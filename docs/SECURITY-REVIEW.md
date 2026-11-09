# Sicherheitsprüfung – 9. November 2026

## Umfang und Stand

Geprüft wurden Frontend, Anmeldung und Sitzungsspeicher, PWA/Service Worker,
SQL-Migrationen, tatsächliche API-/Datenbankberechtigungen, Freigaben und
Einladungen, Shop-Import einschließlich SSRF-/Ressourcenrisiken, Abhängigkeiten,
Git-Historie sowie der Build-/Deployment-Workflow. Primärquellen stehen unten.
Das ist eine nachvollziehbare Prüfung mit Angriffstests, keine unabhängige
Penetrationstest-Zertifizierung und keine Zusicherung vollständiger Sicherheit.

Der gestufte Rollout ist abgeschlossen. Lokale Prüfungen, die Auth-Live-
Vorprüfung und 62 Produktions-Zugriffstests nach Entzug der alten Rechte sind
bestanden. **Auch die echte Google-Rückkehr in die installierte iPhone-App und
die erhaltene Anmeldung nach vollständigem Schließen/Öffnen sind vom Nutzer
bestätigt.**

Bestehende persönliche Wünsche wurden für diese Prüfung nicht gelesen oder
geändert. Produktionsprüfungen verwenden ausschließlich eigens angelegte
QA-Konten; E-Mail-Versand wird nicht ausgelöst. SQL-`TRUNCATE` wird ausschließlich
in einer lokalen PostgreSQL/WASM-Testdatenbank ausgeführt.

## Befunde und Korrekturen

| Priorität | Nachweis / Risiko | Korrektur |
| --- | --- | --- |
| Hoch als Bereinigung unnötiger Rechte; öffentlicher Angriffspfad nicht nachgewiesen | In Produktion hatten `anon` und `authenticated` geerbte `TRUNCATE`-/`TRIGGER`-/`REFERENCES`-Rechte. `TRUNCATE` unterliegt nicht RLS. Über die bestehende REST-API wurde kein ausführbarer Löschweg nachgewiesen. | Vollständiger Rechteentzug auf Anwendungstabellen, anschließend nur tatsächlich benötigte Operationen/Spalten freigeben. Standardrechte für künftige Anwendungstabellen/-funktionen verschärft. Negative SQL-Tests prüfen tatsächliche Ablehnung. |
| Mittel | Öffentlich lesbare Tabellen lieferten bei direktem API-Zugriff auch Besitzer-IDs und Freigabe-Token. Tokens einer öffentlichen Liste waren wegen der Sichtbarkeitsprüfung kein Zugang zu privaten Listen. | Öffentliche Inhalte ausschließlich über explizite sichere RPC-Projektionen; keine direkte anonyme Tabellenabfrage. Der RLS-umgehende Projektionshelfer ist für beide Browser-Rollen gesperrt. |
| Mittel | SDK-Voreinstellung verwendete implizite OAuth-Rückgaben mit Bearer-Token in der URL. Ein fremder Anmeldelink konnte eine unerwünschte Sitzung unterschieben. | PKCE mit S256 und lokalem Verifier; implizite Erkennung deaktiviert, Token/Provider-Token und Fehlerrückgaben vor SDK-Initialisierung aus URL entfernt. Nicht zuordenbare Codes erzeugen keine Sitzung. Die dafür geprüfte SDK-Version ist exakt festgelegt. |
| Mittel | SQL-Schreibrechte umfassten unveränderliche Metadaten, Besitzer-/Elternzuordnungen und selbst gesetzte Freigabe-Token. RLS verhinderte bereits fremde Besitzübernahmen, garantierte aber nicht jede beabsichtigte Spalteninvariante. | Spaltenrechte beschränkt. IDs, Zeitstempel, Besitzer, Elternliste und Token sind über normale API-Schreibzugriffe unveränderlich. Token-Erneuerung nur über eine Besitzer-prüfende Definer-Funktion. |
| Mittel | Anfragekörper wurde vor der Größenprüfung vollständig gelesen; Zeitlimits erfassten nicht sämtliche Upload-/Auth-/DNS-/Stream-Phasen. Fehlerhaftes HTML konnte wiederholte Suffix-Suchen auslösen. | Tatsächlich gelesene UTF-8-Bytes auf 4 KiB begrenzt, JSON-/Längenprüfung, 2 s Upload- und 12 s Gesamtfrist. Shop-Abruf weiter maximal 8 s/1 MiB/3 Weiterleitungen. Abbruch funktioniert auch bei nicht kooperierenden Streams/Resolvern; Parser verwenden begrenzte, fortschreitende Scans. |
| Mittel | Keine serverseitige Obergrenze für Listen/Wünsche/Mitglieder. Ein legitimes Konto konnte den kostenlosen Speicher belasten. | 50 eigene Listen, 500 Wünsche je Liste, 100 Mitbearbeiter je Liste, 500 neue Listen/Wünsche pro Konto und DB-Tag. Transaktionssperren und atomarer Budgetzähler. Bearbeiten/Löschen bleibt möglich. Bestehende Maximalwerte lagen vor der Umstellung unter diesen Grenzen. |
| Niedrig / zusätzliche Schutzschicht | Keine CSP und kein Schutz der angemeldeten Oberfläche vor iframe-Einbettung. Ohne nachgewiesene HTML-Injektion kein bestätigter XSS-Angriff. | CSP als frühes Meta-Element im Produktionsbuild: Skripte nur von eigener Origin, keine Inline-Handler/`eval`, keine fremden Frames/Objekte/Basis-URLs/Formularziele, API-Verbindungen auf Supabase beschränkt. Innerhalb eines Frames wird die Anwendungsoberfläche nicht gemountet. |
| Niedrig | Mitbearbeiternamen stammen aus veränderlichen Nutzer-Metadaten und können andere Personen imitieren. | Nur der Besitzer sieht zusätzlich die aus `auth.users` stammende bestätigte Konto-E-Mail-Adresse. Einladung erklärt diese Weitergabe. Metadaten entscheiden niemals über Rollen. |
| Niedrig | Öffentliche E-Mail-Anmeldung aktiv, obwohl die App ausschließlich Google anbietet; Zugriffstokens bislang 1 h gültig. | Öffentlichen E-Mail-Provider geschlossen; vorhandene echte Konten waren Google-Konten. Neue JWTs 15 Minuten, Erneuerungstoken rotieren weiter. Google-Client-Secret bleibt ausschließlich im Backend. |
| Mittel / zusätzliche Transportabsicherung | Direkte Postgres-/Pooler-Verbindungen konnten ohne TLS hergestellt werden. Die HTTP-APIs der App waren bereits verschlüsselt. | SSL Enforcement für direkte Datenbankverbindungen aktiviert und nach dem kurzen Supabase-Datenbankneustart bestätigt. |
| Niedrig / Lieferkette | GitHub-Actions per veränderlichem Versions-Tag, keine Sicherheitsprüfungen als Deployment-Voraussetzung. | Direkte Action-Verweise an vollständige Commit-SHAs gebunden; Checkout ohne persistierte Git-Zugangsdaten; Audit, SQL-/Parser-/Auth-Tests und Browser-Sicherheitsprüfungen vor Produktionsbuild. Schreibrechte nur im Deployment-Job, keine PR-Deployments. Dependabot erstellt wöchentliche Update-PRs; kein Auto-Merge. |

## Verifizierte vorhandene Schutzmaßnahmen

- Datenbank erzwingt Besitzer-/Mitbearbeiterrechte unabhängig von der UI.
  Mitgliedschaft erlaubt keine Listen-, Token- oder Einladungsverwaltung.
- Leselinks und Einladungen haben unterschiedliche zufällige 256-Bit-Token.
  Wechsel der Sichtbarkeit/Token-Erneuerung macht alte Leselinks ungültig;
  Einladungen laufen nach sieben Tagen ab. Entziehen der Mitgliedschaft ist
  nach dem nächsten API-Zugriff wirksam, auch bei bereits ausgestelltem JWT.
- Anwendungs-Definer-Funktionen autorisieren anhand `auth.uid()` und verwenden
  einen leeren `search_path`. Die zusätzliche plattformverwaltete RLS-Eventfunktion
  hat den sicheren Suchpfad `pg_catalog` und ist für Browser-Rollen gesperrt.
  Der private Projektionshelfer ist kein aufrufbarer API-Endpunkt.
- Shop-Import verlangt ein durch Supabase validiertes Nutzer-Token und hat ein
  atomar begrenztes Budget von 40 Vorschauen pro Konto/DB-Tag. CORS ist auf
  freigegebene Origins begrenzt, ersetzt aber keine Authentifizierung.
- Serverseitige Shop-Abrufe verwenden HTTPS und exakte freigegebene Hostnamen;
  URL-Zugangsdaten, IP-Literale, private/reservierte DNS-Antworten und unerlaubte
  Weiterleitungsziele werden verworfen. Keine Nutzer-Cookies oder Notizen werden
  an Shops weitergegeben. Bild-URLs werden nicht serverseitig heruntergeladen.
- React rendert Titel/Notizen als Text; keine dynamische HTML-Ausgabe oder
  Skriptauswertung. Externe Links verwenden `noopener noreferrer`, Bilder
  `no-referrer`. URL-Schemata und Eingabelängen werden validiert.
- Der Service Worker speichert die Anwendungshülle, keine Supabase-Antworten,
  privaten Listen oder Shop-Bilder. Die lokale Demo ist vom Online-Konto getrennt.
- Geheime Backend-Zugangsdaten gehören nicht zum Build. Der neue Build-Guard
  lehnt erkennbare Service-/Secret-/GitHub-Keys im Publishable-Key-Feld ab.
- GitHub Secret Scanning und Push Protection waren bei der lesenden Prüfung
  aktiviert. Keine Konten-/Repository-Schutzoptionen wurden stillschweigend
  verändert.

## Prüfnachweise

- `npm test`: **82 bestanden**, einschließlich realer SQL-Migrationen in PGlite,
  Rollen-/Spalten-/RLS-/RPC-Angriffen, Mengenlimits und Metadaten-Imitation.
- Vollständige Playwright-Suite: **187 bestanden, 12 planmäßig übersprungen**.
  Darin PKCE/S256, falsche Token-/Code-Rückgaben in Chrome und mobilem WebKit,
  CSP-Injektionsversuche, Frame-Schutz sowie Offline-Start im Pages-Unterpfad.
  Die übersprungenen Tests sind geräte-/projektabhängige Bestandsfälle, keine
  fehlgeschlagenen Sicherheitsprüfungen.
- `npm run build`: erfolgreich. `npm audit --audit-level=high`: **0 gemeldete
  Schwachstellen**, einschließlich Entwicklungsabhängigkeiten, am Prüfdatum.
- Geheimnis-Mustersuche: **87 zu Beginn verfolgte Dateien** sowie **206 historische
  Blobs aus 360 Git-Objekten** geprüft; keine Treffer für Private Keys,
  Supabase-Service-/Secret-/PAT-, GitHub- oder Google-Client-Secrets. Das ist
  keine Garantie, dass jedes beliebige Geheimnisformat erkannt wird.
- Live-Auth-Vorprüfung nach Konfigurationsänderung: Google aktiv, öffentlicher
  E-Mail-/anonymer Provider aus, drei getrennte QA-Sitzungen mit höchstens
  900 Sekunden Laufzeit; sämtliche QA-Konten anschließend gelöscht.
- Produktions-Zugriffstests: **62 Prüfungen bestanden**, drei getrennte Konten
  (Besitzer/Mitbearbeiter/Außenstehender) plus anonymer Zugriff. Sichere öffentliche
  und geheime Projektionen, Ablehnung privater Abfragen und unveränderlicher
  Spalten, keine Rollenübernahme durch Metadaten, Entzug der Mitgliedschaft,
  Edge-Token-/Origin-/Größen-/JSON-/SSRF-Eingaben. Drei gleichzeitige Schreibaufrufe
  bei Budgetstand 499 erlauben genau einen; drei Vorschau-Budgetaufrufe bei 39
  erlauben ebenfalls genau einen. Keine echten Shop-Aufrufe in diesen Angriffstests.
- Live-Metadatenkontrolle: **12 Rollen-/Tabellenkombinationen** ohne
  `TRUNCATE`-/`TRIGGER`-/`REFERENCES`-Rechte, alle sechs Anwendungstabellen mit RLS;
  **12 Funktions-/Rollenkombinationen** entsprechen der vorgesehenen Freigabe.
  Kein unsicherer Definer-Suchpfad. Browser-Rollen dürfen in `public`, `auth` und
  `extensions` keine eigenen Objekte anlegen. Keine verbleibenden Security-QA-Konten.
- Legitimierter Import in der veröffentlichten mobilen App: Apple-Produkttitel,
  Bild und 35-Euro-SKU-Preis importiert, gespeichert und nach Reload erhalten;
  manuelle Preisänderung bleibt geschützt, ausdrückliche Preisübernahme und
  Preisansicht über Leselink funktionieren, Axe-Zugänglichkeitsprüfung bestanden.
  Fivi lieferte am Prüfzeitpunkt HTTP 429, deshalb keine Wiederholung dieses Abrufs.
- Mobile Live-Einladungsprüfung vollständig bestanden: Einladungslink erstellen,
  minimale Gastvorschau, kontrollierter PKCE-Rückweg mit SHA-256-Verifierprüfung,
  ausdrücklicher Beitritt, Hinzufügen/Bearbeiten/Erfüllen/Löschen, Synchronisation
  zum Besitzer, sichtbare bestätigte Mitglieds-E-Mail, Einladungswiderruf,
  Mitgliederentzug, gesperrter Wiederbeitritt und Verlassen ohne Datenlöschung.
  Für die simulierte OAuth-Rückgabe ist im betreffenden Testkontext der Service
  Worker blockiert, damit Playwrights Netzwerk-Mock greift; Besitzer-/Gastkontext
  und der separate Preis-/Offline-Test verwenden den regulären PWA-Ablauf.
  Sämtliche QA-Konten einschließlich zugehöriger Daten wurden bereinigt.
- Manueller Gerätetest: **installierte iPhone-App bestanden**, vom Nutzer nach
  Ab-/Anmeldung mit Google und vollständigem Schließen/Öffnen bestätigt.
- Bereitstellung des Sicherheitscodes: GitHub-Pages-Workflow **42615733260**
  erfolgreich; Live-HTML enthält die CSP und das veröffentlichte Bundle verwendet
  PKCE sowie die neue öffentliche RPC. Auch der abschließende Workflow
  **42617108382** für den protokollierten Stand ist erfolgreich.
  Datenbankmigrationen 003 und 004 sowie
  die abgesicherte Edge Function sind angewendet. Deklarierte Auth-Einstellungen
  ohne Abweichung; Google aktiv, E-Mail/anonym aus. Datenbank-TLS verbindlich aktiv.

## Verbleibende Grenzen und Betrieb

1. **GitHub Pages und gemeinsame Origin:** Eigene HTTP-Sicherheitsheader lassen
   sich dort nicht regulär pro App konfigurieren. `frame-ancestors` wirkt nicht
   aus einem CSP-Meta-Element; der JavaScript-Frame-Schutz ist nur eine zusätzliche
   Schutzschicht. Für verbindliches `frame-ancestors`/weitere Header wäre Hosting
   mit konfigurierbaren Headern nötig. Andere Seiten unter
   `pdohmen91.github.io` teilen die Origin und damit grundsätzlich Speicher und
   Sicherheitskontext. Dort nur vertrauenswürdige Projekte veröffentlichen.
2. **Browser-Sitzungen:** Supabase speichert persistente Sitzungen im
   Origin-Speicher. Eine erfolgreiche Skriptausführung auf dieser Origin oder
   ein kompromittiertes Gerät kann sie auslesen. CSP, Escaping und getrennte
   Backend-Rechte reduzieren das Risiko; eine Garantie entsteht daraus nicht.
   Bereits ausgestellte JWTs können nach Logout bis zu ihrem Ablauf gültig
   bleiben. Die 15-Minuten-Frist gilt für neu ausgestellte Tokens; ältere können
   anfangs noch ihre bisherige Restlaufzeit haben.
3. **SSRF-Restgrenze:** DNS-Prüfung und tatsächlicher TLS-Abruf sind getrennt;
   IP-Pinning auf die zuvor geprüfte Adresse ist nicht implementiert. Exakte
   Betreiber-Hostliste, erneute Prüfung jedes Redirects und TLS-Prüfung begrenzen
   das Risiko. Unbekannte oder nutzerkontrollierte Domains nicht pauschal
   freischalten; für eine Öffnung wären zusätzliche Netzwerkmaßnahmen nötig.
4. **Produktbilder und Links:** Drittanbieter sehen beim Abruf von Bildern die
   IP-Adresse des Betrachters; `no-referrer` verhindert die Übermittlung der
   Listenadresse. Schutz fremder Bildserver vor privaten DNS-Zielen kann der
   Server beim späteren Browserabruf nicht vollständig erzwingen. Klickbare
   Produktlinks sind keine Vertrauensgarantie für den Zielshop.
5. **Freigaben:** Links sind übertragbare Berechtigungen. Keine personengebundene
   Freigabe, kein Widerruf bereits gelesener/kopierter Inhalte. Mitbearbeiter
   haben absichtlich weitreichende Änderungs-/Löschrechte an Wünschen.
6. **Öffentliche Anmeldung / kostenlose Ressourcen:** Google-Anmeldung ist für
   neue Konten offen. Kontolimits verhindern keine verteilten Angriffe mit vielen
   Konten oder hohe anonyme Leseaufrufzahlen. Keine unabhängige Last-/DDoS-Prüfung
   durchgeführt. Bei Missbrauch Einladungs-/Zulassungssystem oder zusätzliche
   Limits prüfen. Alte tägliche Budgetzeilen werden beim Löschen eines Kontos
   entfernt; regelmäßige Bereinigung sehr alter Zeilen ist noch nicht automatisiert.
7. **Betrieb:** MFA für Betreiberkonten bei GitHub, Google und Supabase,
   Zugangs-/Recovery-Sicherung und regelmäßige Backup-/Wiederherstellungstests
   bleiben Betreiberaufgaben. Sie wurden nicht durch Anmeldung in fremde
   Sicherheitsbereiche geprüft oder verändert. Der akzeptierte Supabase-Free-
   Pausenmechanismus bleibt bestehen. Ein unabhängiges externes Review wäre für
   eine breite öffentliche Vermarktung sinnvoll. Die CI meldet ältere
   Action-Major-Versionen, deren Ausführung GitHub bereits auf Node 24 erzwingt;
   Dependabot-Update-PRs vor Übernahme prüfen. Die SHA-Bindung betrifft direkte
   Workflow-Verweise; eingebettete Actions bleiben Teil der GitHub-Lieferkette.
8. **Gerätetest bestanden:** Der Nutzer hat nach Veröffentlichung der
   Sicherheitsversion direkt über das installierte iPhone-App-Symbol abgemeldet,
   mit Google erneut angemeldet und das vollständige Schließen/Öffnen geprüft.
   Rückkehr zu den Listen und gespeicherte Sitzung wurden am 9. November 2026
   bestätigt. Bei späteren Änderungen an OAuth diesen Gerätetest wiederholen;
   keinen unsicheren Token-Fallback für getrennte Speicherkontexte einführen.

## Primärquellen

- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
  – insbesondere die Ausnahme für `TRUNCATE`.
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
  und [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
  – Definer-Funktionen und explizite Berechtigungen.
- [Supabase: SSL Enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)
  – verschlüsselte direkte Datenbankverbindungen und Neustart bei Umstellung.
- [Supabase: PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
  – lokaler Verifier und Code-Austausch.
- [MDN: CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) und
  [frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
  – Möglichkeiten und Grenzen von Meta-CSP.
- [GitHub: Secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use)
  – unveränderliche Action-Referenzen und minimale Workflow-Rechte.
- [OWASP: SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
  – Host-Freigaben und DNS-/Redirect-Grenzen.

## Ergänzung 09.11.2026: persönliche gemerkte Listen

Neue Merker sind private Verweise, keine Freigabe- oder Mitgliedschaftsrechte. Tabelle ohne Client-Rechte und drei eng begrenzte authentifizierte RPCs mit Identitätsprüfung, leerem Suchpfad und explizitem Kontofilter. Neue private Metadaten werden nach Freigabe-Widerruf nicht über Merker ausgegeben. Merken ist ausschließlich mit Anmeldung möglich. Die frühere lokale Gast-Speicherung ist entfernt; alte Gast-Merker werden ohne Auslesen oder Hochladen gelöscht. Details und Prüfungen: [SAVED-LISTS.md](SAVED-LISTS.md).

## Ergänzung 09.11.2026: eigene Listen nur mit Anmeldung

Der normale App-Einstieg bietet keinen anonymen Demo-Modus und keine lokale Ersatzspeicherung mehr an. Fehlende Backend-Konfiguration öffnet keine Testdaten. Alte Demo-Listen werden weder gelesen noch hochgeladen. Schreibdialoge erfordern Bearbeitungsrechte; ein Sitzungsverlust schließt offene Formulare. Private Methoden der Datenquelle prüfen Benutzer und Konfiguration vor Netzwerkzugriff. Die serverseitigen Rollenrechte verweigern anonymen Nutzern das Anlegen von Listen und Wünschen weiterhin.

Die lokale Datenquelle bleibt ausschließlich für den ausdrücklich konfigurierten Entwicklungsserver der Browser-Suite verfügbar. Der Produktionsbuild ignoriert deren Freigabe-Flag. Die PWA-Suite prüft das mit gesetztem Test-Flag, vorhandenen alten Demo-Daten und einem Demo-URL-Versuch. Chrome und iPhone-WebKit prüfen den Gast-Einstieg, angemeldetes Erstellen und erneutes Öffnen sowie Sitzungsverlust bei geöffnetem Formular.
