using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// Подключение к PostgreSQL (Supabase)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// --- НАЧАЛО НАШЕГО API ---

// 1. GET: Получить список упражнений
app.MapGet("/api/exercises", async (AppDbContext db, string? category) =>
{
    var query = db.Exercises.AsQueryable();
    
    if (!string.IsNullOrWhiteSpace(category))
    {
        query = query.Where(e => e.Category == category);
    }
    
    var exercises = await query.ToListAsync();
    return Results.Ok(exercises);
});

// 2. POST: Добавить новое упражнение
app.MapPost("/api/exercises", async (AppDbContext db, Exercise newExercise) =>
{
    db.Exercises.Add(newExercise);
    await db.SaveChangesAsync();
    return Results.Created($"/api/exercises/{newExercise.Id}", newExercise);
});

// 3. POST: Сохранить тренировку в базу данных
app.MapPost("/api/workouts/save", async (AppDbContext db, CreateWorkoutRequest request) =>
{
    if (request.Sets == null || request.Sets.Count == 0)
    {
        return Results.BadRequest("Cannot save an empty workout.");
    }

    // Создаем запись тренировки
    var workout = new Workout
    {
        WorkoutType = request.WorkoutType,
        Date = DateTime.UtcNow
    };

    db.Workouts.Add(workout);
    await db.SaveChangesAsync(); // Сохраняем, чтобы получить workout.Id

    // Создаем записи подходов
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

    await db.SaveChangesAsync(); // Фиксируем подходы в БД

    return Results.Ok(new { Message = "Workout saved successfully!", WorkoutId = workout.Id });
});

// 4. GET: Получить историю тренировок
app.MapGet("/api/workouts/history", async (AppDbContext db) =>
{
    // Запрашиваем тренировки из базы
    var history = await db.Workouts
        .Include(w => w.Sets)                      // Присоединяем подходы
            .ThenInclude(s => s.Exercise)          // Присоединяем названия упражнений к подходам
        .OrderByDescending(w => w.Date)            // Сортируем от самых новых к старым
        .Select(w => new                           // Формируем чистый JSON ответ
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
        })
        .ToListAsync();

    return Results.Ok(history);
});

// --- КОНЕЦ НАШЕГО API --

app.UseDefaultFiles(); 
app.UseStaticFiles();  

app.Run();


// --- DTO Классы для приема JSON с фронтенда ---
public class CreateWorkoutRequest
{
    public string WorkoutType { get; set; } = string.Empty;
    public List<WorkoutSetDto> Sets { get; set; } = new();
}

public class WorkoutSetDto
{
    public int ExerciseId { get; set; }
    public double? Weight { get; set; }
    public int? Reps { get; set; }
    public double? Distance { get; set; }
    public double? Time { get; set; }
}

