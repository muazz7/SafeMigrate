import type { CapacitorConfig } from '@capacitor/cli';

/**
 * BUILD-SPEC §4.3.
 * `server.url` is deliberately absent: setting it would make the APK a thin browser
 * pointed at the live site, destroying offline capability and the reason to ship an app.
 */
const config: CapacitorConfig = {
  appId: 'org.safemigrate.app',
  appName: 'নিরাপদ প্রবাস',
  webDir: 'out',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#0F6B4F' },
  },
};

export default config;
