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
function patchAppHomeLinks() {
    try {
        const home = `${window.location.origin}/index.html`;
        document.querySelectorAll('a.brand').forEach((a) => {
            const href = (a.getAttribute('href') || '').trim();
            if (href === '/' || href === '' || href === '#') {
                a.setAttribute('href', home);
            }
        });
    } catch (e) {
        console.warn('[CourseShared] patchAppHomeLinks failed:', e);
    }
}

function init() {
    console.log("[CourseShared] Initializing...");
    patchAppHomeLinks();
    enhanceMasterUnitTabsToFastTab();
    applyHideTabsPreference();
    upgradeLegacyStartUnitToMsLayout();
    applyStartUnitModernTheme();
    injectMediaOverlay();
    initAnimations();
    enhanceAssignmentEntryButtons();
    initFirebaseFeatures(); // [NEW] Start Firebase (Tracking + Assignments)
    initGithubReadme(); // [V8.2] Fetch and render GitHub README if applicable
}

/**
 * Master page FastTab (BC-like):
 * - Each unit row is collapsible (> / V)
 * - Each row can expand independently
 * - Expanded row shows that unit's browse list
 */
function enhanceMasterUnitTabsToFastTab() {
    try {
        const pathname = (window.location.pathname || '').toLowerCase();
        const file = pathname.split('/').pop() || '';
        const masterMatch = file.match(/^(start|basic|adv)-(\d{2})-master-.*\.html$/);
        if (!masterMatch) return;
        const track = masterMatch[1];
        const lessonNo = masterMatch[2];

        const unitTabsWrapper = document.querySelector('.unit-tabs-wrapper');
        const tabsFlex = document.getElementById('course-tabs-container');
        if (!unitTabsWrapper || !tabsFlex) return;
        if (document.querySelector('.fasttab-course-layout')) return;

        const contentArea = unitTabsWrapper.nextElementSibling;
        const buttons = Array.from(tabsFlex.querySelectorAll('.unit-tab-btn'));
        if (buttons.length === 0) return;

        const tabUrlMap = {};
        const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
        const branchRegex = /(if|else if)\s*\(tab\s*===\s*'([^']+)'\)\s*\{[\s\S]*?url\s*=\s*'([^']+)'/g;
        let m;
        while ((m = branchRegex.exec(scripts)) !== null) {
            tabUrlMap[m[2]] = m[3];
        }
        // Support direct call style inside branch:
        // if (tab === 'foo') { ... loadContent('bar.html'); ... }
        const directLoadRegex = /(if|else if)\s*\(tab\s*===\s*'([^']+)'\)\s*\{[\s\S]*?loadContent\(\s*'([^']+)'\s*\)/g;
        while ((m = directLoadRegex.exec(scripts)) !== null) {
            if (!tabUrlMap[m[2]]) tabUrlMap[m[2]] = m[3];
        }
        // Support object-map style, e.g. const tabs = { unit1: { id:'tab-unit1', url:'xxx.html' } }
        const objectMapRegex = /([a-zA-Z0-9_-]+)\s*:\s*\{\s*id:\s*'[^']+'\s*,\s*url:\s*'([^']+)'/g;
        while ((m = objectMapRegex.exec(scripts)) !== null) {
            if (!tabUrlMap[m[1]]) tabUrlMap[m[1]] = m[2];
        }
        // Support plain file map style, e.g. const files = { 'data-flow': 'adv-15-unit-data-flow.html' }
        const plainFileMapRegex = /['"]([a-zA-Z0-9_-]+)['"]\s*:\s*['"]([^'"]+\.html)['"]/g;
        while ((m = plainFileMapRegex.exec(scripts)) !== null) {
            if (!tabUrlMap[m[1]]) tabUrlMap[m[1]] = m[2];
        }

        const layout = document.createElement('section');
        layout.className = 'fasttab-course-layout';
        const list = document.createElement('div');
        list.className = 'fasttab-list';

        const getTabKey = (btn) => {
            const onclick = btn.getAttribute('onclick') || '';
            const mm = onclick.match(/switchTab\('([^']+)'\)/);
            return mm ? mm[1] : '';
        };

        const extractSidebarDataFromHtml = (htmlText) => {
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            const moduleTitle = (doc.querySelector('#page-index h1')?.textContent || '').trim();
            const moduleMeta = (doc.querySelector('.ms-sidebar-header .meta')?.textContent || '').trim().replace(/\s+/g, ' ');

            const unitData = [];
            const unitDataBlock = htmlText.match(/const\s+(?:unitData|UNITS)\s*=\s*\[([\s\S]*?)\];/);
            if (unitDataBlock && unitDataBlock[1]) {
                // Parse object entries robustly regardless of spacing/line breaks.
                const entryRegex = /id:\s*(\d+)\s*,\s*label:\s*'([^']+)'\s*,\s*time:\s*'([^']*)'\s*,\s*type:\s*'([^']+)'/g;
                let m;
                while ((m = entryRegex.exec(unitDataBlock[1])) !== null) {
                    const id = Number(m[1]);
                    if (id === 0) continue; // Skip index entry
                    unitData.push({
                        label: (m[2] || '').trim(),
                        time: (m[3] || '').trim(),
                        type: (m[4] || 'unit').trim()
                    });
                }

                // Fallback for files where key order may differ.
                if (unitData.length === 0) {
                    const objRegex = /\{[\s\S]*?\}/g;
                    let o;
                    while ((o = objRegex.exec(unitDataBlock[1])) !== null) {
                        const objText = o[0];
                        const idRaw = (objText.match(/id:\s*(\d+)/) || [])[1];
                        const id = Number(idRaw);
                        if (!Number.isNaN(id) && id === 0) continue;
                        const label = (objText.match(/label:\s*'([^']+)'/) || [])[1];
                        const time = (objText.match(/time:\s*'([^']*)'/) || [])[1] || '';
                        const type = (objText.match(/type:\s*'([^']+)'/) || [])[1] || 'unit';
                        if (!label) continue;
                        unitData.push({ label, time, type });
                    }
                }
            }

            return {
                moduleTitle: moduleTitle || '課程總覽',
                moduleMeta: moduleMeta || '',
                units: unitData
            };
        };

        const renderSubList = async (itemEl, btn) => {
            const panel = itemEl.querySelector('.fasttab-children');
            if (!panel) return;
            if (panel.dataset.loaded === '1') return;

            const tabKey = getTabKey(btn);
            const unitUrl = tabUrlMap[tabKey];
            let sidebarData = null;
            if (unitUrl) {
                try {
                    const sep = unitUrl.includes('?') ? '&' : '?';
                    const qs = window.location.search ? window.location.search.substring(1) : '';
                    const requestUrl = qs ? `${unitUrl}${sep}${qs}` : unitUrl;
                    const res = await fetch(requestUrl, { credentials: 'same-origin' });
                    if (res.ok) {
                        const html = await res.text();
                        sidebarData = extractSidebarDataFromHtml(html);
                    }
                } catch (err) {
                    console.warn('[CourseShared] FastTab fetch sublist failed:', err);
                }
            }
            // Fallback: if current iframe already loaded this unit, parse directly from iframe document.
            if (!sidebarData || !Array.isArray(sidebarData.units) || sidebarData.units.length === 0) {
                const frame = document.getElementById('content-frame');
                try {
                    if (frame && frame.contentWindow && frame.contentWindow.location) {
                        const current = String(frame.contentWindow.location.pathname || '');
                        if (unitUrl && current.endsWith(unitUrl)) {
                            const iframeDoc = frame.contentDocument;
                            if (iframeDoc) {
                                sidebarData = extractSidebarDataFromHtml(iframeDoc.documentElement.outerHTML);
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[CourseShared] FastTab iframe fallback parse failed:', err);
                }
            }
            if (!sidebarData) {
                sidebarData = { moduleTitle: '課程總覽', moduleMeta: '', units: [] };
            }
            if (!Array.isArray(sidebarData.units) || sidebarData.units.length === 0) {
                sidebarData.units = [
                    { label: '簡介', time: '', type: 'unit' },
                    { label: '重點整理', time: '', type: 'unit' },
                    { label: '摘要與資源', time: '', type: 'unit' }
                ];
            }

            const unitRows = sidebarData.units.map((u, idx) => {
                const typeTag = u.type === 'lab'
                    ? '<span class="fasttab-unit-tag lab">LAB</span>'
                    : (u.type === 'quiz' ? '<span class="fasttab-unit-tag quiz">測驗</span>' : '');
                const timeText = u.time ? `<div class="fasttab-unit-time"><i class="far fa-clock"></i> ${u.time}</div>` : '';
                return `
                    <button type="button" class="fasttab-unit-row" data-unit-id="${idx + 1}">
                        <div class="fasttab-unit-index">${idx + 1}</div>
                        <div class="fasttab-unit-main">
                            <div class="fasttab-unit-label">${u.label} ${typeTag}</div>
                            ${timeText}
                        </div>
                    </button>
                `;
            }).join('');

            panel.innerHTML = `
                <div class="fasttab-overview-card">
                    <div class="fasttab-overview-head">
                        <div class="fasttab-overview-title">${sidebarData.moduleTitle}</div>
                        ${sidebarData.moduleMeta ? `<div class="fasttab-overview-meta">${sidebarData.moduleMeta}</div>` : ''}
                    </div>
                    <div class="fasttab-overview-section">課程總覽</div>
                    <div class="fasttab-unit-rows">${unitRows}</div>
                    <div class="fasttab-progress-wrap">
                        <div class="fasttab-progress-bar"><div class="fasttab-progress-fill" style="width:0%"></div></div>
                        <div class="fasttab-progress-text">0 / ${sidebarData.units.length} 已完成</div>
                    </div>
                </div>
            `;

            // Make each row a real link-like action to iframe unit pages.
            const frame = document.getElementById('content-frame');
            panel.querySelectorAll('.fasttab-unit-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const unitId = Number(row.getAttribute('data-unit-id') || '0');
                    if (!unitId || !frame) return;
                    try {
                        if (frame.contentWindow && typeof frame.contentWindow.goToUnit === 'function') {
                            frame.contentWindow.goToUnit(unitId);
                        }
                    } catch (err) {
                        console.warn('[CourseShared] FastTab unit link failed:', err);
                    }
                });
            });
            panel.dataset.loaded = '1';
        };

        buttons.forEach((btn) => {
            const emojiSpan = btn.querySelector('span');
            const emoji = emojiSpan ? (emojiSpan.textContent || '').trim() : '';
            const fullText = (btn.textContent || '').trim().replace(/\s+/g, ' ');
            const labelText = emoji ? fullText.replace(emoji, '').trim() : fullText;

            btn.classList.add('fasttab-strip');
            btn.type = 'button';
            btn.innerHTML = `
                <span class="fasttab-chevron" aria-hidden="true">></span>
                <span class="fasttab-title">${labelText}</span>
            `;

            const tabKey = getTabKey(btn);

            const item = document.createElement('section');
            item.className = 'fasttab-item';
            item.dataset.tabKey = tabKey || '';
            item.appendChild(btn);

            const children = document.createElement('div');
            children.className = 'fasttab-children';
            children.dataset.loaded = '0';
            item.appendChild(children);

            btn.addEventListener('click', async () => {
                const wasOpen = item.classList.contains('is-open');
                const open = item.classList.toggle('is-open');
                btn.querySelector('.fasttab-chevron').textContent = open ? 'V' : '>';
                if (open && !wasOpen) {
                    activateFastTabModule(tabKey, tabUrlMap, item, btn, layout);
                    await renderSubList(item, btn);
                }
            });

            list.appendChild(item);
        });

        layout.appendChild(list);

        if (contentArea) {
            contentArea.classList.add('fasttab-main-content');
            layout.appendChild(contentArea);
        }

        unitTabsWrapper.replaceWith(layout);

        // Full-width top blue bar above FastTab area.
        if (!document.querySelector('.fasttab-master-topbar')) {
            const titleClean = (document.title || '')
                .replace(/\s*-\s*Vibe Coding\s*$/i, '')
                .trim();
            const trackLabel = track === 'adv' ? '進階' : (track === 'basic' ? '基礎' : '入門');
            const listHref = track === 'adv' ? '/advanced.html' : (track === 'basic' ? '/basic.html' : '/start.html');
            const listLabel = track === 'adv' ? '進階課程' : (track === 'basic' ? '基礎課程' : '入門課程');
            const courseTitle = titleClean ? `${trackLabel} ${lessonNo}：${titleClean}` : `${trackLabel} ${lessonNo}`;
            const topbar = document.createElement('nav');
            topbar.className = 'fasttab-master-topbar';
            const homeUrl = `${window.location.origin}/index.html`;
            topbar.innerHTML = `
                <a href="${homeUrl}" class="brand"><i class="fas fa-rocket"></i> Vibe Coding</a>
                <div class="divider"></div>
                <a href="${listHref}" class="nav-label-link">${listLabel}</a>
                <div class="divider divider-soft"></div>
                <div class="course-name-dropdown">
                    <button type="button" class="course-name-trigger" aria-haspopup="true" aria-expanded="false">
                        <span class="course-name-text">${courseTitle}</span>
                        <svg class="course-name-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div class="course-name-menu" role="menu" hidden></div>
                </div>
            `;
            document.body.insertBefore(topbar, layout);
        }

        bindCourseNameDropdown(document.querySelector('.fasttab-master-topbar'), layout, tabUrlMap, renderSubList);
        bindMobileFastTabNav(layout, document.querySelector('.fasttab-master-topbar'));

        // Hide duplicated topnav/sidebar inside iframe for start/basic master pages.
        const iframe = document.getElementById('content-frame');
        if (iframe && !iframe.dataset.fasttabIframePatchBound) {
            iframe.dataset.fasttabIframePatchBound = '1';
            const patchIframeLayout = () => {
                try {
                    const doc = iframe.contentDocument;
                    if (!doc || doc.getElementById('fasttab-iframe-hide-sidebar')) return;
                    const style = doc.createElement('style');
                    style.id = 'fasttab-iframe-hide-sidebar';
                    style.textContent = `
                        .ms-topnav { display: none !important; }
                        .ms-layout { display: block !important; }
                        .ms-sidebar { display: none !important; }
                        .ms-content { width: 100% !important; max-width: none !important; }
                        .unit-content { max-width: 980px !important; margin: 0 auto !important; }
                    `;
                    doc.head.appendChild(style);
                    const home = `${window.location.origin}/index.html`;
                    doc.querySelectorAll('a.brand').forEach((a) => {
                        const href = (a.getAttribute('href') || '').trim();
                        if (href === '/' || href === '' || href === '#') {
                            a.setAttribute('href', home);
                        }
                    });
                } catch (err) {
                    console.warn('[CourseShared] fasttab iframe layout patch failed:', err);
                }
            };
            iframe.addEventListener('load', patchIframeLayout);
            setTimeout(patchIframeLayout, 0);
        }
    } catch (e) {
        console.warn('[CourseShared] enhanceMasterUnitTabsToFastTab failed:', e);
    }
}

function activateFastTabModule(tabKey, tabUrlMap, targetItem, targetBtn, layout) {
    if (tabKey && typeof window.switchTab === 'function') {
        window.switchTab(tabKey);
    } else {
        const unitUrl = tabUrlMap[tabKey];
        if (unitUrl && typeof window.loadContent === 'function') {
            window.loadContent(unitUrl);
        }
    }

    if (layout) {
        layout.querySelectorAll('.fasttab-item.is-open').forEach((el) => {
            if (el !== targetItem) {
                el.classList.remove('is-open');
                const chev = el.querySelector('.fasttab-chevron');
                if (chev) chev.textContent = '>';
            }
        });
    }

    if (targetItem && !targetItem.classList.contains('is-open')) {
        targetItem.classList.add('is-open');
        const chev = targetBtn?.querySelector('.fasttab-chevron');
        if (chev) chev.textContent = 'V';
    }

    syncCourseNameDropdownActive(tabKey, tabUrlMap);
}

function syncCourseNameDropdownActive(tabKey, tabUrlMap) {
    const dropdown = document.querySelector('.course-name-dropdown');
    if (!dropdown) return;

    const frame = document.getElementById('content-frame');
    let activeKey = tabKey || '';
    if (!activeKey && frame?.src) {
        try {
            const currentFile = new URL(frame.src, window.location.href).pathname.split('/').pop() || '';
            activeKey = Object.keys(tabUrlMap || {}).find((key) => tabUrlMap[key] === currentFile) || '';
        } catch (e) {
            activeKey = '';
        }
    }

    dropdown.querySelectorAll('.course-name-menu-item').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.tabKey === activeKey);
    });
}

/** 頂列課程名稱下拉：快速切換同課程內的模組單元 */
function bindCourseNameDropdown(topbar, layout, tabUrlMap, renderSubList) {
    if (!topbar || !layout || topbar.dataset.courseDropdownBound === '1') return;
    const dropdown = topbar.querySelector('.course-name-dropdown');
    const trigger = topbar.querySelector('.course-name-trigger');
    const menu = topbar.querySelector('.course-name-menu');
    if (!dropdown || !trigger || !menu) return;
    topbar.dataset.courseDropdownBound = '1';

    let ignoreOutsideClickUntil = 0;

    const closeMenu = () => {
        dropdown.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        const backdrop = topbar.querySelector('.course-name-menu-backdrop');
        if (backdrop) backdrop.classList.remove('is-visible');
    };

    const openMenu = () => {
        dropdown.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
        ignoreOutsideClickUntil = Date.now() + 350;
        const backdrop = topbar.querySelector('.course-name-menu-backdrop');
        if (backdrop) backdrop.classList.add('is-visible');
    };

    if (!topbar.querySelector('.course-name-menu-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.className = 'course-name-menu-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.addEventListener('click', closeMenu);
        topbar.appendChild(backdrop);
    }

    layout.querySelectorAll('.fasttab-item').forEach((itemEl) => {
        const btn = itemEl.querySelector('.fasttab-strip');
        if (!btn) return;
        const tabKey = itemEl.dataset.tabKey || '';
        const title = btn.querySelector('.fasttab-title')?.textContent?.trim() || '課程單元';

        const menuItem = document.createElement('button');
        menuItem.type = 'button';
        menuItem.className = 'course-name-menu-item';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.dataset.tabKey = tabKey;
        menuItem.textContent = title;
        menuItem.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
            activateFastTabModule(tabKey, tabUrlMap, itemEl, btn, layout);
            if (typeof renderSubList === 'function') {
                await renderSubList(itemEl, btn);
            }
            if (window.innerWidth <= 768) {
                layout.classList.remove('fasttab-nav-open');
            }
        });
        menu.appendChild(menuItem);
    });

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropdown.classList.contains('is-open')) closeMenu();
        else openMenu();
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.classList.contains('is-open')) return;
        if (Date.now() < ignoreOutsideClickUntil) return;
        if (!dropdown.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    const frame = document.getElementById('content-frame');
    if (frame && !frame.dataset.courseDropdownSyncBound) {
        frame.dataset.courseDropdownSyncBound = '1';
        frame.addEventListener('load', () => syncCourseNameDropdownActive('', tabUrlMap));
        syncCourseNameDropdownActive('', tabUrlMap);
    }
}

/** 手機版：預設隱藏 FastTab 左欄，與準備課程一致；頂列選單可開啟 */
function bindMobileFastTabNav(layout, topbar) {
    if (!layout || layout.dataset.mobileNavBound === '1') return;
    layout.dataset.mobileNavBound = '1';

    const backdrop = document.createElement('div');
    backdrop.className = 'fasttab-nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    layout.appendChild(backdrop);

    const closeNav = () => {
        layout.classList.remove('fasttab-nav-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    };
    const openNav = () => {
        if (window.innerWidth > 768) return;
        layout.classList.add('fasttab-nav-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
    };

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fasttab-nav-toggle';
    toggle.setAttribute('aria-label', '開啟課程單元清單');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '☰';
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (layout.classList.contains('fasttab-nav-open')) closeNav();
        else openNav();
    });
    backdrop.addEventListener('click', closeNav);

    if (topbar) {
        topbar.appendChild(toggle);
    } else {
        layout.insertBefore(toggle, layout.firstChild);
    }

    layout.querySelectorAll('.fasttab-unit-row').forEach((row) => {
        row.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeNav();
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeNav();
    });
}

function upgradeLegacyStartUnitToMsLayout() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!/^start-\d{2}-unit-.*\.html$/.test(file)) return;
        if (document.querySelector('.ms-layout')) return;

        const legacyMain = document.querySelector('main');
        const legacySections = legacyMain ? Array.from(legacyMain.querySelectorAll('.module-section')) : [];
        if (!legacyMain || legacySections.length === 0) return;

        const pageTitle = (document.querySelector('header h1')?.textContent || document.title || '課程單元').trim();
        const pageSubtitle = (document.querySelector('header p')?.textContent || '').trim();

        const topNav = document.createElement('nav');
        topNav.className = 'ms-topnav';
        topNav.innerHTML = `
            <a href="#" class="brand"><i class="fas fa-graduation-cap"></i> Vibe Coding Learn</a>
            <div class="divider"></div>
            <span class="nav-label">開發者課程</span>
        `;

        const layout = document.createElement('div');
        layout.className = 'ms-layout';

        const sidebar = document.createElement('aside');
        sidebar.className = 'ms-sidebar';
        sidebar.innerHTML = `
            <div class="ms-sidebar-header">
                <div class="module-label">模組</div>
                <div class="module-title"></div>
                <div class="meta"><i class="far fa-clock"></i> 約 45 分鐘 · ${legacySections.length + 1} 個單元</div>
            </div>
            <nav class="ms-unit-list" id="sidebar-nav"></nav>
            <div class="sidebar-progress">
                <div class="progress-bar-bg"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div>
                <div class="progress-text" id="progress-text">0 / ${legacySections.length} 已完成</div>
            </div>
        `;
        sidebar.querySelector('.module-title').textContent = pageTitle;

        const content = document.createElement('main');
        content.className = 'ms-content';
        content.innerHTML = `
            <div class="ms-breadcrumb">
                <a href="#">Vibe Coding</a><span>›</span>
                <a href="#">入門課程</a><span>›</span>
                <span id="bc-current">課程總覽</span>
            </div>
        `;

        const pageIndex = document.createElement('div');
        pageIndex.className = 'ms-unit-page visible';
        pageIndex.id = 'page-index';
        pageIndex.innerHTML = `
            <div class="unit-content">
                <h1>${pageTitle}</h1>
                ${pageSubtitle ? `<p>${pageSubtitle}</p>` : ''}
                <h2>本單元內容</h2>
                <div class="unit-card-list" id="index-unit-list"></div>
                <div style="margin-top:32px;">
                    <button class="ms-btn" onclick="goToUnit(1)">開始單元 &nbsp;›</button>
                </div>
            </div>
        `;
        content.appendChild(pageIndex);

        const unitTitles = [];
        legacySections.forEach((section, idx) => {
            const pageNo = idx + 1;
            const title = (section.querySelector('.section-header-left h2')?.textContent || section.querySelector('h2')?.textContent || `單元 ${pageNo}`).trim();
            unitTitles.push(title);
            const page = document.createElement('div');
            page.className = 'ms-unit-page';
            page.id = `page-${pageNo}`;

            const contentWrap = document.createElement('div');
            contentWrap.className = 'unit-content';
            contentWrap.innerHTML = `<h1>${title}</h1>`;

            const sectionBody = section.querySelector('.p-8, .p-6, .p-10') || section;
            const cloned = sectionBody.cloneNode(true);
            // Remove header blocks from legacy card to avoid duplicate big titles.
            cloned.querySelectorAll('.section-header-left').forEach(el => el.remove());
            contentWrap.appendChild(cloned);

            const nav = document.createElement('div');
            nav.className = 'unit-nav';
            const prevTarget = pageNo === 1 ? 0 : pageNo - 1;
            const nextTarget = pageNo === legacySections.length ? 0 : pageNo + 1;
            nav.innerHTML = `
                <button class="nav-btn-prev" onclick="goToUnit(${prevTarget})">‹ &nbsp;${pageNo === 1 ? '總覽' : '上一個單元'}</button>
                <span class="unit-page-indicator">${pageNo} / ${legacySections.length}</span>
                <button class="nav-btn-next" onclick="markDone(${pageNo}); goToUnit(${nextTarget})">${pageNo === legacySections.length ? '返回總覽' : '下一個單元'} &nbsp;›</button>
            `;

            page.appendChild(contentWrap);
            page.appendChild(nav);
            content.appendChild(page);
        });

        layout.appendChild(sidebar);
        layout.appendChild(content);

        // Replace body content with the upgraded layout.
        document.body.innerHTML = '';
        document.body.appendChild(topNav);
        document.body.appendChild(layout);

        const sideNav = document.getElementById('sidebar-nav');
        const indexList = document.getElementById('index-unit-list');
        unitTitles.forEach((title, i) => {
            const unitNo = i + 1;
            const sideItem = document.createElement('div');
            sideItem.className = 'ms-unit-item';
            sideItem.dataset.unit = String(unitNo);
            sideItem.innerHTML = `
                <div class="unit-icon">${unitNo}</div>
                <div class="unit-meta">
                    <div class="unit-name">${title}</div>
                </div>
            `;
            sideItem.addEventListener('click', () => window.goToUnit(unitNo));
            sideNav.appendChild(sideItem);

            const indexItem = document.createElement('div');
            indexItem.className = 'unit-card';
            indexItem.innerHTML = `
                <div class="unit-card-num">${unitNo}</div>
                <div class="unit-card-info"><div class="unit-card-name">${title}</div></div>
                <div class="unit-card-arrow">›</div>
            `;
            indexItem.addEventListener('click', () => window.goToUnit(unitNo));
            indexList.appendChild(indexItem);
        });

        window.__startUnitDone = new Set();
        window.markDone = function (unitNo) {
            if (!unitNo || unitNo < 1) return;
            window.__startUnitDone.add(unitNo);
            refreshStartUnitUiState();
        };
        window.goToUnit = function (unitNo) {
            const allPages = Array.from(document.querySelectorAll('.ms-unit-page'));
            allPages.forEach(p => p.classList.remove('visible'));
            const target = unitNo === 0 ? document.getElementById('page-index') : document.getElementById(`page-${unitNo}`);
            if (target) target.classList.add('visible');

            document.querySelectorAll('.ms-unit-item').forEach(it => {
                const n = Number(it.dataset.unit);
                it.classList.toggle('active', n === unitNo);
                const icon = it.querySelector('.unit-icon');
                if (!icon) return;
                icon.classList.toggle('active-icon', n === unitNo);
                icon.classList.toggle('done', window.__startUnitDone.has(n));
                icon.innerHTML = window.__startUnitDone.has(n) ? '<i class="fas fa-check"></i>' : String(n);
            });

            const bc = document.getElementById('bc-current');
            if (bc) bc.textContent = unitNo === 0 ? '課程總覽' : (unitTitles[unitNo - 1] || '單元');
            refreshStartUnitUiState();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        function refreshStartUnitUiState() {
            const doneCount = window.__startUnitDone.size;
            const total = unitTitles.length;
            const fill = document.getElementById('progress-fill');
            const txt = document.getElementById('progress-text');
            if (fill) fill.style.width = `${Math.round((doneCount / Math.max(total, 1)) * 100)}%`;
            if (txt) txt.textContent = `${doneCount} / ${total} 已完成`;
        }

        window.goToUnit(0);
    } catch (e) {
        console.warn('[CourseShared] upgradeLegacyStartUnitToMsLayout failed:', e);
    }
}

function applyStartUnitModernTheme() {
    try {
        const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
        if (!/^start-\d{2}-unit-.*\.html$/.test(file)) return;
        if (document.getElementById('start-unit-modern-theme')) return;

        const style = document.createElement('style');
        style.id = 'start-unit-modern-theme';
        style.textContent = `
            :root {
                --ms-blue: #0078d4;
                --ms-blue-dark: #005a9e;
                --ms-blue-light: #deecf9;
                --ms-gray-10: #f3f2f1;
                --ms-gray-20: #e1dfdd;
                --ms-gray-90: #201f1e;
                --ms-green: #107c10;
                --ms-red: #d13438;
            }
            * { box-sizing: border-box !important; }
            body {
                font-family: 'Inter','Segoe UI',sans-serif !important;
                background: #fff !important;
                color: #201f1e !important;
                margin: 0 !important;
                font-size: 15px !important;
                line-height: 1.6 !important;
            }
            .ms-topnav {
                background: var(--ms-blue) !important;
                height: 48px !important;
                display: flex !important;
                align-items: center !important;
                padding: 0 20px !important;
                gap: 16px !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 100 !important;
                box-shadow: 0 1px 4px rgba(0,0,0,.2) !important;
            }
            .ms-topnav .brand {
                color: #fff !important;
                font-weight: 600 !important;
                font-size: 15px !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                text-decoration: none !important;
            }
            .ms-topnav .divider { width: 1px !important; height: 20px !important; background: rgba(255,255,255,.3) !important; }
            .ms-topnav .nav-label { color: rgba(255,255,255,.9) !important; font-size: 14px !important; }
            .ms-layout { display: flex !important; min-height: calc(100vh - 48px) !important; }
            .ms-sidebar {
                background: #faf9f8 !important;
                width: 280px !important;
                flex-shrink: 0 !important;
                border-right: 1px solid #e1dfdd !important;
                display: flex !important;
                flex-direction: column !important;
                position: sticky !important;
                top: 48px !important;
                height: calc(100vh - 48px) !important;
                overflow-y: auto !important;
            }
            .ms-sidebar-header {
                padding: 16px 16px 12px !important;
                border-bottom: 1px solid #e1dfdd !important;
            }
            .ms-sidebar-header .module-label {
                font-size: 11px !important;
                text-transform: uppercase !important;
                letter-spacing: .08em !important;
                color: #605e5c !important;
                font-weight: 600 !important;
                margin-bottom: 4px !important;
            }
            .ms-sidebar-header .module-title {
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #201f1e !important;
                line-height: 1.4 !important;
            }
            .ms-sidebar-header .meta { font-size: 12px !important; color: #605e5c !important; margin-top: 6px !important; }
            .ms-unit-list { padding: 8px 0 !important; }
            .ms-unit-item {
                display: flex !important;
                align-items: flex-start !important;
                gap: 10px !important;
                padding: 8px 16px !important;
                cursor: pointer !important;
                border-left: 3px solid transparent !important;
                transition: background .12s, border-color .12s !important;
                color: #201f1e !important;
            }
            .ms-unit-item:hover { background: #edebe9 !important; }
            .unit-icon {
                width: 20px !important;
                height: 20px !important;
                border-radius: 50% !important;
                border: 2px solid #c8c6c4 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-shrink: 0 !important;
                margin-top: 1px !important;
                font-size: 10px !important;
                background: #fff !important;
            }
            .ms-unit-item.active {
                border-left-color: var(--ms-blue) !important;
                background: #deecf9 !important;
            }
            .ms-unit-item.active .unit-name {
                color: var(--ms-blue) !important;
                font-weight: 600 !important;
            }
            .unit-icon.done {
                background: var(--ms-green) !important;
                border-color: var(--ms-green) !important;
                color: #fff !important;
            }
            .unit-icon.active-icon {
                border-color: var(--ms-blue) !important;
                background: var(--ms-blue) !important;
                color: #fff !important;
            }
            .unit-meta { flex: 1 !important; min-width: 0 !important; }
            .unit-name { font-size: 13px !important; line-height: 1.4 !important; }
            .unit-time { font-size: 11px !important; color: #605e5c !important; margin-top: 2px !important; }
            .sidebar-progress { padding: 12px 16px !important; border-top: 1px solid #e1dfdd !important; margin-top: auto !important; }
            .progress-bar-bg { background: #e1dfdd !important; border-radius: 4px !important; height: 6px !important; }
            .progress-bar-fill { background: var(--ms-green) !important; border-radius: 4px !important; height: 6px !important; transition: width .4s !important; }
            .progress-text { font-size: 12px !important; color: #605e5c !important; margin-top: 6px !important; }
            .ms-content { flex: 1 !important; min-width: 0 !important; }
            .ms-breadcrumb {
                padding: 10px 40px !important;
                font-size: 12px !important;
                border-bottom: 1px solid #e1dfdd !important;
                background: #fff !important;
                color: #605e5c !important;
            }
            .ms-breadcrumb a {
                color: var(--ms-blue) !important;
                text-decoration: none !important;
            }
            .ms-breadcrumb a:hover { text-decoration: underline !important; }
            .ms-breadcrumb span { margin: 0 6px !important; }
            .ms-unit-page { display: none !important; }
            .ms-unit-page.visible { display: block !important; }
            .unit-content {
                max-width: 820px !important;
                margin: 0 auto !important;
                padding: 32px 40px 60px !important;
            }
            .unit-content h1 {
                font-size: 28px !important;
                font-weight: 700 !important;
                margin: 0 0 20px !important;
                line-height: 1.3 !important;
                color: #201f1e !important;
            }
            .unit-content h2 {
                font-size: 20px !important;
                font-weight: 600 !important;
                margin: 36px 0 12px !important;
                color: #201f1e !important;
                padding-top: 8px !important;
            }
            .unit-content h3 {
                font-size: 16px !important;
                font-weight: 600 !important;
                margin: 24px 0 8px !important;
                color: #201f1e !important;
            }
            .unit-content code {
                background: #f3f2f1 !important;
                border: 1px solid #e1dfdd !important;
                border-radius: 3px !important;
                padding: 1px 6px !important;
                font-family: 'Consolas','Courier New',monospace !important;
                font-size: 13px !important;
                color: #a31515 !important;
            }
            .ms-note, .ms-tip, .ms-warning, .ms-important {
                display: flex !important;
                gap: 12px !important;
                padding: 12px 16px !important;
                margin: 20px 0 !important;
                border-left: 4px solid !important;
                font-size: 14px !important;
            }
            .ms-note { background:#deecf9 !important; border-left:4px solid var(--ms-blue) !important; border-radius:4px !important; }
            .ms-tip { background:#dff6dd !important; border-left:4px solid var(--ms-green) !important; border-radius:4px !important; }
            .ms-warning { background:#fff4ce !important; border-left:4px solid #ffaa44 !important; border-radius:4px !important; }
            .ms-important { background:#fde7e9 !important; border-left:4px solid var(--ms-red) !important; border-radius:4px !important; }
            .note-body strong { display: block !important; margin-bottom: 4px !important; font-size: 13px !important; text-transform: uppercase !important; letter-spacing: .04em !important; }
            .ms-scenario {
                background:#f3f2f1 !important;
                border-left:4px solid #c8c6c4 !important;
                border-radius:4px !important;
                padding: 20px 24px !important;
                margin: 20px 0 !important;
                font-style: italic !important;
                color: #323130 !important;
            }
            .ms-table th {
                background:#f3f2f1 !important;
                border:1px solid #e1dfdd !important;
                color:#323130 !important;
            }
            .ms-table td { border:1px solid #e1dfdd !important; }
            .ms-table tr:nth-child(even) td { background:#faf9f8 !important; }
            .ms-code {
                background:#1e1e1e !important;
                border-radius:6px !important;
                color:#d4d4d4 !important;
            }
            .unit-nav {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 24px 40px !important;
                border-top: 1px solid #e1dfdd !important;
                max-width: 820px !important;
                margin: 0 auto !important;
            }
            .ms-btn, .nav-btn-next {
                background: var(--ms-blue) !important;
                border-color: var(--ms-blue) !important;
                color:#fff !important;
                border-radius: 2px !important;
            }
            .ms-btn:hover, .nav-btn-next:hover {
                background: var(--ms-blue-dark) !important;
                border-color: var(--ms-blue-dark) !important;
            }
            .ms-btn-ghost, .nav-btn-prev {
                background: #fff !important;
                color: var(--ms-blue) !important;
                border: 1px solid var(--ms-blue) !important;
                border-radius: 2px !important;
            }
            .ms-btn-ghost:hover, .nav-btn-prev:hover {
                background: var(--ms-blue-light) !important;
            }
            @media (max-width: 768px) {
                .ms-sidebar { display: none !important; }
                .unit-content {
                    padding: 20px 16px 40px !important;
                }
                .unit-nav { padding: 16px !important; }
                .ms-breadcrumb { padding: 8px 16px !important; }
            }
        `;
        document.head.appendChild(style);
    } catch (e) {
        console.warn('[CourseShared] applyStartUnitModernTheme failed:', e);
    }
}

function applyHideTabsPreference() {
    try {
        // FastTab layout should always keep the unit list visible.
        if (document.querySelector('.fasttab-course-layout')) return;

        const pathname = (window.location.pathname || '').toLowerCase();
        const file = pathname.split('/').pop() || '';
        if (/^(start|basic|adv)-\d{2}-master-.*\.html$/.test(file)) return;

        const params = new URLSearchParams(window.location.search);
        const hideTabs = (params.get('hideTabs') || '').toLowerCase();
        if (!(hideTabs === '1' || hideTabs === 'true')) return;

        const tabs = document.getElementById('course-tabs-container');
        if (!tabs) return;

        tabs.style.setProperty('display', 'none', 'important');
        const tabWrapper = tabs.closest('.relative.z-40') || tabs.parentElement?.parentElement;
        if (tabWrapper) {
            tabWrapper.style.setProperty('display', 'none', 'important');
        }
    } catch (e) {
        console.warn('[CourseShared] applyHideTabsPreference failed:', e);
    }
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
    enhanceAssignmentEntryButtons();
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
async function waitForVibeFirebase(timeout = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (
            window.vibeFirebaseReady &&
            window.vibeApp &&
            typeof window.getFunctions === 'function' &&
            typeof window.httpsCallable === 'function'
        ) {
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

    let isReady = await waitForVibeFirebase();
    if (!isReady) {
        try {
            const shared = await import("./firebase-app-shared.js?v=2026.05.29.auth-persist");
            await shared.ensureFirebaseReady();
            shared.exposeFirebaseGlobals();
            isReady = true;
        } catch (e) {
            console.warn("[CourseShared] Firebase bootstrap failed:", e);
        }
    }
    if (!isReady) {
        console.warn("[CourseShared] Firebase SDK timed out. Firestore data unavailable.");
        return [];
    }

    try {
        const fn = window.getFunctions(window.vibeApp, "asia-east1");
        const getLessonsFunc = window.httpsCallable(fn, "getLessonsMetadata");
        console.log("[CourseShared] Fetching lessons metadata from Firestore...");
        const result = await getLessonsFunc();
        if (result.data?.lessons?.length) {
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

async function initFirebaseFeatures() {
    console.log("[Firebase] Injecting Firebase SDK...");
    const ENABLE_UNIFIED_SUPPORT_HUB = false;

    const { app, auth, db, functions, ensureFirebaseReady, exposeFirebaseGlobals, httpsCallable } = await import("./firebase-app-shared.js?v=2026.05.29.auth-persist");
    await ensureFirebaseReady();
    exposeFirebaseGlobals();

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

        window.firebasePrecheckGithubClassroomAccess = async (classroomUrl) => {
            try {
                const precheck = httpsCallable(functions, 'precheckGithubClassroomAccess');
                const result = await precheck({ classroomUrl });
                return result.data || null;
            } catch (e) {
                console.error("Failed to precheck GitHub Classroom access:", e);
                return null;
            }
        };

        // --- Student Interaction Hub MVP ---

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        const findCourseIdByUnit = async (fileName) => {
            let globalLessonsData = window.globalLessonsData;
            if (!globalLessonsData || globalLessonsData.length === 0) {
                try {
                    const getLessonsFunc = httpsCallable(functions, 'getLessonsMetadata');
                    const result = await getLessonsFunc();
                    if (result.data && result.data.lessons) {
                        globalLessonsData = result.data.lessons;
                        window.globalLessonsData = globalLessonsData;
                    }
                } catch (e) {
                    console.error("Failed to load global lessons data:", e);
                }
            }
            if (globalLessonsData) {
                for (const course of globalLessonsData) {
                    if (course.githubClassroomUrls && course.githubClassroomUrls[fileName]) {
                        return course.courseId;
                    }
                }
            }
            // Fallback prefix check
            if (fileName.startsWith('adv-')) return 'advanced';
            if (fileName.startsWith('basic-')) return 'basic';
            if (fileName.startsWith('start-')) return 'started';
            if (fileName.match(/^[0-9]/)) return 'prepare';
            return 'basic';
        };

        window.submitStudentBlockerAction = async function() {
            const btn = document.getElementById('btn-submit-blocker');
            const type = document.getElementById('blocker-type').value;
            const shared = document.getElementById('hub-shared-note');
            const legacy = document.getElementById('blocker-note');
            const note = (shared?.value || legacy?.value || '').trim();
            if (!note) {
                alert("請先填寫卡點/嘗試說明，再提交卡點。");
                return;
            }
            btn.disabled = true;
            btn.innerText = "提交中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const submitBlocker = httpsCallable(functions, 'submitStudentBlocker');
                await submitBlocker({
                    assignmentId: unitId,
                    blockerType: type,
                    blockerNote: note
                });
                alert("👍 卡點已回報，導師將會收到通知！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("提交失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "🚀 提交卡點";
            }
        };

        window.resolveStudentBlockerAction = async function() {
            if (!confirm("確定卡點已解決嗎？這會將狀態切回「進行中」。")) return;
            const btn = document.getElementById('btn-resolve-blocker');
            btn.disabled = true;
            btn.innerText = "處理中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const resolveBlocker = httpsCallable(functions, 'resolveStudentBlocker');
                await resolveBlocker({
                    assignmentId: unitId
                });
                alert("✅ 卡點已解決，祝您寫作業順利！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("操作失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "✅ 卡點已自行解決";
            }
        };

        window.submitAttemptSummaryAction = async function() {
            const btn = document.getElementById('btn-submit-attempt');
            const shared = document.getElementById('hub-shared-note');
            const legacy = document.getElementById('attempt-summary');
            const summary = (shared?.value || legacy?.value || '').trim();
            if (!summary) {
                alert("請先填寫卡點/嘗試說明，再提交紀錄。");
                return;
            }
            btn.disabled = true;
            btn.innerText = "提交中...";

            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');

            try {
                const submitAttempt = httpsCallable(functions, 'submitAttemptSummary');
                await submitAttempt({
                    assignmentId: unitId,
                    attemptSummary: summary
                });
                alert("📝 嘗試紀錄提交成功！");
                location.reload();
            } catch (e) {
                console.error(e);
                alert("提交失敗：" + e.message);
                btn.disabled = false;
                btn.innerText = "提交嘗試紀錄";
            }
        };

        window.toggleBlockerForm = function() {
            const form = document.getElementById('blocker-form-wrap');
            if (form) {
                form.classList.toggle('hidden');
            }
        };

        async function renderStudentInteractionHub(user) {
            if (!ENABLE_UNIFIED_SUPPORT_HUB) {
                const trigger = document.getElementById('unified-support-trigger');
                if (trigger) trigger.remove();
                const modal = document.getElementById('unified-support-panel');
                if (modal) modal.remove();
                const hideFabStyle = document.getElementById('hide-dashboard-fab-style');
                if (hideFabStyle) hideFabStyle.remove();
                return;
            }
            const pathParts = window.location.pathname.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const unitId = fileName.replace('.html', '');
            
            // Only render on unit HTML pages (skip generic index pages)
            if (fileName === 'basic.html' || fileName === 'advanced.html' || fileName === 'prepare.html' || fileName === 'start.html' || fileName === 'index.html' || fileName === 'payment-return.html') {
                return;
            }

            const courseId = await findCourseIdByUnit(fileName);

            // Fetch assignment status
            let accessResult = null;
            try {
                const resolveAccess = httpsCallable(functions, 'resolveAssignmentAccess');
                const result = await resolveAccess({ courseId, unitId: fileName, assignmentId: unitId });
                accessResult = result.data;
            } catch (e) {
                console.error("[StudentHub] Failed to fetch assignment details:", e);
                return;
            }

            if (!accessResult || !accessResult.authorized) return;

            const details = accessResult.assignmentDetails || {
                learningState: 'in_progress',
                latestBlocker: null,
                hintLevelUsed: null,
                nextAction: null,
                attemptSummary: null,
                grade: null,
                tutorFeedback: null
            };

            const learningState = details.learningState;

            // [NEW] Hide duplicate dashboard floating button on unit pages to merge widgets
            if (!document.getElementById('hide-dashboard-fab-style')) {
                const style = document.createElement('style');
                style.id = 'hide-dashboard-fab-style';
                style.innerHTML = '#dashboard-fab { display: none !important; }';
                document.head.appendChild(style);
            }
            const removeDashboardFab = () => {
                const removeFromDoc = (doc) => {
                    if (!doc) return;
                    const fab = doc.getElementById('dashboard-fab');
                    if (fab) fab.remove();
                };
                removeFromDoc(document);
                try {
                    if (window.parent && window.parent !== window && window.parent.document) {
                        removeFromDoc(window.parent.document);
                    }
                } catch (_) {}
            };
            removeDashboardFab();
            window.addEventListener('DOMContentLoaded', removeDashboardFab);
            setTimeout(removeDashboardFab, 100);
            setTimeout(removeDashboardFab, 500);
            setTimeout(removeDashboardFab, 1500);
            if (!window.__dashboardFabObserverInstalled) {
                const observer = new MutationObserver(() => {
                    removeDashboardFab();
                });
                observer.observe(document.body, { childList: true, subtree: true });
                try {
                    if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) {
                        const parentObserver = new MutationObserver(() => {
                            removeDashboardFab();
                        });
                        parentObserver.observe(window.parent.document.body, { childList: true, subtree: true });
                    }
                } catch (_) {}
                window.__dashboardFabObserverInstalled = true;
            }

            // Define openDashboardModalFromHub helper
            window.openDashboardModalFromHub = function() {
                if (typeof window.openDashboardModal === 'function') {
                    const param = courseId ? `?courseId=${courseId}` : '';
                    window.openDashboardModal(param);
                    if (typeof window.toggleUnifiedSupportPanel === 'function') {
                        window.toggleUnifiedSupportPanel();
                    }
                } else {
                    alert("載入儀表板中，請稍後重試。");
                }
            };
            
            // Check where to render (Floating Button + Slide-up Panel)
            let hubTrigger = document.getElementById('unified-support-trigger');
            if (!hubTrigger) {
                hubTrigger = document.createElement('div');
                hubTrigger.id = 'unified-support-trigger';
                hubTrigger.className = 'fixed bottom-6 right-6 z-50';
                document.body.appendChild(hubTrigger);
            }

            let hubModal = document.getElementById('unified-support-panel');
            if (!hubModal) {
                hubModal = document.createElement('div');
                hubModal.id = 'unified-support-panel';
                hubModal.className = 'fixed bottom-20 sm:bottom-24 right-4 sm:right-6 left-4 sm:left-auto w-auto sm:w-[420px] max-h-[65vh] sm:max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-y-auto z-50 transition-all duration-300 transform scale-95 opacity-0 origin-bottom-right hidden';
                hubModal.innerHTML = `
                    <!-- Close Button -->
                    <button onclick="toggleUnifiedSupportPanel()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg font-bold p-1.5 hover:bg-slate-100 rounded-full transition w-8 h-8 flex items-center justify-center">✕</button>
                    
                    <div id="unified-support-body" class="p-6"></div>
                `;
                document.body.appendChild(hubModal);
            }

            // Define toggle function
            if (!window.toggleUnifiedSupportPanel) {
                window.toggleUnifiedSupportPanel = function() {
                    const panel = document.getElementById('unified-support-panel');
                    if (!panel) return;
                    
                    if (panel.classList.contains('hidden')) {
                        panel.classList.remove('hidden');
                        setTimeout(() => {
                            panel.classList.remove('scale-95', 'opacity-0');
                            panel.classList.add('scale-100', 'opacity-100');
                        }, 20);
                    } else {
                        panel.classList.remove('scale-100', 'opacity-100');
                        panel.classList.add('scale-95', 'opacity-0');
                        setTimeout(() => {
                            panel.classList.add('hidden');
                        }, 200);
                    }
                };
            }

            // Render floating trigger button based on status
            let btnBg = 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700';
            let icon = '🤝';
            let pulseClass = '';
            let badgeHtml = '';
            
            if (learningState === 'blocked') {
                btnBg = 'from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700';
                icon = '🚨';
                pulseClass = 'animate-pulse';
            } else if (learningState === 'coaching') {
                btnBg = 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600';
                icon = '🧑‍🏫';
                pulseClass = 'animate-bounce';
                badgeHtml = '<span class="absolute -top-1 -right-1 flex h-4 w-4"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">!</span></span>';
            } else if (learningState === 'resolved') {
                btnBg = 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700';
                icon = '🎉';
            }
            
            hubTrigger.innerHTML = `
                <button onclick="toggleUnifiedSupportPanel()" class="relative flex items-center gap-2.5 px-6 py-4 bg-gradient-to-r ${btnBg} text-white font-bold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 ${pulseClass}">
                    <span class="text-xl">${icon}</span>
                    <span class="text-sm tracking-wide font-bold whitespace-nowrap">師生互動與卡點支援</span>
                    <span class="text-lg">📊</span>
                    ${badgeHtml}
                </button>
            `;

            const hubContainer = document.getElementById('unified-support-body');

            // Render current progress bar
            let steps = [
                { id: 'in_progress', label: '進行中', color: 'blue' },
                { id: 'blocked', label: '遭遇卡點', color: 'red' },
                { id: 'coaching', label: '導師引導中', color: 'amber' },
                { id: 'resolved', label: '已解決 / 評分', color: 'green' }
            ];

            let activeIndex = steps.findIndex(s => s.id === learningState);
            if (activeIndex === -1) activeIndex = 0;

            const progressHtml = steps.map((s, idx) => {
                const isActive = idx === activeIndex;
                const isPassed = idx < activeIndex;
                
                let circleColor = 'border-slate-300 text-slate-400 bg-white';
                if (isActive) {
                    if (s.id === 'blocked') circleColor = 'border-red-500 text-red-600 bg-red-50 ring-4 ring-red-100 animate-pulse';
                    else if (s.id === 'coaching') circleColor = 'border-amber-500 text-amber-600 bg-amber-50 ring-4 ring-amber-100 animate-pulse';
                    else if (s.id === 'resolved') circleColor = 'border-green-500 text-green-600 bg-green-50 ring-4 ring-green-100';
                    else circleColor = 'border-blue-500 text-blue-600 bg-blue-50 ring-4 ring-blue-100';
                } else if (isPassed) {
                    circleColor = 'border-slate-500 bg-slate-600 text-white';
                }

                return `
                    <div class="flex flex-col items-center flex-1 relative">
                        <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm z-10 transition-all ${circleColor}">
                            ${isPassed ? '✓' : (idx + 1)}
                        </div>
                        <span class="text-xs font-semibold mt-2 ${isActive ? 'text-slate-800 font-bold scale-105' : 'text-slate-505'}">${s.label}</span>
                    </div>
                `;
            }).join(`
                <div class="flex-1 h-0.5 bg-slate-200 mt-5"></div>
            `);

            // Blocker Form / Status UI
            let blockerSectionHtml = '';
            if (learningState === 'blocked') {
                const blocker = details.latestBlocker || {};
                const blockerTypeMap = { concept: '觀念卡點', debug: '程式 Bug 卡點', environment: '環境卡點' };
                blockerSectionHtml = `
                    <div class="bg-red-50 border border-red-200 rounded-2xl p-6 mt-8">
                        <div class="flex items-center gap-3 mb-3 text-red-700 font-bold">
                            <span class="text-2xl">🚨</span>
                            <span>已標記為卡點狀態，老師正在關注中</span>
                        </div>
                        <div class="text-sm text-slate-700 mb-4 bg-white p-4 rounded-xl border border-red-100">
                            <strong>卡點類型：</strong> ${blockerTypeMap[blocker.type] || '一般卡點'}<br>
                            <strong>卡點描述：</strong> ${escapeHtml(blocker.note || '無詳細描述')}
                        </div>
                        <button id="btn-resolve-blocker" onclick="resolveStudentBlockerAction()"
                            class="py-2.5 px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                            <span>✅</span> 卡點已自行解決（回到進行中）
                        </button>
                    </div>
                `;
            } else if (learningState === 'coaching') {
                // Showing Tutor Coaching notes
                const hintLabels = ['無提示', 'L1 方向提示', 'L2 半步驟引導', 'L3 完整拆解'];
                const hintBadgeColors = [
                    'bg-slate-100 text-slate-600',
                    'bg-blue-100 text-blue-800 border border-blue-200',
                    'bg-amber-100 text-amber-800 border border-amber-200',
                    'bg-red-100 text-red-800 border border-red-200'
                ];
                const hintLevel = details.hintLevelUsed !== null ? details.hintLevelUsed : 1;
                const nextAction = details.nextAction || '請遵循導師的指導步驟繼續嘗試';
                const advice = details.tutorFeedback || '導師尚未留下詳細指導內容';

                blockerSectionHtml = `
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6 mt-8">
                        <div class="flex items-center justify-between mb-4 border-b border-amber-200 pb-3">
                            <div class="flex items-center gap-3 text-amber-800 font-bold">
                                <span class="text-2xl">🧑‍🏫</span>
                                <span>導師指導回饋</span>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-bold ${hintBadgeColors[hintLevel]}">
                                ${hintLabels[hintLevel]}
                            </span>
                        </div>

                        <div class="mb-4 bg-amber-500/10 p-4 rounded-xl border border-amber-200">
                            <span class="text-xs text-amber-800 font-bold uppercase tracking-wider block mb-1">🎯 導師指派下一步目標</span>
                            <div class="text-lg font-black text-slate-800 leading-relaxed">${escapeHtml(nextAction)}</div>
                        </div>

                        <div class="text-sm text-slate-700 bg-white p-5 rounded-xl border border-amber-100 whitespace-pre-wrap leading-relaxed">
                            <strong class="text-slate-800 block mb-2">💡 導師回饋指引：</strong>
                            ${escapeHtml(advice)}
                        </div>

                        <div class="flex gap-4 mt-6">
                            <button id="btn-resolve-blocker" onclick="resolveStudentBlockerAction()"
                                class="py-2.5 px-6 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2">
                                <span>✅</span> 已完成導師指引（重設卡點）
                            </button>
                        </div>
                    </div>
                `;
            } else if (learningState === 'resolved') {
                blockerSectionHtml = `
                    <div class="bg-green-50 border border-green-200 rounded-2xl p-6 mt-8 flex items-center gap-4">
                        <span class="text-3xl">🎉</span>
                        <div>
                            <h4 class="font-bold text-green-800 mb-1">恭喜！此單元作業已成功解決或通過評分</h4>
                            <p class="text-xs text-green-700">自動評分或導師檢查已達標。您可以繼續挑戰下一單元！</p>
                        </div>
                    </div>
                `;
            } else {
                // 'in_progress' or default
                blockerSectionHtml = `
                    <div class="mt-8 flex justify-center">
                        <button onclick="toggleBlockerForm()"
                            class="py-3 px-8 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2 transform hover:-translate-y-0.5">
                            <span>⚠️</span> 我卡住了 (回報卡點)
                        </button>
                    </div>

                    <div id="blocker-form-wrap" class="hidden bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-6 transition-all duration-300">
                        <h4 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span>🛠️</span> 填寫卡點回報單
                        </h4>
                        
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-slate-600 mb-2">卡點類型</label>
                            <select id="blocker-type" class="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium text-sm">
                                <option value="concept">觀念不懂 (Concept Block)</option>
                                <option value="debug">程式有 Bug / 寫不出來 (Coding/Debugging Block)</option>
                                <option value="environment">環境問題 / 無法編譯 (Environment/Toolchain Block)</option>
                            </select>
                        </div>
                        <p class="text-xs text-slate-500 mb-5">卡點內容請填在下方「學生互動紀錄」輸入框，這裡只需要選擇卡點類型。</p>

                        <div class="flex justify-end gap-3">
                            <button onclick="toggleBlockerForm()" class="px-5 py-2 text-slate-500 hover:bg-slate-200 rounded-xl font-bold text-sm transition">取消</button>
                            <button id="btn-submit-blocker" onclick="submitStudentBlockerAction()"
                                class="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-bold shadow-md text-sm flex items-center gap-2">
                                <span>🚀</span> 提交卡點
                            </button>
                        </div>
                    </div>
                `;
            }

            // Attempt Logger (visible for in_progress / blocked / coaching states)
            let attemptSectionHtml = '';
            if (learningState !== 'resolved') {
                const currentAttempt = details.attemptSummary || '';
                attemptSectionHtml = `
                    <div class="border-t border-slate-200 mt-8 pt-8">
                        <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span>📝</span> 學生互動紀錄（卡點 / 嘗試）
                        </h4>
                        <p class="text-xs text-slate-500 mb-4">同一個輸入框即可填寫近況。可先按「提交嘗試紀錄」，若需要導師介入再按「提交卡點」。</p>
                        
                        <div class="flex flex-col gap-3">
                            <textarea id="hub-shared-note" placeholder="例：我修改了 main.cpp 中的 wifi 連線 SSID，重新編譯後 Serial Port 輸出重啟循環錯誤，現在正嘗試加上 delay..."
                                class="w-full border border-slate-300 p-4 rounded-xl h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">${escapeHtml(currentAttempt)}</textarea>
                            
                            <div class="flex justify-end">
                                <button id="btn-submit-attempt" onclick="submitAttemptSummaryAction()"
                                    class="py-2.5 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-md hover:shadow-lg active:scale-95 text-sm flex items-center gap-2">
                                    <span>📝</span> 提交嘗試紀錄
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Inject combined HTML
            hubContainer.innerHTML = `
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🤝</span>
                        <div>
                            <h3 class="text-xl font-extrabold text-slate-800 font-[Outfit]">師生互動與卡點支援中心</h3>
                            <p class="text-xs text-slate-500">此單元的即時輔導狀態與下一步行動指引</p>
                        </div>
                    </div>
                    <button onclick="window.openDashboardModalFromHub()" class="flex items-center justify-center w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-lg transition shadow-sm active:scale-95 self-start sm:self-auto" title="完整學習儀表板">
                        <span>📊</span>
                    </button>
                </div>

                <div class="flex justify-between items-center mt-6 mb-6">
                    ${progressHtml}
                </div>

                ${blockerSectionHtml}

                ${attemptSectionHtml}
            `;
        }

        auth.onAuthStateChanged((user) => {
            if (user) {
                renderStudentInteractionHub(user);
            } else {
                const trigger = document.getElementById('unified-support-trigger');
                if (trigger) trigger.remove();
                const modal = document.getElementById('unified-support-panel');
                if (modal) modal.remove();
            }
        });

        console.log("[Firebase] Initialized.");
    injectSubmissionModal();
    injectAssignmentLinkModal();
    enhanceAssignmentEntryButtons();
}

/**
 * Injects the Submission Modal HTML
 */
function injectSubmissionModal() {
    const modalHTML = `
    <div id="submission-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[60]">
        <div class="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl transform transition-all scale-100">
            <h3 class="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">📝 正式提交作業 (Submit for Review)</h3>
            
            <input type="hidden" id="sub-assignment-id">
            <input type="hidden" id="sub-assignment-title">
            
            <div id="github-classroom-section" class="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hidden">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-xl">🐙</span>
                    <h4 class="font-bold text-gray-800">GitHub Classroom</h4>
                </div>
                <p class="text-xs text-gray-600 mb-4">本單元已整合 GitHub Classroom。請先點作業卡下方「前往教室寫作業」按鈕建立「開始作業」紀錄；完成後請回到這裡正式提交 Repo 連結。</p>
                <div class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                    若看到 GitHub「Repository Access Issue」或提交時出現授權錯誤，請先到
                    <a href="https://github.com/settings/organizations" target="_blank" rel="noopener noreferrer" class="font-bold underline">
                        GitHub Settings / Organizations
                    </a>
                    接受待處理邀請後再重試。
                </div>
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
                    <span>🚀</span> 正式提交（通知老師）
                </button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Replace legacy "click whole assignment card" behavior with explicit CTA button.
 * Source pages still contain inline onclick handlers, so we transform them at runtime.
 */
function enhanceAssignmentEntryButtons() {
    const cards = document.querySelectorAll('[onclick*="openSubmissionModal("]');
    console.log(`[CourseShared] Found ${cards.length} assignment cards for CTA enhancement.`);
    const groupMap = new Map();

    cards.forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        if (card.dataset.assignmentEntryEnhanced === '1') return;

        const onclickValue = card.getAttribute('onclick') || '';
        const match =
            onclickValue.match(/openSubmissionModal\('([^']+)'\s*,\s*'([^']+)'\)/) ||
            onclickValue.match(/openSubmissionModal\("([^"]+)"\s*,\s*"([^"]+)"\)/);
        if (!match) return;

        const assignmentId = match[1];
        const assignmentTitle = match[2];

        // Disable whole-card click trigger.
        card.removeAttribute('onclick');
        card.classList.remove('cursor-pointer');
        card.classList.add('cursor-default');

        // Hide legacy full-card hover overlays that can block CTA visibility/click.
        card.querySelectorAll('.absolute.inset-0').forEach((overlay) => {
            if (overlay instanceof HTMLElement) {
                overlay.classList.add('hidden');
            }
        });

        const groupEl = card.parentElement;
        if (groupEl) {
            if (!groupMap.has(groupEl)) groupMap.set(groupEl, []);
            groupMap.get(groupEl).push({ card, assignmentId, assignmentTitle });
        }
        card.dataset.assignmentEntryEnhanced = '1';
    });

    groupMap.forEach((items, groupEl) => {
        if (!(groupEl instanceof HTMLElement)) return;
        if (!items || items.length === 0) return;

        // 取得該群組中最後一張卡片，用以精確定位按鈕
        const lastCard = items[items.length - 1].card;

        // 判斷是否需要直接將按鈕插入最後一張卡片之後
        // 若父容器為主內容區域 (.unit-content 或 .ms-unit-page)，則按鈕不應放在容器外，而應作為 direct sibling 緊隨最後一張卡片
        const isParentUnitContent = groupEl.classList.contains('unit-content') || groupEl.classList.contains('ms-unit-page');
        const insertTarget = isParentUnitContent ? lastCard : groupEl;

        // 避免重複生成按鈕
        if (insertTarget.nextElementSibling && insertTarget.nextElementSibling.classList.contains('assignment-group-entry-wrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'assignment-group-entry-wrap mt-6';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assignment-group-entry-btn w-full py-3 px-4 rounded-xl border-2 border-blue-500 text-blue-700 font-bold bg-white hover:bg-blue-50 transition shadow-sm';
        btn.textContent = '前往教室寫作業';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const primary = items[0];
            if (!primary) return;
            // 呼叫統一的 openSubmissionModal，此函數會自動判斷學員是否已綁定導師及授權狀態
            openSubmissionModal(primary.assignmentId, primary.assignmentTitle);
        });

        wrap.appendChild(btn);
        insertTarget.insertAdjacentElement('afterend', wrap);
    });
}

function openTutorBindingModal(courseId, unitId, assignmentId, title) {
    document.getElementById('link-course-id').value = courseId || '';
    document.getElementById('link-unit-id').value = unitId || '';
    document.getElementById('link-assignment-id').value = assignmentId || '';
    document.getElementById('link-assignment-title').value = title || assignmentId || '';
    document.getElementById('link-promotion-code').value = '';
    document.getElementById('assignment-link-modal').classList.remove('hidden');
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
                <p class="text-sm text-gray-500 mt-2">此單元需要指派老師才能開始作業。<br>請輸入老師提供的 <b>Promotion code</b>。</p>
            </div>
            
            <input type="hidden" id="link-course-id">
            <input type="hidden" id="link-unit-id">
            <input type="hidden" id="link-assignment-id">
            <input type="hidden" id="link-assignment-title">

            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">老師 Promotion code</label>
                <input type="text" id="link-promotion-code" placeholder="例如 rover.k.chen@gmail.com 或 Promotion code"
                    class="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition font-mono text-sm">
                <p class="text-[10px] text-gray-400 mt-2">※ 可填 Promotion code 或 Tutor email（如 rover.k.chen@gmail.com）；留空將使用預設導師。</p>
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
    const codeInput = document.getElementById('link-promotion-code');
    const rawInput = String(codeInput.value || '').trim();
    const promotionCode = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput)
        ? rawInput.toLowerCase()
        : rawInput.toUpperCase();
    const courseId = document.getElementById('link-course-id').value;
    const unitId = document.getElementById('link-unit-id').value;
    const assignmentId = document.getElementById('link-assignment-id').value;
    const title = document.getElementById('link-assignment-title').value;

    btn.disabled = true;
    btn.innerHTML = '正在驗證代碼...';

    try {
        const bindTutorByPromotionCode = httpsCallable(getFunctions(undefined, 'asia-east1'), 'bindTutorByPromotionCode');
        const result = await bindTutorByPromotionCode({ unitId, courseId, promotionCode });

        if (result.data && result.data.success) {
            closeAssignmentLinkModal();
            // Re-open the submission modal to refresh access state
            openSubmissionModal(assignmentId, title, { skipTutorPrompt: true });
        } else {
            alert("❌ 綁定失敗：" + (result.data.message || "未知錯誤"));
        }
    } catch (e) {
        console.error("Binding error:", e);
        const message = e?.message || e?.details || '綁定失敗，請稍後再試。';
        alert("❌ 錯誤：" + message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>✅</span> 驗證並綁定老師';
    }
};

// Global functions for Modal
window.openSubmissionModal = async function (assignmentId, title, options = {}) {
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

            const accessMode = String(assignmentAccess?.accessMode || '');
            const shouldAlwaysPromptTutorBinding =
                ['paid_student', 'free_course', 'trial_course'].includes(accessMode);
            const hasAssignedTutor = !!assignmentAccess?.assignedTutorEmail;
            const skipTutorPrompt = !!options?.skipTutorPrompt;
            const shouldShowTutorPrompt =
                (shouldAlwaysPromptTutorBinding || (assignmentAccess?.requiresTutorAssignment && !hasAssignedTutor)) &&
                !(skipTutorPrompt && hasAssignedTutor);

            if (shouldShowTutorPrompt) {
                document.getElementById('link-course-id').value = courseId;
                document.getElementById('link-unit-id').value = fileName;
                document.getElementById('link-assignment-id').value = assignmentId;
                document.getElementById('link-assignment-title').value = title;
                document.getElementById('link-promotion-code').value = '';
                document.getElementById('assignment-link-modal').classList.remove('hidden');
                return;
            }

        }
    } catch (e) {
        alert("暫時無法確認您的作業入口，請稍後再試。");
        return;
    }

    // --- 1. Resolve Classroom URL (Priority Order) ---
    const shouldResolveFallbackLink = !classroomUrl;
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
    // [V18.1] Move calculation here to ensure fallback links are respected
    shouldUseDirectClassroomLink = (assignmentAccess?.authorized === true || ['paid_student', 'free_course', 'trial_course', 'admin_simulated', 'fully_qualified_tutor', 'qualified_tutor'].includes(assignmentAccess?.accessMode)) && !!classroomUrl;

    // If we have a link and Shift is NOT held, navigate directly (User Request)
    const isShiftPressed = window.event && window.event.shiftKey;
    if (shouldUseDirectClassroomLink && classroomUrl && !isShiftPressed) {
        if (isLikelyGitHubClassroomLink(classroomUrl) && !isValidGitHubClassroomInviteUrl(normalizeGitHubClassroomInviteUrl(classroomUrl))) {
            alert("此單元設定的 Classroom 連結格式不正確，請通知管理員/老師修正。");
            return;
        }
        console.log(`[CourseShared] Direct navigation to: ${classroomUrl}`);
        
        // [NEW] Automated Assignment Tracking
        if (typeof window.firebaseSubmitAssignment === 'function' && !isAdminTutorModeActive()) {
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

function normalizeGitHubClassroomInviteUrl(raw = '') {
    try {
        const url = new URL(String(raw).trim());
        if (url.hostname !== 'classroom.github.com') return String(raw).trim();
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch (_) {
        return String(raw).trim();
    }
}

function isValidGitHubClassroomInviteUrl(url = '') {
    return /^https:\/\/classroom\.github\.com\/a\/[A-Za-z0-9_-]+\/?$/.test(String(url).trim());
}

function isLikelyGitHubClassroomLink(url = '') {
    const s = String(url || '').toLowerCase();
    return s.includes('classroom.github.com') || s.includes('github.com/classroom');
}

function isAdminTutorModeActive() {
    try {
        return localStorage.getItem('adminTutorMode') === 'true';
    } catch (_) {
        return false;
    }
}

function buildSubmitFailureMessage(rawMessage = '', submitUrl = '') {
    const message = String(rawMessage || '').trim();
    const isClassroomSubmission = isLikelyGitHubClassroomLink(submitUrl);
    const maybeOrgInviteIssue =
        /付款授權|payment|repository access issue|no longer have access|no access|invitation|組織邀請|organization/i.test(message);
    if (isClassroomSubmission && maybeOrgInviteIssue) {
        return `繳交失敗：${message || '尚未完成授權'}\n\n請先完成以下步驟後再提交：\n1. 前往 https://github.com/settings/organizations\n2. 接受待處理的組織或 Repository 邀請\n3. 回到本頁重新提交`;
    }
    return `繳交失敗: ${message || 'Unknown error'}`;
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

        if (isLikelyGitHubClassroomLink(url) && typeof window.firebasePrecheckGithubClassroomAccess === 'function') {
            const precheck = await window.firebasePrecheckGithubClassroomAccess(url);
            const badStates = new Set(['pending', 'invited', 'not_member', 'missing_github_identity']);
            if (precheck && precheck.precheckEnabled && badStates.has(String(precheck.state || ''))) {
                const suffix = precheck.state === 'invited'
                    ? '\n（系統已自動補發邀請）'
                    : precheck.state === 'missing_github_identity'
                        ? '\n（目前帳號尚未綁定 GitHub 登入）'
                        : '';
                alert(
                    `請先完成 GitHub 組織邀請授權再提交。\n` +
                    `1. 前往 ${precheck.settingsUrl || 'https://github.com/settings/organizations'}\n` +
                    `2. 接受待處理邀請\n` +
                    `3. 回到本頁重新提交` +
                    suffix
                );
                return;
            }
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
            alert(buildSubmitFailureMessage(result.message, url));
        }
    } catch (e) {
        console.error(e);
        if (e && e.message) {
            alert(buildSubmitFailureMessage(e.message, url));
        }
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
    const fallbackId = fileName.startsWith('prepare-') ? 'prepare'
        : (fileName.split('-')[0] + "-master");
    console.log(`[CourseShared] Fallback resolution for ${fileName} -> ${fallbackId}`);
    return fallbackId;
}
} // end window.__courseSharedLoaded guard
