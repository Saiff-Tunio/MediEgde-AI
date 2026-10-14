param([string]$Architecture = 'arm64-v8a')

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory

$localJdk = Join-Path $projectDirectory '.android-build\jdk17'
$localSdk = Join-Path $projectDirectory '.android-build\sdk'
if (Test-Path -LiteralPath (Join-Path $localJdk 'bin\java.exe')) { $env:JAVA_HOME = $localJdk }
if (Test-Path -LiteralPath $localSdk) {
    $env:ANDROID_HOME = $localSdk
    $env:ANDROID_SDK_ROOT = $localSdk
}
if (-not $env:JAVA_HOME) { throw 'Install JDK 17 and set JAVA_HOME before building.' }
if (-not $env:ANDROID_HOME) { throw 'Install the Android SDK and set ANDROID_HOME before building.' }
$env:GRADLE_USER_HOME = Join-Path $projectDirectory '.android-build\gradle-home'
$env:EXPO_NO_TELEMETRY = '1'
$env:NODE_ENV = 'production'
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path

if (-not (Test-Path -LiteralPath 'android\gradlew.bat')) {
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Android project generation failed.' }
}

$gradleExecutable = Join-Path $projectDirectory '.android-build\gradle-9.3.1\bin\gradle.bat'
if (-not (Test-Path -LiteralPath $gradleExecutable)) {
    $gradleExecutable = Join-Path $projectDirectory 'android\gradlew.bat'
}
& $gradleExecutable -p android :app:assembleRelease "-PreactNativeArchitectures=$Architecture" '-Pandroid.cmakeVersion=3.22.1' --no-daemon --max-workers=2 --console=plain
if ($LASTEXITCODE -ne 0) { throw 'APK build failed. Check the Gradle output above.' }

$apkSource = Join-Path $projectDirectory 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apkSource)) { throw 'Gradle finished without producing the expected APK.' }
$releaseDirectory = Join-Path $projectDirectory 'releases'
New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
$apkDestination = Join-Path $releaseDirectory "MediEdge-AI-1.0.0-$Architecture.apk"
Copy-Item -LiteralPath $apkSource -Destination $apkDestination -Force
$checksum = (Get-FileHash -LiteralPath $apkDestination -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $releaseDirectory 'SHA256SUMS.txt'), "$checksum  $(Split-Path -Leaf $apkDestination)`n")
Write-Output "APK ready: $apkDestination"
