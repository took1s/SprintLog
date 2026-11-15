namespace SprintLog.Api.Services;

/// <summary>
/// Tag relativ zum Spiel (Match-Day-Periodisierung): MD = Spieltag, MD+1/MD+2 danach (Regeneration), MD-4 ... MD-1 davor
/// (Kraft, Umfang, Schnelligkeit, Aktivierung). Bei zwei Spielen pro Woche: MD+1 vor MD-1 vor MD+2.
/// Gleiche Regeln wie im Client (frontend/src/lib/matchDay.ts).
/// </summary>
public static class MatchDay
{
    private static int Bit(DateOnly d) => 1 << (((int)d.DayOfWeek + 6) % 7);

    /// <summary>"MD", "MD+1", "MD-3" ... oder null (kein Spiel in der Nähe / keine Spieltage).</summary>
    public static string? Label(DateOnly day, int matchDays)
    {
        if (matchDays == 0) return null;
        if ((matchDays & Bit(day)) != 0) return "MD";
        // Reihenfolge bei zwei Spielen pro Woche: MD+1 (Regeneration) > MD-1 (Aktivierung) > MD+2 > MD-2 ... MD-4
        if ((matchDays & Bit(day.AddDays(-1))) != 0) return "MD+1";
        if ((matchDays & Bit(day.AddDays(1))) != 0) return "MD-1";
        if ((matchDays & Bit(day.AddDays(-2))) != 0) return "MD+2";
        for (var k = 2; k <= 4; k++) if ((matchDays & Bit(day.AddDays(k))) != 0) return $"MD-{k}";
        return null;
    }

    /// <summary>Schwerpunkt und Belastung für den Prompt.</summary>
    public static string Focus(string label) => label switch
    {
        "MD" => "match",
        "MD+1" => "recovery, very low load (starters); substitutes compensate",
        "MD+2" => "rest or light",
        "MD-1" => "activation: short sprints, reactions, set pieces - low volume, no heavy lower-body strength",
        "MD-2" => "speed and agility, moderate volume",
        "MD-3" => "endurance / large spaces, highest volume of the week",
        "MD-4" => "strength and power, high intensity",
        _ => "normal",
    };
}
