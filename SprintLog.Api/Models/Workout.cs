namespace SprintLog.Api.Models;

public class Workout
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow; // Автоматически ставим время сервера
    public string WorkoutType { get; set; } = string.Empty; // Gym или Football
    
    // --- НОВЫЕ ПОЛЯ ДЛЯ ИЗОЛЯЦИИ ДАННЫХ ---
    public int UserId { get; set; } // Внешний ключ
    public User User { get; set; } = null!; // Навигационное свойство
    
    // Связь 1-ко-многим: одна тренировка содержит список подходов
    public List<WorkoutSet> Sets { get; set; } = new();
}