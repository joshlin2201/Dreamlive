import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

// Why this exists.
//
// A show controller on iPad needs three things at once, and the web layer can
// only ever give two of them:
//
//   - Fades. iOS ignores writes to HTMLMediaElement.volume, so the only way to
//     change level in a WebView is to route playback through a Web Audio gain
//     node.
//   - Playback that survives the home button and the lock screen. WebKit
//     suspends an AudioContext when the app leaves the foreground, so anything
//     routed through the graph stops. Only plain element playback keeps going.
//   - Lock screen and Control Center transport. WebKit does not register Web
//     Audio with the media remote system at all.
//
// Routing through the graph buys fades and loses the other two. Not routing
// buys the other two and loses fades. There is no third option inside the
// WebView, so playback lives out here instead: AVAudioPlayer's volume is
// writable, setVolume(_:fadeDuration:) is a hardware fade, and an AVAudioPlayer
// under a .playback session with the audio background mode keeps playing on the
// lock screen and answers the remote transport.
@objc(ShowAudioPlugin)
public class ShowAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShowAudioPlugin"
    public let jsName = "ShowAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNowPlaying", returnType: CAPPluginReturnPromise),
    ]

    private var players: [String: AVAudioPlayer] = [:]
    private var endObservers: [String: Any] = [:]
    private let queue = DispatchQueue(label: "com.joshlin.dreamlive.showaudio")
    private var remoteWired = false

    // MARK: - Files

    // A track id can be a library id or a whole blob: URL. Either way it has to
    // become one safe filename - the slashes in a URL would otherwise be read as
    // folders that do not exist.
    private func fileName(for id: String) -> String {
        let allowed = CharacterSet.alphanumerics
        let cleaned = String(id.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
        let trimmed = cleaned.count > 80 ? String(cleaned.suffix(80)) : cleaned
        return "\(trimmed)-\(abs(id.hashValue)).audio"
    }

    private func trackDirectory() throws -> URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("show-audio", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    // The web layer holds the audio as a blob in IndexedDB. Native playback
    // needs a file, so a track is written out once and reused after that.
    @objc func write(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let base64 = call.getString("data") else {
            call.reject("write needs an id and data")
            return
        }
        queue.async {
            do {
                let dir = try self.trackDirectory()
                let url = dir.appendingPathComponent(self.fileName(for: id))
                if !FileManager.default.fileExists(atPath: url.path) {
                    guard let bytes = Data(base64Encoded: base64) else {
                        call.reject("audio data was not valid base64")
                        return
                    }
                    try bytes.write(to: url, options: .atomic)
                }
                call.resolve(["path": url.path])
            } catch {
                call.reject("could not store the track: \(error.localizedDescription)")
            }
        }
    }

    @objc func load(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let path = call.getString("path") else {
            call.reject("load needs an id and path")
            return
        }
        let volume = Float(call.getDouble("volume") ?? 1)
        do {
            let player = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: path))
            player.volume = volume
            player.prepareToPlay()
            players[id] = player
            observeEnd(id: id, player: player)
            call.resolve(["duration": player.duration])
        } catch {
            call.reject("could not open the track: \(error.localizedDescription)")
        }
    }

    // AVAudioPlayer has no completion notification, so the end is detected by
    // watching the playhead. Cheap, and it never fires twice for one pass.
    private func observeEnd(id: String, player: AVAudioPlayer) {
        if let existing = endObservers[id] as? Timer { existing.invalidate() }
        var reported = false
        let timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self, weak player] _ in
            guard let self = self, let player = player else { return }
            if player.isPlaying {
                reported = false
                return
            }
            if reported { return }
            if player.currentTime >= player.duration - 0.35 && player.duration > 0 {
                reported = true
                self.notifyListeners("ended", data: ["id": id])
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        endObservers[id] = timer
    }

    // MARK: - Transport

    @objc func play(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.reject("nothing loaded for that id")
            return
        }
        if let at = call.getDouble("from") { player.currentTime = at }
        if let volume = call.getDouble("volume") { player.volume = Float(volume) }
        let started = player.play()
        wireRemoteCommandsIfNeeded()
        call.resolve(["playing": started])
    }

    // A fade here is the whole point: AVAudioPlayer ramps in hardware, so the
    // level actually moves on iOS, which is the thing the WebView cannot do.
    @objc func pause(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.resolve(["playing": false])
            return
        }
        let fade = call.getDouble("fadeSeconds") ?? 0
        if fade > 0 {
            player.setVolume(0, fadeDuration: fade)
            DispatchQueue.main.asyncAfter(deadline: .now() + fade + 0.05) { [weak player] in
                player?.pause()
            }
        } else {
            player.pause()
        }
        call.resolve(["playing": false])
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.resolve()
            return
        }
        player.stop()
        player.currentTime = 0
        call.resolve()
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.resolve()
            return
        }
        let volume = Float(call.getDouble("volume") ?? 1)
        let fade = call.getDouble("fadeSeconds") ?? 0
        if fade > 0 {
            player.setVolume(volume, fadeDuration: fade)
        } else {
            player.volume = volume
        }
        call.resolve()
    }

    @objc func seek(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.resolve()
            return
        }
        player.currentTime = call.getDouble("seconds") ?? 0
        call.resolve()
    }

    @objc func state(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let player = players[id] else {
            call.resolve(["loaded": false])
            return
        }
        call.resolve([
            "loaded": true,
            "playing": player.isPlaying,
            "currentTime": player.currentTime,
            "duration": player.duration,
            "volume": Double(player.volume),
        ])
    }

    @objc func release(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.resolve()
            return
        }
        players[id]?.stop()
        players.removeValue(forKey: id)
        (endObservers[id] as? Timer)?.invalidate()
        endObservers.removeValue(forKey: id)
        call.resolve()
    }

    // MARK: - Lock screen

    @objc func setNowPlaying(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "DreamLIVE"
        let artist = call.getString("artist") ?? "Dreamland"
        let duration = call.getDouble("duration") ?? 0
        let elapsed = call.getDouble("elapsed") ?? 0
        let playing = call.getBool("playing") ?? false

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        wireRemoteCommandsIfNeeded()
        call.resolve()
    }

    // The lock screen buttons do not play anything themselves - they tell the
    // web layer what the operator asked for, so one place still decides what the
    // show is doing.
    private func wireRemoteCommandsIfNeeded() {
        guard !remoteWired else { return }
        remoteWired = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "play"])
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "pause"])
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.notifyListeners("remoteCommand", data: ["command": "toggle"])
            return .success
        }
        UIApplication.shared.beginReceivingRemoteControlEvents()
    }
}
