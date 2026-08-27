import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to AppSettingsPlugin.java — see §15 (camera permission denied).
 *
 * Imported only from `platform.openAppSettings()`, behind an `isNative()` guard.
 * No component may import this directly (§9.2).
 */
export interface AppSettingsPlugin {
  /** Opens this app's entry in Android system settings. */
  open(): Promise<void>;
}

export const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');
