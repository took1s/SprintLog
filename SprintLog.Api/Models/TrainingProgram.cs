namespace SprintLog.Api.Models;

/// <summary>Trainingsplan eines Nutzers (aus Vorlage oder selbst erstellt). Pro Nutzer ist höchstens einer aktiv.</summary>
public class TrainingProgram
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    /// <summary>"Strength", "Hypertrophy", "Speed" oder "General".</summary>
    public string Goal { get; set; } = "General";

    /// <summary>Geplante Dauer in Wochen.</summary>
    public int Weeks { get; set; } = 8;

    public bool IsActive { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Schlüssel der Vorlage, aus der der Plan erstellt wurde (null = eigener Plan).</summary>
    public string? TemplateKey { get; set; }

    /// <summary>
    /// Wochen-Zyklus: Die Wochen-Stufen der Übungen wiederholen sich alle N Wochen (z. B. 4 bei 5/3/1).
    /// null = keine Wiederholung, die Stufen gelten ab ihrer Woche bis zum Ende.
    /// </summary>
    public int? CycleWeeks { get; set; }

    /// <summary>Jede N-te Woche ist eine Entlastungswoche: ~60 % der Sätze, ~10 % weniger Gewicht, RPE -2. null = keine.</summary>
    public int? DeloadEvery { get; set; }

    public List<ProgramDay> Days { get; set; } = new();
}

/// <summary>Ein Trainingstag im Plan (z. B. "Push", "Sprint-Tag"). Tage werden der Reihe nach rotiert.</summary>
public class ProgramDay
{
    public int Id { get; set; }
    public int ProgramId { get; set; }
    public TrainingProgram Program { get; set; } = null!;

    public int Position { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public List<ProgramExercise> Exercises { get; set; } = new();
}

/// <summary>Vorgabe für eine Übung an einem Trainingstag.</summary>
public class ProgramExercise
{
    public int Id { get; set; }
    public int DayId { get; set; }
    public ProgramDay Day { get; set; } = null!;

    public int Position { get; set; }
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;

    /// <summary>Anzahl Arbeitssätze (bei Sprints: Anzahl Läufe).</summary>
    public int Sets { get; set; } = 3;

    /// <summary>Wiederholungsbereich für Gewicht × Wdh. (Double Progression: erst RepsMax erreichen, dann Gewicht erhöhen).</summary>
    public int? RepsMin { get; set; }
    public int? RepsMax { get; set; }

    /// <summary>Zielstrecke in Metern (Distanz + Zeit).</summary>
    public double? Distance { get; set; }

    /// <summary>Zieldauer in Sekunden (Dauer-Übungen).</summary>
    public double? Time { get; set; }

    public double? TargetRpe { get; set; }
    public int? RestSeconds { get; set; }

    /// <summary>Gewichtssteigerung in kg, wenn alle Sätze RepsMax erreicht haben.</summary>
    public double? ProgressionStep { get; set; }

    /// <summary>Prozent des geschätzten 1RM (30-100). Gesetzt = prozentbasiert statt Double Progression.</summary>
    public int? PercentOf1Rm { get; set; }

    /// <summary>Kurzer Hinweis, z. B. "letzter Satz so viele Wdh. wie möglich" oder "pro Seite".</summary>
    public string? Note { get; set; }

    /// <summary>Änderungen ab bestimmten Wochen (Periodisierung, Protokolle wie Nordic/Copenhagen). Als JSON gespeichert.</summary>
    public List<WeekStep> WeekSteps { get; set; } = new();
}

/// <summary>
/// Ab Woche <see cref="FromWeek"/> gelten diese Werte (bis zur nächsten Stufe). Nicht gesetzte Felder = Grundwert der Übung.
/// Woche bezieht sich auf den Zyklus (<see cref="TrainingProgram.CycleWeeks"/>), falls gesetzt.
/// </summary>
public class WeekStep
{
    public int FromWeek { get; set; }
    public int? Sets { get; set; }
    public int? RepsMin { get; set; }
    public int? RepsMax { get; set; }
    public double? Distance { get; set; }
    public double? Time { get; set; }
    public int? PercentOf1Rm { get; set; }
    public double? TargetRpe { get; set; }
    public string? Note { get; set; }
}
