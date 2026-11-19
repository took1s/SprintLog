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

    /// <summary>Studio, in dem trainiert wurde (Geräte und Gewichte unterscheiden sich je Studio).</summary>
    public string? Gym { get; set; }

    /// <summary>Notizen pro Übung - auch für ausgelassene Übungen (Grund für die KI).</summary>
    public List<WorkoutExerciseNote> ExerciseNotes { get; set; } = new();

    // Nur bei "Match": Tore, Vorlagen, Gegner (optional)
    public int? Goals { get; set; }
    public int? Assists { get; set; }
    public string? Opponent { get; set; }
    /// <summary>Position im Spiel (goalkeeper, defender, fullback, midfielder, winger, striker).</summary>
    public string? Position { get; set; }
    /// <summary>Endstand aus Sicht des eigenen Teams.</summary>
    public int? TeamGoals { get; set; }
    public int? OpponentGoals { get; set; }
    public string? WentWell { get; set; }
    public string? ToImprove { get; set; }

    // Aus Apple Health (Watch) übernommen, optional
    public int? DistanceM { get; set; }
    public int? AvgHr { get; set; }
    public int? MaxHr { get; set; }
    public double? MaxSpeedKmh { get; set; }
    public int? Sprints { get; set; }

    /// <summary>Mannschaftstraining (WorkoutType "Team"): Schwerpunkt (tactical, technical, conditioning, game, recovery, mixed).</summary>
    public string? TeamFocus { get; set; }

    /// <summary>Mannschaftstraining: Teilnahme (full, partial, modified, individual).</summary>
    public string? Participation { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public List<WorkoutSet> Sets { get; set; } = new();
}
