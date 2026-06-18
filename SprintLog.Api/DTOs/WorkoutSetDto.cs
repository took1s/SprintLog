namespace SprintLog.Api.DTOs;

public class WorkoutSetDto
{
    public int ExerciseId { get; set; }
    public double? Weight { get; set; }
    public int? Reps { get; set; }
    public double? Distance { get; set; }
    public double? Time { get; set; }
}

