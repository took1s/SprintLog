using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SprintLog.Api.Infrastructure;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

public interface ITokenService
{
    /// <summary>Signierter JWT mit Nutzer-ID, Name und Token-Version (Claim "ver").</summary>
    string CreateToken(User user, TimeSpan lifetime);

    /// <summary>Bearer-Token für API-Clients (Gültigkeit aus Jwt:LifetimeDays).</summary>
    string CreateBearerToken(User user);
}

public class TokenService : ITokenService
{
    public const string VersionClaim = "ver";

    private readonly JwtOptions _options;
    private readonly TimeProvider _time;

    public TokenService(IOptions<JwtOptions> options, TimeProvider time)
    {
        _options = options.Value;
        _time = time;
    }

    public string CreateBearerToken(User user) => CreateToken(user, TimeSpan.FromDays(_options.LifetimeDays));

    public string CreateToken(User user, TimeSpan lifetime)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(VersionClaim, user.TokenVersion.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = _time.GetUtcNow().UtcDateTime;

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: now.Add(lifetime),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
