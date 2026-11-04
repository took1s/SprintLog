using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Wochenplan (Trainings- und Spieltage) eines Programms.</summary>
[Collection(ApiCollection.Name)]
public class ScheduleTests
{
    private readonly SprintLogApiFactory _factory;

    public ScheduleTests(SprintLogApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Schedule_is_saved_and_returned_with_the_program()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/football-strength", null));
        Assert.Equal(0, program.TrainingDays);

        // Mo, Mi, Fr Training (1 + 4 + 16), So Spiel (64)
        var updated = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK,
            await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 21, matchDays = 64 }));
        Assert.Equal(21, updated.TrainingDays);
        Assert.Equal(64, updated.MatchDays);

        var all = await HttpAssert.JsonAsync<List<ProgramResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/programs"));
        Assert.Equal(21, Assert.Single(all).TrainingDays);
    }

    [Fact]
    public async Task Overlapping_or_invalid_days_are_rejected_and_other_users_programs_are_404()
    {
        var user = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/football-strength", null));

        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 64, matchDays = 64 }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 128, matchDays = 0 }));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.PutAsJsonAsync($"/api/programs/{program.Id}/schedule", new { trainingDays = 1, matchDays = 0 }));
    }
}
