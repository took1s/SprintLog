using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Cookie-Sitzungen der Browser-App: httpOnly-Cookies, Rotation, Diebstahl-Erkennung, CSRF, Abmelden.</summary>
[Collection(ApiCollection.Name)]
public class AuthSessionTests
{
    private const string Password = "correct-horse-battery";
    private readonly SprintLogApiFactory _factory;

    public AuthSessionTests(SprintLogApiFactory factory) => _factory = factory;

    private BrowserSession NewBrowser(WebApplicationFactory<Program>? factory = null) =>
        new((factory ?? _factory).CreateClient(new() { HandleCookies = false }));

    private static string NewName() => "web_" + Guid.NewGuid().ToString("N")[..10];

    private static async Task<(BrowserSession Browser, TokenResponse Body)> RegisterAsync(BrowserSession browser, string? name = null)
    {
        var response = await browser.PostAsync("/api/auth/register", new { username = name ?? NewName(), password = Password });
        var body = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.Created, response);
        return (browser, body);
    }

    [Fact]
    public async Task Browser_login_sets_httponly_strict_cookies_and_returns_no_token()
    {
        var browser = NewBrowser();
        var (_, registered) = await RegisterAsync(browser);
        Assert.Null(registered.Token);

        var login = await browser.PostAsync("/api/auth/login", new { username = registered.Username, password = Password });
        var body = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, login);
        Assert.Null(body.Token);

        var access = Assert.Single(browser.LastSetCookies, c => c.StartsWith("sl_at="));
        var refresh = Assert.Single(browser.LastSetCookies, c => c.StartsWith("sl_rt="));
        foreach (var cookie in new[] { access, refresh })
        {
            Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        }
        Assert.Contains("path=/api", access, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", refresh, StringComparison.OrdinalIgnoreCase);

        var me = await HttpAssert.JsonAsync<MeResponse>(HttpStatusCode.OK, await browser.GetAsync("/api/auth/me"));
        Assert.Equal(registered.UserId, me.Id);
    }

    [Fact]
    public async Task Api_clients_without_the_app_header_keep_getting_bearer_tokens_and_no_cookies()
    {
        var client = _factory.CreateClient(new() { HandleCookies = false });
        var response = await client.PostAsJsonAsync("/api/auth/register", new { username = NewName(), password = Password });
        var body = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.Created, response);
        Assert.False(string.IsNullOrEmpty(body.Token));
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Cookie_auth_requires_the_app_header_for_writes_csrf_protection()
    {
        var (browser, _) = await RegisterAsync(NewBrowser());

        // Ein Formular einer fremden Seite könnte die Cookies mitschicken, aber nicht den Header setzen.
        var forged = await browser.PostAsync("/api/favorites/1", appHeader: false);
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, forged);

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await browser.PostAsync("/api/favorites/1"));
        // Lesen ohne Header ist unkritisch und erlaubt.
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await browser.SendAsync(HttpMethod.Get, "/api/favorites", appHeader: false));
    }

    [Fact]
    public async Task Refresh_rotates_the_refresh_token_and_keeps_the_session_alive()
    {
        var (browser, registered) = await RegisterAsync(NewBrowser());
        var first = browser.Cookies["sl_rt"];

        var refreshed = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, await browser.PostAsync("/api/auth/refresh"));
        Assert.Equal(registered.UserId, refreshed.UserId);
        Assert.Null(refreshed.Token);
        Assert.NotEqual(first, browser.Cookies["sl_rt"]);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await browser.GetAsync("/api/auth/me"));
    }

    [Fact]
    public async Task Reusing_a_rotated_refresh_token_within_the_grace_period_is_a_race_not_theft()
    {
        var (browser, _) = await RegisterAsync(NewBrowser());
        var old = browser.Cookies["sl_rt"];
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await browser.PostAsync("/api/auth/refresh"));

        var otherTab = NewBrowser();
        otherTab.Cookies["sl_rt"] = old;
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, await otherTab.PostAsync("/api/auth/refresh"));

        // Die echte Sitzung läuft weiter.
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await browser.PostAsync("/api/auth/refresh"));
    }

    [Fact]
    public async Task Reusing_a_rotated_refresh_token_later_revokes_the_whole_session()
    {
        var clock = new ShiftedTimeProvider();
        using var factory = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(clock);
        }));

        var (browser, _) = await RegisterAsync(NewBrowser(factory));
        var stolen = browser.Cookies["sl_rt"];
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await browser.PostAsync("/api/auth/refresh"));

        clock.Offset = TimeSpan.FromSeconds(45); // nach der Gnadenfrist
        var attacker = NewBrowser(factory);
        attacker.Cookies["sl_rt"] = stolen;
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await attacker.PostAsync("/api/auth/refresh"));

        // Auch der rechtmäßige (neueste) Token ist jetzt widerrufen -> Nutzer muss sich neu anmelden.
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await browser.PostAsync("/api/auth/refresh"));
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token_and_clears_cookies()
    {
        var (browser, _) = await RegisterAsync(NewBrowser());
        var refresh = browser.Cookies["sl_rt"];

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await browser.PostAsync("/api/auth/logout"));
        Assert.False(browser.Cookies.ContainsKey("sl_rt"));
        Assert.False(browser.Cookies.ContainsKey("sl_at"));

        var replay = NewBrowser();
        replay.Cookies["sl_rt"] = refresh;
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await replay.PostAsync("/api/auth/refresh"));
    }

    [Fact]
    public async Task Legacy_bearer_token_can_be_upgraded_to_a_cookie_session()
    {
        // Ältere App-Versionen hatten den Token in localStorage: mit Token + App-Header gibt es eine Cookie-Sitzung.
        var user = await _factory.CreateUserAsync();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user.Token);
        request.Headers.Add("X-Requested-With", "SprintLog");

        var client = _factory.CreateClient(new() { HandleCookies = false });
        var response = await client.SendAsync(request);
        var body = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, response);
        Assert.Null(body.Token);
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("sl_rt="));
    }

    [Fact]
    public async Task Logout_everywhere_invalidates_existing_bearer_tokens_immediately()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.GetAsync("/api/auth/me"));

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PostAsync("/api/auth/logout-all", null));

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await user.Client.GetAsync("/api/auth/me"));
    }
}
