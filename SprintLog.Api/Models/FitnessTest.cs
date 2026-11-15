namespace SprintLog.Api.Models;

/// <summary>
/// Ergebnis eines Leistungstests (alle 6-8 Wochen): Sprint 10/30 m, Sprung (CMJ), Richtungswechsel 5-10-5, Yo-Yo IR1, 30-15 IFT.
/// Ein Eintrag je Test und Tag; Client-Id für Offline-Anlage (idempotentes PUT).
/// </summary>
public class FitnessTest
{
    public const int MaxEntries = 1000;
    public static readonly IReadOnlyDictionary<string, (double Min, double Max)> Ranges = new Dictionary<string, (double, double)>
    {
        ["sprint10"] = (1.2, 4.0),   // Sekunden
        ["sprint30"] = (3.0, 8.0),   // Sekunden
        ["cmj"] = (5, 90),           // Zentimeter
        ["agility"] = (3.5, 8.0),    // 5-10-5, Sekunden
        ["yoyo"] = (40, 4000),       // Yo-Yo IR1, Meter
        ["ift"] = (8, 26),           // 30-15 IFT, km/h
    };

    public int Id { get; set; }
    public int UserId { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public DateOnly Day { get; set; }
    /// <summary>sprint10, sprint30, cmj, agility, yoyo, ift.</summary>
    public string Test { get; set; } = string.Empty;
    public double Value { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
