using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace SprintLog.Api.Services;

/// <summary>
/// Eine KI-Anfrage läuft pro Request-Id genau einmal. Bricht die Verbindung ab (iPhone sperrt, App im Hintergrund,
/// Funkloch) und der Client fragt mit derselben Id erneut, hängt er sich an die laufende Antwort an bzw. bekommt
/// die fertige - ohne zweite Abbuchung. Erfolgreiche Antworten bleiben 15 Minuten, Fehler gar nicht (neuer Versuch erlaubt).
/// </summary>
public sealed partial class AiRequests(TimeProvider time)
{
    public static readonly TimeSpan Keep = TimeSpan.FromMinutes(15);

    /// <summary>Wie lange die Arbeit höchstens läuft - unabhängig davon, ob der Client noch wartet.</summary>
    public static readonly TimeSpan WorkTimeout = TimeSpan.FromMinutes(5);

    private sealed record Entry(Lazy<Task<(IResult Result, bool Ok)>> Work, DateTimeOffset Created);
    private readonly ConcurrentDictionary<(int UserId, string Kind, string Id), Entry> _entries = new();

    [GeneratedRegex("^[A-Za-z0-9_-]{8,64}$")]
    private static partial Regex IdPattern();

    public static bool IsValidId(string? id) => id is null || IdPattern().IsMatch(id);

    /// <summary>Wie viele Anfragen gerade gemerkt sind (für Tests).</summary>
    public int Count => _entries.Count;

    public async Task<IResult> RunOnceAsync(int userId, string kind, string? requestId, Func<CancellationToken, Task<(IResult Result, bool Ok)>> work)
    {
        if (requestId is null)
        {
            using var solo = new CancellationTokenSource(WorkTimeout);
            return (await work(solo.Token)).Result;
        }
        Cleanup();
        var key = (userId, kind, requestId);
        var entry = _entries.GetOrAdd(key, _ => new Entry(new Lazy<Task<(IResult, bool)>>(() => RunDetached(work)), time.GetUtcNow()));
        try
        {
            var (result, ok) = await entry.Work.Value;
            if (!ok) Forget(key, entry); // Fehler: neuer Versuch soll neu rechnen
            return result;
        }
        catch
        {
            Forget(key, entry); // unerwartete Ausnahme ebenso nicht merken
            throw;
        }
    }

    private void Forget((int, string, string) key, Entry entry) =>
        _entries.TryRemove(new KeyValuePair<(int, string, string), Entry>(key, entry));

    private static async Task<(IResult, bool)> RunDetached(Func<CancellationToken, Task<(IResult Result, bool Ok)>> work)
    {
        // Nicht am Request hängen: der Client darf abbrechen, die (bezahlte) Antwort wird trotzdem fertig und gemerkt
        using var cts = new CancellationTokenSource(WorkTimeout);
        return await work(cts.Token);
    }

    private void Cleanup()
    {
        var limit = time.GetUtcNow() - Keep;
        foreach (var (key, entry) in _entries)
            if (entry.Created < limit && entry.Work.IsValueCreated && entry.Work.Value.IsCompleted) _entries.TryRemove(key, out _);
    }
}
