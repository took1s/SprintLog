using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using SprintLog.Api.DTOs;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// Rückmeldungen aus dem Training: unterstützte Maschinen, einseitige Übungen, Ausdauergeräte mit echten Kennzahlen,
/// mehrere Studios, Notizen/Auslassungen pro Übung und KI-Änderungen an der laufenden Einheit.
/// </summary>
[Collection(ApiCollection.Name)]
public class TrainingFeedbackTests
{
    private readonly SprintLogApiFactory _factory;

    public TrainingFeedbackTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    [Fact]
    public async Task Catalog_marks_assisted_machines_unilateral_exercises_and_cardio_equipment()
    {
        var user = await _factory.CreateUserAsync();
        var catalog = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/exercises"));
        var byId = catalog.ToDictionary(e => e.Id);

        Assert.True(byId[Seed.AssistedPullUp].IsAssisted);
        Assert.False(byId[Seed.BenchPress].IsAssisted);
        Assert.True(byId[Seed.SidePlank].PerSide);
        Assert.True(byId[Seed.Bulgarian].PerSide);
        Assert.False(byId[Seed.Plank].PerSide);
        Assert.Equal(TrackingType.Cardio, byId[Seed.StationaryBike].TrackingType);
    }

    [Fact]
    public async Task Cardio_metrics_gym_and_exercise_notes_round_trip_and_are_replaced_on_update()
    {
        var user = await _factory.CreateUserAsync();
        var payload = new
        {
            workoutType = "Gym",
            clientId = Guid.NewGuid(),
            gym = "  Orange Gym ",
            sets = new object[]
            {
                new { exerciseId = Seed.StationaryBike, time = 1200.0, distance = 8400.0, level = 8.0, power = 165, heartRate = 142, cadence = 88, calories = 230 },
                new { exerciseId = Seed.AssistedPullUp, weight = 25.0, reps = 8 },
                new { exerciseId = Seed.SidePlank, time = 45.0 },
            },
            exerciseNotes = new object[]
            {
                new { exerciseId = Seed.AssistedPullUp, note = "Griff eng" },
                new { exerciseId = Seed.LatPulldown, skipped = true, reason = "equipment", note = "Maschine besetzt" },
            },
        };
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", payload));

        var w = await HttpAssert.JsonAsync<WorkoutResponse>(HttpStatusCode.OK, await user.Client.GetAsync($"/api/workouts/{saved.WorkoutId}"));
        Assert.Equal("Orange Gym", w.Gym);
        var bike = w.Sets.Single(s => s.ExerciseId == Seed.StationaryBike);
        Assert.Equal(TrackingType.Cardio, bike.TrackingType);
        Assert.Equal((8.0, 165, 142, 88, 230), (bike.Level!.Value, bike.Power!.Value, bike.HeartRate!.Value, bike.Cadence!.Value, bike.Calories!.Value));
        Assert.True(w.Sets.Single(s => s.ExerciseId == Seed.AssistedPullUp).IsAssisted);
        Assert.True(w.Sets.Single(s => s.ExerciseId == Seed.SidePlank).PerSide);
        Assert.Equal(2, w.ExerciseNotes!.Count);
        var skipped = w.ExerciseNotes.Single(n => n.ExerciseId == Seed.LatPulldown);
        Assert.True(skipped.Skipped);
        Assert.Equal("equipment", skipped.Reason);
        Assert.Equal("Maschine besetzt", skipped.Note);

        // Bearbeiten ersetzt Notizen und Studio vollständig
        var update = new
        {
            workoutType = "Gym",
            gym = "TopFit",
            sets = new object[] { new { exerciseId = Seed.AssistedPullUp, weight = 20.0, reps = 8 } },
            exerciseNotes = new object[] { new { exerciseId = Seed.Bulgarian, skipped = true, reason = "pain" } },
        };
        var updated = await HttpAssert.JsonAsync<WorkoutResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/workouts/{saved.WorkoutId}", update));
        Assert.Equal("TopFit", updated.Gym);
        var only = Assert.Single(updated.ExerciseNotes!);
        Assert.Equal((Seed.Bulgarian, true, "pain", (string?)null), (only.ExerciseId, only.Skipped, only.Reason, only.Note));

        // Delta-Sync liefert die neuen Felder mit
        var changes = await HttpAssert.JsonAsync<WorkoutChangesResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/changes"));
        Assert.Equal("TopFit", Assert.Single(changes.Workouts).Gym);
    }

    [Theory]
    [InlineData("{\"exerciseId\":84,\"time\":600,\"heartRate\":20}", null)]
    [InlineData("{\"exerciseId\":84,\"time\":600,\"power\":5000}", null)]
    [InlineData("{\"exerciseId\":84,\"time\":600,\"level\":-1}", null)]
    [InlineData("{\"exerciseId\":1,\"weight\":50,\"reps\":5}", "[{\"exerciseId\":1,\"skipped\":true,\"reason\":\"bored\"}]")]
    [InlineData("{\"exerciseId\":1,\"weight\":50,\"reps\":5}", "[{\"exerciseId\":1,\"note\":\"a\"},{\"exerciseId\":1,\"note\":\"b\"}]")]
    [InlineData("{\"exerciseId\":1,\"weight\":50,\"reps\":5}", "[{\"exerciseId\":1}]")]
    [InlineData("{\"exerciseId\":1,\"weight\":50,\"reps\":5}", "[{\"exerciseId\":999999,\"skipped\":true}]")]
    public async Task Implausible_metrics_and_invalid_notes_are_rejected(string set, string? notes)
    {
        var user = await _factory.CreateUserAsync();
        var body = new JsonObject
        {
            ["workoutType"] = "Gym",
            ["sets"] = new JsonArray(JsonNode.Parse(set)),
        };
        if (notes is not null) body["exerciseNotes"] = JsonNode.Parse(notes);
        var res = await user.Client.PostAsJsonAsync("/api/workouts", body);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Custom_exercises_can_be_marked_assisted_or_per_side_but_standard_ones_are_fixed()
    {
        var user = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/exercises", new { name = "Gravitron", category = "Gym", muscleGroup = "Back" }));
        Assert.False(created.IsAssisted);

        var patched = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.OK,
            await user.Client.PatchAsJsonAsync($"/api/exercises/{created.Id}", new { isAssisted = true }));
        Assert.True(patched.IsAssisted);
        Assert.False(patched.PerSide);

        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.PatchAsJsonAsync($"/api/exercises/{Seed.BenchPress}", new { isAssisted = true })).StatusCode);
        var other = await _factory.CreateUserAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.Client.PatchAsJsonAsync($"/api/exercises/{created.Id}", new { perSide = true })).StatusCode);

        // Dauer-Übung kann nicht "unterstützt" sein, aber pro Seite
        var hold = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/exercises", new { name = "Copenhagen Hold", category = "Football", trackingType = "Duration", perSide = true }));
        Assert.True(hold.PerSide);
        Assert.Equal(HttpStatusCode.BadRequest, (await user.Client.PatchAsJsonAsync($"/api/exercises/{hold.Id}", new { isAssisted = true })).StatusCode);

        // Nur in Notizen verwendete eigene Übung lässt sich trotzdem löschen
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 50.0, reps = 5 } },
            exerciseNotes = new object[] { new { exerciseId = created.Id, skipped = true, reason = "time" } },
        }));
        Assert.Equal(HttpStatusCode.NoContent, (await user.Client.DeleteAsync($"/api/exercises/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Ai_history_explains_assistance_gyms_and_skipped_exercises()
    {
        var user = await _factory.CreateUserAsync();
        foreach (var (gym, assist, day) in new[] { ("Orange Gym", 30.0, 3), ("TopFit", 25.0, 1) })
            await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
            {
                workoutType = "Gym",
                gym,
                date = DateTimeOffset.UtcNow.AddDays(-day),
                sets = new object[] { new { exerciseId = Seed.AssistedPullUp, weight = assist, reps = 8 } },
                exerciseNotes = day == 1 ? new object[] { new { exerciseId = Seed.AssistedPullUp, note = "Schulter zwickt" } } : null,
            }));

        string? history = null;
        _factory.Ai.Reply = (req, n) => n == 0
            ? AiResponse.FromTool("get_exercise_history", new { exercise = Seed.AssistedPullUp.ToString() })
            : AiResponse.FromText((history = ToolResult(req)) is null ? "" : "ok");
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wie läuft Gravitron?" }));

        Assert.NotNull(history);
        Assert.Contains("less kg = harder", history);
        Assert.Contains("Several gyms", history);
        Assert.Contains("assist 25kg x8", history);
        Assert.Contains("Schulter zwickt", history);
        Assert.Contains("\"minAssistKg\":25", history);
        Assert.DoesNotContain("\"e1rm\":", history);
    }

    [Fact]
    public async Task Live_workout_question_gets_the_session_in_the_prompt_and_a_sanitized_change_card()
    {
        var user = await _factory.CreateUserAsync();
        var session = """{"gym":"TopFit","exercises":[{"id":44,"name":"Lat Pulldown","sets":[]}]}""";
        _factory.Ai.Reply = (req, n) =>
        {
            if (n > 0) return AiResponse.FromText("Nimm Kabelrudern statt Latzug.");
            Assert.Contains("IN THE MIDDLE OF A WORKOUT", req.System);
            Assert.Contains("\"gym\":\"TopFit\"", req.System);
            Assert.Contains(req.Tools!, t => t.Name == AiTools.ProposeWorkoutChange);
            return AiResponse.FromTool(AiTools.ProposeWorkoutChange, new
            {
                changes = new[] { "Latzug besetzt -> Kabelrudern" },
                operations = new object[]
                {
                    new { op = "replace", exerciseId = Seed.LatPulldown, withExerciseId = 14, sets = 3, reps = 10, weight = 52.3 },
                    new { op = "add", exerciseId = 999_999, sets = 3 },                                 // erfunden -> raus
                    new { op = "adjust", exerciseId = Seed.BenchPress, sets = 99, targetRpe = 12.0 },   // Grenzen
                    new { op = "fly", exerciseId = Seed.BenchPress },                                   // unbekannt -> raus
                },
            });
        };

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Latzug ist besetzt, was jetzt?", session }));
        var card = Assert.Single(res.Actions);
        Assert.Equal("workout", (string?)card["type"]);
        var ops = card["operations"]!.AsArray();
        Assert.Equal(2, ops.Count);
        Assert.Equal(("replace", 44, 14, "Seated Cable Row", 52.25), ((string?)ops[0]!["op"], (int)ops[0]!["exerciseId"]!, (int)ops[0]!["withExerciseId"]!, (string?)ops[0]!["withName"], (double)ops[0]!["weight"]!));
        Assert.Equal((10, 10.0), ((int)ops[1]!["sets"]!, (double)ops[1]!["targetRpe"]!));

        // Ohne laufende Einheit gibt es das Werkzeug nicht
        _factory.Ai.Reply = (req, _) =>
        {
            Assert.DoesNotContain(req.Tools!, t => t.Name == AiTools.ProposeWorkoutChange);
            Assert.DoesNotContain("IN THE MIDDLE OF A WORKOUT", req.System);
            return AiResponse.FromText("ok");
        };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Allgemeine Frage" }));

        // Zu große Session wird abgelehnt
        var huge = await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Frage", session = new string('x', AiAskInput.MaxSession + 1) });
        Assert.Equal(HttpStatusCode.BadRequest, huge.StatusCode);
    }

    private static string ToolResult(AiRequest request) =>
        request.Messages.OfType<JsonObject>().Last()["content"]!.AsArray().OfType<JsonObject>()
            .First(b => (string?)b["type"] == "tool_result")["content"]!.GetValue<string>();
}
