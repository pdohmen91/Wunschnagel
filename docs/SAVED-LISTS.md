# Gemerkte Wunschlisten

Angemeldete Nutzer können geteilte Listen mit „Liste merken“ in ihrem Konto speichern. Gäste sehen stattdessen „Zum Merken anmelden“. Mobil erscheinen die Einträge im Bereich „Gemerkte Listen“ des Listen-Dialogs, den „Listen“ im Kopfbereich öffnet. Am Desktop klappt „Gemerkte Listen“ im Seitenmenü die Einträge direkt auf. Ein Klick auf eine Liste öffnet sie ohne zusätzlichen Dialog; „Merker verwalten“ öffnet die Übersicht mit Entfernen-Funktion. Das Menü lässt sich auch per Tastatur öffnen und schließen.

- Merken und der Bereich „Gemerkte Listen“ erfordern eine Anmeldung. Es gibt keine anonyme oder lokale Ersatzspeicherung.
- Konto-Merker sind nach der Anmeldung auch auf anderen Geräten verfügbar.
- Der Name des Listenbesitzers steht als kräftige erste Zeile („Von …“) über dem kleineren Listentitel. So lassen sich auch gleichnamige Listen schnell zuordnen. Ohne Profilnamen bleibt der Titel sichtbar, ergänzt um „Name nicht verfügbar“.
- Alte Gast-Merker im Schlüssel `wunschnagel-saved-lists-v1` werden beim Laden entfernt, ohne ihren Inhalt zu lesen oder hochzuladen. Bereits gespeicherte Konto-Merker bleiben bestehen.
- Entfernen löscht nur den Merker. Eigentümer, Mitglieder, Wünsche und Geschenkmarkierungen bleiben unberührt.
- Erneuerte Links ersetzen beim Merken den alten Verweis derselben Liste. Eine erneute Freigabe muss zunächst vom Besitzer oder einem Mitbearbeiter geteilt werden; Merker umgehen keine Sperre.

## Zugriff und gespeicherte Daten

Die Tabelle `wishlist_bookmarks` hat RLS, keinerlei Client-Tabellenrechte und drei ausschließlich authentifizierten Rollen zugängliche RPCs. Jede Funktion prüft die aktuelle Benutzer-ID gegen `expected_user`; damit darf auch ein verspäteter Auftrag nach einem Kontowechsel nicht in einem anderen Konto ausgeführt werden. Alle Definer-Funktionen verwenden einen leeren `search_path` und explizite Benutzerfilter.

Gespeichert werden Listen-ID, Freigabeart und -verweis, zuletzt gemerkter Titel/Emoji, Profilname des Besitzers und Zeitpunkt. Der Name kommt aus `full_name`, ersatzweise `name`, in den Kontometadaten und ist auf 100 Zeichen begrenzt. E-Mail-Adressen und übrige Kontometadaten werden nicht übertragen. Keine Wünsche, Notizen, Preise, Käuferinformationen oder Bearbeitungsrechte. Freigabetokens sind Zugangsdaten und bleiben im persönlichen Speicher, niemals in öffentlichen Tabellenprojektionen oder dem Service-Worker-Cache.

Beim Abrufen werden aktuelle Titel/Emoji und Profilnamen nur für weiterhin über genau diesen Verweis zugängliche Listen ergänzt. Die Migration `202611100001_saved_list_owner_names.sql` ergänzt Namen für bestehende, weiterhin zugängliche Merker. Nach Linkwechsel, Privatschaltung oder Löschung erscheint der alte Merker mit „Link nicht mehr verfügbar“; neue private Titel/Emoji/Namen werden nicht übertragen. Der beim Merken gespeicherte Name bleibt erkennbar. Auch das Öffnen prüft die Freigabe erneut über die bestehenden geteilten RPCs. Geteilte Verweise werden vor dem Anzeigen validiert. Merker machen die Liste nicht offline zugänglich.

Die Anzahl ist auf 100 pro Konto begrenzt. Der Server serialisiert neue Einträge pro Konto; Updates bleiben am Limit möglich. Kontoantworten werden bei Abmeldung oder Kontowechsel verworfen. Konto-Merker gelangen nicht als lokale Backups in den Browser. Schreibfehler werden angezeigt, ohne einen falschen Erfolgsstatus zu setzen.

## Namensanzeige veröffentlichen

Für „Von …“ sind sowohl die Datenbankmigration `202611100001_saved_list_owner_names.sql` als auch der neue Frontend-Build erforderlich. Zuerst die Migration anwenden, danach das Frontend veröffentlichen. Ein Frontend-Update allein ergänzt keine Namen in den Serverantworten. Bestehende, weiterhin zugängliche Konto-Merker erhalten den Namen automatisch; erneutes Merken ist nicht erforderlich.

Nach der Veröffentlichung die App neu laden und mit einem zweiten Konto prüfen, dass eine bereits gemerkte Liste den Namen ihres Besitzers über dem Listentitel zeigt. Bei installierter PWA auch die aktivierte App-Version prüfen. Der Test mit simulierten Serverantworten bestätigt die Darstellung, ersetzt aber keine Prüfung der produktiven Migration.

## Prüfungen

`tests/saved-lists.test.ts`: echte SQL-Migrationen mit PostgreSQL/PGlite; Rollenrechte, Kontotrennung, keine Bearbeitungs-/Mitgliedschaftsrechte, Widerruf, neue private Metadaten, Linkwechsel, Löschung, Limit, sichere Verweise und Entfernung der alten Gast-Speicherung.

`tests/auth/saved-lists.spec.ts`: Chrome und iPhone-WebKit; Gastzugriff gesperrt, Merken/Wiederöffnen/Entfernen im Konto, 320-px-Ansicht mit Barrierefreiheitsprüfung, keine Übernahme alter Gast-Merker, Kontopersistenz/Abmeldung, Schreib- und Ladefehler.

`tests/live/saved-lists.mjs`: optionaler Test mit ausschließlich neu erstellten QA-Konten und Listen; echte RPCs sowie zwei unabhängige Browserkontexte, Aufräumen im `finally`. Keine echten Nutzerlisten, E-Mails oder Shopzugriffe.

## Ausschließlich geheime Ansichtslinks

Neue Merker sind nur mit gültigem Freigabetoken möglich. `202611100004_link_only_sharing.sql` wandelt noch öffentliche Listen in „Mit Link“ um und aktualisiert deren bestehende öffentliche Merker auf den neuen Token. Private, gelöschte oder zuvor widerrufene Verweise werden nicht wieder freigegeben. Alte öffentliche Merker ohne weiterhin zugängliche Liste bleiben als entfernbare, nicht verfügbare Einträge erhalten. Alte ID-basierte öffentliche URLs werden im Frontend mit einem Hinweis auf einen neuen Ansichtslink abgewiesen und liefern über die frühere RPC keine Daten.
