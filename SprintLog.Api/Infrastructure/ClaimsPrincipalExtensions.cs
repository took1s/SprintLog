using System.Security.Claims;

namespace SprintLog.Api.Infrastructure;

public static class ClaimsPrincipalExtensions
{
    /// <summary>Liest die Nutzer-ID aus dem JWT. Gibt null zurück, wenn der Claim fehlt oder ungültig ist.</summary>
    public static int? GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var id) ? id : null;
    }
}
