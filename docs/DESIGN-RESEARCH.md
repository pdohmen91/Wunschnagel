# Design-Recherche und Funktionsbewertung

Recherchiert am 7. November 2026. Grundlage sind aktuelle Herstellerseiten und dokumentierte Gestaltungsprinzipien. Die gestalterische Bewertung der eigenen App ist eine fachliche Einschätzung, keine Nutzerstudie und kein objektiver Test, ob eine Oberfläche „nach KI“ aussieht.

## Richtung für die Oberfläche

[Apples „Principles of great design“, WWDC26](https://developer.apple.com/videos/play/wwdc2026/250/) betont verständliche Sprache, klare Hierarchie, konsistente Interaktionen und sorgfältige Anpassung an unterschiedliche Geräte. Daraus folgt für diese App: Listen und Produktinformationen erhalten mehr Gewicht, Texte werden kürzer und zentrale Aktionen bleiben sichtbar.

[Nielsen Norman Group: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) beschreibt, wie unnötige Information mit relevanten Inhalten konkurriert. Die Veröffentlichung stammt von 2021; das Prinzip wurde hier erneut geprüft und als stabile Grundlage verwendet, nicht als neuer Designtrend ausgegeben.

Meine konkrete Designentscheidung: eine sachliche Alltags-App mit neutralen Flächen, einer zurückhaltenden grünen Akzentfarbe, Systemschrift und kompakten Bedienelementen. Markenname und selbst gewählte Listensymbole bleiben erhalten. Die dekorativen Spruchkästen, die zusätzliche Werbezeile, Serifenschrift in Überschriften, Herz-/Sternverzierungen und die große zusätzliche Hinzufügen-Kachel entfallen. Eine leere Liste erklärt konkret, wie der erste Wunsch angelegt wird.

Das ist keine Übernahme von Apples Plattformmaterialien oder einer fremden App-Oberfläche. Die Quellen liefern Prinzipien; die Umsetzung ist auf den konkreten Zweck dieser Wunschlisten-App abgestimmt.

## Sichtbarkeit und Layout

Die [W3C-Erläuterung zu Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) verlangt für gewöhnliche vertikal scrollende Inhalte eine Darstellung ohne Verlust von Information oder Funktion bis zur Breite von 320 CSS-Pixeln. Eine passende Seitenbreite allein beweist aber noch nicht, dass jede Aktion anklickbar ist.

Deshalb wurden zusätzlich die Positionen einzelner Aktionen geprüft: Teilen, Wunsch hinzufügen, Liste bearbeiten, Sortierung, Suche, Menüs und die Schaltflächen im Formular. Die Prüfung kontrolliert auch, ob die Mitte des Elements von einem anderen Element verdeckt wird.

Die im Nutzerscreenshot gezeigte starke Verschiebung war vor der Überarbeitung in den installierten Chrome- und WebKit-Testversionen nicht exakt reproduzierbar. Das Layout wurde von einer feststehenden Seitenleiste mit zusätzlichem Inhaltsrand auf ein explizites CSS-Grid umgestellt. Die Prüffälle umfassen nun ausdrücklich die leere Weihnachtsliste und große Desktop-Breiten. Ein nachgestelltes kurzes Formular zeigte außerdem ein tatsächlich verdecktes Preisfeld; der Formularinhalt scrollt jetzt getrennt von den Aktionen.

Nachtrag zur anschließenden Diagnose: Eine Messung des tatsächlich geöffneten Tabs zeigte, dass dessen gemeldete Inhaltsbreite größer als der sichtbare Bildschirmbereich war. Diesen Fall deckten die bisherigen normalen Browserfenster nicht ab. Die App berücksichtigt nun die sichtbare Fensterfläche und verwendet diese auch für ihre responsiven Breakpoints. Details und Messwerte stehen im [Prüfbericht](UX-REVIEW.md).

## Sinnvolle Funktionen

| Priorität | Funktion | Nutzen und Stand |
| --- | --- | --- |
| Hoch | Reservieren / als gekauft markieren | Verhindert Doppelgeschenke. Die Reservierung wird in der normalen Ansicht des Beschenkten verborgen. Noch nicht implementiert. |
| Hoch | Besonders gewünschte Artikel markieren | Hilft Freunden und Familie bei der Auswahl. Noch nicht implementiert. |
| Mittel | Nach Preis, Name und Datum sortieren | Erleichtert die Auswahl nach Budget und das Wiederfinden. In dieser Überarbeitung implementiert; auch in der geteilten Listenansicht verfügbar. |
| Mittel | Eigenes Bild hochladen | Hilfreich, wenn ein Shop keine Vorschau liefert oder sich der Wunsch auf etwas Eigenes bezieht. Derzeit ist nur eine manuelle Bildadresse möglich. |
| Mittel | Wünsche zwischen eigenen Listen verschieben | Erleichtert das Aufräumen nach einem Anlass. Noch nicht implementiert. |
| Später | Anlassdatum und Kalenderexport | Eine eigene Empfehlung für Geburtstage und Weihnachten. Ein Kalenderexport kann ohne zusätzlichen Mailversand arbeiten. Noch nicht implementiert. |

[Elfsters aktuelle Hilfe zum Kaufstatus](https://help.elfster.com/en/articles/11517983-how-do-i-mark-that-i-bought-an-item-on-another-elfster-wishlist) beschreibt einen für andere Schenkende sichtbaren Kaufstatus, der dem Besitzer der Liste nicht angezeigt wird. Das ist die Grundlage für die Empfehlung gegen Doppelgeschenke; es ist in dieser App noch keine vorhandene Funktion.

[Giftsters List Basics](https://help.giftster.com/article/39-tips-when-using-my-lists) dokumentiert Wunschprioritäten, Sortierung nach Preis, Name und Datum, eigene Bilder und das Kopieren in andere Listen. Nicht jede dieser Möglichkeiten muss sofort in die Oberfläche: Für diese Familien-App sind Reservierungen und eine einfache Markierung „Besonders gewünscht“ die nächsten sinnvollen Schritte.

Reservierungen brauchen eigene Zugriffsregeln und einen atomaren Vorgang, damit zwei Personen nicht gleichzeitig denselben Wunsch reservieren. Sie dürfen nicht einfach mit dem bisherigen Besitzerstatus „Erfüllt“ gleichgesetzt werden. Die konkrete Anmeldung für Schenkende und die Rücknahme einer Reservierung müssen dabei zusammen gelöst werden.

## Kosten und Daten

Die Änderungen betreffen Frontend, Sortierung und lokale Prüfungen. Sie benötigen keinen weiteren Hostingdienst oder Vorschauanbieter. Bereits gespeicherte Listen und Wünsche werden durch die Überarbeitung nicht gelöscht, umbenannt oder neu befüllt. Die bekannten Grenzen des vorgesehenen kostenlosen Betriebs und die ausstehende Supabase-Einrichtung gelten weiter.
