using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SprintLog.Api.Data;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Sitzungen der Browser-App über httpOnly-Cookies:
/// <list type="bullet">
/// <item>sl_at - kurzlebiger Access-Token (JWT), Pfad /api</item>
/// <item>sl_rt - Refresh-Token, nur an /api/auth gesendet, wird bei jedem Refresh rotiert</item>
/// </list>
/// JavaScript kommt an keinen der beiden Tokens heran (Schutz bei XSS). SameSite=Strict + Pflicht-Header
/// für schreibende Requests (siehe Program.cs) schützen vor CSRF.
/// </summary>
public sealed class AuthSessionService
{
    public const string AccessCookie = "sl_at";
    public const string RefreshCookie = "sl_rt";
    public const string ClientHeader = "X-Requested-With";
    public const string ClientHeaderValue = "SprintLog";
    private const string HashPurpose = "refresh";

    /// <summary>Zwei Tabs refreshen gleichzeitig: Der zweite sieht einen eben rotierten Token. Kein Diebstahl -> nicht die Familie widerrufen.</summary>
    private static readonly TimeSpan RotationGrace = TimeSpan.FromSeconds(30);

    private readonly AppDbContext _db;
    private readonly ISecretHasher _hasher;
    private readonly ITokenService _tokens;
    private readonly TimeProvider _time;
    private readonly JwtOptions _jwt;

    public AuthSessionService(AppDbContext db, ISecretHasher hasher, ITokenService tokens, TimeProvider time, IOptions<JwtOptions> jwt)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _time = time;
        _jwt = jwt.Value;
    }

    /// <summary>Request kommt von der eigenen Browser-App (setzt immer X-Requested-With: SprintLog).</summary>
    public static bool IsBrowserClient(HttpRequest request) =>
        string.Equals(request.Headers[ClientHeader], ClientHeaderValue, StringComparison.Ordinal);

    private TimeSpan AccessLifetime => TimeSpan.FromMinutes(_jwt.AccessTokenMinutes);
    private TimeSpan RefreshLifetime => TimeSpan.FromDays(_jwt.RefreshTokenDays);

    /// <summary>Neue Sitzung (neue Token-Familie) nach Login, Registrierung oder Passwortwechsel.</summary>
    public async Task StartAsync(HttpContext http, User user, CancellationToken ct)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        // Aufräumen: abgelaufene und seit über einem Tag widerrufene Tokens dieses Nutzers.
        var cutoff = now.AddDays(-1);
        await _db.RefreshTokens.Where(t => t.UserId == user.Id && (t.ExpiresAt < now || t.RevokedAt < cutoff)).ExecuteDeleteAsync(ct);

        var raw = Issue(user.Id, Guid.NewGuid(), now);
        await _db.SaveChangesAsync(ct);
        SetCookies(http, user, raw, now);
    }

    public enum RotateStatus { Ok, Missing, Invalid, Race }

    /// <summary>Tauscht den Refresh-Token aus dem Cookie gegen einen neuen (Rotation) und setzt neue Cookies.</summary>
    public async Task<(RotateStatus Status, User? User)> RotateAsync(HttpContext http, CancellationToken ct)
    {
        var raw = http.Request.Cookies[RefreshCookie];
        if (string.IsNullOrEmpty(raw)) return (RotateStatus.Missing, null);

        var hash = _hasher.Hash(HashPurpose, raw);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null) return (RotateStatus.Invalid, null);

        var now = _time.GetUtcNow().UtcDateTime;
        if (token.RevokedAt is { } revokedAt)
        {
            if (token.Rotated && now - revokedAt < RotationGrace) return (RotateStatus.Race, null);
            // Ein alter, bereits ersetzter Token wird erneut benutzt -> vermutlich kopiert: ganze Sitzung beenden.
            await RevokeFamilyAsync(token.FamilyId, now, ct);
            return (RotateStatus.Invalid, null);
        }
        if (token.ExpiresAt <= now) return (RotateStatus.Invalid, null);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == token.UserId, ct);
        if (user is null) return (RotateStatus.Invalid, null);

        token.RevokedAt = now;
        token.Rotated = true;
        var next = Issue(user.Id, token.FamilyId, now);
        await _db.SaveChangesAsync(ct);
        SetCookies(http, user, next, now);
        return (RotateStatus.Ok, user);
    }

    /// <summary>Abmelden auf diesem Gerät: Familie des aktuellen Refresh-Tokens widerrufen, Cookies löschen.</summary>
    public async Task EndAsync(HttpContext http, CancellationToken ct)
    {
        var raw = http.Request.Cookies[RefreshCookie];
        if (!string.IsNullOrEmpty(raw))
        {
            var hash = _hasher.Hash(HashPurpose, raw);
            var familyId = await _db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).FirstOrDefaultAsync(ct);
            if (familyId is { } id) await RevokeFamilyAsync(id, _time.GetUtcNow().UtcDateTime, ct);
        }
        ClearCookies(http);
    }

    /// <summary>Alle Sitzungen des Nutzers beenden (Passwort geändert/zurückgesetzt, "überall abmelden").</summary>
    public Task RevokeAllAsync(int userId, CancellationToken ct)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        return _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    public static void ClearCookies(HttpContext http)
    {
        http.Response.Cookies.Delete(AccessCookie, new CookieOptions { Path = "/api" });
        http.Response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = "/api/auth" });
    }

    private Task RevokeFamilyAsync(Guid familyId, DateTime now, CancellationToken ct) =>
        _db.RefreshTokens.Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

    private string Issue(int userId, Guid familyId, DateTime now)
    {
        var raw = SecretHasher.NewToken();
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            FamilyId = familyId,
            TokenHash = _hasher.Hash(HashPurpose, raw),
            CreatedAt = now,
            ExpiresAt = now.Add(RefreshLifetime)
        });
        return raw;
    }

    private void SetCookies(HttpContext http, User user, string refreshRaw, DateTime now)
    {
        var secure = http.Request.IsHttps;
        http.Response.Cookies.Append(AccessCookie, _tokens.CreateToken(user, AccessLifetime), new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api",
            Expires = now.Add(AccessLifetime), IsEssential = true
        });
        http.Response.Cookies.Append(RefreshCookie, refreshRaw, new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api/auth",
            Expires = now.Add(RefreshLifetime), IsEssential = true
        });
    }
}
