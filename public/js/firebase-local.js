import {
    connectAuthEmulator,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
    authDomain: "e-learning-942f7.firebaseapp.com",
    projectId: "e-learning-942f7",
    storageBucket: "e-learning-942f7.firebasestorage.app",
    messagingSenderId: "878397058574",
    appId: "1:878397058574:web:28aaa07a291ee3baab165f"
};

const EMULATOR_HOST_KEY = "VC_EMULATOR_HOST";

export function isLocalDev() {
    const host = window.location.hostname;
    return host === "127.0.0.1" || host === "localhost";
}

/** ngrok 外網預覽（透過 Hosting 同源代理連到本機 Emulator） */
export function isNgrokHost() {
    const host = window.location.hostname || "";
    return host.endsWith(".ngrok-free.dev") || host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io");
}

export function isDemoMode() {
    return new URLSearchParams(window.location.search).get("demo") === "1";
}

/** localhost 或 ngrok 皆視為本地開發，連接 Emulator */
export function shouldUseEmulators() {
    return isLocalDev() || isNgrokHost();
}

/** HTTPS ngrok 頁面使用的同源代理 port（443 或實際 port） */
function getNgrokProxyPort() {
    if (window.location.port) return parseInt(window.location.port, 10);
    return window.location.protocol === "https:" ? 443 : 80;
}

/**
 * Emulator 連線主機（直連，用於 localhost 或手機 + LAN IP）：
 * - 預設 127.0.0.1
 * - 手機/LAN：?emulatorHost=192.168.x.x
 */
export function getEmulatorHost() {
    const fromQuery = new URLSearchParams(window.location.search).get("emulatorHost");
    if (fromQuery) {
        try {
            localStorage.setItem(EMULATOR_HOST_KEY, fromQuery.trim());
        } catch (_) { /* ignore */ }
        return fromQuery.trim();
    }
    try {
        const stored = localStorage.getItem(EMULATOR_HOST_KEY);
        if (stored) return stored;
    } catch (_) { /* ignore */ }
    return "127.0.0.1";
}

/** ngrok 是否透過同源 HTTPS 代理（預設；僅 ?emulatorHost= 時改直連 LAN） */
export function useNgrokSameOriginProxy() {
    if (!isNgrokHost()) return false;
    const fromQuery = new URLSearchParams(window.location.search).get("emulatorHost");
    return !fromQuery;
}

/**
 * Firebase SDK connectFunctionsEmulator 在 HTTPS 頁面會發 http://host:443（Mixed Content 被擋）。
 * ngrok 同源代理時改以 HTTPS fetch 呼叫 /{projectId}/{region}/{name}。
 */
export function createNgrokCallable(auth, name, region = "asia-east1") {
    const projectId = firebaseConfig.projectId;
    return async (payload) => {
        const url = `${window.location.origin}/${projectId}/${region}/${name}`;
        const headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
        };
        if (auth?.currentUser) {
            headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
        }
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ data: payload ?? {} }),
        });
        let json;
        try {
            json = await res.json();
        } catch (_) {
            throw Object.assign(new Error(`Functions proxy HTTP ${res.status}`), { code: "functions/internal" });
        }
        if (json.error) {
            const status = (json.error.status || "INTERNAL").toLowerCase();
            const message = json.error.message || json.error.status || "internal";
            throw Object.assign(new Error(message), { code: `functions/${status}` });
        }
        return { data: json.result };
    };
}

/** 僅在 demo=1 時保留查詢參數 */
export function withDemoQuery(url) {
    if (!url || !isDemoMode()) return url;
    const hasDemo = /[?&]demo=1(?:&|$)/.test(url);
    if (hasDemo) return url;
    return `${url}${url.includes("?") ? "&" : "?"}demo=1`;
}

const connected = { auth: false, db: false, functions: false };

/** 確保登入狀態寫入 localStorage（ngrok redirect 必備） */
export async function prepareAuthPersistence(auth) {
    if (!auth) return;
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (e) {
        console.warn("[Firebase] setPersistence failed:", e);
    }
}

/** 每個頁面載入時處理 Google redirect 回傳（避免只在 login.html 處理導致首頁仍顯示訪客） */
export async function finishAuthRedirectIfNeeded(auth) {
    if (!auth) return null;
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            console.info("[Firebase] Redirect sign-in completed:", result.user.email);
        }
        return result;
    } catch (e) {
        console.warn("[Firebase] getRedirectResult failed:", e);
        return null;
    }
}

/** Connect Firebase client SDKs to local emulators (no-op in production). */
export function connectFirebaseEmulators({ auth, db, functions } = {}) {
    if (!shouldUseEmulators()) return;

    if (useNgrokSameOriginProxy()) {
        const hostname = window.location.hostname;
        const port = getNgrokProxyPort();
        const origin = window.location.origin;

        if (auth && !connected.auth) {
            connected.auth = true;
            // SDK 會請求 {origin}/identitytoolkit.googleapis.com/...（需 Hosting rewrite 轉發至 9099）
            connectAuthEmulator(auth, origin, { disableWarnings: true });
            console.info(`[Firebase] Auth Emulator (ngrok proxy) -> ${origin}`);
        }
        if (db && !connected.db) {
            connected.db = true;
            connectFirestoreEmulator(db, hostname, port);
            console.info(`[Firebase] Firestore Emulator (ngrok proxy) -> ${hostname}:${port}`);
        }
        if (functions && !connected.functions) {
            connected.functions = true;
            // 不在 ngrok HTTPS 使用 connectFunctionsEmulator（SDK 會發 http://host:443 被 Mixed Content 擋）
            // Callable 請用 firebase-app-shared 的 httpsCallable（同源 HTTPS fetch）
            console.info(`[Firebase] Functions via ngrok HTTPS fetch -> ${origin}/${firebaseConfig.projectId}/asia-east1/*`);
        }
        return;
    }

    const host = getEmulatorHost();

    if (auth && !connected.auth) {
        connected.auth = true;
        connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
        console.info(`[Firebase] Auth Emulator -> http://${host}:9099`);
    }
    if (db && !connected.db) {
        connected.db = true;
        connectFirestoreEmulator(db, host, 8080);
        console.info(`[Firebase] Firestore Emulator -> ${host}:8080`);
    }
    if (functions && !connected.functions) {
        connected.functions = true;
        connectFunctionsEmulator(functions, host, 5001);
        console.info(`[Firebase] Functions Emulator -> ${host}:5001`);
    }
}
