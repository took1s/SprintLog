namespace SprintLog.Api.Models;

/// <summary>
/// Kraft-Ziel für eine Übung (z. B. Bankdrücken 100 kg × 1). Die App berechnet daraus pro Einheit das nächste
/// Arbeitsgewicht (lineare Progression mit Autoregulation über RPE) und eine Prognose, wann das Ziel erreicht ist.
/// Pro Nutzer und Übung ein Ziel.
/// </summary>
public class LiftGoal
{
    public int Id { get; set; }
    public int UserId { get; set; }

    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;

    /// <summary>Zielgewicht in kg.</summary>
    public double TargetWeight { get; set; }

    /// <summary>Wiederholungen beim Zielgewicht (1 = Maximalversuch).</summary>
    public int TargetReps { get; set; }

    /// <summary>Steigerung pro erfolgreicher Einheit in kg (z. B. 2,5).</summary>
    public double Increment { get; set; }

    /// <summary>Geschätztes 1RM beim Anlegen - Basis für den Fortschritt in %.</summary>
    public double? StartE1RM { get; set; }

    /// <summary>Optionales Wunschdatum.</summary>
    public DateOnly? TargetDate { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? AchievedAt { get; set; }
}
