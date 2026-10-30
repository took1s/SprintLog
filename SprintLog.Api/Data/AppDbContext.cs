using Microsoft.EntityFrameworkCore;
using SprintLog.Api.DTOs;
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
    public DbSet<TrainingProgram> Programs => Set<TrainingProgram>();
    public DbSet<ProgramDay> ProgramDays => Set<ProgramDay>();
    public DbSet<ProgramExercise> ProgramExercises => Set<ProgramExercise>();
    public DbSet<DeletedWorkout> DeletedWorkouts => Set<DeletedWorkout>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<RecoveryCode> RecoveryCodes => Set<RecoveryCode>();
    public DbSet<AuthToken> AuthTokens => Set<AuthToken>();
    public DbSet<WellnessEntry> Wellness => Set<WellnessEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.Property(u => u.Username).HasMaxLength(32);
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Email).HasMaxLength(254);
            e.HasIndex(u => u.Email).IsUnique(); // NULL-Werte sind in PostgreSQL nicht "gleich" -> beliebig viele ohne E-Mail
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
            e.Property(w => w.Notes).HasMaxLength(CreateWorkoutRequest.MaxNotesLength);
            e.Property(w => w.Opponent).HasMaxLength(60);
            e.HasOne(w => w.User).WithMany(u => u.Workouts).HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(w => new { w.UserId, w.Date });
            // Delta-Sync: "alles seit X" pro Nutzer, stabil sortiert nach (UpdatedAt, Id).
            e.Property(w => w.UpdatedAt).HasDefaultValueSql("now()");
            e.HasIndex(w => new { w.UserId, w.UpdatedAt, w.Id });
            // Wird ein Plan(-tag) gelöscht, bleibt die Einheit erhalten - nur die Verknüpfung entfällt.
            e.HasOne(w => w.ProgramDay).WithMany().HasForeignKey(w => w.ProgramDayId).OnDelete(DeleteBehavior.SetNull);
            // Idempotenz: dieselbe Client-ID kann pro Nutzer nur einmal gespeichert werden.
            e.HasIndex(w => new { w.UserId, w.ClientId }).IsUnique();
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.Property(t => t.TokenHash).HasMaxLength(64);
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => new { t.UserId, t.FamilyId });
            e.HasOne<User>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RecoveryCode>(e =>
        {
            e.Property(c => c.CodeHash).HasMaxLength(64);
            e.HasIndex(c => new { c.UserId, c.CodeHash }).IsUnique();
            e.HasOne<User>().WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuthToken>(e =>
        {
            e.Property(t => t.Purpose).HasMaxLength(20);
            e.Property(t => t.TokenHash).HasMaxLength(64);
            e.Property(t => t.Email).HasMaxLength(254);
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => new { t.UserId, t.Purpose });
            e.HasOne<User>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WellnessEntry>(e =>
        {
            e.ToTable("Wellness", t =>
            {
                foreach (var column in new[] { "Sleep", "Energy", "Soreness", "Mood" })
                    t.HasCheckConstraint($"CK_Wellness_{column}", $"\"{column}\" BETWEEN 1 AND 5");
            });
            e.HasIndex(w => new { w.UserId, w.Date }).IsUnique();
            e.Property(w => w.Note).HasMaxLength(200);
            e.HasOne<User>().WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeletedWorkout>(e =>
        {
            e.HasIndex(d => new { d.UserId, d.DeletedAt });
            e.HasOne<User>().WithMany().HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TrainingProgram>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(60);
            e.Property(p => p.Goal).HasMaxLength(20);
            e.Property(p => p.TemplateKey).HasMaxLength(40);
            e.ToTable("Programs", t =>
            {
                t.HasCheckConstraint("CK_Programs_CycleWeeks", "\"CycleWeeks\" IS NULL OR \"CycleWeeks\" BETWEEN 1 AND 12");
                t.HasCheckConstraint("CK_Programs_DeloadEvery", "\"DeloadEvery\" IS NULL OR \"DeloadEvery\" BETWEEN 2 AND 12");
            });
            e.HasOne(p => p.User).WithMany(u => u.Programs).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.UserId, p.IsActive });
        });

        modelBuilder.Entity<ProgramDay>(e =>
        {
            e.Property(d => d.Name).HasMaxLength(40);
            e.Property(d => d.Notes).HasMaxLength(200);
            e.HasOne(d => d.Program).WithMany(p => p.Days).HasForeignKey(d => d.ProgramId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProgramExercise>(e =>
        {
            e.HasOne(x => x.Day).WithMany(d => d.Exercises).HasForeignKey(x => x.DayId).OnDelete(DeleteBehavior.Cascade);
            // Übungen, die in einem Plan stehen, dürfen nicht gelöscht werden (gleiches Prinzip wie bei der Historie).
            e.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.NoAction);
            e.Property(x => x.Note).HasMaxLength(120);
            // Wochen-Stufen als jsonb-Spalte: gehören fest zur Vorgabe, werden nie einzeln abgefragt.
            e.OwnsMany(x => x.WeekSteps, b =>
            {
                b.ToJson();
                b.Property(s => s.Note).HasMaxLength(80);
            });
        });

        modelBuilder.Entity<WorkoutSet>(e =>
        {
            e.HasOne(s => s.Workout).WithMany(w => w.Sets).HasForeignKey(s => s.WorkoutId).OnDelete(DeleteBehavior.Cascade);
            // Eine Übung, die in der Historie verwendet wird, darf nicht gelöscht werden -
            // sonst würden die Sätze still mitgelöscht (vorher: Cascade).
            e.HasOne(s => s.Exercise).WithMany(x => x.Sets).HasForeignKey(s => s.ExerciseId).OnDelete(DeleteBehavior.NoAction);
            e.Property(s => s.Note).HasMaxLength(200);
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
        Ex(84, "Cycling (Stationary)", "Gym", "Cardio", TrackingType.DistanceTime),

        // v5: Verletzungsprävention (FIFA 11+, Copenhagen), Feld-Kondition, Athletik, Körpergewicht
        Ex(85, "Copenhagen Adduction", "Football", "Legs"),
        Ex(86, "Single-Leg Balance", "Football", "Legs", TrackingType.Duration),
        Ex(87, "Interval Run", "Football", "Cardio", TrackingType.Duration),
        Ex(88, "Repeated Shuttle Sprints", "Football", "Agility", TrackingType.DistanceTime),
        Ex(89, "Flying Sprints", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(90, "Countermovement Jump", "Football", "Explosive"),
        Ex(91, "Lateral Bounds", "Football", "Explosive"),
        Ex(92, "A-Skips", "Football", "Agility", TrackingType.DistanceTime),
        Ex(93, "Tempo Runs", "Football", "Cardio", TrackingType.DistanceTime),
        Ex(94, "Inverted Row", "Gym", "Back"),
        Ex(95, "Hollow Body Hold", "Gym", "Core", TrackingType.Duration),
        Ex(96, "Pallof Press", "Gym", "Core"),
        Ex(97, "Single-Leg Romanian Deadlift", "Gym", "Legs"),
        Ex(98, "Step-ups", "Gym", "Legs"),
        Ex(99, "Kettlebell Swing", "Gym", "Back/Legs"),
        Ex(100, "Power Clean", "Gym", "Explosive"),
        Ex(101, "Push Press", "Gym", "Shoulders"),
        Ex(102, "Reverse Lunges", "Gym", "Legs"),
        Ex(103, "Lateral Lunge", "Gym", "Legs"),
        Ex(104, "Dead Bug", "Gym", "Core"),
        Ex(105, "Bodyweight Squat", "Gym", "Legs"),
        Ex(106, "Warm-up Jog", "Football", "Cardio", TrackingType.Duration),

        // v6: Geräte und Kabelzug, Cardio-Geräte
        Ex(107, "Smith Machine Squat", "Gym", "Legs"),
        Ex(108, "Smith Machine Bench Press", "Gym", "Chest"),
        Ex(109, "Shoulder Press Machine", "Gym", "Shoulders"),
        Ex(110, "Machine Row", "Gym", "Back"),
        Ex(111, "Assisted Pull-up Machine", "Gym", "Back"),
        Ex(112, "Assisted Dip Machine", "Gym", "Arms"),
        Ex(113, "Lying Leg Curl", "Gym", "Legs"),
        Ex(114, "Glute Kickback Machine", "Gym", "Legs"),
        Ex(115, "Hip Thrust Machine", "Gym", "Legs"),
        Ex(116, "Pendulum Squat", "Gym", "Legs"),
        Ex(117, "Machine Bicep Curl", "Gym", "Arms"),
        Ex(118, "Ab Crunch Machine", "Gym", "Core"),
        Ex(119, "Rotary Torso Machine", "Gym", "Core"),
        Ex(120, "Incline Chest Press Machine", "Gym", "Chest"),
        Ex(121, "Cable Lateral Raise", "Gym", "Shoulders"),
        Ex(122, "Cable Bicep Curl", "Gym", "Arms"),
        Ex(123, "Low-to-High Cable Fly", "Gym", "Chest"),
        Ex(124, "Standing Calf Raise Machine", "Gym", "Legs"),
        Ex(125, "Belt Squat", "Gym", "Legs"),
        Ex(126, "Cable Glute Kickback", "Gym", "Legs"),
        Ex(127, "Treadmill", "Gym", "Cardio", TrackingType.DistanceTime),
        Ex(128, "Stair Climber", "Gym", "Cardio", TrackingType.Duration),
        Ex(129, "Elliptical Trainer", "Gym", "Cardio", TrackingType.Duration),
        Ex(130, "Air Bike", "Gym", "Cardio", TrackingType.Duration),
        // v7: großer Katalog - Hammer Strength, Pullover, Kabel, Kettlebell, Bänder, Prävention, Feld, Mobilität
        Ex(131, "Decline Bench Press", "Gym", "Chest"),
        Ex(132, "Decline Dumbbell Press", "Gym", "Chest"),
        Ex(133, "Dumbbell Fly", "Gym", "Chest"),
        Ex(134, "Incline Dumbbell Fly", "Gym", "Chest"),
        Ex(135, "High-to-Low Cable Fly", "Gym", "Chest"),
        Ex(136, "Dumbbell Pullover", "Gym", "Chest"),
        Ex(137, "Pullover Machine", "Gym", "Back"),
        Ex(138, "Floor Press", "Gym", "Chest"),
        Ex(139, "Decline Push-ups", "Gym", "Chest"),
        Ex(140, "Diamond Push-ups", "Gym", "Arms"),
        Ex(141, "Hammer Strength Chest Press", "Gym", "Chest"),
        Ex(142, "Hammer Strength Incline Press", "Gym", "Chest"),
        Ex(143, "Landmine Press", "Gym", "Shoulders"),
        Ex(144, "Weighted Dips", "Gym", "Chest"),
        Ex(145, "Hammer Strength Iso-Row", "Gym", "Back"),
        Ex(146, "Hammer Strength High Row", "Gym", "Back"),
        Ex(147, "Hammer Strength Pulldown", "Gym", "Back"),
        Ex(148, "Single-Arm Lat Pulldown", "Gym", "Back"),
        Ex(149, "Neutral-Grip Pull-ups", "Gym", "Back"),
        Ex(150, "Weighted Pull-ups", "Gym", "Back"),
        Ex(151, "Pendlay Row", "Gym", "Back"),
        Ex(152, "Seal Row", "Gym", "Back"),
        Ex(153, "Meadows Row", "Gym", "Back"),
        Ex(154, "Rack Pull", "Gym", "Back"),
        Ex(155, "Sumo Deadlift", "Gym", "Legs/Back"),
        Ex(156, "Good Morning", "Gym", "Legs/Back"),
        Ex(157, "Reverse Hyperextension", "Gym", "Back"),
        Ex(158, "Barbell Shrugs", "Gym", "Back"),
        Ex(159, "Superman", "Gym", "Back"),
        Ex(160, "Arnold Press", "Gym", "Shoulders"),
        Ex(161, "Upright Row", "Gym", "Shoulders"),
        Ex(162, "Reverse Pec Deck", "Gym", "Shoulders"),
        Ex(163, "Cable Rear Delt Fly", "Gym", "Shoulders"),
        Ex(164, "Cable Front Raise", "Gym", "Shoulders"),
        Ex(165, "Plate Front Raise", "Gym", "Shoulders"),
        Ex(166, "Y-Raise", "Gym", "Shoulders"),
        Ex(167, "Smith Machine Shoulder Press", "Gym", "Shoulders"),
        Ex(168, "Handstand Push-ups", "Gym", "Shoulders"),
        Ex(169, "Concentration Curl", "Gym", "Arms"),
        Ex(170, "Incline Dumbbell Curl", "Gym", "Arms"),
        Ex(171, "Spider Curl", "Gym", "Arms"),
        Ex(172, "Rope Hammer Curl", "Gym", "Arms"),
        Ex(173, "Reverse Curl", "Gym", "Arms"),
        Ex(174, "Bayesian Cable Curl", "Gym", "Arms"),
        Ex(175, "Preacher Curl Machine", "Gym", "Arms"),
        Ex(176, "Rope Pushdown", "Gym", "Arms"),
        Ex(177, "Overhead Cable Extension", "Gym", "Arms"),
        Ex(178, "Single-Arm Cable Pushdown", "Gym", "Arms"),
        Ex(179, "EZ-Bar Skull Crusher", "Gym", "Arms"),
        Ex(180, "Dumbbell Kickback", "Gym", "Arms"),
        Ex(181, "Bench Dips", "Gym", "Arms"),
        Ex(182, "Seated Dip Machine", "Gym", "Arms"),
        Ex(183, "Wrist Roller", "Gym", "Arms"),
        Ex(184, "Goblet Squat", "Gym", "Legs"),
        Ex(185, "Box Squat", "Gym", "Legs"),
        Ex(186, "Pause Squat", "Gym", "Legs"),
        Ex(187, "Safety Bar Squat", "Gym", "Legs"),
        Ex(188, "Sissy Squat", "Gym", "Legs"),
        Ex(189, "Single-Leg Leg Press", "Gym", "Legs"),
        Ex(190, "Seated Leg Curl", "Gym", "Legs"),
        Ex(191, "Single-Leg Leg Extension", "Gym", "Legs"),
        Ex(192, "Single-Leg Hip Thrust", "Gym", "Legs"),
        Ex(193, "Cable Pull-Through", "Gym", "Legs"),
        Ex(194, "Stiff-Leg Deadlift", "Gym", "Legs/Back"),
        Ex(195, "Dumbbell Romanian Deadlift", "Gym", "Legs/Back"),
        Ex(196, "Leg Press Calf Raise", "Gym", "Legs"),
        Ex(197, "Tibialis Raise", "Gym", "Legs"),
        Ex(198, "Reverse Nordic", "Football", "Legs"),
        Ex(199, "Spanish Squat", "Football", "Legs", TrackingType.Duration),
        Ex(200, "Wall Sit", "Gym", "Legs", TrackingType.Duration),
        Ex(201, "Single-Leg Calf Raise", "Gym", "Legs"),
        Ex(202, "Cable Hip Abduction", "Gym", "Legs"),
        Ex(203, "Smith Machine Split Squat", "Gym", "Legs"),
        Ex(204, "Glute Ham Raise", "Gym", "Legs"),
        Ex(205, "Decline Sit-ups", "Gym", "Core"),
        Ex(206, "Bicycle Crunch", "Gym", "Core"),
        Ex(207, "V-Ups", "Gym", "Core"),
        Ex(208, "Toes-to-Bar", "Gym", "Core"),
        Ex(209, "Captain's Chair Knee Raise", "Gym", "Core"),
        Ex(210, "Lying Leg Raise", "Gym", "Core"),
        Ex(211, "Mountain Climbers", "Gym", "Core", TrackingType.Duration),
        Ex(212, "Bird Dog", "Gym", "Core"),
        Ex(213, "Landmine Rotation", "Gym", "Core"),
        Ex(214, "Turkish Get-up", "Gym", "Core"),
        Ex(215, "Hang Power Clean", "Gym", "Explosive"),
        Ex(216, "Jump Squat", "Gym", "Explosive"),
        Ex(217, "Trap Bar Jump", "Gym", "Explosive"),
        Ex(218, "Med Ball Slam", "Gym", "Explosive"),
        Ex(219, "Rotational Med Ball Throw", "Gym", "Explosive"),
        Ex(220, "Hurdle Hops", "Football", "Explosive"),
        Ex(221, "Pogo Jumps", "Football", "Explosive"),
        Ex(222, "Kettlebell Clean & Press", "Gym", "Shoulders"),
        Ex(223, "Kettlebell Snatch", "Gym", "Explosive"),
        Ex(224, "Burpees", "Gym", "Cardio"),
        Ex(225, "Band Pull-Apart", "Gym", "Shoulders"),
        Ex(226, "Band External Rotation", "Gym", "Shoulders"),
        Ex(227, "Banded Lateral Walk", "Football", "Legs"),
        Ex(228, "Hill Sprints", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(229, "Sled Push", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(230, "Resisted Sprints", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(231, "Acceleration Sprints", "Football", "Explosive", TrackingType.DistanceTime),
        Ex(232, "Yo-Yo Intermittent Recovery Test", "Football", "Cardio", TrackingType.DistanceTime),
        Ex(233, "Box-to-Box Runs", "Football", "Cardio", TrackingType.DistanceTime),
        Ex(234, "Fartlek", "Football", "Cardio", TrackingType.Duration),
        Ex(235, "Easy Run (Zone 2)", "Football", "Cardio", TrackingType.DistanceTime),
        Ex(236, "Small-Sided Game", "Football", "Agility", TrackingType.Duration),
        Ex(237, "Rondo", "Football", "Agility", TrackingType.Duration),
        Ex(238, "Passing Drill", "Football", "Agility", TrackingType.Duration),
        Ex(239, "Dribbling Drill", "Football", "Agility", TrackingType.Duration),
        Ex(240, "Finishing (Shooting)", "Football", "Agility", TrackingType.Duration),
        Ex(241, "Ball Juggling", "Football", "Agility", TrackingType.Duration),
        Ex(242, "Hip 90/90 Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(243, "Couch Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(244, "World's Greatest Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(245, "Hamstring Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(246, "Hip Flexor Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(247, "Adductor Stretch", "Football", "Mobility", TrackingType.Duration),
        Ex(248, "Ankle Mobility", "Football", "Mobility", TrackingType.Duration),
        Ex(249, "Thoracic Rotation", "Football", "Mobility", TrackingType.Duration),
        Ex(250, "Cat-Cow", "Football", "Mobility", TrackingType.Duration),
        Ex(251, "Leg Swings", "Football", "Mobility", TrackingType.Duration),
        Ex(252, "Foam Rolling", "Football", "Mobility", TrackingType.Duration),
        Ex(253, "Incline Treadmill Walk", "Gym", "Cardio", TrackingType.Duration),
        Ex(254, "SkiErg", "Gym", "Cardio", TrackingType.Duration),
        Ex(255, "Battle Ropes", "Gym", "Cardio", TrackingType.Duration),
        Ex(256, "Swimming", "Gym", "Cardio", TrackingType.Duration),
        Ex(257, "Jumping Jacks", "Gym", "Cardio", TrackingType.Duration),
    };
}
