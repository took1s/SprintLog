using System.Text;

namespace SprintLog.Api.Infrastructure;

public class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SprintLog";
    public string Audience { get; set; } = "SprintLog";
    public int LifetimeDays { get; set; } = 7;

    /// <summary>HMAC-SHA256 braucht mindestens 256 Bit (32 Byte) Schlüssellänge.</summary>
    public bool HasValidSecret => Encoding.UTF8.GetByteCount(Secret) >= 32;
}
