# Nomina Names API - Developer Documentation

<details open>
<summary><strong>🇬🇧 English</strong></summary>

## Overview

The Nomina Names API provides a comprehensive system for generating names and content for fantasy tabletop games. Whether you need character names, settlement names, tavern names, or other fantasy content, this API offers a flexible and extensible solution for Foundry VTT modules.

The API supports multiple languages, species, and content types, with built-in fallback mechanisms and intelligent generation algorithms. Built on the powerful JSON Format 4.0.0, it provides tag-based filtering, weighted selections, recipe-based generation, vocabulary system, and collections.

### Key Features

- **Multi-language Support**: German and English content with extensibility for other languages
- **Species Diversity**: Built-in support for 8+ fantasy species (Human, Elf, Dwarf, etc.)
- **JSON Format 4.0.0**: Modern data format with catalogs, tags, recipes, vocab, and collections
- **Tag-based Filtering**: Flexible filtering with tags and collections
- **Weighted Selection**: Control probability of name generation
- **Recipe System**: Complex name composition with templates and patterns
- **Robust Error Handling**: Graceful degradation and fallback mechanisms
- **Performance Optimized**: Package-based caching and efficient data loading

</details>

<details>
<summary><strong>🇩🇪 Deutsch</strong></summary>

## Übersicht

Die Nomina Names API bietet ein umfassendes System zur Generierung von Namen und Inhalten für Fantasy-Tabletop-Spiele. Ob Sie Charakternamen, Siedlungsnamen, Tavernennamen oder andere Fantasy-Inhalte benötigen, diese API bietet eine flexible und erweiterbare Lösung für Foundry VTT Module.

Die API unterstützt mehrere Sprachen, Spezies und Inhaltstypen mit eingebauten Fallback-Mechanismen und intelligenten Generierungsalgorithmen. Sie ist sowohl für einfache Aufgaben leicht zu verwenden als auch für erweiterte Anwendungsfälle anpassbar.

### Hauptfunktionen

- **Mehrsprachige Unterstützung**: Deutsche und englische Inhalte mit Erweiterbarkeit für andere Sprachen
- **Spezies-Vielfalt**: Eingebaute Unterstützung für 8+ Fantasy-Spezies (Mensch, Elf, Zwerg, etc.)
- **Inhaltskategorien**: Namen, Siedlungen, Tavernen, Geschäfte, Bücher, Schiffe und mehr
- **Format-Unterstützung**: JSON Format 3.0.0+ mit optionalen Metadaten (3.0.1)
- **Externe Modul-Integration**: Einfache Registrierung eigener Spezies und Inhalte
- **Robuste Fehlerbehandlung**: Graceful Degradation und Fallback-Mechanismen
- **Performance-Optimiert**: Lazy Loading und intelligentes Caching

</details>

<details open>
<summary><strong>🇬🇧 Getting Started</strong></summary>

### Basic Setup

To use the Nomina Names API in your module, first ensure it's listed as a dependency in your `module.json`:

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

### Accessing the API

The API is available through the global game object once Foundry VTT has loaded:

```javascript
// Wait for the system to be ready
Hooks.once('ready', () => {
  const namesAPI = game.modules.get('nomina-names').api;

  // Now you can use the API
  generateCharacterName();
});

async function generateCharacterName() {
  const api = game.modules.get('nomina-names').api;
  const name = await api.generateName({
    species: 'elf',
    gender: 'female',
    language: 'en',
    components: ['firstname', 'surname'],
    format: '{firstname} {surname}'
  });

  console.log('Generated name:', name);
  // Result: "Aerdeth Moonwhisper"
}
```

### Event-Based Integration

For more reliable integration, use the ready hook to ensure the names system is fully initialized:

```javascript
Hooks.once('ready', async () => {
  if (!game.modules.get('nomina-names')?.active) {
    console.warn('Nomina Names module not available');
    return;
  }

  const api = game.modules.get('nomina-names').api;

  // Generate a name
  const name = await api.generateName({
    species: 'human',
    gender: 'male',
    language: 'en'
  });

  console.log('Generated name:', name);
});
```

</details>

<details>
<summary><strong>🇩🇪 Erste Schritte</strong></summary>

### Grundeinrichtung

Um die Nomina Names API in Ihrem Modul zu verwenden, stellen Sie zunächst sicher, dass sie als Abhängigkeit in Ihrer `module.json` aufgeführt ist:

```json
{
  "dependencies": [
    {
      "name": "nomina-names",
      "type": "module"
    }
  ]
}
```

### API-Zugriff

Die API ist über das globale Game-Objekt verfügbar, sobald Foundry VTT geladen wurde:

```javascript
// Warten Sie, bis das System bereit ist
Hooks.once('ready', () => {
  const namesAPI = game.modules.get('nomina-names').api;

  // Jetzt können Sie die API verwenden
  generateCharacterName();
});

async function generateCharacterName() {
  const api = game.modules.get('nomina-names').api;
  const name = await api.generateName({
    species: 'elf',
    gender: 'female',
    language: 'de'
  });

  console.log('Generierter Name:', name);
}
```

### Event-basierte Integration

Für eine zuverlässigere Integration verwenden Sie das Core-Loaded-Event, um sicherzustellen, dass das Namenssystem vollständig initialisiert ist:

```javascript
Hooks.once('nomina-names:coreLoaded', async () => {
  console.log('Namenssystem ist bereit!');

  // Registrieren Sie hier Ihre benutzerdefinierten Spezies
  await registerMySpecies();

  // Beginnen Sie mit der Verwendung der API
  const name = await game.modules.get('nomina-names').api.generateName({
    species: 'human',
    category: 'names'
  });
});
```

</details>

<details open>
<summary><strong>🇬🇧 Core Functions</strong></summary>

## Core Functions

### Name Generation

The primary function for generating names using the V4 system with packages, catalogs, and recipes.

#### `generateName(options)`

Generates a single name or multiple names based on the provided options.

**Parameters:**

- `options` (Object): Configuration object with the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `language` | string | `'de'` | Language code ('de', 'en') |
| `species` | string | `'human'` | Species identifier (e.g., 'human', 'elf', 'dwarf') |
| `gender` | string | `null` | Gender for name generation ('male', 'female', 'nonbinary', null for any) |
| `components` | array | `['firstname', 'surname']` | Name components to include |
| `format` | string | `'{firstname} {surname}'` | Name format template with placeholders |
| `count` | number | `1` | Number of names to generate |

**Returns:** `Promise<string>` when `count=1`, `Promise<Array<string>>` when `count>1`

**Basic Examples:**

```javascript
const api = game.modules.get('nomina-names').api;

// Simple character name (firstname + surname)
const characterName = await api.generateName({
  species: 'elf',
  gender: 'male',
  language: 'en',
  components: ['firstname', 'surname'],
  format: '{firstname} {surname}'
});
// Result: "Aerdeth Moonwhisper"

// Just a first name
const firstName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'de',
  components: ['firstname'],
  format: '{firstname}'
});
// Result: "Emma"

// Generate multiple names at once
const names = await api.generateName({
  species: 'dwarf',
  gender: 'male',
  language: 'en',
  count: 5
});
// Result: ["Thorin Ironforge", "Balin Stonehelm", ...]
```

**Advanced Examples:**

```javascript
// Name with title
const formalName = await api.generateName({
  species: 'human',
  gender: 'female',
  language: 'en',
  components: ['title', 'firstname', 'surname'],
  format: '{title} {firstname} {surname}'
});
// Result: "Lady von Goldenhaven Elara Brightblade"
// Note: Title automatically includes settlement with preposition

// Name with nickname
const nicknameFormat = await api.generateName({
  species: 'dwarf',
  gender: 'male',
  language: 'en',
  components: ['firstname', 'nickname', 'surname'],
  format: '{firstname} "{nickname}" {surname}'
});
// Result: "Thorin "Stonefist" Ironforge"

// Full name with all components
const fullName = await api.generateName({
  species: 'elf',
  gender: 'female',
  language: 'de',
  components: ['title', 'firstname', 'nickname', 'surname'],
  format: '{title} {firstname} "{nickname}" {surname}'
});
// Result: "Lady von Silbermond Arwen "Sternentänzerin" Mondglanz"
```

#### `generateNames(options)`

Convenience function that calls `generateName()` with `count > 1`. Returns an array of names.

```javascript
const api = game.modules.get('nomina-names').api;

// Generate multiple character names
const names = await api.generateNames({
  species: 'human',
  gender: 'male',
  count: 5,
  language: 'en'
});
// Result: ["John Smith", "William Brown", "Robert Davis", "James Wilson", "Michael Anderson"]

// Generate female elf names
const elfNames = await api.generateNames({
  species: 'elf',
  gender: 'female',
  count: 3,
  language: 'de'
});
// Result: ["Arwen Mondglanz", "Galadriel Silberblatt", "Lúthien Sternenlied"]
```

### Catalog Generation

#### `generateFromCatalog(options)`

Generate directly from a specific catalog (e.g., surnames only, titles only).

**Parameters:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `language` | string | `'de'` | Language code |
| `species` | string | `'human'` | Species identifier |
| `catalog` | string | - | Catalog key (e.g., 'surnames', 'titles', 'settlements') |
| `tags` | array | `[]` | Filter tags |
| `count` | number | `1` | Number of items to generate |

**Returns:** `Promise<Array<string>>` - Always returns an array

**Examples:**

```javascript
const api = game.modules.get('nomina-names').api;

// Get surnames only
const surnames = await api.generateFromCatalog({
  species: 'dwarf',
  language: 'en',
  catalog: 'surnames',
  count: 5
});
// Result: ["Ironbeard", "Stonehelm", "Goldseeker", "Hammerhand", "Deepdelver"]

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

### Information Functions

#### `getAvailableLanguages()`

Get list of available languages.

```javascript
const languages = await api.getAvailableLanguages();
// Result: ['de', 'en']
```

#### `getAvailableSpecies(language)`

Get list of available species for a language.

```javascript
const species = await api.getAvailableSpecies('en');
// Result: [
//   { code: 'human', name: 'Humans' },
//   { code: 'elf', name: 'Elves' },
//   { code: 'dwarf', name: 'Dwarves' },
//   ...
// ]
```

#### `getAllSpeciesCodes()`

Get all species codes across all languages. This is useful for configuration dialogs and administrative interfaces that need to display all registered species regardless of language availability.

```javascript
const allSpecies = api.getAllSpeciesCodes();
// Result: ['aasimar', 'dragonborn', 'dwarf', 'elf', 'gnome', 'halfling', 'human', 'orc', 'tiefling']
```

**Note:** This method returns a synchronous array of species codes sorted alphabetically. Unlike `getAvailableSpecies()`, it does not filter by language or provide localized names.

#### `getAvailableCatalogs(language, species)`

Get available catalogs (categories) for a species/language package.

```javascript
const catalogs = await api.getAvailableCatalogs('de', 'human');
// Result: [
//   { code: 'names', displayName: 'Namen' },
//   { code: 'settlements', displayName: 'Siedlungen' },
//   { code: 'taverns', displayName: 'Tavernen' },
//   ...
// ]
```

## UI Functions

The API also provides functions to open the built-in user interfaces.

### `openGenerator()`

Opens the main name generator application.

```javascript
const api = game.modules.get('nomina-names').api;
api.openGenerator();
```

### `openPicker(actor)`

Opens the name picker for a specific actor.

```javascript
const api = game.modules.get('nomina-names').api;
const actor = game.actors.getName("My Character");
api.openPicker(actor);
```

### `openEmergency()`

Opens the emergency quick-name generator.

```javascript
const api = game.modules.get('nomina-names').api;
api.openEmergency();
```

## Extension System

### Hook Registration

You can register hooks to be notified of events in the name generation system.

```javascript
const api = game.modules.get('nomina-names').api;

// Register a hook before name generation
api.registerHook('names.beforeGenerate', (data) => {
  console.log('About to generate name with options:', data.options);
});

// Register a hook after name generation
api.registerHook('names.afterGenerate', (data) => {
  console.log('Generated name:', data.result);
  console.log('Used options:', data.options);
});
```

Available hooks:
- `names.beforeGenerate` - Fired before name generation
- `names.afterGenerate` - Fired after name generation
- `names.dataLoaded` - Fired when data is loaded

## Adding Custom Content (V4 Format)

External modules can register custom species and content at runtime using the V4 package registration API.

### `registerPackage(options)`

Register a new package (species-language combination) with custom names and content.

**Parameters:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | string | Yes | Package code in format 'species-language' (e.g., 'goblin-de') |
| `data` | object | Yes | Package data following JSON Format 4.0.0 |

**Returns:** `Promise<void>`

**Example - Basic Registration:**

```javascript
Hooks.once('ready', async () => {
  const api = game.modules.get('nomina-names')?.api;
  if (!api) return;

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
            { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
            { t: { de: "Snarl" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
            { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
            { t: { de: "Skullcrusher" }, tags: ["surnames"], w: 1 },
            { t: { de: "Ratbiter" }, tags: ["surnames"], w: 1 }
          ]
        },
        settlements: {
          displayName: { de: "Siedlungen", en: "Settlements" },
          items: [
            { t: { de: "Knochenfels" }, tags: ["camp"], w: 1 },
            { t: { de: "Schädelhöhle" }, tags: ["cave"], w: 1 }
          ]
        }
      },
      recipes: [
        {
          id: "fullname",
          displayName: { de: "Voller Name", en: "Full Name" },
          pattern: [
            { select: { from: "catalog", key: "names", where: { tags: ["firstnames"] } } },
            { literal: " " },
            { select: { from: "catalog", key: "names", where: { tags: ["surnames"] } } }
          ],
          post: ["TrimSpaces", "CollapseSpaces"]
        }
      ]
    }
  });

  ui.notifications.info('Goblin species registered!');
});
```

**Example - Loading from JSON File:**

```javascript
Hooks.once('ready', async () => {
  const api = game.modules.get('nomina-names')?.api;
  if (!api) return;

  try {
    // Load package data from your module's data folder
    const response = await fetch('modules/my-goblin-module/data/goblin-de.json');
    const packageData = await response.json();

    // Register the package
    await api.registerPackage({
      code: 'goblin-de',
      data: packageData
    });

    console.log('Goblin package registered successfully');
  } catch (error) {
    console.error('Failed to register goblin package:', error);
  }
});
```

### `registerPackages(packages)`

Register multiple packages at once.

**Parameters:**
- `packages` (Array): Array of package registration options

**Example:**

```javascript
await api.registerPackages([
  {
    code: 'goblin-de',
    data: goblinDeData
  },
  {
    code: 'goblin-en',
    data: goblinEnData
  },
  {
    code: 'orc-de',
    data: orcDeData
  }
]);
```

### Package Data Format

Your package data must follow JSON Format 4.0.0. See the [JSON Format 4.0.0 Specification](json_v_4_spec.md) for complete details.

**Minimum Required Structure:**

```json
{
  "format": "4.0.0",
  "package": {
    "code": "species-language",
    "displayName": { "de": "Name", "en": "Name" },
    "languages": ["de"],
    "phoneticLanguage": "de"
  },
  "catalogs": {
    "names": {
      "displayName": { "de": "Namen", "en": "Names" },
      "items": [
        { "t": { "de": "Text" }, "tags": ["tag1"], "w": 1 }
      ]
    }
  }
}
```

For more information on creating custom content, see the [Module Extension Guide](module-extension-guide.md) and [JSON Format 4.0.0 Specification](json_v_4_spec.md).

## Practical Examples

### Creating a Complete NPC Generator

```javascript
async function generateNPC() {
  const api = game.modules.get('nomina-names').api;

  // Available species and genders
  const species = ['human', 'elf', 'dwarf', 'halfling'];
  const genders = ['male', 'female'];

  // Random selections
  const randomSpecies = species[Math.floor(Math.random() * species.length)];
  const randomGender = genders[Math.floor(Math.random() * genders.length)];

  // Generate the name
  const name = await api.generateName({
    species: randomSpecies,
    gender: randomGender,
    components: ['firstname', 'surname'],
    format: '{firstname} {surname}',
    language: 'en'
  });

  return {
    name,
    species: randomSpecies,
    gender: randomGender
  };
}

// Usage
const npc = await generateNPC();
console.log(`Meet ${npc.name}, a ${npc.gender} ${npc.species}`);
```

### Building a Settlement Generator

```javascript
async function generateSettlement() {
  const api = game.modules.get('nomina-names').api;

  const cultures = ['human', 'elf', 'dwarf'];
  const culture = cultures[Math.floor(Math.random() * cultures.length)];

  // Generate settlement name from settlements catalog
  const settlementNames = await api.generateFromCatalog({
    species: culture,
    catalog: 'settlements',
    language: 'en',
    count: 1
  });
  const settlementName = settlementNames[0];

  // Generate a tavern in the settlement
  const tavernNames = await api.generateFromCatalog({
    species: culture,
    catalog: 'taverns',
    language: 'en',
    count: 1
  });
  const tavernName = tavernNames[0];

  // Generate the tavern keeper
  const tavernKeeper = await api.generateName({
    species: culture,
    gender: Math.random() > 0.5 ? 'male' : 'female',
    components: ['firstname', 'surname'],
    format: '{firstname} {surname}',
    language: 'en'
  });

  return {
    name: settlementName,
    culture: culture,
    tavern: {
      name: tavernName,
      keeper: tavernKeeper
    }
  };
}

// Usage
const settlement = await generateSettlement();
console.log(`Welcome to ${settlement.name}, a ${settlement.culture} settlement`);
console.log(`Visit ${settlement.tavern.name}, run by ${settlement.tavern.keeper}`);
```

### Creating a Library Generator

```javascript
async function generateLibrary() {
  const api = game.modules.get('nomina-names').api;

  const books = [];

  // Generate 5 books from the books catalog
  const titles = await api.generateFromCatalog({
    species: 'human',
    catalog: 'books',
    language: 'en',
    count: 5
  });

  for (const title of titles) {
    const author = await api.generateName({
      species: 'human',
      gender: Math.random() > 0.5 ? 'male' : 'female',
      components: ['firstname', 'surname'],
      format: '{firstname} {surname}',
      language: 'en'
    });

    books.push({
      title,
      author
    });
  }

  return books;
}

// Usage
const library = await generateLibrary();
library.forEach(book => {
  console.log(`"${book.title}" by ${book.author}`);
});
```

## Chat Commands Integration

You can easily integrate the names API with Foundry's chat system:

```javascript
// Register a chat command for generating names
Hooks.on('chatMessage', async (chatlog, messageText, chatdata) => {
  const parts = messageText.split(' ');

  if (parts[0] === '/name') {
    const species = parts[1] || 'human';
    const gender = parts[2] || 'male';

    try {
      const api = game.modules.get('nomina-names').api;
      const name = await api.generateName({
        species: species,
        gender: gender,
        language: 'en'
      });

      ChatMessage.create({
        content: `Generated ${species} ${gender} name: <strong>${name}</strong>`,
        speaker: ChatMessage.getSpeaker()
      });
    } catch (error) {
      ChatMessage.create({
        content: `Error generating name: ${error.message}`,
        speaker: ChatMessage.getSpeaker()
      });
    }

    return false; // Prevent default chat processing
  }
});

// Usage in chat:
// /name elf female
// /name dwarf male
// /name human
```

## Macro Integration

Create useful macros for your players and GMs:

```javascript
// Quick NPC Generator Macro
async function quickNPC() {
  const api = game.modules.get('nomina-names').api;

  if (!api) {
    ui.notifications.error('Nomina Names module not found or not active');
    return;
  }

  try {
    const species = ['human', 'elf', 'dwarf', 'halfling'];
    const randomSpecies = species[Math.floor(Math.random() * species.length)];
    const randomGender = Math.random() > 0.5 ? 'male' : 'female';

    const name = await api.generateName({
      species: randomSpecies,
      gender: randomGender,
      language: 'en'
    });

    const message = `
      <h3>Random NPC Generated</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Species:</strong> ${randomSpecies}</p>
      <p><strong>Gender:</strong> ${randomGender}</p>
    `;

    ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker()
    });

  } catch (error) {
    ui.notifications.error(`Failed to generate NPC: ${error.message}`);
  }
}

// Run the macro
quickNPC();
```

## Error Handling

The API includes comprehensive error handling. Always wrap API calls in try-catch blocks:

```javascript
async function safeNameGeneration() {
  const api = game.modules.get('nomina-names').api;

  try {
    const name = await api.generateName({
      species: 'unknown-species', // This will cause an error
      gender: 'male'
    });

    console.log('Generated:', name);
  } catch (error) {
    console.error('Name generation failed:', error.message);

    // Fallback to a simple name
    const fallbackName = await api.generateName({
      species: 'human',
      gender: 'male'
    });

    console.log('Using fallback name:', fallbackName);
  }
}
```

## Available Species and Languages

### Built-in Species

The following species are available by default:

- `human` - Human names and content
- `elf` - Elven names and content
- `dwarf` - Dwarven names and content
- `halfling` - Halfling names and content
- `gnome` - Gnome names and content
- `dragonborn` - Dragonborn names and content
- `tiefling` - Tiefling names and content
- `aasimar` - Aasimar names and content

### Supported Languages

- `de` - German
- `en` - English

### Available Categories

- `names` - Character names (supports gender-specific generation)
- `settlements` - Settlement and place names
- `taverns` - Tavern and inn names
- `shops` - Shop and business names
- `books` - Book and tome titles
- `ships` - Ship and vessel names

## Advanced Configuration

### Custom Name Formats

You can create custom name formats using template strings:

```javascript
// Available placeholders
const formats = {
  simple: '{firstname}',
  standard: '{firstname} {surname}',
  formal: '{title} {firstname} {surname}',
  nickname: '{firstname} "{nickname}" {surname}',
  full: '{title} {firstname} {surname} of {place}'
};

// Usage
const name = await api.generateName({
  species: 'elf',
  gender: 'female',
  format: formats.formal,
  components: ['title', 'firstname', 'surname']
});
```

### Debugging and Development

Enable debug mode to see detailed logging:

```javascript
// In browser console
game.settings.set('nomina-names', 'logLevel', 'debug');

// Check available data
const dataManager = game.modules.get('nomina-names').dataManager;
console.log('Available languages:', Array.from(dataManager.availableLanguages));
console.log('Available species:', Array.from(dataManager.availableSpecies));

// Inspect specific species data
console.log('Core species:', dataManager.coreSpecies);
console.log('API species:', dataManager.apiSpecies);

// Check if specific data exists
console.log('Has genasi names data?', dataManager.hasData('de', 'genasi', 'names'));

// List all registered data keys
console.log('All data keys:', Array.from(dataManager.consolidatedData.keys()));

// Check species availability
const speciesManager = game.modules.get('nomina-names').speciesManager;
console.log('Is genasi available?', speciesManager.isSpeciesAvailable('genasi'));
```

## Performance Considerations

The names system uses lazy loading and caching for optimal performance:

```javascript
// Preload data for better performance
const dataManager = game.modules.get('nomina-names').dataManager;
await dataManager.ensureDataLoaded('en', 'elf', 'names');

// Generate multiple names efficiently
const names = await api.generateNames({
  species: 'elf',
  count: 10,
  language: 'en'
});
```

## Module Integration Best Practices

1. **Always check for module availability:**
```javascript
const namesModule = game.modules.get('nomina-names');
if (!namesModule?.active) {
  console.warn('Nomina Names module not available');
  return;
}
```

2. **Use the core loaded hook for initialization:**
```javascript
Hooks.once('nomina-names:coreLoaded', () => {
  // Your integration code here
});
```

3. **Handle errors gracefully:**
```javascript
try {
  const name = await api.generateName(options);
} catch (error) {
  // Provide fallback or user feedback
  ui.notifications.warn('Name generation failed, using default');
}
```

4. **Cache frequently used data:**
```javascript
// Store API reference for performance
const api = game.modules.get('nomina-names').api;
```

This comprehensive API provides everything you need to integrate rich name and content generation into your Foundry VTT modules. Whether you're creating simple character generators or complex world-building tools, the Nomina Names API offers the flexibility and reliability you need.