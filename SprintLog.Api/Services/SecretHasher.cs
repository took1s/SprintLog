using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Services;

/// <summary>
/// Hash für Geheimnisse, die nur geprüft, nie zurückgelesen werden (Refresh-Tokens, Wiederherstellungscodes, E-Mail-Links).
/// HMAC-SHA256 mit einem aus dem JWT-Secret abgeleiteten Schlüssel: Ein Datenbank-Dump allein reicht nicht,
/// um Codes durch Ausprobieren zu finden, und die Prüfung bleibt ein schneller Index-Lookup.
/// </summary>
public interface ISecretHasher
{
    string Hash(string purpose, string secret);
}

public sealed class SecretHasher : ISecretHasher
{
    private readonly byte[] _key;

    public SecretHasher(IOptions<JwtOptions> jwt)
    {
        _key = HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(jwt.Value.Secret), 32,
            info: Encoding.UTF8.GetBytes("sprintlog:secret-hasher:v1"));
    }

    public string Hash(string purpose, string secret)
    {
        var mac = HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{purpose}:{secret}"));
        return Convert.ToHexString(mac).ToLowerInvariant();
    }

    /// <summary>Zufälliger, URL-tauglicher Token (Standard: 256 Bit).</summary>
    public static string NewToken(int bytes = 32) => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(bytes));
}
