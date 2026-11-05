using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Services;

/// <summary>Werkzeug mit JSON-Schema, das das Modell aufrufen kann (Statistik abfragen, Plan vorschlagen ...).</summary>
public sealed record AiTool(string Name, string Description, JsonObject InputSchema);

/// <summary>
/// Eine Anfrage an die Messages-API. <see cref="Messages"/> enthält Inhalte im Format der API
/// (Text, tool_use, tool_result), damit Werkzeug-Schleifen möglich sind.
/// </summary>
public sealed record AiRequest(string Model, string System, JsonArray Messages, int MaxTokens, IReadOnlyList<AiTool>? Tools = null, JsonObject? ToolChoice = null);

public sealed record AiToolUse(string Id, string Name, JsonElement Input);

public sealed record AiResponse(JsonArray Content, string? StopReason, int InputTokens, int OutputTokens)
{
    public string Text => string.Join("\n", Content.OfType<JsonObject>()
        .Where(b => (string?)b["type"] == "text").Select(b => (string?)b["text"] ?? string.Empty)).Trim();

    public IReadOnlyList<AiToolUse> ToolUses => Content.OfType<JsonObject>()
        .Where(b => (string?)b["type"] == "tool_use")
        .Select(b => new AiToolUse((string?)b["id"] ?? string.Empty, (string?)b["name"] ?? string.Empty,
            JsonSerializer.Deserialize<JsonElement>(b["input"]?.ToJsonString() ?? "{}")))
        .ToList();

    /// <summary>Hilfen für Tests und Fakes.</summary>
    public static AiResponse FromText(string text) =>
        new(new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }), "end_turn", 0, 0);

    public static AiResponse FromTool(string name, object input, string id = "toolu_1") =>
        new(new JsonArray(new JsonObject { ["type"] = "tool_use", ["id"] = id, ["name"] = name, ["input"] = JsonSerializer.SerializeToNode(input) }), "tool_use", 0, 0);
}

/// <summary>Fehler der KI mit stabilem Code für den Client (Text kommt aus den App-Übersetzungen).</summary>
public sealed class AiException(string code, HttpStatusCode status, string? detail = null) : Exception(detail ?? code)
{
    public string Code { get; } = code;
    public HttpStatusCode Status { get; } = status;
}

public interface IAiClient
{
    bool IsEnabled { get; }
    Task<AiResponse> CompleteAsync(AiRequest request, CancellationToken ct);
}

/// <summary>Kein API-Key gesetzt: KI-Funktionen sind ausgeblendet.</summary>
public sealed class DisabledAiClient : IAiClient
{
    public bool IsEnabled => false;
    public Task<AiResponse> CompleteAsync(AiRequest request, CancellationToken ct) =>
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

    public async Task<AiResponse> CompleteAsync(AiRequest r, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"] = r.Model,
            ["max_tokens"] = r.MaxTokens,
            // Prompt-Caching: Werkzeuge + System-Prompt sind innerhalb einer Werkzeug-Schleife und eines Gesprächs gleich
            ["system"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = r.System, ["cache_control"] = new JsonObject { ["type"] = "ephemeral" } }),
            ["messages"] = r.Messages.DeepClone(),
        };
        if (r.Tools is { Count: > 0 })
        {
            body["tools"] = new JsonArray(r.Tools.Select(t => (JsonNode)new JsonObject
            {
                ["name"] = t.Name, ["description"] = t.Description, ["input_schema"] = t.InputSchema.DeepClone(),
            }).ToArray());
            if (r.ToolChoice is not null) body["tool_choice"] = r.ToolChoice.DeepClone();
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

            var root = JsonNode.Parse(json)!.AsObject();
            var content = root["content"] as JsonArray ?? new JsonArray();
            var usage = root["usage"] as JsonObject;
            int Tokens(string name) => (int?)usage?[name] ?? 0;
            _log.LogInformation("Claude {Model}: {In} in (+{CacheRead} cached) / {Out} out, stop {Stop}",
                r.Model, Tokens("input_tokens"), Tokens("cache_read_input_tokens"), Tokens("output_tokens"), (string?)root["stop_reason"]);
            return new AiResponse((JsonArray)content.DeepClone(), (string?)root["stop_reason"], Tokens("input_tokens"), Tokens("output_tokens"));
        }
    }

    private AiException MapError(HttpStatusCode status, string body)
    {
        // Nur Typ und Status loggen - der Text kann Teile der Anfrage enthalten
        var type = "unknown";
        var message = string.Empty;
        try
        {
            var err = JsonNode.Parse(body)?["error"];
            type = (string?)err?["type"] ?? type;
            message = (string?)err?["message"] ?? string.Empty;
        }
        catch (JsonException) { /* kein JSON */ }
        _log.LogWarning("Claude API error {Status} {Type}", (int)status, type);

        if (message.Contains("credit balance", StringComparison.OrdinalIgnoreCase))
            return new AiException("ai_no_credit", HttpStatusCode.ServiceUnavailable);
        return status switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => new AiException("ai_key_invalid", HttpStatusCode.ServiceUnavailable),
            HttpStatusCode.TooManyRequests or (HttpStatusCode)529 => new AiException("ai_busy", HttpStatusCode.ServiceUnavailable),
            HttpStatusCode.NotFound when type == "not_found_error" => new AiException("ai_model", HttpStatusCode.ServiceUnavailable),
            _ => new AiException("ai_unavailable", HttpStatusCode.BadGateway),
        };
    }
}

/// <summary>
/// Tageskontingent pro Nutzer in Einheiten (schnelle Frage 1, gründliche Antwort und Pläne mehr) - im Speicher, nach einem
/// Neustart beginnt es neu; der Kontostand bei Anthropic ist die harte Grenze. Schützt vor Schleifen und hält Kosten planbar.
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
