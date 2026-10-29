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
        group.MapPut("/{id:int}", Update);
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

        // 2. Nur Übungen erlauben, die der Nutzer sehen darf (Standard + eigene) - und nur eigene Plan-Tage.
        if (await CheckExercisesAsync(db, userId.Value, req, ct) is { } exerciseError) return exerciseError;
        if (await CheckProgramDayAsync(db, userId.Value, req, ct) is { } dayError) return dayError;

        // 3. Einheit + Sätze in EINEM SaveChanges speichern -> atomar (vorher zwei Schritte, Teil-Speicherung möglich).
        var workout = new Workout
        {
            UserId = userId.Value,
            WorkoutType = req.WorkoutType!,
            Date = (req.Date ?? now).UtcDateTime,
            DurationSeconds = req.DurationSeconds,
            SessionRpe = req.SessionRpe,
            Notes = NormalizeNotes(req.Notes),
            ProgramDayId = req.ProgramDayId,
            ClientId = req.ClientId,
            Sets = MapSets(req)
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

    /// <summary>Ersetzt eine bestehende Einheit vollständig (Metadaten + alle Sätze) - z. B. nach einer Korrektur.</summary>
    private static async Task<IResult> Update(int id, CreateWorkoutRequest req, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var errors = req.Validate(time.GetUtcNow());
        if (errors.HasErrors) return errors.ToResult();

        var workout = await db.Workouts.Include(w => w.Sets).FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId, ct);
        if (workout is null) return Results.NotFound();

        if (await CheckExercisesAsync(db, userId.Value, req, ct) is { } exerciseError) return exerciseError;
        if (await CheckProgramDayAsync(db, userId.Value, req, ct) is { } dayError) return dayError;

        workout.WorkoutType = req.WorkoutType!;
        workout.ProgramDayId = req.ProgramDayId;
        if (req.Date is { } date) workout.Date = date.UtcDateTime;
        workout.DurationSeconds = req.DurationSeconds;
        workout.SessionRpe = req.SessionRpe;
        workout.Notes = NormalizeNotes(req.Notes);

        // Sätze komplett ersetzen - einfacher und eindeutiger als ein Abgleich einzelner Sätze.
        db.WorkoutSets.RemoveRange(workout.Sets);
        workout.Sets = MapSets(req);
        await db.SaveChangesAsync(ct);

        var updated = await Project(db.Workouts.AsNoTracking().Where(w => w.Id == id)).FirstAsync(ct);
        return Results.Ok(updated);
    }

    private static async Task<IResult> Delete(int id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Fremde Einheiten liefern 404 statt 403 - so lässt sich nicht herausfinden, welche IDs existieren.
        var deleted = await db.Workouts.Where(w => w.Id == id && w.UserId == userId).ExecuteDeleteAsync(ct);
        return deleted == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static List<WorkoutSet> MapSets(CreateWorkoutRequest req) =>
        req.Sets!.Select((s, i) => new WorkoutSet
        {
            SetNumber = i + 1,
            ExerciseId = s.ExerciseId,
            Weight = s.Weight,
            Reps = s.Reps,
            Distance = s.Distance,
            Time = s.Time,
            Rpe = s.Rpe,
            IsWarmup = s.IsWarmup
        }).ToList();

    private static string? NormalizeNotes(string? notes) =>
        string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    private static async Task<IResult?> CheckExercisesAsync(AppDbContext db, int userId, CreateWorkoutRequest req, CancellationToken ct)
    {
        var exerciseIds = req.Sets!.Select(s => s.ExerciseId).Distinct().ToList();
        var knownIds = await db.Exercises.VisibleTo(userId)
            .Where(e => exerciseIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync(ct);
        var unknownIds = exerciseIds.Except(knownIds).ToList();
        return unknownIds.Count > 0
            ? new ValidationErrors().Add("sets", $"Unknown exercise id(s): {string.Join(", ", unknownIds)}.").ToResult()
            : null;
    }

    private static async Task<IResult?> CheckProgramDayAsync(AppDbContext db, int userId, CreateWorkoutRequest req, CancellationToken ct)
    {
        if (req.ProgramDayId is not { } dayId) return null;
        var owned = await db.ProgramDays.AnyAsync(d => d.Id == dayId && d.Program.UserId == userId, ct);
        return owned ? null : new ValidationErrors().Add("programDayId", "Unknown program day.").ToResult();
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
            w.SessionRpe,
            w.Notes,
            w.ProgramDayId,
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
                    s.Time,
                    s.Rpe,
                    s.IsWarmup))
                .ToList()));
}
