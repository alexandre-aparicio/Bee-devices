import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.beeprojects.devices',
  appName: 'Bee Devices',
  webDir: 'www/browser',
  bundledWebRuntime: false,
  plugins: {
    MLKitBarcodeScanning: {
      barcodeFormats: ['QR_CODE'],
      googleBarcodeScannerModuleInstall: true
    }
  }
};

export default config;
