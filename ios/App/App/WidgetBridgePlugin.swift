import Capacitor
import WidgetKit

/// Daten für das Home-Bildschirm-Widget: die Web-App schickt einen fertigen Schnappschuss (JSON, 7 Tage) - er landet in
/// der gemeinsamen App-Gruppe, das Widget liest ihn von dort und wird neu geladen.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    static let appGroup = "group.com.took1s.sprintlog"
    static let key = "widget.snapshot"

    @objc func update(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.utf8.count < 200_000 else {
            call.reject("json missing or too large")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("app group unavailable")
            return
        }
        // Nur neu laden, wenn sich etwas geändert hat (iOS begrenzt die Anzahl der Neuladungen)
        if defaults.string(forKey: Self.key) != json {
            defaults.set(json, forKey: Self.key)
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.key)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
