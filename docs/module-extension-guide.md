# Nomina Names - Module Extension Guide

This guide explains how third-party module developers can extend the Nomina Names module with custom species, names, and content.

## Table of Contents

1. [Overview](#overview)
2. [Extension Types](#extension-types)
3. [Registration Methods](#registration-methods)
4. [Complete Examples](#complete-examples)
5. [Best Practices](#best-practices)
6. [Data Structure Reference](#data-structure-reference)
7. [Testing Your Extensions](#testing-your-extensions)

## Overview

The Nomina Names module provides a comprehensive extension system that allows other modules to:

- Add completely new species with custom names and content
- Extend existing species with additional name data
- Add categorized content (taverns, shops, books, etc.) for any species
- Register hooks for custom behavior

All extensions are automatically integrated into the main API and generator interface.

## Extension Types

### 1. New Species Registration
Register entirely new species with complete name data sets.

### 2. Name Data Extension
Add additional names to existing species without replacing existing data.

### 3. Categorized Content Extension
Add content like tavern names, shop names, book titles for any species.

### 4. Hook Registration
Register custom hooks for advanced integration.

## Registration Methods

All registration must happen after Nomina Names is ready. Use the `namesModuleReady` hook:

```javascript
Hooks.once('namesModuleReady', (api) => {
  // Your extension registration code here
});
```

### Method 1: Register New Species

Use `api.registerSpecies()` to add completely new species:

```javascript
api.registerSpecies('my-module-id', {
  species: 'dragonkin',
  displayName: 'Dragonkin',
  languages: ['de', 'en'],
  keywords: ['dragon', 'scale', 'fire'],
  data: {
    names: {
      male: {
        firstname: ['Pyrion', 'Scaleborn', 'Emberus', 'Draconis'],
        surname: ['Feuerherz', 'Schuppensohn', 'Drachenlord']
      },
      female: {
        firstname: ['Pyria', 'Scalewhisper', 'Emberia', 'Draconia'],
        surname: ['Feuerherz', 'Schuppentochter', 'Drachendame']
      }
    }
  }
});
```

### Method 2: Extend Existing Species

Use `api.registerNameData()` to add names to existing species:

```javascript
api.registerNameData('my-module-id', {
  language: 'de',
  species: 'elf',
  category: 'names',
  displayName: 'Waldelfen Namen',
  data: {
    male: {
      firstname: ['Silvanus', 'Thalorin', 'Elenion'],
      surname: ['Waldläufer', 'Baumfreund', 'Naturwächter']
    },
    female: {
      firstname: ['Silvara', 'Thaloria', 'Elenia'],
      surname: ['Waldläuferin', 'Baumfreundin', 'Naturwächterin']
    }
  }
});
```

### Method 3: Add Categorized Content

Use `api.registerCategorizedContent()` for taverns, shops, books, etc.:

```javascript
api.registerCategorizedContent('my-module-id', {
  language: 'de',
  species: 'dragonkin',
  category: 'taverns',
  displayName: 'Dragonkin Taverns',
  subcategories: {
    fire_taverns: [
      'Zur Flammenden Klaue',
      'Das Glühende Herz',
      'Zum Feuerschlund'
    ],
    ice_taverns: [
      'Zur Gefrorenen Schuppe',
      'Das Eisige Nest',
      'Zum Frosthauch'
    ]
  }
});
```

## Complete Examples

### Example 1: Fantasy Race Module

Complete module setup for adding a new fantasy race:

```javascript
// In your module's main.js
Hooks.once('init', () => {
  console.log('My Fantasy Races module initializing...');
});

Hooks.once('namesModuleReady', (api) => {
  console.log('Registering custom races with Nomina Names...');

  // Register Lizardfolk
  api.registerSpecies('my-fantasy-races', {
    species: 'lizardfolk',
    displayName: 'Echsenmenschen',
    languages: ['de', 'en'],
    keywords: ['reptile', 'swamp', 'scale'],
    data: {
      names: {
        male: {
          firstname: [
            'Ssissareth', 'Kragnor', 'Thessek', 'Vissarak',
            'Drakkor', 'Slyther', 'Nagesh', 'Serpentes'
          ],
          surname: [
            'Schuppenträger', 'Sumpfläufer', 'Kaltzahn',
            'Echsensohn', 'Reptilianer', 'Wasserwandler'
          ]
        },
        female: {
          firstname: [
            'Ssilara', 'Krasha', 'Thessara', 'Vissanya',
            'Drakkira', 'Slythia', 'Nagesha', 'Serpentia'
          ],
          surname: [
            'Schuppenträgerin', 'Sumpfläuferin', 'Kaltzahn',
            'Echsentochter', 'Reptilianerin', 'Wasserwandlerin'
          ]
        }
      }
    }
  });

  // Add taverns for Lizardfolk
  api.registerCategorizedContent('my-fantasy-races', {
    language: 'de',
    species: 'lizardfolk',
    category: 'taverns',
    displayName: 'Echsenmensch Tavernen',
    subcategories: {
      swamp_taverns: [
        'Zum Krächzenden Frosch',
        'Das Schlammige Nest',
        'Zur Warmen Sonne'
      ],
      water_taverns: [
        'Zum Gleitenden Aal',
        'Das Tropfende Blatt',
        'Zur Stillen Lagune'
      ]
    }
  });

  console.log('Fantasy races registered successfully!');
});
```

### Example 2: Regional Name Extension

Adding regional variants to existing races:

```javascript
Hooks.once('namesModuleReady', (api) => {
  // Add Nordic-inspired human names
  api.registerNameData('nordic-names', {
    language: 'de',
    species: 'human',
    category: 'names',
    displayName: 'Nordische Namen',
    data: {
      male: {
        firstname: [
          'Björn', 'Erik', 'Ragnar', 'Thorvald', 'Olaf',
          'Magnus', 'Gunnar', 'Leif', 'Ivar', 'Sigurd'
        ],
        surname: [
          'Eisenbart', 'Sturmborn', 'Wolfssohn', 'Bärenstark',
          'Frostwind', 'Steinherz', 'Donnerschlag'
        ]
      },
      female: {
        firstname: [
          'Astrid', 'Ingrid', 'Sigrid', 'Brunhild', 'Freydis',
          'Solveig', 'Thora', 'Gudrun', 'Helga', 'Ragnhild'
        ],
        surname: [
          'Eisenbart', 'Sturmborn', 'Wolfstochter', 'Bärenstark',
          'Frostwind', 'Steinherz', 'Donnerschlag'
        ]
      }
    }
  });

  // Add Mediterranean-inspired elf names
  api.registerNameData('mediterranean-elves', {
    language: 'de',
    species: 'elf',
    category: 'names',
    displayName: 'Mediterrane Elfen',
    data: {
      male: {
        firstname: [
          'Aurelius', 'Lysander', 'Theron', 'Demetrius',
          'Leander', 'Apollon', 'Cyrus', 'Orion'
        ],
        surname: [
          'Sonnenstrahl', 'Olivenhain', 'Meereswind',
          'Goldblüte', 'Weinranke', 'Marmorherz'
        ]
      },
      female: {
        firstname: [
          'Aurelia', 'Lysandra', 'Theia', 'Demetria',
          'Leandra', 'Apollonia', 'Cyra', 'Oriana'
        ],
        surname: [
          'Sonnenstrahl', 'Olivenhain', 'Meereswind',
          'Goldblüte', 'Weinranke', 'Marmorherz'
        ]
      }
    }
  });
});
```

### Example 3: Content Pack Module

Specialized content for specific themes:

```javascript
Hooks.once('namesModuleReady', (api) => {
  // Pirate-themed content for humans
  api.registerCategorizedContent('pirate-content', {
    language: 'de',
    species: 'human',
    category: 'taverns',
    displayName: 'Piraten Tavernen',
    subcategories: {
      port_taverns: [
        'Zum Verlorenen Anker',
        'Das Schwankende Deck',
        'Zur Salzigen Möwe',
        'Der Trunkene Seebär'
      ],
      island_taverns: [
        'Zur Vergrabenen Truhe',
        'Das Versteckte Nest',
        'Zum Goldenen Papagei',
        'Die Heimliche Bucht'
      ]
    }
  });

  api.registerCategorizedContent('pirate-content', {
    language: 'de',
    species: 'human',
    category: 'ships',
    displayName: 'Piratenschiffe',
    subcategories: {
      warships: [
        'Die Schwarze Perle',
        'Der Rote Korsar',
        'Die Sturmjägerin',
        'Der Eiserne Hai'
      ],
      merchant_ships: [
        'Die Goldene Galeone',
        'Der Reisende Händler',
        'Die Schnelle Jenny',
        'Der Glückliche Fund'
      ]
    }
  });

  // Magical books for elves
  api.registerCategorizedContent('magical-content', {
    language: 'de',
    species: 'elf',
    category: 'books',
    displayName: 'Elfische Zauberbücher',
    subcategories: {
      nature_magic: [
        'Die Geheimnisse des Waldes',
        'Lieder der Bäume',
        'Das Flüstern der Blätter',
        'Kraft der Naturgeister'
      ],
      elemental_magic: [
        'Beherrschung der Elemente',
        'Tanz von Feuer und Eis',
        'Windmagie für Fortgeschrittene',
        'Die Erdseele erwecken'
      ]
    }
  });
});
```

## Best Practices

### 1. Module Dependencies

Always declare Nomina Names as a dependency in your module.json:

```json
{
  "id": "my-module",
  "title": "My Custom Names",
  "dependencies": [
    {
      "name": "nomina-names",
      "type": "module",
      "manifest": "https://github.com/user/nomina-names/releases/latest/download/module.json"
    }
  ]
}
```

### 2. Error Handling

Always wrap your registration in try-catch blocks:

```javascript
Hooks.once('namesModuleReady', (api) => {
  try {
    api.registerSpecies('my-module', speciesData);
    console.log('Species registered successfully');
  } catch (error) {
    console.error('Failed to register species:', error);
  }
});
```

### 3. Naming Conventions

- Use your module ID as the first parameter in all registration calls
- Use consistent species codes (lowercase, no spaces)
- Provide meaningful display names in the target language
- Include relevant keywords for better categorization

### 4. Data Quality

- Ensure name lists have sufficient variety (minimum 5-10 names per category)
- Follow naming conventions of the target culture/species
- Test names for appropriate length and readability
- Avoid offensive or inappropriate content

### 5. Performance

- Register extensions only once during the `namesModuleReady` hook
- Don't register unnecessary empty categories
- Keep individual data arrays reasonably sized (< 100 items)

## Data Structure Reference

### Species Registration Structure

```javascript
{
  species: 'species-code',        // Required: lowercase identifier
  displayName: 'Display Name',    // Required: user-friendly name
  languages: ['de', 'en'],        // Optional: supported languages
  keywords: ['tag1', 'tag2'],     // Optional: categorization tags
  data: {                         // Required: name and content data
    names: {
      male: {
        firstname: ['Name1', 'Name2'],
        surname: ['Surname1', 'Surname2']
      },
      female: {
        firstname: ['Name1', 'Name2'],
        surname: ['Surname1', 'Surname2']
      },
      nonbinary: {                // Optional
        firstname: ['Name1', 'Name2'],
        surname: ['Surname1', 'Surname2']
      }
    }
  }
}
```

### Name Data Extension Structure

```javascript
{
  language: 'de',                 // Required: language code
  species: 'human',               // Required: existing species
  category: 'names',              // Required: 'names' for name data
  displayName: 'Custom Names',    // Optional: display name
  data: {                         // Required: same structure as species.data.names
    male: {
      firstname: ['Name1', 'Name2'],
      surname: ['Surname1', 'Surname2']
    },
    female: {
      firstname: ['Name1', 'Name2'],
      surname: ['Surname1', 'Surname2']
    }
  }
}
```

### Categorized Content Structure

```javascript
{
  language: 'de',                 // Required: language code
  species: 'human',               // Required: target species
  category: 'taverns',            // Required: content category
  displayName: 'Custom Taverns',  // Optional: display name
  subcategories: {                // Required: content organization
    subcategory1: ['Item1', 'Item2'],
    subcategory2: ['Item3', 'Item4']
  }
}
```

### Valid Categories

**Name Categories:**
- `names` - Character names (firstname/surname)

**Content Categories:**
- `taverns` - Tavern and inn names
- `shops` - Shop and store names
- `books` - Book titles and literature
- `ships` - Ship and vessel names
- `settlements` - City and town names

## Testing Your Extensions

### 1. Console Testing

Test your registrations in the Foundry console:

```javascript
// Test species registration
const api = game.modules.get('nomina-names').api;
const name = await api.randomName('your-species');
console.log('Generated name:', name);

// Test content generation
const tavern = await api.tavern('your-species');
console.log('Generated tavern:', tavern);
```

### 2. API Test Script

Use the provided test script and modify it for your extensions:

```javascript
// Add to test-api.js
const customName = await api.randomName('your-custom-species');
const customTavern = await api.tavern('your-custom-species');
console.log('Custom species name:', customName);
console.log('Custom tavern:', customTavern);
```

### 3. Generator App Testing

1. Open the Names Generator app in Foundry
2. Check if your species appears in the dropdown
3. Test generation with your custom species
4. Verify content categories are available

### 4. Error Testing

Test error conditions:

```javascript
// Test with invalid data
try {
  api.registerSpecies('test', {}); // Should fail
} catch (error) {
  console.log('Expected error:', error.message);
}
```

## Integration Examples

### Chat Command Integration

```javascript
Hooks.once('namesModuleReady', (api) => {
  // Register custom chat command
  Hooks.on('chatMessage', async (html, content, msg) => {
    if (content.startsWith('/myrace')) {
      const name = await api.randomName('my-custom-race');
      ChatMessage.create({
        content: `Random ${api.getSpeciesDisplayName('my-custom-race')}: ${name}`,
        speaker: ChatMessage.getSpeaker()
      });
      return false; // Prevent default handling
    }
  });
});
```

### Actor Name Generation

```javascript
Hooks.on('preCreateActor', async (actor, data, options, userId) => {
  if (data.type === 'character' && !data.name) {
    const api = game.modules.get('nomina-names')?.api;
    if (api) {
      const species = data.system?.species || 'human';
      data.name = await api.randomName(species);
    }
  }
});
```

---

*This guide covers advanced module extension features for Nomina Names v1.2.7+. For basic API usage, see the main API documentation.*