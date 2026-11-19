using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>Mannschaftstraining (Typ "Team"): ohne Sätze, mit Minuten/sRPE/Schwerpunkt; Team-Tage im Wochenplan; Coach sieht beides.</summary>
[Collection(ApiCollection.Name)]
public class TeamTrainingTests
{
    private readonly SprintLogApiFactory _factory;

    public TeamTrainingTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public async Task Team_training_is_saved_with_minutes_rpe_focus_and_participation()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Team", durationSeconds = 90 * 60, sessionRpe = 7, quality = 4, notes = "Pressing 11 gegen 11",
            team = new { focus = "tactical", participation = "full" },
        }));

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        var team = Assert.Single(history);
        Assert.Equal("Team", team.WorkoutType);
        Assert.Empty(team.Sets);
        Assert.Equal(new TeamDetails("tactical", "full"), team.Team);
        Assert.Null(team.Match);

        // Andere Einheiten haben keine Team-Details
        await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout());
        history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Null(history.Single(w => w.WorkoutType != "Team").Team);
    }

    public static TheoryData<object, string> InvalidTeamTrainings => new()
    {
        { new { workoutType = "Team", sessionRpe = 6 }, "durationSeconds" },
        { new { workoutType = "Team", durationSeconds = 5400 }, "sessionRpe" },
        { new { workoutType = "Team", durationSeconds = 5 * 3600, sessionRpe = 6 }, "durationSeconds" },
        { new { workoutType = "Team", durationSeconds = 5400, sessionRpe = 6, team = new { focus = "yoga" } }, "team" },
        { new { workoutType = "Team", durationSeconds = 5400, sessionRpe = 6, team = new { participation = "maybe" } }, "team" },
        { new { workoutType = "Team", durationSeconds = 5400, sessionRpe = 6, sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 50.0, reps = 5 } } }, "sets" },
        { new { workoutType = "Gym", sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 50.0, reps = 5 } }, team = new { focus = "tactical" } }, "team" },
    };

    [Theory]
    [MemberData(nameof(InvalidTeamTrainings))]
    public async Task Invalid_team_trainings_are_rejected(object payload, string field)
    {
        var user = await _factory.CreateUserAsync();
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/workouts", payload));
        Assert.Contains(field, fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Team_days_are_saved_kept_when_omitted_and_never_on_match_days()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/football-strength", null));

        // Di + Do Mannschaft (2 + 8), Mo + Mi eigenes Training (1 + 4), Sa Spiel (32)
        var saved = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 5, matchDays = 32, teamDays = 10 }));
        Assert.Equal(10, saved.TeamDays);

        // Ohne teamDays bleiben sie erhalten (ältere Clients)
        var kept = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 1, matchDays = 32 }));
        Assert.Equal(10, kept.TeamDays);

        // Mannschaftstraining am Spieltag oder außerhalb der Woche: abgelehnt
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 1, matchDays = 32, teamDays = 32 }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 1, matchDays = 32, teamDays = 128 }));

        // Neuer Spieltag auf einem Team-Tag: der Team-Tag fällt weg
        var moved = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 1, matchDays = 8 }));
        Assert.Equal(2, moved.TeamDays);
    }

    [Fact]
    public async Task Coach_sees_team_days_and_team_load()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/football-strength", null));
        var tomorrow = Today.AddDays(1);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule",
            new { trainingDays = 0, matchDays = 0, teamDays = PlannedWorkoutRules.DayBit(tomorrow) }));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Team", durationSeconds = 80 * 60, sessionRpe = 6, quality = 3, team = new { focus = "conditioning", participation = "partial" },
        }));

        string? summary = null;
        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 0)
            {
                Assert.Contains($"{tomorrow:yyyy-MM-dd} {tomorrow.ToString("ddd", System.Globalization.CultureInfo.InvariantCulture)}: TEAM training (club)", req.System);
                return AiResponse.FromTool("get_training_summary", new { weeks = 2 });
            }
            summary = req.Messages.ToJsonString();
            return AiResponse.FromText("ok");
        };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wie war meine Woche?" }));
        Assert.Contains("teamMinutes", summary);
        Assert.Contains("recentTeamTrainings", summary);
        Assert.Contains("conditioning", summary);
        Assert.Contains("480", summary); // Last 6 x 80
    }

    [Fact]
    public async Task Coach_creates_a_missing_exercise_once_and_reuses_existing_ones()
    {
        var user = await _factory.CreateUserAsync();
        var results = new List<string>();
        const string Cues = "Seitstütz, oberes Bein auf der Bank, unteres Bein frei. Hüfte hoch und gerade halten, nicht nach vorne kippen.";

        _factory.Ai.Reply = (req, n) =>
        {
            Assert.Contains(req.Tools!, t => t.Name == AiTools.CreateExercise);
            if (n > 0) results.Add(req.Messages.ToJsonString());
            return n switch
            {
                0 => AiResponse.FromTool(AiTools.CreateExercise, new { name = "  Copenhagen   Plank Long Lever ", category = "Gym", muscleGroup = "Core", tracking = "Duration", perSide = true, description = Cues }, "c1"),
                1 => AiResponse.FromTool(AiTools.CreateExercise, new { name = "copenhagen-plank long lever", category = "Gym", muscleGroup = "Core", tracking = "Duration", description = Cues }, "c2"),
                2 => AiResponse.FromTool(AiTools.CreateExercise, new { name = "Bench press", category = "Gym", muscleGroup = "Chest", tracking = "WeightReps", description = Cues }, "c3"),
                3 => AiResponse.FromTool(AiTools.CreateExercise, new { name = "Zauberübung", category = "Yoga", muscleGroup = "Brain", tracking = "Magic", description = "kurz" }, "c4"),
                _ => AiResponse.FromText("Übung angelegt."),
            };
        };

        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Gib mir eine Adduktoren-Übung" }));
        var created = Assert.Single(res.Exercises!);
        Assert.Equal("Copenhagen Plank Long Lever", created.Name);
        Assert.True(created.ByCoach);
        Assert.True(created.PerSide);
        Assert.Equal(Cues, created.Description);
        // Werkzeug-Ergebnisse stehen als (escapter) Text in den Nachrichten - nur auf Wörter prüfen
        Assert.Contains("Saved to the", results[0]);
        Assert.Contains("Already in the catalog", results[1]);                 // Dublette trotz anderer Schreibweise
        Assert.Contains("Already in the catalog", results[2]);                 // Katalog-Übung statt neuer
        Assert.Contains("Bench Press", results[2]);
        Assert.Contains("Not created", results[3]);

        var catalog = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/exercises"));
        var mine = Assert.Single(catalog, e => e.IsCustom);
        Assert.Equal(created.Id, mine.Id);
        Assert.Equal(Cues, mine.Description);

        // Fremde Nutzer sehen sie nicht; Rückgängig = normales Löschen
        var other = await _factory.CreateUserAsync();
        Assert.DoesNotContain(await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await other.Client.GetAsync("/api/exercises")), e => e.Id == created.Id);
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/exercises/{created.Id}"));
    }

    [Fact]
    public async Task Coach_creates_at_most_three_exercises_per_answer()
    {
        var user = await _factory.CreateUserAsync();
        string? last = null;
        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 4) { last = req.Messages.ToJsonString(); return AiResponse.FromText("ok"); }
            return AiResponse.FromTool(AiTools.CreateExercise, new { name = $"Drill Number {n}", category = "Football", muscleGroup = "Agility", tracking = "Duration",
                description = "Hütchen im Zickzack, tiefer Schwerpunkt, kurze Schritte, Blick nach vorne, nicht aufrichten." }, $"x{n}");
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Viele Drills bitte" }));
        Assert.Equal(AiTools.MaxCoachExercisesPerAnswer, res.Exercises!.Count);
        Assert.Contains("Limit reached", last);
    }
}
