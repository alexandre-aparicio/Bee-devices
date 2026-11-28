[CmdletBinding()]
param(
    [switch]$CleanInstall,
    [switch]$BuildOnly,
    [string]$DeviceSerial
)

$ErrorActionPreference = "Stop"
$AppId = "net.beeprojects.devices"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

function Assert-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name no está instalado o no está en PATH. $Hint"
    }
}

Write-Host ""
Write-Host "=== Bee Devices: actualización e instalación Android ===" -ForegroundColor Cyan
Assert-Command "git" "Instala Git for Windows."
Assert-Command "node" "Instala Node.js 22 LTS."
Assert-Command "npm" "Instala Node.js 22 LTS (incluye npm)."

$NodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($NodeMajor -lt 22) {
    throw "Se requiere Node.js 22 o superior. Versión detectada: $(node --version)"
}

$Branch = (git branch --show-current).Trim()
if ($Branch -ne "main") {
    throw "Este script actualiza exclusivamente main. Rama actual: '$Branch'. Cambia a main y vuelve a ejecutarlo."
}

$Changes = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "No se pudo comprobar el estado de Git." }
if ($Changes) {
    throw "Hay cambios locales sin guardar. Haz commit/stash o utiliza un clon limpio antes de actualizar."
}

Write-Host ""
Write-Host "[1/6] Descargando la última versión de main..." -ForegroundColor Yellow
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw "git fetch ha fallado." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "git pull ha fallado. No se han sobrescrito cambios locales." }

Write-Host ""
Write-Host "[2/6] Comprobando Java y Android..." -ForegroundColor Yellow
# Localiza JDK 21. Prioriza JAVA_HOME si apunta a un JDK válido y,
# además, inspecciona directamente las carpetas instaladas de Temurin.
$JavaCandidates = @()
if ($env:JAVA_HOME) {
    $JavaCandidates += $env:JAVA_HOME
}

$AdoptiumRoot = Join-Path $env:ProgramFiles "Eclipse Adoptium"
if (Test-Path $AdoptiumRoot) {
    $JavaCandidates += Get-ChildItem -Path $AdoptiumRoot -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName }
}
$JavaCandidates += @(
    (Join-Path $env:ProgramFiles "Java"),
    (Join-Path $env:ProgramFiles "Android\Android Studio\jbr"),
    (Join-Path $env:LOCALAPPDATA "Programs\Eclipse Adoptium")
) | Where-Object { $_ -and (Test-Path $_) }

$JavaCandidates = @($JavaCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) } | Select-Object -Unique)
$Jdk21Home = $null
$SelectedJavaVersion = $null
$DetectedJava = @()

foreach ($Candidate in $JavaCandidates) {
    $JavaExe = Join-Path $Candidate "bin\java.exe"
    # ProcessStartInfo captura stderr sin que Windows PowerShell lo convierta
    # en NativeCommandError.
    $Psi = New-Object System.Diagnostics.ProcessStartInfo
    $Psi.FileName = $JavaExe
    $Psi.Arguments = "-version"
    $Psi.UseShellExecute = $false
    $Psi.RedirectStandardError = $true
    $Psi.RedirectStandardOutput = $true
    $Proc = New-Object System.Diagnostics.Process
    $Proc.StartInfo = $Psi
    [void]$Proc.Start()
    $VersionText = $Proc.StandardError.ReadToEnd() + $Proc.StandardOutput.ReadToEnd()
    $Proc.WaitForExit()

    if ($VersionText -match 'version\s+"(\d+)(?:\.|")') {
        $Major = [int]$Matches[1]
        $DetectedJava += "$Candidate (Java $Major)"
        if ($Major -eq 21 -and -not $Jdk21Home) {
            $Jdk21Home = $Candidate
            $SelectedJavaVersion = ($VersionText -split "`r?`n" | Select-Object -First 1).Trim()
        }
    }
}

if (-not $Jdk21Home) {
    $Found = if ($DetectedJava.Count) { $DetectedJava -join "; " } else { "No se encontró ningún JDK en las rutas habituales." }
    throw "Se requiere JDK 21. Java detectado: $Found. Instala JDK 21 (por ejemplo, Eclipse Temurin 21 x64), abre una nueva PowerShell y vuelve a ejecutar este script. No cambies JAVA_HOME a una ruta supuesta."
}

$env:JAVA_HOME = $Jdk21Home
$env:Path = "$(Join-Path $Jdk21Home 'bin');$env:Path"
Write-Host "JDK seleccionado: $Jdk21Home" -ForegroundColor Green
Write-Host "Java: $SelectedJavaVersion"

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    Write-Warning "ANDROID_HOME/ANDROID_SDK_ROOT no está definido. Capacitor/Gradle puede no encontrar el SDK."
}
if (-not $BuildOnly) {
    Assert-Command "adb" "Instala Android SDK Platform-Tools y añade su carpeta platform-tools al PATH."
}

Write-Host ""
Write-Host "[3/6] Instalando dependencias npm..." -ForegroundColor Yellow
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install ha fallado." }

if (-not (Test-Path (Join-Path $RepoRoot "android"))) {
    Write-Host ""
    Write-Host "[4/6] Generando el proyecto Android nativo..." -ForegroundColor Yellow
    npm run android:add
    if ($LASTEXITCODE -ne 0) { throw "No se pudo generar el proyecto Android." }
} else {
    Write-Host ""
    Write-Host "[4/6] Proyecto Android existente: se reutilizará." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/6] Compilando Angular y sincronizando Capacitor..." -ForegroundColor Yellow
npm run cap:sync
if ($LASTEXITCODE -ne 0) { throw "La compilación/sincronización de Capacitor ha fallado." }

$Gradle = Join-Path $RepoRoot "android\gradlew.bat"
$Apk = Join-Path $RepoRoot "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $Gradle)) { throw "No se encuentra android\gradlew.bat." }

Write-Host "Compilando APK debug..." -ForegroundColor Yellow
Push-Location (Join-Path $RepoRoot "android")
try {
    & $Gradle --no-daemon assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle no ha podido generar el APK." }
} finally {
    Pop-Location
}
if (-not (Test-Path $Apk)) { throw "Gradle terminó, pero no se encuentra el APK esperado: $Apk" }

Write-Host ""
Write-Host "APK generado: $Apk" -ForegroundColor Green
if ($BuildOnly) {
    Write-Host "Modo BuildOnly: no se ha intentado instalar en un teléfono."
    exit 0
}

Write-Host ""
Write-Host "[6/6] Buscando dispositivo Android por USB..." -ForegroundColor Yellow
$DeviceLines = @(adb devices)
if ($LASTEXITCODE -ne 0) { throw "adb devices ha fallado." }
$Connected = @($DeviceLines | Select-Object -Skip 1 | Where-Object { $_ -match "^\S+\s+device$" })
if ($DeviceSerial) {
    $Selected = @($Connected | Where-Object { ($_ -split "\s+")[0] -eq $DeviceSerial })
    if ($Selected.Count -ne 1) { throw "No se encuentra el dispositivo autorizado con serial '$DeviceSerial'." }
} else {
    if ($Connected.Count -eq 0) {
        throw "No hay ningún Android autorizado. Activa Opciones de desarrollador > Depuración USB, conecta el cable y acepta el diálogo RSA. APK disponible en: $Apk"
    }
    if ($Connected.Count -gt 1) {
        throw "Hay varios Android conectados. Repite con -DeviceSerial <SERIAL>. Dispositivos: $($Connected -join ', ')"
    }
    $DeviceSerial = ($Connected[0] -split "\s+")[0]
}

Write-Host "Dispositivo: $DeviceSerial"
if ($CleanInstall) {
    Write-Warning "CleanInstall desinstala Bee Devices y elimina sus datos locales, incluida la credencial de emparejamiento. Tendrás que emparejar de nuevo."
    $UninstallOutput = adb -s $DeviceSerial uninstall $AppId 2>&1
    if ($LASTEXITCODE -ne 0 -and ($UninstallOutput -join " ") -notmatch "Unknown package|not installed") {
        throw "No se pudo desinstalar la versión anterior: $($UninstallOutput -join ' ')"
    }
}

adb -s $DeviceSerial install -r $Apk
if ($LASTEXITCODE -ne 0) { throw "La instalación del APK en Android ha fallado." }

Write-Host ""
Write-Host "Bee Devices actualizado e instalado correctamente." -ForegroundColor Green
Write-Host "Si has utilizado -CleanInstall, vuelve a emparejar el dispositivo desde Bee Core."
