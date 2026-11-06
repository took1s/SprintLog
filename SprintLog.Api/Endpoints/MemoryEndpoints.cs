using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Gedächtnis des KI-Coachs verwalten: alles sehen, selbst ergänzen, ändern, einzeln oder komplett löschen.
/// Funktioniert auch ohne konfigurierte KI (die Daten gehören dem Nutzer).
/// </summary>
public static class MemoryEndpoints
{
    public static void MapMemoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai/memory").RequireAuthorization().WithTags("AI");
        group.MapGet("/", List);
        group.MapPost("/", Create);
        group.MapPut("/{id:int}", Update);
        group.MapDelete("/{id:int}", Delete);
        group.MapDelete("/", Clear);
    }

    private static async Task<IResult> List(HttpContext http, CoachMemoryService memory, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        return Results.Ok((await memory.ListAsync(userId.Value, ct)).Select(CoachMemoryDto.From));
    }

    private static async Task<IResult> Create(CoachMemoryInput input, HttpContext http, CoachMemoryService memory, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var errors = input.Validate(time.GetUtcNow().UtcDateTime);
        if (errors.HasErrors) return errors.ToResult();
        var (change, error) = await memory.RememberAsync(userId.Value, input.Content, input.Category, input.Importance ?? 2, input.ExpiresAt, null, "user", ct);
        if (change is null) return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: error);
        var entry = await db.CoachMemories.AsNoTracking().FirstAsync(m => m.Id == change.Id, ct);
        return Results.Created($"/api/ai/memory/{entry.Id}", CoachMemoryDto.From(entry));
    }

    private static async Task<IResult> Update(int id, CoachMemoryInput input, HttpContext http, CoachMemoryService memory, AppDbContext db, TimeProvider time, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        var errors = input.Validate(time.GetUtcNow().UtcDateTime);
        if (errors.HasErrors) return errors.ToResult();
        var (change, _) = await memory.RememberAsync(userId.Value, input.Content, input.Category, input.Importance, input.ExpiresAt, id, "user", ct);
        if (change is null) return Results.NotFound();
        var entry = await db.CoachMemories.AsNoTracking().FirstAsync(m => m.Id == change.Id, ct);
        return Results.Ok(CoachMemoryDto.From(entry));
    }

    private static async Task<IResult> Delete(int id, HttpContext http, CoachMemoryService memory, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        return await memory.ForgetAsync(userId.Value, id, ct) is null ? Results.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> Clear(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        if (userId is null) return Results.Unauthorized();
        await db.CoachMemories.Where(m => m.UserId == userId).ExecuteDeleteAsync(ct);
        return Results.NoContent();
    }
}
