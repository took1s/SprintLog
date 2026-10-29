using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class ProgramTests
{
    private readonly SprintLogApiFactory _factory;

    public ProgramTests(SprintLogApiFactory factory) => _factory = factory;

    private static object CustomProgram(string name = "My plan") => new
    {
        name,
        goal = "Strength",
        weeks = 6,
        days = new object[]
        {
            new { name = "Day A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 8, restSeconds = 120, progressionStep = 2.5 } } },
            new { name = "Sprint day", exercises = new object[] { new { exerciseId = Seed.Sprints, sets = 6, distance = 30.0, restSeconds = 120 } } },
        }
    };

    private static async Task<List<ProgramResponse>> ProgramsAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<ProgramResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/programs"));

    [Fact]
    public async Task All_templates_reference_existing_exercises_and_can_be_started()
    {
        var user = await _factory.CreateUserAsync();
        var templates = await HttpAssert.JsonAsync<List<ProgramTemplate>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/programs/templates"));
        Assert.Equal(ProgramTemplates.All.Count, templates.Count);

        foreach (var t in ProgramTemplates.All)
        {
            var created = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync($"/api/programs/templates/{t.Key}", null));
            Assert.Equal(t.Name, created.Name);
            Assert.True(created.IsActive);
            Assert.Equal(t.Days.Count, created.Days.Count);
            Assert.All(created.Days, d => Assert.NotEmpty(d.Exercises));
        }

        // Nur der zuletzt gestartete Plan ist aktiv
        var programs = await ProgramsAsync(user);
        Assert.Single(programs, p => p.IsActive);
        Assert.Equal(ProgramTemplates.All[^1].Name, programs.Single(p => p.IsActive).Name);
    }

    [Fact]
    public async Task Unknown_template_returns_404()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await user.Client.PostAsync("/api/programs/templates/nope", null));
    }

    [Fact]
    public async Task Custom_program_is_created_active_when_none_is_active_and_isolated_per_user()
    {
        var user = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();

        var first = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram()));
        var second = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram("Second")));

        Assert.True(first.IsActive);
        Assert.False(second.IsActive);
        Assert.Equal(new[] { "Day A", "Sprint day" }, first.Days.Select(d => d.Name));
        Assert.Equal(30, first.Days[1].Exercises[0].Distance);
        Assert.Empty(await ProgramsAsync(other));
        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.PostAsync($"/api/programs/{first.Id}/activate", null));
    }

    [Fact]
    public async Task Activate_switches_the_active_program()
    {
        var user = await _factory.CreateUserAsync();
        var a = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram("Plan A")));
        var b = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram("Plan B")));

        var activated = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK, await user.Client.PostAsync($"/api/programs/{b.Id}/activate", null));
        Assert.True(activated.IsActive);
        Assert.NotNull(activated.StartedAt);

        var programs = await ProgramsAsync(user);
        Assert.False(programs.Single(p => p.Id == a.Id).IsActive);

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PostAsync($"/api/programs/{b.Id}/deactivate", null));
        Assert.DoesNotContain(await ProgramsAsync(user), p => p.IsActive);
    }

    [Fact]
    public async Task Update_keeps_existing_day_ids_so_workouts_stay_linked()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram()));
        var dayA = program.Days[0];

        // Einheit für Tag A speichern
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            programDayId = dayA.Id,
            sets = new[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } }
        }));

        // Tag A umbenennen + Übung ändern, Sprint-Tag entfernen, neuen Tag hinzufügen
        var updated = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{program.Id}", new
        {
            name = "Renamed",
            goal = "Hypertrophy",
            weeks = 8,
            days = new object[]
            {
                new { id = dayA.Id, name = "Push", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 4, repsMin = 8, repsMax = 10 } } },
                new { name = "Core", exercises = new object[] { new { exerciseId = Seed.Plank, sets = 3, time = 45.0 } } },
            }
        }));

        Assert.Equal("Renamed", updated.Name);
        Assert.Equal(dayA.Id, updated.Days[0].Id);
        Assert.Equal("Push", updated.Days[0].Name);
        Assert.Equal(4, updated.Days[0].Exercises.Single().Sets);
        Assert.Equal("Core", updated.Days[1].Name);

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Equal(dayA.Id, Assert.Single(history).ProgramDayId);
    }

    [Fact]
    public async Task Deleting_a_program_keeps_workouts_but_unlinks_them()
    {
        var user = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", CustomProgram()));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            programDayId = program.Days[0].Id,
            sets = new[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } }
        }));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.DeleteAsync($"/api/programs/{program.Id}"));

        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Null(Assert.Single(history).ProgramDayId);
        Assert.Empty(await ProgramsAsync(user));
    }

    [Fact]
    public async Task Workout_cannot_reference_a_foreign_program_day()
    {
        var owner = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var program = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await owner.Client.PostAsJsonAsync("/api/programs", CustomProgram()));

        var fields = await HttpAssert.ValidationFieldsAsync(await other.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            programDayId = program.Days[0].Id,
            sets = new[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } }
        }));
        Assert.Contains("programDayId", fields, StringComparer.OrdinalIgnoreCase);
    }

    public static TheoryData<object, string> InvalidPrograms => new()
    {
        { new { name = "x", goal = "Strength", weeks = 6, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 8 } } } } }, "name" },
        { new { name = "Plan", goal = "Fun", weeks = 6, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 8 } } } } }, "goal" },
        { new { name = "Plan", goal = "Strength", weeks = 0, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 8 } } } } }, "weeks" },
        { new { name = "Plan", goal = "Strength", weeks = 6, days = Array.Empty<object>() }, "days" },
        { new { name = "Plan", goal = "Strength", weeks = 6, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 9, repsMax = 5 } } } } }, "days[0].exercises[0]" },
        { new { name = "Plan", goal = "Strength", weeks = 6, days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = 999999, sets = 3, repsMin = 5, repsMax = 8 } } } } }, "days" },
    };

    [Theory]
    [MemberData(nameof(InvalidPrograms))]
    public async Task Invalid_programs_are_rejected(object payload, string expectedField)
    {
        var user = await _factory.CreateUserAsync();
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/programs", payload));
        Assert.Contains(expectedField, fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Custom_exercise_used_in_a_program_cannot_be_deleted()
    {
        var user = await _factory.CreateUserAsync();
        var ex = await HttpAssert.JsonAsync<ExerciseDto>(HttpStatusCode.Created,
            await user.Client.PostAsJsonAsync("/api/exercises", new { name = "Sled " + Guid.NewGuid().ToString("N")[..6], category = "Football", trackingType = "DistanceTime" }));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Sled plan", goal = "Speed", weeks = 4,
            days = new object[] { new { name = "A", exercises = new object[] { new { exerciseId = ex.Id, sets = 5, distance = 20.0 } } } }
        }));

        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, await user.Client.DeleteAsync($"/api/exercises/{ex.Id}"));
    }

    [Fact]
    public async Task Deleting_the_account_also_removes_programs()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/football-strength", null));
        var req = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account") { Content = JsonContent.Create(new { password = user.Password }) };
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.SendAsync(req));
    }
}
