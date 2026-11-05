using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>KI-Coach: Status, Fragen mit Verlauf und Kontext, Tageskontingent, Fehlerabbildung und abgesicherte Pläne.</summary>
[Collection(ApiCollection.Name)]
public class AiTests
{
    private readonly SprintLogApiFactory _factory;

    public AiTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.IsEnabled = true;
        _factory.Ai.Reply = (_, _, _) => new AiCompletion("Heute locker.", null, 10, 5);
    }

    [Fact]
    public async Task Status_reports_enabled_and_the_daily_quota()
    {
        var user = await _factory.CreateUserAsync();
        var status = await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.True(status.Enabled);
        Assert.Equal(5, status.DailyLimit);
        Assert.Equal(5, status.Remaining);
    }

    [Fact]
    public async Task Ask_sends_context_history_and_language_and_counts_against_the_quota()
    {
        var user = await _factory.CreateUserAsync();
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new
        {
            question = "Soll ich heute sprinten?",
            context = "Recovery: legs 40%. Week plan: today rest.",
            locale = "de",
            history = new[] { new { role = "assistant", content = "Hallo!" }, new { role = "user", content = "Hi" }, new { role = "assistant", content = "Wie geht's?" } },
        }));
        Assert.Equal("Heute locker.", res.Answer);
        Assert.Equal(4, res.Remaining);

        var last = _factory.Ai.Last!.Value;
        Assert.Contains("legs 40%", last.System);
        Assert.Contains("Answer in German", last.System);
        // Gespräch beginnt mit "user", Rollen wechseln sich ab, letzte Nachricht ist die Frage
        Assert.Equal("user", last.Messages[0].Role);
        Assert.Equal("Soll ich heute sprinten?", last.Messages[^1].Content);
        Assert.All(last.Messages.Zip(last.Messages.Skip(1)), p => Assert.NotEqual(p.First.Role, p.Second.Role));
    }

    [Fact]
    public async Task Quota_is_enforced_and_failed_calls_are_refunded()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (_, _, _) => throw new AiException("ai_no_credit", HttpStatusCode.ServiceUnavailable);
        var failed = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Plan?" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal("ai_no_credit", (await failed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());

        _factory.Ai.Reply = (_, _, _) => new AiCompletion("ok", null, 1, 1);
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.OK, (await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage " + i })).StatusCode);
        var over = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Noch eine" });
        Assert.Equal(HttpStatusCode.TooManyRequests, over.StatusCode);
        Assert.Equal("ai_quota", (await over.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Invalid_input_and_disabled_ai_are_rejected()
    {
        var user = await _factory.CreateUserAsync();
        Assert.Contains("question", await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "x" })));
        Assert.Contains("history[0]", await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "ok?", history = new[] { new { role = "system", content = "hack" } } })));

        _factory.Ai.IsEnabled = false;
        var status = await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.False(status.Enabled);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Hallo?" })).StatusCode);
        _factory.Ai.IsEnabled = true;

        var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/ai/status")).StatusCode);
    }

    [Fact]
    public async Task Plan_uses_only_catalog_exercises_and_returns_a_valid_program_that_can_be_saved()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (system, _, tool) =>
        {
            Assert.Equal("propose_program", tool!.Name);
            Assert.Contains($"{Seed.Nordic} | ", system); // Übungskatalog mit IDs im Prompt
            var plan = JsonSerializer.SerializeToElement(new
            {
                name = "Hamstring & Speed",
                goal = "Speed",
                weeks = 99,
                summary = "Passt zu deinem Spieltag.",
                days = new object[]
                {
                    new { name = "Tag A", exercises = new object[]
                    {
                        new { exerciseId = Seed.Sprints, sets = 6, distance = 30 },
                        new { exerciseId = 999_999, sets = 3, repsMin = 5 },               // erfunden -> raus
                        new { exerciseId = Seed.Nordic, sets = 3 },                        // ohne Wdh. -> ergänzt
                        new { exerciseId = Seed.Plank, sets = 50, repsMin = 10 },          // Dauer-Übung -> Zeit, Sätze begrenzt
                    } },
                    new { name = "Tag B", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 4, repsMin = 12, repsMax = 6, targetRpe = 12 } } },
                    new { name = "Zu viel", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5 } } },
                },
            });
            return new AiCompletion(null, plan, 100, 200);
        };

        var res = await HttpAssert.JsonAsync<AiPlanResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/plan", new
        {
            answers = new { focus = "football", daysPerWeek = 2, matchDay = 6, level = "Intermediate" },
            notes = "Hamstring-Zerrung im August",
            locale = "de",
        }));
        Assert.Equal("Passt zu deinem Spieltag.", res.Summary);
        Assert.Equal(2, res.Remaining); // Plan kostet 3 von 5
        var p = res.Program;
        Assert.Equal(16, p.Weeks);
        Assert.Equal(2, p.Days!.Count); // nur so viele Tage wie gewünscht
        var a = p.Days[0].Exercises!;
        Assert.Equal(new[] { Seed.Sprints, Seed.Nordic, Seed.Plank }, a.Select(x => x.ExerciseId));
        Assert.Equal(30, a[0].Distance);
        Assert.NotNull(a[1].RepsMin);
        Assert.Equal(10, a[2].Sets);
        Assert.NotNull(a[2].Time);
        Assert.Null(a[2].RepsMin);
        var bench = p.Days[1].Exercises![0];
        Assert.True(bench.RepsMin <= bench.RepsMax);
        Assert.Equal(10, bench.TargetRpe);
        Assert.Contains("Hamstring-Zerrung", _factory.Ai.Last!.Value.Messages[0].Content);

        // Der Vorschlag ist direkt speicherbar
        var saved = await user.Client.PostAsJsonAsync("/api/programs", p);
        Assert.True(saved.IsSuccessStatusCode, await saved.Content.ReadAsStringAsync());
    }
}
