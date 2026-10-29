using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V4WorkoutDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsWarmup",
                table: "WorkoutSets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "Rpe",
                table: "WorkoutSets",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Workouts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SessionRpe",
                table: "Workouts",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsWarmup",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Rpe",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "SessionRpe",
                table: "Workouts");
        }
    }
}
