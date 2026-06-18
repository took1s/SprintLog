namespace SprintLog.Api.DTOs;

public class CreateWorkoutRequest
{
    public string WorkoutType { get; set; } = string.Empty;
    public List<WorkoutSetDto> Sets { get; set; } = new();
}

