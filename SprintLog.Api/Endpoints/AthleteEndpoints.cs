using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Leistungstests (GET, PUT/DELETE pro Client-Id) und Tageswerte (GET der letzten Tage, PUT pro Tag) - beide offline-first:
/// der Client sendet idempotent nach.
/// </summary>
public static class AthleteEndpoints
{
    public const int MaxDailyDays = 400;

    public static void MapAthleteEndpoints(this IEndpointRouteBuilder app)
    {
        var tests = app.MapGroup("/api/fitness-tests").RequireAuthorization().WithTags("Fitness tests");
        tests.MapGet("/", GetTests);
        tests.MapPut("/{clientId}", PutTest);
        tests.MapDelete("/{clientId}", DeleteTest);

        var daily = app.MapGroup("/api/daily").RequireAuthorization().WithTags("Daily log");
        daily.MapGet("/", GetDaily);
        daily.MapPut("/{day}", PutDaily);
    }

    private static async Task<IResult> GetTests(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var list = await db.FitnessTests.AsNoTracking().Where(t => t.UserId == userId).OrderBy(t => t.Day).ThenBy(t => t.Id).ToListAsync(ct);
        return Results.Ok(list.Select(FitnessTestResponse.From));
    }

    private static async Task<IResult> PutTest(string clientId, FitnessTestInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        if (!AiRequests.IsValidId(clientId)) return new ValidationErrors().Add("clientId", "Invalid id.").ToResult();
        var now = time.GetUtcNow().UtcDateTime;
        var errors = input.Validate(DateOnly.FromDateTime(now));
        if (errors.HasErrors) return errors.ToResult();

        var test = await db.FitnessTests.FirstOrDefaultAsync(t => t.UserId == userId && t.ClientId == clientId, ct);
        var created = test is null;
        if (created && await db.FitnessTests.CountAsync(t => t.UserId == userId, ct) >= FitnessTest.MaxEntries)
            return new ValidationErrors().Add("test", $"At most {FitnessTest.MaxEntries} results are allowed.").ToResult();
        test ??= db.FitnessTests.Add(new FitnessTest { UserId = userId.Value, ClientId = clientId, CreatedAt = now }).Entity;
        test.Day = input.Day;
        test.Test = input.Test!;
        test.Value = Math.Round(input.Value, 2);
        test.Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
        test.UpdatedAt = now;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            db.ChangeTracker.Clear();
            return await PutTest(clientId, input, http, db, time, ct);
        }
        return Results.Ok(FitnessTestResponse.From(test));
    }

    private static async Task<IResult> DeleteTest(string clientId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        await db.FitnessTests.Where(t => t.UserId == userId && t.ClientId == clientId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> GetDaily(HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct, int days = 120)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var from = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(-Math.Clamp(days, 1, MaxDailyDays));
        var list = await db.DailyLogs.AsNoTracking().Where(d => d.UserId == userId && d.Day >= from).OrderBy(d => d.Day).ToListAsync(ct);
        return Results.Ok(list.Select(DailyLogResponse.From));
    }

    /// <summary>Tag komplett setzen (der Client führt manuelle und Apple-Health-Werte zusammen); alles leer = löschen.</summary>
    private static async Task<IResult> PutDaily(string day, DailyLogInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var now = time.GetUtcNow().UtcDateTime;
        if (!DateOnly.TryParseExact(day, "yyyy-MM-dd", out var date) || date > DateOnly.FromDateTime(now).AddDays(1) || date < DateOnly.FromDateTime(now).AddYears(-5))
            return new ValidationErrors().Add("day", "Day must be yyyy-MM-dd and not in the future.").ToResult();
        var errors = input.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var log = await db.DailyLogs.FirstOrDefaultAsync(d => d.UserId == userId && d.Day == date, ct);
        var empty = input is { WeightKg: null, ProteinG: null, SleepMinutes: null, RestingHr: null, Hrv: null, Steps: null };
        if (empty)
        {
            if (log is not null) { db.DailyLogs.Remove(log); await db.SaveChangesAsync(ct); }
            return Results.NoContent();
        }
        var created = log is null;
        log ??= db.DailyLogs.Add(new DailyLog { UserId = userId.Value, Day = date }).Entity;
        log.WeightKg = input.WeightKg is { } w ? Math.Round(w, 1) : null;
        log.ProteinG = input.ProteinG;
        log.SleepMinutes = input.SleepMinutes;
        log.RestingHr = input.RestingHr;
        log.Hrv = input.Hrv;
        log.Steps = input.Steps;
        log.UpdatedAt = now;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            db.ChangeTracker.Clear();
            return await PutDaily(day, input, http, db, time, ct);
        }
        // Gewicht auch ins Athletenprofil (Coach, Eiweiß-Ziel) - nur wenn dieser Tag der neueste mit Gewicht ist
        if (log.WeightKg is { } kg && !await db.DailyLogs.AnyAsync(d => d.UserId == userId && d.Day > date && d.WeightKg != null, ct))
            await db.AthleteProfiles.Where(p => p.UserId == userId).ExecuteUpdateAsync(s => s.SetProperty(p => p.WeightKg, (double?)kg), ct);
        return Results.Ok(DailyLogResponse.From(log));
    }
}
