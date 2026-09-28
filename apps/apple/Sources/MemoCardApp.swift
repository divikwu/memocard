import SwiftUI
import UniformTypeIdentifiers

@main
struct MemoCardApp: App {
    @StateObject private var host = NativeHost()
    var body: some Scene {
        WindowGroup {
            WebView(host: host)
                .fileImporter(isPresented: $host.showPicker, allowedContentTypes: host.pickerTypes) { result in host.finishPicker(result) }
                .onOpenURL { host.openNote($0) }
                .onReceive(NotificationCenter.default.publisher(for: foregroundNotification)) { _ in host.notify("statusChanged") }
                #if os(macOS)
                .frame(minWidth: 680, minHeight: 500)
                #endif
        }
        #if os(macOS)
        .defaultSize(width: 1100, height: 780)
        #endif
    }
    private var foregroundNotification: Notification.Name {
        #if os(macOS)
        return NSApplication.didBecomeActiveNotification
        #else
        return UIApplication.willEnterForegroundNotification
        #endif
    }
}
