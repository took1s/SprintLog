using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DotNetEnv; // 1. Добавляем using

// 2. Загружаем .env файл прямо в память до старта конфигурации
Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Подключение к БД
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- НАСТРОЙКА JWT АВТОРИЗАЦИИ ---
var jwtSecret = builder.Configuration["JWT_SECRET"] ?? throw new Exception("JWT_SECRET missing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });
builder.Services.AddAuthorization();
// ----------------------------------

var app = builder.Build();

// Включаем проверку токенов
app.UseAuthentication();
app.UseAuthorization();

// --- ЭНДПОИНТ ЛОГИНА (Открытый) ---
app.MapPost("/api/auth/login", (LoginRequest req, IConfiguration config) =>
{
    var validUser = config["APP_USERNAME"];
    var validPass = config["APP_PASSWORD"];

    if (req.Username != validUser || req.Password != validPass)
    {
        return Results.Unauthorized();
    }

    // Создаем "паспорт" пользователя
    var claims = new[] { new Claim(ClaimTypes.Name, req.Username) };
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    // Генерируем токен на 7 дней
    var token = new JwtSecurityToken(
        claims: claims,
        expires: DateTime.UtcNow.AddDays(7),
        signingCredentials: creds
    );

    var jwt = new JwtSecurityTokenHandler().WriteToken(token);
    return Results.Ok(new { Token = jwt });
});

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
}).RequireAuthorization();

// 2. POST: Добавить новое упражнение
app.MapPost("/api/exercises", async (AppDbContext db, Exercise newExercise) =>
{
    db.Exercises.Add(newExercise);
    await db.SaveChangesAsync();
    return Results.Created($"/api/exercises/{newExercise.Id}", newExercise);
}).RequireAuthorization();

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
}).RequireAuthorization();

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
}).RequireAuthorization();

app.MapPost("/api/auth/refresh", (ClaimsPrincipal user, IConfiguration config) =>
{
    // Берем имя пользователя из текущего действующего токена
    var username = user.Identity?.Name;
    if (string.IsNullOrEmpty(username)) return Results.Unauthorized();

    // Генерируем новый токен с текущего момента еще на 7 дней
    var claims = new[] { new Claim(ClaimTypes.Name, username) };
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var newToken = new JwtSecurityToken(
        claims: claims,
        expires: DateTime.UtcNow.AddDays(7), // Обнуляем таймер: +7 дней от СЕЙЧАС
        signingCredentials: creds
    );

    var jwt = new JwtSecurityTokenHandler().WriteToken(newToken);
    return Results.Ok(new { Token = jwt });
}).RequireAuthorization();

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

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

