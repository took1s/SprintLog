namespace SprintLog.Api.Models;

public class WorkoutSet
{
    public int Id { get; set; }
    public int SetNumber { get; set; } // Номер подхода (1, 2, 3...)

    // Метрики для зала
    public double? Weight { get; set; }
    public int? Reps { get; set; }

    // Метрики для футбольного поля
    public double? Distance { get; set; } // В метрах
    public double? Time { get; set; } // В секундах

    // Внешние ключи для связи таблиц
    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;

    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
}