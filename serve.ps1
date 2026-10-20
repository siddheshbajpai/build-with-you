param([int]$Port = 8080)
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
foreach ($h in @('localhost', '127.0.0.1')) {
    try { $listener.Prefixes.Add("http://$h`:$Port/") } catch { Write-Host "skip $h" }
}
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/ (hosts: $($listener.Prefixes -join ', '))"
while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $path = $req.Url.AbsolutePath
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
        $file = Join-Path $root ($path.TrimStart('/').Replace('/', '\'))
        if (Test-Path -LiteralPath $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $types = @{
                '.html' = 'text/html; charset=utf-8'
                '.css'  = 'text/css; charset=utf-8'
                '.js'   = 'application/javascript; charset=utf-8'
                '.svg'  = 'image/svg+xml'
                '.png'  = 'image/png'
                '.jpg'  = 'image/jpeg'
                '.ico'  = 'image/x-icon'
                '.json' = 'application/json'
            }
            $mime = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentType = $mime
            $ctx.Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $ctx.Response.OutputStream.Close()
        } else {
            $ctx.Response.StatusCode = 404
            $ctx.Response.OutputStream.Close()
        }
    } catch {
        try { $ctx.Response.StatusCode = 500; $ctx.Response.OutputStream.Close() } catch {}
    }
}
