namespace SprintLog.Api.Models;

/// <summary>
/// Tägliches Befinden (Wellness-Fragebogen nach McLean et al. 2010, je 1-5, höher = besser).
/// Zusammen mit der Trainingslast (ACWR) zeigt es, wann ein leichterer Tag sinnvoll ist. Pro Nutzer und Tag ein Eintrag.
/// </summary>
public class WellnessEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>Kalendertag (lokales Datum des Nutzers).</summary>
    public DateOnly Date { get; set; }

    /// <summary>Schlafqualität 1-5.</summary>
    public int Sleep { get; set; }

    /// <summary>Energie / Frische 1-5 (5 = sehr frisch, 1 = sehr müde).</summary>
    public int Energy { get; set; }

    /// <summary>Muskelkater 1-5 (5 = keiner, 1 = stark).</summary>
    public int Soreness { get; set; }

    /// <summary>Stimmung / Stress 1-5 (5 = entspannt, 1 = sehr gestresst).</summary>
    public int Mood { get; set; }

    /// <summary>Schlafdauer in Stunden (optional).</summary>
    public double? SleepHours { get; set; }

    public string? Note { get; set; }

    public DateTime UpdatedAt { get; set; }
}
