import UIKit
import Capacitor

/// Eigener View-Controller, damit die App-eigenen Plugins (ohne npm-Paket) beim Start registriert werden.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(AudioDuckPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(HealthPlugin())
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            // iOS 26 legt oben und unten eine weiche Unschärfe über den Inhalt (Scroll Edge Effect). Unsere Dialoge reichen
            // bis knapp unter die Statusleiste - der Schleier lag über dem Schließen-Knopf und machte Text unscharf.
            // Die App zeichnet ihre Kopfzeilen selbst (deckend), daher hier aus.
            webView?.scrollView.topEdgeEffect.isHidden = true
            webView?.scrollView.bottomEdgeEffect.isHidden = true
        }
        #endif
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
