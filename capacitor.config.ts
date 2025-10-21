import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.health.positive_konnections',
  appName: 'Positive Konnections',
  webDir: 'www',
  cordova: {
    preferences: {
      ScrollEnabled: 'false',
      BackupWebStorage: 'none',
      SplashMaintainAspectRatio: 'true',
      FadeSplashScreenDuration: '0',
      SplashShowOnlyFirstTime: 'true',
      SplashScreen: 'screen',
      SplashScreenDelay: '2000'
    }
  }
};

export default config;
