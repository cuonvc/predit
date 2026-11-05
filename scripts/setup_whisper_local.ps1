# Predit - Local Whisper Setup Script
# Downloads whisper-cli Windows x64 binary and GGML Whisper model
param(
    [string]$Model = "base"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$binDir = Join-Path $root "src-tauri\binaries"
$modelDir = Join-Path $root "src-tauri\resources\models"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}
if (-not (Test-Path $modelDir)) {
    New-Item -ItemType Directory -Path $modelDir -Force | Out-Null
}

Write-Host "=== Predit Local Whisper Setup ===" -ForegroundColor Cyan

# 1. Download whisper-cli for Windows x64
$cliTarget = Join-Path $binDir "whisper-cli-x86_64-pc-windows-msvc.exe"
Write-Host "[1/2] Setting up whisper-cli binary..." -ForegroundColor Yellow

$releaseUrls = @(
    "https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip",
    "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-x64.zip"
)
$tempZip = Join-Path $env:TEMP "whisper-bin-x64.zip"
$tempExtract = Join-Path $env:TEMP "whisper-bin-x64"

try {
    $downloadSuccess = $false
    foreach ($url in $releaseUrls) {
        try {
            Write-Host "Downloading whisper.cpp from $url..." -ForegroundColor Gray
            Invoke-WebRequest -Uri $url -OutFile $tempZip -UseBasicParsing
            $downloadSuccess = $true
            break
        } catch {
            Write-Host "Failed to download from $url, trying next..." -ForegroundColor DarkGray
        }
    }

    if ($downloadSuccess) {
        if (Test-Path $tempExtract) {
            Remove-Item -Recurse -Force $tempExtract
        }
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        $foundCli = Get-ChildItem -Path $tempExtract -Recurse -Filter "whisper-cli.exe" | Select-Object -First 1
        if (-not $foundCli) {
            $foundCli = Get-ChildItem -Path $tempExtract -Recurse -Filter "main.exe" | Select-Object -First 1
        }

        if ($foundCli) {
            Copy-Item -Path $foundCli.FullName -Destination $cliTarget -Force
            Get-ChildItem -Path $tempExtract -Recurse -Filter "*.dll" | ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $binDir -Force
            }

            # Also ensure target/debug and target/release have the latest binary and DLLs for tauri dev
            $targets = @(
                Join-Path $root "src-tauri\target\debug",
                Join-Path $root "src-tauri\target\release"
            )
            foreach ($t in $targets) {
                if (Test-Path $t) {
                    Copy-Item -Path $foundCli.FullName -Destination (Join-Path $t "whisper-cli.exe") -Force
                    Get-ChildItem -Path $tempExtract -Recurse -Filter "*.dll" | ForEach-Object {
                        Copy-Item -Path $_.FullName -Destination $t -Force
                    }
                }
            }

            Write-Host "[OK] Installed whisper-cli to: $cliTarget" -ForegroundColor Green
        } else {
            Write-Warning "Could not find whisper-cli executable in archive."
        }
    }
} catch {
    Write-Warning "Download of whisper-cli failed: $($_.Exception.Message)"
}

# 2. Download GGML Model
$modelMap = @{
    "tiny" = @{ file = "ggml-tiny.bin"; url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" }
    "base" = @{ file = "ggml-base.bin"; url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" }
    "small" = @{ file = "ggml-small.bin"; url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" }
    "large-v3-turbo" = @{ file = "ggml-large-v3-turbo-q5_0.bin"; url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" }
}

$selected = $modelMap[$Model]
if (-not $selected) {
    $selected = $modelMap["base"]
}

$modelDest = Join-Path $modelDir $selected.file
Write-Host "[2/2] Downloading $($selected.file)..." -ForegroundColor Yellow

try {
    Write-Host "Source: $($selected.url)" -ForegroundColor Gray
    Invoke-WebRequest -Uri $selected.url -OutFile $modelDest -UseBasicParsing
    Write-Host "[OK] Successfully downloaded $($selected.file) to: $modelDest" -ForegroundColor Green
} catch {
    Write-Warning "Model download failed: $($_.Exception.Message)"
}

Write-Host "Setup finished. You can now use Local Whisper in Predit." -ForegroundColor Cyan
