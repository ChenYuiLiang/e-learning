import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
const db = getFirestore(app);

const NAV_STATE_VERSION = "2026.04.05.FINAL_V6";

// --- 1. Navigation Rendering Engine (Original Style) ---

window.toggleMobileMenu = function () {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    if (menu) {
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
            menu.classList.remove('hidden');
            if (btn) btn.innerHTML = '<svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        } else {
            menu.classList.add('hidden');
            if (btn) btn.innerHTML = '<svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
        }
    }
};

const handleMenuClick = (e) => {
    const btn = e.target.closest('#mobile-menu-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleMobileMenu();
        return;
    }

    // Auto-close mobile menu when a link is clicked
    const link = e.target.closest('#mobile-menu a');
    if (link) {
        window.toggleMobileMenu();
        return;
    }

    // Close mobile menu when clicking outside
    const menu = document.getElementById('mobile-menu');
    const isMenuOpen = menu && !menu.classList.contains('hidden');
    if (isMenuOpen && !e.target.closest('#main-nav')) {
        window.toggleMobileMenu();
    }
};

// Handle Escape key to close mobile menu
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('mobile-menu');
        if (menu && !menu.classList.contains('hidden')) {
            window.toggleMobileMenu();
        }
    }
});

document.addEventListener('click', handleMenuClick, true);


window.renderNav = function (rootPath = '.', options = {}) {
    const showAuth = options.showAuth || false;
    const brandSuffix = options.brandSuffix || '';
    const isFluid = options.isFluid !== undefined ? options.isFluid : true;

    const resolve = (path) => {
        if (path.startsWith('http')) return path;
        return `${rootPath}/${path}`.replace('./http', 'http').replace('//', '/');
    };

    // [Refactored] Use unique ID for style block to avoid duplicates
    let style = document.getElementById('nav-comp-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'nav-comp-styles';
        style.innerHTML = `
            @media (hover: hover) { 
                .dropdown:hover .dropdown-menu { display: block; } 
            }
            /* [A11y] Focus-within support for keyboard users */
            .dropdown:focus-within .dropdown-menu { display: block; }
            
            #mobile-menu { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: top; }
            #mobile-menu-btn { cursor: pointer; touch-action: manipulation; }
            #mobile-menu.hidden { display: none !important; opacity: 0; transform: scaleY(0.95); }
            #mobile-menu:not(.hidden) { display: block !important; opacity: 1; transform: scaleY(1); }
            
            /* Focus ring for better visibility */
            .dropdown button:focus { outline: 2px solid #06b6d4; border-radius: 0.5rem; }
        `;
        document.head.appendChild(style);
    }

    // [New] Inject FontAwesome for global icon support
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        document.head.appendChild(fa);
    }

    const navHTML = `
    <nav class="bg-white/90 backdrop-blur-md shadow-md w-full sticky top-0 z-[99999]" id="main-nav">
        <div class="${isFluid ? 'w-full px-6' : 'container mx-auto px-4'}">
            <div class="flex justify-between items-center py-4">
                <a href="${resolve('index.html')}"
                    class="text-2xl font-extrabold text-blue-900 tracking-tight flex items-center gap-2">
                    <span>🚀</span> Vibe Coding ${brandSuffix ? `<span class="text-sm font-normal text-gray-500 ml-2">${brandSuffix}</span>` : ''}
                </a>
                <div class="flex items-center gap-6">
                    <div class="hidden md:flex items-center space-x-6 font-medium text-gray-600">
                        <!-- Courses Dropdown -->
                        <div class="relative dropdown group">
                            <button class="flex items-center hover:text-cyan-600 transition-all cursor-pointer py-2 gap-1 group-hover:text-cyan-600">
                                學習路徑 <svg class="w-4 h-4 opacity-50 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden group-hover:block bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-3 w-56 mt-0 border border-slate-100 left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                <a href="${resolve('prepare.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                    <i class="fa-solid fa-book-open text-xs opacity-40"></i> 課前準備
                                </a>
                                <a href="${resolve('started.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                    <i class="fa-solid fa-rocket text-xs opacity-40"></i> 入門課程
                                </a>
                                <a href="${resolve('basic.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                    <i class="fa-solid fa-code text-xs opacity-40"></i> 基礎實作
                                </a>
                                <a href="${resolve('advanced.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                    <i class="fa-solid fa-microchip text-xs opacity-40"></i> 進階應用
                                </a>
                            </div>
                        </div>

                        <!-- Support Dropdown -->
                        <div class="relative dropdown group">
                            <button class="flex items-center text-cyan-600 font-bold transition-all cursor-pointer py-2 gap-1">
                                支援與合作 <svg class="w-4 h-4 opacity-50 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            <div class="dropdown-menu absolute hidden group-hover:block bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-3 w-64 mt-0 border border-slate-100 left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                                <a href="${resolve('students.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-50 hover:text-cyan-700 transition-colors">
                                    <i class="fa-solid fa-graduation-cap text-xs opacity-40"></i> 課程購買與使用指南
                                </a>
                                <a href="${resolve('tutors.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-50 hover:text-cyan-700 transition-colors">
                                    <i class="fa-solid fa-handshake text-xs opacity-40"></i> 專業導師與合作洽談
                                </a>
                                <div class="my-2 border-t border-slate-50"></div>
                                <a href="${resolve('examples/index.html')}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                                    <i class="fa-solid fa-display text-xs opacity-40"></i> 範例展示參考
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        ${showAuth ? `
                        <div class="flex items-center space-x-4">
                            <a href="${resolve('cart.html')}" class="text-gray-600 hover:text-cyan-600 transition duration-150 relative" title="前往購物車">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.2 4h12.4M15 13H7" />
                                </svg>
                            </a>
                            <div id="auth-status" class="text-sm flex items-center">
                                <span id="user-display" class="text-gray-600 hidden md:inline mr-2">訪客</span>
                                <button id="login-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-full transition shadow-md">登入</button>
                            </div>
                        </div>` : ''}
                        <div class="md:hidden z-[99999]" style="position: relative;">
                            <button id="mobile-menu-btn" type="button" class="text-gray-600 focus:outline-none p-2 border rounded hover:bg-gray-100">
                                <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="mobile-menu" class="hidden md:hidden pb-8 border-t border-slate-100 mt-0 absolute w-full left-0 bg-white/95 backdrop-blur-lg shadow-2xl z-[9998] px-6 max-h-[85vh] overflow-y-auto">
                <div class="flex flex-col space-y-6 pt-6 font-medium text-slate-600">
                    
                    <!-- Mobile Auth Section -->
                    ${showAuth ? `
                    <div id="mobile-auth-section" class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <i class="fa-solid fa-user"></i>
                            </div>
                            <div>
                                <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">目前狀態</p>
                                <span id="mobile-user-display" class="text-sm font-bold text-slate-700">訪客</span>
                            </div>
                        </div>
                        <button id="mobile-login-btn" class="px-5 py-2 bg-indigo-600 text-white text-sm rounded-xl font-bold shadow-sm active:scale-95 transition-transform">登入</button>
                    </div>` : ''}

                    <!-- Courses Section -->
                    <div class="space-y-3">
                        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">學習路徑</span>
                        <div class="grid grid-cols-2 gap-3">
                            <a href="${resolve('prepare.html')}" class="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 text-sm">
                                <i class="fa-solid fa-book-open text-xs opacity-50"></i> 課前準備
                            </a>
                            <a href="${resolve('started.html')}" class="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 text-sm">
                                <i class="fa-solid fa-rocket text-xs opacity-50"></i> 入門課程
                            </a>
                            <a href="${resolve('basic.html')}" class="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 text-sm">
                                <i class="fa-solid fa-code text-xs opacity-50"></i> 基礎實作
                            </a>
                            <a href="${resolve('advanced.html')}" class="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100 text-sm">
                                <i class="fa-solid fa-microchip text-xs opacity-50"></i> 進階應用
                            </a>
                        </div>
                    </div>

                    <!-- Support Section -->
                    <div class="space-y-3 pb-4">
                        <span class="text-[11px] font-bold text-cyan-500 uppercase tracking-[0.2em] px-1">支援與合作</span>
                        <div class="flex flex-col gap-2">
                            <a href="${resolve('students.html')}" class="flex items-center justify-between py-3.5 px-5 bg-cyan-50/50 border border-cyan-100 rounded-2xl hover:bg-cyan-100 hover:text-cyan-700 transition-all group">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-graduation-cap text-cyan-600"></i>
                                    <span class="text-sm font-bold text-cyan-900">課程購買與使用指南</span>
                                </div>
                                <i class="fa-solid fa-chevron-right text-xs opacity-30 group-hover:translate-x-1 transition-transform"></i>
                            </a>
                            <a href="${resolve('tutors.html')}" class="flex items-center justify-between py-3.5 px-5 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-700 transition-all group">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-handshake text-indigo-600"></i>
                                    <span class="text-sm font-bold text-indigo-900">專業導師與合作洽談</span>
                                </div>
                                <i class="fa-solid fa-chevron-right text-xs opacity-30 group-hover:translate-x-1 transition-transform"></i>
                            </a>
                            <a href="${resolve('examples/index.html')}" class="flex items-center justify-between py-3.5 px-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 hover:text-slate-700 transition-all group">
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid fa-display text-slate-500"></i>
                                    <span class="text-sm font-bold text-slate-700">範例展示參考</span>
                                </div>
                                <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-30 group-hover:translate-x-0.5 transition-transform"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.innerHTML = navHTML;
    } else {
        const existingNav = document.getElementById('main-nav') || document.querySelector('nav');
        if (existingNav) { 
            // If we already have a nav, replace its content or outer
            existingNav.outerHTML = navHTML; 
        }
        else { document.body.insertAdjacentHTML('afterbegin', navHTML); }
    }

    setTimeout(() => {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('nav a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript') || href === '#') return;
            const isMatch = (href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) || (href !== '/' && currentPath.includes(href));
            if (isMatch) {
                link.classList.add('text-cyan-600', 'font-bold');
                link.classList.remove('text-gray-600');
            }
        });
    }, 0);
};

// --- 2. Dashboard Modal logic (From original master-nav.js) ---

function injectDashboardModal() {
    if (document.getElementById('dashboard-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.className = 'fixed inset-0 bg-black/60 hidden flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300';
    modal.style.zIndex = '10000000';
    modal.innerHTML = `
        <div class="bg-white w-full h-full max-w-7xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col transform scale-100 transition-transform">
            <div class="flex justify-between items-center p-4 border-b bg-gray-50/80 backdrop-blur">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">📊</span>
                    <h3 class="text-lg font-bold text-gray-800">儀表板 (Dashboard)</h3>
                </div>
                <button onclick="closeDashboardModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="flex-grow relative bg-gray-100">
                <div id="dashboard-loading" class="absolute inset-0 flex items-center justify-center z-10 bg-white/50">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
                <iframe id="dashboard-frame" class="w-full h-full border-0" src="" onload="document.getElementById('dashboard-loading').classList.add('hidden')"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.openDashboardModal = function (courseParam) {
    injectDashboardModal();
    const modal = document.getElementById('dashboard-modal');
    const frame = document.getElementById('dashboard-frame');
    const loader = document.getElementById('dashboard-loading');
    let separator = courseParam.includes('?') ? '&' : '?';

    let finalUnitId = '';
    const iframe = document.getElementById('content-frame');
    if (iframe && iframe.src) {
        try {
            const absoluteSrc = new URL(iframe.src, window.location.href).href;
            finalUnitId = absoluteSrc.split('/').pop().split('?')[0].split('#')[0];
        } catch (e) { finalUnitId = iframe.src.split('/').pop().split('?')[0].split('#')[0]; }
    }
    if (!finalUnitId) { finalUnitId = window.location.pathname.split('/').pop().split('#')[0]; }

    const unitParam = finalUnitId ? `&unitId=${finalUnitId}` : '';
    let url = `/dashboard.html${courseParam}${separator}mode=iframe${unitParam}`;

    frame.src = url;
    loader.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    if (modal.requestFullscreen) modal.requestFullscreen();
    else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();

    const nav = document.getElementById('main-nav') || document.querySelector('nav');
    if (nav) nav.style.setProperty('display', 'none', 'important');
};

window.closeDashboardModal = function () {
    const modal = document.getElementById('dashboard-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        const nav = document.getElementById('main-nav') || document.querySelector('nav');
        if (nav) nav.style.display = '';
        setTimeout(() => { document.getElementById('dashboard-frame').src = ''; }, 300);
    }
    document.body.style.overflow = '';
};

// Sync Modal state with Native Fullscreen Exit
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const modal = document.getElementById('dashboard-modal');
        if (modal && !modal.classList.contains('hidden')) { closeDashboardModal(); }
    }
});

function injectDashboardFAB() {
    const existing = document.getElementById('dashboard-fab');
    if (existing) existing.remove();
    injectDashboardModal();

    const path = decodeURIComponent(window.location.pathname);
    const filename = path.split('/').pop();

    // Rule: ONLY show on Course Units (filenames containing 'unit-' or 'master-')
    const isCourseUnit = filename.includes('unit-') || filename.includes('master-');
    if (!isCourseUnit) return;

    let courseParam = '';
    if (filename) {
        let idPrefix = null;
        if (filename.includes('-unit')) { idPrefix = filename.split('-unit')[0]; }
        else if (filename.includes('-master')) { idPrefix = filename.split('-master')[0]; }
        else {
            const match = filename.match(/^([a-zA-Z0-9]+-\d+|\d+)-/);
            if (match) idPrefix = match[1];
        }
        if (idPrefix) { courseParam = `?courseId=${idPrefix}`; }
    }

    const fab = document.createElement('button');
    fab.id = 'dashboard-fab';
    fab.className = 'fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group z-50';
    fab.style.zIndex = '9999';
    fab.innerHTML = `
        <span class="text-3xl group-hover:rotate-12 transition-transform">📊</span>
        <span class="absolute right-full mr-4 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
            查看儀表板
        </span>
    `;
    fab.onclick = function () { openDashboardModal(courseParam); };
    document.body.appendChild(fab);
}

// --- 3. Initializer Bootloader (SAFE RENDER) ---

function initNavComponent() {
    const placeholder = document.getElementById('nav-placeholder');
    const root = placeholder ? (placeholder.getAttribute('data-root') || '.') : '/';
    const showAuth = placeholder ? (placeholder.getAttribute('data-show-auth') === 'true') : false;

    if (placeholder) {
        // We'll manage sticky behavior on the nav element itself for better control
        placeholder.classList.remove('sticky', 'top-0', 'z-[99999]');
    }
    window.renderNav(root, { showAuth });

    try {
        if (document.body) { injectDashboardFAB(); }
        else { document.addEventListener('DOMContentLoaded', injectDashboardFAB); }
    } catch (e) { console.error("[NavComp] FAB failed:", e); }

    onAuthStateChanged(auth, async (user) => {
        const desktopUser = document.getElementById('user-display');
        const desktopLogin = document.getElementById('login-btn');
        const mobileUser = document.getElementById('mobile-user-display');
        const mobileLogin = document.getElementById('mobile-login-btn');

        const updateUI = (userDisplay, loginBtn) => {
            if (!userDisplay || !loginBtn) return;
            if (user) {
                userDisplay.innerText = user.email.split('@')[0];
                userDisplay.classList.remove('hidden');
                loginBtn.innerText = '登出';
                loginBtn.onclick = () => auth.signOut();
            } else {
                userDisplay.innerText = '訪客';
                // [Fix] Desktop user display usually has 'hidden md:inline' classes,
                // while mobile usually doesn't. We should respect the desktop-only hidden rule.
                if (userDisplay.id === 'user-display') {
                    userDisplay.classList.add('hidden');
                } else {
                    userDisplay.classList.remove('hidden');
                }
                loginBtn.innerText = '登入';
                loginBtn.onclick = () => {
                    const root = placeholder ? (placeholder.getAttribute('data-root') || '.') : '.';
                    window.location.href = `${root}/login.html`.replace('//', '/');
                };
            }
        };

        updateUI(desktopUser, desktopLogin);
        updateUI(mobileUser, mobileLogin);
    });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initNavComponent); }
else { initNavComponent(); }
