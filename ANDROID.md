# Tono Uno para Android

El proyecto incluye un contenedor Android nativo creado con Capacitor.

## Requisitos

- Android Studio con el Android SDK instalado
- Java 21 (Android Studio incluye una versión compatible)
- Un teléfono Android o emulador

## Abrir y generar el APK

```bash
pnpm install
pnpm android:sync
pnpm android:open
```

En Android Studio, usa **Build → Build App Bundles or APKs → Build APKs**.

También puedes generar un APK de prueba desde la terminal:

```bash
pnpm android:apk
```

El resultado se crea en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Bluetooth

El proyecto incluye un complemento nativo para módulos HC-05 y HC-06 mediante Bluetooth clásico/Serial (SPP). La aplicación solicita el permiso de dispositivos cercanos, muestra los dispositivos vinculados y abre los ajustes de Android para vincular un módulo nuevo.

El PIN habitual de estos módulos es `1234` o `0000`.

## Publicar y activar el código QR

El flujo `.github/workflows/android-release.yml` compila y publica el APK automáticamente en GitHub Releases. Para usarlo:

1. Publica este proyecto en un repositorio de GitHub.
2. Crea y sube una etiqueta:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. Espera a que termine la acción **Publicar APK de Android**.

El APK se publicará como `tono-uno.apk`. Durante la compilación, la aplicación recibe automáticamente la URL de la última versión y muestra un código QR funcional en el botón **Descargar app**.
