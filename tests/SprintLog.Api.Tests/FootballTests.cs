using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class FootballTests
{
    private readonly SprintLogApiFactory _factory;

    public FootballTests(SprintLogApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Match_without_sets_is_saved_with_minutes_rpe_and_details()
    {
        var user = await _factory.CreateUserAsync();
        var save = await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Match", durationSeconds = 75 * 60, sessionRpe = 8, notes = "Left back",
            match = new { goals = 1, assists = 2, opponent = "  FC Weißenhorn  " }
        });
        Assert.Equal(HttpStatusCode.Created, save.StatusCode);

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        var match = Assert.Single(history);
        Assert.Equal("Match", match.WorkoutType);
        Assert.Empty(match.Sets);
        Assert.Equal(new MatchDetails(1, 2, "FC Weißenhorn"), match.Match);

        // Andere Einheiten haben keine Spiel-Details
        await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout());
        history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Null(history.Single(w => w.WorkoutType != "Match").Match);
    }

    public static TheoryData<object, string> InvalidMatches => new()
    {
        { new { workoutType = "Match", sessionRpe = 7 }, "durationSeconds" },
        { new { workoutType = "Match", durationSeconds = 3600 }, "sessionRpe" },
        { new { workoutType = "Match", durationSeconds = 3600, sessionRpe = 7, match = new { goals = -1 } }, "match" },
        { new { workoutType = "Gym", sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 50.0, reps = 5 } }, match = new { goals = 1 } }, "match" },
        { new { workoutType = "Gym", sets = Array.Empty<object>() }, "sets" },
    };

    [Theory]
    [MemberData(nameof(InvalidMatches))]
    public async Task Invalid_matches_are_rejected(object payload, string field)
    {
        var user = await _factory.CreateUserAsync();
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/workouts", payload));
        Assert.Contains(field, fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Wellness_is_upserted_per_day_listed_newest_first_and_isolated()
    {
        var user = await _factory.CreateUserAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var yesterday = today.AddDays(-1);

        await HttpAssert.JsonAsync<WellnessResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/wellness/{yesterday:yyyy-MM-dd}", new { sleep = 2, energy = 3, soreness = 2, mood = 4, sleepHours = 6.5 }));
        await user.Client.PutAsJsonAsync($"/api/wellness/{today:yyyy-MM-dd}", new { sleep = 4, energy = 4, soreness = 3, mood = 4 });
        var updated = await HttpAssert.JsonAsync<WellnessResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/wellness/{today:yyyy-MM-dd}", new { sleep = 5, energy = 5, soreness = 4, mood = 5, note = "  Fresh  " }));
        Assert.Equal("Fresh", updated.Note);

        var list = await HttpAssert.JsonAsync<List<WellnessResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/wellness?days=7"));
        Assert.Equal(new[] { today, yesterday }, list.Select(w => w.Date));
        Assert.Equal(5, list[0].Sleep);
        Assert.Equal(6.5, list[1].SleepHours);

        var other = await _factory.CreateUserAsync();
        Assert.Empty(await HttpAssert.JsonAsync<List<WellnessResponse>>(HttpStatusCode.OK, await other.Client.GetAsync("/api/wellness")));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.DeleteAsync($"/api/wellness/{today:yyyy-MM-dd}"));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/wellness/{yesterday:yyyy-MM-dd}"));
        Assert.Single(await HttpAssert.JsonAsync<List<WellnessResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/wellness")));
    }

    [Theory]
    [InlineData("2026-13-01", 3, "date")]
    [InlineData("tomorrowish", 3, "date")]
    [InlineData(null, 6, "sleep")]
    [InlineData(null, 0, "sleep")]
    public async Task Invalid_wellness_is_rejected(string? date, int sleep, string field)
    {
        var user = await _factory.CreateUserAsync();
        var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync($"/api/wellness/{day}", new { sleep, energy = 3, soreness = 3, mood = 3 }));
        Assert.Contains(field, fields, StringComparer.OrdinalIgnoreCase);

        var future = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5).ToString("yyyy-MM-dd");
        Assert.Contains("date", await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync($"/api/wellness/{future}", new { sleep = 3, energy = 3, soreness = 3, mood = 3 })), StringComparer.OrdinalIgnoreCase);
    }
}
