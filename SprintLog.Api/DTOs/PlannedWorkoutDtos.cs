using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record PlannedExerciseDto(int ExerciseId, int Sets, int? RepsMin = null, int? RepsMax = null, double? Weight = null, double? Distance = null,
    double? Time = null, double? TargetRpe = null, string? Note = null);

public record PlannedWorkoutInput(DateOnly Date, string? Title, string? Category, string? Notes, List<PlannedExerciseDto>? Exercises,
    string? Status = null, string? WorkoutClientId = null, string? Source = null, bool? ReplacesPlan = null)
{
    public static readonly IReadOnlySet<string> Categories = new HashSet<string> { "Gym", "Football" };
    public static readonly IReadOnlySet<string> Statuses = new HashSet<string> { "planned", "done", "skipped" };

    public ValidationErrors Validate(DateOnly today)
    {
        var ex = Exercises ?? new();
        return new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(Title) || Title.Trim().Length > 60, "title", "Title is required (max 60 characters).")
            .AddIf(Category is null || !Categories.Contains(Category), "category", "Unknown category.")
            .AddIf(Date < today.AddDays(-90) || Date > today.AddDays(180), "date", "Date is out of range.")
            .AddIf(Notes is { Length: > 300 }, "notes", "Notes must not exceed 300 characters.")
            .AddIf(ex.Count is < 1 or > PlannedWorkout.MaxExercises, "exercises", $"Add 1 to {PlannedWorkout.MaxExercises} exercises.")
            .AddIf(ex.Any(x => x.Sets is < 1 or > 20 || x.RepsMin is < 1 or > 100 || x.RepsMax is < 1 or > 100 || (x.RepsMin is { } a && x.RepsMax is { } b && b < a)
                || x.Weight is < 0 or > 1000 || x.Distance is < 0 or > 100_000 || x.Time is < 0 or > 36_000 || x.TargetRpe is < 1 or > 10 || x.Note is { Length: > 120 }),
                "exercises", "Exercise values are out of range.")
            .AddIf(Status is not null && !Statuses.Contains(Status), "status", "Unknown status.")
            .AddIf(WorkoutClientId is { Length: > 64 }, "workoutClientId", "Invalid workout id.")
            .AddIf(Source is not (null or "user" or "coach"), "source", "Unknown source.");
    }
}

public record PlannedWorkoutResponse(string ClientId, DateOnly Date, string Title, string Category, string? Notes, string Source, string Status,
    string? WorkoutClientId, List<PlannedExerciseDto> Exercises, DateTime CreatedAt, DateTime UpdatedAt, bool ReplacesPlan = false)
{
    public static PlannedWorkoutResponse From(PlannedWorkout p) => new(p.ClientId, p.Date, p.Title, p.Category, p.Notes, p.Source, p.Status,
        p.WorkoutClientId, p.Exercises.Select(x => new PlannedExerciseDto(x.ExerciseId, x.Sets, x.RepsMin, x.RepsMax, x.Weight, x.Distance, x.Time, x.TargetRpe, x.Note)).ToList(),
        p.CreatedAt, p.UpdatedAt, p.ReplacesPlan);
}
