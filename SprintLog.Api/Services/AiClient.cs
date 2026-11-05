using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Services;

public sealed record AiMessage(string Role, string Content);

/// <summary>Werkzeug mit festem JSON-Schema - erzwingt strukturierte Antworten (z. B. einen Trainingsplan).</summary>
public sealed record AiTool(string Name, string Description, JsonObject InputSchema);

public sealed record AiCompletion(string? Text, JsonElement? ToolInput, int InputTokens, int OutputTokens);

/// <summary>Fehler der KI mit stabilem Code für den Client (Text kommt aus den App-Übersetzungen).</summary>
public sealed class AiException(string code, HttpStatusCode status, string? detail = null) : Exception(detail ?? code)
{
    public string Code { get; } = code;
    public HttpStatusCode Status { get; } = status;
}

public interface IAiClient
{
    bool IsEnabled { get; }
    Task<AiCompletion> CompleteAsync(string system, IReadOnlyList<AiMessage> messages, int maxTokens, AiTool? tool, CancellationToken ct);
}

/// <summary>Kein API-Key gesetzt: KI-Funktionen sind ausgeblendet.</summary>
public sealed class DisabledAiClient : IAiClient
{
    public bool IsEnabled => false;
    public Task<AiCompletion> CompleteAsync(string system, IReadOnlyList<AiMessage> messages, int maxTokens, AiTool? tool, CancellationToken ct) =>
        throw new AiException("ai_disabled", HttpStatusCode.ServiceUnavailable);
}

/// <summary>Messages-API von Anthropic (https://docs.claude.com/en/api/messages).</summary>
public sealed class AnthropicAiClient : IAiClient
{
    private readonly HttpClient _http;
    private readonly AiOptions _options;
    private readonly ILogger<AnthropicAiClient> _log;

    public AnthropicAiClient(HttpClient http, IOptions<AiOptions> options, ILogger<AnthropicAiClient> log)
    {
        _http = http;
        _options = options.Value;
        _log = log;
    }

    public bool IsEnabled => true;

    public async Task<AiCompletion> CompleteAsync(string system, IReadOnlyList<AiMessage> messages, int maxTokens, AiTool? tool, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = _options.Model,
            ["max_tokens"] = maxTokens,
            ["system"] = system,
            ["messages"] = new JsonArray(messages.Select(m => (JsonNode)new JsonObject { ["role"] = m.Role, ["content"] = m.Content }).ToArray()),
        };
        if (tool is not null)
        {
            body["tools"] = new JsonArray(new JsonObject { ["name"] = tool.Name, ["description"] = tool.Description, ["input_schema"] = tool.InputSchema.DeepClone() });
            body["tool_choice"] = new JsonObject { ["type"] = "tool", ["name"] = tool.Name };
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/messages") { Content = JsonContent.Create(body) };
        request.Headers.Add("x-api-key", _options.ApiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");

        HttpResponseMessage response;
        try { response = await _http.SendAsync(request, ct); }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            _log.LogWarning(e, "Claude API not reachable");
            throw new AiException("ai_unavailable", HttpStatusCode.ServiceUnavailable);
        }

        using (response)
        {
            var json = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode) throw MapError(response.StatusCode, json);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string? text = null;
            JsonElement? toolInput = null;
            foreach (var block in root.GetProperty("content").EnumerateArray())
            {
                var type = block.GetProperty("type").GetString();
                if (type == "text") text = (text ?? string.Empty) + block.GetProperty("text").GetString();
                else if (type == "tool_use") toolInput = block.GetProperty("input").Clone();
            }
            var usage = root.TryGetProperty("usage", out var u) ? u : default;
            int Tokens(string name) => usage.ValueKind == JsonValueKind.Object && usage.TryGetProperty(name, out var v) ? v.GetInt32() : 0;
            _log.LogInformation("Claude call {Model}: {In} in / {Out} out tokens", _options.Model, Tokens("input_tokens"), Tokens("output_tokens"));
            return new AiCompletion(text?.Trim(), toolInput, Tokens("input_tokens"), Tokens("output_tokens"));
        }
    }

    private AiException MapError(HttpStatusCode status, string body)
    {
        // Nur Typ und Status loggen - der Text kann Teile der Anfrage enthalten
        var type = "unknown";
        var message = string.Empty;
        try
        {
            using var doc = JsonDocument.Parse(body);
            var err = doc.RootElement.GetProperty("error");
            type = err.GetProperty("type").GetString() ?? type;
            message = err.TryGetProperty("message", out var m) ? m.GetString() ?? string.Empty : string.Empty;
        }
        catch (Exception) { /* kein JSON */ }
        _log.LogWarning("Claude API error {Status} {Type}", (int)status, type);

        if (message.Contains("credit balance", StringComparison.OrdinalIgnoreCase))
            return new AiException("ai_no_credit", HttpStatusCode.ServiceUnavailable);
        return status switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => new AiException("ai_key_invalid", HttpStatusCode.ServiceUnavailable),
            HttpStatusCode.TooManyRequests or (HttpStatusCode)529 => new AiException("ai_busy", HttpStatusCode.ServiceUnavailable),
            _ => new AiException("ai_unavailable", HttpStatusCode.BadGateway),
        };
    }
}

/// <summary>
/// Tageskontingent pro Nutzer (im Speicher - nach einem Neustart beginnt es neu; der Kontostand bei Anthropic ist
/// die harte Grenze). Schützt vor versehentlichen Schleifen und hält die Kosten planbar.
/// </summary>
public sealed class AiQuota(IOptions<AiOptions> options, TimeProvider time)
{
    private readonly ConcurrentDictionary<int, (DateOnly Day, int Used)> _used = new();

    public int Limit => Math.Max(1, options.Value.DailyLimit);

    private DateOnly Today => DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);

    public int Remaining(int userId) =>
        _used.TryGetValue(userId, out var u) && u.Day == Today ? Math.Max(0, Limit - u.Used) : Limit;

    /// <summary>Bucht <paramref name="cost"/> Einheiten, wenn genug übrig ist.</summary>
    public bool TryTake(int userId, int cost)
    {
        var today = Today;
        while (true)
        {
            var current = _used.GetOrAdd(userId, (today, 0));
            var used = current.Day == today ? current.Used : 0;
            if (used + cost > Limit) return false;
            if (_used.TryUpdate(userId, (today, used + cost), current)) return true;
        }
    }

    /// <summary>Fehlgeschlagene Anfrage zählt nicht.</summary>
    public void Refund(int userId, int cost) =>
        _used.AddOrUpdate(userId, (Today, 0), (_, u) => (u.Day, Math.Max(0, u.Used - cost)));
}
