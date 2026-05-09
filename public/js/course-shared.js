/**
 * course-shared.js?v=2026.04.05.FINAL_V8_STABLE
 * Shared logic for Vibe Coding Course Units
 * Handles: Media Overlay (Video/Doc), Fullscreen, Mobile Zoom, and Animations
 */

// Guard: Only execute once per window context
if (window.__courseSharedLoaded) {
    console.log("[CourseShared] Already loaded, skipping.");
} else {
window.__courseSharedLoaded = true;

// Initializer
function init() {
    console.log("[CourseShared] Initializing...");
    injectMediaOverlay();
    initAnimations();
    initFirebaseFeatures(); // [NEW] Start Firebase (Tracking + Assignments)
    initGithubReadme(); // [V8.2] Fetch and render GitHub README if applicable
}

// Robust Initialization Logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM already ready
    init();
}

// Fallback: Ensure animations run even if DOMContentLoaded missed
window.addEventListener('load', () => {
    console.log("[CourseShared] Window Load fallback check");
    initAnimations();
});

// Global State (Using var for redeclaration safety in Master/Unit contexts)
var currentMode = typeof currentMode !== 'undefined' ? currentMode : null;
var sessionStartTime = typeof sessionStartTime !== 'undefined' ? sessionStartTime : null;
var currentScale = typeof currentScale !== 'undefined' ? currentScale : 1.0;
var BASE_DOC_WIDTH = typeof BASE_DOC_WIDTH !== 'undefined' ? BASE_DOC_WIDTH : 850;
var boundDocs = typeof boundDocs !== 'undefined' ? boundDocs : new Set(); // To prevent duplicate event listeners
var globalLessonsData = typeof globalLessonsData !== 'undefined' ? globalLessonsData : null; // [NEW] Cache for Firestore-based lessons
var globalCourseConfigs = typeof globalCourseConfigs !== 'undefined' ? globalCourseConfigs : null; // [NEW] Cache for Firestore configs

/**
 * Global utility for resizing iframes (used in Master course pages)
 * Moved to course-shared.js for synchronous availability.
 */
window.resizeIframe = function (obj) {
    if (obj && obj.contentWindow) {
        try {
            const height = obj.contentWindow.document.documentElement.scrollHeight;
            obj.style.height = height + 'px';
        } catch (e) {
            console.warn("[CourseShared] Cannot resize cross-origin iframe or missing contentWindow:", e);
        }
    }
};

/**
 * [NEW] Helper to wait for Firebase SDK injection
 */
async function waitForVibeFirebase(timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (typeof window.getFunctions !== 'undefined' && typeof window.httpsCallable !== 'undefined') {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
}

/**
 * [NEW] Centralized Lesson Fetching (Firestore via Cloud Function)
 * Replaces fetch('./lessons.json')
 */
async function vibeFetchLessons() {
    if (window.globalLessonsData && window.globalLessonsData.length > 0) {
        return window.globalLessonsData;
    }

    // Wait for SDK if it's currently being injected
    const isReady = await waitForVibeFirebase();
    if (!isReady) {
        console.warn("[CourseShared] Firebase SDK timed out. Firestore data unavailable.");
        return [];
    }

    try {
        const functions = window.getFunctions(window.vibeApp, 'asia-east1');
        const getLessonsFunc = window.httpsCallable(functions, 'getLessonsMetadata');
        
        console.log("[CourseShared] Fetching lessons metadata from Firestore...");
        const result = await getLessonsFunc();
        
        if (result.data && result.data.lessons) {
            window.globalLessonsData = result.data.lessons;
            return window.globalLessonsData;
        }
        return [];
    } catch (err) {
        console.error("[CourseShared] vibeFetchLessons failed:", err);
        return [];
    }
}
window.vibeFetchLessons = vibeFetchLessons;

/**
 * Injects the standard Media Overlay HTML into the body
 */
function injectMediaOverlay() {
    if (document.getElementById('media-overlay')) return; // Already exists

    const overlayHTML = `
    <div id="media-overlay" class="fixed inset-0 bg-black hidden flex flex-col overflow-hidden" style="z-index: 1000000 !important;">
        <!-- Doc Container (Responsive Padding) -->
        <div id="doc-wrapper" class="hidden flex-grow w-full relative overflow-auto bg-gray-100 flex justify-center p-0">
            <iframe id="doc-frame" class="border-0 bg-white shadow-2xl origin-top"
                style="width: 100%; min-height: 100%; transition: transform 0.2s ease;" src="">
            </iframe>
        </div>

        <!-- Video Container -->
        <div id="video-wrapper" class="hidden flex-grow w-full bg-black flex justify-center items-center">
            <iframe id="video-frame" class="w-full h-full" src="" title="Course Video" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen>
            </iframe>
        </div>

        <!-- Close Button (Fixed) -->
        <button onclick="closeModal()"
            style="z-index: 1000001 !important;"
            class="close-video-btn fixed top-3 right-3 md:top-6 md:right-6 text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full shadow-xl transition cursor-pointer pointer-events-auto flex items-center gap-2 text-xs md:text-sm font-bold">
            <span>✕</span> 關閉 (Close)
        </button>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

// Explicitly export to window to avoid scope issues
window.enterMediaMode = enterMediaMode;
window.closeModal = closeModal;

// [COMPATIBILITY] Restore window.courseShared for older/advanced unit files
window.courseShared = {
    enterMediaMode,
    closeModal,
    autoFitZoom
};

/**
 * Opens the Media Overlay
 */
function enterMediaMode(mode, url) {
    try {
        console.log(`[Media] Entering mode: ${mode}`);
        currentMode = mode;
        const overlay = document.getElementById('media-overlay');

        // Safety check: if overlay doesn't exist, try injecting it again
        if (!overlay) {
            console.warn("[Media] Overlay not found, re-injecting...");
            injectMediaOverlay();
            if (!document.getElementById('media-overlay')) {
                alert("Component Error: Media Overlay missing.");
                return;
            }
        }

        const O = document.getElementById('media-overlay');
        const docWrapper = document.getElementById('doc-wrapper');
        const videoWrapper = document.getElementById('video-wrapper');
        const docFrame = document.getElementById('doc-frame');
        const videoFrame = document.getElementById('video-frame');

        // Reset UI
        docWrapper.classList.add('hidden');
        videoWrapper.classList.add('hidden');
        O.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Determine Source
        let targetSrc = "";
        if (url) {
            targetSrc = url;
        } else {
            // Priority: window.RESOURCES -> local RESOURCES
            if (typeof window.RESOURCES !== 'undefined') {
                targetSrc = window.RESOURCES[mode];
                if (!targetSrc && mode === 'video') targetSrc = window.RESOURCES['youtube'];
            } else if (typeof RESOURCES !== 'undefined') {
                targetSrc = RESOURCES[mode];
                if (!targetSrc && mode === 'video') targetSrc = RESOURCES['youtube'];
            }
        }

        console.log(`[Media] Target Source: ${targetSrc}`);

        if (mode === 'doc') {
            docWrapper.classList.remove('hidden');

            // [FIXED v11.3.12] Robust Google Doc Native Reflow & Optimization
            let finalSrc = targetSrc;
            if (targetSrc.includes('docs.google.com/document/d/')) {
                const isPublished = targetSrc.includes('/pub');
                const isStandard = !isPublished;

                if (isStandard) {
                    console.log("[Media] Standard Doc detected, forcing /mobilebasic for native reflow...");
                    // Transform /edit, /view, etc. to /mobilebasic
                    finalSrc = finalSrc.replace(/\/document\/d\/([^/]+)\/.*$/, '/document/d/$1/mobilebasic');
                    if (!finalSrc.includes('/mobilebasic')) {
                        finalSrc = finalSrc.replace(/\/document\/d\/([^/]+)$/, '/document/d/$1/mobilebasic');
                    }
                } else {
                    console.log("[Media] Published Doc detected, keeping /pub with UI optimization...");
                    // Just append rm=mobile for a cleaner (but not reflowed) view
                    if (!finalSrc.includes('rm=mobile')) {
                        finalSrc += (finalSrc.includes('?') ? '&' : '?') + "rm=mobile";
                    }
                }
            }

            if (finalSrc) docFrame.src = finalSrc;
            setTimeout(autoFitZoom, 100);
        } else if (mode === 'video') {
            videoWrapper.classList.remove('hidden');
            if (targetSrc) videoFrame.src = targetSrc;
        }

        // Hide Navbar and Tabs to prevent z-index issues (especially in iframes)
        const docs = [document];
        try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { }

        docs.forEach(doc => {
            const nav = doc.getElementById('main-nav');
            if (nav) nav.style.setProperty('display', 'none', 'important');

            // Aggressive FAB Hiding via CSS Injection [NEW]
            let styleHide = doc.getElementById('vibe-media-hide-fab');
            if (!styleHide) {
                styleHide = doc.createElement('style');
                styleHide.id = 'vibe-media-hide-fab';
                styleHide.textContent = '#dashboard-fab, .dashboard-fab { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
                doc.head.appendChild(styleHide);
            }

            // Also hide the tab bar if it exists (Master Page pattern)
            const tabs = doc.getElementById('course-tabs-container');
            if (tabs) {
                const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
                if (tabWrapper) tabWrapper.style.display = 'none';
            }
        });

        // [FIX] Always re-bind events when entering media mode
        bindOverlayEvents();

        requestFullscreenSafe();
        sessionStartTime = new Date();

        // [FIX] Give focus to the close button so Esc works immediately
        const closeBtn = document.querySelector('.close-video-btn');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 100);
        }
    } catch (err) {
        console.error("[Media] Error in enterMediaMode:", err);
    }
}

// Flag to prevent recursive closing
var isClosingModal = typeof isClosingModal !== 'undefined' ? isClosingModal : false;

/**
 * Closes the Media Overlay
 */
function closeModal() {
    if (isClosingModal) return;
    const overlay = document.getElementById('media-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    isClosingModal = true;
    console.log("[Media] Closing modal...");
    overlay.classList.add('hidden');
    document.body.style.overflow = '';

    // Restore Navbar and Tabs
    const docs = [document];
    try { if (window.parent && window.parent.document) docs.push(window.parent.document); } catch (e) { }

    docs.forEach(doc => {
        const nav = doc.getElementById('main-nav');
        if (nav) nav.style.display = '';

        // Restore FAB Visibility [NEW]
        const styleHide = doc.getElementById('vibe-media-hide-fab');
        if (styleHide) styleHide.remove();

        const tabs = doc.getElementById('course-tabs-container');
        if (tabs) {
            const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement.parentElement;
            if (tabWrapper) tabWrapper.style.display = '';
        }
    });

    // Stop Playback
    document.getElementById('video-frame').src = "";
    document.getElementById('doc-frame').src = "";

    if (sessionStartTime) {
        const endTime = new Date();
        const duration = (endTime - sessionStartTime) / 1000;
        console.log(`[Tracking] Session duration: ${duration}s`);

        // Dispatch event for Firebase
        const modeUpper = currentMode ? currentMode.toUpperCase() : 'UNKNOWN';
        const frameSrc = document.getElementById(currentMode + '-frame') ? document.getElementById(currentMode + '-frame').src : "";

        window.dispatchEvent(new CustomEvent('vibe-log-activity', {
            detail: {
                action: modeUpper,
                duration: Math.round(duration),
                metadata: { src: frameSrc }
            }
        }));

        sessionStartTime = null;
    }

    currentMode = null;
    exitFullscreenSafe();

    // Explicitly unbind from top window on close as a safety measure
    cleanupOverlayEvents();

    // Reset flag after transitions
    setTimeout(() => { isClosingModal = false; }, 300);
}

// --- Zoom Logic ---

// --- Event Listeners ---

var handleEscKey = function(e) {
    if (e.key === "Escape") {
        const overlay = document.getElementById('media-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            console.log("[Media] Esc pressed, closing modal");
            closeModal();
        }
    }
};

/**
 * [FIXED] Robust event binding to handle iframe transitions and cross-origin safety
 */
function bindOverlayEvents() {
    // 1. Local Window & Document
    window.removeEventListener('keydown', handleEscKey, true);
    window.addEventListener('keydown', handleEscKey, true);
    document.removeEventListener('keydown', handleEscKey, true);
    document.addEventListener('keydown', handleEscKey, true);

    // 2. Top Window (Persists across tab switches in Master Page context)
    // We store the handler reference on win itself to properly remove it later
    const bindTo = (win) => {
        try {
            if (!win) return;
            // Remove previous version regardless of which unit page added it
            if (win._vibeEscHandler) {
                win.removeEventListener('keydown', win._vibeEscHandler, true);
            }
            // Bind new one
            win._vibeEscHandler = handleEscKey;
            win.addEventListener('keydown', win._vibeEscHandler, true);
        } catch (e) { /* Cross-origin blocked */ }
    };

    if (window.top && window.top !== window) {
        bindTo(window.top);
    }

    // 3. Fullscreen Events
    const docs = [document];
    try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) { }

    docs.forEach(doc => {
        try {
            doc.removeEventListener('fullscreenchange', onFullscreenChange);
            doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
            doc.addEventListener('fullscreenchange', onFullscreenChange);
            doc.addEventListener('webkitfullscreenchange', onFullscreenChange);
        } catch (e) { }
    });
}

function cleanupOverlayEvents() {
    window.removeEventListener('keydown', handleEscKey, true);
    document.removeEventListener('keydown', handleEscKey, true);

    if (window.top && window.top._vibeEscHandler) {
        try {
            window.top.removeEventListener('keydown', window.top._vibeEscHandler, true);
            window.top._vibeEscHandler = null;
        } catch (e) { }
    }

    const docs = [document];
    try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) { }

    docs.forEach(doc => {
        try {
            doc.removeEventListener('fullscreenchange', onFullscreenChange);
            doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        } catch (e) { }
    });
}

// Ensure cleanup on tab switch/close
window.addEventListener('pagehide', cleanupOverlayEvents);
window.addEventListener('unload', cleanupOverlayEvents);

bindOverlayEvents();

function onFullscreenChange() {
    // Multi-phase check to handle browser state lag
    const check = () => {
        const getFsElement = () => {
            try {
                return document.fullscreenElement || document.webkitFullscreenElement ||
                    (window.top && window.top.document && (window.top.document.fullscreenElement || window.top.document.webkitFullscreenElement));
            } catch (e) { return document.fullscreenElement || document.webkitFullscreenElement; }
        };

        const isFs = !!getFsElement();
        if (!isFs && !isClosingModal) {
            const overlay = document.getElementById('media-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                console.log("[Media] Verified exit, closing modal");
                closeModal();
            }
        }
    };

    // Trigger checks at multiple intervals
    check();
    setTimeout(check, 100);
    setTimeout(check, 300);
}

// Update autoFitZoom to be more aggressive with width
function autoFitZoom() {
    if (currentMode !== 'doc') return;
    const wrapper = document.getElementById('doc-wrapper');
    const iframe = document.getElementById('doc-frame');
    if (!wrapper || !iframe) return;

    const availableWidth = wrapper.clientWidth;
    const isMobile = window.innerWidth < 768;

    // [FIXED v11.3.12] Only disable manual scaling IF using /mobilebasic
    // Standard docs with /mobilebasic support native reflow, making manual scaling counter-productive.
    // Published docs (/pub) do NOT reflow and MUST still use manual scaling.
    // Native Reflow Doc Logic
    if (iframe.src.includes('docs.google.com') && iframe.src.includes('mobilebasic')) {
        if (isMobile) {
            console.log("[Media] Native Reflow Doc detected (Mobile), disabling manual scaling.");
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.transform = 'none';
            iframe.style.marginBottom = '0';
            return;
        } else {
            console.log("[Media] Native Reflow Doc detected (Desktop), applying expansion zoom...");
            // Force it to proceed to the scaling logic below with a customized base width
        }
    }

    // Standard Scaling Logic (for Desktop or non-Google-Doc mobile)
    // Use full width for both desktop and mobile
    iframe.style.width = '100%';
    iframe.style.maxWidth = 'none';

    // Standard Google Doc content width is ~820px
    const baseWidth = 820;
    let scale = availableWidth / baseWidth;

    if (isMobile) {
        // [FIXED v11.3.11] More aggressive scaling for small screens
        // Target a standard mobile viewport width (e.g. 430px) to ensure no gaps
        const mobileBase = 430;
        scale = availableWidth / mobileBase;

        // Safety cap for mobile zoom
        if (scale < 0.8) scale = 0.8;
    } else {
        // Desktop: Allow full expansion ("Page Width")
        // For mobilebasic on desktop, use a smaller base width to force larger zoom
        const activeBaseWidth = (iframe.src.includes('mobilebasic')) ? 680 : 820;
        scale = availableWidth / activeBaseWidth;

        if (scale < 0.5) scale = 0.5;
        // No upper limit to ensure it fills the screen width
    }

    applyZoom(scale);
}

function applyZoom(scale) {
    currentScale = scale;
    const iframe = document.getElementById('doc-frame');
    if (!iframe) return;

    iframe.style.transform = `scale(${scale})`;

    // Width compensation
    // We set the real width to 100/scale, so when scaled by 'scale', it looks like 100% width
    iframe.style.width = `${100 / scale}%`;
    iframe.style.height = `${100 / scale}%`;

    // Vertical spacing compensation (origin-top creates whitespace at bottom)
    iframe.style.marginBottom = `${-(1 - scale) * 100 / scale}%`;

    // Horizontal centering is handled by flex 'justify-center' on the wrapper
    // and 'origin-top' (which defaults to center horizontal) on the iframe.
    iframe.style.marginLeft = '0';
    iframe.style.marginRight = '0';
}


// --- Helper Functions ---

function requestFullscreenSafe() {
    let target = document.documentElement;
    try {
        if (window.top && window.top.document) {
            target = window.top.document.documentElement;
        }
    } catch (e) { }

    if (target.requestFullscreen) {
        target.requestFullscreen().catch(err => console.log(err));
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
    }
}

function exitFullscreenSafe() {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement ||
        (window.top && window.top.document && (window.top.document.fullscreenElement || window.top.document.webkitFullscreenElement));

    if (fsElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => { });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }

        // Also try top window if possible
        try {
            if (window.top && window.top.document && window.top.document.exitFullscreen) {
                window.top.document.exitFullscreen().catch(() => { });
            }
        } catch (e) { }
    }
}

window.addEventListener('resize', () => {
    if (currentMode === 'doc' && !document.getElementById('media-overlay').classList.contains('hidden')) {
        autoFitZoom();
    }
});

// --- Animation Logic ---

function initAnimations() {
    if (window._animationsInitialized) return;

    console.log("[Animations] Starting initialization...");

    const observerOptions = { threshold: 0.1 };

    // Safely create observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right');

    animatedElements.forEach((el) => {
        if (!el.classList.contains('visible')) {
            observer.observe(el);
        }
    });

    window._animationsInitialized = true;
    console.log(`[Animations] Observing ${animatedElements.length} elements`);

    // FAILSAFE: Force visibility after 1.5 seconds if simpler browsers or errors occur
    setTimeout(() => {
        animatedElements.forEach(el => {
            if (!el.classList.contains('visible')) {
                console.warn("[Animations] Failsafe triggering for", el);
                el.classList.add('visible');
            }
        });
    }, 1500);
}

// --- Firebase Features (Tracking & Assignments) ---

function initFirebaseFeatures() {
    console.log("[Firebase] Injecting Firebase SDK...");

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
        import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
        import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
            authDomain: "e-learning-942f7.firebaseapp.com",
            projectId: "e-learning-942f7",
            storageBucket: "e-learning-942f7.firebasestorage.app",
            messagingSenderId: "878397058574",
            appId: "1:878397058574:web:28aaa07a291ee3baab165f"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const functions = getFunctions(app, 'asia-east1');
        
        // [MOD] Expose globally for other parts of course-shared.js
        window.vibeApp = app;
        window.getFunctions = getFunctions;
        window.httpsCallable = httpsCallable;

        const logActivityFn = httpsCallable(functions, 'logActivity');
        const submitAssignmentFn = httpsCallable(functions, 'submitAssignment');

        // --- Tracking Logic ---
        
        // Helper to log
        const log = async (action, duration = 0, metadata = {}) => {
            // [MODIFIED] User verification
            const user = auth.currentUser;
            if (!user) {
                // console.log("[Tracking] Skipped: No user logged in.");
                return;
            }

            // Get Page ID from URL
            const pathParts = window.location.pathname.split('/');
            const courseId = pathParts[pathParts.length - 1] || 'unknown-page';

            try {
                await logActivityFn({
                    courseId: courseId,
                    action: action,
                    duration: duration,
                    metadata: metadata
                });
            } catch (e) {
                console.error("[Tracking] Upload failed:", e);
            }
        };

        // 1. Listen for Custom Events (VIDEO, DOC)
        window.addEventListener('vibe-log-activity', (e) => {
            const { action, duration, metadata } = e.detail;
            log(action, duration, metadata);
        });

        // --- Assignment Logic ---

        window.firebaseSubmitAssignment = async (data) => {
             const user = auth.currentUser;
             if (!user) {
                 alert("請先登入 (Please Login First)");
                 return { success: false, error: "Not Logged In" };
             }
             
             try {
                 const result = await httpsCallable(functions, 'submitAssignment')(data);
                 return result.data;
             } catch (error) {
                 console.error("Submission Error:", error);
                 alert("提交失敗: " + error.message);
                 throw error;
             }
        };

        // [NEW] Helper to get dynamic tutor configs
        window.firebaseGetTutorConfigs = async (courseId) => {
            try {
                const getTutorConfigs = httpsCallable(functions, 'getTutorConfigs');
                const result = await getTutorConfigs({ courseId });
                return result.data;
            } catch (e) {
                console.error("Failed to fetch tutor configs:", e);
                return null;
            }
        };
        // Backward-compatible browser alias for older page code.
        window.firebaseGetCourseConfigs = window.firebaseGetTutorConfigs;

        window.firebaseResolveAssignmentAccess = async (payload) => {
            try {
                // [V13.0.21] Automatically inject tutorMode from browser session
                const isTutorMode = localStorage.getItem('adminTutorMode') === 'true';
                const resolveAssignmentAccess = httpsCallable(functions, 'resolveAssignmentAccess');
                const result = await resolveAssignmentAccess({
                    ...payload,
                    tutorMode: isTutorMode
                });
                return result.data;
            } catch (e) {
                console.error("Failed to resolve assignment access:", e);
                throw e;
            }
        };

        console.log("[Firebase] Initialized.");
    `;

    document.body.appendChild(script);
    injectSubmissionModal();
    injectAssignmentLinkModal();
}

/**
 * Injects the Submission Modal HTML
 */
function injectSubmissionModal() {
    const modalHTML = `
    <div id="submission-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[60]">
        <div class="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl transform transition-all scale-100">
            <h3 class="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">📝 繳交作業 (Submit Assignment)</h3>
            
            <input type="hidden" id="sub-assignment-id">
            <input type="hidden" id="sub-assignment-title">
            
            <div id="github-classroom-section" class="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hidden">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-xl">🐙</span>
                    <h4 class="font-bold text-gray-800">GitHub Classroom</h4>
                </div>
                <p class="text-xs text-gray-600 mb-4">本單元已整合 GitHub Classroom。請先領取作業範本，完成後將您的 Repo 連結貼到下方。</p>
                <a id="sub-github-link" href="#" target="_blank"
                    class="block w-full text-center py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition shadow-md flex items-center justify-center gap-2">
                    <span>🚀</span> 領取 GitHub Classroom 作業
                </a>
                <p class="text-[10px] text-gray-400 mt-2 italic text-center">※ 點擊後將連往 GitHub 頁面並自動建立您的私有 Repo</p>
            </div>

            <div class="mb-5">
                <label class="block text-sm font-bold text-gray-700 mb-2">作業名稱</label>
                <div id="sub-display-title" class="text-gray-900 font-medium bg-gray-100 p-3 rounded"></div>
            </div>

            <div class="mb-5">
                <label class="block text-sm font-bold text-gray-700 mb-2">作業連結 (GitHub / Demo URL) <span class="text-red-500">*</span></label>
                <input type="url" id="sub-url" placeholder="https://github.com/username/project"
                    class="w-full border-2 border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
            </div>

            <div class="mb-6">
                <label class="block text-sm font-bold text-gray-700 mb-2">備註 / 留言 (Optional)</label>
                <textarea id="sub-note" placeholder="遇到的困難、心得..."
                    class="w-full border-2 border-gray-300 p-3 rounded-lg h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"></textarea>
            </div>

            <div class="flex justify-end gap-3">
                <button onclick="closeSubmissionModal()"
                    class="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold transition">取消</button>
                <button id="btn-confirm-submit" onclick="submitAssignmentAction()"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-lg flex items-center gap-2">
                    <span>🚀</span> 送出作業
                </button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Injects the Assignment Link Modal (for self-binding)
 */
function injectAssignmentLinkModal() {
    if (document.getElementById('assignment-link-modal')) return;
    const modalHTML = `
    <div id="assignment-link-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[70]">
        <div class="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all scale-100 border border-blue-100">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    🔗
                </div>
                <h3 class="text-2xl font-bold text-gray-800">連結您的授課老師</h3>
                <p class="text-sm text-gray-500 mt-2">此單元需要指派老師才能開始作業。<br>請輸入老師提供的 <b>GitHub Classroom 作業連結</b>。</p>
            </div>
            
            <input type="hidden" id="link-course-id">
            <input type="hidden" id="link-unit-id">
            <input type="hidden" id="link-assignment-id">
            <input type="hidden" id="link-assignment-title">

            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">老師提供的作業連結</label>
                <input type="url" id="link-referral-url" placeholder="https://classroom.github.com/a/..."
                    class="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition font-mono text-sm">
                <p class="text-[10px] text-gray-400 mt-2">※ 系統將自動辨識連結並綁定您的導師關係。</p>
            </div>

            <div class="flex flex-col gap-3">
                <button id="btn-bind-tutor" onclick="submitBindTutorAction()"
                    class="w-full py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold shadow-lg flex items-center justify-center gap-2">
                    <span>✅</span> 驗證並綁定老師
                </button>
                <button onclick="closeAssignmentLinkModal()"
                    class="w-full py-3 text-gray-400 hover:text-gray-600 transition font-medium text-sm">稍後再說</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeAssignmentLinkModal = function () {
    document.getElementById('assignment-link-modal').classList.add('hidden');
};

window.submitBindTutorAction = async function () {
    const btn = document.getElementById('btn-bind-tutor');
    const urlInput = document.getElementById('link-referral-url');
    const referralLink = urlInput.value.trim();
    const courseId = document.getElementById('link-course-id').value;
    const unitId = document.getElementById('link-unit-id').value;
    const assignmentId = document.getElementById('link-assignment-id').value;
    const title = document.getElementById('link-assignment-title').value;

    if (!referralLink) {
        alert("請輸入連結！");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '正在驗證連結...';

    try {
        const bindTutorToUnit = httpsCallable(getFunctions(undefined, 'asia-east1'), 'bindTutorToUnit');
        const result = await bindTutorToUnit({ unitId, courseId, referralLink });

        if (result.data && result.data.success) {
            alert(`✅ 成功綁定導師：${result.data.tutorEmail}\n現在您可以開始作業了！`);
            closeAssignmentLinkModal();
            // Re-open the submission modal to refresh access state
            openSubmissionModal(assignmentId, title);
        } else {
            alert("❌ 綁定失敗：" + (result.data.message || "未知錯誤"));
        }
    } catch (e) {
        console.error("Binding error:", e);
        alert("❌ 錯誤：" + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>✅</span> 驗證並綁定老師';
    }
};

// Global functions for Modal
window.openSubmissionModal = async function (assignmentId, title) {
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const courseId = await findCourseIdByUnit(fileName);
    let classroomUrl = null;
    let assignmentAccess = null;
    let shouldUseDirectClassroomLink = false;

    try {
        if (typeof window.firebaseResolveAssignmentAccess === 'function') {
            assignmentAccess = await window.firebaseResolveAssignmentAccess({ courseId, unitId: fileName, assignmentId });
            classroomUrl = assignmentAccess?.classroomUrl || null;

            if (assignmentAccess?.requiresTutorAssignment && !assignmentAccess?.assignedTutorEmail) {
                // [V16.1] Instead of alert, show the self-binding modal
                document.getElementById('link-course-id').value = courseId;
                document.getElementById('link-unit-id').value = fileName;
                document.getElementById('link-assignment-id').value = assignmentId;
                document.getElementById('link-assignment-title').value = title;
                document.getElementById('link-referral-url').value = '';
                document.getElementById('assignment-link-modal').classList.remove('hidden');
                return;
            }

            shouldUseDirectClassroomLink = ['paid_student', 'free_course', 'trial_course'].includes(assignmentAccess?.accessMode) && !!classroomUrl;
        }
    } catch (e) {
        alert("暫時無法確認您的作業入口，請稍後再試。");
        return;
    }

    // --- 1. Resolve Classroom URL (Priority Order) ---
    const shouldResolveFallbackLink = !classroomUrl && !assignmentAccess?.accessMode;
    if (shouldResolveFallbackLink) {

        // A. Try Dynamic Configs (Firestore) [NEW]
        try {
            if (typeof window.firebaseGetTutorConfigs === 'function') {
                if (!globalCourseConfigs) {
                    globalCourseConfigs = await window.firebaseGetTutorConfigs();
                }

                if (globalCourseConfigs) {
                    for (const [cid, cfg] of Object.entries(globalCourseConfigs)) {
                        if (cfg && cfg.githubClassroomUrls && cfg.githubClassroomUrls[fileName]) {
                            classroomUrl = resolveClassroomUrl(cfg.githubClassroomUrls[fileName]);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[CourseShared] Dynamic config lookup failed:", e);
        }

        // B. Try local RESOURCES (unit-level manual override)
        if (!classroomUrl && typeof window.RESOURCES !== 'undefined' && window.RESOURCES.githubClassroomUrl) {
            classroomUrl = resolveClassroomUrl(window.RESOURCES.githubClassroomUrl);
        }

        // C. Fallback to centralized lessons metadata (Firestore cached)
        if (!classroomUrl) {
            try {
                if (!globalLessonsData) {
                    // If not cached, try fetching now (strictly Firestore)
                    globalLessonsData = await vibeFetchLessons();
                }
                // Search all courses for this filename key
                if (globalLessonsData) {
                    for (const course of globalLessonsData) {
                        if (course.githubClassroomUrls && course.githubClassroomUrls[fileName]) {
                            classroomUrl = resolveClassroomUrl(course.githubClassroomUrls[fileName]);
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error("[CourseShared] Firestore link fetch failed:", e);
            }
        }
    }

    // --- 2. Direct Navigation Logic ---
    // If we have a link and Shift is NOT held, navigate directly (User Request)
    const isShiftPressed = window.event && window.event.shiftKey;
    if (shouldUseDirectClassroomLink && classroomUrl && !isShiftPressed) {
        console.log(`[CourseShared] Direct navigation to: ${classroomUrl}`);
        
        // [NEW] Automated Assignment Tracking
        if (typeof window.firebaseSubmitAssignment === 'function') {
            window.firebaseSubmitAssignment({
                courseId: courseId,
                unitId: fileName,
                assignmentId: assignmentId,
                title: title,
                url: classroomUrl,
                status: 'started',
                assignmentType: 'classroom'
            }).catch(e => console.error("[CourseShared] Auto-tracking failed:", e));
        }

        window.open(classroomUrl, '_blank');
        return;
    }

    // --- 3. Modal UI Updates (if still here) ---
    document.getElementById('sub-assignment-id').value = assignmentId;
    document.getElementById('sub-assignment-title').value = title;
    document.getElementById('sub-display-title').textContent = title;
    document.getElementById('sub-url').value = '';
    document.getElementById('sub-note').value = '';

    const githubSection = document.getElementById('github-classroom-section');
    const githubLink = document.getElementById('sub-github-link');

    if (shouldUseDirectClassroomLink && classroomUrl) {
        githubSection.classList.remove('hidden');
        githubLink.href = classroomUrl;
    } else {
        githubSection.classList.add('hidden');
    }

    document.getElementById('submission-modal').classList.remove('hidden');
};

/**
 * Helper to pick the right URL based on tutor map
 */
function resolveClassroomUrl(urlConfig) {
    if (typeof urlConfig === 'string') return urlConfig;
    if (typeof urlConfig === 'object') {
        // Fallback to default or first key
        return urlConfig.default || Object.values(urlConfig)[0];
    }
    return null;
}

window.closeSubmissionModal = function () {
    document.getElementById('submission-modal').classList.add('hidden');
};

window.submitAssignmentAction = async function () {
    const btn = document.getElementById('btn-confirm-submit');
    const originalText = btn.innerHTML;

    const assignmentId = document.getElementById('sub-assignment-id').value;
    const title = document.getElementById('sub-assignment-title').value;
    const url = document.getElementById('sub-url').value;
    const note = document.getElementById('sub-note').value;

    if (!url) {
        alert("請輸入作業連結！");
        return;
    }

    // Get Course ID / Unit ID from URL
    const pathParts = window.location.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1]; // 02-unit-ui-ux-standards.html
    const courseId = await findCourseIdByUnit(fileName);
    const unitId = fileName;

    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> 提交中...`;

    try {
        if (typeof window.firebaseSubmitAssignment !== 'function') {
            throw new Error("Firebase SDK not initialized yet.");
        }

        const result = await window.firebaseSubmitAssignment({
            courseId: courseId,
            unitId: unitId,
            assignmentId: assignmentId,
            title: title,
            url: url,
            note: note
        });

        if (result.success) {
            alert("作業繳交成功！老師將會收到通知。");
            closeSubmissionModal();
        } else {
            alert("繳交失敗: " + (result.message || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        // Error alert handled in firebaseSubmitAssignment or here
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

/**
 * Robustly find parent courseId for a given unit fileName
 */
/**
 * [V8.2] Initialize GitHub README rendering within the unit page.
 * Finds #assignment-guide and injects README above it.
 */
async function initGithubReadme() {
    const target = document.getElementById('assignment-guide');
    if (!target) return;

    // [V14.8.6] Reinforcement: Explicitly hide the guide in main unit body as requested
    target.style.display = 'none';

    // 1. Identify Unit ID
    let unitId = "";
    const meta = document.querySelector('meta[name="markdown-url"]');
    if (meta) {
        unitId = meta.getAttribute('data-unit-id') || "";
    }
    if (!unitId) {
        // Fallback: Use filename
        const path = window.location.pathname;
        unitId = path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
    }

    if (!unitId) return;

    // 2. Load marked.js dynamically if not present
    if (typeof window.marked === 'undefined') {
        console.log("[CourseShared] Loading marked.js dynamically...");
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
        document.head.appendChild(script);
        await new Promise((resolve) => {
            script.onload = resolve;
        });
    }

    // 3. Fetch README
    const GITHUB_ORG = 'vibe-coding-classroom';
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/${unitId}/main/README.md`;

    try {
        console.log("[CourseShared] Fetching README from Github Raw...");
        const resp = await fetch(rawUrl);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const text = await resp.text();
        const html = window.marked.parse(text);

        // 4. Inject - [V14.8.4] Only if specifically requested or in non-hide-mode
        // User requested to HIDE README.md and assignment-guide in the main unit body.
        // We will keep the fetch logic but skip the injection here.
        /*
        const mdContainer = document.createElement('div');
        mdContainer.className = 'markdown-embed p-6 mt-12 mb-12 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden';
        mdContainer.innerHTML = html;
        target.parentNode.insertBefore(mdContainer, target);
        */
        
        console.log("[CourseShared] README loaded but hidden in main body as requested.");
    } catch (e) {
        console.warn("[CourseShared] Failed to load GitHub README:", e);
    }
}

async function findCourseIdByUnit(fileName) {
    console.log(`[CourseShared] Resolving CourseId for: ${fileName}`);
    try {
        if (!globalLessonsData || globalLessonsData.length === 0) {
            console.log("[CourseShared] globalLessonsData empty, fetching...");
            globalLessonsData = await vibeFetchLessons();
        }
        
        if (globalLessonsData && Array.isArray(globalLessonsData)) {
            const course = globalLessonsData.find(c => c.courseUnits && c.courseUnits.includes(fileName));
            if (course) {
                console.log(`[CourseShared] Resolved ${fileName} -> ${course.courseId}`);
                return course.courseId;
            } else {
                console.warn(`[CourseShared] No matching course found for unit ${fileName} in Firestore metadata.`);
            }
        } else {
            console.error("[CourseShared] globalLessonsData is not an array:", globalLessonsData);
        }
    } catch (e) {
        console.error("[CourseShared] Error in findCourseIdByUnit:", e);
    }
    
    // Fallback logic
    const fallbackId = fileName.startsWith('04-') ? 'ai-agents-vibe' : (fileName.split('-')[0] + "-master");
    console.log(`[CourseShared] Fallback resolution for ${fileName} -> ${fallbackId}`);
    return fallbackId;
}
} // end window.__courseSharedLoaded guard
