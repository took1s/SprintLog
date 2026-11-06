namespace SprintLog.Api.Models;

/// <summary>
/// Langzeit-Gedächtnis des KI-Coachs: kurze, dauerhafte Fakten über den Sportler (Ziele, Verletzungen, feste Termine,
/// Vorlieben, Reaktionen auf Training). Der Coach legt sie selbst an (Werkzeug "remember") oder der Nutzer trägt sie ein;
/// der Nutzer sieht, ändert und löscht alles. Zeitlich begrenzte Fakten (aktuelle Schmerzen) laufen über <see cref="ExpiresAt"/> ab.
/// </summary>
public class CoachMemory
{
    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>Eine von <see cref="Categories"/>.</summary>
    public string Category { get; set; } = "other";

    /// <summary>Ein Fakt, kurz und in dritter Person, z. B. "Spielt sonntags 11:00 in der Kreisliga".</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>1 = nützlich, 2 = wichtig, 3 = kritisch (Verletzung, harte Einschränkung).</summary>
    public int Importance { get; set; } = 2;

    /// <summary>"ai" = vom Coach gemerkt, "user" = selbst eingetragen.</summary>
    public string Source { get; set; } = "ai";

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    public static readonly string[] Categories = { "injury", "health", "goal", "schedule", "preference", "equipment", "insight", "other" };
}
