import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.positivekonnections.app',
  appName: 'Positive Konnections',
  webDir: 'www',
  plugins: {
    StatusBar: {
      style: 'DARK',
    },
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
