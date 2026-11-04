using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record GoalInput(double TargetWeight, int TargetReps, double Increment = 2.5, double? StartE1RM = null, DateOnly? TargetDate = null, DateTime? AchievedAt = null)
{
    public ValidationErrors Validate(DateOnly today)
    {
        return new ValidationErrors()
            .AddIf(TargetWeight is <= 0 or > 1000 || double.IsNaN(TargetWeight), "targetWeight", "Target weight must be between 0 and 1000 kg.")
            .AddIf(TargetReps is < 1 or > 12, "targetReps", "Target reps must be between 1 and 12.")
            .AddIf(Increment is < 0.25 or > 20 || double.IsNaN(Increment), "increment", "Increment must be between 0.25 and 20 kg.")
            .AddIf(StartE1RM is < 0 or > 1500, "startE1RM", "Start value must be between 0 and 1500 kg.")
            .AddIf(TargetDate is { } d && (d < today.AddDays(-1) || d > today.AddYears(3)), "targetDate", "Target date must be within the next 3 years.");
    }
}

public record GoalResponse(int ExerciseId, double TargetWeight, int TargetReps, double Increment, double? StartE1RM, DateOnly? TargetDate, DateTime CreatedAt, DateTime UpdatedAt, DateTime? AchievedAt)
{
    public static GoalResponse From(LiftGoal g) => new(g.ExerciseId, g.TargetWeight, g.TargetReps, g.Increment, g.StartE1RM, g.TargetDate, g.CreatedAt, g.UpdatedAt, g.AchievedAt);
}
