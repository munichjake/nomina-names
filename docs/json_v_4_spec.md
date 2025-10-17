# JSON Format 4.0 – **Complete Specification** (English)

> **Purpose.** A single, uniform JSON format to power curated and generative content for TTRPG/Fantasy tooling (names, ships, shops, books, weapons, pets, toponyms, etc.). The spec is written for **third‑party plugin developers**. It is deliberately exhaustive: every concept, field, default, and algorithm is explained with runnable examples, request/response shapes, and edge‑cases.
>
> **Scope.** A **Package** is the smallest deliverable unit (one JSON file). An **Index** enumerates available packages in multiple languages and species; a future **Bundle** groups packages for thematic sets. This document defines all three.

---

## 0. Terminology & Design Goals

- **Package**: one JSON file that contains **catalogs** (curated lists) and optional **recipes** (declarative combination rules). Replaces earlier terms like "module" to avoid conflicts with Foundry.
- **Catalog**: a flat list of **items** (e.g., first names, ship names, bookstore names). Items share one uniform schema.
- **Recipe**: a pattern that builds an output string by **selecting** from catalogs (and optionally generators), plus optional post‑transforms. Recipes may reference grammar (`langRules`) for preposition+article phrases.
- **Index**: a registry that maps species+category to one or more package files per display language.
- **Bundle**: (optional, future) a collection of packages that the runtime can load as a thematic set (e.g., "Pirate Crew").
- **Display Language vs. Phonetic Language**:
  - **displayName** and **item text `t.{lang}`** are **UI display** strings. They may exist for multiple locales. Missing locales fallback to the first declared language in `package.languages`.
  - **phoneticLanguage** declares the **sound/shape** the content aims for (e.g., an elven names package can display in German, but the names are designed to sound English‑like). This does **not** change labeling; it informs generation/guidelines.

**Design goals**
1) **Uniformity** across all categories. 2) **Flat data**; no deep trees. 3) **Everything optional by default** except a small core; easy to evolve. 4) **Typed but permissive** via required/optional fields and JSON‑Schema. 5) **Deterministic** outputs when seeded; **weighted random** otherwise.

---

## 1. Package File – Root Structure

A package is a single JSON document:

```json
{
  "format": "4.0.0",                       // Required. Exact string.
  "package": {                              // Required
    "code": "elf",                         // Required. Stable technical code.
    "displayName": { "en": "Elves" },     // Required. UI labels per locale.
    "languages": ["en"],                    // Required. Display locales; first = fallback.
    "phoneticLanguage": "en"                // Optional. Content sound/shape reference.
  },

  "catalogs": {                             // Required. ≥1 catalog
    /* see §2 */
  },

  "recipes": [                              // Optional. 0..n recipes
    /* see §3 */
  ],

  "output": {                               // Optional. Global output options
    /* see §4 */
  },

  "langRules": {                            // Optional. Grammar rules per language
    /* see §5 */
  },

  "vocab": {                                // Optional. Vocabulary for tags and UI
    /* see §6 */
  },

  "collections": [                          // Optional. Predefined filter sets
    /* see §7 */
  ]
}
```

### 1.1 Required vs Optional (Package Root)

| Field            | Required | Type   | Default | Notes |
|------------------|:-------:|--------|---------|-------|
| `format`         |  yes    | string | —       | Must be exactly `"4.0.0"`.
| `package`        |  yes    | object | —       | See §1.2.
| `catalogs`       |  yes    | object | —       | Must contain ≥1 catalog; keys are catalog ids.
| `recipes`        |   no    | array  | `[]`    | If absent, consumers may still pick directly from catalogs.
| `output`         |   no    | object | `{}`    | Global transforms & uniqueness; see §4.
| `langRules`      |   no    | object | `{}`    | Grammar tables; see §5.
| `vocab`          |   no    | object | `{}`    | Vocabulary for tag translations and icons; see §6.
| `collections`    |   no    | array  | `[]`    | Predefined filter sets for common queries; see §7.

### 1.2 `package` Object (Metadata)

| Field                | Required | Type            | Default | Constraints |
|----------------------|:-------:|-----------------|---------|-------------|
| `code`               |  yes    | string          | —       | Lowercase recommended; stable (not translated).
| `displayName`        |  yes    | object{lang→str}| —       | Must include at least one locale key.
| `languages`          |  yes    | array<string>   | —       | First element is the display fallback.
| `phoneticLanguage`   |   no    | string          | —       | BCP‑47 recommended (e.g., `en`, `de`); purely descriptive for content design and generators.

**Display vs Phonetic**: `displayName` and all item texts `t.{lang}` are **display strings**; `phoneticLanguage` documents the **intended sound** of the content. E.g., a dwarven name list might ship `t.en` and `t.de` while also stating `phoneticLanguage: "de"` to hint a Germanic sound.

---

## 2. Catalogs – Structure, Items, Semantics

A catalog is a flat collection of items with a uniform item schema. Catalog keys are developer‑chosen ids (e.g., `names_elf`, `ships_elf`).

```json
"catalogs": {
  "names_elf": {
    "displayName": { "en": "Elven First Names", "de": "Elfen‑Vornamen" },
    "items": [ /* item objects */ ]
  }
}
```

### 2.1 Catalog Object

| Field          | Required | Type                 | Default | Notes |
|----------------|:-------:|----------------------|---------|-------|
| `displayName`  |  yes    | object{lang→string}  | —       | UI label for the catalog itself.
| `items`        |  yes    | array<item>          | —       | See item schema (§2.2).

### 2.2 Item Schema (Uniform for all domains)

```json
{
  "t": { "en": "Loraadis", "de": "Loraadis" },   // Required: display text(s)
  "tags": ["first_name","female","elf"],         // Optional: fine‑grained labels
  "kinds": ["name"],                                  // Optional: coarse roles (e.g., name, ship, settlement)
  "w": 1,                                              // Optional: weight (positive number). Default 1.
  "gram": {                                            // Optional: grammar hints per language
    "de": { "article": "none|def", "gender": "m|f|n|pl" }
  },
  "attrs": { "rarity": "rare" },                    // Optional: domain attributes (e.g., damage, material)
  "ext": { }                                           // Optional: vendor extension namespace
}
```

**Field semantics**
- `t`: **Required**. A map of locale codes to display strings. Consumers read `t[requestedLocale]` or fallback to the first language in `package.languages`.
- `tags`: Optional. Any number of string tags (e.g., `"female"`, `"merchant_ship"`, `"forest"`). Used by `where` filters.
- `kinds`: Optional. Coarse roles for multi‑role items (e.g., "Kreuzberg" as `settlement` and as `mountain`).
- `w`: Optional. Weight for weighted random selection. Must be a positive finite number (integers recommended). Default `1`.
- `gram`: Optional. Grammar hints per language. See §5 for how `pp` uses this (`article` + `gender`). If omitted, the runtime assumes **no article**.
- `attrs`: Optional. Domain data (e.g., for weapons: `{ "damage": "1d8", "material":"steel" }`).
- `ext`: Optional. Reserved for plugin‑specific data; **must not** conflict with top‑level fields.

**Item identity**
- An item is identified by its **array position** at load time. Runtimes may capture a stable internal id if needed, but the spec does not require an `id` field for items.

---

## 3. Recipes – Patterns, Selection, Grammar, Transforms

Recipes are optional but recommended. They describe **how to produce an output string**.

```json
"recipes": [
  {
    "id": "full_name",
    "displayName": { "en": "Full Name" },
    "oneOf": [                         // either `oneOf` or `pattern` must exist
      { "pattern": [ /* blocks */ ] },
      { "pattern": [ /* blocks */ ] }
    ],
    "post": ["TitleCase","CollapseSpaces"]
  }
]
```

### 3.1 Required vs Optional (Recipe)

| Field          | Required | Type                 | Default | Notes |
|----------------|:-------:|----------------------|---------|-------|
| `id`           |  yes    | string               | —       | Unique within the package.
| `displayName`  |  yes    | object{lang→string}  | —       | UI label for this recipe.
| `pattern`      |  no¹    | array<block>         | —       | ¹Required **if** `oneOf` is absent.
| `oneOf`        |  no¹    | array<{ref|pattern,w}>| —       | ¹Required **if** `pattern` is absent.
| `post`         |   no    | array<string>        | `[]`    | Post‑transforms; see §4.2.

### 3.2 Pattern Blocks (Formal)

A pattern is a left‑to‑right sequence of **blocks**. Valid block kinds:

- **`select` block** (pick from a source - legacy syntax)
- **`generate` block** (generate content from catalogs or recipes - **recommended**)
- **`literal` block** (insert a fixed string)
- **`pp` block** (build preposition+article+name phrase)

```json
// SELECT block (LEGACY - use GENERATE block instead)
{
  "select": {
    "from": "catalog" | "generator" | "bundle"* | "external"*,  // `bundle`/`external` are optional extensions
    "key": "<id>",                    // required for `catalog` and `generator`
    "where": {                         // optional filter; see §3.3
      "kinds": ["…"],                 // ANY-of match
      "tags":  ["…","…"]            // ALL-of match
      /* optional extended filters: anyOfTags, noneOfTags */
    },
    "params": { /* generator/external parameters (optional) */ }
  },
  "as": "Alias",                      // optional: store this pick under an alias
  "distinctFrom": ["AliasA", "AliasB"] // optional: ensure different item identity
}
```

```json
// GENERATE block (RECOMMENDED - new in v4.1)
{
  "generate": {
    "from": "<package/category>" | "recipe" | "catalog",  // Source - see details below
    "collection": "<collection-id>",  // Optional: collection to use for generation
    "key": "<id>",                     // Optional: explicit recipe or catalog key (for "recipe"/"catalog" mode)
    "where": {                          // Optional: additional filter (catalog mode only)
      "kinds": ["…"],                  // ANY-of match
      "tags":  ["…","…"]             // ALL-of match
    }
  },
  "as": "Alias",                       // Optional: store under an alias
  "transform": "Demonym" | "possessive" // Optional: apply transformation
}
```

**GENERATE block details:**

**IMPORTANT: GENERATE always produces complete, generated results. To pick individual catalog items, use SELECT.**

- **Simplified Syntax (RECOMMENDED)**: `"from": "packageName"`
  - Automatically finds and executes recipes from collections
  - With `collection`: Executes random recipe from specified collection
    - Example: `{ "from": "settlements", "collection": "procedural_settlements" }`
    - Finds collection with key "procedural_settlements"
    - Picks random recipe from collection's recipe list
    - Executes recipe to generate complete name (e.g., "Ironforge", "Steelhold")

  - Without `collection`: Uses first available collection with recipes
    - Example: `{ "from": "settlements" }`
    - Searches for first collection in package that has recipes defined
    - Executes random recipe from that collection
    - Useful for simple generation without specifying collection

- **Explicit Syntax**: `"from": "recipe"` or `"from": "catalog"`
  - **`from: "recipe"`**: Execute a specific recipe by ID
    - `key`: Recipe ID from the same package (required)
    - Example: `{ "from": "recipe", "key": "settlement_compound" }`
    - Direct recipe execution with full control

  - **`from: "catalog"`**: Generate from catalog with collection-based recipe execution
    - `key`: Catalog name (local) or `"packageCode:catalogName"` (cross-package)
    - `collection`: Collection key (required for recipe execution)
    - Example: `{ "from": "catalog", "key": "dwarf-en:settlements", "collection": "mountain_settlements" }`
    - Cross-package generation support

- **`transform`**: Apply a transformation to the generated text
  - `"Demonym"`: Convert place name to inhabitant name (e.g., "Ironforge" → "Ironfordian" [EN], "Hamburg" → "Hamburger" [DE])
  - `"possessive"` or `"genitive"`: Convert to possessive form (e.g., "Peter" → "Peter's" [EN], "Peter" → "Peters" [DE])
  - Transforms are locale-aware and applied before the text is added to output

**GENERATE vs SELECT:**
- **GENERATE**: Always produces complete, generated results (executes recipes)
- **SELECT**: Picks individual items from catalogs (raw catalog entries)

```json
// LITERAL block
{ "literal": { "en": ", ", "de": ", " } }     // Required: locale map or a single string "text"
```

```json
// PP block (preposition + article + referenced name)
{
  "pp": {
    "prep": "an" | "bei" | "of" | "at" | "near" | "…",   // optional if you only want the article
    "ref": "Alias" | { "select": { /* inline SELECT, same shape as above */ } }
  }
}
```

**Notes**
- `bundle` and `external` are **extensions**. The core v4 spec only normatively defines `catalog` and `generator`. See §9.4 for extension guidance.
- If `prep` is given, **do not** print a separate literal preposition; the `pp` block outputs the preposition itself.
- A `pp` reference can be an alias (previous `select` with `as`) or an inline `select` (handy when you don’t need to reuse the pick elsewhere).

### 3.3 `where` Filter Semantics (Normative)

Given a candidate item with arrays `item.kinds` and `item.tags` (both optional):

- `where.kinds`: **ANY‑of** logic. The candidate matches if **intersection**(`item.kinds`, `where.kinds`) ≠ ∅. If either side is missing/empty, the candidate does **not** match unless `where.kinds` is omitted entirely.
- `where.tags`: **ALL‑of** logic. The candidate matches if `where.tags` ⊆ `item.tags`. If `item.tags` is missing and `where.tags` is provided, the candidate does **not** match.
- Extended (optional) filters a runtime **may** support:
  - `anyOfTags`: **ANY‑of** tags must be present.
  - `noneOfTags`: **NONE** of these tags may be present (exclusion).

**Weighting & random selection**
1. Filter candidates according to `where`.
2. If the filtered set is empty → **selection error** (see §8.3).
3. Otherwise, select **weighted random** with weights `w` (default 1). If a **seed** is provided at request time, the result MUST be deterministic for the same inputs.

**Distinctness**
- `distinctFrom` compares **item identity** (by index or internal id). If identity is equal, the pick is retried up to an implementation‑defined limit (recommended: 20 attempts), else returns a selection error.

### 3.4 `pp` Phrase Construction (Normative)

`pp` produces a language‑aware phrase. Algorithm:

1. Resolve **target item** via `ref` (alias or inline select).
2. Determine **case** from `langRules[locale].prepCase[prep]` (e.g., `an → dat`). If `prep` omitted, use the language default or skip case‑marking.
3. Inspect `target.gram[locale]`:
   - If `article: "none"` (or `gram` missing) → phrase is simply `prep + Name` (or just `Name` if `prep` omitted).
   - If `article: "def"`, lookup article by `articles.def[case][gender]`.
4. Concatenate tokens: `[prep] [article?] [Name]`.
5. Apply contractions from `langRules[locale].contractions` (e.g., `"an dem" → "am"`).

**Example (German)**
- Mountain item: `gram.de = { article: "def", gender: "m" }`, `prep = "an"` → case `dat`, article `dem`, contraction → `am` → output: `am Kreuzberg`.
- City item: `gram.de = { article: "none" }`, `prep = "bei"` → output: `bei Heuburg`.

### 3.5 Examples – Names (first/bynam/last/title)

**Catalogs**
```json
"catalogs": {
  "first_names": {
    "displayName": { "en": "First Names" },
    "items": [
      { "t": { "en": "Aerendil" }, "tags": ["male"] },
      { "t": { "en": "Loraadis" }, "tags": ["female"] }
    ]
  },
  "last_names": {
    "displayName": { "en": "Last Names" },
    "items": [
      { "t": { "en": "Stoneclaw" } },
      { "t": { "en": "Ironfist" } }
    ]
  },
  "bynames": {
    "displayName": { "en": "Bynames" },
    "items": [
      { "t": { "en": "the Bold", "de": "der Kühne" } },
      { "t": { "en": "the Wanderer", "de": "der Wanderer" } }
    ]
  },
  "titles": {
    "displayName": { "en": "Titles" },
    "items": [
      { "t": { "en": "Lord", "de": "Fürst" } },
      { "t": { "en": "High Mage", "de": "Hochmagier" } }
    ]
  }
}
```

**Recipe**
```json
"recipes": [
  {
    "id": "full_name",
    "displayName": { "en": "Full Name" },
    "oneOf": [
      { "pattern": [
        { "select": { "from": "catalog", "key": "first_names" }, "as": "FN" },
        { "literal": { "en": " " } },
        { "select": { "from": "catalog", "key": "last_names" }, "as": "LN" }
      ]},
      { "pattern": [
        { "select": { "from": "catalog", "key": "first_names" }, "as": "FN" },
        { "literal": { "en": " " } },
        { "select": { "from": "catalog", "key": "bynames" }, "as": "BN" },
        { "literal": { "en": " " } },
        { "select": { "from": "catalog", "key": "last_names" }, "as": "LN" }
      ]},
      { "pattern": [
        { "select": { "from": "catalog", "key": "titles" }, "as": "T" },
        { "literal": { "en": " " } },
        { "select": { "from": "catalog", "key": "first_names" }, "as": "FN" },
        { "literal": { "en": " " } },
        { "select": { "from": "catalog", "key": "last_names" }, "as": "LN" }
      ]}
    ],
    "post": ["CollapseSpaces"]
  }
]
```

**Runtime Request → Response**
```json
// Request
{ "n": 5, "locale": "en", "recipes": ["full_name"], "seed": "af3c92e7" }
```
```json
// Response
{
  "suggestions": [
    { "text": "Aerendil Stoneclaw",          "recipe": "full_name", "seed": "af3c92e7:0", "parts": {"FN":"Aerendil","LN":"Stoneclaw"} },
    { "text": "Loraadis the Bold Ironfist",  "recipe": "full_name", "seed": "af3c92e7:1", "parts": {"FN":"Loraadis","BN":"the Bold","LN":"Ironfist"} },
    { "text": "Lord Aerendil Stoneclaw",     "recipe": "full_name", "seed": "af3c92e7:2", "parts": {"T":"Lord","FN":"Aerendil","LN":"Stoneclaw"} }
  ]
}
```

### 3.6 Examples – Toponyms with Grammar (`pp`)

**Catalog**
```json
"catalogs": {
  "toponyms": {
    "displayName": { "en": "Toponyms" },
    "items": [
      { "t": {"en":"Kreuzberg"}, "kinds":["settlement"], "tags":["town"],    "gram":{"de":{"article":"none"}} },
      { "t": {"en":"Kreuzberg"}, "kinds":["mountain"],  "tags":["peak"],    "gram":{"de":{"article":"def","gender":"m"}} },
      { "t": {"en":"Heuburg"},   "kinds":["settlement"], "tags":["village"], "gram":{"de":{"article":"none"}} },
      { "t": {"en":"Heuburg"},   "kinds":["castle"],     "tags":["fortress"],"gram":{"de":{"article":"def","gender":"f"}} }
    ]
  }
}
```

**Recipes**
```json
"recipes": [
  { "id": "settlement_at_mountain", "displayName": {"en":"Settlement at Mountain"},
    "pattern": [
      { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S" },
      { "literal": {"en":" "} },
      { "pp": { "prep": "an", "ref": { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["mountain"]}} } } }
    ],
    "post": ["TitleCase","CollapseSpaces"] },

  { "id": "settlement_near_settlement", "displayName": {"en":"Settlement near Settlement"},
    "pattern": [
      { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S1" },
      { "literal": {"en":" near "} },
      { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S2", "distinctFrom":["S1"] }
    ],
    "post": ["TitleCase","CollapseSpaces"] },

  { "id": "settlement_near_castle", "displayName": {"en":"Settlement near Castle"},
    "pattern": [
      { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S" },
      { "literal": {"en":" "} },
      { "pp": { "prep": "bei", "ref": { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["castle"]}} } } }
    ],
    "post": ["TitleCase","CollapseSpaces"] }
]
```

**Possible Outputs (locale `de`)**
- `Heuburg am Kreuzberg` (mountain m, `an dem`→`am`)
- `Kreuzberg bei Heuburg` (both settlements, no article)
- `Kreuzberg bei der Heuburg` (castle f, `bei der`)

### 3.7 Examples – GENERATE Block with Transforms

The `generate` block provides a cleaner, more semantic syntax for content generation with built-in support for transformations and cross-package references.

**IMPORTANT:** GENERATE always produces complete, generated results by executing recipes. To pick individual catalog items (like prefixes or suffixes), use SELECT instead.

**Example 1: Simplified Syntax with Collection (RECOMMENDED)**

```json
{
  "id": "settlement_beer",
  "displayName": { "en": "Settlement Beer" },
  "pattern": [
    {
      "generate": {
        "from": "settlements",
        "collection": "procedural_settlements"
      },
      "transform": "Demonym"
    },
    { "literal": " " },
    {
      "select": {
        "from": "catalog",
        "key": "beer_styles"
      }
    }
  ],
  "post": ["TitleCase", "CollapseSpaces"]
}
```

**What happens:**
1. Finds collection "procedural_settlements" in settlements package
2. Picks random recipe from collection (e.g., "procedural_template_0")
3. Executes recipe → generates "Ironforge", "Steelhold", etc.
4. Applies Demonym transform → "Ironfordian", "Steelholdian"
5. Adds beer style → "Ironfordian Lager", "Steelholdian Bock"

**Output:** "Ironfordian Lager", "Steelholdian Bock"

**Example 2: Simplified Syntax without Collection**

```json
{
  "id": "quick_settlement_beer",
  "displayName": { "en": "Quick Settlement Beer" },
  "pattern": [
    {
      "generate": {
        "from": "settlements"  // Uses first available collection with recipes
      },
      "transform": "Demonym"
    },
    { "literal": " " },
    {
      "select": {
        "from": "catalog",
        "key": "beer_styles"
      }
    }
  ],
  "post": ["TitleCase"]
}
```

**What happens:**
1. Searches for first collection in settlements package that has recipes
2. Finds "procedural_buildings" or "procedural_settlements"
3. Executes random recipe from that collection
4. Generates complete settlement name

**Output:** "Copperkeep Ale", "Bronzehall Stout"

**Example 3: Cross-Package Reference with Explicit Syntax**

```json
{
  "id": "brand_from_dwarf_settlements",
  "displayName": { "en": "Brand from Dwarf Settlements" },
  "pattern": [
    {
      "generate": {
        "from": "catalog",
        "key": "dwarf-en:settlements",
        "collection": "procedural_settlements"
      },
      "transform": "Demonym",
      "as": "TOPONYM"
    },
    { "literal": " " },
    {
      "select": {
        "from": "catalog",
        "key": "beer_styles"
      }
    }
  ],
  "post": ["TitleCase"]
}
```

**What happens:**
1. References settlements catalog from dwarf-en package (cross-package)
2. Uses collection "procedural_settlements"
3. Executes recipe to generate settlement name

**Output:** "Ironpeakian Lager", "Stonehavenite Ale"

**Example 4: Explicit Recipe Execution**

```json
{
  "id": "complex_brand",
  "displayName": { "en": "Complex Brand" },
  "pattern": [
    {
      "generate": {
        "from": "recipe",
        "key": "procedural_template_0"
      },
      "transform": "Demonym"
    },
    { "literal": " " },
    {
      "select": {
        "from": "catalog",
        "key": "beer_styles"
      }
    }
  ],
  "post": ["TitleCase"]
}
```

**What happens:**
1. Directly executes recipe "procedural_template_0"
2. Full control over which recipe is used
3. No collection lookup needed

**Output:** "Mithrilforger Pilsner", "Goldhallic Wheat"

**Example 5: Possessive Transform**

```json
{
  "id": "possessive_brewery",
  "displayName": { "en": "Possessive Brewery" },
  "pattern": [
    {
      "generate": {
        "from": "names",
        "collection": "surnames"
      },
      "transform": "possessive"
    },
    { "literal": " " },
    {
      "select": {
        "from": "catalog",
        "key": "brewery_types"
      }
    }
  ],
  "post": ["TitleCase"]
}
```

**Output (EN):** "Ironhammer's Brewery", "Stonefist's Tavern"
**Output (DE):** "Eisenhammers Brauerei", "Steinfausts Taverne"

**GENERATE vs SELECT - When to use which:**

```json
// ✅ GENERATE: For complete, generated content
{ "generate": { "from": "settlements", "collection": "procedural" } }
// → Executes recipe → "Ironforge", "Steelhold"

// ✅ SELECT: For individual catalog items
{ "select": { "from": "catalog", "key": "settlements", "where": { "tags": ["prefix"] } } }
// → Picks item → "Iron", "Steel", "Copper"
```

---

## 4. Output – Global Options & Transforms

```json
"output": {
  "transforms": ["TrimSpaces","CollapseSpaces"],
  "uniqueWithinBatch": true
}
```

### 4.1 Fields

| Field               | Required | Type           | Default | Description |
|---------------------|:-------:|----------------|---------|-------------|
| `transforms`        |   no    | array<string>  | `[]`    | Global default transforms applied after each recipe.
| `uniqueWithinBatch` |   no    | boolean        | `false` | If true, the engine must reject duplicates within a single response and retry up to a limit.

### 4.2 Standard Transforms (Normative Names)

- `TrimSpaces`: trim leading/trailing whitespace.
- `CollapseSpaces`: collapse runs of spaces/tabs to a single space.
- `TitleCase`: title‑case per locale (simplified: capitalize first letter of words; leave particles like *of, the* as‑is).
- `ConcatNoSpace`: remove all spaces between blocks (useful for compounds like `Granit` + `heim` → `Granitheim`).
- `NormalizeUmlauts`: optional ASCII fallback (ä→ae, ö→oe, ü→ue, ß→ss). **Not** applied unless explicitly included.

Runtimes may safely add vendor transforms under a namespaced name (e.g., `vendorX.Slugify`).

---

## 5. Language Rules (`langRules`) – Grammar Tables

`langRules` define minimal grammar needed by `pp`. Omit if your packages never use `pp`.

```json
"langRules": {
  "de": {
    "prepCase": { "an": "dat", "bei": "dat" },
    "articles": {
      "def": {
        "dat": { "m": "dem", "n": "dem", "f": "der", "pl": "den" }
      }
    },
    "contractions": { "an dem": "am", "bei dem": "beim" },
    "defaults": { "articleWhenNone": "omit" }
  }
}
```

- `prepCase`: which grammatical case a preposition imposes.
- `articles.def[case][gender]`: definite article lookup.
- `contractions`: token joins (e.g., `an dem` → `am`).
- `defaults.articleWhenNone`: `"omit"` (no article) or runtime‑specific behavior.

---

## 6. Index File – Discovery, Locales, Species Labels

The index registers all packages and their language variants.

```json
{
  "format": "4.0.0",           // Required
  "version": "1.0.0",          // Required

  "locales": {                   // Required
    "default": "en",            // Required
    "fallbacks": { "en": ["de"], "de": ["en"] } // Optional
  },

  "species": {                   // Optional but recommended
    "elf":   { "displayName": { "en": "Elves",   "de": "Elfen" } },
    "human": { "displayName": { "en": "Humans",  "de": "Menschen" } }
  },

  "packages": [                  // Required
    {
      "species": "elf",         // Required
      "category": "names",      // Required
      "files": [                 // Required (≥1)
        { "path": "en.elf.names.v4.json", "language": "en", "enabled": true },
        { "path": "de.elf.names.v4.json", "language": "de", "enabled": true }
      ]
    }
  ],

  "bundles": [                   // Optional (future)
    {
      "code": "pirate-crew",    // Required
      "displayName": { "en": "Pirate Crew" }, // Required
      "includes": [               // Required (≥1)
        { "species": "human", "category": "names" },
        { "species": "elf",   "category": "ships" }
      ]
    }
  ]
}
```

### 6.1 Loader Behavior (Normative)

1. For each `packages[]` entry, choose `files[]` whose `language` equals the requested locale; else follow `locales.fallbacks`; else use `locales.default`.
2. Load the chosen package JSON. Optionally layer additional files as translation overlays for missing `t.{lang}` only (implementation choice).
3. Expose `species[code].displayName[locale]` for UI; **do not** translate `package.code`.

---

## 7. Runtime API – Request/Response & Determinism

Runtimes may expose a simple generation API. Recommended shapes:

```json
// Request
{
  "n": 5,                               // Required. Number of suggestions.
  "locale": "en",                      // Required. Display locale.
  "recipes": ["full_name"],            // Required. 1..n recipe ids.
  "seed": "af3c92e7",                  // Optional. If present → deterministic.
  "distinctBy": "identity|text",       // Optional. Default: implementation defined.
  "allowDuplicates": false              // Optional. Overrides output.uniqueWithinBatch.
}
```

```json
// Response
{
  "suggestions": [
    {
      "text": "Aerendil Stoneclaw",        // Final display string
      "recipe": "full_name",               // Recipe id used
      "seed": "af3c92e7:0",                // Derived sub‑seed per suggestion
      "parts": { "FN": "Aerendil", "LN": "Stoneclaw" } // Optional: debug/UX
    }
  ],
  "errors": [ /* optional structured errors, see §8 */ ]
}
```

**Determinism**
- With a `seed`, the engine MUST produce identical outputs for identical inputs (same package file, same request, same locale). Use a stable PRNG (e.g., splitmix64/pcg) and derive per‑pick sub‑seeds (`seed:idx:path`).

**Uniqueness**
- If `output.uniqueWithinBatch` or request overrides demand uniqueness, the engine should retry conflicts up to a limit (recommended 20). After that, report a `duplicate_exhausted` error.

---

## 8. Errors, Validation, and Fallbacks

### 8.1 JSON Validation
- Packages and Index SHOULD be validated against the provided JSON‑Schema (Appendix A). Vendors may add additional validation.

### 8.2 Missing Locales
- If `t[locale]` is missing for an item, fall back to the first entry of `package.languages`. If still missing, the item is **invalid** and SHOULD be rejected at load time.

### 8.3 Selection Errors (Runtime)
- `no_candidates`: a `select` filter yields zero items.
- `distinct_conflict`: cannot satisfy `distinctFrom` after retries.
- `unknown_alias`: a `pp.ref` references an alias that was never defined.
- `unknown_catalog`: a `select` references a catalog key not present.
- `invalid_where`: filter keys have wrong types.

All errors SHOULD be returned as structured diagnostics, e.g.:
```json
{ "code": "no_candidates", "block": 2, "recipe": "full_name", "details": { "catalog": "first_names", "where": {"tags":["female"]} } }
```

---

## 6. Vocabulary (vocab) – Tag Translations & Icons

The optional `vocab` section provides centralized translations and icons for tags used throughout the package. This enables consistent UI display across different languages without hardcoding translations in the application.

### 6.1 Schema

```json
"vocab": {
  "fields": {
    "<fieldName>": {
      "labels": { "<lang>": "<translation>" },
      "icon": "<icon>",
      "values": {
        "<tagValue>": { "<lang>": "<translation>" }
      }
    }
  },
  "icons": {
    "<tag>": "<icon>"
  }
}
```

### 6.2 Fields Structure

A **field** represents a reusable concept (e.g., "type", "quality", "atmosphere"):

```json
"fields": {
  "type": {
    "labels": {
      "en": "Type",
      "de": "Typ"
    },
    "icon": "🏷️",
    "values": {
      "upscale_inn": {
        "en": "Upscale Inn",
        "de": "Gehobenes Gasthaus"
      },
      "common_tavern": {
        "en": "Common Tavern",
        "de": "Gewöhnliche Taverne"
      }
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labels` | object{lang→str} | no | UI label for the field itself |
| `icon` | string | no | Icon for the field (emoji recommended) |
| `values` | object | **yes** | Map of tag → translations |

**Important:** The keys in `values` must match the `tags` array values used in catalog items.

### 6.3 Icons Registry

A flat map for quick icon lookups:

```json
"icons": {
  "upscale_inn": "⭐",
  "common_tavern": "🍺",
  "harbor_tavern": "⚓",
  "merchant_ship": "🚢",
  "war_ship": "⚓",
  "pirate_ship": "🏴‍☠️"
}
```

**Usage:**
- `fields[field].icon` → icon for the **field itself** (e.g., "Type" → 🏷️)
- `vocab.icons[tag]` → icon for a **specific tag value** (e.g., "upscale_inn" → ⭐)

### 6.4 Complete Example

```json
"vocab": {
  "fields": {
    "type": {
      "labels": { "en": "Type", "de": "Typ" },
      "values": {
        "upscale_inn": { "en": "Upscale Inn", "de": "Gehobenes Gasthaus" },
        "common_tavern": { "en": "Common Tavern", "de": "Gewöhnliche Taverne" },
        "harbor_tavern": { "en": "Harbor Tavern", "de": "Hafentaverne" }
      }
    },
    "quality": {
      "labels": { "en": "Quality", "de": "Qualität" },
      "values": {
        "luxury": { "en": "Luxury", "de": "Luxuriös" },
        "standard": { "en": "Standard", "de": "Standard" }
      }
    }
  },
  "icons": {
    "upscale_inn": "⭐",
    "common_tavern": "🍺",
    "harbor_tavern": "⚓",
    "luxury": "💎",
    "standard": "⚪"
  }
}
```

---

## 7. Collections – Predefined Filter Sets

The optional `collections` array defines commonly-used filter queries that applications can present as quick-access options in the UI.

### 7.1 Schema

```json
"collections": [
  {
    "key": "upscale_inns",
    "labels": {
      "en": "Upscale Inns",
      "de": "Gehobene Gasthäuser"
    },
    "description": {
      "en": "High-quality establishments",
      "de": "Hochwertige Einrichtungen"
    },
    "query": {
      "category": "taverns",
      "tags": ["upscale_inn"],
      "filters": { "quality": "luxury" },
      "limit": 100
    },
    "staticMembers": []
  }
]
```

### 7.2 Collection Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | **yes** | Unique identifier (lowercase, underscores) |
| `labels` | object{lang→str} | **yes** | Display name per locale |
| `description` | object{lang→str} | no | Optional description |
| `query` | object | no* | Filter query (see below) |
| `staticMembers` | array<string> | no* | Explicit item text values |

*Either `query` OR `staticMembers` must be present.

### 7.3 Query Object

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | Catalog key to filter |
| `tags` | array<string> | Items must have ALL these tags (AND logic) |
| `filters` | object | Additional attribute filters |
| `limit` | number | Maximum items to return |

### 7.4 Examples

**Query-based Collection:**
```json
{
  "key": "harbor_taverns",
  "labels": {
    "en": "Harbor Taverns",
    "de": "Hafentavernen"
  },
  "query": {
    "category": "taverns",
    "tags": ["harbor_tavern"]
  }
}
```

**Static Collection:**
```json
{
  "key": "legendary_ships",
  "labels": {
    "en": "Legendary Ships",
    "de": "Legendäre Schiffe"
  },
  "staticMembers": [
    "Flying Dutchman",
    "Black Pearl",
    "Queen Anne's Revenge"
  ]
}
```

**Mixed Collection:**
```json
{
  "key": "featured_inns",
  "labels": { "en": "Featured Inns" },
  "query": {
    "category": "taverns",
    "tags": ["upscale_inn"],
    "limit": 10
  },
  "staticMembers": ["The Golden Lion"]
}
```

---

## 8. Best Practices

### 8.1 Vocabulary Usage
- **Include all used tags** in vocab for consistent UI
- **Provide translations** for all supported languages
- **Use emoji icons** for maximum compatibility (⭐ 🍺 ⚓ 🚢)
- **Keep field names semantic** (`type`, `quality`, not `field1`)

### 8.2 Collections Design
- **Focus on common use cases** (3-10 collections per package)
- **Use descriptive keys** (`harbor_taverns`, not `collection1`)
- **Combine query + staticMembers** to highlight featured items
- **Set reasonable limits** to prevent performance issues

### 8.3 Performance
- Vocab typically adds ~5-10% to file size
- Collections with queries are computed at runtime
- Static collections are pre-resolved
- Trade-off: slightly larger files for significantly better UX

---

## 9. Extensibility & Conformance

### 9.1 Generators (`from: "generator"`)
Minimal contract:
```json
{ "select": { "from": "generator", "key": "syllables", "params": { "preset": "dwarven", "min": 2, "max": 3 } } }
```
- The generator returns a **string** for the requested locale, or an object `{ t: { lang→string } }`. Runtimes MUST treat plain strings as the `t[locale]` value.
- Generators SHOULD obey the `phoneticLanguage` hint when applicable.

### 9.2 External Sources & Bundles
- `from: "external"` and `from: "bundle"` are optional extensions. Vendors MUST namespace `key` appropriately (e.g., `vendorX.monsters`).

### 9.3 Vendor Extensions
- Use `ext` fields at item level or **namespaced transform names** (e.g., `vendorX.Slugify`).
- Do not introduce new top‑level fields without version negotiation.

### 9.4 Conformance Levels
- **Reader**: validates & reads packages; can list catalogs and items.
- **Selector**: implements `select` filters, weights, distinctness.
- **Composer**: implements `pattern`, `literal`, `pp`, transforms, and `oneOf`.

---

## 10. Migration Guide (v3 → v4)

1) **Flatten** nested subcategories into **one catalog**; move former subcategory names into `tags` (e.g., `merchant_ship`, `war_ship`).
2) **Map** multilingual strings into `t.{lang}`. Ensure at least one locale present.
3) **Introduce recipes** for common combinations (optional).
4) **Add `phoneticLanguage`** if your lists are intended to sound like a particular language.
5) **Build an index** (`index.v4.json`) referencing all packages per species/category.

---

## 11. Security & Content Guidelines (Informative)

- Avoid sensitive/PII in `t` and `attrs`.
- Keep `ext` data vendor‑scoped.
- Escape HTML if strings are shown in web contexts.

---

## 12. Testing & QA

- Provide **golden test cases**: input seed → expected suggestions.
- Validate JSON against the schema.
- Fuzz filters: ensure `no_candidates` errors are cleanly reported.
- Case & whitespace tests for transforms.

---

## Appendix A — JSON‑Schema (abridged)

> This schema is intentionally abridged for readability. Vendors may ship a stricter variant.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/json-v4.schema.json",
  "type": "object",
  "required": ["format", "package", "catalogs"],
  "properties": {
    "format": { "const": "4.0.0" },
    "package": {
      "type": "object",
      "required": ["code", "displayName", "languages"],
      "properties": {
        "code": { "type": "string" },
        "displayName": { "type": "object", "minProperties": 1, "additionalProperties": { "type": "string" } },
        "languages": { "type": "array", "minItems": 1, "items": { "type": "string" } },
        "phoneticLanguage": { "type": "string" }
      },
      "additionalProperties": false
    },
    "catalogs": {
      "type": "object",
      "minProperties": 1,
      "additionalProperties": {
        "type": "object",
        "required": ["displayName", "items"],
        "properties": {
          "displayName": { "type": "object", "minProperties": 1, "additionalProperties": { "type": "string" } },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["t"],
              "properties": {
                "t": { "type": "object", "minProperties": 1, "additionalProperties": { "type": "string" } },
                "tags": { "type": "array", "items": { "type": "string" } },
                "kinds": { "type": "array", "items": { "type": "string" } },
                "w": { "type": "number", "exclusiveMinimum": 0 },
                "gram": { "type": "object" },
                "attrs": { "type": "object" },
                "ext": { "type": "object" }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    },
    "recipes": { "type": "array" },
    "output": { "type": "object" },
    "langRules": { "type": "object" },
    "vocab": {
      "type": "object",
      "properties": {
        "fields": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "required": ["values"],
            "properties": {
              "labels": { "type": "object", "additionalProperties": { "type": "string" } },
              "icon": { "type": "string" },
              "values": {
                "type": "object",
                "additionalProperties": {
                  "type": "object",
                  "additionalProperties": { "type": "string" }
                }
              }
            }
          }
        },
        "icons": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "collections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["key", "labels"],
        "properties": {
          "key": { "type": "string" },
          "labels": { "type": "object", "minProperties": 1, "additionalProperties": { "type": "string" } },
          "description": { "type": "object", "additionalProperties": { "type": "string" } },
          "query": {
            "type": "object",
            "properties": {
              "category": { "type": "string" },
              "tags": { "type": "array", "items": { "type": "string" } },
              "filters": { "type": "object" },
              "limit": { "type": "integer", "minimum": 1 }
            }
          },
          "staticMembers": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

---

## Appendix B — Full Working Demo (Toponyms)

A minimal, self‑contained package including catalogs, recipes, output, and `langRules`; copy into a file and run against your engine to reproduce the examples in §3.6.

```json
{
  "format": "4.0.0",
  "package": { "code": "toponyms-demo", "displayName": { "en": "Toponyms – Demo" }, "languages": ["en","de"], "phoneticLanguage": "de" },
  "catalogs": {
    "toponyms": {
      "displayName": { "en": "Toponyms" },
      "items": [
        { "t": {"en":"Kreuzberg","de":"Kreuzberg"}, "kinds":["settlement"], "tags":["town"],    "gram":{"de":{"article":"none"}} },
        { "t": {"en":"Kreuzberg","de":"Kreuzberg"}, "kinds":["mountain"],  "tags":["peak"],    "gram":{"de":{"article":"def","gender":"m"}} },
        { "t": {"en":"Heuburg","de":"Heuburg"},   "kinds":["settlement"], "tags":["village"], "gram":{"de":{"article":"none"}} },
        { "t": {"en":"Heuburg","de":"Heuburg"},   "kinds":["castle"],     "tags":["fortress"],"gram":{"de":{"article":"def","gender":"f"}} }
      ]
    }
  },
  "recipes": [
    { "id": "settlement_at_mountain", "displayName": {"en":"Settlement at Mountain"},
      "pattern": [
        { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S" },
        { "literal": {"en":" "} },
        { "pp": { "prep": "an", "ref": { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["mountain"]}} } } }
      ], "post": ["TitleCase","CollapseSpaces"] },
    { "id": "settlement_near_settlement", "displayName": {"en":"Settlement near Settlement"},
      "pattern": [
        { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S1" },
        { "literal": {"en":" near "} },
        { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S2", "distinctFrom":["S1"] }
      ], "post": ["TitleCase","CollapseSpaces"] },
    { "id": "settlement_near_castle", "displayName": {"en":"Settlement near Castle"},
      "pattern": [
        { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["settlement"]}}, "as":"S" },
        { "literal": {"en":" "} },
        { "pp": { "prep": "bei", "ref": { "select": {"from":"catalog","key":"toponyms","where":{"kinds":["castle"]}} } } }
      ], "post": ["TitleCase","CollapseSpaces"] }
  ],
  "output": { "transforms": ["TrimSpaces","CollapseSpaces"], "uniqueWithinBatch": true },
  "langRules": { "de": { "prepCase": { "an": "dat", "bei": "dat" }, "articles": { "def": { "dat": { "m": "dem", "n": "dem", "f": "der", "pl": "den" } } }, "contractions": { "an dem": "am", "bei dem": "beim" }, "defaults": { "articleWhenNone": "omit" } } }
}
```

---

**End of Specification**

