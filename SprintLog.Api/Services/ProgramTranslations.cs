using System.Text.Json;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Übersetzungen der frei geschriebenen Texte eines Plans (Name, Tage, Hinweise) nach en/de/ru. Schlüssel ist der
/// Originaltext: wird ein Text geändert, passt der Schlüssel nicht mehr und die App zeigt den neuen Text, wie er ist.
/// </summary>
public static class ProgramTranslations
{
    public static readonly string[] Languages = ["en", "de", "ru"];
    public const int MaxTexts = 120;
    public const int MaxTextLength = 300;

    public static Dictionary<string, Dictionary<string, string>> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(json) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    public static string? Serialize(Dictionary<string, Dictionary<string, string>> map) => map.Count == 0 ? null : JsonSerializer.Serialize(map);

    /// <summary>Alle übersetzbaren Texte des Plans (ohne Duplikate, Reihenfolge wie im Plan).</summary>
    public static List<string> Texts(TrainingProgram p)
    {
        var all = new List<string?> { p.Name };
        foreach (var d in p.Days.OrderBy(d => d.Position))
        {
            all.Add(d.Name);
            all.Add(d.Notes);
            foreach (var x in d.Exercises.OrderBy(x => x.Position))
            {
                all.Add(x.Note);
                all.AddRange((x.WeekSteps ?? new()).Select(s => s.Note));
            }
        }
        return all.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!.Trim()).Where(s => s.Length <= MaxTextLength).Distinct().Take(MaxTexts).ToList();
    }

    /// <summary>Nach einer Änderung am Plan: Übersetzungen nicht mehr vorhandener Texte entfernen.</summary>
    public static string? Prune(string? json, TrainingProgram p)
    {
        var map = Parse(json);
        if (map.Count == 0) return null;
        var texts = Texts(p).ToHashSet();
        foreach (var key in map.Keys.Where(k => !texts.Contains(k)).ToList()) map.Remove(key);
        return Serialize(map);
    }

    /// <summary>Texte, denen noch mindestens eine Sprache fehlt.</summary>
    public static List<string> Missing(TrainingProgram p, Dictionary<string, Dictionary<string, string>> map) =>
        Texts(p).Where(t => !map.TryGetValue(t, out var tr) || Languages.Any(l => !tr.ContainsKey(l))).ToList();
}
