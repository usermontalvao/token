$ErrorActionPreference = "Stop"

$RegistryPaths = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\br.com.jurius.token_bridge",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\br.com.jurius.token_bridge",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\br.com.jurius.token_bridge"
)

foreach ($RegistryPath in $RegistryPaths) {
  if (Test-Path $RegistryPath) { Remove-Item -Recurse -Force $RegistryPath }
}

Write-Host "Registros removidos. Os dados permanecem em $env:LOCALAPPDATA\JuriusTokenBridge"

