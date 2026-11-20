namespace SprintLog.Api.Models;

/// <summary>
/// Einzelne geplante Einheit an einem Datum neben dem Trainingsplan (z. B. Zusatz-Sprinteinheit am Samstag, Reha-Einheit).
/// Legt der Nutzer an oder der KI-Coach schlägt sie vor. Nie an einem Spieltag; an einem Trainingstag entweder Doppeltag
/// (zusätzlich) oder - mit <see cref="ReplacesPlan"/> - Ersatz für den Plan-Tag an diesem Datum (siehe <see cref="Services.PlannedWorkoutRules"/>).
/// </summary>
public class PlannedWorkout
{
    public const int MaxExercises = 15;

    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>Vom Client vergeben (offline anlegen, idempotentes PUT).</summary>
    public string ClientId { get; set; } = string.Empty;

    public DateOnly Date { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Gym oder Football (bestimmt den Tab beim Start).</summary>
    public string Category { get; set; } = "Gym";

    public string? Notes { get; set; }

    /// <summary>user oder coach.</summary>
    public string Source { get; set; } = "user";

    /// <summary>planned, done, skipped.</summary>
    public string Status { get; set; } = "planned";

    /// <summary>Ersetzt an diesem Datum den Tag des Trainingsplans (statt zusätzlich = Doppeltag). Nur an Trainingstagen.</summary>
    public bool ReplacesPlan { get; set; }

    /// <summary>Client-Id der geloggten Einheit, wenn erledigt.</summary>
    public string? WorkoutClientId { get; set; }

    public List<PlannedExercise> Exercises { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Vorgabe einer Übung (wie im Plan, ohne Progression).</summary>
public class PlannedExercise
{
    public int ExerciseId { get; set; }
    public int Sets { get; set; }
    public int? RepsMin { get; set; }
    public int? RepsMax { get; set; }
    public double? Weight { get; set; }
    public double? Distance { get; set; }
    public double? Time { get; set; }
    public double? TargetRpe { get; set; }
    public string? Note { get; set; }
}
