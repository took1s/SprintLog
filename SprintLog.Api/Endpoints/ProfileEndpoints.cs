using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Endpoints;

/// <summary>Sportler-Profil für den KI-Coach: GET (leer, wenn noch nicht ausgefüllt) und PUT (idempotent, offline nachreichbar).</summary>
public static class ProfileEndpoints
{
    public static void MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profile/athlete").RequireAuthorization().WithTags("Profile");
        group.MapGet("/", Get);
        group.MapPut("/", Put);
    }

    internal static async Task<AthleteProfileDto> LoadAsync(AppDbContext db, int userId, CancellationToken ct)
    {
        var profile = await db.AthleteProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return profile is null ? new AthleteProfileDto() : AthleteProfileDto.From(profile);
    }

    private static async Task<IResult> Get(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        return Results.Ok(await LoadAsync(db, userId.Value, ct));
    }

    private static async Task<IResult> Put(AthleteProfileDto input, HttpContext http, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var now = time.GetUtcNow().UtcDateTime;
        var errors = input.Validate(now.Year);
        if (errors.HasErrors) return errors.ToResult();

        static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        var profile = await db.AthleteProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct)
            ?? db.AthleteProfiles.Add(new AthleteProfile { UserId = userId.Value }).Entity;
        profile.Position = input.Position;
        profile.BirthYear = input.BirthYear;
        profile.HeightCm = input.HeightCm;
        profile.WeightKg = input.WeightKg is { } w ? Math.Round(w, 1) : null;
        profile.Level = Clean(input.Level);
        profile.Goals = Clean(input.Goals);
        profile.Injuries = Clean(input.Injuries);
        profile.Equipment = Clean(input.Equipment);
        profile.SessionMinutes = input.SessionMinutes;
        profile.Notes = Clean(input.Notes);
        profile.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return Results.Ok(AthleteProfileDto.From(profile));
    }
}
