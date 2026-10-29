using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using SprintLog.Api.DTOs;
using Testcontainers.PostgreSql;

namespace SprintLog.Api.Tests;

/// <summary>
/// Startet die echte API gegen eine echte PostgreSQL-Instanz (Docker / Testcontainers).
/// So werden auch Migrationen, Indizes und Npgsql-Eigenheiten mitgetestet - nicht nur ein In-Memory-Ersatz.
/// </summary>
public sealed class SprintLogApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string JwtSecret = "integration-tests-secret-key-with-more-than-32-bytes";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _postgres.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = _postgres.GetConnectionString(),
            ["JWT_SECRET"] = JwtSecret,
            ["Database:MigrateOnStartup"] = "true",
            ["RateLimiting:AuthPermitLimit"] = "10000"
        }));
    }

    public Task InitializeAsync() => _postgres.StartAsync();

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    /// <summary>Registriert einen neuen Nutzer mit zufälligem Namen und liefert einen authentifizierten Client.</summary>
    public async Task<TestUser> CreateUserAsync(string? username = null, string password = "correct-horse-battery")
    {
        username ??= "user_" + Guid.NewGuid().ToString("N")[..12];
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new { username, password });
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<TokenResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        return new TestUser(client, token.UserId, token.Username, password, token.Token);
    }
}

public sealed record TestUser(HttpClient Client, int UserId, string Username, string Password, string Token);

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<SprintLogApiFactory>
{
    public const string Name = "api";
}
