namespace SprintLog.Api.Models;

public class Favorite
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty; // Привязка к пользователю
    public int ExerciseId { get; set; }
}