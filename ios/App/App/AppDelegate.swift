import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure AVAudioSession for playback (audio plays even with the silent switch on)
        activateAudioSession()
        observeAudioInterruptions()

        // Live-show controller: keep the iPad awake so music never stops mid-performance
        application.isIdleTimerDisabled = true

        return true
    }

    private func activateAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("AVAudioSession configuration error: \(error)")
        }
    }

    // A show does not stop because someone locked the iPad or switched apps.
    // UIBackgroundModes declares the intent; this keeps the session alive
    // through the things that would otherwise end it silently - a phone call,
    // Siri, or a headphone yanked out of the jack.
    private func observeAudioInterruptions() {
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()

        center.addObserver(forName: AVAudioSession.interruptionNotification,
                           object: session, queue: .main) { [weak self] notification in
            guard let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            if type == .ended {
                self?.activateAudioSession()
                self?.resumePlaybackInWebLayer()
            }
        }

        center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                           object: session, queue: .main) { [weak self] _ in
            self?.activateAudioSession()
            self?.resumePlaybackInWebLayer()
        }
    }

    // The web layer owns what is playing; nudge it rather than guessing here.
    private func resumePlaybackInWebLayer() {
        guard let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge else { return }
        bridge.triggerWindowJSEvent(eventName: "dreamliveAudioSessionRestored")
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Deliberately nothing: with the audio background mode declared and the
        // session already active, playback continues on the lock screen. Tearing
        // anything down here is what would stop the show.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Reclaim the audio session after an interruption while we were backgrounded.
        // Without this, playback resumes into a dead session and
        // tracks appear to play with no sound.
        activateAudioSession()
        application.isIdleTimerDisabled = true
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
