namespace SprintLog.Api.Infrastructure;

/// <summary>
/// KI-Coach über die Claude-API (Anthropic). Ohne API-Key ist die Funktion aus - die App zeigt dann keine KI-Knöpfe,
/// der regelbasierte Coach funktioniert unverändert. Der Key bleibt ausschließlich auf dem Server.
/// </summary>
public class AiOptions
{
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Schnell und günstig - für kurze Coach-Antworten und Pläne ausreichend.</summary>
    public string Model { get; set; } = "claude-haiku-5-5";

    /// <summary>Anfragen pro Nutzer und Tag (Schutz vor Kostenexplosion, z. B. durch eine Schleife im Client).</summary>
    public int DailyLimit { get; set; } = 30;

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
}
