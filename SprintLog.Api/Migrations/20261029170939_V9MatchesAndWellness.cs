using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V9MatchesAndWellness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Assists",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Goals",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Opponent",
                table: "Workouts",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Wellness",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Sleep = table.Column<int>(type: "integer", nullable: false),
                    Energy = table.Column<int>(type: "integer", nullable: false),
                    Soreness = table.Column<int>(type: "integer", nullable: false),
                    Mood = table.Column<int>(type: "integer", nullable: false),
                    SleepHours = table.Column<double>(type: "double precision", nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Wellness", x => x.Id);
                    table.CheckConstraint("CK_Wellness_Energy", "\"Energy\" BETWEEN 1 AND 5");
                    table.CheckConstraint("CK_Wellness_Mood", "\"Mood\" BETWEEN 1 AND 5");
                    table.CheckConstraint("CK_Wellness_Sleep", "\"Sleep\" BETWEEN 1 AND 5");
                    table.CheckConstraint("CK_Wellness_Soreness", "\"Soreness\" BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_Wellness_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Wellness_UserId_Date",
                table: "Wellness",
                columns: new[] { "UserId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Wellness");

            migrationBuilder.DropColumn(
                name: "Assists",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Goals",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "Opponent",
                table: "Workouts");
        }
    }
}
