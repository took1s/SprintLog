using System.Net.Mail;
using System.Text.RegularExpressions;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.DTOs;

public record LoginRequest(string? Username, string? Password);

public static class PasswordRules
{
    public const int MinLength = 8;
    public const int MaxLength = 128;

    public static ValidationErrors Check(ValidationErrors errors, string? password, string field = "password") => errors
        .AddIf(string.IsNullOrEmpty(password) || password.Length < MinLength, field, $"Password must be at least {MinLength} characters.")
        .AddIf(password is { Length: > MaxLength }, field, $"Password must not exceed {MaxLength} characters.");
}

public record RegisterRequest(string? Username, string? Password)
{
    public const int MinPasswordLength = PasswordRules.MinLength;
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9_.-]{3,32}$", RegexOptions.Compiled);

    public ValidationErrors Validate() => PasswordRules.Check(new ValidationErrors()
        .AddIf(string.IsNullOrWhiteSpace(Username) || !UsernamePattern.IsMatch(Username.Trim()),
            "username", "Username must be 3-32 characters: letters, digits, '_', '.', '-'."), Password);
}

public record DeleteAccountRequest(string? Password);

/// <summary>
/// Antwort auf Login/Registrierung/Refresh. Browser-App (Cookie-Sitzung): Token = null.
/// API-Clients ohne X-Requested-With-Header bekommen einen Bearer-Token.
/// RecoveryCodes nur direkt nach der Registrierung (einmalig im Klartext).
/// </summary>
/// <param name="RefreshToken">Nur für die native App (Header X-SprintLog-Client) - Browser bekommen httpOnly-Cookies.</param>
public record TokenResponse(string? Token, string Username, int UserId, string[]? RecoveryCodes = null, string? RefreshToken = null);

/// <summary>Refresh/Logout der nativen App.</summary>
public record NativeSessionRequest(string? RefreshToken);

public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword)
{
    public ValidationErrors Validate() => PasswordRules.Check(new ValidationErrors()
        .AddIf(string.IsNullOrEmpty(CurrentPassword), "currentPassword", "Enter your current password."), NewPassword, "newPassword");
}

public record PasswordConfirmation(string? Password);

public record RecoveryCodesResponse(string[] Codes);

public record RecoverRequest(string? Username, string? Code, string? NewPassword)
{
    public ValidationErrors Validate() => PasswordRules.Check(new ValidationErrors()
        .AddIf(string.IsNullOrWhiteSpace(Username), "username", "Enter your username.")
        .AddIf(string.IsNullOrWhiteSpace(Code), "code", "Enter one of your recovery codes."), NewPassword, "newPassword");
}

public record SetEmailRequest(string? Email, string? Password)
{
    public const int MaxLength = 254;

    /// <summary>Kleingeschrieben und getrimmt; leer = E-Mail entfernen.</summary>
    public string? Normalized => string.IsNullOrWhiteSpace(Email) ? null : Email.Trim().ToLowerInvariant();

    public ValidationErrors Validate()
    {
        var errors = new ValidationErrors().AddIf(string.IsNullOrEmpty(Password), "password", "Enter your password to confirm.");
        var email = Normalized;
        if (email is null) return errors;
        var valid = email.Length <= MaxLength && MailAddress.TryCreate(email, out var parsed) && parsed!.Address == email && email.Contains('.');
        return errors.AddIf(!valid, "email", "Enter a valid e-mail address.");
    }
}

public record TokenRequest(string? Token);

public record ForgotPasswordRequest(string? Login);

public record ResetPasswordRequest(string? Token, string? NewPassword)
{
    public ValidationErrors Validate() => PasswordRules.Check(new ValidationErrors()
        .AddIf(string.IsNullOrWhiteSpace(Token), "token", "The reset link is incomplete."), NewPassword, "newPassword");
}

public record AuthOptionsResponse(bool EmailEnabled);

public record MeResponse(int Id, string Username, DateTime CreatedAt, int WorkoutCount, int CustomExerciseCount,
    string? Email, bool EmailVerified, int RecoveryCodesRemaining);
