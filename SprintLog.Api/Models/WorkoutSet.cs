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

    // Ausdauergerät (TrackingType.Cardio) - alles optional, Dauer steht in Time, Distanz in Distance
    /// <summary>Widerstandsstufe bzw. Steigung (%), wie am Gerät angezeigt.</summary>
    public double? Level { get; set; }
    /// <summary>Durchschnittliche Leistung in Watt.</summary>
    public int? Power { get; set; }
    /// <summary>Durchschnittspuls (Schläge/min).</summary>
    public int? HeartRate { get; set; }
    /// <summary>Trittfrequenz bzw. Schlagzahl pro Minute.</summary>
    public int? Cadence { get; set; }
    /// <summary>Kalorien laut Gerät.</summary>
    public int? Calories { get; set; }

    /// <summary>Anstrengung des Satzes (RPE 1-10, halbe Schritte erlaubt). Optional.</summary>
    public double? Rpe { get; set; }

    /// <summary>Aufwärmsatz - zählt nicht für Rekorde und Volumen.</summary>
    public bool IsWarmup { get; set; }

    /// <summary>Notiz zum Satz, z. B. "Knie schmerzt" oder "Griff breiter" (max. 200 Zeichen).</summary>
    public string? Note { get; set; }

    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;

    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
}
