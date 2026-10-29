using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SprintLog.Api.Endpoints;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class MonitoringTests
{
    private const string Dsn = "https://publickey123@o4500.ingest.de.sentry.io/4501";
    private readonly SprintLogApiFactory _factory;

    public MonitoringTests(SprintLogApiFactory factory) => _factory = factory;

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<(Uri Uri, string Body, string? ContentType)> Requests { get; } = new();
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add((request.RequestUri!, await request.Content!.ReadAsStringAsync(ct), request.Content.Headers.ContentType?.MediaType));
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }

    private HttpClient ClientWithSentry(RecordingHandler handler) =>
        _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Sentry:BrowserDsn", Dsn);
            b.ConfigureTestServices(s => s.AddHttpClient(nameof(MonitoringEndpoints)).ConfigurePrimaryHttpMessageHandler(() => handler));
        }).CreateClient();

    private static StringContent Envelope(string dsn) =>
        new($"{{\"event_id\":\"9ec79c33ec9942ab8353589fcb2e04dc\",\"dsn\":\"{dsn}\"}}\n{{\"type\":\"event\"}}\n{{\"message\":\"boom\"}}", Encoding.UTF8, "text/plain");

    [Fact]
    public async Task Config_without_dsn_disables_browser_monitoring()
    {
        var config = await _factory.CreateClient().GetFromJsonAsync<MonitoringEndpoints.ClientConfig>("/api/config", SprintLogApiFactory.Json);
        Assert.Null(config!.SentryDsn);
        Assert.StartsWith("sprintlog@", config.Release);

        var tunnel = await _factory.CreateClient().PostAsync("/api/monitoring/tunnel", Envelope(Dsn));
        Assert.Equal(HttpStatusCode.NotFound, tunnel.StatusCode);
    }

    [Fact]
    public async Task Tunnel_forwards_envelopes_for_our_project_only()
    {
        var handler = new RecordingHandler();
        var client = ClientWithSentry(handler);

        var config = await client.GetFromJsonAsync<MonitoringEndpoints.ClientConfig>("/api/config", SprintLogApiFactory.Json);
        Assert.Equal(Dsn, config!.SentryDsn);

        var ok = await client.PostAsync("/api/monitoring/tunnel", Envelope(Dsn));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var forwarded = Assert.Single(handler.Requests);
        Assert.Equal("https://o4500.ingest.de.sentry.io/api/4501/envelope/", forwarded.Uri.ToString());
        Assert.Equal("application/x-sentry-envelope", forwarded.ContentType);
        Assert.Contains("boom", forwarded.Body);

        // Fremdes Projekt / fremder Host -> kein offener Proxy.
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/monitoring/tunnel", Envelope("https://publickey123@evil.example.com/4501"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/monitoring/tunnel", Envelope("https://publickey123@o4500.ingest.de.sentry.io/999"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/monitoring/tunnel", new StringContent("not json\n{}"))).StatusCode);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Tunnel_rejects_oversized_envelopes()
    {
        var handler = new RecordingHandler();
        var client = ClientWithSentry(handler);
        var big = new StringContent($"{{\"dsn\":\"{Dsn}\"}}\n" + new string('x', MonitoringEndpoints.MaxEnvelopeBytes + 10));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await client.PostAsync("/api/monitoring/tunnel", big)).StatusCode);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("https://abc@o1.ingest.sentry.io/123", "abc", "o1.ingest.sentry.io", "123")]
    [InlineData("https://abc:secret@sentry.example.com:9000/sub/42", "abc", "sentry.example.com:9000", "42")]
    public void Dsn_is_parsed(string dsn, string key, string host, string project)
    {
        var parts = SentryDsnParts.TryParse(dsn)!;
        Assert.Equal((key, host, project), (parts.PublicKey, parts.Host, parts.ProjectId));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("https://o1.ingest.sentry.io/123")]
    [InlineData("https://abc@o1.ingest.sentry.io/project")]
    [InlineData("ftp://abc@o1.ingest.sentry.io/123")]
    public void Invalid_dsn_is_rejected(string? dsn) => Assert.Null(SentryDsnParts.TryParse(dsn));

    [Fact]
    public void Scrubber_removes_secrets()
    {
        Assert.True(SentryScrubber.IsSensitive("X-Refresh-Token"));
        Assert.True(SentryScrubber.IsSensitive("password"));
        Assert.True(SentryScrubber.IsSensitive("Cookie"));
        Assert.False(SentryScrubber.IsSensitive("User-Agent"));
    }
}
