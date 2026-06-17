namespace SprintLog.Api.Models;

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // "Gym" или "Football"
    public string? MuscleGroup { get; set; } // Для футбола может быть null
    
    // Связь: у одного упражнения может быть много подходов
    public List<WorkoutSet> Sets { get; set; } = new();
}