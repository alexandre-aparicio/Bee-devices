# Bee Devices

Aplicación Android compañera de Bee Core para emparejar dispositivos físicos y ejecutar únicamente las capacidades que la empresa haya concedido a cada dispositivo.

## Stack

- Ionic + Angular standalone.
- Capacitor para Android.
- ML Kit Barcode Scanning para leer códigos QR.
- Credencial de dispositivo mantenida solo en memoria en esta primera versión; no se persiste en almacenamiento local.

## Emparejamiento

1. Abrir **Bee Devices** y escanear el QR `bee-device://pair?token=...` creado desde Connected Devices.
2. La app intercambia el token de un solo uso mediante `POST /connected-devices/pair`.
3. Conserva temporalmente la credencial devuelta y consulta `GET /connected-devices/pairing-status` cada cuatro segundos.
4. Cuando la empresa aprueba el dispositivo, la app obtiene `GET /connected-devices/device/capabilities`.
5. Muestra el estado **Emparejado** y los permisos concedidos como badges informativos. Android no modifica grants ni presenta acciones funcionales en esta fase.

El emparejamiento no depende de extensiones. Un dispositivo puede quedar emparejado con cero capacidades y recibir nuevas autorizaciones más adelante.

## Permisos visibles

Cuando la empresa aprueba el dispositivo, la app consulta el catálogo autorizado y muestra como badges las capacidades devueltas por Bee Core. Si todavía no hay ninguna, mantiene el estado **Emparejado** y muestra que no existen permisos concedidos. La gestión de permisos se realiza desde Bee-Core; Android solo los consulta y presenta.

La app reconoce, entre otras, estas capacidades cuando la extensión **Time Tracking Connected** está instalada, habilitada y concedida al dispositivo:

| Capability ID | Acción | Endpoint |
|---|---|---|
| `time-tracking.clock-in` | Registrar entrada | `POST /time-tracking-connected/device/clock-in` |
| `time-tracking.clock-out` | Registrar salida | `POST /time-tracking-connected/device/clock-out` |
| `time-tracking.records.read` | Consultar registros propios | `GET /time-tracking-connected/device/sessions` |

En esta fase estas capacidades se muestran únicamente como badges informativos. Las acciones de Control Horario desde Android quedan fuera de la interfaz hasta completar y validar el flujo de autorización.

## Desarrollo

Requisitos: Node.js compatible con Angular 22, npm, Android Studio y Android SDK.

```bash
npm install
npm run start
```

Para generar y abrir el proyecto Android:

```bash
npx cap add android
npm run cap:sync
npm run android
```

La URL de API inicial es `https://beecore.beeprojects.net/api`; puede cambiarse desde la pantalla de la aplicación para desarrollo.

## Estado

- [x] Proyecto Ionic/Angular + Capacitor inicial.
- [x] Escaneo QR con ML Kit.
- [x] Intercambio del QR y consulta de aprobación.
- [x] Descubrimiento dinámico de capacidades concedidas.
- [ ] Acciones de Control Horario desde Android (pospuestas; primero se valida emparejamiento y visualización de permisos).
- [x] Desvinculación del dispositivo.
- [ ] Almacenamiento seguro de credenciales mediante Android Keystore.
- [x] Refresco del catálogo al volver la app a primer plano y acción manual de actualización.
- [ ] Validación de build e integración en dispositivo Android.
- [ ] Pruebas de seguridad, expiración, revocación y operación offline.

**Importante:** esta implementación aún no ha sido compilada ni probada. Las pruebas se reservarán para la fase final de validación acordada.
