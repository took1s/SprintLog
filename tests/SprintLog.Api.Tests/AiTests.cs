using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// KI-Coach: Status, schnelle/gründliche Fragen mit Werkzeug-Schleife und Vorschlags-Karten, Kontingent, Fehler,
/// abgesicherte Pläne, Analyse-Bericht und das Sportler-Profil.
/// </summary>
[Collection(ApiCollection.Name)]
public class AiTests
{
    private readonly SprintLogApiFactory _factory;

    public AiTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static string ToolResult(AiRequest request) =>
        request.Messages.OfType<JsonObject>().Last()["content"]!.AsArray().OfType<JsonObject>()
            .First(b => (string?)b["type"] == "tool_result")["content"]!.GetValue<string>();

    private static string Code(HttpResponseMessage r) =>
        r.Content.ReadFromJsonAsync<JsonElement>().GetAwaiter().GetResult().GetProperty("code").GetString()!;

    [Fact]
    public async Task Status_reports_quota_and_costs()
    {
        var user = await _factory.CreateUserAsync();
        var status = await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.True(status.Enabled);
        Assert.Equal(12, status.DailyLimit);
        Assert.Equal(12, status.Remaining);
        Assert.Equal(1, status.Costs["quick"]);
        Assert.Equal(4, status.Costs["deep"]);
    }

    [Fact]
    public async Task Quick_question_uses_the_fast_model_with_profile_context_and_alternating_history()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/profile/athlete",
            new { position = "winger", heightCm = 180, weightKg = 76, injuries = "Hamstring strain in August" }));
        _factory.Ai.Reply = (_, _) => AiResponse.FromText("Heute locker.");

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new
        {
            question = "Soll ich heute sprinten?",
            context = "Recovery: legs 40%.",
            locale = "de",
            history = new[] { new { role = "assistant", content = "Hallo!" }, new { role = "user", content = "Hi" }, new { role = "assistant", content = "Wie geht's?" } },
        }));
        Assert.Equal("Heute locker.", res.Answer);
        Assert.Equal(11, res.Remaining);
        Assert.Empty(res.Actions);

        var req = Assert.Single(_factory.Ai.Requests);
        Assert.Equal("claude-haiku-5-5", req.Model);
        Assert.Contains("legs 40%", req.System);
        Assert.Contains("Position: winger", req.System);
        Assert.Contains("Hamstring strain in August", req.System);
        Assert.Contains("Answer in German", req.System);
        Assert.NotNull(req.Tools);
        var roles = req.Messages.Select(m => (string?)m!["role"]).ToList();
        Assert.Equal("user", roles[0]);
        Assert.All(roles.Zip(roles.Skip(1)), p => Assert.NotEqual(p.First, p.Second));
        Assert.Equal("Soll ich heute sprinten?", (string?)req.Messages.Last()!["content"]);
    }

    [Fact]
    public async Task Deep_question_runs_tools_with_exact_numbers_and_returns_proposal_cards()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-3))));

        string? historyJson = null;
        _factory.Ai.Reply = (req, n) => n switch
        {
            0 => AiResponse.FromTool("get_exercise_history", new { exercise = "bench press", weeks = 8 }, "t1"),
            1 => (historyJson = ToolResult(req)) is not null
                ? AiResponse.FromTool("propose_goal", new { exerciseId = Seed.BenchPress, targetWeight = 95.3, targetReps = 3, targetDate = "2099-01-15", reason = "Steady progress" }, "t2")
                : throw new InvalidOperationException(),
            _ => AiResponse.FromText("Dein Bankdrücken steigt. Ziel: 95 kg x3."),
        };

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wie entwickelt sich mein Bankdrücken?", mode = "deep", locale = "de" }));

        Assert.Equal("Dein Bankdrücken steigt. Ziel: 95 kg x3.", res.Answer);
        Assert.Equal(8, res.Remaining); // gründlich kostet 4
        Assert.Equal(3, _factory.Ai.Requests.Count);
        Assert.All(_factory.Ai.Requests, r => Assert.Equal("claude-sonnet-5-5", r.Model));

        // Exakte Werte vom Server: 85 x 6 -> Epley 102 kg; Sätze kompakt
        Assert.NotNull(historyJson);
        var history = JsonDocument.Parse(historyJson!).RootElement;
        Assert.Equal("Bench Press", history.GetProperty("exercise").GetProperty("name").GetString());
        var session = history.GetProperty("sessions")[0];
        Assert.Equal(102, session.GetProperty("e1rm").GetDouble());
        Assert.Equal("80x8, 85x6", session.GetProperty("sets").GetString());

        // Vorschlag als Karte, Gewicht auf 0,25 kg gerundet
        var goal = Assert.Single(res.Actions);
        Assert.Equal("goal", (string?)goal["type"]);
        Assert.Equal(Seed.BenchPress, (int)goal["exerciseId"]!);
        Assert.Equal(95.25, (double)goal["targetWeight"]!);
        Assert.Equal("2099-01-15", (string?)goal["targetDate"]);
    }

    [Fact]
    public async Task Tool_loop_is_bounded_and_the_last_step_forces_a_text_answer()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (req, _) => req.ToolChoice is not null ? AiResponse.FromText("Fertig.") : AiResponse.FromTool("get_personal_records", new { });
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Rekorde?" }));
        Assert.Equal("Fertig.", res.Answer);
        Assert.Equal(4, _factory.Ai.Requests.Count); // schnell: höchstens 4 Schritte
        Assert.Equal("none", (string?)_factory.Ai.Requests[^1].ToolChoice!["type"]);
    }

    [Fact]
    public async Task Quota_is_enforced_and_failed_calls_are_refunded()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (_, _) => throw new AiException("ai_no_credit", HttpStatusCode.ServiceUnavailable);
        var failed = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Plan?", mode = "deep" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal("ai_no_credit", Code(failed));

        _factory.Ai.Reply = (_, _) => AiResponse.FromText("ok");
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage " + i, mode = "deep" })).StatusCode);
        var over = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Noch eine" });
        Assert.Equal(HttpStatusCode.TooManyRequests, over.StatusCode);
        Assert.Equal("ai_quota", Code(over));
    }

    [Fact]
    public async Task Invalid_input_and_disabled_ai_are_rejected()
    {
        var user = await _factory.CreateUserAsync();
        Assert.Contains("question", await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "x" })));
        Assert.Contains("mode", await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "ok?", mode = "max" })));
        Assert.Contains("history[0]", await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "ok?", history = new[] { new { role = "system", content = "hack" } } })));

        _factory.Ai.IsEnabled = false;
        var status = await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.False(status.Enabled);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Hallo?" })).StatusCode);
        _factory.Ai.IsEnabled = true;

        var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/ai/status")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/profile/athlete")).StatusCode);
    }

    [Fact]
    public async Task Plan_uses_only_catalog_exercises_and_returns_a_valid_program_that_can_be_saved()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (req, _) =>
        {
            Assert.Equal("claude-sonnet-5-5", req.Model);
            Assert.Contains($"{Seed.Nordic} | ", req.System); // Übungskatalog mit IDs im Prompt
            return AiResponse.FromTool("propose_program", new
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
        };

        var res = await HttpAssert.JsonAsync<AiPlanResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/plan", new
        {
            answers = new { focus = "football", daysPerWeek = 2, matchDay = 6, level = "Intermediate" },
            notes = "Hamstring-Zerrung im August",
            locale = "de",
        }));
        Assert.Equal("Passt zu deinem Spieltag.", res.Summary);
        Assert.Equal(6, res.Remaining); // Plan kostet 6 von 12
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
        Assert.Contains("Hamstring-Zerrung", (string?)_factory.Ai.Requests[0].Messages[0]!["content"]);

        // Der Vorschlag ist direkt speicherbar
        var saved = await user.Client.PostAsJsonAsync("/api/programs", p);
        Assert.True(saved.IsSuccessStatusCode, await saved.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Analysis_collects_statistics_and_returns_the_structured_report()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(-9), "Gym")));
        string? summaryJson = null;
        _factory.Ai.Reply = (req, n) => n switch
        {
            0 => AiResponse.FromTool("get_training_summary", new { weeks = 4 }, "s1"),
            _ => (summaryJson = ToolResult(req)) is not null ? AiResponse.FromTool("submit_report", new
            {
                headline = "Solide Basis, Sprintvolumen zu niedrig.",
                summary = "2 Einheiten in 4 Wochen.",
                sections = new[] { new { area = "load", title = "Belastung", status = "watch", points = new[] { "1 Einheit pro Woche" } } },
                recommendations = new[] { new { title = "Sprints", why = "Nur 1 Lauf", action = "2x pro Woche 6x30 m" } },
                nextWeekFocus = "Zwei Einheiten.",
            }, "s2") : throw new InvalidOperationException(),
        };

        var res = await HttpAssert.JsonAsync<AiAnalysisResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/analysis", new { locale = "de", period = "full" }));
        Assert.Equal("Solide Basis, Sprintvolumen zu niedrig.", (string?)res.Report["headline"]);
        Assert.Equal("watch", (string?)res.Report["sections"]![0]!["status"]);
        Assert.Equal(6, res.Remaining);

        var summary = JsonDocument.Parse(summaryJson!).RootElement;
        Assert.Equal(4, summary.GetProperty("weeks").GetArrayLength());
        Assert.Equal(1, summary.GetProperty("totalSessions").GetInt32());
        Assert.Contains(summary.GetProperty("weeks").EnumerateArray(), w => w.GetProperty("tonnageKg").GetDouble() == 80 * 8 + 85 * 6);
        Assert.Contains("submit_report", _factory.Ai.Requests[0].Tools!.Select(t => t.Name));
    }

    [Fact]
    public async Task Athlete_profile_round_trip_and_validation()
    {
        var user = await _factory.CreateUserAsync();
        var empty = await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await user.Client.GetAsync("/api/profile/athlete"));
        Assert.Null(empty.Position);

        var saved = await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/profile/athlete", new
        {
            position = "winger", birthYear = 2005, heightCm = 180, weightKg = 76.04, level = " Kreisliga ", goals = "Höhere Liga", equipment = "", sessionMinutes = 75,
        }));
        Assert.Equal("Kreisliga", saved.Level);
        Assert.Equal(76, saved.WeightKg);
        Assert.Null(saved.Equipment);

        var again = await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await user.Client.GetAsync("/api/profile/athlete"));
        Assert.Equal("winger", again.Position);
        Assert.Equal(75, again.SessionMinutes);

        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync("/api/profile/athlete", new { position = "libero", heightCm = 90, weightKg = 500, sessionMinutes = 5 }));
        Assert.Contains("position", fields);
        Assert.Contains("heightCm", fields);
        Assert.Contains("weightKg", fields);
        Assert.Contains("sessionMinutes", fields);

        // Fremde Profile sind unsichtbar
        var other = await _factory.CreateUserAsync();
        Assert.Null((await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await other.Client.GetAsync("/api/profile/athlete"))).Position);
    }
}
