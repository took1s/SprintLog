using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record RoutineStepDto(string? Name, string? Dose = null, int? ExerciseId = null);

public record RoutinePainDto(DateOnly Day, int Level);

public record RoutineInput(string? Title, string? Kind, int Days, DateOnly StartDate, DateOnly? EndDate, string? Reason, List<RoutineStepDto>? Steps,
    List<DateOnly>? DoneDates = null, string? Source = null, int TimesPerDay = 1, List<string>? Times = null, List<RoutinePainDto>? Pain = null)
{
    /// <summary>Uhrzeit "HH:mm" (24 h).</summary>
    public static bool IsTime(string? s) =>
        s is { Length: 5 } && s[2] == ':' && char.IsAsciiDigit(s[0]) && char.IsAsciiDigit(s[1]) && char.IsAsciiDigit(s[3]) && char.IsAsciiDigit(s[4])
        && (s[0] - '0') * 10 + (s[1] - '0') <= 23 && s[3] <= '5';

    /// <summary>Gültige Zeiten sortiert und ohne Doppelte, höchstens eine je Durchgang.</summary>
    public static List<string> NormalizeTimes(IEnumerable<string>? times, int timesPerDay) =>
        (times ?? []).Where(IsTime).Distinct().Order(StringComparer.Ordinal).Take(Math.Clamp(timesPerDay, 1, Routine.MaxTimesPerDay)).ToList();

    public static readonly IReadOnlySet<string> Kinds = new HashSet<string> { "mobility", "rehab", "prevention", "activation", "recovery", "other" };

    public ValidationErrors Validate(DateOnly today)
    {
        var steps = Steps ?? new();
        return new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(Title) || Title.Trim().Length > 60, "title", "Title is required (max 60 characters).")
            .AddIf(Kind is null || !Kinds.Contains(Kind), "kind", "Unknown kind.")
            .AddIf(Days is < 1 or > 127, "days", "Pick at least one weekday.")
            .AddIf(StartDate < today.AddYears(-2) || StartDate > today.AddYears(1), "startDate", "Start date is out of range.")
            .AddIf(EndDate is { } end && (end < StartDate || end > StartDate.AddYears(2)), "endDate", "End date must be after the start (max 2 years).")
            .AddIf(Reason is { Length: > 300 }, "reason", "Reason must not exceed 300 characters.")
            .AddIf(steps.Count is < 1 or > Routine.MaxSteps, "steps", $"Add 1 to {Routine.MaxSteps} steps.")
            .AddIf(steps.Any(s => string.IsNullOrWhiteSpace(s.Name) || s.Name.Trim().Length > 80 || s.Dose is { Length: > 60 }), "steps", "Each step needs a name (max 80) and an optional dose (max 60).")
            .AddIf(TimesPerDay is < 1 or > Routine.MaxTimesPerDay, "timesPerDay", $"1 to {Routine.MaxTimesPerDay} times per day.")
            .AddIf(DoneDates is { Count: > Routine.MaxDoneEntries }, "doneDates", "Too many entries.")
            .AddIf(DoneDates?.Any(d => d > today.AddDays(1)) == true, "doneDates", "Done dates cannot be in the future.")
            .AddIf(Source is not (null or "user" or "coach"), "source", "Unknown source.")
            .AddIf(Times is { Count: > Routine.MaxTimesPerDay } || Times?.Any(x => !IsTime(x)) == true, "times", "Times must be HH:mm, at most one per round.")
            .AddIf(Pain is { Count: > Routine.MaxPainEntries }, "pain", "Too many pain entries.")
            .AddIf(Pain?.Any(x => x.Level is < 0 or > 10 || x.Day > today.AddDays(1)) == true, "pain", "Pain is 0 to 10 and not in the future.");
    }
}

public record RoutineResponse(string ClientId, string Title, string Kind, int Days, DateOnly StartDate, DateOnly? EndDate, string? Reason, string Source,
    List<RoutineStepDto> Steps, List<DateOnly> DoneDates, DateTime CreatedAt, DateTime UpdatedAt, int TimesPerDay, List<string> Times, List<RoutinePainDto> Pain)
{
    public static RoutineResponse From(Routine r) => new(r.ClientId, r.Title, r.Kind, r.Days, r.StartDate, r.EndDate, r.Reason, r.Source,
        r.Steps.Select(s => new RoutineStepDto(s.Name, s.Dose, s.ExerciseId)).ToList(), r.DoneDates.OrderBy(d => d).ToList(), r.CreatedAt, r.UpdatedAt, r.TimesPerDay,
        (r.Times ?? []).ToList(), (r.Pain ?? []).OrderBy(p => p.Day).Select(p => new RoutinePainDto(p.Day, p.Level)).ToList());
}
