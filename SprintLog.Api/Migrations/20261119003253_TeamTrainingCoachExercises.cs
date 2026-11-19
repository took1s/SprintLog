using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class TeamTrainingCoachExercises : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Participation",
                table: "Workouts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TeamFocus",
                table: "Workouts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TeamDays",
                table: "Programs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "CreatedByCoach",
                table: "Exercises",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Exercises",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 22,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 23,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 24,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 25,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 26,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 27,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 28,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 29,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 30,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 31,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 32,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 33,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 34,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 35,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 36,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 37,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 38,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 39,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 40,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 41,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 42,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 43,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 44,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 45,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 46,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 47,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 48,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 49,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 50,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 51,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 52,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 53,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 54,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 55,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 56,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 57,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 58,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 59,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 60,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 61,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 62,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 63,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 64,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 65,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 66,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 67,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 68,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 69,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 70,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 71,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 72,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 73,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 74,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 75,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 76,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 77,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 78,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 79,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 80,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 81,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 82,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 83,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 84,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 85,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 86,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 87,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 88,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 89,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 90,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 91,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 92,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 93,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 94,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 95,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 96,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 97,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 98,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 99,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 100,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 101,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 102,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 103,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 104,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 105,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 106,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 107,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 108,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 109,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 110,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 111,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 112,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 113,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 114,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 115,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 116,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 117,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 118,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 119,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 120,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 121,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 122,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 123,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 124,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 125,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 126,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 127,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 128,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 129,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 130,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 131,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 132,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 133,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 134,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 135,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 136,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 137,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 138,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 139,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 140,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 141,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 142,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 143,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 144,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 145,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 146,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 147,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 148,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 149,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 150,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 151,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 152,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 153,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 154,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 155,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 156,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 157,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 158,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 159,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 160,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 161,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 162,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 163,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 164,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 165,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 166,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 167,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 168,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 169,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 170,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 171,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 172,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 173,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 174,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 175,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 176,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 177,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 178,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 179,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 180,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 181,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 182,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 183,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 184,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 185,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 186,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 187,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 188,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 189,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 190,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 191,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 192,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 193,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 194,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 195,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 196,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 197,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 198,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 199,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 200,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 201,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 202,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 203,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 204,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 205,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 206,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 207,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 208,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 209,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 210,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 211,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 212,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 213,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 214,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 215,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 216,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 217,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 218,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 219,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 220,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 221,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 222,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 223,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 224,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 225,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 226,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 227,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 228,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 229,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 230,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 231,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 232,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 233,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 234,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 235,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 236,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 237,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 238,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 239,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 240,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 241,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 242,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 243,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 244,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 245,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 246,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 247,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 248,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 249,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 250,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 251,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 252,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 253,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 254,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 255,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 256,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 257,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 258,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 259,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 260,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 261,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 262,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 263,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 264,
                columns: new[] { "CreatedByCoach", "Description" },
                values: new object[] { false, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Participation",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "TeamFocus",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "TeamDays",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "CreatedByCoach",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Exercises");
        }
    }
}
