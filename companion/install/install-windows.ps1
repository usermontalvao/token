param(
  [string]$ExtensionId = "ipapgfacphjdohnonhjkgbcdmojelbjb",
  [string]$HostExecutable = ""
)

$ErrorActionPreference = "Stop"

if ($ExtensionId -notmatch '^[a-p]{32}$') {
  throw "ID de extensao invalido: $ExtensionId"
}

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$CompanionDirectory = Split-Path -Parent $ScriptDirectory
$InstallDirectory = Join-Path $env:LOCALAPPDATA "JuriusTokenBridge"
$InstalledExecutable = Join-Path $InstallDirectory "jurius-token-bridge.exe"
$ConfigFile = Join-Path $InstallDirectory "config.json"

if (-not $HostExecutable) {
  $Candidate = Join-Path (Split-Path -Parent $CompanionDirectory) "dist\jurius-token-bridge-windows-x64.exe"
  if (Test-Path $Candidate) { $HostExecutable = $Candidate }
}

if (-not $HostExecutable -or -not (Test-Path $HostExecutable)) {
  throw "Informe -HostExecutable com o executavel baixado da pagina Releases."
}

New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
Copy-Item -Force $HostExecutable $InstalledExecutable

if (-not (Test-Path $ConfigFile)) {
  Copy-Item (Join-Path $CompanionDirectory "config.example.json") $ConfigFile
}

$Manifest = [ordered]@{
  name = "br.com.jurius.token_bridge"
  description = "Jurius Token Bridge"
  path = $InstalledExecutable
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$ManifestPath = Join-Path $InstallDirectory "br.com.jurius.token_bridge.json"
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $ManifestPath

$RegistryPaths = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\br.com.jurius.token_bridge",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\br.com.jurius.token_bridge",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\br.com.jurius.token_bridge"
)

foreach ($RegistryPath in $RegistryPaths) {
  New-Item -Force -Path $RegistryPath | Out-Null
  Set-Item -Path $RegistryPath -Value $ManifestPath
}

Write-Host "Companion instalado em: $InstallDirectory"
Write-Host "Configuracao: $ConfigFile"
Write-Host "Feche e abra o Chrome antes do teste."

