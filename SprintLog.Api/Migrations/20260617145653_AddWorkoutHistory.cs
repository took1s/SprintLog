using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Type",
                table: "Workouts",
                newName: "WorkoutType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "WorkoutType",
                table: "Workouts",
                newName: "Type");
        }
    }
}
