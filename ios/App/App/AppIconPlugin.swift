import UIKit
import Capacitor

/// Eigener View-Controller, damit die App-eigenen Plugins (ohne npm-Paket) beim Start registriert werden.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppIconPlugin())
    }
}

/// Wechselt das App-Icon auf dem Home-Bildschirm (Standard <-> Saison-Icon).
/// iOS zeigt danach selbst kurz einen Hinweis an - das lässt sich nicht abschalten.
@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getName", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setName", returnType: CAPPluginReturnPromise),
    ]

    /// Nur Icons, die wirklich im Asset-Katalog liegen (ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES).
    private let allowed: Set<String> = ["AppIcon-Halloween"]

    @objc func getName(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "name": UIApplication.shared.alternateIconName ?? "",
                "supported": UIApplication.shared.supportsAlternateIcons,
            ])
        }
    }

    @objc func setName(_ call: CAPPluginCall) {
        let raw = call.getString("name") ?? ""
        let name: String? = raw.isEmpty ? nil : raw
        if let name = name, !allowed.contains(name) {
            call.reject("Unknown icon")
            return
        }
        DispatchQueue.main.async {
            let app = UIApplication.shared
            guard app.supportsAlternateIcons else { call.reject("Alternate icons not supported"); return }
            if app.alternateIconName == name { call.resolve(["changed": false]); return }
            app.setAlternateIconName(name) { error in
                if let error = error { call.reject(error.localizedDescription) } else { call.resolve(["changed": true]) }
            }
        }
    }
}
