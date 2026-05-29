import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable as firebaseHttpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import {
    firebaseConfig,
    connectFirebaseEmulators,
    finishAuthRedirectIfNeeded,
    prepareAuthPersistence,
    useNgrokSameOriginProxy,
    createNgrokCallable,
} from "./firebase-local.js?v=2026.05.29.auth-persist";

/** ngrok HTTPS：避免 SDK http://host:443 Mixed Content；localhost 仍用標準 httpsCallable */
export function httpsCallable(functions, name) {
    if (useNgrokSameOriginProxy()) {
        return createNgrokCallable(auth, name);
    }
    return firebaseHttpsCallable(functions, name);
}

export { firebaseHttpsCallable };

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-east1");

connectFirebaseEmulators({ auth, db, functions });

let readyPromise = null;

/** 單次處理 redirect 登入、持久化與 session 還原（全站共用） */
export function ensureFirebaseReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            await prepareAuthPersistence(auth);
            await finishAuthRedirectIfNeeded(auth);
            await auth.authStateReady();
        })();
    }
    return readyPromise;
}

/** 同源首頁（避免手機 /courses/ → / 導致 session 異常） */
export function getAppHomeUrl() {
    return `${window.location.origin}/index.html`;
}

export function exposeFirebaseGlobals() {
    window.vibeApp = app;
    window.getFunctions = getFunctions;
    window.httpsCallable = httpsCallable;
    window.vibeFirebaseReady = true;
}
