using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>Leistungstests, Tageswerte (Gewicht/Eiweiß/Health), Spiel-Details, Uhr-Werte, Match-Day-Phasen und Coach-Kontext.</summary>
[Collection(ApiCollection.Name)]
public class AthleteTests
{
    private readonly SprintLogApiFactory _factory;

    public AthleteTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");

    [Fact]
    public async Task Fitness_tests_are_saved_idempotently_validated_and_deleted()
    {
        var user = await _factory.CreateUserAsync();
        var body = new { day = Iso(Today), test = "sprint10", value = 1.784, notes = " Kunstrasen " };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-a0000001", body));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-a0000001", body));
        var list = await HttpAssert.JsonAsync<List<FitnessTestResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/fitness-tests"));
        var t = Assert.Single(list);
        Assert.Equal(1.78, t.Value);
        Assert.Equal("Kunstrasen", t.Notes);

        var bad = await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-a0000002", new { day = Iso(Today.AddDays(3)), test = "cmj", value = 150.0 });
        var fields = await HttpAssert.ValidationFieldsAsync(bad);
        Assert.Contains("value", fields);
        Assert.Contains("day", fields);
        Assert.Contains("test", await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-a0000003", new { day = Iso(Today), test = "bench", value = 1.0 })));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync("/api/fitness-tests/ft-a0000001"));
        Assert.Empty(await HttpAssert.JsonAsync<List<FitnessTestResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/fitness-tests")));

        // Fremde Nutzer sehen nichts
        var other = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-a0000004", body));
        Assert.Empty(await HttpAssert.JsonAsync<List<FitnessTestResponse>>(HttpStatusCode.OK, await other.Client.GetAsync("/api/fitness-tests")));
    }

    [Fact]
    public async Task Daily_log_upserts_per_day_updates_profile_weight_and_deletes_when_empty()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/profile/athlete", new { position = "winger", weightKg = 76 }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today.AddDays(-1))}", new { weightKg = 76.44, proteinG = 140 }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today)}", new { weightKg = 75.8, sleepMinutes = 470, restingHr = 52, hrv = 68, steps = 9000 }));
        var days = await HttpAssert.JsonAsync<List<DailyLogResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/daily"));
        Assert.Equal(new double?[] { 76.4, 75.8 }, days.Select(d => d.WeightKg));
        Assert.Equal(470, days[1].SleepMinutes);
        var profile = await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await user.Client.GetAsync("/api/profile/athlete"));
        Assert.Equal(75.8, profile.WeightKg);

        // Älterer Tag ändert das Profil nicht
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today.AddDays(-5))}", new { weightKg = 79.0 }));
        Assert.Equal(75.8, (await HttpAssert.JsonAsync<AthleteProfileDto>(HttpStatusCode.OK, await user.Client.GetAsync("/api/profile/athlete"))).WeightKg);

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today.AddDays(-5))}", new { }));
        Assert.Equal(2, (await HttpAssert.JsonAsync<List<DailyLogResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/daily"))).Count);

        var bad = await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today)}", new { weightKg = 10.0, restingHr = 300 });
        var fields = await HttpAssert.ValidationFieldsAsync(bad);
        Assert.Contains("weightKg", fields);
        Assert.Contains("restingHr", fields);
        Assert.Contains("day", await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync("/api/daily/gestern", new { proteinG = 10 })));
    }

    [Fact]
    public async Task Match_details_and_watch_values_are_saved_and_watch_values_survive_older_clients()
    {
        var user = await _factory.CreateUserAsync();
        var clientId = Guid.NewGuid();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Match", clientId, durationSeconds = 70 * 60, sessionRpe = 8, quality = 7,
            match = new { goals = 1, assists = 0, opponent = "TSV", position = "winger", teamGoals = 2, opponentGoals = 1, wentWell = " 1v1 ", toImprove = "Pressing" },
            health = new { distanceM = 8400, avgHr = 158, maxHr = 192, maxSpeedKmh = 31.27, sprints = 18 },
        }));
        var created = Assert.Single(await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history")));
        Assert.Equal(new MatchDetails(1, 0, "TSV", "winger", 2, 1, "1v1", "Pressing"), created.Match);
        Assert.Equal(new WorkoutHealth(8400, 158, 192, 31.3, 18), created.Health);

        // Älterer Client ändert ohne health: Uhr-Werte bleiben
        var updated = await HttpAssert.JsonAsync<WorkoutResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/workouts/{created.Id}", new
        {
            workoutType = "Match", durationSeconds = 75 * 60, sessionRpe = 8, match = new { goals = 2, position = "striker" },
        }));
        Assert.Equal(18, updated.Health?.Sprints);
        Assert.Equal("striker", updated.Match?.Position);
        Assert.Null(updated.Match?.TeamGoals);

        // Nur Uhr-Werte setzen (Import aus Apple Health), Sätze/Spiel bleiben
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PutAsJsonAsync($"/api/workouts/{created.Id}/health", new { distanceM = 9100, sprints = 21 }));
        var after = Assert.Single(await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history")));
        Assert.Equal(new WorkoutHealth(9100, null, null, null, 21), after.Health);
        Assert.Equal(2, after.Match?.Goals);
        Assert.Contains("health", await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync($"/api/workouts/{created.Id}/health", new { avgHr = 400 })));
        Assert.Equal(HttpStatusCode.NotFound, (await (await _factory.CreateUserAsync()).Client.PutAsJsonAsync($"/api/workouts/{created.Id}/health", new { sprints = 1 })).StatusCode);

        var bad = await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Match", durationSeconds = 3600, sessionRpe = 7, match = new { position = "libero" }, health = new { maxSpeedKmh = 80.0 },
        });
        var fields = await HttpAssert.ValidationFieldsAsync(bad);
        Assert.Contains("match", fields);
        Assert.Contains("health", fields);
    }

    [Theory]
    [InlineData(0, "MD")]
    [InlineData(1, "MD+1")]
    [InlineData(2, "MD+2")]
    [InlineData(3, "MD-4")]
    [InlineData(6, "MD-1")]
    public void Match_day_phase_for_a_weekly_match(int offset, string label)
    {
        var match = new DateOnly(2026, 11, 14); // Samstag
        var bit = 1 << (((int)match.DayOfWeek + 6) % 7);
        Assert.Equal(label, MatchDay.Label(match.AddDays(offset), bit));
    }

    [Fact]
    public void Match_day_phase_prefers_recovery_and_is_empty_without_matches()
    {
        var wed = new DateOnly(2026, 11, 11);
        var sat = new DateOnly(2026, 11, 14);
        var bits = (1 << 2) | (1 << 5); // Mi + Sa
        Assert.Equal("MD+1", MatchDay.Label(wed.AddDays(1), bits)); // Do: nach Mi, vor Sa -> Regeneration zuerst
        Assert.Equal("MD-1", MatchDay.Label(sat.AddDays(-1), bits));
        Assert.Null(MatchDay.Label(sat, 0));
    }

    [Fact]
    public async Task Coach_sees_tests_body_values_and_match_day_phases()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-c0000001", new { day = Iso(Today.AddDays(-60)), test = "sprint30", value = 4.35 }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/fitness-tests/ft-c0000002", new { day = Iso(Today.AddDays(-2)), test = "sprint30", value = 4.21 }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/daily/{Iso(Today)}", new { weightKg = 76.0, proteinG = 150, sleepMinutes = 480 }));
        var plan = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Plan", goal = "Speed", weeks = 6,
            days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5 } } } },
        }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{plan.Id}/schedule",
            new { trainingDays = PlannedWorkoutRules.DayBit(Today.AddDays(4)), matchDays = PlannedWorkoutRules.DayBit(Today.AddDays(2)) }));
        _factory.Ai.Reply = (req, _) =>
        {
            Assert.Contains("30 m sprint: 4.21 s", req.System);
            Assert.Contains("previous 4.35", req.System);
            Assert.Contains("Body weight: latest 76 kg", req.System);
            Assert.Contains("protein 150 g", req.System);
            Assert.Contains("sleep 8 h", req.System);
            Assert.Contains($"{Iso(Today.AddDays(1))} {Today.AddDays(1).ToString("ddd", CultureInfo.InvariantCulture)}: MD-1 (activation", req.System);
            return AiResponse.FromText("Ok.");
        };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Wie stehe ich?" }));
    }
}
