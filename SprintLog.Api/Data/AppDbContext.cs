using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Models;

namespace SprintLog.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<Workout> Workouts => Set<Workout>();
    public DbSet<WorkoutSet> WorkoutSets => Set<WorkoutSet>();
    public DbSet<Favorite> Favorites => Set<Favorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.Property(u => u.Username).HasMaxLength(32);
            e.HasIndex(u => u.Username).IsUnique();
        });

        modelBuilder.Entity<Exercise>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(60);
            e.Property(x => x.Category).HasMaxLength(20);
            e.Property(x => x.MuscleGroup).HasMaxLength(30);
            e.Property(x => x.TrackingType).HasConversion<string>().HasMaxLength(20);

            // Eigene Übungen gehören einem Nutzer; Standard-Übungen haben UserId = NULL.
            e.HasOne(x => x.User)
                .WithMany(u => u.CustomExercises)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.UserId);

            e.HasData(SeedExercises);
        });

        modelBuilder.Entity<Favorite>(e =>
        {
            e.HasOne(f => f.User).WithMany(u => u.Favorites).HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(f => f.Exercise).WithMany().HasForeignKey(f => f.ExerciseId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(f => new { f.UserId, f.ExerciseId }).IsUnique();
        });

        modelBuilder.Entity<Workout>(e =>
        {
            e.Property(w => w.WorkoutType).HasMaxLength(20);
            e.HasOne(w => w.User).WithMany(u => u.Workouts).HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(w => new { w.UserId, w.Date });
            // Idempotenz: dieselbe Client-ID kann pro Nutzer nur einmal gespeichert werden.
            e.HasIndex(w => new { w.UserId, w.ClientId }).IsUnique();
        });

        modelBuilder.Entity<WorkoutSet>(e =>
        {
            e.HasOne(s => s.Workout).WithMany(w => w.Sets).HasForeignKey(s => s.WorkoutId).OnDelete(DeleteBehavior.Cascade);
            // Eine Übung, die in der Historie verwendet wird, darf nicht gelöscht werden -
            // sonst würden die Sätze still mitgelöscht (vorher: Cascade).
            e.HasOne(s => s.Exercise).WithMany(x => x.Sets).HasForeignKey(s => s.ExerciseId).OnDelete(DeleteBehavior.NoAction);
        });
    }

    private static Exercise Ex(int id, string name, string category, string muscleGroup, TrackingType trackingType = TrackingType.WeightReps) =>
        new() { Id = id, Name = name, Category = category, MuscleGroup = muscleGroup, TrackingType = trackingType };

    /// <summary>Standard-Übungskatalog. IDs sind fix, damit bestehende Daten gültig bleiben.</summary>
    internal static readonly Exercise[] SeedExercises =
    {
        Ex(1, "Bench Press", "Gym", "Chest"),
        Ex(2, "Leg Extensions", "Gym", "Legs"),
        Ex(3, "Leg Curls", "Gym", "Legs"),
        Ex(4, "Calf Raises", "Gym", "Legs"),
        Ex(5, "Hip Abduction", "Gym", "Legs"),
        Ex(6, "Hip Adduction", "Gym", "Legs"),
        Ex(7, "Leg Press", "Gym", "Legs"),
        Ex(8, "Cable Tricep Pushdown", "Gym", "Arms"),
        Ex(9, "Barbell Bicep Curl", "Gym", "Arms"),
        Ex(10, "Dumbbell Wrist Curl", "Gym", "Arms"),
        Ex(11, "Reverse Wrist Curl", "Gym", "Arms"),
        Ex(12, "Running / Sprints", "Football", "Cardio", TrackingType.DistanceTime),
        Ex(13, "Dumbbell Bicep Curl", "Gym", "Arms"),
        Ex(14, "Seated Cable Row", "Gym", "Back"),
        Ex(15, "Standing Dumbbell Curl", "Gym", "Arms"),
        Ex(16, "Dumbbell Skull Crusher", "Gym", "Arms"),
        Ex(17, "Pull-ups", "Gym", "Back"),
        Ex(18, "Chest Press Machine", "Gym", "Chest"),
        Ex(19, "Machine Lateral Raise", "Gym", "Shoulders"),
        Ex(20, "Dips", "Gym", "Chest"),
        Ex(21, "Seated Calf Raises", "Gym", "Legs"),
        Ex(22, "EZ-Bar Bicep Curl", "Gym", "Arms"),
        Ex(23, "Wide Grip Lat Pulldown", "Gym", "Back"),
        Ex(24, "Tricep Press Machine", "Gym", "Arms"),
        Ex(25, "Overhead Tricep Extension", "Gym", "Arms"),
        Ex(26, "Barbell Row", "Gym", "Back"),
        Ex(27, "Rear Delt Fly", "Gym", "Shoulders"),
        Ex(28, "Close Grip Lat Pulldown", "Gym", "Back"),
        Ex(29, "Trap Bar Deadlift", "Football", "Legs/Back"),
        Ex(30, "Dumbbell Bench Press", "Gym", "Chest"),
        Ex(31, "Bent-Over Row", "Gym", "Back"),
        Ex(32, "Med Ball Wall Throw", "Football", "Explosive"),
        Ex(33, "Bulgarian Split Squats", "Football", "Legs"),
        Ex(34, "Broad Jumps", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(35, "Barbell Squat", "Gym", "Legs"),
        Ex(36, "Single-Arm Dumbbell Row", "Gym", "Back"),
        Ex(37, "Dumbbell Squat", "Gym", "Legs"),
        Ex(38, "Dumbbell Bent-Over Row", "Gym", "Back"),
        Ex(39, "Glute Bridge", "Gym", "Legs"),
        Ex(40, "Dumbbell Shoulder Press", "Gym", "Shoulders"),
        Ex(41, "Static Lunges", "Gym", "Legs"),
        Ex(42, "Dumbbell Deadlift", "Gym", "Legs/Back"),
        Ex(43, "Hammer Curl", "Gym", "Arms"),
        Ex(44, "Lat Pulldown", "Gym", "Back"),
        Ex(45, "Chest-Supported Row", "Gym", "Back"),
        Ex(46, "Push-ups", "Gym", "Chest"),
        Ex(47, "Plank", "Gym", "Core", TrackingType.Duration),
        Ex(48, "Side Plank", "Gym", "Core", TrackingType.Duration),
        Ex(49, "Romanian Deadlift (RDL)", "Gym", "Legs"),
        Ex(50, "Nordic Hamstring Curls", "Gym", "Legs"),
        Ex(51, "Box Jumps", "Football", "Explosive"),
        Ex(52, "Depth Jumps", "Football", "Explosive"),
        Ex(53, "Russian Twists", "Gym", "Core"),
        Ex(54, "Cable Woodchoppers", "Gym", "Core"),
        Ex(55, "Hanging Leg Raises", "Gym", "Core"),
        Ex(56, "Agility Ladder", "Football", "Agility", TrackingType.Duration),
        Ex(57, "Cone Shuttle Drills", "Football", "Agility", TrackingType.DistanceTime),
        Ex(58, "Change of Direction (COD) Sprints", "Football", "Agility", TrackingType.DistanceTime),
        Ex(59, "Incline Barbell Bench Press", "Gym", "Chest"),
        Ex(60, "Incline Dumbbell Bench Press", "Gym", "Chest"),
        Ex(61, "Cable Crossover", "Gym", "Chest"),
        Ex(62, "Pec Deck Fly", "Gym", "Chest"),
        Ex(63, "Deadlift (Conventional)", "Gym", "Back/Legs"),
        Ex(64, "T-Bar Row", "Gym", "Back"),
        Ex(65, "Chin-ups", "Gym", "Back"),
        Ex(66, "Straight-Arm Pulldown", "Gym", "Back"),
        Ex(67, "Back Extension", "Gym", "Back"),
        Ex(68, "Military Press", "Gym", "Shoulders"),
        Ex(69, "Dumbbell Lateral Raise", "Gym", "Shoulders"),
        Ex(70, "Dumbbell Front Raise", "Gym", "Shoulders"),
        Ex(71, "Face Pulls", "Gym", "Shoulders"),
        Ex(72, "Dumbbell Shrugs", "Gym", "Shoulders"),
        Ex(73, "Front Squat", "Gym", "Legs"),
        Ex(74, "Hack Squat", "Gym", "Legs"),
        Ex(75, "Barbell Hip Thrust", "Gym", "Legs"),
        Ex(76, "Walking Lunges", "Gym", "Legs"),
        Ex(77, "Preacher Curl", "Gym", "Arms"),
        Ex(78, "Close-Grip Bench Press", "Gym", "Arms"),
        Ex(79, "Cable Crunches", "Gym", "Core"),
        Ex(80, "Ab Wheel Rollout", "Gym", "Core"),
        Ex(81, "Crunches", "Gym", "Core"),
        Ex(82, "Jump Rope", "Gym", "Cardio", TrackingType.Duration),
        Ex(83, "Rowing Machine", "Gym", "Cardio", TrackingType.DistanceTime),
        Ex(84, "Cycling (Stationary)", "Gym", "Cardio", TrackingType.DistanceTime),    };
}
