using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SprintLog.Api.DTOs;
using SprintLog.Api.Endpoints;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// "Ответ не пришёл" nach langer Wartezeit: Das Modell endet nach Werkzeug-Ergebnissen manchmal leer (stop_reason end_turn).
/// Der Server bittet dann einmal um die Antwort, statt sofort ai_empty zu melden, und erzwingt die Antwort nach einem Zeitbudget.
/// </summary>
[Collection(ApiCollection.Name)]
public class CoachEmptyAnswerTests
{
    private readonly SprintLogApiFactory _factory;

    public CoachEmptyAnswerTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static AiResponse Empty() => new(new JsonArray(), "end_turn", 0, 0);

    private static string Code(HttpResponseMessage r) =>
        r.Content.ReadFromJsonAsync<JsonElement>().GetAwaiter().GetResult().GetProperty("code").GetString()!;

    [Fact]
    public async Task Empty_answer_after_tool_results_gets_one_nudge_and_then_the_real_answer()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (req, n) => n switch
        {
            0 => AiResponse.FromTool("get_personal_records", new { }),
            1 => Empty(),
            _ => AiResponse.FromText("Dienstag ist MD-4 - mach die Kraft dort."),
        };

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Was mache ich diese Woche?", mode = "deep" }));
        Assert.Equal("Dienstag ist MD-4 - mach die Kraft dort.", res.Answer);

        Assert.Equal(3, _factory.Ai.Requests.Count);
        var nudge = _factory.Ai.Requests[2];
        Assert.Equal("none", (string?)nudge.ToolChoice!["type"]);
        // Die leere Antwort wird nicht zurückgeschickt (die API lehnt leere Nachrichten ab), die Bitte kommt als neue Nachricht
        var sent = nudge.Messages.Select(m => m!.AsObject()).ToList();
        Assert.DoesNotContain(sent, m => (string?)m["role"] == "assistant" && m["content"] is JsonArray { Count: 0 });
        Assert.Equal(AiEndpoints.EmptyAnswerNudge, (string?)sent[^1]["content"]);
    }

    [Fact]
    public async Task Still_empty_after_the_nudge_reports_ai_empty_and_refunds_the_quota()
    {
        var user = await _factory.CreateUserAsync();
        var status = await HttpAssert.JsonAsync<JsonElement>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        var before = status.GetProperty("remaining").GetInt32();

        _factory.Ai.Reply = (_, _) => Empty();
        var failed = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Hallo?", mode = "deep" });
        Assert.Equal(HttpStatusCode.BadGateway, failed.StatusCode);
        Assert.Equal("ai_empty", Code(failed));
        Assert.Equal(2, _factory.Ai.Requests.Count); // Frage + genau eine Bitte, keine Endlosschleife

        status = await HttpAssert.JsonAsync<JsonElement>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.Equal(before, status.GetProperty("remaining").GetInt32());
    }

    /// <summary>Uhr, die nur der Test weiterdreht.</summary>
    private sealed class ManualClock : TimeProvider
    {
        public TimeSpan Elapsed { get; set; }
        public override long TimestampFrequency => TimeSpan.TicksPerSecond;
        public override long GetTimestamp() => Elapsed.Ticks;
    }

    [Fact]
    public async Task After_the_time_budget_the_next_step_forces_the_answer()
    {
        var user = await _factory.CreateUserAsync();
        var clock = new ManualClock();
        _factory.Ai.Reply = (req, _) =>
        {
            clock.Elapsed += TimeSpan.FromSeconds(30); // jede Runde im gründlichen Modus dauert spürbar
            return req.ToolChoice is not null ? AiResponse.FromText("Kurz und klar.") : AiResponse.FromTool("get_personal_records", new { });
        };

        using var scope = _factory.Services.CreateScope();
        var tools = scope.ServiceProvider.GetRequiredService<AiTools>();
        var messages = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = "Rekorde?" });
        var run = await AiEndpoints.RunAsync(_factory.Ai, tools, user.UserId, "model", "system", messages, AiTools.ChatTools,
            1000, 8, null, NullLoggerFactory.Instance, CancellationToken.None, clock);

        Assert.Equal("Kurz und klar.", run.Text);
        // 0 s und 30 s: Werkzeuge erlaubt; ab 60 s (> 55 s Budget) wird die Antwort erzwungen - statt bis zu 8 Runden
        Assert.Equal(3, _factory.Ai.Requests.Count);
        Assert.Null(_factory.Ai.Requests[1].ToolChoice);
        Assert.Equal("none", (string?)_factory.Ai.Requests[2].ToolChoice!["type"]);
    }
}
