using System.Text;

namespace SprintLog.Api.Infrastructure;

public class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SprintLog";
    public string Audience { get; set; } = "SprintLog";
    /// <summary>Gültigkeit von Bearer-Tokens für API-Clients (Swagger, Skripte, Tests).</summary>
    public int LifetimeDays { get; set; } = 7;

    /// <summary>Gültigkeit des Access-Tokens im Cookie der Browser-App. Kurz, weil per Refresh-Token erneuert wird.</summary>
    public int AccessTokenMinutes { get; set; } = 15;

    /// <summary>Gültigkeit des Refresh-Tokens (gleitend - jede Rotation verlängert).</summary>
    public int RefreshTokenDays { get; set; } = 30;

    /// <summary>HMAC-SHA256 braucht mindestens 256 Bit (32 Byte) Schlüssellänge.</summary>
    public bool HasValidSecret => Encoding.UTF8.GetByteCount(Secret) >= 32;
}
