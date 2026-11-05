namespace SprintLog.Api.Models;

/// <summary>
/// Steckbrief des Sportlers für den KI-Coach (Position, Körperdaten, Niveau, Ziele, Verletzungen, Geräte, Zeit).
/// Pro Nutzer genau ein Datensatz; alle Felder optional - der Coach arbeitet mit dem, was da ist.
/// </summary>
public class AthleteProfile
{
    public int UserId { get; set; }

    /// <summary>Schlüssel: goalkeeper, defender, fullback, midfielder, winger, striker.</summary>
    public string? Position { get; set; }
    public int? BirthYear { get; set; }
    public int? HeightCm { get; set; }
    public double? WeightKg { get; set; }

    /// <summary>Freitext, z. B. "Kreisliga", "U19 Bezirksliga".</summary>
    public string? Level { get; set; }
    public string? Goals { get; set; }
    public string? Injuries { get; set; }
    public string? Equipment { get; set; }

    /// <summary>Typische Zeit pro Einheit in Minuten.</summary>
    public int? SessionMinutes { get; set; }
    public string? Notes { get; set; }

    public DateTime UpdatedAt { get; set; }
}
