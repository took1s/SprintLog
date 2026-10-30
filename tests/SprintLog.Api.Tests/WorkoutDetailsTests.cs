using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class WorkoutDetailsTests
{
    private readonly SprintLogApiFactory _factory;

    public WorkoutDetailsTests(SprintLogApiFactory factory) => _factory = factory;

    private static object DetailedWorkout(Guid? clientId = null) => new
    {
        workoutType = "Gym",
        clientId,
        date = new DateTimeOffset(2026, 10, 20, 18, 0, 0, TimeSpan.Zero),
        durationSeconds = 3000,
        sessionRpe = 7,
        quality = 8,
        notes = "  Felt strong today  ",
        sets = new object[]
        {
            new { exerciseId = Seed.BenchPress, weight = 40.0, reps = 10, isWarmup = true },
            new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 6, rpe = 8.5 },
        }
    };

    [Fact]
    public async Task Rpe_warmup_and_notes_are_stored_and_returned()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", DetailedWorkout()));

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        var w = Assert.Single(history);
        Assert.Equal(7, w.SessionRpe);
        Assert.Equal(8, w.Quality);
        Assert.Equal("Felt strong today", w.Notes);
        Assert.True(w.Sets[0].IsWarmup);
        Assert.Null(w.Sets[0].Rpe);
        Assert.False(w.Sets[1].IsWarmup);
        Assert.Equal(8.5, w.Sets[1].Rpe);
    }

    [Fact]
    public async Task Update_replaces_metadata_and_sets()
    {
        var user = await _factory.CreateUserAsync();
        var clientId = Guid.NewGuid();
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", DetailedWorkout(clientId)));

        var updated = await HttpAssert.JsonAsync<WorkoutResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/workouts/{saved.WorkoutId}", new
        {
            workoutType = "Hybrid",
            date = new DateTimeOffset(2026, 10, 19, 17, 0, 0, TimeSpan.Zero),
            durationSeconds = 3600,
            sessionRpe = 9,
            notes = "",
            sets = new object[]
            {
                new { exerciseId = Seed.BenchPress, weight = 82.5, reps = 5, rpe = 9 },
                new { exerciseId = Seed.Sprints, distance = 30.0, time = 4.1 },
                new { exerciseId = Seed.Plank, time = 60.0 },
            }
        }));

        Assert.Equal(saved.WorkoutId, updated.Id);
        Assert.Equal(clientId, updated.ClientId);
        Assert.Equal("Hybrid", updated.WorkoutType);
        Assert.Equal(new DateTime(2026, 10, 19, 17, 0, 0, DateTimeKind.Utc), updated.Date);
        Assert.Equal(9, updated.SessionRpe);
        Assert.Null(updated.Notes);
        Assert.Equal(new[] { 1, 2, 3 }, updated.Sets.Select(s => s.SetNumber));
        Assert.Equal(82.5, updated.Sets[0].Weight);

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Equal(3, Assert.Single(history).Sets.Count);
    }

    [Fact]
    public async Task Update_of_foreign_or_missing_workout_returns_404()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await owner.Client.PostAsJsonAsync("/api/workouts", DetailedWorkout()));

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.PutAsJsonAsync($"/api/workouts/{saved.WorkoutId}", DetailedWorkout()));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await owner.Client.PutAsJsonAsync("/api/workouts/999999", DetailedWorkout()));
    }

    [Fact]
    public async Task Update_validates_like_create()
    {
        var user = await _factory.CreateUserAsync();
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", DetailedWorkout()));

        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync($"/api/workouts/{saved.WorkoutId}",
            new { workoutType = "Gym", sets = Array.Empty<object>() }));

        Assert.Contains("sets", fields, StringComparer.OrdinalIgnoreCase);
    }

    public static TheoryData<object, string> InvalidDetails => new()
    {
        { new { workoutType = "Gym", sessionRpe = 11, sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "sessionRpe" },
        { new { workoutType = "Gym", quality = 0, sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "quality" },
        { new { workoutType = "Gym", quality = 11, sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "quality" },
        { new { workoutType = "Gym", notes = new string('x', 501), sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1 } } }, "notes" },
        { new { workoutType = "Gym", sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1, rpe = 7.3 } } }, "sets[0]" },
        { new { workoutType = "Gym", sets = new[] { new { exerciseId = Seed.BenchPress, weight = 10.0, reps = 1, rpe = 0.5 } } }, "sets[0]" },
    };

    [Theory]
    [MemberData(nameof(InvalidDetails))]
    public async Task Invalid_details_are_rejected(object payload, string expectedField)
    {
        var user = await _factory.CreateUserAsync();

        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/workouts", payload));

        Assert.Contains(expectedField, fields, StringComparer.OrdinalIgnoreCase);
    }
}
