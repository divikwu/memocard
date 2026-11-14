import Foundation

let appURL = URL(fileURLWithPath: CommandLine.arguments[0])
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
let companion = TunnelCompanion(appURL: appURL)
companion.start()
RunLoop.main.run()
