using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using SprintLog.Api.Data;
using SprintLog.Api.DTOs;
using SprintLog.Api.Endpoints;
using SprintLog.Api.Models;

namespace SprintLog.Api.Services;

/// <summary>
/// Werkzeuge des KI-Coachs. Statistik-Werkzeuge rechnen exakt auf dem Server (die KI rät keine Zahlen), Vorschlags-Werkzeuge
/// ändern nichts - sie erzeugen Karten, die der Nutzer selbst bestätigt. Alle Abfragen sind auf den eigenen Nutzer beschränkt.
/// </summary>
public sealed class AiTools(AppDbContext db, TimeProvider time)
{
    public const string ProposeProgram = "propose_program";
    public const string ProposeProgramUpdate = "propose_program_update";
    public const string ProposeGoal = "propose_goal";
    public const string ProposeSchedule = "propose_schedule";
    public const string SubmitReport = "submit_report";
    private const int MaxResultChars = 9_000;

    private static JsonObject Schema(string json) => JsonNode.Parse(json)!.AsObject();

    // ---------- Definitionen ----------

    public static readonly AiTool ExerciseHistory = new("get_exercise_history",
        "Session-by-session history of one exercise: work sets, best set, estimated 1RM (Epley) or best time, and the trend. Use for progress and plateau questions.",
        Schema("""{"type":"object","required":["exercise"],"properties":{"exercise":{"type":"string","description":"Exercise id or (English) name from the catalog"},"weeks":{"type":"integer","description":"How far back, 1-52 (default 12)"}}}"""));

    public static readonly AiTool PersonalRecords = new("get_personal_records",
        "Personal records: best estimated 1RM per strength exercise, best times per sprint distance, longest holds - with dates.",
        Schema("""{"type":"object","properties":{"limit":{"type":"integer","description":"Max entries per group, 1-30 (default 15)"}}}"""));

    public static readonly AiTool TrainingSummary = new("get_training_summary",
        "Weekly training summary: sessions by type, matches, work sets, tonnage, sprint reps, session load (sRPE x minutes) and average weekly work sets per muscle group.",
        Schema("""{"type":"object","properties":{"weeks":{"type":"integer","description":"Number of weeks, 1-26 (default 8)"}}}"""));

    public static readonly AiTool WellnessTrend = new("get_wellness_trend",
        "Daily check-ins (1-5, higher is better; soreness 5 = no soreness) with averages, sleep hours and low days.",
        Schema("""{"type":"object","properties":{"days":{"type":"integer","description":"7-90 (default 28)"}}}"""));

    public static readonly AiTool MatchStats = new("get_match_stats",
        "Logged matches with minutes, goals, assists, opponent and effort.",
        Schema("""{"type":"object","properties":{"weeks":{"type":"integer","description":"1-52 (default 26)"}}}"""));

    public static readonly AiTool SearchExercises = new("search_exercises",
        "Find exercises in the athlete's catalog by name, muscle group or category. Returns ids for proposals.",
        Schema("""{"type":"object","required":["query"],"properties":{"query":{"type":"string"},"limit":{"type":"integer"}}}"""));

    public static readonly AiTool ProposeProgramTool = new(ProposeProgram,
        "Propose a complete training program. The athlete sees it as a card and decides whether to save it. Only catalog exercise ids.",
        Schema("""
        {"type":"object","required":["name","goal","weeks","days","summary"],"properties":{
          "name":{"type":"string"},
          "goal":{"type":"string","enum":["Strength","Hypertrophy","Speed","General","Rehab"]},
          "weeks":{"type":"integer","minimum":2,"maximum":12},
          "summary":{"type":"string","description":"2-3 sentences why this program fits"},
          "days":{"type":"array","minItems":1,"maxItems":6,"items":{"type":"object","required":["name","exercises"],"properties":{
            "name":{"type":"string"},"notes":{"type":"string"},
            "exercises":{"type":"array","minItems":1,"maxItems":10,"items":{"type":"object","required":["exerciseId","sets"],"properties":{
              "exerciseId":{"type":"integer"},"sets":{"type":"integer"},"repsMin":{"type":"integer"},"repsMax":{"type":"integer"},
              "distance":{"type":"number","description":"meters"},"time":{"type":"number","description":"seconds"},
              "targetRpe":{"type":"number"},"restSeconds":{"type":"integer"},"note":{"type":"string"}}}}}}}}}
        """));

    public static readonly AiTool ProposeGoalTool = new(ProposeGoal,
        "Propose a strength goal (e.g. back squat 100 kg x 3 by a date). The athlete confirms it in the app.",
        Schema("""{"type":"object","required":["exerciseId","targetWeight","targetReps","reason"],"properties":{"exerciseId":{"type":"integer"},"targetWeight":{"type":"number"},"targetReps":{"type":"integer"},"targetDate":{"type":"string","description":"yyyy-MM-dd, optional"},"reason":{"type":"string"}}}"""));

    public static readonly AiTool ProposeScheduleTool = new(ProposeSchedule,
        "Propose the weekly schedule of the active program: training days and match days (0 = Monday ... 6 = Sunday). The athlete confirms it.",
        Schema("""{"type":"object","required":["trainingDays","matchDays","reason"],"properties":{"trainingDays":{"type":"array","items":{"type":"integer"}},"matchDays":{"type":"array","items":{"type":"integer"}},"reason":{"type":"string"}}}"""));

    public static readonly AiTool SubmitReportTool = new(SubmitReport,
        "Submit the final analysis report.",
        Schema("""
        {"type":"object","required":["headline","summary","sections","recommendations","nextWeekFocus"],"properties":{
          "headline":{"type":"string","description":"One sentence verdict"},
          "summary":{"type":"string","description":"2-4 sentences"},
          "sections":{"type":"array","minItems":2,"maxItems":6,"items":{"type":"object","required":["title","status","points"],"properties":{
            "area":{"type":"string","enum":["load","strength","speed","recovery","consistency","injury","matches","body"]},
            "title":{"type":"string"},"status":{"type":"string","enum":["good","watch","risk"]},
            "points":{"type":"array","maxItems":4,"items":{"type":"string"}}}}},
          "recommendations":{"type":"array","minItems":1,"maxItems":3,"items":{"type":"object","required":["title","why","action"],"properties":{
            "title":{"type":"string"},"why":{"type":"string"},"action":{"type":"string"}}}},
          "nextWeekFocus":{"type":"string"}}}
        """));

    public static readonly AiTool Programs = new("get_programs",
        "All training programs of the athlete and the full details of one (default: the active one): every day with every exercise and its prescription (sets, reps, distance/time, RPE, rest, %1RM, weekly steps, notes), the week plan, the current program week and adherence (how often each day was completed in the last 4 weeks, last date).",
        Schema("""{"type":"object","properties":{"programId":{"type":"integer","description":"Optional; default is the active program"}}}"""));

    public static readonly AiTool LoadMetrics = new("get_load_metrics",
        "Training load monitoring (session RPE x minutes): daily loads, 7-day acute and 28-day chronic load, rolling and EWMA acute:chronic ratio, monotony and strain (Foster), week-to-week change. Use for overload / injury-risk and readiness questions.",
        Schema("""{"type":"object","properties":{"days":{"type":"integer","description":"28-84 (default 42)"}}}"""));

    public static readonly AiTool ProposeProgramUpdateTool = new(ProposeProgramUpdate,
        "Propose changes to an EXISTING program (default: active). Send the complete new version of every day: keep dayId for days that stay (their history is kept), omit dayId for new days, leave out days to remove. The athlete sees a diff card and applies it. Call get_programs first.",
        Schema("""
        {"type":"object","required":["programId","days","changes"],"properties":{
          "programId":{"type":"integer"},
          "name":{"type":"string"},"weeks":{"type":"integer"},
          "changes":{"type":"array","maxItems":8,"items":{"type":"string"},"description":"Short list of what changes and why, in the athlete's language"},
          "days":{"type":"array","minItems":1,"maxItems":7,"items":{"type":"object","required":["name","exercises"],"properties":{
            "dayId":{"type":"integer"},"name":{"type":"string"},"notes":{"type":"string"},
            "exercises":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"object","required":["exerciseId","sets"],"properties":{
              "exerciseId":{"type":"integer"},"sets":{"type":"integer"},"repsMin":{"type":"integer"},"repsMax":{"type":"integer"},
              "distance":{"type":"number","description":"meters"},"time":{"type":"number","description":"seconds"},
              "targetRpe":{"type":"number"},"restSeconds":{"type":"integer"},"note":{"type":"string"}}}}}}}}}
        """));

    public static readonly IReadOnlyList<AiTool> DataTools = new[] { Programs, ExerciseHistory, PersonalRecords, TrainingSummary, LoadMetrics, WellnessTrend, MatchStats, SearchExercises };
    public static readonly IReadOnlyList<AiTool> ChatTools = DataTools.Concat(new[] { ProposeProgramTool, ProposeProgramUpdateTool, ProposeGoalTool, ProposeScheduleTool }).ToList();

    // ---------- Ausführung ----------

    /// <summary>Führt ein Werkzeug aus. Vorschläge landen in <paramref name="actions"/> (für die Karten im Client).</summary>
    public async Task<string> ExecuteAsync(int userId, AiToolUse use, List<JsonObject> actions, CancellationToken ct)
    {
        try
        {
            object result = use.Name switch
            {
                "get_programs" => await ProgramsAsync(userId, Int(use.Input, "programId"), ct),
                "get_load_metrics" => await LoadMetricsAsync(userId, Clamp(Int(use.Input, "days"), 28, 84, 42), ct),
                ProposeProgramUpdate => await ProgramUpdateActionAsync(userId, use.Input, actions, ct),
                "get_exercise_history" => await HistoryAsync(userId, Str(use.Input, "exercise") ?? string.Empty, Clamp(Int(use.Input, "weeks"), 1, 52, 12), ct),
                "get_personal_records" => await RecordsAsync(userId, Clamp(Int(use.Input, "limit"), 1, 30, 15), ct),
                "get_training_summary" => await SummaryAsync(userId, Clamp(Int(use.Input, "weeks"), 1, 26, 8), ct),
                "get_wellness_trend" => await WellnessAsync(userId, Clamp(Int(use.Input, "days"), 7, 90, 28), ct),
                "get_match_stats" => await MatchesAsync(userId, Clamp(Int(use.Input, "weeks"), 1, 52, 26), ct),
                "search_exercises" => await SearchAsync(userId, Str(use.Input, "query") ?? string.Empty, Clamp(Int(use.Input, "limit"), 1, 25, 15), ct),
                ProposeProgram => await ProgramActionAsync(userId, use.Input, 7, actions, ct),
                ProposeGoal => await GoalActionAsync(userId, use.Input, actions, ct),
                ProposeSchedule => ScheduleAction(use.Input, actions),
                _ => new { error = $"Unknown tool {use.Name}" },
            };
            var json = JsonSerializer.Serialize(result, JsonOpts);
            return json.Length <= MaxResultChars ? json : json[..MaxResultChars] + " ... (truncated)";
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            return JsonSerializer.Serialize(new { error = "Tool failed: " + e.Message }, JsonOpts);
        }
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    private DateTime Now => time.GetUtcNow().UtcDateTime;
    private static string Day(DateTime d) => d.ToString("yyyy-MM-dd ddd", CultureInfo.InvariantCulture);
    private static double R(double v, int digits = 1) => Math.Round(v, digits);

    /// <summary>Epley-Schätzung (nur bis 12 Wdh. aussagekräftig).</summary>
    public static double? E1Rm(double? weight, int? reps) =>
        weight is > 0 && reps is >= 1 and <= 12 ? (reps == 1 ? weight.Value : weight.Value * (1 + reps.Value / 30.0)) : null;

    private static string SetText(WorkoutSet s) =>
        s.Distance is { } d ? $"{R(d, 0)}m{(s.Time is { } t ? $" {R(t, 2)}s" : string.Empty)}"
        : s.Weight is null && s.Reps is null && s.Time is { } hold ? $"{R(hold, 0)}s"
        : $"{(s.Weight is > 0 ? R(s.Weight.Value, 2).ToString(CultureInfo.InvariantCulture) : "BW")}x{s.Reps}{(s.Rpe is { } rpe ? $"@{R(rpe)}" : string.Empty)}";

    private IQueryable<Workout> Workouts(int userId, DateTime since) =>
        db.Workouts.AsNoTracking().Where(w => w.UserId == userId && w.Date >= since).Include(w => w.Sets).ThenInclude(s => s.Exercise);

    private async Task<Exercise?> ResolveAsync(int userId, string query, CancellationToken ct)
    {
        var visible = db.Exercises.AsNoTracking().VisibleTo(userId);
        if (int.TryParse(query.Trim().TrimStart('#'), out var id)) return await visible.FirstOrDefaultAsync(e => e.Id == id, ct);
        var q = query.Trim().ToLowerInvariant();
        if (q.Length < 2) return null;
        return await visible.FirstOrDefaultAsync(e => e.Name.ToLower() == q, ct)
            ?? await visible.Where(e => e.Name.ToLower().Contains(q)).OrderBy(e => e.Name.Length).FirstOrDefaultAsync(ct);
    }

    private async Task<object> HistoryAsync(int userId, string query, int weeks, CancellationToken ct)
    {
        var ex = await ResolveAsync(userId, query, ct);
        if (ex is null) return new { error = $"No exercise matches '{query}'. Use search_exercises first." };
        var since = Now.AddDays(-7 * weeks);
        var sessions = await Workouts(userId, since)
            .Where(w => w.Sets.Any(s => s.ExerciseId == ex.Id))
            .OrderByDescending(w => w.Date).Take(30).ToListAsync(ct);

        var rows = sessions.Select(w =>
        {
            var sets = w.Sets.Where(s => s.ExerciseId == ex.Id).OrderBy(s => s.SetNumber).ToList();
            var work = sets.Where(s => !s.IsWarmup).ToList();
            if (work.Count == 0) work = sets;
            var best = work.Select(s => (Set: s, E1: E1Rm(s.Weight, s.Reps))).OrderByDescending(x => x.E1 ?? 0).First();
            var times = work.Where(s => s.Time is > 0 && s.Distance is > 0).Select(s => s.Time!.Value).ToList();
            return new
            {
                date = Day(w.Date),
                sets = string.Join(", ", work.Select(SetText)),
                warmupSets = sets.Count - work.Count,
                e1rm = best.E1 is { } e ? R(e) : (double?)null,
                tonnageKg = work.Sum(s => (s.Weight ?? 0) * (s.Reps ?? 0)) is var t and > 0 ? R(t, 0) : (double?)null,
                bestTime = times.Count > 0 ? R(times.Min(), 2) : (double?)null,
                sessionRpe = w.SessionRpe,
            };
        }).ToList();

        var withE1 = rows.Where(r => r.e1rm is not null).Reverse().ToList(); // alt -> neu
        object? trend = withE1.Count >= 2 ? new
        {
            firstE1rm = withE1[0].e1rm, firstDate = withE1[0].date,
            lastE1rm = withE1[^1].e1rm, lastDate = withE1[^1].date,
            changePercent = R((withE1[^1].e1rm!.Value / withE1[0].e1rm!.Value - 1) * 100),
            bestE1rm = withE1.Max(r => r.e1rm), sessionsSinceBest = withE1.Count - 1 - withE1.FindLastIndex(r => r.e1rm == withE1.Max(x => x.e1rm)),
        } : null;
        var timed = rows.Where(r => r.bestTime is not null).Reverse().ToList();
        object? speedTrend = timed.Count >= 2 ? new { firstBest = timed[0].bestTime, lastBest = timed[^1].bestTime, allTimeBest = timed.Min(r => r.bestTime) } : null;

        return new { exercise = new { ex.Id, ex.Name, tracking = ex.TrackingType.ToString(), ex.MuscleGroup }, weeks, sessionCount = rows.Count, trend, speedTrend, sessions = rows };
    }

    private async Task<object> RecordsAsync(int userId, int limit, CancellationToken ct)
    {
        var sets = await db.WorkoutSets.AsNoTracking()
            .Where(s => s.Workout.UserId == userId && !s.IsWarmup)
            .Select(s => new { s.ExerciseId, s.Exercise.Name, s.Exercise.TrackingType, s.Weight, s.Reps, s.Distance, s.Time, s.Workout.Date })
            .ToListAsync(ct);

        var strength = sets.Where(s => s.TrackingType == TrackingType.WeightReps && E1Rm(s.Weight, s.Reps) is not null)
            .GroupBy(s => s.Name)
            .Select(g => g.OrderByDescending(s => E1Rm(s.Weight, s.Reps)).First())
            .OrderByDescending(s => s.Date).Take(limit)
            .Select(s => new { exercise = s.Name, e1rm = R(E1Rm(s.Weight, s.Reps)!.Value), set = $"{s.Weight}x{s.Reps}", date = Day(s.Date) });
        var speed = sets.Where(s => s.TrackingType == TrackingType.DistanceTime && s.Distance is > 0 && s.Time is > 0)
            .GroupBy(s => (s.Name, Distance: Math.Round(s.Distance!.Value)))
            .Select(g => g.OrderBy(s => s.Time).First())
            .OrderByDescending(s => s.Date).Take(limit)
            .Select(s => new { exercise = s.Name, distanceM = R(s.Distance!.Value, 0), bestTimeS = R(s.Time!.Value, 2), date = Day(s.Date) });
        var holds = sets.Where(s => s.TrackingType == TrackingType.Duration && s.Time is > 0)
            .GroupBy(s => s.Name)
            .Select(g => g.OrderByDescending(s => s.Time).First())
            .OrderByDescending(s => s.Date).Take(limit)
            .Select(s => new { exercise = s.Name, bestS = R(s.Time!.Value, 0), date = Day(s.Date) });
        return new { strength, speed, holds };
    }

    private async Task<object> SummaryAsync(int userId, int weeks, CancellationToken ct)
    {
        var today = Now.Date;
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var start = monday.AddDays(-7 * (weeks - 1));
        var list = await Workouts(userId, start).ToListAsync(ct);

        var perWeek = Enumerable.Range(0, weeks).Select(i =>
        {
            var from = start.AddDays(7 * i);
            var ws = list.Where(w => w.Date >= from && w.Date < from.AddDays(7)).ToList();
            var work = ws.SelectMany(w => w.Sets).Where(s => !s.IsWarmup).ToList();
            return new
            {
                week = from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + (i == weeks - 1 ? " (current, incomplete)" : string.Empty),
                sessions = ws.Count,
                gym = ws.Count(w => w.WorkoutType == "Gym"),
                football = ws.Count(w => w.WorkoutType is "Football" or "Hybrid"),
                matches = ws.Count(w => w.WorkoutType == "Match"),
                workSets = work.Count,
                tonnageKg = R(work.Sum(s => (s.Weight ?? 0) * (s.Reps ?? 0)), 0),
                sprintReps = work.Count(s => s.Exercise.TrackingType == TrackingType.DistanceTime),
                loadAU = ws.Sum(w => (w.SessionRpe ?? 0) * (w.DurationSeconds ?? 0) / 60),
            };
        }).ToList();

        var fullWeeks = Math.Max(1, weeks - 1);
        var muscle = list.Where(w => w.Date < monday).SelectMany(w => w.Sets).Where(s => !s.IsWarmup && s.Exercise.MuscleGroup != null)
            .GroupBy(s => s.Exercise.MuscleGroup!)
            .ToDictionary(g => g.Key, g => R(g.Count() / (double)fullWeeks))
            .OrderByDescending(kv => kv.Value).ToDictionary(kv => kv.Key, kv => kv.Value);

        return new { weeks = perWeek, avgWorkSetsPerWeekByMuscle = muscle, totalSessions = list.Count };
    }

    private async Task<object> WellnessAsync(int userId, int days, CancellationToken ct)
    {
        var since = DateOnly.FromDateTime(Now.AddDays(-days));
        var entries = await db.Wellness.AsNoTracking().Where(w => w.UserId == userId && w.Date >= since).OrderByDescending(w => w.Date).ToListAsync(ct);
        if (entries.Count == 0) return new { days, count = 0 };
        double Avg(Func<WellnessEntry, double> f) => R(entries.Average(f));
        var hours = entries.Where(e => e.SleepHours is > 0).Select(e => e.SleepHours!.Value).ToList();
        return new
        {
            days, count = entries.Count,
            avg = new { sleep = Avg(e => e.Sleep), energy = Avg(e => e.Energy), soreness = Avg(e => e.Soreness), mood = Avg(e => e.Mood), sleepHours = hours.Count > 0 ? R(hours.Average()) : (double?)null },
            lowDays = entries.Count(e => (e.Sleep + e.Energy + e.Soreness + e.Mood) / 4.0 < 2.75),
            recent = entries.Take(10).Select(e => new { date = e.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), e.Sleep, e.Energy, e.Soreness, e.Mood, e.SleepHours, e.Note }),
        };
    }

    private async Task<object> MatchesAsync(int userId, int weeks, CancellationToken ct)
    {
        var since = Now.AddDays(-7 * weeks);
        var matches = await db.Workouts.AsNoTracking().Where(w => w.UserId == userId && w.WorkoutType == "Match" && w.Date >= since)
            .OrderByDescending(w => w.Date).Take(40)
            .Select(w => new { w.Date, w.DurationSeconds, w.Goals, w.Assists, w.Opponent, w.SessionRpe, w.Notes })
            .ToListAsync(ct);
        return new
        {
            weeks, count = matches.Count,
            goals = matches.Sum(m => m.Goals ?? 0), assists = matches.Sum(m => m.Assists ?? 0),
            matches = matches.Select(m => new { date = Day(m.Date), minutes = m.DurationSeconds / 60, m.Goals, m.Assists, m.Opponent, m.SessionRpe, notes = m.Notes is { Length: > 100 } n ? n[..100] : m.Notes }),
        };
    }

    private async Task<object> SearchAsync(int userId, string query, int limit, CancellationToken ct)
    {
        var q = query.Trim().ToLowerInvariant();
        var found = await db.Exercises.AsNoTracking().VisibleTo(userId)
            .Where(e => e.Name.ToLower().Contains(q) || (e.MuscleGroup != null && e.MuscleGroup.ToLower().Contains(q)) || e.Category.ToLower() == q)
            .OrderBy(e => e.Name).Take(limit)
            .Select(e => new { e.Id, e.Name, e.Category, e.MuscleGroup, e.TrackingType })
            .ToListAsync(ct);
        return found.Select(e => new { e.Id, e.Name, e.Category, e.MuscleGroup, tracking = e.TrackingType.ToString() });
    }

    private async Task<object> ProgramsAsync(int userId, int? programId, CancellationToken ct)
    {
        var programs = await db.Programs.AsNoTracking().Where(p => p.UserId == userId)
            .Include(p => p.Days).ThenInclude(d => d.Exercises).ThenInclude(x => x.Exercise)
            .OrderByDescending(p => p.IsActive).ThenByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        if (programs.Count == 0) return new { programs = Array.Empty<object>(), note = "The athlete has no program yet." };

        var list = programs.Select(p => new { p.Id, p.Name, p.Goal, p.Weeks, active = p.IsActive, template = p.TemplateKey, days = p.Days.Count });
        var chosen = programId is { } id ? programs.FirstOrDefault(p => p.Id == id) : programs.FirstOrDefault(p => p.IsActive);
        if (chosen is null) return new { programs = list, note = programId is null ? "No active program." : $"Program {programId} not found." };

        var since = Now.AddDays(-28);
        var dayIds = chosen.Days.Select(d => d.Id).ToList();
        var done = await db.Workouts.AsNoTracking()
            .Where(w => w.UserId == userId && w.ProgramDayId != null && dayIds.Contains(w.ProgramDayId.Value))
            .Select(w => new { DayId = w.ProgramDayId!.Value, w.Date })
            .ToListAsync(ct);
        string Week(int bits) => string.Join(", ", Enumerable.Range(0, 7).Where(d => (bits & (1 << d)) != 0).Select(d => CultureInfo.InvariantCulture.DateTimeFormat.AbbreviatedDayNames[(d + 1) % 7]));
        var currentWeek = chosen.StartedAt is { } start ? Math.Min(chosen.Weeks, (int)((Now - start).TotalDays / 7) + 1) : (int?)null;

        static string Target(ProgramExercise x) =>
            x.Distance is { } d ? $"{x.Sets}x{R(d, 0)}m"
            : x.Time is { } t ? $"{x.Sets}x{R(t, 0)}s"
            : $"{x.Sets}x{x.RepsMin}{(x.RepsMax is { } mx && mx != x.RepsMin ? $"-{mx}" : string.Empty)}";

        return new
        {
            programs = list,
            details = new
            {
                chosen.Id, chosen.Name, chosen.Goal, chosen.Weeks, active = chosen.IsActive, template = chosen.TemplateKey,
                startedAt = chosen.StartedAt is { } s ? Day(s) : null, currentWeek, chosen.CycleWeeks, chosen.DeloadEvery,
                weekPlan = chosen.TrainingDays == 0 && chosen.MatchDays == 0 ? "not set" : $"training: {Week(chosen.TrainingDays)}; match: {Week(chosen.MatchDays)}",
                days = chosen.Days.OrderBy(d => d.Position).Select(d => new
                {
                    dayId = d.Id, d.Name, d.Notes,
                    completedLast4Weeks = done.Count(w => w.DayId == d.Id && w.Date >= since),
                    lastDone = done.Where(w => w.DayId == d.Id).Select(w => (DateTime?)w.Date).Max() is { } last ? Day(last) : null,
                    exercises = d.Exercises.OrderBy(x => x.Position).Select(x => new
                    {
                        x.ExerciseId, name = x.Exercise.Name, tracking = x.Exercise.TrackingType.ToString(), muscle = x.Exercise.MuscleGroup,
                        target = Target(x), x.TargetRpe, x.RestSeconds, x.PercentOf1Rm, x.ProgressionStep, x.Note,
                        weekSteps = x.WeekSteps.Count == 0 ? null : string.Join("; ", x.WeekSteps.OrderBy(w => w.FromWeek).Select(w =>
                            $"from week {w.FromWeek}: {w.Sets?.ToString(CultureInfo.InvariantCulture) ?? "-"} sets{(w.RepsMin is { } rm ? $" x{rm}{(w.RepsMax is { } rx && rx != rm ? $"-{rx}" : string.Empty)}" : string.Empty)}{(w.PercentOf1Rm is { } pc ? $" @{pc}%" : string.Empty)}{(w.TargetRpe is { } tr ? $" RPE {tr}" : string.Empty)}")),
                    }),
                }),
            },
        };
    }

    /// <summary>Belastungssteuerung nach Foster (sRPE x Minuten) mit rollierendem und EWMA-Verhältnis (Williams et al. 2017).</summary>
    private async Task<object> LoadMetricsAsync(int userId, int days, CancellationToken ct)
    {
        var today = Now.Date;
        var start = today.AddDays(-(days + 27)); // Vorlauf für die chronische Last
        var sessions = await db.Workouts.AsNoTracking().Where(w => w.UserId == userId && w.Date >= start)
            .Select(w => new { w.Date, w.SessionRpe, w.DurationSeconds, w.WorkoutType }).ToListAsync(ct);
        var missingRpe = sessions.Count(w => w.SessionRpe is null || w.DurationSeconds is null);
        var total = (today - start).Days + 1;
        var daily = new double[total];
        foreach (var w in sessions)
        {
            var i = (w.Date.Date - start).Days;
            if (i >= 0 && i < total) daily[i] += (w.SessionRpe ?? 0) * (w.DurationSeconds ?? 0) / 60.0;
        }

        double Sum(int endIncl, int len) { double sum = 0; for (var i = Math.Max(0, endIncl - len + 1); i <= endIncl; i++) sum += daily[i]; return sum; }
        double aEw = 0, cEw = 0;
        const double la = 2.0 / (7 + 1), lc = 2.0 / (28 + 1);
        for (var i = 0; i < total; i++) { aEw = daily[i] * la + (1 - la) * aEw; cEw = daily[i] * lc + (1 - lc) * cEw; }
        var last = total - 1;
        var acute = Sum(last, 7);
        var chronicWeekly = Sum(last, 28) / 4;
        var week = Enumerable.Range(last - 6, 7).Select(i => daily[i]).ToArray();
        var mean = week.Average();
        var sd = Math.Sqrt(week.Select(x => (x - mean) * (x - mean)).Average());
        var monotony = sd > 0 ? mean / sd : (double?)null;

        var weeks = Enumerable.Range(0, days / 7).Select(k =>
        {
            var end = last - 7 * k;
            var load = Sum(end, 7);
            var prev = Sum(end - 7, 7);
            return new { weekEnding = Day(start.AddDays(end)), loadAU = R(load, 0), sessions = sessions.Count(w => (w.Date.Date - start).Days > end - 7 && (w.Date.Date - start).Days <= end), changePercent = prev > 0 ? R((load / prev - 1) * 100) : (double?)null };
        }).ToList();

        return new
        {
            unit = "AU = session RPE x minutes",
            acute7dAU = R(acute, 0), chronicWeeklyAvgAU = R(chronicWeekly, 0),
            acwrRolling = chronicWeekly > 0 ? R(acute / chronicWeekly, 2) : (double?)null,
            acwrEwma = cEw > 0 ? R(aEw / cEw, 2) : (double?)null,
            monotony7d = monotony is { } m ? R(m, 2) : (double?)null,
            strain7d = monotony is { } m2 ? R(acute * m2, 0) : (double?)null,
            sessionsWithoutRpeOrDuration = missingRpe,
            guide = "ACWR 0.8-1.3 sweet spot, >1.5 high risk; monotony >2 means too little variation; weekly increases above ~10-15% raise risk.",
            weeks,
            last14Days = Enumerable.Range(last - 13, 14).Select(i => new { day = Day(start.AddDays(i)), loadAU = R(daily[i], 0) }),
        };
    }

    /// <summary>Änderungen an einem bestehenden Programm vorschlagen (Diff-Karte im Client, angewendet per PUT /api/programs/{id}).</summary>
    private async Task<object> ProgramUpdateActionAsync(int userId, JsonElement input, List<JsonObject> actions, CancellationToken ct)
    {
        var id = Int(input, "programId");
        var program = await db.Programs.AsNoTracking().Where(p => p.UserId == userId && (id == null ? p.IsActive : p.Id == id))
            .Include(p => p.Days).ThenInclude(d => d.Exercises).FirstOrDefaultAsync(ct);
        if (program is null) return new { error = "Program not found. Call get_programs and use its id." };

        var (draft, _) = Sanitize(input, await CatalogAsync(userId, ct), 7, program);
        if (draft.Validate().HasErrors) return new { error = "The update is not valid (every day needs at least one catalog exercise). Fix and call again." };
        var changes = input.TryGetProperty("changes", out var ch) && ch.ValueKind == JsonValueKind.Array
            ? ch.EnumerateArray().Where(c => c.ValueKind == JsonValueKind.String).Select(c => Clip(c.GetString(), 200)).Where(c => c.Length > 0).Take(8).ToList()
            : new List<string>();
        actions.Add(new JsonObject
        {
            ["type"] = "programUpdate", ["programId"] = program.Id, ["programName"] = program.Name,
            ["program"] = JsonSerializer.SerializeToNode(draft, JsonOpts), ["changes"] = JsonSerializer.SerializeToNode(changes),
        });
        return new { shown = true, note = "The athlete sees a diff card and decides. Summarise the key changes and the reasoning; do not repeat every exercise." };
    }

    // ---------- Vorschläge (werden nur angezeigt, nie automatisch gespeichert) ----------

    public async Task<IReadOnlyDictionary<int, TrackingType>> CatalogAsync(int userId, CancellationToken ct) =>
        await db.Exercises.AsNoTracking().VisibleTo(userId).ToDictionaryAsync(e => e.Id, e => e.TrackingType, ct);

    private async Task<object> ProgramActionAsync(int userId, JsonElement input, int maxDays, List<JsonObject> actions, CancellationToken ct)
    {
        var (program, summary) = Sanitize(input, await CatalogAsync(userId, ct), maxDays);
        if (program.Validate().HasErrors) return new { error = "The program is not valid (each day needs at least one catalog exercise). Fix and call again." };
        actions.Add(new JsonObject { ["type"] = "program", ["program"] = JsonSerializer.SerializeToNode(program, JsonOpts), ["summary"] = summary });
        return new { shown = true, note = "The athlete sees the program as a card and decides. Briefly explain it in your answer; do not repeat every exercise." };
    }

    private async Task<object> GoalActionAsync(int userId, JsonElement input, List<JsonObject> actions, CancellationToken ct)
    {
        var id = Int(input, "exerciseId");
        var ex = id is null ? null : await db.Exercises.AsNoTracking().VisibleTo(userId).FirstOrDefaultAsync(e => e.Id == id, ct);
        if (ex is null || ex.TrackingType != TrackingType.WeightReps) return new { error = "Goals need a weight x reps exercise from the catalog." };
        var weight = Num(input, "targetWeight");
        var reps = Int(input, "targetReps");
        if (weight is not (> 0 and <= 500) || reps is not (>= 1 and <= 12)) return new { error = "targetWeight must be 1-500 kg and targetReps 1-12." };
        string? date = DateOnly.TryParseExact(Str(input, "targetDate") ?? string.Empty, "yyyy-MM-dd", out var d) && d > DateOnly.FromDateTime(Now) ? d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
        actions.Add(new JsonObject
        {
            ["type"] = "goal", ["exerciseId"] = ex.Id, ["exerciseName"] = ex.Name,
            ["targetWeight"] = Math.Round(weight.Value * 4) / 4, ["targetReps"] = reps, ["targetDate"] = date, ["reason"] = Clip(Str(input, "reason"), 300),
        });
        return new { shown = true, note = "The athlete sees the goal as a card and decides." };
    }

    private static object ScheduleAction(JsonElement input, List<JsonObject> actions)
    {
        static int Mask(JsonElement o, string name) =>
            o.TryGetProperty(name, out var a) && a.ValueKind == JsonValueKind.Array
                ? a.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Number).Select(x => x.GetInt32()).Where(x => x is >= 0 and <= 6).Aggregate(0, (m, x) => m | (1 << x))
                : 0;
        var training = Mask(input, "trainingDays");
        var match = Mask(input, "matchDays");
        if ((training & match) != 0) return new { error = "A day cannot be both a training and a match day." };
        actions.Add(new JsonObject { ["type"] = "schedule", ["trainingDays"] = training, ["matchDays"] = match, ["reason"] = Clip(Str(input, "reason"), 300) });
        return new { shown = true, note = "The athlete sees the week plan as a card and decides." };
    }

    // ---------- Absicherung eines Plan-Vorschlags ----------

    /// <summary>
    /// Macht aus einem KI-Vorschlag ein gültiges <see cref="ProgramInput"/>: unbekannte Übungen fliegen raus, Werte werden in
    /// sinnvolle Grenzen gebracht, fehlende Vorgaben passend zur Erfassungsart ergänzt. Der Nutzer sieht den Plan vor dem Speichern.
    /// </summary>
    public static (ProgramInput Program, string Summary) Sanitize(JsonElement json, IReadOnlyDictionary<int, TrackingType> exercises, int maxDays, TrainingProgram? existing = null)
    {
        var days = new List<ProgramDayInput>();
        var usedDayIds = new HashSet<int>();
        if (json.TryGetProperty("days", out var daysJson) && daysJson.ValueKind == JsonValueKind.Array)
            foreach (var d in daysJson.EnumerateArray().Take(Math.Clamp(maxDays, 1, ProgramInput.MaxDays)))
            {
                if (d.ValueKind != JsonValueKind.Object || !d.TryGetProperty("exercises", out var xs) || xs.ValueKind != JsonValueKind.Array) continue;
                // Bestehender Tag (nur aus genau diesem Programm, jeder höchstens einmal): Verlauf bleibt verknüpft
                var oldDay = existing is not null && Int(d, "dayId") is { } dayId && usedDayIds.Add(dayId) ? existing.Days.FirstOrDefault(x => x.Id == dayId) : null;
                var list = new List<ProgramExerciseInput>();
                foreach (var x in xs.EnumerateArray())
                {
                    if (list.Count >= ProgramInput.MaxExercisesPerDay || x.ValueKind != JsonValueKind.Object) break;
                    if (Int(x, "exerciseId") is not { } id || !exercises.TryGetValue(id, out var tracking)) continue;
                    if (list.Any(e => e.ExerciseId == id)) continue;
                    var sets = Math.Clamp(Int(x, "sets") ?? 3, 1, 10);
                    int? repsMin = null, repsMax = null;
                    double? distance = null, seconds = null;
                    switch (tracking)
                    {
                        case TrackingType.DistanceTime:
                            distance = Math.Clamp(Num(x, "distance") ?? 30, 5, 5_000);
                            break;
                        case TrackingType.Duration:
                            seconds = Math.Clamp(Num(x, "time") ?? 30, 5, 600);
                            break;
                        default:
                            repsMin = Math.Clamp(Int(x, "repsMin") ?? Int(x, "repsMax") ?? 8, 1, 30);
                            repsMax = Math.Clamp(Int(x, "repsMax") ?? repsMin.Value, repsMin.Value, 30);
                            break;
                    }
                    var rpe = Num(x, "targetRpe") is { } r ? Math.Clamp(Math.Round(r * 2) / 2, 5, 10) : (double?)null;
                    var rest = Int(x, "restSeconds") is { } s ? Math.Clamp(s, 0, 600) : (int?)null;
                    var note = Clip(Str(x, "note"), 120);
                    // Gleiche Übung am selben Tag: Progression (Schritt, %1RM, Wochenstufen) aus dem Programm übernehmen
                    var old = oldDay?.Exercises.FirstOrDefault(e => e.ExerciseId == id);
                    list.Add(new ProgramExerciseInput(id, sets, repsMin, repsMax, distance, seconds, rpe, rest, old?.ProgressionStep, old?.PercentOf1Rm,
                        note.Length > 0 ? note : old?.Note, old is { WeekSteps.Count: > 0 } ? old.WeekSteps.Select(WeekStepDto.From).ToList() : null));
                }
                if (list.Count == 0) continue;
                var name = Clip(Str(d, "name"), 40);
                var notes = Clip(Str(d, "notes"), 200);
                days.Add(new ProgramDayInput(oldDay?.Id, name.Length > 0 ? name : oldDay?.Name ?? $"Day {days.Count + 1}", notes.Length > 0 ? notes : null, list));
            }

        var goal = Str(json, "goal") is { } g && ProgramInput.AllowedGoals.Contains(g) ? g : existing?.Goal ?? "General";
        var programName = Clip(Str(json, "name"), 60);
        if (programName.Length < 2) programName = existing?.Name ?? "AI plan";
        var weeks = Math.Clamp(Int(json, "weeks") ?? existing?.Weeks ?? 6, 1, 16);
        return (new ProgramInput(programName, goal, weeks, days, existing?.CycleWeeks, existing?.DeloadEvery), Clip(Str(json, "summary"), 600));
    }

    // ---------- JSON-Hilfen ----------

    public static string Clip(string? s, int max) { var t = (s ?? string.Empty).Trim(); return t.Length <= max ? t : t[..max].TrimEnd(); }
    public static int? Int(JsonElement o, string name) => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d) ? (int)Math.Round(d) : null;
    public static double? Num(JsonElement o, string name) => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
    public static string? Str(JsonElement o, string name) => o.ValueKind == JsonValueKind.Object && o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static int Clamp(int? v, int min, int max, int fallback) => Math.Clamp(v ?? fallback, min, max);
}
