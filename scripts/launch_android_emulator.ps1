$ErrorActionPreference = "Continue"
$adb = "C:\AndroidSDK\platform-tools\adb.exe"
$emulator = "C:\AndroidSDK\emulator\emulator.exe"
$apkPath = "C:\Users\IMDAD\.gemini\antigravity\scratch\khodar-pos\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "Checking if an emulator or device is already running..."
$devices = & $adb devices
$running = $devices | Where-Object { $_ -match "\bdevice\b" }

if (-not $running) {
    Write-Host "Starting Android Emulator (Pixel_9_Pro_XL)..."
    Start-Process -FilePath $emulator -ArgumentList "-avd", "Pixel_9_Pro_XL"
    Write-Host "Waiting for device to connect to ADB..."
    & $adb wait-for-device
    
    Write-Host "Waiting for Android system to finish booting..."
    $booted = $false
    for ($i = 0; $i -lt 60; $i++) {
        $status = (& $adb shell getprop sys.boot_completed 2>$null).Trim()
        if ($status -eq "1") {
            $booted = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if ($booted) {
        Write-Host "Device booted successfully!"
    } else {
        Write-Host "Proceeding with installation..."
    }
} else {
    Write-Host "Device already connected!"
}

Write-Host "Installing APK ($apkPath)..."
& $adb install -r $apkPath

Write-Host "Launching KhodarPOS on the emulator..."
& $adb shell am start -n com.khodar.pos/.MainActivity

Write-Host "=== Done! App is now running on the Android Emulator screen. ==="
