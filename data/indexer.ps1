<#
Sync-Index.ps1

Zweck:
- Läuft im aktuellen Ordner.
- Liest/erzeugt index.json.
- Fügt Einträge für vorhandene *.json-Dateien hinzu, die noch nicht im Index stehen.
- Entfernt Einträge aus dem Index, deren Dateien fehlen.
- Generiert/aktualisiert sprachspezifische Beschreibungen auf Basis von Sprach-/Spezies-/Kategorie-Codes im Dateinamen (z. B. de.human.settlements.json -> "menschlich und Städte und Siedlungen").

Nutzung:
  pwsh ./Sync-Index.ps1

Hinweise:
- Erwartetes Namensschema: <language>.<species>.<category>.json (z. B. de.human.male.json)
- index.json selbst wird ignoriert.
- Erhält vorhandene optionale Felder (z. B. enabled), falls bereits im Index vorhanden.
- Sortiert Einträge nach Dateinamen.
#>

param(
    [string]$IndexFile = "index.json",
    [switch]$Force
)

# -------------------- Hilfsfunktionen --------------------
function Get-PartsFromFilename {
    param([string]$FileName)
    $name = [System.IO.Path]::GetFileName($FileName)
    if ($name -ieq 'index.json') { return $null }
    if (-not $name.EndsWith('.json', 'OrdinalIgnoreCase')) { return $null }

    $base = $name.Substring(0, $name.Length - 5) # ohne .json
    $parts = $base.Split('.')
    if ($parts.Count -ne 3) { return $null }

    [pscustomobject]@{
        filename = $name
        language = $parts[0]
        species  = $parts[1]
        category = $parts[2]
    }
}

function Get-Description {
    param(
        [string]$Language,
        [string]$Species,
        [string]$Category
    )

    # Sprachspezifische Wörterbücher
    $speciesMap = @{
        'de' = @{
            'human'    = 'menschlich'
            'elf'      = 'Elfen'
            'dwarf'    = 'Zwerge'
            'halfling' = 'Halblinge'
            'gnome'    = 'Gnome'
        }
        'en' = @{
            'human'    = 'human'
            'elf'      = 'elfs'
            'dwarf'    = 'dwarves'
            'halfling' = 'halflings'
            'gnome'    = 'gnomes'
        }
    }

    $categoryMap = @{
        'de' = @{
            'male'       = 'Vornamen (männlich)'
            'female'     = 'Vornamen (weiblich)'
            'surnames'   = 'Nachnamen'
            'titles'     = 'Adelstitel'
            'nicknames'  = 'Beinamen'
            'settlements'= 'Städte und Siedlungen'
        }
        'en' = @{
            'male'       = 'first names (male)'
            'female'     = 'first names (female)'
            'surnames'   = 'surnames'
            'titles'     = 'noble titles'
            'nicknames'  = 'epithets'
            'settlements'= 'cities and settlements'
        }
    }

    $lang = $Language.ToLowerInvariant()
    $sp = $Species.ToLowerInvariant()
    $cat = $Category.ToLowerInvariant()

    $spLabel  = if ($speciesMap.ContainsKey($lang) -and $speciesMap[$lang].ContainsKey($sp)) { $speciesMap[$lang][$sp] } else { $sp }
    $catLabel = if ($categoryMap.ContainsKey($lang) -and $categoryMap[$lang].ContainsKey($cat)) { $categoryMap[$lang][$cat] } else { $cat }

    switch ($lang) {
        'de' { return "$spLabel und $catLabel" }
        default { return "$spLabel and $catLabel" }
    }
}

function Load-Index {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        try {
            $json = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop | ConvertFrom-Json -Depth 20
            return $json
        } catch {
            if ($Force) {
                Write-Warning "Konnte vorhandene index.json nicht lesen. Erstelle eine neue.";
            } else {
                throw "index.json ist ungültig. Nutze -Force um zu überschreiben. Fehler: $($_.Exception.Message)"
            }
        }
    }
    [pscustomobject]@{
        version     = '1.0.0'
        description = switch -Regex ((Get-Culture).Name) { '^de' { 'Index aller verfügbaren Namensdateien' } default { 'Index of all available name files' } }
        files       = @()
    }
}

function Save-Index {
    param([object]$Index, [string]$Path)
    $json = $Index | ConvertTo-Json -Depth 50 -Compress:$false
    Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

# -------------------- Hauptlogik --------------------
$index = Load-Index -Path $IndexFile

# Hash nach Dateinamen für schnellen Zugriff
$existingByFile = @{}
if ($index.files) {
    foreach ($f in $index.files) { $existingByFile[$f.filename] = $f }
}

# 1) Alle json-Dateien im Ordner erfassen (ohne index.json)
$diskFiles = Get-ChildItem -LiteralPath . -File -Filter '*.json' | Where-Object { $_.Name -ne 'index.json' }

# 2) Aus Dateien Zieldatensätze bauen
$desired = @{}
foreach ($df in $diskFiles) {
    $parts = Get-PartsFromFilename -FileName $df.Name
    if (-not $parts) { continue }

    $desc = Get-Description -Language $parts.language -Species $parts.species -Category $parts.category

    $obj = [ordered]@{
        filename    = $parts.filename
        language    = $parts.language
        species     = $parts.species
        category    = $parts.category
        description = $desc
    }

    # Bestehende optionale Felder übernehmen (z. B. enabled)
    if ($existingByFile.ContainsKey($parts.filename)) {
        $existing = $existingByFile[$parts.filename]
        foreach ($prop in $existing.PSObject.Properties.Name) {
            if ($obj.Contains($prop)) { continue }
            $obj[$prop] = $existing.$prop
        }
    }

    $desired[$parts.filename] = [pscustomobject]$obj
}

# 3) Dateien, die im Index stehen, aber fehlen -> entfernen
$toRemove = @()
foreach ($k in $existingByFile.Keys) {
    if (-not $desired.ContainsKey($k)) {
        $toRemove += $k
    }
}

if ($toRemove.Count -gt 0) {
    Write-Host "Entferne fehlende Einträge: $($toRemove -join ', ')"
}

# 4) Index.files neu zusammenbauen (nur gewünschte, sortiert)
$index.files = $desired.Values | Sort-Object filename

# 5) Speichern
Save-Index -Index $index -Path $IndexFile

Write-Host "Fertig. Einträge aktuell: $($index.files.Count)"
