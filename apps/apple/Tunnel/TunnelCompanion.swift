import AppKit
import Foundation
import Darwin

// The existing MemoCard login item owns when the tunnel is needed.
// launchd supervises this small companion; MemoCard keeps its App Sandbox.
final class TunnelCompanion {
    private let appURL: URL
    private let isServiceRunning: (pid_t?) -> Bool
    private var scriptURL: URL { appURL.appendingPathComponent("Contents/Resources/run-tunnel.sh") }
    private var childPID: pid_t?
    private var childExit: DispatchSourceProcess?
    private var stopping = false
    private var observers: [NSObjectProtocol] = []
    private var timer: Timer?
    private var terminationSignal: DispatchSourceSignal?
    private var shuttingDown = false

    init(appURL: URL, isServiceRunning: ((pid_t?) -> Bool)? = nil) {
        self.appURL = appURL.standardizedFileURL
        self.isServiceRunning = isServiceRunning ?? { terminatedPID in
            NSWorkspace.shared.runningApplications.contains {
                $0.bundleIdentifier == "dev.divikwu.memocard.service"
                    && $0.bundleURL?.standardizedFileURL == appURL.standardizedFileURL
                    && $0.processIdentifier != terminatedPID && !$0.isTerminated
            }
        }
    }

    func start() {
        signal(SIGTERM, SIG_IGN)
        terminationSignal = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        terminationSignal?.setEventHandler { [weak self] in self?.shutdown() }
        terminationSignal?.resume()
        let center = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.didLaunchApplicationNotification, NSWorkspace.didTerminateApplicationNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] notification in
                let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
                let terminatedPID = name == NSWorkspace.didTerminateApplicationNotification ? app?.processIdentifier : nil
                self?.reconcile(excluding: terminatedPID)
            })
        }
        // Also repairs a crashed tunnel and covers a missed workspace notification.
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.reconcile()
        }
        reconcile()
    }

    private func reconcile(excluding terminatedPID: pid_t? = nil) {
        guard !shuttingDown else { return }
        let needed = isServiceRunning(terminatedPID)
        if childPID != nil {
            if !needed && !stopping {
                stopChild()
                log("MemoCard exited; stopping tunnel")
            }
            return
        }
        guard needed else { return }

        // Foundation.Process creates a separate process group. Keep the tunnel in
        // launchd's group so launchd also cleans it up if this helper is SIGKILLed.
        var pid: pid_t = 0
        var arguments = ["/bin/sh", scriptURL.path].map { strdup($0) } + [nil]
        defer { arguments.forEach { free($0) } }
        var environment = ProcessInfo.processInfo.environment.map { strdup("\($0.key)=\($0.value)") } + [nil]
        defer { environment.forEach { free($0) } }
        var actions: posix_spawn_file_actions_t?
        posix_spawn_file_actions_init(&actions)
        defer { posix_spawn_file_actions_destroy(&actions) }
        posix_spawn_file_actions_addopen(&actions, STDIN_FILENO, "/dev/null", O_RDONLY, 0)
        var attributes: posix_spawnattr_t?
        posix_spawnattr_init(&attributes)
        defer { posix_spawnattr_destroy(&attributes) }
        var defaults = sigset_t(), mask = sigset_t()
        sigemptyset(&defaults); sigaddset(&defaults, SIGTERM)
        sigemptyset(&mask)
        posix_spawnattr_setsigdefault(&attributes, &defaults)
        posix_spawnattr_setsigmask(&attributes, &mask)
        posix_spawnattr_setflags(&attributes, Int16(POSIX_SPAWN_SETSIGDEF | POSIX_SPAWN_SETSIGMASK))
        let result = posix_spawn(&pid, "/bin/sh", &actions, &attributes, &arguments, &environment)
        guard result == 0 else {
            log("Unable to start tunnel; error=\(result), retrying in 5 seconds")
            return
        }
        childPID = pid
        let exitedPID = pid
        childExit = DispatchSource.makeProcessSource(identifier: pid, eventMask: .exit, queue: .main)
        childExit?.setEventHandler { [weak self] in
            guard let self, self.childPID == exitedPID else { return }
            var status: Int32 = 0
            waitpid(exitedPID, &status, 0)
            self.childExit?.cancel()
            self.childExit = nil
            self.childPID = nil
            self.stopping = false
            self.log("Tunnel stopped; wait status=\(status)")
            if self.shuttingDown { exit(0) }
        }
        childExit?.resume()
        log("MemoCard running; started tunnel pid=\(pid)")
    }

    private func stopChild() {
        guard let pid = childPID else { return }
        stopping = true
        kill(pid, SIGTERM)
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            // The PID remains ours until waitpid reaps it in childExit.
            guard let self, self.childPID == pid else { return }
            kill(pid, SIGKILL)
        }
    }

    private func shutdown() {
        shuttingDown = true
        timer?.invalidate()
        guard childPID != nil else { exit(0) }
        stopChild()
    }

    private func log(_ message: String) {
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        FileHandle.standardError.write(Data(line.utf8))
    }
}
