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

        // Встроенный механизм EF Core для стартовых данных
        modelBuilder.Entity<Exercise>().HasData(
            // Базовые упражнения
            new Exercise { Id = 1, Name = "Bench Press", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 2, Name = "Leg Extensions", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 3, Name = "Leg Curls", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 4, Name = "Calf Raises", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 5, Name = "Hip Abduction", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 6, Name = "Hip Adduction", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 7, Name = "Leg Press", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 8, Name = "Cable Tricep Pushdown", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 9, Name = "Barbell Bicep Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 10, Name = "Dumbbell Wrist Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 11, Name = "Reverse Wrist Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 12, Name = "Running / Sprints", Category = "Football", MuscleGroup = "Cardio" },
            new Exercise { Id = 13, Name = "Dumbbell Bicep Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 14, Name = "Seated Cable Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 15, Name = "Standing Dumbbell Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 16, Name = "Dumbbell Skull Crusher", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 17, Name = "Pull-ups", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 18, Name = "Chest Press Machine", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 19, Name = "Machine Lateral Raise", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 20, Name = "Dips", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 21, Name = "Seated Calf Raises", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 22, Name = "EZ-Bar Bicep Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 23, Name = "Wide Grip Lat Pulldown", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 24, Name = "Tricep Press Machine", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 25, Name = "Overhead Tricep Extension", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 26, Name = "Barbell Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 27, Name = "Rear Delt Fly", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 28, Name = "Close Grip Lat Pulldown", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 29, Name = "Trap Bar Deadlift", Category = "Football", MuscleGroup = "Legs/Back" },
            new Exercise { Id = 30, Name = "Dumbbell Bench Press", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 31, Name = "Bent-Over Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 32, Name = "Med Ball Wall Throw", Category = "Football", MuscleGroup = "Explosive" },
            new Exercise { Id = 33, Name = "Bulgarian Split Squats", Category = "Football", MuscleGroup = "Legs" },
            new Exercise { Id = 34, Name = "Broad Jumps", Category = "Football", MuscleGroup = "Explosive" },
            new Exercise { Id = 35, Name = "Barbell Squat", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 36, Name = "Single-Arm Dumbbell Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 37, Name = "Dumbbell Squat", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 38, Name = "Dumbbell Bent-Over Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 39, Name = "Glute Bridge", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 40, Name = "Dumbbell Shoulder Press", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 41, Name = "Static Lunges", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 42, Name = "Dumbbell Deadlift", Category = "Gym", MuscleGroup = "Legs/Back" },
            new Exercise { Id = 43, Name = "Hammer Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 44, Name = "Lat Pulldown", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 45, Name = "Chest-Supported Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 46, Name = "Push-ups", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 47, Name = "Plank", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 48, Name = "Side Plank", Category = "Gym", MuscleGroup = "Core" },
            
            // Специфика для поля и взрывной силы
            new Exercise { Id = 49, Name = "Romanian Deadlift (RDL)", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 50, Name = "Nordic Hamstring Curls", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 51, Name = "Box Jumps", Category = "Football", MuscleGroup = "Explosive" },
            new Exercise { Id = 52, Name = "Depth Jumps", Category = "Football", MuscleGroup = "Explosive" },
            new Exercise { Id = 53, Name = "Russian Twists", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 54, Name = "Cable Woodchoppers", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 55, Name = "Hanging Leg Raises", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 56, Name = "Agility Ladder", Category = "Football", MuscleGroup = "Agility" },
            new Exercise { Id = 57, Name = "Cone Shuttle Drills", Category = "Football", MuscleGroup = "Agility" },
            new Exercise { Id = 58, Name = "Change of Direction (COD) Sprints", Category = "Football", MuscleGroup = "Agility" },

            // Грудь (Верхняя и нижняя часть, изоляция)
            new Exercise { Id = 59, Name = "Incline Barbell Bench Press", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 60, Name = "Incline Dumbbell Bench Press", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 61, Name = "Cable Crossover", Category = "Gym", MuscleGroup = "Chest" },
            new Exercise { Id = 62, Name = "Pec Deck Fly", Category = "Gym", MuscleGroup = "Chest" },

            // Спина (Толщина и ширина)
            new Exercise { Id = 63, Name = "Deadlift (Conventional)", Category = "Gym", MuscleGroup = "Back/Legs" },
            new Exercise { Id = 64, Name = "T-Bar Row", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 65, Name = "Chin-ups", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 66, Name = "Straight-Arm Pulldown", Category = "Gym", MuscleGroup = "Back" },
            new Exercise { Id = 67, Name = "Back Extension", Category = "Gym", MuscleGroup = "Back" },

            // Плечи (Дельты и трапеции)
            new Exercise { Id = 68, Name = "Military Press", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 69, Name = "Dumbbell Lateral Raise", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 70, Name = "Dumbbell Front Raise", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 71, Name = "Face Pulls", Category = "Gym", MuscleGroup = "Shoulders" },
            new Exercise { Id = 72, Name = "Dumbbell Shrugs", Category = "Gym", MuscleGroup = "Shoulders" },

            // Ноги (Квадрицепсы и ягодичные)
            new Exercise { Id = 73, Name = "Front Squat", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 74, Name = "Hack Squat", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 75, Name = "Barbell Hip Thrust", Category = "Gym", MuscleGroup = "Legs" },
            new Exercise { Id = 76, Name = "Walking Lunges", Category = "Gym", MuscleGroup = "Legs" },

            // Руки (Специфическая изоляция)
            new Exercise { Id = 77, Name = "Preacher Curl", Category = "Gym", MuscleGroup = "Arms" },
            new Exercise { Id = 78, Name = "Close-Grip Bench Press", Category = "Gym", MuscleGroup = "Arms" },

            // Кор (Динамика)
            new Exercise { Id = 79, Name = "Cable Crunches", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 80, Name = "Ab Wheel Rollout", Category = "Gym", MuscleGroup = "Core" },
            new Exercise { Id = 81, Name = "Crunches", Category = "Gym", MuscleGroup = "Core" },

            // Кардио и Функционал
            new Exercise { Id = 82, Name = "Jump Rope", Category = "Gym", MuscleGroup = "Cardio" },
            new Exercise { Id = 83, Name = "Rowing Machine", Category = "Gym", MuscleGroup = "Cardio" },
            new Exercise { Id = 84, Name = "Cycling (Stationary)", Category = "Gym", MuscleGroup = "Cardio" }
        );
    }
}