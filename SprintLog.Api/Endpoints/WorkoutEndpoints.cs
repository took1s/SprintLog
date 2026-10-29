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
        group.MapGet("/", List);
        group.MapGet("/changes", Changes);
        group.MapGet("/history", History); // komplette Historie in einer Antwort - für ältere App-Versionen
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
            UpdatedAt = now.UtcDateTime,
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

        var now = time.GetUtcNow();
        var errors = req.Validate(now);
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
        workout.UpdatedAt = now.UtcDateTime;

        // Sätze komplett ersetzen - einfacher und eindeutiger als ein Abgleich einzelner Sätze.
        db.WorkoutSets.RemoveRange(workout.Sets);
        workout.Sets = MapSets(req);
        await db.SaveChangesAsync(ct);

        var updated = await Project(db.Workouts.AsNoTracking().Where(w => w.Id == id)).FirstAsync(ct);
        return Results.Ok(updated);
    }

    private static async Task<IResult> Delete(int id, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Fremde Einheiten liefern 404 statt 403 - so lässt sich nicht herausfinden, welche IDs existieren.
        if (!await db.Workouts.AnyAsync(w => w.Id == id && w.UserId == userId, ct)) return Results.NotFound();

        // Löschen + Grabstein in EINEM SaveChanges -> atomar. Sätze löscht die Datenbank per Cascade.
        db.Workouts.Remove(new Workout { Id = id, UserId = userId.Value });
        db.DeletedWorkouts.Add(new DeletedWorkout { UserId = userId.Value, WorkoutId = id, DeletedAt = time.GetUtcNow().UtcDateTime });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.NotFound(); // parallel schon gelöscht
        }
        return Results.NoContent();
    }

    // ---------- Seitenweise Historie + Delta-Sync ----------

    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 200;

    /// <summary>
    /// Überlappung des Sync-Tokens: Eine Änderung, deren Transaktion beim Lesen noch nicht abgeschlossen war,
    /// hat ein UpdatedAt kurz vor dem Lesezeitpunkt. Der nächste Sync holt deshalb die letzten 2 Minuten erneut
    /// (Clients mergen per ID, doppelte Einträge sind harmlos).
    /// </summary>
    internal static readonly TimeSpan SyncOverlap = TimeSpan.FromMinutes(2);

    /// <summary>Historie seitenweise, neueste zuerst (Keyset-Pagination: stabil, auch wenn neue Einheiten dazukommen).</summary>
    private static async Task<IResult> List(HttpContext http, AppDbContext db, int? limit, string? cursor, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var take = Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize);
        var query = db.Workouts.AsNoTracking().Where(w => w.UserId == userId);
        if (cursor is not null)
        {
            if (!Cursor.TryParse(cursor, out var date, out var lastId))
                return new ValidationErrors().Add("cursor", "Invalid cursor.").ToResult();
            query = query.Where(w => w.Date < date || (w.Date == date && w.Id < lastId));
        }

        var page = await Project(query.OrderByDescending(w => w.Date).ThenByDescending(w => w.Id)).Take(take + 1).ToListAsync(ct);
        var hasMore = page.Count > take;
        if (hasMore) page.RemoveAt(take);
        return Results.Ok(new WorkoutPageResponse(page, hasMore ? Cursor.Create(page[^1].Date, page[^1].Id) : null));
    }

    /// <summary>
    /// Delta-Sync: ohne <c>since</c> alle Einheiten (seitenweise), mit <c>since</c> nur Änderungen danach
    /// plus die IDs gelöschter Einheiten. So lädt die App die Historie einmal und danach nur noch Unterschiede.
    /// </summary>
    private static async Task<IResult> Changes(HttpContext http, AppDbContext db, TimeProvider time,
        DateTimeOffset? since, string? cursor, int? limit, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var token = time.GetUtcNow().UtcDateTime - SyncOverlap;
        var take = Math.Clamp(limit ?? MaxPageSize, 1, MaxPageSize);
        var sinceUtc = since?.UtcDateTime;

        var query = db.Workouts.AsNoTracking().Where(w => w.UserId == userId);
        if (sinceUtc is { } s) query = query.Where(w => w.UpdatedAt > s);
        if (cursor is not null)
        {
            if (!Cursor.TryParse(cursor, out var at, out var lastId))
                return new ValidationErrors().Add("cursor", "Invalid cursor.").ToResult();
            query = query.Where(w => w.UpdatedAt > at || (w.UpdatedAt == at && w.Id > lastId));
        }

        var page = await Project(query.OrderBy(w => w.UpdatedAt).ThenBy(w => w.Id)).Take(take + 1).ToListAsync(ct);
        var hasMore = page.Count > take;
        if (hasMore) page.RemoveAt(take);

        // Gelöschte IDs nur bei inkrementellem Sync und nur auf der ersten Seite.
        var deleted = sinceUtc is { } d && cursor is null
            ? await db.DeletedWorkouts.Where(x => x.UserId == userId && x.DeletedAt > d).Select(x => x.WorkoutId).Distinct().ToListAsync(ct)
            : new List<int>();

        return Results.Ok(new WorkoutChangesResponse(page, deleted,
            hasMore ? Cursor.Create(page[^1].UpdatedAt, page[^1].Id) : null, token));
    }

    /// <summary>Undurchsichtiger Cursor "ticks_id" - Zeitpunkt + ID des letzten Eintrags einer Seite.</summary>
    private static class Cursor
    {
        public static string Create(DateTime at, int id) => $"{at.ToUniversalTime().Ticks}_{id}";

        public static bool TryParse(string value, out DateTime at, out int id)
        {
            at = default;
            id = 0;
            var parts = value.Split('_');
            if (parts.Length != 2 || !long.TryParse(parts[0], out var ticks) || !int.TryParse(parts[1], out id)) return false;
            if (ticks < DateTime.MinValue.Ticks || ticks > DateTime.MaxValue.Ticks) return false;
            at = new DateTime(ticks, DateTimeKind.Utc);
            return true;
        }
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
                .ToList(),
            w.UpdatedAt));
}
