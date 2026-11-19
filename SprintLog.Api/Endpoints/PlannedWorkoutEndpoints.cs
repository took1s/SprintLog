using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Geplante Einzel-Einheiten: GET (ab 90 Tagen zurück), PUT pro Client-Id (anlegen/ändern, idempotent), DELETE.
/// Ein neuer oder verschobener Termin darf nicht auf einem Trainings- oder Spieltag des aktiven Plans liegen (409 plan_conflict).
/// </summary>
public static class PlannedWorkoutEndpoints
{
    public const int MaxUpcoming = 60;

    public static void MapPlannedWorkoutEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/planned").RequireAuthorization().WithTags("Planned workouts");
        group.MapGet("/", GetAll);
        group.MapPut("/{clientId}", Upsert);
        group.MapDelete("/{clientId}", Delete);
    }

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var from = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime).AddDays(-90);
        var list = await db.PlannedWorkouts.AsNoTracking().Where(p => p.UserId == userId && p.Date >= from).OrderBy(p => p.Date).ToListAsync(ct);
        return Results.Ok(list.Select(PlannedWorkoutResponse.From));
    }

    private static async Task<IResult> Upsert(string clientId, PlannedWorkoutInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        if (!AiRequests.IsValidId(clientId)) return new ValidationErrors().Add("clientId", "Invalid id.").ToResult();

        var now = time.GetUtcNow().UtcDateTime;
        var today = DateOnly.FromDateTime(now);
        var errors = input.Validate(today);
        if (errors.HasErrors) return errors.ToResult();

        var ids = input.Exercises!.Select(x => x.ExerciseId).Distinct().ToList();
        var known = (await db.Exercises.AsNoTracking().VisibleTo(userId.Value).Where(e => ids.Contains(e.Id)).Select(e => e.Id).ToListAsync(ct)).ToHashSet();
        if (ids.Any(id => !known.Contains(id))) return new ValidationErrors().Add("exercises", "Unknown exercise.").ToResult();

        var planned = await db.PlannedWorkouts.FirstOrDefaultAsync(p => p.UserId == userId && p.ClientId == clientId, ct);
        var created = planned is null;
        var status = input.Status ?? planned?.Status ?? "planned";

        // Neuer oder verschobener offener Termin: nie auf einen Spieltag. Trainingstag = erlaubter Doppeltag.
        if (status == "planned" && (created || planned!.Date != input.Date))
        {
            var active = await db.Programs.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId && p.IsActive, ct);
            if (PlannedWorkoutRules.ConflictOn(input.Date, active) is { } kind && PlannedWorkoutRules.Blocks(kind))
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "plan_conflict",
                    detail: kind == "match" ? "This day is a match day in your plan." : "This day is a training day in your plan.",
                    extensions: new Dictionary<string, object?> { ["code"] = "plan_conflict", ["kind"] = kind });
        }
        if (created && await db.PlannedWorkouts.CountAsync(p => p.UserId == userId && p.Date >= today && p.Status == "planned", ct) >= MaxUpcoming)
            return new ValidationErrors().Add("planned", $"At most {MaxUpcoming} upcoming sessions are allowed.").ToResult();

        planned ??= db.PlannedWorkouts.Add(new PlannedWorkout { UserId = userId.Value, ClientId = clientId, CreatedAt = now, Source = input.Source ?? "user" }).Entity;
        planned.Date = input.Date;
        planned.Title = input.Title!.Trim();
        planned.Category = input.Category!;
        planned.Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
        planned.Status = status;
        planned.WorkoutClientId = status == "done" ? input.WorkoutClientId ?? planned.WorkoutClientId : null;
        planned.Exercises = input.Exercises!.Select(x => new PlannedExercise
        {
            ExerciseId = x.ExerciseId, Sets = x.Sets, RepsMin = x.RepsMin, RepsMax = x.RepsMax, Weight = x.Weight, Distance = x.Distance,
            Time = x.Time, TargetRpe = x.TargetRpe, Note = string.IsNullOrWhiteSpace(x.Note) ? null : x.Note.Trim(),
        }).ToList();
        planned.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            // Zwei Geräte gleichzeitig: Unique-Index (UserId, ClientId) -> als Update wiederholen
            db.ChangeTracker.Clear();
            return await Upsert(clientId, input, http, db, time, ct);
        }
        return Results.Ok(PlannedWorkoutResponse.From(planned));
    }

    private static async Task<IResult> Delete(string clientId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        await db.PlannedWorkouts.Where(p => p.UserId == userId && p.ClientId == clientId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }
}
