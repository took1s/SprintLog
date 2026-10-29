namespace SprintLog.Api.Models;

/// <summary>
/// "Grabstein" einer gelöschten Einheit. Clients, die per Delta-Sync nur Änderungen abholen,
/// erfahren so, welche Einheiten sie aus ihrem lokalen Cache entfernen müssen.
/// </summary>
public class DeletedWorkout
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public int WorkoutId { get; set; }
    public DateTime DeletedAt { get; set; }
}
