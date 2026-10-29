using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Anmeldung. Zwei Arten von Clients:
/// <list type="bullet">
/// <item>Browser-App (Header X-Requested-With: SprintLog): Sitzung in httpOnly-Cookies, kein Token im Body.</item>
/// <item>API-Clients (Swagger, Skripte, Tests): Bearer-Token im Body, keine Cookies.</item>
/// </list>
/// </summary>
public static class AuthEndpoints
{
    public const string RateLimitPolicy = "auth";

    // Wird verglichen, wenn der Nutzer nicht existiert - so dauert ein Login mit unbekanntem
    // Namen genauso lange wie mit falschem Passwort (kein Erraten von Nutzernamen über die Antwortzeit).
    internal static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("sprintlog-timing-dummy");

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register).RequireRateLimiting(RateLimitPolicy);
        group.MapPost("/login", Login).RequireRateLimiting(RateLimitPolicy);
        group.MapPost("/refresh", Refresh);
        group.MapPost("/logout", Logout);
        group.MapPost("/logout-all", LogoutAll).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization();
        group.MapGet("/options", (IEmailSender email) => Results.Ok(new AuthOptionsResponse(email.IsEnabled)));
        group.MapDelete("/account", DeleteAccount).RequireAuthorization().RequireRateLimiting(RateLimitPolicy);
    }

    /// <summary>Erfolgreiche Anmeldung abschließen: Cookie-Sitzung für die Browser-App, sonst Bearer-Token.</summary>
    internal static async Task<TokenResponse> SignInAsync(HttpContext http, User user, AuthSessionService sessions, ITokenService tokens,
        CancellationToken ct, string[]? recoveryCodes = null)
    {
        if (AuthSessionService.IsBrowserClient(http.Request))
        {
            await sessions.StartAsync(http, user, ct);
            return new TokenResponse(null, user.Username, user.Id, recoveryCodes);
        }
        return new TokenResponse(tokens.CreateBearerToken(user), user.Username, user.Id, recoveryCodes);
    }

    private static async Task<IResult> Register(RegisterRequest req, HttpContext http, AppDbContext db, AuthSessionService sessions,
        ITokenService tokens, RecoveryCodeService recovery, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var username = req.Username!.Trim();
        var normalized = username.ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Username.ToLower() == normalized, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Username is already taken.");

        var user = new User
        {
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Zwei gleichzeitige Registrierungen mit demselben Namen - der Unique-Index greift.
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Username is already taken.");
        }

        // Wiederherstellungscodes gleich mitgeben: ohne E-Mail ist das der einzige Weg zurück ins Konto.
        var codes = await recovery.RegenerateAsync(user.Id, ct);
        return Results.Created("/api/auth/me", await SignInAsync(http, user, sessions, tokens, ct, codes));
    }

    private static async Task<IResult> Login(LoginRequest req, HttpContext http, AppDbContext db, AuthSessionService sessions,
        ITokenService tokens, ILoggerFactory logs, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrEmpty(req.Password))
            return InvalidCredentials();

        var normalized = req.Username.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == normalized, ct);

        var passwordOk = BCrypt.Net.BCrypt.Verify(req.Password, user?.PasswordHash ?? DummyHash);
        if (user is null || !passwordOk)
        {
            // Kein Benutzername im Log (personenbezogen) - bei bekanntem Konto nur die ID.
            logs.CreateLogger("SprintLog.Security").LogInformation("Security: failed login ({Account})", user is null ? "unknown account" : $"user {user.Id}");
            return InvalidCredentials();
        }

        return Results.Ok(await SignInAsync(http, user, sessions, tokens, ct));
    }

    /// <summary>
    /// Browser-App: Refresh-Token aus dem Cookie rotieren (neue Cookies, kein Token im Body).
    /// Ältere App-Versionen bzw. API-Clients mit gültigem Bearer-Token: neuer Token - mit dem Header der
    /// Browser-App wird dabei auf eine Cookie-Sitzung umgestellt (Übergang von localStorage zu Cookies).
    /// </summary>
    private static async Task<IResult> Refresh(HttpContext http, AppDbContext db, AuthSessionService sessions, ITokenService tokens, CancellationToken ct)
    {
        var browser = AuthSessionService.IsBrowserClient(http.Request);

        if (browser && http.Request.Cookies.ContainsKey(AuthSessionService.RefreshCookie))
        {
            var (status, rotated) = await sessions.RotateAsync(http, ct);
            switch (status)
            {
                case AuthSessionService.RotateStatus.Ok:
                    return Results.Ok(new TokenResponse(null, rotated!.Username, rotated.Id));
                case AuthSessionService.RotateStatus.Race:
                    // Ein anderer Tab hat eben rotiert - die neuen Cookies sind schon im Browser. Client versucht es erneut.
                    return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Session is being refreshed. Retry.");
                default:
                    AuthSessionService.ClearCookies(http);
                    return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Session expired. Please log in again.");
            }
        }

        // Bearer-Token oder (noch gültiger) Access-Cookie
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Existiert das Konto noch? (z. B. nach dem Löschen des Accounts auf einem anderen Gerät)
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Results.Unauthorized();

        return Results.Ok(await SignInAsync(http, user, sessions, tokens, ct));
    }

    private static async Task<IResult> Logout(HttpContext http, AuthSessionService sessions, CancellationToken ct)
    {
        await sessions.EndAsync(http, ct);
        return Results.NoContent();
    }

    /// <summary>Alle Geräte abmelden: Token-Version erhöhen (alle JWTs ungültig) und alle Refresh-Tokens widerrufen.</summary>
    private static async Task<IResult> LogoutAll(HttpContext http, AppDbContext db, AuthSessionService sessions, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        await db.Users.Where(u => u.Id == userId).ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1), ct);
        await sessions.RevokeAllAsync(userId.Value, ct);
        AuthSessionService.ClearCookies(http);
        return Results.NoContent();
    }

    private static async Task<IResult> Me(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var me = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new MeResponse(
                u.Id,
                u.Username,
                u.CreatedAt,
                u.Workouts.Count,
                u.CustomExercises.Count,
                u.Email,
                u.EmailVerifiedAt != null,
                db.RecoveryCodes.Count(c => c.UserId == u.Id && c.UsedAt == null)))
            .FirstOrDefaultAsync(ct);

        return me is null ? Results.Unauthorized() : Results.Ok(me);
    }

    /// <summary>Löscht das Konto inkl. aller Daten (Recht auf Löschung, Art. 17 DSGVO).</summary>
    private static async Task<IResult> DeleteAccount([FromBody] DeleteAccountRequest req, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Results.Unauthorized();

        if (string.IsNullOrEmpty(req.Password) || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Password is incorrect.");

        // Reihenfolge wichtig: zuerst Sätze, dann alles, was darauf verweist.
        // Refresh-Tokens, Wiederherstellungscodes und E-Mail-Tokens löscht die Datenbank per Cascade mit dem Nutzer.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.WorkoutSets.Where(s => s.Workout.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Workouts.Where(w => w.UserId == userId).ExecuteDeleteAsync(ct);
        await db.DeletedWorkouts.Where(d => d.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Favorites.Where(f => f.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Programs.Where(p => p.UserId == userId).ExecuteDeleteAsync(ct); // Tage + Vorgaben per Cascade
        await db.Exercises.Where(e => e.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);

        AuthSessionService.ClearCookies(http);
        return Results.NoContent();
    }

    internal static IResult InvalidCredentials() =>
        Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password.");
}
