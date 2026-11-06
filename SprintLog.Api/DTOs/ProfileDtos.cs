using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record AthleteProfileDto(
    string? Position = null, int? BirthYear = null, int? HeightCm = null, double? WeightKg = null, string? Level = null,
    string? Goals = null, string? Injuries = null, string? Equipment = null, int? SessionMinutes = null, string? Notes = null,
    DateTime? UpdatedAt = null)
{
    public static readonly string[] Positions = { "goalkeeper", "defender", "fullback", "midfielder", "winger", "striker" };

    public static AthleteProfileDto From(AthleteProfile p) =>
        new(p.Position, p.BirthYear, p.HeightCm, p.WeightKg, p.Level, p.Goals, p.Injuries, p.Equipment, p.SessionMinutes, p.Notes, p.UpdatedAt);

    public ValidationErrors Validate(int currentYear) => new ValidationErrors()
        .AddIf(Position is not null && !Positions.Contains(Position), "position", "Unknown position.")
        .AddIf(BirthYear is { } y && (y < currentYear - 90 || y > currentYear - 8), "birthYear", "Birth year is out of range.")
        .AddIf(HeightCm is < 120 or > 230, "heightCm", "Height must be 120-230 cm.")
        .AddIf(WeightKg is < 30 or > 200, "weightKg", "Weight must be 30-200 kg.")
        .AddIf(Level is { Length: > 60 }, "level", "Level must not exceed 60 characters.")
        .AddIf(Goals is { Length: > 400 }, "goals", "Goals must not exceed 400 characters.")
        .AddIf(Injuries is { Length: > 400 }, "injuries", "Injuries must not exceed 400 characters.")
        .AddIf(Equipment is { Length: > 300 }, "equipment", "Equipment must not exceed 300 characters.")
        .AddIf(SessionMinutes is < 10 or > 300, "sessionMinutes", "Session time must be 10-300 minutes.")
        .AddIf(Notes is { Length: > 400 }, "notes", "Notes must not exceed 400 characters.");

    /// <summary>Kurzfassung für den KI-Prompt (nur ausgefüllte Felder).</summary>
    public string ToPromptText(int currentYear)
    {
        var lines = new List<string>();
        if (Position is not null) lines.Add($"Position: {Position}");
        if (BirthYear is { } y) lines.Add($"Age: about {currentYear - y}");
        if (HeightCm is { } h) lines.Add($"Height: {h} cm");
        if (WeightKg is { } w) lines.Add($"Body weight: {w:0.#} kg");
        if (!string.IsNullOrWhiteSpace(Level)) lines.Add($"Level/league: {Level}");
        if (!string.IsNullOrWhiteSpace(Goals)) lines.Add($"Goals: {Goals}");
        if (!string.IsNullOrWhiteSpace(Injuries)) lines.Add($"Injuries / history: {Injuries}");
        if (!string.IsNullOrWhiteSpace(Equipment)) lines.Add($"Equipment: {Equipment}");
        if (SessionMinutes is { } m) lines.Add($"Time per session: about {m} min");
        if (!string.IsNullOrWhiteSpace(Notes)) lines.Add($"Notes: {Notes}");
        return lines.Count == 0 ? "(profile not filled in)" : string.Join("\n", lines);
    }
}
