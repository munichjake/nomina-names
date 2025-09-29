# JSON Format Specification v3.1.2

## Overview

The Names Module supports a comprehensive JSON format for storing name data with rich metadata support. Version 3.1.2 extends the translation capabilities to support individual entry values, allowing for comprehensive localization of not just predefined field values but also dynamic content within entries.

## File Structure

### Basic File Format

```json
{
    "format": "3.1.1",
    "fileVersion": "1.0.0",
    "code": "human",
    "displayName": {
        "de": "Menschen",
        "en": "Human"
    },
    "languages": ["de", "en"],
    "categories": ["names", "taverns", "shops"],
    "data": {
        // Category definitions...
    }
}
```

### Required Root Properties

- `format` (string): Must be "3.1.2"
- `fileVersion` (string): Version of the specific data file
- `code` (string): Species/race identifier
- `displayName` (object): Localized display names for the species
- `languages` (array): Supported language codes
- `categories` (array): Available categories in this file
- `data` (object): Category data definitions

## Category Structure

### Enhanced Category Definition (v3.1.2)

```json
"taverns": {
    "displayName": {
        "de": "Gasthäuser",
        "en": "Taverns"
    },
    "entry_metadata": {
        "field_name": {
            "de": "Deutscher Feldname",
            "en": "English Field Name",
            "icon": {
                "type": "unicode",
                "value": "🏨"
            },
            "values": {
                "de": {
                    "key1": "Deutscher Wert",
                    "key2": "Anderer Wert"
                },
                "en": {
                    "key1": "English Value",
                    "key2": "Other Value"
                }
            }
        }
    },
    "subcategories": [
        // Subcategory definitions...
    ]
}
```

### Metadata Field Definition

Each field in `entry_metadata` supports:

- **Field Label** (required): Localized field names as direct language properties
- **Icon** (optional): Unicode emoji or icon specification
- **Values** (optional): Predefined value mappings for localization

#### Icon Format

```json
"icon": {
    "type": "unicode",
    "value": "🏨"
}
```

#### Value Mappings

For fields with predefined values:

```json
"values": {
    "de": {
        "luxury": "Luxus",
        "excellent": "Exzellent",
        "good": "Gut"
    },
    "en": {
        "luxury": "Luxury",
        "excellent": "Excellent",
        "good": "Good"
    }
}
```

### Entry Structure

```json
{
    "name": "Gasthof Kronprinz",
    "meta": {
        "type": "inn",
        "quality": "luxury",
        "atmosphere": "elegant",
        "clientele": "nobles",
        "location": "Tiefwasser (Oberstadt)",
        "owner": "Belindra Hügelfeld",
        "specialty": "Kalbsrücken mit Wacholderjus",
        "rooms": 22
    }
}
```

### Individual Entry Translation (v3.1.2)

Version 3.1.2 introduces support for translating individual entry values. This is particularly useful for proper nouns, location names, and specific content that varies between languages:

```json
{
    "name": "Gasthof Kronprinz",
    "meta": {
        "type": "inn",
        "quality": "luxury",
        "location": {
            "de": "Tiefwasser (Oberstadt)",
            "en": "Deepwater (Upper City)"
        },
        "owner": {
            "de": "Belindra Hügelfeld",
            "en": "Belindra Hillfield"
        },
        "specialty": {
            "de": "Kalbsrücken mit Wacholderjus",
            "en": "Veal loin with juniper jus"
        },
        "rooms": 22
    }
}
```

Individual entry values can now be either:
- **String values**: For content that doesn't need translation
- **Localized objects**: With language-specific translations

## Backward Compatibility

### Version 3.1.1 Compatibility
- All v3.1.1 features remain supported
- Individual entry translations are optional - string values work as before
- Existing entries continue to display correctly

### Version 3.1.0 Compatibility
- All v3.1.0 features remain supported
- `entry_metadata` is optional - files without it work as before
- Existing metadata display falls back to generic labels

### Version 3.0.x Compatibility
- Legacy subcategory structures are automatically converted
- Missing `displayName` properties use fallback mechanisms
- Simple string entries are converted to object format as needed

### Version 2.x Compatibility
- Legacy files are supported through automatic format detection
- Simple name arrays are converted to modern structure
- No metadata support for legacy formats

## Metadata Processing

### Field Resolution Priority

1. **entry_metadata definition** (v3.1.1)
2. **Localization file lookup** (v3.1.0 fallback)
3. **Generic field name** (final fallback)

### Icon Resolution

1. **entry_metadata icon** (v3.1.1)
2. **Default field icon mapping** (system default)
3. **No icon** (text only)

### Value Localization

1. **Individual entry translation** (v3.1.2)
2. **entry_metadata values mapping** (v3.1.1)
3. **Raw value display** (fallback)

## Complete Example

```json
{
    "format": "3.1.2",
    "fileVersion": "1.0.0",
    "code": "human",
    "displayName": {
        "de": "Menschen",
        "en": "Human"
    },
    "languages": ["de", "en"],
    "categories": ["taverns"],
    "data": {
        "taverns": {
            "displayName": {
                "de": "Gasthäuser",
                "en": "Taverns"
            },
            "entry_metadata": {
                "type": {
                    "de": "Typ",
                    "en": "Type",
                    "icon": {
                        "type": "unicode",
                        "value": "🏨"
                    },
                    "values": {
                        "de": {
                            "inn": "Gasthaus",
                            "tavern": "Taverne",
                            "restaurant": "Restaurant"
                        },
                        "en": {
                            "inn": "Inn",
                            "tavern": "Tavern",
                            "restaurant": "Restaurant"
                        }
                    }
                },
                "quality": {
                    "de": "Qualität",
                    "en": "Quality",
                    "icon": {
                        "type": "unicode",
                        "value": "⭐"
                    },
                    "values": {
                        "de": {
                            "luxury": "Luxus",
                            "excellent": "Exzellent",
                            "good": "Gut"
                        },
                        "en": {
                            "luxury": "Luxury",
                            "excellent": "Excellent",
                            "good": "Good"
                        }
                    }
                }
            },
            "subcategories": [
                {
                    "key": "upscale_inns",
                    "displayName": {
                        "de": "Luxuriöse Gasthäuser",
                        "en": "Upscale Inns"
                    },
                    "entries": {
                        "de": [
                            {
                                "name": "Gasthof Kronprinz",
                                "meta": {
                                    "type": "inn",
                                    "quality": "luxury",
                                    "location": {
                                        "de": "Tiefwasser (Oberstadt)",
                                        "en": "Deepwater (Upper City)"
                                    },
                                    "owner": {
                                        "de": "Belindra Hügelfeld",
                                        "en": "Belindra Hillfield"
                                    },
                                    "specialty": {
                                        "de": "Kalbsrücken mit Wacholderjus",
                                        "en": "Veal loin with juniper jus"
                                    },
                                    "rooms": 22
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

## Migration Guide

### From v3.1.1 to v3.1.2

1. Update `format` to "3.1.2"
2. Convert individual entry values to localized objects where needed
3. Test individual entry translation in generator

### From v3.1.0 to v3.1.1

1. Add `entry_metadata` section to categories with metadata
2. Define field labels, icons, and value mappings
3. Update `format` to "3.1.1"
4. Test metadata display in generator

### Best Practices

- Always include both German and English labels
- Use descriptive Unicode emojis for icons
- Provide value mappings for enumerated fields
- Keep field names consistent across files
- Test with multiple languages

## Technical Implementation

The system automatically detects format version and applies appropriate processing:

- **Format detection**: Based on `format` field in JSON
- **Metadata processing**: Uses entry_metadata when available
- **Fallback handling**: Graceful degradation for older formats
- **Performance**: Metadata definitions cached for efficiency

This specification ensures rich, localized metadata display while maintaining full backward compatibility with existing data files.