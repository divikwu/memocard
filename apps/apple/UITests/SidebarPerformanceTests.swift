import XCTest

final class SidebarPerformanceTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
    }

    private var options: XCTMeasureOptions {
        let options = XCTMeasureOptions()
        options.iterationCount = 5
        return options
    }

    private func launchToNavigation() {
        app.launch()
        XCTAssertTrue(app.buttons["导航"].waitForExistence(timeout: 20))
    }

    func testLaunchPerformance() {
        measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)], options: options) {
            app.launch()
        }
    }

    // Includes XCTest tap/wait overhead; this measures the same end-to-end scenario on each run.
    func testSidebarPresentationPerformance() {
        launchToNavigation()
        measure(metrics: [XCTClockMetric()], options: options) {
            app.buttons["导航"].tap()
            XCTAssertTrue(app.buttons["MemoCard，返回主页"].waitForExistence(timeout: 5))
            app.buttons["收起导航"].tap()
            XCTAssertTrue(app.buttons["导航"].waitForExistence(timeout: 5))
        }
    }

    func testSidebarExpansionAndRowActionsRemainIndependent() {
        launchToNavigation()
        app.buttons["导航"].tap()
        let header = app.buttons["MemoCard，返回主页"]
        XCTAssertTrue(header.waitForExistence(timeout: 5))
        let expansion = app.buttons["展开或收起快捷筛选"]
        XCTAssertTrue(expansion.waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(expansion.frame.width, 44)
        XCTAssertGreaterThanOrEqual(expansion.frame.height, 44)
        XCTAssertEqual(expansion.value as? String, "已收起")
        let notes = app.buttons["所有笔记"]
        let rowTrailingCenter = notes.coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 0.5))

        // The 44-point target remains centered 24 points from the row's trailing edge.
        // Both taps fall outside the previous 40-point target, regardless of AX padding bounds.
        rowTrailingCenter.withOffset(CGVector(dx: -45, dy: 0)).tap()
        XCTAssertEqual(expansion.value as? String, "已展开")
        XCTAssertTrue(app.buttons["无标签"].waitForExistence(timeout: 5))
        XCTAssertTrue(header.isHittable)
        rowTrailingCenter.withOffset(CGVector(dx: -3, dy: 0)).tap()
        XCTAssertEqual(expansion.value as? String, "已收起")
        XCTAssertTrue(header.isHittable)

        // Padding outside the overlaid expansion target still belongs to the original row action.
        rowTrailingCenter.withOffset(CGVector(dx: -1, dy: 0)).tap()
        let closed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: header)
        XCTAssertEqual(XCTWaiter.wait(for: [closed], timeout: 5), .completed)
        XCTAssertTrue(app.buttons["导航"].isHittable)

        app.buttons["导航"].tap()
        XCTAssertTrue(header.waitForExistence(timeout: 5))
        rowTrailingCenter.withOffset(CGVector(dx: -47, dy: 0)).tap()
        let closedFromInnerEdge = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: header)
        XCTAssertEqual(XCTWaiter.wait(for: [closedFromInnerEdge], timeout: 5), .completed)
        XCTAssertTrue(app.buttons["导航"].isHittable)
    }

    func testSidebarEdgeGesturesOpenAndCloseNavigation() {
        launchToNavigation()
        let header = app.buttons["MemoCard，返回主页"]
        XCTAssertFalse(header.exists)
        let edge = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
            .withOffset(CGVector(dx: 12, dy: 0))
        let opened = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5))
        edge.press(forDuration: 0.05, thenDragTo: opened)
        XCTAssertTrue(header.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["收起导航"].isHittable)

        let trailing = app.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5))
        let closed = app.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.5))
        trailing.press(forDuration: 0.05, thenDragTo: closed)
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: header)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertTrue(app.buttons["导航"].isHittable)
    }

    func testSidebarScrollingPerformance() throws {
        launchToNavigation()
        app.buttons["导航"].tap()
        XCTAssertTrue(app.buttons["MemoCard，返回主页"].waitForExistence(timeout: 5))
        let children = app.buttons.matching(NSPredicate(format: "label CONTAINS '/'"))
        try XCTSkipUnless(children.count >= 6, "Scrolling baseline requires a connected vault with enough nested tags.")
        try XCTSkipUnless(!children.element(boundBy: children.count - 1).isHittable,
                         "Scrolling baseline requires tags extending beyond the visible sidebar.")

        measure(metrics: [XCTOSSignpostMetric.scrollingAndDecelerationMetric], options: options) {
            app.swipeUp(velocity: .fast)
            app.swipeDown(velocity: .fast)
        }
    }
}
