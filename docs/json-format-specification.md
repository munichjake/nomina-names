# Nomina Names JSON Format Specification

## Overview

This document defines the authoritative JSON format specification for the Nomina Names module. The format supports multiple versions, multilingual content, metadata-enhanced entries, and extensible data structures designed for fantasy tabletop gaming applications.

### Format Versions

| Version | Status | Features |
|---------|---------|----------|
| **3.1.0** | Latest | Self-contained translations with category-level displayNames |
| **3.0.1** | Stable | Base format + optional metadata support |
| **3.0.0** | Stable | Base format with subcategories and multilingual support |
| 2.x | Legacy | Deprecated - migration recommended |

### Core Principles

- **Backward Compatibility**: Newer versions maintain compatibility with older formats
- **Multilingual Support**: Native support for multiple languages within a single file
- **Extensibility**: Designed to accommodate new features without breaking changes
- **Performance**: Optimized for efficient loading and processing
- **Validation**: Schema-based validation for data integrity

## File Structure

### Root Schema

All JSON files must conform to this base structure:

```json
{
  "format": "3.0.0" | "3.0.1" | "3.1.0",
  "fileVersion": "<version-string>",
  "code": "<species-identifier>",
  "displayName": {
    "<language-code>": "<localized-name>",
    "en": "<english-name>"
  },
  "languages": ["<language-code>", "..."],
  "categories": ["<category-code>", "..."],
  "data": {
    "<category-code>": {
      "displayName": {              // 3.1.0: Optional category-level translations
        "<language-code>": "<localized-category-name>"
      },
      "subcategories": [
        {
          "key": "<subcategory-key>",
          "displayName": {
            "<language-code>": "<localized-subcategory-name>"
          },
          "entries": {
            "<language-code>": <entry-data>
          }
        }
      ]
    }
  }
}
```

### Field Specifications

#### Required Root Fields

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `format` | string | Must be "3.0.0", "3.0.1", or "3.1.0" | JSON structure format version |
| `fileVersion` | string | Optional, any string | Individual file version for tracking updates |
| `code` | string | Lowercase, no spaces, unique | Species identifier code |
| `displayName` | object | At least one language required | Localized display names |
| `languages` | array | ISO 639-1 codes, matches displayName keys | Supported language codes |
| `categories` | array | Lowercase, must match data keys | Available content categories |
| `data` | object | Non-empty, matches categories | Category-specific data |

#### Optional Root Fields

| Field | Type | Description | Examples |
|-------|------|-------------|----------|
| `fileVersion` | string | Version tracking for this specific file | `"1.0.0"`, `"2023.12.15"`, `"v1.2"` |

**Note:** The `fileVersion` field is completely independent of the `format` field. While `format` specifies the JSON structure version, `fileVersion` can be used to track content updates, new entries, or revisions to the specific data file.

#### Display Name Object

```json
{
  "de": "Menschen",
  "en": "Human",
  "fr": "Humain",
  "es": "Humano"
}
```

**Requirements:**
- At least one language must be provided
- Language codes must be valid ISO 639-1 codes
- Recommended: Include both 'de' and 'en' for maximum compatibility

#### Subcategory Structure

```json
{
  "key": "firstnames",
  "displayName": {
    "de": "Vornamen",
    "en": "First Names"
  },
  "entries": {
    "de": { /* language-specific entries */ },
    "en": { /* language-specific entries */ }
  }
}
```

## Entry Data Formats

### Format 3.0.0 - Base Entries

#### Simple Array
```json
"entries": {
  "de": ["Name1", "Name2", "Name3"],
  "en": ["Name1", "Name2", "Name3"]
}
```

#### Gender-Specific Structure (Names)
```json
"entries": {
  "de": {
    "male": ["Heinrich", "Wilhelm", "Friedrich"],
    "female": ["Margarethe", "Elisabeth", "Katharina"],
    "nonbinary": ["Raven", "Morgan", "Alex"]
  },
  "en": {
    "male": ["Henry", "William", "Frederick"],
    "female": ["Margaret", "Elizabeth", "Catherine"],
    "nonbinary": ["Raven", "Morgan", "Alex"]
  }
}
```

### Format 3.0.1 - Enhanced with Metadata

#### Mixed String and Object Entries
```json
"entries": {
  "de": [
    "Simple Entry",
    {
      "name": "Enhanced Entry",
      "meta": {
        "style": "fantasy",
        "rarity": "rare",
        "region": "northern"
      }
    },
    "Another Simple Entry"
  ]
}
```

#### Gender Structure with Metadata
```json
"entries": {
  "de": {
    "male": [
      "Heinrich",
      {
        "name": "Thalion",
        "meta": {
          "style": "ancient",
          "origin": "noble",
          "rarity": "uncommon"
        }
      }
    ],
    "female": ["Margarethe", "Elisabeth"]
  }
}
```

## Metadata Schema (Format 3.0.1)

### Universal Metadata Properties

```json
{
  "style": "ancient|classical|modern|fantasy|futuristic",
  "rarity": "common|uncommon|rare|legendary|unique",
  "region": "northern|southern|eastern|western|coastal|inland|mountain|forest",
  "custom": {
    "any_property": "custom_value"
  }
}
```

### Category-Specific Metadata

#### Names
```json
{
  "style": "ancient|classical|modern|fantasy",
  "origin": "noble|common|tribal|religious|occupational",
  "rarity": "common|uncommon|rare|unique",
  "culture": "northern|southern|eastern|western"
}
```

#### Settlements
```json
{
  "size": "hamlet|village|town|city|metropolis",
  "region": "coastal|inland|mountain|forest|desert|arctic",
  "style": "ancient|medieval|renaissance|modern",
  "prosperity": "poor|modest|prosperous|wealthy"
}
```

#### Taverns & Establishments
```json
{
  "type": "tavern|inn|pub|alehouse|restaurant",
  "quality": "poor|common|good|excellent|luxury",
  "atmosphere": "rowdy|cozy|elegant|mysterious|dangerous",
  "clientele": "commoners|merchants|nobles|adventurers|sailors"
}
```

#### Books & Literature
```json
{
  "genre": "historical|religious|scientific|fantasy|adventure|romance|mystery",
  "age": "ancient|old|recent|contemporary",
  "condition": "poor|fair|good|excellent|pristine",
  "language": "common|elvish|draconic|ancient"
}
```

#### Ships & Vessels
```json
{
  "type": "merchant|warship|fishing|exploration|passenger|pirate",
  "size": "small|medium|large|massive",
  "condition": "derelict|poor|fair|good|excellent",
  "fame": "unknown|local|regional|legendary"
}
```

#### Shops & Services
```json
{
  "type": "general|specialty|luxury|craft|service",
  "quality": "poor|average|good|excellent|masterwork",
  "reputation": "questionable|average|good|excellent|renowned",
  "specialization": "weapons|armor|potions|books|food|clothes"
}
```

## Category Definitions

### Names Category
Primary category for character name generation with gender-specific subcategories.

**Standard Subcategories:**
- `firstnames` - First/given names (gender-specific)
- `surnames` - Family names/surnames (gender-neutral)
- `nicknames` - Nicknames and epithets
- `titles` - Noble titles and honorifics

### Settlements Category
Location names for various types of settlements.

**Standard Subcategories:**
- `coastal` - Coastal cities and ports
- `inland` - Inland towns and cities
- `mountain` - Mountain settlements
- `forest` - Forest communities

### Taverns Category
Names for inns, taverns, and drinking establishments.

**Standard Subcategories:**
- `upscale` - High-quality inns and establishments
- `common` - Standard taverns and pubs
- `harbor` - Waterfront taverns and sailor hangouts
- `roadside` - Waystation inns and rest stops

### Books Category
Titles for books, tomes, and written works.

**Standard Subcategories:**
- `religious` - Religious texts and prayers
- `historical` - Historical chronicles and records
- `magical` - Spellbooks and magical treatises
- `fictional` - Novels and fictional works

### Ships Category
Names for vessels and watercraft.

**Standard Subcategories:**
- `merchant` - Trading vessels
- `military` - Warships and naval vessels
- `fishing` - Fishing boats and trawlers
- `exploration` - Exploration and research vessels

### Shops Category
Names for businesses and commercial establishments.

**Standard Subcategories:**
- `blacksmith` - Smithies and metalworking shops
- `general` - General stores and markets
- `alchemist` - Potion shops and alchemical suppliers
- `clothier` - Tailors and clothing shops

## Complete Examples

### Basic Names File (3.0.0)
```json
{
  "format": "3.0.0",
  "code": "human",
  "displayName": {
    "de": "Menschen",
    "en": "Human"
  },
  "languages": ["de", "en"],
  "categories": ["names"],
  "data": {
    "names": {
      "subcategories": [
        {
          "key": "firstnames",
          "displayName": {
            "de": "Vornamen",
            "en": "First Names"
          },
          "entries": {
            "de": {
              "male": ["Heinrich", "Wilhelm", "Friedrich"],
              "female": ["Margarethe", "Elisabeth", "Katharina"]
            },
            "en": {
              "male": ["Henry", "William", "Frederick"],
              "female": ["Margaret", "Elizabeth", "Catherine"]
            }
          }
        }
      ]
    }
  }
}
```

### Enhanced Taverns File with File Versioning (3.0.1)
```json
{
  "format": "3.0.1",
  "fileVersion": "2.1.0",
  "code": "elf",
  "displayName": {
    "de": "Elfen",
    "en": "Elf"
  },
  "languages": ["de", "en"],
  "categories": ["taverns"],
  "data": {
    "taverns": {
      "subcategories": [
        {
          "key": "upscale",
          "displayName": {
            "de": "Gehobene Gasthäuser",
            "en": "Upscale Inns"
          },
          "entries": {
            "de": [
              "Zum Goldenen Hirsch",
              {
                "name": "Das Königliche Gasthaus",
                "meta": {
                  "quality": "luxury",
                  "atmosphere": "elegant",
                  "clientele": "nobles"
                }
              },
              {
                "name": "Zur Silbernen Harfe",
                "meta": {
                  "quality": "excellent",
                  "atmosphere": "cozy",
                  "style": "fantasy"
                }
              }
            ],
            "en": [
              "The Golden Stag",
              {
                "name": "The Royal Inn",
                "meta": {
                  "quality": "luxury",
                  "atmosphere": "elegant",
                  "clientele": "nobles"
                }
              }
            ]
          }
        }
      ]
    }
  }
}
```

## File Naming Conventions

### Standard Pattern
```
<language>.<species>.<category>.json
```

### Examples
- `de.human.names.json` - German human names
- `en.elf.settlements.json` - English elf settlements
- `de.dwarf.taverns.json` - German dwarf taverns
- `en.dragonborn.books.json` - English dragonborn books

### Best Practices
1. Use lowercase for all components
2. No spaces or special characters
3. Use hyphens for multi-word species (e.g., `half-orc`)
4. Keep category names consistent across files

## Validation Rules

### Schema Validation
1. **Format Field**: Must be exactly "3.0.0" or "3.0.1" (defines JSON structure)
2. **File Version**: Optional field for tracking individual file updates (any string format)
3. **Required Fields**: All mandatory root fields must be present and valid
4. **Language Consistency**: Language codes must match across all sections
5. **Data Integrity**: Categories array must match data object keys
6. **Entry Validation**: All entry arrays must contain at least one item

### Content Validation
1. **No Empty Arrays**: Entry arrays cannot be empty
2. **Consistent Languages**: All subcategories must support the same languages
3. **Unique Entries**: Avoid duplicate entries within the same array
4. **Appropriate Content**: Ensure cultural and contextual appropriateness

### Metadata Validation (3.0.1)
1. **Valid Properties**: Only use standardized metadata keys
2. **Consistent Values**: Use predefined values for enumerated properties
3. **Meaningful Metadata**: Only add metadata that provides value
4. **Optional Usage**: Metadata is always optional

## API Integration

### Basic Usage (3.0.0 Compatible)
```javascript
// Generate a simple name
const name = await NamesAPI.generateName({
  language: 'en',
  species: 'elf',
  category: 'names',
  subcategory: 'firstnames',
  gender: 'male'
});

// Generate settlement name
const settlement = await NamesAPI.generateName({
  language: 'de',
  species: 'human',
  category: 'settlements',
  subcategory: 'coastal'
});
```

### Enhanced Usage with Metadata (3.0.1)
```javascript
// Generate with metadata
const nameWithMeta = await NamesAPI.generateNameWithMetadata({
  language: 'en',
  species: 'elf',
  category: 'names',
  subcategory: 'firstnames',
  gender: 'male'
});
// Returns: { name: "Thalion", meta: { style: "ancient", rarity: "uncommon" } }

// Generate with filters
const filteredTaverns = await NamesAPI.generateNames({
  language: 'de',
  species: 'human',
  category: 'taverns',
  subcategory: 'upscale',
  count: 5,
  filters: {
    atmosphere: 'cozy',
    quality: ['good', 'excellent']
  }
});
```

## Migration Guide

### From 2.x to 3.0.0
1. Add `format: "3.0.0"` field
2. Restructure data into `subcategories` array
3. Add `displayName` objects for subcategories
4. Organize entries by language

### From 3.0.0 to 3.0.1
1. Update `format` field to "3.0.1"
2. Optionally add metadata to entries
3. No structural changes required

### Legacy Format Support
The system automatically handles legacy formats through internal transformation, but migration to 3.0.0+ is strongly recommended for optimal performance and feature support.

## File Versioning Best Practices

The `fileVersion` field enables tracking of content updates and new entries for individual data files:

### Version Numbering Schemes

#### Semantic Versioning (Recommended)
```json
{
  "format": "3.0.1",
  "fileVersion": "1.2.3",
  "code": "human"
}
```
- **Major** (1): Breaking changes or complete overhauls
- **Minor** (2): New content additions (new names, categories)
- **Patch** (3): Small fixes, corrections, or minor improvements

#### Date-Based Versioning
```json
{
  "format": "3.0.1",
  "fileVersion": "2024.01.15",
  "code": "elf"
}
```
- Useful for tracking when content was last updated
- Format: `YYYY.MM.DD` or `YYYY-MM-DD`

#### Simple Incremental
```json
{
  "format": "3.0.1",
  "fileVersion": "v7",
  "code": "dwarf"
}
```
- Simple counter for minor updates

### Usage Examples

#### Tracking Content Additions
```json
{
  "format": "3.0.1",
  "fileVersion": "2.1.0",
  "code": "human",
  "displayName": { "en": "Human" },
  "languages": ["en"],
  "categories": ["names"],
  "data": {
    "names": {
      "subcategories": [{
        "key": "firstnames",
        "displayName": { "en": "First Names" },
        "entries": {
          "en": {
            "male": [
              "John", "William", "James",
              "Alexander"  // Added in v2.1.0
            ]
          }
        }
      }]
    }
  }
}
```

#### Change Log Integration
The `fileVersion` can be used alongside external change logs to document what was added or modified in each version.

### Self-Contained Translations File (3.1.0)
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
            "de": ["Rex", "Luna", "Bello", "Max"],
            "en": ["Buddy", "Bella", "Charlie", "Daisy"]
          }
        },
        {
          "key": "cats",
          "displayName": {
            "de": "Katzen",
            "en": "Cats"
          },
          "entries": {
            "de": ["Minka", "Felix", "Tiger", "Luna"],
            "en": ["Whiskers", "Shadow", "Luna", "Oliver"]
          }
        }
      ]
    }
  }
}
```

## Format 3.1.0 Features

### Category-Level DisplayNames
The key innovation in 3.1.0 is the ability to include category-level `displayName` objects directly in the data files:

```json
"data": {
  "pets": {
    "displayName": {
      "de": "Haustiere & Begleiter",
      "en": "Pets & Companions",
      "fr": "Animaux de compagnie"
    },
    "subcategories": [...]
  }
}
```

### Translation Priority System
When loading category names, the system uses the following priority:

1. **JSON displayName** (highest priority) - Current language → English → German → Any available
2. **Language files** (fallback) - Traditional i18n system
3. **Generated fallback** (last resort) - Capitalized category key

### Benefits of 3.1.0
- **Self-contained**: No need to modify separate language files
- **Modular**: Each JSON file contains all its translations
- **Dynamic**: New categories can be added without code changes
- **Flexible**: Mix of JSON displayNames and traditional i18n
- **Backwards Compatible**: Falls back to language files when displayNames not available

### Migration from 3.0.1 to 3.1.0
1. Update `format` field to "3.1.0"
2. Add `displayName` object to category level in `data` section
3. Optionally remove corresponding entries from language files
4. Test that category names display correctly

## Best Practices

### Content Creation
1. **Cultural Sensitivity**: Research naming conventions for appropriate cultural context
2. **Language Quality**: Ensure high-quality translations and localization
3. **Thematic Consistency**: Maintain consistent themes within species and categories
4. **Variety**: Provide diverse options within each subcategory
5. **Version Tracking**: Use `fileVersion` to document content updates and additions

### Technical Implementation
1. **Validation**: Always validate files against the schema
2. **Performance**: Consider file size and loading performance
3. **Maintenance**: Keep files organized and well-documented
4. **Versioning**: Use semantic versioning for data updates

### Metadata Usage (3.0.1)
1. **Purposeful Metadata**: Only add metadata that serves a specific purpose
2. **Standardized Values**: Use predefined enumeration values
3. **Consistent Application**: Apply metadata consistently across similar entries
4. **Performance Consideration**: Balance metadata richness with loading performance

## Future Compatibility

The format is designed for extensibility:
- Additional languages can be added without breaking compatibility
- New subcategories can be introduced seamlessly
- Metadata schema can be extended with new properties
- Future format versions will maintain backward compatibility

---

*This specification defines the authoritative structure for Nomina Names JSON Format 3.0.0+. All implementations should conform to this specification for maximum compatibility and functionality.*