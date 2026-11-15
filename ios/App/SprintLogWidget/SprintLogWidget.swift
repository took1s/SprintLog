import SwiftUI
import WidgetKit

// SprintLog-Widget: Einheit des Tages und Routinen mit Fortschrittsring. Daten schreibt die App als Schnappschuss der
// nächsten 7 Tage in die App-Gruppe (WidgetBridgePlugin) - die Timeline hat einen Eintrag je Tag ab Mitternacht,
// das Widget stimmt also auch, wenn die App ein paar Tage nicht geöffnet wurde. Texte und Theme-Farben kommen aus der App.

private let appGroup = "group.com.took1s.sprintlog"
private let snapshotKey = "widget.snapshot"

// MARK: - Daten

struct WidgetSnapshot: Decodable {
    struct Session: Decodable { let kind: String; let label: String; let title: String? }
    struct Routine: Decodable { let title: String; let done: Int; let total: Int; let next: String? }
    struct Day: Decodable { let day: String; let session: Session; let routines: [Routine] }
    struct Colors: Decodable { let bg: String; let fg: String; let muted: String; let accent: String; let success: String }
    struct Labels: Decodable { let routines: String; let allDone: String; let none: String; let next: String }
    let days: [Day]
    let colors: Colors
    let labels: Labels

    static func load() -> WidgetSnapshot? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey), let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    static let preview = WidgetSnapshot(
        days: [Day(day: dayKey(Date()), session: Session(kind: "training", label: "Training day", title: "Speed & agility"),
                   routines: [Routine(title: "Hamstring rehab", done: 1, total: 1, next: nil), Routine(title: "Stretching", done: 1, total: 3, next: "14:00"),
                              Routine(title: "Ankle prevention", done: 0, total: 1, next: "19:00")])],
        colors: Colors(bg: "28 22 34", fg: "245 240 250", muted: "150 140 160", accent: "255 122 26", success: "52 211 153"),
        labels: Labels(routines: "Routines", allDone: "All done for today", none: "No routines today", next: "Next"))
}

func dayKey(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

extension Color {
    /// "r g b" wie in den CSS-Variablen der App.
    init(rgb: String, fallback: Color) {
        let parts = rgb.split(separator: " ").compactMap { Double($0) }
        if parts.count == 3 { self.init(red: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255) } else { self = fallback }
    }
}

// MARK: - Timeline

struct DayEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let day: WidgetSnapshot.Day?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), snapshot: .preview, day: WidgetSnapshot.preview.days.first)
    }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        if context.isPreview { completion(placeholder(in: context)); return }
        let s = WidgetSnapshot.load()
        completion(DayEntry(date: Date(), snapshot: s, day: s?.days.first { $0.day == dayKey(Date()) }))
    }

    /// Ein Eintrag jetzt und je einer ab Mitternacht für die folgenden Tage des Schnappschusses.
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let s = WidgetSnapshot.load()
        let calendar = Calendar.current
        let now = Date()
        var entries = [DayEntry(date: now, snapshot: s, day: s?.days.first { $0.day == dayKey(now) })]
        for offset in 1...7 {
            guard let date = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) else { continue }
            entries.append(DayEntry(date: date, snapshot: s, day: s?.days.first { $0.day == dayKey(date) }))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Ansicht

struct ProgressRing: View {
    let done: Int
    let total: Int
    let accent: Color
    let success: Color
    let fg: Color
    let size: CGFloat

    var body: some View {
        let fraction = total > 0 ? min(1, Double(done) / Double(total)) : 0
        let complete = total > 0 && done >= total
        ZStack {
            Circle().stroke(fg.opacity(0.12), lineWidth: size * 0.11)
            Circle().trim(from: 0, to: fraction)
                .stroke(complete ? success : accent, style: StrokeStyle(lineWidth: size * 0.11, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if complete {
                Image(systemName: "checkmark").font(.system(size: size * 0.32, weight: .heavy)).foregroundColor(success)
            } else {
                Text("\(done)/\(total)").font(.system(size: size * 0.24, weight: .heavy, design: .rounded)).foregroundColor(fg).minimumScaleFactor(0.6)
            }
        }
        .frame(width: size, height: size)
    }
}

struct SprintLogWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: DayEntry

    private var colors: WidgetSnapshot.Colors { (entry.snapshot ?? .preview).colors }
    private var bg: Color { Color(rgb: colors.bg, fallback: Color(white: 0.1)) }
    private var fg: Color { Color(rgb: colors.fg, fallback: .white) }
    private var muted: Color { Color(rgb: colors.muted, fallback: .gray) }
    private var accent: Color { Color(rgb: colors.accent, fallback: .orange) }
    private var success: Color { Color(rgb: colors.success, fallback: .green) }

    private var routines: [WidgetSnapshot.Routine] { entry.day?.routines ?? [] }
    private var doneRoutines: Int { routines.filter { $0.done >= $0.total }.count }

    var body: some View {
        Group {
            if entry.snapshot == nil || entry.day == nil {
                emptyView
            } else if family == .systemSmall {
                smallView
            } else {
                mediumView
            }
        }
        .widgetBackground(bg)
    }

    private var header: some View {
        HStack(spacing: 5) {
            Circle().fill(accent).frame(width: 6, height: 6)
            Text("SPRINTLOG").font(.system(size: 10, weight: .heavy)).tracking(1.2).foregroundColor(accent)
        }
    }

    private var sessionView: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(entry.day?.session.label ?? "").font(.system(size: 13, weight: .bold)).foregroundColor(fg).lineLimit(1)
            if let title = entry.day?.session.title {
                Text(title).font(.system(size: 11, weight: .medium)).foregroundColor(muted).lineLimit(1)
            }
        }
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            Spacer(minLength: 0)
            HStack(alignment: .center, spacing: 10) {
                ProgressRing(done: doneRoutines, total: routines.count, accent: accent, success: success, fg: fg, size: 46)
                VStack(alignment: .leading, spacing: 1) {
                    Text((entry.snapshot ?? .preview).labels.routines).font(.system(size: 10, weight: .bold)).foregroundColor(muted).lineLimit(1)
                    if let next = routines.first(where: { $0.done < $0.total })?.next {
                        Text(next).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundColor(fg)
                    }
                }
            }
            Spacer(minLength: 0)
            sessionView
        }
    }

    private var mediumView: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                header
                Spacer(minLength: 0)
                ProgressRing(done: doneRoutines, total: routines.count, accent: accent, success: success, fg: fg, size: 54)
                Spacer(minLength: 0)
                sessionView
            }
            .frame(width: 112, alignment: .leading)
            VStack(alignment: .leading, spacing: 7) {
                Text((entry.snapshot ?? .preview).labels.routines.uppercased()).font(.system(size: 10, weight: .heavy)).tracking(1).foregroundColor(muted)
                if routines.isEmpty {
                    Text((entry.snapshot ?? .preview).labels.none).font(.system(size: 13, weight: .semibold)).foregroundColor(muted)
                } else if doneRoutines == routines.count {
                    Text((entry.snapshot ?? .preview).labels.allDone).font(.system(size: 13, weight: .bold)).foregroundColor(success)
                }
                ForEach(Array(routines.prefix(3).enumerated()), id: \.offset) { _, r in
                    HStack(spacing: 8) {
                        Image(systemName: r.done >= r.total ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 15, weight: .semibold)).foregroundColor(r.done >= r.total ? success : muted)
                        Text(r.title).font(.system(size: 13, weight: .semibold)).foregroundColor(r.done >= r.total ? muted : fg).lineLimit(1)
                        Spacer(minLength: 4)
                        if r.total > 1 && r.done < r.total {
                            Text("\(r.done)/\(r.total)").font(.system(size: 11, weight: .heavy, design: .rounded)).foregroundColor(accent)
                        } else if let next = r.next, r.done < r.total {
                            Text(next).font(.system(size: 11, weight: .bold, design: .rounded)).foregroundColor(muted)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            Spacer(minLength: 0)
            Image(systemName: "bolt.fill").font(.system(size: 26, weight: .semibold)).foregroundColor(accent)
            Text("SprintLog").font(.system(size: 15, weight: .heavy)).foregroundColor(fg)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    /// iOS 17+: Hintergrund über containerBackground (sonst Hinweis "adopt containerBackground"), davor wie bisher.
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(color, for: .widget)
        } else {
            self.padding().background(color)
        }
    }
}

// MARK: - Widget

@main
struct SprintLogWidget: Widget {
    let kind = "SprintLogToday"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SprintLogWidgetView(entry: entry)
        }
        .configurationDisplayName("SprintLog")
        .description("Routines and today's training.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
