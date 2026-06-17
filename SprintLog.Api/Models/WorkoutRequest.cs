namespace SprintLog.Api.Models;

// Это "конверты" для данных, которые придут с твоего фронтенда
public record WorkoutRequest(string WorkoutType, List<SetRequest> Sets);
public record SetRequest(int ExerciseId, double? Weight, int? Reps, double? Distance, double? Time);