using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>Frei geschriebene Plan-Texte (z. B. vom KI-Planer auf Russisch) werden nach en/de/ru übersetzt und am Plan gespeichert.</summary>
[Collection(ApiCollection.Name)]
public class ProgramTranslationTests
{
    private readonly SprintLogApiFactory _factory;

    public ProgramTranslationTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static object RussianPlan(string dayName = "Сила ног") => new
    {
        name = "Сила и скорость", goal = "Strength", weeks = 6,
        days = new object[]
        {
            new { name = dayName, notes = "Не накануне матча.", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5, note = "~80% 1RM" } } },
        },
    };

    private static string[] Indexed(AiRequest req) =>
        req.Messages[0]!["content"]!.GetValue<string>().Split('\n').Where(l => l.Length > 2 && char.IsDigit(l[0])).Select(l => l[(l.IndexOf(": ", StringComparison.Ordinal) + 2)..]).ToArray();

    [Fact]
    public async Task Translates_missing_texts_once_and_drops_translations_of_changed_texts()
    {
        var user = await _factory.CreateUserAsync();
        var plan = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", RussianPlan()));
        Assert.Null(plan.Translations);

        string[]? sent = null;
        _factory.Ai.Reply = (req, _) =>
        {
            Assert.Equal("submit_translations", (string?)req.ToolChoice?["name"]);
            sent = Indexed(req);
            return AiResponse.FromTool("submit_translations", new
            {
                items = sent.Select((text, i) => new { i, en = $"EN {text}", de = $"DE {text}", ru = text }).Append(new { i = 99, en = "x", de = "x", ru = "x" }).ToArray(),
            });
        };
        var res = await HttpAssert.JsonAsync<AiTranslateResponse>(HttpStatusCode.OK, await user.Client.PostAsJsonAsync($"/api/ai/translate-program/{plan.Id}", new { requestId = "tr-12345678" }));
        Assert.Equal(new[] { "Сила и скорость", "Сила ног", "Не накануне матча.", "~80% 1RM" }, sent);
        Assert.Equal("DE Сила ног", res.Program.Translations!["Сила ног"]["de"]);
        Assert.Equal(12 - 1, res.Remaining);

        // Schon alles übersetzt: kein KI-Aufruf, keine Kosten
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PostAsJsonAsync($"/api/ai/translate-program/{plan.Id}", new { requestId = "tr-87654321" }));
        Assert.Single(_factory.Ai.Requests);

        // Tag umbenannt: dessen alte Übersetzung fällt weg, der Rest bleibt
        var dayId = plan.Days[0].Id;
        var edited = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync($"/api/programs/{plan.Id}", new
        {
            name = "Сила и скорость", goal = "Strength", weeks = 6,
            days = new object[] { new { id = dayId, name = "Ноги тяжело", notes = "Не накануне матча.", exercises = new object[] { new { exerciseId = Seed.BenchPress, sets = 3, repsMin = 5, repsMax = 5, note = "~80% 1RM" } } } },
        }));
        Assert.False(edited.Translations!.ContainsKey("Сила ног"));
        Assert.True(edited.Translations.ContainsKey("Не накануне матча."));
    }

    [Fact]
    public async Task Failed_translation_is_refunded_and_other_users_plans_are_hidden()
    {
        var user = await _factory.CreateUserAsync();
        var other = await _factory.CreateUserAsync();
        var plan = await HttpAssert.JsonAsync<ProgramResponse>(HttpStatusCode.Created, await user.Client.PostAsJsonAsync("/api/programs", RussianPlan()));

        _factory.Ai.Reply = (_, _) => AiResponse.FromText("Sorry");
        var bad = await user.Client.PostAsJsonAsync($"/api/ai/translate-program/{plan.Id}", new { });
        Assert.Equal(HttpStatusCode.BadGateway, bad.StatusCode);
        var status = await HttpAssert.JsonAsync<AiStatusResponse>(HttpStatusCode.OK, await user.Client.GetAsync("/api/ai/status"));
        Assert.Equal(12, status.Remaining);

        await HttpAssert.StatusAsync(HttpStatusCode.NotFound, await other.Client.PostAsJsonAsync($"/api/ai/translate-program/{plan.Id}", new { }));
    }

    [Fact]
    public void Texts_and_prune_work_on_the_model()
    {
        var p = new SprintLog.Api.Models.TrainingProgram { Name = "A", Days = { new() { Name = "B", Notes = " ", Exercises = { new() { Note = "A" } } } } };
        Assert.Equal(new[] { "A", "B" }, ProgramTranslations.Texts(p));
        var json = JsonSerializer.Serialize(new Dictionary<string, Dictionary<string, string>> { ["A"] = new() { ["en"] = "a" }, ["Z"] = new() { ["en"] = "z" } });
        Assert.Equal(new[] { "A" }, ProgramTranslations.Parse(ProgramTranslations.Prune(json, p)).Keys);
        Assert.Empty(ProgramTranslations.Parse("not json"));
    }
}
