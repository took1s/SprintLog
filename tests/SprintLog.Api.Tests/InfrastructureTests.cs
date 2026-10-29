using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class InfrastructureTests
{
    private readonly SprintLogApiFactory _factory;

    public InfrastructureTests(SprintLogApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Health_endpoint_reports_healthy_database()
    {
        var response = await _factory.CreateClient().GetAsync("/health");

        await HttpAssert.StatusAsync(HttpStatusCode.OK, response);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Static_frontend_is_served_with_security_headers()
    {
        var response = await _factory.CreateClient().GetAsync("/");

        await HttpAssert.StatusAsync(HttpStatusCode.OK, response);
        Assert.Contains("SprintLog", await response.Content.ReadAsStringAsync());
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        var csp = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("script-src 'self'", csp);
        Assert.DoesNotContain("unsafe-eval", csp);
        Assert.DoesNotContain("unsafe-inline", csp);
    }

    [Fact]
    public async Task Login_is_rate_limited()
    {
        using var limited = _factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration(c =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimiting:AuthPermitLimit"] = "3" })));
        var client = limited.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "nobody", password = "wrong-password" });
            statuses.Add(response.StatusCode);
        }

        Assert.Equal(3, statuses.Count(s => s == HttpStatusCode.Unauthorized));
        Assert.Equal(2, statuses.Count(s => s == HttpStatusCode.TooManyRequests));
    }
}
