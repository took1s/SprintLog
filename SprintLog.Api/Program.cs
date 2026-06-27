using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Endpoints; // Подключаем папку с эндпоинтами
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

// 1. Подключение БД
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Настройка JWT
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

var app = builder.Build();

// 3. Middlewares
app.UseAuthentication();
app.UseAuthorization();

// 4. Подключение маршрутов (твои новые классы)
app.MapAuthEndpoints();
app.MapFavoriteEndpoints();
app.MapExerciseEndpoints();
app.MapWorkoutEndpoints(); // Код для этого файла я давал в предыдущем ответе

app.UseDefaultFiles(); 
app.UseStaticFiles();  

app.Run();