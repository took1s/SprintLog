using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Models;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class WorkoutTests
{
    private readonly SprintLogApiFactory _factory;

    public WorkoutTests(SprintLogApiFactory factory) => _factory = factory;

    private static async Task<List<WorkoutResponse>> HistoryAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));

    [Fact]
    public async Task Saved_workout_appears_in_history_with_client_date_and_ordered_sets()
    {
        var user = await _factory.CreateUserAsync();
        var performedAt = new DateTimeOffset(2026, 10, 1, 17, 30, 0, TimeSpan.Zero);

        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(Guid.NewGuid(), performedAt)));

        var workout = Assert.Single(await HistoryAsync(user));
        Assert.Equal(saved.WorkoutId, workout.Id);
        Assert.Equal(performedAt.UtcDateTime, workout.Date);
        Assert.Equal("Hybrid", workout.WorkoutType);
        Assert.Equal(3600, workout.DurationSeconds);
        Assert.Equal(new[] { 1, 2, 3 }, workout.Sets.Select(s => s.SetNumber));
        Assert.Equal("Bench Press", workout.Sets[0].ExerciseName);
        Assert.Equal(TrackingType.DistanceTime, workout.Sets[2].TrackingType);
        Assert.Equal(4.2, workout.Sets[2].Time);
    }

    [Fact]
    public async Task Date_with_timezone_offset_is_stored_as_utc()
    {
        var user = await _factory.CreateUserAsync();

        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts",
            Payloads.Workout(date: new DateTimeOffset(2026, 10, 1, 10, 0, 0, TimeSpan.FromHours(2)))));

        var workout = Assert.Single(await HistoryAsync(user));
        Assert.Equal(new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc), workout.Date);
    }

    [Fact]
    public async Task Saving_twice_with_same_client_id_does_not_create_a_duplicate()
    {
        var user = await _factory.CreateUserAsync();
        var clientId = Guid.NewGuid();

        var first = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(clientId)));
        var second = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(clientId)));

        Assert.True(second.Duplicate);
        Assert.Equal(first.WorkoutId, second.WorkoutId);
        Assert.Single(await HistoryAsync(user));
    }

    [Fact]
    public async Task Parallel_sync_of_the_same_workout_creates_exactly_one_entry()
    {
        var user = await _factory.CreateUserAsync();
        var clientId = Guid.NewGuid();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5)
            .Select(_ => user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(clientId))));

        Assert.All(responses, r => Assert.True(r.IsSuccessStatusCode, $"Status {(int)r.StatusCode}"));
        Assert.Single(await HistoryAsync(user));
    }

    [Fact]
    public async Task Same_client_id_from_different_users_is_allowed()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();
        var clientId = Guid.NewGuid();

        await HttpAssert.StatusAsync(HttpStatusCode.Created, await a.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(clientId)));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await b.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(clientId)));
    }

    [Fact]
    public async Task Users_only_see_their_own_workouts()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();

        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await a.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout()));

        Assert.Empty(await HistoryAsync(b));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await b.Client.GetAsync($"/api/workouts/{saved.WorkoutId}"));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await a.Client.GetAsync($"/api/workouts/{saved.WorkoutId}"));
    }

    [Fact]
    public async Task Only_the_owner_can_delete_a_workout()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await a.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout()));

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await b.Client.DeleteAsync($"/api/workouts/{saved.WorkoutId}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await a.Client.DeleteAsync($"/api/workouts/{saved.WorkoutId}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await a.Client.DeleteAsync($"/api/workouts/{saved.WorkoutId}"));
        Assert.Empty(await HistoryAsync(a));
    }

    [Fact]
    public async Task Legacy_save_endpoint_still_works_for_cached_app_versions()
    {
        var user = await _factory.CreateUserAsync();

        var response = await user.Client.PostAsJsonAsync("/api/workouts/save", new
        {
            WorkoutType = "Gym",
            Sets = new[] { new { ExerciseId = Seed.BenchPress, Weight = 60.0, Reps = 10, Distance = 0.0, Time = 0.0 } }
        });

        Assert.True(response.IsSuccessStatusCode);
        Assert.Single(await HistoryAsync(user));
    }

    public static TheoryData<object, string> InvalidWorkouts => new()
    {
        { new { workoutType = "Gym", sets = Array.Empty<object>() }, "sets" },
        { new { workoutType = "Swimming", sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "workoutType" },
        { new { workoutType = "Gym", sets = new[] { new { exerciseId = Seed.BenchPress, weight = -5.0, reps = 1 } } }, "sets[0]" },
        { new { workoutType = "Gym", sets = new[] { new { exerciseId = Seed.BenchPress, weight = 5000.0, reps = 1 } } }, "sets[0]" },
        { new { workoutType = "Gym", sets = new[] { new { exerciseId = 999_999, weight = 10.0, reps = 1 } } }, "sets" },
        { new { workoutType = "Gym", date = DateTimeOffset.UtcNow.AddDays(3), sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "date" }
    };

    [Theory]
    [MemberData(nameof(InvalidWorkouts))]
    public async Task Invalid_workouts_are_rejected_with_validation_problem(object payload, string expectedField)
    {
        var user = await _factory.CreateUserAsync();

        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/workouts", payload));

        Assert.Contains(expectedField, fields, StringComparer.OrdinalIgnoreCase);
        Assert.Empty(await HistoryAsync(user));
    }
}
