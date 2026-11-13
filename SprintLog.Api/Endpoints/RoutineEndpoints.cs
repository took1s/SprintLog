using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Routinen (Dehnen, Reha, Prävention): GET alle, PUT pro Client-Id (anlegen oder überschreiben, idempotent für die
/// Offline-Queue), DELETE. Erledigt-Tage kommen mit der Routine - das letzte Schreiben gewinnt (ein Nutzer, wenige Geräte).
/// </summary>
public static class RoutineEndpoints
{
    public const int MaxRoutines = 30;

    public static void MapRoutineEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/routines").RequireAuthorization().WithTags("Routines");
        group.MapGet("/", GetAll);
        group.MapPut("/{clientId}", Upsert);
        group.MapDelete("/{clientId}", Delete);
    }

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var list = await db.Routines.AsNoTracking().Where(r => r.UserId == userId).OrderBy(r => r.CreatedAt).ToListAsync(ct);
        return Results.Ok(list.Select(RoutineResponse.From));
    }

    private static async Task<IResult> Upsert(string clientId, RoutineInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        if (clientId is null || !AiRequests.IsValidId(clientId)) return new ValidationErrors().Add("clientId", "Invalid id.").ToResult();

        var now = time.GetUtcNow().UtcDateTime;
        var errors = input.Validate(DateOnly.FromDateTime(now));
        if (errors.HasErrors) return errors.ToResult();

        // Schritte mit Übung: nur sichtbare Katalog-Übungen behalten (fremde/gelöschte Ids -> nur Text)
        var ids = input.Steps!.Where(s => s.ExerciseId is not null).Select(s => s.ExerciseId!.Value).Distinct().ToList();
        var known = ids.Count == 0 ? new HashSet<int>()
            : (await db.Exercises.AsNoTracking().VisibleTo(userId.Value).Where(e => ids.Contains(e.Id)).Select(e => e.Id).ToListAsync(ct)).ToHashSet();

        var routine = await db.Routines.FirstOrDefaultAsync(r => r.UserId == userId && r.ClientId == clientId, ct);
        var created = routine is null;
        if (created && await db.Routines.CountAsync(r => r.UserId == userId, ct) >= MaxRoutines)
            return new ValidationErrors().Add("routine", $"At most {MaxRoutines} routines are allowed.").ToResult();

        routine ??= db.Routines.Add(new Routine { UserId = userId.Value, ClientId = clientId, CreatedAt = now, Source = input.Source ?? "user" }).Entity;
        routine.Title = input.Title!.Trim();
        routine.Kind = input.Kind!;
        routine.Days = input.Days;
        routine.StartDate = input.StartDate;
        routine.EndDate = input.EndDate;
        routine.Reason = string.IsNullOrWhiteSpace(input.Reason) ? null : input.Reason.Trim();
        routine.Steps = input.Steps!.Select(s => new RoutineStep
        {
            Name = s.Name!.Trim(),
            Dose = string.IsNullOrWhiteSpace(s.Dose) ? null : s.Dose.Trim(),
            ExerciseId = s.ExerciseId is { } id && known.Contains(id) ? id : null,
        }).ToList();
        routine.DoneDates = (input.DoneDates ?? routine.DoneDates).Distinct().OrderByDescending(d => d).Take(Routine.MaxDoneDays).OrderBy(d => d).ToList();
        routine.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            // Zwei Geräte legen dieselbe Routine gleichzeitig an: Unique-Index (UserId, ClientId) -> als Update wiederholen
            db.ChangeTracker.Clear();
            return await Upsert(clientId, input, http, db, time, ct);
        }
        return Results.Ok(RoutineResponse.From(routine));
    }

    private static async Task<IResult> Delete(string clientId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        // Idempotent: schon gelöscht ist kein Fehler (Offline-Queue wiederholt Requests)
        await db.Routines.Where(r => r.UserId == userId && r.ClientId == clientId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }
}
