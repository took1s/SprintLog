using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Sitzungen der nativen iOS-App: Tokens im Body statt Cookies, Rotation, Diebstahl-Erkennung, CORS.</summary>
[Collection(ApiCollection.Name)]
public class NativeSessionTests
{
    private const string Password = "correct-horse-battery";
    private const string Origin = "capacitor://localhost";
    private readonly SprintLogApiFactory _factory;

    public NativeSessionTests(SprintLogApiFactory factory) => _factory = factory;

    private HttpClient NewApp(WebApplicationFactory<Program>? factory = null)
    {
        var client = (factory ?? _factory).CreateClient(new() { HandleCookies = false });
        client.DefaultRequestHeaders.Add("X-SprintLog-Client", "ios");
        client.DefaultRequestHeaders.Add("Origin", Origin);
        return client;
    }

    private static string NewName() => "ios_" + Guid.NewGuid().ToString("N")[..10];

    private static async Task<TokenResponse> RegisterAsync(HttpClient app)
    {
        var response = await app.PostAsJsonAsync("/api/auth/register", new { username = NewName(), password = Password });
        var body = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.Created, response);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        return body;
    }

    private static Task<HttpResponseMessage> RefreshAsync(HttpClient app, string? refreshToken) =>
        app.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });

    private static async Task<HttpResponseMessage> MeAsync(HttpClient app, string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return await app.SendAsync(request);
    }

    [Fact]
    public async Task Login_returns_access_and_refresh_token_in_the_body()
    {
        var app = NewApp();
        var body = await RegisterAsync(app);
        Assert.False(string.IsNullOrEmpty(body.Token));
        Assert.False(string.IsNullOrEmpty(body.RefreshToken));

        var me = await HttpAssert.JsonAsync<MeResponse>(HttpStatusCode.OK, await MeAsync(app, body.Token!));
        Assert.Equal(body.UserId, me.Id);
    }

    [Fact]
    public async Task Refresh_rotates_and_reusing_an_old_token_after_the_grace_revokes_the_family()
    {
        var clock = new ShiftedTimeProvider();
        using var factory = _factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<TimeProvider>();
            s.AddSingleton<TimeProvider>(clock);
        }));
        var app = NewApp(factory);
        var first = await RegisterAsync(app);

        var rotated = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, await RefreshAsync(app, first.RefreshToken));
        Assert.NotEqual(first.RefreshToken, rotated.RefreshToken);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await MeAsync(app, rotated.Token!));

        // Nach der Kulanzzeit gilt ein alter Token als gestohlen: ganze Familie widerrufen.
        clock.Offset = TimeSpan.FromSeconds(45);
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await RefreshAsync(app, first.RefreshToken));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await RefreshAsync(app, rotated.RefreshToken));
    }

    [Fact]
    public async Task Refresh_without_or_with_unknown_token_is_401()
    {
        var app = NewApp();
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await RefreshAsync(app, null));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await RefreshAsync(app, "nope"));
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var app = NewApp();
        var body = await RegisterAsync(app);
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await app.PostAsJsonAsync("/api/auth/logout", new { refreshToken = body.RefreshToken }));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await RefreshAsync(app, body.RefreshToken));
    }

    [Fact]
    public async Task Cors_preflight_allows_the_app_origin_only()
    {
        var client = _factory.CreateClient(new() { HandleCookies = false });

        async Task<HttpResponseMessage> Preflight(string origin)
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/workouts");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "POST");
            request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type,x-sprintlog-client");
            return await client.SendAsync(request);
        }

        var allowed = await Preflight(Origin);
        Assert.True(allowed.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins));
        Assert.Equal(Origin, Assert.Single(origins!));
        Assert.False(allowed.Headers.Contains("Access-Control-Allow-Credentials"));

        var foreign = await Preflight("https://evil.example");
        Assert.False(foreign.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
