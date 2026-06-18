using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", (LoginRequest req, IConfiguration config) =>
        {
            var validUser = config["APP_USERNAME"];
            var validPass = config["APP_PASSWORD"];

            if (req.Username != validUser || req.Password != validPass)
            {
                return Results.Unauthorized();
            }

            var claims = new[] { new Claim(ClaimTypes.Name, req.Username) };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_SECRET"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            var jwt = new JwtSecurityTokenHandler().WriteToken(token);
            return Results.Ok(new { Token = jwt });
        });

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

            var jwt = new JwtSecurityTokenHandler().WriteToken(newToken);
            return Results.Ok(new { Token = jwt });
        }).RequireAuthorization(); // Только для авторизованных
    }
}