# Nomina Names - Module Extension Guide

**Version 3.0.0+ | JSON Format 4.0.0**

> This complete guide teaches you how to extend Nomina Names with your own content. Whether you're a beginner or experienced developer, you'll find step-by-step instructions with working examples.

---

## 📚 Table of Contents

1. [What You Can Create](#what-you-can-create)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [Complete Tutorial](#complete-tutorial)
4. [Understanding JSON Format 4.0.0](#understanding-json-format-400)
5. [Advanced Topics](#advanced-topics)
6. [Troubleshooting](#troubleshooting)
7. [Publishing Your Module](#publishing-your-module)

---

## What You Can Create

### 🎭 New Species
Add entirely new species (races) with their own names, settlements, and culture:
- **Fantasy**: Goblins, Orcs, Dragons, Fey
- **Sci-Fi**: Androids, Aliens, Cyborgs
- **Historical**: Vikings, Romans, Samurai
- **Custom**: Your own unique creations

### 🌍 New Languages
Translate existing content or add new language support:
- French, Spanish, Italian, Portuguese
- Japanese, Chinese, Korean
- Constructed languages (Elvish, Klingon, etc.)

### 📦 Content Packs
Themed collections of names and content:
- Pirate names and ship names
- Noble houses and family names
- Merchant guilds and businesses
- Military ranks and titles

---

## Quick Start (5 Minutes)

Let's create your first extension that adds Goblin names to Nomina Names!

### Step 1: Create Your Module Folder

Create a new folder in your Foundry modules directory:
```
FoundryVTT/Data/modules/my-goblin-names/
```

### Step 2: Create module.json

Create `module.json` in your folder:

```json
{
  "id": "my-goblin-names",
  "title": "Goblin Names for Nomina",
  "description": "Adds goblin names with German and English support",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "12",
    "verified": "13"
  },
  "relationships": {
    "requires": [{
      "id": "nomina-names",
      "type": "module",
      "compatibility": {
        "minimum": "3.0.0"
      }
    }]
  },
  "esmodules": ["main.js"]
}
```

**What this means:**
- `id`: Unique identifier for your module (use lowercase, no spaces)
- `title`: Display name users will see
- `relationships.requires`: Tells Foundry your module needs Nomina Names installed
- `esmodules`: JavaScript files to load

### Step 3: Create main.js

Create `main.js` in your folder:

```javascript
// Wait for Nomina Names API to be ready (Recommended)
Hooks.once('nomina-names.api.ready', async (api) => {
  console.log('Goblin Names | Nomina Names API ready, loading...');

  // The api instance is provided directly
  const nominaAPI = api;

  // Define our goblin data
  const goblinData = {
    format: "4.0.0",
    package: {
      code: "goblin-de",
      displayName: {
        de: "Goblins",
        en: "Goblins"
      },
      languages: ["de"],
      phoneticLanguage: "de"
    },
    catalogs: {
      names: {
        displayName: {
          de: "Namen",
          en: "Names"
        },
        items: [
          // Male first names
          { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Snarl" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Vex" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Grimjaw" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Skreech" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },

          // Female first names
          { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Shiv" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Hex" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Razorclaw" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Sneer" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },

          // Surnames (clan names)
          { t: { de: "Skullcrusher" }, tags: ["surnames"], w: 1 },
          { t: { de: "Ratbiter" }, tags: ["surnames"], w: 1 },
          { t: { de: "Mudfoot" }, tags: ["surnames"], w: 1 },
          { t: { de: "Ironteeth" }, tags: ["surnames"], w: 1 },
          { t: { de: "Shadowblade" }, tags: ["surnames"], w: 1 }
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
  };

  try {
    // Register the goblin package with Nomina Names
    await nominaAPI.registerPackage({
      code: 'goblin-de',
      data: goblinData
    });

    console.log('Goblin Names | Successfully registered!');
    ui.notifications.info('Goblin names are now available!');

  } catch (error) {
    console.error('Goblin Names | Failed to register:', error);
    ui.notifications.error('Failed to load goblin names');
  }
});
```
    package: {
      code: "goblin-de",
      displayName: {
        de: "Goblins",
        en: "Goblins"
      },
      languages: ["de"],
      phoneticLanguage: "de"
    },
    catalogs: {
      names: {
        displayName: {
          de: "Namen",
          en: "Names"
        },
        items: [
          // Male first names
          { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Snarl" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Vex" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Grimjaw" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
          { t: { de: "Skreech" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },

          // Female first names
          { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Shiv" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Hex" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Razorclaw" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
          { t: { de: "Sneer" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },

          // Surnames (clan names)
          { t: { de: "Skullcrusher" }, tags: ["surnames"], w: 1 },
          { t: { de: "Ratbiter" }, tags: ["surnames"], w: 1 },
          { t: { de: "Mudfoot" }, tags: ["surnames"], w: 1 },
          { t: { de: "Ironteeth" }, tags: ["surnames"], w: 1 },
          { t: { de: "Shadowblade" }, tags: ["surnames"], w: 1 }
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
  };

  try {
    // Register the goblin package with Nomina Names
    await nominaAPI.registerPackage({
      code: 'goblin-de',
      data: goblinData
    });

    console.log('Goblin Names | Successfully registered!');
    ui.notifications.info('Goblin names are now available!');

  } catch (error) {
    console.error('Goblin Names | Failed to register:', error);
    ui.notifications.error('Failed to load goblin names');
  }
});
```

**What this code does:**
1. **Waits for Foundry**: The `Hooks.once('ready', ...)` waits until Foundry is fully loaded
2. **Gets the API**: Retrieves the Nomina Names API to communicate with it
3. **Checks if available**: Makes sure Nomina Names is installed and active
4. **Defines data**: Creates the goblin names in JSON Format 4.0.0
5. **Registers**: Adds the goblins to Nomina Names
6. **Shows feedback**: Notifies user if successful or if there's an error

### Step 4: Test It!

1. Restart Foundry VTT
2. Go to **Add-on Modules**
3. Enable both **Nomina Names** and **Goblin Names for Nomina**
4. Open a world
5. Open the Nomina Names dialog (`/names` in chat)
6. You should now see "Goblins" in the species dropdown!
7. Generate some goblin names like "Grax Skullcrusher"!

**🎉 Congratulations!** You've created your first Nomina Names extension!

---

## Complete Tutorial

Now let's build a more complete module with multiple features.

### Project: "Monster Names Pack"

We'll create a module that adds three monster species: Goblins, Orcs, and Trolls, each with names and settlements.

### File Structure

```
my-monster-names/
├── module.json
├── main.js
├── data/
│   ├── goblin-de.js
│   ├── orc-de.js
│   └── troll-de.js
└── README.md
```

### 1. Enhanced module.json

```json
{
  "id": "monster-names-pack",
  "title": "Monster Names Pack",
  "description": "Adds goblins, orcs, and trolls with names and settlements",
  "version": "1.0.0",
  "authors": [{
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://your-website.com"
  }],
  "compatibility": {
    "minimum": "12",
    "verified": "13"
  },
  "relationships": {
    "requires": [{
      "id": "nomina-names",
      "type": "module",
      "compatibility": {
        "minimum": "3.0.0"
      }
    }]
  },
  "esmodules": ["main.js"],
  "url": "https://github.com/yourusername/monster-names-pack",
  "manifest": "https://github.com/yourusername/monster-names-pack/releases/latest/download/module.json",
  "download": "https://github.com/yourusername/monster-names-pack/releases/latest/download/monster-names-pack.zip"
}
```

### 2. Create data/goblin-de.js

```javascript
export const GOBLIN_DE = {
  format: "4.0.0",
  package: {
    code: "goblin-de",
    displayName: {
      de: "Goblins",
      en: "Goblins"
    },
    languages: ["de"],
    phoneticLanguage: "de"
  },
  catalogs: {
    names: {
      displayName: { de: "Namen", en: "Names" },
      items: [
        // More male names with weights (higher w = more common)
        { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 2, attrs: { gender: "m" } },
        { t: { de: "Snarl" }, tags: ["male", "firstnames"], w: 2, attrs: { gender: "m" } },
        { t: { de: "Vex" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
        { t: { de: "Grimjaw" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
        { t: { de: "Skreech" }, tags: ["male", "firstnames"], w: 1, attrs: { gender: "m" } },
        { t: { de: "Bloodfang" }, tags: ["male", "firstnames", "rare"], w: 0.5, attrs: { gender: "m", rarity: "rare" } },

        // Female names
        { t: { de: "Vyx" }, tags: ["female", "firstnames"], w: 2, attrs: { gender: "f" } },
        { t: { de: "Shiv" }, tags: ["female", "firstnames"], w: 2, attrs: { gender: "f" } },
        { t: { de: "Hex" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
        { t: { de: "Razorclaw" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
        { t: { de: "Sneer" }, tags: ["female", "firstnames"], w: 1, attrs: { gender: "f" } },
        { t: { de: "Poisontooth" }, tags: ["female", "firstnames", "rare"], w: 0.5, attrs: { gender: "f", rarity: "rare" } },

        // Clan names
        { t: { de: "Skullcrusher" }, tags: ["surnames"], w: 1 },
        { t: { de: "Ratbiter" }, tags: ["surnames"], w: 1 },
        { t: { de: "Mudfoot" }, tags: ["surnames"], w: 1 },
        { t: { de: "Ironteeth" }, tags: ["surnames"], w: 1 },
        { t: { de: "Shadowblade" }, tags: ["surnames", "rare"], w: 0.5, attrs: { rarity: "rare" } }
      ]
    },
    settlements: {
      displayName: { de: "Siedlungen", en: "Settlements" },
      items: [
        { t: { de: "Knochenfels" }, tags: ["camp", "mountain"], w: 1 },
        { t: { de: "Schädelhöhle" }, tags: ["cave", "underground"], w: 1 },
        { t: { de: "Faulhügel" }, tags: ["camp", "forest"], w: 1 },
        { t: { de: "Rattennest" }, tags: ["cave", "urban"], w: 1 },
        { t: { de: "Dunkelschlucht" }, tags: ["canyon", "wilderness"], w: 1 }
      ]
    }
  },
  vocab: {
    fields: {
      rarity: {
        labels: { de: "Seltenheit", en: "Rarity" },
        values: {
          common: { de: "Gewöhnlich", en: "Common" },
          rare: { de: "Selten", en: "Rare" }
        }
      },
      location: {
        labels: { de: "Ort", en: "Location" },
        values: {
          mountain: { de: "Gebirge", en: "Mountain" },
          cave: { de: "Höhle", en: "Cave" },
          forest: { de: "Wald", en: "Forest" }
        }
      }
    },
    icons: {
      rare: "⭐",
      mountain: "⛰️",
      cave: "🕳️",
      forest: "🌲"
    }
  },
  collections: [
    {
      key: "common_names",
      labels: { de: "Häufige Namen", en: "Common Names" },
      description: { de: "Die gebräuchlichsten Goblin-Namen", en: "Most common goblin names" },
      query: {
        category: "names",
        tags: ["firstnames"]
      }
    },
    {
      key: "rare_names",
      labels: { de: "Seltene Namen", en: "Rare Names" },
      description: { de: "Seltene und besondere Goblin-Namen", en: "Rare and special goblin names" },
      query: {
        category: "names",
        tags: ["firstnames", "rare"]
      }
    }
  ],
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
    },
    {
      id: "settlement_full",
      displayName: { de: "Siedlung mit Beschreibung", en: "Settlement with Description" },
      pattern: [
        { select: { from: "catalog", key: "settlements" } }
      ],
      post: ["TrimSpaces"]
    }
  ]
};
```

**Understanding the structure:**

- **`format`**: Always "4.0.0" for current version
- **`package`**: Metadata about your content
  - `code`: Unique ID (species-language format)
  - `displayName`: Names in different languages
  - `languages`: Which languages are included
  - `phoneticLanguage`: How the names "sound"
- **`catalogs`**: Collections of items (names, settlements, etc.)
  - Each catalog has a `displayName` and `items` array
  - Items have `t` (text), `tags` (for filtering), `w` (weight), `attrs` (attributes)
- **`vocab`**: Translations for UI elements
  - Makes tags readable in different languages
  - Adds icons for visual recognition
- **`collections`**: Predefined filter sets
  - Quick access to common queries (like "rare names")
- **`recipes`**: Templates for combining items
  - Defines how to create full names from parts

### 3. Create main.js (Loader)

```javascript
// Import all species data
import { GOBLIN_DE } from './data/goblin-de.js';
import { ORC_DE } from './data/orc-de.js';
import { TROLL_DE } from './data/troll-de.js';

// List of all packages to register
const PACKAGES = [
  { code: 'goblin-de', data: GOBLIN_DE, name: 'Goblins' },
  { code: 'orc-de', data: ORC_DE, name: 'Orcs' },
  { code: 'troll-de', data: TROLL_DE, name: 'Trolls' }
];

// Wait for Nomina Names API to be ready (Recommended)
Hooks.once('nomina-names.api.ready', async (api) => {
  console.log('Monster Names Pack | API ready, initializing...');

  // The api instance is provided directly
  const nominaAPI = api;

  // Register all packages
  let successCount = 0;
  let failCount = 0;

  for (const pkg of PACKAGES) {
    try {
      await nominaAPI.registerPackage({
        code: pkg.code,
        data: pkg.data
      });

      console.log(`Monster Names Pack | ✓ Registered ${pkg.name}`);
      successCount++;

    } catch (error) {
      console.error(`Monster Names Pack | ✗ Failed to register ${pkg.name}:`, error);
      failCount++;
    }
  }

  // Show summary notification
  if (successCount > 0) {
    ui.notifications.info(`Monster Names: Loaded ${successCount} species!`);
  }

  if (failCount > 0) {
    ui.notifications.warn(`Monster Names: Failed to load ${failCount} species`);
  }

  console.log(`Monster Names Pack | Ready! (${successCount} loaded, ${failCount} failed)`);
});
```

**What this does:**
- Imports all your species data files
- Creates a list of packages to register
- Waits for Foundry to load
- Registers each package one by one
- Keeps track of successes and failures
- Shows user-friendly notifications

---

## Understanding JSON Format 4.0.0

Let's break down each part of the format in detail.

### The Item Structure

Every item (name, settlement, etc.) follows this structure:

```javascript
{
  t: { de: "Grax", en: "Grax" },  // Text in different languages
  tags: ["male", "firstnames"],    // Tags for filtering
  w: 1,                            // Weight (probability)
  attrs: { gender: "m" },          // Custom attributes
  gram: {},                        // Grammar rules (optional)
  ext: {}                          // Extension data (optional)
}
```

**Fields explained:**

#### `t` (text) - Required
The actual content in different languages:
```javascript
t: {
  de: "Grimjaw",    // German text
  en: "Grimjaw"     // English text
}
```
- At least one language must be present
- Language codes: `de` (German), `en` (English), `fr` (French), etc.

#### `tags` (tags) - Optional but recommended
Array of strings for filtering and organization:
```javascript
tags: ["male", "firstnames", "rare"]
```
- Common tags: `male`, `female`, `nonbinary`, `firstnames`, `surnames`, `nicknames`
- Location tags: `mountain`, `forest`, `cave`, `urban`
- Custom tags: Anything you want!

#### `w` (weight) - Optional, default: 1
Controls how often an item appears:
```javascript
w: 2      // Twice as common
w: 1      // Normal frequency
w: 0.5    // Half as common
w: 0.1    // Rare (10% chance)
```

#### `attrs` (attributes) - Optional
Custom metadata you can use:
```javascript
attrs: {
  gender: "m",
  rarity: "legendary",
  culture: "forest_goblins",
  personality: "aggressive"
}
```

### Catalogs

Catalogs are named collections of items:

```javascript
catalogs: {
  names: {
    displayName: { de: "Namen", en: "Names" },
    items: [
      /* items here */
    ]
  },
  settlements: {
    displayName: { de: "Siedlungen", en: "Settlements" },
    items: [
      /* items here */
    ]
  }
}
```

**Common catalog types:**
- `names` - Character names
- `settlements` - Place names
- `taverns` - Inn and tavern names
- `shops` - Business names
- `ships` - Vessel names
- `books` - Book titles

You can create any catalog name you want!

### Recipes

Recipes combine items from catalogs:

```javascript
recipes: [
  {
    id: "fullname",
    displayName: { de: "Voller Name", en: "Full Name" },
    pattern: [
      // Step 1: Select a first name
      {
        select: {
          from: "catalog",
          key: "names",
          where: { tags: ["firstnames"] }
        }
      },
      // Step 2: Add a space
      { literal: " " },
      // Step 3: Select a surname
      {
        select: {
          from: "catalog",
          key: "names",
          where: { tags: ["surnames"] }
        }
      }
    ],
    post: ["TrimSpaces", "CollapseSpaces"]
  }
]
```

**Pattern elements:**

1. **select**: Pick an item from a catalog
   ```javascript
   { select: { from: "catalog", key: "names", where: { tags: ["male"] } } }
   ```

2. **literal**: Add fixed text
   ```javascript
   { literal: " the " }
   ```

3. **pp**: Add prepositions (German grammar)
   ```javascript
   { pp: { prep: "von", ref: { select: { ... } } } }
   ```

**Post-processing:**
- `TrimSpaces` - Remove leading/trailing spaces
- `CollapseSpaces` - Replace multiple spaces with one
- `TitleCase` - Capitalize words
- `Uppercase` - ALL CAPS
- `Lowercase` - all lowercase

### Vocab (Vocabulary)

Makes tags readable in the UI:

```javascript
vocab: {
  fields: {
    rarity: {
      labels: { de: "Seltenheit", en: "Rarity" },
      values: {
        common: { de: "Gewöhnlich", en: "Common" },
        rare: { de: "Selten", en: "Rare" },
        legendary: { de: "Legendär", en: "Legendary" }
      }
    }
  },
  icons: {
    common: "⚪",
    rare: "⭐",
    legendary: "💎"
  }
}
```

This makes `{ attrs: { rarity: "rare" } }` display as "⭐ Selten" in German!

### Collections

Collections are predefined filter sets that allow quick access to subsets of your content. They are one of the most powerful features for organizing and presenting your data to users.

#### Why Use Collections?

1. **Better User Experience**: Users select "Harbor Taverns" instead of manually picking catalog + tags
2. **Consistent Filtering**: Define the correct tag combinations once, reuse everywhere
3. **Localized Labels**: Display names in the user's language
4. **API Simplification**: One `collection` parameter instead of multiple `catalog` + `tags` parameters

#### Collection Structure

```javascript
collections: [
  {
    key: "warrior_names",           // Unique identifier (required)
    labels: {                       // Localized display names (required)
      de: "Kriegernamen",
      en: "Warrior Names"
    },
    description: {                  // Localized descriptions (optional)
      de: "Namen für tapfere Krieger",
      en: "Names for brave warriors"
    },
    query: {                        // The filter definition (required)
      category: "names",            // Which catalog to query
      tags: ["male", "fierce"],     // Tags to filter by (AND logic)
      limit: 50                     // Max items to consider (optional)
    }
  }
]
```

#### Complete Collection Example: Tavern Types

Here's a real-world example showing how to organize tavern names by type:

```javascript
{
  format: "4.0.0",
  package: {
    code: "taverns-de",
    displayName: { de: "Tavernen", en: "Taverns" },
    languages: ["de"]
  },
  catalogs: {
    taverns: {
      displayName: { de: "Tavernen & Gasthäuser", en: "Taverns & Inns" },
      items: [
        // Upscale inns - for nobles and wealthy merchants
        { t: { de: "Goldener Greif" }, tags: ["upscale_inn"], w: 1 },
        { t: { de: "Silberner Hirsch" }, tags: ["upscale_inn"], w: 1 },
        { t: { de: "Kristallpalast" }, tags: ["upscale_inn"], w: 1 },

        // Common taverns - for everyday folk
        { t: { de: "Brauner Bär" }, tags: ["common_tavern"], w: 1 },
        { t: { de: "Müder Wanderer" }, tags: ["common_tavern"], w: 1 },
        { t: { de: "Warme Stube" }, tags: ["common_tavern"], w: 1 },

        // Harbor taverns - for sailors and dock workers
        { t: { de: "Zum Anker" }, tags: ["harbor_tavern"], w: 1 },
        { t: { de: "Salziger Hund" }, tags: ["harbor_tavern"], w: 1 },
        { t: { de: "Windrose" }, tags: ["harbor_tavern"], w: 1 },

        // Adventurer taverns - for heroes and mercenaries
        { t: { de: "Rostiges Schwert" }, tags: ["adventurer_tavern"], w: 1 },
        { t: { de: "Letzte Chance" }, tags: ["adventurer_tavern"], w: 1 },
        { t: { de: "Goldener Würfel" }, tags: ["adventurer_tavern"], w: 1 }
      ]
    }
  },
  vocab: {
    fields: {
      type: {
        labels: { de: "Typ", en: "Type" },
        values: {
          upscale_inn: { de: "Gehobenes Gasthaus", en: "Upscale Inn" },
          common_tavern: { de: "Gewöhnliche Taverne", en: "Common Tavern" },
          harbor_tavern: { de: "Hafentaverne", en: "Harbor Tavern" },
          adventurer_tavern: { de: "Abenteurertaverne", en: "Adventurer Tavern" }
        }
      }
    },
    icons: {
      upscale_inn: "⭐",
      common_tavern: "🍺",
      harbor_tavern: "⚓",
      adventurer_tavern: "⚔️"
    }
  },
  collections: [
    {
      key: "upscale_inns",
      labels: { de: "Gehobene Gasthäuser", en: "Upscale Inns" },
      description: { de: "Feine Etablissements für wohlhabende Gäste", en: "Fine establishments for wealthy guests" },
      query: { category: "taverns", tags: ["upscale_inn"] }
    },
    {
      key: "common_taverns",
      labels: { de: "Gewöhnliche Tavernen", en: "Common Taverns" },
      description: { de: "Einfache Tavernen für das gemeine Volk", en: "Simple taverns for common folk" },
      query: { category: "taverns", tags: ["common_tavern"] }
    },
    {
      key: "harbor_taverns",
      labels: { de: "Hafentavernen", en: "Harbor Taverns" },
      description: { de: "Raue Lokale am Hafen", en: "Rough places at the harbor" },
      query: { category: "taverns", tags: ["harbor_tavern"] }
    },
    {
      key: "adventurer_taverns",
      labels: { de: "Abenteurertavernen", en: "Adventurer Taverns" },
      description: { de: "Treffpunkte für Helden und Söldner", en: "Meeting places for heroes and mercenaries" },
      query: { category: "taverns", tags: ["adventurer_tavern"] }
    }
  ]
}
```

#### Using Collections via API

Once registered, users can generate from your collections:

```javascript
const api = game.modules.get('nomina-names').api;

// Generate using collection instead of manual filtering
const harborTavern = await api.generateFromCollection({
  species: 'human',  // or your custom species
  language: 'de',
  collection: 'harbor_taverns',
  count: 1
});

console.log(harborTavern);
// Result: ["Zum Anker"]
```

#### Collection Best Practices

1. **Plan your tags first**: Before creating collections, design a consistent tagging system
2. **Use semantic names**: `harbor_tavern` is better than `type_3`
3. **Provide all languages**: If your package supports multiple languages, add labels for each
4. **Add descriptions**: Help users understand what each collection contains
5. **Test thoroughly**: Verify each collection returns the expected items

Users can select "Warrior Names" in the UI instead of manually filtering!

---

## Advanced Topics

### Multiple Languages

Create packages for different languages:

```javascript
// data/goblin-de.js (German)
export const GOBLIN_DE = {
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
        { t: { de: "Grax" }, tags: ["male", "firstnames"], w: 1 }
      ]
    }
  }
};

// data/goblin-en.js (English)
export const GOBLIN_EN = {
  format: "4.0.0",
  package: {
    code: "goblin-en",
    displayName: { de: "Goblins", en: "Goblins" },
    languages: ["en"],
    phoneticLanguage: "en"
  },
  catalogs: {
    names: {
      displayName: { de: "Namen", en: "Names" },
      items: [
        { t: { en: "Grax" }, tags: ["male", "firstnames"], w: 1 }
      ]
    }
  }
};
```

Then register both:
```javascript
await nominaAPI.registerPackage({ code: 'goblin-de', data: GOBLIN_DE });
await nominaAPI.registerPackage({ code: 'goblin-en', data: GOBLIN_EN });
```

### Loading from JSON Files

Instead of JS files, use JSON:

**data/goblin-de.json:**
```json
{
  "format": "4.0.0",
  "package": {
    "code": "goblin-de",
    "displayName": { "de": "Goblins" },
    "languages": ["de"]
  },
  "catalogs": {
    "names": {
      "displayName": { "de": "Namen" },
      "items": [
        { "t": { "de": "Grax" }, "tags": ["male", "firstnames"], "w": 1 }
      ]
    }
  }
}
```

**main.js:**
```javascript
// Wait for Nomina Names API to be ready (Recommended)
Hooks.once('nomina-names.api.ready', async (api) => {
  const nominaAPI = api;

  try {
    const response = await fetch('modules/my-goblin-names/data/goblin-de.json');
    const data = await response.json();

    await nominaAPI.registerPackage({
      code: 'goblin-de',
      data: data
    });

    ui.notifications.info('Goblins loaded!');
  } catch (error) {
    console.error('Failed to load goblins:', error);
  }
});
```

### Settings and Configuration

Add user settings:

```javascript
Hooks.once('init', () => {
  // Register a setting
  game.settings.register('monster-names-pack', 'enableRareNames', {
    name: 'Enable Rare Names',
    hint: 'Include rare and legendary names in generation',
    scope: 'world',      // 'world' or 'client'
    config: true,        // Show in module settings
    type: Boolean,
    default: true,
    onChange: value => {
      console.log('Rare names setting changed to:', value);
    }
  });
});

// Use the setting with the API ready event
Hooks.once('nomina-names.api.ready', async (api) => {
  const nominaAPI = api;
  const enableRare = game.settings.get('monster-names-pack', 'enableRareNames');

  if (!enableRare) {
    // Filter out rare items before registering
    GOBLIN_DE.catalogs.names.items = GOBLIN_DE.catalogs.names.items.filter(
      item => !item.tags.includes('rare')
    );
  }

  await nominaAPI.registerPackage({ code: 'goblin-de', data: GOBLIN_DE });
});
```

### Error Handling Best Practices

```javascript
// Wait for Nomina Names API to be ready (Recommended)
Hooks.once('nomina-names.api.ready', async (api) => {
  console.log('Monster Names | Starting...');

  // The api instance is provided directly
  const nominaAPI = api;

  // Register packages with detailed error handling
  for (const pkg of PACKAGES) {
    try {
      // Validate data before registering
      if (!pkg.data.format || pkg.data.format !== '4.0.0') {
        throw new Error(`Invalid format: ${pkg.data.format}`);
      }

      if (!pkg.data.package || !pkg.data.package.code) {
        throw new Error('Missing package code');
      }

      if (!pkg.data.catalogs || Object.keys(pkg.data.catalogs).length === 0) {
        throw new Error('No catalogs defined');
      }

      // Register
      await nominaAPI.registerPackage({
        code: pkg.code,
        data: pkg.data
      });

      console.log(`Monster Names | ✓ ${pkg.name} registered successfully`);

    } catch (error) {
      console.error(`Monster Names | ✗ Failed to register ${pkg.name}:`, error);

      // Show user-friendly error
      ui.notifications.error(
        `Failed to load ${pkg.name}: ${error.message}`,
        { permanent: false }
      );
    }
  }

  console.log('Monster Names | Initialization complete');
});
```

---

## Troubleshooting

### Common Issues

#### "Module not found" error
**Problem:** Nomina Names API is not available

**Solution:**
```javascript
const nominaAPI = game.modules.get('nomina-names')?.api;
if (!nominaAPI) {
  console.error('Nomina Names not found!');
  return;  // Stop here
}
```

Make sure:
- Nomina Names is installed
- Nomina Names is enabled in your world
- Nomina Names version is 3.0.0 or higher

#### "Invalid format" error
**Problem:** JSON structure is incorrect

**Solution:** Check your JSON structure:
- `format` must be exactly `"4.0.0"`
- `package.code` must exist
- `catalogs` must have at least one catalog
- All JSON must be valid (use a validator)

#### Names not appearing
**Problem:** Package registered but names don't show up

**Solution:**
1. Check the console for errors (`F12` in browser)
2. Verify your package code matches registration:
   ```javascript
   code: "goblin-de"  // Must match everywhere!
   ```
3. Check that items have the required structure:
   ```javascript
   { t: { de: "Name" }, tags: ["male"], w: 1 }
   ```

#### Wrong language shown
**Problem:** UI shows wrong language

**Solution:**
- Ensure `package.languages` includes the language
- Check `displayName` has the language key
- Verify item `t` objects have the language

### Debugging Tips

Add detailed logging:

```javascript
Hooks.once('ready', async () => {
  console.group('Monster Names Pack Debug');

  const nominaAPI = game.modules.get('nomina-names')?.api;
  console.log('API available:', !!nominaAPI);

  if (nominaAPI) {
    console.log('Available languages:', await nominaAPI.getAvailableLanguages());
    console.log('Available species:', await nominaAPI.getAvailableSpecies('de'));
  }

  for (const pkg of PACKAGES) {
    console.group(pkg.name);
    console.log('Package code:', pkg.code);
    console.log('Format:', pkg.data.format);
    console.log('Catalogs:', Object.keys(pkg.data.catalogs));
    console.log('Item count:', pkg.data.catalogs.names?.items?.length || 0);

    try {
      await nominaAPI.registerPackage({ code: pkg.code, data: pkg.data });
      console.log('✓ Registration successful');
    } catch (error) {
      console.error('✗ Registration failed:', error);
    }

    console.groupEnd();
  }

  console.groupEnd();
});
```

---

## Publishing Your Module

### Preparation Checklist

- [ ] **Test thoroughly**: Generate at least 100 names without errors
- [ ] **Check all languages**: Verify all language variants work
- [ ] **Validate JSON**: Use online validator for all JSON files
- [ ] **Write README**: Clear installation and usage instructions
- [ ] **Add LICENSE**: Choose appropriate license (MIT, CC, etc.)
- [ ] **Version control**: Use Git for tracking changes
- [ ] **Create manifest**: Proper module.json with all fields

### README.md Example

```markdown
# Monster Names Pack for Nomina Names

Adds three monster species to Nomina Names: Goblins, Orcs, and Trolls.

## Features
- 🧟 3 monster species with unique naming conventions
- 🌍 German language support
- 📍 Settlement names for each species
- ⭐ Rare and legendary names
- 🎨 Themed collections

## Installation

### Method 1: Module Browser
1. Open Foundry VTT
2. Go to "Add-on Modules"
3. Search for "Monster Names Pack"
4. Click "Install"

### Method 2: Manifest URL
Use this URL: `https://github.com/yourusername/monster-names/releases/latest/download/module.json`

## Requirements
- Foundry VTT v12 or higher
- Nomina Names module v3.0.0 or higher

## Usage
1. Enable "Monster Names Pack" in your world
2. Open Nomina Names dialog (`/names` in chat)
3. Select "Goblins", "Orcs", or "Trolls" from species dropdown
4. Generate names!

## Content Overview

### Goblins
- 12 male first names
- 12 female first names
- 8 clan names
- 5 settlement types

### Orcs
- 15 male first names
- 15 female first names
- 10 clan names
- 8 settlement types

### Trolls
- 10 male first names
- 10 female first names
- 6 clan names
- 4 settlement types

## API Usage

Generate names programmatically:

\`\`\`javascript
const api = game.modules.get('nomina-names').api;

// Generate goblin name
const goblinName = await api.generateName({
  species: 'goblin',
  gender: 'male',
  language: 'de'
});

// Generate orc settlement
const orcSettlement = await api.generateFromCatalog({
  species: 'orc',
  catalog: 'settlements',
  language: 'de',
  count: 1
});
\`\`\`

## Credits
- Names inspired by traditional fantasy literature
- Created by [Your Name]

## License
This module is licensed under [MIT License](LICENSE).

## Support
- Report issues: https://github.com/yourusername/monster-names/issues
- Discussions: https://github.com/yourusername/monster-names/discussions

## Changelog

### v1.0.0 (2025-01-15)
- Initial release
- Added Goblins, Orcs, and Trolls
- German language support
```

### GitHub Repository Structure

```
monster-names-pack/
├── .gitignore
├── LICENSE
├── README.md
├── CHANGELOG.md
├── module.json
├── main.js
├── data/
│   ├── goblin-de.js
│   ├── orc-de.js
│   └── troll-de.js
└── .github/
    └── workflows/
        └── release.yml
```

### .gitignore

```gitignore
# Development
node_modules/
*.log
.DS_Store
*.swp

# Build artifacts
dist/
build/

# IDE
.vscode/
.idea/
```

### Creating a Release

1. **Update version** in module.json
2. **Update CHANGELOG.md** with changes
3. **Commit and tag**:
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```
4. **Create release on GitHub**:
   - Go to Releases
   - Click "Create new release"
   - Select your tag
   - Add release notes
   - Upload a zip of your module

### Submitting to Foundry Package Browser

1. Create a manifest URL (from your GitHub release)
2. Submit to https://foundryvtt.com/packages/submit
3. Fill out the form with:
   - Module title
   - Short description
   - Manifest URL
   - Categories/tags
4. Wait for approval

---

## Need Help?

### Resources
- **Nomina Names API Docs**: [api-documentation.md](api-documentation.md)
- **JSON Format Spec**: [json_v_4_spec.md](json_v_4_spec.md)
- **Foundry Docs**: https://foundryvtt.com/api/
- **Discord**: Join the Foundry VTT Discord for support

### Community
- Share your modules on r/FoundryVTT
- Post in Foundry Discord #module-development
- Create a discussion on GitHub

---

**🎉 You're Ready!**

You now have everything you need to create amazing extensions for Nomina Names. Start simple, test often, and gradually add more features. The community is excited to see what you create!
