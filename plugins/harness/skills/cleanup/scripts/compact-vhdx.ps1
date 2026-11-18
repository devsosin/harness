# Shrinks Docker Desktop's WSL disk (docker_data.vhdx) on Windows after volumes/images were removed.
# The file only grows: deleting data inside frees blocks for Docker but not for Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File compact-vhdx.ps1 [-DryRun]
#
# Steps: record running containers -> fstrim inside the Docker VM -> stop Docker Desktop -> wsl --shutdown
# -> diskpart "compact vdisk" (one UAC prompt the user approves) -> start Docker Desktop -> start the
# recorded containers that did not come back on their own (no restart policy) -> before/after sizes.
# Every running container stops for a few minutes. Run it only after the user agreed.
# Windows PowerShell 5.1, no modules (Optimize-VHD needs Hyper-V tools and admin; diskpart does not).

param([switch]$DryRun)
$ErrorActionPreference = 'Stop'

$vhd = Join-Path $env:LOCALAPPDATA 'Docker\wsl\disk\docker_data.vhdx'
if (-not (Test-Path $vhd)) { Write-Output "no docker_data.vhdx at $vhd"; exit 1 }
$before = (Get-Item $vhd).Length

# Docker Desktop's install folder differs per install (Program Files, or LocalAppData\Programs for a
# per-user install); take it from the running process when possible.
$desktop = (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path -notmatch '\\frontend\\' } | Select-Object -First 1).Path
if (-not $desktop) {
    $desktop = @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
                 "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
                 "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $desktop) { Write-Output 'Docker Desktop.exe not found'; exit 1 }

$running = @(docker ps --format '{{.Names}}' 2>$null)
Write-Output ("vhdx {0:N1}GB, Docker Desktop {1}" -f ($before / 1GB), $desktop)
Write-Output ("running containers: {0}" -f ($(if ($running.Count) { $running -join ', ' } else { '(none)' })))
if ($DryRun) { Write-Output 'dry run: nothing stopped'; exit 0 }

# 1. Tell the virtual disk which blocks are free; compaction can only drop blocks it knows are unused.
docker run --rm --privileged --pid=host alpine:latest nsenter -t 1 -m -- fstrim -av 2>&1 | Write-Output

# 2. Stop Docker Desktop and the WSL VM so the vhdx is not attached.
Get-Process | Where-Object { $_.ProcessName -match '^Docker Desktop$|^com\.docker\.' } |
    Stop-Process -Force -Confirm:$false -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
wsl --shutdown
Start-Sleep -Seconds 3

# 3. diskpart needs admin: one UAC prompt.
$script = Join-Path $env:TEMP ("compact-vhdx-{0}.txt" -f [guid]::NewGuid().ToString('N'))
@"
select vdisk file="$vhd"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@ | Set-Content -Encoding ascii $script
try {
    $p = Start-Process diskpart.exe -ArgumentList "/s `"$script`"" -Verb RunAs -Wait -PassThru
    Write-Output "diskpart exit=$($p.ExitCode)"
} catch {
    Write-Output "diskpart not run (UAC declined?): $($_.Exception.Message)"
} finally {
    Remove-Item $script -Force -ErrorAction SilentlyContinue
}
$after = (Get-Item $vhd).Length

# 4. Bring Docker back and restart what was running before.
Start-Process $desktop
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $null = docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
}
if (-not $ready) { Write-Output 'docker engine did not come back within 5 minutes'; exit 1 }
Start-Sleep -Seconds 10
$now = @(docker ps --format '{{.Names}}' 2>$null)
foreach ($name in $running) {
    if ($now -notcontains $name) {
        docker start $name | Out-Null
        Write-Output "restarted $name"
    }
}
Write-Output ("before {0:N1}GB -> after {1:N1}GB; C: free {2:N1}GB" -f ($before / 1GB), ($after / 1GB), ((Get-PSDrive C).Free / 1GB))
