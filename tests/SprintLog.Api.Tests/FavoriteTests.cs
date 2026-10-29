using System.Net;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class FavoriteTests
{
    private readonly SprintLogApiFactory _factory;

    public FavoriteTests(SprintLogApiFactory factory) => _factory = factory;

    private static async Task<List<int>> FavoritesAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<int>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/favorites"));

    [Fact]
    public async Task Add_is_idempotent_and_remove_deletes()
    {
        var user = await _factory.CreateUserAsync();

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PostAsync($"/api/favorites/{Seed.BenchPress}", null));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PostAsync($"/api/favorites/{Seed.BenchPress}", null));
        Assert.Equal(new[] { Seed.BenchPress }, await FavoritesAsync(user));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/favorites/{Seed.BenchPress}"));
        Assert.Empty(await FavoritesAsync(user));
    }

    [Fact]
    public async Task Favorites_are_isolated_per_user()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await a.Client.PostAsync($"/api/favorites/{Seed.Sprints}", null));

        Assert.Empty(await FavoritesAsync(b));
    }

    [Fact]
    public async Task Unknown_exercise_returns_404()
    {
        var user = await _factory.CreateUserAsync();

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await user.Client.PostAsync("/api/favorites/999999", null));
    }
}
