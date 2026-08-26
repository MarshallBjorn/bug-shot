param(
  [int]$Port = 5500
)

$apiBaseUrl = if ($env:BUGSHOT_API_URL) {
  $env:BUGSHOT_API_URL
} else {
  "http://localhost:5110"
}

$jsonApiBaseUrl = $apiBaseUrl | ConvertTo-Json -Compress
$configContent = "window.BUGSHOT_CONFIG = { apiBaseUrl: $jsonApiBaseUrl };"

Set-Content `
  -Path (Join-Path $PSScriptRoot "config.js") `
  -Value $configContent `
  -Encoding UTF8

python -m http.server $Port --directory $PSScriptRoot
