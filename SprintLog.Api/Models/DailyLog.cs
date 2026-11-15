namespace SprintLog.Api.Models;

/// <summary>
/// Tageswerte des Körpers: Gewicht und Eiweiß (manuell) sowie Schlaf, Ruhepuls, HRV und Schritte (Apple Health).
/// Ein Eintrag je Nutzer und Tag; alle Werte optional.
/// </summary>
public class DailyLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateOnly Day { get; set; }
    public double? WeightKg { get; set; }
    public int? ProteinG { get; set; }
    public int? SleepMinutes { get; set; }
    public int? RestingHr { get; set; }
    public int? Hrv { get; set; }
    public int? Steps { get; set; }
    public DateTime UpdatedAt { get; set; }
}
