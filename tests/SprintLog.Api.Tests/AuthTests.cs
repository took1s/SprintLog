using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

[Collection(ApiCollection.Name)]
public class AuthTests
{
    private readonly SprintLogApiFactory _factory;

    public AuthTests(SprintLogApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Register_returns_token_that_works_for_protected_endpoints()
    {
        var user = await _factory.CreateUserAsync();

        var response = await user.Client.GetAsync("/api/auth/me");

        await HttpAssert.StatusAsync(HttpStatusCode.OK, response);
        Assert.Contains(user.Username, await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("ab", "long-enough-password", "username")]
    [InlineData("has space", "long-enough-password", "username")]
    [InlineData("valid_name", "short", "password")]
    [InlineData("", "", "username")]
    public async Task Register_rejects_invalid_input(string username, string password, string expectedField)
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new { username, password });

        var fields = await HttpAssert.ValidationFieldsAsync(response);
        Assert.Contains(expectedField, fields, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Register_rejects_duplicate_username_case_insensitive()
    {
        var user = await _factory.CreateUserAsync();
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register",
            new { username = user.Username.ToUpperInvariant(), password = "another-password" });

        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, response);
    }

    [Fact]
    public async Task Login_succeeds_with_case_insensitive_username()
    {
        var user = await _factory.CreateUserAsync();
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login",
            new { username = user.Username.ToUpperInvariant(), password = user.Password });

        var token = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, response);
        Assert.Equal(user.UserId, token.UserId);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Login_with_wrong_credentials_returns_401(bool existingUser)
    {
        var user = await _factory.CreateUserAsync();
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            username = existingUser ? user.Username : "does_not_exist_" + Guid.NewGuid().ToString("N")[..6],
            password = "wrong-password"
        });

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, response);
    }

    [Theory]
    [InlineData("/api/exercises")]
    [InlineData("/api/workouts/history")]
    [InlineData("/api/favorites")]
    [InlineData("/api/auth/me")]
    public async Task Protected_endpoints_require_a_token(string url)
    {
        var response = await _factory.CreateClient().GetAsync(url);

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, response);
    }

    [Fact]
    public async Task Token_signed_with_another_key_is_rejected()
    {
        var user = await _factory.CreateUserAsync();
        var forged = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "SprintLog",
            audience: "SprintLog",
            claims: new[] { new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()), new Claim(ClaimTypes.Name, user.Username) },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes("attacker-controlled-secret-key-0123456789")),
                SecurityAlgorithms.HmacSha256)));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", forged);

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await client.GetAsync("/api/workouts/history"));
    }

    [Fact]
    public async Task Refresh_returns_a_new_working_token()
    {
        var user = await _factory.CreateUserAsync();

        var token = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, await user.Client.PostAsync("/api/auth/refresh", null));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await client.GetAsync("/api/auth/me"));
    }

    [Fact]
    public async Task Delete_account_requires_password_and_removes_all_data()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/workouts", Payloads.Workout(Guid.NewGuid())));
        await HttpAssert.StatusAsync(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/exercises",
            new { name = "Custom " + Guid.NewGuid().ToString("N")[..6], category = "Gym", trackingType = "WeightReps" }));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.PostAsync($"/api/favorites/{Seed.BenchPress}", null));

        var wrong = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account") { Content = JsonContent.Create(new { password = "nope" }) };
        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, await user.Client.SendAsync(wrong));

        var correct = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account") { Content = JsonContent.Create(new { password = user.Password }) };
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await user.Client.SendAsync(correct));

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await user.Client.PostAsync("/api/auth/refresh", null));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { username = user.Username, password = user.Password }));
    }
}
