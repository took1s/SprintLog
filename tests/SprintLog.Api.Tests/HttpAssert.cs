using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SprintLog.Api.Tests;

public static class HttpAssert
{
    public static async Task StatusAsync(HttpStatusCode expected, HttpResponseMessage response)
    {
        if (response.StatusCode != expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.Fail($"Expected {(int)expected} {expected}, got {(int)response.StatusCode} {response.StatusCode}. Body: {body}");
        }
    }

    public static async Task<T> JsonAsync<T>(HttpStatusCode expected, HttpResponseMessage response)
    {
        await StatusAsync(expected, response);
        return (await response.Content.ReadFromJsonAsync<T>(SprintLogApiFactory.Json))!;
    }

    /// <summary>Liest die Feldnamen aus einem RFC-7807 ValidationProblem ("errors": { "field": [...] }).</summary>
    public static async Task<string[]> ValidationFieldsAsync(HttpResponseMessage response)
    {
        await StatusAsync(HttpStatusCode.BadRequest, response);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("errors").EnumerateObject().Select(p => p.Name).ToArray();
    }
}
