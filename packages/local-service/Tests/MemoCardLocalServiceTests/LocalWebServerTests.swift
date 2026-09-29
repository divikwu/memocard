import XCTest
@testable import MemoCardLocalWeb

final class LocalWebServerTests: XCTestCase {
    func testModuleLoads() {
        XCTAssertEqual(LocalWebServer.maximumSessions, 16)
    }
}
