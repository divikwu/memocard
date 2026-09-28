import SwiftUI
import WebKit

#if os(macOS)
typealias PlatformWebRepresentable = NSViewRepresentable
#else
typealias PlatformWebRepresentable = UIViewRepresentable
#endif

struct WebView: PlatformWebRepresentable {
    @ObservedObject var host: NativeHost
    func makeCoordinator() -> Coordinator { Coordinator(host: host) }
    private func make(_ coordinator: Coordinator) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addScriptMessageHandler(coordinator, contentWorld: .page, name: "memocard")
        configuration.setURLSchemeHandler(coordinator, forURLScheme: "memocard-ui")
        configuration.setURLSchemeHandler(coordinator, forURLScheme: "memocard-asset")
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = coordinator
        #if DEBUG
        view.isInspectable = true
        #endif
        host.webView = view
        view.load(URLRequest(url: URL(string: "memocard-ui://app/index.html")!))
        return view
    }
    #if os(macOS)
    func makeNSView(context: Context) -> WKWebView { make(context.coordinator) }
    func updateNSView(_ view: WKWebView, context: Context) {}
    #else
    func makeUIView(context: Context) -> WKWebView { make(context.coordinator) }
    func updateUIView(_ view: WKWebView, context: Context) {}
    #endif

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKURLSchemeHandler {
        let host: NativeHost
        var loading: [ObjectIdentifier: Task<Void, Never>] = [:]
        init(host: NativeHost) { self.host = host }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            host.webContentWillLoad()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
                  url.scheme == "memocard-ui", url.host == "app", let request = message.body as? [String: Any] else {
                replyHandler(nil, "Untrusted bridge caller"); return
            }
            Task { replyHandler(await host.handle(request), nil) }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let url = navigationAction.request.url
            decisionHandler(url?.scheme == "memocard-ui" && url?.host == "app" ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
            let identifier = ObjectIdentifier(urlSchemeTask as AnyObject)
            loading[identifier] = Task { [weak self] in
                guard let self else { return }
                defer { loading.removeValue(forKey: identifier) }
                do {
                    guard let url = urlSchemeTask.request.url else { throw URLError(.badURL) }
                    let data: Data
                    if url.scheme == "memocard-ui", url.host == "app" {
                        let root = Bundle.main.resourceURL!.appendingPathComponent("Web", isDirectory: true).standardizedFileURL
                        let resource = root.appendingPathComponent(url.path == "/" ? "index.html" : String(url.path.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
                        guard resource.path.hasPrefix(root.path + "/") else { throw URLError(.noPermissionsToReadFile) }
                        data = try await Task.detached(priority: .userInitiated) { try Data(contentsOf: resource) }.value
                    } else if url.scheme == "memocard-asset", url.host == "vault" {
                        data = try await host.store.asset(relativePath: String(url.path.dropFirst()))
                    } else { throw URLError(.badURL) }
                    guard !Task.isCancelled else { return }
                    let mime = ["html":"text/html", "js":"text/javascript", "css":"text/css", "json":"application/json", "woff2":"font/woff2", "svg":"image/svg+xml", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "gif":"image/gif", "heic":"image/heic", "heif":"image/heif"][url.pathExtension.lowercased()] ?? "application/octet-stream"
                    let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: ["html", "js", "css"].contains(url.pathExtension) ? "utf-8" : nil)
                    urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
                } catch { if !Task.isCancelled { urlSchemeTask.didFailWithError(error) } }
            }
        }
        func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { loading.removeValue(forKey: ObjectIdentifier(urlSchemeTask as AnyObject))?.cancel() }
    }
}
