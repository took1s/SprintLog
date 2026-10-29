using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V8PeriodizationAndCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "WorkoutSets",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CycleWeeks",
                table: "Programs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeloadEvery",
                table: "Programs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "ProgramExercises",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PercentOf1Rm",
                table: "ProgramExercises",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WeekSteps",
                table: "ProgramExercises",
                type: "jsonb",
                nullable: true);

            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "Category", "MuscleGroup", "Name", "TrackingType", "UserId" },
                values: new object[,]
                {
                    { 85, "Football", "Legs", "Copenhagen Adduction", "WeightReps", null },
                    { 86, "Football", "Legs", "Single-Leg Balance", "Duration", null },
                    { 87, "Football", "Cardio", "Interval Run", "Duration", null },
                    { 88, "Football", "Agility", "Repeated Shuttle Sprints", "DistanceTime", null },
                    { 89, "Football", "Explosive", "Flying Sprints", "DistanceTime", null },
                    { 90, "Football", "Explosive", "Countermovement Jump", "WeightReps", null },
                    { 91, "Football", "Explosive", "Lateral Bounds", "WeightReps", null },
                    { 92, "Football", "Agility", "A-Skips", "DistanceTime", null },
                    { 93, "Football", "Cardio", "Tempo Runs", "DistanceTime", null },
                    { 94, "Gym", "Back", "Inverted Row", "WeightReps", null },
                    { 95, "Gym", "Core", "Hollow Body Hold", "Duration", null },
                    { 96, "Gym", "Core", "Pallof Press", "WeightReps", null },
                    { 97, "Gym", "Legs", "Single-Leg Romanian Deadlift", "WeightReps", null },
                    { 98, "Gym", "Legs", "Step-ups", "WeightReps", null },
                    { 99, "Gym", "Back/Legs", "Kettlebell Swing", "WeightReps", null },
                    { 100, "Gym", "Explosive", "Power Clean", "WeightReps", null },
                    { 101, "Gym", "Shoulders", "Push Press", "WeightReps", null },
                    { 102, "Gym", "Legs", "Reverse Lunges", "WeightReps", null },
                    { 103, "Gym", "Legs", "Lateral Lunge", "WeightReps", null },
                    { 104, "Gym", "Core", "Dead Bug", "WeightReps", null },
                    { 105, "Gym", "Legs", "Bodyweight Squat", "WeightReps", null },
                    { 106, "Football", "Cardio", "Warm-up Jog", "Duration", null }
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Programs_CycleWeeks",
                table: "Programs",
                sql: "\"CycleWeeks\" IS NULL OR \"CycleWeeks\" BETWEEN 1 AND 12");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Programs_DeloadEvery",
                table: "Programs",
                sql: "\"DeloadEvery\" IS NULL OR \"DeloadEvery\" BETWEEN 2 AND 12");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Programs_CycleWeeks",
                table: "Programs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Programs_DeloadEvery",
                table: "Programs");

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 85);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 86);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 87);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 88);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 89);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 90);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 91);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 92);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 93);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 94);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 95);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 96);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 97);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 98);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 99);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 100);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 101);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 102);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 103);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 104);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 105);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 106);

            migrationBuilder.DropColumn(
                name: "Note",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "CycleWeeks",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "DeloadEvery",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "ProgramExercises");

            migrationBuilder.DropColumn(
                name: "PercentOf1Rm",
                table: "ProgramExercises");

            migrationBuilder.DropColumn(
                name: "WeekSteps",
                table: "ProgramExercises");
        }
    }
}
