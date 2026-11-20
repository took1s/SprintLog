using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Endpoints;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>
/// Rückmeldungen des Coachs selbst: Plan-Tag nach Wochentag, Ersatz statt Doppeltag, keine behaupteten Karten,
/// Schmerz 0-10 je Übung.
/// </summary>
[Collection(ApiCollection.Name)]
public class CoachTodayTests
{
    private readonly SprintLogApiFactory _factory;

    public CoachTodayTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static int Bit(DateOnly d) => PlannedWorkoutRules.DayBit(d);

    [Theory]
    [InlineData("2: Бедро B + верх (пт, MD-2)", 4)]
    [InlineData("Lower (Fri)", 4)]
    [InlineData("Unterkörper (Mo/Do)", 0)]
    public void Weekday_hints_come_from_parentheses(string name, int expected) =>
        Assert.Contains(expected, PlanWeekdays.Hints(name));

    [Fact]
    public void Weekday_hints_ignore_words_outside_parentheses() => Assert.Empty(PlanWeekdays.Hints("Sprint Do it"));

    [Fact]
    public void Plan_day_follows_weekday_by_name_or_by_order()
    {
        var wed = new DateOnly(2026, 11, 18);
        var fri = new DateOnly(2026, 11, 20);
        var program = new TrainingProgram
        {
            TrainingDays = Bit(wed) | Bit(fri), MatchDays = Bit(new DateOnly(2026, 11, 22)),
            Days = [new ProgramDay { Id = 1, Position = 1, Name = "B" }, new ProgramDay { Id = 2, Position = 0, Name = "A" }],
        };
        Assert.Equal(2, PlanWeekdays.DayFor(program, wed)!.Id); // Reihenfolge nach Position
        Assert.Equal(1, PlanWeekdays.DayFor(program, fri)!.Id);
        Assert.Null(PlanWeekdays.DayFor(program, new DateOnly(2026, 11, 19)));

        program.Days[1].Name = "A (пт)"; // Hinweis im Namen schlägt die Reihenfolge
        Assert.Equal(2, PlanWeekdays.DayFor(program, fri)!.Id);
    }

    [Theory]
    [InlineData("Я подготовил карточку на сегодня.", true)]
    [InlineData("Карточка ниже - прими её одним касанием.", true)]
    [InlineData("I created a card for Friday.", true)]
    [InlineData("Die Karte unten übernimmt alles.", true)]
    [InlineData("Если хочешь, я создам карточку.", false)]
    [InlineData("Want me to add a session card?", false)]
    [InlineData("Сегодня по плану Бедро B, состав выше.", false)]
    public void Card_claims_are_detected(string text, bool claims) => Assert.Equal(claims, AiEndpoints.ClaimsCard(text));

    [Fact]
    public async Task Coach_claiming_a_card_without_one_gets_one_correction_round()
    {
        var user = await _factory.CreateUserAsync();
        string? check = null;
        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 0) return AiResponse.FromText("Я подготовил карточку на сегодня - прими её.");
            check = req.Messages.ToJsonString();
            return AiResponse.FromText("Поправка: карточку я не создавал. Сегодняшняя тренировка уже в плане. Создать замену?");
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Что сегодня?" }));
        Assert.Contains("Self-check from the app", check);
        Assert.StartsWith("Поправка", res.Answer);
        Assert.Empty(res.Actions);
    }

    [Fact]
    public async Task Coach_replaces_todays_plan_day_instead_of_making_a_double_day()
    {
        var user = await _factory.CreateUserAsync();
        var tomorrow = Today.AddDays(1);
        var plan = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", new
        {
            name = "Plan", goal = "Strength", weeks = 6,
            days = new object[] { new { name = "Beine (Haupttag)", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5 } } } },
        }));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{plan.Id}/schedule",
            new { trainingDays = Bit(tomorrow), matchDays = Bit(Today.AddDays(3)) }));

        var results = new List<string>();
        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 0)
            {
                Assert.Contains($"plan training day 'Beine (Haupttag)'", req.System);
                // Auf einen freien Tag geht kein Ersatz
                return AiResponse.FromTool(AiTools.ProposeSession, new { date = Iso(Today.AddDays(2)), title = "Leicht", category = "Gym", reason = "x", replacesPlanDay = true,
                    exercises = new[] { new { exerciseId = Seed.Nordic, sets = 2 } } });
            }
            results.Add(req.Messages.ToJsonString());
            if (n == 1)
                return AiResponse.FromTool(AiTools.ProposeSession, new { date = Iso(tomorrow), title = "Beine leicht", category = "Gym", reason = "Oberschenkel zieht", replacesPlanDay = true,
                    exercises = new[] { new { exerciseId = Seed.Nordic, sets = 2 } } });
            return AiResponse.FromText("Morgen ersetzt die leichtere Einheit den Plan-Tag.");
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Mach morgen leichter" }));
        Assert.Contains("not a plan training day", results[0]);
        Assert.Contains("Replacement", results[1]);
        Assert.DoesNotContain("Double day", results[1]);
        var s = Assert.Single(res.Actions)["session"]!;
        Assert.True((bool)s["replacesPlan"]!);
        Assert.Equal("Beine (Haupttag)", (string?)s["planDayName"]);

        // Speichern: Ersatz nur an Trainingstagen
        var saved = await HttpAssert.JsonAsync<PlannedWorkoutResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/planned/pl-repl0001", new
        {
            date = Iso(tomorrow), title = "Beine leicht", category = "Gym", replacesPlan = true, exercises = new object[] { new { exerciseId = Seed.Nordic, sets = 2 } },
        }));
        Assert.True(saved.ReplacesPlan);
        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PutAsJsonAsync("/api/planned/pl-repl0002", new
        {
            date = Iso(Today.AddDays(2)), title = "X", category = "Gym", replacesPlan = true, exercises = new object[] { new { exerciseId = Seed.Nordic, sets = 2 } },
        }));
        Assert.Contains("replacesPlan", fields);

        // Kalender für den Coach: Plan-Tag als ersetzt markiert
        string? system = null;
        _factory.Ai.Reply = (req, _) => { system = req.System; return AiResponse.FromText("ok"); };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Und morgen?" }));
        Assert.Contains("REPLACED this date by session id pl-repl0001", system);
    }

    [Fact]
    public async Task Pain_per_exercise_is_saved_validated_and_shown_to_the_coach()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } },
            exerciseNotes = new object[] { new { exerciseId = Seed.BenchPress, pain = 4 } },
        }));
        var history = await HttpAssert.JsonAsync<List<WorkoutResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/workouts/history"));
        Assert.Equal(4, Assert.Single(Assert.Single(history).ExerciseNotes!).Pain);

        var fields = await HttpAssert.ValidationFieldsAsync(await user.Client.PostAsJsonAsync("/api/workouts", new
        {
            workoutType = "Gym",
            sets = new object[] { new { exerciseId = Seed.BenchPress, weight = 60.0, reps = 8 } },
            exerciseNotes = new object[] { new { exerciseId = Seed.BenchPress, pain = 11 } },
        }));
        Assert.Contains("exerciseNotes[0]", fields);

        string? tool = null;
        _factory.Ai.Reply = (req, n) =>
        {
            if (n == 0) return AiResponse.FromTool("get_exercise_history", new { exercise = "Bench Press" });
            tool = req.Messages.ToJsonString();
            return AiResponse.FromText("ok");
        };
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Bankdrücken?" }));
        Assert.Contains("pain 4/10", tool);
    }
}
