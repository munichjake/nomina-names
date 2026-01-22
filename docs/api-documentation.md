# Nomina Names API - Developer Documentation

<details open>
<summary><strong>🇬🇧 English</strong></summary>

## Quickstart

Get started with the Nomina Names API in 3 simple steps:

### Step 1: Add Module Dependency

Add `nomina-names` to your `module.json`:

```json
{
  "id": "my-module",
  "title": "My Module",
  "relationships": {
    "requires": [
      {
        "id": "nomina-names",
        "type": "module",
        "compatibility": {
          "minimum": "3.0.0"
        }
      }
    ]
  }
}
```

### Step 2: Listen for API Ready Event

The recommended way to access the API is using the dedicated ready event. **Important:** The API is automatically passed as the `api` parameter - you don't need to call `game.modules.get('nomina-names').api` yourself.

```javascript
Hooks.once('nomina-names.api.ready', async (api) => {
  // The 'api' parameter contains the ready-to-use API
  // No need to call game.modules.get() here!

  const name = await api.generateName({
    species: 'elf',
    gender: 'female',
    language: 'en'
  });

  console.log('Generated name:', name);
  // Output: "Aerdeth Moonwhisper"
});
```

**How it works:**
- The `nomina-names.api.ready` event fires automatically when the API is initialized
- The API instance is passed directly as the `api` parameter
- You can use `api` immediately without any additional setup

**Alternative (outside the event):**
If you need to access the API outside of the ready event, you can use the shorter global access point:

```javascript
// Get the API reference (shorter way)
const api = game.NominaAPI;

// Wait for it to be ready
await api.ready();

// Now use it
const name = await api.generateName({ species: 'elf' });
```

**Note:** `game.NominaAPI` is the recommended shorthand. You can also use `game.modules.get('nomina-names').api` if you prefer the explicit path.

### Step 3: Generate Names

That's it! You can now generate names. Here are some common examples:

```javascript
// Simple character name
const name = await api.generateName({
  species: 'human',
  gender: 'male',
  language: 'en'
});
// Result: "John Smith"

// Multiple names at once
const names = await api.generateName({
  species: 'elf',
  language: 'de',
  count: 5
});
// Result: ["Arwen Mondglanz", "Galadriel Silberblatt", ...]

// Name with title
const nobleName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'en',
  components: ['title', 'firstname', 'surname'],
  format: '{title} {firstname} {surname}'
});
// Result: "Lady von Goldenhaven Elara Brightblade"

// Get surnames only
const surnames = await api.generateFromCatalog({
  species: 'dwarf',
  language: 'en',
  catalog: 'surnames',
  count: 5
});
// Result: ["Ironbeard", "Stonehelm", "Goldseeker", ...]
```

## Overview

The Nomina Names API provides a comprehensive system for generating fantasy names and content. Built on JSON Format 4.0.0, it offers:

- **8+ Species**: Human, Elf, Dwarf, Halfling, Gnome, Dragonborn, Tiefling, Aasimar
- **2 Languages**: German and English (extensible)
- **Multiple Content Types**: Names, settlements, taverns, shops, books, ships
- **Tag-based Filtering**: Fine-grained control over generated content
- **Input Validation**: Automatic parameter validation with clear error messages

---

## API Reference

### Name Generation

#### `generateName(options)`

Generate a single name or multiple names.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `'de'` | Language code (`'de'`, `'en'`) |
| `species` | string | `'human'` | Species code (`'human'`, `'elf'`, `'dwarf'`, etc.) |
| `gender` | string\|null | `null` | Gender (`'male'`, `'female'`, `'nonbinary'`, or `null` for random) |
| `components` | string[] | `['firstname', 'surname']` | Name components to include |
| `format` | string | `'{firstname} {surname}'` | Name format template |
| `count` | number | `1` | Number of names to generate (1-100) |

**Returns:** `Promise<string>` when count=1, `Promise<string[]>` when count>1

**Valid Components:** `'firstname'`, `'surname'`, `'title'`, `'nickname'`

**Examples:**

```javascript
// Basic usage
const name = await api.generateName({
  species: 'elf',
  gender: 'male',
  language: 'en'
});
// Result: "Aerdeth Moonwhisper"

// First name only
const firstName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'de',
  components: ['firstname'],
  format: '{firstname}'
});
// Result: "Emma"

// Name with nickname
const nicknameName = await api.generateName({
  species: 'dwarf',
  gender: 'male',
  language: 'en',
  components: ['firstname', 'nickname', 'surname'],
  format: '{firstname} "{nickname}" {surname}'
});
// Result: 'Thorin "Stonefist" Ironforge'

// Generate multiple names
const names = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'en',
  count: 5
});
// Result: ["Emma Watson", "Sarah Jones", "Emily Davis", ...]
```

---

#### `generateNames(options)`

Convenience method for generating multiple names. Always returns an array.

**Parameters:** Same as `generateName()`

**Returns:** `Promise<string[]>`

```javascript
const names = await api.generateNames({
  species: 'human',
  gender: 'male',
  count: 5,
  language: 'en'
});
// Result: ["John Smith", "William Brown", "Robert Davis", ...]
```

---

### Catalog Generation

#### `generateFromCatalog(options)`

Generate items directly from a specific catalog.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `'de'` | Language code |
| `species` | string | `'human'` | Species code |
| `catalog` | string | - | Catalog key (required) |
| `tags` | string[] | `[]` | Filter by tags |
| `count` | number | `1` | Number of items to generate |

**Returns:** `Promise<string[]>`

```javascript
// Get surnames only
const surnames = await api.generateFromCatalog({
  species: 'dwarf',
  language: 'en',
  catalog: 'surnames',
  count: 5
});
// Result: ["Ironbeard", "Stonehelm", "Goldseeker", ...]

// Get nicknames
const nicknames = await api.generateFromCatalog({
  species: 'human',
  language: 'de',
  catalog: 'nicknames',
  count: 3
});
// Result: ["der Tapfere", "die Weise", "Eisenfaust"]

// Get settlements with tag filtering
const harbors = await api.generateFromCatalog({
  species: 'human',
  language: 'en',
  catalog: 'settlements',
  tags: ['harbor', 'coastal'],
  count: 3
});
// Result: ["Port Royal", "Seahaven", "Anchor Bay"]
```

---

### Information Functions

#### `getAvailableLanguages()`

Get all available language codes.

```javascript
const languages = await api.getAvailableLanguages();
// Result: ['de', 'en']
```

---

#### `getAvailableSpecies(language)`

Get all available species for a given language.

```javascript
const species = await api.getAvailableSpecies('en');
// Result: [
//   { code: 'human', name: 'Humans' },
//   { code: 'elf', name: 'Elves' },
//   { code: 'dwarf', name: 'Dwarves' },
//   ...
// ]
```

---

#### `getAllSpeciesCodes()`

Get all species codes across all languages.

```javascript
const allSpecies = api.getAllSpeciesCodes();
// Result: ['aasimar', 'dragonborn', 'dwarf', 'elf', ...]
```

---

#### `getAvailableCatalogs(language, species)`

Get available catalogs for a species-language combination.

```javascript
const catalogs = await api.getAvailableCatalogs('de', 'human');
// Result: [
//   { code: 'names', displayName: 'Namen' },
//   { code: 'settlements', displayName: 'Siedlungen' },
//   { code: 'taverns', displayName: 'Tavernen' },
//   ...
// ]
```

---

#### `getAvailableCollections(language, species)`

Get available collections (v4.0.1+ feature).

```javascript
const collections = await api.getAvailableCollections('de', 'human');
// Result: [
//   { key: 'noble', displayName: 'Adelige' },
//   { key: 'rare', displayName: 'Selten' },
//   ...
// ]
```

---

#### `getSupportedGenders()`

Get all supported gender codes.

```javascript
const genders = api.getSupportedGenders();
// Result: ['male', 'female', 'nonbinary']
```

---

### Readiness Functions

#### `ready()`

Wait for the API to be ready. Alternative to the event-based approach.

```javascript
const api = game.NominaAPI;
await api.ready();
// API is now ready
const name = await api.generateName({ species: 'human' });
```

---

#### `isReady()`

Check if the API is ready without waiting.

```javascript
const api = game.NominaAPI;
if (api.isReady()) {
  // Safe to use API
  const name = await api.generateName({ language: 'de' });
}
```

---

#### `hasPackage(species, language)`

Check if a specific species-language package exists.

```javascript
const hasGoblins = await api.hasPackage('goblin', 'en');
if (hasGoblins) {
  // Package exists, safe to generate names
  const name = await api.generateName({ species: 'goblin' });
}
```

---

### UI Functions

#### `openGenerator()`

Open the main name generator application.

```javascript
api.openGenerator();
```

---

#### `openPicker(actor)`

Open the name picker for a specific actor.

```javascript
const actor = game.actors.getName("My Character");
api.openPicker(actor);
```

---

#### `openEmergency()`

Open the emergency quick-name generator.

```javascript
api.openEmergency();
```

---

### Extension Functions

#### `registerPackage(options)`

Register a custom package at runtime.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Package code (`'species-language'`) |
| `data` | object | Yes | Package data following JSON Format 4.0.0 |

```javascript
await api.registerPackage({
  code: 'goblin-de',
  data: {
    format: "4.0.0",
    package: {
      code: "goblin-de",
      displayName: { de: "Goblins", en: "Goblins" },
      languages: ["de"],
      phoneticLanguage: "de"
    },
    catalogs: {
      names: {
        displayName: { de: "Namen", en: "Names" },
        items: [
          { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1 },
          { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 1 }
        ]
      }
    }
  }
});
```

---

#### `registerPackages(packages)`

Register multiple packages at once.

```javascript
await api.registerPackages([
  { code: 'goblin-de', data: goblinDeData },
  { code: 'goblin-en', data: goblinEnData }
]);
```

---

#### `registerHook(hookName, callback)`

Register a hook for events.

**Available Hooks:**
- `'names.beforeGenerate'` - Fired before name generation
- `'names.afterGenerate'` - Fired after name generation
- `'names.dataLoaded'` - Fired when data is loaded

```javascript
api.registerHook('names.beforeGenerate', (data) => {
  console.log('Generating with options:', data.options);
});

api.registerHook('names.afterGenerate', (data) => {
  console.log('Generated:', data.result);
});
```

---

### Validation Functions

#### `getValidator()`

Get access to the input validation utilities.

```javascript
const validator = api.getValidator();

// Validate user input
const result = validator.validateLanguage(userInput);
if (!result.isValid) {
  ui.notifications.error(`Invalid: ${result.error}`);
  return;
}
// Use normalized value
const name = await api.generateName({ language: result.normalized });
```

**Available Validators:**
- `validateLanguage(value)` - Validate language codes
- `validateSpecies(value, availableSpecies)` - Validate species codes
- `validateGender(value)` - Validate gender values
- `validateComponents(value)` - Validate component arrays
- `validateFormat(value, components)` - Validate format strings
- `validateCatalog(value, availableCatalogs)` - Validate catalog codes
- `validateTags(value)` - Validate tag arrays
- `validateCount(value)` - Validate count values (1-100)
- `validatePackageCode(value)` - Validate package codes

All validators return:
```javascript
{
  isValid: boolean,
  error: string | null,
  normalized: any
}
```

---

## Integration Patterns

### Pattern 1: Event-Based (Recommended)

Best for modules that need to integrate as soon as the API is available.

```javascript
Hooks.once('nomina-names.api.ready', async (api) => {
  // Register custom content
  await api.registerPackage({
    code: 'custom-de',
    data: myCustomData
  });

  // API is ready to use
  const name = await api.generateName({ species: 'custom' });
});
```

---

### Pattern 2: Async/Await

Best for one-time scripts or macros.

```javascript
const api = game.NominaAPI;
await api.ready();

const name = await api.generateName({
  species: 'human',
  gender: 'male',
  language: 'en'
});
```

---

### Pattern 3: Safe Check

Best for optional integration.

```javascript
const api = game.NominaAPI;
if (!api) {
  console.warn('Nomina Names not available');
  return;
}

if (api.isReady()) {
  const name = await api.generateName({ species: 'human' });
}
```

---

## Error Handling

All API methods throw errors on failure. Wrap calls in try-catch:

```javascript
try {
  const name = await api.generateName({
    species: 'unknown-species'  // Invalid!
  });
} catch (error) {
  console.error('Error:', error.message);
  // Output: "Species 'unknown-species' is not available. Available species: human, elf, dwarf, ..."
}
```

For user-facing code, provide fallbacks:

```javascript
async function generateNameSafe(options) {
  try {
    return await api.generateName(options);
  } catch (error) {
    ui.notifications.warn(`Name generation failed: ${error.message}`);
    // Fallback to human name
    return await api.generateName({ species: 'human' });
  }
}
```

---

## Available Options Reference

### Species Codes

| Code | Description |
|------|-------------|
| `human` | Human names |
| `elf` | Elven names |
| `dwarf` | Dwarven names |
| `halfling` | Halfling names |
| `gnome` | Gnome names |
| `dragonborn` | Dragonborn names |
| `tiefling` | Tiefling names |
| `aasimar` | Aasimar names |
| *(more can be added via `registerPackage`)* |  |

### Language Codes

| Code | Language |
|------|----------|
| `de` | German |
| `en` | English |

### Gender Codes

| Code | Description |
|------|-------------|
| `male` | Male names |
| `female` | Female names |
| `nonbinary` | Non-binary names |
| `null` | Random gender |
| `'random'` | Random gender (alias for null) |

### Catalog Codes

| Code | Description |
|------|-------------|
| `names` | Character names |
| `settlements` | Settlement names |
| `taverns` | Tavern/inn names |
| `shops` | Shop names |
| `books` | Book titles |
| `ships` | Ship names |

### Format Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{firstname}` | First name |
| `{surname}` | Surname |
| `{title}` | Title (includes settlement) |
| `{nickname}` | Nickname |

---

## Advanced Examples

### NPC Generator with Random Attributes

```javascript
async function generateRandomNPC() {
  const species = ['human', 'elf', 'dwarf', 'halfling'];
  const genders = ['male', 'female'];

  const randomSpecies = species[Math.floor(Math.random() * species.length)];
  const randomGender = genders[Math.floor(Math.random() * genders.length)];

  const name = await api.generateName({
    species: randomSpecies,
    gender: randomGender,
    language: 'en'
  });

  return { name, species: randomSpecies, gender: randomGender };
}
```

---

### Settlement Generator

```javascript
async function generateSettlement(species = 'human', language = 'de') {
  const settlementName = (await api.generateFromCatalog({
    species,
    catalog: 'settlements',
    language,
    count: 1
  }))[0];

  const tavernName = (await api.generateFromCatalog({
    species,
    catalog: 'taverns',
    language,
    count: 1
  }))[0];

  const innkeeper = await api.generateName({
    species,
    language,
    components: ['firstname', 'surname'],
    format: '{firstname} {surname}'
  });

  return {
    name: settlementName,
    tavern: { name: tavernName, keeper: innkeeper }
  };
}
```

---

### Macro: Quick NPC Generator

```javascript
// Create a Foundry macro for quick NPC generation
async function quickNPC() {
  const api = game.NominaAPI;
  if (!api) {
    ui.notifications.error('Nomina Names module not found');
    return;
  }

  await api.ready();

  const species = ['human', 'elf', 'dwarf', 'halfling'];
  const genders = ['male', 'female'];

  const randomSpecies = species[Math.floor(Math.random() * species.length)];
  const randomGender = genders[Math.floor(Math.random() * genders.length)];

  const name = await api.generateName({
    species: randomSpecies,
    gender: randomGender,
    language: 'en'
  });

  const message = `
    <h3>Random NPC</h3>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Species:</strong> ${randomSpecies}</p>
    <p><strong>Gender:</strong> ${randomGender}</p>
  `;

  ChatMessage.create({
    content: message,
    speaker: ChatMessage.getSpeaker()
  });
}

quickNPC();
```

---

## Events Reference

### `nomina-names.api.ready`

Fired when the API is fully initialized and ready to use.

```javascript
Hooks.once('nomina-names.api.ready', (api) => {
  // Use api immediately
});
```

---

### `names.beforeGenerate`

Fired before name generation starts.

```javascript
Hooks.on('names.beforeGenerate', (data) => {
  console.log('Generation options:', data.options);
});
```

---

### `names.afterGenerate`

Fired after name generation completes.

```javascript
Hooks.on('names.afterGenerate', (data) => {
  console.log('Generated:', data.result);
});
```

---

### `names.dataLoaded`

Fired when new data is loaded.

```javascript
Hooks.on('names.dataLoaded', (data) => {
  console.log('Package loaded:', data.packageCode);
});
```

---

## Constants

### API Events

```javascript
import { NamesAPI } from './scripts/api-system.js';

NamesAPI.EVENTS.API_READY      // 'nomina-names.api.ready'
NamesAPI.EVENTS.CORE_LOADED    // 'nomina-names:coreLoaded'
NamesAPI.EVENTS.MODULE_READY   // 'namesModuleReady' (deprecated)
```

---

</details>

<details>
<summary><strong>🇩🇪 Deutsch</strong></summary>

## Quickstart

Starten Sie mit der Nomina Names API in 3 einfachen Schritten:

### Schritt 1: Modul-Abhängigkeit hinzufügen

Fügen Sie `nomina-names` zu Ihrer `module.json` hinzu:

```json
{
  "id": "my-module",
  "title": "My Module",
  "relationships": {
    "requires": [
      {
        "id": "nomina-names",
        "type": "module"
      }
    ]
  }
}
```

### Schritt 2: Auf API-Ready-Event warten

Die empfohlene Methode für den API-Zugriff ist das dedizierte Ready-Event. **Wichtig:** Die API wird automatisch als `api`-Parameter übergeben - Sie müssen nicht selbst `game.modules.get('nomina-names').api` aufrufen.

```javascript
Hooks.once('nomina-names.api.ready', async (api) => {
  // Der 'api'-Parameter enthält die fertige API
  // Kein Aufruf von game.modules.get() nötig!

  const name = await api.generateName({
    species: 'elf',
    gender: 'female',
    language: 'de'
  });

  console.log('Generierter Name:', name);
  // Ausgabe: "Arwen Mondglanz"
});
```

**Wie es funktioniert:**
- Das `nomina-names.api.ready`-Event wird automatisch ausgelöst, wenn die API initialisiert ist
- Die API-Instanz wird direkt als `api`-Parameter übergeben
- Sie können `api` sofort verwenden, ohne zusätzliche Einrichtung

**Alternative (außerhalb des Events):**
Wenn Sie außerhalb des Ready-Events auf die API zugreifen müssen, verwenden Sie den kürzeren globalen Zugriff:

```javascript
// API-Referenz holen (kürzere Schreibweise)
const api = game.NominaAPI;

// Warten bis sie bereit ist
await api.ready();

// Jetzt verwenden
const name = await api.generateName({ species: 'elf' });
```

**Hinweis:** `game.NominaAPI` ist die empfohlene Kurzschreibweise. Sie können auch `game.modules.get('nomina-names').api` verwenden, wenn Sie den expliziten Pfad bevorzugen.

### Schritt 3: Namen generieren

Das war's schon! Hier sind einige gängige Beispiele:

```javascript
// Einfacher Charaktername
const name = await api.generateName({
  species: 'human',
  gender: 'male',
  language: 'de'
});
// Ergebnis: "Max Müller"

// Mehrere Namen auf einmal
const names = await api.generateName({
  species: 'elf',
  language: 'de',
  count: 5
});
// Ergebnis: ["Arwen Mondglanz", "Galadriel Silberblatt", ...]

// Name mit Titel
const nobleName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'de',
  components: ['title', 'firstname', 'surname'],
  format: '{title} {firstname} {surname}'
});
// Ergebnis: "Lady von Goldburg Emma Brightblade"

// Nur Nachnamen
const surnames = await api.generateFromCatalog({
  species: 'dwarf',
  language: 'de',
  catalog: 'surnames',
  count: 5
});
// Ergebnis: ["Eisenbart", "Steinhelm", "Goldsucher", ...]
```

## Übersicht

Die Nomina Names API bietet ein umfassendes System zur Generierung von Fantasynamen. Basierend auf JSON Format 4.0.0 bietet sie:

- **8+ Spezies**: Mensch, Elf, Zwerg, Halbling, Gnom, Drachenblut, Tiefling, Aasimar
- **2 Sprachen**: Deutsch und Englisch (erweiterbar)
- **Mehrere Inhaltstypen**: Namen, Siedlungen, Tavernen, Geschäfte, Bücher, Schiffe
- **Tag-basierte Filterung**: Feinkörnige Kontrolle über generierte Inhalte
- **Eingabevalidierung**: Automatische Parameterüberprüfung mit klaren Fehlermeldungen

---

## API-Referenz

### Namensgenerierung

#### `generateName(options)`

Generiert einen einzelnen Namen oder mehrere Namen.

**Parameter:**

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `language` | string | `'de'` | Sprachcode (`'de'`, `'en'`) |
| `species` | string | `'human'` | Spezies-Code (`'human'`, `'elf'`, `'dwarf'`, etc.) |
| `gender` | string\|null | `null` | Geschlecht (`'male'`, `'female'`, `'nonbinary'`, oder `null` für zufällig) |
| `components` | string[] | `['firstname', 'surname']` | Namenskomponenten |
| `format` | string | `'{firstname} {surname}'` | Namensformat-Vorlage |
| `count` | number | `1` | Anzahl zu generierender Namen (1-100) |

**Rückgabe:** `Promise<string>` bei count=1, `Promise<string[]>` bei count>1

**Gültige Komponenten:** `'firstname'`, `'surname'`, `'title'`, `'nickname'`

**Beispiele:**

```javascript
// Grundlegende Verwendung
const name = await api.generateName({
  species: 'elf',
  gender: 'male',
  language: 'de'
});
// Ergebnis: "Aereth Mondwandler"

// Nur Vorname
const firstName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'de',
  components: ['firstname'],
  format: '{firstname}'
});
// Ergebnis: "Emma"

// Name mit Spitznamen
const nicknameName = await api.generateName({
  species: 'dwarf',
  gender: 'male',
  language: 'de',
  components: ['firstname', 'nickname', 'surname'],
  format: '{firstname} "{nickname}" {surname}'
});
// Ergebnis: 'Thorin "Steinfaust" Eisenbart'

// Mehrere Namen generieren
const names = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'de',
  count: 5
});
// Ergebnis: ["Emma Müller", "Anna Schmidt", "Maria Fischer", ...]
```

---

#### `generateNames(options)`

Bequeme Methode zum Generieren mehrerer Namen. Gibt immer ein Array zurück.

**Parameter:** Gleich wie `generateName()`

**Rückgabe:** `Promise<string[]>`

```javascript
const names = await api.generateNames({
  species: 'human',
  gender: 'male',
  count: 5,
  language: 'de'
});
// Ergebnis: ["Max Müller", "Johann Schmidt", "Heinrich Fischer", ...]
```

---

### Katalog-Generierung

#### `generateFromCatalog(options)`

Generiert Elemente direkt aus einem spezifischen Katalog.

**Parameter:**

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `language` | string | `'de'` | Sprachcode |
| `species` | string | `'human'` | Spezies-Code |
| `catalog` | string | - | Katalog-Schlüssel (erforderlich) |
| `tags` | string[] | `[]` | Nach Tags filtern |
| `count` | number | `1` | Anzahl zu generierender Elemente |

**Rückgabe:** `Promise<string[]>`

```javascript
// Nur Nachnamen
const surnames = await api.generateFromCatalog({
  species: 'dwarf',
  language: 'de',
  catalog: 'surnames',
  count: 5
});
// Ergebnis: ["Eisenbart", "Steinhelm", "Goldsucher", ...]

// Spitznamen
const nicknames = await api.generateFromCatalog({
  species: 'human',
  language: 'de',
  catalog: 'nicknames',
  count: 3
});
// Ergebnis: ["der Tapfere", "die Weise", "Eisenfaust"]

// Siedlungen mit Tag-Filterung
const harbors = await api.generateFromCatalog({
  species: 'human',
  language: 'de',
  catalog: 'settlements',
  tags: ['hafen', 'küste'],
  count: 3
});
// Ergebnis: ["Hafenstadt", "Küstenort", "Ankerplatz"]
```

---

### Informationsfunktionen

#### `getAvailableLanguages()`

Ruft alle verfügbaren Sprachcodes ab.

```javascript
const languages = await api.getAvailableLanguages();
// Ergebnis: ['de', 'en']
```

---

#### `getAvailableSpecies(language)`

Ruft alle verfügbaren Spezies für eine Sprache ab.

```javascript
const species = await api.getAvailableSpecies('de');
// Ergebnis: [
//   { code: 'human', name: 'Menschen' },
//   { code: 'elf', name: 'Elfen' },
//   { code: 'dwarf', name: 'Zwerge' },
//   ...
// ]
```

---

#### `getAllSpeciesCodes()`

Ruft alle Spezies-Codes über alle Sprachen hinweg ab.

```javascript
const allSpecies = api.getAllSpeciesCodes();
// Ergebnis: ['aasimar', 'dragonborn', 'dwarf', 'elf', ...]
```

---

#### `getAvailableCatalogs(language, species)`

Ruft verfügbare Kataloge für eine Kombination ab.

```javascript
const catalogs = await api.getAvailableCatalogs('de', 'human');
// Ergebnis: [
//   { code: 'names', displayName: 'Namen' },
//   { code: 'settlements', displayName: 'Siedlungen' },
//   { code: 'taverns', displayName: 'Tavernen' },
//   ...
// ]
```

---

#### `getSupportedGenders()`

Ruft alle unterstützten Geschlechtscodes ab.

```javascript
const genders = api.getSupportedGenders();
// Ergebnis: ['male', 'female', 'nonbinary']
```

---

### Bereitschaftsfunktionen

#### `ready()`

Wartet darauf, dass die API bereit ist. Alternative zum event-basierten Ansatz.

```javascript
const api = game.NominaAPI;
await api.ready();
// API ist jetzt bereit
const name = await api.generateName({ species: 'human' });
```

---

#### `isReady()`

Überprüft, ob die API bereit ist, ohne zu warten.

```javascript
const api = game.NominaAPI;
if (api.isReady()) {
  // Sicher, API zu verwenden
  const name = await api.generateName({ language: 'de' });
}
```

---

#### `hasPackage(species, language)`

Überprüft, ob ein bestimmtes Spezies-Sprach-Paket existiert.

```javascript
const hasGoblins = await api.hasPackage('goblin', 'de');
if (hasGoblins) {
  // Paket existiert, sicher, Namen zu generieren
  const name = await api.generateName({ species: 'goblin' });
}
```

---

### UI-Funktionen

#### `openGenerator()`

Öffnet die Hauptanwendung.

```javascript
api.openGenerator();
```

---

#### `openPicker(actor)`

Öffnet den Namenswähler für einen spezifischen Akteur.

```javascript
const actor = game.actors.getName("Mein Charakter");
api.openPicker(actor);
```

---

#### `openEmergency()`

Öffnet den Notfall-Schnellnamensgenerator.

```javascript
api.openEmergency();
```

---

### Erweiterungsfunktionen

#### `registerPackage(options)`

Registriert ein benutzerdefiniertes Paket zur Laufzeit.

**Parameter:**

| Parameter | Typ | Erforderlich | Beschreibung |
|-----------|-----|--------------|--------------|
| `code` | string | Ja | Paket-Code (`'species-language'`) |
| `data` | object | Ja | Paketdaten nach JSON Format 4.0.0 |

```javascript
await api.registerPackage({
  code: 'goblin-de',
  data: {
    format: "4.0.0",
    package: {
      code: "goblin-de",
      displayName: { de: "Goblins", en: "Goblins" },
      languages: ["de"],
      phoneticLanguage: "de"
    },
    catalogs: {
      names: {
        displayName: { de: "Namen", en: "Names" },
        items: [
          { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1 },
          { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 1 }
        ]
      }
    }
  }
});
```

---

## Verfügbare Optionen

### Spezies-Codes

| Code | Beschreibung |
|------|--------------|
| `human` | Menschnamen |
| `elf` | Elennamen |
| `dwarf` | Zwergennamen |
| `halfling` | Halblingnamen |
| `gnome` | Gnomnamen |
| `dragonborn` | Drachenblut-Namen |
| `tiefling` | Tiefling-Namen |
| `aasimar` | Aasimar-Namen |
| *(mehr via `registerPackage`)* |  |

### Sprachcodes

| Code | Sprache |
|------|---------|
| `de` | Deutsch |
| `en` | Englisch |

### Geschlechtscodes

| Code | Beschreibung |
|------|--------------|
| `male` | Männliche Namen |
| `female` | Weibliche Namen |
| `nonbinary` | Non-binäre Namen |
| `null` | Zufälliges Geschlecht |
| `'random'` | Zufälliges Geschlecht (Alias für null) |

### Katalog-Codes

| Code | Beschreibung |
|------|--------------|
| `names` | Charakternamen |
| `settlements` | Siedlungsnamen |
| `taverns` | Taveren-/Gasthausnamen |
| `shops` | Ladennamen |
| `books` | Büchertitel |
| `ships` | Schiffnamen |

### Format-Platzhalter

| Platzhalter | Beschreibung |
|-------------|--------------|
| `{firstname}` | Vorname |
| `{surname}` | Nachname |
| `{title}` | Titel (inklusive Siedlung) |
| `{nickname}` | Spitzname |

---

</details>
