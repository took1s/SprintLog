using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Gedächtnis des KI-Coachs pro Konto: lesen (für jeden Prompt), merken/aktualisieren/vergessen (Werkzeuge und App).
/// Begrenzt auf <see cref="MaxEntries"/> Einträge, damit der Prompt klein und das Gedächtnis gepflegt bleibt -
/// statt still alte Einträge zu verdrängen, bittet die Grenze den Coach, zusammenzufassen oder Veraltetes zu löschen.
/// </summary>
public sealed class CoachMemoryService(AppDbContext db, TimeProvider time)
{
    public const int MaxEntries = 60;
    private const int MaxPromptChars = 4_500;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    /// <summary>Aktive Einträge (abgelaufene werden dabei entfernt), wichtigste zuerst.</summary>
    public async Task<List<CoachMemory>> ListAsync(int userId, CancellationToken ct)
    {
        var now = Now;
        await db.CoachMemories.Where(m => m.UserId == userId && m.ExpiresAt != null && m.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        return await db.CoachMemories.AsNoTracking().Where(m => m.UserId == userId)
            .OrderByDescending(m => m.Importance).ThenByDescending(m => m.UpdatedAt).ThenByDescending(m => m.Id)
            .ToListAsync(ct);
    }

    /// <summary>Gedächtnis als Prompt-Block (mit Ids, damit der Coach Einträge ersetzen oder löschen kann).</summary>
    public async Task<string> PromptTextAsync(int userId, CancellationToken ct)
    {
        var entries = await ListAsync(userId, ct);
        if (entries.Count == 0) return "(empty - nothing saved yet)";
        var sb = new StringBuilder();
        foreach (var m in entries)
        {
            var line = new StringBuilder("- [#").Append(m.Id).Append(' ').Append(m.Category)
                .Append(m.Importance switch { 3 => ", critical", 1 => ", minor", _ => string.Empty })
                .Append(", ").Append(m.Source == "user" ? "added by athlete" : "saved by coach")
                .Append(' ').Append(Day(m.UpdatedAt));
            if (m.ExpiresAt is { } e) line.Append(", valid until ").Append(Day(e));
            line.Append("] ").Append(m.Content).Append('\n');
            if (sb.Length + line.Length > MaxPromptChars) { sb.Append("- (more entries omitted - the least important ones)\n"); break; }
            sb.Append(line);
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Merken oder (mit <paramref name="replacesId"/>) aktualisieren. Gleicher Inhalt wie ein bestehender Eintrag aktualisiert
    /// diesen statt zu duplizieren. Liefert die Änderung oder einen Fehlertext für das Modell.
    /// </summary>
    public async Task<(MemoryChangeDto? Change, string? Error)> RememberAsync(int userId, string? content, string? category, int? importance,
        DateTime? expiresAt, int? replacesId, string source, CancellationToken ct)
    {
        var now = Now;
        var input = new CoachMemoryInput(content, category, importance, expiresAt);
        if (input.Validate(now) is { HasErrors: true } errors) return (null, "Invalid memory: " + string.Join(" ", errors.Errors.SelectMany(e => e.Value)));
        var text = content!.Trim();

        CoachMemory? entry = null;
        if (replacesId is { } id)
        {
            entry = await db.CoachMemories.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
            if (entry is null) return (null, $"Memory #{id} not found. Use an id from the coach_memory block.");
        }
        else
        {
            var normalized = Normalize(text);
            var existing = await db.CoachMemories.Where(m => m.UserId == userId).ToListAsync(ct);
            entry = existing.FirstOrDefault(m => Normalize(m.Content) == normalized);
            if (entry is null && existing.Count(m => m.ExpiresAt is null || m.ExpiresAt > now) >= MaxEntries)
                return (null, $"Memory is full ({MaxEntries} entries). Merge related entries with replacesId or forget outdated ones first.");
        }

        var action = entry is null ? "saved" : "updated";
        if (entry is null)
        {
            entry = new CoachMemory { UserId = userId, CreatedAt = now };
            db.CoachMemories.Add(entry);
        }
        entry.Content = text;
        entry.Category = category!;
        entry.Importance = importance ?? entry.Importance;
        entry.ExpiresAt = expiresAt;
        entry.Source = source;
        entry.UpdatedAt = now;
        if (entry.Importance is < 1 or > 3) entry.Importance = 2;
        await db.SaveChangesAsync(ct);
        return (new MemoryChangeDto(action, entry.Id, entry.Category, entry.Content), null);
    }

    public async Task<MemoryChangeDto?> ForgetAsync(int userId, int id, CancellationToken ct)
    {
        var entry = await db.CoachMemories.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
        if (entry is null) return null;
        db.CoachMemories.Remove(entry);
        await db.SaveChangesAsync(ct);
        return new MemoryChangeDto("forgotten", entry.Id, entry.Category, entry.Content);
    }

    private static string Day(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Für den Duplikat-Vergleich: Groß/klein, Satzzeichen und Leerraum egal.</summary>
    private static string Normalize(string s) =>
        new(s.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
}
