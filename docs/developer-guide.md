# Nomina Names - Developer Integration Guide

This guide shows practical examples of how to integrate the Nomina Names API into your Foundry VTT modules.

## Quick Setup

### Basic Integration

```javascript
// module.js
Hooks.once('ready', async () => {
  // Check if Nomina Names is available
  const nominaNames = game.modules.get('nomina-names');
  if (!nominaNames?.active) {
    console.warn('MyModule: Nomina Names not available');
    return;
  }

  // Store API reference for easy access
  window.MyModule = window.MyModule || {};
  window.MyModule.names = nominaNames.api;

  console.log('MyModule: Nomina Names integration ready');
});
```

### Helper Function

```javascript
// Create a safe wrapper function
async function generateName(type = 'human', gender = 'random') {
  const api = game.modules.get('nomina-names')?.api;
  if (!api) {
    return 'Unknown'; // Fallback
  }

  try {
    return await api.randomName(type, gender);
  } catch (error) {
    console.warn('Name generation failed:', error);
    return 'Unknown';
  }
}

// Usage
const npcName = await generateName('elf', 'female');
```

## Common Use Cases

### 1. Random NPC Generator

```javascript
class NPCGenerator {
  static async generateRandomNPC() {
    const api = game.modules.get('nomina-names')?.api;
    if (!api) return null;

    const species = ['human', 'elf', 'dwarf', 'halfling'];
    const randomSpecies = species[Math.floor(Math.random() * species.length)];

    const npc = await api.quickNPC(randomSpecies, 'random');

    // Add additional properties
    npc.level = Math.floor(Math.random() * 10) + 1;
    npc.profession = this.randomProfession();

    return npc;
  }

  static randomProfession() {
    const professions = ['Warrior', 'Mage', 'Thief', 'Cleric', 'Merchant'];
    return professions[Math.floor(Math.random() * professions.length)];
  }
}

// Usage
const npc = await NPCGenerator.generateRandomNPC();
console.log(npc);
// {
//   name: "Thorin Steinhammer",
//   species: "dwarf",
//   gender: "male",
//   firstName: "Thorin",
//   lastName: "Steinhammer",
//   level: 5,
//   profession: "Warrior"
// }
```

### 2. Settlement Generator Module

```javascript
class SettlementGenerator {
  static async generateSettlement(options = {}) {
    const {
      species = 'human',
      size = 'medium',
      language = 'auto'
    } = options;

    const api = game.modules.get('nomina-names')?.api;
    if (!api) return null;

    const settlement = {
      name: await api.settlement(species, language),
      species: species,
      size: size,
      population: this.getPopulation(size),
      establishments: {},
      npcs: {}
    };

    // Generate establishments
    settlement.establishments.tavern = await api.tavern(species, language);
    settlement.establishments.shop = await api.shop(species, language);

    // Generate key NPCs
    settlement.npcs.mayor = await api.randomName(species, 'random', language);
    settlement.npcs.guard_captain = await api.randomName(species, 'random', language);
    settlement.npcs.merchant = await api.randomName(species, 'random', language);

    // Generate random population
    const npcCount = Math.floor(settlement.population / 10);
    settlement.residents = await api.multipleNames(npcCount, species, 'mixed', language);

    return settlement;
  }

  static getPopulation(size) {
    switch (size) {
      case 'small': return Math.floor(Math.random() * 100) + 50;
      case 'medium': return Math.floor(Math.random() * 500) + 200;
      case 'large': return Math.floor(Math.random() * 2000) + 1000;
      default: return 300;
    }
  }
}

// Usage
const settlement = await SettlementGenerator.generateSettlement({
  species: 'elf',
  size: 'large'
});
```

### 3. Adventure Hook Generator

```javascript
class AdventureHookGenerator {
  static async generateHook() {
    const api = game.modules.get('nomina-names')?.api;
    if (!api) return null;

    const templates = [
      'The {patron} {patronName} seeks adventurers to retrieve {item} from {location}.',
      'Strange disappearances in {settlement} lead to {villain} {villainName}.',
      'The {establishment} is haunted by the spirit of {npcName}.'
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];

    const data = {
      patron: this.randomPatronType(),
      patronName: await api.randomName('human', 'random'),
      item: await api.book(), // Creative use of book names as artifacts
      location: await api.settlement('elf'), // Mysterious elven location
      settlement: await api.settlement('human'),
      villain: this.randomVillainType(),
      villainName: await api.randomName('orc', 'random'),
      establishment: await api.tavern(),
      npcName: await api.randomName('human', 'random')
    };

    return this.fillTemplate(template, data);
  }

  static randomPatronType() {
    return ['noble', 'merchant', 'scholar', 'priest'][Math.floor(Math.random() * 4)];
  }

  static randomVillainType() {
    return ['bandit leader', 'dark wizard', 'cult leader', 'monster'][Math.floor(Math.random() * 4)];
  }

  static fillTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }
}

// Usage
const hook = await AdventureHookGenerator.generateHook();
console.log(hook);
// "The noble Johann Müller seeks adventurers to retrieve Das Buch der Geheimnisse from Rivendell."
```

### 4. Name Database for Character Creation

```javascript
class CharacterNameHelper {
  constructor() {
    this.nameCache = new Map();
    this.api = game.modules.get('nomina-names')?.api;
  }

  async getNameSuggestions(species, gender, count = 5) {
    const cacheKey = `${species}-${gender}-${count}`;

    if (this.nameCache.has(cacheKey)) {
      return this.nameCache.get(cacheKey);
    }

    if (!this.api) return [];

    const suggestions = await this.api.multipleNames(count, species, gender);
    this.nameCache.set(cacheKey, suggestions);

    return suggestions;
  }

  async getNameComponents(species, gender) {
    if (!this.api) return { firstNames: [], surnames: [] };

    const firstNames = await Promise.all([
      this.api.firstName(species, gender),
      this.api.firstName(species, gender),
      this.api.firstName(species, gender)
    ]);

    const surnames = await Promise.all([
      this.api.surname(species),
      this.api.surname(species),
      this.api.surname(species)
    ]);

    return { firstNames, surnames };
  }

  clearCache() {
    this.nameCache.clear();
  }
}

// Integration with character sheet
Hooks.on('renderActorSheet', async (app, html) => {
  if (app.actor.type !== 'character') return;

  const nameHelper = new CharacterNameHelper();
  const species = app.actor.system.details?.race?.value || 'human';
  const gender = app.actor.system.details?.gender || 'random';

  const suggestions = await nameHelper.getNameSuggestions(species, gender, 3);

  // Add suggestion buttons to character sheet
  const nameField = html.find('input[name="name"]');
  if (nameField.length) {
    const suggestionsDiv = $(`
      <div class="name-suggestions">
        <small>Suggestions: ${suggestions.map(name =>
          `<a href="#" class="name-suggestion">${name}</a>`
        ).join(' | ')}</small>
      </div>
    `);

    nameField.after(suggestionsDiv);

    suggestionsDiv.find('.name-suggestion').click((e) => {
      e.preventDefault();
      nameField.val($(e.target).text());
    });
  }
});
```

### 5. Chat Command Integration

```javascript
// Add custom chat commands
Hooks.on('chatMessage', async (chatLog, message, chatData) => {
  const api = game.modules.get('nomina-names')?.api;
  if (!api) return;

  // /npc command
  if (message.startsWith('/npc')) {
    const args = message.split(' ').slice(1);
    const species = args[0] || 'human';
    const gender = args[1] || 'random';

    const npc = await api.quickNPC(species, gender);

    const content = `
      <div class="generated-npc">
        <h3>${npc.name}</h3>
        <p><strong>Species:</strong> ${npc.species}</p>
        <p><strong>Gender:</strong> ${npc.gender}</p>
      </div>
    `;

    ChatMessage.create({
      content: content,
      speaker: { alias: "NPC Generator" }
    });

    return false; // Prevent normal chat processing
  }

  // /settlement command
  if (message.startsWith('/settlement')) {
    const args = message.split(' ').slice(1);
    const species = args[0] || 'human';

    const settlement = await SettlementGenerator.generateSettlement({ species });

    const content = `
      <div class="generated-settlement">
        <h3>${settlement.name}</h3>
        <p><strong>Population:</strong> ${settlement.population}</p>
        <p><strong>Tavern:</strong> ${settlement.establishments.tavern}</p>
        <p><strong>Shop:</strong> ${settlement.establishments.shop}</p>
        <p><strong>Mayor:</strong> ${settlement.npcs.mayor}</p>
      </div>
    `;

    ChatMessage.create({
      content: content,
      speaker: { alias: "Settlement Generator" }
    });

    return false;
  }
});
```

### 6. World Building Assistant

```javascript
class WorldBuilder {
  static async generateRegion(options = {}) {
    const api = game.modules.get('nomina-names')?.api;
    if (!api) return null;

    const {
      settlements = 3,
      species = ['human', 'elf', 'dwarf'],
      language = 'auto'
    } = options;

    const region = {
      name: await api.settlement('elf', language), // Elven name for region
      settlements: [],
      landmarks: [],
      books: [],
      threats: []
    };

    // Generate settlements
    for (let i = 0; i < settlements; i++) {
      const settlementSpecies = species[Math.floor(Math.random() * species.length)];
      const settlement = await SettlementGenerator.generateSettlement({
        species: settlementSpecies,
        language
      });
      region.settlements.push(settlement);
    }

    // Generate landmarks
    region.landmarks = await api.multipleNames(3, 'elf', 'random', language);

    // Generate lore books
    region.books = await Promise.all([
      api.book('human', language),
      api.book('elf', language),
      api.book('dwarf', language)
    ]);

    // Generate threats/villains
    region.threats = await api.multipleNames(2, 'orc', 'random', language);

    return region;
  }

  static async exportToJournal(region) {
    if (!region) return;

    const content = `
      <h1>${region.name}</h1>

      <h2>Settlements</h2>
      ${region.settlements.map(s => `
        <h3>${s.name}</h3>
        <p>Population: ${s.population} ${s.species}s</p>
        <p>Notable locations: ${s.establishments.tavern}, ${s.establishments.shop}</p>
        <p>Key figures: ${s.npcs.mayor} (Mayor), ${s.npcs.guard_captain} (Guard Captain)</p>
      `).join('')}

      <h2>Landmarks</h2>
      <ul>${region.landmarks.map(l => `<li>${l}</li>`).join('')}</ul>

      <h2>Ancient Texts</h2>
      <ul>${region.books.map(b => `<li>${b}</li>`).join('')}</ul>

      <h2>Known Threats</h2>
      <ul>${region.threats.map(t => `<li>${t}</li>`).join('')}</ul>
    `;

    await JournalEntry.create({
      name: `Region: ${region.name}`,
      content: content,
      folder: null
    });
  }
}

// Usage
const region = await WorldBuilder.generateRegion({
  settlements: 5,
  species: ['human', 'elf', 'dwarf', 'halfling']
});

await WorldBuilder.exportToJournal(region);
```

## Performance Tips

### 1. Caching Strategy

```javascript
class NameCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  async getName(key, generator) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const name = await generator();

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, name);
    return name;
  }
}

const nameCache = new NameCache();

// Usage
const name = await nameCache.getName('elf-female', () =>
  api.randomName('elf', 'female')
);
```

### 2. Batch Processing

```javascript
// Good: Batch generation
async function generatePartyNames(size = 4) {
  const api = game.modules.get('nomina-names')?.api;
  return await api.multipleNames(size, 'human', 'mixed');
}

// Less efficient: Individual calls
async function generatePartyNamesSlowly(size = 4) {
  const api = game.modules.get('nomina-names')?.api;
  const names = [];
  for (let i = 0; i < size; i++) {
    names.push(await api.randomName('human', 'random'));
  }
  return names;
}
```

### 3. Preloading

```javascript
class PreloadedNames {
  constructor() {
    this.pools = new Map();
    this.api = game.modules.get('nomina-names')?.api;
  }

  async preload(species, gender, count = 20) {
    if (!this.api) return;

    const key = `${species}-${gender}`;
    const names = await this.api.multipleNames(count, species, gender);
    this.pools.set(key, names);
  }

  getName(species, gender) {
    const key = `${species}-${gender}`;
    const pool = this.pools.get(key);

    if (!pool || pool.length === 0) {
      return null; // Need to preload or generate
    }

    return pool.pop(); // Remove and return name
  }

  async ensureName(species, gender) {
    let name = this.getName(species, gender);

    if (!name) {
      await this.preload(species, gender);
      name = this.getName(species, gender);
    }

    return name || 'Unknown';
  }
}

// Initialize in ready hook
Hooks.once('ready', async () => {
  window.namePool = new PreloadedNames();

  // Preload common combinations
  await namePool.preload('human', 'male');
  await namePool.preload('human', 'female');
  await namePool.preload('elf', 'mixed');
});
```

## Error Handling Best Practices

### Graceful Degradation

```javascript
class SafeNameGenerator {
  constructor() {
    this.api = game.modules.get('nomina-names')?.api;
    this.fallbacks = {
      human: { male: 'John', female: 'Jane' },
      elf: { male: 'Legolas', female: 'Galadriel' },
      dwarf: { male: 'Thorin', female: 'Dain' }
    };
  }

  async generateName(species = 'human', gender = 'male') {
    // Try API first
    if (this.api) {
      try {
        return await this.api.randomName(species, gender);
      } catch (error) {
        console.warn('API generation failed:', error);
      }
    }

    // Fallback to static names
    const speciesFallback = this.fallbacks[species] || this.fallbacks.human;
    const genderFallback = speciesFallback[gender] || speciesFallback.male;

    return genderFallback + ' ' + this.randomSurname();
  }

  randomSurname() {
    const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
    return surnames[Math.floor(Math.random() * surnames.length)];
  }
}
```

### User Feedback

```javascript
async function generateWithFeedback(species, gender) {
  try {
    ui.notifications.info('Generating name...');

    const name = await api.randomName(species, gender);

    ui.notifications.info(`Generated: ${name}`);
    return name;

  } catch (error) {
    console.error('Name generation failed:', error);
    ui.notifications.error('Failed to generate name. Using fallback.');
    return 'Unknown Adventurer';
  }
}
```

## Testing Your Integration

```javascript
// Test function to verify integration
async function testNominaIntegration() {
  console.log('Testing Nomina Names integration...');

  const api = game.modules.get('nomina-names')?.api;

  if (!api) {
    console.error('❌ API not available');
    return false;
  }

  try {
    // Test basic name generation
    const name = await api.randomName();
    console.log('✅ Basic name:', name);

    // Test species
    const elfName = await api.randomName('elf');
    console.log('✅ Elf name:', elfName);

    // Test content generation
    const tavern = await api.tavern();
    console.log('✅ Tavern:', tavern);

    // Test batch generation
    const names = await api.multipleNames(3);
    console.log('✅ Multiple names:', names);

    console.log('✅ All tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test
testNominaIntegration();
```

---

This guide provides practical examples for integrating the Nomina Names API into your modules. Remember to always check for module availability and provide fallbacks for a robust user experience.