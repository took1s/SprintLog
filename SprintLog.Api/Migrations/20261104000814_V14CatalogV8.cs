using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V14CatalogV8 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "Category", "MuscleGroup", "Name", "TrackingType", "UserId" },
                values: new object[,]
                {
                    { 258, "Football", "Legs", "Askling Extender", "WeightReps", null },
                    { 259, "Football", "Legs", "Askling Diver", "WeightReps", null },
                    { 260, "Football", "Legs", "Askling Glider", "WeightReps", null },
                    { 261, "Gym", "Legs", "Isometric Bridge Hold", "Duration", null },
                    { 262, "Gym", "Legs", "Swiss Ball Hamstring Curl", "WeightReps", null },
                    { 263, "Gym", "Legs", "Single-Leg Glute Bridge", "WeightReps", null },
                    { 264, "Gym", "Legs", "Assisted Nordic Hamstring Curl", "WeightReps", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 258);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 259);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 260);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 261);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 262);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 263);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 264);
        }
    }
}
