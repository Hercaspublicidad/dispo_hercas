$ErrorActionPreference = 'Stop'
$root = 'D:\Aliados exteriores\Fichas_HERCAS_2026'
$manifest = Get-Content -LiteralPath (Join-Path $root 'avance.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$records = @($manifest.registros | Where-Object { $_.estado -eq 'completo' })
$app = New-Object -ComObject PowerPoint.Application
$changed = 0
$rendered = 0
$errors = [System.Collections.Generic.List[string]]::new()
try {
    foreach ($record in $records) {
        $deck = $null
        try {
            $pptx = [string]$record.ficha_editable
            $preview = [string]$record.vista_previa
            if (-not (Test-Path -LiteralPath $pptx)) { throw "Falta PPTX: $pptx" }
            $deck = $app.Presentations.Open($pptx, $false, $false, $false)
            $slide = $deck.Slides.Item(1)
            $removed = 0
            for ($i = $slide.Shapes.Count; $i -ge 1; $i--) {
                $shape = $slide.Shapes.Item($i)
                $match = ([string]$shape.Name -in @('simulacion', 'franja inferior foto'))
                if (-not $match) {
                    try { $match = ([string]$shape.TextFrame.TextRange.Text).ToUpperInvariant().Contains('SIMULACIÓN DE PAUTA HERCAS') } catch { }
                }
                if ($match) { $shape.Delete(); $removed++ }
            }
            if ($removed -gt 0) { $deck.Save(); $changed++ }
            $price = $false
            foreach ($shape in $slide.Shapes) {
                if ([string]$shape.Name -eq 'precio editable') {
                    $price = ([string]$shape.TextFrame.TextRange.Text).Contains('$')
                    break
                }
            }
            if (-not $price) { throw "Precio editable ausente: $($record.codigo_hercas)" }
            $slide.Export($preview, 'PNG', 1280, 720)
            $rendered++
        } catch {
            $errors.Add("$($record.codigo_hercas): $($_.Exception.Message)")
        } finally {
            if ($null -ne $deck) { try { $deck.Close() } catch { } }
        }
        if (($changed + $errors.Count) % 25 -eq 0) { Write-Output "PROGRESO modificadas=$changed previas=$rendered errores=$($errors.Count)" }
    }
} finally {
    try { $app.Quit() } catch { }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)
}
Write-Output "RESULTADO total=$($records.Count) modificadas=$changed previas=$rendered errores=$($errors.Count)"
$errors | Set-Content -LiteralPath 'D:\Aliados exteriores\catalogo_hercas_app\scripts\remove_simulation_labels_errores.txt' -Encoding UTF8
if ($errors.Count -gt 0) { $errors | Write-Output; exit 1 }