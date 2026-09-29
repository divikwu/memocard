import AppKit
import Foundation

enum CLIError: LocalizedError {
    case usage
    case appNotFound

    var errorDescription: String? {
        switch self {
        case .usage: return "用法：memocard serve"
        case .appNotFound: return "找不到 MemoCardService.app。请先运行 pnpm install:service。"
        }
    }
}

func serviceApplication(fileManager: FileManager = .default) throws -> URL {
    let installed = fileManager.homeDirectoryForCurrentUser
        .appendingPathComponent("Applications/MemoCardService.app", isDirectory: true)
    if fileManager.fileExists(atPath: installed.path) { return installed }

    let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
    let adjacent = executable.deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("MemoCardService.app", isDirectory: true)
    if fileManager.fileExists(atPath: adjacent.path) { return adjacent }
    throw CLIError.appNotFound
}

@main
struct MemoCardCLI {
    static func main() async {
        do {
            guard CommandLine.arguments.dropFirst().elementsEqual(["serve"]) else { throw CLIError.usage }
            let application = try serviceApplication()
            let command = URL(string: "memocard-service://open-web")!
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = false
            _ = try await NSWorkspace.shared.open([command], withApplicationAt: application, configuration: configuration)
            print("已请求 MemoCard 打开本机 Web。")
        } catch {
            FileHandle.standardError.write(Data("\(error.localizedDescription)\n".utf8))
            exit(2)
        }
    }
}
