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

    /// <summary>Einheiten pro Nutzer und Tag (schnelle Frage 1, gründliche 4, Plan/Analyse 6) - für alle außer den Inhabern.</summary>
    public int DailyLimit { get; set; } = 12;

    /// <summary>Tageskontingent der Inhaber (siehe <see cref="Owners"/>).</summary>
    public int OwnerDailyLimit { get; set; } = 60;

    /// <summary>Benutzernamen mit dem großen Kontingent (Konfiguration "Ai:Owners", durch Komma getrennt; Groß/klein egal).</summary>
    public HashSet<string> Owners { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public bool IsOwner(string? username) => !string.IsNullOrWhiteSpace(username) && Owners.Contains(username.Trim());

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
}
