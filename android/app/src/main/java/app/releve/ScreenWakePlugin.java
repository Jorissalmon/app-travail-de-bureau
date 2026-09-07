package app.releve;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/**
 * Mirrors each scheduled reminder with an alarm whose only job is to wake the
 * screen (see WakeReceiver). The reminder engine itself stays in JavaScript,
 * on @capacitor/local-notifications — this plugin adds nothing to it but the
 * one thing that plugin cannot do: show a page over the lock screen.
 */
@CapacitorPlugin(name = "ScreenWake")
public class ScreenWakePlugin extends Plugin {

    @Override
    public void load() {
        emitRoute(getActivity() == null ? null : getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        emitRoute(intent);
    }

    /**
     * The wake notification exists only to launch the activity. Once we are on
     * screen it is a duplicate of the reminder, so it goes.
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        NotificationManager manager =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(WakeReceiver.NOTIFICATION_ID);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alerts = call.getArray("alerts");
        if (alerts == null) {
            call.reject("alerts manquant");
            return;
        }

        AlarmManager alarms =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) {
            call.reject("AlarmManager indisponible");
            return;
        }

        try {
            JSONArray stored = WakeAlarms.read(getContext());
            List<JSONObject> items = alerts.toList();
            for (JSONObject item : items) {
                if (item.optLong("at", 0L) <= System.currentTimeMillis()) continue;
                WakeAlarms.arm(getContext(), alarms, item);
                // The whole payload is kept, not just the id: it is what lets
                // BootReceiver put the alarm back after a restart.
                stored = WakeAlarms.merge(stored, item);
            }
            WakeAlarms.write(getContext(), stored);
        } catch (Exception e) {
            call.reject("Programmation impossible : " + e.getMessage());
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        WakeAlarms.cancelAll(getContext());

        NotificationManager manager =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(WakeReceiver.NOTIFICATION_ID);

        call.resolve();
    }

    // ---------------------------------------------------------------------
    // Audio focus
    // ---------------------------------------------------------------------

    /**
     * What a web page cannot do: tell Android that something short and
     * important is about to play, so whatever music or podcast is running
     * turns itself down for the duration and comes back afterwards.
     *
     * TRANSIENT_MAY_DUCK rather than a full GAIN: a two-second bowl has no
     * business pausing a podcast, only leaning on it.
     */
    private AudioFocusRequest focusRequest;

    @PluginMethod
    public void duckOthers(PluginCall call) {
        AudioManager audio =
                (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) {
            call.resolve();
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (focusRequest == null) {
                    AudioAttributes attributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    focusRequest = new AudioFocusRequest
                            .Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attributes)
                            // No listener, so this must stay false: we never
                            // want the other app paused, only quieter.
                            .setWillPauseWhenDucked(false)
                            .build();
                }
                audio.requestAudioFocus(focusRequest);
            } else {
                audio.requestAudioFocus(
                        null,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            }
        } catch (Exception e) {
            // Refused focus is not a failure: the bowl still rings, on top.
        }
        call.resolve();
    }

    @PluginMethod
    public void stopDucking(PluginCall call) {
        AudioManager audio =
                (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) {
            call.resolve();
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
            } else {
                audio.abandonAudioFocus(null);
            }
        } catch (Exception e) {
            // Nothing held, nothing to give back.
        }
        call.resolve();
    }

    /**
     * Android 14 stopped granting USE_FULL_SCREEN_INTENT at install to apps
     * that are not phone or alarm clocks, so it has to be asked for like any
     * other runtime grant. Below 14 it is granted by the manifest alone.
     */
    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", canUseFullScreenIntent());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!canUseFullScreenIntent()) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
            } catch (Exception e) {
                // No such settings screen on this build: nothing else to offer.
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", canUseFullScreenIntent());
        call.resolve(ret);
    }

    private boolean canUseFullScreenIntent() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        NotificationManager manager =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.canUseFullScreenIntent();
    }

    /**
     * Retained, because a cold start from the lock screen reaches load() long
     * before the web layer has had a chance to add its listener.
     */
    private void emitRoute(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(WakeReceiver.EXTRA_ROUTE);
        if (route == null) return;
        intent.removeExtra(WakeReceiver.EXTRA_ROUTE);
        JSObject data = new JSObject();
        data.put("route", route);
        notifyListeners("wakeAlert", data, true);
    }

}
