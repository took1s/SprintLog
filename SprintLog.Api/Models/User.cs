namespace SprintLog.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Workout> Workouts { get; set; } = new();
    public List<Favorite> Favorites { get; set; } = new();
    public List<Exercise> CustomExercises { get; set; } = new();
    public List<TrainingProgram> Programs { get; set; } = new();
}
