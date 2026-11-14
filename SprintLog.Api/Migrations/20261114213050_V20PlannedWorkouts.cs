using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V20PlannedWorkouts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TimesPerDay",
                table: "Routines",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "PlannedWorkouts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ClientId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Title = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Notes = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Source = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    WorkoutClientId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Exercises = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlannedWorkouts", x => x.Id);
                    table.CheckConstraint("CK_PlannedWorkouts_Status", "\"Status\" IN ('planned', 'done', 'skipped')");
                    table.ForeignKey(
                        name: "FK_PlannedWorkouts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Routines_TimesPerDay",
                table: "Routines",
                sql: "\"TimesPerDay\" BETWEEN 1 AND 6");

            migrationBuilder.CreateIndex(
                name: "IX_PlannedWorkouts_UserId_ClientId",
                table: "PlannedWorkouts",
                columns: new[] { "UserId", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlannedWorkouts_UserId_Date",
                table: "PlannedWorkouts",
                columns: new[] { "UserId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlannedWorkouts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Routines_TimesPerDay",
                table: "Routines");

            migrationBuilder.DropColumn(
                name: "TimesPerDay",
                table: "Routines");
        }
    }
}
