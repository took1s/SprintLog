using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Models;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class ExerciseTests
{
    private readonly SprintLogApiFactory _factory;

    public ExerciseTests(SprintLogApiFactory factory) => _factory = factory;

    private static string UniqueName() => "Custom " + Guid.NewGuid().ToString("N")[..8];

    [Fact]
    public async Task Catalog_contains_seeded_exercises_with_tracking_types()
    {
        var user = await _factory.CreateUserAsync();

        var exercises = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/exercises"));

        Assert.True(exercises.Count(e => !e.IsCustom) >= 130);
        Assert.Equal(TrackingType.WeightReps, exercises.Single(e => e.Id == Seed.BenchPress).TrackingType);
        Assert.Equal(TrackingType.DistanceTime, exercises.Single(e => e.Id == Seed.Sprints).TrackingType);
        Assert.Equal(TrackingType.Duration, exercises.Single(e => e.Id == Seed.Plank).TrackingType);
    }

    [Fact]
    public async Task Category_filter_returns_only_that_category()
    {
        var user = await _factory.CreateUserAsync();

        var exercises = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/exercises?category=Football"));

        Assert.NotEmpty(exercises);
        Assert.All(exercises, e => Assert.Equal("Football", e.Category));
    }

    [Fact]
    public async Task Custom_exercise_is_visible_only_to_its_owner()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var name = UniqueName();

        var created = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await owner.Client.PostAsJsonAsync("/api/exercises", new { name, category = "Football", muscleGroup = "Legs", trackingType = "DistanceTime" }));

        Assert.True(created.IsCustom);
        Assert.True(created.Id >= 1000, "Custom exercise ids start at 1000 (identity sequence reset in migration).");
        Assert.Equal(TrackingType.DistanceTime, created.TrackingType);

        var ownerList = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await owner.Client.GetAsync("/api/exercises"));
        var otherList = await HttpAssert.JsonAsync<List<ExerciseDto>>(HttpStatusCode.OK, await other.Client.GetAsync("/api/exercises"));
        Assert.Contains(ownerList, e => e.Id == created.Id);
        Assert.DoesNotContain(otherList, e => e.Id == created.Id);
    }

    [Fact]
    public async Task Creating_exercise_with_existing_name_returns_409()
    {
        var user = await _factory.CreateUserAsync();

        var response = await user.Client.PostAsJsonAsync("/api/exercises", new { name = "bench press", category = "Gym" });

        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, response);
    }

    [Fact]
    public async Task Creating_exercise_validates_input()
    {
        var user = await _factory.CreateUserAsync();

        var response = await user.Client.PostAsJsonAsync("/api/exercises", new { name = "x", category = "Swimming" });

        var fields = await HttpAssert.ValidationFieldsAsync(response);
        Assert.Contains("name", fields, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("category", fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Seeded_or_foreign_exercises_cannot_be_deleted()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await owner.Client.PostAsJsonAsync("/api/exercises", new { name = UniqueName(), category = "Gym" }));

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await owner.Client.DeleteAsync($"/api/exercises/{Seed.BenchPress}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.DeleteAsync($"/api/exercises/{created.Id}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await owner.Client.DeleteAsync($"/api/exercises/{created.Id}"));
    }

    [Fact]
    public async Task Exercise_used_in_history_cannot_be_deleted_until_workout_is_removed()
    {
        var user = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/exercises", new { name = UniqueName(), category = "Gym" }));
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", new
            {
                workoutType = "Gym",
                sets = new[] { new { exerciseId = created.Id, weight = 50.0, reps = 10 } }
            }));

        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, await user.Client.DeleteAsync($"/api/exercises/{created.Id}"));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/workouts/{saved.WorkoutId}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/exercises/{created.Id}"));
    }

    [Fact]
    public async Task Foreign_custom_exercise_cannot_be_used_in_a_workout()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await owner.Client.PostAsJsonAsync("/api/exercises", new { name = UniqueName(), category = "Gym" }));

        var response = await other.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new[] { new { exerciseId = created.Id, weight = 50.0, reps = 10 } }
        });

        var fields = await HttpAssert.ValidationFieldsAsync(response);
        Assert.Contains("sets", fields, StringComparer.OrdinalIgnoreCase);
    }
}
