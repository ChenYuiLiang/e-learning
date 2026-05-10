console.log("Dashboard Script v2026.04.07.V14.10.3_FIX_404 Loaded");
// alert("Dashboard Script v6 Loaded"); // Uncomment if needed for hard debugging

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

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
const vibeFetchLessons = httpsCallable(functions, 'getLessonsMetadata');
const PUBLIC_SITE_URL = 'https://vibe-coding.tw';

/**
 * Standard Email Normalizer
 */
function normalizeEmail(email) {
    if (!email) return "";
    return String(email).trim().toLowerCase();
}

// DOM Elements
const loadingState = document.getElementById('loading-state');
const dashboardContent = document.getElementById('dashboard-content');
const accessDenied = document.getElementById('access-denied');

window.toggleRow = function(uid) {
    console.log("[Dashboard] Toggling row for UID:", uid);
    // Use data attribute instead of class to be safer with special characters
    const detailsRows = document.querySelectorAll(`tr[data-parent-uid="${uid}"]`);
    const icon = document.getElementById(`icon-${uid}`);
    
    if (detailsRows.length === 0) {
        console.warn("[Dashboard] No details rows found for UID:", uid);
        return;
    }

    detailsRows.forEach(row => {
        row.classList.toggle('hidden');
    });
    
    if (icon) {
        const isCollapsed = detailsRows[0].classList.contains('hidden');
        icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

const userDisplay = document.getElementById('user-display');
const userUidDisplay = document.getElementById('user-uid-display');
const stats = {
    students: document.getElementById('stat-students'),
    hours: document.getElementById('stat-hours'),
};

// Removed singular assignmentTableBody in favor of plural class-based updates.

// Admin UI
//const adminPanel = document.getElementById('admin-panel');


let myRole = null;
let myUid = null;
let myEmail = null;
let charts = {};
let dashboardData = null;
let lessonsMap = {};
let unitsTitleMap = {};
let allLessons = [];
let currentGradingAssignment = null;
let currentDashboardPermissions = {
    isAdmin: false,
    isQualifiedTutor: false,
    isPaidStudent: false,
    canViewAssignments: false,
    canViewSettings: false
};

// [NEW] Admin Super Mode state
// [NEW] Admin Tutor Mode state (formerly Super Mode)
let adminTutorMode = localStorage.getItem('adminTutorMode') === 'true'; 


// [REMOVED] MASTER_UNIT_MAPPING is now standardized in lessons.json


// [Global UI Init] Check for Iframe Mode immediately
(function initIframeMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'iframe') {
        // Force hide navbar
        const nav = document.querySelector('nav');
        if (nav) nav.style.display = 'none';

        // Hide standard header elements if any
        document.body.classList.add('bg-white');

        // Add specific style to ensure nav is hidden even if script runs early
        const style = document.createElement('style');
        // Force hide nav, reset container padding/width
        style.textContent = `
            nav { display: none !important; } 
            .container { padding-top: 0 !important; max-width: 100% !important; }
            #dashboard-content { padding: 1rem !important; }
            body { background: white !important; }
        `;
        document.head.appendChild(style);

        // Also adjust dashboardContent if it exists already, usually it does
        if (dashboardContent) {
            dashboardContent.classList.remove('pt-24', 'pb-12', 'space-y-6');
            dashboardContent.classList.add('p-2', 'space-y-4');
        }
    }
})();

// --- Auth State ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUid = user.uid;
        myEmail = user.email;
        if (userDisplay) userDisplay.textContent = `您好, ${user.displayName || '使用者'}`;
        await loadLessons();
        loadDashboard();
    } else {
        // [MODIFIED] No more redirect, show guest view for Incognito/Unauthenticated
        console.log("[Auth] No user detected, showing guest prompt.");
        showAccessDenied("GUEST");
    }
});

async function loadLessons() {
    try {
        // [MOD] Use centralized Firestore-backed fetch from course-shared.js
        if (typeof vibeFetchLessons === 'function') {
            const result = await vibeFetchLessons();
            // [FIX v11.3.143] Properly unpack result.data.lessons for Callable result
            allLessons = (result && result.data && result.data.lessons) ? result.data.lessons : (Array.isArray(result) ? result : []);
        } else {
            console.error("[Dashboard] vibeFetchLessons not found. Firestore data unavailable.");
            allLessons = [];
        }
        
        console.log(`[Dashboard] Loaded ${allLessons.length} lessons from metadata source.`);
        syncLessonsAndUnitsMap(allLessons);
    } catch (e) {
        console.error("Failed to load lessons:", e);
    }
}

function syncLessonsAndUnitsMap(lessons) {
    if (!lessons) return;
    lessons.forEach(l => {
        lessonsMap[l.courseId] = l.title;
        if (l.courseUnits && l.courseUnitTitles) {
            l.courseUnits.forEach((u, i) => {
                const uid = resolveCanonicalUnitId(u);
                unitsTitleMap[uid] = l.courseUnitTitles[i];
            });
        }
    });
}


// Initialize on Load
// loadDashboard(); // This is called in onAuthStateChanged

// --- Main Data Fetching ---
async function loadDashboard() {
    try {
        const { filterUnitId, filterCourseId } = getCurrentDashboardContext();
        const hasUnitContext = !!filterUnitId;
        
        // [V12.1.2] SECURITY RULE: Global dashboard (no orientation) is ADMIN ONLY.
        const getDashboardData = httpsCallable(functions, 'getDashboardData');
        const response = await getDashboardData({ 
            unitId: filterUnitId, 
            courseId: filterCourseId,
            tutorMode: adminTutorMode // [V13.0.8] Pass simulation flag to backend
        });
        const data = response.data;

        // [FIX] Aggregate data (map filename IDs to real Course IDs)
        aggregateData(data);
        dashboardData = data;

        // [FIX] Ensure allLessons is populated. 
        if (!allLessons || allLessons.length === 0) {
            if (data.lessons && data.lessons.length > 0) {
                allLessons = data.lessons;
                syncLessonsAndUnitsMap(allLessons);
            } else if (typeof vibeFetchLessons === 'function') {
                const result = await vibeFetchLessons();
                allLessons = (result && result.data && result.data.lessons) ? result.data.lessons : (Array.isArray(result) ? result : []);
                syncLessonsAndUnitsMap(allLessons);
            }
        }

        myRole = data.role;
        const isAdmin = myRole === 'admin';
        const hasPaidAnything = (data.students?.[0]?.orders?.length > 0 || data.students?.[0]?.accountStatus === 'paid');
        
        // Final Rule enforcement: Allow access if Admin OR has Unit Context OR has any paid orders (Hardware)
        if (!hasUnitContext && !isAdmin && !hasPaidAnything) {
            console.warn("[Security] Non-Admin global access denied.");
            showAccessDenied("ADMIN_ONLY_NO_UNIT");
            return;
        }

        const isQualifiedTutor = hasQualifiedTutorAccessForUnit(filterUnitId, filterCourseId, myEmail);

        const isPaidStudent = hasUnitContext
            ? await hasPaidStudentAccessForUnit(filterCourseId, filterUnitId)
            : hasPaidAnything;
            
        updateCurrentDashboardPermissions({ isAdmin, isQualifiedTutor, isPaidStudent });
        const requestedTab = getRequestedTabFromUrl();

        if (isAdmin || isQualifiedTutor) {
            // Admin/Tutor View (Management)
            setupAdminFeatures();
            setupGradingFunctions();
            setupSettingsFeature();
            renderAdminDashboard(data, filterUnitId);

            // [MODIFIED] Automatically refresh the UI and handle tab switching for filtered units
            const activeTab = document.querySelector('.tab-btn.text-blue-600');
            if (activeTab) {
                const tabId = activeTab.id.replace('tab-btn-', '');

                if (requestedTab) {
                    switchTab(requestedTab);
                } else if (filterUnitId && tabId === 'overview') {
                    switchTab(getPreferredDashboardTab(filterUnitId));
                } else {
                    if (tabId === 'admin') renderAdminConsole();
                    if (tabId === 'settings') renderSettingsTab(filterUnitId);
                    if (tabId === 'assignments' && canCurrentUserViewAssignmentsTab()) {
                        // Handled by renderAdminDashboard or switchTab
                    }
                }
            }
        } else if (isPaidStudent) {
            // Paid student unit view
            renderStudentDashboard(data, filterUnitId);
            if (requestedTab) switchTab(requestedTab);
        } else {
            showAccessDenied();
        }

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        showAccessDenied(error.message);
    }
}

function showAccessDenied(errorType = "") {
    loadingState.classList.add('hidden');
    accessDenied.classList.remove('hidden');

    const guestView = document.getElementById('guest-view');
    const adminSetupNote = document.getElementById('admin-setup-note');
    const deniedTitle = document.getElementById('denied-title');
    const deniedMsg = document.getElementById('denied-msg');

    if (errorType === "GUEST") {
        // Show Login Prompt
        if (deniedTitle) deniedTitle.innerText = "👋 您好！閣下尚未登入";
        if (deniedMsg) deniedMsg.innerText = "本頁面為個人學習儀表板，請登入以查看您的數據。";
        if (guestView) guestView.classList.remove('hidden');
        if (adminSetupNote) adminSetupNote.classList.add('hidden');
    } else if (errorType === "ADMIN_ONLY_NO_UNIT") {
        if (deniedTitle) deniedTitle.innerText = "⛔ 僅限管理員";
        if (deniedMsg) deniedMsg.innerText = "未指定課程單元時，只有管理員可以存取 Dashboard。";
        if (guestView) guestView.classList.add('hidden');
        if (adminSetupNote) adminSetupNote.classList.add('hidden');
    } else {
        // Show Access Denied (Logged in but no permission)
        if (deniedTitle) deniedTitle.innerText = "⛔ 權限不足";
        if (deniedMsg) deniedMsg.innerText = "只有管理員、該單元合格導師，或該單元已付款學生可以存取此頁面。";
        if (guestView) guestView.classList.add('hidden');
        if (adminSetupNote) adminSetupNote.classList.remove('hidden');

        const user = auth.currentUser;
        if (user && userUidDisplay) {
            userUidDisplay.innerText = user.uid;
        }

        if (errorType && errorType !== "GUEST") {
            // [DEBUG] Show error to user to help pinpoint if it's a code crash
            const errorDisplay = document.createElement('div');
            errorDisplay.className = 'mt-4 p-2 bg-red-50 text-red-600 text-xs font-mono rounded border border-red-100';
            errorDisplay.innerText = `Error Details: ${errorType}`;
            accessDenied.appendChild(errorDisplay);
        }
    }
}

function updateCurrentDashboardPermissions({ isAdmin = false, isQualifiedTutor = false, isPaidStudent = false } = {}) {
    const { filterUnitId } = getCurrentDashboardContext();
    const isGlobalAdmin = !filterUnitId && isAdmin;
    const canViewAssignments = isGlobalAdmin ||
        (!!filterUnitId && (isQualifiedTutor ? !adminTutorMode : isPaidStudent));
    const canViewSettings = !!filterUnitId && isQualifiedTutor && adminTutorMode;
    
    currentDashboardPermissions = {
        isAdmin,
        isQualifiedTutor,
        isPaidStudent,
        canViewAssignments,
        canViewSettings
    };
}

function canCurrentUserViewAssignmentsTab() {
    return !!currentDashboardPermissions.canViewAssignments;
}

function canCurrentUserViewSettingsTab() {
    return !!currentDashboardPermissions.canViewSettings;
}

function getPreferredDashboardTab(filterUnitId = null) {
    // [V12.1.1] Rule: If no unit context, always prefer Overview for global perspective
    if (!filterUnitId) return 'overview';

    if (canCurrentUserViewSettingsTab()) return 'settings';
    if (canCurrentUserViewAssignmentsTab()) return 'assignments';
    if (myRole === 'admin') return 'admin';
    return 'overview';
}

// Helper: Resolve URL param (e.g. "basic-01") to Course UUID
function resolveCourseIdFromUrlParam(paramId) {
    if (!paramId) return null;
    if (!allLessons || allLessons.length === 0) return paramId;

    // 1. Direct match (UUID)
    const direct = allLessons.find(l => l.courseId === paramId);
    if (direct) return paramId;

    // 2. Fuzzy match (Classroom URL contains param)
    const fuzzy = allLessons.find(l => l.classroomUrl && l.classroomUrl.includes(paramId));
    if (fuzzy) {
        console.log(`Resolved URL value '${paramId}' to Course ID '${fuzzy.courseId}'`);
        return fuzzy.courseId;
    }

    return paramId;
}

window.unitIdsMatch = window.unitIdsMatch || function(id1, id2) {
    if (!id1 || !id2) return false;
    // Universal prefix stripper: removes "01-unit-", "start-", "basic-03-unit-", etc.
    const clean = (id) => String(id).trim().toLowerCase().replace('.html', '').replace(/^.*?-(unit|start|lesson)-/i, '');
    return clean(id1) === clean(id2);
};

window.getEquivalentUnitIds = window.getEquivalentUnitIds || function(unitId) {
    if (!unitId) return [];
    const normalized = unitId.toLowerCase().trim();
    const base = normalized.replace('.html', '').replace(/^.*?-(unit|start|lesson)-/i, '');
    
    // Return a list of variants to help with lookup/matching
    return [
        normalized,
        base,
        `${base}.html`,
        `01-unit-${base}.html`,
        `start-${base}`,
        `start-${base}.html`
    ];
};

window.resolveCanonicalUnitId = window.resolveCanonicalUnitId || function(unitId) {
    const candidates = getEquivalentUnitIds(unitId);
    if (candidates.length === 0) return '';

    for (const candidate of candidates) {
        if (dashboardData?.unitToDocId?.[candidate]) return candidate;
        if ((allLessons || []).some(l => Array.isArray(l.courseUnits) && l.courseUnits.includes(candidate))) return candidate;
    }

    return candidates.find(id => id.endsWith('.html')) || candidates[0];
}

function findParentCourseIdByUnit(unitId) {
    const candidates = getEquivalentUnitIds(unitId);
    const lesson = (allLessons || []).find(l =>
        Array.isArray(l.courseUnits) && l.courseUnits.some(courseUnit => candidates.includes(courseUnit))
    );
    return lesson?.courseId || null;
}

function getPreferredUnitId(unitId, courseUnits = [], extraKeys = []) {
    const candidates = getEquivalentUnitIds(unitId);
    return courseUnits.find(unit => candidates.includes(unit)) ||
        extraKeys.find(key => candidates.includes(key)) ||
        candidates.find(id => id.endsWith('.html')) ||
        unitId;
}

function isRenderableUnitFile(fileName) {
    return typeof fileName === 'string' && fileName.endsWith('.html') && !fileName.includes('-master-');
}

function normalizeTutorIdentifier(value) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/_DOT_/g, '.').trim();
}

function getCurrentDashboardContext() {
    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
    if (!filterCourseId && filterUnitId) {
        filterCourseId = findParentCourseIdByUnit(filterUnitId);
    }

    return { filterUnitId, filterCourseId };
}

function getRequestedTabFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = (urlParams.get('tab') || '').trim();
    const allowedTabs = new Set(['overview', 'assignments', 'settings', 'earnings', 'admin']);
    return allowedTabs.has(requestedTab) ? requestedTab : '';
}

function getUnitTutorConfig(fileName) {
    const candidateIds = getEquivalentUnitIds(fileName);
    const unitConfigs = dashboardData?.unitTutorConfigs || {};
    for (const candidateId of candidateIds) {
        if (unitConfigs[candidateId]) return unitConfigs[candidateId];
    }
    return {
        courseId: findParentCourseIdByUnit(fileName),
        authorizedTutors: [],
        tutorDetails: {},
        githubClassroomUrls: {}
    };
}

function getCourseGuideConfig(courseId) {
    return dashboardData?.courseGuideIndex?.[courseId] || {};
}

function hasQualifiedTutorAccessForUnit(fileName, courseId, email) {
    if (!email || !fileName || !courseId) return false;

    const candidateIds = getEquivalentUnitIds(fileName);
    const normalizedEmail = normalizeTutorIdentifier(email);

    if (normalizedEmail === normalizeTutorIdentifier(myEmail)) {
        const myTutorConfigs = dashboardData?.myTutorConfigs || {};
        if (candidateIds.some(id => myTutorConfigs[id]?.authorized === true)) {
            return true;
        }
    }

    const unitConfig = getUnitTutorConfig(fileName);
    const authorizedTutors = Array.isArray(unitConfig.authorizedTutors) ? unitConfig.authorizedTutors : [];
    return authorizedTutors.map(normalizeTutorIdentifier).includes(normalizedEmail);
}

async function hasPaidStudentAccessForUnit(courseId, unitId) {
    if (!courseId || !unitId || !auth.currentUser) return false;

    try {
        const checkAuthFunction = httpsCallable(functions, 'checkPaymentAuthorization');
        const response = await checkAuthFunction({
            pageId: courseId,
            fileName: unitId,
            tutorMode: false
        });
        return !!(response?.data?.authorized || response?.data?.result?.authorized);
    } catch (error) {
        console.error('[Dashboard] Failed to verify paid student access:', error);
        return false;
    }
}

function configureStudentTabsForUnitAccess() {
    const overviewTabBtn = document.getElementById('tab-btn-overview');
    const assignmentsTabBtn = document.getElementById('tab-btn-assignments');
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    const earningsTabBtn = document.getElementById('tab-btn-earnings');
    const adminTabBtn = document.getElementById('tab-btn-admin');

    if (overviewTabBtn) overviewTabBtn.classList.add('hidden');
    if (assignmentsTabBtn) assignmentsTabBtn.classList.toggle('hidden', !canCurrentUserViewAssignmentsTab());
    if (settingsTabBtn) settingsTabBtn.classList.add('hidden');
    if (earningsTabBtn) earningsTabBtn.classList.add('hidden');
    if (adminTabBtn) adminTabBtn.classList.add('hidden');
}

function filterAssignmentsForCurrentView(assignments = []) {
    const isOwnAssignment = (assignment) =>
        (assignment.userId || assignment.uid) === myUid ||
        normalizeEmail(assignment.studentEmail || assignment.userEmail) === normalizeEmail(myEmail);

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));

    // 2. Unit Context: STRICT Role simulation for Admins/Tutors
    if (filterUnitId) {
        if (currentDashboardPermissions.isAdmin) {
            if (adminTutorMode) {
                // Admin in TUTOR mode: Only see assigned students, hide own.
                console.log("[Debug] Admin Simulation: TUTOR MODE");
                return assignments.filter(a => {
                    return normalizeEmail(a.assignedTutorEmail) === normalizeEmail(myEmail) && !isOwnAssignment(a);
                });
            } else {
                // Admin in STUDENT mode: Only see own.
                console.log("[Debug] Admin Simulation: STUDENT MODE");
                return assignments.filter(isOwnAssignment);
            }
        }
        
        if (currentDashboardPermissions.isQualifiedTutor) {
             // Regular Tutor: Only see assigned students, hide own.
             return assignments.filter(a => {
                 return normalizeEmail(a.assignedTutorEmail) === normalizeEmail(myEmail) && !isOwnAssignment(a);
             });
        }
    }

    // 3. Global Feed or Fallback:
    if (currentDashboardPermissions.isAdmin) {
        // Super Admin Global Feed: See everything.
        return assignments;
    }

    if (currentDashboardPermissions.isQualifiedTutor) {
        // Global Tutor Feed: See assigned students.
        return assignments.filter(a => {
            return normalizeEmail(a.assignedTutorEmail) === normalizeEmail(myEmail) && !isOwnAssignment(a);
        });
    }

    // 3. Student (Paid or Role): Only see their own.
    if (myRole === 'user' || !myRole || currentDashboardPermissions.isPaidStudent) {
        return assignments.filter(isOwnAssignment);
    }

    return [];
}

// --- Rendering ---
function renderStudentDashboard(data, filterUnitId = null) {
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    configureStudentTabsForUnitAccess();

    // 1. Personal Stats (Find my own data from students array or separate object)
    // For students, getDashboardData returns 'students' array containing ONLY the requesting student
    const myData = data.students[0] || { totalTime: 0, videoTime: 0, docTime: 0, isActive: true };

    // Parse params
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    // Parse courseId from URL and resolve to UUID
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    let displayAssignments = filterAssignmentsForCurrentView(data.assignments);
    let displayCourseProgress = myData.courseProgress || {};

    // Filter if courseId is present
    if (filterCourseId) {
        // [V14.9] DECOUPLED: If we have a unit context, prioritize unitId matching.
        // We no longer strip courseId matches if the unitId is correct.
        if (filterUnitId) {
            displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
        } else {
            displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
        }

        // Filter progress to only this course
        const filteredProgress = {};
        if (displayCourseProgress[filterCourseId]) {
            filteredProgress[filterCourseId] = displayCourseProgress[filterCourseId];
        }
        displayCourseProgress = filteredProgress;

        // [NEW] If filterUnitId is present, calculate time for THAT UNIT specifically
        if (filterUnitId && displayCourseProgress[filterCourseId] && displayCourseProgress[filterCourseId].units && displayCourseProgress[filterCourseId].units[filterUnitId]) {
            myData.totalTime = displayCourseProgress[filterCourseId].units[filterUnitId].total;
        } else if (displayCourseProgress[filterCourseId]) {
            myData.totalTime = displayCourseProgress[filterCourseId].total; // Override for display
        } else {
            myData.totalTime = 0;
        }
    }

    // Update Stats Cards (Reusing existing IDs if possible, or we will hide/show sections in HTML)
    // We will dynamically inject the HTML for Student View to avoid conflict with Admin View structure

    const container = document.getElementById('view-overview');

    let courseTitle = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : "我的學習概況";
    if (filterUnitId) courseTitle += ` - ${formatUnitName(filterUnitId)}`;

    // Check for physical products and fulfillment status
    const physicalItems = (myData.orderRecords || []).flatMap(o => 
        Object.keys(o.items || {}).filter(id => allLessons.find(l => l.id === id)?.isPhysical === true)
    );
    const hasPhysical = physicalItems.length > 0;
    const isShipped = (myData.orderRecords || []).some(o => o.fulfillmentStatus === 'SHIPPED');

    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-bold text-gray-800">${escapeHtml(courseTitle)}</h2>
            ${filterCourseId && mode !== 'iframe' ? '<a href="dashboard.html" class="text-sm text-blue-600 hover:underline">← 查看所有課程</a>' : ''}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="card border-l-4 border-blue-500">
                <p class="text-gray-500 text-sm font-medium">${filterUnitId ? '本單元學習時數' : '學習時數'}</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${((myData.totalTime || 0) / 3600).toFixed(1)} <span class="text-sm font-normal text-gray-400">hours</span></h3>
            </div>
            <div class="card border-l-4 border-purple-500">
                <p class="text-gray-500 text-sm font-medium">作業繳交</p>
                <h3 class="text-3xl font-bold text-gray-800 mt-1">${displayAssignments.length} <span class="text-sm font-normal text-gray-400">submitted</span></h3>
            </div>
             <div class="card border-l-4 border-green-500">
                <p class="text-gray-500 text-sm font-medium">帳號狀態</p>
                <h3 class="text-3xl font-bold text-green-600 mt-1">Active</h3>
            </div>
            ${hasPhysical ? `
            <div class="card border-l-4 border-orange-500">
                <p class="text-gray-500 text-sm font-medium">實體教材出貨</p>
                <h3 class="text-3xl font-bold ${isShipped ? 'text-green-600' : 'text-orange-600'} mt-1">${isShipped ? '已出貨' : '準備中'}</h3>
            </div>
            ` : ''}
        </div>

        <!-- My Assignments -->
        <div class="card">
            <h3 class="text-lg font-bold text-gray-800 mb-4">我的作業 (My Assignments)</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-sm text-gray-500 border-b">
                            <th class="py-3 px-2">作業名稱</th>
                            <th class="py-3 px-2">提交時間</th>
                            <th class="py-3 px-2">狀態</th>
                            <th class="py-3 px-2 text-right">分數</th>
                            <th class="py-3 px-2 text-right">評語</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm text-gray-700 divide-y">
                        ${displayAssignments.length > 0 ? displayAssignments.map(a => `
                            <tr class="hover:bg-gray-50">
                                <td class="py-3 px-2">
                                    <div class="font-bold text-gray-800 mb-0.5">${escapeHtml(a.assignmentTitle || a.title || "未指定任務")}</div>
                                    <div class="text-[10px] text-gray-400 capitalize">${escapeHtml(a.unitId ? a.unitId.replace('.html', '').replace(/-/g, ' ') : 'N/A')}</div>
                                </td>
                                <td class="py-3 px-2 text-gray-500 text-xs">${a.submittedAt ? new Date(a.submittedAt.seconds * 1000).toLocaleString() : '-'}</td>
                                <td class="py-3 px-2">
                                    <span class="px-2 py-1 rounded text-xs font-bold ${a.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                        ${a.grade ? '已評分' : '待批改'}
                                    </span>
                                </td>
                                <td class="py-3 px-2 text-right font-bold text-blue-600">${a.grade !== null && a.grade !== undefined ? a.grade : '-'}</td>
                                <td class="py-3 px-2 text-right text-gray-500 max-w-xs truncate" title="${escapeHtml(a.tutorFeedback)}">
                                    ${a.tutorFeedback ? escapeHtml(a.tutorFeedback) : '-'}
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="5" class="py-4 text-center text-gray-500">此課程尚無繳交作業</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- [V15.11] Student README Placeholder -->
        <div id="github-readme-placeholder-student" class="markdown-embed p-6 mt-8 rounded-3xl border border-slate-200 bg-gray-50 shadow-sm overflow-hidden hidden">
            <div class="flex items-center gap-3 text-slate-400 italic font-medium">
                <span class="animate-pulse">⏳</span> 正在抓取 GitHub 任務說明 (README.md)...
            </div>
        </div>

        <!-- Detailed Activity Chart -->
        <div class="card mt-8">
             <div class="flex flex-col md:flex-row gap-8 items-center">
                <div class="w-full md:w-1/3">
                    <h3 class="text-lg font-bold text-gray-800 mb-2">學習分佈</h3>
                    <canvas id="chart-activity"></canvas>
                </div>
                <div class="w-full md:w-2/3">
                     <h3 class="text-lg font-bold text-gray-800 mb-4">課程進度詳情</h3>
                     <div class="space-y-3">
                        ${Object.entries(displayCourseProgress).length > 0 ? Object.entries(displayCourseProgress).map(([cid, p]) => `
                            <div>
                                <div class="flex justify-between text-sm mb-1">
                                    <span class="font-medium text-gray-700">${escapeHtml(lessonsMap[cid] || cid)}</span>
                                    <span class="text-gray-500">${(p.total / 60).toFixed(0)} mins</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min(100, (p.total / 3600) * 100)}%"></div> 
                                </div>
                            </div>
                        `).join('') : '<p class="text-gray-500">尚無學習紀錄</p>'}
                     </div>
                </div>
            </div>
        </div>
    `;

    // Render Chart (Need to adjust chart data if filtering? 
    // Usually chart data comes from myData.videoTime etc. which are totals. 
    // If we want course specific chart, we need granular data which we might not have easily in 'myData' root properties.
    // 'myData.courseProgress' has breakdown. Let's try to sum up from courseProgress if filtered.

    let chartData = [myData]; // Default

    if (filterCourseId && displayCourseProgress[filterCourseId]) {
        // Construct a temp object mimicking student structure but with only this course's times
        const p = displayCourseProgress[filterCourseId];

        // [NEW] Deep Filter to unit level if present
        if (filterUnitId && p.units && p.units[filterUnitId]) {
            const up = p.units[filterUnitId];
            chartData = [{
                videoTime: up.video,
                docTime: up.doc,
                pageTime: up.page || 0
            }];
        } else {
            chartData = [{
                videoTime: p.video,
                docTime: p.doc,
                pageTime: p.page || 0 // assuming page exists or calc remainder
            }];
        }
    }

    renderChart(chartData);

    // [V15.11] Student README Trigger
    if (filterUnitId) {
        vibeRefreshReadmeContent(filterUnitId);
    }
}

function renderAdminDashboard(data, filterUnitId = null) {
    const requestedTab = getRequestedTabFromUrl();
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // Tab Buttons
    const assignmentsTabBtn = document.getElementById('tab-btn-assignments');
    const adminTabBtn = document.getElementById('tab-btn-admin');
    const settingsTabBtn = document.getElementById('tab-btn-settings');
    const earningsTabBtn = document.getElementById('tab-btn-earnings');

    if (assignmentsTabBtn) {
        const canViewAssignments = canCurrentUserViewAssignmentsTab();
        assignmentsTabBtn.classList.toggle('hidden', !canViewAssignments);
        assignmentsTabBtn.textContent = '作業 (Assignments)';
    }


    // 1. Admin Tab (Always Admin-only, always visible if myRole is admin)
    if (adminTabBtn) {
        if (myRole === 'admin') {
            adminTabBtn.classList.remove('hidden');
        } else {
            // [V14.13] REINFORCED: Explicitly hide for anyone else
            adminTabBtn.classList.add('hidden');
            adminTabBtn.style.display = 'none'; // Double layer protection
        }
    }

    // 2. Settings & Earnings Tabs (Role-based & Authorization-based)
    const urlParams = new URLSearchParams(window.location.search);
    let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
    const currentUserEmail = auth.currentUser?.email || '';
    if (!filterCourseId && filterUnitId) {
        filterCourseId = findParentCourseIdByUnit(filterUnitId);
    }

    // Tutor Mode ON = teacher view for qualified tutors and admins.
    // Tutor Mode OFF = student-like view within the current unit context.
    // Settings & Assignments switch according to rules.md.
    // Settings & Earnings are only accessible within a specific UNIT context
    const showSettingsTab = canCurrentUserViewSettingsTab();

    if (settingsTabBtn) {
        settingsTabBtn.classList.toggle('hidden', !showSettingsTab);
        settingsTabBtn.textContent = '課程設定 (Settings)';
    }
    
    // [MODIFIED] Explicitly REMOVE/HIDE the Earnings standalone tab as requested
    if (earningsTabBtn) {
        earningsTabBtn.classList.add('hidden');
    }

    // Stats (Base on filtered students if unit is selected)
    const allInList = data.students || [];
    let summaryStudents = allInList.length;
    let summaryHours = allInList.reduce((acc, s) => acc + (s.totalTime || 0), 0) / 3600;

    // Show total registered vs paid (Unified with the table list)
    const totalRegistered = allInList.length;
    const totalPaid = allInList.filter(s => (s.orderRecords || []).length > 0).length;
    
    if (stats.students) stats.students.textContent = totalRegistered;
    const statPaidEl = document.getElementById('stat-paid');
    if (statPaidEl) statPaidEl.textContent = totalPaid;
    if (stats.hours) stats.hours.textContent = summaryHours.toFixed(1);


    // [V12.1.5] SECURITY & UX RULE: Overview is only for GLOBAL view (no unitId).
    const overviewTabBtn = document.getElementById('tab-btn-overview');
    const overviewTabContent = document.getElementById('view-overview');
    const shouldShowOverview = !filterUnitId && myRole === 'admin';

    if (overviewTabBtn) overviewTabBtn.classList.toggle('hidden', !shouldShowOverview);
    if (overviewTabContent) overviewTabContent.classList.toggle('hidden', !shouldShowOverview);

    // Default redirect if current view is hidden (e.g. Tutors in Global View)
    if (requestedTab === 'overview' && !shouldShowOverview) {
        console.log("[Dashboard] Redirecting from restricted Overview to Assignments.");
        switchTab('assignments');
        return;
    }

    // [NEW] Unit Context Header
    if (filterUnitId || filterCourseId) {
        const header = document.querySelector('#dashboard-content > div.flex.justify-between.items-center.mb-8');
        if (header) {
            let contextLabel = filterCourseId ? (lessonsMap[filterCourseId] || filterCourseId) : "";
            if (filterUnitId) contextLabel = (contextLabel ? contextLabel + " / " : "") + formatUnitName(filterUnitId);

            const existingLabel = document.getElementById('unit-context-label');
            if (existingLabel) {
                existingLabel.textContent = contextLabel;
            } else {
                const badge = document.createElement('div');
                badge.id = 'unit-context-label';
                badge.className = 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold ml-4';
                badge.textContent = contextLabel;
                header.querySelector('h2').appendChild(badge);
            }
        }
    }

    // Table with Expansion (Sorted by Registration Date: Newest First)
    const sortedStudents = (data.students || []).sort((a, b) => {
        const getTs = (c) => {
            if (!c) return 0;
            if (c._seconds) return c._seconds * 1000; // Firestore Timestamp
            if (typeof c === 'number') return c;      // Raw ms timestamp
            return new Date(c).getTime() || 0;        // ISO string or other
        };
        const timeA = getTs(a.createdAt);
        const timeB = getTs(b.createdAt);
        return timeB - timeA; // Descending: Newest first
    });

    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = sortedStudents.map(s => {
        const courses = s.courseProgress || {};

        // [Fix] Filter stats based on courseId
        let displayTotal = s.totalTime;
        let displayVideo = s.videoTime;
        let displayDoc = s.docTime;

        if (filterCourseId) {
            if (courses[filterCourseId]) {
                const p = courses[filterCourseId];

                // [NEW] Filter deep to unit level if enabled
                if (filterUnitId && p.units && p.units[filterUnitId]) {
                    const up = p.units[filterUnitId];
                    displayTotal = up.total || 0;
                    displayVideo = up.video || 0;
                    displayDoc = up.doc || 0;
                } else {
                    displayTotal = p.total || 0;
                    displayVideo = p.video || 0;
                    displayDoc = p.doc || 0;
                }
            } else {
                // Course selected but student has no record for it
                displayTotal = 0;
                displayVideo = 0;
                displayDoc = 0;
            }
        }

        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const regTime = s.createdAt
            ? (s.createdAt._seconds ? new Date(s.createdAt._seconds * 1000) : new Date(s.createdAt))
            : null;
        const isTrialActive = regTime && (now - regTime.getTime() < THIRTY_DAYS_MS);
        const trialExpiryStr = regTime ? new Date(regTime.getTime() + THIRTY_DAYS_MS).toLocaleDateString('zh-TW') : '';

        // Pre-map order items for quick lookup
        const orderItemMap = {};
        (s.orderRecords || []).forEach(rec => {
            const exp = rec.expiryDate
                ? (rec.expiryDate._seconds ? new Date(rec.expiryDate._seconds * 1000) : new Date(rec.expiryDate))
                : null;
            const expStr = exp && !isNaN(exp) ? exp.toLocaleDateString('zh-TW') : '';
            Object.keys(rec.items || {}).forEach(cid => {
                orderItemMap[cid] = expStr;
            });
        });

        // Generate Course Detail Rows
        // 1. Definition of "Starter Course" (入門課程) - 5 units
        const starterMasters = [
            'start-01-master-web-app',
            'start-02-master-web-ble',
            'start-03-master-remote-control',
            'start-04-master-touch-events',
            'start-05-master-joystick-lab'
        ];
        const starterTitles = {
            'start-01-master-web-app': 'Web App 遙控器設計',
            'start-02-master-web-ble': 'Web BLE 整合實務',
            'start-03-master-remote-control': '遠端控制邏輯',
            'start-04-master-touch-events': '觸控事件處理',
            'start-05-master-joystick-lab': '搖桿控制實務'
        };

        // 2. Definition of "Prepare" units (課前準備)
        const prepareCids = [
            'github-classroom-free',
            'ai-agents-vibe',
            'cvhofqxc'              // WiFi & Motor
        ];
        const prepareTitles = {
            'github-classroom-free': 'GitHub Classroom & Vibe Coding 實務',
            'ai-agents-vibe': 'AI 代理人與 Vibe Coding 實務',
            'cvhofqxc': 'WiFi 組態設定'
        };
        
        // Combine into "Always Show" list
        const showAlways = new Set([...starterMasters, ...prepareCids]);
        const allCourseIds = new Set(Object.keys(courses));
        showAlways.forEach(cid => allCourseIds.add(cid));

        const courseRows = Array.from(allCourseIds).map(cid => {
            const progress = courses[cid] || { total: 0, video: 0, doc: 0 };
            const courseTitle = starterTitles[cid] || prepareTitles[cid] || lessonsMap[cid] || cid;
            const cleanTitle = courseTitle.replace('course-', '').replace('unit-', '');
            
            let statusLabel = '';
            const isStarter = starterMasters.includes(cid);
            const isPrepare = prepareCids.includes(cid);
            
            if (orderItemMap[cid]) {
                statusLabel = `<span class="text-emerald-600 font-semibold ml-2">繳費至：${orderItemMap[cid]}</span>`;
            } else if (isStarter) {
                if (isTrialActive) {
                    statusLabel = `<span class="text-blue-600 font-semibold ml-2">免費試用(至${trialExpiryStr})</span>`;
                } else {
                    statusLabel = `<span class="text-gray-400 ml-2 italic">試用已過期</span>`;
                }
            } else if (isPrepare) {
                statusLabel = `<span class="text-emerald-500 ml-2">免費課程</span>`;
            } else {
                statusLabel = `<span class="text-gray-400 ml-2">尚未開通</span>`;
            }

            const isMatch = filterCourseId && cid === filterCourseId;
            const bgClass = isMatch ? "bg-blue-50" : "bg-gray-50/30";

            return `
                <tr class="${bgClass} text-[10px] md:text-xs border-b border-gray-50 hidden" data-parent-uid="${s.uid}">
                    <td class="pl-8 md:pl-12 py-2 text-gray-700">
                        <div class="flex items-center gap-4 whitespace-nowrap">
                            <div class="font-bold cursor-help" title="${escapeHtml(courseTitle)}">${escapeHtml(cleanTitle)}</div>
                            <div class="text-[9px] md:text-[10px]">${statusLabel}</div>
                        </div>
                    </td>
                    <td class="py-2 text-right pr-2" colspan="2">
                         <div class="flex items-center justify-end gap-4 text-[9px] text-gray-400 font-normal">
                            <span title="影片觀看時數">🎬 ${Math.round((progress.video || 0) / 60)}m</span>
                            <span title="文件閱讀時數">📄 ${Math.round((progress.doc || 0) / 60)}m</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 1. Build identity row (fallback to uid if name/email missing)
        const displayName = s.name || s.email || `UID_${s.uid.slice(0,6)}`;
        const displaySub = s.name ? s.email : '';
        
        // 2. Formatting Registration Date for the Header
        const regHeaderStr = regTime && !isNaN(regTime) ? regTime.toLocaleDateString('zh-TW', { year:'numeric', month:'numeric', day:'numeric' }) : '–';

        return `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 cursor-pointer text-xs md:text-sm student-header-row" onclick="toggleRow('${s.uid}')">
            <td class="py-3 px-2 font-medium text-gray-800" colspan="2">
                <div class="flex items-center gap-2">
                    <span id="icon-${s.uid}" class="text-gray-400 w-4 inline-block transform transition-transform shrink-0">▶</span>
                    <div class="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                        <div class="text-blue-600 font-bold text-lg">${escapeHtml(displayName)}</div>
                        <div class="text-[11px] text-gray-500">註冊日期: ${regHeaderStr}</div>
                        <div class="text-[10px] text-gray-400 font-normal">${escapeHtml(displaySub)}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-2 text-right">
                <div class="flex flex-col items-end">
                    <div class="font-mono text-blue-600 font-bold text-base">${(displayTotal / 3600).toFixed(1)}h</div>
                    <div class="flex gap-4 text-[9px] text-gray-400 font-normal">
                        <span title="影片觀看時數">🎬 ${Math.round((s.videoTime || 0) / 60)}m</span>
                        <span title="文件閱讀時數">📄 ${Math.round((s.docTime || 0) / 60)}m</span>
                    </div>
                </div>
            </td>
        </tr>
        ${courseRows}
        `;
    }).join('');

    // [V14.8] Use filterUnitId for chart and assignment filtering
    let chartData = data.students;
    let displayAssignments = filterAssignmentsForCurrentView(data.assignments);

    // Assignment Filtering Priority: unitId > courseId
    if (filterUnitId) {
        displayAssignments = displayAssignments.filter(a => unitIdsMatch(a.unitId, filterUnitId));
    } else if (filterCourseId) {
        displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
    }

    // Chart Data Filtering
    if (filterCourseId) {
        chartData = data.students.map(s => {
            const courses = s.courseProgress || {};
            const p = courses[filterCourseId] || { total: 0, video: 0, doc: 0, page: 0 };

            let finalStats = p;
            if (filterUnitId && p.units && p.units[filterUnitId]) {
                finalStats = p.units[filterUnitId];
            }

            return {
                ...s,
                totalTime: finalStats.total || finalStats.totalTime || 0,
                videoTime: finalStats.video || finalStats.videoTime || 0,
                docTime: finalStats.doc || finalStats.docTime || 0,
                pageTime: finalStats.page || finalStats.pageTime || 0
            };
        });
    }

    const guideContent = resolveAssignmentGuide(data, filterCourseId, filterUnitId);

    renderChart(chartData);
    // [V8.1] GitHub README loading moved to renderAssignments for better container management

    // [V15.11] Ensure README is refreshed for Admin Overview as well
    vibeRefreshReadmeContent(filterUnitId);

    // [V8.1] GitHub README loading moved to renderAssignments for better container management
    renderAssignments(displayAssignments, guideContent);
}

// Helper: Resolve assignment guide for a unit
window.resolveAssignmentGuide = window.resolveAssignmentGuide || function(data, filterCourseId, filterUnitId) {
    if (!filterCourseId || !filterUnitId) return "";
    filterUnitId = resolveCanonicalUnitId(filterUnitId);

    try {
        const guideConfig = data.courseGuideIndex?.[filterCourseId] || {};
        const rawInstructor = guideConfig.tutorGuide || null;
        const rawAssignment = guideConfig.assignmentGuide || null;

        const guideData = robustExtractGuideSegments(rawInstructor, rawAssignment);

        const cleanUnitId = filterUnitId.replace('.html', '');
        const candidateIds = getEquivalentUnitIds(filterUnitId);
        let assignmentGuide = candidateIds.map(id => guideData.assignmentGuides[id]).find(Boolean) ||
            guideData.assignmentGuides[cleanUnitId] ||
            guideData.assignmentGuides[cleanUnitId + '.html'] || "";

        console.log(`[Debug] Guide resolution for ${filterUnitId}: ${assignmentGuide ? 'Found by FileName/CleanID' : 'Not Found by ID'}`);

        if (!assignmentGuide.trim()) {
            const lesson = allLessons.find(l => l.courseId === filterCourseId);
            const units = lesson?.courseUnits || [];

            const unitIdx = units.findIndex(u => unitIdsMatch(u, filterUnitId) || u.replace('.html', '') === cleanUnitId);
            if (unitIdx !== -1) {
                const unitNum = unitIdx + 1;
                assignmentGuide = (guideData.assignmentGuides[unitNum] || "").trim();
                console.log(`[Debug] Fallback guide for index ${unitNum}: ${assignmentGuide ? 'Found' : 'Not Found'}`);
            }
        }
        return assignmentGuide;
    } catch (err) {
        console.error("[Debug] Error resolving assignment guide:", err);
        return "";
    }
}

// --- Global Toggle Functions ---
window.toggleCourseRows = function (id, event) {
    if (event) event.stopPropagation();
    const rows = document.querySelectorAll(`.course-unit-${id}`);
    const icon = document.getElementById(`icon-${id}`);

    let isNowVisible = false;
    rows.forEach(row => {
        if (row.style.getPropertyValue('display') === 'none' || row.style.display === 'none') {
            row.style.setProperty('display', 'table-row', 'important');
            isNowVisible = true;
        } else {
            row.style.setProperty('display', 'none', 'important');
            // Also hide any active logs under these units
            const unitLogsIdMatch = row.onclick.toString().match(/toggleUnitLogs\('(.+?)'/);
            if (unitLogsIdMatch) {
                const unitLogsId = unitLogsIdMatch[1];
                const logs = document.querySelectorAll(`.unit-log-${unitLogsId}`);
                logs.forEach(l => l.style.setProperty('display', 'none', 'important'));
                const subIcon = document.getElementById(`icon-${unitLogsId}`);
                if (subIcon) subIcon.classList.remove('rotate-90');
            }
            isNowVisible = false;
        }
    });

    if (icon) {
        if (isNowVisible) icon.classList.add('rotate-90');
        else icon.classList.remove('rotate-90');
    }
};

window.toggleUnitLogs = function (id, event) {
    if (event) event.stopPropagation();
    const rows = document.querySelectorAll(`.unit-log-${id}`);
    const icon = document.getElementById(`icon-${id}`);

    let isNowVisible = false;
    rows.forEach(row => {
        if (row.style.getPropertyValue('display') === 'none' || row.style.display === 'none') {
            row.style.setProperty('display', 'table-row', 'important');
            isNowVisible = true;
        } else {
            row.style.setProperty('display', 'none', 'important');
            isNowVisible = false;
        }
    });

    if (icon) {
        if (isNowVisible) {
            icon.classList.add('rotate-90');
        } else {
            icon.classList.remove('rotate-90');
        }
    }
};


window.handleAssignmentClick = function (courseId, unitId, assignmentUrl = null) {
    if (assignmentUrl) {
        window.open(assignmentUrl, '_blank');
        return;
    }
    // [MOD v12.0.7] Dynamic Permission Check (Context-Aware)
    // 1. Admin with Tutor Mode ON: Direct authorization (Master Key)
    // 2. Qualified Tutor for THIS unit (Status): Direct authorization (Status-based)
    const isAuthorizedTutor = hasQualifiedTutorAccessForUnit(unitId, courseId, myEmail);
    const useMasterBypass = (myRole === 'admin' && adminTutorMode);

    if (useMasterBypass || isAuthorizedTutor) {
        const inviteLink = getUnitTutorConfig(unitId).githubClassroomUrls || null;

        if (inviteLink) {
            let finalUrl = inviteLink;
            if (typeof inviteLink === 'object') {
                finalUrl = inviteLink[myEmail] || inviteLink.default || Object.values(inviteLink)[0];
            }
            if (finalUrl) {
                window.open(finalUrl, '_blank');
                return;
            }
        }

        alert("此單元尚未設定 GitHub Classroom 邀請連結，請管理員/老師至「課程設定」中設定。");
        return;
    }

    (async () => {
        try {
            const resolveAssignmentAccess = httpsCallable(functions, 'resolveAssignmentAccess');
            const result = await resolveAssignmentAccess({ 
                courseId, 
                unitId,
                tutorMode: adminTutorMode 
            });
            const access = result.data || {};

            if (!access.authorized) {
                // [REMOVED] Silent fail or separate UI handling for unauthorized access
                console.warn("[Dashboard] Assignment access unauthorized.");
                return;
            }

            if (access.requiresTutorAssignment && !access.assignedTutorEmail) {
                alert("此單元尚未完成老師指派，作業入口會在老師指派完成後開放。");
                return;
            }

            if (access.classroomUrl) {
                window.open(access.classroomUrl, '_blank');
                return;
            }

            alert("此單元尚未設定 GitHub Classroom 邀請連結，請管理員/老師至「課程設定」中設定。");
        } catch (error) {
            console.error('[Dashboard] Failed to resolve assignment link:', error);
            alert("暫時無法取得作業入口，請稍後再試。");
        }
    })();
};

/**
 * [V14.3] Standardized Render Assignments with Placeholder Support
 */
window.renderAssignments = window.renderAssignments || function(assignments = [], guideContent = "", options = {}) {
    const { showGuide = true } = options;
    const { filterUnitId, filterCourseId } = getCurrentDashboardContext();
    const isAdmin = myRole === 'admin';
    const canManageAssignments = isUserAuthorizedForUnit(filterUnitId, filterCourseId, myEmail) || (isAdmin && !filterUnitId);

    // [Cleanup] Remove old guides
    const possibleContainers = [
        document.getElementById('view-assignments'),
        document.getElementById('assignments-container')
    ];
    possibleContainers.forEach(container => {
        if (!container) return;
        const oldGuides = container.querySelectorAll('.integrated-tutor-guide, .bg-blue-50');
        oldGuides.forEach(g => g.remove());
    });

    // [V14.4] GitHub README Placeholder Management
    vibeRefreshReadmeContent(filterUnitId);

    if (showGuide && guideContent) {
        const guideDiv = document.createElement('div');
        guideDiv.className = 'integrated-tutor-guide mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden';
        guideDiv.innerHTML = `
            <div class="px-6 py-6 text-sm leading-7 text-slate-700 prose prose-base max-w-none prose-headings:text-slate-900 prose-headings:text-2xl prose-headings:font-black prose-strong:text-slate-900 prose-li:my-1">
                ${guideContent}
            </div>
        `;
        possibleContainers.forEach(container => {
            if (container) {
                // Ensure no duplicates
                const existing = container.querySelector('.integrated-tutor-guide');
                if (existing) existing.remove();
                container.appendChild(guideDiv.cloneNode(true));
            }
        });
    }

    const isGlobal = !filterUnitId;
    const thMain = document.getElementById('th-assignment-action-main');
    const thIntegrated = document.getElementById('th-assignment-action-integrated');

    // [V14.12] Action column is NEVER visible in the main Assignments tab
    if (thMain) thMain.classList.add('hidden');
    // Integrated Action column only visible if we are in a unit (can manage)
    if (thIntegrated) thIntegrated.classList.toggle('hidden', isGlobal || !canManageAssignments);

    if (isAdmin && isGlobal) {
        // [V12.1.3] Global Feed: Sort all assignments by newest first
        const sortedAll = [...assignments].sort((a, b) => {
            const getTs = (item) => {
                const ts = item.updatedAt || item.submittedAt;
                if (!ts) return 0;
                return ts.seconds || ts._seconds || new Date(ts).getTime() / 1000 || 0;
            };
            return getTs(b) - getTs(a);
        });
        // Target specifically the Global/Main Assignments Table
        renderAssignmentsTable(sortedAll, canManageAssignments, 'global', '#view-assignments .assignment-table-body');
    } else {
        // Target specifically the Main Assignments Tab (Unit View)
        renderAssignmentsTable(assignments, canManageAssignments, 'unit-main', '#view-assignments .assignment-table-body');
        // Target specifically the Integrated Assignments Table (Settings Tab)
        renderAssignmentsTable(assignments, canManageAssignments, 'unit-integrated', '#assignments-container .assignment-table-body');
    }
    // [V13.6] Note: Cleanup of old guides moved to the TOP of the function to prevent flickering
}

/**
 * Shared Table Renderer for Assignments
 */
window.renderAssignmentsTable = window.renderAssignmentsTable || function(assignments, canManageAssignments, context = 'unit-main', targetSelector = '.assignment-table-body') {
    const tableBodies = document.querySelectorAll(targetSelector);
    if (tableBodies.length === 0) return;
    
    // logic constants
    const showActionCol = (context === 'unit-integrated') && canManageAssignments;
    // [V17.0.6] Integrated Assignments Row click should open URL directly, as there is a dedicated Grade button
    const clickAction = (context === 'unit-integrated') 
                        ? 'url' 
                        : (context === 'global' ? 'modal' : (context === 'unit-main' ? 'url' : 'modal'));

    if (!assignments || assignments.length === 0) {
        const emptyMsg = `<tr><td colspan="${showActionCol ? 6 : 5}" class="text-center py-8 text-gray-400">尚無作業繳交紀錄</td></tr>`;
        tableBodies.forEach(tbody => tbody.innerHTML = emptyMsg);
        return;
    }

    const content = assignments.map(a => {
        let submittedDate = 'N/A';
        const ts = a.updatedAt || a.submittedAt;
        if (ts) {
            if (ts._seconds) submittedDate = new Date(ts._seconds * 1000).toLocaleString();
            else if (ts.seconds) submittedDate = new Date(ts.seconds * 1000).toLocaleString();
            else submittedDate = new Date(ts).toLocaleString();
        }

        const currentStatus = a.currentStatus || a.status || 'new'; 
        const badge = `<span class="${currentStatus === 'submitted' ? 'bg-yellow-100 text-yellow-800' : (currentStatus === 'graded' ? 'bg-green-100 text-green-800' : 'bg-gray-100')} px-2 py-0.5 rounded text-[10px] font-bold">${currentStatus === 'submitted' ? '待評分' : (currentStatus === 'graded' ? '已評分' : currentStatus)}</span>`;

        // Determine Row Onclick logic
        let rowOnClick = '';
        if (clickAction === 'modal') {
            rowOnClick = `window.openGradingModal('${a.id}')`;
        } else {
            // clickAction === 'url'
            rowOnClick = a.assignmentUrl ? `window.open('${a.assignmentUrl}', '_blank')` : "vibeShowToast('此作業無連結', 'warning')";
        }
        
        return `
        <tr class="lg:hover:bg-blue-50/50 transition border-b border-gray-100 cursor-pointer group text-xs md:text-sm" 
            onclick="${rowOnClick}">
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-gray-800">
                <div class="font-medium group-hover:text-blue-600 transition-colors truncate max-w-[150px] md:max-w-none">${escapeHtml(a.studentEmail || a.userEmail)}</div>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2">
                <div class="text-[10px] text-gray-400 capitalize mb-0.5">
                    ${escapeHtml(a.unitId ? a.unitId.replace('.html', '').replace(/-/g, ' ') : 'N/A')}
                </div>
                <div class="font-bold text-gray-800 text-xs md:text-sm">
                    ${escapeHtml(a.title || a.assignmentTitle || unitsTitleMap[resolveCanonicalUnitId(a.unitId)] || "未指定任務")}
                </div>
            </td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-[10px] text-gray-400 text-center">${submittedDate}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-center">${badge}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 font-bold text-gray-700 text-center">${a.grade !== null && a.grade !== undefined ? a.grade : '-'}</td>
            <td class="py-2 px-1 sm:py-3 sm:px-2 text-right ${!showActionCol ? 'hidden' : ''}">
                <button 
                    onclick="event.stopPropagation(); window.openGradingModal('${a.id}')"
                    id="btn-grade-${a.id}"
                    class="bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 px-2 py-0.5 sm:px-3 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition">
                    ${currentStatus === 'graded' ? '查看/修改' : '評分'}
                </button>
            </td>
        </tr>`;
    }).join('');

    tableBodies.forEach(tbody => tbody.innerHTML = content);
}


/**
 * [V15.11] Shared README Refresher
 * Fetches README from GitHub and injects into all available placeholders.
 */
async function vibeRefreshReadmeContent(filterUnitId) {
    const readmePlaceholders = [
        document.getElementById('github-readme-placeholder-main'),
        document.getElementById('github-readme-placeholder-settings'),
        document.getElementById('github-readme-placeholder-student'),
        document.getElementById('github-readme-placeholder-admin-overview')
    ].filter(Boolean);

    if (readmePlaceholders.length === 0) return;

    if (!filterUnitId) {
        readmePlaceholders.forEach(p => p.classList.add('hidden'));
        return;
    }

    // Show loading state
    readmePlaceholders.forEach(p => {
        p.classList.remove('hidden');
        p.innerHTML = `
            <div class="flex items-center gap-3 text-slate-400 italic">
                <span class="animate-pulse">⏳</span> 正在抓取 GitHub 教學指引 (tutor_guide.md)...
            </div>
        `;
    });

    try {
        const repoName = filterUnitId.replace(/\.html$/, '');
        const GITHUB_ORG = 'vibe-coding-classroom';

        for (const placeholder of readmePlaceholders) {
            const isSettingsTab = placeholder.id === 'github-readme-placeholder-settings';
            let markdownHtml = null;

            if (isSettingsTab) {
                // [V17.0.5] SETTINGS TAB: Prioritized Fetching (Tutor Guide Focus)
                const possibleFiles = ['.github/tutor_guide.md', 'tutor_guide.md', 'tutor-guide.md', 'README.md'];
                
                for (const fileName of possibleFiles) {
                    const fileUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/${repoName}/main/${fileName}`;
                    console.log(`[V17.0.5] SettingsTab attempting: ${fileUrl}`);
                    
                    placeholder.innerHTML = `<div class="flex items-center gap-3 text-slate-400 italic"><span class="animate-pulse">⏳</span> 正在抓取導師指南 ${fileName}...</div>`;
                    const result = await loadMarkdown(fileUrl);
                    
                    if (result && !result.includes('無法讀取')) {
                        markdownHtml = result;
                        break;
                    }
                }
            } else {
                // [V17.0.5] ASSIGNMENT TAB: Directly use README.md
                const readmeUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/${repoName}/main/README.md`;
                console.log(`[V17.0.5] AssignmentTab attempting: ${readmeUrl}`);
                
                placeholder.innerHTML = `<div class="flex items-center gap-3 text-slate-400 italic"><span class="animate-pulse">⏳</span> 正在抓取任務說明 (README.md)...</div>`;
                markdownHtml = await loadMarkdown(readmeUrl);
            }

            // Final Injection
            if (markdownHtml && !markdownHtml.includes('無法讀取')) {
                placeholder.innerHTML = markdownHtml;
                placeholder.classList.remove('hidden');
                console.log(`[V17.0.5] Content successfully injected into: ${placeholder.id}`);
            } else {
                console.warn(`[V17.0.5] No content found for placeholder: ${placeholder.id}`);
                placeholder.innerHTML = `
                    <div class="flex items-center gap-3 text-red-500 bg-red-50 p-4 rounded-xl border border-red-100">
                        <span>⚠️</span>
                        <div>
                            <div class="font-bold">無法載入外部說明檔案</div>
                            <div class="text-xs opacity-75">GitHub 儲存庫中找不到可用說明。</div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error("[V17.0.5] External Content Loading Error:", error);
    }
}

window.renderAssignments = renderAssignments;

function renderChart(students) {
    const ctx = document.getElementById('chart-activity').getContext('2d');
    let totalVideo = 0;
    let totalDoc = 0;
    let totalPage = 0;

    students.forEach(s => {
        totalVideo += s.videoTime;
        totalDoc += s.docTime;
        totalPage += s.pageTime;
    });

    if (charts.activity) charts.activity.destroy();

    charts.activity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Video Viewing', 'Document Reading', 'Page Browsing'],
            datasets: [{
                data: [totalVideo, totalDoc, totalPage],
                backgroundColor: ['#3b82f6', '#a855f7', '#9ca3af'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// --- Tab Logic ---
window.switchTab = function (tabName) {
    if (!tabName) return;
    
    // [V14.12] PERMISSION LEAK FIX: Explicitly block 'admin' tab for non-admins
    if (tabName === 'admin' && myRole !== 'admin') {
        console.warn(`[Security] Unauthorized tab access: ${tabName} blocked for ${myRole}.`);
        // Fallback: Redirect to assignments for tutors or overview for admins.
        tabName = getPreferredDashboardTab(getCurrentDashboardContext().filterUnitId);
        if (tabName === 'admin') {
            tabName = 'assignments'; // Extreme safety fallback
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));

    // Role-based restrictions for other tabs
    if (tabName === 'assignments' && !canCurrentUserViewAssignmentsTab()) {
        tabName = getPreferredDashboardTab(filterUnitId);
        if (tabName === 'assignments' && !canCurrentUserViewAssignmentsTab()) {
            return;
        }
    }
    if (tabName === 'settings' && !canCurrentUserViewSettingsTab()) {
        tabName = getPreferredDashboardTab(filterUnitId);
        if (tabName === 'settings' && !canCurrentUserViewSettingsTab()) {
            return;
        }
    }
    if (tabName === 'earnings') {
        tabName = getPreferredDashboardTab(filterUnitId);
    }

    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Show target content
    const targetPane = document.getElementById(`view-${tabName}`);
    if (targetPane) {
        targetPane.classList.remove('hidden');
    } else {
        console.error(`[Dashboard] Tab pane not found: view-${tabName}`);
        return;
    }

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.add('text-gray-500', 'hover:text-gray-700', 'border-transparent');
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    });

    // Activate target button
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700', 'border-transparent');
        activeBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    }

    // [NEW] Integrated Tab Logic: Settings now includes Assignments
    if (tabName === 'settings') {
        const filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));
        console.log("[Dashboard] Rendering Settings & Assignments for unitId:", filterUnitId);
        
        // 1. Render unit settings (links, guides)
        renderSettingsTab(filterUnitId);

        // 2. Fetch and Render assignments inside Settings (for tutors)
        const isQualifiedTutor = !!filterUnitId && currentDashboardPermissions.isQualifiedTutor;
        if (isQualifiedTutor || myRole === 'admin') {
            document.getElementById('assignments-container')?.classList.remove('hidden');
            console.log("[Debug] Total raw assignments in data:", dashboardData.assignments.length);
            console.log("[Debug] Filtering for Unit:", filterUnitId);
            
            let displayAssignments = filterAssignmentsForCurrentView(dashboardData.assignments);
            console.log("[Debug] Assignments after permission filter:", displayAssignments.length);

            if (filterUnitId) {
                displayAssignments = displayAssignments.filter(a => {
                    const match = unitIdsMatch(a.unitId, filterUnitId);
                    if (normalizeEmail(a.studentEmail).includes('rover.k.chen')) {
                        console.log(`[Debug] Checking Rover's doc ${a.id}: unitId=${a.unitId}, match=${match}`);
                    }
                    return match;
                });
            } else if (filterCourseId) {
                displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
            }
            console.log("[Debug] Final assignments to render:", displayAssignments.length);
            // Resolve guide for the integrated view
            renderAssignments(displayAssignments, "", { showGuide: false });
        } else {
            document.getElementById('assignments-container')?.classList.add('hidden');
        }

        // 3. Render integrated earnings (for tutors/admin)
        if (myRole === 'admin' || currentDashboardPermissions.isQualifiedTutor) {
            document.getElementById('earnings-container')?.classList.remove('hidden');
            renderEarningsTab(dashboardData);
        } else {
            document.getElementById('earnings-container')?.classList.add('hidden');
        }
    }
    if (tabName === 'assignments') {
        const urlParams = new URLSearchParams(window.location.search);
        const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
        let filterCourseId = resolveCourseIdFromUrlParam(urlParams.get('courseId'));

        console.log("[DebugTab] tab assignments: filterUnitId=", filterUnitId, "total raw counts:", dashboardData.assignments.length);
        let displayAssignments = filterAssignmentsForCurrentView(dashboardData.assignments);
        console.log("[DebugTab] tab assignments: count after permissions filter:", displayAssignments.length);

        if (filterUnitId) {
            // Same here: prioritize unitId and relax courseId requirement for unit-specific view
            displayAssignments = displayAssignments.filter(a => {
                const match = unitIdsMatch(a.unitId, filterUnitId);
                if (normalizeEmail(a.studentEmail).includes('rover.k.chen')) {
                     console.log(`[DebugAssignmentTab] Checking Rover's doc ${a.id}: unitId=${a.unitId}, match=${match}`);
                }
                return match;
            });
        } else if (filterCourseId) {
            displayAssignments = displayAssignments.filter(a => a.courseId === filterCourseId);
        }
        console.log("[DebugTab] tab assignments: Final count to render:", displayAssignments.length);

        // [NEW] Extract and pass assignment guide
        let assignmentGuide = "";
        if (filterCourseId && filterUnitId) {
            try {
                const guideConfig = dashboardData.courseGuideIndex?.[filterCourseId] || {};
                const rawInstructor = guideConfig.tutorGuide || null;
                const rawAssignment = guideConfig.assignmentGuide || null;

                const guideData = robustExtractGuideSegments(rawInstructor, rawAssignment);

                const cleanUnitId = filterUnitId.replace('.html', '');
                const candidateIds = getEquivalentUnitIds(filterUnitId);
                assignmentGuide = (candidateIds.map(id => guideData.assignmentGuides[id]).find(Boolean) ||
                    guideData.assignmentGuides[cleanUnitId] ||
                    guideData.assignmentGuides[cleanUnitId + '.html'] || "").trim();

                if (!assignmentGuide) {
                    const lesson = allLessons.find(l => l.courseId === filterCourseId);
                    const units = lesson?.courseUnits || [];

                    const unitIdx = units.findIndex(u => unitIdsMatch(u, filterUnitId) || u.replace('.html', '') === cleanUnitId);
                    if (unitIdx !== -1) {
                        assignmentGuide = (guideData.assignmentGuides[unitIdx + 1] || "").trim();
                    }
                }
                console.log(`[Debug] Guide resolution (switchTab) for ${filterUnitId}: ${assignmentGuide ? 'Found' : 'Not Found'}`);
            } catch (guideErr) {
                console.error("[Debug] Error resolving assignment guide in switchTab:", guideErr);
            }
        }
        renderAssignments(displayAssignments, assignmentGuide);
    }
    if (tabName === 'admin') {
        renderAdminConsole();
    }
    // Redundant switch logic removed for merged tabs.
};

// --- Admin Features ---
window.setupAdminFeatures = window.setupAdminFeatures || function() {
    // Admin features are now initialized during renderAdminConsole
}

window.renderAdminConsole = window.renderAdminConsole || function() {
    if (myRole !== 'admin') return;

    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    const filterCourseId = filterUnitId ? findParentCourseIdByUnit(filterUnitId) : resolveCourseIdFromUrlParam(urlParams.get('courseId'));

    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) return;

    // [NEW] Render Pending Applications
    const pendingApps = dashboardData.pendingApplications || [];
    let pendingHtml = '';
    if (pendingApps.length > 0) {
        pendingHtml = `
            <div class="mb-10 bg-orange-50 border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                <div class="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
                    <h4 class="text-sm font-black text-orange-900 flex items-center gap-2">
                        <span class="animate-pulse">🔔</span> 待處理導師申請 (${pendingApps.length})
                    </h4>
                </div>
                <div class="p-6 space-y-4">
                    ${pendingApps.map(app => `
                        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl border border-orange-100 gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center gap-4">
                                <div class="p-2 bg-orange-100 rounded-lg text-lg">🎓</div>
                                <div>
                                    <div class="text-sm font-black text-gray-800">${escapeHtml(app.userEmail)}</div>
                                    <div class="text-[10px] font-mono text-gray-400 mt-0.5">${escapeHtml(app.unitId)}</div>
                                    ${app.source === 'tutor_recommendation' ? `<div class="text-[10px] text-orange-500 mt-0.5">由老師推薦：${escapeHtml(app.recommendedByEmail || 'unknown')}</div>` : ''}
                                    <div class="text-[10px] text-gray-400 mt-0.5">${new Date(app.appliedAt?._seconds * 1000).toLocaleString()}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 w-full sm:w-auto">
                                <button onclick="handleDecideApplication('${app.id}', 'rejected')"
                                    class="flex-grow sm:flex-none px-6 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-700 hover:border-red-100 transition-all">
                                    拒絕 Reject
                                </button>
                                <button onclick="handleDecideApplication('${app.id}', 'approved')"
                                    class="flex-grow sm:flex-none px-8 py-2 bg-blue-500 text-white rounded-lg text-xs font-black hover:bg-orange-600 shadow-sm transition-all active:scale-95">
                                    批准 Approve ✅
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // [NEW] Render Pending Shipments
    const pendingShipments = dashboardData.pendingShipments || [];
    let shipmentsHtml = '';
    if (pendingShipments.length > 0) {
        shipmentsHtml = `
            <div class="mb-10 bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
                <div class="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                    <h4 class="text-sm font-black text-blue-900 flex items-center gap-2">
                        <span class="animate-pulse">📦</span> 待出貨管理 (Shipment Management)
                    </h4>
                </div>
                <div class="p-6 space-y-4">
                    ${pendingShipments.map(ship => `
                        <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl border border-blue-100 gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center gap-4 flex-grow">
                                <div class="p-2 bg-blue-100 rounded-lg text-lg">🚚</div>
                                <div>
                                    <div class="text-sm font-black text-gray-800">${escapeHtml(ship.email)}</div>
                                    <div class="text-[10px] font-mono text-gray-400 mt-0.5">訂單: ${escapeHtml(ship.orderId)}</div>
                                    <div class="text-[10px] text-blue-600 mt-1 font-bold">項目: ${ship.items.join(', ')}</div>
                                    <div class="text-[10px] text-gray-500 mt-1">付款時間: ${new Date(ship.paidAt).toLocaleString()}</div>
                                    ${ship.logistics ? `
                                        <div class="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100 text-[10px] text-gray-600">
                                            <strong>收件資訊:</strong> ${escapeHtml(ship.logistics.CVSStoreName || '')} (${escapeHtml(ship.logistics.CVSStoreID || '')})<br>
                                            ${escapeHtml(ship.logistics.CVSAddress || '')}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-3 w-full sm:w-auto">
                                <button onclick="handleMarkAsShipped('${ship.orderId}')"
                                    class="flex-grow sm:flex-none px-8 py-2 bg-emerald-500 text-white rounded-lg text-xs font-black hover:bg-emerald-600 shadow-sm transition-all active:scale-95">
                                    標記為已出貨 Mark Shipped ✅
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    let html = `
        ${shipmentsHtml}
        ${pendingHtml}
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <h3 class="text-2xl font-black text-orange-900 flex items-center gap-3">
                <span class="p-2.5 bg-orange-100 rounded-xl">🛠️</span> 
                課程管理控制台 (Course Management)
            </h3>
            
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">導師模式 / Tutor Mode</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" class="sr-only peer" ${adminTutorMode ? 'checked' : ''} onchange="toggleAdminTutorMode(this.checked)">
                        <div class="w-10 h-5 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                </div>
            </div>

            <p id="admin-msg" class="text-sm font-bold text-orange-600 animate-pulse"></p>
        </div>
    `;

    try {
        const renderedUnits = new Set(); // [NEW] Track rendered units to prevent duplicates
        let lessonRows = allLessons.map(lesson => {
            try {
                if (filterCourseId && lesson.courseId !== filterCourseId) return '';

                let units = lesson.courseUnits || [];
                const rawFiles = Array.from(new Set([...units, ...Object.keys(dashboardData?.unitTutorConfigs || {})]))
                    .filter(isRenderableUnitFile);
                const canonicalUnitMap = new Map();

                rawFiles.forEach(fileName => {
                    const preferredId = getPreferredUnitId(fileName, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                    if (!isRenderableUnitFile(preferredId)) return;
                    if (!canonicalUnitMap.has(preferredId)) {
                        canonicalUnitMap.set(preferredId, preferredId);
                    }
                });

                let allFiles = Array.from(canonicalUnitMap.values());

                if (filterUnitId) {
                    const preferredUnit = getPreferredUnitId(filterUnitId, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                    allFiles = preferredUnit ? [preferredUnit] : [];
                }

                if (allFiles.length === 0) return '';

                return allFiles.map(unitFile => {
                    const normalizedFile = getPreferredUnitId(unitFile, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                    if (!isRenderableUnitFile(normalizedFile)) return '';
                    if (renderedUnits.has(normalizedFile)) return ''; 
                    renderedUnits.add(normalizedFile);

                    const unitDocConfig = getUnitTutorConfig(unitFile);

                    const unitTutorsArr = Array.isArray(unitDocConfig.authorizedTutors) ? unitDocConfig.authorizedTutors : [];
                    const configEmails = Object.keys(unitDocConfig.githubClassroomUrls || {})
                        .map(normalizeTutorIdentifier)
                        .filter(Boolean);
                    const tutorDetailsEmails = Object.values(unitDocConfig.tutorDetails || {})
                        .map(entry => entry?.email)
                        .filter(Boolean);
                    const unitTutors = Array.from(new Set([...unitTutorsArr, ...configEmails, ...tutorDetailsEmails]))
                        .filter(t => t && t !== 'default');
                    const unitName = formatUnitName(unitFile) || unitFile;

                    const isSelected = filterUnitId && unitIdsMatch(unitFile, filterUnitId);
                    const containerClass = isSelected ? "bg-blue-50/60 border-l-4 border-blue-500 shadow-sm z-10" : "hover:bg-orange-50/20 transition-colors";
                    const inputId = `input-auth-${lesson.courseId}-${unitFile}`.replace(/[^a-z0-9]/gi, '-');

                    return `
                        <div class="flex flex-col ${containerClass} p-6 gap-6 relative">
                            <!-- Section 1: Unit Info -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-1.5 tracking-widest">課程單元 / Unit</div>
                                <div class="text-xs text-gray-400 font-mono mb-1 leading-relaxed">${escapeHtml(lesson.title)}</div>
                                <div class="text-lg font-black text-gray-800 flex items-center gap-2">${escapeHtml(unitName)}</div>
                                <div class="text-xs text-gray-400 font-mono mt-1.5 opacity-80">${escapeHtml(unitFile)}</div>
                            </div>

                            <!-- Section 2: Tutor Management -->
                            <div>
                                <div class="text-[11px] text-orange-400 font-black uppercase mb-3.5 tracking-widest">合格導師 / Tutors</div>
                                <div class="bg-white rounded-xl border border-orange-100 overflow-hidden mb-5">
                                    <table class="w-full text-left border-collapse text-[11px]">
                                        <thead>
                                            <tr class="bg-orange-50/50 text-orange-700 border-b border-orange-100 uppercase tracking-tighter font-black">
                                                <th class="py-2.5 px-4">姓名 / Name</th>
                                                <th class="py-2.5 px-4">Email</th>
                                                <th class="py-2.5 px-4">合格時間 / Qualified At</th>
                                                <th class="py-2.5 px-4 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-orange-50">
                                            ${unitTutors.length > 0
                                ? unitTutors.map(email => {
                                    const details = unitDocConfig.tutorDetails?.[email] || {};
                                    const displayEmail = email.includes('@') ? email : (details.email || email);
                                    const name = details.name || displayEmail.split('@')[0];
                                    const time = details.qualifiedAt
                                        ? new Date(details.qualifiedAt).toLocaleString('zh-TW', { hour12: false })
                                        : '—';

                                    return `
                                            <tr class="hover:bg-orange-50/20 transition-colors group/row">
                                                <td class="py-2.5 px-4 font-bold text-gray-800">${escapeHtml(name)}</td>
                                                <td class="py-2.5 px-4 font-mono text-gray-500">${escapeHtml(displayEmail)}</td>
                                                <td class="py-2.5 px-4 text-gray-400">${escapeHtml(time)}</td>
                                                <td class="py-2.5 px-4 text-right">
                                                    <button onclick="handleUnitTutorAuth('${lesson.courseId}', '${unitFile}', '${displayEmail}', 'remove', '${lesson.courseId}')" 
                                                        class="text-red-500 hover:text-red-700 transition-colors p-1 font-bold">
                                                        移除 ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                }).join('')
                                : '<tr><td colspan="4" class="py-8 text-center text-gray-300 italic">目前無核心授權導師</td></tr>'
                            }
                                        </tbody>
                                    </table>
                                </div>

                            </div>
                        </div>
                    `;
                }).join('');
            } catch (lessonErr) {
                console.error("Error rendering lesson:", lesson.courseId, lessonErr);
                return `<div class="p-4 text-red-500">Error rendering lesson ${lesson.courseId}: ${lessonErr.message}</div>`;
            }
        }).join('');

        html += `
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm font-mono text-sm w-full">
                <div class="divide-y divide-gray-100">
                    ${lessonRows}
                </div>
            </div>
        `;
    } catch (totalErr) {
        console.error("Admin Console Crash:", totalErr);
        html += `<div class="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <h4 class="font-black mb-2">管理控制台發生錯誤</h4>
            <p class="text-xs opacity-75">${totalErr.message}</p>
        </div>`;
    }

    adminPanel.innerHTML = html;
    stripAdminConsoleAttachmentSections(adminPanel);
}

function stripAdminConsoleAttachmentSections(rootEl) {
    if (!rootEl) return;
    const candidates = Array.from(rootEl.querySelectorAll('div, section, article'));
    candidates.forEach(node => {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text.includes('附件資料 / Attachments')) return;

        const removableCard =
            node.closest('.mb-4.p-4.bg-orange-50') ||
            node.closest('.unit-guide-row') ||
            node;

        if (removableCard && rootEl.contains(removableCard)) {
            removableCard.remove();
        }
    });
}

window.handleUnitTutorAuth = async function (courseId, unitFile, tutorEmail, action, parentCourseId = null) {
    if (!tutorEmail) return alert("請輸入 Email");
    const msg = document.getElementById('admin-msg');

    try {
        if (msg) msg.textContent = action === 'add' ? "正在新增單元授權..." : "正在移除單元授權...";

        // [MODIFIED] Use both unitFile (as specific courseId) and parentCourseId (for legacy cleanup)
        const authFunc = httpsCallable(functions, 'authorizeTutorForCourse');
        await authFunc({ 
            courseId: unitFile, 
            tutorEmail, 
            action,
            parentCourseId: parentCourseId || courseId // Use courseId as fallback if specifically passed
        });

        loadDashboard(); // Refresh UI
    } catch (e) {
        console.error("Unit Auth Error:", e);
        alert("授權失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};

window.toggleAdminTutorMode = function (enabled) {
    localStorage.setItem('adminTutorMode', enabled);
    // [V13.0.21] Force reload to ensure ALL functions and UI respect the new simulation state
    window.location.reload();
};

window.handleAssignTutor = async function (studentUid, unitId, tutorEmail) {
    if (!studentUid || !unitId) {
        alert(`Missing data: studentUid=${studentUid}, unitId=${unitId}`);
        return;
    }
    const msg = document.getElementById('admin-msg');
    const finalTutor = (tutorEmail === 'none' || !tutorEmail) ? "" : tutorEmail;

    // alert(`Sending: studentUid=${studentUid}, unitId=${unitId}, tutorEmail=${finalTutor}`);

    try {
        if (msg) msg.textContent = "正在更新導師指派...";

        const assignFunc = httpsCallable(functions, 'assignStudentToTutor');
        await assignFunc({ studentUid, unitId, tutorEmail: finalTutor });

        // Refresh the whole dashboard to get fresh data from server
        await loadDashboard();
    } catch (e) {
        console.error("Assignment Error:", e);
        alert("指派失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};

// --- Grading Logic ---
window.setupGradingFunctions = window.setupGradingFunctions || function() {
    const modal = document.getElementById('grading-modal');
    if (!modal) return; // Guard if modal not found

    const idInput = document.getElementById('grade-assignment-id');
    const scoreInput = document.getElementById('grade-score');
    const feedbackInput = document.getElementById('grade-feedback');
    const submitBtn = document.getElementById('btn-submit-grade');
    const historyContainer = document.getElementById('assignment-history');
    const recommendationBox = document.getElementById('tutor-recommendation-box');
    const recommendationDesc = document.getElementById('tutor-recommendation-desc');
    const recommendationStatus = document.getElementById('tutor-recommendation-status');
    const recommendationBtn = document.getElementById('btn-submit-recommendation');

    function setTutorRecommendationState({
        visible,
        message = '',
        messageClass = 'text-orange-700',
        buttonLabel = '推薦此學生',
        buttonDisabled = false
    }) {
        if (!recommendationBox || !recommendationStatus || !recommendationBtn) return;

        recommendationBox.classList.toggle('hidden', !visible);
        recommendationStatus.className = `mt-3 text-xs font-bold ${messageClass}`;
        recommendationStatus.textContent = message;
        recommendationBtn.textContent = buttonLabel;
        recommendationBtn.disabled = buttonDisabled;
        recommendationBtn.classList.toggle('opacity-50', buttonDisabled);
        recommendationBtn.classList.toggle('cursor-not-allowed', buttonDisabled);
    }

    function refreshTutorRecommendationUI(assignment) {
        if (!recommendationBox || !recommendationDesc) return;

        if (!assignment) {
            setTutorRecommendationState({ visible: false });
            return;
        }

        const canonicalUnitId = resolveCanonicalUnitId(assignment.unitId);
        const unitConfig = getUnitTutorConfig(canonicalUnitId);
        const authorizedTutors = Array.isArray(unitConfig.authorizedTutors) ? unitConfig.authorizedTutors : [];
        const pendingApps = dashboardData?.pendingApplications || [];
        const studentEmail = assignment.studentEmail || assignment.userEmail || '';
        const hasPendingRecommendation = pendingApps.some(app =>
            app.status === 'pending' &&
            unitIdsMatch(app.unitId, canonicalUnitId) &&
            (app.userEmail === studentEmail || app.userId === assignment.userId)
        );

        recommendationDesc.textContent = `若 ${studentEmail || '該學生'} 在此單元表現成熟，可由授課老師直接送出推薦，交由管理員審核。`;

        if (authorizedTutors.includes(studentEmail)) {
            setTutorRecommendationState({
                visible: true,
                message: '此學生已是本單元合格導師。',
                messageClass: 'text-green-700',
                buttonLabel: '已具資格',
                buttonDisabled: true
            });
            return;
        }

        if (hasPendingRecommendation) {
            setTutorRecommendationState({
                visible: true,
                message: '此學生已有待審推薦，等待管理員審核中。',
                messageClass: 'text-orange-700',
                buttonLabel: '審核中',
                buttonDisabled: true
            });
            return;
        }

        setTutorRecommendationState({
            visible: true,
            message: '推薦送出後，管理員控制台會出現待審申請卡片。',
            messageClass: 'text-orange-700',
            buttonLabel: '推薦此學生',
            buttonDisabled: false
        });
    }

    window.openGradingModal = function (id) {
        console.log(`[Grading] Opening modal for ID: ${id}`);
        const modal = document.getElementById('grading-modal');
        const idInput = document.getElementById('grade-assignment-id');
        const scoreInput = document.getElementById('grade-score');
        const feedbackInput = document.getElementById('grade-feedback');
        const titleEl = document.getElementById('grading-assignment-title');
        const historyContainer = document.getElementById('assignment-history');

        if (!modal || !idInput || !scoreInput || !feedbackInput) {
            console.error("[Grading] One or more grading modal elements are missing!");
            alert("系統錯誤：找不到評分視窗元素，請重新整理頁面。");
            return;
        }

        if (!dashboardData || !dashboardData.assignments) {
            console.error("[Grading] dashboardData.assignments is missing!");
            return;
        }
        const assignment = dashboardData.assignments.find(a => a.id === id);
        if (!assignment) {
            console.error(`[Grading] Assignment NOT FOUND for ID: ${id}. Candidates:`, dashboardData.assignments.map(a => a.id));
            alert("找不到該作業資料，請重新整理頁面。");
            return;
        }
        currentGradingAssignment = assignment;

        if (titleEl) titleEl.innerText = assignment.assignmentTitle || assignment.title || "評分作業";

        idInput.value = id;
        scoreInput.value = assignment.grade || '';
        feedbackInput.value = assignment.tutorFeedback || '';

        // Render History
        const historyMap = (assignment.submissionHistory || []).map(h => {
            let safeTime = 'Unknown';
            if (h.timestamp && h.timestamp._seconds) {
                safeTime = new Date(h.timestamp._seconds * 1000).toLocaleString();
            } else if (h.timestamp) {
                safeTime = new Date(h.timestamp).toLocaleString();
            }

            return `
        <div class="mb-2 pb-2 border-b border-gray-200 last:border-0" >
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>${safeTime}</span>
                        <span class="font-bold text-blue-600">${h.action || 'SUBMIT'}</span>
                    </div>
                    <div class="mt-1 text-gray-800 break-all whitespace-pre-wrap">${escapeHtml(h.content || h.url)}</div>
                    ${h.note ? `<div class="text-xs text-gray-400 italic">Note: ${escapeHtml(h.note)}</div>` : ''}
                    ${h.grader ? `<div class="text-xs text-orange-600 mt-1">Graded by Tutor</div>` : ''}
                </div>
        `;
        }).join('');

        historyContainer.innerHTML = historyMap || '<p class="text-gray-400 text-center">No history</p>';
        refreshTutorRecommendationUI(assignment);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('modal-open');

        // Fallback programmatic hide
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.setProperty('display', 'none', 'important');
    }

    window.closeGradingModal = function () {
        currentGradingAssignment = null;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.classList.remove('modal-open');

        // Restore navbar
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';
    }

    window.submitGrade = async function () {
        const idInput = document.getElementById('grade-assignment-id');
        const scoreInput = document.getElementById('grade-score');
        const feedbackInput = document.getElementById('grade-feedback');
        const submitBtn = document.getElementById('btn-submit-grade');

        if (!idInput || !scoreInput || !feedbackInput || !submitBtn) {
            alert('系統錯誤：找不到評分表單元素');
            return;
        }

        const id = idInput.value;
        const score = scoreInput.value;
        const feedback = feedbackInput.value;

        if (!score) {
            alert('請輸入分數');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '送出中...';

        try {
            const gradeAssignment = httpsCallable(functions, 'gradeAssignment');
            await gradeAssignment({ assignmentId: id, grade: score, feedback: feedback });
            alert('評分成功！');
            closeGradingModal();
            loadDashboard(); // Refresh list
        } catch (e) {
            console.error(e);
            alert('評分失敗：' + e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '送出評分';
        }
    };

    window.submitTutorRecommendation = async function () {
        if (!currentGradingAssignment || !recommendationBtn) return;

        recommendationBtn.disabled = true;
        recommendationBtn.textContent = '送出推薦中...';
        if (recommendationStatus) {
            recommendationStatus.className = 'mt-3 text-xs font-bold text-orange-700';
            recommendationStatus.textContent = '正在送出推薦...';
        }

        try {
            const recommendTutorForUnit = httpsCallable(functions, 'recommendTutorForUnit');
            const result = await recommendTutorForUnit({ assignmentId: currentGradingAssignment.id });

            setTutorRecommendationState({
                visible: true,
                message: '已成功送出老師推薦，等待管理員審核。',
                messageClass: 'text-green-700',
                buttonLabel: '已送出推薦',
                buttonDisabled: true
            });

            dashboardData.pendingApplications = dashboardData.pendingApplications || [];
            dashboardData.pendingApplications.unshift({
                id: result?.data?.applicationId || `pending-${currentGradingAssignment.id}`,
                userId: currentGradingAssignment.userId,
                userEmail: currentGradingAssignment.studentEmail || currentGradingAssignment.userEmail,
                unitId: resolveCanonicalUnitId(currentGradingAssignment.unitId),
                status: 'pending'
            });
        } catch (e) {
            console.error('Tutor recommendation failed:', e);
            const msg = e?.message || '';

            if (msg.includes('already a qualified tutor')) {
                setTutorRecommendationState({
                    visible: true,
                    message: '此學生已是本單元合格導師。',
                    messageClass: 'text-green-700',
                    buttonLabel: '已具資格',
                    buttonDisabled: true
                });
            } else if (msg.includes('pending application')) {
                setTutorRecommendationState({
                    visible: true,
                    message: '此學生已有待審推薦，等待管理員審核中。',
                    messageClass: 'text-orange-700',
                    buttonLabel: '審核中',
                    buttonDisabled: true
                });
            } else {
                setTutorRecommendationState({
                    visible: true,
                    message: `推薦失敗：${msg}`,
                    messageClass: 'text-red-600',
                    buttonLabel: '重新推薦',
                    buttonDisabled: false
                });
            }
        }
    };
}

// Utils
window.escapeHtml = window.escapeHtml || function(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.formatUnitName = window.formatUnitName || function(fileName) {
    if (!fileName) return "Unknown";
    let name = fileName.replace('.html', '');

    // Explicit handle for master files - Keep them for display in settings
    if (name.includes('-master-')) {
        // Fallback title for masters
    }

    // Try to strip prefixes like "00-unit-", "basic-01-unit-"
    const nameMatch = name.match(/(?:unit-|master-)(.+)/i);
    if (nameMatch) name = nameMatch[1];
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); // Title Case
}

// --- Data Aggregation Logic ---
window.aggregateData = window.aggregateData || function(data) {
    if (!data.students) return;

    const MENU_PAGES = new Set([
        'index.html', 'about.html', 'advanced.html', 'basic.html', 
        'started.html', 'prepare.html', 'auth.html', 'dashboard.html', 
        'cart.html', 'faq.html', 'payment-return.html', 'tutors.html',
        'index', 'about', 'advanced', 'basic', 'started', 'prepare', 'auth', 'dashboard', 'cart', 'faq'
    ]);

    data.students.forEach(student => {
        const rawProgress = student.courseProgress || {};
        const aggregated = {};

        Object.entries(rawProgress).forEach(([key, stats]) => {
            const lowKey = key.toLowerCase();
            // Skip Menu Pages OR 00-* intro pages
            if (MENU_PAGES.has(lowKey) || lowKey.startsWith('00-')) return;

            const realId = findCourseId(key);
            // console.log(`Mapping ${ key } -> ${ realId } `);

            if (!aggregated[realId]) {
                aggregated[realId] = { total: 0, video: 0, doc: 0, page: 0, units: {}, logs: [] };
            }
            aggregated[realId].total += stats.total || 0;
            aggregated[realId].video += stats.video || 0;
            aggregated[realId].doc += stats.doc || 0;
            aggregated[realId].page += stats.page || 0;

            // Store granular unit data
            aggregated[realId].units[key] = stats;

            // Merge Logs
            if (stats.logs && Array.isArray(stats.logs)) {
                if (!aggregated[realId].logs) aggregated[realId].logs = [];
                aggregated[realId].logs = aggregated[realId].logs.concat(stats.logs);
            }
        });

        // Recalculate totals based on filtered courses
        student.totalTime = Object.values(aggregated).reduce((acc, c) => acc + (c.total || 0), 0);
        student.videoTime = Object.values(aggregated).reduce((acc, c) => acc + (c.video || 0), 0);
        student.docTime = Object.values(aggregated).reduce((acc, c) => acc + (c.doc || 0), 0);

        student.courseProgress = aggregated;
    });

    // Fix assignments courseId & ensure ID stability
    if (data.assignments) {
        data.assignments.forEach(a => {
            // [REPAIR] Ensure id is always present (backend returns id, but we be defensive)
            if (!a.id && a.docId) a.id = a.docId;
            
            const realId = findCourseId(a.courseId);
            if (realId && realId !== a.courseId) {
                a.courseId = realId;
            }
        });
    }
}

window.findCourseId = window.findCourseId || function(key) {
    // 1. Exact match in loaded lessons
    const exact = allLessons.find(l => l.courseId === key);
    if (exact) return key;

    // 2. Exact match in lessonsMap (keys are courseIds)
    if (lessonsMap[key]) return key;

    // 3. Prefix match / Filename match
    // key might be "02-unit-html5-basics.html" or "basic-01-unit..."
    // lesson.classroomUrl might be ".../02-master-web-app.html"

    // Sanitize key: remove .html
    const cleanKey = key.replace('.html', '');

    for (const l of allLessons) {
        if (!l.classroomUrl) continue;

        // Extract filename from lesson URL and clean it
        const lessonFile = l.classroomUrl.split('/').pop().replace('.html', '');

        // Matches if:
        // A. Key starts with lessonFile prefix (very specific)
        // B. Key and LessonFile share a common "course code" prefix (e.g. "02-", "basic-01-")

        // Try code prefix matching
        // Patterns: "XX-", "basic-XX-"
        // Extract prefix from Lesson File:
        // "00-master..." -> "00-"
        // "basic-01-master..." -> "basic-01-"

        const masterMatch = lessonFile.match(/^([a-zA-Z0-9]+-\d+-|[0-9]+-)/);
        const prefix = masterMatch ? masterMatch[0] : null;

        if (prefix && cleanKey.startsWith(prefix)) {
            return l.courseId;
        }
    }

    return key; // Fallback to original if no match found
}

// --- Course Settings Feature ---

window.setupSettingsFeature = window.setupSettingsFeature || function() {
    // Buttons are now rendered individually in each row
}

/**
 * Checks if a user is explicitly authorized as a tutor for a specific unit.
 * Logic matches renderAdminConsole: unit-level authorizedTutors OR legacy classroom URL keys.
 */
window.isUserAuthorizedForUnit = window.isUserAuthorizedForUnit || function(fileName, courseId, email) {
    if (!email) return false;
    const { isAdmin, isPaidStudent } = currentDashboardPermissions;

    // RULE 1: Admin in Tutor Mode follows the teacher-view path for this unit.
    if (isAdmin && adminTutorMode) return true;

    // [V12.5.0] INTRO MONTH RULE: 1 month free for intro units upon registration
    const isFreeUnit = (fileName || "").toLowerCase().includes('intro') || (fileName || "").toLowerCase().includes('prepare');
    
    if (isFreeUnit && !isPaidStudent) {
        const regTime = dashboardData?.createdAt?.seconds ? new Date(dashboardData.createdAt.seconds * 1000) : new Date(dashboardData?.createdAt || 0);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        // If registration was less than a month ago, grant access to intro units.
        if (regTime > oneMonthAgo) return true;
        else return false; // Trial expired!
    }

    // RULE 2: If Simulation Mode or Standard User:
    const isQual = hasQualifiedTutorAccessForUnit(fileName, courseId, email);

    // RULE 3: For Paid Units, must be Qualified OR Paid (non-expired).
    return isQual || isPaidStudent;
}

async function renderSettingsTab(filterUnitId = null) {
    filterUnitId = resolveCanonicalUnitId(filterUnitId);
    console.log("[Settings] renderSettingsTab invoked with filter:", filterUnitId);
    
    const assignmentContainer = document.getElementById('assignment-setting');
    const guideContainer = document.getElementById('guide-container');
    if (!assignmentContainer || !guideContainer) {
        console.error("[Settings] Critical: Containers NOT found in DOM.");
        return;
    }

    try {
        const userEmail = auth.currentUser?.email;
        console.log("[Settings] Current User:", userEmail);
        
        if (!userEmail) {
            const msg = `<div class="text-center py-20 text-gray-400">請先登入以查看設定。</div>`;
            assignmentContainer.innerHTML = msg;
            guideContainer.innerHTML = msg;
            return;
        }

        // [MODIFIED] Wait for data if it's somehow missing but being called
        if (!dashboardData && (myRole === 'admin')) {
            console.warn("[Settings] dashboardData missing, possibly still loading...");
            return; // Exit and wait for loadDashboard to call us again
        }

        const lessonsToProcess = Array.isArray(allLessons) ? allLessons : [];
        console.log("[Settings] Processing", lessonsToProcess.length, "lessons.");

        // 1. Render Course List
        let authorizedLessons = lessonsToProcess.filter(course => {
            if (myRole === 'admin' && adminTutorMode) return true;

            const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];
            const allFiles = Array.from(new Set(units)).filter(f => f && !f.includes('-master-'));

            return allFiles.some(f => isUserAuthorizedForUnit(f, course.courseId, userEmail));
        });

        authorizedLessons = Array.from(
            new Map(
                authorizedLessons
                    .filter(course => course && course.courseId)
                    .map(course => [course.courseId, course])
            ).values()
        );

        console.log("[Settings] Authorized lessons count:", authorizedLessons.length);

        // [NEW] If filtered to a specific course
        const urlParams = new URLSearchParams(window.location.search);
        const filterCourseId = filterUnitId ? findParentCourseIdByUnit(filterUnitId) : resolveCourseIdFromUrlParam(urlParams.get('courseId'));
        if (filterCourseId) {
            authorizedLessons = authorizedLessons.filter(l => l.courseId === filterCourseId);
        }

        if (authorizedLessons.length === 0) {
            console.warn("[Settings] No authorized lessons found for user.");
            const msg = `<div class="text-center py-20 text-gray-400">目前尚無獲准管理的課程（需為單元合格導師）。</div>`;
            assignmentContainer.innerHTML = msg;
            guideContainer.innerHTML = msg;
            return;
        }

        // [NEW v13.7] Collect and Deduplicate all units across all authorized courses
        const unitToDataMap = new Map();

        authorizedLessons.forEach(course => {
            const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];
            const masterFile = (course.classroomUrl || "").split('/').pop().split('?')[0];
            if (masterFile && !units.includes(masterFile)) {
                units.unshift(masterFile);
            }

            const guideConfig = getCourseGuideConfig(course.courseId);
            const guideData = robustExtractGuideSegments(guideConfig.tutorGuide, guideConfig.assignmentGuide);
            const attachSegments = guideConfig.attachmentGuide || {};

            const filteredUnits = units.filter(f => {
                const isMaster = f.includes('-master-');
                if (isMaster && filterUnitId && !unitIdsMatch(f, filterUnitId)) return false;
                if (filterUnitId && !filterUnitId.includes('-master-')) {
                    return unitIdsMatch(f, filterUnitId);
                }
                return true;
            });

            const finalUnits = filterUnitId
                ? (() => {
                    const preferredUnit = getPreferredUnitId(filterUnitId, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                    return preferredUnit ? [preferredUnit] : [];
                })()
                : filteredUnits;

            finalUnits.forEach(fileName => {
                const preferredFileName = getPreferredUnitId(fileName, units, Object.keys(dashboardData?.unitTutorConfigs || {}));
                if (!isRenderableUnitFile(preferredFileName)) return;
                
                if (!unitToDataMap.has(preferredFileName)) {
                    const realUnitsOnly = units.filter(u => !u.includes('-master-'));
                    const unitIdx = realUnitsOnly.indexOf(preferredFileName);
                    const unitNum = unitIdx !== -1 ? unitIdx + 1 : null;
                    const tutorSegment = guideData.segments[preferredFileName] || (unitNum ? guideData.segments[unitNum] : "") || "";
                    const attachmentSegment = attachSegments[preferredFileName] || (unitNum ? attachSegments[unitNum] : "") || "";

                    unitToDataMap.set(preferredFileName, {
                        courseId: course.courseId,
                        courseTitle: course.title,
                        tutorSegment: tutorSegment,
                        attachmentSegment: attachmentSegment,
                        unitsForPreference: units
                    });
                }
            });
        });

        console.log("[Settings] Deduplicated unique units count:", unitToDataMap.size);

        let totalAssignmentHTML = "";
        let totalGuideHTML = "";

        const allUniqueUnits = Array.from(unitToDataMap.keys());
        
        const assignmentRows = allUniqueUnits.map(fileName => {
            const uData = unitToDataMap.get(fileName);
            const isAuthorized = isUserAuthorizedForUnit(fileName, uData.courseId, userEmail);
            return renderAssignmentConfigRow(uData.courseId, fileName, getUnitTutorConfig(fileName).githubClassroomUrls, uData.courseTitle, isAuthorized);
        }).filter(h => !!h).join('');

        const guideRows = allUniqueUnits.map(fileName => {
            const uData = unitToDataMap.get(fileName);
            if (!uData.tutorSegment && !uData.attachmentSegment) return "";
            
            const isAuthorized = isUserAuthorizedForUnit(fileName, uData.courseId, userEmail);
            let combinedSegment = "";
            if (uData.attachmentSegment) {
                combinedSegment += `
                    <div class="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                         <div class="text-[10px] text-orange-500 font-bold uppercase mb-2 tracking-widest flex items-center gap-2">
                            <span class="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                            附件資料 / Attachments
                         </div>
                         <div class="text-sm text-orange-900 leading-relaxed font-medium">
                            ${uData.attachmentSegment}
                         </div>
                    </div>
                `;
            }
            combinedSegment += uData.tutorSegment;
            return renderGuideRow(uData.courseId, fileName, combinedSegment, uData.courseTitle, isAuthorized);
        }).filter(h => !!h).join('');

        if (assignmentRows) {
            totalAssignmentHTML = `
                <div class="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm font-mono text-sm mb-6 w-full">
                    <div class="divide-y divide-gray-100">${assignmentRows}</div>
                </div>`;
        }
        if (guideRows) {
            totalGuideHTML = `<div class="w-full space-y-6">${guideRows}</div>`;
        }

        assignmentContainer.innerHTML = totalAssignmentHTML || "";
        guideContainer.innerHTML = totalGuideHTML || "";
        if (guideContainer) guideContainer.classList.remove('hidden');

    } catch (e) {
        console.error("[Settings] Critical Render Failure:", e);
        assignmentContainer.innerHTML = `<div class="text-red-500 p-8 rounded-2xl bg-red-50 border border-red-100">
            <h4 class="font-black text-sm mb-2">載入設定時發生錯誤 (Render Failure)</h4>
            <p class="text-[10px] opacity-75">${e.message}</p>
        </div>`;
    }
}

window.renderAssignmentConfigRow = window.renderAssignmentConfigRow || function(courseId, fileName, tutorMap = {}, courseTitle = "", isAuthorized) {
    const userEmail = auth.currentUser?.email;
    const isAdmin = myRole === 'admin' && adminTutorMode;
    
    // [V14.8.5] Even if admin, only show self in unit-settings view to maintain isolation/clutter-free UI
    let entries = Object.entries(tutorMap || {}).filter(([tutor]) => tutor === userEmail);
    
    // Fallback: If current user doesn't have a specific link yet, show an empty row for them
    if (entries.length === 0 && userEmail) entries.push([userEmail, '']);

    const unitName = formatUnitName(fileName);

    return `
        <div class="p-6 unit-config-card" data-course-id="${courseId}" data-file-name="${fileName}">
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div class="flex-grow">
                    <div class="text-[10px] text-blue-500 font-bold uppercase mb-1 tracking-widest flex items-center gap-2">
                       <span class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                       單元資訊 / Unit ${fileName}
                    </div>
                    <div class="text-xl font-black text-gray-800 tracking-tight leading-loose">${escapeHtml(unitName)}</div>
                </div>
                <div class="flex-grow max-w-2xl">
                    ${isAuthorized ? `
                        <div class="text-[10px] text-blue-400 font-black uppercase mb-2 tracking-widest">作業連結 / Link</div>
                        ${entries.map(([tutor, url]) => `
                            <div class="flex gap-2 assignment-link-row">
                                <input type="hidden" class="assignment-id-input" value="${escapeHtml(tutor)}">
                                <input type="url" placeholder="GitHub Classroom 連結" value="${escapeHtml(url)}" 
                                    class="assignment-url-input flex-grow px-4 py-2 text-xs border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-50/50 bg-gray-50/30 transition-all font-mono">
                                <button onclick="saveAllSettings(this)"
                                    class="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md active:scale-95 btn-save-individual">
                                    儲存 🔗
                                </button>
                            </div>
                        `).join('')}
                    ` : '<div class="text-xs text-gray-300 italic">🔒 無權限管理此單元連結</div>'}
                </div>
            </div>
        </div>
    `;
}

window.renderGuideRow = window.renderGuideRow || function(courseId, fileName, tutorSegment, courseTitle, isAuthorized) {
    return `
        <div class="unit-guide-row bg-white rounded-3xl border border-gray-100 p-10 shadow-sm transition-all hover:shadow-md">
            ${isAuthorized ? `
                <div class="tutor-guide-content text-gray-800 leading-relaxed">
                    ${tutorSegment}
                </div>
            ` : `
                <div class="text-[10px] text-blue-500 font-bold uppercase mb-2 tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    ${escapeHtml(courseTitle)} / ${escapeHtml(fileName)}
                </div>
                <div class="text-sm text-gray-400 italic">🔒 僅限該單元之「合格導師」閱讀完整教學指引。</div>
            `}
        </div>
    `;
}

// Helper to split instructor guide into parts
window.robustExtractGuideSegments = window.robustExtractGuideSegments || function(tutorInput, assignmentInput = null) {
    console.log("[Debug] robustExtractGuideSegments init.",
        "Instructor type:", typeof tutorInput,
        "Assignment type:", typeof assignmentInput);

    const result = { header: '', segments: {}, footer: '', assignmentGuides: {} };

    // 1. Process Instructor Guides (Main segments)
    if (tutorInput && typeof tutorInput === 'object' && !Array.isArray(tutorInput)) {
        Object.entries(tutorInput).forEach(([fileName, content]) => {
            if (typeof content !== 'string') return;
            if (fileName.includes('-master-')) {
                result.footer += (result.footer ? "<hr>" : "") + content;
            } else {
                // [MODIFIED] No more legacy extraction. Use raw content.
                result.segments[fileName] = content;
            }
        });
    } else if (typeof tutorInput === 'string') {
        // [MODIFIED] Simplified fallback: treat as footer/header total if raw string
        result.footer = tutorInput;
    }

    // 2. Process Dedicated Assignment Guides
    if (assignmentInput && typeof assignmentInput === 'object' && !Array.isArray(assignmentInput)) {
        Object.entries(assignmentInput).forEach(([fileName, content]) => {
            if (typeof content !== 'string') return;
            result.assignmentGuides[fileName] = content;
            result.assignmentGuides[fileName.replace('.html', '')] = content;

            // Optional: Map numeric keys if the fileName follows a numeric pattern
            const numMatch = fileName.match(/^(?:basic-|adv-)?(\d+)-unit-/);
            if (numMatch) {
                const num = parseInt(numMatch[1]);
                result.assignmentGuides[num] = content;
            }
        });
    }

    // 3. Process Segment ID maps (Optional mapping for index fallbacks)
    Object.entries(result.segments).forEach(([fileName, content]) => {
        const numMatch = fileName.match(/^(?:basic-|adv-)?(\d+)-unit-/);
        if (numMatch) {
            const num = parseInt(numMatch[1]);
            result.segments[num] = content;
        }
    });

    return result;
}


/**
 * [V12.3.5] NEW: Renders a list of qualified tutors for a unit and their assignment count
 */


window.saveAllSettings = async function (clickedBtn = null) {
    const btns = clickedBtn ? [clickedBtn] : document.querySelectorAll('.btn-save-individual');

    const originalTexts = new Map();
    btns.forEach(btn => {
        originalTexts.set(btn, btn.textContent);
        btn.disabled = true;
        btn.textContent = "儲存中...";
    });

    const configsByCourse = {};

    // Collect data from DOM
    document.querySelectorAll('.unit-config-card').forEach(card => {
        const cid = card.dataset.courseId;
        const fname = card.dataset.fileName;

        if (!configsByCourse[cid]) configsByCourse[cid] = {};

        const tutorMap = {};
        card.querySelectorAll('.assignment-link-row').forEach(row => {
            const tid = row.querySelector('.assignment-id-input').value.trim();
            const url = row.querySelector('.assignment-url-input').value.trim();
            if (tid && url) {
                tutorMap[tid] = url;
            }
        });

        if (Object.keys(tutorMap).length > 0) {
            configsByCourse[cid][fname] = tutorMap;
        }
    });

    try {
        const saveTutorConfigs = httpsCallable(functions, 'saveTutorConfigs');
        const promises = Object.entries(configsByCourse).map(([cid, unitMap]) => {
            return saveTutorConfigs({
                courseId: cid,
                configs: { githubClassroomUrls: unitMap }
            });
        });

        await Promise.all(promises);
        alert("設定儲存成功！");
    } catch (e) {
        console.error("Save failed:", e);
        alert("儲存失敗: " + e.message);
    } finally {
        btns.forEach(btn => {
            btn.disabled = false;
            btn.textContent = originalTexts.get(btn) || "儲存變更";
        });
    }
}

// --- Global Function Exports : Esc Key handling ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 1. Close Modal if open
        const modal = document.getElementById('grading-modal');
        if (modal && !modal.classList.contains('hidden')) {
            window.closeGradingModal();
            return;
        }

        // 2. Clear filters if present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('courseId') || urlParams.get('unitId')) {
            console.log("[Esc] Redirecting to main dashboard...");
            window.location.href = 'dashboard.html';
        }
    }
});
// --- Earnings ---
window.renderEarningsTab = window.renderEarningsTab || function(data) {
    const totalEarningsEl = document.getElementById('stat-total-earnings');
    const promoCodeEl = document.getElementById('display-promo-code');
    const tableBody = document.getElementById('earnings-table-body');
    const inviteKitEl = document.getElementById('promo-invite-kit');

    if (!totalEarningsEl || !promoCodeEl || !tableBody || !inviteKitEl) return;

    // 1. Display Referral Link (Unit-Specific)
    const urlParams = new URLSearchParams(window.location.search);
    const filterUnitId = resolveCanonicalUnitId(urlParams.get('unitId'));
    const inviteKit = buildReferralInviteKit(filterUnitId, data.myReferralLink);

    if (!filterUnitId) {
        promoCodeEl.innerHTML = `
            <span class="text-gray-400 text-sm block mb-1">請先從上方切換單元</span>
            <span class="text-[10px] text-gray-300">每一單元皆有專屬作業連結</span>
        `;
    } else if (!data.myReferralLink) {
        promoCodeEl.innerHTML = `
            <span class="text-orange-400 text-sm block font-bold">尚未配置作業連結</span>
            <span class="text-[10px] text-gray-400">請聯繫管理員獲取該單元授權</span>
        `;
    } else {
        promoCodeEl.innerHTML = `
            <div class="flex flex-col items-center">
                <span class="text-xs font-mono text-blue-600 break-all max-w-[200px] text-center">${data.myReferralLink}</span>
                <span class="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">此單元教學作業連結 / Unit Link</span>
            </div>
        `;
    }

    if (!inviteKit.ready) {
        inviteKitEl.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                ${escapeHtml(inviteKit.message)}
            </div>
        `;
    } else {
        inviteKitEl.innerHTML = `
            <div class="space-y-6">
                <!-- Header -->
                <div class="border-b border-slate-100 pb-4">
                    <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-500">招生工具 / Invite Tools</p>
                    <h3 class="text-2xl font-black text-gray-900 mt-2">招生邀請工具包</h3>
                    <p class="text-sm text-gray-500 mt-2 leading-relaxed">學生掃描 QR Code 或點擊專屬連結後，系統會自動將課程加入購物車並連結您的教學作業權限。</p>
                </div>

                <!-- Main Layout Grid -->
                <div class="flex flex-col lg:flex-row gap-8 items-start">
                    
                    <!-- Left Column: QR & Primary Actions -->
                    <div class="lg:w-[320px] w-full flex flex-col gap-6 flex-shrink-0">
                        <!-- QR Code -->
                        <div class="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col items-center">
                            <img src="${escapeHtml(inviteKit.qrUrl)}" alt="Promo invite QR code" class="w-48 h-48 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                            <p class="text-[10px] text-gray-400 mt-4 text-center break-all font-mono max-w-full">${escapeHtml(inviteKit.inviteUrl)}</p>
                        </div>

                        <!-- Buttons (Moved from right to below QR) -->
                        <div class="flex flex-col gap-4">
                            <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <p class="text-[10px] text-blue-600 font-bold uppercase mb-2 tracking-widest">分銷連結 / Referral Link</p>
                                <button type="button" class="promo-copy-link w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition shadow-md active:scale-95">複製專屬連結</button>
                            </div>
                            <div class="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                                <p class="text-[10px] text-emerald-600 font-bold uppercase mb-2 tracking-widest">快速分享 / Quick Share</p>
                                <a href="${escapeHtml(inviteKit.mailtoUrl)}" class="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-md active:scale-95">按此發送郵件</a>
                            </div>
                        </div>

                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 italic">
                            💡 建議：您可以將 QR Code 下載後印在課程講義上，或直接將專屬連結貼到班級群組中。
                        </div>
                    </div>

                    <!-- Right Column: Registration Notice Letter -->
                    <div class="flex-grow w-full">
                        <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
                            <div class="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                                <p class="text-xs font-black uppercase tracking-[0.24em] text-indigo-500">標準文案 / Invite Notice</p>
                                <h4 class="text-xl font-black text-slate-900 mt-2">寄給學生的報名通知書</h4>
                                <p class="text-sm text-slate-500 mt-1 font-medium">複製下方文案並貼給學生，能提供最完整的報名指引。</p>
                            </div>
                            <div class="p-8 flex-grow">
                                <pre class="promo-invite-letter whitespace-pre-wrap break-words text-sm leading-8 text-slate-700 font-sans bg-slate-50 rounded-2xl p-6 border border-slate-100 h-full">${escapeHtml(inviteKit.letterText)}</pre>
                            </div>
                            <div class="px-8 pb-8 flex flex-col sm:flex-row gap-4 mt-auto">
                                <button type="button" class="promo-copy-letter flex-1 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 transition shadow-lg active:scale-95">複製完整通知書內容</button>
                                <button type="button" class="promo-copy-qr inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95">複製 QR 連結</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const copyLinkBtn = inviteKitEl.querySelector('.promo-copy-link');
        const copyLetterBtn = inviteKitEl.querySelector('.promo-copy-letter');
        const copyQrBtn = inviteKitEl.querySelector('.promo-copy-qr');

        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.inviteUrl, '已複製專屬報名連結'));
        }
        if (copyLetterBtn) {
            copyLetterBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.letterText, '已複製通知書內容'));
        }
        if (copyQrBtn) {
            copyQrBtn.addEventListener('click', () => copyTextToClipboard(inviteKit.qrUrl, '已複製 QR Code 圖片連結'));
        }
    }

    // 2. Display Earnings Ledger
    const earnings = data.earnings || [];
    let total = 0;

    if (earnings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-gray-400">尚無分潤紀錄</td></tr>';
    } else {
        tableBody.innerHTML = earnings.map(d => {
            total += d.shareAmount;
            return `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="py-3 px-2 font-medium">${d.month}</td>
                    <td class="py-3 px-2 text-gray-500 font-mono text-[10px]">${d.studentUid || '-'}</td>
                    <td class="py-3 px-2 text-right">NT$ ${d.orderAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right font-bold text-emerald-600">NT$ ${d.shareAmount.toLocaleString()}</td>
                    <td class="py-3 px-2 text-right text-gray-400 text-xs">${d.level === 0 ? '直接' : '第二層'}</td>
                </tr>
            `;
        }).join('');
    }

    totalEarningsEl.innerText = total.toLocaleString();
}

window.buildReferralInviteKit = window.buildReferralInviteKit || function(unitId, referralLink) {
    if (!unitId) {
        return { ready: false, message: '請先切換到特定課程單元，才能生成專屬招生邀請工具。' };
    }

    if (!referralLink) {
        return { ready: false, message: '此單元尚未配置作業連結，請先確認導師授權或聯繫管理員。' };
    }

    const canonicalUnitId = resolveCanonicalUnitId(unitId);
    const parentCourseId = findParentCourseIdByUnit(canonicalUnitId) || canonicalUnitId;
    const lesson = (allLessons || []).find(item => item.courseId === parentCourseId) ||
        (allLessons || []).find(item => Array.isArray(item.courseUnits) && item.courseUnits.includes(canonicalUnitId)) ||
        null;

    const courseId = lesson?.courseId || parentCourseId;
    const courseName = lesson?.title || lesson?.courseName || formatUnitName(parentCourseId);
    const unitName = formatUnitName(canonicalUnitId);
    const coursePrice = parseInt(lesson?.price ?? 0, 10) || 0;
    const isPhysical = lesson?.isPhysical === true;
    const tutorName = auth.currentUser?.displayName || myEmail || '授課老師';

    const inviteParams = new URLSearchParams({
        action: 'addInviteItem',
        courseId,
        unitId: canonicalUnitId,
        referralLink,
        courseName,
        coursePrice: String(coursePrice),
        isPhysical: String(isPhysical)
    });
    const inviteUrl = `${PUBLIC_SITE_URL}/cart.html?${inviteParams.toString()}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(inviteUrl)}`;

    const letterText =
`親愛的同學您好：

歡迎加入 Vibe Coding 的「${courseName}」課程學習。
本次邀請學習單元為：${unitName}

請直接點擊下方專屬報名連結，系統會自動：
1. 在 Shopping Cart 加入此課程項目
2. 綁定我的教學作業邀請權限
3. 引導您完成登入與結帳

專屬報名連結：
${inviteUrl}

若您使用手機，也可以直接掃描我提供的 QR Code。

完成付款後，系統會立即開通課程，並自動建立您與授課老師的輔導關係，之後作業批改與 GitHub Classroom assignment 也會依此關係運作。

如有任何問題，歡迎直接回覆我。

${tutorName}
Vibe Coding`;

    const mailtoSubject = `Vibe Coding 課程報名通知｜${courseName}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(letterText)}`;

    return {
        ready: true,
        inviteUrl,
        qrUrl,
        letterText,
        mailtoUrl
    };
}

window.buildPromoInviteKit = window.buildPromoInviteKit || window.buildReferralInviteKit;

async function copyTextToClipboard(text, successMessage = '已複製') {
    try {
        await navigator.clipboard.writeText(text);
        alert(successMessage);
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        alert('複製失敗，請手動複製內容。');
    }
}

window.handleDecideApplication = async function (applicationId, status) {
    // [MODIFIED] No more confirm dialog as per user request
    let adminMessage = "";
    if (status === 'rejected') {
        adminMessage = prompt("請輸入拒絕原因 (User 將會收到此訊息):") || "條件尚不完全相符，歡迎精進後再次嘗試。";
    }

    const msg = document.getElementById('admin-msg');
    if (msg) msg.textContent = "正在同步授權權限...";

    // Locally hide the item for instant feedback
    const appCards = document.querySelectorAll('#admin-panel .bg-white.p-4.rounded-xl');
    appCards.forEach(card => {
        if (card.outerHTML.includes(applicationId)) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }
    });

    try {
        const decideFunc = httpsCallable(functions, 'decideTutorApplication');
        const result = await decideFunc({ applicationId, status, adminMessage });
        
        if (result.data.success) {
            loadDashboard(); // Full refresh to update all lists
        }
    } catch (e) {
        console.error("Decision failed:", e);
        alert("處理失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }

};


// [CLEANUP] Deprecated legacy status renderers removed.

/**
 * [NEW] [V8.1] Fetches and parses Markdown content from a URL
 * Uses marked.js (included in dashboard.html)
 */
async function loadMarkdown(url) {
    try {
        console.log("[Markdown] Fetching from GitHub Raw:", url);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const text = await resp.text();
        
        if (typeof marked !== 'undefined') {
            // Using marked.parse() for safer rendering
            return marked.parse(text);
        } else {
            console.warn("[Markdown] marked.js not loaded, returning raw text.");
            return `<pre class="whitespace-pre-wrap">${text}</pre>`;
        }
    } catch (e) {
        console.error("[Markdown] Error loading or parsing:", e);
        return `<div class="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
            <h4 class="font-bold mb-1">無法讀取 GitHub README</h4>
            <p class="opacity-75">${e.message}</p>
        </div>`;
    }
}

window.handleMarkAsShipped = async function (orderId) {
    if (!orderId) return;
    if (!confirm(`確認將訂單 ${orderId} 標記為已出貨？\n這將停止提醒郵件並更新學生的狀態。`)) return;

    const msg = document.getElementById('admin-msg');
    try {
        if (msg) msg.textContent = "正在更新出貨狀態...";

        const markShippedFunc = httpsCallable(functions, 'markOrderShipped');
        await markShippedFunc({ orderId });

        alert("出貨狀態已更新！");
        await loadDashboard(); // Refresh UI
    } catch (e) {
        console.error("Mark Shipped Error:", e);
        alert("更新失敗: " + e.message);
    } finally {
        if (msg) msg.textContent = "";
    }
};
