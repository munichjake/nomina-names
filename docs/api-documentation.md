# Nomina Names API - Developer Documentation

<details open>
<summary><strong>🇬🇧 English</strong></summary>

## Overview

The Nomina Names API provides a comprehensive system for generating names and content for fantasy tabletop games. Whether you need character names, settlement names, tavern names, or other fantasy content, this API offers a flexible and extensible solution for Foundry VTT modules.

The API supports multiple languages, species, and content types, with built-in fallback mechanisms and intelligent generation algorithms. It's designed to be easy to use for simple tasks while providing powerful customization options for advanced use cases.

### Key Features

- **Multi-language Support**: German and English content with extensibility for other languages
- **Species Diversity**: Built-in support for 8+ fantasy species (Human, Elf, Dwarf, etc.)
- **Content Categories**: Names, settlements, taverns, shops, books, ships, and more
- **Format Support**: JSON Format 3.0.0+ with optional metadata (3.0.1)
- **External Module Integration**: Easy registration of custom species and content
- **Robust Error Handling**: Graceful degradation and fallback mechanisms
- **Performance Optimized**: Lazy loading and intelligent caching

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
  "dependencies": [
    {
      "name": "nomina-names",
      "type": "module"
    }
  ]
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
    language: 'en'
  });

  console.log('Generated name:', name);
}
```

### Event-Based Integration

For more reliable integration, use the core loaded event to ensure the names system is fully initialized:

```javascript
Hooks.once('nomina-names:coreLoaded', async () => {
  console.log('Names system is ready!');

  // Register your custom species here
  await registerMySpecies();

  // Start using the API
  const name = await game.modules.get('nomina-names').api.generateName({
    species: 'human',
    category: 'names'
  });
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

The primary function for generating names and content. This is the most flexible and commonly used function.

#### `generateName(options)`

Generates a single name or piece of content based on the provided options.

**Parameters:**

- `options` (Object): Configuration object with the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `language` | string | `'de'` | Language code ('de', 'en', etc.) |
| `species` | string | `'human'` | Species identifier |
| `category` | string | `'names'` | Type of content to generate |
| `gender` | string | - | Gender for name generation ('male', 'female', 'nonbinary') |
| `format` | string | `'{firstname} {surname}'` | Name format template |
| `components` | array | - | Specific name components to include |
| `subcategory` | string | - | Specific subcategory for categorized content |
| `count` | number | `1` | Number of names to generate |
| `filters` | object | - | Metadata filters (3.0.1 format) |
| `returnWithMetadata` | boolean | `false` | Return entry with metadata |

**Basic Examples:**

```javascript
const api = game.modules.get('nomina-names').api;

// Simple character name
const characterName = await api.generateName({
  species: 'elf',
  gender: 'male',
  language: 'en'
});
// Result: "Aerdeth Moonwhisper"

// Settlement name
const townName = await api.generateName({
  species: 'human',
  category: 'settlements',
  language: 'en'
});
// Result: "Goldenhaven"

// Tavern name
const tavernName = await api.generateName({
  species: 'halfling',
  category: 'taverns',
  language: 'en'
});
// Result: "The Prancing Pony"
```

**Advanced Examples:**

```javascript
// Custom name format
const formalName = await api.generateName({
  species: 'human',
  gender: 'female',
  format: '{title} {firstname} {surname}',
  components: ['title', 'firstname', 'surname']
});
// Result: "Lady Elara Brightblade"

// Specific book subcategory
const bookTitle = await api.generateName({
  species: 'elf',
  category: 'books',
  subcategory: 'magical_treatises',
  language: 'en'
});
// Result: "Secrets of the Astral Plane"

// Multiple component name
const fullName = await api.generateName({
  species: 'dwarf',
  gender: 'male',
  components: ['firstname', 'surname', 'title'],
  format: '{firstname} {surname}, {title}'
});
// Result: "Thorin Ironforge, Master Smith"
```

#### `generateNames(options)`

Generates multiple names or content pieces at once.

```javascript
// Generate multiple character names
const names = await api.generateNames({
  species: 'human',
  gender: 'mixed', // Generates both male and female names
  count: 5,
  language: 'en'
});
// Result: ["John Smith", "Mary Johnson", "Robert Brown", "Susan Davis", "Michael Wilson"]

// Generate settlement names for a region
const settlements = await api.generateNames({
  species: 'elf',
  category: 'settlements',
  count: 3,
  language: 'en'
});
// Result: ["Silverleaf Grove", "Moonstone Valley", "Starlight Haven"]
```

### Convenience Functions

These functions provide quick access to common name generation tasks.

#### Quick Name Generation

```javascript
const api = game.modules.get('nomina-names').api;

// Get a random first name
const firstName = await api.firstName('human', 'female', 'en');
// Result: "Emma"

// Get a random surname
const lastName = await api.lastName('dwarf', 'en');
// Result: "Ironbeard"

// Get a complete random name
const fullName = await api.fullName('elf', 'male', 'en');
// Result: "Legolas Greenleaf"

// Get any random name from any category
const randomName = await api.randomName('halfling', 'en');
// Result: Could be a character name, place name, etc.
```

#### Content-Specific Functions

```javascript
// Generate settlement names
const settlement = await api.settlement('human', 'en');
// Result: "King's Landing"

// Generate tavern names
const tavern = await api.tavern('halfling', 'en');
// Result: "The Golden Barrel"

// Generate shop names
const shop = await api.shop('dwarf', 'en');
// Result: "Ironforge Smithy"

// Generate book titles
const book = await api.book('elf', 'en');
// Result: "Chronicles of the Ancient Wood"

// Generate ship names
const ship = await api.ship('human', 'en');
// Result: "Sea Dragon"
```

## Adding Custom Species

You can extend the names system by registering your own species with custom name data.

### Basic Species Registration

```javascript
Hooks.once('nomina-names:coreLoaded', async () => {
  const api = game.modules.get('nomina-names').api;

  await api.registerSpecies({
    code: 'dragon',
    displayName: 'Dragon',
    languages: ['en', 'de'],
    data: {
      'en.names': {
        subcategories: {
          male: ['Smaug', 'Bahamut', 'Draconius', 'Pyrion'],
          female: ['Tiamat', 'Vermithrax', 'Scylla', 'Ignis'],
          surnames: ['the Terrible', 'the Wise', 'Goldkeeper', 'Stormwing']
        }
      },
      'de.names': {
        subcategories: {
          male: ['Smaug', 'Bahamut', 'Draconius', 'Pyrion'],
          female: ['Tiamat', 'Vermithrax', 'Scylla', 'Ignis'],
          surnames: ['der Schreckliche', 'die Weise', 'Goldhüter', 'Sturmflügel']
        }
      }
    }
  });

  console.log('Dragon species registered successfully!');
});
```

### Advanced Species with Multiple Content Types

```javascript
await api.registerSpecies({
  code: 'robot',
  displayName: 'Robot',
  languages: ['en'],
  categories: ['names', 'settlements', 'ships'],
  data: {
    'en.names': {
      subcategories: {
        male: ['HAL-9000', 'C-3PO', 'Wall-E', 'R2-D2'],
        female: ['EVE', 'GLaDOS', 'Cortana', 'ARIA'],
        surnames: ['Unit-Alpha', 'Model-X', 'Series-9', 'Protocol-7']
      }
    },
    'en.settlements': {
      names: ['Neo Tokyo', 'Cyber City', 'Bot Harbor', 'Circuit Town']
    },
    'en.ships': {
      names: ['USS Enterprise', 'Normandy', 'Pillar of Autumn', 'Bebop']
    }
  }
});

// Now you can generate robot content
const robotName = await api.generateName({ species: 'robot', gender: 'male' });
const robotCity = await api.generateName({ species: 'robot', category: 'settlements' });
```

### Data Structure Reference

**IMPORTANT: External modules registering custom species must use this exact format:**

The data structure for custom species follows this consolidated format:

```javascript
{
  "speciesCode": {
    "code": "speciesCode",               // Must match the key
    "displayName": "Human Readable Name", // Name shown in UI
    "languages": ["en", "de"],            // Supported language codes
    "categories": ["names", "settlements", "taverns"], // Available content categories
    "data": {
      "language.names": {
        "subcategories": {
          "male": ["name1", "name2"],
          "female": ["name1", "name2"],
          "surnames": ["surname1", "surname2"],
          "titles": ["title1", "title2"]
        }
      },
      "language.settlements": {
        "names": ["settlement1", "settlement2"]
      },
      "language.taverns": {
        "names": ["tavern1", "tavern2"]
      }
    }
  }
}
```

**Example for external module registration:**

```javascript
// Your external module's species data
const customSpeciesData = {
  "genasi": {
    "code": "genasi",
    "displayName": "Genasi",
    "languages": ["de", "en"],
    "categories": ["names", "settlements", "taverns"],
    "data": {
      "de.names": {
        "subcategories": {
          "male": ["Aukan", "Eglath", "Flammenfaust"],
          "female": ["Adrie", "Flammenherz", "Sturmtochter"],
          "surnames": ["Feuerbringer", "Sturmreiter", "Erdenwächter"]
        }
      },
      "en.names": {
        "subcategories": {
          "male": ["Aukan", "Eglath", "Flamefist"],
          "female": ["Adrie", "Flameheart", "Stormdaughter"],
          "surnames": ["Flamebringer", "Stormrider", "Earthguard"]
        }
      },
      "de.settlements": {
        "names": ["Flammenhügel", "Sturmspitze", "Erdenfeste"]
      },
      "en.settlements": {
        "names": ["Flamehill", "Stormpeak", "Earthkeep"]
      },
      "de.taverns": {
        "names": ["Zur Flammenden Esse", "Das Glühende Element"]
      },
      "en.taverns": {
        "names": ["The Blazing Forge", "The Glowing Element"]
      }
    }
  }
}

// Register each species from your data
for (const [speciesCode, speciesConfig] of Object.entries(customSpeciesData)) {
  await api.registerSpecies(speciesConfig);
}
```

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
    category: 'names',
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

  // Generate settlement name
  const settlementName = await api.generateName({
    species: culture,
    category: 'settlements',
    language: 'en'
  });

  // Generate a tavern in the settlement
  const tavernName = await api.generateName({
    species: culture,
    category: 'taverns',
    language: 'en'
  });

  // Generate the tavern keeper
  const tavernKeeper = await api.generateName({
    species: culture,
    gender: Math.random() > 0.5 ? 'male' : 'female',
    category: 'names',
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
  const bookTypes = ['novels', 'histories', 'magical_treatises'];

  // Generate 5 books
  for (let i = 0; i < 5; i++) {
    const bookType = bookTypes[Math.floor(Math.random() * bookTypes.length)];

    const title = await api.generateName({
      species: 'human',
      category: 'books',
      subcategory: bookType,
      language: 'en'
    });

    const author = await api.generateName({
      species: 'human',
      gender: Math.random() > 0.5 ? 'male' : 'female',
      category: 'names',
      format: '{firstname} {surname}',
      language: 'en'
    });

    books.push({
      title,
      author,
      type: bookType
    });
  }

  return books;
}

// Usage
const library = await generateLibrary();
library.forEach(book => {
  console.log(`"${book.title}" by ${book.author} (${book.type})`);
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