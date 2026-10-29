using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record WorkoutSetDto(int ExerciseId, double? Weight, int? Reps, double? Distance, double? Time);

public record CreateWorkoutRequest(
    string? WorkoutType,
    List<WorkoutSetDto>? Sets,
    Guid? ClientId = null,
    DateTimeOffset? Date = null,
    int? DurationSeconds = null)
{
    public static readonly string[] AllowedTypes = { "Gym", "Football", "Hybrid" };
    public const int MaxSets = 200;

    // Plausibilitätsgrenzen - schützen vor Tippfehlern (z. B. 2000 kg) und Missbrauch.
    public const double MaxWeight = 1000;
    public const int MaxReps = 1000;
    public const double MaxDistance = 100_000; // 100 km
    public const double MaxTime = 86_400;      // 24 h

    public ValidationErrors Validate(DateTimeOffset now)
    {
        var errors = new ValidationErrors()
            .AddIf(WorkoutType is null || !AllowedTypes.Contains(WorkoutType), "workoutType", "Workout type must be 'Gym', 'Football' or 'Hybrid'.")
            .AddIf(Sets is null || Sets.Count == 0, "sets", "Cannot save an empty workout.")
            .AddIf(Sets is { Count: > MaxSets }, "sets", $"A workout cannot contain more than {MaxSets} sets.")
            .AddIf(Date is { } d && d > now.AddDays(1), "date", "Workout date cannot be in the future.")
            .AddIf(Date is { } d2 && d2 < now.AddYears(-5), "date", "Workout date is too far in the past.")
            .AddIf(DurationSeconds is < 0 or > 86_400, "durationSeconds", "Duration must be between 0 and 24 hours.");

        if (Sets is null) return errors;

        for (var i = 0; i < Sets.Count && i < MaxSets; i++)
        {
            var s = Sets[i];
            var key = $"sets[{i}]";
            errors
                .AddIf(s.Weight < 0 || s.Reps < 0 || s.Distance < 0 || s.Time < 0, key, "Metrics cannot be negative.")
                .AddIf(s.Weight > MaxWeight || s.Reps > MaxReps || s.Distance > MaxDistance || s.Time > MaxTime, key, "Metric value is out of range.")
                .AddIf(double.IsNaN(s.Weight ?? 0) || double.IsNaN(s.Distance ?? 0) || double.IsNaN(s.Time ?? 0), key, "Metric value is not a number.");
        }

        return errors;
    }
}

public record WorkoutSetResponse(
    int ExerciseId,
    string ExerciseName,
    TrackingType TrackingType,
    string? MuscleGroup,
    int SetNumber,
    double? Weight,
    int? Reps,
    double? Distance,
    double? Time);

public record WorkoutResponse(
    int Id,
    Guid? ClientId,
    DateTime Date,
    string WorkoutType,
    int? DurationSeconds,
    List<WorkoutSetResponse> Sets);

public record SaveWorkoutResponse(int WorkoutId, bool Duplicate, string Message);
