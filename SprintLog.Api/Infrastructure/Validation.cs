namespace SprintLog.Api.Infrastructure;

/// <summary>
/// Kleiner Sammler für Validierungsfehler. Ergebnis wird als RFC-7807 ValidationProblem zurückgegeben,
/// z. B. { "errors": { "username": ["..."] } }.
/// </summary>
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> _errors = new(StringComparer.OrdinalIgnoreCase);

    public bool HasErrors => _errors.Count > 0;

    /// <summary>Gesammelte Fehler je Feld (z. B. für Tests und Logs).</summary>
    public IReadOnlyDictionary<string, List<string>> Errors => _errors;

    public ValidationErrors Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
        {
            list = new List<string>();
            _errors[field] = list;
        }
        list.Add(message);
        return this;
    }

    public ValidationErrors AddIf(bool condition, string field, string message) =>
        condition ? Add(field, message) : this;

    public IResult ToResult() =>
        Results.ValidationProblem(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
}
