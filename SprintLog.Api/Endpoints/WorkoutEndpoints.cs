using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

public static class WorkoutEndpoints
{
    public static void MapWorkoutEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/workouts").RequireAuthorization().WithTags("Workouts");

        group.MapPost("/", Save);
        group.MapPost("/save", Save).ExcludeFromDescription(); // Alias für ältere, gecachte App-Versionen
        group.MapGet("/history", History);
        group.MapGet("/{id:int}", GetById);
        group.MapDelete("/{id:int}", Delete);
    }

    private static async Task<IResult> Save(CreateWorkoutRequest req, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var now = time.GetUtcNow();
        var errors = req.Validate(now);
        if (errors.HasErrors) return errors.ToResult();

        // 1. Idempotenz: wurde diese Einheit (gleiche Client-ID) schon gespeichert? -> kein Duplikat anlegen.
        if (req.ClientId is { } clientId)
        {
            var existingId = await FindByClientId(db, userId.Value, clientId, ct);
            if (existingId is not null)
                return Results.Ok(new SaveWorkoutResponse(existingId.Value, true, "Workout already saved."));
        }

        // 2. Nur Übungen erlauben, die der Nutzer sehen darf (Standard + eigene).
        var exerciseIds = req.Sets!.Select(s => s.ExerciseId).Distinct().ToList();
        var knownIds = await db.Exercises.VisibleTo(userId.Value)
            .Where(e => exerciseIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync(ct);
        var unknownIds = exerciseIds.Except(knownIds).ToList();
        if (unknownIds.Count > 0)
            return new ValidationErrors().Add("sets", $"Unknown exercise id(s): {string.Join(", ", unknownIds)}.").ToResult();

        // 3. Einheit + Sätze in EINEM SaveChanges speichern -> atomar (vorher zwei Schritte, Teil-Speicherung möglich).
        var workout = new Workout
        {
            UserId = userId.Value,
            WorkoutType = req.WorkoutType!,
            Date = (req.Date ?? now).UtcDateTime,
            DurationSeconds = req.DurationSeconds,
            ClientId = req.ClientId,
            Sets = req.Sets!.Select((s, i) => new WorkoutSet
            {
                SetNumber = i + 1,
                ExerciseId = s.ExerciseId,
                Weight = s.Weight,
                Reps = s.Reps,
                Distance = s.Distance,
                Time = s.Time
            }).ToList()
        };

        db.Workouts.Add(workout);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (req.ClientId is not null)
        {
            // Zwei parallele Sync-Versuche derselben Einheit: der Unique-Index (UserId, ClientId) hat gegriffen.
            db.ChangeTracker.Clear();
            var existingId = await FindByClientId(db, userId.Value, req.ClientId.Value, ct);
            if (existingId is null) throw;
            return Results.Ok(new SaveWorkoutResponse(existingId.Value, true, "Workout already saved."));
        }

        return Results.Created($"/api/workouts/{workout.Id}", new SaveWorkoutResponse(workout.Id, false, "Workout saved."));
    }

    private static async Task<IResult> History(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var history = await Project(db.Workouts.AsNoTracking()
                .Where(w => w.UserId == userId)
                .OrderByDescending(w => w.Date)
                .ThenByDescending(w => w.Id))
            .ToListAsync(ct);

        return Results.Ok(history);
    }

    private static async Task<IResult> GetById(int id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var workout = await Project(db.Workouts.AsNoTracking().Where(w => w.UserId == userId && w.Id == id))
            .FirstOrDefaultAsync(ct);

        return workout is null ? Results.NotFound() : Results.Ok(workout);
    }

    private static async Task<IResult> Delete(int id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Fremde Einheiten liefern 404 statt 403 - so lässt sich nicht herausfinden, welche IDs existieren.
        var deleted = await db.Workouts.Where(w => w.Id == id && w.UserId == userId).ExecuteDeleteAsync(ct);
        return deleted == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static Task<int?> FindByClientId(AppDbContext db, int userId, Guid clientId, CancellationToken ct) =>
        db.Workouts.AsNoTracking()
            .Where(w => w.UserId == userId && w.ClientId == clientId)
            .Select(w => (int?)w.Id)
            .FirstOrDefaultAsync(ct);

    private static IQueryable<WorkoutResponse> Project(IQueryable<Workout> query) =>
        query.Select(w => new WorkoutResponse(
            w.Id,
            w.ClientId,
            w.Date,
            w.WorkoutType,
            w.DurationSeconds,
            w.Sets
                .OrderBy(s => s.SetNumber)
                .Select(s => new WorkoutSetResponse(
                    s.ExerciseId,
                    s.Exercise.Name,
                    s.Exercise.TrackingType,
                    s.Exercise.MuscleGroup,
                    s.SetNumber,
                    s.Weight,
                    s.Reps,
                    s.Distance,
                    s.Time))
                .ToList()));
}
