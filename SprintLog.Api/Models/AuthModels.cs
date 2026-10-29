namespace SprintLog.Api.Models;

/// <summary>
/// Refresh-Token einer Browser-Sitzung (im httpOnly-Cookie). Gespeichert wird nur ein HMAC des Tokens.
/// Bei jedem Refresh wird rotiert: der alte Token wird widerrufen, ein neuer derselben "Familie" ausgegeben.
/// Taucht ein bereits rotierter Token wieder auf (gestohlen?), wird die ganze Familie widerrufen.
/// </summary>
public class RefreshToken
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    /// <summary>Gesetzt, wenn der Token durch Rotation ersetzt wurde (Unterscheidung Rotation / Abmeldung).</summary>
    public bool Rotated { get; set; }
}

/// <summary>Einmal-Code zur Wiederherstellung des Kontos ohne E-Mail (wie bei 2FA-Backup-Codes).</summary>
public class RecoveryCode
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

public static class AuthTokenPurpose
{
    public const string VerifyEmail = "verify-email";
    public const string ResetPassword = "reset-password";
}

/// <summary>Einmal-Token aus E-Mail-Links (E-Mail bestätigen, Passwort zurücksetzen).</summary>
public class AuthToken
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    /// <summary>Bei "verify-email": die Adresse, die bestätigt wird (falls sie inzwischen geändert wurde, ist der Link ungültig).</summary>
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
