using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V6WorkoutSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Workouts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.CreateTable(
                name: "DeletedWorkouts",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    WorkoutId = table.Column<int>(type: "integer", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeletedWorkouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeletedWorkouts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId_UpdatedAt_Id",
                table: "Workouts",
                columns: new[] { "UserId", "UpdatedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_DeletedWorkouts_UserId_DeletedAt",
                table: "DeletedWorkouts",
                columns: new[] { "UserId", "DeletedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeletedWorkouts");

            migrationBuilder.DropIndex(
                name: "IX_Workouts_UserId_UpdatedAt_Id",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Workouts");
        }
    }
}
