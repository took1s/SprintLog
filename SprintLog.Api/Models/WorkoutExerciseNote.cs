namespace SprintLog.Api.Models;

/// <summary>
/// Notiz zu einer Übung in einer Einheit: "Schulter zwickt", "Gerät besetzt - Kurzhantel genommen" oder ausgelassen mit Grund.
/// Die KI liest das als Kontext (warum etwas fehlt oder anders lief).
/// </summary>
public class WorkoutExerciseNote
{
    public int Id { get; set; }

    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;

    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;

    /// <summary>Freitext, max. 200 Zeichen.</summary>
    public string? Note { get; set; }

    /// <summary>Übung bewusst nicht (vollständig) gemacht.</summary>
    public bool Skipped { get; set; }

    /// <summary>Grund: pain, equipment, time, fatigue, other.</summary>
    public string? Reason { get; set; }
}
