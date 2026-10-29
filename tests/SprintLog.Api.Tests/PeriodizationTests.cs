using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class PeriodizationTests
{
    private readonly SprintLogApiFactory _factory;

    public PeriodizationTests(SprintLogApiFactory factory) => _factory = factory;

    [Fact]
    public void Every_template_is_valid_uses_catalog_exercises_and_has_unique_key()
    {
        var catalog = AppDbContext.SeedExercises.ToDictionary(e => e.Id);
        Assert.Equal(ProgramTemplates.All.Count, ProgramTemplates.All.Select(t => t.Key).Distinct().Count());
        foreach (var t in ProgramTemplates.All)
        {
            var errors = new ProgramInput(t.Name, t.Goal, t.Weeks, t.Days, t.CycleWeeks, t.DeloadEvery).Validate();
            Assert.False(errors.HasErrors, $"{t.Key}: {string.Join("; ", errors.Errors.SelectMany(e => e.Value))}");
            Assert.Contains(t.Category, new[] { "Football", "Gym" });
            Assert.All(t.Sources, s => Assert.StartsWith("https://", s.Url));
            foreach (var x in t.Days.SelectMany(d => d.Exercises!))
            {
                Assert.True(catalog.ContainsKey(x.ExerciseId), $"{t.Key}: exercise {x.ExerciseId} not in catalog");
                // Prozentbasiert nur bei Gewicht × Wdh.
                if (x.PercentOf1Rm is not null) Assert.Equal(Models.TrackingType.WeightReps, catalog[x.ExerciseId].TrackingType);
            }
        }
    }

    [Fact]
    public async Task Templates_expose_sources_cycle_and_week_steps()
    {
        var user = await _factory.CreateUserAsync();
        var templates = await HttpAssert.JsonAsync<List<ProgramTemplate>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/programs/templates"));
        var wendler = templates.Single(t => t.Key == "531-bbb");
        Assert.Equal(4, wendler.CycleWeeks);
        Assert.NotEmpty(wendler.Sources);

        var created = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/531-bbb", null));
        Assert.Equal(4, created.CycleWeeks);
        var main = created.Days[0].Exercises[0];
        Assert.Equal(77, main.PercentOf1Rm);
        Assert.Equal(new[] { 2, 3, 4 }, main.WeekSteps.Select(s => s.FromWeek));
        Assert.Equal(54, main.WeekSteps[^1].PercentOf1Rm);

        var shield = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsync("/api/programs/templates/hamstring-groin-shield", null));
        var nordic = shield.Days[0].Exercises.Single(x => x.ExerciseId == Seed.Nordic);
        Assert.Equal(4, nordic.WeekSteps.Count);
        Assert.Equal((3, 8, 12), (nordic.WeekSteps[^1].Sets!.Value, nordic.WeekSteps[^1].RepsMin!.Value, nordic.WeekSteps[^1].RepsMax!.Value));
    }

    private static object ProgramWithSteps(object[] steps, int? cycle = null, int? deload = null) => new
    {
        name = "Periodized", goal = "Strength", weeks = 8, cycleWeeks = cycle, deloadEvery = deload,
        days = new object[]
        {
            new { name = "A", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5, percentOf1Rm = 75, note = "  Pause on chest  ", weekSteps = steps } } }
        }
    };

    [Fact]
    public async Task Custom_program_with_week_steps_cycle_and_deload_round_trips_and_updates()
    {
        var user = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs",
            ProgramWithSteps(new object[] { new { fromWeek = 2, percentOf1Rm = 80, repsMin = 3 }, new { fromWeek = 3, sets = 2, note = "Deload" } }, cycle: 3, deload: null)));
        Assert.Equal(3, created.CycleWeeks);
        var x = created.Days[0].Exercises[0];
        Assert.Equal("Pause on chest", x.Note);
        Assert.Equal(2, x.WeekSteps.Count);
        Assert.Equal((80, 3, 3), (x.WeekSteps[0].PercentOf1Rm!.Value, x.WeekSteps[0].RepsMin!.Value, x.WeekSteps[0].RepsMax!.Value)); // RepsMax übernimmt RepsMin

        // Bearbeiten ersetzt die Stufen; Entlastung statt Zyklus
        var updated = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{created.Id}",
            ProgramWithSteps(new object[] { new { fromWeek = 5, percentOf1Rm = 85 } }, cycle: null, deload: 4)));
        Assert.Null(updated.CycleWeeks);
        Assert.Equal(4, updated.DeloadEvery);
        Assert.Equal(5, Assert.Single(updated.Days[0].Exercises[0].WeekSteps).FromWeek);
    }

    public static TheoryData<object, string> InvalidPrograms => new()
    {
        { ProgramWithSteps(new object[] { new { fromWeek = 3 }, new { fromWeek = 2 } }), "days[0].exercises[0]" },
        { ProgramWithSteps(new object[] { new { fromWeek = 9 } }), "days[0].exercises[0]" },
        { ProgramWithSteps(new object[] { new { fromWeek = 4 } }, cycle: 3), "days[0].exercises[0]" },
        { ProgramWithSteps(new object[] { new { fromWeek = 2, percentOf1Rm = 120 } }), "days[0].exercises[0]" },
        { ProgramWithSteps(Array.Empty<object>(), cycle: 13), "cycleWeeks" },
        { ProgramWithSteps(Array.Empty<object>(), deload: 1), "deloadEvery" },
    };

    [Theory]
    [MemberData(nameof(InvalidPrograms))]
    public async Task Invalid_periodization_is_rejected(object program, string field)
    {
        var user = await _factory.CreateUserAsync();
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/programs", program));
        Assert.Contains(field, fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Set_notes_are_saved_trimmed_and_limited()
    {
        var user = await _factory.CreateUserAsync();
        var save = await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 5, note = "  Left shoulder a bit sore  " }, new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 5 } }
        });
        Assert.Equal(HttpStatusCode.Created, save.StatusCode);
        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Equal("Left shoulder a bit sore", history[0].Sets[0].Note);
        Assert.Null(history[0].Sets[1].Note);

        var tooLong = await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 5, note = new string('x', 201) } }
        });
        Assert.Contains("sets[0]", await HttpAssert.ValidationFieldsAsync(tooLong), StringComparer.OrdinalIgnoreCase);
    }
}
