using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>Regeln für geplante Einzel-Einheiten: kein Termin an einem Trainings- oder Spieltag des aktiven Plans.</summary>
public static class PlannedWorkoutRules
{
    /// <summary>Wochentag als Bit (Montag = Bit 0) - wie TrainingDays/MatchDays.</summary>
    public static int DayBit(DateOnly d) => 1 << (((int)d.DayOfWeek + 6) % 7);

    /// <summary>"training", "match" oder null (frei).</summary>
    public static string? ConflictOn(DateOnly date, int trainingDays, int matchDays) =>
        (matchDays & DayBit(date)) != 0 ? "match" : (trainingDays & DayBit(date)) != 0 ? "training" : null;

    public static string? ConflictOn(DateOnly date, TrainingProgram? active) =>
        active is null ? null : ConflictOn(date, active.TrainingDays, active.MatchDays);
}
