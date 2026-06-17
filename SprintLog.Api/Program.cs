using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;
using System.Text;


var builder = WebApplication.CreateBuilder(args);


// Добавляем подключение к PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// --- НАЧАЛО НАШЕГО API ---

// 1. GET: Получить список упражнений

app.MapGet("/api/exercises", async (AppDbContext db, string? category) =>
{
    var query = db.Exercises.AsQueryable();
    
    // Если телефон попросил конкретную категорию (например, "Gym" или "Football"), фильтруем
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
    await db.SaveChangesAsync(); // Сохраняем изменения в Supabase
    
    // Возвращаем успешный статус 201 (Created) и само созданное упражнение
    return Results.Created($"/api/exercises/{newExercise.Id}", newExercise);
});

// Эндпоинт для генерации отчета
app.MapPost("/api/workouts/generate", (WorkoutRequest request) =>
{
    var sb = new StringBuilder();
    sb.AppendLine($"# Тренировка: {request.WorkoutType}");
    sb.AppendLine($"Дата: {DateTime.Now:yyyy-MM-dd}");
    sb.AppendLine("");
    sb.AppendLine("| Упражнение | Вес/Дист | Повт/Время |");
    sb.AppendLine("| --- | --- | --- |");

    foreach (var s in request.Sets)
    {
        sb.AppendLine($"| ID: {s.ExerciseId} | {s.Weight ?? s.Distance} | {s.Reps ?? (int?)s.Time} |");
    }

    return Results.Ok(new { Markdown = sb.ToString() });
});


// --- КОНЕЦ НАШЕГО API --

app.UseDefaultFiles(); // Чтобы он искал index.html
app.UseStaticFiles();  // Чтобы он раздавал файлы из wwwroot

app.Run();