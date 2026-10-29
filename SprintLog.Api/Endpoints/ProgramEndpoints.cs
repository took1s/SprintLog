using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

public static class ProgramEndpoints
{
    public static void MapProgramEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/programs").RequireAuthorization().WithTags("Programs");

        group.MapGet("/", GetAll);
        group.MapGet("/templates", (HttpContext _) => Results.Ok(ProgramTemplates.All));
        group.MapPost("/templates/{key}", CreateFromTemplate);
        group.MapPost("/", Create);
        group.MapPut("/{id:int}", Update);
        group.MapPost("/{id:int}/activate", Activate);
        group.MapPost("/{id:int}/deactivate", Deactivate);
        group.MapDelete("/{id:int}", Delete);
    }

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var programs = await Load(db, userId.Value)
            .OrderByDescending(p => p.IsActive)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return Results.Ok(programs.Select(ToResponse));
    }

    private static async Task<IResult> CreateFromTemplate(string key, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var template = ProgramTemplates.Find(key);
        if (template is null) return Results.NotFound();

        var input = new ProgramInput(template.Name, template.Goal, template.Weeks, template.Days);
        return await Save(db, userId.Value, input, template.Key, activate: true, time, ct);
    }

    private static async Task<IResult> Create(ProgramInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var errors = input.Validate();
        if (errors.HasErrors) return errors.ToResult();

        // Hat der Nutzer noch keinen aktiven Plan, wird der neue direkt aktiviert.
        var hasActive = await db.Programs.AnyAsync(p => p.UserId == userId && p.IsActive, ct);
        return await Save(db, userId.Value, input, null, activate: !hasActive, time, ct);
    }

    private static async Task<IResult> Save(AppDbContext db, int userId, ProgramInput input, string? templateKey, bool activate, TimeProvider time, CancellationToken ct)
    {
        if (await CheckExercisesAsync(db, userId, input, ct) is { } exerciseError) return exerciseError;

        var now = time.GetUtcNow().UtcDateTime;
        if (activate) await DeactivateAll(db, userId, ct);

        var program = new TrainingProgram
        {
            UserId = userId,
            Name = input.Name!.Trim(),
            Goal = input.Goal!,
            Weeks = input.Weeks,
            TemplateKey = templateKey,
            IsActive = activate,
            StartedAt = activate ? now : null,
            CreatedAt = now,
            Days = input.Days!.Select((d, i) => NewDay(d, i)).ToList()
        };
        db.Programs.Add(program);
        await db.SaveChangesAsync(ct);

        var created = await Load(db, userId).FirstAsync(p => p.Id == program.Id, ct);
        return Results.Created($"/api/programs/{program.Id}", ToResponse(created));
    }

    /// <summary>
    /// Plan bearbeiten. Tage mit bekannter ID bleiben erhalten (Einheiten bleiben mit ihnen verknüpft),
    /// fehlende Tage werden gelöscht, neue angelegt. Die Übungen eines Tages werden komplett ersetzt.
    /// </summary>
    private static async Task<IResult> Update(int id, ProgramInput input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var errors = input.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var program = await db.Programs
            .Include(p => p.Days).ThenInclude(d => d.Exercises)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct);
        if (program is null) return Results.NotFound();

        if (await CheckExercisesAsync(db, userId.Value, input, ct) is { } exerciseError) return exerciseError;

        program.Name = input.Name!.Trim();
        program.Goal = input.Goal!;
        program.Weeks = input.Weeks;

        var keptIds = input.Days!.Where(d => d.Id is not null).Select(d => d.Id!.Value).ToHashSet();
        var removedDays = program.Days.Where(d => !keptIds.Contains(d.Id)).ToList();
        if (removedDays.Count > 0)
        {
            // Einheiten dieser Tage verlieren die Verknüpfung (SET NULL) -> für den Delta-Sync als geändert markieren.
            var removedIds = removedDays.Select(d => d.Id).ToList();
            var now = time.GetUtcNow().UtcDateTime;
            await db.Workouts.Where(w => w.ProgramDayId != null && removedIds.Contains(w.ProgramDayId.Value))
                .ExecuteUpdateAsync(x => x.SetProperty(w => w.UpdatedAt, now), ct);
            foreach (var removed in removedDays) db.ProgramDays.Remove(removed);
        }

        for (var i = 0; i < input.Days!.Count; i++)
        {
            var dayInput = input.Days[i];
            var existing = dayInput.Id is { } dayId ? program.Days.FirstOrDefault(d => d.Id == dayId) : null;
            if (existing is null)
            {
                program.Days.Add(NewDay(dayInput, i));
                continue;
            }
            existing.Position = i;
            existing.Name = dayInput.Name!.Trim();
            existing.Notes = string.IsNullOrWhiteSpace(dayInput.Notes) ? null : dayInput.Notes.Trim();
            db.ProgramExercises.RemoveRange(existing.Exercises);
            existing.Exercises = dayInput.Exercises!.Select((x, p) => NewExercise(x, p)).ToList();
        }

        await db.SaveChangesAsync(ct);
        var updated = await Load(db, userId.Value).FirstAsync(p => p.Id == id, ct);
        return Results.Ok(ToResponse(updated));
    }

    private static async Task<IResult> Activate(int id, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var program = await db.Programs.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, ct);
        if (program is null) return Results.NotFound();

        await DeactivateAll(db, userId.Value, ct);
        program.IsActive = true;
        program.StartedAt = time.GetUtcNow().UtcDateTime; // Neustart: Woche 1 beginnt jetzt
        await db.SaveChangesAsync(ct);

        return Results.Ok(ToResponse(await Load(db, userId.Value).FirstAsync(p => p.Id == id, ct)));
    }

    private static async Task<IResult> Deactivate(int id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var changed = await db.Programs.Where(p => p.Id == id && p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false), ct);
        return changed == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> Delete(int id, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var now = time.GetUtcNow().UtcDateTime;
        await db.Workouts.Where(w => w.UserId == userId && w.ProgramDay != null && w.ProgramDay.ProgramId == id)
            .ExecuteUpdateAsync(x => x.SetProperty(w => w.UpdatedAt, now), ct);

        // Tage + Vorgaben werden per Cascade gelöscht, Einheiten verlieren nur die Verknüpfung (SET NULL).
        var deleted = await db.Programs.Where(p => p.Id == id && p.UserId == userId).ExecuteDeleteAsync(ct);
        return deleted == 0 ? Results.NotFound() : Results.NoContent();
    }

    // ---------- Helfer ----------

    private static Task DeactivateAll(AppDbContext db, int userId, CancellationToken ct) =>
        db.Programs.Where(p => p.UserId == userId && p.IsActive)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false), ct);

    private static ProgramDay NewDay(ProgramDayInput d, int position) => new()
    {
        Position = position,
        Name = d.Name!.Trim(),
        Notes = string.IsNullOrWhiteSpace(d.Notes) ? null : d.Notes.Trim(),
        Exercises = d.Exercises!.Select((x, i) => NewExercise(x, i)).ToList()
    };

    private static ProgramExercise NewExercise(ProgramExerciseInput x, int position) => new()
    {
        Position = position,
        ExerciseId = x.ExerciseId,
        Sets = x.Sets,
        RepsMin = x.RepsMin ?? x.RepsMax,
        RepsMax = x.RepsMax ?? x.RepsMin,
        Distance = x.Distance,
        Time = x.Time,
        TargetRpe = x.TargetRpe,
        RestSeconds = x.RestSeconds,
        ProgressionStep = x.ProgressionStep
    };

    private static async Task<IResult?> CheckExercisesAsync(AppDbContext db, int userId, ProgramInput input, CancellationToken ct)
    {
        var ids = input.Days!.SelectMany(d => d.Exercises ?? new()).Select(x => x.ExerciseId).Distinct().ToList();
        var known = await db.Exercises.VisibleTo(userId).Where(e => ids.Contains(e.Id)).Select(e => e.Id).ToListAsync(ct);
        var unknown = ids.Except(known).ToList();
        return unknown.Count > 0
            ? new ValidationErrors().Add("days", $"Unknown exercise id(s): {string.Join(", ", unknown)}.").ToResult()
            : null;
    }

    private static IQueryable<TrainingProgram> Load(AppDbContext db, int userId) =>
        db.Programs.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Include(p => p.Days).ThenInclude(d => d.Exercises).ThenInclude(x => x.Exercise)
            .AsSplitQuery();

    private static ProgramResponse ToResponse(TrainingProgram p) => new(
        p.Id, p.Name, p.Goal, p.Weeks, p.IsActive, p.StartedAt, p.CreatedAt, p.TemplateKey,
        p.Days.OrderBy(d => d.Position).Select(d => new ProgramDayResponse(
            d.Id, d.Position, d.Name, d.Notes,
            d.Exercises.OrderBy(x => x.Position).Select(x => new ProgramExerciseResponse(
                x.Id, x.Position, x.ExerciseId, x.Exercise.Name, x.Exercise.TrackingType, x.Exercise.MuscleGroup,
                x.Sets, x.RepsMin, x.RepsMax, x.Distance, x.Time, x.TargetRpe, x.RestSeconds, x.ProgressionStep)).ToList()
        )).ToList());
}
