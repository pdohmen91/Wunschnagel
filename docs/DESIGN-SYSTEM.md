# Designsprache: persönliche Wunschkartei

Stand: 9. November 2026. Der vom Nutzer ausgewählte Produktname ist **Wunschnagel**. Der Claim lautet **Deine Wünsche. Festgehalten.**

Die visuelle Grundlage sind beschriftete Geschenkanhänger und eine sorgfältig angelegte Kartei. Sie verbindet die persönlichen Inhalte einer Wunschliste mit gut lesbarer, einfacher Bedienung. Produktbilder und eigene Notizen bleiben der Inhalt; zusätzliche Werbesprüche sind nicht Teil der Oberfläche.

## Farben

Die zentralen CSS-Variablen in `src/styles.css` sind die verbindliche Grundlage.

| Token | Farbe | Verwendung |
| --- | --- | --- |
| `--paper` | `#f6f1e8` | Hintergrund, helle Schrift auf dunklen Flächen |
| `--surface` | `#fffdf8` | Karten, Eingaben, Dialoge |
| `--ink` | `#352334` | Haupttext, Navigation, Linien, Benachrichtigungen |
| `--muted` | `#70646d` | Beschreibungen und Hilfstexte |
| `--line` | `#d7cdc9` | Leise Trennlinien |
| `--soft` | `#eee7e7` | Zurückhaltende Nebenflächen |
| `--accent` | `#f3a468` | Hauptaktion, Markensymbol, aktive Navigation |

Orange kennzeichnet die wichtigste Aktion. Sie trägt dunkle Schrift. Rot bleibt Löschen und Fehlern vorbehalten. Datenschutz und Status werden zusätzlich mit Text und Symbolen vermittelt.

## Schrift und Hierarchie

- **Iowan Old Style / Palatino / Georgia** für Marke, Listentitel, Wunschtitel und Dialogtitel. Die Serifenschrift gibt den persönlichen Inhalten ihren Charakter.
- **Systemschrift ohne Serifen** für Bedienung, Beschreibungen und Formulare.
- **Systemschrift mit fester Zeichenbreite** für kleine Listen- und Kartenindizes sowie Shop-Adressen. Keine langen Texte in Versalien.

Alle Schriften sind auf dem Gerät vorhanden. Die Oberfläche benötigt keinen externen Schriftanbieter und bleibt offline darstellbar.

## Wiederkehrende Formen

Kleine Ecken von 2–4 px bilden die Grundform. Anhänger und Inhaltskarten erhalten unten rechts eine größere Rundung. Diese Form wiederholt sich in Listensymbolen, Kartenindizes, Leerzuständen, Installationsschritten und Dialogen.

Das eigene Markenzeichen zeigt einen Wunschzettel mit Falz, Herz und Beschriftungslinie, der an einem kleinen Nagel hängt. Dasselbe Motiv erscheint in Navigation, Favicon und den installierbaren App-Symbolen. Name und Claim bilden gemeinsam die Wortmarke, auch in der kompakten mobilen Kopfzeile.

## Sprache: Wünsche festhalten

Die persönliche Wunschkartei wird zu einer Sammlung aufgehängter Wunschzettel. Wiederkehrende Nagel-Anspielungen geben Rückmeldungen, Anleitungen und Leerzuständen Charakter: „Deine nagelneue Wunschliste ist bereit“, „Festgehalten! Dein Wunsch hängt an der Liste“ und „Nagel auf den Kopf! Wunsch als erfüllt markiert“. Bearbeiten bekommt „Sitzt jetzt genau richtig“, das Löschen schafft „Platz für nagelneue Ideen“. Auch Suche, Teilen, Hinweise zum Schenken und Installation greifen das Festhalten, Hängenbleiben und Weitergeben auf.

Handlungsnamen, Pflichtfelder, Datenschutz und Fehlermeldungen bleiben eindeutig. „Wunsch hinzufügen“, „Liste teilen“, „Als erfüllt markieren“, „Löschen“ und die Statusfilter behalten ihre gewohnten Bedeutungen. Ein Nagel ist hier das Bild für einen festen Platz; Wünsche und Sichtbarkeit bleiben veränderbar.

Einfarbige Linien ordnen Bereiche. Die gestrichelte Linie trennt die Beschreibung einer Wunschkarte von Preis und Shop-Aktion. Ein kleiner versetzter Schatten setzt Inhaltskarten vom Papier ab. Menüs werden nicht durch abgeschnittene Kartenformen verdeckt.

## Komponenten

- Die dunkle Navigation rahmt die eigenen Listen. Die aktive Liste erscheint als heller Eintrag mit orangefarbener Kante.
- Der Listenkopf kombiniert Index, persönliches Symbol, Titel und Beschreibung. Die Freigabe bleibt neben Anzahl und Bearbeitung sichtbar.
- Wunschkarten tragen einen kleinen nummerierten Anhänger. Beim Suchen und Sortieren bleibt die Nummer der ursprünglichen Listenreihenfolge erhalten.
- Hauptaktionen sind orange, Nebenaktionen hell mit Tintenrand. Auswahlzustände erhalten eine Fläche und eine klare Kante.
- Dialoge verwenden dieselbe Typografie, Papierfläche und Form. Kopf und Aktionen bleiben von scrollbaren Formularfeldern getrennt.
- Hinweise erhalten eine linke Markierung und erklärenden Text. Die Benachrichtigung verwendet die dunkle Tinte der Navigation.
- Der leere Zustand erklärt den nächsten Schritt und bietet direkt das Hinzufügen an.

## Responsive Verhalten und Bedienung

Die Gestaltung richtet sich nach der tatsächlich sichtbaren App-Breite. Die Korrektur für über den Bildschirmrand hinausreichende Dia-Fenster bleibt erhalten. Bis 960 px öffnet „Listen“ die Listennavigation in einem Dialog mit vollständigen Namen. Die Brotkrumen entfallen. Wunschkarten wechseln von drei zu zwei und schließlich einer Spalte.

Die Mindestgröße wichtiger Bedienelemente beträgt 44 px. Formulare verwenden mindestens 16 px Schrift in Eingaben, sichtbaren Tastaturfokus, einen Fokusrahmen innerhalb des Dialogs und erreichbare Speichern-/Abbrechen-Aktionen auch bei kurzen Fenstern. Reduzierte Bewegung wird respektiert.

Die Darstellung ist bewusst kompakt: Auf Handys bis 620 px stehen ein 88 × 96 px großes Produktbild und die Wunschangaben nebeneinander. Titel verwenden 17 px, Hinweise 13 px; lange Titel umbrechen vollständig und Hinweise bleiben aufklappbar. „Bearbeiten“ bleibt ausgeschrieben unter dem Bild, das Menü öffnet sich nach oben. Fehlende Notizen oder Preise erzeugen mobil keine Platzhalterzeilen. Die ungefilterte Anzahl wird bereits im Filter angezeigt und beansprucht keine zusätzliche sichtbare Zeile. Zwei vollständige Beispielwünsche müssen bei 390 × 844 px über die untere Aktionsleiste passen. Desktop-Karten verwenden 176 px hohe Bilder und kleinere Abstände. Eingaben und Touchflächen werden nicht proportional mit verkleinert.

Jede Wunschkarte zeigt unter Preis und Shop-Link einen 44 px hohen Angebotsbutton mit hellem orangefarbenem Hintergrund. „Preisvergleich“ öffnet idealo, „Gebraucht suchen“ eine eBay-Suche und „Angebote finden“ Kleinanzeigen oder den eigenen Suchlink. Im Formular lassen sich Ziel und Suchbegriff festlegen und die Ergebnisliste vorab öffnen. Die Suche verwendet ausschließlich den Suchbegriff bzw. ersatzweise den Titel; Hinweise und Freigabetoken fließen nicht in die erzeugte URL ein. Gäste sehen denselben Angebotsbutton wie der Listenbesitzer.

## Überprüfung

Die Umsetzung wurde mit Chrome und WebKit in Desktop- und mobilen Ansichten geprüft. Zur bestehenden Browserprüfung gehören WCAG-Kontrastprüfungen, Tastaturbedienung, Breiten von 320 bis 2560 px, kurze Formulare, lange Inhalte, tatsächliche Sichtbarkeit der Aktionen sowie die reproduzierte Dia-Fensterkonstellation. Zusätzlich werden Übersicht, Leerzustand, Formular und Dia-Ansicht visuell anhand von Screenshots beurteilt.

## Bewegung: drücken, aufklappen, einsortieren, abstempeln

Die Animationen sind Teil derselben Wunschkartei. `src/motion.css` beschreibt die visuellen Übergänge; `src/lib/motion.ts` steuert unterbrochene Übergänge, native Dialoge und die Anordnung der Karten. Es gibt keine zusätzliche Bibliothek und keinen externen Dienst.

| Aktion | Reaktion |
| --- | --- |
| Liste wählen | Listenkopf und Bedienung erscheinen gestaffelt; das Listensymbol bewegt sich kurz wie ein Anhänger. |
| Wunsch hinzufügen | Die neue Karte wird mit kurzer Staffelung einsortiert. |
| Suchen, filtern, sortieren | Bestehende Karten gleiten an ihre neue Position; entfernte Karten verschwinden kurz und blockieren keine Bedienung. |
| Wunsch erfüllen | Häkchen zeichnet sich, Status wird abgestempelt, kurze Papierstreifen bestätigen die Aktion. |
| Hinweise öffnen | Textbereich klappt auf und zu; der Pfeil dreht sich passend. |
| Menü öffnen/schließen | Das Menü entfaltet sich vom Auslöser aus und zieht sich wieder zurück. |
| Dialog öffnen/schließen | Papierkarte hebt sich ins Bild bzw. senkt sich heraus; Hintergrund blendet passend ein/aus. |
| Formular bedienen | Fokusrahmen, Symbolauswahl und Hinweise reagieren auf die Eingabe. |
| Shop-Vorschau laden | Ladebewegung am Titelfeld; automatisch ergänzter Titel wird kurz hervorgehoben. |
| Erfolg, Hinweis, Fehler | Rückmeldungen erscheinen mit passender Bewegung; Hinweise zeigen ihre verbleibende Anzeigezeit. |
| Button aktivieren | Kurzer Tintendruck mit Maus, Touch oder Tastatur; unterstützende Symbole reagieren auch auf Hover. |
| Leere Liste öffnen | Erklärung und nächste Aktion erscheinen in einer kurzen Folge. |

Die Grundzeiten sind 160 ms für direkte Reaktionen, 280 ms für Aufklappen, 360 ms für Positionswechsel und rund 420 ms für Eintritte. Staffelungen sind auf 180 ms begrenzt. Datenänderungen benötigen keine vorgeschaltete Animation. Ein Dialog bleibt während seiner kurzen Schließbewegung modal; danach kehrt der Fokus zum Auslöser zurück. Auch WebKit mit Mausbedienung merkt sich diesen Auslöser.

Animationen laufen durch Aktionen oder Ladevorgänge an. Im Ruhezustand bewegt sich die Oberfläche nicht fortlaufend. Bei `prefers-reduced-motion: reduce` entfallen die Bewegungen, die laufenden programmatischen Animationen werden beendet und die Inhalte bleiben sofort bedienbar. Dekorative Papierstreifen und der Zeitbalken werden ausgeblendet.

## Verständlichkeit bei seltener Nutzung

Die App setzt keine Erinnerung an frühere Besuche voraus. Die Kurzanleitung „So funktioniert’s“ lässt sich bei jeder Liste erneut öffnen; es gibt keinen vorgeschalteten Pflichttour-Dialog. Sie erklärt Listenwahl, Produktlinks und das Weitergeben einer Liste. Gäste erhalten eine passende Anleitung zum Ansehen und Öffnen der Shopseiten.

Hilfen stehen am Entscheidungspunkt: Freigabeoptionen erklären ihren Empfängerkreis, die Suchansicht erklärt die Statusfilter, und das Formular beschreibt Link, freiwillige Angaben und Speicherziel. Die Bildvorschau steht direkt neben dem Titel. „Speichern“ wird erst mit gültigem Link und Titel aktiv; ein dauerhafter Hinweis erklärt noch fehlende Angaben. Selten benötigte Angaben zu Preis und Bildadresse bleiben aufklappbar.

Auf Wunschkarten ist „Bearbeiten“ ausgeschrieben. Das Menü erklärt, wie bereits bekommene Wünsche markiert werden. „Offen“ und „Erfüllt“ sind ausdrücklich vom Kaufen oder Reservieren getrennt. Eine aktive Suche oder ein Filter zeigt, wie viele Wünsche aus der Liste sichtbar sind und wie man alle wieder anzeigt.

In der lokalen Demo erklärt ein Dialog beim Teilen, dass andere Geräte die Daten noch nicht öffnen können. Es wird dort kein scheinbar funktionierender Freigabelink angeboten. In der gemeinsam nutzbaren Version beschreiben die Texte das Kopieren und Versenden des Links; das Ersetzen eines Links liegt unter den zusätzlichen Freigabeoptionen.

Auf kleinen Bildschirmen öffnet „Details & Hilfe“ die Beschreibung und den Zugang zur Kurzanleitung. Suche und Sortierung liegen in einem eigenen Dialog; Änderungen werden erst mit „Ergebnisse anzeigen“ übernommen. Die Übersicht enthält nur Titel, Sichtbarkeit, Statusfilter und Wünsche. In Formularen scrollt nur der Eingabebereich; Speichern und Abbrechen stehen außerhalb des deaktivierbaren Eingabefeldsets und bleiben sichtbar.

Wenn weitere Formularfelder unterhalb des sichtbaren Bereichs liegen, zeigt eine feste Zeile über den Aktionen „Weitere Felder · nach unten scrollen“. Weiche Kanten am Eingabebereich zeigen Inhalte oberhalb und unterhalb an. Am Ende verschwindet der Hinweis; vollständig sichtbare Formulare erhalten ihn nicht. Die Erkennung reagiert auf Tastatur, Größenänderungen und aufgeklappte Zusatzfelder. Die Hinweiszeile fängt keine Touch-Eingaben ab.


## Handy als Hauptgerät

Im mobilen Browser steht „App installieren“ als beschriftete Leiste direkt unter der Marke, sowohl vor der Anmeldung als auch bei eigenen und geteilten Listen. Die Leiste lässt sich für die aktuelle Browser-Sitzung schließen und entfällt in der installierten App. Die Installation bleibt oben im Listen-Dialog als breite Schaltfläche erreichbar. So bleibt die Aktion auffindbar, ohne die dauerhaft genutzte App-Ansicht zu vergrößern.

Die installierte iOS-App unterlegt den Statusbereich mit dunkler Tinte und hält die Marke sowie die Kopfleisten-Aktionen mindestens 24 px vom oberen Inhaltsrand entfernt. Größere vom Gerät gemeldete sichere Insets bleiben maßgeblich. `apple-mobile-web-app-status-bar-style=black` verlangt eine nicht durchscheinende Statusleiste; siehe [Apple: Supported Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html). Der Abstand schützt die Beschriftung zusätzlich vor dem systemseitigen Kanteneffekt. Dessen konkrete Darstellung hängt vom iOS-Stand ab.

Bis 960 Pixel App-Breite stehen „+ Wunsch“ und „Teilen“ einzeilig in einer festen unteren Aktionsleiste. Sie wird außerhalb des Größencontainers gerendert und berücksichtigt denselben tatsächlich sichtbaren Bereich wie Dialoge und Rückmeldungen. Unterhalb der Inhalte und über Systemrändern bleibt ein ausreichender Abstand. Der Listenkopf ist auf schmalen Geräten kompakter; dekorative Indizes treten zugunsten der Wünsche zurück.

Die sichtbare Höhe und der vertikale Versatz des Visual Viewports begrenzen offene Formulare bei einer Bildschirmtastatur. Direkte Aktionen bleiben sichtbar, während ergänzende Einleitungstexte vorübergehend entfallen. Außerhalb eines Dialogs wird die untere Leiste bei verdecktem unteren Bildschirmbereich ausgeblendet. Zoom wird dabei ausdrücklich von einer verkleinerten Eingabefläche unterschieden.

Messwerte und Testumfang stehen in [MOBILE-REVIEW.md](MOBILE-REVIEW.md).

## Dezente Anlassvarianten

Öffentliche und per Link geteilte Listen erkennen ihren Anlass aus dem Namen,
unabhängig von Groß-/Kleinschreibung: `Geburtstag` einschließlich Zusammensetzungen
wie `Geburtstagswünsche`, sowie `Weihnacht` für `Weihnachten`/`Weihnachtswünsche`.
Private Listen, normale Namen und Namen mit beiden Anlässen bleiben neutral.
Die Darstellung ändert keine gespeicherten Angaben oder Freigaberechte.

- Geburtstag: leicht rosiges Papier, warme Rosé-Akzente und ein gestrichelter
  Geschenkanhänger am Titel.
- Weihnachten: cremefarbenes Papier, Tannengrün und gedämpftes Gold; eine kleine
  goldene Kante am Anhänger.
- Das allgemeine Standardsymbol wird passend zu Torte oder Tanne. Ein bewusst
  gewähltes anderes Listensymbol bleibt erhalten.
- Typografie, Kartengrößen, Touchflächen und Reihenfolge bleiben dieselben. Es
  kommen keine zusätzlichen Banner, Animationen oder dekorativen Flächen hinzu.
- Überschrift, Kartenflächen, Filter, Angebotsbuttons und Kaufdialoge verwenden
  dieselben Anlass-Tokens. Die dunkle Wunschnagel-Navigation bleibt erkennbar.
- Die Tokens werden beim Wechsel auf eine neutrale/private Liste wieder entfernt.
  Sie gelten auch für native Dialoge und die mobile Aktionsleiste außerhalb des
  App-Containers. Reduzierte Bewegung bleibt berücksichtigt.

Visuell geprüft in Chrome und mobilem WebKit, einschließlich 320 Pixel Breite,
Kontrastprüfung und des thematisch passenden Kaufdialogs. Im Zuge der mobilen
Prüfung wurde die Gast-Kaufaktion über die volle Kartenbreite gesetzt; der
„Bereits gekauft“-Hinweis bleibt innerhalb des kleinen Produktbildes.
