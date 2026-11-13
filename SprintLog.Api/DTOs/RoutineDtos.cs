using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record RoutineStepDto(string? Name, string? Dose = null, int? ExerciseId = null);

public record RoutineInput(string? Title, string? Kind, int Days, DateOnly StartDate, DateOnly? EndDate, string? Reason, List<RoutineStepDto>? Steps,
    List<DateOnly>? DoneDates = null, string? Source = null)
{
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
            .AddIf(DoneDates is { Count: > Routine.MaxDoneDays }, "doneDates", "Too many entries.")
            .AddIf(DoneDates?.Any(d => d > today.AddDays(1)) == true, "doneDates", "Done dates cannot be in the future.")
            .AddIf(Source is not (null or "user" or "coach"), "source", "Unknown source.");
    }
}

public record RoutineResponse(string ClientId, string Title, string Kind, int Days, DateOnly StartDate, DateOnly? EndDate, string? Reason, string Source,
    List<RoutineStepDto> Steps, List<DateOnly> DoneDates, DateTime CreatedAt, DateTime UpdatedAt)
{
    public static RoutineResponse From(Routine r) => new(r.ClientId, r.Title, r.Kind, r.Days, r.StartDate, r.EndDate, r.Reason, r.Source,
        r.Steps.Select(s => new RoutineStepDto(s.Name, s.Dose, s.ExerciseId)).ToList(), r.DoneDates.OrderBy(d => d).ToList(), r.CreatedAt, r.UpdatedAt);
}
