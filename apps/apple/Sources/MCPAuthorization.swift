import Foundation

// Legacy mcpEnabled only grants reads. Write consent is versioned separately.
enum MCPAuthorization {
    static let writeVersionKey = "mcpWriteAuthorizationVersion"
    static let currentWriteVersion = 1

    static func allowsWrites(in defaults: UserDefaults) -> Bool {
        defaults.bool(forKey: "mcpEnabled") && defaults.integer(forKey: writeVersionKey) == currentWriteVersion
    }
    static func grantWrites(in defaults: UserDefaults) {
        defaults.set(currentWriteVersion, forKey: writeVersionKey)
    }
    static func revokeWrites(in defaults: UserDefaults) {
        defaults.removeObject(forKey: writeVersionKey)
    }
}
