using Microsoft.EntityFrameworkCore;
using System.Security.Claims; // ОБЯЗАТЕЛЬНО добавить эту строку для работы с токенами
using SprintLog.Api.Data;
using SprintLog.Api.Models;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Endpoints;

public static class WorkoutEndpoints
{
    public static void MapWorkoutEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/workouts").RequireAuthorization();

        // ДОБАВЛЕНО: ClaimsPrincipal user в параметрах
        group.MapPost("/save", async (AppDbContext db, CreateWorkoutRequest request, ClaimsPrincipal user) =>
        {
            // 1. Достаем ID текущего пользователя из токена
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
                return Results.Unauthorized();

            if (request.Sets == null || request.Sets.Count == 0)
                return Results.BadRequest("Cannot save an empty workout.");

            if (request.Sets.Any(s => s.Weight < 0 || s.Reps < 0 || s.Distance < 0 || s.Time < 0))
                return Results.BadRequest("Metrics cannot be negative.");

            var workout = new Workout
            {
                UserId = userId, // 2. ИЗОЛЯЦИЯ: Жестко привязываем тренировку к аккаунту
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

        // ДОБАВЛЕНО: ClaimsPrincipal user в параметрах
        group.MapGet("/history", async (AppDbContext db, ClaimsPrincipal user) =>
        {
            // 1. Узнаем, чей это запрос
            var userIdString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
                return Results.Unauthorized();

            var history = await db.Workouts
                .Where(w => w.UserId == userId) // 2. ИЗОЛЯЦИЯ: Забираем из БД только его тренировки
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