namespace SprintLog.Api.Models;

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>"Gym" oder "Football".</summary>
    public string Category { get; set; } = string.Empty;

    public string? MuscleGroup { get; set; }

    public TrackingType TrackingType { get; set; } = TrackingType.WeightReps;

    /// <summary>NULL = Standard-Übung für alle. Gesetzt = eigene Übung dieses Nutzers.</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    public List<WorkoutSet> Sets { get; set; } = new();
}
