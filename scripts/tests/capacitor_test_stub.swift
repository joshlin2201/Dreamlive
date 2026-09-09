import Foundation

public enum CAPPluginReturnType {
    case promise
}

public let CAPPluginReturnPromise = CAPPluginReturnType.promise

public struct CAPPluginMethod {
    public let name: String
    public let returnType: CAPPluginReturnType

    public init(name: String, returnType: CAPPluginReturnType) {
        self.name = name
        self.returnType = returnType
    }
}

public protocol CAPBridgedPlugin {}

open class CAPPlugin: NSObject {
    public private(set) var emittedListeners: [(event: String, data: [String: Any])] = []
    public var onNotify: ((String, [String: Any]) -> Void)?

    public func notifyListeners(_ eventName: String, data: [String: Any]) {
        emittedListeners.append((eventName, data))
        onNotify?(eventName, data)
    }
}

public final class CAPPluginCall: NSObject {
    private let values: [String: Any]
    public private(set) var resolved: [String: Any]?
    public private(set) var rejected: String?

    public init(_ values: [String: Any] = [:]) {
        self.values = values
    }

    public func getString(_ key: String) -> String? { values[key] as? String }
    public func getDouble(_ key: String) -> Double? {
        if let value = values[key] as? Double { return value }
        if let value = values[key] as? Float { return Double(value) }
        if let value = values[key] as? Int { return Double(value) }
        return nil
    }
    public func getBool(_ key: String) -> Bool? { values[key] as? Bool }
    public func resolve(_ data: [String: Any] = [:]) { resolved = data }
    public func reject(_ message: String) { rejected = message }
}

public final class UIApplication: NSObject {
    public static let shared = UIApplication()
    public func beginReceivingRemoteControlEvents() {}
}
