type SymbolGroup = { id: string; name: string; symbols: readonly (readonly [string, string, string?])[] }

export const symbolGroups: readonly SymbolGroup[] = [
  { id: 'celebrations', name: 'Anlässe & Feiern', symbols: [
    ['🎁', 'Geschenk', 'Geburtstag Weihnachten present gift'], ['🎂', 'Geburtstagstorte', 'Kuchen birthday cake'],
    ['🎄', 'Weihnachtsbaum', 'Weihnachten Advent Tannenbaum christmas'], ['🎉', 'Konfetti', 'Party feiern'],
    ['🎈', 'Luftballon', 'Geburtstag Party'], ['🎊', 'Konfettiball', 'Feier Party'],
    ['🥳', 'Partygesicht', 'Feiern Geburtstag'], ['🎀', 'Schleife', 'Geschenk'],
    ['🕯️', 'Kerze', 'Advent Geburtstag'], ['💍', 'Ring', 'Hochzeit Verlobung'],
    ['🎓', 'Abschluss', 'Schule Studium Universität'], ['👶', 'Baby', 'Geburt Taufe'],
    ['🐣', 'Küken', 'Ostern Frühling'], ['🎃', 'Kürbis', 'Halloween Herbst'],
    ['🎆', 'Feuerwerk', 'Silvester Neujahr'], ['🥂', 'Anstoßen', 'Feiern Hochzeit'],
  ] },
  { id: 'hearts', name: 'Herzen & Sterne', symbols: [
    ['💛', 'Gelbes Herz', 'Liebe love'], ['❤️', 'Rotes Herz', 'Liebe love'], ['🧡', 'Oranges Herz', 'Liebe'],
    ['💚', 'Grünes Herz', 'Liebe'], ['💙', 'Blaues Herz', 'Liebe'], ['💜', 'Lila Herz', 'Liebe'],
    ['🩷', 'Rosa Herz', 'Liebe pink'], ['🤍', 'Weißes Herz', 'Liebe'], ['🖤', 'Schwarzes Herz', 'Liebe'],
    ['💕', 'Zwei Herzen', 'Liebe Freunde'], ['✨', 'Funkeln', 'Sterne Glitzer'], ['⭐', 'Stern', 'Star'],
    ['🌟', 'Leuchtender Stern', 'Glitzer'], ['🌈', 'Regenbogen', 'Farben'], ['☀️', 'Sonne', 'Sommer Wetter'],
    ['🌙', 'Mond', 'Nacht Schlafen'],
  ] },
  { id: 'nature', name: 'Natur & Tiere', symbols: [
    ['🌿', 'Blatt', 'Pflanze Natur Kräuter'], ['🌻', 'Sonnenblume', 'Blume Garten'], ['🌷', 'Tulpe', 'Blume Frühling'],
    ['🌹', 'Rose', 'Blume Liebe'], ['🌵', 'Kaktus', 'Pflanze'], ['🪴', 'Topfpflanze', 'Pflanze Garten'],
    ['🌳', 'Baum', 'Wald Garten'], ['🍀', 'Kleeblatt', 'Glück'], ['🍂', 'Herbstblätter', 'Blatt Herbst'],
    ['🦋', 'Schmetterling', 'Tier Insekt'], ['🐝', 'Biene', 'Tier Honig'], ['🐶', 'Hund', 'Tier dog'],
    ['🐱', 'Katze', 'Tier cat'], ['🦊', 'Fuchs', 'Tier'], ['🐼', 'Panda', 'Tier Bär'], ['🦄', 'Einhorn', 'Tier Fantasie'],
  ] },
  { id: 'home', name: 'Zuhause & Alltag', symbols: [
    ['🏡', 'Zuhause', 'Haus Wohnung Einzug'], ['🛋️', 'Sofa', 'Möbel Wohnen'], ['🛏️', 'Bett', 'Möbel Schlafen'],
    ['💡', 'Glühbirne', 'Licht Lampe Idee'], ['🧸', 'Teddybär', 'Kinder Spielzeug'], ['🛍️', 'Einkaufstaschen', 'Shopping'],
    ['👕', 'T-Shirt', 'Kleidung Mode'], ['👗', 'Kleid', 'Kleidung Mode'], ['👟', 'Schuh', 'Sneaker Kleidung'],
    ['🧣', 'Schal', 'Winter Kleidung'], ['👜', 'Handtasche', 'Tasche Mode'], ['🧴', 'Pflege', 'Kosmetik Beauty'],
    ['💄', 'Lippenstift', 'Kosmetik Beauty'], ['🛁', 'Badewanne', 'Wellness Bad'], ['🔨', 'Hammer', 'Werkzeug Heimwerken'],
    ['🧰', 'Werkzeugkasten', 'Werkzeug Heimwerken'],
  ] },
  { id: 'food', name: 'Essen & Trinken', symbols: [
    ['☕', 'Kaffee', 'Espresso Tasse coffee'], ['🫖', 'Teekanne', 'Tee tea'], ['🍵', 'Tee', 'Matcha Tasse'],
    ['🍷', 'Wein', 'Getränk'], ['🍺', 'Bier', 'Getränk'], ['🍹', 'Cocktail', 'Getränk Sommer'],
    ['🍕', 'Pizza', 'Essen Kochen'], ['🍝', 'Pasta', 'Nudeln Essen'], ['🍣', 'Sushi', 'Essen Japan'],
    ['🥐', 'Croissant', 'Frühstück Backen'], ['🍰', 'Kuchenstück', 'Backen Torte'], ['🍪', 'Keks', 'Backen Plätzchen'],
    ['🍫', 'Schokolade', 'Süßigkeiten'], ['🍓', 'Erdbeere', 'Obst'], ['🥑', 'Avocado', 'Gemüse'],
    ['🍳', 'Bratpfanne', 'Kochen Küche'],
  ] },
  { id: 'travel', name: 'Reisen & Freizeit', symbols: [
    ['🎒', 'Rucksack', 'Schule Wandern Reise'], ['🧳', 'Koffer', 'Urlaub Reise'], ['✈️', 'Flugzeug', 'Urlaub Reise'],
    ['🚂', 'Zug', 'Reise Bahn'], ['🚗', 'Auto', 'Reise Fahren'], ['🚲', 'Fahrrad', 'Rad Radtour'],
    ['🏕️', 'Camping', 'Zelt Outdoor'], ['⛺', 'Zelt', 'Camping Outdoor'], ['🏖️', 'Strand', 'Urlaub Sommer Meer'],
    ['🏔️', 'Berge', 'Wandern Outdoor'], ['🗺️', 'Landkarte', 'Reise Welt'], ['🧭', 'Kompass', 'Wandern Outdoor'],
    ['🚐', 'Camper', 'Camping Reise Wohnmobil'], ['⛵', 'Segelboot', 'Meer Wasser'], ['🎡', 'Riesenrad', 'Freizeitpark'],
    ['🎟️', 'Eintrittskarten', 'Ticket Konzert Erlebnis'],
  ] },
  { id: 'hobbies', name: 'Hobbys & Technik', symbols: [
    ['📚', 'Bücher', 'Lesen Buch books'], ['🎨', 'Malen', 'Kunst Kreativ Farbe'], ['🧶', 'Wolle', 'Stricken Häkeln'],
    ['🧵', 'Nähgarn', 'Nähen Kreativ'], ['🎵', 'Musik', 'Noten music'], ['🎸', 'Gitarre', 'Musik Instrument'],
    ['🎹', 'Klavier', 'Piano Musik Instrument'], ['🎧', 'Kopfhörer', 'Musik Technik headphones'],
    ['📷', 'Kamera', 'Foto Fotografie'], ['🎮', 'Controller', 'Gaming Konsole Videospiel'], ['💻', 'Laptop', 'Computer Technik'],
    ['📱', 'Handy', 'Telefon Technik'], ['⌚', 'Uhr', 'Smartwatch Technik'], ['🔭', 'Teleskop', 'Astronomie Sterne'],
    ['🎬', 'Film', 'Kino Video'], ['🧩', 'Puzzle', 'Spiel Rätsel'],
  ] },
  { id: 'sports', name: 'Sport & Spiel', symbols: [
    ['⚽', 'Fußball', 'Sport soccer'], ['🏀', 'Basketball', 'Sport'], ['🎾', 'Tennis', 'Sport'],
    ['🏐', 'Volleyball', 'Sport'], ['🏓', 'Tischtennis', 'Sport'], ['🏸', 'Badminton', 'Sport Federball'],
    ['🏋️', 'Gewichtheben', 'Fitness Sport Training'], ['🧘', 'Yoga', 'Fitness Meditation'], ['🏃', 'Laufen', 'Joggen Sport'],
    ['🏊', 'Schwimmen', 'Wasser Sport'], ['🎿', 'Ski', 'Winter Sport'], ['🛹', 'Skateboard', 'Sport'],
    ['🏆', 'Pokal', 'Gewinner Sport'], ['🎲', 'Würfel', 'Brettspiel Spiel'], ['♟️', 'Schach', 'Spiel'],
    ['🎯', 'Darts', 'Spiel Ziel'],
  ] },
]

export const listSymbols = symbolGroups.flatMap(group => group.symbols.map(([emoji, name, keywords = '']) => ({ emoji, name, keywords, category: group.id })))

export function searchListSymbols(query: string, category = 'all') {
  const normalize = (text: string) => text.toLocaleLowerCase('de').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ß', 'ss')
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  return listSymbols.filter(symbol => (category === 'all' || symbol.category === category)
    && terms.every(term => normalize(`${symbol.emoji} ${symbol.name} ${symbol.keywords}`).includes(term)))
}
