# Nomina Names - FoundryVTT Module

A flexible and extensible name generator for FoundryVTT with configurable JSON data files for multiple languages, species, and categories. Generate traditional character names, settlements, titles, and categorized content like books, taverns, ships, and shops.

## 🚀 Features

### 🎭 Versatile Name Generation
- **Multiple Species**: Humans, Elves, Gnomes (easily extensible)
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
- **JSON Format 3.1.0**: Self-contained files with integrated translations
- **Category Groups**: Organized categories (Names, Places, Objects, etc.)
- **Dynamic Categories**: Categories loaded from index.json with fallback support
- **Permission System**: Control access based on user roles
- **Modern UI**: Enhanced dropdowns and responsive design
- **Nonbinary Support**: Optional nonbinary names (configurable)

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

After installation, find the following options under **Game Settings → Configure Settings → Module Settings → Names**:

- **Show Button in Token Controls**: Adds button to the left toolbar
- **Show Button in Character Sheet**: Name picker next to the name field
- **Show Button in Token HUD**: Name button on selected tokens
- **Show Right-click Context Menu**: "Change Name" in token context menu
- **Enable Emergency Names**: Quick random names in chat
- **Include Nonbinary Names**: Enable nonbinary name generation
- **Default Language**: Set default language for name generation
- **Permission Level**: Control who can use the generator

## 🎮 Usage

### Basic Name Generation
- **Toolbar Button**: Click the names button in the left toolbar
- **Chat Command**: Type `/names` or `/namen` in chat
- **Token Selection**: Select a token and use the HUD button or right-click menu

### Quick Names for Tokens
1. Select one or more tokens
2. Right-click → "Change Name" or use the HUD button
3. Choose language, species, gender, and categories
4. Click "Apply to Selected Token(s)"

### Emergency Names
- Use `/emergency-names` chat command for instant random names
- Perfect for NPCs that need quick naming during play

### Categorized Content
Generate books, taverns, ships, and shops with themed subcategories:
- **Books**: Religious texts, novels, scientific treatises, humorous books
- **Taverns**: Upscale inns, common taverns, harbor taverns, adventurer taverns
- **Ships**: Merchant ships, warships, pirate ships, exploration vessels
- **Shops**: Blacksmiths, alchemists, general stores, weapon/armor smiths

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

#### Register New Species
```javascript
const namesAPI = game.modules.get('nomina-names').api;

namesAPI.registerSpecies('my-module', {
  species: 'dragonborn',
  languages: ['en', 'de'],
  data: {
    en: {
      male: ['Arjhan', 'Balasar', 'Bharash'],
      female: ['Akra', 'Biri', 'Daar'],
      surnames: ['Clethtinthiallor', 'Daardendrian', 'Delmirev']
    },
    de: {
      male: ['Arjhan', 'Balasar', 'Bharash'],
      female: ['Akra', 'Biri', 'Daar'],
      surnames: ['Clethtinthiallor', 'Daardendrian', 'Delmirev']
    }
  },
  localization: {
    en: 'Dragonborn',
    de: 'Drachenblütige'
  }
});
```

#### Register Custom Data Source
```javascript
namesAPI.registerDataSource('my-module', {
  language: 'en',
  species: 'human',
  category: 'titles',
  data: ['Lord', 'Lady', 'Sir', 'Dame'],
  priority: 1
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

### Data File Formats

#### JSON Format 3.1.0 (Recommended)
Self-contained files with integrated category translations:

```json
{
  "format": "3.1.0",
  "fileVersion": "1.0.0",
  "code": "human",
  "displayName": {
    "de": "Menschen",
    "en": "Human"
  },
  "languages": ["de", "en"],
  "categories": ["pets"],
  "data": {
    "pets": {
      "displayName": {
        "de": "Haustiere & Begleiter",
        "en": "Pets & Companions"
      },
      "subcategories": [
        {
          "key": "dogs",
          "displayName": {
            "de": "Hunde",
            "en": "Dogs"
          },
          "entries": {
            "de": ["Rex", "Luna", "Bello"],
            "en": ["Buddy", "Bella", "Charlie"]
          }
        }
      ]
    }
  }
}
```

#### Legacy Data File Formats

##### Simple Categories (surnames, titles, etc.)
```json
{
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Description of data source",
  "data": [
    "Name 1",
    "Name 2",
    "Name 3"
  ]
}
```

##### Categorized Content (books, ships, etc.)
```json
{
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Books data",
  "data": {
    "religious_books": [
      "The Sacred Tome",
      "Divine Revelations"
    ],
    "novels": [
      "The Dragon's Tale",
      "Love in the Tavern"
    ]
  }
}
```

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

### Version 1.2.6
- Enhanced category system with groups
- Added categorized content support (books, ships, shops, taverns)
- Improved UI with modern dropdowns
- Extended API for third-party modules
- Added nonbinary name support
- Performance improvements

### Previous Versions
See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

*Built with ❤️ for the FoundryVTT community*
