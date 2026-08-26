import UIKit
import Capacitor

// Capacitor 6 stopped scanning the runtime for plugins that live in the app
// target, so a local plugin has to introduce itself. Without this the JS side
// finds no ShowAudio and silently falls back to the WebView, which is the
// behaviour this plugin exists to replace.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ShowAudioPlugin())
    }
}
