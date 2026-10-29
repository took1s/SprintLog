using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;
using SprintLog.Api.Services;

namespace SprintLog.Api.Endpoints;

/// <summary>
/// Konto-Sicherheit: Passwort ändern, Wiederherstellungscodes, E-Mail-Adresse und "Passwort vergessen".
/// Jede Passwortänderung erhöht die Token-Version und beendet alle anderen Sitzungen.
/// </summary>
public static class AccountEndpoints
{
    private static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan VerifyLinkLifetime = TimeSpan.FromHours(24);
    /// <summary>Höchstens ein Reset-Link pro Konto in diesem Zeitraum (Schutz vor E-Mail-Bombing).</summary>
    private static readonly TimeSpan ResetCooldown = TimeSpan.FromMinutes(2);

    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Account");
        var limited = AuthEndpoints.RateLimitPolicy;

        group.MapPost("/password", ChangePassword).RequireAuthorization().RequireRateLimiting(limited);
        group.MapPost("/recovery-codes", RegenerateRecoveryCodes).RequireAuthorization().RequireRateLimiting(limited);
        group.MapPost("/recover", Recover).RequireRateLimiting(limited);
        group.MapPut("/email", SetEmail).RequireAuthorization().RequireRateLimiting(limited);
        group.MapPost("/email/verify", VerifyEmail).RequireRateLimiting(limited);
        group.MapPost("/forgot-password", ForgotPassword).RequireRateLimiting(limited);
        group.MapPost("/reset-password", ResetPassword).RequireRateLimiting(limited);
    }

    private static async Task<IResult> ChangePassword(ChangePasswordRequest req, HttpContext http, AppDbContext db,
        AuthSessionService sessions, ITokenService tokens, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var user = await CurrentUserAsync(http, db, ct);
        if (user is null) return Results.Unauthorized();
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Current password is incorrect.");

        await SetPasswordAsync(user, req.NewPassword!, db, sessions, ct);
        // Dieses Gerät bleibt angemeldet (neue Sitzung), alle anderen sind abgemeldet.
        return Results.Ok(await AuthEndpoints.SignInAsync(http, user, sessions, tokens, ct));
    }

    private static async Task<IResult> RegenerateRecoveryCodes(PasswordConfirmation req, HttpContext http, AppDbContext db,
        RecoveryCodeService recovery, CancellationToken ct)
    {
        var user = await CurrentUserAsync(http, db, ct);
        if (user is null) return Results.Unauthorized();
        if (string.IsNullOrEmpty(req.Password) || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Password is incorrect.");

        return Results.Ok(new RecoveryCodesResponse(await recovery.RegenerateAsync(user.Id, ct)));
    }

    /// <summary>Passwort mit einem Wiederherstellungscode zurücksetzen (ohne E-Mail). Jeder Code funktioniert einmal.</summary>
    private static async Task<IResult> Recover(RecoverRequest req, HttpContext http, AppDbContext db, RecoveryCodeService recovery,
        AuthSessionService sessions, ITokenService tokens, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var normalized = req.Username!.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == normalized, ct);
        // Gleiche Antwort für "Nutzer unbekannt" und "Code falsch" - nichts über existierende Konten verraten.
        if (user is null || !await recovery.TryConsumeAsync(user.Id, req.Code, ct))
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Username or recovery code is invalid.");

        await SetPasswordAsync(user, req.NewPassword!, db, sessions, ct); // speichert auch den verbrauchten Code
        return Results.Ok(await AuthEndpoints.SignInAsync(http, user, sessions, tokens, ct));
    }

    /// <summary>E-Mail setzen/ändern (Bestätigungslink) oder entfernen (leere Adresse).</summary>
    private static async Task<IResult> SetEmail(SetEmailRequest req, HttpContext http, AppDbContext db, IEmailSender email,
        ISecretHasher hasher, IOptions<EmailOptions> options, TimeProvider time, ILoggerFactory logs, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var user = await CurrentUserAsync(http, db, ct);
        if (user is null) return Results.Unauthorized();
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Password is incorrect.");

        var address = req.Normalized;
        if (address is null)
        {
            user.Email = null;
            user.EmailVerifiedAt = null;
            await db.AuthTokens.Where(t => t.UserId == user.Id && t.Purpose == AuthTokenPurpose.VerifyEmail).ExecuteDeleteAsync(ct);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }

        if (!email.IsEnabled)
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "E-mail is not configured on this server.");
        if (address == user.Email && user.EmailVerifiedAt is not null) return Results.NoContent();
        if (await db.Users.AnyAsync(u => u.Email == address && u.Id != user.Id, ct))
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "This e-mail is already used by another account.");

        user.Email = address;
        user.EmailVerifiedAt = null;
        var raw = await CreateTokenAsync(db, hasher, time, user.Id, AuthTokenPurpose.VerifyEmail, VerifyLinkLifetime, address, ct);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "This e-mail is already used by another account.");
        }

        try
        {
            await email.SendAsync(EmailTemplates.VerifyEmail(address, user.Username, options.Value.Link($"verify={raw}")), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logs.CreateLogger(nameof(AccountEndpoints)).LogError(ex, "Sending the verification e-mail failed for user {UserId}", user.Id);
            return Results.Problem(statusCode: StatusCodes.Status502BadGateway, title: "The e-mail could not be sent. Try again later.");
        }
        return Results.Accepted(value: new { message = "Check your inbox to confirm the address." });
    }

    private static async Task<IResult> VerifyEmail(TokenRequest req, AppDbContext db, ISecretHasher hasher, TimeProvider time, CancellationToken ct)
    {
        var token = await FindTokenAsync(db, hasher, time, req.Token, AuthTokenPurpose.VerifyEmail, ct);
        var user = token is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == token.UserId, ct);
        // Link gilt nur für die Adresse, an die er geschickt wurde.
        if (token is null || user is null || user.Email != token.Email)
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "This link is invalid or has expired.");

        token.UsedAt = time.GetUtcNow().UtcDateTime;
        user.EmailVerifiedAt = token.UsedAt;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { email = user.Email });
    }

    /// <summary>
    /// Reset-Link per E-Mail anfordern (Nutzername oder bestätigte E-Mail). Antwortet immer gleich,
    /// damit sich nicht herausfinden lässt, welche Konten oder Adressen existieren.
    /// </summary>
    private static async Task<IResult> ForgotPassword(ForgotPasswordRequest req, AppDbContext db, IEmailSender email, ISecretHasher hasher,
        IOptions<EmailOptions> options, TimeProvider time, ILoggerFactory logs, CancellationToken ct)
    {
        var accepted = Results.Accepted(value: new { message = "If the account has a confirmed e-mail, a reset link is on its way." });
        if (!email.IsEnabled)
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "E-mail is not configured on this server. Use a recovery code.");

        var login = req.Login?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(login)) return accepted;

        var verified = db.Users.Where(u => u.EmailVerifiedAt != null);
        var user = login.Contains('@')
            ? await verified.FirstOrDefaultAsync(u => u.Email == login, ct)
            : await verified.FirstOrDefaultAsync(u => u.Username.ToLower() == login, ct);
        if (user?.Email is null) return accepted;

        var now = time.GetUtcNow().UtcDateTime;
        var recent = await db.AuthTokens.AnyAsync(t => t.UserId == user.Id && t.Purpose == AuthTokenPurpose.ResetPassword && t.CreatedAt > now - ResetCooldown, ct);
        if (recent) return accepted;

        var raw = await CreateTokenAsync(db, hasher, time, user.Id, AuthTokenPurpose.ResetPassword, ResetLinkLifetime, null, ct);
        await db.SaveChangesAsync(ct);
        try
        {
            await email.SendAsync(EmailTemplates.ResetPassword(user.Email, user.Username, options.Value.Link($"reset={raw}")), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logs.CreateLogger(nameof(AccountEndpoints)).LogError(ex, "Sending the reset e-mail failed for user {UserId}", user.Id);
        }
        return accepted;
    }

    private static async Task<IResult> ResetPassword(ResetPasswordRequest req, HttpContext http, AppDbContext db, ISecretHasher hasher,
        TimeProvider time, AuthSessionService sessions, ITokenService tokens, CancellationToken ct)
    {
        var errors = req.Validate();
        if (errors.HasErrors) return errors.ToResult();

        var token = await FindTokenAsync(db, hasher, time, req.Token, AuthTokenPurpose.ResetPassword, ct);
        var user = token is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == token.UserId, ct);
        if (token is null || user is null)
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "This link is invalid or has expired. Request a new one.");

        token.UsedAt = time.GetUtcNow().UtcDateTime;
        // Alle anderen offenen Reset-Links verfallen ebenfalls.
        await db.AuthTokens.Where(t => t.UserId == user.Id && t.Purpose == AuthTokenPurpose.ResetPassword && t.UsedAt == null && t.Id != token.Id)
            .ExecuteDeleteAsync(ct);
        await SetPasswordAsync(user, req.NewPassword!, db, sessions, ct);
        return Results.Ok(await AuthEndpoints.SignInAsync(http, user, sessions, tokens, ct));
    }

    // ---------- Helfer ----------

    private static async Task<User?> CurrentUserAsync(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var userId = http.User.GetUserId();
        return userId is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
    }

    /// <summary>Neues Passwort setzen und alle bestehenden Sitzungen/Tokens ungültig machen.</summary>
    private static async Task SetPasswordAsync(User user, string newPassword, AppDbContext db, AuthSessionService sessions, CancellationToken ct)
    {
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.TokenVersion += 1;
        await db.SaveChangesAsync(ct);
        await sessions.RevokeAllAsync(user.Id, ct);
    }

    private static async Task<string> CreateTokenAsync(AppDbContext db, ISecretHasher hasher, TimeProvider time, int userId, string purpose,
        TimeSpan lifetime, string? email, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        // Alte, abgelaufene Tokens dieses Zwecks aufräumen
        await db.AuthTokens.Where(t => t.UserId == userId && t.Purpose == purpose && (t.ExpiresAt < now || t.UsedAt != null)).ExecuteDeleteAsync(ct);
        if (purpose == AuthTokenPurpose.VerifyEmail)
            await db.AuthTokens.Where(t => t.UserId == userId && t.Purpose == purpose).ExecuteDeleteAsync(ct); // nur der neueste Link gilt

        var raw = SecretHasher.NewToken();
        db.AuthTokens.Add(new AuthToken
        {
            UserId = userId,
            Purpose = purpose,
            TokenHash = hasher.Hash(purpose, raw),
            Email = email,
            CreatedAt = now,
            ExpiresAt = now.Add(lifetime)
        });
        return raw;
    }

    private static async Task<AuthToken?> FindTokenAsync(AppDbContext db, ISecretHasher hasher, TimeProvider time, string? raw, string purpose, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 100) return null;
        var hash = hasher.Hash(purpose, raw.Trim());
        var now = time.GetUtcNow().UtcDateTime;
        return await db.AuthTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.Purpose == purpose && t.UsedAt == null && t.ExpiresAt > now, ct);
    }
}
