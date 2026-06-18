using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        // РЕГИСТРАЦИЯ
        group.MapPost("/register", async (AppDbContext db, LoginRequest req) =>
        {
            if (await db.Users.AnyAsync(u => u.Username.ToLower() == req.Username.ToLower()))
            {
                return Results.BadRequest(new { Message = "IDENTIFIER ALREADY IN USE" });
            }

            var user = new User
            {
                Username = req.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
            };

            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Ok(new { Message = "REGISTRATION SUCCESSFUL" });
        });

        // ЛОГИН
        group.MapPost("/login", async (AppDbContext db, LoginRequest req, IConfiguration config) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == req.Username.ToLower());

            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            // ИСПРАВЛЕНИЕ 1: Зашиваем ID пользователя в токен
            var claims = new[] 
            { 
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username) 
            };
            
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return Results.Ok(new { Token = new JwtSecurityTokenHandler().WriteToken(token) });
        });

        // РЕФРЕШ
        group.MapPost("/refresh", (ClaimsPrincipal userPrincipal, IConfiguration config) =>
        {
            // ИСПРАВЛЕНИЕ 2: Читаем ID и Имя из старого токена
            var userId = userPrincipal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var username = userPrincipal.Identity?.Name;
            
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(userId)) 
                return Results.Unauthorized();

            // Переносим ID и Имя в новый токен
            var claims = new[] 
            { 
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Name, username) 
            };
            
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var newToken = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return Results.Ok(new { Token = new JwtSecurityTokenHandler().WriteToken(newToken) });
        }).RequireAuthorization();
    }
}