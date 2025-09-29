# Changelog

All notable changes to the Nomina Names module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-01-30

### Fixed
- **Emergency Button UI**: Fixed oversized emergency name button in Foundry VTT v12 chat window
  - Reduced button padding from 8-12px to 4px 8px
  - Reduced font size from 12-14px to 11px
  - Added max-height constraint (24px) for consistent sizing
  - Changed to inline-flex display for better integration
  - Button now properly fits in chat window without taking excessive vertical space

## [2.0.0] - 2025-01-21

### 🎉 Major Update - Complete Redesign

This is a massive update that completely overhauls the Nomina Names module with a brand new interface, improved flexibility, and better translations!

### ✨ What's New for Users

- **🎨 Completely Redesigned Interface**
  - Modern, professional design with smooth animations
  - Better organized controls and clearer layout
  - Improved visual feedback and hover effects
  - More intuitive user experience

- **🌍 Improved Translations & Localization**
  - Better German and English translations throughout the module
  - More consistent naming across all categories
  - Cleaner language file structure

- **📦 New Content Categories**
  - Added new category types: Pets & Companions, Weapons
  - More diverse name generation options
  - Expanded settlement and location names

- **🎯 Enhanced Name Generation**
  - More flexible name combinations
  - Better quality and variety of generated names
  - Improved formatting options

- **🔌 New API for Module Integration**
  - Third-party modules can now easily add their own name lists and categories
  - External content integration without modifying core files
  - Simplified workflow for content creators and module developers
  - Better interoperability with other Foundry VTT modules

- **🐛 Bug Fixes & Stability**
  - Fixed various UI glitches and display issues
  - Improved compatibility with Foundry VTT v12 and v13
  - Better error handling and performance
  - Fixed design inconsistencies

### 🔧 Technical Improvements (for Developers)

- **JSON Format 3.1.0**: Revolutionary self-contained translation system
  - Category-level `displayName` objects for integrated translations
  - Self-contained JSON files that don't require language file modifications
  - Dynamic category registration without code changes
  - Backwards compatible with existing 3.0.0 and 3.0.1 formats

- **Enhanced Localization System**
  - Priority-based translation resolution (JSON displayName → i18n → fallback)
  - Support for mixed environments (some categories with JSON translations, others with traditional i18n)
  - Language fallback chain: current language → English → German → any available → capitalized key

- **Dynamic Content System**
  - Categories can now be added by simply creating JSON files and updating index.json
  - No code modifications required for new categories like "pets", "weapons", "vehicles", etc.
  - Automatic category type detection and UI integration

- **Code Architecture**
  - New modular structure with `name-generator.js` and `species-manager.js`
  - Enhanced data manager with improved caching
  - New validation system for data files
  - Better API integration and extensibility

### 📚 Documentation
- **JSON Format Specification**: Complete 3.1.0 format documentation with examples
- **Developer Guide**: New section on creating self-contained categories
- **Migration Guide**: Step-by-step instructions for upgrading from 3.0.1 to 3.1.0
- **API Documentation**: Updated with new 3.1.0 features and capabilities

## [1.2.11] - Previous Release

### Features
- Basic 3.0.0/3.0.1 format support
- Traditional i18n localization system
- Manual category configuration in index.json
- Core name generation functionality

---

## Migration Guide for 3.1.0

### For Content Creators

#### Upgrading Existing Files
1. Change `format` field from "3.0.1" to "3.1.0"
2. Add category-level `displayName`:
   ```json
   "data": {
     "pets": {
       "displayName": {
         "de": "Haustiere & Begleiter",
         "en": "Pets & Companions"
       },
       "subcategories": [...]
     }
   }
   ```
3. Test in your setup
4. Optionally remove corresponding entries from language files

#### Creating New Categories
1. Create your JSON file with format 3.1.0
2. Include category-level displayName
3. Add entry to index.json files array
4. No code changes needed - category appears automatically!

### For Module Developers

#### Benefits
- **Simplified Integration**: No need to modify language files
- **Self-Contained Modules**: Everything in one JSON file
- **Dynamic Categories**: Add new content types without code changes
- **Backwards Compatibility**: Existing integrations continue working

#### API Enhancements
- Enhanced `getLocalizedCategoryName()` with context support
- New `getCategoryDisplayName()` method for cached lookups
- Improved category detection and UI integration

### Compatibility
- ✅ **3.0.0 Format**: Full backwards compatibility
- ✅ **3.0.1 Format**: Full backwards compatibility
- ✅ **Legacy Formats**: Continued support with fallbacks
- ✅ **Mixed Environments**: 3.1.0 files can coexist with older formats
- ✅ **Existing APIs**: All existing module integrations continue working

---

*This changelog documents the evolution of the Nomina Names module. For detailed technical specifications, see the [JSON Format Specification](docs/json-format-specification.md) and [Developer Guide](docs/developer-guide.md).*