using System.Text.RegularExpressions;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.DTOs;

public record LoginRequest(string? Username, string? Password);

public record RegisterRequest(string? Username, string? Password)
{
    public const int MinPasswordLength = 8;
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9_.-]{3,32}$", RegexOptions.Compiled);

    public ValidationErrors Validate() => new ValidationErrors()
        .AddIf(string.IsNullOrWhiteSpace(Username) || !UsernamePattern.IsMatch(Username.Trim()),
            "username", "Username must be 3-32 characters: letters, digits, '_', '.', '-'.")
        .AddIf(string.IsNullOrEmpty(Password) || Password.Length < MinPasswordLength,
            "password", $"Password must be at least {MinPasswordLength} characters.")
        .AddIf(Password is { Length: > 128 }, "password", "Password must not exceed 128 characters.");
}

public record DeleteAccountRequest(string? Password);

public record TokenResponse(string Token, string Username, int UserId);
