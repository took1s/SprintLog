using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Regeln für geplante Einzel-Einheiten: am Spieltag des aktiven Plans nie (Spiel hat Vorrang); an einem Trainingstag erlaubt -
/// das ist dann ein Doppeltag (z. B. Mannschaftstraining + kurze Extra-Einheit), den Athlet und Coach bewusst wählen.
/// </summary>
public static class PlannedWorkoutRules
{
    /// <summary>Wochentag als Bit (Montag = Bit 0) - wie TrainingDays/MatchDays.</summary>
    public static int DayBit(DateOnly d) => 1 << (((int)d.DayOfWeek + 6) % 7);

    /// <summary>"training", "match" oder null (frei).</summary>
    public static string? ConflictOn(DateOnly date, int trainingDays, int matchDays) =>
        (matchDays & DayBit(date)) != 0 ? "match" : (trainingDays & DayBit(date)) != 0 ? "training" : null;

    public static string? ConflictOn(DateOnly date, TrainingProgram? active) =>
        active is null ? null : ConflictOn(date, active.TrainingDays, active.MatchDays);

    /// <summary>Blockiert nur der Spieltag ("match"); ein Trainingstag ist ein erlaubter Doppeltag.</summary>
    public static bool Blocks(string? conflict) => conflict == "match";
}
