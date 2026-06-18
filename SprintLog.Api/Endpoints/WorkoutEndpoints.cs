using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;
using SprintLog.Api.DTOs; // Подключаем твои вынесенные DTO

namespace SprintLog.Api.Endpoints;

public static class WorkoutEndpoints
{
    // Метод расширения для IEndpointRouteBuilder
    public static void MapWorkoutEndpoints(this IEndpointRouteBuilder app)
    {
        // Группируем префикс и применяем авторизацию ко всей группе разом
        var group = app.MapGroup("/api/workouts").RequireAuthorization();

        group.MapPost("/save", async (AppDbContext db, CreateWorkoutRequest request) =>
        {
            if (request.Sets == null || request.Sets.Count == 0)
                return Results.BadRequest("Cannot save an empty workout.");

            // БИЗНЕС-ВАЛИДАЦИЯ: Защита от мусорных данных с фронтенда
            if (request.Sets.Any(s => s.Weight < 0 || s.Reps < 0 || s.Distance < 0 || s.Time < 0))
                return Results.BadRequest("Metrics cannot be negative.");

            var workout = new Workout
            {
                WorkoutType = request.WorkoutType,
                Date = DateTime.UtcNow
            };

            db.Workouts.Add(workout);
            await db.SaveChangesAsync();

            int currentSetNumber = 1;
            foreach (var setDto in request.Sets)
            {
                var workoutSet = new WorkoutSet
                {
                    WorkoutId = workout.Id,
                    ExerciseId = setDto.ExerciseId,
                    SetNumber = currentSetNumber++,
                    Weight = setDto.Weight,
                    Reps = setDto.Reps,
                    Distance = setDto.Distance,
                    Time = setDto.Time
                };
                db.WorkoutSets.Add(workoutSet);
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { Message = "Workout saved successfully!", WorkoutId = workout.Id });
        });

        group.MapGet("/history", async (AppDbContext db) =>
        {
            var history = await db.Workouts
                .Include(w => w.Sets).ThenInclude(s => s.Exercise)
                .OrderByDescending(w => w.Date)
                .Select(w => new
                {
                    w.Id,
                    w.Date,
                    w.WorkoutType,
                    Sets = w.Sets.OrderBy(s => s.SetNumber).Select(s => new 
                    {
                        ExerciseName = s.Exercise != null ? s.Exercise.Name : "Удаленное упражнение",
                        s.Weight,
                        s.Reps,
                        s.Distance,
                        s.Time
                    })
                }).ToListAsync();

            return Results.Ok(history);
        });
    }
}