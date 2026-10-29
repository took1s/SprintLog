namespace SprintLog.Api.Models;

public class WorkoutSet
{
    public int Id { get; set; }
    public int SetNumber { get; set; }

    // Kraft
    public double? Weight { get; set; }
    public int? Reps { get; set; }

    // Feld
    public double? Distance { get; set; } // Meter
    public double? Time { get; set; }     // Sekunden

    /// <summary>Anstrengung des Satzes (RPE 1-10, halbe Schritte erlaubt). Optional.</summary>
    public double? Rpe { get; set; }

    /// <summary>Aufwärmsatz - zählt nicht für Rekorde und Volumen.</summary>
    public bool IsWarmup { get; set; }

    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;

    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
}
