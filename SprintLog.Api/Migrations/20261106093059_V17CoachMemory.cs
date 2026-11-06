using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V17CoachMemory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoachMemories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Content = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Importance = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoachMemories", x => x.Id);
                    table.CheckConstraint("CK_CoachMemories_Importance", "\"Importance\" BETWEEN 1 AND 3");
                    table.ForeignKey(
                        name: "FK_CoachMemories_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoachMemories_UserId_UpdatedAt",
                table: "CoachMemories",
                columns: new[] { "UserId", "UpdatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoachMemories");
        }
    }
}
