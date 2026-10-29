using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Tests;

/// <summary>Wiederherstellungscodes, Passwort ändern, E-Mail bestätigen, Passwort per E-Mail zurücksetzen.</summary>
[Collection(ApiCollection.Name)]
public class AccountRecoveryTests
{
    private const string Password = "correct-horse-battery";
    private const string NewPassword = "brand-new-password-42";
    private readonly SprintLogApiFactory _factory;

    public AccountRecoveryTests(SprintLogApiFactory factory) => _factory = factory;

    private static string NewName() => "acc_" + Guid.NewGuid().ToString("N")[..10];

    private async Task<(TokenResponse Registered, HttpClient Client)> RegisterAsync(string username)
    {
        var client = _factory.CreateClient();
        var registered = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.Created,
            await client.PostAsJsonAsync("/api/auth/register", new { username, password = Password }));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", registered.Token);
        return (registered, client);
    }

    private Task<HttpResponseMessage> LoginAsync(string username, string password) =>
        _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { username, password });

    [Fact]
    public async Task Registration_returns_ten_unique_recovery_codes_once()
    {
        var (registered, client) = await RegisterAsync(NewName());

        Assert.NotNull(registered.RecoveryCodes);
        Assert.Equal(10, registered.RecoveryCodes!.Distinct().Count());
        Assert.All(registered.RecoveryCodes, c => Assert.Matches("^[A-Z2-9]{5}-[A-Z2-9]{5}$", c));

        var me = await HttpAssert.JsonAsync<MeResponse>(HttpStatusCode.OK, await client.GetAsync("/api/auth/me"));
        Assert.Equal(10, me.RecoveryCodesRemaining);
    }

    [Fact]
    public async Task Recovery_code_resets_the_password_once_and_logs_out_old_tokens()
    {
        var name = NewName();
        var (registered, oldClient) = await RegisterAsync(name);
        var code = registered.RecoveryCodes![3];

        // Eingabe tolerant: klein, ohne Bindestrich
        var recovered = await _factory.CreateClient().PostAsJsonAsync("/api/auth/recover",
            new { username = name.ToUpperInvariant(), code = code.Replace("-", "").ToLowerInvariant(), newPassword = NewPassword });
        var session = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, recovered);
        Assert.False(string.IsNullOrEmpty(session.Token));

        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await LoginAsync(name, Password));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await LoginAsync(name, NewPassword));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await oldClient.GetAsync("/api/auth/me"));

        // Derselbe Code funktioniert kein zweites Mal
        var reuse = await _factory.CreateClient().PostAsJsonAsync("/api/auth/recover", new { username = name, code, newPassword = "another-password-1" });
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, reuse);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.Token);
        var me = await HttpAssert.JsonAsync<MeResponse>(HttpStatusCode.OK, await client.GetAsync("/api/auth/me"));
        Assert.Equal(9, me.RecoveryCodesRemaining);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Wrong_code_or_unknown_user_gives_the_same_answer(bool existingUser)
    {
        var name = NewName();
        if (existingUser) await RegisterAsync(name);
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/recover", new { username = name, code = "AAAAA-BBBBB", newPassword = NewPassword });
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, response);
        Assert.Contains("Username or recovery code is invalid", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Regenerating_codes_requires_the_password_and_invalidates_old_codes()
    {
        var name = NewName();
        var (registered, client) = await RegisterAsync(name);

        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, await client.PostAsJsonAsync("/api/auth/recovery-codes", new { password = "wrong-password" }));
        var fresh = await HttpAssert.JsonAsync<RecoveryCodesResponse>(HttpStatusCode.OK,
            await client.PostAsJsonAsync("/api/auth/recovery-codes", new { password = Password }));
        Assert.Equal(10, fresh.Codes.Length);

        var old = await _factory.CreateClient().PostAsJsonAsync("/api/auth/recover", new { username = name, code = registered.RecoveryCodes![0], newPassword = NewPassword });
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, old);
        var current = await _factory.CreateClient().PostAsJsonAsync("/api/auth/recover", new { username = name, code = fresh.Codes[0], newPassword = NewPassword });
        await HttpAssert.StatusAsync(HttpStatusCode.OK, current);
    }

    [Fact]
    public async Task Changing_the_password_needs_the_current_one_and_revokes_other_sessions()
    {
        var name = NewName();
        var (_, client) = await RegisterAsync(name);
        var otherDevice = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK, await LoginAsync(name, Password));

        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden,
            await client.PostAsJsonAsync("/api/auth/password", new { currentPassword = "nope-nope-nope", newPassword = NewPassword }));
        Assert.Contains("newPassword", await HttpAssert.ValidationFieldsAsync(
            await client.PostAsJsonAsync("/api/auth/password", new { currentPassword = Password, newPassword = "short" })));

        var changed = await HttpAssert.JsonAsync<TokenResponse>(HttpStatusCode.OK,
            await client.PostAsJsonAsync("/api/auth/password", new { currentPassword = Password, newPassword = NewPassword }));

        var other = _factory.CreateClient();
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherDevice.Token);
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await other.GetAsync("/api/auth/me"));

        var self = _factory.CreateClient();
        self.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", changed.Token);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await self.GetAsync("/api/auth/me"));
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await LoginAsync(name, NewPassword));
    }

    [Fact]
    public async Task Email_must_be_confirmed_before_it_can_be_used_for_a_reset()
    {
        var name = NewName();
        var email = $"{name}@example.com";
        var (_, client) = await RegisterAsync(name);

        await HttpAssert.StatusAsync(HttpStatusCode.Forbidden, await client.PutAsJsonAsync("/api/auth/email", new { email, password = "wrong-password" }));
        Assert.Contains("email", await HttpAssert.ValidationFieldsAsync(await client.PutAsJsonAsync("/api/auth/email", new { email = "not-an-email", password = Password })));
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, await client.PutAsJsonAsync("/api/auth/email", new { email = email.ToUpperInvariant(), password = Password }));

        var verify = _factory.Emails.Last(email, "verify");
        Assert.NotNull(verify);
        Assert.Contains(SprintLogApiFactory.PublicUrl, verify!.Value.Message.Text);

        // Noch nicht bestätigt -> kein Reset-Link
        var before = _factory.Emails.Sent.Count;
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, await _factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { login = name }));
        Assert.Equal(before, _factory.Emails.Sent.Count);

        await HttpAssert.StatusAsync(HttpStatusCode.OK, await _factory.CreateClient().PostAsJsonAsync("/api/auth/email/verify", new { token = verify.Value.Token }));
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, await _factory.CreateClient().PostAsJsonAsync("/api/auth/email/verify", new { token = verify.Value.Token }));

        var me = await HttpAssert.JsonAsync<MeResponse>(HttpStatusCode.OK, await client.GetAsync("/api/auth/me"));
        Assert.Equal(email, me.Email);
        Assert.True(me.EmailVerified);
    }

    [Fact]
    public async Task Reset_link_by_email_sets_a_new_password_once()
    {
        var name = NewName();
        var email = $"{name}@example.com";
        var (_, oldClient) = await RegisterAsync(name);
        await oldClient.PutAsJsonAsync("/api/auth/email", new { email, password = Password });
        await _factory.CreateClient().PostAsJsonAsync("/api/auth/email/verify", new { token = _factory.Emails.Last(email, "verify")!.Value.Token });

        // Per E-Mail-Adresse anfordern (Groß-/Kleinschreibung egal)
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, await _factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { login = email.ToUpperInvariant() }));
        var reset = _factory.Emails.Last(email, "reset");
        Assert.NotNull(reset);

        // Sofort ein zweiter Antrag -> Cooldown, keine weitere E-Mail
        var count = _factory.Emails.Sent.Count;
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, await _factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { login = name }));
        Assert.Equal(count, _factory.Emails.Sent.Count);

        var done = await _factory.CreateClient().PostAsJsonAsync("/api/auth/reset-password", new { token = reset!.Value.Token, newPassword = NewPassword });
        await HttpAssert.StatusAsync(HttpStatusCode.OK, done);
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await LoginAsync(name, NewPassword));
        await HttpAssert.StatusAsync(HttpStatusCode.Unauthorized, await oldClient.GetAsync("/api/auth/me"));

        var again = await _factory.CreateClient().PostAsJsonAsync("/api/auth/reset-password", new { token = reset.Value.Token, newPassword = "third-password-99" });
        await HttpAssert.StatusAsync(HttpStatusCode.BadRequest, again);
    }

    [Fact]
    public async Task Forgot_password_answers_the_same_for_unknown_accounts()
    {
        var before = _factory.Emails.Sent.Count;
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { login = "nobody-" + Guid.NewGuid().ToString("N")[..6] + "@example.com" });
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, response);
        Assert.Equal(before, _factory.Emails.Sent.Count);
    }

    [Fact]
    public async Task An_email_can_belong_to_one_account_only()
    {
        var email = $"s{Guid.NewGuid():N}"[..12] + "@example.com";
        var (_, first) = await RegisterAsync(NewName());
        var (_, second) = await RegisterAsync(NewName());
        await HttpAssert.StatusAsync(HttpStatusCode.Accepted, await first.PutAsJsonAsync("/api/auth/email", new { email, password = Password }));
        await HttpAssert.StatusAsync(HttpStatusCode.Conflict, await second.PutAsJsonAsync("/api/auth/email", new { email, password = Password }));
    }

    [Fact]
    public async Task Options_report_whether_email_reset_is_available()
    {
        var options = await HttpAssert.JsonAsync<AuthOptionsResponse>(HttpStatusCode.OK, await _factory.CreateClient().GetAsync("/api/auth/options"));
        Assert.True(options.EmailEnabled); // im Test: FakeEmailSender
    }
}
