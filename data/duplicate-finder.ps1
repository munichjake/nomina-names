# Pfad zur JSON-Datei
$jsonPath = "./de.aasimar.female.json"

# JSON laden
#$json = Get-Content $jsonPath -Raw | ConvertFrom-Json
$json = ConvertFrom-Json (Get-Content $jsonPath -Raw)

# Namen extrahieren
$names = $json.names

# Gesamtanzahl und eindeutige Anzahl berechnen
$totalCount   = $names.Count
$uniqueCount  = ($names | Sort-Object -Unique).Count

Write-Host "Gesamtanzahl der Namen: $totalCount"
Write-Host "Davon eindeutig:         $uniqueCount"
Write-Host ""

# Duplikate finden
$duplicates = $names | Group-Object | Where-Object { $_.Count -gt 1 } | Select-Object Name, Count

if ($duplicates) {
    Write-Host "Gefundene Duplikate:`n"
    $duplicates | Format-Table -AutoSize
} else {
    Write-Host "Keine Duplikate gefunden."
}
