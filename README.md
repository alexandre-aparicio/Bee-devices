# Bee Devices

Aplicación Android compañera de **Bee Core**. Permite vincular un teléfono como dispositivo físico de la empresa y consultar únicamente las capacidades que Bee Core haya concedido.

## Qué hace esta versión

- Interfaz móvil propia, responsive y sin componentes visuales de Ionic.
- Escaneo de QR mediante la cámara y ML Kit de Google.
- Emparejamiento con el endpoint oficial de Connected Devices.
- Espera de aprobación por parte de la empresa.
- Consulta del perfil y de los permisos reales del dispositivo.
- Actualización del estado y desvinculación.
- Credencial mantenida solo en memoria durante esta primera versión; al cerrar el proceso Android será necesario volver a emparejar. No se guarda ningún secreto en almacenamiento no seguro.

## Conexión con Bee Core

Servidor predeterminado:

`https://beecore.beeprojects.net/api`

La URL se puede cambiar en Ajustes para entornos de desarrollo. La aplicación usa estas rutas existentes:

| Método | Ruta | Uso |
|---|---|---|
| POST | `/connected-devices/pair` | Intercambia el token QR de un solo uso y recibe la credencial pendiente |
| GET | `/connected-devices/pairing-status` | Comprueba la aprobación con `x-device-pairing-secret` |
| GET | `/connected-devices/device/me` | Obtiene el dispositivo y sus `grantedCapabilities` |
| POST | `/connected-devices/device/heartbeat` | Actualiza la última conexión |
| POST | `/connected-devices/device/unlink` | Desvincula el dispositivo y revoca su credencial |

El QR debe tener el formato `bee-device://pair?token=...`. La aprobación se realiza en Bee Core; escanear el QR no concede permisos. La aplicación no solicita, modifica ni amplía capacidades. No llama a rutas de capacidades que no formen parte del contrato actual.

## Requisitos

- Node.js 22 LTS
- npm
- Android Studio y Android SDK
- Un dispositivo Android con depuración USB para instalar desde Android Studio

## Instalación desde un clon limpio

En PowerShell, desde la carpeta del repositorio:

```powershell
npm install
npm run build
npm run android:add
npm run cap:sync
npm run android
```

Después, en Android Studio, espera a Gradle Sync y pulsa **Run**.

Si ya existe la carpeta `android`, no ejecutes `android:add` otra vez. Usa:

```powershell
npm install
npm run cap:sync
npm run android
```

Para regenerar los recursos web y sincronizarlos con Android:

```powershell
npm run cap:sync
```

La carpeta nativa `android/` la genera Capacitor en cada entorno y no se versiona. El script de preparación comprueba que exista `MainActivity.java` antes de sincronizar.

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

## Alcance y seguridad

Bee Devices es un cliente de dispositivo, no un usuario ni una vía para saltarse permisos. Bee Core sigue siendo la autoridad para tenant, membresía, estado del dispositivo y concesión/revocación de capacidades. El cliente falla cerrado ante credenciales rechazadas. Las operaciones de negocio (TPV, inventario, control horario u otras) no se implementan en esta versión.

La credencial de dispositivo solo vive en memoria en esta entrega. El almacenamiento persistente seguro con Android Keystore se incorporará como una fase separada; no se sustituye por almacenamiento local en texto claro.
