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
            // Проверяем, не занято ли имя
            if (await db.Users.AnyAsync(u => u.Username.ToLower() == req.Username.ToLower()))
            {
                return Results.BadRequest(new { Message = "IDENTIFIER ALREADY IN USE" });
            }

            var user = new User
            {
                Username = req.Username,
                // Никогда не храним пароль текстом, только хэш!
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
            };

            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Ok(new { Message = "REGISTRATION SUCCESSFUL" });
        });

        // ЛОГИН
        group.MapPost("/login", async (AppDbContext db, LoginRequest req, IConfiguration config) =>
        {
            // Ищем пользователя в БД
            var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == req.Username.ToLower());

            // Если не найден или пароль не совпадает с хэшем
            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            var claims = new[] { new Claim(ClaimTypes.Name, user.Username) };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return Results.Ok(new { Token = new JwtSecurityTokenHandler().WriteToken(token) });
        });

        // РЕФРЕШ (остается без изменений)
        group.MapPost("/refresh", (ClaimsPrincipal user, IConfiguration config) =>
        {
            var username = user.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Results.Unauthorized();

            var claims = new[] { new Claim(ClaimTypes.Name, username) };
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