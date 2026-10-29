using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Configuration;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;
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

    private static readonly string WebRoot = CreateWebRoot();

    private static string CreateWebRoot()
    {
        var dir = Path.Combine(Path.GetTempPath(), "sprintlog-tests-wwwroot");
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "index.html"), "<!DOCTYPE html><title>SprintLog</title><div id=\"app\"></div>");
        return dir;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // Eigenes wwwroot: Die API-Tests hängen nicht vom Frontend-Build (npm run build) ab.
        builder.UseWebRoot(WebRoot);
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = _postgres.GetConnectionString(),
            ["JWT_SECRET"] = JwtSecret,
            ["Database:MigrateOnStartup"] = "true",
            ["RateLimiting:AuthPermitLimit"] = "10000",
            ["App:PublicUrl"] = PublicUrl
        }));
        // E-Mails landen in einem Postfach im Speicher statt bei Brevo.
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
        });
    }

    public const string PublicUrl = "https://sprintlog.test";

    /// <summary>Alle "versendeten" E-Mails (für Tests von Bestätigung und Passwort-Reset).</summary>
    public FakeEmailSender Emails { get; } = new();

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

public sealed class FakeEmailSender : IEmailSender
{
    private readonly System.Collections.Concurrent.ConcurrentQueue<EmailMessage> _sent = new();

    public bool IsEnabled => true;
    public IReadOnlyCollection<EmailMessage> Sent => _sent.ToArray();

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        _sent.Enqueue(message);
        return Task.CompletedTask;
    }

    /// <summary>Letzte Mail an diese Adresse und der Wert des Query-Parameters (z. B. "reset") aus dem Link.</summary>
    public (EmailMessage Message, string Token)? Last(string to, string parameter)
    {
        var message = _sent.LastOrDefault(m => m.To == to);
        if (message is null) return null;
        var match = System.Text.RegularExpressions.Regex.Match(message.Text, $@"[?&]{parameter}=([A-Za-z0-9_-]+)");
        return match.Success ? (message, match.Groups[1].Value) : null;
    }
}

/// <summary>Zeit, die sich in Tests vorstellen lässt (z. B. über die Gnadenfrist der Token-Rotation hinaus).</summary>
public sealed class ShiftedTimeProvider : TimeProvider
{
    public TimeSpan Offset { get; set; }
    public override DateTimeOffset GetUtcNow() => System.GetUtcNow() + Offset;
}
