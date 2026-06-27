using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Exercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    MuscleGroup = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exercises", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Favorites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    ExerciseId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Favorites", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Workouts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WorkoutType = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Workouts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SetNumber = table.Column<int>(type: "integer", nullable: false),
                    Weight = table.Column<double>(type: "double precision", nullable: true),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    Distance = table.Column<double>(type: "double precision", nullable: true),
                    Time = table.Column<double>(type: "double precision", nullable: true),
                    WorkoutId = table.Column<int>(type: "integer", nullable: false),
                    ExerciseId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkoutSets_Workouts_WorkoutId",
                        column: x => x.WorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "Category", "MuscleGroup", "Name" },
                values: new object[,]
                {
                    { 1, "Gym", "Chest", "Bench Press" },
                    { 2, "Gym", "Legs", "Leg Extensions" },
                    { 3, "Gym", "Legs", "Leg Curls" },
                    { 4, "Gym", "Legs", "Calf Raises" },
                    { 5, "Gym", "Legs", "Hip Abduction" },
                    { 6, "Gym", "Legs", "Hip Adduction" },
                    { 7, "Gym", "Legs", "Leg Press" },
                    { 8, "Gym", "Arms", "Cable Tricep Pushdown" },
                    { 9, "Gym", "Arms", "Barbell Bicep Curl" },
                    { 10, "Gym", "Arms", "Dumbbell Wrist Curl" },
                    { 11, "Gym", "Arms", "Reverse Wrist Curl" },
                    { 12, "Football", "Cardio", "Running / Sprints" },
                    { 13, "Gym", "Arms", "Dumbbell Bicep Curl" },
                    { 14, "Gym", "Back", "Seated Cable Row" },
                    { 15, "Gym", "Arms", "Standing Dumbbell Curl" },
                    { 16, "Gym", "Arms", "Dumbbell Skull Crusher" },
                    { 17, "Gym", "Back", "Pull-ups" },
                    { 18, "Gym", "Chest", "Chest Press Machine" },
                    { 19, "Gym", "Shoulders", "Machine Lateral Raise" },
                    { 20, "Gym", "Chest", "Dips" },
                    { 21, "Gym", "Legs", "Seated Calf Raises" },
                    { 22, "Gym", "Arms", "EZ-Bar Bicep Curl" },
                    { 23, "Gym", "Back", "Wide Grip Lat Pulldown" },
                    { 24, "Gym", "Arms", "Tricep Press Machine" },
                    { 25, "Gym", "Arms", "Overhead Tricep Extension" },
                    { 26, "Gym", "Back", "Barbell Row" },
                    { 27, "Gym", "Shoulders", "Rear Delt Fly" },
                    { 28, "Gym", "Back", "Close Grip Lat Pulldown" },
                    { 29, "Football", "Legs/Back", "Trap Bar Deadlift" },
                    { 30, "Gym", "Chest", "Dumbbell Bench Press" },
                    { 31, "Gym", "Back", "Bent-Over Row" },
                    { 32, "Football", "Explosive", "Med Ball Wall Throw" },
                    { 33, "Football", "Legs", "Bulgarian Split Squats" },
                    { 34, "Football", "Explosive", "Broad Jumps" },
                    { 35, "Gym", "Legs", "Barbell Squat" },
                    { 36, "Gym", "Back", "Single-Arm Dumbbell Row" },
                    { 37, "Gym", "Legs", "Dumbbell Squat" },
                    { 38, "Gym", "Back", "Dumbbell Bent-Over Row" },
                    { 39, "Gym", "Legs", "Glute Bridge" },
                    { 40, "Gym", "Shoulders", "Dumbbell Shoulder Press" },
                    { 41, "Gym", "Legs", "Static Lunges" },
                    { 42, "Gym", "Legs/Back", "Dumbbell Deadlift" },
                    { 43, "Gym", "Arms", "Hammer Curl" },
                    { 44, "Gym", "Back", "Lat Pulldown" },
                    { 45, "Gym", "Back", "Chest-Supported Row" },
                    { 46, "Gym", "Chest", "Push-ups" },
                    { 47, "Gym", "Core", "Plank" },
                    { 48, "Gym", "Core", "Side Plank" },
                    { 49, "Gym", "Legs", "Romanian Deadlift (RDL)" },
                    { 50, "Gym", "Legs", "Nordic Hamstring Curls" },
                    { 51, "Football", "Explosive", "Box Jumps" },
                    { 52, "Football", "Explosive", "Depth Jumps" },
                    { 53, "Gym", "Core", "Russian Twists" },
                    { 54, "Gym", "Core", "Cable Woodchoppers" },
                    { 55, "Gym", "Core", "Hanging Leg Raises" },
                    { 56, "Football", "Agility", "Agility Ladder" },
                    { 57, "Football", "Agility", "Cone Shuttle Drills" },
                    { 58, "Football", "Agility", "Change of Direction (COD) Sprints" },
                    { 59, "Gym", "Chest", "Incline Barbell Bench Press" },
                    { 60, "Gym", "Chest", "Incline Dumbbell Bench Press" },
                    { 61, "Gym", "Chest", "Cable Crossover" },
                    { 62, "Gym", "Chest", "Pec Deck Fly" },
                    { 63, "Gym", "Back/Legs", "Deadlift (Conventional)" },
                    { 64, "Gym", "Back", "T-Bar Row" },
                    { 65, "Gym", "Back", "Chin-ups" },
                    { 66, "Gym", "Back", "Straight-Arm Pulldown" },
                    { 67, "Gym", "Back", "Back Extension" },
                    { 68, "Gym", "Shoulders", "Military Press" },
                    { 69, "Gym", "Shoulders", "Dumbbell Lateral Raise" },
                    { 70, "Gym", "Shoulders", "Dumbbell Front Raise" },
                    { 71, "Gym", "Shoulders", "Face Pulls" },
                    { 72, "Gym", "Shoulders", "Dumbbell Shrugs" },
                    { 73, "Gym", "Legs", "Front Squat" },
                    { 74, "Gym", "Legs", "Hack Squat" },
                    { 75, "Gym", "Legs", "Barbell Hip Thrust" },
                    { 76, "Gym", "Legs", "Walking Lunges" },
                    { 77, "Gym", "Arms", "Preacher Curl" },
                    { 78, "Gym", "Arms", "Close-Grip Bench Press" },
                    { 79, "Gym", "Core", "Cable Crunches" },
                    { 80, "Gym", "Core", "Ab Wheel Rollout" },
                    { 81, "Gym", "Core", "Crunches" },
                    { 82, "Gym", "Cardio", "Jump Rope" },
                    { 83, "Gym", "Cardio", "Rowing Machine" },
                    { 84, "Gym", "Cardio", "Cycling (Stationary)" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId",
                table: "Workouts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_ExerciseId",
                table: "WorkoutSets",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSets_WorkoutId",
                table: "WorkoutSets",
                column: "WorkoutId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Favorites");

            migrationBuilder.DropTable(
                name: "WorkoutSets");

            migrationBuilder.DropTable(
                name: "Exercises");

            migrationBuilder.DropTable(
                name: "Workouts");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
