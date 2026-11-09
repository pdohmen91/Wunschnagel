# Sicherheit von Wunschnagel

Wunschnagel speichert private Wünsche. Der Browser ist keine Vertrauensgrenze:
Berechtigungen müssen in PostgreSQL/RPCs und der Edge Function erzwungen werden.

- Private Listen: Besitzer und ausdrücklich eingeladene Mitbearbeiter.
- Mit Link: Jeder mit dem Leselink kann die Inhalte ansehen und Geschenke ohne
  Anmeldung als gekauft markieren. Das gibt keine Bearbeitungsrechte an Wünschen. Einen Link nur an
  die gewünschten Personen weitergeben; zum Entziehen den Link erneuern oder
  die Liste privat stellen. Bereits kopierte Inhalte lassen sich nicht zurückholen.
- Öffentlich: Jeder mit der Listenadresse kann die Inhalte ansehen und
  Geschenk-Kaufmarkierungen setzen. Kein Schutz
  für persönliche oder vertrauliche Angaben.
- Einladungslink: Wer ihn erhält, kann nach Anmeldung ausdrücklich beitreten.
  Er gilt sieben Tage. Deaktivieren verhindert neue Beitritte; bestehende
  Mitbearbeiter muss der Besitzer separat entfernen. Entfernen deaktiviert außerdem
  den Einladungslink, damit kein erneuter Beitritt über den alten Link möglich ist.
- Mitbearbeiter dürfen Wünsche ändern und löschen. Listeneinstellungen und
  Mitgliederverwaltung bleiben beim Besitzer. Dieser sieht zur Unterscheidung
  auch die bestätigte Konto-E-Mail-Adresse der Mitbearbeiter.

## Verborgene Geschenk-Kaufmarkierungen

Käufe werden getrennt vom Wunsch und dessen `fulfilled`-Status gespeichert.
Browser-Rollen haben keinerlei direkte Tabellenrechte auf `wish_purchases`.
Begrenzte RPCs prüfen Sichtbarkeit, Lesetoken, Zugehörigkeit des Wunsches und
schließen den angemeldeten Besitzer aus. Eigentümer-Abfragen und deren eigene
Freigabeansicht enthalten keinen Kaufstatus. Andere Gäste erhalten nur ein Ja/Nein,
keinen Käufer, Zeitpunkt oder geheimen Beleg.

Zum Aufheben benötigt der Gast den zufälligen 256-Bit-Beleg, den dieser Browser
vor der Markierung lokal speichert. In der Datenbank steht nur sein SHA-256-Hash.
Fremde Gäste können eine Markierung nicht mit einem eigenen Beleg überschreiben
oder löschen. Bei gelöschten Browserdaten oder Gerätewechsel ist ein eigener
Beleg nicht mehr verfügbar. Ein Link-Widerruf sperrt auch neue Kaufaktionen über
den alten Link. Beim Wechsel von `fulfilled` oder der Produkt-URL werden die
bisherigen Kaufmarkierungen für den betroffenen Wunsch zurückgesetzt.

Ohne Anmeldung ist ein Besucher nicht als Besitzer identifizierbar: Wer seinen
eigenen Freigabelink abgemeldet oder in einem privaten Browser öffnet, erhält
technisch dieselbe Gastansicht wie andere. Strikte Geheimhaltung gegenüber
solchen anonymen Besitzeraufrufen ist mit einem anonym lesbaren Link nicht
möglich. Die normale angemeldete Besitzeransicht bleibt unverändert.

Ein freigegebener Link ist auch die Berechtigung zum Markieren. Wer ihn besitzt,
kann bewusst unzutreffende Markierungen setzen; keine Kaufbelege oder
Shop-Bestellungen werden überprüft. Der Hinweis ist keine Reservierung vor dem
Kauf und kann zwei zeitgleiche Käufe im externen Shop nicht verhindern. Die
Datenbank verhindert jedoch das Überschreiben paralleler Markierungen. Schon
gesetzte Markierungen werden Gästen regelmäßig und bei Rückkehr zur Seite neu
angezeigt; bei offline geöffneten Listen ist kein aktueller Status garantiert.

## Änderungen prüfen

```sh
npm ci
npm audit --audit-level=high
npm test
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/wunschliste-playwright npm run test:browser
npm run build
```

Die CI prüft zusätzlich Produktions-CSP, iframe-Schutz, PKCE und Offline-Start.
Für lokale Browser-Tests werden Chrome und Playwright WebKit benötigt; die CI
installiert ihre eigenen Browser. Live-Prüfungen in `tests/live/` sind ausdrücklich
opt-in: Sie benötigen einen administrativen CLI-Zugang, erstellen nur isolierte
Konten unter `example.invalid`, versenden keine E-Mails und räumen diese Konten
im `finally`-Block wieder auf. Die CLI-Zugangsdaten gehören niemals in die App.

Supabase-Publishable-/Anon-Keys sind öffentlich. Service-/Secret-Keys,
Google-Client-Secrets und persönliche Zugriffstokens dürfen weder unter `VITE_*`
stehen noch ins Repository gelangen. Neue Tabellen, Spalten und Funktionen
brauchen explizite Rechte und negative Zugriffstests. `SECURITY DEFINER` erfordert
explizite Autorisierung und einen leeren `search_path`.

## Rollout der Migrationen 202611090003 / 202611090004

Zuerst die ergänzende Migration `202611090003_public_projection.sql` einspielen,
dann das Frontend mit `get_public_wishlist` veröffentlichen und erst danach
`202611090004_security_hardening.sql` anwenden. Das verhindert einen Ausfall
öffentlicher Listen während des Wechsels. Alte bereits geladene Frontends können
nach der letzten Migration eine Aktualisierung benötigen. Bei Neuinstallationen
alle Migrationen in der normalen Reihenfolge ausführen.

## Sicherheitsprobleme melden

Keine privaten Listen, Token oder Zugangsdaten in öffentliche Issues schreiben.
Für vertrauliche Meldungen die private GitHub-Sicherheitsmeldung des Repositories
verwenden, sofern aktiviert; andernfalls dem Betreiber über einen bereits
bekannten privaten Kontaktweg nur eine kurze Beschreibung senden und zunächst
einen sicheren Austauschweg vereinbaren. Keine Konten oder Daten anderer Nutzer
zum Nachweis verändern.

Details, durchgeführte Tests und verbleibende Grenzen:
[Security Review](docs/SECURITY-REVIEW.md).
