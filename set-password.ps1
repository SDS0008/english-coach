# Sets (or changes) the password for the Interview English app.
# The password is typed hidden and never saved. Only a salted fingerprint
# (PBKDF2-SHA256, 310000 rounds) is written to lock-config.js.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File .\set-password.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Hidden([string]$prompt) {
  $sec = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "Set the password for your English coach app" -ForegroundColor Green
Write-Host "Use 4 to 6 characters (numbers or letters), e.g. a PIN like 4829."
Write-Host ""

while ($true) {
  $p1 = Read-Hidden "New password"
  if ($p1.Length -lt 4 -or $p1.Length -gt 6) { Write-Host "Use 4 to 6 characters." -ForegroundColor Yellow; continue }
  $p2 = Read-Hidden "Type it again"
  if ($p1 -ne $p2) { Write-Host "The two passwords don't match. Try again." -ForegroundColor Yellow; continue }
  break
}

$iterations = 310000
$salt = New-Object byte[] 16
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($salt)
$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes(([Text.Encoding]::UTF8.GetBytes($p1)), $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
$hash = $kdf.GetBytes(32)
$p1 = $null; $p2 = $null

$toHex = { param($b) -join ($b | ForEach-Object { $_.ToString("x2") }) }
$content = @"
// Password fingerprint, written by set-password.ps1. The password itself is not stored anywhere.
export const LOCK = { salt: "$(& $toHex $salt)", iterations: $iterations, hash: "$(& $toHex $hash)" };
"@
Set-Content -Path (Join-Path $here "lock-config.js") -Value $content -Encoding utf8
Write-Host ""
Write-Host "Done. The password is set." -ForegroundColor Green
Write-Host "Tell Claude 'password set' so it can upload the change."
