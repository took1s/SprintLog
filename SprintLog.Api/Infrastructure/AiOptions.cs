namespace SprintLog.Api.Infrastructure;

/// <summary>
/// KI-Coach über die Claude-API (Anthropic). Ohne API-Key ist die Funktion aus - die App zeigt dann keine KI-Knöpfe,
/// der regelbasierte Coach funktioniert unverändert. Der Key bleibt ausschließlich auf dem Server.
/// </summary>
public class AiOptions
{
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Schnelle, günstige Antworten im Chat.</summary>
    public string Model { get; set; } = "claude-haiku-5-5";

    /// <summary>Gründliche Arbeit: Analyse, Pläne, Wochenbilanz und "Gründlich"-Fragen.</summary>
    public string DeepModel { get; set; } = "claude-sonnet-5-5";

    /// <summary>Einheiten pro Nutzer und Tag (schnelle Frage 1, gründliche 4, Plan/Analyse 6).</summary>
    public int DailyLimit { get; set; } = 60;

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
}
