namespace SprintLog.Api.Tests;

/// <summary>IDs aus dem Standard-Katalog (siehe AppDbContext.SeedExercises).</summary>
public static class Seed
{
    public const int BenchPress = 1;
    public const int Sprints = 12;
    public const int Plank = 47;
}

public static class Payloads
{
    public static object Workout(Guid? clientId = null, DateTimeOffset? date = null, string type = "Hybrid") => new
    {
        workoutType = type,
        clientId,
        date,
        durationSeconds = 3600,
        sets = new object[]
        {
            new { exerciseId = Seed.BenchPress, weight = 80.0, reps = 8 },
            new { exerciseId = Seed.BenchPress, weight = 85.0, reps = 6 },
            new { exerciseId = Seed.Sprints, distance = 30.0, time = 4.2 }
        }
    };
}
