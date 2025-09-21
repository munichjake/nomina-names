# Nomina Names - API Documentation

The Nomina Names module provides a comprehensive API for generating fantasy names, settlements, and other content for your Foundry VTT campaigns. This documentation covers both the simple convenience functions and the advanced features.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Convenience Functions](#convenience-functions)
3. [Advanced API](#advanced-api)
4. [Integration Guide](#integration-guide)
5. [Examples](#examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Quick Start

```javascript
// Access the API
const api = game.modules.get('nomina-names').api;

// Generate a random name
const name = await api.randomName();
console.log(name); // "Johann Müller"

// Generate specific content
const elfName = await api.randomName('elf', 'female');
const tavernName = await api.tavern();
const npc = await api.quickNPC('halfling');
```

## Convenience Functions

These functions provide easy access to the most common use cases with minimal configuration.

### Name Generation

#### `randomName(species, gender, language)`

Generates a complete name (firstname + surname) with smart defaults.

```javascript
// Basic usage
await api.randomName();                     // Random human name
await api.randomName('elf');                // Random elf name
await api.randomName('dwarf', 'female');    // Female dwarf name
await api.randomName('human', 'random', 'en'); // English human name
```

**Parameters:**
- `species` (string, optional): Species type
  - Default: `'human'`
  - Options: `'human'`, `'elf'`, `'dwarf'`, `'halfling'`, `'orc'`, `'goblin'`, `'dragonborn'`, `'tiefling'`, `'aasimar'`, `'gnome'`
- `gender` (string, optional): Gender preference
  - Default: `'random'`
  - Options: `'male'`, `'female'`, `'nonbinary'`, `'random'`
- `language` (string, optional): Language/culture
  - Default: `'auto'` (uses Foundry language setting)
  - Options: `'de'`, `'en'`, `'fr'`, `'es'`, `'it'`, `'auto'`

**Returns:** `Promise<string>` - Complete name

#### `firstName(species, gender, language)`

Generates only a first name.

```javascript
await api.firstName();                    // "Johann"
await api.firstName('elf', 'female');     // "Galadriel"
await api.firstName('dwarf', 'male', 'en'); // "Thorin"
```

**Parameters:** Same as `randomName()`
**Returns:** `Promise<string>` - First name only

#### `surname(species, language)`

Generates only a surname/family name.

```javascript
await api.surname();            // "Müller"
await api.surname('dwarf');     // "Steinhammer"
await api.surname('elf', 'en'); // "Starweaver"
```

**Parameters:**
- `species` (string, optional): Species type (default: `'human'`)
- `language` (string, optional): Language (default: `'auto'`)

**Returns:** `Promise<string>` - Surname only

### Content Generation

#### `settlement(species, language)`

Generates a settlement/city name.

```javascript
await api.settlement();         // "Goldental"
await api.settlement('elf');    // "Rivendell"
await api.settlement('dwarf');  // "Eisenfeste"
```

#### `tavern(species, language)`

Generates a tavern/inn name.

```javascript
await api.tavern();           // "Zur Goldenen Krone"
await api.tavern('halfling'); // "Zum Grünen Drachen"
```

#### `shop(species, language)`

Generates a shop/store name.

```javascript
await api.shop();          // "Meister Schmidts Werkstatt"
await api.shop('elf');     // "Mondschein Alchemie"
```

#### `book(species, language)`

Generates a book title.

```javascript
await api.book();        // "Das Buch der Geheimnisse"
await api.book('dwarf'); // "Chroniken der Tiefenberge"
```

### Advanced Convenience Functions

#### `multipleNames(count, species, gender, language)`

Generates multiple names at once.

```javascript
// 5 random human names
const names = await api.multipleNames(5);
// ["Johann Müller", "Anna Weber", "Klaus Schmidt", ...]

// Mixed genders for variety
const party = await api.multipleNames(4, 'elf', 'mixed');
// ["Legolas Waldläufer", "Galadriel Mondschein", ...]

// Specific configuration
const dwarfWarriors = await api.multipleNames(3, 'dwarf', 'male', 'de');
```

**Parameters:**
- `count` (number): Number of names to generate (default: 5)
- `species` (string, optional): Species (default: `'human'`)
- `gender` (string, optional): Gender or `'mixed'` for variety (default: `'random'`)
- `language` (string, optional): Language (default: `'auto'`)

**Returns:** `Promise<Array<string>>` - Array of names

#### `quickNPC(species, gender, language)`

Generates a complete NPC with additional metadata.

```javascript
const npc = await api.quickNPC('halfling', 'female');
console.log(npc);
// {
//   name: "Rosie Beutlin",
//   species: "halfling",
//   gender: "female",
//   fullName: "Rosie Beutlin",
//   firstName: "Rosie",
//   lastName: "Beutlin"
// }
```

**Returns:** `Promise<Object>` - NPC object with:
- `name`: Full name
- `species`: Species type
- `gender`: Gender
- `fullName`: Same as name
- `firstName`: First name component
- `lastName`: Last name component

## Advanced API

For complex use cases requiring fine-grained control, the full API provides extensive customization options.

### `generateName(options)`

The core generation function with full configuration options.

```javascript
const name = await api.generateName({
  language: 'de',
  species: 'elf',
  gender: 'female',
  category: 'names',
  components: ['firstname', 'surname'],
  format: '{firstname} {surname}',
  useCustomData: true
});
```

**Options Object:**
- `language` (string): Language code
- `species` (string): Species identifier
- `gender` (string): Gender identifier
- `category` (string): Content category
- `subcategory` (string, optional): Subcategory for categorized content
- `components` (Array<string>): Name components to include
- `format` (string): Format template with placeholders
- `useCustomData` (boolean): Include custom data sources

### Categorized Content Generation

#### `generateCategorizedContent(options)`

Generates content from categorized data (books, shops, taverns, ships).

```javascript
const bookTitle = await api.generateCategorizedContent({
  language: 'de',
  species: 'human',
  category: 'books',
  subcategory: 'magic_books' // optional
});
```

### Data Access Functions

#### `getAvailableLanguages()`

Returns all available languages.

```javascript
const languages = api.getAvailableLanguages();
// ['de', 'en', 'fr', 'es', 'it']
```

#### `getAvailableSpecies()`

Returns all available species.

```javascript
const species = api.getAvailableSpecies();
// ['human', 'elf', 'dwarf', 'halfling', ...]
```

#### `getAvailableSubcategories(language, species, category)`

Returns available subcategories for specific content.

```javascript
const subcategories = await api.getAvailableSubcategories('de', 'human', 'books');
// ['religious_books', 'novels', 'scientific_treatises', ...]
```

### Hook System

The API provides hooks for extending functionality.

#### `registerHook(hookName, callback)`

Register custom hooks.

```javascript
api.registerHook('names.beforeGenerate', (data) => {
  console.log('About to generate:', data.options);
});

api.registerHook('names.afterGenerate', (data) => {
  console.log('Generated:', data.result);
});
```

Available hooks:
- `names.beforeGenerate`: Called before name generation
- `names.afterGenerate`: Called after successful generation
- `names.dataLoaded`: Called when data loading completes

## Integration Guide

### Basic Module Integration

```javascript
// In your module's init hook
Hooks.once('ready', async () => {
  // Check if Nomina Names is available
  if (!game.modules.get('nomina-names')?.active) {
    console.warn('Nomina Names module not available');
    return;
  }

  const api = game.modules.get('nomina-names').api;

  // Use the API
  const npcName = await api.randomName('elf', 'female');
  console.log('Generated NPC:', npcName);
});
```

### Advanced Integration with Custom Data

```javascript
// Register custom data source
api.registerCustomDataSource('my-module', {
  'custom.species.male': ['CustomName1', 'CustomName2'],
  'custom.species.female': ['CustomName3', 'CustomName4']
});

// Use custom data
const customName = await api.generateName({
  language: 'custom',
  species: 'species',
  gender: 'male',
  useCustomData: true
});
```

### Error Handling

```javascript
try {
  const name = await api.randomName('unknown-species');
  console.log(name); // Will return fallback name
} catch (error) {
  console.error('Generation failed:', error);
  // Convenience functions have built-in fallbacks
}
```

## Examples

### Tavern Generator

```javascript
async function generateTavern(species = 'human') {
  const tavernName = await api.tavern(species);
  const keeperName = await api.randomName(species, 'random');
  const barmaidName = await api.randomName(species, 'female');

  return {
    name: tavernName,
    keeper: keeperName,
    staff: [barmaidName],
    species: species
  };
}

const tavern = await generateTavern('halfling');
// {
//   name: "Zum Grünen Drachen",
//   keeper: "Bilbo Beutlin",
//   staff: ["Rosie Kochfeld"],
//   species: "halfling"
// }
```

### Adventure Party Generator

```javascript
async function generateParty(size = 4) {
  const species = ['human', 'elf', 'dwarf', 'halfling'];
  const party = [];

  for (let i = 0; i < size; i++) {
    const randomSpecies = species[Math.floor(Math.random() * species.length)];
    const character = await api.quickNPC(randomSpecies, 'random');
    party.push(character);
  }

  return party;
}

const adventurers = await generateParty(4);
```

### Settlement with NPCs

```javascript
async function generateSettlement(species = 'human', size = 'small') {
  const settlementName = await api.settlement(species);
  const mayorName = await api.randomName(species, 'random');
  const tavernName = await api.tavern(species);
  const shopName = await api.shop(species);

  const npcCount = size === 'large' ? 10 : size === 'medium' ? 5 : 3;
  const npcs = await api.multipleNames(npcCount, species, 'mixed');

  return {
    name: settlementName,
    mayor: mayorName,
    establishments: {
      tavern: tavernName,
      shop: shopName
    },
    residents: npcs,
    species: species
  };
}
```

### Multilingual Support

```javascript
// Generate names in different languages
const germanName = await api.randomName('human', 'male', 'de');  // "Johann Müller"
const englishName = await api.randomName('human', 'male', 'en'); // "John Smith"
const frenchName = await api.randomName('human', 'male', 'fr');  // "Jean Dubois"

// Auto-detect Foundry language
const autoName = await api.randomName('human', 'male', 'auto');
```

## Best Practices

### Performance

1. **Cache Results**: Store frequently used names to avoid repeated API calls
2. **Batch Generation**: Use `multipleNames()` instead of multiple individual calls
3. **Lazy Loading**: Generate names only when needed

```javascript
// Good: Batch generation
const names = await api.multipleNames(10, 'human', 'mixed');

// Less efficient: Multiple individual calls
const names = [];
for (let i = 0; i < 10; i++) {
  names.push(await api.randomName());
}
```

### Error Handling

1. **Use Convenience Functions**: They have built-in fallbacks
2. **Check Module Availability**: Always verify the module is active
3. **Graceful Degradation**: Provide fallback names in your module

```javascript
async function safeName(species = 'human') {
  if (!game.modules.get('nomina-names')?.active) {
    return 'Unknown'; // Fallback
  }

  try {
    return await api.randomName(species);
  } catch (error) {
    console.warn('Name generation failed:', error);
    return 'Unknown';
  }
}
```

### Memory Management

1. **Don't Store Large Arrays**: Generate names on-demand
2. **Clean Up Hooks**: Unregister custom hooks when not needed
3. **Limit Batch Sizes**: Don't generate hundreds of names at once

### Localization

1. **Use 'auto' Language**: Let the API detect Foundry's language
2. **Respect User Preferences**: Consider user's language settings
3. **Provide Fallbacks**: Handle missing language data gracefully

## Troubleshooting

### Common Issues

#### "Module not found" Error

```javascript
// Check if module is active
if (!game.modules.get('nomina-names')?.active) {
  console.error('Nomina Names module is not installed or active');
}
```

#### Empty/Undefined Results

```javascript
// Use convenience functions for automatic fallbacks
const name = await api.randomName(); // Always returns something

// Or handle manually
const name = await api.generateName(options) || 'Fallback Name';
```

#### Performance Issues

```javascript
// Use batch generation
const names = await api.multipleNames(100); // Efficient

// Avoid this
const names = [];
for (let i = 0; i < 100; i++) {
  names.push(await api.randomName()); // Inefficient
}
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// In Foundry settings, set log level to "Debug"
// Or temporarily enable verbose logging
console.log('API test:', await api.randomName());
```

### Getting Help

1. Check the browser console for error messages
2. Verify module compatibility with your Foundry version
3. Test with the provided test script: `test-api.js`
4. Report issues with detailed reproduction steps

## API Reference Summary

### Convenience Functions
- `randomName(species?, gender?, language?)` - Complete name generation
- `firstName(species?, gender?, language?)` - First name only
- `surname(species?, language?)` - Surname only
- `settlement(species?, language?)` - Settlement name
- `tavern(species?, language?)` - Tavern name
- `shop(species?, language?)` - Shop name
- `book(species?, language?)` - Book title
- `multipleNames(count?, species?, gender?, language?)` - Multiple names
- `quickNPC(species?, gender?, language?)` - Complete NPC object

### Advanced Functions
- `generateName(options)` - Core generation with full options
- `generateCategorizedContent(options)` - Categorized content generation
- `getAvailableLanguages()` - List available languages
- `getAvailableSpecies()` - List available species
- `getAvailableSubcategories(lang, species, category)` - List subcategories

### Utility Functions
- `registerHook(name, callback)` - Register custom hooks
- `registerCustomDataSource(id, data)` - Add custom data
- `hasPermission()` - Check user permissions

---

*This documentation covers version 1.2.7+ of the Nomina Names module. For older versions, some features may not be available.*