import Capacitor
import HealthKit

/// Apple Health lesen (nur lesen, nichts schreiben): Tageswerte (Schlaf, Ruhepuls, HRV, Schritte) und Workouts der Uhr
/// (Dauer, Distanz, Puls, Höchstgeschwindigkeit, Sprints). Sprints = Abschnitte über 25 km/h aus den Laufgeschwindigkeits-
/// Proben (iOS 16+, nur wenn die Uhr sie aufzeichnet).
@objc(HealthPlugin)
public class HealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthPlugin"
    public let jsName = "Health"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dailySummaries", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "workouts", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    private static let sprintSpeed = 25.0 / 3.6 // m/s

    private var readTypes: Set<HKObjectType> {
        var set: Set<HKObjectType> = [HKObjectType.workoutType()]
        let quantities: [HKQuantityTypeIdentifier] = [.heartRate, .restingHeartRate, .heartRateVariabilitySDNN, .stepCount, .distanceWalkingRunning, .activeEnergyBurned]
        for id in quantities { if let t = HKObjectType.quantityType(forIdentifier: id) { set.insert(t) } }
        if #available(iOS 16.0, *), let speed = HKObjectType.quantityType(forIdentifier: .runningSpeed) { set.insert(speed) }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { set.insert(sleep) }
        return set
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.reject("unavailable"); return }
        store.requestAuthorization(toShare: nil, read: readTypes) { ok, error in
            if let error = error { call.reject(error.localizedDescription); return }
            // iOS verrät nicht, welche Lese-Rechte erteilt wurden - nur ob der Dialog lief
            call.resolve(["granted": ok])
        }
    }

    // MARK: - Tageswerte

    @objc func dailySummaries(_ call: CAPPluginCall) {
        let days = max(1, min(60, call.getInt("days") ?? 14))
        let cal = Calendar.current
        let end = cal.startOfDay(for: Date()).addingTimeInterval(86_400)
        let start = cal.date(byAdding: .day, value: -days, to: end)!
        let group = DispatchGroup()
        var steps: [String: Double] = [:], rhr: [String: Double] = [:], hrv: [String: Double] = [:], sleep: [String: Double] = [:]
        let lock = NSLock()

        func collect(_ id: HKQuantityTypeIdentifier, _ options: HKStatisticsOptions, _ unit: HKUnit, into apply: @escaping (String, Double) -> Void) {
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let q = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                                                options: options, anchorDate: start, intervalComponents: DateComponents(day: 1))
            q.initialResultsHandler = { _, results, _ in
                results?.enumerateStatistics(from: start, to: end) { s, _ in
                    let value = options.contains(.cumulativeSum) ? s.sumQuantity()?.doubleValue(for: unit) : s.averageQuantity()?.doubleValue(for: unit)
                    if let v = value { lock.lock(); apply(Self.key(s.startDate), v); lock.unlock() }
                }
                group.leave()
            }
            store.execute(q)
        }
        collect(.stepCount, .cumulativeSum, .count()) { steps[$0] = $1 }
        collect(.restingHeartRate, .discreteAverage, HKUnit.count().unitDivided(by: .minute())) { rhr[$0] = $1 }
        collect(.heartRateVariabilitySDNN, .discreteAverage, .secondUnit(with: .milli)) { hrv[$0] = $1 }

        // Schlaf: Zeiten "schlafend" je Nacht, dem Aufwach-Tag zugeordnet; überlappende Quellen (iPhone + Uhr) zusammengeführt
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let q = HKSampleQuery(sampleType: sleepType, predicate: HKQuery.predicateForSamples(withStart: start.addingTimeInterval(-43_200), end: end),
                                  limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, _ in
                let asleep = (samples as? [HKCategorySample] ?? []).filter { Self.isAsleep($0.value) }
                var byDay: [String: [(Date, Date)]] = [:]
                for s in asleep { byDay[Self.key(s.endDate), default: []].append((s.startDate, s.endDate)) }
                for (day, ranges) in byDay {
                    var total = 0.0, curStart: Date?, curEnd: Date?
                    for r in ranges.sorted(by: { $0.0 < $1.0 }) {
                        if let e = curEnd, r.0 <= e { curEnd = max(e, r.1) } else {
                            if let s0 = curStart, let e0 = curEnd { total += e0.timeIntervalSince(s0) }
                            curStart = r.0; curEnd = r.1
                        }
                    }
                    if let s0 = curStart, let e0 = curEnd { total += e0.timeIntervalSince(s0) }
                    lock.lock(); sleep[day] = total / 60; lock.unlock()
                }
                group.leave()
            }
            store.execute(q)
        }

        group.notify(queue: .main) {
            var out: [[String: Any]] = []
            for i in 0..<days {
                let d = cal.date(byAdding: .day, value: i, to: start)!
                let k = Self.key(d)
                var row: [String: Any] = ["day": k]
                if let v = sleep[k], v >= 60 { row["sleepMinutes"] = Int(v.rounded()) }
                if let v = rhr[k] { row["restingHr"] = Int(v.rounded()) }
                if let v = hrv[k] { row["hrv"] = Int(v.rounded()) }
                if let v = steps[k], v > 0 { row["steps"] = Int(v.rounded()) }
                if row.count > 1 { out.append(row) }
            }
            call.resolve(["days": out])
        }
    }

    private static func isAsleep(_ value: Int) -> Bool {
        if #available(iOS 16.0, *) {
            return [HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue, HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue, HKCategoryValueSleepAnalysis.asleepREM.rawValue].contains(value)
        }
        return value == HKCategoryValueSleepAnalysis.asleep.rawValue
    }

    private static func key(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: - Workouts

    @objc func workouts(_ call: CAPPluginCall) {
        let days = max(1, min(60, call.getInt("days") ?? 14))
        let start = Date().addingTimeInterval(-Double(days) * 86_400)
        let q = HKSampleQuery(sampleType: .workoutType(), predicate: HKQuery.predicateForSamples(withStart: start, end: Date()),
                              limit: 100, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { [weak self] _, samples, error in
            guard let self = self else { return }
            if let error = error { call.reject(error.localizedDescription); return }
            let list = (samples as? [HKWorkout]) ?? []
            let formatter = ISO8601DateFormatter()
            var rows: [[String: Any]] = list.map { w in
                var row: [String: Any] = [
                    "start": formatter.string(from: w.startDate),
                    "end": formatter.string(from: w.endDate),
                    "durationSeconds": Int(w.duration.rounded()),
                    "activity": Self.activity(w.workoutActivityType),
                ]
                if let d = w.totalDistance?.doubleValue(for: .meter()), d > 0 { row["distanceM"] = Int(d.rounded()) }
                if let e = w.totalEnergyBurned?.doubleValue(for: .kilocalorie()), e > 0 { row["calories"] = Int(e.rounded()) }
                return row
            }
            let group = DispatchGroup()
            // Alle Ergänzungen auf dem Main-Thread: rows wird nie gleichzeitig verändert
            DispatchQueue.main.async {
                for (i, w) in list.enumerated() {
                    let predicate = HKQuery.predicateForSamples(withStart: w.startDate, end: w.endDate, options: .strictStartDate)
                    if let hr = HKQuantityType.quantityType(forIdentifier: .heartRate) {
                        group.enter()
                        self.store.execute(HKStatisticsQuery(quantityType: hr, quantitySamplePredicate: predicate, options: [.discreteAverage, .discreteMax]) { _, s, _ in
                            let bpm = HKUnit.count().unitDivided(by: .minute())
                            let avg = s?.averageQuantity()?.doubleValue(for: bpm)
                            let top = s?.maximumQuantity()?.doubleValue(for: bpm)
                            DispatchQueue.main.async {
                                if let avg = avg { rows[i]["avgHr"] = Int(avg.rounded()) }
                                if let top = top { rows[i]["maxHr"] = Int(top.rounded()) }
                                group.leave()
                            }
                        })
                    }
                    if rows[i]["distanceM"] == nil, let dist = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning) {
                        group.enter()
                        self.store.execute(HKStatisticsQuery(quantityType: dist, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, s, _ in
                            let m = s?.sumQuantity()?.doubleValue(for: .meter())
                            DispatchQueue.main.async {
                                if let m = m, m > 0 { rows[i]["distanceM"] = Int(m.rounded()) }
                                group.leave()
                            }
                        })
                    }
                    if #available(iOS 16.0, *), let speed = HKQuantityType.quantityType(forIdentifier: .runningSpeed) {
                        group.enter()
                        self.store.execute(HKSampleQuery(sampleType: speed, predicate: predicate, limit: HKObjectQueryNoLimit,
                                                         sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, _ in
                            let mps = HKUnit.meter().unitDivided(by: .second())
                            let values = (samples as? [HKQuantitySample] ?? []).map { $0.quantity.doubleValue(for: mps) }
                            DispatchQueue.main.async {
                                if let top = values.max(), top > 0 {
                                    rows[i]["maxSpeedKmh"] = (top * 3.6 * 10).rounded() / 10
                                    // Sprint = Übergang unter -> über 25 km/h (mit kleiner Hysterese)
                                    var count = 0, above = false
                                    for v in values {
                                        if v >= Self.sprintSpeed { if !above { count += 1 }; above = true } else if v < Self.sprintSpeed * 0.85 { above = false }
                                    }
                                    rows[i]["sprints"] = count
                                }
                                group.leave()
                            }
                        })
                    }
                }
                group.notify(queue: .main) { call.resolve(["workouts": rows]) }
            }
        }
        store.execute(q)
    }

    private static func activity(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .soccer: return "soccer"
        case .running: return "running"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "strength"
        case .highIntensityIntervalTraining: return "hiit"
        case .cycling: return "cycling"
        default: return "other"
        }
    }
}
