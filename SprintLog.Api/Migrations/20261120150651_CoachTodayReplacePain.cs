using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class CoachTodayReplacePain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Pain",
                table: "WorkoutExerciseNotes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ReplacesPlan",
                table: "PlannedWorkouts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "CK_WorkoutExerciseNotes_Pain",
                table: "WorkoutExerciseNotes",
                sql: "\"Pain\" IS NULL OR (\"Pain\" >= 0 AND \"Pain\" <= 10)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_WorkoutExerciseNotes_Pain",
                table: "WorkoutExerciseNotes");

            migrationBuilder.DropColumn(
                name: "Pain",
                table: "WorkoutExerciseNotes");

            migrationBuilder.DropColumn(
                name: "ReplacesPlan",
                table: "PlannedWorkouts");
        }
    }
}
