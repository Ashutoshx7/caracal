# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# One-shot Windows installer that downloads, verifies, and extracts Caracal release archives. The thin `caracal` shell is always installed; -Tui adds the TUI alongside the CLI, -TuiOnly installs shell+TUI without the CLI.

[CmdletBinding()]
param(
    [string]$Version = $env:CARACAL_VERSION,
    [string]$InstallDir = $env:CARACAL_INSTALL_DIR,
    [switch]$Tui,
    [switch]$TuiOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($TuiOnly) { $Tui = $true }
$withCli = -not $TuiOnly

$repo = 'Garudex-Labs/caracal'
if ([string]::IsNullOrEmpty($Version)) { $Version = 'latest' }
if ([string]::IsNullOrEmpty($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\caracal'
}

$osArch = (Get-CimInstance Win32_OperatingSystem).OSArchitecture
switch -Wildcard ($osArch) {
    '64-bit*' { $arch = 'amd64' }
    default   { throw "unsupported architecture: $osArch (only amd64 binaries are published for Windows)" }
}

if ($Version -eq 'latest') {
    $tag = (Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -UseBasicParsing).tag_name
    if ([string]::IsNullOrEmpty($tag)) { throw 'could not resolve latest release tag from GitHub API' }
} else {
    $tag = $Version
}
$base = "https://github.com/$repo/releases/download/$tag"

$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "caracal-install-$([guid]::NewGuid())")
try {
    Write-Host "caracal-install: target release $tag (windows-$arch)"
    $sumsPath = Join-Path $tmp.FullName 'SHA256SUMS'
    Write-Host 'caracal-install: downloading SHA256SUMS'
    Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile $sumsPath -UseBasicParsing

    $sums = @{}
    foreach ($line in Get-Content $sumsPath) {
        if ($line -match '^([0-9a-fA-F]{64})\s+\*?(.+)$') {
            $sums[$Matches[2]] = $Matches[1].ToLower()
        }
    }

    function Install-Archive([string]$Kind, [string]$BinName) {
        $archive = "caracal-$Kind-windows-$arch-$tag.zip"
        if (-not $sums.ContainsKey($archive)) { throw "no checksum for $archive in SHA256SUMS" }
        $archivePath = Join-Path $tmp.FullName $archive
        Write-Host "caracal-install: downloading $archive"
        Invoke-WebRequest -Uri "$base/$archive" -OutFile $archivePath -UseBasicParsing
        $actual = (Get-FileHash -Algorithm SHA256 -Path $archivePath).Hash.ToLower()
        if ($actual -ne $sums[$archive]) {
            throw "checksum mismatch for $archive (expected $($sums[$archive]), got $actual)"
        }
        Expand-Archive -Path $archivePath -DestinationPath $tmp.FullName -Force
        $src = Join-Path $tmp.FullName "$BinName.exe"
        if (-not (Test-Path $src)) { throw "expected $BinName.exe inside $archive, not found" }
        $dest = Join-Path $InstallDir "$BinName.exe"
        Move-Item -Force $src $dest
        Write-Host "caracal-install: installed $dest"
    }

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Install-Archive -Kind 'shell' -BinName 'caracal'
    if ($withCli) { Install-Archive -Kind 'cli' -BinName 'caracal-cli' }
    if ($Tui) { Install-Archive -Kind 'tui' -BinName 'caracal-tui' }
} finally {
    Remove-Item -Recurse -Force $tmp.FullName -ErrorAction SilentlyContinue
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not ($userPath -split ';' | Where-Object { $_ -ieq $InstallDir })) {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
    Write-Host "caracal-install: added $InstallDir to user PATH (open a new shell to pick it up)"
}

Write-Host 'caracal-install: done. Next steps:'
Write-Host '  caracal up         # start stack (Docker Desktop required)'
Write-Host '  caracal status     # probe service health'
Write-Host '  caracal down       # stop stack'
Write-Host '  caracal purge      # centralized cleanup'
if ($withCli) {
    Write-Host '  caracal cli zone create --name <n>   # provision a zone'
    Write-Host '  caracal cli app create --name <n>    # provision an application'
    Write-Host '  caracal cli run -- cmd               # smoke test ambient tokens'
}
if ($Tui) {
    Write-Host '  caracal tui        # launch the interactive TUI'
}
if (-not $withCli -and $Tui) {
    Write-Host 'caracal-install: CLI not installed (re-run without -TuiOnly to add it)'
}
if ($withCli -and -not $Tui) {
    Write-Host 'caracal-install: TUI not installed (re-run with -Tui to add it, or -TuiOnly for TUI alone)'
}
Write-Host "caracal-install: to uninstall, remove the installed binaries from $InstallDir and the user PATH entry."
