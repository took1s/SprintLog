using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record ProgramExerciseInput(
    int ExerciseId,
    int Sets,
    int? RepsMin = null,
    int? RepsMax = null,
    double? Distance = null,
    double? Time = null,
    double? TargetRpe = null,
    int? RestSeconds = null,
    double? ProgressionStep = null);

public record ProgramDayInput(int? Id, string? Name, string? Notes, List<ProgramExerciseInput>? Exercises);

public record ProgramInput(string? Name, string? Goal, int Weeks, List<ProgramDayInput>? Days)
{
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
            .AddIf(Days is { Count: > MaxDays }, "days", $"A program can have at most {MaxDays} days.");
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
                    .AddIf(x.Sets is < 1 or > 20, key, "Sets must be between 1 and 20.")
                    .AddIf(x.RepsMin is < 1 or > 100 || x.RepsMax is < 1 or > 100, key, "Reps must be between 1 and 100.")
                    .AddIf(x.RepsMin is { } min && x.RepsMax is { } max && min > max, key, "Minimum reps cannot exceed maximum reps.")
                    .AddIf(x.Distance is <= 0 or > 10_000, key, "Distance must be between 1 and 10000 m.")
                    .AddIf(x.Time is <= 0 or > 3_600, key, "Time must be between 1 and 3600 s.")
                    .AddIf(x.RepsMin is null && x.RepsMax is null && x.Distance is null && x.Time is null, key, "Set a rep range, a distance or a time.")
                    .AddIf(x.TargetRpe is < 5 or > 10, key, "Target RPE must be between 5 and 10.")
                    .AddIf(x.RestSeconds is < 0 or > 900, key, "Rest must be between 0 and 900 s.")
                    .AddIf(x.ProgressionStep is < 0 or > 20, key, "Progression step must be between 0 and 20 kg.");
            }
        }
        return errors;
    }
}

public record ProgramExerciseResponse(
    int Id, int Position, int ExerciseId, string ExerciseName, TrackingType TrackingType, string? MuscleGroup,
    int Sets, int? RepsMin, int? RepsMax, double? Distance, double? Time, double? TargetRpe, int? RestSeconds, double? ProgressionStep);

public record ProgramDayResponse(int Id, int Position, string Name, string? Notes, List<ProgramExerciseResponse> Exercises);

public record ProgramResponse(
    int Id, string Name, string Goal, int Weeks, bool IsActive, DateTime? StartedAt, DateTime CreatedAt, string? TemplateKey,
    List<ProgramDayResponse> Days);

public record ProgramTemplate(string Key, string Name, string Description, string Goal, string Level, int Weeks, List<ProgramDayInput> Days)
{
    public int DaysPerWeek => Days.Count;
}
