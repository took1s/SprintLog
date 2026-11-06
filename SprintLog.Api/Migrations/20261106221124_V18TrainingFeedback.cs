using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V18TrainingFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Cadence",
                table: "WorkoutSets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Calories",
                table: "WorkoutSets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HeartRate",
                table: "WorkoutSets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Level",
                table: "WorkoutSets",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Power",
                table: "WorkoutSets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gym",
                table: "Workouts",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAssisted",
                table: "Exercises",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PerSide",
                table: "Exercises",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "WorkoutExerciseNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkoutId = table.Column<int>(type: "integer", nullable: false),
                    ExerciseId = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Skipped = table.Column<bool>(type: "boolean", nullable: false),
                    Reason = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutExerciseNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutExerciseNotes_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkoutExerciseNotes_Workouts_WorkoutId",
                        column: x => x.WorkoutId,
                        principalTable: "Workouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 22,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 23,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 24,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 25,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 26,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 27,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 28,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 29,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 30,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 31,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 32,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 33,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 34,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 35,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 36,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 37,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 38,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 39,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 40,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 41,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 42,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 43,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 44,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 45,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 46,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 47,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 48,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 49,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 50,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 51,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 52,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 53,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 54,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 55,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 56,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 57,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 58,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 59,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 60,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 61,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 62,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 63,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 64,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 65,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 66,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 67,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 68,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 69,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 70,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 71,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 72,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 73,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 74,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 75,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 76,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 77,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 78,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 79,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 80,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 81,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 82,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 83,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 84,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 85,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 86,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 87,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 88,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 89,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 90,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 91,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 92,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 93,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 94,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 95,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 96,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 97,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 98,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 99,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 100,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 101,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 102,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 103,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 104,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 105,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 106,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 107,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 108,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 109,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 110,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 111,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { true, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 112,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { true, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 113,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 114,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 115,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 116,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 117,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 118,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 119,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 120,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 121,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 122,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 123,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 124,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 125,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 126,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 127,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 128,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 129,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 130,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 131,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 132,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 133,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 134,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 135,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 136,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 137,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 138,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 139,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 140,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 141,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 142,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 143,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 144,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 145,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 146,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 147,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 148,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 149,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 150,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 151,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 152,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 153,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 154,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 155,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 156,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 157,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 158,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 159,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 160,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 161,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 162,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 163,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 164,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 165,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 166,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 167,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 168,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 169,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 170,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 171,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 172,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 173,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 174,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 175,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 176,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 177,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 178,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 179,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 180,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 181,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 182,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 183,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 184,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 185,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 186,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 187,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 188,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 189,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 190,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 191,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 192,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 193,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 194,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 195,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 196,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 197,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 198,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 199,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 200,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 201,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 202,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 203,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 204,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 205,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 206,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 207,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 208,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 209,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 210,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 211,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 212,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 213,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 214,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 215,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 216,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 217,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 218,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 219,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 220,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 221,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 222,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 223,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 224,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 225,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 226,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 227,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 228,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 229,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 230,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 231,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 232,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 233,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 234,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 235,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 236,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 237,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 238,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 239,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 240,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 241,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 242,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 243,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 244,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 245,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 246,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 247,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 248,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 249,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 250,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 251,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 252,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 253,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 254,
                columns: new[] { "IsAssisted", "PerSide", "TrackingType" },
                values: new object[] { false, false, "Cardio" });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 255,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 256,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 257,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 258,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 259,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 260,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 261,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 262,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 263,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, true });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 264,
                columns: new[] { "IsAssisted", "PerSide" },
                values: new object[] { false, false });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutExerciseNotes_ExerciseId",
                table: "WorkoutExerciseNotes",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutExerciseNotes_WorkoutId_ExerciseId",
                table: "WorkoutExerciseNotes",
                columns: new[] { "WorkoutId", "ExerciseId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkoutExerciseNotes");

            migrationBuilder.DropColumn(
                name: "Cadence",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Calories",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "HeartRate",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Power",
                table: "WorkoutSets");

            migrationBuilder.DropColumn(
                name: "Gym",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "IsAssisted",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "PerSide",
                table: "Exercises");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 83,
                column: "TrackingType",
                value: "DistanceTime");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 84,
                column: "TrackingType",
                value: "DistanceTime");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 127,
                column: "TrackingType",
                value: "DistanceTime");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 128,
                column: "TrackingType",
                value: "Duration");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 129,
                column: "TrackingType",
                value: "Duration");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 130,
                column: "TrackingType",
                value: "Duration");

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 254,
                column: "TrackingType",
                value: "Duration");
        }
    }
}
