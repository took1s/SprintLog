using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.DTOs;

public record CoachMemoryDto(int Id, string Category, string Content, int Importance, string Source, DateTime CreatedAt, DateTime UpdatedAt, DateTime? ExpiresAt)
{
    public static CoachMemoryDto From(CoachMemory m) => new(m.Id, m.Category, m.Content, m.Importance, m.Source, m.CreatedAt, m.UpdatedAt, m.ExpiresAt);
}

/// <summary>Eintrag selbst anlegen oder ändern.</summary>
public record CoachMemoryInput(string? Content, string? Category, int? Importance = null, DateTime? ExpiresAt = null)
{
    public const int MinContent = 3;
    public const int MaxContent = 300;

    public ValidationErrors Validate(DateTime now)
    {
        var c = Content?.Trim() ?? string.Empty;
        return new ValidationErrors()
            .AddIf(c.Length is < MinContent or > MaxContent, "content", $"Content must be {MinContent}-{MaxContent} characters.")
            .AddIf(Category is null || !CoachMemory.Categories.Contains(Category), "category", "Unknown category.")
            .AddIf(Importance is < 1 or > 3, "importance", "Importance must be 1-3.")
            .AddIf(ExpiresAt is { } e && (e <= now || e > now.AddDays(366)), "expiresAt", "Expiry must be within the next year.");
    }
}

/// <summary>Was der Coach in dieser Antwort an seinem Gedächtnis geändert hat (Hinweis im Chat, mit "Rückgängig").</summary>
/// <param name="Action">saved | updated | forgotten</param>
public record MemoryChangeDto(string Action, int Id, string Category, string Content);
