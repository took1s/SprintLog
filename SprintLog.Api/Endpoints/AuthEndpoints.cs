using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

public static class AuthEndpoints
{
    public const string RateLimitPolicy = "auth";

    // Wird verglichen, wenn der Nutzer nicht existiert - so dauert ein Login mit unbekanntem
    // Namen genauso lange wie mit falschem Passwort (kein Erraten von Nutzernamen über die Antwortzeit).
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("sprintlog-timing-dummy");

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register).RequireRateLimiting(RateLimitPolicy);
        group.MapPost("/login", Login).RequireRateLimiting(RateLimitPolicy);
        group.MapPost("/refresh", Refresh).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization();
        group.MapDelete("/account", DeleteAccount).RequireAuthorization().RequireRateLimiting(RateLimitPolicy);
    }

    private static async Task<IResult> Register(RegisterRequest req, AppDbContext db, ITokenService tokens, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var username = req.Username!.Trim();
        var normalized = username.ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Username.ToLower() == normalized, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Username is already taken.");

        var user = new User
        {
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password)
        };
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Zwei gleichzeitige Registrierungen mit demselben Namen - der Unique-Index greift.
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Username is already taken.");
        }

        return Results.Created("/api/auth/me", new TokenResponse(tokens.CreateToken(user.Id, user.Username), user.Username, user.Id));
    }

    private static async Task<IResult> Login(LoginRequest req, AppDbContext db, ITokenService tokens, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrEmpty(req.Password))
            return InvalidCredentials();

        var normalized = req.Username.Trim().ToLowerInvariant();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username.ToLower() == normalized, ct);

        var passwordOk = BCrypt.Net.BCrypt.Verify(req.Password, user?.PasswordHash ?? DummyHash);
        if (user is null || !passwordOk)
            return InvalidCredentials();

        return Results.Ok(new TokenResponse(tokens.CreateToken(user.Id, user.Username), user.Username, user.Id));
    }

    private static async Task<IResult> Refresh(HttpContext http, AppDbContext db, ITokenService tokens, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        // Existiert das Konto noch? (z. B. nach dem Löschen des Accounts auf einem anderen Gerät)
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Results.Unauthorized();

        return Results.Ok(new TokenResponse(tokens.CreateToken(user.Id, user.Username), user.Username, user.Id));
    }

    private static async Task<IResult> Me(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var me = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.CreatedAt,
                WorkoutCount = u.Workouts.Count,
                CustomExerciseCount = u.CustomExercises.Count
            })
            .FirstOrDefaultAsync(ct);

        return me is null ? Results.Unauthorized() : Results.Ok(me);
    }

    /// <summary>Löscht das Konto inkl. aller Daten (Recht auf Löschung, Art. 17 DSGVO).</summary>
    private static async Task<IResult> DeleteAccount([FromBody] DeleteAccountRequest req, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Results.Unauthorized();

        if (string.IsNullOrEmpty(req.Password) || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Password is incorrect.");

        // Reihenfolge wichtig: zuerst Sätze, dann alles, was darauf verweist.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.WorkoutSets.Where(s => s.Workout.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Workouts.Where(w => w.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Favorites.Where(f => f.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Exercises.Where(e => e.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);

        return Results.NoContent();
    }

    private static IResult InvalidCredentials() =>
        Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password.");
}
