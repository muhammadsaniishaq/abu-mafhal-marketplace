import 'react-native-gesture-handler';

// ─── Abu Mafhal Zero-Crash Production Shield ───
if (typeof global !== 'undefined') {
    // Intercept uncaught global JS errors so they NEVER terminate the Android process
    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
        const defaultHandler = typeof global.ErrorUtils.getGlobalHandler === 'function' ? global.ErrorUtils.getGlobalHandler() : null;
        global.ErrorUtils.setGlobalHandler((error, isFatal) => {
            try {
                console.error('[CRASH_SHIELD] Intercepted error:', error?.message || error, 'isFatal:', isFatal);
                if (error?.stack) {
                    console.error('[CRASH_SHIELD] Stack trace:', error.stack);
                }
            } catch (_) {}

            if (defaultHandler) {
                defaultHandler(error, isFatal);
            }
        });
    }

    // Intercept unhandled promise rejections
    if (typeof global.PromiseRejectionTracking !== 'undefined' && global.PromiseRejectionTracking.enable) {
        try {
            global.PromiseRejectionTracking.enable({
                allRejections: true,
                onUnhandled: (id, rejection) => {
                    console.warn('[CRASH_SHIELD] Unhandled Promise Rejection:', id, rejection?.message || rejection);
                },
                onHandled: () => {},
            });
        } catch (_) {}
    }
}

import { registerRootComponent } from 'expo';
import React from 'react';
import App from './App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

function Root() {
    return (
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}

registerRootComponent(Root);

