namespace SprintLog.Api.Models;

public class Workout
{
    public int Id { get; set; }

    /// <summary>Zeitpunkt, an dem die Einheit begonnen wurde (UTC) - kommt vom Client, damit Offline-Einheiten das richtige Datum behalten.</summary>
    public DateTime Date { get; set; } = DateTime.UtcNow;

    /// <summary>"Gym", "Football", "Hybrid" oder "Match" (Spiel: ohne Sätze, Last aus Minuten × Session-RPE).</summary>
    public string WorkoutType { get; set; } = string.Empty;

    /// <summary>Dauer der Einheit in Sekunden (optional).</summary>
    public int? DurationSeconds { get; set; }

    /// <summary>Session-RPE (1-10, Borg CR-10). Mit der Dauer ergibt sich die Trainingslast (sRPE × Minuten).</summary>
    public int? SessionRpe { get; set; }

    /// <summary>Subjektive Qualität der Einheit (1-10): Wie gut lief es technisch/taktisch? Unabhängig von der Anstrengung (RPE).</summary>
    public int? Quality { get; set; }

    /// <summary>Freitext-Notiz zur Einheit (max. 500 Zeichen).</summary>
    public string? Notes { get; set; }

    /// <summary>Vom Client erzeugte ID - macht das Speichern idempotent (doppelte Sync-Versuche erzeugen keine Duplikate).</summary>
    public Guid? ClientId { get; set; }

    /// <summary>Letzte Änderung (Server-Zeit, UTC) - Grundlage für den Delta-Sync.</summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>Trainingstag aus einem Plan, zu dem diese Einheit gehört (optional).</summary>
    public int? ProgramDayId { get; set; }
    public ProgramDay? ProgramDay { get; set; }

    // Nur bei "Match": Tore, Vorlagen, Gegner (optional)
    public int? Goals { get; set; }
    public int? Assists { get; set; }
    public string? Opponent { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public List<WorkoutSet> Sets { get; set; } = new();
}
