using System.Net;
using System.Net.Http.Json;
using SprintLog.Api.DTOs;
using SprintLog.Api.Services;

namespace SprintLog.Api.Tests;

/// <summary>Routinen (Dehnen, Reha): Upsert per Client-Id (idempotent), Validierung, Isolation, Löschen, KI-Vorschlag und Prompt.</summary>
[Collection(ApiCollection.Name)]
public class RoutineTests
{
    private readonly SprintLogApiFactory _factory;

    public RoutineTests(SprintLogApiFactory factory)
    {
        _factory = factory;
        _factory.Ai.Reset();
    }

    private static string Today => DateTime.UtcNow.ToString("yyyy-MM-dd");
    private static string InDays(int d) => DateTime.UtcNow.AddDays(d).ToString("yyyy-MM-dd");

    private static object Rehab(object? done = null, string title = "Reha Oberschenkel") => new
    {
        title, kind = "rehab", days = 127, startDate = Today, endDate = InDays(21), reason = "Zerrung links, Physio-Freigabe",
        steps = new object[] { new { name = "Nordic Curls", dose = "2 x 5", exerciseId = Seed.Nordic }, new { name = "Brücke isometrisch", dose = "3 x 30 s", exerciseId = 999_999 } },
        doneDates = done,
    };

    private static async Task<List<RoutineResponse>> AllAsync(TestUser user) =>
        await HttpAssert.JsonAsync<List<RoutineResponse>>(HttpStatusCode.OK, await user.Client.GetAsync("/api/routines"));

    [Fact]
    public async Task Put_creates_then_updates_the_same_routine()
    {
        var user = await _factory.CreateUserAsync();
        var created = await HttpAssert.JsonAsync<RoutineResponse>(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/routines/rt-abc12345", Rehab()));
        Assert.Equal("rehab", created.Kind);
        Assert.Equal("user", created.Source);
        Assert.Equal(Seed.Nordic, created.Steps[0].ExerciseId);
        Assert.Null(created.Steps[1].ExerciseId); // unbekannte Übung -> nur Text

        // Wiederholtes PUT (Offline-Queue) + Haken für heute: überschreibt statt zu duplizieren
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/routines/rt-abc12345", Rehab(new[] { Today, Today }, "Reha OS links")));
        var r = Assert.Single(await AllAsync(user));
        Assert.Equal("Reha OS links", r.Title);
        Assert.Equal(new[] { DateOnly.Parse(Today) }, r.DoneDates);
    }

    [Fact]
    public async Task Invalid_values_are_rejected_with_field_errors()
    {
        var user = await _factory.CreateUserAsync();
        var res = await user.Client.PutAsJsonAsync("/api/routines/rt-bad12345", new
        {
            title = "", kind = "yoga", days = 0, startDate = Today, endDate = InDays(-3), reason = new string('x', 301),
            steps = Array.Empty<object>(), doneDates = new[] { InDays(5) },
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var fields = await HttpAssert.ValidationFieldsAsync(res);
        foreach (var f in new[] { "title", "kind", "days", "endDate", "reason", "steps", "doneDates" }) Assert.Contains(f, fields);

        var badId = await user.Client.PutAsJsonAsync("/api/routines/x", Rehab());
        Assert.Equal(HttpStatusCode.BadRequest, badId.StatusCode);
    }

    [Fact]
    public async Task Routines_are_private_and_delete_is_idempotent()
    {
        var a = await _factory.CreateUserAsync();
        var b = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await a.Client.PutAsJsonAsync("/api/routines/rt-shared01", Rehab()));
        // Gleiche Client-Id bei einem anderen Nutzer: eigene Routine, keine Überschneidung
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await b.Client.PutAsJsonAsync("/api/routines/rt-shared01", Rehab(title: "Von B")));
        Assert.Equal("Reha Oberschenkel", Assert.Single(await AllAsync(a)).Title);

        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await b.Client.DeleteAsync("/api/routines/rt-shared01"));
        await HttpAssert.StatusAsync(HttpStatusCode.NoContent, await b.Client.DeleteAsync("/api/routines/rt-shared01"));
        Assert.Empty(await AllAsync(b));
        Assert.Single(await AllAsync(a));
    }

    [Fact]
    public async Task Coach_sees_routines_with_adherence_and_proposes_a_sanitized_card()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/routines/rt-rehab001", Rehab(new[] { Today })));

        _factory.Ai.Reply = (req, n) =>
        {
            if (n > 0) return AiResponse.FromText("Hier deine Dehnroutine bis Monatsende.");
            Assert.Contains("<routines", req.System);
            Assert.Contains("id rt-rehab001 | Reha Oberschenkel | rehab | active | daily", req.System);
            Assert.Contains("done 1/1 scheduled days", req.System);
            Assert.Contains(req.Tools!, t => t.Name == AiTools.ProposeRoutine);
            return AiResponse.FromTool(AiTools.ProposeRoutine, new
            {
                title = "Dehnen nach dem Training - Hüftbeuger, Adduktoren, Waden", kind = "mobility", days = new[] { 0, 2, 4, 9 },
                endDate = InDays(20), reason = "Hüfte steif nach Sprints",
                steps = new object[] { new { name = "Hüftbeuger-Dehnung", dose = "2 x 45 s je Seite" }, new { exerciseId = Seed.Plank }, new { name = "" } },
            });
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Gib mir eine Dehnroutine bis Monatsende" }));
        var card = Assert.Single(res.Actions);
        Assert.Equal("routine", (string?)card["type"]);
        var r = card["routine"]!;
        Assert.Equal(40, ((string)r["title"]!).Length);           // gekürzt
        Assert.Equal(0b10101, (int)r["days"]!);                  // Mo, Mi, Fr; 9 verworfen
        Assert.Equal(Today, (string?)r["startDate"]);
        Assert.Equal(2, r["steps"]!.AsArray().Count);             // leerer Schritt raus
        Assert.Equal("Plank", (string?)r["steps"]![1]!["name"]);  // Name aus dem Katalog
        Assert.Null(card["replacesId"]);
    }

    [Fact]
    public async Task Coach_can_end_an_existing_routine_but_not_invent_one()
    {
        var user = await _factory.CreateUserAsync();
        await HttpAssert.StatusAsync(HttpStatusCode.OK, await user.Client.PutAsJsonAsync("/api/routines/rt-rehab002", Rehab()));
        string? toolResult = null;
        _factory.Ai.Reply = (req, n) => n switch
        {
            0 => AiResponse.FromTool(AiTools.ProposeRoutine, new { title = "X", kind = "rehab", days = new[] { 1 }, steps = new[] { new { name = "a" } }, replacesId = "rt-unknown1" }),
            1 => AiResponse.FromTool(AiTools.ProposeRoutine, new { title = "Reha Oberschenkel", kind = "rehab", days = new[] { 0, 1, 2, 3, 4, 5, 6 }, endDate = Today,
                reason = "Beschwerdefrei", steps = new[] { new { name = "Nordic Curls", dose = "2 x 5" } }, replacesId = "rt-rehab002" }, "toolu_2"),
            _ => AiResponse.FromText((toolResult = req.Messages.ToJsonString()) is null ? "" : "Routine beendet."),
        };
        var res = await HttpAssert.JsonAsync<AiAskResponse>(HttpStatusCode.OK,
            await user.Client.PostAsJsonAsync("/api/ai/ask", new { question = "Bein ist wieder gut" }));
        Assert.Contains("not found", toolResult);
        var card = Assert.Single(res.Actions);
        Assert.Equal("rt-rehab002", (string?)card["replacesId"]);
        Assert.Equal(127, (int)card["routine"]!["days"]!);
        Assert.Equal(Today, (string?)card["routine"]!["startDate"]); // Beginn der bestehenden Routine
        Assert.Equal(Today, (string?)card["routine"]!["endDate"]);
    }
}
