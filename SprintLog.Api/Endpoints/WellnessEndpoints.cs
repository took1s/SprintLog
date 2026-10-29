using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

/// <summary>Tägliches Befinden: GET der letzten Tage, PUT pro Tag (anlegen oder überschreiben), DELETE.</summary>
public static class WellnessEndpoints
{
    public const int MaxDays = 366;

    public static void MapWellnessEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/wellness").RequireAuthorization().WithTags("Wellness");
        group.MapGet("/", GetRecent);
        group.MapPut("/{date}", Upsert);
        group.MapDelete("/{date}", Delete);
    }

    private static bool TryParseDate(string value, out DateOnly date) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static async Task<IResult> GetRecent(HttpContext http, AppDbContext db, TimeProvider time, int? days, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var count = Math.Clamp(days ?? 56, 1, MaxDays);
        var from = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(-count);
        var entries = await db.Wellness.AsNoTracking()
            .Where(w => w.UserId == userId && w.Date >= from)
            .OrderByDescending(w => w.Date)
            .ToListAsync(ct);
        return Results.Ok(entries.Select(WellnessResponse.From));
    }

    private static async Task<IResult> Upsert(string date, WellnessInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        if (!TryParseDate(date, out var day))
            return new ValidationErrors().Add("date", "Date must be in the format yyyy-MM-dd.").ToResult();

        var now = time.GetUtcNow().UtcDateTime;
        var errors = input.Validate(day, DateOnly.FromDateTime(now));
        if (errors.HasErrors) return errors.ToResult();

        var entry = await db.Wellness.FirstOrDefaultAsync(w => w.UserId == userId && w.Date == day, ct);
        var created = entry is null;
        entry ??= db.Wellness.Add(new WellnessEntry { UserId = userId.Value, Date = day }).Entity;
        entry.Sleep = input.Sleep;
        entry.Energy = input.Energy;
        entry.Soreness = input.Soreness;
        entry.Mood = input.Mood;
        entry.SleepHours = input.SleepHours;
        entry.Note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        entry.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            // Zwei Geräte speichern denselben Tag gleichzeitig: Unique-Index (UserId, Date) -> erneut als Update.
            db.ChangeTracker.Clear();
            return await Upsert(date, input, http, db, time, ct);
        }
        return Results.Ok(WellnessResponse.From(entry));
    }

    private static async Task<IResult> Delete(string date, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        if (!TryParseDate(date, out var day)) return Results.NotFound();

        var deleted = await db.Wellness.Where(w => w.UserId == userId && w.Date == day).ExecuteDeleteAsync(ct);
        return deleted == 0 ? Results.NotFound() : Results.NoContent();
    }
}
