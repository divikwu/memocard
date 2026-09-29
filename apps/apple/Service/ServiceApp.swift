import AppKit
import ServiceManagement

@MainActor
@main
final class ServiceApp: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private var host: ServiceHost!

    static func main() {
        let application = NSApplication.shared
        let delegate = ServiceApp()
        application.delegate = delegate
        application.setActivationPolicy(.accessory)
        application.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { host = try ServiceHost() }
        catch {
            let alert = NSAlert(error: error)
            alert.runModal()
            NSApp.terminate(nil)
            return
        }
        host.stateChanged = { [weak self] in self?.rebuildMenu() }
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemSymbolName: "square.stack.3d.up", accessibilityDescription: "MemoCard")
        statusItem.button?.toolTip = "MemoCard 本机服务"
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
        rebuildMenu()
    }

    func applicationWillTerminate(_ notification: Notification) { host?.shutdown() }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard urls.contains(where: { $0.scheme == "memocard-service" && $0.host == "open-web" }) else { return }
        run { try await self.host.openWeb() }
    }

    func menuNeedsUpdate(_ menu: NSMenu) { rebuildMenu() }

    private func rebuildMenu() {
        guard let menu = statusItem?.menu, let host else { return }
        menu.removeAllItems()
        let vault = NSMenuItem(title: host.currentVaultName, action: nil, keyEquivalent: "")
        vault.isEnabled = false
        menu.addItem(vault)
        let webStatus = NSMenuItem(title: host.webRunning ? "本机 Web：运行中" : "本机 Web：已停止", action: nil, keyEquivalent: "")
        webStatus.isEnabled = false
        menu.addItem(webStatus)
        menu.addItem(.separator())
        for (index, vault) in host.registeredVaults.enumerated() {
            let entry = item(vault.name, #selector(activateVault(_:)), enabled: !vault.active)
            if index < 9 {
                entry.keyEquivalent = String(index + 1)
                entry.keyEquivalentModifierMask = [.option]
            }
            entry.state = vault.active ? .on : .off
            entry.representedObject = vault.id
            menu.addItem(entry)
        }
        if !host.registeredVaults.isEmpty { menu.addItem(.separator()) }
        menu.addItem(item(host.currentVaultName == "未选择笔记库" ? "打开已有笔记库…" : "切换笔记库…", #selector(selectVault)))
        menu.addItem(item("创建新笔记库…", #selector(createVault)))
        menu.addItem(.separator())
        menu.addItem(item("打开 Web", #selector(openWeb), enabled: true))
        menu.addItem(item("复制访问链接", #selector(copyLink), enabled: true))
        menu.addItem(item("停止 Web", #selector(stopWeb), enabled: host.webRunning))
        menu.addItem(.separator())
        let login = item("登录时启动", #selector(toggleLogin))
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        if SMAppService.mainApp.status == .requiresApproval {
            menu.addItem(item("在系统设置中批准…", #selector(openLoginSettings)))
        }
        menu.addItem(.separator())
        menu.addItem(item("退出 MemoCard 服务", #selector(quit), key: "q"))
    }

    private func item(_ title: String, _ action: Selector, enabled: Bool = true, key: String = "") -> NSMenuItem {
        let value = NSMenuItem(title: title, action: action, keyEquivalent: key)
        value.target = self
        value.isEnabled = enabled
        return value
    }

    private func run(_ operation: @escaping @MainActor () async throws -> Void) {
        Task { @MainActor in
            do { try await operation() }
            catch { NSAlert(error: error).runModal() }
            rebuildMenu()
        }
    }

    @objc private func selectVault() { run { try await self.host.chooseVault(create: false) } }
    @objc private func activateVault(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        run { try await self.host.chooseRegisteredVault(id: id) }
    }
    @objc private func createVault() { run { try await self.host.chooseVault(create: true) } }
    @objc private func openWeb() { run { try await self.host.openWeb() } }
    @objc private func copyLink() { run { try await self.host.copyWebLink() } }
    @objc private func stopWeb() { host.stopWeb(); rebuildMenu() }
    @objc private func quit() { NSApp.terminate(nil) }
    @objc private func openLoginSettings() { SMAppService.openSystemSettingsLoginItems() }

    @objc private func toggleLogin() {
        do {
            switch SMAppService.mainApp.status {
            case .enabled:
                try SMAppService.mainApp.unregister()
            case .notRegistered:
                try SMAppService.mainApp.register()
            case .requiresApproval:
                SMAppService.openSystemSettingsLoginItems()
            case .notFound:
                throw NSError(domain: "dev.memocard.service.login", code: 1, userInfo: [NSLocalizedDescriptionKey: "系统找不到已安装的 MemoCard 服务，请重新安装后再试。"])
            @unknown default:
                throw NSError(domain: "dev.memocard.service.login", code: 2, userInfo: [NSLocalizedDescriptionKey: "当前系统无法更新登录启动状态。"])
            }
        } catch { NSAlert(error: error).runModal() }
        rebuildMenu()
    }
}
