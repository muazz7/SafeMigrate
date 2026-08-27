package org.safemigrate.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens this app's system settings page.
 *
 * BUILD-SPEC §15 requires that a denied camera permission offers a button into
 * app settings. Android only allows re-granting a permanently denied permission
 * from there, and Capacitor 6 ships no first-party plugin for it, so this is the
 * smallest possible native surface to satisfy that requirement.
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // The UI already shows written instructions as a fallback, so a
            // failure here must not surface a raw Android error to the user.
            call.reject("Could not open app settings");
        }
    }
}
