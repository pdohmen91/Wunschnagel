# Online-Prüfung für gemeinsame Bearbeitung

`automatic-price.mjs` verwendet dieselben Verbindungsvariablen wie unten und prüft zusätzlich die Preisermittlung der produktiven Edge Function an zwei unabhängig öffentlich recherchierten Produkten von Fivi und Apple. Ein isoliertes Konto testet im mobilen WebKit die sichtbare Preisvorschau, das Speichern, den Schutz selbst eingegebener Preise, die ausdrückliche Übernahme eines neuen Shop-Preises und den Preis für Lesegäste. Die Preisvorschau wird mit axe geprüft. Auch dieses Skript löscht seine Testdaten anschließend vollständig.

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

`npm test` führt zusätzlich die tatsächlichen Migrationen in PostgreSQL/PGlite aus. Die Tests prüfen unter anderem abgelaufene Einladungen, Schreibrechte auf fremde Listen, direkten Zugriff auf Mitgliedschaftstabellen und das kaskadierende Löschen von Mitgliedschaften.
