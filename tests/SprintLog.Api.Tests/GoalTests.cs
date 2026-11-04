using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Kraft-Ziele: Upsert pro Übung (idempotent), Validierung, Isolation, Löschen.</summary>
[Collection(ApiCollection.Name)]
public class GoalTests
{
    private readonly SprintLogApiFactory _factory;

    public GoalTests(SprintLogApiFactory factory) => _factory = factory;

    private static async Task<List<GoalResponse>> GoalsAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<GoalResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/goals"));

    [Fact]
    public async Task Put_creates_then_updates_the_same_goal()
    {
        var user = await _factory.CreateUserAsync();

        var created = await HttpAssert.JsonAsync<GoalResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/goals/{Seed.BenchPress}", new { targetWeight = 100, targetReps = 1, increment = 2.5, startE1RM = 84.2 }));
        Assert.Equal(100, created.TargetWeight);
        Assert.Equal(84.2, created.StartE1RM);

        // Erneutes PUT (z. B. Offline-Queue wiederholt) überschreibt statt zu duplizieren
        await HttpAssert.JsonAsync<GoalResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/goals/{Seed.BenchPress}", new { targetWeight = 105, targetReps = 3, increment = 1.25, startE1RM = 84.2 }));

        var goal = Assert.Single(await GoalsAsync(user));
        Assert.Equal(105, goal.TargetWeight);
        Assert.Equal(3, goal.TargetReps);
        Assert.Equal(1.25, goal.Increment);
    }

    [Fact]
    public async Task Invalid_values_are_rejected_with_field_errors()
    {
        var user = await _factory.CreateUserAsync();
        var response = await user.Client.PutAsJsonAsync($"/api/goals/{Seed.BenchPress}", new { targetWeight = 0, targetReps = 30, increment = 0 });
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, response);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("targetWeight", body);
        Assert.Contains("targetReps", body);
        Assert.Contains("increment", body);
    }

    [Fact]
    public async Task Goals_are_isolated_and_delete_is_idempotent()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await a.Client.PutAsJsonAsync($"/api/goals/{Seed.BenchPress}", new { targetWeight = 80, targetReps = 5 }));

        Assert.Empty(await GoalsAsync(b));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await b.Client.DeleteAsync($"/api/goals/{Seed.BenchPress}"));
        Assert.Single(await GoalsAsync(a));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await a.Client.DeleteAsync($"/api/goals/{Seed.BenchPress}"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await a.Client.DeleteAsync($"/api/goals/{Seed.BenchPress}"));
        Assert.Empty(await GoalsAsync(a));
    }

    [Fact]
    public async Task Unknown_exercise_returns_404()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await user.Client.PutAsJsonAsync("/api/goals/999999", new { targetWeight = 50, targetReps = 5 }));
    }
}
