using SprintLog.Api.DTOs;

namespace SprintLog.Api.Services;

/// <summary>
/// Eingebaute Plan-Vorlagen. Übungs-IDs beziehen sich auf den Standard-Katalog (AppDbContext.SeedExercises).
/// Wiederholungsbereiche folgen dem Prinzip der Double Progression.
/// </summary>
public static class ProgramTemplates
{
    // Kurzschreibweisen: Kraft (Wdh.-Bereich), Sprint/Strecke, Dauer
    private static ProgramExerciseInput W(int id, int sets, int min, int max, int rest, double? rpe = null, double step = 2.5) =>
        new(id, sets, RepsMin: min, RepsMax: max, TargetRpe: rpe, RestSeconds: rest, ProgressionStep: step);
    private static ProgramExerciseInput Run(int id, int reps, double meters, int rest) =>
        new(id, reps, Distance: meters, RestSeconds: rest);
    private static ProgramExerciseInput Hold(int id, int sets, double seconds, int rest) =>
        new(id, sets, Time: seconds, RestSeconds: rest);
    private static ProgramDayInput Day(string name, string? notes, params ProgramExerciseInput[] exercises) =>
        new(null, name, notes, exercises.ToList());

    public static readonly IReadOnlyList<ProgramTemplate> All = new List<ProgramTemplate>
    {
        new("football-strength", "Footballer Strength 2x",
            "In-season strength & power around team training: heavy lower body, sprint work, hamstring protection (Nordics).",
            "Strength", "Intermediate", 8, new()
            {
                Day("Lower power", "Not the day before a match.",
                    W(29, 4, 3, 5, 180, 8), W(51, 3, 4, 5, 90, step: 0), W(33, 3, 6, 8, 120), W(50, 3, 4, 6, 120, step: 0), Hold(47, 3, 45, 60)),
                Day("Upper + speed", "Sprints first, fully rested.",
                    Run(12, 6, 20, 120), W(1, 4, 4, 6, 150, 8), W(17, 4, 5, 8, 120, step: 0), W(75, 3, 8, 10, 90, step: 5), W(54, 3, 10, 12, 60)),
            }),
        new("speed-agility", "Speed & Agility",
            "Field sessions for acceleration, max velocity and change of direction. Quality over quantity - full rest between reps.",
            "Speed", "All levels", 6, new()
            {
                Day("Acceleration", "Warm up 15 min first.",
                    Run(12, 8, 15, 90), Run(34, 4, 2.5, 90), Run(58, 6, 20, 90), Hold(56, 4, 30, 60)),
                Day("Max velocity", null,
                    Run(12, 6, 40, 180), W(51, 4, 3, 3, 120, step: 0), Run(57, 4, 25, 120), W(50, 3, 4, 6, 120, step: 0)),
            }),
        new("full-body-3x", "Full Body Beginner",
            "Two full-body workouts alternated three times a week. Learn the main lifts and build a base.",
            "General", "Beginner", 8, new()
            {
                Day("Full body A", null, W(35, 3, 8, 10, 120), W(1, 3, 8, 10, 120), W(14, 3, 10, 12, 90), Hold(47, 3, 40, 60)),
                Day("Full body B", null, W(63, 3, 5, 6, 150, step: 5), W(68, 3, 8, 10, 120), W(44, 3, 10, 12, 90), W(41, 3, 10, 12, 90)),
            }),
        new("upper-lower-4x", "Upper / Lower 4x",
            "Classic 4-day split for muscle and strength with two upper and two lower days per week.",
            "Hypertrophy", "Intermediate", 8, new()
            {
                Day("Upper A", null, W(1, 4, 6, 8, 150, 8), W(26, 4, 6, 8, 120), W(40, 3, 8, 10, 90, step: 2), W(44, 3, 10, 12, 90), W(22, 2, 10, 12, 60), W(8, 2, 10, 12, 60)),
                Day("Lower A", null, W(35, 4, 6, 8, 180, 8, 5), W(49, 3, 8, 10, 120, step: 5), W(7, 3, 10, 12, 90, step: 10), W(3, 3, 10, 12, 60), W(4, 3, 12, 15, 60, step: 5)),
                Day("Upper B", null, W(60, 4, 8, 10, 120, step: 2), W(65, 4, 6, 10, 120, step: 0), W(69, 3, 12, 15, 60, step: 1), W(14, 3, 10, 12, 90), W(71, 2, 15, 15, 60), W(43, 2, 10, 12, 60, step: 2)),
                Day("Lower B", null, W(63, 3, 4, 6, 180, 8, 5), W(73, 3, 6, 8, 150, step: 5), W(76, 3, 10, 12, 90, step: 2), W(75, 3, 8, 10, 90, step: 5), W(55, 3, 10, 15, 60, step: 0)),
            }),
        new("ppl-3x", "Push / Pull / Legs",
            "Three focused days per week. Run it once (3 days) or twice (6 days) per week.",
            "Hypertrophy", "Intermediate", 8, new()
            {
                Day("Push", null, W(1, 4, 6, 8, 150, 8), W(68, 3, 6, 8, 120), W(60, 3, 8, 12, 90, step: 2), W(69, 3, 12, 15, 60, step: 1), W(8, 3, 10, 12, 60)),
                Day("Pull", null, W(63, 3, 5, 5, 180, 8, 5), W(17, 4, 6, 10, 120, step: 0), W(26, 3, 8, 10, 120), W(71, 3, 15, 15, 60), W(9, 3, 8, 12, 60)),
                Day("Legs", null, W(35, 4, 6, 8, 180, 8, 5), W(49, 3, 8, 10, 120, step: 5), W(7, 3, 10, 12, 90, step: 10), W(3, 3, 10, 12, 60), W(4, 4, 12, 15, 60, step: 5)),
            }),
    };

    public static ProgramTemplate? Find(string key) =>
        All.FirstOrDefault(t => string.Equals(t.Key, key, StringComparison.OrdinalIgnoreCase));
}
