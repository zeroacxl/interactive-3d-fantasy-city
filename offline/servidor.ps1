$ErrorActionPreference = 'Stop'
$listener = New-Object System.Net.HttpListener
$port = 8765
$started = $false
foreach ($candidate in 8765..8785) {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$candidate/")
    try { $listener.Start(); $port = $candidate; $started = $true; break }
    catch { $listener.Close() }
}
if (-not $started) { throw 'Nao foi possivel abrir uma porta local entre 8765 e 8785.' }
$url = "http://localhost:$port/"
Write-Host "Aqua City em $url - Ctrl+C para parar"
Start-Process $url
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response
        try {
            if ($context.Request.Url.AbsolutePath -in @('/', '/index.html')) {
                $bytes = [System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'index.html'))
                $response.ContentType = 'text/html; charset=utf-8'
                $response.Headers['Cache-Control'] = 'no-store'
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else { $response.StatusCode = 404 }
        } finally { $response.Close() }
    }
} finally { $listener.Stop(); $listener.Close() }
