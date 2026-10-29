using System.Text.Json;
using SprintLog.Api.DTOs;

namespace SprintLog.Api.Services;

/// <summary>
/// Eingebaute Plan-Vorlagen aus <c>Data/program-templates.json</c> (eingebettete Ressource).
/// Eine Datei als Quelle für API, Mock-Backend und Tests. Übungs-IDs beziehen sich auf den Standard-Katalog
/// (AppDbContext.SeedExercises); jede Vorlage wird in den Tests mit <see cref="ProgramInput.Validate"/> geprüft.
/// </summary>
public static class ProgramTemplates
{
    public const string ResourceName = "SprintLog.Api.Data.program-templates.json";

    public static readonly IReadOnlyList<ProgramTemplate> All = Load();

    private static IReadOnlyList<ProgramTemplate> Load()
    {
        using var stream = typeof(ProgramTemplates).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} not found.");
        var templates = JsonSerializer.Deserialize<List<ProgramTemplate>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("Program templates are empty.");
        return templates;
    }

    public static ProgramTemplate? Find(string key) =>
        All.FirstOrDefault(t => string.Equals(t.Key, key, StringComparison.OrdinalIgnoreCase));
}
