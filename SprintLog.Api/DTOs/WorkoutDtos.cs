using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record WorkoutSetDto(
    int ExerciseId, double? Weight, int? Reps, double? Distance, double? Time, double? Rpe = null, bool IsWarmup = false, string? Note = null,
    double? Level = null, int? Power = null, int? HeartRate = null, int? Cadence = null, int? Calories = null);

/// <summary>Notiz zu einer Übung der Einheit; <c>Skipped</c> + <c>Reason</c> = ausgelassen (pain, equipment, time, fatigue, other).</summary>
public record ExerciseNoteDto(int ExerciseId, string? Note, bool Skipped = false, string? Reason = null)
{
    public static readonly string[] Reasons = { "pain", "equipment", "time", "fatigue", "other" };
}

public record CreateWorkoutRequest(
    string? WorkoutType,
    List<WorkoutSetDto>? Sets,
    Guid? ClientId = null,
    DateTimeOffset? Date = null,
    int? DurationSeconds = null,
    int? SessionRpe = null,
    string? Notes = null,
    int? ProgramDayId = null,
    MatchDetails? Match = null,
    int? Quality = null,
    string? Gym = null,
    List<ExerciseNoteDto>? ExerciseNotes = null)
{
    public const string MatchType = "Match";
    public const int MaxGymLength = 40;
    public const int MaxExerciseNotes = 50;
    public bool IsMatch => WorkoutType == MatchType;

    public const int MaxNotesLength = 500;
    public const int MaxSetNoteLength = 200;

    public static readonly string[] AllowedTypes = { "Gym", "Football", "Hybrid", MatchType };
    public const int MaxSets = 200;

    // Plausibilitätsgrenzen - schützen vor Tippfehlern (z. B. 2000 kg) und Missbrauch.
    public const double MaxWeight = 1000;
    public const int MaxReps = 1000;
    public const double MaxDistance = 100_000; // 100 km
    public const double MaxTime = 86_400;      // 24 h
    public const double MaxLevel = 100;
    public const int MaxPower = 3_000;
    public const int MaxCalories = 10_000;

    public ValidationErrors Validate(DateTimeOffset now)
    {
        var errors = new ValidationErrors()
            .AddIf(WorkoutType is null || !AllowedTypes.Contains(WorkoutType), "workoutType", "Workout type must be 'Gym', 'Football', 'Hybrid' or 'Match'.")
            // Ein Spiel hat keine Sätze, braucht aber Minuten und Session-RPE (sonst keine Trainingslast).
            .AddIf(!IsMatch && (Sets is null || Sets.Count == 0), "sets", "Cannot save an empty workout.")
            .AddIf(IsMatch && DurationSeconds is null or <= 0, "durationSeconds", "Enter the minutes played.")
            .AddIf(IsMatch && SessionRpe is null, "sessionRpe", "Rate how hard the match was (1-10).")
            .AddIf(Match is { Goals: < 0 or > 20 } || Match is { Assists: < 0 or > 20 }, "match", "Goals and assists must be between 0 and 20.")
            .AddIf(Match is { Opponent.Length: > 60 }, "match", "Opponent must not exceed 60 characters.")
            .AddIf(!IsMatch && Match is not null, "match", "Match details are only allowed for matches.")
            .AddIf(Sets is { Count: > MaxSets }, "sets", $"A workout cannot contain more than {MaxSets} sets.")
            .AddIf(Date is { } d && d > now.AddDays(1), "date", "Workout date cannot be in the future.")
            .AddIf(Date is { } d2 && d2 < now.AddYears(-5), "date", "Workout date is too far in the past.")
            .AddIf(DurationSeconds is < 0 or > 86_400, "durationSeconds", "Duration must be between 0 and 24 hours.")
            .AddIf(SessionRpe is < 1 or > 10, "sessionRpe", "Session RPE must be between 1 and 10.")
            .AddIf(Quality is < 1 or > 10, "quality", "Quality must be between 1 and 10.")
            .AddIf(Notes is { Length: > MaxNotesLength }, "notes", $"Notes must not exceed {MaxNotesLength} characters.")
            .AddIf(Gym is { Length: > MaxGymLength }, "gym", $"Gym must not exceed {MaxGymLength} characters.")
            .AddIf(ExerciseNotes is { Count: > MaxExerciseNotes }, "exerciseNotes", $"At most {MaxExerciseNotes} exercise notes.");

        if (ExerciseNotes is not null)
        {
            for (var i = 0; i < ExerciseNotes.Count && i < MaxExerciseNotes; i++)
            {
                var n = ExerciseNotes[i];
                var key = $"exerciseNotes[{i}]";
                errors
                    .AddIf(n.Note is { Length: > MaxSetNoteLength }, key, $"Exercise notes must not exceed {MaxSetNoteLength} characters.")
                    .AddIf(n.Reason is not null && !ExerciseNoteDto.Reasons.Contains(n.Reason), key, "Unknown reason.")
                    .AddIf(!n.Skipped && n.Reason is null && string.IsNullOrWhiteSpace(n.Note), key, "Empty exercise note.");
            }
            errors.AddIf(ExerciseNotes.Select(n => n.ExerciseId).Distinct().Count() != ExerciseNotes.Count, "exerciseNotes", "One note per exercise.");
        }

        if (Sets is null || Sets.Count == 0) return errors;

        for (var i = 0; i < Sets.Count && i < MaxSets; i++)
        {
            var s = Sets[i];
            var key = $"sets[{i}]";
            errors
                .AddIf(s.Weight < 0 || s.Reps < 0 || s.Distance < 0 || s.Time < 0, key, "Metrics cannot be negative.")
                .AddIf(s.Weight > MaxWeight || s.Reps > MaxReps || s.Distance > MaxDistance || s.Time > MaxTime, key, "Metric value is out of range.")
                .AddIf(double.IsNaN(s.Weight ?? 0) || double.IsNaN(s.Distance ?? 0) || double.IsNaN(s.Time ?? 0), key, "Metric value is not a number.")
                .AddIf(s.Rpe is < 1 or > 10 || (s.Rpe is { } rpe && Math.Abs(rpe * 2 - Math.Round(rpe * 2)) > 1e-9), key, "RPE must be between 1 and 10 in steps of 0.5.")
                .AddIf(s.Note is { Length: > MaxSetNoteLength }, key, $"Set notes must not exceed {MaxSetNoteLength} characters.")
                .AddIf(s.Level is < 0 or > MaxLevel || (s.Level is { } lv && double.IsNaN(lv)), key, "Level must be between 0 and 100.")
                .AddIf(s.Power is < 0 or > MaxPower, key, "Power must be between 0 and 3000 W.")
                .AddIf(s.HeartRate is < 30 or > 250, key, "Heart rate must be between 30 and 250 bpm.")
                .AddIf(s.Cadence is < 0 or > 300, key, "Cadence must be between 0 and 300 per minute.")
                .AddIf(s.Calories is < 0 or > MaxCalories, key, "Calories are out of range.");
        }

        return errors;
    }
}

public record WorkoutSetResponse(
    int ExerciseId,
    string ExerciseName,
    TrackingType TrackingType,
    string? MuscleGroup,
    int SetNumber,
    double? Weight,
    int? Reps,
    double? Distance,
    double? Time,
    double? Rpe,
    bool IsWarmup,
    string? Note = null,
    double? Level = null,
    int? Power = null,
    int? HeartRate = null,
    int? Cadence = null,
    int? Calories = null,
    bool IsAssisted = false,
    bool PerSide = false);

public record WorkoutResponse(
    int Id,
    Guid? ClientId,
    DateTime Date,
    string WorkoutType,
    int? DurationSeconds,
    int? SessionRpe,
    string? Notes,
    int? ProgramDayId,
    List<WorkoutSetResponse> Sets,
    DateTime UpdatedAt,
    MatchDetails? Match = null,
    int? Quality = null,
    string? Gym = null,
    List<ExerciseNoteDto>? ExerciseNotes = null);

/// <summary>Spiel-Details (nur bei WorkoutType "Match").</summary>
public record MatchDetails(int? Goals, int? Assists, string? Opponent);

/// <summary>Eine Seite der Historie (neueste zuerst). <c>NextCursor</c> = null -> keine weiteren Seiten.</summary>
public record WorkoutPageResponse(List<WorkoutResponse> Items, string? NextCursor);

/// <summary>
/// Delta-Sync: geänderte/neue Einheiten seit <c>since</c> (aufsteigend nach Änderung) und IDs gelöschter Einheiten.
/// Ist <c>NextCursor</c> gesetzt, mit gleichem <c>since</c> und diesem Cursor weiterladen.
/// <c>SyncToken</c> der ersten Seite ist das <c>since</c> für den nächsten Sync.
/// </summary>
public record WorkoutChangesResponse(List<WorkoutResponse> Workouts, List<int> DeletedIds, string? NextCursor, DateTime SyncToken);

public record SaveWorkoutResponse(int WorkoutId, bool Duplicate, string Message);
