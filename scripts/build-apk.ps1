param(
  [string]$JavaHome = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot',
  [string]$AndroidSdk = 'D:\azb\android-sdk',
  [string]$GradleHome = 'D:\azb\gradle-8.14.2',
  [string]$GradleZip = 'D:\azb\gradle-8.14.2-bin.zip'
)

$ErrorActionPreference = 'Stop'

function Assert-CommandSucceeded([string]$step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$step failed with exit code $LASTEXITCODE."
  }
}

function Get-Sha256([string]$path) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($path)

  try {
    $hashBytes = $sha256.ComputeHash($stream)
    return ($hashBytes | ForEach-Object { $_.ToString('x2') }) -join ''
  }
  finally {
    $stream.Dispose()
    $sha256.Dispose()
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$cordovaRoot = Join-Path $projectRoot 'cordova'
$cordovaWww = Join-Path $cordovaRoot 'www'
$androidRoot = Join-Path $cordovaRoot 'platforms\android'
$artifactRoot = Join-Path $projectRoot 'artifacts'
$socketTemp = Join-Path (Split-Path -Parent $AndroidSdk) 'java-sockets'
$gradleCommand = Join-Path $GradleHome 'bin\gradle.bat'
$javaCommand = Join-Path $JavaHome 'bin\java.exe'
$sdkManager = Join-Path $AndroidSdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$resolvedProjectRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd('\')
$resolvedCordovaWww = [IO.Path]::GetFullPath($cordovaWww)

if (-not $resolvedCordovaWww.StartsWith("$resolvedProjectRoot\", [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unexpected Cordova www path: $resolvedCordovaWww"
}

foreach ($requiredPath in @($javaCommand, $sdkManager, $gradleCommand, $GradleZip)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required build dependency was not found: $requiredPath"
  }
}

New-Item -ItemType Directory -Force -Path $socketTemp | Out-Null
$env:TEMP = $socketTemp
$env:TMP = $socketTemp
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$socketTemp -Djava.io.tmpdir=$socketTemp"
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:GRADLE_HOME = $GradleHome
$env:PATH = "$JavaHome\bin;$GradleHome\bin;$AndroidSdk\platform-tools;$env:PATH"

Push-Location $projectRoot
try {
  & npm.cmd run build
  Assert-CommandSucceeded 'Web build'

  if (-not (Test-Path -LiteralPath $resolvedCordovaWww)) {
    New-Item -ItemType Directory -Force -Path $resolvedCordovaWww | Out-Null
  }
  Get-ChildItem -LiteralPath $resolvedCordovaWww -Force | Remove-Item -Recurse -Force
  Copy-Item -Path (Join-Path $projectRoot 'dist\*') -Destination $resolvedCordovaWww -Recurse -Force

  Push-Location $cordovaRoot
  try {
    & cordova.cmd prepare android
    Assert-CommandSucceeded 'Cordova prepare'

    & $gradleCommand -p (Join-Path $androidRoot 'tools') wrapper --gradle-version 8.14.2
    Assert-CommandSucceeded 'Gradle wrapper setup'

    $wrapperProperties = Join-Path $androidRoot 'gradle\wrapper\gradle-wrapper.properties'
    $localDistributionUrl = ([Uri](Resolve-Path -LiteralPath $GradleZip).Path).AbsoluteUri
    $wrapperContent = Get-Content -LiteralPath $wrapperProperties -Raw
    $wrapperContent = [regex]::Replace(
      $wrapperContent,
      '(?m)^distributionUrl=.*$',
      "distributionUrl=$localDistributionUrl"
    )
    [IO.File]::WriteAllText($wrapperProperties, $wrapperContent)

    Push-Location $androidRoot
    try {
      & .\gradlew.bat cdvBuildDebug
      Assert-CommandSucceeded 'Android debug build'
    }
    finally {
      Pop-Location
    }
  }
  finally {
    Pop-Location
  }

  $configPath = Join-Path $cordovaRoot 'config.xml'
  [xml]$cordovaConfig = [IO.File]::ReadAllText($configPath, [Text.Encoding]::UTF8)
  $version = $cordovaConfig.widget.version
  $sourceApk = Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
  if (-not (Test-Path -LiteralPath $sourceApk)) {
    throw "Built APK was not found: $sourceApk"
  }

  New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
  $artifactApk = Join-Path $artifactRoot "pokemon-guess-type-$version-debug.apk"
  Copy-Item -LiteralPath $sourceApk -Destination $artifactApk -Force

  $artifact = Get-Item -LiteralPath $artifactApk
  $hash = Get-Sha256 $artifactApk
  Write-Host "APK: $($artifact.FullName)"
  Write-Host "Size: $($artifact.Length) bytes"
  Write-Host "SHA-256: $hash"
}
finally {
  Pop-Location
}
