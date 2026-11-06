using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V16AthleteProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AthleteProfiles",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Position = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    BirthYear = table.Column<int>(type: "integer", nullable: true),
                    HeightCm = table.Column<int>(type: "integer", nullable: true),
                    WeightKg = table.Column<double>(type: "double precision", nullable: true),
                    Level = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Goals = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Injuries = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Equipment = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SessionMinutes = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AthleteProfiles", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_AthleteProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AthleteProfiles");
        }
    }
}
