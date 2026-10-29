using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Services;

public sealed record EmailMessage(string To, string Subject, string Text, string Html);

public interface IEmailSender
{
    bool IsEnabled { get; }
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>Kein E-Mail-Dienst konfiguriert: Funktionen mit E-Mail sind in der App ausgeblendet.</summary>
public sealed class DisabledEmailSender : IEmailSender
{
    public bool IsEnabled => false;
    public Task SendAsync(EmailMessage message, CancellationToken ct) => throw new InvalidOperationException("E-mail is not configured.");
}

/// <summary>Versand über die Transactional-Email-API von Brevo (https://developers.brevo.com/reference/sendtransacemail).</summary>
public sealed class BrevoEmailSender : IEmailSender
{
    private readonly HttpClient _http;
    private readonly EmailOptions _options;

    public BrevoEmailSender(HttpClient http, IOptions<EmailOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool IsEnabled => true;

    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "v3/smtp/email")
        {
            Content = JsonContent.Create(new
            {
                sender = new { name = _options.FromName, email = _options.From },
                to = new[] { new { email = message.To } },
                subject = message.Subject,
                textContent = message.Text,
                htmlContent = message.Html
            })
        };
        request.Headers.Add("api-key", _options.BrevoApiKey);
        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"Brevo returned {(int)response.StatusCode}: {body[..Math.Min(body.Length, 300)]}");
        }
    }
}

/// <summary>Texte der System-E-Mails (bewusst schlicht: Text + minimales HTML, keine externen Bilder).</summary>
public static class EmailTemplates
{
    public static EmailMessage VerifyEmail(string to, string username, string link) => Build(to,
        "Confirm your e-mail for SprintLog",
        $"Hi {username},\n\nplease confirm this address for password resets:\n{link}\n\nThe link is valid for 24 hours. If you did not request this, ignore this e-mail.",
        username, "Confirm your e-mail address", "This address will only be used to reset your password.", "Confirm e-mail", link, "The link is valid for 24 hours.");

    public static EmailMessage ResetPassword(string to, string username, string link) => Build(to,
        "Reset your SprintLog password",
        $"Hi {username},\n\nsomeone asked to reset the password of your SprintLog account.\n{link}\n\nThe link is valid for 30 minutes and works once. If it was not you, ignore this e-mail - your password stays unchanged.",
        username, "Reset your password", "Someone asked to reset the password of your SprintLog account.", "Choose a new password", link,
        "The link is valid for 30 minutes and works once. If it was not you, ignore this e-mail.");

    private static EmailMessage Build(string to, string subject, string text, string username, string title, string intro, string button, string link, string footer)
    {
        var e = System.Net.WebUtility.HtmlEncode;
        var html = $"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
              <h2 style="margin:0 0 12px">{e(title)}</h2>
              <p>Hi {e(username)},</p>
              <p>{e(intro)}</p>
              <p style="margin:24px 0"><a href="{e(link)}" style="background:#00a6d6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">{e(button)}</a></p>
              <p style="font-size:12px;color:#64748b">{e(footer)}<br>{e(link)}</p>
            </div>
            """;
        return new EmailMessage(to, subject, text, html);
    }
}
