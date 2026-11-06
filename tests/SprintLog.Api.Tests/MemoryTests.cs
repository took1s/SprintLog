using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// Gedächtnis des KI-Coachs: merken per Werkzeug (mit Hinweis an den Client), in späteren Prompts wieder da, aktualisieren
/// statt duplizieren, vergessen, Obergrenze, Ablaufdatum, Verwaltung durch den Nutzer und strikte Trennung zwischen Konten.
/// </summary>
[Collection(ApiCollection.Name)]
public class MemoryTests
{
    private readonly SprintLogApiFactory _factory;

    public MemoryTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static string ToolResult(AiRequest request) =>
        request.Messages.OfType<JsonObject>().Last()["content"]!.AsArray().OfType<JsonObject>()
            .First(b => (string?)b["type"] == "tool_result")["content"]!.GetValue<string>();

    /// <summary>Erster Aufruf: Werkzeug, zweiter: Antworttext. Liefert die Antwort des Servers.</summary>
    private async Task<AiAskResponse> AskWithToolAsync(TestUser user, string tool, object input, string answer = "Notiert.")
    {
        _factory.Ai.Reset((_, n) => n == 0 ? AiResponse.FromTool(tool, input) : AiResponse.FromText(answer));
        return await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Info für dich" }));
    }

    private static async Task<List<CoachMemoryDto>> ListAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<CoachMemoryDto>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/memory"));

    [Fact]
    public async Task Coach_remembers_a_fact_reports_it_and_sees_it_in_later_conversations()
    {
        var user = await _factory.CreateUserAsync();
        var res = await AskWithToolAsync(user, "remember", new { content = "Spielt sonntags 11 Uhr Kreisliga", category = "schedule", importance = 2 });

        var change = Assert.Single(res.Memory!);
        Assert.Equal("saved", change.Action);
        Assert.Equal("schedule", change.Category);
        var entry = Assert.Single(await ListAsync(user));
        Assert.Equal(change.Id, entry.Id);
        Assert.Equal("ai", entry.Source);
        Assert.Null(entry.ExpiresAt);

        // Nächstes Gespräch (ohne Verlauf): der Fakt steht im Prompt, mit Id zum Aktualisieren
        _factory.Ai.Reset((_, _) => AiResponse.FromText("Sonntag ist Spieltag."));
        var next = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wann spiele ich?" }));
        Assert.Empty(next.Memory!);
        var system = _factory.Ai.Requests[0].System;
        Assert.Contains("<coach_memory", system);
        Assert.Contains($"[#{entry.Id} schedule", system);
        Assert.Contains("Spielt sonntags 11 Uhr Kreisliga", system);
        Assert.Contains("remember", _factory.Ai.Requests[0].Tools!.Select(t => t.Name));
    }

    [Fact]
    public async Task Same_fact_updates_instead_of_duplicating_replace_and_forget_work_and_stay_in_the_own_account()
    {
        var user = await _factory.CreateUserAsync();
        var first = Assert.Single((await AskWithToolAsync(user, "remember", new { content = "Knie zwickt bei tiefen Kniebeugen", category = "injury", importance = 3 })).Memory!);

        // Gleicher Fakt anders geschrieben -> derselbe Eintrag
        var again = Assert.Single((await AskWithToolAsync(user, "remember", new { content = "knie zwickt bei tiefen Kniebeugen!", category = "injury" })).Memory!);
        Assert.Equal(("updated", first.Id), (again.Action, again.Id));
        Assert.Single(await ListAsync(user));

        // Ersetzen per Id (z. B. Status besser geworden)
        var replaced = Assert.Single((await AskWithToolAsync(user, "remember", new { content = "Knie seit 05.11. schmerzfrei bei Kniebeugen bis parallel", category = "injury", importance = 2, replacesId = first.Id })).Memory!);
        Assert.Equal(("updated", first.Id), (replaced.Action, replaced.Id));
        var entry = Assert.Single(await ListAsync(user));
        Assert.StartsWith("Knie seit 05.11.", entry.Content);
        Assert.Equal(2, entry.Importance);

        // Fremdes Konto kann den Eintrag weder vergessen noch ersetzen
        var other = await _factory.CreateUserAsync();
        _factory.Ai.Reset((_, n) => n == 0 ? AiResponse.FromTool("forget_memory", new { id = first.Id }) : AiResponse.FromText("ok"));
        var foreign = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await other.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Vergiss das" }));
        Assert.Empty(foreign.Memory!);
        Assert.Contains("not found", ToolResult(_factory.Ai.Requests[1]));
        Assert.DoesNotContain("Knie", _factory.Ai.Requests[0].System);
        Assert.Single(await ListAsync(user));
        Assert.Empty(await ListAsync(other));

        // Eigenes Konto: vergessen
        var forgot = Assert.Single((await AskWithToolAsync(user, "forget_memory", new { id = first.Id })).Memory!);
        Assert.Equal("forgotten", forgot.Action);
        Assert.Empty(await ListAsync(user));
    }

    [Fact]
    public async Task Memory_has_a_limit_and_asks_the_coach_to_clean_up()
    {
        var user = await _factory.CreateUserAsync();
        for (var i = 0; i < CoachMemoryService.MaxEntries; i++)
            await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = $"Fakt Nummer {i}", category = "other" }));
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Einer zu viel", category = "other" }));

        var res = await AskWithToolAsync(user, "remember", new { content = "Noch ein Fakt", category = "goal" });
        Assert.Empty(res.Memory!);
        Assert.Contains("Memory is full", ToolResult(_factory.Ai.Requests[1]));
        Assert.Equal(CoachMemoryService.MaxEntries, (await ListAsync(user)).Count);
    }

    [Fact]
    public async Task Athlete_manages_memory_add_edit_delete_clear_with_validation()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "ok", category = "goal" }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Gültiger Text", category = "secret" }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Gültiger Text", category = "goal", importance = 5 }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Gültiger Text", category = "goal", expiresAt = DateTime.UtcNow.AddDays(-1) }));

        var created = await HttpAssert.JsonAsync<CoachMemoryDto>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "  Ziel: 30 m unter 4,1 s bis März  ", category = "goal", importance = 3 }));
        Assert.Equal(("Ziel: 30 m unter 4,1 s bis März", "user", 3), (created.Content, created.Source, created.Importance));

        var edited = await HttpAssert.JsonAsync<CoachMemoryDto>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/ai/memory/{created.Id}", new { content = "Ziel: 30 m unter 4,0 s bis März", category = "goal", importance = 3 }));
        Assert.Equal("Ziel: 30 m unter 4,0 s bis März", edited.Content);

        var other = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.PutAsJsonAsync($"/api/ai/memory/{created.Id}", new { content = "Gekapert", category = "goal" }));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.DeleteAsync($"/api/ai/memory/{created.Id}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await other.Client.DeleteAsync("/api/ai/memory"));
        Assert.Single(await ListAsync(user));

        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Trainiert morgens am liebsten", category = "preference", importance = 1 }));
        var list = await ListAsync(user);
        Assert.Equal(new[] { "goal", "preference" }, list.Select(m => m.Category)); // wichtigste zuerst
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/ai/memory/{created.Id}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync("/api/ai/memory"));
        Assert.Empty(await ListAsync(user));
    }

    [Fact]
    public async Task Temporary_facts_expire()
    {
        var clock = new ShiftedTimeProvider();
        using var factory = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(clock);
        }));
        var client = factory.CreateClient();
        var reg = await client.PostAsJsonAsync("/api/auth/register", new { username = "mem_" + Guid.NewGuid().ToString("N")[..10], password = "correct-horse-battery" });
        reg.EnsureSuccessStatusCode();
        var token = (await reg.Content.ReadFromJsonAsync<JsonObject>())!["token"]!.GetValue<string>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        await HttpAssert.StatusAsync(HttpStatusCode.Created, await client.PostAsJsonAsync("/api/ai/memory", new { content = "Leichte Schmerzen in der Wade", category = "injury", expiresAt = DateTime.UtcNow.AddDays(3) }));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await client.PostAsJsonAsync("/api/ai/memory", new { content = "Spieltag ist Sonntag", category = "schedule" }));
        Assert.Equal(2, (await HttpAssert.JsonAsync<List<CoachMemoryDto>>(HttpStatusCode.OK, await client.GetAsync("/api/ai/memory"))).Count);

        clock.Offset = TimeSpan.FromDays(4);
        var left = Assert.Single(await HttpAssert.JsonAsync<List<CoachMemoryDto>>(HttpStatusCode.OK, await client.GetAsync("/api/ai/memory")));
        Assert.Equal("Spieltag ist Sonntag", left.Content);
    }

    [Fact]
    public async Task Deleting_the_account_deletes_the_memory()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/ai/memory", new { content = "Spieltag ist Sonntag", category = "schedule" }));
        var req = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account") { Content = JsonContent.Create(new { password = user.Password }) };
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.SendAsync(req));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await db.CoachMemories.CountAsync(m => m.UserId == user.UserId));
    }
}
