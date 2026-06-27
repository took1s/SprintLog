using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using SprintLog.Api.Data;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints; // Убедись, что namespace совпадает с твоим проектом

// 1. Обязательно public static class
public static class FavoriteEndpoints 
{
    // 2. Внутри него наш метод
    public static void MapFavoriteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/favorites").RequireAuthorization();

        // Получить список избранного
        group.MapGet("/", async (AppDbContext db, ClaimsPrincipal user) => {
            var username = user.Identity!.Name!;
            return await db.Favorites.Where(f => f.Username == username).Select(f => f.ExerciseId).ToListAsync();
        });

        // Добавить в избранное
        group.MapPost("/{exerciseId}", async (AppDbContext db, ClaimsPrincipal user, int exerciseId) => {
            var username = user.Identity!.Name!;
            if (!await db.Favorites.AnyAsync(f => f.Username == username && f.ExerciseId == exerciseId)) {
                db.Favorites.Add(new Favorite { Username = username, ExerciseId = exerciseId });
                await db.SaveChangesAsync();
            }
            return Results.Ok();
        });

        // Удалить из избранного
        group.MapDelete("/{exerciseId}", async (AppDbContext db, ClaimsPrincipal user, int exerciseId) => {
            var username = user.Identity!.Name!;
            var fav = await db.Favorites.FirstOrDefaultAsync(f => f.Username == username && f.ExerciseId == exerciseId);
            if (fav != null) {
                db.Favorites.Remove(fav);
                await db.SaveChangesAsync();
            }
            return Results.NoContent();
        });
    }
}