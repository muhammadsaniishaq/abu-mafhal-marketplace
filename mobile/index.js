// ─── Abu Mafhal Zero-Crash Production Shield ───
if (typeof global !== 'undefined') {
    // Intercept uncaught global JS errors so they NEVER terminate the Android process
    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
        const defaultHandler = typeof global.ErrorUtils.getGlobalHandler === 'function' ? global.ErrorUtils.getGlobalHandler() : null;
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
            try {
                console.error('[CRASH_SHIELD] Intercepted error:', error?.message || error, 'isFatal:', isFatal);
            } catch (_) {}
            // In development, pass to original handler for redbox
            if (__DEV__ && defaultHandler) {
                defaultHandler(error, isFatal);
            }
            // In production APK/AAB release: swallow fatal exit and keep app alive safely
        });
    }
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
