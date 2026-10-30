using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace SprintLog.Api.Migrations
{
    /// <inheritdoc />
    public partial class V11CatalogV7 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Exercises",
                columns: new[] { "Id", "Category", "MuscleGroup", "Name", "TrackingType", "UserId" },
                values: new object[,]
                {
                    { 131, "Gym", "Chest", "Decline Bench Press", "WeightReps", null },
                    { 132, "Gym", "Chest", "Decline Dumbbell Press", "WeightReps", null },
                    { 133, "Gym", "Chest", "Dumbbell Fly", "WeightReps", null },
                    { 134, "Gym", "Chest", "Incline Dumbbell Fly", "WeightReps", null },
                    { 135, "Gym", "Chest", "High-to-Low Cable Fly", "WeightReps", null },
                    { 136, "Gym", "Chest", "Dumbbell Pullover", "WeightReps", null },
                    { 137, "Gym", "Back", "Pullover Machine", "WeightReps", null },
                    { 138, "Gym", "Chest", "Floor Press", "WeightReps", null },
                    { 139, "Gym", "Chest", "Decline Push-ups", "WeightReps", null },
                    { 140, "Gym", "Arms", "Diamond Push-ups", "WeightReps", null },
                    { 141, "Gym", "Chest", "Hammer Strength Chest Press", "WeightReps", null },
                    { 142, "Gym", "Chest", "Hammer Strength Incline Press", "WeightReps", null },
                    { 143, "Gym", "Shoulders", "Landmine Press", "WeightReps", null },
                    { 144, "Gym", "Chest", "Weighted Dips", "WeightReps", null },
                    { 145, "Gym", "Back", "Hammer Strength Iso-Row", "WeightReps", null },
                    { 146, "Gym", "Back", "Hammer Strength High Row", "WeightReps", null },
                    { 147, "Gym", "Back", "Hammer Strength Pulldown", "WeightReps", null },
                    { 148, "Gym", "Back", "Single-Arm Lat Pulldown", "WeightReps", null },
                    { 149, "Gym", "Back", "Neutral-Grip Pull-ups", "WeightReps", null },
                    { 150, "Gym", "Back", "Weighted Pull-ups", "WeightReps", null },
                    { 151, "Gym", "Back", "Pendlay Row", "WeightReps", null },
                    { 152, "Gym", "Back", "Seal Row", "WeightReps", null },
                    { 153, "Gym", "Back", "Meadows Row", "WeightReps", null },
                    { 154, "Gym", "Back", "Rack Pull", "WeightReps", null },
                    { 155, "Gym", "Legs/Back", "Sumo Deadlift", "WeightReps", null },
                    { 156, "Gym", "Legs/Back", "Good Morning", "WeightReps", null },
                    { 157, "Gym", "Back", "Reverse Hyperextension", "WeightReps", null },
                    { 158, "Gym", "Back", "Barbell Shrugs", "WeightReps", null },
                    { 159, "Gym", "Back", "Superman", "WeightReps", null },
                    { 160, "Gym", "Shoulders", "Arnold Press", "WeightReps", null },
                    { 161, "Gym", "Shoulders", "Upright Row", "WeightReps", null },
                    { 162, "Gym", "Shoulders", "Reverse Pec Deck", "WeightReps", null },
                    { 163, "Gym", "Shoulders", "Cable Rear Delt Fly", "WeightReps", null },
                    { 164, "Gym", "Shoulders", "Cable Front Raise", "WeightReps", null },
                    { 165, "Gym", "Shoulders", "Plate Front Raise", "WeightReps", null },
                    { 166, "Gym", "Shoulders", "Y-Raise", "WeightReps", null },
                    { 167, "Gym", "Shoulders", "Smith Machine Shoulder Press", "WeightReps", null },
                    { 168, "Gym", "Shoulders", "Handstand Push-ups", "WeightReps", null },
                    { 169, "Gym", "Arms", "Concentration Curl", "WeightReps", null },
                    { 170, "Gym", "Arms", "Incline Dumbbell Curl", "WeightReps", null },
                    { 171, "Gym", "Arms", "Spider Curl", "WeightReps", null },
                    { 172, "Gym", "Arms", "Rope Hammer Curl", "WeightReps", null },
                    { 173, "Gym", "Arms", "Reverse Curl", "WeightReps", null },
                    { 174, "Gym", "Arms", "Bayesian Cable Curl", "WeightReps", null },
                    { 175, "Gym", "Arms", "Preacher Curl Machine", "WeightReps", null },
                    { 176, "Gym", "Arms", "Rope Pushdown", "WeightReps", null },
                    { 177, "Gym", "Arms", "Overhead Cable Extension", "WeightReps", null },
                    { 178, "Gym", "Arms", "Single-Arm Cable Pushdown", "WeightReps", null },
                    { 179, "Gym", "Arms", "EZ-Bar Skull Crusher", "WeightReps", null },
                    { 180, "Gym", "Arms", "Dumbbell Kickback", "WeightReps", null },
                    { 181, "Gym", "Arms", "Bench Dips", "WeightReps", null },
                    { 182, "Gym", "Arms", "Seated Dip Machine", "WeightReps", null },
                    { 183, "Gym", "Arms", "Wrist Roller", "WeightReps", null },
                    { 184, "Gym", "Legs", "Goblet Squat", "WeightReps", null },
                    { 185, "Gym", "Legs", "Box Squat", "WeightReps", null },
                    { 186, "Gym", "Legs", "Pause Squat", "WeightReps", null },
                    { 187, "Gym", "Legs", "Safety Bar Squat", "WeightReps", null },
                    { 188, "Gym", "Legs", "Sissy Squat", "WeightReps", null },
                    { 189, "Gym", "Legs", "Single-Leg Leg Press", "WeightReps", null },
                    { 190, "Gym", "Legs", "Seated Leg Curl", "WeightReps", null },
                    { 191, "Gym", "Legs", "Single-Leg Leg Extension", "WeightReps", null },
                    { 192, "Gym", "Legs", "Single-Leg Hip Thrust", "WeightReps", null },
                    { 193, "Gym", "Legs", "Cable Pull-Through", "WeightReps", null },
                    { 194, "Gym", "Legs/Back", "Stiff-Leg Deadlift", "WeightReps", null },
                    { 195, "Gym", "Legs/Back", "Dumbbell Romanian Deadlift", "WeightReps", null },
                    { 196, "Gym", "Legs", "Leg Press Calf Raise", "WeightReps", null },
                    { 197, "Gym", "Legs", "Tibialis Raise", "WeightReps", null },
                    { 198, "Football", "Legs", "Reverse Nordic", "WeightReps", null },
                    { 199, "Football", "Legs", "Spanish Squat", "Duration", null },
                    { 200, "Gym", "Legs", "Wall Sit", "Duration", null },
                    { 201, "Gym", "Legs", "Single-Leg Calf Raise", "WeightReps", null },
                    { 202, "Gym", "Legs", "Cable Hip Abduction", "WeightReps", null },
                    { 203, "Gym", "Legs", "Smith Machine Split Squat", "WeightReps", null },
                    { 204, "Gym", "Legs", "Glute Ham Raise", "WeightReps", null },
                    { 205, "Gym", "Core", "Decline Sit-ups", "WeightReps", null },
                    { 206, "Gym", "Core", "Bicycle Crunch", "WeightReps", null },
                    { 207, "Gym", "Core", "V-Ups", "WeightReps", null },
                    { 208, "Gym", "Core", "Toes-to-Bar", "WeightReps", null },
                    { 209, "Gym", "Core", "Captain's Chair Knee Raise", "WeightReps", null },
                    { 210, "Gym", "Core", "Lying Leg Raise", "WeightReps", null },
                    { 211, "Gym", "Core", "Mountain Climbers", "Duration", null },
                    { 212, "Gym", "Core", "Bird Dog", "WeightReps", null },
                    { 213, "Gym", "Core", "Landmine Rotation", "WeightReps", null },
                    { 214, "Gym", "Core", "Turkish Get-up", "WeightReps", null },
                    { 215, "Gym", "Explosive", "Hang Power Clean", "WeightReps", null },
                    { 216, "Gym", "Explosive", "Jump Squat", "WeightReps", null },
                    { 217, "Gym", "Explosive", "Trap Bar Jump", "WeightReps", null },
                    { 218, "Gym", "Explosive", "Med Ball Slam", "WeightReps", null },
                    { 219, "Gym", "Explosive", "Rotational Med Ball Throw", "WeightReps", null },
                    { 220, "Football", "Explosive", "Hurdle Hops", "WeightReps", null },
                    { 221, "Football", "Explosive", "Pogo Jumps", "WeightReps", null },
                    { 222, "Gym", "Shoulders", "Kettlebell Clean & Press", "WeightReps", null },
                    { 223, "Gym", "Explosive", "Kettlebell Snatch", "WeightReps", null },
                    { 224, "Gym", "Cardio", "Burpees", "WeightReps", null },
                    { 225, "Gym", "Shoulders", "Band Pull-Apart", "WeightReps", null },
                    { 226, "Gym", "Shoulders", "Band External Rotation", "WeightReps", null },
                    { 227, "Football", "Legs", "Banded Lateral Walk", "WeightReps", null },
                    { 228, "Football", "Explosive", "Hill Sprints", "DistanceTime", null },
                    { 229, "Football", "Explosive", "Sled Push", "DistanceTime", null },
                    { 230, "Football", "Explosive", "Resisted Sprints", "DistanceTime", null },
                    { 231, "Football", "Explosive", "Acceleration Sprints", "DistanceTime", null },
                    { 232, "Football", "Cardio", "Yo-Yo Intermittent Recovery Test", "DistanceTime", null },
                    { 233, "Football", "Cardio", "Box-to-Box Runs", "DistanceTime", null },
                    { 234, "Football", "Cardio", "Fartlek", "Duration", null },
                    { 235, "Football", "Cardio", "Easy Run (Zone 2)", "DistanceTime", null },
                    { 236, "Football", "Agility", "Small-Sided Game", "Duration", null },
                    { 237, "Football", "Agility", "Rondo", "Duration", null },
                    { 238, "Football", "Agility", "Passing Drill", "Duration", null },
                    { 239, "Football", "Agility", "Dribbling Drill", "Duration", null },
                    { 240, "Football", "Agility", "Finishing (Shooting)", "Duration", null },
                    { 241, "Football", "Agility", "Ball Juggling", "Duration", null },
                    { 242, "Football", "Mobility", "Hip 90/90 Stretch", "Duration", null },
                    { 243, "Football", "Mobility", "Couch Stretch", "Duration", null },
                    { 244, "Football", "Mobility", "World's Greatest Stretch", "Duration", null },
                    { 245, "Football", "Mobility", "Hamstring Stretch", "Duration", null },
                    { 246, "Football", "Mobility", "Hip Flexor Stretch", "Duration", null },
                    { 247, "Football", "Mobility", "Adductor Stretch", "Duration", null },
                    { 248, "Football", "Mobility", "Ankle Mobility", "Duration", null },
                    { 249, "Football", "Mobility", "Thoracic Rotation", "Duration", null },
                    { 250, "Football", "Mobility", "Cat-Cow", "Duration", null },
                    { 251, "Football", "Mobility", "Leg Swings", "Duration", null },
                    { 252, "Football", "Mobility", "Foam Rolling", "Duration", null },
                    { 253, "Gym", "Cardio", "Incline Treadmill Walk", "Duration", null },
                    { 254, "Gym", "Cardio", "SkiErg", "Duration", null },
                    { 255, "Gym", "Cardio", "Battle Ropes", "Duration", null },
                    { 256, "Gym", "Cardio", "Swimming", "Duration", null },
                    { 257, "Gym", "Cardio", "Jumping Jacks", "Duration", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 131);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 132);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 133);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 134);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 135);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 136);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 137);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 138);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 139);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 140);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 141);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 142);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 143);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 144);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 145);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 146);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 147);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 148);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 149);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 150);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 151);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 152);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 153);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 154);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 155);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 156);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 157);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 158);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 159);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 160);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 161);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 162);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 163);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 164);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 165);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 166);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 167);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 168);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 169);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 170);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 171);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 172);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 173);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 174);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 175);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 176);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 177);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 178);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 179);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 180);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 181);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 182);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 183);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 184);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 185);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 186);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 187);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 188);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 189);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 190);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 191);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 192);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 193);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 194);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 195);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 196);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 197);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 198);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 199);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 200);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 201);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 202);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 203);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 204);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 205);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 206);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 207);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 208);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 209);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 210);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 211);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 212);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 213);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 214);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 215);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 216);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 217);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 218);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 219);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 220);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 221);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 222);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 223);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 224);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 225);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 226);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 227);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 228);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 229);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 230);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 231);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 232);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 233);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 234);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 235);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 236);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 237);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 238);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 239);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 240);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 241);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 242);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 243);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 244);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 245);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 246);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 247);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 248);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 249);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 250);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 251);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 252);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 253);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 254);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 255);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 256);

            migrationBuilder.DeleteData(
                table: "Exercises",
                keyColumn: "Id",
                keyValue: 257);
        }
    }
}
