using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// Abbuchung pro Antwort, nicht pro Versuch: Netzabbruch + Wiederholung (gleiche Request-Id) kostet nichts extra,
/// Fehler jeder Art werden erstattet, und ohne Ai:Owners gilt das erste Konto als Inhaber.
/// </summary>
[Collection(ApiCollection.Name)]
public class AiRequestTests
{
    private readonly SprintLogApiFactory _factory;

    public AiRequestTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static async Task<int> RemainingAsync(HttpClient client) =>
        (await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await client.GetAsync("/api/ai/status"))).Remaining;

    [Fact]
    public async Task Retrying_with_the_same_request_id_returns_the_same_answer_and_charges_once()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (_, n) => AiResponse.FromText($"Antwort {n}");
        var body = new { question = "Was trainiere ich heute?", mode = "deep", requestId = "req-0001-abcdef" };

        var first = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", body));
        var again = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", body));

        Assert.Equal("Antwort 0", first.Answer);
        Assert.Equal(first.Answer, again.Answer);
        Assert.Single(_factory.Ai.Requests);
        Assert.Equal(12 - 4, await RemainingAsync(user.Client));

        // Neue Frage = neue Id = neue Abbuchung
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", body with { requestId = "req-0002-abcdef" }));
        Assert.Equal(12 - 8, await RemainingAsync(user.Client));
    }

    [Fact]
    public async Task Parallel_retry_while_the_answer_is_still_running_joins_it()
    {
        var user = await _factory.CreateUserAsync();
        var gate = new TaskCompletionSource();
        _factory.Ai.Delay = () => gate.Task;
        var body = new { question = "Lange Frage", mode = "deep", requestId = "req-parallel-01" };

        var a = user.Client.PostAsJsonAsync("/api/ai/ask", body);
        await WaitUntil(() => _factory.Ai.Requests.Count == 1);
        var b = user.Client.PostAsJsonAsync("/api/ai/ask", body); // "Funkloch" -> Client fragt erneut
        await Task.Delay(150);
        gate.SetResult();

        Assert.Equal(HttpStatusCode.OK, (await a).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await b).StatusCode);
        Assert.Single(_factory.Ai.Requests);
        Assert.Equal(12 - 4, await RemainingAsync(user.Client));
    }

    [Fact]
    public async Task Every_kind_of_failure_is_refunded_and_a_failed_request_id_can_be_retried()
    {
        var user = await _factory.CreateUserAsync();
        // Unerwarteter Fehler (z. B. Datenbank): 500, aber nichts abgebucht
        _factory.Ai.Reply = (_, _) => throw new InvalidOperationException("kaputt");
        var res = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage eins", mode = "deep", requestId = "req-fail-0001" });
        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Equal(12, await RemainingAsync(user.Client));

        // Dieselbe Id danach: wird neu gerechnet (Fehler werden nicht gemerkt)
        _factory.Ai.Reply = (_, _) => AiResponse.FromText("jetzt klappt es");
        var ok = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage eins", mode = "deep", requestId = "req-fail-0001" }));
        Assert.Equal("jetzt klappt es", ok.Answer);
        Assert.Equal(12 - 4, await RemainingAsync(user.Client));
    }

    [Theory]
    [InlineData("kurz")]
    [InlineData("mit leerzeichen drin")]
    [InlineData("<script>alert(1)</script>")]
    public async Task Invalid_request_ids_are_rejected(string id)
    {
        var user = await _factory.CreateUserAsync();
        var res = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage", requestId = id });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Without_configured_owners_the_first_registered_account_gets_the_large_quota()
    {
        await _factory.CreateUserAsync(); // es gibt mindestens ein Konto
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var firstId = db.Users.OrderBy(u => u.Id).Select(u => u.Id).First();
        var quota = new AiQuota(Options.Create(new AiOptions { DailyLimit = 12, OwnerDailyLimit = 60 }), TimeProvider.System);

        static ClaimsPrincipal As(int id, string name) =>
            new(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Name, name) }, "test"));

        Assert.Equal(60, await quota.LimitForAsync(As(firstId, "wer-auch-immer"), db, default));
        Assert.Equal(12, await quota.LimitForAsync(As(firstId + 1, "jemand"), db, default));

        // Mit Ai:Owners zählt nur der Name
        var named = new AiQuota(Options.Create(new AiOptions { DailyLimit = 12, OwnerDailyLimit = 60, Owners = { "Illia" } }), TimeProvider.System);
        Assert.Equal(12, await named.LimitForAsync(As(firstId, "erster"), db, default));
        Assert.Equal(60, await named.LimitForAsync(As(firstId + 5, "illia"), db, default));
    }

    private static async Task WaitUntil(Func<bool> condition)
    {
        for (var i = 0; i < 100 && !condition(); i++) await Task.Delay(20);
        Assert.True(condition());
    }
}
