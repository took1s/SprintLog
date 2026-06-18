namespace SprintLog.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    
    // Опционально, но полезно: список тренировок этого пользователя
    public List<Workout> Workouts { get; set; } = new();
}