# Shop-Importprüfung

Stand: 9. November 2026. Je ein öffentlich recherchiertes Produkt pro bereits freigegebenem Shop, direkt über die **produktive Supabase Edge Function** mit einem isolierten Testkonto. Vorhandene Konten, Listen und Wünsche wurden nicht gelesen oder geändert. Testkonten und ihre Vorschau-Budgets wurden anschließend gelöscht.

Erster Durchlauf: 20 Shops, sechs vollständige Vorschauen. Nach den gezielten Korrekturen: **zwölf vollständige Vorschauen mit Euro-Preis und im Browser erfolgreich geladenem Bild**, eine Vorschau ohne Preis sowie sieben fehlgeschlagene oder nicht automatisch lesbare Abrufe. Bereits gesperrte Shops wurden nicht erneut angefragt. Die korrigierten Fälle und die zuvor vollständigen Vorschauen wurden gezielt nachgeprüft.

Die Tabelle beschreibt konkrete Stichproben, keine Garantie für jede Produktseite eines Shops. Preise sind Momentaufnahmen des Imports; Versand, spätere Änderungen und die Wahl anderer Varianten können abweichen. „Bild geladen“ bedeutet: Das externe Bild wurde in WebKit ohne Referrer geladen und hatte eine natürliche Bildbreite größer null. Für Avocadostore wurde nur die gelieferte Bildadresse geprüft.

| Shop / Testprodukt | Titel | Bild | Euro-Preis | Ergebnis / Grenze |
|---|---|---|---|---|
| [Amazon](https://www.amazon.de/kindle-paperwhite-2024/dp/B0CFPXBJ9Y) | Ja | Geladen | 209,99 € | Vollständig |
| [OTTO](https://www.otto.de/p/bialetti-teebereiter-moka-exclusive-6tz-induction-grey-CS0FJ50N2/) | – | – | – | Abruf fehlgeschlagen (unavailable); vom produktiven Abruf nicht erreichbar. |
| [Zalando](https://www.zalando.de/adidas-originals-samba-og-sneaker-low-cloud-whitecore-black-ad111a37w-a11.html) | Ja | Geladen | 116,95 € | Vollständig |
| [IKEA](https://www.ikea.com/de/de/p/billy-buecherregal-weiss-00263850/) | Ja | Geladen | 49,99 € | Vollständig |
| [Thalia](https://www.thalia.de/shop/home/artikeldetails/A1009753594) | – | – | – | Automatischer Abruf wird blockiert. |
| [Etsy](https://www.etsy.com/listing/1095025986/) | – | – | – | Automatischer Abruf wird blockiert. |
| [Hugendubel](https://www.hugendubel.de/de/buch_gebunden/j_r_r_tolkien_john_r_r_tolkien-der_hobbit-9651479-produkt-details.html) | Ja | Geladen | 22,00 € | Vollständig |
| [MediaMarkt](https://www.mediamarkt.de/de/product/_sony-wh-1000xm5-over-ear-kopfhorer-bluetooth-black-2801006.html) | Ja | Geladen | 259,00 € | Vollständig |
| [Saturn](https://www.saturn.de/de/product/_sony-wh-1000xm5-sa-noise-cancelling-over-ear-kopfhorer-bluetooth-black-3008058.html) | Ja | Geladen | 380,00 € | Vollständig |
| [dm](https://www.dm.de/p/d/1639872/balea-med-duschgel-ultra-sensitive) | – | – | – | Nur App-Hülle: Produktdaten werden erst im Browser geladen. Wird jetzt als no_metadata gemeldet. |
| [ROSSMANN](https://www.rossmann.de/de/pflege-und-duft-isana-med-duschgel-ultra-sensitiv/p/4305615629186) | – | – | – | Client Challenge trotz HTTP 200. Wird jetzt als shop_blocked gemeldet. |
| [Decathlon](https://www.decathlon.de/p/wanderrucksack-20-l-arpenaz-nh100-schwarz/_/R-p-301674) | – | – | – | Automatischer Abruf wird blockiert. |
| [Apple](https://www.apple.com/de/shop/buy-airtag/airtag?product=MFE94ZM%2FA) | Ja | Geladen | 35,00 € | Vollständig |
| [Bialetti](https://www.bialetti.com/it_it/moka-express.html) | Ja | Geladen | 31,92 € | Vom Shop deklarierter EUR-Angebotspreis; Tassengröße weiterhin im Wunsch angeben. |
| [Marshall](https://www.marshall.com/de/de/product/major-v?pid=1006832) | Ja | Geladen | 149,00 € | Vollständig |
| [Avocadostore](https://www.avocadostore.de/products/154254-edelstahl-trinkflasche-05-oder-1-liter-samebutgreen?variant_id=1558044) | Ja | Adresse erkannt | – | Titel/Bildadresse erkannt, kein eindeutiger Preis. Zusätzlich angefragtes öffentliches HTML wurde blockiert; keine weiteren Abrufe. |
| [eBay](https://www.ebay.de/itm/194506782421) | – | – | – | Automatischer Abruf wird blockiert. |
| [Bambu Lab](https://eu.store.bambulab.com/de/products/a1-mini?id=599117891173982224) | Ja | Geladen | 179,00 € | Konkrete A1-mini-Variante über id ausgewählt; nicht der Combo-Preis. |
| [Fivi](https://fivi.gg/products/officemesser-luca-fivi) | Ja | Geladen | 25,00 € | Vollständig |
| [Dyson](https://www.dyson.de/staubsauger/kabellos/v8-cyclone/motorbar-schwarz) | Ja | Geladen | 249,00 € | Vollständig |

## Zusätzliche Prüfung: Tesla

Am 9. November 2026 wurde zusätzlich `shop.tesla.com` als exakter Shop-Host freigegeben. Geprüft wurde der öffentliche Link [Wall Connector](https://shop.tesla.com/de_de/product/wall-connector), den der Betreiber zum Test genannt hat. Sowohl der lokale Import als auch die produktive Edge Function erhielten HTTP 403. Die Online-Funktion meldet nach der Freigabe deshalb korrekt `shop_blocked` anstelle von `unsupported_shop`; Titel, Bild und Preis konnten nicht automatisch geladen werden. Es wurden weder Bot-Schutzmaßnahmen umgangen noch Nutzerkonten oder bestehende Wünsche geändert. Das isolierte Testkonto wurde gelöscht. Die Freigabe ist keine Zusage eines erfolgreichen Tesla-Imports.

## Korrigierte Ursachen

- **Amazon:** Primärer Kaufpreis aus eindeutig markierten Preisfeldern. Allgemeine a-price-Felder, Empfehlungen und Fremdwährungen werden nicht beliebig übernommen.
- **IKEA:** Aktueller barrierefrei beschrifteter Preis aus dem Haupt-Preismodul, getrennt von Alt- und Grundpreisen.
- **Zalando:** Datenfragmente derselben ausgewählten Produkt-SKU aus eingebettetem Hydration-JSON zusammengeführt. Aktionspreis wird gegenüber dem Originalpreis bevorzugt und mit dem aktuellen Betrag abgeglichen. Es wird kein Shop-JavaScript ausgeführt.
- **Marshall:** Exakte Produkt-ID und Produktpfad identifizieren den Preis auch bei einem internen Storefront-Host in den Schema-Daten. Dieser Host wird nicht als Netzwerkziel aufgerufen oder freigegeben.
- **Bambu Lab:** Sprachpfade und konkrete id-Auswahl mit der Produkt-SKU verknüpft. Der A1-mini-Preis wird vom Combo-Preis und durchgestrichenen Preisen getrennt. Ohne konkrete Auswahl bleibt ein mehrdeutiger Variantenpreis leer.
- **MediaMarkt/Saturn:** Bei einer eindeutigen Standard-Neuware werden separate Refurbished-Angebote nicht als konkurrierende Variantenpreise behandelt. Explizite Auswahlparameter bleiben konservativ.
- **ROSSMANN/dm:** Prüfseiten und eine leere Produkt-App-Hülle werden nicht mehr als vermeintlich erfolgreicher Produkttitel übernommen.

## Validierung und Wiederholung

72 automatisierte Tests einschließlich gezielter Regressionen für die hier gefundenen Preisformate und Fehlerseiten; TypeScript- und Produktionsbuild erfolgreich. Zusätzlich wurden die zwölf vollständigen Bildvorschauen visuell geprüft.

Die öffentlichen Produktlinks liegen in `tests/live/shop-samples.json`. `tests/live/shop-matrix.mjs` nutzt dieselben QA-Verbindungsvariablen wie die übrigen Online-Tests. Optional schränkt `WUNSCHNAGEL_QA_SHOPS` die Prüfung auf eine kommaseparierte Shop-Liste ein. `WUNSCHNAGEL_QA_CHECK_IMAGES=1` lädt die gefundenen Bilder einmal in WebKit und erzeugt `test-results/shop-images-audit.png`. Es gibt keine automatischen Wiederholungen gesperrter Abrufe und keine Umgehung des Vorschau-Budgets.
