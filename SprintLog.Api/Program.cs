using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SprintLog.Api.Data;
using SprintLog.Api.Endpoints;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Services;

// .env aus dem Projekt- oder Repo-Ordner laden. Echte Umgebungsvariablen (Docker, Render) haben Vorrang.
Env.NoClobber().TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

// ---------- Konfiguration ----------
builder.Services.AddOptions<JwtOptions>()
    .Configure<IConfiguration>((options, config) =>
    {
        // "JWT_SECRET" bleibt unterstützt, damit bestehende Deployments (Render) ohne Änderung laufen.
        options.Secret = config["Jwt:Secret"] ?? config["JWT_SECRET"] ?? string.Empty;
        options.Issuer = config["Jwt:Issuer"] ?? options.Issuer;
        options.Audience = config["Jwt:Audience"] ?? options.Audience;
        options.LifetimeDays = config.GetValue("Jwt:LifetimeDays", options.LifetimeDays);
    })
    .Validate(o => o.HasValidSecret, "JWT secret is missing or shorter than 32 bytes. Set JWT_SECRET.")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ITokenService, TokenService>();

// ---------- Datenbank ----------
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    var connectionString = sp.GetRequiredService<IConfiguration>().GetConnectionString("DefaultConnection");
    // Ohne Connection-String (z. B. bei "dotnet ef") wird nur der Provider registriert - geprüft wird nach Build().
    if (string.IsNullOrWhiteSpace(connectionString)) options.UseNpgsql();
    else options.UseNpgsql(connectionString);
});

// ---------- Authentifizierung (JWT) ----------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
    {
        bearer.MapInboundClaims = true;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Value.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Value.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Secret))
        };
    });
builder.Services.AddAuthorization();

// ---------- Rate Limiting (Schutz vor Brute-Force auf Login/Registrierung) ----------
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthEndpoints.RateLimitPolicy, http =>
    {
        var limit = http.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimiting:AuthPermitLimit", 10);
        return RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });
    });
});

// Hinter dem Render-Proxy: echte Client-IP aus X-Forwarded-For übernehmen (wichtig für das Rate Limiting).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// ---------- API-Infrastruktur ----------
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "SprintLog API", Version = "v3" });
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    c.AddSecurityDefinition("Bearer", scheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

var app = builder.Build();

// Fail fast: ohne Datenbank kann die API nicht arbeiten.
if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("DefaultConnection")))
    throw new InvalidOperationException("Connection string 'DefaultConnection' is missing. Set ConnectionStrings__DefaultConnection.");

// ---------- Datenbank-Migrationen (optional beim Start) ----------
if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        app.Logger.LogInformation("Database schema is up to date.");
    }
    else
    {
        // Schlägt eine Migration fehl, startet die App nicht -> Render behält die alte, laufende Version.
        app.Logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
        await db.Database.MigrateAsync();
        app.Logger.LogInformation("Migrations applied.");
    }
}

// ---------- Middleware-Pipeline ----------
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next();
});

if (app.Environment.IsDevelopment() || app.Configuration.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "SprintLog API v3"));
}

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Service Worker und HTML nie cachen, damit Updates sofort ankommen.
        var path = ctx.File.Name;
        if (path is "sw.js" or "index.html" or "manifest.json")
            ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapAuthEndpoints();
app.MapExerciseEndpoints();
app.MapFavoriteEndpoints();
app.MapWorkoutEndpoints();

app.Run();

/// <summary>Für WebApplicationFactory in den Integrationstests.</summary>
public partial class Program { }
