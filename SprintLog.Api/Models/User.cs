namespace SprintLog.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Optionale E-Mail (kleingeschrieben) - nur für das Zurücksetzen des Passworts.</summary>
    public string? Email { get; set; }
    public DateTime? EmailVerifiedAt { get; set; }

    /// <summary>
    /// Wird bei Passwortwechsel, Zurücksetzen oder "Überall abmelden" erhöht.
    /// Access-Tokens tragen die Version als Claim "ver" -> ältere Tokens werden sofort abgelehnt.
    /// </summary>
    public int TokenVersion { get; set; }

    public List<Workout> Workouts { get; set; } = new();
    public List<Favorite> Favorites { get; set; } = new();
    public List<Exercise> CustomExercises { get; set; } = new();
    public List<TrainingProgram> Programs { get; set; } = new();
}
