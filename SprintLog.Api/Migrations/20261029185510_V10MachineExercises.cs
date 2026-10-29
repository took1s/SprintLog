using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V10MachineExercises : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "Category", "MuscleGroup", "Name", "TrackingType", "UserId" },
                values: new object[,]
                {
                    { 107, "Gym", "Legs", "Smith Machine Squat", "WeightReps", null },
                    { 108, "Gym", "Chest", "Smith Machine Bench Press", "WeightReps", null },
                    { 109, "Gym", "Shoulders", "Shoulder Press Machine", "WeightReps", null },
                    { 110, "Gym", "Back", "Machine Row", "WeightReps", null },
                    { 111, "Gym", "Back", "Assisted Pull-up Machine", "WeightReps", null },
                    { 112, "Gym", "Arms", "Assisted Dip Machine", "WeightReps", null },
                    { 113, "Gym", "Legs", "Lying Leg Curl", "WeightReps", null },
                    { 114, "Gym", "Legs", "Glute Kickback Machine", "WeightReps", null },
                    { 115, "Gym", "Legs", "Hip Thrust Machine", "WeightReps", null },
                    { 116, "Gym", "Legs", "Pendulum Squat", "WeightReps", null },
                    { 117, "Gym", "Arms", "Machine Bicep Curl", "WeightReps", null },
                    { 118, "Gym", "Core", "Ab Crunch Machine", "WeightReps", null },
                    { 119, "Gym", "Core", "Rotary Torso Machine", "WeightReps", null },
                    { 120, "Gym", "Chest", "Incline Chest Press Machine", "WeightReps", null },
                    { 121, "Gym", "Shoulders", "Cable Lateral Raise", "WeightReps", null },
                    { 122, "Gym", "Arms", "Cable Bicep Curl", "WeightReps", null },
                    { 123, "Gym", "Chest", "Low-to-High Cable Fly", "WeightReps", null },
                    { 124, "Gym", "Legs", "Standing Calf Raise Machine", "WeightReps", null },
                    { 125, "Gym", "Legs", "Belt Squat", "WeightReps", null },
                    { 126, "Gym", "Legs", "Cable Glute Kickback", "WeightReps", null },
                    { 127, "Gym", "Cardio", "Treadmill", "DistanceTime", null },
                    { 128, "Gym", "Cardio", "Stair Climber", "Duration", null },
                    { 129, "Gym", "Cardio", "Elliptical Trainer", "Duration", null },
                    { 130, "Gym", "Cardio", "Air Bike", "Duration", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 107);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 108);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 109);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 110);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 111);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 112);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 113);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 114);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 115);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 116);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 117);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 118);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 119);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 120);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 121);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 122);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 123);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 124);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 125);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 126);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 127);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 128);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 129);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 130);
        }
    }
}
