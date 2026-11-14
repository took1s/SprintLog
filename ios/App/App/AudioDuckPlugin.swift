import AVFoundation
import Capacitor

/// Musik anderer Apps (Spotify, Apple Music ...) kurz vor einem Signal leiser stellen und danach wieder freigeben.
/// Grundzustand: .ambient + .mixWithOthers - unsere Töne unterbrechen laufende Musik nie.
@objc(AudioDuckPlugin)
public class AudioDuckPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioDuckPlugin"
    public let jsName = "AudioDuck"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "duck", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
    ]

    private let session = AVAudioSession.sharedInstance()

    override public func load() {
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
    }

    @objc func duck(_ call: CAPPluginCall) {
        do {
            // .playback statt .ambient: Signal auch bei Stummschalter hörbar, andere Audio-Quellen werden gedämpft
            try session.setCategory(.playback, mode: .default, options: [.duckOthers])
            try session.setActive(true)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        do {
            // notifyOthersOnDeactivation: die Musik-App bekommt Bescheid und dreht wieder auf
            try session.setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            // Läuft noch Audio-I/O, scheitert das Deaktivieren - Kategorie trotzdem zurücksetzen
        }
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        call.resolve()
    }
}
