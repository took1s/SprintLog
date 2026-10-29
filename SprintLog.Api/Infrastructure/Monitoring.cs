using System.Reflection;
using Sentry;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;

namespace SprintLog.Api.Infrastructure;

/// <summary>
/// Logging (Serilog) und Fehler-Monitoring (Sentry, optional).
/// Ohne DSN läuft alles wie bisher - es werden nur strukturierte Logs auf die Konsole (Render-Logs) geschrieben.
/// </summary>
public sealed class MonitoringOptions
{
    /// <summary>DSN für Server-Fehler (Sentry:Dsn bzw. SENTRY_DSN). Leer = Sentry aus.</summary>
    public string? Dsn { get; set; }

    /// <summary>DSN für Browser-Fehler (Sentry:BrowserDsn bzw. SENTRY_BROWSER_DSN). Standard: derselbe wie <see cref="Dsn"/>.</summary>
    public string? BrowserDsn { get; set; }

    public string Environment { get; set; } = "Production";

    /// <summary>Version des Deployments: Git-Commit von Render (RENDER_GIT_COMMIT) oder die Assembly-Version.</summary>
    public string Release { get; set; } = "sprintlog@dev";

    /// <summary>Anteil der Requests mit Performance-Tracing (0 = aus). Spart das Kontingent im Free-Plan.</summary>
    public double TracesSampleRate { get; set; }

    public SentryDsnParts? BrowserDsnParts => SentryDsnParts.TryParse(string.IsNullOrWhiteSpace(BrowserDsn) ? Dsn : BrowserDsn);
    public bool BackendEnabled => SentryDsnParts.TryParse(Dsn) is not null;

    public static MonitoringOptions From(IConfiguration config, IHostEnvironment env)
    {
        var commit = config["RENDER_GIT_COMMIT"];
        var version = typeof(MonitoringOptions).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return new MonitoringOptions
        {
            Dsn = config["Sentry:Dsn"] ?? config["SENTRY_DSN"],
            BrowserDsn = config["Sentry:BrowserDsn"] ?? config["SENTRY_BROWSER_DSN"],
            Environment = config["Sentry:Environment"] ?? env.EnvironmentName,
            Release = !string.IsNullOrWhiteSpace(commit) ? $"sprintlog@{commit[..Math.Min(12, commit.Length)]}" : $"sprintlog@{version?.Split('+')[0] ?? "dev"}",
            TracesSampleRate = config.GetValue("Sentry:TracesSampleRate", 0.0)
        };
    }
}

/// <summary>Bestandteile eines Sentry-DSN: https://{PublicKey}@{Host}/{ProjectId}</summary>
public sealed record SentryDsnParts(string PublicKey, string Host, string ProjectId, string Scheme)
{
    public Uri EnvelopeUri => new($"{Scheme}://{Host}/api/{ProjectId}/envelope/");

    public static SentryDsnParts? TryParse(string? dsn)
    {
        if (string.IsNullOrWhiteSpace(dsn) || !Uri.TryCreate(dsn.Trim(), UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme is not ("https" or "http") || string.IsNullOrEmpty(uri.UserInfo)) return null;
        var projectId = uri.AbsolutePath.Trim('/').Split('/').LastOrDefault();
        if (string.IsNullOrEmpty(projectId) || !projectId.All(char.IsDigit)) return null;
        return new SentryDsnParts(uri.UserInfo.Split(':')[0], uri.Authority, projectId, uri.Scheme);
    }

    /// <summary>Gleicher Empfänger? (Schlüssel, Host und Projekt - Groß-/Kleinschreibung des Hosts egal.)</summary>
    public bool SameTarget(SentryDsnParts other) =>
        PublicKey == other.PublicKey && ProjectId == other.ProjectId && string.Equals(Host, other.Host, StringComparison.OrdinalIgnoreCase);
}

public static class MonitoringExtensions
{
    /// <summary>Serilog als Logger, Sentry nur mit DSN. Logs gehen zusätzlich an Sentry (Fehler als Event, Rest als Breadcrumbs).</summary>
    public static WebApplicationBuilder AddSprintLogMonitoring(this WebApplicationBuilder builder)
    {
        var options = MonitoringOptions.From(builder.Configuration, builder.Environment);
        // Zur Laufzeit erneut aus der fertigen Konfiguration lesen (Tests setzen Werte erst nach CreateBuilder).
        builder.Services.AddSingleton(sp => MonitoringOptions.From(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IHostEnvironment>()));

        if (options.BackendEnabled)
        {
            builder.WebHost.UseSentry(o =>
            {
                o.Dsn = options.Dsn;
                o.Environment = options.Environment;
                o.Release = options.Release;
                o.SendDefaultPii = false;          // keine IP-Adressen, Cookies oder Header
                o.MaxRequestBodySize = Sentry.Extensibility.RequestSize.None; // Passwörter stehen im Body
                o.TracesSampleRate = options.TracesSampleRate;
                o.MinimumEventLevel = LogLevel.Error;
                o.MinimumBreadcrumbLevel = LogLevel.Information;
                o.SetBeforeSend(SentryScrubber.Scrub);
            });
        }

        var json = string.Equals(builder.Configuration["Logging:Format"], "json", StringComparison.OrdinalIgnoreCase);
        builder.Host.UseSerilog((context, services, logger) =>
        {
            logger
                .ReadFrom.Configuration(context.Configuration)
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
                .MinimumLevel.Override("System.Net.Http.HttpClient", LogEventLevel.Warning)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Release", options.Release);
            if (json)
                logger.WriteTo.Console(new RenderedCompactJsonFormatter());
            else
                logger.WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}");
        }, writeToProviders: true); // Sentry hängt sich als ILogger-Provider an - Serilog reicht die Logs dorthin weiter.

        return builder;
    }

    /// <summary>Eine Zeile pro API-Request (Methode, Pfad, Status, Dauer, Nutzer-ID). /health und statische Dateien nicht.</summary>
    public static IApplicationBuilder UseSprintLogRequestLogging(this IApplicationBuilder app) =>
        app.UseSerilogRequestLogging(o =>
        {
            o.MessageTemplate = "HTTP {RequestMethod} {RequestPath} -> {StatusCode} in {Elapsed:0} ms";
            o.GetLevel = (http, _, exception) =>
                http.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose
                // 5xx als Warnung: die Exception selbst wird schon als Fehler geloggt (sonst doppelt in Sentry).
                : exception is not null || http.Response.StatusCode >= 500 ? LogEventLevel.Warning
                : LogEventLevel.Information;
            o.EnrichDiagnosticContext = (diagnostics, http) =>
            {
                if (http.User.GetUserId() is { } userId) diagnostics.Set("UserId", userId);
                if (http.Request.Headers.TryGetValue("X-Client-Version", out var client)) diagnostics.Set("ClientVersion", client.ToString());
            };
        });

    /// <summary>Nutzer-ID (keine Namen/E-Mails) an Sentry-Events hängen, damit sich Fehler einem Konto zuordnen lassen.</summary>
    public static IApplicationBuilder UseSentryUser(this IApplicationBuilder app) =>
        app.Use(async (http, next) =>
        {
            if (http.User.GetUserId() is { } userId && SentrySdk.IsEnabled)
                SentrySdk.ConfigureScope(scope => scope.User = new SentryUser { Id = userId.ToString() });
            await next();
        });
}

/// <summary>Letzte Sicherung, bevor ein Event den Server verlässt: sensible Felder entfernen.</summary>
public static class SentryScrubber
{
    private static readonly string[] SensitiveKeys = ["password", "passwort", "token", "code", "secret", "authorization", "cookie"];

    public static SentryEvent? Scrub(SentryEvent e, SentryHint _)
    {
        e.Request.Cookies = null;
        e.Request.Data = null;
        foreach (var key in e.Request.Headers.Keys.Where(IsSensitive).ToList()) e.Request.Headers.Remove(key);
        if (!string.IsNullOrEmpty(e.Request.QueryString)) e.Request.QueryString = "[filtered]";
        foreach (var key in e.Extra.Keys.Where(IsSensitive).ToList()) e.SetExtra(key, "[filtered]");
        return e;
    }

    public static bool IsSensitive(string key) => SensitiveKeys.Any(s => key.Contains(s, StringComparison.OrdinalIgnoreCase));
}
