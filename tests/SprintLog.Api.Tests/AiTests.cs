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

    /// <summary>Einheit mit optionalem Plan-Tag und Session-RPE (60 Minuten).</summary>
    private static object Session(DateTimeOffset date, int? programDayId = null, int? rpe = null) => new
    {
        workoutType = "Gym", clientId = Guid.NewGuid(), date, durationSeconds = 3600, sessionRpe = rpe, programDayId,
        sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 8 }, new { exerciseId = Seed.BenchPress, weight = 85.0, reps = 6 } },
    };

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
        Assert.Equal(5, _factory.Ai.Requests.Count); // schnell: höchstens 5 Schritte
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

    [Fact]
    public async Task Answer_cut_off_at_the_token_limit_is_continued_seamlessly()
    {
        var user = await _factory.CreateUserAsync();
        _factory.Ai.Reply = (_, n) => n switch
        {
            0 => AiResponse.FromText("Plan für diese Woche:\n- Montag: Kniebeuge 4x5 @ 80% 1RM\n- Diens", "max_tokens"),
            1 => AiResponse.FromText("tag: Sprints 6x30 m\n- Donnerstag: Nordic Curls 3x6", "max_tokens"),
            _ => AiResponse.FromText("\nNächster Schritt: Montag starten."),
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wochenplan?", mode = "deep" }));
        Assert.Equal("Plan für diese Woche:\n- Montag: Kniebeuge 4x5 @ 80% 1RM\n- Dienstag: Sprints 6x30 m\n- Donnerstag: Nordic Curls 3x6\nNächster Schritt: Montag starten.", res.Answer);
        Assert.Equal(3, _factory.Ai.Requests.Count);
        // Fortsetzung ohne Werkzeuge, mit der Bitte, nahtlos weiterzuschreiben
        Assert.Equal("none", (string?)_factory.Ai.Requests[1].ToolChoice!["type"]);
        Assert.StartsWith("Continue exactly", (string?)_factory.Ai.Requests[1].Messages.Last()!["content"]);
    }

    [Fact]
    public async Task Programs_tool_shows_every_day_with_exercises_and_adherence()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Speed Block", goal = "Speed", weeks = 6,
            days = new object[]
            {
                new { name = "MD-4 Kraft", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 4, repsMin = 4, repsMax = 6, targetRpe = 8, percentOf1Rm = 82 } } },
                new { name = "MD-3 Speed", exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6, distance = 30, restSeconds = 180 } } },
            },
        }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsync($"/api/programs/{program.Id}/activate", null));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", Session(DateTimeOffset.UtcNow.AddDays(-2), programDayId: program.Days[0].Id)));

        string? json = null;
        _factory.Ai.Reply = (req, n) => n == 0 ? AiResponse.FromTool("get_programs", new { }) : AiResponse.FromText((json = ToolResult(req)) is null ? "" : "ok");
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wie ist mein Plan?" }));

        var details = JsonDocument.Parse(json!).RootElement.GetProperty("details");
        Assert.Equal("Speed Block", details.GetProperty("name").GetString());
        Assert.True(details.GetProperty("active").GetBoolean());
        var days = details.GetProperty("days");
        Assert.Equal(2, days.GetArrayLength());
        Assert.Equal(program.Days[0].Id, days[0].GetProperty("dayId").GetInt32());
        Assert.Equal(1, days[0].GetProperty("completedLast4Weeks").GetInt32());
        var bench = days[0].GetProperty("exercises")[0];
        Assert.Equal("Bench Press", bench.GetProperty("name").GetString());
        Assert.Equal("4x4-6", bench.GetProperty("target").GetString());
        Assert.Equal(82, bench.GetProperty("percentOf1Rm").GetInt32());
        Assert.Equal("6x30m", days[1].GetProperty("exercises")[0].GetProperty("target").GetString());
    }

    [Fact]
    public async Task Program_update_keeps_days_and_progression_and_can_be_applied()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Strength", goal = "Strength", weeks = 8, cycleWeeks = 4,
            days = new object[]
            {
                new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5, progressionStep = 2.5, percentOf1Rm = 75 } } },
                new { name = "B", exercises = new object[] { new { exerciseId = Seed.Plank, sets = 3, time = 30 } } },
            },
        }));
        var other = await _factory.CreateUserAsync(); // fremdes Programm darf nicht angefasst werden

        _factory.Ai.Reply = (_, n) => n == 0
            ? AiResponse.FromTool("propose_program_update", new
            {
                programId = program.Id,
                changes = new[] { "Bankdrücken auf 4 Sätze", "Tag B ersetzt durch Sprint-Tag" },
                days = new object[]
                {
                    new { dayId = program.Days[0].Id, name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 4, repsMin = 5, repsMax = 5 }, new { exerciseId = Seed.Nordic, sets = 3, repsMin = 6 } } },
                    new { dayId = 999_999, name = "Sprint", exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6, distance = 30 } } },
                },
            })
            : AiResponse.FromText("Hier ist der angepasste Plan.");

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Pass meinen Plan an", mode = "deep" }));
        var action = Assert.Single(res.Actions);
        Assert.Equal("programUpdate", (string?)action["type"]);
        Assert.Equal(program.Id, (int)action["programId"]!);
        Assert.Equal(2, action["changes"]!.AsArray().Count);
        var draft = action["program"]!.Deserialize<ProgramInput>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal(program.Days[0].Id, draft.Days![0].Id);       // Tag bleibt (Verlauf hängt daran)
        Assert.Null(draft.Days[1].Id);                              // fremde/unbekannte Tag-ID -> neuer Tag
        Assert.Equal(4, draft.CycleWeeks);
        var bench = draft.Days[0].Exercises![0];
        Assert.Equal(4, bench.Sets);
        Assert.Equal(2.5, bench.ProgressionStep);                   // Progression übernommen
        Assert.Equal(75, bench.PercentOf1Rm);

        // Anwenden = normales PUT des Programms
        var applied = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}", draft));
        Assert.Equal(program.Days[0].Id, applied.Days[0].Id);
        Assert.Equal(2, applied.Days[0].Exercises.Count);
        Assert.Equal("Sprint", applied.Days[1].Name);

        // Programm eines anderen Nutzers: Werkzeug meldet "nicht gefunden"
        string? foreign = null;
        _factory.Ai.Reset((req, n) => n == 0
            ? AiResponse.FromTool("propose_program_update", new { programId = program.Id, changes = new[] { "x" }, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5 } } } } })
            : AiResponse.FromText((foreign = ToolResult(req)) is null ? "" : "ok"));
        var res2 = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await other.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Plan ändern" }));
        Assert.Empty(res2.Actions);
        Assert.Contains("not found", foreign);
    }

    [Fact]
    public async Task Load_metrics_compute_acwr_monotony_and_strain()
    {
        var user = await _factory.CreateUserAsync();
        for (var d = 1; d <= 20; d += 3)
        {
            await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", Session(DateTimeOffset.UtcNow.AddDays(-d), rpe: 6)));
        }
        string? json = null;
        _factory.Ai.Reply = (req, n) => n == 0 ? AiResponse.FromTool("get_load_metrics", new { days = 28 }) : AiResponse.FromText((json = ToolResult(req)) is null ? "" : "ok");
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Belastung?" }));

        var m = JsonDocument.Parse(json!).RootElement;
        Assert.Equal(4, m.GetProperty("weeks").GetArrayLength());
        Assert.Equal(14, m.GetProperty("last14Days").GetArrayLength());
        Assert.True(m.GetProperty("acute7dAU").GetDouble() > 0);
        Assert.True(m.GetProperty("acwrRolling").GetDouble() > 0);
        Assert.True(m.GetProperty("acwrEwma").GetDouble() > 0);
        Assert.Equal(JsonValueKind.Number, m.GetProperty("monotony7d").ValueKind);
        Assert.Equal(0, m.GetProperty("sessionsWithoutRpeOrDuration").GetInt32());
    }
}
