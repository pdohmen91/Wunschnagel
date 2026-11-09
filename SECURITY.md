# Sicherheit von Wunschnagel

Wunschnagel speichert private Wünsche. Der Browser ist keine Vertrauensgrenze:
Berechtigungen müssen in PostgreSQL/RPCs und der Edge Function erzwungen werden.

- Private Listen: Besitzer und ausdrücklich eingeladene Mitbearbeiter.
- Mit Link: Jeder mit dem Leselink kann die Inhalte ansehen. Einen Link nur an
  die gewünschten Personen weitergeben; zum Entziehen den Link erneuern oder
  die Liste privat stellen. Bereits kopierte Inhalte lassen sich nicht zurückholen.
- Öffentlich: Jeder mit der Listenadresse kann die Inhalte ansehen. Kein Schutz
  für persönliche oder vertrauliche Angaben.
- Einladungslink: Wer ihn erhält, kann nach Anmeldung ausdrücklich beitreten.
  Er gilt sieben Tage. Deaktivieren verhindert neue Beitritte; bestehende
  Mitbearbeiter muss der Besitzer separat entfernen. Entfernen deaktiviert außerdem
  den Einladungslink, damit kein erneuter Beitritt über den alten Link möglich ist.
- Mitbearbeiter dürfen Wünsche ändern und löschen. Listeneinstellungen und
  Mitgliederverwaltung bleiben beim Besitzer. Dieser sieht zur Unterscheidung
  auch die bestätigte Konto-E-Mail-Adresse der Mitbearbeiter.

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
