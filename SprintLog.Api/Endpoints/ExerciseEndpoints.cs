using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

public static class ExerciseEndpoints
{
    public static void MapExerciseEndpoints(this IEndpointRouteBuilder app)
    {
        // Группируем маршруты и закрываем их токеном
        var group = app.MapGroup("/api/exercises").RequireAuthorization();

        // Путь "/" внутри группы означает "/api/exercises"
        group.MapGet("/", async (AppDbContext db, string? category) =>
        {
            var query = db.Exercises.AsQueryable();
            
            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(e => e.Category == category);
            }
            
            var exercises = await query.ToListAsync();
            return Results.Ok(exercises);
        });

        // Добавление упражнения
        group.MapPost("/", async (AppDbContext db, Exercise newExercise) =>
        {
            db.Exercises.Add(newExercise);
            await db.SaveChangesAsync();
            return Results.Created($"/api/exercises/{newExercise.Id}", newExercise);
        });
    }
}