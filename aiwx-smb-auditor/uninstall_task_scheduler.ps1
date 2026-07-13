#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Remove AiWorXmiths Task Scheduler tasks.
#>

$tasks = @(
    "AiWorXmiths-SocialMediaScheduler",
    "AiWorXmiths-ServerAutoStart"
)

Write-Host ""
Write-Host "AiWorXmiths Task Scheduler Uninstaller" -ForegroundColor Yellow
Write-Host ""

foreach ($task in $tasks) {
    $existing = Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
        Write-Host "  ✓ Removed: $task" -ForegroundColor Green
    } else {
        Write-Host "  - Not found (already removed): $task" -ForegroundColor Gray
    }
}

# Also remove the generated wrapper script
$wrapper = Join-Path $PSScriptRoot "ensure_server_running.ps1"
if (Test-Path $wrapper) {
    Remove-Item $wrapper -Force
    Write-Host "  ✓ Removed: ensure_server_running.ps1" -ForegroundColor Green
}

Write-Host ""
Write-Host "Uninstall complete." -ForegroundColor Green
Write-Host ""
