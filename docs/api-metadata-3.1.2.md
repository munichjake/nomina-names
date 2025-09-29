# JSON Format 3.1.2 Metadata API Documentation

This document describes the metadata API functions introduced with JSON format 3.1.1+ and extended in 3.1.2, which allows for rich, localized metadata definitions directly within data files.

## Overview

JSON format 3.1.1 introduces `entry_metadata` sections that define localized field labels, icons, and value mappings for metadata fields. JSON format 3.1.2 extends this with individual entry translation support, allowing for localization of dynamic content within entries themselves.

## Data Manager API Methods

### `hasEntryMetadata(language, species, category)`

Checks if a category has entry metadata definitions.

**Parameters:**
- `language` (string): Language code (e.g., "de", "en")
- `species` (string): Species code (e.g., "human", "elf")
- `category` (string): Category code (e.g., "taverns", "shops")

**Returns:** `boolean` - True if category has entry metadata definitions

**Example:**
```javascript
const globalNamesData = getGlobalNamesData();
const hasMetadata = globalNamesData.hasEntryMetadata("de", "human", "taverns");
console.log(hasMetadata); // true or false
```

### `getEntryMetadata(language, species, category)`

Gets the complete entry metadata object for a category.

**Parameters:**
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code

**Returns:** `Object|null` - Entry metadata object or null if not found

**Example:**
```javascript
const metadata = globalNamesData.getEntryMetadata("de", "human", "taverns");
console.log(metadata);
// {
//   "type": { "de": "Typ", "en": "Type", "icon": { "type": "unicode", "value": "🏨" }, ... },
//   "quality": { "de": "Qualität", "en": "Quality", "icon": { "type": "unicode", "value": "⭐" }, ... }
// }
```

### `getFieldLabel(language, species, category, fieldName)`

Gets the localized field label for a specific metadata field.

**Parameters:**
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code
- `fieldName` (string): Field name (e.g., "type", "quality")

**Returns:** `string|null` - Localized field label or null if not found

**Example:**
```javascript
const label = globalNamesData.getFieldLabel("de", "human", "taverns", "type");
console.log(label); // "Typ"

const labelEn = globalNamesData.getFieldLabel("en", "human", "taverns", "type");
console.log(labelEn); // "Type"
```

### `getFieldIcon(language, species, category, fieldName)`

Gets the Unicode icon for a specific metadata field.

**Parameters:**
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code
- `fieldName` (string): Field name

**Returns:** `string|null` - Unicode icon or null if not found

**Example:**
```javascript
const icon = globalNamesData.getFieldIcon("de", "human", "taverns", "type");
console.log(icon); // "🏨"
```

### `getLocalizedValue(language, species, category, fieldName, value)`

Gets the localized value mapping for a field value.

**Parameters:**
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code
- `fieldName` (string): Field name
- `value` (string): Raw value to localize

**Returns:** `string` - Localized value or original value if no mapping found

**Example:**
```javascript
const localizedValue = globalNamesData.getLocalizedValue("de", "human", "taverns", "quality", "luxury");
console.log(localizedValue); // "Luxus"

const englishValue = globalNamesData.getLocalizedValue("en", "human", "taverns", "quality", "luxury");
console.log(englishValue); // "Luxury"
```

### `getMetadataFields(language, species, category)`

Gets all available metadata field names for a category.

**Parameters:**
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code

**Returns:** `Array<string>` - Array of field names that have metadata definitions

**Example:**
```javascript
const fields = globalNamesData.getMetadataFields("de", "human", "taverns");
console.log(fields); // ["type", "quality", "atmosphere", "clientele", "location", "owner", ...]
```

## New in 3.1.2: Individual Entry Translation

### `getLocalizedEntryValue(value, fallbackLang = 'en')`

Localizes individual entry values that can be either strings or localized objects.

**Parameters:**
- `value` (any): Value to localize (can be string or object with language keys)
- `fallbackLang` (string): Fallback language if current language not available (default: "en")

**Returns:** `string` - Localized value or original value

**Example:**
```javascript
const globalNamesData = getGlobalNamesData();

// String values pass through unchanged
const stringValue = globalNamesData.getLocalizedEntryValue("Static Text");
console.log(stringValue); // "Static Text"

// Localized objects are resolved to current language
const localizedObject = {
  "de": "Tiefwasser (Oberstadt)",
  "en": "Deepwater (Upper City)"
};
const localizedValue = globalNamesData.getLocalizedEntryValue(localizedObject);
console.log(localizedValue); // "Tiefwasser (Oberstadt)" (if current language is German)
```

### `extractLocalizedMetadata(entry, language, species, category)`

Extracts and localizes all metadata values for display, combining both individual entry translation (3.1.2) and predefined value mappings (3.1.1).

**Parameters:**
- `entry` (Object): Entry object with metadata
- `language` (string): Language code
- `species` (string): Species code
- `category` (string): Category code

**Returns:** `Object|null` - Localized metadata object or null

**Example:**
```javascript
const entry = {
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
    }
  }
};

const localizedMeta = globalNamesData.extractLocalizedMetadata(entry, "de", "human", "taverns");
console.log(localizedMeta);
// {
//   "type": "Gasthaus",        // from 3.1.1 value mapping
//   "quality": "Luxus",        // from 3.1.1 value mapping
//   "location": "Tiefwasser (Oberstadt)", // from 3.1.2 individual translation
//   "owner": "Belindra Hügelfeld"         // from 3.1.2 individual translation
// }
```

## Generator App Integration

The generator app automatically uses the new metadata API when displaying results. The `_processMetaField` method now:

1. Checks for individual entry translation (3.1.2) first
2. Checks for entry metadata definitions (3.1.1) second
3. Falls back to pattern-based detection for older formats
4. Uses localized labels, icons, and value mappings when available

## Settings Integration

A new setting `enableMetadata` controls whether metadata features are enabled:

```javascript
// Check if metadata is enabled
const metadataEnabled = game.settings.get("nomina-names", "enableMetadata");

// The view toggle is automatically hidden when:
// - Metadata is disabled in settings
// - No metadata is available for current selection
```

## JSON Structure Example

```json
{
  "format": "3.1.2",
  "data": {
    "taverns": {
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
              "tavern": "Taverne"
            },
            "en": {
              "inn": "Inn",
              "tavern": "Tavern"
            }
          }
        }
      },
      "subcategories": [
        {
          "key": "upscale_inns",
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
                  }
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

## Migration from Older Formats

### From 3.1.1
- Convert individual entry values to localized objects where needed
- Update `format` to "3.1.2"
- Existing files work without changes (backward compatible)

### From 3.1.0
- Add `entry_metadata` section to categories
- Update `format` to "3.1.1" (or directly to "3.1.2")
- Existing files work without changes (backward compatible)

### From 3.0.x
- Convert to 3.1.0 structure first
- Then add `entry_metadata` sections
- All existing functionality preserved

### From 2.x
- Full migration required
- Use conversion tools or manual restructuring
- No metadata support in legacy formats

## Best Practices

1. **Always include both German and English labels**
   ```json
   "quality": {
     "de": "Qualität",
     "en": "Quality"
   }
   ```

2. **Use descriptive Unicode emojis for icons**
   ```json
   "icon": {
     "type": "unicode",
     "value": "⭐"
   }
   ```

3. **Provide value mappings for enumerated fields**
   ```json
   "values": {
     "de": {
       "luxury": "Luxus",
       "excellent": "Exzellent"
     },
     "en": {
       "luxury": "Luxury",
       "excellent": "Excellent"
     }
   }
   ```

4. **Keep field names consistent across files**
   - Use the same field names (e.g., "quality", "type") across different species/categories
   - This enables better pattern recognition and consistent UX

5. **Test with multiple languages**
   - Verify all labels display correctly
   - Check value mappings work as expected
   - Test fallback behavior

## Performance Considerations

- Metadata definitions are cached for efficiency
- Field resolution uses priority system (3.1.1 → 3.1.0 fallback → generic)
- Icon and value lookups are optimized for common use cases

## Error Handling

All metadata API methods handle missing data gracefully:

- `getFieldLabel()` returns `null` if no definition found
- `getFieldIcon()` returns `null` if no icon defined
- `getLocalizedValue()` returns original value if no mapping exists
- `hasEntryMetadata()` returns `false` for non-existent categories

This ensures backward compatibility and prevents runtime errors when working with mixed format versions.