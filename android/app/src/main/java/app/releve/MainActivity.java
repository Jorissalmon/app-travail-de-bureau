package app.releve;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenWakePlugin.class);
        // Read before super: loading the plugins consumes the route extra.
        boolean wake = cameFromWake(getIntent());
        super.onCreate(savedInstanceState);
        applyWakeFlags(wake);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        boolean wake = cameFromWake(intent);
        super.onNewIntent(intent);
        setIntent(intent);
        applyWakeFlags(wake);
    }

    private boolean cameFromWake(Intent intent) {
        return intent != null && intent.hasExtra(WakeReceiver.EXTRA_ROUTE);
    }

    /**
     * Only a launch that came from a wake alarm may show over the lock screen
     * and turn the display on. Opening the app by hand must behave like any
     * other app, so the flags are cleared again on the next ordinary start.
     */
    private void applyWakeFlags(boolean wake) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(wake);
            setTurnScreenOn(wake);
        } else {
            int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (wake) getWindow().addFlags(flags);
            else getWindow().clearFlags(flags);
        }
    }
}
