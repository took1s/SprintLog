using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>Geplante Einzel-Einheiten: nie an einem Plan-Tag, idempotentes PUT, Status, KI-Vorschlag inkl. Wochenplan-Verschiebung.</summary>
[Collection(ApiCollection.Name)]
public class PlannedWorkoutTests
{
    private readonly SprintLogApiFactory _factory;

    public PlannedWorkoutTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static int Bit(DateOnly d) => PlannedWorkoutRules.DayBit(d);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static int Wd(DateOnly d) => ((int)d.DayOfWeek + 6) % 7;

    /// <summary>Aktiver Plan, der morgen trainiert und übermorgen spielt.</summary>
    private static async Task<int> PlanWithTrainingTomorrowAsync(TestUser user)
    {
        var plan = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Plan", goal = "Strength", weeks = 6,
            days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5 } } } },
        }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{plan.Id}/schedule",
            new { trainingDays = Bit(Today.AddDays(1)), matchDays = Bit(Today.AddDays(2)) }));
        return plan.Id;
    }

    private static object Session(DateOnly date, string status = "planned") => new
    {
        date = Iso(date), title = "Sprint-Zusatz", category = "Football", notes = "Locker einlaufen", status,
        exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6, distance = 30 }, new { exerciseId = Seed.Nordic, sets = 2, repsMin = 5, repsMax = 5 } },
    };

    [Fact]
    public async Task Sessions_never_land_on_match_days_but_may_double_a_training_day_and_put_is_idempotent()
    {
        var user = await _factory.CreateUserAsync();
        await PlanWithTrainingTomorrowAsync(user);

        // Spieltag: nie. Trainingstag: erlaubter Doppeltag.
        var onMatch = await user.Client.PutAsJsonAsync("/api/planned/pl-0000001", Session(Today.AddDays(2)));
        Assert.Equal(HttpStatusCode.Conflict, onMatch.StatusCode);
        Assert.Contains("plan_conflict", await onMatch.Content.ReadAsStringAsync());
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-0000009", Session(Today.AddDays(1))));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync("/api/planned/pl-0000009"));

        var free = Today.AddDays(3);
        var created = await HttpAssert.JsonAsync<PlannedWorkoutResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-0000001", Session(free)));
        Assert.Equal("planned", created.Status);
        Assert.Equal(2, created.Exercises.Count);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-0000001", Session(free)));

        // Erledigt mit verknüpfter Einheit; ausgelassene/erledigte Termine prüfen keinen Plan-Konflikt mehr
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-0000001",
            new { date = Iso(free), title = "Sprint-Zusatz", category = "Football", status = "done", workoutClientId = "wk-123", exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6 } } }));
        var all = await HttpAssert.JsonAsync<List<PlannedWorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/planned"));
        var one = Assert.Single(all);
        Assert.Equal("done", one.Status);
        Assert.Equal("wk-123", one.WorkoutClientId);

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync("/api/planned/pl-0000001"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync("/api/planned/pl-0000001"));
        Assert.Empty(await HttpAssert.JsonAsync<List<PlannedWorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/planned")));
    }

    [Fact]
    public async Task Invalid_sessions_and_foreign_exercises_are_rejected()
    {
        var user = await _factory.CreateUserAsync();
        var res = await user.Client.PutAsJsonAsync("/api/planned/pl-bad00001", new
        {
            date = Iso(Today.AddDays(400)), title = "", category = "Yoga", status = "maybe", exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 0 } },
        });
        var fields = await HttpAssert.ValidationFieldsAsync(res);
        foreach (var f in new[] { "date", "title", "category", "status", "exercises" }) Assert.Contains(f, fields);

        var unknown = await user.Client.PutAsJsonAsync("/api/planned/pl-bad00002", new { date = Iso(Today), title = "X", category = "Gym", exercises = new object[] { new { exerciseId = 999_999, sets = 3 } } });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
    }

    [Fact]
    public async Task Coach_sees_the_calendar_and_cannot_put_a_session_on_a_plan_day_unless_it_moves_the_plan()
    {
        var user = await _factory.CreateUserAsync();
        await PlanWithTrainingTomorrowAsync(user);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-cal00001", Session(Today.AddDays(4))));
        var tomorrow = Today.AddDays(1);
        var results = new List<string>();

        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 0)
            {
                Assert.Contains("<calendar", req.System);
                Assert.Contains($"{tomorrow:yyyy-MM-dd} {tomorrow.ToString("ddd", System.Globalization.CultureInfo.InvariantCulture)}: plan training", req.System);
                Assert.Contains("session id pl-cal00001 'Sprint-Zusatz'", req.System);
                Assert.Contains(req.Tools!, t => t.Name == AiTools.ProposeSession);
                // Erst auf den Spieltag -> Fehler
                return AiResponse.FromTool(AiTools.ProposeSession, new { date = Iso(Today.AddDays(2)), title = "Speed", category = "Football", reason = "x", exercises = new[] { new { exerciseId = Seed.Sprints, sets = 6 } } });
            }
            if (n == 1)
            {
                results.Add(req.Messages.ToJsonString());
                // Trainingstag morgen: erlaubt als Doppeltag
                return AiResponse.FromTool(AiTools.ProposeSession, new { date = Iso(tomorrow), title = "Speed day", category = "Football", reason = "Zusatz",
                    exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6, distance = 30, targetRpe = 12 }, new { exerciseId = 999_999, sets = 2 } } });
            }
            if (n == 2) results.Add(req.Messages.ToJsonString());
            return AiResponse.FromText("Fertig.");
        };

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Plane mir morgen eine Speed-Einheit" }));
        Assert.Contains("is a match day of the plan", results[0]);
        Assert.Contains("Double day", results[1]);
        var session = Assert.Single(res.Actions, a => (string?)a["type"] == "session");
        var s = session["session"]!;
        Assert.Equal(Iso(tomorrow), (string?)s["date"]);
        Assert.Single(s["exercises"]!.AsArray());                // unbekannte Übung raus
        Assert.Null(s["exercises"]![0]!["targetRpe"]);            // 12 ist kein RPE
        Assert.Equal(30, (double)s["exercises"]![0]!["distance"]!);
    }
}
