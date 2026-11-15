using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record FitnessTestInput(DateOnly Day, string? Test, double Value, string? Notes = null)
{
    public ValidationErrors Validate(DateOnly today) => new ValidationErrors()
        .AddIf(Test is null || !FitnessTest.Ranges.ContainsKey(Test), "test", "Unknown test.")
        .AddIf(Test is not null && FitnessTest.Ranges.TryGetValue(Test, out var r) && (Value < r.Min || Value > r.Max || double.IsNaN(Value)), "value", "Value is out of range for this test.")
        .AddIf(Day > today.AddDays(1) || Day < today.AddYears(-10), "day", "Day is out of range.")
        .AddIf(Notes is { Length: > 200 }, "notes", "Notes must not exceed 200 characters.");
}

public record FitnessTestResponse(string ClientId, DateOnly Day, string Test, double Value, string? Notes, DateTime UpdatedAt)
{
    public static FitnessTestResponse From(FitnessTest t) => new(t.ClientId, t.Day, t.Test, t.Value, t.Notes, t.UpdatedAt);
}

public record DailyLogInput(double? WeightKg = null, int? ProteinG = null, int? SleepMinutes = null, int? RestingHr = null, int? Hrv = null, int? Steps = null)
{
    public ValidationErrors Validate() => new ValidationErrors()
        .AddIf(WeightKg is < 30 or > 250, "weightKg", "Weight must be between 30 and 250 kg.")
        .AddIf(ProteinG is < 0 or > 600, "proteinG", "Protein must be between 0 and 600 g.")
        .AddIf(SleepMinutes is < 0 or > 1440, "sleepMinutes", "Sleep must be between 0 and 24 h.")
        .AddIf(RestingHr is < 25 or > 150, "restingHr", "Resting heart rate must be between 25 and 150.")
        .AddIf(Hrv is < 1 or > 400, "hrv", "HRV must be between 1 and 400 ms.")
        .AddIf(Steps is < 0 or > 150_000, "steps", "Steps are out of range.");
}

public record DailyLogResponse(DateOnly Day, double? WeightKg, int? ProteinG, int? SleepMinutes, int? RestingHr, int? Hrv, int? Steps, DateTime UpdatedAt)
{
    public static DailyLogResponse From(DailyLog d) => new(d.Day, d.WeightKg, d.ProteinG, d.SleepMinutes, d.RestingHr, d.Hrv, d.Steps, d.UpdatedAt);
}
