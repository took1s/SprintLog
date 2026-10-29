using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record WellnessInput(int Sleep, int Energy, int Soreness, int Mood, double? SleepHours = null, string? Note = null)
{
    public ValidationErrors Validate(DateOnly date, DateOnly today)
    {
        var errors = new ValidationErrors();
        foreach (var (field, value) in new[] { ("sleep", Sleep), ("energy", Energy), ("soreness", Soreness), ("mood", Mood) })
            errors.AddIf(value is < 1 or > 5, field, "Values must be between 1 and 5.");
        return errors
            .AddIf(SleepHours is < 0 or > 24, "sleepHours", "Sleep must be between 0 and 24 hours.")
            .AddIf(Note is { Length: > 200 }, "note", "Note must not exceed 200 characters.")
            // +1 Tag Toleranz für Zeitzonen (Datum = lokaler Tag des Nutzers)
            .AddIf(date > today.AddDays(1), "date", "Date cannot be in the future.")
            .AddIf(date < today.AddYears(-2), "date", "Date is too far in the past.");
    }
}

public record WellnessResponse(DateOnly Date, int Sleep, int Energy, int Soreness, int Mood, double? SleepHours, string? Note, DateTime UpdatedAt)
{
    public static WellnessResponse From(WellnessEntry e) => new(e.Date, e.Sleep, e.Energy, e.Soreness, e.Mood, e.SleepHours, e.Note, e.UpdatedAt);
}
