# JSON Format Specification v3.2.0

## Overview

Version 3.2.0 extends the Names Module JSON format with **template-based procedural generation** support. This allows for dynamic name creation using placeholders and component libraries, while maintaining full backward compatibility with all previous formats.

## What's New in 3.2.0

- **Template System**: Define name generation patterns using placeholders
- **Component Libraries**: Reusable language-specific word lists
- **Hybrid Mode**: Combine static entries with procedural generation
- **Filter Support**: Prepared syntax for future grammar features

## File Structure

### Basic File Format (unchanged)

```json
{
    "format": "3.1.2",
    "fileVersion": "1.0.0",
    "code": "dwarf",
    "displayName": {
        "de": "Zwerge",
        "en": "Dwarves"
    },
    "languages": ["de", "en"],
    "categories": ["settlements"],
    "data": {
        // Category definitions with optional templates...
    }
}
```

**Note**: Format version remains "3.1.2" - template support is backward-compatible.

## Template-Based Subcategories

### Subcategory Modes

Each subcategory can operate in one of three modes:

#### Mode 1: Static Entries Only (Traditional)

```json
{
  "key": "mountain_halls",
  "displayName": {
    "de": "Berghallen",
    "en": "Mountain Halls"
  },
  "entries": {
    "de": ["Eisenberg", "Steinschmiede", "Goldhalle"],
    "en": ["Ironpeak", "Stoneforge", "Goldhall"]
  }
}
```

#### Mode 2: Templates Only (Procedural)

```json
{
  "key": "procedural_mountain_halls",
  "displayName": {
    "de": "Berghallen (Prozedural Beta)",
    "en": "Mountain Halls (Procedural Beta)"
  },
  "templates": [
    "{metal}{building}",
    "{metal}halle der {clan}",
    "{stone}{suffix}"
  ],
  "components": {
    "metal": {
      "de": ["Eisen", "Gold", "Mithril", "Silber", "Kupfer"],
      "en": ["Iron", "Gold", "Mithril", "Silver", "Copper"]
    },
    "stone": {
      "de": ["Stein", "Granit", "Marmor", "Schiefer"],
      "en": ["Stone", "Granite", "Marble", "Slate"]
    },
    "building": {
      "de": ["schmiede", "grube", "halle", "kammer", "festung"],
      "en": ["forge", "mine", "hall", "chamber", "fortress"]
    },
    "clan": {
      "de": ["Steinklaue", "Eisenfaust", "Goldbart", "Silberhammer"],
      "en": ["Stoneclaw", "Ironfist", "Goldbeard", "Silverhammer"]
    },
    "suffix": {
      "de": ["berg", "heim", "hort", "burg"],
      "en": ["peak", "home", "hoard", "burg"]
    }
  }
}
```

#### Mode 3: Hybrid (Both Static and Procedural)

```json
{
  "key": "mixed_settlements",
  "displayName": {
    "de": "Gemischte Siedlungen",
    "en": "Mixed Settlements"
  },
  "entries": {
    "de": ["Khazad-dûm", "Erebor"],  // Famous/canonical names
    "en": ["Khazad-dûm", "Erebor"]
  },
  "templates": [
    "{prefix}{suffix}",
    "{metal}heim"
  ],
  "components": {
    "prefix": {
      "de": ["Eisen", "Stein", "Gold"],
      "en": ["Iron", "Stone", "Gold"]
    },
    "suffix": {
      "de": ["berg", "halle", "grube"],
      "en": ["peak", "hall", "mine"]
    },
    "metal": {
      "de": ["Eisen", "Silber", "Gold"],
      "en": ["Iron", "Silver", "Gold"]
    }
  }
}
```

**Hybrid Mode Behavior**: The generator randomly chooses between static entries and template generation (50/50 probability).

## Template Syntax

### Placeholder Format

```
{placeholder}              → Simple placeholder
{placeholder|filter}       → Placeholder with filter (for future grammar)
```

### Examples

```json
"templates": [
  "{prefix}{suffix}",                    // Simple: "Eisenberg"
  "{metal}schmiede",                     // Mixed: "Goldschmiede"
  "{metal}halle der {clan}",             // Multi: "Eisenhalle der Steinklaue"
  "{settlement|genitive}",               // Filtered (future): grammar support
  "Festung {prefix}{building}"           // Prefix text: "Festung Eisenschmiede"
]
```

### Component Structure

Components must be defined for each language:

```json
"components": {
  "component_name": {
    "de": ["Option 1", "Option 2", "Option 3"],
    "en": ["Option 1", "Option 2", "Option 3"]
  }
}
```

**Alternative**: Components without language keys (shared across all languages):

```json
"components": {
  "numbers": ["I", "II", "III", "IV", "V"]  // Same for all languages
}
```

## Generation Logic

### Template Processing

1. **Template Selection**: Random template from `templates` array
2. **Placeholder Resolution**: Each `{placeholder}` is replaced with:
   - Random value from `components[placeholder][language]`
   - Or from `components[placeholder]` if not language-specific
3. **Filter Application**: If `{placeholder|filter}` is used, filter is applied (future feature)

### Mode Selection (Hybrid)

When both `entries` and `templates` are present:
- 50% chance: Pick random entry from `entries[language]`
- 50% chance: Generate from random template

## Complete Example

```json
{
  "format": "3.1.2",
  "fileVersion": "1.0.0",
  "code": "dwarf",
  "displayName": {
    "de": "Zwerge",
    "en": "Dwarves"
  },
  "languages": ["de", "en"],
  "categories": ["settlements"],
  "data": {
    "settlements": {
      "displayName": {
        "de": "Siedlungen",
        "en": "Settlements"
      },
      "subcategories": [
        {
          "key": "mountain_halls",
          "displayName": {
            "de": "Berghallen",
            "en": "Mountain Halls"
          },
          "entries": {
            "de": ["Khazad-dûm", "Erebor", "Eisenberg"],
            "en": ["Khazad-dûm", "Erebor", "Ironpeak"]
          }
        },
        {
          "key": "procedural_beta",
          "displayName": {
            "de": "Prozedural (Beta)",
            "en": "Procedural (Beta)"
          },
          "templates": [
            "{metal}{building}",
            "{metal}halle der {clan}",
            "{stone}{suffix}"
          ],
          "components": {
            "metal": {
              "de": ["Eisen", "Gold", "Mithril", "Silber"],
              "en": ["Iron", "Gold", "Mithril", "Silver"]
            },
            "stone": {
              "de": ["Stein", "Granit", "Marmor"],
              "en": ["Stone", "Granite", "Marble"]
            },
            "building": {
              "de": ["schmiede", "grube", "halle", "kammer"],
              "en": ["forge", "mine", "hall", "chamber"]
            },
            "clan": {
              "de": ["Steinklaue", "Eisenfaust", "Goldbart"],
              "en": ["Stoneclaw", "Ironfist", "Goldbeard"]
            },
            "suffix": {
              "de": ["berg", "heim", "hort"],
              "en": ["peak", "home", "hoard"]
            }
          }
        }
      ]
    }
  }
}
```

## Use Cases

### 1. Dwarven Settlements

```json
"templates": [
  "{metal}{building}",
  "{stone}halle der {clan}",
  "Festung {metal}{suffix}"
],
"components": {
  "metal": {"de": ["Eisen", "Gold", "Mithril", "Silber", "Kupfer"]},
  "stone": {"de": ["Stein", "Granit", "Marmor", "Schiefer"]},
  "building": {"de": ["schmiede", "grube", "halle", "festung"]},
  "clan": {"de": ["Steinklaue", "Eisenfaust", "Goldbart"]},
  "suffix": {"de": ["berg", "heim", "hort", "burg"]}
}
```

**Example Output**:
- "Eisenschmiede"
- "Steinhal le der Goldbart"
- "Festung Mithrilberg"

### 2. Halfling Settlements (Simplified)

Instead of 800+ manual entries like "Pfeifental", "Gartenstein":

```json
"templates": [
  "{prefix}{suffix}",
  "{prefix}feld",
  "{prefix}hof"
],
"components": {
  "prefix": {"de": ["Pfeifen", "Garten", "Linden", "Rose", "Klee", "Hasel", "Birn", "Apfel"]},
  "suffix": {"de": ["tal", "stein", "hufe", "feld", "brück", "hain", "bach", "dorf"]}
}
```

**Example Output**:
- "Pfeifental"
- "Gartenfeld"
- "Rosenhof"

### 3. Elven Names (Character Names)

```json
"templates": [
  "{prefix}{suffix}",
  "{prefix}il",
  "{prefix}wen",
  "{prefix}adriel"
],
"components": {
  "prefix": {"de": ["Gal", "Thran", "Leg", "Cel", "Glor", "El"]},
  "suffix": {"de": ["adriel", "ador", "ion", "las", "rond", "wen"]}
}
```

**Example Output**:
- "Galadriel"
- "Thranduil"
- "Legolas"
- "Celoril"

## Filter System (Future Feature)

### Syntax

```json
"templates": [
  "Graf {preposition|genitive} {settlement|genitive}",
  "{name} {title|accusative}"
]
```

### Planned Filters

- **Grammar Cases**: `genitive`, `dative`, `accusative`, `nominative`
- **Text Transformation**: `uppercase`, `lowercase`, `capitalize`
- **Pluralization**: `plural`, `singular`
- **Articles**: `definite_article`, `indefinite_article`

**Current Status**: Filter syntax is recognized but not yet implemented. Values are returned unchanged.

## Backward Compatibility

### Version Compatibility Matrix

| Format Version | Static Entries | Templates | Metadata | Entry Translation |
|----------------|----------------|-----------|----------|-------------------|
| 2.x (Legacy)   | ✅ | ❌ | ❌ | ❌ |
| 3.0.x          | ✅ | ❌ | ❌ | ❌ |
| 3.1.0          | ✅ | ❌ | ✅ | ❌ |
| 3.1.1          | ✅ | ❌ | ✅ | ✅ |
| 3.1.2          | ✅ | ❌ | ✅ | ✅ |
| **3.2.0**      | ✅ | **✅** | ✅ | ✅ |

### Migration Path

**From 3.1.2 to 3.2.0**:
1. Keep existing `entries` intact
2. Add new subcategories with `templates` and `components`
3. Mark new subcategories as "Beta" or "Procedural" in `displayName`
4. Test generation with both modes

**Example Migration**:

```json
// BEFORE (3.1.2)
"subcategories": [
  {
    "key": "mountain_halls",
    "entries": {"de": ["Eisenberg", "Goldschmiede"]}
  }
]

// AFTER (3.2.0 - keeping old data)
"subcategories": [
  {
    "key": "mountain_halls",
    "entries": {"de": ["Eisenberg", "Goldschmiede"]}  // UNCHANGED
  },
  {
    "key": "procedural_beta",  // NEW
    "displayName": {"de": "Prozedural (Beta)"},
    "templates": ["{metal}{building}"],
    "components": {
      "metal": {"de": ["Eisen", "Gold", "Mithril"]},
      "building": {"de": ["schmiede", "berg", "halle"]}
    }
  }
]
```

## Validation

### Template Validation

The system validates templates before generation:

```javascript
// Check if all placeholders have corresponding components
validateTemplate("{metal}{building}", components, "de")
// Returns: { isValid: true, missing: [], placeholders: ["metal", "building"] }
```

### Common Errors

**Error**: "Template validation failed: missing components metal"
- **Cause**: Template uses `{metal}` but no `metal` component defined
- **Fix**: Add `"metal": {"de": [...]}` to components

**Error**: "No options found for component 'prefix' in language 'de'"
- **Cause**: Component exists but has no German options
- **Fix**: Add `"de": [...]` array to component

## Best Practices

### 1. Component Naming
- Use descriptive names: `metal`, `building`, `clan` instead of `a`, `b`, `c`
- Be consistent across files
- Use lowercase for component keys

### 2. Template Variety
- Provide multiple templates for variety
- Mix simple and complex patterns
- Include both short and long generation patterns

### 3. Component Size
- 3-10 options: Good variety without overwhelming
- 10-30 options: Excellent variety
- 30+ options: Risk of rarely-seen combinations

### 4. Language Parity
- Ensure all languages have equal number of options
- Maintain consistent theme across languages
- Consider cultural differences in naming patterns

### 5. Beta Testing
- Mark new procedural categories as "Beta"
- Keep existing static entries unchanged
- Create separate subcategories for experimentation

## Technical Implementation

### Generation Flow

```javascript
// 1. Check for templates
if (hasTemplates && hasComponents) {
  // 2. Pick random template
  template = pickRandom(subcategoryData.templates);

  // 3. Validate template
  validation = validateTemplate(template, components, language);

  // 4. Replace placeholders
  name = parseTemplate(template, components, language);

  return name;
}
```

### Placeholder Replacement

```javascript
template.replace(/{(\w+)(?:\|(\w+))?}/g, (match, key, filter) => {
  // Get component options for language
  options = components[key][language] || components[key];

  // Pick random value
  value = pickRandom(options);

  // Apply filter if specified (future)
  return filter ? applyFilter(value, filter) : value;
});
```

## Future Enhancements

### Planned Features

1. **Grammar Filters** (v3.3.0)
   - German declensions
   - Article agreement
   - Case transformations

2. **Weighted Components** (v3.4.0)
   ```json
   "components": {
     "rarity": [
       {"value": "Common", "weight": 70},
       {"value": "Rare", "weight": 25},
       {"value": "Legendary", "weight": 5}
     ]
   }
   ```

3. **Conditional Templates** (v3.5.0)
   ```json
   "templates": [
     {
       "pattern": "{title} {name}",
       "conditions": {"gender": "male"}
     }
   ]
   ```

4. **Cross-Category References** (v3.6.0)
   ```json
   "templates": [
     "{settlement@settlements} {descriptor}"
   ]
   ```

## Support and Resources

- **Examples**: See `data/de.dwarf.settlements.json` for complete example
- **API Documentation**: `docs/api-documentation.md`
- **Developer Guide**: `docs/developer-guide.md`
- **Changelog**: `CHANGELOG.md`

## Version History

- **3.2.0** (2025): Template-based generation, procedural names
- **3.1.2** (2024): Individual entry translation
- **3.1.1** (2024): Metadata field definitions
- **3.1.0** (2024): Metadata support
- **3.0.0** (2024): Consolidated format, subcategories
- **2.x** (2023): Legacy format
