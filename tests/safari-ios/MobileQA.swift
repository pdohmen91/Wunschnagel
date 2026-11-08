import XCTest

final class SafariMobileQA: XCTestCase {
    func record(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func testSafariFormAndKeyboard() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        for label in ["Continue", "Not Now"] {
            let prompt = safari.buttons[label]
            if prompt.waitForExistence(timeout: 2) { prompt.tap() }
        }
        let browserTip = safari.buttons["xmark.circle.fill"]
        if browserTip.waitForExistence(timeout: 2) { browserTip.tap() }
        let addWish = safari.buttons["Wunsch hinzufügen"]
        XCTAssertTrue(addWish.waitForExistence(timeout: 25), safari.debugDescription)
        XCTAssertTrue(addWish.isHittable)
        record(safari, "01-Safari-Uebersicht")
        addWish.tap()
        let link = safari.textFields.matching(NSPredicate(format: "label == %@ OR placeholderValue == %@", "Link zum Wunsch", "https://shop.de/dein-wunsch")).firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 8), safari.debugDescription)
        link.tap()
        link.typeText("shop.de/mobiler-test")
        let keyboard = safari.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 5), "Software keyboard did not appear: \(safari.debugDescription)")
        let save = safari.buttons["Wunsch speichern"]
        XCTAssertTrue(save.exists)
        print("KEYBOARD FRAME \(keyboard.frame) SAVE FRAME \(save.frame)")
        XCTAssertLessThanOrEqual(save.frame.maxY, keyboard.frame.minY + 1)
        record(safari, "02-Safari-Tastatur-Link")
        let title = safari.textFields.matching(NSPredicate(format: "label == %@ OR placeholderValue == %@", "Dein Wunsch", "Zum Beispiel: Espressokanne für zwei")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 5), safari.debugDescription)
        XCTAssertLessThanOrEqual(title.frame.maxY, save.frame.minY)
        title.tap()
        title.typeText("Im iPhone Simulator getestet")
        XCTAssertTrue(save.isHittable, safari.debugDescription)
        XCTAssertLessThanOrEqual(save.frame.maxY, keyboard.frame.minY + 1)
        record(safari, "03-Safari-Tastatur-Speichern")
        save.tap()
        XCTAssertTrue(addWish.waitForExistence(timeout: 8))
        XCTAssertTrue(addWish.isHittable)
        record(safari, "04-Safari-Gespeichert")
        XCUIDevice.shared.orientation = .landscapeLeft
        let rotated = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in safari.frame.width > safari.frame.height }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [rotated], timeout: 8), .completed)
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        XCTAssertTrue(addWish.isHittable)
        XCTAssertLessThanOrEqual(addWish.frame.maxX, safari.frame.maxX)
        XCTAssertLessThan(safari.frame.maxX - addWish.frame.maxX, 100)
        record(safari, "05-Safari-Querformat")
        XCUIDevice.shared.orientation = .portrait
    }
}
