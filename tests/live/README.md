# Online-Prüfung für gemeinsame Bearbeitung

`shop-matrix.mjs` prüft die öffentlichen Produktbeispiele aus `shop-samples.json` direkt über die produktive Edge Function. Es verwendet dieselben QA-Verbindungsvariablen, erstellt ein isoliertes Konto und entfernt es samt Vorschau-Budget danach. Bereits vorhandene Nutzerdaten werden nicht gelesen. Optional wählt `WUNSCHNAGEL_QA_SHOPS` eine kommaseparierte Teilmenge; es gibt keine automatischen Wiederholungen gesperrter Anfragen. `WUNSCHNAGEL_QA_CHECK_IMAGES=1` lädt die gefundenen Bilder einmal ohne Referrer in WebKit und erstellt `test-results/shop-images-audit.png`. `WUNSCHNAGEL_QA_REPORT` legt den Pfad des JSON-Berichts fest. Ergebnisse hängen von Shop, Region, Variante und Zeitpunkt ab; ein gemeldeter Shop-Fehler ist kein erfolgreich verifizierter Import.

`automatic-price.mjs` verwendet dieselben Verbindungsvariablen wie unten und prüft zusätzlich die Preisermittlung der produktiven Edge Function an zwei unabhängig öffentlich recherchierten Produkten von Fivi und Apple. Ein isoliertes Konto testet im mobilen WebKit die sichtbare Preisvorschau, das Speichern, den Schutz selbst eingegebener Preise, die ausdrückliche Übernahme eines neuen Shop-Preises und den Preis für Lesegäste. Die Preisvorschau wird mit axe geprüft. Auch dieses Skript löscht seine Testdaten anschließend vollständig.

Für eine andere unabhängig geprüfte Preisreferenz können `WUNSCHNAGEL_QA_PRODUCT_URL` und `WUNSCHNAGEL_QA_EXPECTED_PRICE` gesetzt werden. Dann entfällt der direkte Abruf der Shopify-Preisreferenz; ein fehlgeschlagener Referenzabruf wird nicht automatisch wiederholt.

`collaboration.mjs` prüft die tatsächlichen Supabase-Zugriffsregeln und die mobile Oberfläche mit drei kurzlebigen, ausdrücklich als QA erkennbaren Konten. Vorhandene Konten und Listen werden nicht gelesen. Die Konten werden per Admin-API ohne Versand von E-Mails erstellt; nach dem Test werden sie samt eigenen Listen, Wünschen, Einladungen und Mitgliedschaften in `finally` gelöscht.

Benötigt werden eine angemeldete Supabase-CLI mit Zugriff auf das explizit gewählte Projekt, Playwright-Browser und eine lokale JSON-Datei mit ausschließlich öffentlichen Verbindungsdaten (`url`, `publishable_key`). Den Admin-Schlüssel liest das Skript nur in den Arbeitsspeicher; er wird weder gespeichert noch in den Browser übertragen.

```sh
WUNSCHNAGEL_QA_CONFIG=/pfad/public-config.json \
WUNSCHNAGEL_QA_SUPABASE=/pfad/supabase \
WUNSCHNAGEL_QA_BASE=https://pdohmen91.github.io/Wunschnagel/ \
node tests/live/collaboration.mjs
```

Standardmäßig wird WebKit mit einem mobilen Viewport verwendet. `WUNSCHNAGEL_QA_BROWSER=chrome` wählt Chrome. Die Basisadresse kann auch auf eine lokale Version zeigen, die für dasselbe Backend konfiguriert ist. Bilder der Freigabe-, Einladungs- und Mitgliederansicht landen im ignorierten Verzeichnis `test-results/`.

Geprüft werden Erstellen einer Einladung, minimaler Gastzugriff vor dem Beitritt, ausdrückliche Annahme, Speichern der gemeinsamen Liste im Konto, Hinzufügen und Ändern von Wünschen, Schutz der Besitzereinstellungen, Aktualisierung für den Besitzer, reine Lesezugriffe über Ansichtslinks, Widerruf ohne Verlust bestehender Mitgliedschaften, Entfernen mit gesperrtem Wiederbeitritt sowie Verlassen ohne Löschen der Wünsche. Der Google-Handoff wird abgefangen und mit einer gültigen Sitzung des isolierten Testkontos abgeschlossen; die eigentliche Google-Zustimmung ist ein gesonderter manueller Test.

`collaboration.mjs` prüft außerdem die gleichen Verwaltungsrechte für Mitbearbeiter: Ansichtslink aktivieren und ersetzen, Einladungen weitergeben und deaktivieren, andere Mitbearbeiter entfernen, Listeneinstellungen ändern und die Liste löschen. Der Besitzer bleibt gegen Entfernung geschützt. Alle diese Schritte verwenden ausschließlich eigene QA-Listen und -Konten.

`npm test` führt zusätzlich die tatsächlichen Migrationen in PostgreSQL/PGlite aus. Die Tests prüfen unter anderem abgelaufene Einladungen, Schreibrechte auf fremde Listen, direkten Zugriff auf Mitgliedschaftstabellen und das kaskadierende Löschen von Mitgliedschaften.

## Gemerkte Listen

`tests/live/saved-lists.mjs` prüft mit zwei eigens angelegten und anschließend gelöschten QA-Konten die echten Merker-RPCs, private Kontotrennung, widerrufene Links, unveränderte Bearbeitungsrechte, gesperrtes Merken und Erstellen ohne Anmeldung, angemeldetes Erstellen und Synchronisierung zwischen unabhängigen mobilen WebKit-Kontexten. E-Mail-Versand und bestehende Nutzerdaten werden nicht verwendet.

Gleiche Umgebungsvariablen wie beim Geschenkstatus-Test: `WUNSCHNAGEL_QA_CONFIG`, `WUNSCHNAGEL_QA_SUPABASE`, optional `WUNSCHNAGEL_QA_BASE`; mit `WUNSCHNAGEL_QA_API_ONLY=1` ausschließlich API-Prüfung.

## Hervorgehobene Wünsche

`highlights.mjs` verwendet dieselben QA-Umgebungsvariablen. Es prüft ausschließlich mit neuen, anschließend gelöschten QA-Konten und Listen die Speicherung, Rollenrechte, sicheren geteilten Projektionen und den unveränderten Schutz der Kaufmarkierungen. Der mobile WebKit-Lauf prüft Umschalten, Bearbeiten, Neuanlegen und Persistenz sowie die entfernte Fußleiste. Shop-Vorschauen werden im Browser abgefangen; keine E-Mails oder Shopabrufe. `WUNSCHNAGEL_QA_API_ONLY=1` führt nur die Backend-Prüfungen aus.
