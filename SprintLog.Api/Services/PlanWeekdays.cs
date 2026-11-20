using System.Text.RegularExpressions;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Welcher Plan-Tag fällt auf welchen Wochentag - gleiche Regeln wie im Client (frontend/src/lib/program.ts dayForWeekday):
/// 1. Wochentag in Klammern im Namen ("Bedro B (пт, MD-2)", "Lower (Fri)") - eindeutig gewinnt;
/// 2. sonst gleich viele Trainingstage wie Plan-Tage: k-ter Trainingstag der Woche = k-ter Tag;
/// 3. sonst keine Zuordnung (Rotation).
/// </summary>
public static partial class PlanWeekdays
{
    private static readonly string[][] Tokens =
    [
        ["пн", "понедельник", "mo", "montag", "mon", "monday"],
        ["вт", "вторник", "di", "dienstag", "tue", "tues", "tuesday"],
        ["ср", "среда", "mi", "mittwoch", "wed", "wednesday"],
        ["чт", "четверг", "do", "donnerstag", "thu", "thur", "thurs", "thursday"],
        ["пт", "пятница", "fr", "freitag", "fri", "friday"],
        ["сб", "суббота", "sa", "samstag", "sat", "saturday"],
        ["вс", "воскресенье", "so", "sonntag", "sun", "sunday"],
    ];

    [GeneratedRegex(@"\(([^)]*)\)")]
    private static partial Regex Parens();

    [GeneratedRegex(@"[\s,;/+&|-]+")]
    private static partial Regex Separators();

    /// <summary>Wochentage (0 = Montag) aus Klammern im Namen.</summary>
    public static IReadOnlySet<int> Hints(string name)
    {
        var set = new HashSet<int>();
        foreach (Match m in Parens().Matches(name))
            foreach (var raw in Separators().Split(m.Groups[1].Value))
            {
                var token = raw.ToLowerInvariant().Replace(".", string.Empty).Replace(":", string.Empty);
                for (var wd = 0; wd < 7; wd++) if (Tokens[wd].Contains(token)) set.Add(wd);
            }
        return set;
    }

    public static int Weekday(DateOnly d) => ((int)d.DayOfWeek + 6) % 7;

    /// <summary>Plan-Tag für ein Datum (null = kein Trainingstag oder keine eindeutige Zuordnung). Braucht geladene Days.</summary>
    public static ProgramDay? DayFor(TrainingProgram? program, DateOnly date)
    {
        if (program is null || program.Days.Count == 0) return null;
        var wd = Weekday(date);
        var training = Enumerable.Range(0, 7).Where(d => (program.TrainingDays & (1 << d)) != 0 && (program.MatchDays & (1 << d)) == 0).ToList();
        if (!training.Contains(wd)) return null;
        var days = program.Days.OrderBy(d => d.Position).ToList();
        var hinted = days.Where(d => Hints(d.Name).Contains(wd)).ToList();
        if (hinted.Count == 1) return hinted[0];
        if (hinted.Count > 1) return null;
        return training.Count == days.Count ? days[training.IndexOf(wd)] : null;
    }
}
