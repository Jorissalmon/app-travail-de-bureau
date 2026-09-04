package app.releve;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The screen-wake alarms, and the record of them that lets them be rebuilt.
 *
 * They used to be stored as a bare set of ids — enough to cancel them, not
 * enough to recreate them. Android drops every alarm on reboot, so the reminder
 * notification came back (the notifications plugin registers its own boot
 * receiver) while the alarm that turns the screen on did not, until the app was
 * next opened by hand. "The alarm didn't go off after I restarted the phone" is
 * one of the most common complaints made of reminder apps on Android, and it is
 * the kind that gets an app deleted rather than reported.
 *
 * So the whole payload is kept, and BootReceiver replays it.
 */
final class WakeAlarms {

    private static final String PREFS = "releve_screen_wake";
    /** A JSON array of {id, at, route, title, always}. */
    private static final String KEY_ALERTS = "alerts";

    private WakeAlarms() {}

    static PendingIntent pendingFor(
            Context context, int id, String route, String title, boolean always) {
        Intent intent = new Intent(context, WakeReceiver.class);
        intent.putExtra(WakeReceiver.EXTRA_ID, id);
        intent.putExtra(WakeReceiver.EXTRA_ROUTE, route);
        intent.putExtra(WakeReceiver.EXTRA_TITLE, title);
        intent.putExtra(WakeReceiver.EXTRA_ALWAYS, always);
        return PendingIntent.getBroadcast(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Arm one alarm. Silently does nothing for an instant already past. */
    static void arm(Context context, AlarmManager alarms, JSONObject alert) {
        long at = alert.optLong("at", 0L);
        if (at <= System.currentTimeMillis()) return;

        PendingIntent pending = pendingFor(
                context,
                alert.optInt("id", 0),
                alert.optString("route", null),
                alert.optString("title", null),
                alert.optBoolean("always", false));

        if (canScheduleExact(alarms)) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        }
    }

    static boolean canScheduleExact(AlarmManager alarms) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return alarms.canScheduleExactAlarms();
    }

    static JSONArray read(Context context) {
        String raw = prefs(context).getString(KEY_ALERTS, "[]");
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Exception e) {
            // A corrupted store must never stop a reminder from being armed.
            return new JSONArray();
        }
    }

    static void write(Context context, JSONArray alerts) {
        prefs(context).edit().putString(KEY_ALERTS, alerts.toString()).apply();
    }

    /**
     * Remember `alert`, replacing any entry with the same id, and drop the ones
     * whose instant has passed so the store cannot grow without bound.
     */
    static JSONArray merge(JSONArray stored, JSONObject alert) {
        JSONArray out = new JSONArray();
        long now = System.currentTimeMillis();
        int id = alert.optInt("id", 0);
        for (int i = 0; i < stored.length(); i++) {
            JSONObject existing = stored.optJSONObject(i);
            if (existing == null) continue;
            if (existing.optInt("id", 0) == id) continue;
            if (existing.optLong("at", 0L) <= now) continue;
            out.put(existing);
        }
        out.put(alert);
        return out;
    }

    /** Cancel every alarm we know about and forget them. */
    static void cancelAll(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        JSONArray stored = read(context);
        if (alarms != null) {
            for (int i = 0; i < stored.length(); i++) {
                JSONObject alert = stored.optJSONObject(i);
                if (alert == null) continue;
                alarms.cancel(pendingFor(context, alert.optInt("id", 0), null, null, false));
            }
        }
        write(context, new JSONArray());
    }

    /** Re-arm everything still ahead of us. Called after a reboot. */
    static void restore(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        JSONArray stored = read(context);
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < stored.length(); i++) {
            JSONObject alert = stored.optJSONObject(i);
            if (alert == null || alert.optLong("at", 0L) <= now) continue;
            arm(context, alarms, alert);
            kept.put(alert);
        }
        write(context, kept);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
