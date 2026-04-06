# Nomina Names - FoundryVTT Module

A flexible and extensible name generator for FoundryVTT with configurable JSON data files for multiple languages, species, and categories. Generate traditional character names, settlements, titles, and categorized content like books, taverns, ships, and shops.

## 🚀 Features

### 🎭 Versatile Name Generation
- **Multiple Species**: Humans, Elves, Dwarves, Aasimar, Dragonborn, Halflings, Gnomes, Tieflings (easily extensible)
- **Various Categories**: First names (male/female/nonbinary), surnames, titles, nicknames, settlements
- **Categorized Content**: Books, taverns, ships, shops with subcategories
- **Complex Names**: Combine first name, surname, title, and nickname with customizable formats
- **Grammar Support**: Correct German articles for titles (von/zur/zum/etc.)

### 🌍 Multilingual Support
- **German**: Complete localization
- **English**: Full support
- Easily extensible for additional languages

### 🔗 Seamless Integration
- **Token HUD**: Name button directly on selected tokens
- **Character Sheet**: Name picker button next to the name field
- **Right-click Menu**: "Change Name" option in token context menu
- **Chat Commands**: `/names` or `/namen` for quick access
- **Toolbar Button**: Optional button in the left toolbar
- **Emergency Names**: Quick random name generation for chat

### 🛠️ Customizable & Extensible
- **JSON-based**: Easy extension through new data files
- **Modular Structure**: Add new species and languages via JSON
- **Configurable UI**: Enable/disable various integration points
- **Author Credits**: Automatic display of data source authors
- **Third-party Extensions**: API for other modules to add content

### 📊 Advanced Features
- **JSON Format 4.0.0**: Modern unified package format with catalogs, recipes, vocab, and collections
- **Tag-based Filtering**: Flexible filtering with tags and predefined collections
- **Weighted Selection**: Control probability distribution of generated names
- **Recipe System**: Template-based composition for complex name patterns
- **Vocabulary System**: Centralized translations and icons for consistent UI
- **Permission System**: Control access based on user roles
- **Modern UI**: Enhanced dropdowns and responsive design
- **Nonbinary Support**: Optional nonbinary names (configurable)
- **Gender Color Coding**: Visual distinction of names by gender with customizable colors
- **Flexible Button Placement**: Position the generate button where it suits your workflow

## 📦 Installation

### Automatic Installation
1. Open FoundryVTT
2. Go to "Add-on Modules" → "Install Module"
3. Enter the manifest URL: `https://raw.githubusercontent.com/munichjake/nomina-names/main/module.json`
4. Click "Install"

### Manual Installation
1. Download the latest version from [Releases](https://github.com/munichjake/nomina-names/releases)
2. Extract the archive to `Data/modules/nomina-names/`
3. Restart FoundryVTT
4. Enable the module in the game settings

## ⚙️ Configuration

**[📸 SCREENSHOT NEEDED: Complete module settings panel]**

After installation, find the following options under **Game Settings - Configure Settings - Module Settings - Nomina Names**:

**Benutzer-Einstellungen (Client):**
- **In Zwischenablage kopieren**: Namen beim Klick automatisch kopieren
- **In Chat posten**: Namen beim Klick in den Chat senden
- **Interface-Sprache**: Sprache der Benutzeroberflaeche
- **Standard-Sprachklang**: Standardsprache fuer generierte Namen
- **Standard-Anzahl Namen**: Wie viele Namen auf einmal generiert werden
- **Standard-Ansicht**: Detailliert oder Kompakt
- **Generieren-Button Position**: Klassisch, Schwebend oder Ergebnisbereich
- **Geschlechter-Farben**: Farbkodierung nach Geschlecht aktivieren und konfigurieren

**Welt-Einstellungen (GM):**
- **Rollen konfigurieren**: Welche Benutzerrollen den Generator nutzen duerfen
- **Spezies verwalten**: Welche Spezies verfuegbar sein sollen
- **Erweiterte Metadaten anzeigen**: Zusatzinfos bei Orten und Gebaeuden
- **Non-binaere Namen einbeziehen**: Ermoeglicht nichtbinaere Namensgenerierung
- **Show Button in Token Controls**: Button in der linken Werkzeugleiste
- **Show Button in Character Sheet**: Name-Picker neben dem Namensfeld
- **Show Button in Token HUD**: Namen-Button auf ausgewaehlten Tokens
- **Emergency Button anzeigen**: Schnelle NPC-Namen im Chat

## 🎮 Usage

### Basic Name Generation
**[📸 SCREENSHOT NEEDED: Main generator interface with filled dropdowns and generated results]**

- **Toolbar Button**: Click the names button in the left toolbar
- **Chat Command**: Type `/names` or `/namen` in chat
- **Token Selection**: Select a token and use the HUD button or right-click menu

### Quick Names for Tokens
**[🎬 GIF NEEDED: Complete token naming workflow]**
1. Select one or more tokens
2. Right-click → "Change Name" or use the HUD button
3. Choose language, species, gender, and categories
4. Click "Apply to Selected Token(s)"

### Emergency Names
- Use `/emergency-names` chat command for instant random names
- Perfect for NPCs that need quick naming during play

### Categorized Content with Rich Metadata
**[📸 SCREENSHOT NEEDED: Tavern with detailed metadata display]**

Generate books, taverns, ships, and shops with detailed information:
- **Books**: Religious texts, novels, scientific treatises with authors and descriptions
- **Taverns**: Complete with owner names, locations, quality ratings, atmosphere, and specialties
- **Ships**: Detailed vessel information with captain, purpose, and characteristics
- **Shops**: Full shop details including proprietors, specializations, and inventory focus

### Advanced Search & Filtering
**[🎬 GIF NEEDED: Live search demonstration]**
- **Live Search**: Instantly filter generated results as you type
- **Smart Filtering**: Search names, metadata, categories, and descriptions
- **View Modes**: Toggle between simple name lists and detailed metadata views

---

## 🎨 New in Version 3.1.0

### Gender Color Coding

Generierte Namen konnen farblich nach Geschlecht unterschieden werden. Dies hilft beim schnellen Erkennen, welches Geschlecht zu einem Namen gehort - besonders nuetzlich bei der Multi-Gender-Generierung.

**Aktivierung:**
1. Gehe zu **Game Settings** - **Configure Settings** - **Module Settings** - **Nomina Names**
2. Klicke auf **Konfigurieren** neben "Geschlechter-Farben"
3. Aktiviere das Haekchen bei "Farbkodierung aktivieren"
4. Waehle individuelle Farben fuer maennlich, weiblich und nichtbinaer
5. Klicke auf **Speichern**

**Standardfarben:**
- Maennlich: Blau (#4a90d9)
- Weiblich: Rosa (#d94a6b)
- Nichtbinaer: Lila (#9b59b6)

**Hinweis:** Die Farbkodierung erscheint nur bei Namenskategorien, bei denen das Geschlecht relevant ist (Vornamen). Bei Siedlungsnamen oder Tavernennamen werden keine Geschlechterfarben angezeigt.

---

### Emergency App Species Filter

Die Emergency Names App (Schnelle NPC-Namen) verfuegt jetzt ueber einen Spezies-Filter, mit dem du kontrollieren kannst, welche Spezies bei der Zufallsgenerierung beruecksichtigt werden.

**So verwendest du den Filter:**
1. Oeffne die Emergency Names App (Chat-Button oder `/emergency-names` Befehl)
2. Klicke auf den **Spezies-Filter** Header um ihn auszuklappen
3. Klicke auf die Spezies-Pillen um sie zu aktivieren/deaktivieren
   - Aktive Spezies haben einen farbigen Hintergrund
   - Deaktivierte Spezies sind ausgegraut

**Schnellaktionen:**
- **Alle auswaehlen**: Aktiviert alle verfuegbaren Spezies
- **Menschen**: Waehlt nur Menschen aus (oder die erste alphabetische Spezies als Fallback)

**Hinweise:**
- Mindestens eine Spezies muss ausgewaehlt bleiben
- Die Anzeige zeigt die Anzahl ausgewaehlter Spezies (z.B. "3/10")
- Der Filter bleibt waehrend der Sitzung erhalten

---

### Generate Button Placement

Die Position des "Generieren"-Buttons in der Haupt-Generator-App kann jetzt angepasst werden.

**Verfuegbare Positionen:**

| Position | Beschreibung |
|----------|--------------|
| **Klassisch (Legacy)** | Unter den Optionen - die traditionelle Position. Standard-Einstellung. |
| **Schwebend (Floating)** | Am unteren Rand des Options-Panels mit Sticky-Positioning. Der Button bleibt beim Scrollen sichtbar. |
| **Ergebnisbereich (Result)** | Im Ergebnisbereich neben dem Kopieren-Button. Ideal fuer schnelles Regenerieren ohne zurueck zu scrollen. |

**Einstellung aendern:**
1. Gehe zu **Game Settings** - **Configure Settings** - **Module Settings** - **Nomina Names**
2. Suche die Einstellung "Generieren-Button Position"
3. Waehle deine bevorzugte Position aus dem Dropdown
4. Die Aenderung wird sofort wirksam (kein Neuladen erforderlich)

---

## 🔧 API for Developers

The module provides a comprehensive API for third-party modules to integrate with or extend the name generation system.

### Basic API Usage

```javascript
// Access the API
const namesAPI = game.modules.get('nomina-names').api;

// Generate a single name
const name = await namesAPI.generateName({
  language: 'en',
  species: 'human',
  gender: 'female',
  components: ['firstname', 'surname'],
  format: '{firstname} {surname}'
});

// Generate multiple names
const names = await namesAPI.generateNames({
  count: 5,
  language: 'de',
  species: 'elf',
  gender: 'male'
});

// Generate categorized content
const book = await namesAPI.generateCategorizedContent({
  language: 'en',
  species: 'human',
  category: 'books',
  subcategory: 'religious_books'
});
```

### Available API Methods

#### Name Generation
- `generateName(options)` - Generate a single name
- `generateNames(options)` - Generate multiple names
- `generateCategorizedContent(options)` - Generate categorized content

#### Data Access
- `getAvailableLanguages()` - Get supported languages
- `getAvailableSpecies()` - Get supported species
- `getSupportedGenders()` - Get supported genders
- `getAvailableSubcategories(language, species, category)` - Get subcategories
- `getDefinedSubcategories(category)` - Get all defined subcategories

#### UI Control
- `showGenerator()` - Open the main generator UI
- `showPicker(actor)` - Open picker for specific actor
- `showEmergencyNames()` - Open emergency names UI

#### Utility
- `hasPermission()` - Check user permissions
- `isCategorizedContent(category)` - Check if category has subcategories

### Extension System

#### Register New Package (JSON Format 4.0.0)
```javascript
const namesAPI = game.modules.get('nomina-names').api;

// Register a complete package with JSON Format 4.0.0
await namesAPI.registerPackage({
  code: 'dragonborn-en',
  data: {
    format: '4.0.0',
    package: {
      code: 'dragonborn-en',
      displayName: {
        en: 'Dragonborn',
        de: 'Drachenblütige'
      },
      languages: ['en'],
      phoneticLanguage: 'en'
    },
    catalogs: {
      names: {
        displayName: { en: 'Names', de: 'Namen' },
        items: [
          { t: { en: 'Arjhan' }, tags: ['male', 'firstnames'], w: 1 },
          { t: { en: 'Balasar' }, tags: ['male', 'firstnames'], w: 1 },
          { t: { en: 'Akra' }, tags: ['female', 'firstnames'], w: 1 },
          { t: { en: 'Biri' }, tags: ['female', 'firstnames'], w: 1 },
          { t: { en: 'Clethtinthiallor' }, tags: ['surnames'], w: 1 },
          { t: { en: 'Daardendrian' }, tags: ['surnames'], w: 1 }
        ]
      }
    },
    recipes: [
      {
        id: 'fullname',
        displayName: { en: 'Full Name', de: 'Voller Name' },
        pattern: [
          { select: { from: 'catalog', key: 'names', where: { tags: ['firstnames'] } } },
          { literal: ' ' },
          { select: { from: 'catalog', key: 'names', where: { tags: ['surnames'] } } }
        ],
        post: ['TrimSpaces', 'CollapseSpaces']
      }
    ]
  }
});
```

#### Hook System
```javascript
// Listen for name generation events
namesAPI.registerHook('names.beforeGenerate', (data) => {
  console.log('About to generate name with:', data.options);
});

namesAPI.registerHook('names.afterGenerate', (data) => {
  console.log('Generated:', data.result);
});
```

## 📁 Data Structure & Customization

### Adding New Categories

1. **Update index.json**:
```json
{
  "categoryGroups": {
    "objects": {
      "localization": "names.category-groups.objects",
      "categories": {
        "weapons": {
          "type": "categorized",
          "generators": ["generator"],
          "localization": "names.categories.weapons",
          "subcategories": {
            "swords": "names.subcategory-translations.weapons.swords",
            "axes": "names.subcategory-translations.weapons.axes"
          }
        }
      }
    }
  }
}
```

2. **Create data files**:
   - `data/en.human.weapons.json`
   - `data/de.human.weapons.json`

3. **Add localization**:
```json
{
  "names": {
    "categories": {
      "weapons": "Weapons"
    },
    "subcategory-translations": {
      "weapons": {
        "swords": "Swords",
        "axes": "Axes"
      }
    }
  }
}
```

### Data File Format

#### JSON Format 4.0.0 (Current)

Nomina Names uses a modern, unified package format with powerful features:

```json
{
  "format": "4.0.0",
  "package": {
    "code": "human-de",
    "displayName": {
      "de": "Menschen",
      "en": "Humans"
    },
    "languages": ["de"],
    "phoneticLanguage": "de"
  },
  "catalogs": {
    "names": {
      "displayName": {
        "de": "Namen",
        "en": "Names"
      },
      "items": [
        {
          "t": { "de": "Hans" },
          "tags": ["male", "firstnames"],
          "w": 1,
          "attrs": { "gender": "m" }
        },
        {
          "t": { "de": "Maria" },
          "tags": ["female", "firstnames"],
          "w": 1,
          "attrs": { "gender": "f" }
        },
        {
          "t": { "de": "Schmidt" },
          "tags": ["surnames"],
          "w": 1
        }
      ]
    },
    "settlements": {
      "displayName": {
        "de": "Siedlungen",
        "en": "Settlements"
      },
      "items": [
        {
          "t": { "de": "Goldenhain" },
          "tags": ["village", "rural"],
          "w": 1
        }
      ]
    }
  },
  "vocab": {
    "fields": {
      "location": {
        "labels": { "de": "Ort", "en": "Location" },
        "values": {
          "village": { "de": "Dorf", "en": "Village" },
          "city": { "de": "Stadt", "en": "City" }
        }
      }
    },
    "icons": {
      "village": "🏘️",
      "city": "🏙️"
    }
  },
  "collections": [
    {
      "key": "common_names",
      "labels": { "de": "Häufige Namen", "en": "Common Names" },
      "query": {
        "category": "names",
        "tags": ["firstnames"]
      }
    }
  ],
  "recipes": [
    {
      "id": "fullname",
      "displayName": { "de": "Voller Name", "en": "Full Name" },
      "pattern": [
        { "select": { "from": "catalog", "key": "names", "where": { "tags": ["firstnames"] } } },
        { "literal": " " },
        { "select": { "from": "catalog", "key": "names", "where": { "tags": ["surnames"] } } }
      ],
      "post": ["TrimSpaces", "CollapseSpaces"]
    }
  ]
}
```

**Key Features of Format 4.0.0:**

- **Unified Packages**: All species data in comprehensive, self-contained files
- **Catalogs**: Organized collections of items (names, settlements, taverns, etc.)
- **Tags**: Flexible filtering and categorization system
- **Weights**: Control probability distribution of generated content
- **Attributes**: Rich metadata for items (gender, rarity, culture, etc.)
- **Vocab**: Centralized translations and icons for consistent UI
- **Collections**: Predefined filter sets for common queries
- **Recipes**: Template-based patterns for complex name composition
- **Language Rules**: Grammar support for German articles and prepositions

**For detailed information:**
- **Format Specification**: See [docs/json_v_4_spec.md](docs/json_v_4_spec.md)
- **Developer Guide**: See [docs/module-extension-guide.md](docs/module-extension-guide.md)
- **API Documentation**: See [docs/api-documentation.md](docs/api-documentation.md)

### Language Support

Add new languages by:
1. Creating data files with the language code (e.g., `fr.human.male.json`)
2. Adding language configuration in `lang/_config.json`
3. Creating localization files in `lang/` directory
4. Updating `module.json` with the new language

### Species Support

Add new species by:
1. Creating data files for each category (e.g., `en.dwarf.male.json`)
2. Adding species mapping in `lang/_species-mapping.json`
3. Adding localization entries for the species name

## 🎨 UI Customization

The module uses CSS custom properties for easy theming:

```css
:root {
  --names-primary-color: #4f46e5;
  --names-secondary-color: #6b7280;
  --names-success-color: #10b981;
  --names-border-radius: 6px;
  --names-font-family: 'Signika', sans-serif;
}
```

## ❓ FAQ (Häufig gestellte Fragen)

### Installation & Setup

**Wie installiere ich das Modul?**

Es gibt zwei Möglichkeiten:

1. **Automatisch (empfohlen)**: Öffne FoundryVTT, gehe zu "Add-on Modules" → "Install Module", füge die Manifest-URL ein (`https://raw.githubusercontent.com/munichjake/nomina-names/main/module.json`) und klicke auf "Install".

2. **Manuell**: Lade das Modul von der [Releases-Seite](https://github.com/munichjake/nomina-names/releases) herunter, entpacke es nach `Data/modules/nomina-names/` und starte FoundryVTT neu.

Nach der Installation musst du das Modul noch in deiner Spielwelt aktivieren: "Game Settings" → "Manage Modules" → Häkchen bei "Nomina Names" setzen → "Save Module Settings".

---

**Welche Foundry-Version brauche ich?**

Nomina Names benötigt mindestens **FoundryVTT Version 12**. Wir empfehlen, immer die neueste stabile Version von FoundryVTT zu verwenden, um die beste Kompatibilität zu gewährleisten. Die genauen Versionsanforderungen findest du in der `module.json`-Datei oder auf der Releases-Seite.

---

### Grundlegende Nutzung

**Wie generiere ich einen Namen?**

Es gibt mehrere Wege, den Namensgenerator zu öffnen:

- **Chat-Befehl**: Tippe `/names` oder `/namen` in den Chat und drücke Enter
- **Toolbar-Button**: Klicke auf das Namen-Symbol in der linken Werkzeugleiste (falls aktiviert)
- **Token-HUD**: Wähle einen Token aus und klicke auf den Namen-Button im HUD
- **Rechtsklick-Menü**: Klicke mit der rechten Maustaste auf einen Token und wähle "Change Name"

Im Generator wählst du dann Sprache, Spezies, Geschlecht und die gewünschten Namensbestandteile aus. Klicke auf "Generate" um Namen zu erstellen.

---

**Wie ändere ich die Sprache der Namen?**

Im Namensgenerator findest du ganz oben ein Dropdown-Menü für die Sprache. Wähle dort zwischen "Deutsch" und "English" (oder anderen verfügbaren Sprachen). Die Sprache bestimmt, welche Namensdaten verwendet werden - deutsche Namen haben einen anderen Klang und Stil als englische.

Du kannst auch eine Standardsprache festlegen: "Game Settings" → "Configure Settings" → "Module Settings" → "Names" → "Default Language".

---

**Wie wähle ich eine andere Spezies?**

Im Generator-Fenster gibt es ein Dropdown-Menü für die Spezies. Hier kannst du zwischen Menschen, Elfen, Zwergen, Aasimar, Drachenblütigen, Halblingen, Gnomen, Tieflingen und anderen wählen. Jede Spezies hat ihre eigenen, thematisch passenden Namen.

Hinweis: Nicht jede Spezies ist für jede Sprache verfügbar. Wenn eine Spezies fehlt, sind möglicherweise noch keine Namensdaten für diese Kombination vorhanden.

---

### Konfiguration

**Wie aktiviere ich geschlechtsneutrale Namen?**

Gehe zu "Game Settings" → "Configure Settings" → "Module Settings" → "Names" und aktiviere die Option "Include Nonbinary Names". Danach erscheint im Generator neben "männlich" und "weiblich" auch die Option "nichtbinär" (sofern entsprechende Namensdaten vorhanden sind).

---

**Wie ändere ich die Anzahl der Vorschläge?**

Im Generator-Fenster selbst kannst du einstellen, wie viele Namen auf einmal generiert werden sollen. Suche nach dem Feld "Anzahl" oder "Count" und gib die gewünschte Zahl ein (z.B. 5, 10 oder 20).

---

**Wie kann ich die Farben fuer Geschlechter anpassen?**

Seit Version 3.1.0 gibt es eine integrierte Konfigurationsoberflaeche fuer Geschlechterfarben:

1. Gehe zu **Game Settings** - **Configure Settings** - **Module Settings** - **Nomina Names**
2. Klicke auf **Konfigurieren** neben "Geschlechter-Farben"
3. Aktiviere die Farbkodierung mit dem Haekchen
4. Waehle individuelle Farben mit den Farbwaehlern
5. Nutze **Zuruecksetzen** um zu den Standardfarben zurueckzukehren

Alternativ kannst du Farben auch ueber CSS ueberschreiben:

```css
:root {
  --gender-color-male: #4a90d9;
  --gender-color-female: #d94a6b;
  --gender-color-nonbinary: #9b59b6;
}
```

---

### Fehlerbehebung

**Warum sehe ich keine Namen?**

Wenn keine Namen angezeigt werden, prüfe folgende Punkte:

1. **Modul aktiviert?** Stelle sicher, dass Nomina Names in deiner Welt aktiviert ist ("Manage Modules")
2. **Richtige Auswahl?** Prüfe, ob Sprache, Spezies und Geschlecht korrekt ausgewählt sind
3. **Daten vorhanden?** Nicht alle Kombinationen von Sprache/Spezies/Kategorie haben Daten - versuche eine andere Kombination
4. **Browser-Konsole prüfen**: Drücke F12 und schaue in der Konsole nach Fehlermeldungen
5. **Modul neu laden**: Deaktiviere und reaktiviere das Modul, oder starte FoundryVTT neu

Falls das Problem weiterhin besteht, erstelle einen Bug-Report auf [GitHub Issues](https://github.com/munichjake/nomina-names/issues).

---

**Warum fehlt eine Spezies in der Liste?**

Eine Spezies fehlt in der Dropdown-Liste, wenn:

1. **Keine Daten für diese Sprache**: Die Spezies hat möglicherweise nur Daten für andere Sprachen. Wechsle die Sprache und prüfe erneut.
2. **Daten noch nicht erstellt**: Für manche Spezies wurden noch keine Namensdaten erstellt. Du kannst selbst welche hinzufügen (siehe "Kann ich eigene Namen hinzufügen?").
3. **Erweiterungsmodul fehlt**: Die Spezies wird von einem separaten Erweiterungsmodul bereitgestellt, das nicht installiert oder aktiviert ist.

---

### Für Fortgeschrittene

**Kann ich eigene Namen hinzufügen?**

Ja, absolut! Es gibt zwei Möglichkeiten:

1. **Bestehende Dateien erweitern**: Bearbeite die JSON-Dateien im `data/`-Ordner des Moduls. Füge neue Einträge zu den `items`-Arrays in den Katalogen hinzu. Beachte, dass deine Änderungen bei einem Modul-Update überschrieben werden könnten.

2. **Eigenes Erweiterungsmodul erstellen** (empfohlen): Erstelle ein separates FoundryVTT-Modul, das die API nutzt, um neue Namenspakete zu registrieren. So bleiben deine Daten bei Updates erhalten.

Das Datenformat ist JSON Format 4.0.0. Eine ausführliche Dokumentation findest du in [docs/json_v_4_spec.md](docs/json_v_4_spec.md).

---

**Wie erstelle ich ein Erweiterungs-Modul?**

Ein Erweiterungsmodul kann eigene Namensdaten zu Nomina Names hinzufügen. Hier die Kurzanleitung:

1. **Modul-Struktur erstellen**:
   ```
   my-names-extension/
   ├── module.json
   ├── scripts/
   │   └── init.js
   └── data/
       └── my-names.json
   ```

2. **In `module.json`** Nomina Names als Abhängigkeit deklarieren:
   ```json
   {
     "id": "my-names-extension",
     "name": "My Names Extension",
     "version": "1.0.0",
     "compatibility": { "minimum": "12", "verified": "13" },
     "relationships": {
       "requires": [{ "id": "nomina-names", "type": "module" }]
     },
     "esmodules": ["scripts/init.js"]
   }
   ```

3. **In `init.js`** die API nutzen, um dein Paket zu registrieren:
   ```javascript
   Hooks.once('ready', async () => {
     const api = game.modules.get('nomina-names')?.api;
     if (api) {
       const data = await fetch('modules/my-names-extension/data/my-names.json')
         .then(r => r.json());
       await api.registerPackage({ code: 'my-custom-names', data });
     }
   });
   ```

Eine ausführliche Anleitung mit allen Details findest du in [docs/module-extension-guide.md](docs/module-extension-guide.md).

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add appropriate tests
5. Submit a pull request

### Development Setup

1. Clone the repository to your FoundryVTT modules directory
2. Enable developer mode in FoundryVTT
3. Make changes and test in a development world
4. Follow the existing code style and patterns

## 📄 License

This module is licensed under the MIT License. See the LICENSE file for details.

## 🙏 Credits

- **Original Author**: munichjake
- **Data Sources**: Various contributors (credited in individual data files)
- **FoundryVTT Community**: For feedback and testing

## 📞 Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/munichjake/nomina-names/issues)
- **Feature Requests**: Submit ideas via GitHub Issues
- **Community**: Join the FoundryVTT Discord for support and discussion

## 📈 Changelog

### Version 3.1.0 (Current)
- **Gender Color Coding**: Configurable color-coding for generated names by gender
- **Emergency App Species Filter**: Filter which species appear in random name generation
- **Generate Button Placement**: Choose where the generate button appears (legacy, floating, result)
- **English Nonbinary Names**: Complete nonbinary name support for all 8 species in English
- **Expanded Data Content**: New Aasimar nicknames, German titles, Halfling taverns, Tiefling titles
- Various bug fixes and stability improvements

### Version 3.0.0
- JSON Format 4.0.0 with unified packages, recipes, vocab, and collections
- Enhanced localization system with fallback chains
- Dynamic category system - add categories without code changes
- Improved performance with intelligent caching
- Modern UI with enhanced dropdowns and responsive design
- Live search and filtering in results
- Advanced metadata display with icons and localized field labels
- Runtime package registration API for external modules

### Previous Versions
See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

*Built with ❤️ for the FoundryVTT community*
