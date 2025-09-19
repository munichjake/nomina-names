# Parameter für direkten Aufruf des Skripts
param(
    [string]$InputPattern = $null,
    [string]$OutputFolder = "converted"
)

function Convert-SettlementJson {
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [System.IO.FileInfo]$InputFile,
        
        [string]$OutputFolder = "converted"
    )
    
    process {
        try {
            Write-Host "Processing: $($InputFile.Name)" -ForegroundColor Green
            
            # JSON-Datei einlesen
            $jsonContent = Get-Content -Path $InputFile.FullName -Raw -Encoding UTF8
            $jsonObject = ConvertFrom-Json $jsonContent
            
            # Prüfen ob settlements Array existiert und ein Array von Strings ist
            if (-not $jsonObject.settlements) {
                Write-Warning "No 'settlements' property found in $($InputFile.Name)"
                return
            }
            
            if ($jsonObject.settlements[0] -is [string]) {
                Write-Host "Converting settlements array from string[] to object[]" -ForegroundColor Yellow
                
                # Settlements Array umwandeln
                $newSettlements = @()
                foreach ($settlement in $jsonObject.settlements) {
                    $newSettlements += @{
                        name = $settlement
                        gender = "n"
                    }
                }
                
                # Neues Array zuweisen
                $jsonObject.settlements = $newSettlements
                
                # Absoluten Pfad für Output-Ordner erstellen
                $AbsoluteOutputFolder = if ([System.IO.Path]::IsPathRooted($OutputFolder)) {
                    $OutputFolder
                } else {
                    Join-Path (Get-Location) $OutputFolder
                }
                
                # Unterordner erstellen falls nicht vorhanden
                if (-not (Test-Path $AbsoluteOutputFolder)) {
                    New-Item -ItemType Directory -Path $AbsoluteOutputFolder -Force | Out-Null
                    Write-Host "Created output folder: $AbsoluteOutputFolder" -ForegroundColor Cyan
                }
                
                # Output-Pfad mit gleichem Dateinamen im Unterordner
                $OutputPath = Join-Path $AbsoluteOutputFolder $InputFile.Name
                
                # JSON zurück konvertieren mit schöner Formatierung
                $newJsonContent = $jsonObject | ConvertTo-Json -Depth 10 -Compress:$false
                
                # Datei speichern mit UTF8-Encoding
                [System.IO.File]::WriteAllText($OutputPath, $newJsonContent, [System.Text.Encoding]::UTF8)
                
                Write-Host "Successfully converted $($InputFile.Name)" -ForegroundColor Green
                Write-Host "Converted $($jsonObject.settlements.Count) settlements" -ForegroundColor Cyan
            }
            else {
                Write-Host "File $($InputFile.Name) already appears to be in the target format (objects with name/gender)" -ForegroundColor Blue
            }
        }
        catch {
            Write-Error "Error processing $($InputFile.Name): $($_.Exception.Message)"
        }
    }
}

# Beispiel-Verwendung:
# Alle JSON-Dateien im aktuellen Verzeichnis konvertieren (Output in "converted" Ordner):
# Get-ChildItem -Filter "*.json" | Convert-SettlementJson

# Spezifische Dateien konvertieren:
# Get-ChildItem -Filter "en.*.settlements.json" | Convert-SettlementJson

# Mit benutzerdefiniertem Unterordner:
# Get-ChildItem -Filter "en.*.settlements.json" | Convert-SettlementJson -OutputFolder "deutsche_versionen"

# Mehrere Ordner gleichzeitig verarbeiten:
# Get-ChildItem -Filter "*.settlements.json" -Recurse | Convert-SettlementJson -OutputFolder "converted"

Write-Host "JSON Settlement Converter loaded!" -ForegroundColor Green
Write-Host "Usage examples:" -ForegroundColor Yellow
Write-Host "  Get-ChildItem -Filter '*.json' | Convert-SettlementJson" -ForegroundColor Gray
Write-Host "  Get-ChildItem -Filter 'en.*.settlements.json' | Convert-SettlementJson -OutputFolder 'german'" -ForegroundColor Gray

# Wenn Parameter übergeben wurden, direkt ausführen
if ($InputPattern) {
    Write-Host "Processing files matching pattern: $InputPattern" -ForegroundColor Cyan
    Get-ChildItem -Filter $InputPattern | Convert-SettlementJson -OutputFolder $OutputFolder
}