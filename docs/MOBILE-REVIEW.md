# Prüfung für überwiegende Handynutzung

Stand: 8. November 2026.

## Änderungen

- Die untere Aktionsleiste zeigt die einzeiligen Aktionen „Teilen“ und „+ Wunsch“. Beide bleiben nach dem Scrollen erreichbar. Auf großen Bildschirmen stehen die ausgeschriebenen Aktionen weiterhin am Listenkopf.
- Oben öffnet „Listen“ die vollständigen Listennamen und „Neue Wunschliste“. Die abgeschnittene Auswahl entfällt. Beschreibung, Sichtbarkeit und Kurzanleitung stehen unter „Details & Hilfe“; der Stift daneben öffnet die Listenbearbeitung.
- Die Übersicht zeigt Titel, Statusfilter und Wünsche. Suche und Sortierung öffnen einen eigenen Dialog mit breiten Feldern, Abbrechen und explizitem Übernehmen. Zusätzliche Erklärungen verdrängen die Wünsche nicht mehr.
- Auf Handys stehen Produktbild und Text nebeneinander. Die erste Beispielkarte ist bei 390 Pixel Breite 166 statt zuvor 361 CSS-Pixel hoch. Zwei vollständige Wünsche passen bei 390 × 844 Pixeln über die untere Leiste; dieser Platzgewinn wird im Browsertest geprüft. Ohne Installationshinweis beginnt die ungefilterte Übersicht bei 250 statt zuvor 310 CSS-Pixeln, einschließlich des zusätzlichen Demo-Hinweises. Die angemeldete Ansicht benötigt die Demo-Zeile nicht.
- Im Browser steht „App installieren“ als deutlich beschriftete Leiste unter dem App-Namen. Sie ist schließbar und entfällt in der installierten App. Oben im Listen-Dialog bleibt eine weitere Installationsschaltfläche erreichbar. Die Leiste wird sowohl bei Google-Anmeldung als auch in eigenen oder geteilten Listen angezeigt.
- Überschriften, Abstände, Desktop-Bilder und Formulare sind kleiner. Texteingaben behalten 16 Pixel Schrift, Hauptaktionen 48 Pixel Höhe und weitere interaktive Elemente mindestens 44 Pixel. Lange Wunschtitel umbrechen vollständig, Hinweise lassen sich ausklappen. Das Bearbeitungsmenü sitzt unter dem Vorschaubild und öffnet sich nach oben. Fehlende Preise und Notizen erzeugen auf Handys keine zusätzlichen Platzhalterzeilen.
- Die Aktionsleiste berücksichtigt Notch und Home-Indikator. Am Seitenende bleibt genug Platz, um die letzte Karte und ihren Shop-Link darüber zu lesen und zu bedienen. Rückmeldungen erscheinen oberhalb der Leiste.
- Formulare richten sich nach der sichtbaren Höhe über der Tastatur. Bei geöffneter Tastatur werden die lange Einleitung und zusätzliche Footer-Hinweise ausgeblendet. Die Eingaben scrollen, während Speichern und Abbrechen erreichbar bleiben.
- Pinch-Zoom verkleinert nicht künstlich die Formularfläche. Die vorhandene Breitenkorrektur für ein abgeschnittenes Dia-Fenster bleibt aktiv.

## Browserprüfungen

Die vollständige Prüfung des kompakteren Designs bestand 113 Browserfälle; zwölf Handyfälle werden in den Desktop-Profilen bewusst ausgelassen. Die anschließende Installationsänderung bestand 32 gezielte Browserprüfungen für Auffindbarkeit, Schließen, installierten Zustand, mobile Bedienung und Fensterbreiten. Dazu kommen 38 Fach- und Zugriffsprüfungen. Chrome wird mit einem Pixel-7-Profil und WebKit mit einem iPhone-13-Profil geprüft. Die normalen Desktop- und Offline-Prüfungen bleiben Bestandteil des vollständigen Laufs.

| Bereich | Prüfung |
| --- | --- |
| Bildschirmgrößen | 320 × 568, 360 × 740, 390 × 844, 412 × 915, 430 × 932, Querformat 844 × 390 |
| Touch | Hinzufügen, Teilen und Speichern durch Touch-Ereignisse |
| Tastatur | Nachgestellter Visual Viewport mit 344 bzw. 304 Pixeln sichtbarer Höhe und zusätzlichem vertikalem Versatz |
| Systemränder | Nachgestellte sichere Insets für Notch und Home-Indikator, Hoch- und Querformat |
| Scrollen | Untere Aktionen bleiben sichtbar; der letzte Shop-Link wird nicht verdeckt |
| Platz für Inhalte | Zwei vollständige Beispielwünsche gleichzeitig sichtbar bei 390 × 844 Pixeln; vorher war es einer |
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
