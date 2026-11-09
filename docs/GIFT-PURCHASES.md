# Geschenk-Kaufmarkierungen

Gäste einer freigegebenen Liste können einen Wunsch ohne Anmeldung als gekauft
markieren. Das gilt für geheime Leselinks und öffentliche Listen.

## Bedienung

- Produktbild, „Zum Shop“ und Angebots-/Preisvergleichslink öffnen zuerst einen
  kurzen Dialog mit der Erinnerung, nach dem tatsächlichen Kauf zu markieren.
  Erst der Link im Dialog öffnet den externen Shop in einem neuen Tab.
- Das bloße Öffnen markiert nichts. „Als gekauft markieren“ ist eine bewusste,
  getrennte Aktion; der Button ist auch direkt am Wunsch erreichbar.
- Andere Gäste sehen „Bereits gekauft“ am Bild und unter der Karte. Beim Öffnen
  eines solchen Artikels erscheint eine Warnung vor einem doppelten Geschenk.
- Die Kaufmarkierung kann der Käufer im selben Browser verwalten und aufheben.
  Andere Gäste erhalten diese Möglichkeit nicht. Nach dem Löschen der Browserdaten
  oder auf einem anderen Gerät ist der dafür benötigte Beleg nicht vorhanden.
- Die Liste aktualisiert den Status bei Rückkehr und alle zehn Sekunden, solange
  sie sichtbar ist und kein Dialog offen ist. Der Shop-Dialog prüft den aktuellen
  Status vor dem Freigeben seiner Aktionen und erneut bei Rückkehr aus dem Shop.

## Daten und Berechtigungen

`wish_purchases` ist eine eigene Tabelle ohne direkte Rechte für `anon` oder
`authenticated`, einschließlich Besitzer und Mitbearbeiter. `wishes` und dessen
`fulfilled`-Status ändern sich beim Markieren nicht. Die normale Besitzeransicht
und der eigene, angemeldet geöffnete Leselink liefern keinen Kaufstatus aus.
Andere Gäste erhalten nur `purchased: true/false`, keine Käuferdaten oder Belege.

`purchase_wish` und `undo_wish_purchase` prüfen die gültige Listenfreigabe, den
Lesetoken bei geheimen Listen, die Zugehörigkeit des Wunsches und die Identität
des angemeldeten Besitzers. Private Listen und widerrufene Links erlauben keine
Kaufaktionen. Die privaten Definer-Helfer sind nicht per API ausführbar und haben
einen leeren `search_path`.

Ein zufälliger 256-Bit-Beleg wird vor der Markierung im Browser gespeichert;
serverseitig liegt nur sein SHA-256-Hash. Eine Wiederholung mit demselben Beleg
ist idempotent, auch nach einer verlorenen Antwort. Ein anderer Beleg kann eine
bestehende Markierung nicht überschreiben oder löschen. Der eindeutige
Primärschlüssel pro Wunsch entscheidet auch bei parallelen Anfragen atomar.

Wird ein Wunsch als erhalten markiert, wieder geöffnet oder seine Produkt-URL
geändert, entfällt die bisherige Kaufmarkierung. Änderungen an Notizen, Bildern
oder Preisen lassen sie bestehen. Gelöschte Wünsche/Listen entfernen zugehörige
Markierungen per Fremdschlüssel-Kaskade.

## Grenzen

Ohne Anmeldung lässt sich der Besitzer nicht von anderen Gästen unterscheiden.
Der abgemeldet oder im privaten Browser geöffnete eigene Freigabelink zeigt die
Gastansicht. Eine strengere Geheimhaltung ist mit anonym lesbaren Links nicht
möglich. Die normale angemeldete Besitzeransicht bleibt unverändert.

Wer einen freigegebenen Link kennt, kann auch bewusst eine falsche Markierung
setzen. Die App prüft keine Bestellungen bei Shops. Es gibt keine Reservierung
vor dem Kauf und keine Garantie gegen zwei zeitgleiche externe Bestellungen.
Die Kennzeichnung hilft bei der Abstimmung und verhindert das Überschreiben
der ersten Kaufmarkierung in der Datenbank.

## Validierung

- 87 Code-/SQL-Tests, einschließlich anonymer Rechte, Besitzer-Geheimhaltung,
  privaten/falschen/widerrufenen Links, idempotenten Wiederholungen, fremden
  Belegen, Rücknahme und Status-/Produktwechseln.
- Browserprüfung in Chrome sowie mobilem WebKit: Hinweis vor allen drei
  Linkarten, kein unbeabsichtigtes Markieren, Shop in eigenem Tab, explizites
  Markieren, Wiederöffnen und Rücknahme, Fehler und erneuter Versuch,
  Besitzerprojektion, Kontrast/Zugänglichkeit und sichtbare Aktionen bei 390×650.
- Die bestehende Browser-Gesamtsuite wurde auf Regressionen geprüft; die vier
  Hilfetext-Prüfungen wurden an die neue Erklärung angepasst und erneut bestanden.
- Isolierte Produktions-API-Prüfung: 31 Prüfungen bestanden, einschließlich zwei
  gleichzeitiger anonymer Markierungen. Keine echten Nutzerwünsche wurden gelesen
  oder verändert. Die QA-Konten und alle zugehörigen Daten sind bereinigt.
- Die vollständige mobile Live-Prüfung ist über `tests/live/gift-purchases.mjs`
  reproduzierbar. Sie verwendet zwei unabhängige Gast-Browserkontexte und einen
  angemeldeten QA-Besitzer, niemals bestehende persönliche Listen.

Quellen für die verwendeten Datenbankmechanismen:
[Supabase Database Functions](https://supabase.com/docs/guides/database/functions),
[PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html).
