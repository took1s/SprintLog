using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V22AthleteData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AvgHr",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DistanceM",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxHr",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MaxSpeedKmh",
                table: "Workouts",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OpponentGoals",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Position",
                table: "Workouts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Sprints",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TeamGoals",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ToImprove",
                table: "Workouts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WentWell",
                table: "Workouts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DailyLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    WeightKg = table.Column<double>(type: "double precision", nullable: true),
                    ProteinG = table.Column<int>(type: "integer", nullable: true),
                    SleepMinutes = table.Column<int>(type: "integer", nullable: true),
                    RestingHr = table.Column<int>(type: "integer", nullable: true),
                    Hrv = table.Column<int>(type: "integer", nullable: true),
                    Steps = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FitnessTests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ClientId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    Test = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Value = table.Column<double>(type: "double precision", nullable: false),
                    Notes = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FitnessTests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FitnessTests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyLogs_UserId_Day",
                table: "DailyLogs",
                columns: new[] { "UserId", "Day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FitnessTests_UserId_ClientId",
                table: "FitnessTests",
                columns: new[] { "UserId", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FitnessTests_UserId_Day",
                table: "FitnessTests",
                columns: new[] { "UserId", "Day" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyLogs");

            migrationBuilder.DropTable(
                name: "FitnessTests");

            migrationBuilder.DropColumn(
                name: "AvgHr",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "DistanceM",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "MaxHr",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "MaxSpeedKmh",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "OpponentGoals",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Sprints",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "TeamGoals",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "ToImprove",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "WentWell",
                table: "Workouts");
        }
    }
}
