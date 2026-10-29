namespace SprintLog.Api.Infrastructure;

/// <summary>
/// Versand von E-Mails (Passwort zurücksetzen, Adresse bestätigen) über die HTTP-API von Brevo.
/// Ohne API-Key, Absender und öffentliche URL ist der Versand deaktiviert - die App funktioniert dann
/// weiter, Konten lassen sich aber nur über Wiederherstellungscodes zurückholen.
/// </summary>
public class EmailOptions
{
    public string BrevoApiKey { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string FromName { get; set; } = "SprintLog";

    /// <summary>Basis-URL der App für Links in E-Mails (nie aus dem Host-Header ableiten - Host-Header-Injection).</summary>
    public string PublicUrl { get; set; } = string.Empty;

    public bool Enabled => !string.IsNullOrWhiteSpace(BrevoApiKey) && !string.IsNullOrWhiteSpace(From) && Uri.IsWellFormedUriString(PublicUrl, UriKind.Absolute);

    public string Link(string query) => $"{PublicUrl.TrimEnd('/')}/?{query}";
}
