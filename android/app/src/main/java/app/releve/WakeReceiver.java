package app.releve;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Fires at the instant of a reminder, only to deal with the case the ordinary
 * notification cannot: the screen is off, so nothing is read.
 *
 * When the screen is already on, this does nothing at all — the reminder
 * notification posted by @capacitor/local-notifications has already appeared as
 * a heads-up, and a second one would only be noise. When the screen is off, it
 * posts a full-screen-intent notification, which is the only sanctioned way for
 * a background app to start an activity: Android turns the screen on and shows
 * MainActivity over the lock screen.
 *
 * The notification itself is silent and short-lived — ScreenWakePlugin cancels
 * it as soon as the activity resumes, leaving the real reminder (with its three
 * actions) alone in the shade.
 */
public class WakeReceiver extends BroadcastReceiver {

    public static final String CHANNEL_ID = "releve_wake";
    /** One at a time is enough, so a fixed id makes it cancellable without bookkeeping. */
    public static final int NOTIFICATION_ID = 90210;
    public static final String EXTRA_ROUTE = "wakeRoute";
    public static final String EXTRA_TITLE = "wakeTitle";
    public static final String EXTRA_ID = "wakeId";
    /** True when the break should take the screen even if it is already on. */
    public static final String EXTRA_ALWAYS = "wakeAlways";

    @Override
    public void onReceive(Context context, Intent intent) {
        // A phone lying face up on the desk has its screen off most of the time,
        // and the ordinary notification covers the rest — so by default this
        // only steps in when nothing else could be seen. When the user has asked
        // to be alerted rather than merely notified, it takes the screen either
        // way: a heads-up banner is exactly what gets worked through.
        boolean always = intent.getBooleanExtra(EXTRA_ALWAYS, false);
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (!always && power != null && power.isInteractive()) return;

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        createChannel(manager);

        String route = intent.getStringExtra(EXTRA_ROUTE);
        String title = intent.getStringExtra(EXTRA_TITLE);
        int id = intent.getIntExtra(EXTRA_ID, 0);

        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(EXTRA_ROUTE, route);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                id,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_logoff)
                .setContentTitle(title == null ? "" : title)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pending, true)
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setSilent(true)
                .build();

        manager.notify(NOTIFICATION_ID, notification);
    }

    /**
     * A full-screen intent is only honoured on a HIGH importance channel, but
     * the sound and vibration belong to the reminder channel — this one must
     * stay silent or every break would alert twice.
     */
    static void createChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Réveil de l’écran", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Allume l’écran quand un rappel tombe téléphone en veille.");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
