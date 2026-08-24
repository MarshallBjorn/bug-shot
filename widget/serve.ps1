param(
  [int]$Port = 5500
)

python -m http.server $Port --directory $PSScriptRoot
