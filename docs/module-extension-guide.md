# Nomina Names Module Extension Guide

## Overview

This guide provides comprehensive instructions for extending the Nomina Names module with custom content and creating external modules that integrate with the Nomina Names API. Whether you're adding new species, creating themed content packs, or building complex generators, this guide will help you get started.

## Table of Contents

1. [Extension Types](#extension-types)
2. [Getting Started](#getting-started)
3. [Species Registration](#species-registration)
4. [Content Creation](#content-creation)
5. [Advanced Features](#advanced-features)
6. [Testing and Validation](#testing-and-validation)
7. [Best Practices](#best-practices)
8. [Publishing Guidelines](#publishing-guidelines)

## Extension Types

### 1. Content Extension Modules
Add new species, languages, or content categories to the base system.

**Examples:**
- Monster species (Goblin, Orc, Dragon)
- Historical cultures (Roman, Norse, Celtic)
- Sci-fi species (Android, Alien, Cyborg)
- Additional languages (French, Spanish, Italian)

### 2. Generator Modules
Build specialized generators using the Nomina Names API.

**Examples:**
- Settlement generators with complete demographics
- Adventure hook generators
- NPC personality generators
- World-building assistants

### 3. Integration Modules
Connect Nomina Names with other systems and modules.

**Examples:**
- Character sheet auto-population
- Journal entry generators
- Chat command extensions
- Macro collections

## Getting Started

### Prerequisites

1. **Foundry VTT Development Environment**
   - Foundry VTT v11 or later
   - Basic understanding of module development
   - Node.js and npm (for advanced features)

2. **Nomina Names Knowledge**
   - Familiarity with the API
   - Understanding of JSON Format 3.0.1
   - Knowledge of species registration process

### Basic Module Structure

```
my-nomina-extension/
├── module.json
├── scripts/
│   ├── main.js
│   ├── species-data.js
│   └── generators/
├── data/
│   ├── species1.json
│   ├── species2.json
│   └── index.json
├── lang/
│   ├── en.json
│   └── de.json
└── README.md
```

### Module Manifest (module.json)

```json
{
  "id": "my-nomina-extension",
  "title": "My Nomina Extension",
  "description": "Custom species and generators for Nomina Names",
  "version": "1.0.0",
  "authors": [{
    "name": "Your Name",
    "email": "your.email@example.com"
  }],
  "compatibility": {
    "minimum": "11",
    "verified": "12"
  },
  "dependencies": [{
    "id": "nomina-names",
    "type": "module",
    "compatibility": {}
  }],
  "esmodules": [
    "scripts/main.js"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ]
}
```

## Species Registration

### Method 1: JSON File Registration

Create species data files in JSON Format 3.0.1:

```javascript
// scripts/main.js
Hooks.once('nomina-names:coreLoaded', async () => {
  const api = game.modules.get('nomina-names').api;

  try {
    // Load species data from JSON file
    const response = await fetch('modules/my-nomina-extension/data/goblin.json');
    const speciesData = await response.json();

    // Register the species
    await api.registerSpecies(speciesData);

    console.log('Goblin species registered successfully');
  } catch (error) {
    console.error('Failed to register species:', error);
  }
});
```

### Method 2: Programmatic Registration

```javascript
// scripts/species-data.js
export const GOBLIN_SPECIES = {
  code: 'goblin',
  displayName: {
    en: 'Goblin',
    de: 'Goblin'
  },
  languages: ['en', 'de'],
  categories: ['names', 'settlements', 'nicknames'],
  data: {
    'en.names': {
      subcategories: [{
        key: 'firstnames',
        displayName: { en: 'First Names' },
        entries: {
          male: [
            'Grax', 'Snarl', 'Vex', 'Grimjaw', 'Skreech',
            { name: 'Bloodfang', meta: { rarity: 'uncommon', type: 'fierce' } }
          ],
          female: [
            'Vyx', 'Shiv', 'Hex', 'Razorclaw', 'Sneer',
            { name: 'Poisontooth', meta: { rarity: 'rare', type: 'cunning' } }
          ]
        }
      }, {
        key: 'surnames',
        displayName: { en: 'Clan Names' },
        entries: [
          'Skullcrusher', 'Ratbiter', 'Mudfoot', 'Ironteeth',
          { name: 'Shadowblade', meta: { rarity: 'legendary', reputation: 'feared' } }
        ]
      }]
    },
    'en.settlements': {
      subcategories: [{
        key: 'camps',
        displayName: { en: 'Camps & Lairs' },
        entries: [
          'Rotting Hollow', 'Skull Rock', 'The Bone Pit',
          { name: 'Shadowmere Depths', meta: { size: 'large', danger: 'high' } }
        ]
      }]
    }
  }
};

// scripts/main.js
import { GOBLIN_SPECIES } from './species-data.js';

Hooks.once('nomina-names:coreLoaded', async () => {
  const api = game.modules.get('nomina-names').api;

  try {
    await api.registerSpecies(GOBLIN_SPECIES);
    console.log('Goblin species registered');
  } catch (error) {
    console.error('Registration failed:', error);
  }
});
```

### Method 3: Batch Registration from JSON Files

```javascript
// Load multiple species from a directory
Hooks.once('nomina-names:coreLoaded', async () => {
  const api = game.modules.get('nomina-names').api;

  const speciesFiles = [
    'goblin.json',
    'orc.json',
    'troll.json',
    'kobold.json'
  ];

  for (const filename of speciesFiles) {
    try {
      const response = await fetch(`modules/my-nomina-extension/data/${filename}`);
      const speciesData = await response.json();

      await api.registerSpecies(speciesData);
      console.log(`Registered species from ${filename}`);
    } catch (error) {
      console.error(`Failed to register ${filename}:`, error);
    }
  }
});
```

## Content Creation

### Creating Quality Content

#### 1. Research and Planning

```javascript
// Example: Creating Orcish names based on linguistic patterns
const ORCISH_LINGUISTICS = {
  // Common syllables and patterns
  maleStarts: ['Grax', 'Thok', 'Murg', 'Skar', 'Drak'],
  maleEnds: ['ul', 'ak', 'og', 'ur', 'ash'],

  femaleStarts: ['Yaz', 'Shak', 'Mex', 'Vor', 'Lash'],
  femaleEnds: ['a', 'ia', 'ul', 'ek', 'ath'],

  // Cultural elements
  clanWords: ['blood', 'iron', 'bone', 'skull', 'fang'],
  honorifics: ['the Mighty', 'Skullcrusher', 'Ironjaw']
};

function generateOrcishNames() {
  // Use linguistic patterns to create authentic-sounding names
  // This helps ensure consistency and immersion
}
```

#### 2. Cultural Consistency

```json
{
  "format": "3.0.1",
  "code": "viking",
  "displayName": {
    "en": "Viking"
  },
  "languages": ["en"],
  "categories": ["names", "settlements", "ships"],
  "data": {
    "en.names": {
      "subcategories": [{
        "key": "firstnames",
        "displayName": { "en": "Given Names" },
        "entries": {
          "male": [
            "Ragnar", "Bjorn", "Erik", "Olaf", "Magnus",
            { "name": "Thorvald", "meta": { "meaning": "Thor's ruler", "rarity": "uncommon" } }
          ],
          "female": [
            "Astrid", "Ingrid", "Sigrid", "Freydis", "Helga",
            { "name": "Brunhilde", "meta": { "meaning": "armor battle", "rarity": "rare" } }
          ]
        }
      }]
    },
    "en.settlements": {
      "subcategories": [{
        "key": "villages",
        "displayName": { "en": "Villages" },
        "entries": [
          "Ironholm", "Ravensfjord", "Wolfsburg", "Dragonhaven",
          { "name": "Valhalla's Gate", "meta": { "significance": "sacred", "size": "large" } }
        ]
      }]
    }
  }
}
```

#### 3. Metadata Usage for Rich Content

```json
{
  "entries": {
    "en": [
      {
        "name": "The Kraken's Rest",
        "meta": {
          "type": "tavern",
          "quality": "poor",
          "atmosphere": "dangerous",
          "clientele": "pirates",
          "location": "harbor",
          "reputation": "questionable",
          "specialties": ["grog", "sea_shanties", "illegal_goods"],
          "rumors": ["hidden_treasure", "cursed_captain"]
        }
      },
      {
        "name": "The Golden Anchor",
        "meta": {
          "type": "inn",
          "quality": "excellent",
          "atmosphere": "elegant",
          "clientele": "merchants",
          "location": "harbor",
          "reputation": "renowned",
          "services": ["luxury_rooms", "fine_dining", "secure_storage"]
        }
      }
    ]
  }
}
```

### Advanced Content Features

#### 1. Dynamic Content Generation

```javascript
class DynamicSpeciesGenerator {
  constructor(api) {
    this.api = api;
    this.templates = new Map();
  }

  // Create procedural species based on templates
  async generateHybridSpecies(parent1, parent2) {
    const species1Data = await this.getSpeciesData(parent1);
    const species2Data = await this.getSpeciesData(parent2);

    const hybridSpecies = {
      code: `${parent1}_${parent2}`,
      displayName: {
        en: `${parent1.charAt(0).toUpperCase() + parent1.slice(1)}-${parent2}`
      },
      languages: ['en'],
      categories: ['names'],
      data: this.mergeSpeciesData(species1Data, species2Data)
    };

    await this.api.registerSpecies(hybridSpecies);
    return hybridSpecies;
  }

  mergeSpeciesData(data1, data2) {
    // Combine names from both species
    // Apply transformation rules
    // Return merged data structure
  }
}
```

#### 2. Conditional Content

```javascript
// Register content based on other modules or settings
Hooks.once('nomina-names:coreLoaded', async () => {
  const api = game.modules.get('nomina-names').api;

  // Check for other modules
  if (game.modules.get('pf2e-bestiary')?.active) {
    await registerPF2ESpecies(api);
  }

  if (game.modules.get('dnd5e-monsters')?.active) {
    await registerD5ESpecies(api);
  }

  // Check world settings
  const worldType = game.settings.get('core', 'worldType');
  if (worldType === 'sci-fi') {
    await registerSciFiSpecies(api);
  }
});
```

## Advanced Features

### Custom Generators

```javascript
// Advanced settlement generator with economic simulation
class EconomicSettlementGenerator {
  constructor() {
    this.api = game.modules.get('nomina-names').api;
    this.economicModels = {
      agricultural: {
        primaryIndustries: ['farming', 'livestock'],
        commonBuildings: ['granary', 'mill', 'stable'],
        tradeGoods: ['grain', 'meat', 'wool']
      },
      maritime: {
        primaryIndustries: ['fishing', 'shipbuilding', 'trade'],
        commonBuildings: ['harbor', 'shipyard', 'lighthouse'],
        tradeGoods: ['fish', 'ships', 'exotic_goods']
      }
    };
  }

  async generateSettlement(options = {}) {
    const {
      species = 'human',
      economicModel = 'agricultural',
      size = 'village',
      language = 'en'
    } = options;

    const model = this.economicModels[economicModel];
    const settlement = {
      name: await this.api.generateName({
        species,
        category: 'settlements',
        language
      }),
      species,
      size,
      economicModel,
      population: this.calculatePopulation(size),
      industries: model.primaryIndustries,
      buildings: await this.generateBuildings(species, model, language),
      npcs: await this.generateNPCs(species, model, language),
      tradeGoods: model.tradeGoods
    };

    return settlement;
  }

  async generateBuildings(species, model, language) {
    const buildings = {};

    for (const buildingType of model.commonBuildings) {
      buildings[buildingType] = await this.api.generateName({
        species,
        category: 'shops', // or appropriate category
        subcategory: buildingType,
        language
      });
    }

    return buildings;
  }
}
```

### Integration with Other Systems

```javascript
// Integration with D&D 5e character creation
Hooks.on('dnd5e.preCreateActor', async (actor, data, options, userId) => {
  if (actor.type !== 'character') return;

  const api = game.modules.get('nomina-names')?.api;
  if (!api) return;

  try {
    // Get race from character data
    const race = data.system?.details?.race?.value?.toLowerCase() || 'human';

    // Map D&D races to Nomina species
    const speciesMapping = {
      'human': 'human',
      'elf': 'elf',
      'dwarf': 'dwarf',
      'halfling': 'halfling',
      'dragonborn': 'dragonborn',
      'tiefling': 'tiefling'
    };

    const species = speciesMapping[race] || 'human';

    // Generate name if not provided
    if (!data.name || data.name === 'New Actor') {
      const gender = data.system?.details?.gender || 'random';
      const generatedName = await api.randomName(species, gender, 'en');

      foundry.utils.setProperty(data, 'name', generatedName);
    }

    // Generate background elements
    const hometown = await api.settlement(species, 'en');
    foundry.utils.setProperty(data, 'system.details.hometown', hometown);

  } catch (error) {
    console.error('Failed to generate character details:', error);
  }
});
```

### Custom UI Components

```javascript
// Custom application for species management
class SpeciesManagerApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'species-manager',
      title: 'Species Manager',
      template: 'modules/my-extension/templates/species-manager.hbs',
      width: 600,
      height: 400,
      tabs: [
        { navSelector: '.tabs', contentSelector: '.content', initial: 'species' }
      ]
    });
  }

  async getData() {
    const api = game.modules.get('nomina-names').api;

    return {
      availableSpecies: api.getAllSpeciesCodes(),
      registeredSpecies: this.getRegisteredSpecies(),
      canManage: game.user.isGM
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('.register-species').click(this._onRegisterSpecies.bind(this));
    html.find('.unregister-species').click(this._onUnregisterSpecies.bind(this));
    html.find('.test-species').click(this._onTestSpecies.bind(this));
  }

  async _onRegisterSpecies(event) {
    const speciesCode = event.target.dataset.species;
    // Handle species registration
  }
}
```

## Testing and Validation

### Automated Testing

```javascript
// Test suite for your extension
class ExtensionTester {
  constructor() {
    this.api = game.modules.get('nomina-names').api;
    this.results = [];
  }

  async runAllTests() {
    console.log('Starting extension tests...');

    await this.testSpeciesRegistration();
    await this.testNameGeneration();
    await this.testMetadataFiltering();
    await this.testErrorHandling();

    this.printResults();
  }

  async testSpeciesRegistration() {
    try {
      // Test species registration
      await this.api.registerSpecies(TEST_SPECIES);

      // Verify species is available
      const species = this.api.getAllSpeciesCodes();
      const isRegistered = species.includes(TEST_SPECIES.code);

      this.results.push({
        test: 'Species Registration',
        passed: isRegistered,
        message: isRegistered ? 'Species registered successfully' : 'Species not found after registration'
      });
    } catch (error) {
      this.results.push({
        test: 'Species Registration',
        passed: false,
        message: `Registration failed: ${error.message}`
      });
    }
  }

  async testNameGeneration() {
    try {
      const name = await this.api.generateName({
        species: TEST_SPECIES.code,
        gender: 'male',
        language: 'en'
      });

      this.results.push({
        test: 'Name Generation',
        passed: typeof name === 'string' && name.length > 0,
        message: `Generated name: ${name}`
      });
    } catch (error) {
      this.results.push({
        test: 'Name Generation',
        passed: false,
        message: `Generation failed: ${error.message}`
      });
    }
  }

  printResults() {
    console.log('=== Extension Test Results ===');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.message}`);
    });
  }
}

// Run tests when ready
Hooks.once('ready', () => {
  if (game.user.isGM && game.modules.get('my-nomina-extension')?.active) {
    const tester = new ExtensionTester();
    tester.runAllTests();
  }
});
```

### Manual Validation

```javascript
// Developer utilities for manual testing
window.NominaExtensionUtils = {
  // Test species registration
  async testSpecies(speciesCode) {
    const api = game.modules.get('nomina-names').api;

    console.log(`Testing species: ${speciesCode}`);

    // Test name generation
    const maleName = await api.generateName({ species: speciesCode, gender: 'male' });
    const femaleName = await api.generateName({ species: speciesCode, gender: 'female' });

    console.log(`Male name: ${maleName}`);
    console.log(`Female name: ${femaleName}`);

    // Test other categories if available
    try {
      const settlement = await api.generateName({ species: speciesCode, category: 'settlements' });
      console.log(`Settlement: ${settlement}`);
    } catch (error) {
      console.log('No settlement data available');
    }
  },

  // Generate sample content for review
  async generateSamples(speciesCode, count = 5) {
    const api = game.modules.get('nomina-names').api;

    const samples = {
      maleNames: await api.generateNames({ species: speciesCode, gender: 'male', count }),
      femaleNames: await api.generateNames({ species: speciesCode, gender: 'female', count }),
    };

    console.table(samples);
    return samples;
  }
};
```

## Best Practices

### 1. Code Organization

```javascript
// Good: Modular structure
// scripts/species/goblin.js
export const GoblinSpecies = { /* ... */ };

// scripts/species/orc.js
export const OrcSpecies = { /* ... */ };

// scripts/main.js
import { GoblinSpecies } from './species/goblin.js';
import { OrcSpecies } from './species/orc.js';

// Bad: Everything in main.js
// This makes maintenance difficult
```

### 2. Error Handling

```javascript
// Good: Comprehensive error handling
async function registerSpecies(speciesData) {
  try {
    // Validate data first
    if (!speciesData.code) {
      throw new Error('Species code is required');
    }

    // Check for conflicts
    const existingSpecies = api.getAllSpeciesCodes();
    if (existingSpecies.includes(speciesData.code)) {
      console.warn(`Species ${speciesData.code} already exists, skipping`);
      return;
    }

    await api.registerSpecies(speciesData);
    console.log(`Successfully registered ${speciesData.code}`);

  } catch (error) {
    console.error(`Failed to register ${speciesData.code}:`, error);
    ui.notifications.error(`Species registration failed: ${error.message}`);
  }
}
```

### 3. Performance Considerations

```javascript
// Good: Lazy loading
const speciesCache = new Map();

async function getSpeciesData(code) {
  if (speciesCache.has(code)) {
    return speciesCache.get(code);
  }

  const response = await fetch(`modules/my-extension/data/${code}.json`);
  const data = await response.json();
  speciesCache.set(code, data);

  return data;
}

// Good: Batch operations
async function registerAllSpecies() {
  const registrationPromises = SPECIES_LIST.map(species =>
    api.registerSpecies(species)
  );

  await Promise.all(registrationPromises);
}
```

### 4. User Experience

```javascript
// Provide feedback during long operations
async function registerSpeciesWithFeedback(speciesData) {
  ui.notifications.info(`Registering ${speciesData.displayName.en}...`);

  try {
    await api.registerSpecies(speciesData);
    ui.notifications.info(`${speciesData.displayName.en} registered successfully!`);
  } catch (error) {
    ui.notifications.error(`Failed to register ${speciesData.displayName.en}: ${error.message}`);
  }
}

// Allow users to disable features
Hooks.once('init', () => {
  game.settings.register('my-extension', 'enableAutoGeneration', {
    name: 'Enable Automatic Name Generation',
    hint: 'Automatically generate names for new characters',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
});
```

## Publishing Guidelines

### 1. Documentation

Create comprehensive documentation:

```markdown
# My Nomina Extension

## Features
- Adds 5 new monster species (Goblin, Orc, Troll, Kobold, Ogre)
- Over 500 unique names per species
- Metadata support for enhanced generation
- Custom settlement generator

## Installation
1. Install the Nomina Names module
2. Install this extension
3. Restart Foundry VTT

## Usage
The new species will automatically be available in the Nomina Names interface.

## API Usage
```javascript
// Generate goblin names
const goblinName = await game.modules.get('nomina-names').api.randomName('goblin');

// Generate orc settlement
const orcSettlement = await game.modules.get('nomina-names').api.settlement('orc');
```

## Changelog
### v1.0.0
- Initial release
```

### 2. Manifest Requirements

```json
{
  "relationships": {
    "requires": [{
      "id": "nomina-names",
      "type": "module",
      "compatibility": {
        "minimum": "1.2.0"
      }
    }]
  },
  "bugs": "https://github.com/username/my-extension/issues",
  "changelog": "https://github.com/username/my-extension/blob/main/CHANGELOG.md",
  "readme": "https://github.com/username/my-extension/blob/main/README.md"
}
```

### 3. Quality Checklist

- [ ] All species have consistent naming conventions
- [ ] Content is culturally appropriate and well-researched
- [ ] Metadata is meaningful and consistent
- [ ] Error handling is comprehensive
- [ ] Documentation is complete and accurate
- [ ] Testing has been performed
- [ ] Performance impact is minimal
- [ ] Compatible with latest Nomina Names version

---

*This guide provides the foundation for creating high-quality extensions to the Nomina Names module. Remember to test thoroughly and provide good documentation for your users.*