using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

/// <summary>Kraft-Ziele: GET alle, PUT pro Übung (anlegen oder überschreiben, idempotent für die Offline-Queue), DELETE.</summary>
public static class GoalEndpoints
{
    public const int MaxGoals = 50;

    public static void MapGoalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/goals").RequireAuthorization().WithTags("Goals");
        group.MapGet("/", GetAll);
        group.MapPut("/{exerciseId:int}", Upsert);
        group.MapDelete("/{exerciseId:int}", Delete);
    }

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var goals = await db.Goals.AsNoTracking().Where(g => g.UserId == userId).OrderBy(g => g.CreatedAt).ToListAsync(ct);
        return Results.Ok(goals.Select(GoalResponse.From));
    }

    private static async Task<IResult> Upsert(int exerciseId, GoalInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var now = time.GetUtcNow().UtcDateTime;
        var errors = input.Validate(DateOnly.FromDateTime(now));
        if (errors.HasErrors) return errors.ToResult();

        if (!await db.Exercises.VisibleTo(userId.Value).AnyAsync(e => e.Id == exerciseId, ct))
            return Results.NotFound();

        var goal = await db.Goals.FirstOrDefaultAsync(g => g.UserId == userId && g.ExerciseId == exerciseId, ct);
        var created = goal is null;
        if (created && await db.Goals.CountAsync(g => g.UserId == userId, ct) >= MaxGoals)
            return new ValidationErrors().Add("goal", $"At most {MaxGoals} goals are allowed.").ToResult();

        goal ??= db.Goals.Add(new LiftGoal { UserId = userId.Value, ExerciseId = exerciseId, CreatedAt = now }).Entity;
        goal.TargetWeight = Math.Round(input.TargetWeight, 2);
        goal.TargetReps = input.TargetReps;
        goal.Increment = Math.Round(input.Increment, 2);
        goal.StartE1RM = input.StartE1RM is { } s ? Math.Round(s, 1) : null;
        goal.TargetDate = input.TargetDate;
        goal.AchievedAt = input.AchievedAt;
        goal.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (created)
        {
            // Zwei Geräte legen dasselbe Ziel gleichzeitig an: Unique-Index (UserId, ExerciseId) -> als Update wiederholen.
            db.ChangeTracker.Clear();
            return await Upsert(exerciseId, input, http, db, time, ct);
        }
        return Results.Ok(GoalResponse.From(goal));
    }

    private static async Task<IResult> Delete(int exerciseId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        // Idempotent: ein schon gelöschtes Ziel ist kein Fehler (Offline-Queue wiederholt Requests).
        await db.Goals.Where(g => g.UserId == userId && g.ExerciseId == exerciseId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }
}
