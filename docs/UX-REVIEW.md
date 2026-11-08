# Prüfung von Darstellung und Bedienung

Stand: 7. November 2026, nach der Überarbeitung für seltene Nutzung. Die [Recherche und Funktionsbewertung](DESIGN-RESEARCH.md) dokumentiert die Quellen und die noch fehlenden Funktionen.

## Umfang

- Chrome mit Desktop- und Handy-Profil.
- WebKit 27.2 mit Desktop- und Handy-Profil als zusätzliche Prüfung der Safari-Browsertechnik.
- Bildschirmbreiten 320, 390, 620, 768, 960, 1024, 1280, 1440, 1699, 1920 und 2560 Pixel für leere und gefüllte Listen.
- Zusätzlich 360 und 430 Pixel in den bestehenden Layoutprüfungen.
- Ein nur 600 Pixel hohes Fenster für lange Formulare und aufklappbare Zusatzfelder.

## Befund aus dem tatsächlich geöffneten Browser

Nach einer weiteren Rückmeldung wurden vorübergehend ausschließlich Fenstermaße und Elementpositionen im geöffneten lokalen Tab gemessen. Der Tab meldete 2190 Pixel Inhaltsbreite und ein 2560 Pixel breites Fenster bei 2056 Pixel verfügbarer Bildschirmbreite. Das Fenster begann am linken Bildschirmrand. Die normalen responsiven Tests konnten diesen Fall nicht abbilden, weil dort gemeldete und verfügbare Fläche übereinstimmten.

Die App begrenzt ihre Breite in dieser Konstellation auf 1686 Pixel. Im geöffneten Nutzertab lag die rechte Kante der Hauptaktionen danach bei 1591 statt 1843 Pixel. Breakpoints richten sich nun mit Container Queries nach der App-Breite; Dialoge und Meldungen berücksichtigen denselben Bereich. Normale Fenstergrößen bleiben vollständig nutzbar. Die temporäre lokale Messung wird nicht mit der App ausgeliefert.

Die genaue Fenster-Konstellation und ein schmalerer Fall mit 500 Pixel sichtbarer App-Fläche werden jetzt in allen vier Browserprofilen nachgestellt. Getestet werden auch Dialoge, Rückmeldungen und die Rückkehr zur normalen Fenstergröße.

## Befunde und Änderungen

| Befund | Änderung |
| --- | --- |
| Auf dem Nutzerscreenshot waren Aktionen am rechten Rand abgeschnitten. Die exakte Verschiebung war in den Testbrowsern nicht reproduzierbar. | Explizites zweispaltiges Grid, feste Zuordnung der Seitenleiste und begrenzte Inhaltsbreite; Tests der einzelnen Aktionen auch auf großen Bildschirmen und mit leerer Liste. |
| Dekorative Kästen und wiederholte Sprüche nahmen viel Platz ein; der anschließenden Gestaltung fehlte eine eigene Identität. | Einheitliche Wunschkartei mit Papierflächen, Pflaumentinte, orangefarbener Hauptaktion, charakteristischer Typografie und einem eigenen Anhängersymbol. Die Regeln stehen in `DESIGN-SYSTEM.md`. |
| Eine leere Liste bestand aus einer einzelnen Hinzufügen-Kachel mit viel ungenutzter Fläche. | Zusammenhängender leerer Zustand mit verständlicher Anleitung und direkter Aktion. Suche und Sortierung erscheinen erst bei vorhandenen Wünschen. |
| Im kurzen Formular überdeckte der Formularfuß das Preisfeld. | Eigener Scrollbereich für die Eingaben; Speichern und Abbrechen stehen außerhalb dieses Bereichs. |
| Lange Hinweise waren ursprünglich abgeschnitten. | Vollständig aufklappbar; auch die tatsächliche Lesbarkeit nach dem Aufklappen wird geprüft. |
| Für die Auswahl nach Budget fehlte eine Sortierung. | Preis auf-/absteigend, Name A–Z, zuletzt hinzugefügt und ursprüngliche Reihenfolge. Wünsche ohne Preis bleiben bei beiden Preissortierungen am Ende. |
| Mobile WebKit-Browser laden weit entfernte Bilder erst beim Scrollen. | Die Bildprüfung scrollt zum Bild und kontrolliert anschließend erfolgreichen Ladevorgang und tatsächliche Bildbreite. Verzögertes Laden bleibt aktiv. |
| Native Auswahlfelder fielen in WebKit kleiner aus als in Chrome. | Explizite Höhen und einheitliche Darstellung; Sortierung und mobile Listenauswahl werden ebenfalls auf mindestens 44 Pixel Höhe geprüft. |

Bereits vorhandene Verbesserungen bleiben bestehen: große Bedienflächen, lesbare Kontraste, 16-Pixel-Schrift in Eingabefeldern, mobile Listenauswahl, erkennbare Fokusmarkierung, Tab-/Shift+Tab-Navigation im Dialog, Escape und Rückgabe des Fokus, Menüs mit Außenklick sowie Shop-Links ohne manuell eingegebenes Protokoll.

## Prüfungen

Alle 109 Browserprüfungen und alle 33 Fach- und Zugriffsprüfungen bestanden. Der Produktionsbuild ist erfolgreich.

- 109 Browserprüfungen in vier Browser-/Geräteprofilen sowie mit dem Produktionsbuild der PWA.
- 33 Fach- und Zugriffsprüfungen, darunter die SQL-Zugriffsregeln in PostgreSQL/WASM und die neue Sortierung.
- Die Sichtbarkeitsprüfung kontrolliert die Begrenzungen jedes relevanten Elements, fehlenden horizontalen Seitenversatz und einen unverdeckten Mittelpunkt.
- axe-Prüfungen mit den Tags `wcag2a`, `wcag2aa`, `wcag21aa` für Übersicht, Listenformular und Wunschformular.
- PWA-Test mit GitHub-Unterpfad und Offline-Neustart.

Wiederholen:

```sh
npm test
npx playwright install webkit
npm run test:browser
```

Für die Chrome-Profile wird ein installiertes Google Chrome verwendet. Auf Linux können zusätzliche Systempakete für WebKit erforderlich sein. Screenshots entstehen unter `test-results/`, unter anderem `desktop-overview.png`, `mobile-viewport.png` und `webkit-wide-empty.png`.

## Automatisches Laden von Titel und Bild

Ein gültiger Shop-Link löst nach einer kurzen Eingabepause selbstständig den Abruf aus. Eigene Texte bleiben erhalten; andere Felder können währenddessen bearbeitet werden. Ein Wechsel des Links oder das Schließen des Dialogs bricht den vorherigen Abruf ab. Tests prüfen insbesondere, dass eine verspätete Antwort den Titel eines neueren Links nicht überschreibt und blockierte Shops die manuelle Eingabe weiter zulassen.

Zusätzlich zu kontrollierten Browserantworten wurde der Ablauf ohne Mocks gegen den lokalen Entwicklungsserver geprüft: Der Bialetti-Produktlink `/it_en/moka-express.html` lieferte den Titel „Moka Express“ und eine Bildadresse. Der Titel erschien automatisch im Formular; Speichern war anschließend möglich. Dabei wurde kein Testwunsch im Nutzerbrowser gespeichert. Ein weiterer getesteter Shop verweigerte den Abruf; dafür funktioniert der manuelle Fallback.

## Eigene Designsprache

Die neue Gestaltung wurde für Navigation, Listenkopf, Wunschkarten, Leerzustände, Formulare, Freigabe- und Installationsdialoge, Menüs, Hinweise und App-Symbole umgesetzt. Nummerierte Anhänger, wiederkehrende asymmetrische Ecken und dünne Trennlinien verbinden die Komponenten. Auf dem Handy entfallen redundante Brotkrumen, damit die Inhalte früher erscheinen. Systemschriften halten die Darstellung unabhängig von externen Font-Diensten.

Die Gestaltung einschließlich der Animationen besteht 97 Browserprüfungen und 29 Fachprüfungen. Übersicht, Wunschformular, Leerzustand und die nachgestellte Dia-Konstellation wurden zusätzlich als Screenshots visuell kontrolliert.

## Animationen und schnelle Interaktionen

Die Oberfläche reagiert mit einem gemeinsamen Bewegungsrhythmus auf Listenwahl, Sortierung, Suche, Filter, neue und erfüllte Wünsche, Hinweise, Menüs, Dialoge, Formularfelder und Rückmeldungen. Die Details stehen im Designsystem. Es wurden keine externe Bibliothek und kein zusätzlicher Dienst eingebunden.

Die 12 neuen Browserprüfungen kontrollieren tatsächliche Kartenanimationen, schnelle Filterwechsel, entfernte und nicht mehr blockierende Kartenkopien, unterbrochene Aufklappbewegungen, mehrfaches Escape, erneutes Öffnen und die Fokusrückgabe. Ein Wechsel zur reduzierten Bewegung beendet auch laufende programmatische Animationen.

Nach den Korrekturen bestanden die 32 Animations- und Bedienungsprüfungen und anschließend die 49 übrigen Browserprüfungen. Kontraste werden nach den Einblendungen geprüft. Verdeckte optionale Formularfelder werden beim Warten auf sichtbare Übergänge nicht berücksichtigt. Desktop- und Handyabläufe wurden außerdem lokal aufgezeichnet und Zwischenbilder der Übergänge visuell geprüft. Die Aufnahmen verwenden isolierte Browserkontexte; Nutzerdaten im normalen Browser wurden dabei nicht verändert.

## Verständlichkeit bei seltener Nutzung

Die Kurzanleitung ist bei jeder Liste über „So funktioniert’s“ wieder erreichbar. Sie erklärt die drei Hauptschritte. Eine sichtbare Beschriftung ersetzt das bisherige reine Symbol auf den Wunschkarten. Hinweise erklären, dass „Erfüllt“ einen bereits bekommenen Wunsch bezeichnet und keine Kaufreservierung ist.

Das Wunschformular erklärt das Kopieren der Produktadresse, zeigt die Zielliste und stellt Titel und Bildvorschau nebeneinander dar. Ein fehlender Link oder Titel wird neben der Speicheraktion erklärt. Ein bereits gesetzter Suchbegriff oder Statusfilter wird beim Anlegen eines neuen Wunsches zurückgesetzt, damit dieser nicht unmittelbar verborgen bleibt. Freiwillige Angaben bleiben aufklappbar.

Die Empfängerkreise der Freigabeoptionen und das Weitergeben eines Links sind ausgeschrieben. In der lokalen Demo bleibt die Erklärung zum noch nicht verfügbaren Teilen als Dialog stehen. Es wird kein Freigabelink vorgetäuscht. Bei einer hier nicht ladbaren gemeinsamen Liste gibt es einen verständlichen Weg zurück zur eigenen Vorschau.

Die 16 zusätzlichen Browserprüfungen kontrollieren die erneut aufrufbare Anleitung samt Fokusrückgabe, erforderliche Angaben und zugängliche Feldhilfen, die Bildvorschau, das Wiederfinden neuer Wünsche, die Sichtbarkeitsauswahl und die sichtbare Bearbeitung erfüllter Wünsche. Neue axe-Prüfungen decken Anleitung und Demo-Freigabe ab. Der Formularfuß wird ausdrücklich auch ohne vorheriges Scrollen auf Sichtbarkeit und Begrenzung innerhalb des Dialogs geprüft. Die Eingabefeldsets liegen im Scrollbereich; die Aktionen stehen als separate Flex-Zeile darunter.

Die komplette Prüfung mit 97 Browserfällen bestand. Nach der kompakteren Anordnung von Titel und Bild bestanden außerdem alle 76 betroffenen Formular-, Hilfs-, Animations- und Sichtbarkeitsprüfungen. Die abschließenden 16 Hilfs- und Formularprüfungen bestanden auch mit dem Zurücksetzen alter Filter nach dem Hinzufügen. Die 29 Fach- und Zugriffsprüfungen bestanden ebenfalls. Screenshots von Desktop und Handygröße wurden zur Kontrolle von Textmenge und Bedienbarkeit verwendet.

## Überwiegende Handynutzung

Die mobile Gestaltung und ihr gesonderter Testumfang sind in [MOBILE-REVIEW.md](MOBILE-REVIEW.md) beschrieben. Die untere Aktionsleiste, sichere Bildschirmränder und die sichtbare Formularhöhe bei einer Bildschirmtastatur werden zusätzlich geprüft. Ein gesonderter XCTest bestand außerdem mit Safari und der iOS-Softwaretastatur auf einem iPhone-17-Pro-Simulator (iOS 26.5); der dort gefundene Flex-Dialogfehler wurde behoben.

## Grenzen

Die Bildschirmprofile und WebKit-Prüfungen ersetzen keinen Test auf einem echten iPhone, einem Android-Gerät oder mit dem konkreten Safari-Build des Nutzers. Es wurde keine Studie mit unabhängigen Testpersonen durchgeführt. Die automatische Barrierefreiheitsprüfung ist keine vollständige Zertifizierung. Live-Anmeldung, die online bereitgestellte Edge Function und geräteübergreifendes Teilen benötigen das weiterhin noch nicht eingerichtete Supabase-Projekt. Automatische Shopabrufe sind lokal über den Entwicklungsserver möglich und wurden mit einem echten Produktlink geprüft.
