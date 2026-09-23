param(
  [int]$Port = 5500
)

$apiBaseUrl = if ($env:BUGSHOT_API_URL) {
  $env:BUGSHOT_API_URL
} else {
  "http://localhost:8080"
}

$projectKey = if ($env:BUGSHOT_PROJECT_KEY) {
  $env:BUGSHOT_PROJECT_KEY
} else {
  "demo"
}

$jsonApiBaseUrl = $apiBaseUrl | ConvertTo-Json -Compress
$jsonProjectKey = $projectKey | ConvertTo-Json -Compress
$configContent = "window.BUGSHOT_CONFIG = { apiBaseUrl: $jsonApiBaseUrl, projectKey: $jsonProjectKey };"

Set-Content `
  -Path (Join-Path $PSScriptRoot "config.js") `
  -Value $configContent `
  -Encoding UTF8

python -m http.server $Port --directory $PSScriptRoot
