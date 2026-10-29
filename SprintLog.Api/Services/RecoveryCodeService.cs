using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Wiederherstellungscodes: 10 Einmal-Codes je Konto, z. B. "K7M2Q-9XWPA" (~49 Bit Zufall).
/// Damit lässt sich das Passwort ohne E-Mail zurücksetzen. Gespeichert werden nur HMACs.
/// </summary>
public sealed class RecoveryCodeService
{
    public const int CodeCount = 10;
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne 0/O, 1/I/L
    private const string HashPurpose = "recovery";

    private readonly AppDbContext _db;
    private readonly ISecretHasher _hasher;
    private readonly TimeProvider _time;

    public RecoveryCodeService(AppDbContext db, ISecretHasher hasher, TimeProvider time)
    {
        _db = db;
        _hasher = hasher;
        _time = time;
    }

    /// <summary>Ersetzt alle Codes des Nutzers durch neue. Die Klartext-Codes gibt es nur in dieser Antwort.</summary>
    public async Task<string[]> RegenerateAsync(int userId, CancellationToken ct)
    {
        await _db.RecoveryCodes.Where(c => c.UserId == userId).ExecuteDeleteAsync(ct);
        var now = _time.GetUtcNow().UtcDateTime;
        var codes = Enumerable.Range(0, CodeCount).Select(_ => NewCode()).ToArray();
        _db.RecoveryCodes.AddRange(codes.Select(code => new RecoveryCode
        {
            UserId = userId,
            CodeHash = _hasher.Hash(HashPurpose, Normalize(code)),
            CreatedAt = now
        }));
        await _db.SaveChangesAsync(ct);
        return codes;
    }

    /// <summary>Markiert den Code als benutzt, wenn er gültig ist. Änderungen werden beim nächsten SaveChanges geschrieben.</summary>
    public async Task<bool> TryConsumeAsync(int userId, string? code, CancellationToken ct)
    {
        var normalized = Normalize(code);
        if (normalized.Length != 10) return false;
        var hash = _hasher.Hash(HashPurpose, normalized);
        var entry = await _db.RecoveryCodes.FirstOrDefaultAsync(c => c.UserId == userId && c.CodeHash == hash && c.UsedAt == null, ct);
        if (entry is null) return false;
        entry.UsedAt = _time.GetUtcNow().UtcDateTime;
        return true;
    }

    public Task<int> RemainingAsync(int userId, CancellationToken ct) =>
        _db.RecoveryCodes.CountAsync(c => c.UserId == userId && c.UsedAt == null, ct);

    /// <summary>Groß, ohne Leer- und Bindestriche; verwechselbare Zeichen werden angeglichen (O->0 ist nicht im Alphabet).</summary>
    public static string Normalize(string? code) =>
        new string((code ?? string.Empty).ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static string NewCode()
    {
        Span<char> chars = stackalloc char[10];
        for (var i = 0; i < chars.Length; i++) chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        return new string(chars[..5]) + "-" + new string(chars[5..]);
    }
}
