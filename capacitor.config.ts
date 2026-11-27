import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.beeprojects.devices",
  appName: "Bee Devices",
  webDir: "www/browser",
  bundledWebRuntime: false,
  plugins: {
    MLKitBarcodeScanning: {
      cameraFacing: "BACK",
      formats: ["QR_CODE"]
    }
  }
};

export default config;
