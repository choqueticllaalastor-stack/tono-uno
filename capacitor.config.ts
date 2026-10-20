import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tonouno.app",
  appName: "Tono Uno",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
