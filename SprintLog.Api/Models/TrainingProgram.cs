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
}
