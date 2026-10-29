using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V3UserScopedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutSets_Exercises_ExerciseId",
                table: "WorkoutSets");

            migrationBuilder.DropIndex(
                name: "IX_Workouts_UserId",
                table: "Workouts");

            migrationBuilder.AlterColumn<string>(
                name: "WorkoutType",
                table: "Workouts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<Guid>(
                name: "ClientId",
                table: "Workouts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "Workouts",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Username",
                table: "Users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Bestehende Konten: Registrierungsdatum = erste Einheit (oder jetzt, falls keine vorhanden).
            migrationBuilder.Sql("""
                UPDATE "Users" u
                SET "CreatedAt" = COALESCE((SELECT MIN(w."Date") FROM "Workouts" w WHERE w."UserId" = u."Id"), now());
                """);

            // Favoriten: Username -> UserId (echter Fremdschlüssel). Erst nullable anlegen, Daten übernehmen,
            // verwaiste/doppelte Einträge entfernen, dann NOT NULL setzen und die alte Spalte löschen.
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Favorites",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Favorites" f
                SET "UserId" = u."Id"
                FROM "Users" u
                WHERE lower(u."Username") = lower(f."Username");

                DELETE FROM "Favorites"
                WHERE "UserId" IS NULL
                   OR "ExerciseId" NOT IN (SELECT "Id" FROM "Exercises");

                DELETE FROM "Favorites" a
                USING "Favorites" b
                WHERE a."UserId" = b."UserId"
                  AND a."ExerciseId" = b."ExerciseId"
                  AND a."Id" > b."Id";
                """);

            migrationBuilder.AlterColumn<int>(
                name: "UserId",
                table: "Favorites",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "Username",
                table: "Favorites");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Exercises",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "MuscleGroup",
                table: "Exercises",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "Exercises",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "TrackingType",
                table: "Exercises",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "WeightReps");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Exercises",
                type: "integer",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 7,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 8,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 9,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 10,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 11,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 12,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 13,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 14,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 15,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 16,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 17,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 18,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 19,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 20,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 21,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 22,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 23,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 24,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 25,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 26,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 27,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 28,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 29,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 30,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 31,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 32,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 33,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 34,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 35,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 36,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 37,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 38,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 39,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 40,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 41,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 42,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 43,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 44,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 45,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 46,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 47,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "Duration", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 48,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "Duration", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 49,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 50,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 51,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 52,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 53,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 54,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 55,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 56,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "Duration", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 57,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 58,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 59,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 60,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 61,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 62,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 63,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 64,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 65,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 66,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 67,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 68,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 69,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 70,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 71,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 72,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 73,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 74,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 75,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 76,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 77,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 78,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 79,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 80,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 81,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "WeightReps", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 82,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "Duration", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 83,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            migrationBuilder.UpdateData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 84,
                columns: new[] { "TrackingType", "UserId" },
                values: new object[] { "DistanceTime", null });

            // HasData fügt die Standard-Übungen mit festen IDs ein, ohne die Identity-Sequenz weiterzuschalten.
            // Ohne diesen Schritt würde die erste eigene Übung mit Id = 1 kollidieren (duplicate key).
            // IDs < 1000 bleiben für künftige Standard-Übungen reserviert.
            // (ALTER ... RESTART statt SELECT setval(), damit das Statement auch im idempotenten Skript / DO-Block gültig ist.)
            migrationBuilder.Sql("""
                ALTER TABLE "Exercises" ALTER COLUMN "Id" RESTART WITH 1000;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId_ClientId",
                table: "Workouts",
                columns: new[] { "UserId", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId_Date",
                table: "Workouts",
                columns: new[] { "UserId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_ExerciseId",
                table: "Favorites",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_UserId_ExerciseId",
                table: "Favorites",
                columns: new[] { "UserId", "ExerciseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Exercises_Users_UserId",
                table: "Exercises",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Favorites_Exercises_ExerciseId",
                table: "Favorites",
                column: "ExerciseId",
                principalTable: "Exercises",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Favorites_Users_UserId",
                table: "Favorites",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutSets_Exercises_ExerciseId",
                table: "WorkoutSets",
                column: "ExerciseId",
                principalTable: "Exercises",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Exercises_Users_UserId",
                table: "Exercises");

            migrationBuilder.DropForeignKey(
                name: "FK_Favorites_Exercises_ExerciseId",
                table: "Favorites");

            migrationBuilder.DropForeignKey(
                name: "FK_Favorites_Users_UserId",
                table: "Favorites");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutSets_Exercises_ExerciseId",
                table: "WorkoutSets");

            migrationBuilder.DropIndex(
                name: "IX_Workouts_UserId_ClientId",
                table: "Workouts");

            migrationBuilder.DropIndex(
                name: "IX_Workouts_UserId_Date",
                table: "Workouts");

            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Favorites_ExerciseId",
                table: "Favorites");

            migrationBuilder.DropIndex(
                name: "IX_Favorites_UserId_ExerciseId",
                table: "Favorites");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_UserId",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "ClientId",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "Workouts");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Favorites");

            migrationBuilder.DropColumn(
                name: "TrackingType",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Exercises");

            migrationBuilder.AlterColumn<string>(
                name: "WorkoutType",
                table: "Workouts",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Username",
                table: "Users",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);

            // Hinweis: Beim Zurückrollen gehen die Favoriten verloren (Username wird nicht rekonstruiert).
            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "Favorites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Exercises",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(60)",
                oldMaxLength: 60);

            migrationBuilder.AlterColumn<string>(
                name: "MuscleGroup",
                table: "Exercises",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Category",
                table: "Exercises",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.CreateIndex(
                name: "IX_Workouts_UserId",
                table: "Workouts",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutSets_Exercises_ExerciseId",
                table: "WorkoutSets",
                column: "ExerciseId",
                principalTable: "Exercises",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
