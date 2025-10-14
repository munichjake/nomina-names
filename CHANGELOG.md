# Changelog

All notable changes to the Nomina Names module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Genitive/Possessive Transformer**: Neuer Transformer zur Umwandlung von Namen in den Genitiv/Possessiv
  - Unterstützt deutsche Genitivbildung nach korrekten Grammatikregeln
  - Unterstützt englische Possessivbildung (apostrophe rules)
  - Case-insensitiv: `genitive`, `Genitive`, `GENITIVE` und `possessive`, `Possessive`, `POSSESSIVE` funktionieren alle
  - Verwendung in Patterns: `"transform": "genitive"` oder `"transform": { "type": "genitive" }`
  - Deutsche Regeln:
    - Namen auf -s, -ß, -x, -z, -tz: Apostroph anhängen (Hans → Hans')
    - Namen auf -e: -s anhängen (Marie → Maries)
    - Namen auf -er, -el, -en: -s anhängen (Peter → Peters)
    - Standard: -s anhängen (Wilhelm → Wilhelms)
  - Englische Regeln:
    - Namen auf -s: nur Apostroph (Charles → Charles')
    - Standard: 's anhängen (Peter → Peter's)
  - Praktische Anwendung z.B. für Tavernennamen, Ladennamen: "Peters Taverne", "Annas Laden"

- **Spezies-Filter in Emergency App**: Neue Filteroptionen für schnellere Namensgenerierung
  - Kompakter, ausklappbarer Filter-Bereich mit Fieldset-Design
  - Alle Spezies standardmäßig ausgewählt
  - Inline-Pills zum Aktivieren/Deaktivieren einzelner Spezies
  - "Alle auswählen" Button für schnelle Vollauswahl
  - "Menschen" Button zum schnellen Filtern auf Menschen (oder erste alphabetische Spezies als Fallback)
  - Dynamische Anzeige der Anzahl ausgewählter Spezies (z.B. "(3/10)")
  - Mindestens eine Spezies muss ausgewählt bleiben (Validierung verhindert vollständige Abwahl)
  - Smooth slideDown/slideUp Animation beim Ausklappen
  - Vollständig i18n-fähig (Deutsch/Englisch)
  - Subtiles, kompaktes Design das den Fokus auf Namensgenerierung behält

- **Name-Click-Konfiguration**: Neue Settings für individuelles Name-Click-Verhalten
  - Checkbox: In Zwischenablage kopieren (Standard: aktiviert)
  - Checkbox: In Chat posten (Standard: deaktiviert)
  - Beide Optionen gleichzeitig nutzbar
  - Dropdown für Vertraulichkeitsstufe bei Chat-Posts:
    - Aktuelle Stufe übernehmen (erbt den aktuellen Roll-Mode)
    - Nur für GM sichtbar (WHISPER)
    - Öffentlich (PUBLIC)
  - Hinweis-Notification wenn beide Optionen deaktiviert sind
  - Funktioniert in allen Apps: Generator, Emergency Names und History
  - Lokalisierung für Deutsch und Englisch

- **Prozedurale Generierung (Beta)**: Neue Collection-basierte prozedurale Namensgenerierung
  - Unterstützung für Recipe-basierte Collections in JSON Format 4.0.1
  - Collections können jetzt entweder `tags` (für Catalog-Filterung) oder `recipes` (für prozedurale Generierung) enthalten
  - Bei Auswahl von Recipe-basierten Collections wählt der Generator für jeden Namen zufällig ein Recipe aus
  - Automatische Duplikat-Vermeidung über alle generierten Namen hinweg
  - Beispiel: Zwergensiedlungen mit 9 verschiedenen prozeduralen Templates für realistische Namen wie "Eisentor", "Goldhalle der Steinfäuste", "Granitburg"
  - Generator-App zeigt Recipe-basierte und Tag-basierte Collections gemeinsam als Checkboxen an
  - Flexible Kombination möglich: Mehrere Collections können gleichzeitig ausgewählt werden

### Changed

- **Emergency Button Injection**: Verbesserte Button-Injection mit robuster Event-Behandlung
  - Umstellung von jQuery auf native DOM API (insertAdjacentHTML/insertAdjacentElement) für bessere Performance
  - Umfassende Chat-Event-Hooks für zuverlässige Button-Positionierung:
    - renderChatLog, closeChatLog, activateChatLog, deactivateChatLog, collapseSidebar
  - Button bleibt korrekt positioniert bei Chat-Popout, Sidebar-Kollaps und Tab-Wechseln
  - Neue moveEmergencyButton() Funktion für dynamische Repositionierung
  - Button-Padding auf 2em erhöht für bessere Klickbarkeit

- **Generator App**: Verbesserte Collection-Verarbeitung in `generator-app.js`
  - Intelligente Erkennung von Recipe- vs Tag-basierten Collections
  - Separate Generierungslogik für beide Collection-Typen
  - Bei Recipe-Collections: Iterative Generierung mit zufälliger Recipe-Auswahl pro Name
  - Bei Tag-Collections: Batch-Generierung mit Tag-Filterung
  - Kombinierbar: Recipe-basierte und Tag-basierte Collections können gemeinsam verwendet werden

### Fixed

- **Nonbinär-Feld im Generator**: Nonbinäres Geschlechtsfeld wird jetzt nur noch korrekt angezeigt, wenn beide Bedingungen erfüllt sind
  - Nur sichtbar wenn Nonbinär-Einstellung aktiviert ist UND die gewählte Spezies nonbinäre Namen hat
  - Behebt Problem wo Nonbinär-Feld bei allen Spezies angezeigt wurde (z.B. Zwerge, Dragonborn)
  - Neue zentrale Hilfsfunktion `hasNonbinaryNamesForSpecies()` in [ui-helpers.js](scripts/utils/ui-helpers.js:322-360)
  - DataManager-Zugriff korrigiert: Nutzt jetzt `window.NamesModule.getGlobalDataManager()` statt `generator.dataManager`
  - Geschlechts-Checkboxen werden jetzt bei jedem Spezieswechsel aktualisiert statt nur einmal initial
  - Test 35 in [console-tests-extended.js](_dev/tests/console-tests-extended.js) verifiziert das Verhalten

- **Generator App Styling**: Verbesserte Darstellung der Generator-App
  - Optimierte CSS-Stile für bessere visuelle Konsistenz
  - Anpassungen am Layout für verbesserte Benutzerfreundlichkeit

- **Emergency App**: Fehlerbehandlung und Stabilität verbessert
  - Robustere Spezies-Auswahl und Datenvalidierung
  - Verbessertes Error-Handling bei fehlenden Daten

- **Data Manager**: Erweiterte Validierung und Fehlerbehandlung
  - Bessere Prüfung auf ungültige oder fehlende Spezies-Daten
  - Verbesserte Logging-Informationen für Debugging

- **API: getAllSpeciesCodes()**: Neue API-Methode hinzugefügt für den Zugriff auf alle registrierten Spezies-Codes
  - Gibt alle Spezies-Codes über alle Sprachen hinweg zurück (alphabetisch sortiert)
  - Wird von der Spezies-Konfigurationsdialog verwendet
  - Behebt Rendering-Fehler in NamesSpeciesConfig ("api.getAllSpeciesCodes is not a function")
  - Synchrone Methode, die ein Array von Spezies-Codes zurückgibt
  - Dokumentiert in API-Dokumentation unter "Information Functions"

- **Standard-Anzahl der Namen**: Die Einstellung "Standard-Anzahl Namen" wird jetzt korrekt verwendet statt des hartcodierten Wertes 5

- **Suchfunktion im Generator**: Die Suchfunktion zum Durchsuchen der generierten Namen wurde implementiert
  - Echtzeit-Filterung der generierten Namen während der Eingabe (150ms Debounce)
  - Case-insensitive Suche für bessere Benutzbarkeit
  - Suchfilter bleibt nach Neu-Generierung erhalten
  - "Keine Namen gefunden"-Meldung wenn keine Treffer
  - Lokalisierung für Deutsch und Englisch
  - Suchfeld-ID korrigiert von `searchInput` zu `names-search-input` für korrekte Event-Bindung

- **Duplikat-Vermeidung**: Generator verhindert jetzt korrekt Duplikate über alle Generierungsmethoden hinweg
  - Recipe-basierte Generierung nutzt Set-basiertes Tracking für eindeutige Namen
  - Maximale Versuche (10x gewünschte Anzahl) verhindern Endlosschleifen
  - Warnung wenn nicht genug eindeutige Namen generiert werden konnten

- **Namensformat-Feld im Generator**: Formatierung und dynamische Befüllung korrigiert
  - Backslash-Escape-Problem behoben: `\"` wird nicht mehr falsch als `\` + `"` angezeigt
  - Format-Feld wird jetzt dynamisch basierend auf ausgewählten Komponenten befüllt
  - Nur aktivierte Komponenten (Firstname, Surname, Title, Nickname) werden ins Format eingefügt
  - Format wird automatisch aktualisiert beim An-/Abwählen von Komponenten-Checkboxen
  - Initial leeres Feld mit intelligentem Placeholder
  - Reihenfolge: `{title} {firstname} "{nickname}" {surname}` (Nickname in Anführungszeichen)

## [3.0.0] - 2025-10-09

### Major Update - JSON Format 4.0.0 Migration

Diese Version führt eine grundlegende Neustrukturierung der Datenarchitektur ein mit dem neuen JSON Format 4.0.0, das die Grundlage für erweiterte Features und bessere Performance bildet.

### Added

- **JSON Format 4.0.0 Support**: Komplett neues Datenformat mit modernen Features
  - **Unified Package Structure**: Alle Spezies-Daten (male, female, nicknames, surnames, titles, etc.) in einer einzigen Datei pro Sprache
  - **Catalogs System**: Kategorisierung von Daten in `catalogs` (z.B. "names", "settlements", "taverns")
  - **Tag-based Filtering**: Items können mit `tags` versehen werden für flexible Filterung und Kategorisierung
  - **Item Attributes**: `attrs` Feld für zusätzliche Metadaten (z.B. `gender`, `rarity`, etc.)
  - **Weighted Items**: Gewichtung von Items über `w` (weight) für unterschiedliche Häufigkeiten
  - **Recipe System**: Vorbereitete Template-Rezepte für komplexe Namensgenerierung
  - **Output Transforms**: Konfigurierbare Text-Transformationen (TrimSpaces, CollapseSpaces, etc.)
  - **Language Rules**: Grammatik-Regeln für sprachspezifische Transformationen
  - **Vocab System**: Zentrale Übersetzungen und Icons für Tags
  - **Collections**: Vordefinierte Filter-Sets für häufige Anwendungsfälle
  - Siehe vollständige Spezifikation in [docs/json_v_4_spec.md](docs/json_v_4_spec.md)

- **Neue Core-Architektur**: Modulares System für bessere Wartbarkeit
  - **Engine (`scripts/core/engine.js`)**: Zentrale Generator-Engine mit Tag-Filtering und Weighted Selection
  - **Composer (`scripts/core/composer.js`)**: Komponiert komplexe Namen aus mehreren Katalogen
  - **Selector (`scripts/core/selector.js`)**: Intelligente Item-Auswahl mit Gewichtung und Filtering
  - Klare Trennung von Daten-Layer, Business-Logic und UI-Layer

- **Verbesserte Index-Struktur**: Neues `data/index.json` Format
  - Packages statt einzelner Files: Gruppierung von Dateien nach Spezies und Kategorie
  - Multi-Language Support pro Package
  - Flexible Enable/Disable-Optionen pro Datei
  - Zentrale Spezies-Übersetzungen
  - Locale-Fallback-Konfiguration

- **Granulare Namen-Dateien**: Aufspaltung der monolithischen `*.names.json` Dateien
  - Separate Dateien für: `female`, `male`, `nonbinary`, `nicknames`, `surnames`, `titles`
  - Bessere Organisation und Performance
  - Einfacheres Bearbeiten und Erweitern einzelner Kategorien
  - Alle Spezies migriert: Aasimar, Dragonborn, Dwarf, Elf, Gnome, Halfling, Human, Tiefling
  - Für beide Sprachen: Deutsch (`de`) und English (`en`)

- **Enhanced Data Manager**: Komplett überarbeiteter `scripts/core/data-manager.js`
  - Format 4.0.0/4.0.1 Support mit Abwärtskompatibilität zu 3.x Formaten
  - Package-basiertes Loading statt File-basiert
  - Intelligentes Caching für bessere Performance
  - Tag-basierte Queries und Filtering
  - Catalog-System für strukturierte Datenabfrage

- **API-System für Externe Module**: Neues Public API in `scripts/api/`
  - `generator.js`: Öffentliche API für externe Module zur Namensgenerierung
  - `registerPackage()`: Runtime-Registrierung von benutzerdefinierten Spezies und Content-Paketen
  - `registerPackages()`: Batch-Registrierung mehrerer Pakete
  - Dokumentierte Schnittstellen für Integration in andere Foundry-Module
  - Ermöglicht Third-Party-Erweiterungen ohne Code-Modifikationen oder manuelle File-Installation

### Changed

- **Data Structure Migration**: Alle Datendateien zu JSON Format 4.0.0 migriert
  - Alte `*.names.json` Dateien entfernt und durch granulare Files ersetzt
  - Settlement-Dateien zu Format 4.0.0 konvertiert mit Tags und Catalogs
  - Books, Ships, Shops, Taverns zu Format 4.0.0 mit vocab und collections
  - Pets und Weapons zu Format 4.0.0 migriert

- **Generator App Überarbeitung**: `scripts/apps/generator-app.js` für Format 4.0.0
  - Unterstützung für Catalog-basierte Auswahl
  - Tag-Filtering in der UI
  - Integration mit neuem Engine/Composer/Selector System
  - Verbesserte Fehlerbehandlung

- **Picker App Modernisierung**: `scripts/apps/picker-app.js` für neue Architektur
  - Package-basierte Datenabfrage
  - Bessere Integration mit Data Manager
  - Optimierte Rendering-Performance

- **Emergency App**: `scripts/apps/emergency-app.js` an neue Struktur angepasst

- **History Manager**: `scripts/apps/history-app.js` für neue Datenformate aktualisiert

- **API System**: `scripts/api-system.js` komplett überarbeitet für Format 4.0.0

- **Localization Updates**: `lang/de.json` und `lang/en.json` erweitert
  - Neue Übersetzungen für Catalog-Namen und UI-Elemente
  - Verbesserte Konsistenz zwischen Sprachen

- **UI Styling**: CSS-Dateien optimiert für neue Features
  - `styles/names.css`: Erweitert für Tag-Anzeige und Filtering
  - `styles/modern-dropdown.css`: Verbesserte Dropdown-Komponenten
  - `styles/emergency-app.css`, `styles/history-app.css`: Kleinere Anpassungen

- **Templates**: Handlebars-Templates aktualisiert
  - `templates/names.hbs`: Unterstützung für neue Datenstruktur
  - `templates/history.hbs`: Angepasst an Format 4.0.0

### Deprecated

- **Legacy JSON Formats**: Format 3.x wird weiterhin unterstützt, aber sollte zu 4.0.0 migriert werden
  - Alte `*.names.json` Dateien (einzelne Dateien statt unified packages) sind deprecated
  - Migration zu unified package structure empfohlen

### Fixed

- **Performance**: Deutlich schnelleres Laden durch Package-basiertes Caching
- **Memory Usage**: Reduzierter Speicherverbrauch durch optimierte Datenstrukturen
- **Code Quality**: Refactoring für bessere Wartbarkeit und Erweiterbarkeit

### Developer Notes

#### Breaking Changes

- **Data File Structure**: Alte Dateien in `data/` wurden umbenannt/verschoben
  - `*.names.json` → aufgeteilt in `*.female.json`, `*.male.json`, etc.
  - Alte Dateien sind disabled in `index.json`, können aber reaktiviert werden

- **API Changes**: Data Manager API wurde komplett überarbeitet
  - `loadSpeciesData()` → jetzt package-basiert statt file-basiert
  - Neue Methoden: `getCatalog()`, `queryItems()`, `getPackages()`, `registerPackage()`
  - **Runtime Package Registration**: Externe Module können Pakete zur Laufzeit registrieren

#### Migration Path

1. **Für Content Creators**: Siehe [docs/json_v_4_spec.md](docs/json_v_4_spec.md) für Format-Details
2. **Für Module Developers**: Nutze die neue API in `scripts/api/generator.js`

#### Testing

- Alle 8 Spezies getestet (Aasimar, Dragonborn, Dwarf, Elf, Gnome, Halfling, Human, Tiefling)
- Beide Sprachen verifiziert (Deutsch, English)
- Abwärtskompatibilität zu Format 3.x geprüft
- Performance-Tests mit großen Datensätzen durchgeführt

### Technical Details

**Neue Dateien:**
- `scripts/core/engine.js` - Generator Engine
- `scripts/core/composer.js` - Name Composer
- `scripts/core/selector.js` - Item Selector
- `scripts/api/generator.js` - Public API
- `docs/json_v_4_spec.md` - Format 4.0.0 Specification (includes vocab and collections)

**Geänderte Core Files:**
- `scripts/core/data-manager.js` - Komplett überarbeitet (~60% weniger Code)
- `scripts/apps/generator-app.js` - Refactored für neue Architektur
- `scripts/main.js` - Initialisierung angepasst
- `data/index.json` - Neues Package-basiertes Format

**Daten-Migration:**
- 67 Dateien geändert
- ~78,000 Zeilen gelöscht (Konsolidierung)
- ~27,000 Zeilen hinzugefügt (neue Struktur + Features)
- Netto: ~50,000 Zeilen weniger (durch Deduplizierung)

## [2.2.0] - 2025-10-04

### Added
- **Template-based Procedural Name Generation**: Implemented a new template system for generating names dynamically using placeholders and component libraries
  - Supports simple placeholder syntax like `{metal}{building}` that gets replaced with random values from component lists
  - Added support for filter syntax `{placeholder|filter}` to prepare for future grammar features (declensions, cases, etc.)
  - Three generation modes supported: static entries only, procedural templates only, or hybrid mode (randomly picks between static and generated)
  - Fully backward compatible with all existing JSON formats (2.x, 3.0.x, 3.1.x)
- Added new template parser utility (`scripts/utils/template-parser.js`) that handles placeholder replacement and validation
- Created comprehensive documentation for the template system in Format Specification 3.2.0
- **Dwarf Settlements: Procedural Beta**: Added experimental procedural generation for dwarf settlements
  - New "Prozedural (Beta)" subcategory in German dwarf settlements with 9 different template patterns
  - Includes component libraries with 60+ building blocks: metals, stones, building types, clan names, and location suffixes
  - Generates authentic-sounding names like "Eisenschmiede", "Goldhalle der Steinklaue", "Steinburg", "Festung Mithrilgrube"
  - All existing static settlement entries remain unchanged

### Changed
- Updated `NamesDataManager.getSubcategoryData()` to return full subcategory objects when templates are present (instead of just entries array)
- Extended name generator with template support in both categorized content and subcategory selection
- Added template validation to prevent generation errors from missing components

### Fixed
- Data manager now correctly handles subcategories that use templates instead of static entries

## [2.1.1] - 2025-10-04

### Fixed
- **Module Loading**: Fixed critical loading error in published version that prevented module initialization

## [2.1.0] - 2025-10-04

### Added
- **Generation History Feature**: Track all generated names in a dedicated history window
  - Displays last 100 generated names (configurable 10-200 in settings)
  - Accessible from all three apps (Generator, Picker, Emergency) via history button
  - **Search and Filter**: Real-time search and filter by source (Generator/Picker/Emergency/All)
  - **Multi-select**: Select multiple names with checkboxes for batch operations
  - **Quick Actions**:
    - Single-click on name to copy
    - Copy selected names
    - Copy all visible names
    - Export history to JSON
    - Clear history
  - **Rich Display**: Shows name, 
  - **Gender Display**: For names category, displays gender (male/female/neutral/random) in subcategory column

### Changed
- **i18n Structure**: Refactored gender localization keys to `names.gender.*` format
  - Added support for: male, female, nonbinary, neutral, random
  - Applies to both German and English translations

### Fixed
- **History Display**: Empty search results no longer break the UI
  - Search field and filters remain functional when no results found
  - Empty state message displayed within table instead of replacing entire content area

## [2.0.3] - 2025-10-03

### Added
- **Favourite/Pin Feature**: Names can now be pinned/favourited in the generator app
  - Pin button for each generated name
  - Visual indicator for favourited names
  - Improved user experience for tracking preferred names

### Fixed
- **Log Level Settings**: Module log level setting now works correctly
- **Picker App Gender Selection**:
  - Fixed gender selection bug (const → let variable fix)
  - Smart category filtering shows only available genders based on species/language data
  - Added "All Genders (random)" option for varied name generation
  - Auto-reset category when species changes
  - Respects nonbinary setting from user preferences
- **Critical Bug Fixes**:
  - Removed duplicate _getData() method in name-generator.js that could cause unpredictable behavior
  - Fixed hook-listener memory leak in main.js (added v13HooksRegistered flag)
  - Optimized language validation with compiled regex pattern
  - Improved debug logging (DEBUG-prefixed calls now use proper logDebug())
  - Added defensive null checks for better error handling
- **Emergency App Localization**: Removed hardcoded German text, now fully supports both German and English
- **CSS Fixes**:
  - Fixed emergency button padding
  - Fixed scroll behavior in generator app categories dropdown
- **Content**: Fixed incorrect label for 'Humorous books' subcategory and extended list of humorous book titles

## [2.0.2] - 2025-10-03

### Changed
- Version bump for release

## [2.0.1] - 2025-01-30

### Fixed
- **Emergency Button UI**: Fixed oversized emergency name button in Foundry VTT v12 chat window
  - Reduced button padding from 8-12px to 4px 8px
  - Reduced font size from 12-14px to 11px
  - Added max-height constraint (24px) for consistent sizing
  - Changed to inline-flex display for better integration
  - Button now properly fits in chat window without taking excessive vertical space

## [2.0.0] - 2025-01-21

### 🎉 Major Update - Complete Redesign

This is a massive update that completely overhauls the Nomina Names module with a brand new interface, improved flexibility, and better translations!

### ✨ What's New for Users

- **🎨 Completely Redesigned Interface**
  - Modern, professional design with smooth animations
  - Better organized controls and clearer layout
  - Improved visual feedback and hover effects
  - More intuitive user experience

- **🌍 Improved Translations & Localization**
  - Better German and English translations throughout the module
  - More consistent naming across all categories
  - Cleaner language file structure

- **📦 New Content Categories**
  - Added new category types: Pets & Companions, Weapons
  - More diverse name generation options
  - Expanded settlement and location names

- **🎯 Enhanced Name Generation**
  - More flexible name combinations
  - Better quality and variety of generated names
  - Improved formatting options

- **🔌 New API for Module Integration**
  - Third-party modules can now easily add their own name lists and categories
  - External content integration without modifying core files
  - Simplified workflow for content creators and module developers
  - Better interoperability with other Foundry VTT modules

- **🐛 Bug Fixes & Stability**
  - Fixed various UI glitches and display issues
  - Improved compatibility with Foundry VTT v12 and v13
  - Better error handling and performance
  - Fixed design inconsistencies

### 🔧 Technical Improvements (for Developers)

- **JSON Format 3.1.0**: Revolutionary self-contained translation system
  - Category-level `displayName` objects for integrated translations
  - Self-contained JSON files that don't require language file modifications
  - Dynamic category registration without code changes
  - Backwards compatible with existing 3.0.0 and 3.0.1 formats

- **Enhanced Localization System**
  - Priority-based translation resolution (JSON displayName → i18n → fallback)
  - Support for mixed environments (some categories with JSON translations, others with traditional i18n)
  - Language fallback chain: current language → English → German → any available → capitalized key

- **Dynamic Content System**
  - Categories can now be added by simply creating JSON files and updating index.json
  - No code modifications required for new categories like "pets", "weapons", "vehicles", etc.
  - Automatic category type detection and UI integration

- **Code Architecture**
  - New modular structure with `name-generator.js` and `species-manager.js`
  - Enhanced data manager with improved caching
  - New validation system for data files
  - Better API integration and extensibility

### 📚 Documentation
- **JSON Format Specification**: Complete 3.1.0 format documentation with examples
- **Developer Guide**: New section on creating self-contained categories
- **Migration Guide**: Step-by-step instructions for upgrading from 3.0.1 to 3.1.0
- **API Documentation**: Updated with new 3.1.0 features and capabilities

## [1.2.11] - Previous Release

### Features
- Basic 3.0.0/3.0.1 format support
- Traditional i18n localization system
- Manual category configuration in index.json
- Core name generation functionality

---

## Migration Guide for 3.1.0

### For Content Creators

#### Upgrading Existing Files
1. Change `format` field from "3.0.1" to "3.1.0"
2. Add category-level `displayName`:
   ```json
   "data": {
     "pets": {
       "displayName": {
         "de": "Haustiere & Begleiter",
         "en": "Pets & Companions"
       },
       "subcategories": [...]
     }
   }
   ```
3. Test in your setup
4. Optionally remove corresponding entries from language files

#### Creating New Categories
1. Create your JSON file with format 3.1.0
2. Include category-level displayName
3. Add entry to index.json files array
4. No code changes needed - category appears automatically!

### For Module Developers

#### Benefits
- **Simplified Integration**: No need to modify language files
- **Self-Contained Modules**: Everything in one JSON file
- **Dynamic Categories**: Add new content types without code changes
- **Backwards Compatibility**: Existing integrations continue working

#### API Enhancements
- Enhanced `getLocalizedCategoryName()` with context support
- New `getCategoryDisplayName()` method for cached lookups
- Improved category detection and UI integration

### Compatibility
- ✅ **3.0.0 Format**: Full backwards compatibility
- ✅ **3.0.1 Format**: Full backwards compatibility
- ✅ **Legacy Formats**: Continued support with fallbacks
- ✅ **Mixed Environments**: 3.1.0 files can coexist with older formats
- ✅ **Existing APIs**: All existing module integrations continue working

---

*This changelog documents the evolution of the Nomina Names module. For detailed technical specifications, see the [JSON Format 4.0.0 Specification](docs/json_v_4_spec.md) and [API Documentation](docs/api-documentation.md).*