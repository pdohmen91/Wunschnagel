# Gemerkte Wunschlisten

Geteilte Listen bieten „Liste merken“. Der Eintrag erscheint im Bereich „Gemerkte Listen“ des Listen-Dialogs. Mobil öffnet ihn „Listen“ im Kopfbereich; am Desktop gibt es zusätzlich einen direkten Navigationseintrag.

- Ohne Anmeldung: ausdrücklich gespeicherte Verweise in `wunschnagel-saved-lists-v1` im Browser/App-Speicher. Browser und installierte iPhone-App können getrennte Speicher haben. Gelöschte Websitedaten löschen diese Merker.
- Mit Anmeldung: private Einträge im eigenen Konto, auf anderen Geräten nach Anmeldung verfügbar. Lokale Merker werden **nicht automatisch hochgeladen**. „Ins Konto übernehmen“ ist eine ausdrückliche Einzelaktion.
- Entfernen löscht nur den Merker. Eigentümer, Mitglieder, Wünsche und Geschenkmarkierungen bleiben unberührt.
- Erneuerte Links ersetzen beim Merken den alten Verweis derselben Liste. Eine erneute Freigabe muss zunächst vom Besitzer geteilt werden; Merker umgehen keine Sperre.

## Zugriff und gespeicherte Daten

Die Tabelle `wishlist_bookmarks` hat RLS, keinerlei Client-Tabellenrechte und drei ausschließlich authentifizierten Rollen zugängliche RPCs. Jede Funktion prüft die aktuelle Benutzer-ID gegen `expected_user`; damit darf auch ein verspäteter Auftrag nach einem Kontowechsel nicht in einem anderen Konto ausgeführt werden. Alle Definer-Funktionen verwenden einen leeren `search_path` und explizite Benutzerfilter.

Gespeichert werden Listen-ID, Freigabeart und -verweis, zuletzt gemerkter Titel/Emoji und Zeitpunkt. Keine Wünsche, Notizen, Preise, Käuferinformationen oder Bearbeitungsrechte. Freigabetokens sind Zugangsdaten und bleiben im persönlichen Speicher, niemals in öffentlichen Tabellenprojektionen oder dem Service-Worker-Cache.

Beim Abrufen werden aktuelle Titel/Emoji nur für weiterhin über genau diesen Verweis zugängliche Listen ergänzt. Nach Linkwechsel, Privatschaltung oder Löschung erscheint der alte Merker mit „Link nicht mehr verfügbar“; neue private Titel/Emoji werden nicht übertragen. Auch das Öffnen prüft die Freigabe erneut über die bestehenden geteilten RPCs. Lokale Merker werden beim Öffnen validiert, nicht mit einer kopierten Liste offline zugänglich gemacht.

Die Anzahl ist auf 100 pro Konto bzw. lokalem Speicher begrenzt. Der Server serialisiert neue Einträge pro Konto; Updates bleiben am Limit möglich. Kontoantworten werden bei Abmeldung oder Kontowechsel verworfen. Konto-Merker gelangen nicht als lokale Backups in den Browser. Schreibfehler werden angezeigt, ohne einen falschen Erfolgsstatus zu setzen.

## Prüfungen

`tests/saved-lists.test.ts`: echte SQL-Migrationen mit PostgreSQL/PGlite; Rollenrechte, Kontotrennung, keine Bearbeitungs-/Mitgliedschaftsrechte, Widerruf, neue private Metadaten, Linkwechsel, Löschung, Limit und sichere lokale Verweise.

`tests/auth/saved-lists.spec.ts`: Chrome und iPhone-WebKit; Merken/Wiederöffnen/Entfernen, 320-px-Ansicht mit Barrierefreiheitsprüfung, keine automatische Übernahme, Kontopersistenz/Abmeldung, Schreib- und Ladefehler.

`tests/live/saved-lists.mjs`: optionaler Test mit ausschließlich neu erstellten QA-Konten und Listen; echte RPCs sowie zwei unabhängige Browserkontexte, Aufräumen im `finally`. Keine echten Nutzerlisten, E-Mails oder Shopzugriffe.
