# Start API + web, capture README screenshots, then stop background jobs.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Push-Location $Root

$env:REGISTRY_STORE = "memory"
$env:MOCK_MODE = "true"
$env:RUN_MIGRATIONS_ON_STARTUP = "false"
$env:API_PORT = "3000"
$env:MCP_DEFINER_API_KEY = "dev-api-key"
$env:VITE_API_KEY = "dev-api-key"

Write-Host "Building packages..."
pnpm build | Out-Null

Write-Host "Starting API on :3000..."
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:Root
    $env:REGISTRY_STORE = "memory"
    $env:MOCK_MODE = "true"
    $env:RUN_MIGRATIONS_ON_STARTUP = "false"
    $env:API_PORT = "3000"
    $env:MCP_DEFINER_API_KEY = "dev-api-key"
    node packages/api/dist/server.js 2>&1
}

Write-Host "Starting web UI on :5173..."
$webJob = Start-Job -ScriptBlock {
    Set-Location $using:Root
    $env:VITE_API_KEY = "dev-api-key"
    pnpm --filter @mcp-definer/web exec vite --host 127.0.0.1 --port 5173 2>&1
}

function Wait-Http($Url, $Attempts = 60) {
    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

if (-not (Wait-Http "http://127.0.0.1:3000/health")) {
    Receive-Job $apiJob
    throw "API did not become ready"
}
if (-not (Wait-Http "http://127.0.0.1:5173")) {
    Receive-Job $webJob
    throw "Web UI did not become ready"
}

Write-Host "Services ready - capturing screenshots..."
pnpm exec playwright install chromium 2>$null
node scripts/capture-screenshots.mjs
$exit = $LASTEXITCODE

Stop-Job $apiJob, $webJob -ErrorAction SilentlyContinue
Remove-Job $apiJob, $webJob -Force -ErrorAction SilentlyContinue

Pop-Location
exit $exit
