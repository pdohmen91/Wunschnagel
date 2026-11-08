# Prüfung für überwiegende Handynutzung

Stand: 7. November 2026.

## Änderungen

- Die untere Aktionsleiste zeigt die einzeiligen Aktionen „Teilen“ und „+ Wunsch“. Beide bleiben nach dem Scrollen erreichbar. Auf großen Bildschirmen stehen die ausgeschriebenen Aktionen weiterhin am Listenkopf.
- Oben öffnet „Listen“ die vollständigen Listennamen und „Neue Wunschliste“. Die abgeschnittene Auswahl entfällt. Beschreibung, Sichtbarkeit und Kurzanleitung stehen unter „Details & Hilfe“; der Stift daneben öffnet die Listenbearbeitung.
- Die Übersicht zeigt Titel, Statusfilter und Wünsche. Suche und Sortierung öffnen einen eigenen Dialog mit breiten Feldern, Abbrechen und explizitem Übernehmen. Zusätzliche Erklärungen verdrängen die Wünsche nicht mehr.
- Bei 320 und 390 Pixel Breite beginnt die erste Wunschkarte im gemeldeten Zustand „Offen · 2 von 3 Wünschen“ bei 318 CSS-Pixeln. Die Regression prüft diesen Zustand ausdrücklich, einschließlich einzeiliger Hauptaktionen.
- Die Aktionsleiste berücksichtigt Notch und Home-Indikator. Am Seitenende bleibt genug Platz, um die letzte Karte und ihren Shop-Link darüber zu lesen und zu bedienen. Rückmeldungen erscheinen oberhalb der Leiste.
- Formulare richten sich nach der sichtbaren Höhe über der Tastatur. Bei geöffneter Tastatur werden die lange Einleitung und zusätzliche Footer-Hinweise ausgeblendet. Die Eingaben scrollen, während Speichern und Abbrechen erreichbar bleiben.
- Pinch-Zoom verkleinert nicht künstlich die Formularfläche. Die vorhandene Breitenkorrektur für ein abgeschnittenes Dia-Fenster bleibt aktiv.

## Browserprüfungen

109 Browserprüfungen bestanden; zwölf Handyfälle werden in den Desktop-Profilen bewusst ausgelassen. Dazu kommen 33 Fach- und Zugriffsprüfungen. Chrome wird mit einem Pixel-7-Profil und WebKit mit einem iPhone-13-Profil geprüft. Die normalen Desktop- und Offline-Prüfungen bleiben Bestandteil des Laufs.

| Bereich | Prüfung |
| --- | --- |
| Bildschirmgrößen | 320 × 568, 360 × 740, 390 × 844, 412 × 915, 430 × 932, Querformat 844 × 390 |
| Touch | Hinzufügen, Teilen und Speichern durch Touch-Ereignisse |
| Tastatur | Nachgestellter Visual Viewport mit 344 bzw. 304 Pixeln sichtbarer Höhe und zusätzlichem vertikalem Versatz |
| Systemränder | Nachgestellte sichere Insets für Notch und Home-Indikator, Hoch- und Querformat |
| Scrollen | Untere Aktionen bleiben sichtbar; der letzte Shop-Link wird nicht verdeckt |
| Rückmeldungen | Hinweise überdecken die untere Aktionsleiste nicht |
| Formular | Neuer Wunsch und neue Liste lassen sich bei begrenzter sichtbarer Höhe anlegen |
| Gemeldete Ansicht | Zwei von drei Wünschen offen, erste Karte vor 360 Pixeln, keine umgebrochenen Hauptbuttons |
| Sekundäre Werkzeuge | Such- und Sortierdialog mit lesbarer Auswahl; Abbrechen verwirft Änderungen, Übernehmen wendet sie an |
| Regression | Zugriffsschutz, automatischer Titel, Animationen, Fokus, Desktop und Offline-Build |

Die nachgestellten Tastaturgrenzen und Systemränder sind Layoutprüfungen. Sie bilden die vollständige Oberfläche eines echten Android- oder iOS-Geräts nicht ab. Die Browserprofile ersetzen keinen Test auf physischer Hardware.


## Zusätzlicher Test mit iOS-Safari

Ein gesonderter XCTest lief erfolgreich auf einem eigens angelegten iPhone-17-Pro-Simulator mit iOS 26.5. Er verwendete Safari, Touch-Ereignisse und die iOS-Softwaretastatur. Link und Titel wurden eingegeben und der Wunsch bei geöffneter Tastatur gespeichert. Speicherbutton und Tastatur wurden anhand ihrer tatsächlichen Bildschirmkoordinaten verglichen. Das Querformat wurde nach abgeschlossener Rotation zusätzlich anhand der tatsächlichen Bildschirmkoordinaten auf vollständig erreichbare Hauptaktionen geprüft.

Dabei wurde ein Fehler entdeckt, den der Desktop-WebKit-Test nicht abbildete: iOS-Safari konnte im automatisch bemessenen Flex-Dialog die Formularfläche auf null reduzieren. Eine definierte, vom sichtbaren Viewport begrenzte Blockhöhe behebt dies. Während der Tastatureingabe weichen auch die wiederholte Zielangabe und der Link-Hilfstext den Pflichtfeldern.

Der wiederverwendbare Test liegt in [tests/safari-ios](../tests/safari-ios/README.md). Er bestand auch nach dem Umbau der mobilen Übersicht erneut; Screenshots von Übersicht, Eingabe mit Tastatur und Querformat wurden visuell kontrolliert. Der separat angelegte Simulator wurde anschließend wieder gelöscht; Daten im normalen Browser und in vorhandenen Simulatoren wurden nicht verändert. Physische Android- und iPhone-Geräte wurden nicht geprüft.
