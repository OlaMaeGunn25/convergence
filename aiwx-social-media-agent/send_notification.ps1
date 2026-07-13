param (
    [string]$Title,
    [string]$Message
)

[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
$objNotification = New-Object System.Windows.Forms.NotifyIcon
$objNotification.Icon = [System.Drawing.SystemIcons]::Information
$objNotification.BalloonTipText = $Message
$objNotification.BalloonTipTitle = $Title
$objNotification.Visible = $True
$objNotification.ShowBalloonTip(7000)
Start-Sleep -Seconds 1
$objNotification.Dispose()
