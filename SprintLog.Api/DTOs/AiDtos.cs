using System.Text.Json.Nodes;
using SprintLog.Api.Infrastructure;

namespace SprintLog.Api.DTOs;

public record AiStatusResponse(bool Enabled, int Remaining, int DailyLimit, IReadOnlyDictionary<string, int> Costs);

public record AiChatMessage(string? Role, string? Content);

/// <summary>
/// Frage an den Coach. <c>Context</c> ist eine kompakte Zusammenfassung der eigenen Trainingsdaten, die der Client
/// (offline-first, kennt Erholung/Wochenplan/Belastung) erstellt - der Server reicht sie nur als Daten weiter.
/// </summary>
/// <param name="Mode">"quick" (schnelles Modell) oder "deep" (gründliches Modell, mehr Werkzeug-Schritte).</param>
/// <param name="Session">Laufende Einheit als kompaktes JSON (Übungen, erledigte Sätze, Vorgaben, Notizen, Studio) - nur während des Trainings.</param>
public record AiAskInput(string? Question, string? Context, List<AiChatMessage>? History, string? Locale, string? Mode = null, string? Session = null)
{
    public const int MaxQuestion = 1000;
    public const int MaxContext = 12_000;
    public const int MaxSession = 8_000;
    public const int MaxHistory = 10;
    public const int MaxHistoryMessage = 2_000;

    public ValidationErrors Validate()
    {
        var q = Question?.Trim() ?? string.Empty;
        var errors = new ValidationErrors()
            .AddIf(q.Length is < 2 or > MaxQuestion, "question", $"Question must be 2-{MaxQuestion} characters.")
            .AddIf(Context is { Length: > MaxContext }, "context", $"Context must not exceed {MaxContext} characters.")
            .AddIf(History is { Count: > MaxHistory }, "history", $"At most {MaxHistory} previous messages.")
            .AddIf(Mode is not (null or "quick" or "deep"), "mode", "Mode must be quick or deep.")
            .AddIf(Session is { Length: > MaxSession }, "session", $"Session must not exceed {MaxSession} characters.");
        if (History is not null)
            for (var i = 0; i < History.Count && i < MaxHistory; i++)
                errors
                    .AddIf(History[i].Role is not ("user" or "assistant"), $"history[{i}]", "Role must be user or assistant.")
                    .AddIf(string.IsNullOrWhiteSpace(History[i].Content) || History[i].Content!.Length > MaxHistoryMessage, $"history[{i}]", $"Message must be 1-{MaxHistoryMessage} characters.");
        return errors;
    }
}

/// <param name="Actions">Vorschläge als Karten: { type: program | goal | schedule, ... } - erst der Nutzer speichert.</param>
/// <param name="Memory">Was sich der Coach dabei gemerkt / aktualisiert / vergessen hat (Hinweis mit "Rückgängig").</param>
public record AiAskResponse(string Answer, int Remaining, List<JsonObject> Actions, List<MemoryChangeDto>? Memory = null);

public record AiPlanAnswers(string? Focus, int DaysPerWeek, int? MatchDay, string? Level);

/// <summary>Plan von der KI: Antworten aus "Plan für mich" + freie Hinweise (Verletzung, Geräte, Zeit).</summary>
public record AiPlanInput(AiPlanAnswers? Answers, string? Notes, string? Context, string? Locale)
{
    public const int MaxNotes = 600;
    public static readonly string[] Focuses = { "football", "speed", "strength", "muscle", "rehab" };
    public static readonly string[] Levels = { "Beginner", "Intermediate", "Advanced" };

    public ValidationErrors Validate() => new ValidationErrors()
        .AddIf(Answers is null, "answers", "Answers are required.")
        .AddIf(Answers is not null && !Focuses.Contains(Answers.Focus), "answers.focus", "Unknown focus.")
        .AddIf(Answers is not null && !Levels.Contains(Answers.Level), "answers.level", "Unknown level.")
        .AddIf(Answers is { DaysPerWeek: < 1 or > 6 }, "answers.daysPerWeek", "Days per week must be 1-6.")
        .AddIf(Answers is { MatchDay: < 0 or > 6 }, "answers.matchDay", "Match day must be 0-6.")
        .AddIf(Notes is { Length: > MaxNotes }, "notes", $"Notes must not exceed {MaxNotes} characters.")
        .AddIf(Context is { Length: > AiAskInput.MaxContext }, "context", $"Context must not exceed {AiAskInput.MaxContext} characters.");
}

/// <summary>Vorschlag zum Ansehen - gespeichert wird erst, wenn der Nutzer ihn übernimmt (normales POST /api/programs).</summary>
public record AiPlanResponse(ProgramInput Program, string Summary, int Remaining);

/// <summary>Analyse-Bericht: "full" (8-12 Wochen) oder "week" (Wochenbilanz).</summary>
public record AiAnalysisInput(string? Context, string? Locale, string? Period = null)
{
    public ValidationErrors Validate() => new ValidationErrors()
        .AddIf(Period is not (null or "full" or "week"), "period", "Period must be full or week.")
        .AddIf(Context is { Length: > AiAskInput.MaxContext }, "context", $"Context must not exceed {AiAskInput.MaxContext} characters.");
}

/// <summary>Bericht im Format von submit_report (headline, summary, sections, recommendations, nextWeekFocus).</summary>
public record AiAnalysisResponse(JsonObject Report, DateTime GeneratedAt, int Remaining);
