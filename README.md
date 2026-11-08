# Wunschnagel

**Deine Wünsche. Festgehalten.**

Eine installierbare Wunschlisten-Web-App für Freunde und Familie. React und TypeScript im Frontend, Supabase für Anmeldung, Daten und Shop-Vorschauen. Die Web-App kann später mit Capacitor in Android- und iOS-Projekte übernommen werden.

## Was bereits funktioniert

- Mehrere Wunschlisten pro Person, jeweils mit Name, Beschreibung und Symbol.
- Sichtbarkeit **Nur für mich**, **Mit Link** oder **Öffentlich**.
- Wünsche mit Shop-Link, Titel, Notizen, optionalem Preis und Vorschaubild.
- Listen und Wünsche erstellen, bearbeiten und löschen; Wünsche als erfüllt markieren.
- Suche, Filter für offene und erfüllte Wünsche sowie Sortierung nach Preis, Name und Datum.
- Gut lesbare Texte, große Bedienflächen, mobile Listenauswahl und vollständig aufklappbare Hinweise.
- Ansicht geteilter Listen ohne Anmeldung und ohne Bearbeitungsrechte.
- Geheimen Link kopieren, über das System teilen und widerrufen/erneuern.
- Google-Anmeldung nach Einrichtung des Providers.
- Automatisches Laden von Titel und Bild nach dem Einfügen eines Shop-Links, mit manueller Nachbearbeitung und Schutz eigener Eingaben. Lokal übernimmt der Entwicklungsserver den Abruf; online die Supabase Edge Function.
- PWA-Manifest, App-Symbole, Startbildschirm-Installation und gecachte App-Oberfläche.
- GitHub-Pages-Workflow, SQL-Migration und Tests für die Zugriffsregeln.

**Ohne Konfiguration läuft die App als lokale Demo.** Sie speichert Beispieldaten und Änderungen ausschließlich im Browser. Diese Daten werden nicht zu Supabase übertragen. Geräteübergreifendes Teilen und Anmeldung sind erst mit dem eingerichteten Backend nutzbar. Bei `npm run dev` funktionieren automatische Shop-Titel und Bilder auch ohne Supabase über einen lokalen Endpunkt. Ein unkonfigurierter statischer Produktionsbuild hat diesen lokalen Endpunkt nicht; dort wird für Shop-Vorschauen weiterhin Supabase benötigt. Die Beispielbilder sind mitgelieferte Illustrationen, keine automatisch abgerufenen Shopbilder. Lokale Demodaten können durch das Löschen der Website-Daten im Browser entfernt werden.

## Lokal starten

Voraussetzung: Node.js ab 22.18 und npm.

```sh
npm ci
npm run dev
```

Öffne die im Terminal angezeigte Adresse, normalerweise `http://127.0.0.1:5173/`. Für die Demo ist kein Account erforderlich.

Beim Hinzufügen eines Wunsches genügt das Einfügen eines Shop-Links. Nach 600 ms ohne weitere Linkänderung werden Titel und Bild angefragt. Du kannst während des Abrufs andere Felder bearbeiten oder abbrechen. Selbst eingegebene Titel und Bildadressen werden nicht überschrieben; eine verspätete Antwort für einen vorherigen Link wird verworfen. „Vorschau aus dem Shop laden“ bleibt als manuelle Wiederholung verfügbar.

Auch lokal gelten die unterstützten Shop-Hosts sowie HTTPS-, DNS-, Zeit-, Größen- und Weiterleitungsgrenzen aus dem Abschnitt Shop-Vorschauen. Das Tagesbudget pro Nutzer wird im Online-Betrieb von Supabase geprüft. Zusätzliche vertrauenswürdige Hosts können für die Entwicklung über `PREVIEW_ALLOWED_HOSTS=shop.de,www.shop.de` in `.env` ergänzt werden. Der lokale Endpunkt `/__api/link-preview` akzeptiert nur Anfragen aus derselben lokalen App und wird nicht in den GitHub-Pages-Build eingebaut.


```sh
npm test
npm run build
npm run preview
```

`npm test` führt unter anderem die echte SQL-Migration in PostgreSQL/WASM aus und prüft Zugriffsrechte für Besitzer, andere Nutzer und Gäste. Das ersetzt keinen Live-Test mit deinem Supabase-Projekt.

Für die Browserprüfungen brauchst du installiertes Google Chrome und die passende WebKit-Testengine:

```sh
npx playwright install webkit
npm run test:browser
```

Die Browser-Tests laufen in Desktop-Profilen sowie mit einem Pixel-7-Profil in Chrome und einem iPhone-13-Profil in WebKit. Die [mobile Prüfung](docs/MOBILE-REVIEW.md) dokumentiert Touchbedienung, untere Aktionen, Querformat und nachgestellte Bildschirmtastaturen. Sie prüfen auch Kartenbewegungen, schnelle Filterwechsel, unterbrochene Übergänge, Fokusrückgabe und die Einstellung für reduzierte Bewegung. Leere und gefüllte Listen werden bis 2560 Pixel Breite geprüft; einzelne Aktionen müssen unverdeckt erreichbar sein. Ein zusätzlicher Test prüft den Produktionsbuild unter einem GitHub-Pages-Unterpfad einschließlich Offline-Neustart nach der ersten Installation. Das ersetzt keinen Test auf echten iOS-/Android-Geräten oder mit einem konkreten Safari-Build. Zur bewussten Prüfung einer noch unkonfigurierten App darf hierfür keine echte `.env` gesetzt sein. Die Testserver verwenden die Ports 4181 und 4182.

Die zusätzlichen Bedienungsprüfungen untersuchen Kontrast, ausreichend große Schaltflächen, Tastaturnavigation, Fokus nach dem Schließen eines Dialogs, lange Hinweise und Bildschirmbreiten ab 320 Pixel. Befunde und Änderungen sind im [Bericht zur Gestaltung und Bedienung](docs/UX-REVIEW.md) dokumentiert. Die [Design-Recherche und Funktionsbewertung](docs/DESIGN-RESEARCH.md) enthält aktuelle Quellen und priorisiert die nächsten Funktionen.

## Betrieb ohne laufende Gebühren

Vorgeschlagen ist **GitHub Pages + Supabase Free**, jeweils mit der kostenlosen Anbieteradresse. Du brauchst keine eigene Domain und keinen eigenen Server.

| Teil | Kostenloser Weg | Grenze oder Voraussetzung |
| --- | --- | --- |
| Quellcode und Web-Oberfläche | Öffentliches GitHub-Repository + GitHub Pages | GitHub Free unterstützt Pages aus öffentlichen Repositories. |
| Anmeldung und gemeinsame Daten | Supabase Free | Aktuell 500 MB Datenbank, 50.000 aktive Nutzer pro Monat und begrenztes Transfer-/Funktionskontingent. |
| Shop-Vorschauen | Supabase Edge Function | Zählt ins kostenlose Funktionskontingent; zusätzlich begrenzt auf 40 Vorschauen pro Nutzer und Tag. |
| Handy-Installation | PWA über HTTPS | Browser-Menü statt App Store. Gemeinsame Daten benötigen Internet. |
| Anbieteradresse | `github.io` und `supabase.co` | Eine eigene gekaufte Domain ist optional. |

Stand der Anbieterbedingungen: 7. November 2026. **Kostenlos gilt innerhalb der jeweiligen Free-Tarife und Limits; es ist keine unbegrenzte oder dauerhafte Preisgarantie.** Bleibe ausdrücklich im Free-Tarif und aktiviere keine kostenpflichtigen Zusatzdienste. Supabase kann Free-Projekte bei geringer Aktivität über sieben Tage pausieren. Dann musst du sie im Dashboard wieder starten; die App ist in der Zwischenzeit nicht online nutzbar. Für eine selten genutzte Geburtstags-/Weihnachtsliste ist das relevant.

Quellen: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Supabase-Preise und Kontingente](https://supabase.com/pricing), [Pausieren von Free-Projekten](https://supabase.com/docs/guides/platform/free-project-pausing).

Alternative bei störenden Pausen: Cloudflare Workers Free + D1. Das wäre ein anderes Backend mit eigener Authentifizierungsintegration; diese Variante ist hier nicht implementiert. Auch dort gelten [Workers-Limits](https://developers.cloudflare.com/workers/platform/pricing/) und [D1-Limits](https://developers.cloudflare.com/d1/platform/pricing/).

## Supabase einrichten

Das Projekt [wunschnagel](https://supabase.com/dashboard/project/gjlvrtzsrecgmqdghhgj) ist angelegt. Migration, Zugriffsregeln, Site-URL, Rückleitungen, Google-Anbieter und die Edge Function `link-preview` sind eingerichtet. Die Datenzugriffe und Shop-Vorschau wurden live geprüft. Am 8. November 2026 hat der Betreiber die vollständige Google-Anmeldung und das Erstellen einer Wunschliste auf der veröffentlichten App mit seinem eigenen Konto bestätigt.

1. Erstelle ein Supabase-Projekt im **Free-Tarif**, möglichst in einer passenden EU-Region. Die Supabase-Organisation braucht kein kostenpflichtiges Upgrade für diese App.
2. Führe den Inhalt von `supabase/migrations/202611070001_initial.sql` einmal im Supabase SQL Editor aus. Mit Supabase CLI 3 kannst du nach `supabase login` auch `supabase db push --remote=gjlvrtzsrecgmqdghhgj --skip-vault` verwenden. Die bereits angewendete Migration wird dabei nicht erneut ausgeführt.
3. Kopiere `.env.example` nach `.env`. Trage Projekt-URL und **Publishable Key** (alternativ den bisherigen `anon`-Key) ein. Einen `service_role`- oder Secret-Key niemals ins Frontend oder GitHub-Repository schreiben.
4. Starte `npm run dev` neu. Mit Backend-Konfiguration erscheint die Anmeldung; über „Erst einmal ausprobieren“ bleibt die unabhängige lokale Demo erreichbar.
5. Richte Google als Supabase-Anmeldeprovider ein, wie unten beschrieben.
6. Stelle die Edge Function bereit, wie im nächsten Abschnitt beschrieben.

### Google-Anmeldung

Auf dem iPhone speichern Safari und die installierte Web-App ihre Anmeldung getrennt. Nach der Installation einmal über das App-Symbol anmelden; mit demselben Google-Konto sind dieselben Listen erreichbar. Die Sitzung bleibt über das Schließen und erneute Öffnen erhalten, vom Betreiber am 8. November 2026 bestätigt. Die Installationshilfe und die Anmeldeseite der installierten iOS-App erklären diesen Schritt. Siehe [WebKit: Login cookies und getrennter Web-App-Speicher](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#login-cookies).

Im [Supabase-Leitfaden für Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) sind die aktuellen Einrichtungsschritte beschrieben. Du legst dafür einen OAuth-Web-Client in einem Google-Cloud-Projekt an und trägst dessen Client-ID und Client-Secret **nur beim Google-Provider im Supabase-Dashboard** ein. Für diesen OAuth-Client braucht die App keine kostenpflichtige Google-API.

- Die autorisierte Redirect-Adresse bei Google ist die Supabase-Callback-Adresse aus dem Provider-Dashboard, `https://gjlvrtzsrecgmqdghhgj.supabase.co/auth/v1/callback`.
- Als **Authorized JavaScript origin** bei Google verwendest du `https://pdohmen91.github.io`, ohne den Repository-Pfad.
- Die Supabase **Site URL** ist `https://pdohmen91.github.io/Wunschnagel/`.
- Unter Supabase **Redirect URLs** erlaubst du genau diese Veröffentlichungsadresse sowie zur Entwicklung `http://127.0.0.1:5173/`.
- Die Anmeldung fragt ausschließlich die Basisdaten `email` und `profile` ab. Google nimmt reine Basis-Identitätsdaten von der üblichen Testnutzer-Beschränkung im Testmodus aus. Für zusätzliche Berechtigungen gelten andere Vorgaben. Siehe [Google: App-Zielgruppe und Testmodus](https://support.google.com/cloud/answer/15549945?hl=en). Eine eigene Datenschutzerklärung für die tatsächlich eingesetzten Dienste sollte vor einer breiteren Veröffentlichung ergänzt werden.

E-Mail-Login ist bewusst nicht enthalten: Supabases eingebauter Mailversand ist für Tests eingeschränkt und verschickt ohne eigenes SMTP nicht allgemein an Familie und Freunde. Google-Anmeldung vermeidet hier einen zusätzlichen Mailanbieter. Siehe [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Shop-Vorschauen bereitstellen

Mit installierter [Supabase CLI 3](https://supabase.com/docs/guides/local-development/cli/getting-started):

```sh
supabase login
supabase functions deploy link-preview --remote=gjlvrtzsrecgmqdghhgj --use-api
```

Die Funktion prüft die Supabase-Sitzung selbst mit `auth.getUser()`. Deshalb ist die Gateway-Prüfung in `supabase/config.toml` deaktiviert. **Die Funktion ist trotzdem nur mit gültiger Nutzeranmeldung nutzbar.** Sie verwendet den öffentlichen Anon-Key und die Nutzersitzung; ein Service-Role-Key ist nicht nötig.

Unterstützt sind zunächst die in `supabase/functions/link-preview/helpers.ts` aufgeführten Shop-Hosts, unter anderem Amazon.de, Otto, Zalando, IKEA, Thalia, Etsy, MediaMarkt, Saturn, dm, Rossmann, Decathlon, Apple, Bialetti und Marshall. Exakte Hostnamen werden auch bei Weiterleitungen geprüft. Weitere vertrauenswürdige Shops kannst du im Dashboard unter **Edge Functions → Secrets** als `PREVIEW_ALLOWED_HOSTS` ergänzen, beispielsweise `shop.de,www.shop.de`. Keine Platzhalter oder beliebigen Nutzer-Domains freigeben.

Die Funktion liest `og:title`, `og:image` und vergleichbare Metadaten. Sie führt kein Shop-JavaScript aus, verwendet keine Cookies und umgeht keinen Bot-Schutz. Nicht jeder Shop stellt lesbare Daten bereit; dann bleiben Titel und Bild-Link manuell eintragbar. Bilddateien werden nicht kopiert, sondern von der hinterlegten Bildadresse geladen. Shopbilder können deshalb später nicht mehr erreichbar sein; die App zeigt dann einen Platzhalter. Vorschauen erfordern öffentliche HTTPS-Adressen.

Ausgehende Anfragen sind auf HTTPS, bekannte Hosts, öffentliche DNS-Adressen, drei Weiterleitungen, acht Sekunden und maximal 1 MB HTML begrenzt. Das Nutzerbudget wird atomar in der Datenbank gezählt. Die kleine Budgettabelle wächst mit aktiven Nutzertagen und kann bei Bedarf um alte Datensätze bereinigt werden.

## Über GitHub veröffentlichen

1. Der Code liegt im öffentlichen Repository [pdohmen91/Wunschnagel](https://github.com/pdohmen91/Wunschnagel) auf dem Branch `main`. `.env`, persönliche Daten und Backend-Secrets gehören nicht ins Repository. Die gemeinsam nutzbaren Wunschlisten liegen nach Einrichtung ausschließlich in Supabase.
2. Unter **Settings → Pages → Build and deployment** ist **GitHub Actions** als Veröffentlichungsquelle eingerichtet.
3. Unter **Settings → Secrets and variables → Actions → Variables** legst du diese beiden Repository-Variablen an:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Starte den Workflow **Build and deploy GitHub Pages** über den Actions-Tab oder pushe auf `main`.
5. Ergänze die veröffentlichte Adresse in den Supabase-Auth-Einstellungen wie oben beschrieben.
6. Prüfe mit zwei unterschiedlichen Google-Konten und einem privaten Browserfenster: privates Lesen verweigert, geheimer Link lesbar, öffentlich lesbar, Bearbeiten nur durch Besitzer, alter Link nach Erneuern gesperrt.

Der Workflow setzt den Unterpfad automatisch auf den Repository-Namen. Für ein User-Repository namens `DEIN_NAME.github.io` oder eine eigene Domain ändere `VITE_BASE_PATH` im Workflow auf `/`. Lokal steht der Wert in `.env`. Die Linkrouten verwenden den URL-Hash und brauchen deshalb keine Server-Umschreibregeln oder `404.html`-Tricks auf GitHub Pages.

**Veröffentlichungsadresse:** [pdohmen91.github.io/Wunschnagel](https://pdohmen91.github.io/Wunschnagel/). Der Pages-Workflow veröffentlicht Änderungen an `main` automatisch. Der Produktionsbuild verwendet die öffentlichen Supabase-Verbindungswerte aus den GitHub-Variablen und bietet Google-Anmeldung sowie gemeinsame Listen an. Über „Ohne Anmeldung ausprobieren“ bleibt die lokale Vorschau pro Browser erreichbar. Datenbank, Google-Anbieter und Online-Shop-Vorschau sind im Supabase-Projekt eingerichtet. Vorhandene lokale Demo-Listen werden beim Anmelden nicht automatisch in das Konto übernommen.

## Was „privat“ und „geteilt“ bedeuten

- **Nur für mich:** Nur das angemeldete Besitzerkonto kann Liste und Wünsche lesen und bearbeiten. Gäste und andere Nutzer sehen auch bei Kenntnis der Listen-ID nichts.
- **Mit Link:** Besitzer dürfen bearbeiten. Alle mit dem zufälligen geheimen Link dürfen über einen eingeschränkten Datenbankaufruf lesen, ohne Anmeldung. Das ist keine Einladung an einzelne Konten: Weitergegebene Links funktionieren ebenfalls.
- **Öffentlich:** Alle dürfen lesen, auch über die öffentliche Daten-API. Die Liste kann von Dritten weiterverbreitet werden. Nur der Besitzer darf schreiben. Es gibt noch kein öffentliches Listenverzeichnis in der Oberfläche.

Der Zugriff wird mit PostgreSQL Row Level Security durchgesetzt. Unveröffentlichte Listen sind nicht durch normale Gäste-Abfragen auflistbar. Ein Wechsel der Sichtbarkeit und das Erneuern eines geheimen Links ändern dessen Token. Beim privaten Schalten ist ein alter Link sofort ungültig und wird auch beim späteren Freigeben nicht wieder gültig. Bereits angesehene oder von Empfängern kopierte Inhalte lassen sich dadurch nicht zurückholen.

Der Service Worker speichert nur die App-Oberfläche. Supabase-Antworten und externe Shopbilder werden nicht offline gecacht. Nach einem vollständigen ersten Online-Aufruf lässt sich die Oberfläche offline öffnen; gemeinsame Listen lassen sich dann weder neu laden noch ändern. Die Auth-Sitzung wird vom Supabase-Client im Browser verwaltet.

Ein zusätzlicher [Safari-Test mit iOS-Softwaretastatur](tests/safari-ios/README.md) kann unter macOS mit Xcode ausgeführt werden. Er benötigt kein natives App-Projekt.

## Später Android und iOS

Die Datenmodelle und der Datenzugriff liegen unabhängig von der Oberfläche in `src/domain.ts` und `src/lib/repository.ts`. Das Backend kann auch von einer späteren nativen App verwendet werden.

Für eine Verpackung der bestehenden React-Oberfläche mit Capacitor ist `capacitor.config.json` vorbereitet. Die nativen Pakete und Plattformprojekte sind noch nicht installiert oder erstellt:

```sh
npm install @capacitor/core @capacitor/android @capacitor/ios
npm install -D @capacitor/cli
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

Für native Builds `VITE_BASE_PATH=/` setzen. Vor dem nativen Einsatz müssen insbesondere Google-Anmeldung im Systembrowser, sichere Sitzungsablage, Rückleitung über Deep Links, Teilen und Plattformtests ergänzt werden. Für iOS-Builds brauchst du macOS und Xcode; für Android Android Studio und das SDK. Ein WebView-Paket allein ist noch keine veröffentlichungsfertige native App.

Die Web-App und ihre PWA-Installation brauchen keine Store-Mitgliedschaft. Eine spätere reguläre Store-Veröffentlichung kostet normalerweise **99 US-Dollar pro Jahr bei Apple** und **einmalig 25 US-Dollar bei Google Play**, gegebenenfalls in lokaler Währung. Quellen: [Apple Developer Program](https://developer.apple.com/programs/), [Google Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=de).

## Aufbau

Die verbindlichen Regeln für Farben, Typografie, Karten und Dialoge stehen im [Designsystem](docs/DESIGN-SYSTEM.md). Die Gestaltung orientiert sich an einer persönlichen Wunschkartei mit Papierflächen, Pflaumentinte und orangefarbenen Akzenten.

```text
src/App.tsx                         Oberfläche und Dialoge
src/domain.ts                      Typen, Validierung, Linkrouten
src/lib/repository.ts              Supabase- und lokale Demo-Datenquelle
public/                            PWA, Icons, Demo-Illustrationen
supabase/migrations/               Tabellen, Zugriffsregeln und RPCs
supabase/functions/link-preview/    Shop-Vorschau mit Nutzerprüfung
tests/                             Domänen-, Vorschau- und PostgreSQL-Tests
tests/browser/                     Echte Browserabläufe auf zwei Bildschirmgrößen
.github/workflows/pages.yml        Build und Veröffentlichung
```

Die echte Datenbank wurde mit zwei isolierten Testkonten auf private/öffentliche Zugriffe, Lesen über geheime Links, Schreibschutz und Link-Widerruf geprüft. Ein zusätzlicher Browserlauf auf der veröffentlichten App prüfte die mobile Anmeldeseite, die Weiterleitung zu Google, Sitzungsübernahme, das Erstellen von Listen und Wünschen, automatische Shop-Titel und Bilder sowie geteilte Listen und den Widerruf des Zugriffs in einem zweiten Browser ohne Gastkonto. Die Edge Function verlangt eine Anmeldung. Die kurzlebigen Testkonten und Testdaten wurden anschließend entfernt. Der Betreiber hat die vollständige Google-Anmeldung und das Erstellen einer Liste mit seinem eigenen Konto am 8. November 2026 bestätigt. Reservierungen durch Schenkende, Einladungen für bestimmte Konten, Push-Mitteilungen, Bild-Uploads und gemeinsame Bearbeitung sind nicht Teil dieser ersten Version.
