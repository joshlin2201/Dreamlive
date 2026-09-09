import AVFoundation
import Foundation
import Capacitor

private func appendLE<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var littleEndian = value.littleEndian
    withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
}

private func makeSilentWav(in directory: URL, named name: String, seconds: Double) throws -> URL {
    let url = directory.appendingPathComponent(name)
    let sampleRate: UInt32 = 44_100
    let frames = UInt32(Double(sampleRate) * seconds)
    let dataBytes = frames * 2 // 16-bit mono PCM
    var wav = Data("RIFF".utf8)
    appendLE(UInt32(36 + dataBytes), to: &wav)
    wav.append(Data("WAVEfmt ".utf8))
    appendLE(UInt32(16), to: &wav)
    appendLE(UInt16(1), to: &wav)
    appendLE(UInt16(1), to: &wav)
    appendLE(sampleRate, to: &wav)
    appendLE(sampleRate * 2, to: &wav)
    appendLE(UInt16(2), to: &wav)
    appendLE(UInt16(16), to: &wav)
    wav.append(Data("data".utf8))
    appendLE(dataBytes, to: &wav)
    wav.append(Data(repeating: 0, count: Int(dataBytes)))
    try wav.write(to: url, options: .atomic)
    return url
}

private func call(_ values: [String: Any] = [:]) -> CAPPluginCall { CAPPluginCall(values) }

private func requireResolved(_ call: CAPPluginCall, _ operation: String) {
    precondition(call.rejected == nil, "\(operation) rejected: \(call.rejected ?? "unknown")")
    precondition(call.resolved != nil, "\(operation) never resolved")
}

private func endedCount(_ plugin: ShowAudioPlugin, id: String) -> Int {
    plugin.emittedListeners.filter { $0.event == "ended" && $0.data["id"] as? String == id }.count
}

@discardableResult
private func waitFor(_ label: String, timeout: TimeInterval = 2, _ condition: @escaping () -> Bool) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if condition() { return true }
        RunLoop.main.run(until: Date().addingTimeInterval(0.01))
    }
    assertionFailure("timed out waiting for \(label)")
    return false
}

private func state(of plugin: ShowAudioPlugin, id: String) -> [String: Any] {
    let query = call(["id": id])
    plugin.state(query)
    requireResolved(query, "state")
    return query.resolved!
}

private func load(_ plugin: ShowAudioPlugin, id: String, path: String) {
    let request = call(["id": id, "path": path])
    plugin.load(request)
    requireResolved(request, "load \(id)")
}

private func play(_ plugin: ShowAudioPlugin, id: String, from: Double? = nil) {
    var values: [String: Any] = ["id": id]
    if let from { values["from"] = from }
    let request = call(values)
    plugin.play(request)
    requireResolved(request, "play \(id)")
    precondition(request.resolved?["playing"] as? Bool == true, "play \(id) did not start")
}

private func pause(_ plugin: ShowAudioPlugin, id: String, fade: Double = 0) {
    let request = call(["id": id, "fadeSeconds": fade])
    plugin.pause(request)
    requireResolved(request, "pause \(id)")
}

private func stop(_ plugin: ShowAudioPlugin, id: String) {
    let request = call(["id": id])
    plugin.stop(request)
    requireResolved(request, "stop \(id)")
}

private func currentPlayer(_ plugin: ShowAudioPlugin, id: String) -> AVAudioPlayer {
    let players = Mirror(reflecting: plugin).children.first { $0.label == "players" }?.value as? [String: AVAudioPlayer]
    guard let player = players?[id] else { preconditionFailure("test could not read player \(id)") }
    return player
}

@main
struct Regression {
    static func main() throws {
        let plugin = ShowAudioPlugin()
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("show-audio-plugin-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = try makeSilentWav(in: directory, named: "first.wav", seconds: 0.42)
        let second = try makeSilentWav(in: directory, named: "second.wav", seconds: 0.42)
        let third = try makeSilentWav(in: directory, named: "third.wav", seconds: 0.42)
        let cue = try makeSilentWav(in: directory, named: "cue.wav", seconds: 0.55)
        let replacement = try makeSilentWav(in: directory, named: "replacement.wav", seconds: 0.55)

        // The test bridge listener advances the production channel after each completion.
        let tracks = [first, second, third]
        let trackNames = ["first", "second", "third"]
        var activeTrack = 0
        var completionOrder: [String] = []
        plugin.onNotify = { event, data in
            guard event == "ended", data["id"] as? String == "room" else { return }
            completionOrder.append(trackNames[activeTrack])
            guard activeTrack + 1 < tracks.count else { return }
            activeTrack += 1
            load(plugin, id: "room", path: tracks[activeTrack].path)
            play(plugin, id: "room")
        }
        load(plugin, id: "room", path: first.path)
        play(plugin, id: "room")
        precondition(waitFor("three automatic track completions") { completionOrder == trackNames })

        // AVAudioPlayer rewinds after natural completion, so a repeated play needs
        // no synthetic `from: 0` seek from the web layer.
        load(plugin, id: "same-player", path: cue.path)
        play(plugin, id: "same-player")
        precondition(waitFor("first same-player completion") { endedCount(plugin, id: "same-player") == 1 })
        play(plugin, id: "same-player")
        precondition(waitFor("second same-player completion") { endedCount(plugin, id: "same-player") == 2 })

        // A deliberate pause near the tail is not an automatic transition.
        load(plugin, id: "paused", path: cue.path)
        play(plugin, id: "paused")
        precondition(waitFor("playhead near end") {
            (state(of: plugin, id: "paused")["currentTime"] as? Double ?? 0) > 0.35
        })
        pause(plugin, id: "paused", fade: 0.30)
        RunLoop.main.run(until: Date().addingTimeInterval(0.55))
        precondition(endedCount(plugin, id: "paused") == 0, "fade pause emitted an ended event")

        // A stopped player that is replaced before its old track would finish cannot
        // notify the web layer from the stale completion.
        load(plugin, id: "reloaded", path: cue.path)
        play(plugin, id: "reloaded")
        let oldPlayer = currentPlayer(plugin, id: "reloaded")
        stop(plugin, id: "reloaded")
        plugin.audioPlayerDidFinishPlaying(oldPlayer, successfully: true)
        precondition(endedCount(plugin, id: "reloaded") == 0, "stop allowed a late completion")
        load(plugin, id: "reloaded", path: replacement.path)
        plugin.audioPlayerDidFinishPlaying(oldPlayer, successfully: true)
        RunLoop.main.run(until: Date().addingTimeInterval(0.70))
        precondition(endedCount(plugin, id: "reloaded") == 0, "stop/reload emitted a stale ended event")

        print("PASS: ShowAudioPlugin advanced three tracks, replayed natively, and ignored paused/stale completions")
    }
}
