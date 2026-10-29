namespace SprintLog.Api.Models;

/// <summary>
/// Bestimmt, welche Metriken für ein Übung erfasst werden.
/// Wird als String gespeichert, damit die Datenbank lesbar bleibt.
/// </summary>
public enum TrackingType
{
    /// <summary>Gewicht × Wiederholungen (Krafttraining, auch Körpergewicht mit 0 kg).</summary>
    WeightReps = 0,

    /// <summary>Distanz + Zeit (Sprints, Shuttle-Runs, Rudern).</summary>
    DistanceTime = 1,

    /// <summary>Nur Dauer in Sekunden (Plank, Seilspringen, Koordinationsleiter).</summary>
    Duration = 2
}
