using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record WeekStepDto(
    int FromWeek,
    int? Sets = null,
    int? RepsMin = null,
    int? RepsMax = null,
    double? Distance = null,
    double? Time = null,
    int? PercentOf1Rm = null,
    double? TargetRpe = null,
    string? Note = null)
{
    public static WeekStepDto From(WeekStep s) => new(s.FromWeek, s.Sets, s.RepsMin, s.RepsMax, s.Distance, s.Time, s.PercentOf1Rm, s.TargetRpe, s.Note);

    public WeekStep ToModel() => new()
    {
        FromWeek = FromWeek, Sets = Sets, RepsMin = RepsMin ?? RepsMax, RepsMax = RepsMax ?? RepsMin, Distance = Distance, Time = Time,
        PercentOf1Rm = PercentOf1Rm, TargetRpe = TargetRpe, Note = string.IsNullOrWhiteSpace(Note) ? null : Note.Trim()
    };
}

public record ProgramExerciseInput(
    int ExerciseId,
    int Sets,
    int? RepsMin = null,
    int? RepsMax = null,
    double? Distance = null,
    double? Time = null,
    double? TargetRpe = null,
    int? RestSeconds = null,
    double? ProgressionStep = null,
    int? PercentOf1Rm = null,
    string? Note = null,
    List<WeekStepDto>? WeekSteps = null);

public record ProgramDayInput(int? Id, string? Name, string? Notes, List<ProgramExerciseInput>? Exercises);

public record ProgramInput(string? Name, string? Goal, int Weeks, List<ProgramDayInput>? Days, int? CycleWeeks = null, int? DeloadEvery = null)
{
    public const int MaxWeekSteps = 12;
    /// <summary>Sätze bzw. Läufe pro Übung (Sprint-Protokolle haben bis zu 24 Wiederholungen).</summary>
    public const int MaxSets = 30;

    public static readonly string[] AllowedGoals = { "Strength", "Hypertrophy", "Speed", "General" };
    public const int MaxDays = 7;
    public const int MaxExercisesPerDay = 15;

    public ValidationErrors Validate()
    {
        var name = Name?.Trim() ?? string.Empty;
        var errors = new ValidationErrors()
            .AddIf(name.Length is < 2 or > 60, "name", "Name must be 2-60 characters.")
            .AddIf(Goal is null || !AllowedGoals.Contains(Goal), "goal", "Goal must be Strength, Hypertrophy, Speed or General.")
            .AddIf(Weeks is < 1 or > 52, "weeks", "Weeks must be between 1 and 52.")
            .AddIf(Days is null || Days.Count == 0, "days", "A program needs at least one day.")
            .AddIf(Days is { Count: > MaxDays }, "days", $"A program can have at most {MaxDays} days.")
            .AddIf(CycleWeeks is < 1 or > 12, "cycleWeeks", "The cycle must be 1-12 weeks.")
            .AddIf(DeloadEvery is < 2 or > 12, "deloadEvery", "Deload must be every 2-12 weeks.");
        if (Days is null) return errors;

        for (var d = 0; d < Days.Count && d < MaxDays; d++)
        {
            var day = Days[d];
            var dayKey = $"days[{d}]";
            var dayName = day.Name?.Trim() ?? string.Empty;
            errors
                .AddIf(dayName.Length is < 1 or > 40, dayKey, "Day name must be 1-40 characters.")
                .AddIf(day.Notes is { Length: > 200 }, dayKey, "Day notes must not exceed 200 characters.")
                .AddIf(day.Exercises is null || day.Exercises.Count == 0, dayKey, "Each day needs at least one exercise.")
                .AddIf(day.Exercises is { Count: > MaxExercisesPerDay }, dayKey, $"A day can have at most {MaxExercisesPerDay} exercises.");
            if (day.Exercises is null) continue;

            for (var i = 0; i < day.Exercises.Count && i < MaxExercisesPerDay; i++)
            {
                var x = day.Exercises[i];
                var key = $"days[{d}].exercises[{i}]";
                errors
                    .AddIf(x.Sets is < 1 or > MaxSets, key, $"Sets must be between 1 and {MaxSets}.")
                    .AddIf(x.RepsMin is < 1 or > 100 || x.RepsMax is < 1 or > 100, key, "Reps must be between 1 and 100.")
                    .AddIf(x.RepsMin is { } min && x.RepsMax is { } max && min > max, key, "Minimum reps cannot exceed maximum reps.")
                    .AddIf(x.Distance is <= 0 or > 10_000, key, "Distance must be between 1 and 10000 m.")
                    .AddIf(x.Time is <= 0 or > 3_600, key, "Time must be between 1 and 3600 s.")
                    .AddIf(x.RepsMin is null && x.RepsMax is null && x.Distance is null && x.Time is null, key, "Set a rep range, a distance or a time.")
                    .AddIf(x.TargetRpe is < 5 or > 10, key, "Target RPE must be between 5 and 10.")
                    .AddIf(x.RestSeconds is < 0 or > 900, key, "Rest must be between 0 and 900 s.")
                    .AddIf(x.ProgressionStep is < 0 or > 20, key, "Progression step must be between 0 and 20 kg.")
                    .AddIf(x.PercentOf1Rm is < 30 or > 100, key, "Percent of 1RM must be between 30 and 100.")
                    .AddIf(x.Note is { Length: > 120 }, key, "Exercise notes must not exceed 120 characters.")
                    .AddIf(x.WeekSteps is { Count: > MaxWeekSteps }, key, $"At most {MaxWeekSteps} week steps per exercise.");
                if (x.WeekSteps is null) continue;

                var previous = 0;
                foreach (var step in x.WeekSteps.Take(MaxWeekSteps))
                {
                    var maxWeek = CycleWeeks ?? Weeks;
                    errors
                        .AddIf(step.FromWeek <= previous, key, "Week steps must be in ascending week order without duplicates.")
                        .AddIf(step.FromWeek < 1 || step.FromWeek > maxWeek, key, $"Week steps must start between week 1 and {maxWeek}.")
                        .AddIf(step.Sets is < 1 or > MaxSets, key, $"Sets must be between 1 and {MaxSets}.")
                        .AddIf(step.RepsMin is < 1 or > 100 || step.RepsMax is < 1 or > 100, key, "Reps must be between 1 and 100.")
                        .AddIf(step.RepsMin is { } smin && step.RepsMax is { } smax && smin > smax, key, "Minimum reps cannot exceed maximum reps.")
                        .AddIf(step.Distance is <= 0 or > 10_000, key, "Distance must be between 1 and 10000 m.")
                        .AddIf(step.Time is <= 0 or > 3_600, key, "Time must be between 1 and 3600 s.")
                        .AddIf(step.PercentOf1Rm is < 30 or > 100, key, "Percent of 1RM must be between 30 and 100.")
                        .AddIf(step.TargetRpe is < 5 or > 10, key, "Target RPE must be between 5 and 10.")
                        .AddIf(step.Note is { Length: > 80 }, key, "Week step notes must not exceed 80 characters.");
                    previous = step.FromWeek;
                }
            }
        }
        return errors;
    }
}

public record ProgramExerciseResponse(
    int Id, int Position, int ExerciseId, string ExerciseName, TrackingType TrackingType, string? MuscleGroup,
    int Sets, int? RepsMin, int? RepsMax, double? Distance, double? Time, double? TargetRpe, int? RestSeconds, double? ProgressionStep,
    int? PercentOf1Rm, string? Note, List<WeekStepDto> WeekSteps);

public record ProgramDayResponse(int Id, int Position, string Name, string? Notes, List<ProgramExerciseResponse> Exercises);

public record ProgramResponse(
    int Id, string Name, string Goal, int Weeks, bool IsActive, DateTime? StartedAt, DateTime CreatedAt, string? TemplateKey,
    List<ProgramDayResponse> Days, int? CycleWeeks, int? DeloadEvery);

/// <summary>Eingebaute Vorlage (Daten: Data/program-templates.json).</summary>
public record ProgramTemplate(string Key, string Name, string Description, string Goal, string Level, int Weeks, List<ProgramDayInput> Days)
{
    /// <summary>Einheiten pro Woche (Tage rotieren, z. B. A/B 3x pro Woche). Standard: Anzahl Tage.</summary>
    public int? SessionsPerWeek { get; init; }
    public int DaysPerWeek => SessionsPerWeek ?? Days.Count;
    public int? CycleWeeks { get; init; }
    public int? DeloadEvery { get; init; }
    /// <summary>Studien bzw. Originalquellen, auf denen die Vorlage beruht.</summary>
    public IReadOnlyList<TemplateSource> Sources { get; init; } = Array.Empty<TemplateSource>();
    /// <summary>"Football" (Platz, Prävention, Athletik) oder "Gym".</summary>
    public string Category { get; init; } = "Gym";
}

public record TemplateSource(string Title, string Url);
