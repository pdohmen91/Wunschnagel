# Optionaler Safari-Test im iOS-Simulator

Dieser Test steuert Safari über XCTest und prüft eine tatsächliche iOS-Bildschirmtastatur. Er ist kein natives App-Projekt und wird nicht für die Web-App benötigt. Voraussetzung sind macOS, Xcode und ein installierter iOS-Simulator-Runtime.

1. `npm run dev -- --port 5173 --strictPort` im Projekt starten.
2. Einen separaten, leeren iPhone-Simulator anlegen und starten. Verfügbare Typen und Runtimes zeigen `xcrun simctl list devicetypes` und `xcrun simctl list runtimes`.
3. Die Test-ID statt `<SIMULATOR-ID>` einsetzen:

```sh
xcrun simctl openurl <SIMULATOR-ID> http://127.0.0.1:5173/
xcodebuild test -project tests/safari-ios/MobileQA.xcodeproj -scheme MobileQA \
  -destination 'platform=iOS Simulator,id=<SIMULATOR-ID>' \
  -derivedDataPath /private/tmp/wunschnagel-ios-derived \
  -resultBundlePath /private/tmp/wunschnagel-ios-results.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
```

Der Test legt einen Wunsch ausschließlich im Browser des gewählten Simulators an. Er öffnet das Formular durch Touch, tippt Link und Titel über die iOS-Tastatur, kontrolliert den Speicherbutton oberhalb der Tastatur und nimmt Screenshots von Übersicht, Tastatur und Querformat auf. Die Softwaretastatur muss im Simulator verfügbar sein. Anschließend den eigenen Tests­imulator wieder herunterfahren und löschen.

Geprüft am 7. November 2026 mit iPhone 17 Pro / iOS 26.5. Dabei wurde ein Safari-Fehler aufgedeckt: Ein automatisch großer Flex-Dialog konnte seinen Formularbereich auf null Höhe zusammendrücken. Die definierte, vom sichtbaren Viewport begrenzte Blockhöhe verhindert dies. Wiederholte Hilfe und Zielangabe weichen während der Tastatureingabe vorübergehend den Pflichtfeldern.
