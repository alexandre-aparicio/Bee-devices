# Bee Devices

Aplicación Android compañera de **Bee Core**. Permite vincular un teléfono como dispositivo físico de la empresa y consultar únicamente las capacidades que Bee Core haya concedido.

## Funcionalidad

- Escaneo de QR mediante la cámara y ML Kit de Google.
- Solicitud de emparejamiento y espera de aprobación por parte de la empresa.
- Estado pendiente y emparejado restaurado automáticamente al reabrir la aplicación.
- Credencial de emparejamiento persistida mediante el almacenamiento nativo de Capacitor Preferences.
- Consulta de los permisos y sus etiquetas reales desde Bee Core; no existe un catálogo local fijo.
- Desvinculación y actualización del estado del dispositivo.

## Conexión con Bee Core

Servidor predeterminado:

`https://beecore.beeprojects.net/api`

La URL se puede cambiar en Ajustes para entornos de desarrollo. La aplicación usa estas rutas:

| Método | Ruta | Uso |
|---|---|---|
| POST | `/connected-devices/pair` | Intercambia el token QR de un solo uso y recibe la credencial pendiente |
| GET | `/connected-devices/pairing-status` | Comprueba la aprobación y recibe los permisos declarados por conectores instalados |
| GET | `/connected-devices/device/me` | Obtiene el dispositivo, permisos concedidos y etiquetas dinámicas |
| POST | `/connected-devices/device/heartbeat` | Actualiza la última conexión |
| POST | `/connected-devices/device/unlink` | Desvincula el dispositivo y revoca su credencial |

El QR debe tener el formato `bee-device://pair?token=...`. La aprobación se realiza en Bee Core; escanear el QR no concede permisos. Las claves y etiquetas se reciben del servidor a partir de los manifiestos de los conectores instalados y habilitados. La aplicación no solicita, modifica ni amplía capacidades.

## Instalación y actualización en Windows

### Requisitos del ordenador

- Git.
- Node.js 22 LTS o superior.
- JDK 21.
- Android SDK y Android SDK Platform-Tools (`adb`).
- Depuración USB activada en el teléfono Android.

Configura `JAVA_HOME`, `ANDROID_HOME` (o `ANDROID_SDK_ROOT`) y añade `platform-tools` al `PATH`.

### Instalación automática desde un clon limpio

Abre PowerShell y ejecuta:

```powershell
git clone https://github.com/alexandre-aparicio/Bee-devices.git
cd Bee-devices
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install-android.ps1
```

El script:

1. Comprueba que estás en `main` y que no hay cambios locales sin guardar.
2. Hace `git fetch` y `git pull --ff-only origin main`.
3. Instala dependencias npm.
4. Genera el proyecto Android de Capacitor si todavía no existe.
5. Compila Angular y sincroniza Capacitor.
6. Compila el APK debug e intenta instalarlo por USB con `adb install -r`.

Conecta el teléfono, acepta el aviso de autorización de depuración USB y vuelve a ejecutar el script. Si hay varios teléfonos conectados, indica el serial:

```powershell
.\scripts\install-android.ps1 -DeviceSerial "SERIAL_DEL_TELEFONO"
```

Para compilar el APK sin instalarlo en un teléfono:

```powershell
.\scripts\install-android.ps1 -BuildOnly
```

Para hacer una instalación realmente limpia:

```powershell
.\scripts\install-android.ps1 -CleanInstall
```

**Atención:** `-CleanInstall` desinstala la aplicación anterior y elimina sus datos locales, incluida la credencial persistente de emparejamiento. Después habrá que generar un nuevo QR y autorizar el teléfono desde Bee Core. Sin ese parámetro, `adb install -r` actualiza la aplicación conservando sus datos.

El APK generado queda en:

`android/app/build/outputs/apk/debug/app-debug.apk`

### Instalación manual

Si prefieres ejecutar los pasos manualmente:

```powershell
npm install
npm run android:add
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Ejecuta `npm run android:add` solo cuando todavía no exista la carpeta `android`.

## Desarrollo web

```powershell
npm install
npm start
```

El escáner de cámara requiere Android nativo; la vista web permite revisar la interfaz, pero no sustituye la prueba en un teléfono.

## Arquitectura

- Angular standalone para estado y lógica de aplicación.
- CSS global propio, sin Ionic UI ni estilos remotos.
- Capacitor 7 para Android.
- ML Kit Barcode Scanning para QR.
- Cliente HTTP aislado en `src/app/connected-devices.client.ts`.
- Persistencia nativa de la credencial de dispositivo mediante Capacitor Preferences.

## Seguridad y autoridad

Bee Devices es un cliente de dispositivo, no un usuario ni una vía para saltarse permisos. Bee Core sigue siendo la autoridad para tenant, membresía, estado del dispositivo y concesión/revocación de capacidades. El cliente falla cerrado ante credenciales rechazadas. Las operaciones de negocio (TPV, inventario, control horario u otras) se habilitan mediante los conectores y permisos correspondientes.
