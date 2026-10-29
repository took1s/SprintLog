using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

public static class FavoriteEndpoints
{
    public static void MapFavoriteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/favorites").RequireAuthorization().WithTags("Favorites");

        group.MapGet("/", GetAll);
        group.MapPost("/{exerciseId:int}", Add);
        group.MapDelete("/{exerciseId:int}", Remove);
    }

    private static async Task<IResult> GetAll(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var ids = await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == userId)
            .Select(f => f.ExerciseId)
            .ToListAsync(ct);

        return Results.Ok(ids);
    }

    private static async Task<IResult> Add(int exerciseId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        if (!await db.Exercises.VisibleTo(userId.Value).AnyAsync(e => e.Id == exerciseId, ct))
            return Results.NotFound();

        // Idempotent: doppeltes Hinzufügen ist kein Fehler.
        if (!await db.Favorites.AnyAsync(f => f.UserId == userId && f.ExerciseId == exerciseId, ct))
        {
            db.Favorites.Add(new Favorite { UserId = userId.Value, ExerciseId = exerciseId });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Paralleler Request hat den Favoriten bereits angelegt (Unique-Index) - Ergebnis ist dasselbe.
            }
        }

        return Results.NoContent();
    }

    private static async Task<IResult> Remove(int exerciseId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        await db.Favorites.Where(f => f.UserId == userId && f.ExerciseId == exerciseId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }
}
