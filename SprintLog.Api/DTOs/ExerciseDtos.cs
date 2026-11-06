using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record ExerciseDto(int Id, string Name, string Category, string? MuscleGroup, TrackingType TrackingType, bool IsCustom, bool IsAssisted = false, bool PerSide = false)
{
    public static ExerciseDto From(Exercise e) =>
        new(e.Id, e.Name, e.Category, e.MuscleGroup, e.TrackingType, e.UserId != null, e.IsAssisted, e.PerSide);
}

/// <summary>Eigenschaften einer eigenen Übung nachträglich ändern (z. B. "Gravitron" als unterstützte Maschine markieren).</summary>
public record UpdateExerciseRequest(bool? IsAssisted, bool? PerSide);

public record CreateExerciseRequest(string? Name, string? Category, string? MuscleGroup, TrackingType? TrackingType, bool IsAssisted = false, bool PerSide = false)
{
    public static readonly string[] AllowedCategories = { "Gym", "Football" };

    public ValidationErrors Validate()
    {
        var name = Name?.Trim() ?? string.Empty;
        return new ValidationErrors()
            .AddIf(name.Length is < 2 or > 60, "name", "Name must be 2-60 characters.")
            .AddIf(Category is null || !AllowedCategories.Contains(Category), "category", "Category must be 'Gym' or 'Football'.")
            .AddIf(MuscleGroup is { Length: > 30 }, "muscleGroup", "Muscle group must not exceed 30 characters.")
            .AddIf(TrackingType is { } t && !Enum.IsDefined(t), "trackingType", "Unknown tracking type.")
            .AddIf(IsAssisted && (TrackingType ?? Models.TrackingType.WeightReps) != Models.TrackingType.WeightReps, "isAssisted", "Only weight exercises can be assisted.");
    }
}
