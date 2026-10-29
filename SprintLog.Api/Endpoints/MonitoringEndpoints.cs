using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Öffentliche Laufzeit-Konfiguration für die Web-App und ein Tunnel für Browser-Fehler zu Sentry.
/// Der Tunnel hält die Content-Security-Policy bei connect-src 'self' (kein Drittanbieter-Host im Browser)
/// und funktioniert auch, wenn Werbeblocker sentry.io blockieren.
/// </summary>
public static class MonitoringEndpoints
{
    public const string RateLimitPolicy = "monitoring";
    public const int MaxEnvelopeBytes = 256 * 1024;

    public static void MapMonitoringEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/config", (MonitoringOptions options) => Results.Ok(new ClientConfig(
                options.BrowserDsnParts is null ? null : string.IsNullOrWhiteSpace(options.BrowserDsn) ? options.Dsn : options.BrowserDsn,
                options.Environment,
                options.Release)))
            .AllowAnonymous()
            .WithTags("Monitoring");

        app.MapPost("/api/monitoring/tunnel", Tunnel)
            .AllowAnonymous()
            .RequireRateLimiting(RateLimitPolicy)
            .ExcludeFromDescription();
    }

    public sealed record ClientConfig(string? SentryDsn, string Environment, string Release);

    private static async Task<IResult> Tunnel(HttpRequest request, MonitoringOptions options, IHttpClientFactory httpClients, ILoggerFactory loggers, CancellationToken ct)
    {
        var target = options.BrowserDsnParts;
        if (target is null) return Results.NotFound();
        if (request.ContentLength > MaxEnvelopeBytes) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);

        // Body mit Obergrenze lesen (ContentLength kann fehlen).
        using var buffer = new MemoryStream();
        var chunk = new byte[16 * 1024];
        int read;
        while ((read = await request.Body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxEnvelopeBytes) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
            buffer.Write(chunk, 0, read);
        }
        var body = buffer.ToArray();

        // Erste Zeile des Envelopes = JSON-Header mit dem DSN. Nur an UNSER Projekt weiterleiten - sonst wäre das ein offener Proxy.
        var newline = Array.IndexOf(body, (byte)'\n');
        var headerJson = Encoding.UTF8.GetString(body, 0, newline < 0 ? body.Length : newline);
        string? dsn;
        try
        {
            using var header = JsonDocument.Parse(headerJson);
            dsn = header.RootElement.TryGetProperty("dsn", out var value) ? value.GetString() : null;
        }
        catch (JsonException)
        {
            return Results.BadRequest();
        }
        if (SentryDsnParts.TryParse(dsn) is not { } parts || !parts.SameTarget(target)) return Results.BadRequest();

        var client = httpClients.CreateClient(nameof(MonitoringEndpoints));
        using var content = new ByteArrayContent(body);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/x-sentry-envelope");
        try
        {
            using var response = await client.PostAsync(target.EnvelopeUri, content, ct);
            return Results.StatusCode((int)response.StatusCode);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            loggers.CreateLogger(nameof(MonitoringEndpoints)).LogWarning("Sentry tunnel: upstream not reachable ({Error})", e.Message);
            return Results.StatusCode(StatusCodes.Status502BadGateway);
        }
    }
}
