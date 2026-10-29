using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace SprintLog.Api.Tests;

/// <summary>
/// Simuliert die Browser-App: sendet "X-Requested-With: SprintLog" und verwaltet Cookies selbst,
/// damit Tests die Set-Cookie-Header prüfen und alte Cookies gezielt wiederverwenden können.
/// </summary>
public sealed class BrowserSession
{
    private readonly HttpClient _client;
    public Dictionary<string, string> Cookies { get; } = new();
    public List<string> LastSetCookies { get; } = new();

    public BrowserSession(HttpClient client) => _client = client;

    public Task<HttpResponseMessage> GetAsync(string url) => SendAsync(HttpMethod.Get, url);
    public Task<HttpResponseMessage> PostAsync(string url, object? body = null, bool appHeader = true) => SendAsync(HttpMethod.Post, url, body, appHeader);
    public Task<HttpResponseMessage> PutAsync(string url, object? body = null) => SendAsync(HttpMethod.Put, url, body);

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body = null, bool appHeader = true)
    {
        using var request = new HttpRequestMessage(method, url);
        if (appHeader) request.Headers.Add("X-Requested-With", "SprintLog");
        if (body is not null) request.Content = JsonContent.Create(body);
        var applicable = Cookies.Where(c => url.StartsWith(PathOf(c.Key), StringComparison.Ordinal)).ToList();
        if (applicable.Count > 0) request.Headers.Add("Cookie", string.Join("; ", applicable.Select(c => $"{c.Key}={c.Value}")));

        var response = await _client.SendAsync(request);
        LastSetCookies.Clear();
        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            foreach (var header in setCookies)
            {
                LastSetCookies.Add(header);
                var m = Regex.Match(header, "^([^=]+)=([^;]*)");
                var expired = Regex.IsMatch(header, "expires=Thu, 01 Jan 1970", RegexOptions.IgnoreCase);
                if (expired || m.Groups[2].Value.Length == 0) Cookies.Remove(m.Groups[1].Value);
                else Cookies[m.Groups[1].Value] = m.Groups[2].Value;
            }
        }
        return response;
    }

    private static string PathOf(string cookie) => cookie == "sl_rt" ? "/api/auth" : "/api";
}
