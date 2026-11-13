namespace SprintLog.Api.Models;

/// <summary>
/// Routine neben dem Trainingsplan: kurze, wiederkehrende Aufgabe mit Zeitraum - z. B. "Dehnen nach jeder Einheit bis 30.11."
/// oder "Reha Oberschenkel links, täglich 3 Wochen". Legt der Nutzer an oder der KI-Coach schlägt sie vor (Karte, Nutzer bestätigt).
/// Erledigt-Tage stehen direkt an der Routine (wenige Hundert Tage, nie einzeln abgefragt).
/// </summary>
public class Routine
{
    public const int MaxSteps = 12;
    public const int MaxDoneDays = 400;

    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>Vom Client vergeben (offline anlegen, idempotentes PUT).</summary>
    public string ClientId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    /// <summary>mobility, rehab, prevention, activation, recovery, other.</summary>
    public string Kind { get; set; } = "mobility";

    /// <summary>Wochentage als Bitmaske (Bit 0 = Montag ... Bit 6 = Sonntag), 127 = täglich.</summary>
    public int Days { get; set; } = 127;

    public DateOnly StartDate { get; set; }

    /// <summary>Bis wann (einschließlich); null = ohne Ende.</summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>Warum - z. B. "Zerrung Oberschenkel links, Physio-Freigabe".</summary>
    public string? Reason { get; set; }

    /// <summary>user oder coach (vom KI-Coach vorgeschlagen und bestätigt).</summary>
    public string Source { get; set; } = "user";

    public List<RoutineStep> Steps { get; set; } = new();

    /// <summary>Erledigte Tage (Datum des Nutzers).</summary>
    public List<DateOnly> DoneDates { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Ein Schritt: Name + Dosis ("2 x 30 s je Seite"); optional mit Katalog-Übung (Animation, Infos).</summary>
public class RoutineStep
{
    public string Name { get; set; } = string.Empty;
    public string? Dose { get; set; }
    public int? ExerciseId { get; set; }
}
