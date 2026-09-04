package app.releve;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Puts the screen-wake alarms back after a reboot.
 *
 * Android clears every pending alarm when the device restarts. The reminder
 * notifications themselves survive — @capacitor/local-notifications declares
 * its own boot receiver — but the alarm that turns a dark screen on did not, so
 * until the app was next opened by hand a reminder arrived as a banner nobody
 * would see. Reinstalling or updating the app clears them for the same reason,
 * hence MY_PACKAGE_REPLACED alongside BOOT_COMPLETED.
 *
 * Everything is wrapped: a receiver that throws at boot shows the user a crash
 * dialog for their trouble, which would be a far worse bargain than a missed
 * screen wake.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (action == null) return;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        try {
            WakeAlarms.restore(context);
        } catch (Exception e) {
            // Nothing to recover from here, and nothing worth crashing for.
        }
    }
}
