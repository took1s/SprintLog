namespace SprintLog.Api.Models;

public class Workout
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string Type { get; set; } = string.Empty; // "Gym" или "Football"
    
    // Связь: в одной тренировке содержится много подходов
    public List<WorkoutSet> Sets { get; set; } = new();
}