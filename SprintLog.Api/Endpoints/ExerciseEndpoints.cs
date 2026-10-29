using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

public static class ExerciseEndpoints
{
    public static void MapExerciseEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/exercises").RequireAuthorization().WithTags("Exercises");

        group.MapGet("/", GetAll);
        group.MapPost("/", Create);
        group.MapDelete("/{id:int}", Delete);
    }

    /// <summary>Alle für den Nutzer sichtbaren Übungen: Standard-Katalog + eigene.</summary>
    internal static IQueryable<Exercise> VisibleTo(this IQueryable<Exercise> query, int userId) =>
        query.Where(e => e.UserId == null || e.UserId == userId);

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, string? category, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var query = db.Exercises.AsNoTracking().VisibleTo(userId.Value);
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(e => e.Category == category);

        var exercises = await query
            .OrderBy(e => e.Name)
            .Select(e => new ExerciseDto(e.Id, e.Name, e.Category, e.MuscleGroup, e.TrackingType, e.UserId != null))
            .ToListAsync(ct);

        return Results.Ok(exercises);
    }

    private static async Task<IResult> Create(CreateExerciseRequest req, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var name = req.Name!.Trim();
        var lower = name.ToLowerInvariant();

        var duplicate = await db.Exercises.VisibleTo(userId.Value).AnyAsync(e => e.Name.ToLower() == lower, ct);
        if (duplicate)
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: $"An exercise named '{name}' already exists.");

        var exercise = new Exercise
        {
            Name = name,
            Category = req.Category!,
            MuscleGroup = string.IsNullOrWhiteSpace(req.MuscleGroup) ? "Other" : req.MuscleGroup.Trim(),
            TrackingType = req.TrackingType ?? TrackingType.WeightReps,
            UserId = userId
        };

        db.Exercises.Add(exercise);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/exercises/{exercise.Id}", ExerciseDto.From(exercise));
    }

    private static async Task<IResult> Delete(int id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Nur eigene Übungen dürfen gelöscht werden; fremde/Standard-Übungen -> 404 (keine Information preisgeben).
        var exercise = await db.Exercises.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId, ct);
        if (exercise is null) return Results.NotFound();

        if (await db.WorkoutSets.AnyAsync(s => s.ExerciseId == id, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict,
                title: "Exercise is used in your history.",
                detail: "Delete the workouts that contain this exercise first.");

        if (await db.ProgramExercises.AnyAsync(x => x.ExerciseId == id, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict,
                title: "Exercise is used in a training program.",
                detail: "Remove it from your programs first.");

        await db.Favorites.Where(f => f.ExerciseId == id).ExecuteDeleteAsync(ct);
        db.Exercises.Remove(exercise);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
