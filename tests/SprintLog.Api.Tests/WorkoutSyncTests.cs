using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Seitenweise Historie (GET /api/workouts) und Delta-Sync (GET /api/workouts/changes).</summary>
[Collection(ApiCollection.Name)]
public class WorkoutSyncTests
{
    private readonly SprintLogApiFactory _factory;

    public WorkoutSyncTests(SprintLogApiFactory factory) => _factory = factory;

    private static async Task<int> SaveAsync(TestUser user, DateTimeOffset date) =>
        (await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(Guid.NewGuid(), date)))).WorkoutId;

    private static async Task<WorkoutChangesResponse> ChangesAsync(TestUser user, string query = "") =>
        await HttpAssert.JsonAsync<WorkoutChangesResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/changes" + query));

    private static string Since(DateTime utc) => "?since=" + Uri.EscapeDataString(utc.ToString("O"));

    [Fact]
    public async Task List_pages_through_history_newest_first_without_gaps_or_duplicates()
    {
        var user = await _factory.CreateUserAsync();
        var start = new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero);
        var ids = new List<int>();
        for (var i = 0; i < 5; i++) ids.Add(await SaveAsync(user, start.AddDays(i)));
        // Zwei Einheiten mit identischem Datum: die ID entscheidet die Reihenfolge, nichts geht verloren.
        ids.Add(await SaveAsync(user, start.AddDays(4)));

        var seen = new List<WorkoutResponse>();
        string? cursor = null;
        var pages = 0;
        do
        {
            var url = "/api/workouts?limit=2" + (cursor is null ? "" : "&cursor=" + Uri.EscapeDataString(cursor));
            var page = await HttpAssert.JsonAsync<WorkoutPageResponse>(HttpStatusCode.OK, await user.Client.GetAsync(url));
            Assert.True(page.Items.Count <= 2);
            seen.AddRange(page.Items);
            cursor = page.NextCursor;
            pages++;
        } while (cursor is not null && pages < 10);

        Assert.Equal(3, pages);
        Assert.Equal(ids.Order(), seen.Select(w => w.Id).Order());
        Assert.Equal(seen.OrderByDescending(w => w.Date).ThenByDescending(w => w.Id).Select(w => w.Id), seen.Select(w => w.Id));
    }

    [Fact]
    public async Task Full_sync_without_since_returns_all_workouts_in_pages()
    {
        var user = await _factory.CreateUserAsync();
        for (var i = 0; i < 3; i++) await SaveAsync(user, DateTimeOffset.UtcNow.AddDays(-i));

        var first = await ChangesAsync(user, "?limit=2");
        Assert.Equal(2, first.Workouts.Count);
        Assert.NotNull(first.NextCursor);
        Assert.Empty(first.DeletedIds);

        var second = await ChangesAsync(user, "?limit=2&cursor=" + Uri.EscapeDataString(first.NextCursor!));
        Assert.Single(second.Workouts);
        Assert.Null(second.NextCursor);
        Assert.Equal(3, first.Workouts.Concat(second.Workouts).Select(w => w.Id).Distinct().Count());
    }

    [Fact]
    public async Task Incremental_sync_returns_only_new_and_changed_workouts_and_deleted_ids()
    {
        var user = await _factory.CreateUserAsync();
        var keep = await SaveAsync(user, DateTimeOffset.UtcNow.AddDays(-3));
        var edit = await SaveAsync(user, DateTimeOffset.UtcNow.AddDays(-2));
        var remove = await SaveAsync(user, DateTimeOffset.UtcNow.AddDays(-1));

        var since = DateTime.UtcNow;
        await Task.Delay(20);

        var added = await SaveAsync(user, DateTimeOffset.UtcNow);
        var update = Payloads.Workout(type: "Gym");
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/workouts/{edit}", update));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/workouts/{remove}"));

        var changes = await ChangesAsync(user, Since(since));

        Assert.Equal(new[] { added, edit }.Order(), changes.Workouts.Select(w => w.Id).Order());
        Assert.DoesNotContain(changes.Workouts, w => w.Id == keep);
        Assert.Equal("Gym", changes.Workouts.Single(w => w.Id == edit).WorkoutType);
        Assert.Equal(new[] { remove }, changes.DeletedIds);
        Assert.Null(changes.NextCursor);
        Assert.True(changes.SyncToken < DateTime.UtcNow, "Token liegt mit Überlappung vor der Serverzeit");
    }

    [Fact]
    public async Task Sync_token_overlaps_so_no_change_is_missed()
    {
        var user = await _factory.CreateUserAsync();
        var first = await ChangesAsync(user);
        var id = await SaveAsync(user, DateTimeOffset.UtcNow);

        var next = await ChangesAsync(user, Since(first.SyncToken));
        Assert.Contains(next.Workouts, w => w.Id == id);
    }

    [Fact]
    public async Task Changes_never_leak_other_users_workouts_or_deletions()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var since = DateTime.UtcNow.AddMinutes(-1);
        var id = await SaveAsync(owner, DateTimeOffset.UtcNow);
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await owner.Client.DeleteAsync($"/api/workouts/{id}"));
        await SaveAsync(owner, DateTimeOffset.UtcNow);

        var changes = await ChangesAsync(other, Since(since));
        Assert.Empty(changes.Workouts);
        Assert.Empty(changes.DeletedIds);

        // Fremde ID löschen -> 404, kein Grabstein für den Besitzer
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.DeleteAsync($"/api/workouts/{id + 1}"));
        var ownerChanges = await ChangesAsync(owner, Since(since));
        Assert.Equal(new[] { id }, ownerChanges.DeletedIds);
    }

    [Theory]
    [InlineData("/api/workouts?cursor=abc")]
    [InlineData("/api/workouts?cursor=1_2_3")]
    [InlineData("/api/workouts/changes?cursor=-5_x")]
    public async Task Invalid_cursor_is_rejected(string url)
    {
        var user = await _factory.CreateUserAsync();
        Assert.Contains("cursor", await HttpAssert.ValidationFieldsAsync(await user.Client.GetAsync(url)));
    }

    [Fact]
    public async Task Deleting_a_program_marks_its_workouts_as_changed()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created,
            await user.Client.PostAsync("/api/programs/templates/full-body-3x", null));
        var dayId = program.Days[0].Id;

        var workout = new
        {
            workoutType = "Gym", clientId = Guid.NewGuid(), programDayId = dayId,
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } }
        };
        var saved = await HttpAssert.JsonAsync<SaveWorkoutResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", workout));

        var since = DateTime.UtcNow;
        await Task.Delay(20);
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/programs/{program.Id}"));

        var changed = Assert.Single((await ChangesAsync(user, Since(since))).Workouts);
        Assert.Equal(saved.WorkoutId, changed.Id);
        Assert.Null(changed.ProgramDayId);
    }
}
