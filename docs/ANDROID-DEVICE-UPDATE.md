# Actualizar Bee-devices en el Android físico

Este procedimiento actualiza el proyecto desde `main`, compila la aplicación Android y la instala directamente en el móvil conectado por USB.

## Entorno configurado

- Repositorio: [alexandre-aparicio/Bee-devices](https://github.com/alexandre-aparicio/Bee-devices)
- Rama: `main`
- Carpeta local del proyecto: `C:/Users/toras/StudioProjects/Bee-devices/android/Bee-devices`
- Identificador ADB del móvil físico: `5baac27`
- APK generado: `android/app/build/outputs/apk/debug/app-debug.apk`

## Requisitos previos

- Windows con PowerShell.
- Git, Node.js/npm, Java y Android SDK instalados y configurados.
- Móvil conectado por USB, con depuración USB activada y autorización ADB concedida.
- El identificador del móvil debe seguir siendo `5baac27`.

## Actualización completa con un solo bloque

Abrir PowerShell y ejecutar el bloque completo. No importa desde qué carpeta se ejecute:

```powershell
$ErrorActionPreference = 'Stop'
$deviceId = '5baac27'
$projectPath = 'C:\Users\toras\StudioProjects\Bee-devices\android\Bee-devices'

# Comprobar que el móvil esperado está conectado y autorizado.
$adbDevices = adb devices
if ($LASTEXITCODE -ne 0) { throw 'No se pudo ejecutar ADB. Comprueba Android SDK y PATH.' }
if (-not ($adbDevices | Select-String -Pattern ("^" + [regex]::Escape($deviceId) + "\s+device$"))) {
    Write-Host $adbDevices
    throw "No se encuentra el móvil $deviceId en estado device. Comprueba el cable USB y acepta la autorización de depuración."
}

Set-Location $projectPath

git checkout main
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar a main. Comprueba si hay cambios locales pendientes.' }

git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Error actualizando main desde origin.' }

npm install
if ($LASTEXITCODE -ne 0) { throw 'Error instalando dependencias npm.' }

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Error compilando la aplicación web.' }

npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Error sincronizando Capacitor con Android.' }

Set-Location (Join-Path $projectPath 'android')
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Error generando el APK Android.' }

$apkPath = Join-Path (Get-Location) 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apkPath)) { throw "No se ha encontrado el APK generado: $apkPath" }

adb -s $deviceId install -r $apkPath
if ($LASTEXITCODE -ne 0) { throw 'Error instalando el APK en el móvil.' }

Write-Host 'ACTUALIZACIÓN COMPLETADA: Bee-devices instalada en el móvil físico.' -ForegroundColor Green
```

## Notas

- Se usa `adb -s 5baac27` para seleccionar explícitamente el móvil físico, evitando el error `more than one device/emulator` cuando también hay un emulador conectado.
- `install -r` actualiza la instalación existente sin desinstalarla; normalmente conserva los datos locales de la aplicación.
- Si ADB muestra `unauthorized`, desbloquear el móvil y aceptar el diálogo de autorización USB.
- Si el identificador cambia, ejecutar `adb devices` y actualizar el valor de `$deviceId` en el bloque.
- Si Git no permite cambiar a `main` por cambios locales, revisar y guardar esos cambios antes de repetir. No descartarlos automáticamente.
- El procedimiento genera e instala el APK `debug`; no genera una versión de producción firmada.
