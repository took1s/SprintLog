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

    /// <summary>
    /// Native App (iOS/Android, Capacitor): lädt die Oberfläche aus dem App-Paket (Origin capacitor://localhost) und ist
    /// damit ein Cross-Origin-Client - Cookies wären Drittanbieter-Cookies. Sie bekommt Access- und Refresh-Token im Body
    /// und speichert sie selbst. Rotation und Diebstahl-Erkennung sind dieselben wie bei der Cookie-Sitzung.
    /// </summary>
    public const string NativeClientHeader = "X-SprintLog-Client";
    private static readonly string[] NativePlatforms = { "ios", "android" };
    private const string HashPurpose = "refresh";

    /// <summary>
    /// Gnadenfrist nach einer Rotation. Ein eben ersetzter Token kommt erneut an, wenn zwei Tabs gleichzeitig refreshen
    /// ODER wenn die Antwort mit den neuen Cookies den Browser nie erreicht hat (Verbindung bricht ab, In-App-Browser wie
    /// Telegram wird in den Hintergrund geschickt). Beides ist kein Diebstahl: Innerhalb der Frist bekommt der Client
    /// einen neuen Token derselben Familie ("reuse interval" wie bei Auth0/Okta). Danach gilt Wiederverwendung als Diebstahl.
    /// </summary>
    private static readonly TimeSpan RotationGrace = TimeSpan.FromSeconds(30);

    private readonly AppDbContext _db;
    private readonly ISecretHasher _hasher;
    private readonly ITokenService _tokens;
    private readonly TimeProvider _time;
    private readonly JwtOptions _jwt;
    private readonly ILogger<AuthSessionService> _log;

    public AuthSessionService(AppDbContext db, ISecretHasher hasher, ITokenService tokens, TimeProvider time, IOptions<JwtOptions> jwt, ILogger<AuthSessionService> log)
    {
        _log = log;
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _time = time;
        _jwt = jwt.Value;
    }

    /// <summary>Request kommt von der nativen App (Header X-SprintLog-Client: ios|android).</summary>
    public static bool IsNativeClient(HttpRequest request) =>
        NativePlatforms.Contains(request.Headers[NativeClientHeader].ToString(), StringComparer.OrdinalIgnoreCase);

    /// <summary>Request kommt von der eigenen Browser-App (setzt immer X-Requested-With: SprintLog).</summary>
    public static bool IsBrowserClient(HttpRequest request) =>
        string.Equals(request.Headers[ClientHeader], ClientHeaderValue, StringComparison.Ordinal);

    private TimeSpan AccessLifetime => TimeSpan.FromMinutes(_jwt.AccessTokenMinutes);
    private TimeSpan RefreshLifetime => TimeSpan.FromDays(_jwt.RefreshTokenDays);

    /// <summary>Neue Sitzung (neue Token-Familie) nach Login, Registrierung oder Passwortwechsel.</summary>
    public async Task StartAsync(HttpContext http, User user, CancellationToken ct)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var raw = await StartFamilyAsync(user, now, ct);
        SetCookies(http, user, raw, now);
    }

    /// <summary>Wie <see cref="StartAsync"/>, aber für die native App: Tokens statt Cookies.</summary>
    public async Task<NativeTokens> StartNativeAsync(User user, CancellationToken ct)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var raw = await StartFamilyAsync(user, now, ct);
        return new NativeTokens(_tokens.CreateToken(user, AccessLifetime), raw);
    }

    private async Task<string> StartFamilyAsync(User user, DateTime now, CancellationToken ct)
    {
        // Aufräumen: abgelaufene und seit über einem Tag widerrufene Tokens dieses Nutzers.
        var cutoff = now.AddDays(-1);
        await _db.RefreshTokens.Where(t => t.UserId == user.Id && (t.ExpiresAt < now || t.RevokedAt < cutoff)).ExecuteDeleteAsync(ct);
        var raw = Issue(user.Id, Guid.NewGuid(), now);
        await _db.SaveChangesAsync(ct);
        return raw;
    }

    public sealed record NativeTokens(string AccessToken, string RefreshToken);

    public enum RotateStatus { Ok, Missing, Invalid }

    /// <summary>Tauscht den Refresh-Token aus dem Cookie gegen einen neuen (Rotation) und setzt neue Cookies.</summary>
    public async Task<(RotateStatus Status, User? User)> RotateAsync(HttpContext http, CancellationToken ct)
    {
        var (status, user, next) = await RotateRawAsync(http.Request.Cookies[RefreshCookie], ct);
        if (status == RotateStatus.Ok) SetCookies(http, user!, next!, _time.GetUtcNow().UtcDateTime);
        return (status, user);
    }

    /// <summary>Rotation für die native App: Refresh-Token aus dem Body, neue Tokens zurück.</summary>
    public async Task<(RotateStatus Status, User? User, NativeTokens? Tokens)> RotateNativeAsync(string? raw, CancellationToken ct)
    {
        var (status, user, next) = await RotateRawAsync(raw, ct);
        return status == RotateStatus.Ok
            ? (status, user, new NativeTokens(_tokens.CreateToken(user!, AccessLifetime), next!))
            : (status, null, null);
    }

    /// <summary>Kern der Rotation (unabhängig davon, ob der Token aus Cookie oder Body kommt).</summary>
    private async Task<(RotateStatus Status, User? User, string? Next)> RotateRawAsync(string? raw, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(raw)) return (RotateStatus.Missing, null, null);

        var hash = _hasher.Hash(HashPurpose, raw);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null) return (RotateStatus.Invalid, null, null);

        var now = _time.GetUtcNow().UtcDateTime;
        if (token.RevokedAt is { } revokedAt)
        {
            var withinGrace = token.Rotated && now - revokedAt < RotationGrace;
            // Nur solange die Sitzung selbst noch lebt (nicht abgemeldet / nicht als gestohlen widerrufen).
            if (withinGrace && token.ExpiresAt > now
                && await _db.RefreshTokens.AnyAsync(t => t.FamilyId == token.FamilyId && t.RevokedAt == null && t.ExpiresAt > now, ct))
            {
                var sameUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == token.UserId, ct);
                if (sameUser is null) return (RotateStatus.Invalid, null, null);
                var reissued = Issue(sameUser.Id, token.FamilyId, now);
                await _db.SaveChangesAsync(ct);
                return (RotateStatus.Ok, sameUser, reissued);
            }
            if (withinGrace) return (RotateStatus.Invalid, null, null);
            // Ein alter, bereits ersetzter Token wird erneut benutzt -> vermutlich kopiert: ganze Sitzung beenden.
            _log.LogWarning("Security: reuse of a rotated refresh token for user {UserId} - session family revoked", token.UserId);
            await RevokeFamilyAsync(token.FamilyId, now, ct);
            return (RotateStatus.Invalid, null, null);
        }
        if (token.ExpiresAt <= now) return (RotateStatus.Invalid, null, null);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == token.UserId, ct);
        if (user is null) return (RotateStatus.Invalid, null, null);

        token.RevokedAt = now;
        token.Rotated = true;
        var next = Issue(user.Id, token.FamilyId, now);
        await _db.SaveChangesAsync(ct);
        return (RotateStatus.Ok, user, next);
    }

    /// <summary>Abmelden auf diesem Gerät: Familie des aktuellen Refresh-Tokens widerrufen, Cookies löschen.</summary>
    public async Task EndAsync(HttpContext http, CancellationToken ct)
    {
        await EndFamilyAsync(http.Request.Cookies[RefreshCookie], ct);
        ClearCookies(http);
    }

    /// <summary>Abmelden der nativen App (Refresh-Token aus dem Body).</summary>
    public Task EndNativeAsync(string? raw, CancellationToken ct) => EndFamilyAsync(raw, ct);

    private async Task EndFamilyAsync(string? raw, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(raw)) return;
        var hash = _hasher.Hash(HashPurpose, raw);
        var familyId = await _db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).FirstOrDefaultAsync(ct);
        if (familyId is { } id) await RevokeFamilyAsync(id, _time.GetUtcNow().UtcDateTime, ct);
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
