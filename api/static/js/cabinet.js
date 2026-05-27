const COACH_TITLE = 'menu.coaches';
const CLIENT_TITLE = 'menu.clients';
const ATTENDANCE_TITLE = 'menu.attendance';
const COMMUNICATION_TITLE = 'menu.communication';
let coachCache = [];
let clientCache = [];
let attendanceCache = [];
let communicationContacts = [];
let communicationMessages = [];
let activeCommunicationUserId = null;
let hallCache = [];
const BASE_FOTO = (window.location && window.location.origin ? window.location.origin : '') + '/media/users/base_foto.jpg';

// debug: confirm script loaded
try { console.log('cabinet.js: loaded'); } catch (e) {}
try { console.log('cabinet.js: script present, ready to init'); } catch(e) {}

// Robust fetch helper: returns parsed JSON or throws with clear message.
async function fetchJson(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }, opts.headers || {});
    if (!opts.credentials) opts.credentials = 'same-origin';

    const resp = await fetch(url, opts);
    const text = await resp.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        const msg = text || 'Server returned non-JSON response';
        throw new Error(msg);
    }
    if (!resp.ok) {
        const msg = (data && (data.error || data.message)) ? (data.error || data.message) : resp.statusText || 'Request failed';
        const err = new Error(msg);
        err.data = data;
        throw err;
    }
    return data;
}

function initCabinet() {
    try {
    console.log('cabinet.js: initCabinet start');
    const logoutBtn = document.getElementById('logout-btn');
    console.log('cabinet.js: found logoutBtn?', !!logoutBtn);
    const backToSiteBtn = document.getElementById('back-to-site-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/logout/'; 
        });
    }

    if (backToSiteBtn) {
        backToSiteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/';
        });
    }

    const menuItems = document.querySelectorAll('.sidebar .menu-item');
    console.log('cabinet.js: menuItems count', menuItems.length);
    
    loadHalls();

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.id === 'logout-btn') return;
            if (this.id === 'back-to-site-btn') {
                // allow immediate navigation to the public site
                window.location.href = '/';
                return;
            }

            e.preventDefault();
            setActiveClass(this);

            if (this.id === 'menu-coaches') {
                loadCoachManagement();
                return;
            }

            if (this.id === 'menu-clients') {
                loadClientManagement();
                return;
            }

            if (this.id === 'menu-attendance') {
                loadAttendanceControl();
                return;
            }

            if (this.id === 'menu-settings') {
                loadSettings();
                return;
            }

            if (this.id === 'menu-review-comments') {
                loadReviewComments();
                return;
            }

            if (this.id === 'menu-communication') {
                loadCommunication();
                return;
            }


            // Prefer translated menu label if data-i18n is present
            const i18nKey = this.getAttribute('data-i18n');
            const rawTitle = this.innerText.trim();
            const title = (i18nKey && window.t) ? window.t(i18nKey) : rawTitle;
            // Build HTML with translatable prefix and section span so applyTranslations
            // can re-translate both when language changes.
            const sectionKeyAttr = i18nKey ? `data-i18n="${i18nKey}"` : '';
            const sectionText = rawTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const html = `
                <p><span data-i18n="generic.selected_prefix"></span> <strong><span ${sectionKeyAttr}>${sectionText}</span></strong></p>
                <div class="content-box"><span data-i18n="placeholder.dynamic_prefix"></span> <strong><span ${sectionKeyAttr}>${sectionText}</span></strong></div>
            `;
            updateWorkspace('', '', html);
            const wt = document.getElementById('workspace-title');
            if (wt) {
                if (i18nKey) {
                    wt.setAttribute('data-i18n', i18nKey);
                } else {
                    if (wt.hasAttribute('data-i18n')) wt.removeAttribute('data-i18n');
                    wt.innerText = rawTitle;
                }
            }
            if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
            // prevent other global delegated handlers from also processing this click
            e.stopPropagation();
        });
    });

    // Mobile toolbar interaction: delegate clicks from mobile toolbar buttons
    const mobileToolbar = document.querySelector('.mobile-toolbar');
    console.log('cabinet.js: mobileToolbar element?', !!mobileToolbar);
    if (mobileToolbar) {
        console.log('cabinet.js: attaching mobileToolbar handler');
        const handleMobileAction = (evt) => {
            // unify touch/pointer/click events
            const e = evt && evt.type === 'touchend' && evt.changedTouches ? evt.changedTouches[0] : evt;
            const raw = evt.target || (evt.changedTouches && evt.changedTouches[0] && evt.changedTouches[0].target);
            const btn = (raw && raw.closest) ? raw.closest('.mobile-item') : (evt.target ? evt.target.closest('.mobile-item') : null);
            if (!btn) return;
            try { evt.preventDefault && evt.preventDefault(); } catch (err) {}
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return;
            // Try to find sidebar menu element with this id and trigger its click handler if present
            let sidebarEl = document.getElementById(targetId);
            if (!sidebarEl && targetId && targetId.startsWith('menu-')) {
                // fallback: many sidebar anchors use data-i18n="menu.x" instead of id attributes
                const dataKey = 'menu.' + targetId.slice('menu-'.length);
                const candidate = document.querySelector(`[data-i18n="${dataKey}"]`);
                if (candidate) sidebarEl = candidate.closest('.menu-item') || candidate;
            }
            if (sidebarEl) {
                try { sidebarEl.click(); } catch (e) { /* ignore */ }
                // Visually mark active on toolbar
                mobileToolbar.querySelectorAll('.mobile-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                return;
            }
            // Fallback: map known targets to functions
            const fnMap = {
                'menu-coaches': loadCoachManagement,
                'menu-clients': loadClientManagement,
                'menu-attendance': loadAttendanceControl,
                'menu-communication': loadCommunication,
                'menu-settings': loadSettings,
                'menu-review-comments': loadReviewComments,
                'back-to-site-btn': () => { window.location.href = '/'; },
                'logout-btn': () => { window.location.href = '/logout/'; }
            };
            if (fnMap[targetId]) {
                try { fnMap[targetId](); } catch (err) { console.error('mobile toolbar action failed', err); }
                mobileToolbar.querySelectorAll('.mobile-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        };

        mobileToolbar.addEventListener('click', handleMobileAction, { passive: false });
        // also handle touch and pointer end events for better responsiveness on mobile devices
        mobileToolbar.addEventListener('touchend', handleMobileAction, { passive: false });
        mobileToolbar.addEventListener('pointerup', handleMobileAction);
    }

    // Also attach delegated handler in case menu nodes are replaced by other scripts
    document.body.addEventListener('click', function(e) {
        if (e.defaultPrevented) return; // skip if another handler already processed this click
        const el = e.target.closest('.sidebar .menu-item');
        if (!el) return;
        if (el.id === 'logout-btn') return;
        if (el.id === 'back-to-site-btn') {
            window.location.href = '/';
            return;
        }
        e.preventDefault();
        setActiveClass(el);
        if (el.id === 'menu-coaches') return loadCoachManagement();
        if (el.id === 'menu-clients') return loadClientManagement();
        if (el.id === 'menu-attendance') return loadAttendanceControl();
        if (el.id === 'menu-settings') return loadSettings();
        if (el.id === 'menu-review-comments') return loadReviewComments();
        if (el.id === 'menu-communication') return loadCommunication();

        // Use translated menu label when available and localize placeholder body
        const i18nKey = el.getAttribute('data-i18n');
        const rawTitle = el.innerText.trim();
        const title = (i18nKey && window.t) ? window.t(i18nKey) : rawTitle;
        const sectionKeyAttr = i18nKey ? `data-i18n="${i18nKey}"` : '';
        const sectionText = rawTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `
            <p><span data-i18n="generic.selected_prefix"></span> <strong><span ${sectionKeyAttr}>${sectionText}</span></strong></p>
            <div class="content-box"><span data-i18n="placeholder.dynamic_prefix"></span> <strong><span ${sectionKeyAttr}>${sectionText}</span></strong></div>
        `;
        updateWorkspace('', '', html);
        const wt = document.getElementById('workspace-title');
        if (wt) {
            if (i18nKey) {
                wt.setAttribute('data-i18n', i18nKey);
            } else {
                if (wt.hasAttribute('data-i18n')) wt.removeAttribute('data-i18n');
                wt.innerText = rawTitle;
            }
        }
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    });

    // Ensure mobile toolbar is shown only on small viewports; otherwise hide it.
    try {
        const mt = document.querySelector('.mobile-toolbar');
        function refreshMobileToolbar() {
            if (!mt) return;
                const w = window.innerWidth;
                try { console.log('refreshMobileToolbar: window.innerWidth=', w); } catch(e){}
                if (w <= 700) {
                    try { console.log('refreshMobileToolbar: showing mobile toolbar'); } catch(e){}
                    mt.style.display = 'flex';
                    mt.setAttribute('aria-hidden', 'false');
                    mt.classList.remove('hidden');
                } else {
                    try { console.log('refreshMobileToolbar: hiding mobile toolbar'); } catch(e){}
                    mt.style.display = 'none';
                    mt.setAttribute('aria-hidden', 'true');
                    mt.classList.add('hidden');
                }
                // delegate height measurement to central updater so values stay consistent
                try { if (window.scheduleUpdateHeaderHeight) { console.log('refreshMobileToolbar: requesting central header update'); window.scheduleUpdateHeaderHeight(); } } catch(e) { /* ignore */ }
        }
        refreshMobileToolbar();
        window.addEventListener('resize', refreshMobileToolbar);
    } catch (e) { console.warn('mobile-toolbar toggle failed', e); }

    } catch (err) {
        console.error('initCabinet error', err && (err.message || err));
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCabinet); else initCabinet();

function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

function loadCoachManagement() {
    const html = `
        <div class="coach-panel">
            <div class="coach-panel-header">
                <div class="coach-search-box">
                    <input id="coach-search-input" type="search" data-i18n="coach.search.placeholder" placeholder="">
                </div>
                <button id="add-coach-btn" class="coach-action-btn" data-i18n="coach.add">Add coach</button>
            </div>
            <div id="coach-list" class="coach-cards-grid"></div>
        </div>
        <div id="coach-modal" class="modal-overlay hidden"></div>
    `;

    updateWorkspace('', '', html);
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', COACH_TITLE);
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    // Defer attaching handlers and fetching list until DOM updates and translations settle
    requestAnimationFrame(() => {
        const searchInput = document.getElementById('coach-search-input');
        const addCoachBtn = document.getElementById('add-coach-btn');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderCoachCards(filterCoaches(searchInput.value));
            });
        }

        if (addCoachBtn) {
            addCoachBtn.addEventListener('click', () => {
                openCoachModal('create');
            });
        }

        refreshCoachList();
    });
}

function refreshCoachList() {
    console.log('refreshCoachList: requesting /coach-api/');

    function doFetchAndRender(attemptsLeft = 10) {
        const listEl = document.getElementById('coach-list');
        if (!listEl) {
            console.warn('refreshCoachList: coach-list element not found, attempts left', attemptsLeft);
            if (attemptsLeft > 0) {
                setTimeout(() => doFetchAndRender(attemptsLeft - 1), 80);
                return;
            }
            // final fallback: render to workspace
        }

        fetchJson('/coach-api/')
            .then(data => {
                console.log('refreshCoachList: response', data);
                if (data.status !== 'success') throw new Error(data.message || 'Unable to load coaches');
                coachCache = data.coaches || [];
                // only render if container exists, otherwise put into workspace view
                if (listEl) renderCoachCards(coachCache);
                else {
                    const view = document.getElementById('workspace-view');
                    if (view) view.innerHTML = `<div class="content-box">No coach container found to render list.</div>`;
                }
            })
            .catch(error => {
                console.error('refreshCoachList error', error);
                const view = document.getElementById('workspace-view');
                if (view) view.innerHTML = `<div class="content-box">${error.message}</div>`;
            });
    }

    doFetchAndRender();
}

function refreshClientList() {
    fetchJson('/client-api/')
        .then(data => {
            if (data.status !== 'success') throw new Error(data.message || 'Unable to load clients');
            clientCache = data.clients || [];
            renderClientCards(clientCache);
        })
        .catch(error => {
            document.getElementById('client-list').innerHTML = `<p class="content-box">${error.message}</p>`;
        });
}

function loadHalls() {
    return fetchJson('/halls-api/')
        .then(data => {
            hallCache = data.halls || [];
        })
        .catch(() => {
            hallCache = [];
        });
}

function renderHallOptions(selectId, selectedId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const placeholder = (window.t && typeof window.t === 'function') ? window.t('placeholder.select_hall', 'Select hall') : 'Select hall';
    let html = `<option value="">${placeholder}</option>`;
    hallCache.forEach(hall => {
        html += `<option value="${hall.id}" ${selectedId && String(hall.id) === String(selectedId) ? 'selected' : ''}>${hall.name}</option>`;
    });

    select.innerHTML = html;
}

function filterCoaches(query) {
    const lower = query.trim().toLowerCase();
    if (!lower) return coachCache;
    return coachCache.filter(coach => {
        return coach.nickname.toLowerCase().includes(lower)
            || coach.email.toLowerCase().includes(lower)
            || (coach.spec || '').toLowerCase().includes(lower);
    });
}

function renderCoachCards(coaches) {
    const container = document.getElementById('coach-list');
    const workspaceView = document.getElementById('workspace-view');
    const coachCardsHtml = coaches.map(coach => {
        const photoUrl = coach.photo_url || BASE_FOTO;
        const shortDesc = coach.description ? coach.description.slice(0, 120) : 'No description yet.';

        return `
            <div class="coach-card">
                <img src="${photoUrl}" alt="Coach photo">
                <div class="coach-card-header">
                    <div>
                        <h3>${coach.nickname || (window.t ? window.t('coach.unnamed') : 'Unnamed Coach')}</h3>
                        <p>${coach.spec || (window.t ? window.t('coach.no_spec') : 'Qualification not set')}</p>
                    </div>
                    <span class="coach-badge" data-i18n="coach.badge">COACH</span>
                </div>
                <p>${shortDesc}</p>
                <p><strong>Email:</strong> ${coach.email}</p>
                <p><strong>Phone:</strong> ${coach.phone || '—'}</p>
                <p><strong>Hall:</strong> ${coach.hall_name || 'Not assigned'}</p>
                <div class="coach-card-footer">
                    <button class="edit-btn" data-coach-id="${coach.id}" data-i18n="coach.edit">Edit</button>
                    <button class="delete-btn" data-coach-id="${coach.id}" data-i18n="coach.delete">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    if (!coaches.length) {
        const noHtml = '<div class="content-box" data-i18n="coach.no_coaches">No coaches found. Click "Add coach" to create the first one.</div>';
        if (container) { container.innerHTML = noHtml; if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en'); return; }
        if (workspaceView) { workspaceView.innerHTML = `<div class="coach-panel">${noHtml}</div>`; if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en'); return; }
    }

    if (container) {
        container.innerHTML = coachCardsHtml;
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');

        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const coachId = btn.getAttribute('data-coach-id');
                const coach = coachCache.find(item => String(item.id) === coachId);
                if (coach) openCoachModal('edit', coach);
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const coachId = btn.getAttribute('data-coach-id');
                if (confirm(window.t ? window.t('confirm.delete_coach') : 'Delete this coach?')) deleteCoach(coachId);
            });
        });
        return;
    }

    // fallback: render a minimal coach panel into workspaceView
    if (workspaceView) {
        const header = `
            <div class="coach-panel">
                <div class="coach-panel-header">
                    <div class="coach-search-box"><input id="coach-search-input" type="search" placeholder="Search for coach..."></div>
                    <button id="add-coach-btn" class="coach-action-btn">Add coach</button>
                </div>
                <div class="coach-cards-grid">${coachCardsHtml}</div>
            </div>`;
        workspaceView.innerHTML = header;
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');

        const searchInput = document.getElementById('coach-search-input');
        const addCoachBtn = document.getElementById('add-coach-btn');
        if (searchInput) searchInput.addEventListener('input', () => renderCoachCards(filterCoaches(searchInput.value)));
        if (addCoachBtn) addCoachBtn.addEventListener('click', () => openCoachModal('create'));

        workspaceView.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const coachId = btn.getAttribute('data-coach-id');
                const coach = coachCache.find(item => String(item.id) === coachId);
                if (coach) openCoachModal('edit', coach);
            });
        });
        workspaceView.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const coachId = btn.getAttribute('data-coach-id');
                if (confirm(window.t ? window.t('confirm.delete_coach') : 'Delete this coach?')) deleteCoach(coachId);
            });
        });
    }
}

function openCoachModal(mode, coach = {}) {
    const modal = document.getElementById('coach-modal');
    if (!modal) return;

    const canEdit = mode === 'edit';
    const nameParts = (coach.nickname || '').split(' ');
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const middleName = nameParts.slice(2).join(' ');

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 data-i18n="${canEdit ? 'coach.edit_modal' : 'coach.add_modal'}"></h3>
                <button class="modal-close" id="coach-modal-close" type="button">×</button>
            </div>
            <form id="coach-form" class="coach-form-grid">
                <div class="form-column">
                    <label class="photo-upload-label" for="coach-photo-input">
                        <span data-i18n="upload.photo">Upload photo</span>
                        <input id="coach-photo-input" name="photo" type="file" accept="image/*">
                    </label>
                    <img id="coach-photo-preview" class="photo-preview" src="${coach.photo_url || BASE_FOTO}" alt="Photo preview">
                    <input id="coach-last-name" name="last_name" type="text" data-i18n="placeholder.last_name" placeholder="" value="${lastName}">
                    <div class="field-error" id="coach-last-name-error"></div>
                    <input id="coach-first-name" name="first_name" type="text" data-i18n="placeholder.first_name" placeholder="" value="${firstName}">
                    <div class="field-error" id="coach-first-name-error"></div>
                    <input id="coach-middle-name" name="middle_name" type="text" data-i18n="placeholder.middle_name" placeholder="" value="${middleName}">
                    <div class="field-error" id="coach-middle-name-error"></div>
                </div>
                <div class="form-column">
                    <input id="coach-spec" name="spec" type="text" data-i18n="placeholder.spec" placeholder="" value="${coach.spec || ''}">
                    <textarea id="coach-description" name="description" data-i18n="placeholder.description" placeholder="">${coach.description || ''}</textarea>
                    <select id="coach-hall" name="hall"></select>
                    <input id="coach-email" name="email" type="email" data-i18n="placeholder.email" placeholder="" value="${coach.email || ''}" ${canEdit ? '' : 'required'}>
                    <div class="field-error" id="coach-email-error"></div>
                    <input id="coach-phone" name="phone" type="text" data-i18n="placeholder.phone" placeholder="" value="${coach.phone || ''}">
                    <div class="field-error" id="coach-phone-error"></div>
                    <input id="coach-password" name="password" type="password" data-i18n="placeholder.password" placeholder="" ${canEdit ? '' : 'required'}>
                    <div class="field-error" id="coach-password-error"></div>
                    <input type="hidden" id="coach-id" name="coach_id" value="${coach.id || ''}">
                </div>
            </form>
            <div class="modal-actions">
                <button class="save-btn" id="coach-save-btn" type="button" data-i18n="button.save">Save</button>
                <button class="cancel-btn" id="coach-cancel-btn" type="button" data-i18n="button.close">Close</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('coach-modal-close').addEventListener('click', closeCoachModal);
    document.getElementById('coach-cancel-btn').addEventListener('click', closeCoachModal);
    document.getElementById('coach-photo-input').addEventListener('change', updatePhotoPreview);
    document.getElementById('coach-save-btn').addEventListener('click', () => saveCoach(mode));
    loadHalls().then(() => renderHallOptions('coach-hall', coach.hall_id));
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    modal.addEventListener('click', event => {
        if (event.target === modal) closeCoachModal();
    });
}

function updatePhotoPreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    const form = event.target.closest('form');
    const preview = form?.querySelector('.photo-preview');
    if (preview) {
        preview.src = URL.createObjectURL(file);
    }
}

function closeCoachModal() {
    const modal = document.getElementById('coach-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.innerHTML = '';
    }
}

function buildFullName() {
    const lastName = document.getElementById('coach-last-name')?.value.trim();
    const firstName = document.getElementById('coach-first-name')?.value.trim();
    const middleName = document.getElementById('coach-middle-name')?.value.trim();
    return [lastName, firstName, middleName].filter(Boolean).join(' ');
}

function saveCoach(mode) {
    const form = document.getElementById('coach-form');
    if (!form) return;

    const coachId = document.getElementById('coach-id')?.value;
    const email = document.getElementById('coach-email')?.value.trim();
    const password = document.getElementById('coach-password')?.value;
    const fullName = buildFullName();
    const phone = document.getElementById('coach-phone')?.value.trim();
    const spec = document.getElementById('coach-spec')?.value.trim();
    const description = document.getElementById('coach-description')?.value.trim();
    const hallId = document.getElementById('coach-hall')?.value;
    const photoInput = document.getElementById('coach-photo-input');

    // Очистка старых ошибок
    ['coach-email','coach-password','coach-last-name','coach-first-name','coach-middle-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-invalid');
        const err = document.getElementById(id + '-error'); if (err) err.textContent = '';
    });

    if (!email) {
        document.getElementById('coach-email')?.classList.add('input-invalid');
        document.getElementById('coach-email-error').textContent = window.t ? window.t('alert.email_required') : 'Email is required';
        return;
    }

    if (mode === 'create' && !password) {
        document.getElementById('coach-password')?.classList.add('input-invalid');
        document.getElementById('coach-password-error').textContent = window.t ? window.t('alert.password_required_coach') : 'Password is required for new coach';
        return;
    }

    // Phone must contain only digits
    if (phone && !/^\d+$/.test(phone)) {
        const phoneEl = document.getElementById('coach-phone');
        const phoneErr = document.getElementById('coach-phone-error');
        if (phoneEl) phoneEl.classList.add('input-invalid');
        if (phoneErr) phoneErr.textContent = 'Телефон должен содержать только цифры.';
        return;
    }

    // Валидация email (возвращена)
    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (email && !emailRe.test(email)) {
        document.getElementById('coach-email')?.classList.add('input-invalid');
        document.getElementById('coach-email-error').textContent = 'Введите корректный email.';
        return;
    }

    // Проверка силы пароля с поддержкой Unicode (латиница + кириллица)
    const pw = password || '';
    const pwChecks = {
        length: pw.length >= 8,
        upper: /\p{Lu}/u.test(pw), // Любая заглавная буква (A-Z, А-Я)
        lower: /\p{Ll}/u.test(pw), // Любая строчная буква (a-z, а-я)
        digit: /\d/.test(pw),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pw)
    };
    const allOk = pwChecks.length && pwChecks.upper && pwChecks.lower && pwChecks.digit && pwChecks.special;
    const pwErrEl = document.getElementById('coach-password-error');
    
    if (!allOk && pw) {
        pwErrEl.innerHTML = `<ul class="pw-req">
            <li class="${pwChecks.length ? 'met' : 'unmet'}">At least 8 characters</li>
            <li class="${pwChecks.upper ? 'met' : 'unmet'}">At least one uppercase letter</li>
            <li class="${pwChecks.lower ? 'met' : 'unmet'}">At least one lowercase letter</li>
            <li class="${pwChecks.digit ? 'met' : 'unmet'}">At least one number</li>
            <li class="${pwChecks.special ? 'met' : 'unmet'}">At least one special character</li>
        </ul>`;
        document.getElementById('coach-password')?.classList.add('input-invalid');
        return;
    }

    const formData = new FormData();
    formData.append('action', mode === 'edit' ? 'update' : 'create');
    if (coachId) formData.append('id', coachId);
    formData.append('email', email);
    formData.append('nickname', fullName || email);
    formData.append('phone', phone);
    formData.append('spec', spec);
    formData.append('description', description);
    if (hallId) formData.append('hall', hallId);
    if (password) formData.append('password', password);
    if (photoInput && photoInput.files.length) {
        formData.append('photo', photoInput.files[0]);
    }

    fetchJson('/coach-save-api/', { method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, body: formData })
    .then(data => {
        closeCoachModal();
        refreshCoachList();
    })
    .catch(error => {
        const data = error && error.data;
        if (data && data.errors) {
            Object.keys(data.errors).forEach(field => {
                const fid = field === 'password' ? 'coach-password' : (field === 'email' ? 'coach-email' : field);
                const errEl = document.getElementById(fid + '-error');
                if (errEl) errEl.textContent = data.errors[field];
                const input = document.getElementById(fid);
                if (input) input.classList.add('input-invalid');
            });
            return;
        }
        showNotification('error', error.message || 'Error');
    });
}

function deleteCoach(coachId) {
    fetchJson('/coach-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action: 'delete', id: coachId }) })
    .then(() => {
        refreshCoachList();
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

function loadClientManagement() {
    const html = `
        <div class="coach-panel">
            <div class="coach-panel-header">
                <div class="coach-search-box">
                    <input id="client-search-input" type="search" data-i18n="client.search.placeholder" placeholder="">
                </div>
                <button id="add-client-btn" class="coach-action-btn" data-i18n="client.add">Add client</button>
            </div>
            <div id="client-list" class="coach-cards-grid"></div>
        </div>
        <div id="client-modal" class="modal-overlay hidden"></div>
    `;

    updateWorkspace('', '', html);
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', CLIENT_TITLE);
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    const searchInput = document.getElementById('client-search-input');
    const addClientBtn = document.getElementById('add-client-btn');

    searchInput?.addEventListener('input', () => {
        renderClientCards(filterClients(searchInput.value));
    });

    addClientBtn?.addEventListener('click', () => {
        openClientModal('create');
    });

    refreshClientList();
}

function filterClients(query) {
    const lower = query.trim().toLowerCase();
    if (!lower) return clientCache;
    return clientCache.filter(client => {
        return client.nickname.toLowerCase().includes(lower)
            || client.email.toLowerCase().includes(lower)
            || (client.description || '').toLowerCase().includes(lower);
    });
}

function renderClientCards(clients) {
    const container = document.getElementById('client-list');
    if (!container) return;

    if (!clients.length) {
        container.innerHTML = '<div class="content-box" data-i18n="coach.no_coaches">No clients found. Click "Add client" to create the first one.</div>';
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
        return;
    }

    container.innerHTML = clients.map(client => {
        const photoUrl = client.photo_url || BASE_FOTO;
        const shortDesc = client.description ? client.description.slice(0, 120) : 'No description yet.';

        return `
            <div class="coach-card">
                <img src="${photoUrl}" alt="Client photo">
                <div class="coach-card-header">
                    <div>
                        <h3>${client.nickname || (window.t ? window.t('client.unnamed') : 'Unnamed Client')}</h3>
                        <p>${client.phone ? (window.t ? window.t('label.phone') : 'Phone:') + ' ' + client.phone : (window.t ? window.t('client.no_phone') : 'No phone provided')}</p>
                    </div>
                    <span class="coach-badge" data-i18n="client.badge">CLIENT</span>
                </div>
                <p>${shortDesc}</p>
                <p><strong>Email:</strong> ${client.email}</p>
                <p><strong>Hall:</strong> ${client.hall_name || 'Not assigned'}</p>
                <div class="coach-card-footer">
                    <button class="edit-btn" data-client-id="${client.id}" data-i18n="client.edit">Edit</button>
                    <button class="delete-btn" data-client-id="${client.id}" data-i18n="client.delete">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clientId = btn.getAttribute('data-client-id');
            const client = clientCache.find(item => String(item.id) === clientId);
            if (client) openClientModal('edit', client);
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clientId = btn.getAttribute('data-client-id');
            if (confirm(window.t ? window.t('confirm.delete_client') : 'Delete this client?')) deleteClient(clientId);
        });
    });
}

function openClientModal(mode, client = {}) {
    const modal = document.getElementById('client-modal');
    if (!modal) return;

    const canEdit = mode === 'edit';
    const fullName = client.nickname || '';
    const nameParts = (fullName || '').split(' ');
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const middleName = nameParts.slice(2).join(' ');

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${canEdit ? 'Edit client' : 'Add a client'}</h3>
                <button class="modal-close" id="client-modal-close" type="button">×</button>
            </div>
            <form id="client-form" class="coach-form-grid">
                <div class="form-column">
                    <label class="photo-upload-label" for="client-photo-input">
                        <span>Upload photo</span>
                        <input id="client-photo-input" name="photo" type="file" accept="image/*">
                    </label>
                    <img id="client-photo-preview" class="photo-preview" src="${client.photo_url || BASE_FOTO}" alt="Photo preview">
                    <input id="client-last-name" name="last_name" type="text" placeholder="Last name" value="${lastName}">
                    <div class="field-error" id="client-last-name-error"></div>
                    <input id="client-first-name" name="first_name" type="text" placeholder="First name" value="${firstName}">
                    <div class="field-error" id="client-first-name-error"></div>
                    <input id="client-middle-name" name="middle_name" type="text" placeholder="Middle name" value="${middleName}">
                    <div class="field-error" id="client-middle-name-error"></div>
                    
                </div>
                <div class="form-column">
                    <textarea id="client-description" name="description" placeholder="Notes or description">${client.description || ''}</textarea>
                    <select id="client-hall" name="hall"></select>
                    <input id="client-email" name="email" type="email" placeholder="Email" value="${client.email || ''}" ${canEdit ? '' : 'required'}>
                    <div class="field-error" id="client-email-error"></div>
                    <input id="client-phone" name="phone" type="text" placeholder="Phone number" value="${client.phone || ''}">
                    <div class="field-error" id="client-phone-error"></div>
                    <input id="client-password" name="password" type="password" placeholder="Password ${canEdit ? '(leave blank to keep)' : ''}" ${canEdit ? '' : 'required'}>
                    <div class="field-error" id="client-password-error"></div>
                    <input type="hidden" id="client-id" name="client_id" value="${client.id || ''}">
                </div>
            </form>
            <div class="modal-actions">
                <button class="save-btn" id="client-save-btn" type="button">Save</button>
                <button class="cancel-btn" id="client-cancel-btn" type="button">Close</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('client-modal-close').addEventListener('click', closeClientModal);
    document.getElementById('client-cancel-btn').addEventListener('click', closeClientModal);
    document.getElementById('client-photo-input').addEventListener('change', updatePhotoPreview);
    document.getElementById('client-save-btn').addEventListener('click', () => saveClient(mode));
    loadHalls().then(() => renderHallOptions('client-hall', client.hall_id));
    modal.addEventListener('click', event => {
        if (event.target === modal) closeClientModal();
    });
}

function closeClientModal() {
    const modal = document.getElementById('client-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.innerHTML = '';
    }
}

function saveClient(mode) {
    const form = document.getElementById('client-form');
    if (!form) return;

    const clientId = document.getElementById('client-id')?.value;
    const email = document.getElementById('client-email')?.value.trim();
    const password = document.getElementById('client-password')?.value;
    const lastName = document.getElementById('client-last-name')?.value.trim();
    const firstName = document.getElementById('client-first-name')?.value.trim();
    const middleName = document.getElementById('client-middle-name')?.value.trim();
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
    const phone = document.getElementById('client-phone')?.value.trim();
    const description = document.getElementById('client-description')?.value.trim();
    const hallId = document.getElementById('client-hall')?.value;
    const photoInput = document.getElementById('client-photo-input');

    // clear previous field errors
    ['client-email','client-password','client-last-name','client-first-name','client-middle-name','client-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-invalid');
        const err = document.getElementById(id + '-error'); if (err) err.textContent = '';
    });

    if (!email) {
        document.getElementById('client-email')?.classList.add('input-invalid');
        document.getElementById('client-email-error').textContent = window.t ? window.t('alert.email_required') : 'Email is required';
        return;
    }

    if (mode === 'create' && !password) {
        document.getElementById('client-password')?.classList.add('input-invalid');
        document.getElementById('client-password-error').textContent = window.t ? window.t('alert.password_required_client') : 'Password is required for new client';
        return;
    }

    // basic client-side validation with per-field messages
    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (email && !emailRe.test(email)) {
        document.getElementById('client-email')?.classList.add('input-invalid');
        document.getElementById('client-email-error').textContent = 'Введите корректный email.';
        return;
    }
    const pw = password || '';
    const pwChecks = {
        length: pw.length >= 8,
        upper: /[A-Z]/.test(pw),
        lower: /[a-z]/.test(pw),
        digit: /\d/.test(pw),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
    };
    const allOk = pwChecks.length && pwChecks.upper && pwChecks.lower && pwChecks.digit && pwChecks.special;
    if (!allOk && pw) {
        document.getElementById('client-password-error').innerHTML = `<ul class="pw-req">
            <li class="${pwChecks.length ? 'met' : 'unmet'}">At least 8 characters</li>
            <li class="${pwChecks.upper ? 'met' : 'unmet'}">At least one uppercase letter</li>
            <li class="${pwChecks.lower ? 'met' : 'unmet'}">At least one lowercase letter</li>
            <li class="${pwChecks.digit ? 'met' : 'unmet'}">At least one number</li>
            <li class="${pwChecks.special ? 'met' : 'unmet'}">At least one special character</li>
        </ul>`;
        document.getElementById('client-password')?.classList.add('input-invalid');
        return;
    }

    // Phone must contain only digits
    if (phone && !/^\d+$/.test(phone)) {
        const phoneEl = document.getElementById('client-phone');
        const phoneErr = document.getElementById('client-phone-error');
        if (phoneEl) phoneEl.classList.add('input-invalid');
        if (phoneErr) phoneErr.textContent = 'Телефон должен содержать только цифры.';
        return;
    }

    const formData = new FormData();
    formData.append('action', mode === 'edit' ? 'update' : 'create');
    if (clientId) formData.append('id', clientId);
    formData.append('email', email);
    formData.append('nickname', fullName || email);
    formData.append('phone', phone);
    formData.append('description', description);
    if (hallId) formData.append('hall', hallId);
    if (password) formData.append('password', password);
    if (photoInput && photoInput.files.length) {
        formData.append('photo', photoInput.files[0]);
    }

    fetchJson('/client-save-api/', { method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, body: formData })
    .then(data => {
        closeClientModal();
        refreshClientList();
    })
    .catch(error => {
        const data = error && error.data;
        if (data && data.errors) {
                Object.keys(data.errors).forEach(field => {
                    let fid;
                    if (field === 'password') fid = 'client-password';
                    else if (field === 'email') fid = 'client-email';
                    else if (field === 'phone') fid = 'client-phone';
                    else fid = field;
                    const errEl = document.getElementById(fid + '-error');
                    if (errEl) errEl.textContent = data.errors[field];
                    const input = document.getElementById(fid);
                    if (input) input.classList.add('input-invalid');
                });
            return;
        }
        showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error'));
    });
}

function deleteClient(clientId) {
    fetchJson('/client-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action: 'delete', id: clientId }) })
    .then(() => {
        refreshClientList();
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

function loadAttendanceControl() {
    const html = `
        <div class="attendance-panel">
            <div class="attendance-add-section">
                <h3 data-i18n="attendance.mark_trainer">Mark Trainer Attendance</h3>
                <div class="attendance-add-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="attendance-add-trainer" data-i18n="attendance.trainer_label">Trainer</label>
                            <select id="attendance-add-trainer"></select>
                        </div>
                        <div class="form-group">
                            <label for="attendance-add-date" data-i18n="attendance.date_label">Date & Time</label>
                            <input id="attendance-add-date" type="datetime-local">
                        </div>
                        <div class="form-group">
                            <label for="attendance-add-status" data-i18n="attendance.status_label">Status</label>
                            <select id="attendance-add-status">
                                <option value="UNKNOWN" data-i18n="attendance.status.UNKNOWN">Unknown</option>
                                <option value="SHOWED" data-i18n="attendance.status.SHOWED">Showed</option>
                                <option value="NO_SHOW" data-i18n="attendance.status.NO_SHOW">No-show</option>
                            </select>
                        </div>
                        <button id="attendance-add-btn" class="coach-action-btn" data-i18n="attendance.mark_btn">Mark Attendance</button>
                    </div>
                </div>
            </div>

            <div class="attendance-filters">
                <div class="filter-group">
                    <label for="attendance-hall" data-i18n="label.hall">Hall</label>
                    <select id="attendance-hall"></select>
                </div>
                <div class="filter-group">
                    <label for="attendance-start" data-i18n="attendance.filter_from">From date</label>
                    <input id="attendance-start" type="date">
                </div>
                <div class="filter-group">
                    <label for="attendance-end" data-i18n="attendance.filter_to">To date</label>
                    <input id="attendance-end" type="date">
                </div>
                <div class="filter-group">
                    <label for="attendance-search" data-i18n="attendance.trainer_label">Trainer search</label>
                    <input id="attendance-search" type="search" data-i18n="attendance.search_placeholder" placeholder="">
                </div>
                <div class="filter-actions">
                    <button id="attendance-generate-btn" class="coach-action-btn" data-i18n="attendance.generate">Generate</button>
                    <button id="attendance-save-btn" class="coach-action-btn secondary attendance-save-btn" data-i18n="attendance.save">Save attendance</button>
                </div>
            </div>
            <div id="attendance-results" class="attendance-results"></div>
        </div>
    `;

    updateWorkspace('', '', html);
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', ATTENDANCE_TITLE);
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');

    loadHalls().then(() => renderHallOptions('attendance-hall'));
    
    loadCoachesForAttendance().then(() => {
        renderTrainerOptions('attendance-add-trainer');
    });

    const today = new Date().toISOString().slice(0, 10);
    // ensure DOM inserted before accessing elements
    requestAnimationFrame(() => {
        const startEl = document.getElementById('attendance-start');
        const endEl = document.getElementById('attendance-end');
        if (startEl) startEl.value = today;
        if (endEl) endEl.value = today;

        const genBtn = document.getElementById('attendance-generate-btn');
        const saveBtn = document.getElementById('attendance-save-btn');
        const addBtn = document.getElementById('attendance-add-btn');
        const searchEl = document.getElementById('attendance-search');

        if (genBtn) genBtn.addEventListener('click', generateAttendanceReport);
        if (saveBtn) saveBtn.addEventListener('click', saveAttendanceReport);
        if (addBtn) addBtn.addEventListener('click', addAttendanceRecord);
        if (searchEl) searchEl.addEventListener('input', () => filterAttendance(searchEl.value));
    });
}

function loadCoachesForAttendance() {
    return fetchJson('/coach-api/')
        .then(data => {
            coachCache = data.coaches || [];
        })
        .catch(error => {
        const data = error && error.data;
        if (data && data.errors) {
            Object.keys(data.errors).forEach(field => {
                // map server field keys to form input names/ids
                let fid;
                if (field === 'password') fid = 'coach-password';
                else if (field === 'email') fid = 'coach-email';
                else if (field === 'phone') fid = 'coach-phone';
                else fid = field;
                const errEl = document.getElementById(fid + '-error');
                if (errEl) errEl.textContent = data.errors[field];
                const input = document.getElementById(fid);
                if (input) input.classList.add('input-invalid');
            });
            return;
        }
        showNotification('error', error.message || 'Error');
    });
}

// Populate a select with available trainers (used in attendance form)
function renderTrainerOptions(selectId, selectedId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const placeholder = (window.t && typeof window.t === 'function') ? window.t('placeholder.select_trainer', 'Select trainer') : 'Select trainer';
    let html = `<option value="">${placeholder}</option>`;
    (coachCache || []).forEach(c => {
        const label = c.nickname || c.email || ('Coach ' + (c.id || ''));
        html += `<option value="${c.id}" ${selectedId && String(c.id) === String(selectedId) ? 'selected' : ''}>${label}</option>`;
    });
    select.innerHTML = html;
}

function addAttendanceRecord() {
    const trainerId = document.getElementById('attendance-add-trainer')?.value;
    const trainingDateStr = document.getElementById('attendance-add-date')?.value;
    const status = document.getElementById('attendance-add-status')?.value || 'UNKNOWN';

    if (!trainerId || !trainingDateStr) {
        showNotification('error', window.t ? window.t('alert.select_trainer_date') : 'Please select trainer and date & time');
        return;
    }

    const trainingDate = new Date(trainingDateStr).toISOString();

    fetchJson('/attendance-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action:'create', trainer_id:trainerId, training_date:trainingDate, status }) })
    .then(data => {
        showNotification('success', window.t ? window.t('alert.attendance_marked') : 'Attendance marked successfully');
        document.getElementById('attendance-add-trainer').value = '';
        document.getElementById('attendance-add-date').value = '';
        document.getElementById('attendance-add-status').value = 'UNKNOWN';
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

function generateAttendanceReport() {
    const hallId = document.getElementById('attendance-hall')?.value;
    const startDate = document.getElementById('attendance-start')?.value;
    const endDate = document.getElementById('attendance-end')?.value;

    if (!startDate || !endDate) {
        showNotification('error', window.t ? window.t('alert.choose_dates') : 'Please choose start and end dates');
        return;
    }

    fetchJson(`/attendance-api/?hall=${hallId || ''}&start_date=${startDate}&end_date=${endDate}`)
        .then(data => {
            attendanceCache = data.attendance || [];
            renderAttendanceList(attendanceCache);
        })
        .catch(error => {
            document.getElementById('attendance-results').innerHTML = `<div class="content-box">${error.message}</div>`;
        });
}

function renderAttendanceList(items) {
    const container = document.getElementById('attendance-results');
    if (!container) return;

    const searchQuery = document.getElementById('attendance-search')?.value.trim().toLowerCase();
    const filtered = items.filter(item => {
        return !searchQuery 
            || item.trainer_nickname.toLowerCase().includes(searchQuery) 
            || item.trainer_email.toLowerCase().includes(searchQuery);
    });

    if (!filtered.length) {
        container.innerHTML = '<div class="content-box">No attendance records found for the selected filter.</div>';
        return;
    }

    const html = `
        <table class="attendance-table attendance-report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Trainer</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(row => `
                    <tr>
                        <td>${row.date}</td>
                        <td>${row.trainer_nickname || row.trainer_email}</td>
                        <td>
                            <select data-schedule-id="${row.id}" class="attendance-status-select">
                                <option value="UNKNOWN" ${row.status === 'UNKNOWN' ? 'selected' : ''}>Unknown</option>
                                <option value="SHOWED" ${row.status === 'SHOWED' ? 'selected' : ''}>Showed</option>
                                <option value="NO_SHOW" ${row.status === 'NO_SHOW' ? 'selected' : ''}>No-show</option>
                            </select>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function filterAttendance(query) {
    const normalized = query.trim().toLowerCase();
    renderAttendanceList(attendanceCache.filter(item => {
        return !normalized 
            || item.trainer_nickname.toLowerCase().includes(normalized) 
            || item.trainer_email.toLowerCase().includes(normalized);
    }));
}

function saveAttendanceReport() {
    const selects = Array.from(document.querySelectorAll('.attendance-status-select'));
    const items = selects.map(select => ({
        id: select.dataset.scheduleId,
        status: select.value
    }));

    if (!items.length) {
        showNotification('error', window.t ? window.t('alert.no_attendance_data') : 'No attendance data to save');
        return;
    }

    fetchJson('/attendance-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ items }) })
    .then(data => {
        showNotification('success', window.t ? window.t('alert.attendance_saved') : 'Attendance saved');
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

function loadCommunication() {
    const html = `
        <div class="communication-panel">
            <div class="contacts-panel">
                <div class="contacts-panel-header">
                    <h3 data-i18n="communication.chats_label">Chats</h3>
                    <div class="communication-controls">
                        <input id="communication-search" type="search" data-i18n="communication.search_placeholder" placeholder="">
                        <input id="communication-add-id" type="text" placeholder="User ID">
                        <div class="communication-id-btns">
                            <button id="communication-add-btn" class="coach-action-btn" data-i18n="communication.add">Add</button>
                            <button id="communication-del-btn" class="coach-action-btn secondary danger" data-i18n="communication.delete">Del</button>
                        </div>
                    </div>
                </div>
                <div id="communication-contacts" class="contacts-list"></div>
            </div>
            <div class="chat-panel">
                <div class="chat-panel-header">
                    <h3 id="chat-heading" data-i18n="communication.select_chat_label">Select a chat to start</h3>
                </div>
                <div id="communication-messages" class="chat-messages"></div>
                <div class="chat-input-row">
                    <textarea id="communication-message-input" data-i18n="communication.write_message_placeholder" placeholder=""></textarea>
                    <button id="communication-send-btn" class="coach-action-btn" data-i18n="communication.send">Send</button>
                </div>
            </div>
        </div>
    `;

    updateWorkspace('', '', html);
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', COMMUNICATION_TITLE);
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    document.getElementById('communication-search')?.addEventListener('input', () => {
        const input = document.getElementById('communication-search');
        const val = input ? input.value.trim() : '';
        if (!val) {
            renderCommunicationContacts(communicationContacts);
            return;
        }

        // If user types only digits, treat as id lookup and ask server
        if (/^\d+$/.test(val)) {
            fetchJson(`/communication-find-api/?id=${encodeURIComponent(val)}`)
                .then(data => {
                    const u = data.user;
                    const contact = [{
                        id: u.id,
                        nickname: u.nickname,
                        email: u.email,
                        role: u.role,
                        hall_name: u.hall_name || '',
                        last_message: '',
                        last_date: ''
                    }];
                    renderCommunicationContacts(contact);
                })
                .catch(() => {
                    // no user found — show empty list
                    renderCommunicationContacts([]);
                });
            return;
        }

        renderCommunicationContacts(filterCommunicationContacts(val));
    });
    document.getElementById('communication-send-btn')?.addEventListener('click', sendCommunicationMessage);
    document.getElementById('communication-add-btn')?.addEventListener('click', addCommunicationById);
    document.getElementById('communication-del-btn')?.addEventListener('click', delCommunicationById);
    document.getElementById('communication-add-id')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCommunicationById(); });
    refreshCommunicationContacts();
}

function refreshCommunicationContacts() {
    fetchJson('/communication-users-api/')
        .then(data => {
            communicationContacts = data.contacts || [];
            renderCommunicationContacts(communicationContacts);
        })
        .catch(error => {
            document.getElementById('communication-contacts').innerHTML = `<div class="content-box">${error.message}</div>`;
        });
}

function renderCommunicationContacts(contacts) {
    const container = document.getElementById('communication-contacts');
    if (!container) return;

    if (!contacts.length) {
        container.innerHTML = '<div class="content-box">Немає доступних чатів.</div>';
        return;
    }

    container.innerHTML = contacts.map(contact => `
        <div class="contact-item ${contact.id === activeCommunicationUserId ? 'active' : ''}" data-contact-id="${contact.id}">
            <div class="contact-main">
                <h4>${contact.nickname}</h4>
                <p class="contact-email">${contact.email}</p>
                ${contact.hall_name ? `<p class="contact-hall">Hall: ${contact.hall_name}</p>` : ''}
            </div>
            <div class="contact-last">
                ${contact.last_date ? `<p class="contact-date">${contact.last_date}</p>` : ''}
                ${contact.last_message ? `<p class="contact-snippet">${contact.last_message.slice(0, 80)}</p>` : '<p class="contact-meta">Немає повідомлень</p>'}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.contact-item').forEach(item => {
        item.addEventListener('click', () => {
            const contactId = item.dataset.contactId;
            if (contactId) {
                openCommunicationChat(contactId);
            }
        });
    });

    // no per-contact delete buttons; deletion is done via Del button with id input
}

function filterCommunicationContacts(query) {
    const lower = query.trim().toLowerCase();
    if (!lower) return communicationContacts;
    return communicationContacts.filter(contact => {
        return contact.nickname.toLowerCase().includes(lower)
            || contact.email.toLowerCase().includes(lower)
            || contact.role.toLowerCase().includes(lower)
            || (contact.hall_name || '').toLowerCase().includes(lower);
    });
}

function openCommunicationChat(contactId) {
    activeCommunicationUserId = Number(contactId);
    const contact = communicationContacts.find(item => String(item.id) === String(contactId));
        const heading = document.getElementById('chat-heading');
    if (heading && contact) {
        heading.innerText = `Чат з ${contact.nickname} (ID: ${contact.id})`;
    }
    document.getElementById('communication-message-input').value = '';
    fetchJson(`/communication-messages-api/?other_id=${contactId}`)
        .then(data => {
            communicationMessages = data.messages || [];
            // store server-declared "other" id to reliably compute ownership
            try { window._COMM_OTHER_ID = data.other && data.other.id ? Number(data.other.id) : null; } catch(e) { window._COMM_OTHER_ID = null; }
            renderCommunicationMessages();
            renderCommunicationContacts(filterCommunicationContacts(document.getElementById('communication-search').value));
            // update heading with server-returned other info (ensures id present)
            try {
                if (data.other && heading) {
                    heading.innerText = `Чат з ${data.other.nickname} (ID: ${data.other.id})`;
                }
            } catch (e) {}
        })
        .catch(error => {
            document.getElementById('communication-messages').innerHTML = `<div class="content-box">${error.message}</div>`;
        });
}

function addCommunicationById() {
    const input = document.getElementById('communication-add-id');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showNotification('error', window.t ? window.t('alert.enter_user_id') : 'Enter user id');
        return;
    }

    fetchJson('/communication-add-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ user_id: val }) })
        .then(() => {
            input.value = '';
            // fetch the user's limited profile and add to local contacts list
            return fetchJson(`/communication-find-api/?id=${encodeURIComponent(val)}`)
                .then(data => {
                    const u = data.user;
                    const contact = {
                        id: u.id,
                        nickname: u.nickname,
                        email: u.email,
                        role: u.role,
                        hall_name: u.hall_name || '',
                        last_message: '',
                        last_date: ''
                    };
                    // ensure no duplicate
                    communicationContacts = (communicationContacts || []).filter(c => String(c.id) !== String(contact.id));
                    communicationContacts.unshift(contact);
                    renderCommunicationContacts(communicationContacts);
                    // open the new chat
                    openCommunicationChat(contact.id);
                })
                .catch(() => {
                    // If we can't fetch the profile, fallback to refreshing the list
                    refreshCommunicationContacts();
                });
        })
        .catch(err => showNotification('error', err.message || 'Error'));
}

function delCommunicationById() {
    const input = document.getElementById('communication-add-id');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showNotification('error', window.t ? window.t('alert.enter_user_id') : 'Enter user id');
        return;
    }
    if (!confirm(window.t ? window.t('confirm.delete_chat') : 'Delete this chat and all messages?')) return;

    fetchJson('/communication-delete-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ user_id: val }) })
        .then(() => {
            input.value = '';
            if (Number(val) === activeCommunicationUserId) {
                activeCommunicationUserId = null;
                document.getElementById('communication-messages').innerHTML = '';
                document.getElementById('chat-heading').innerText = window.t ? window.t('communication.select_chat') : 'Select a chat to start';
            }
            // remove contact locally so it disappears for the current user immediately
            communicationContacts = (communicationContacts || []).filter(c => String(c.id) !== String(val));
            renderCommunicationContacts(communicationContacts);
        })
        .catch(err => showNotification('error', err.message || 'Error'));
}

function renderCommunicationMessages() {
    const container = document.getElementById('communication-messages');
    if (!container) return;

    if (!activeCommunicationUserId) {
        container.innerHTML = '<div class="content-box" data-i18n="communication.choose_chat">Choose a chat to view messages.</div>';
        return;
    }

    if (!communicationMessages.length) {
        container.innerHTML = '<div class="content-box">Почніть діалог, щоб написати перше повідомлення.</div>';
        return;
    }

    container.innerHTML = communicationMessages.map(msg => {
        // prefer server-provided 'other' id (the chat peer) when available
        const otherId = (typeof window._COMM_OTHER_ID !== 'undefined') ? window._COMM_OTHER_ID : (activeCommunicationUserId || null);
        const currentUser = (typeof window.CURRENT_USER_ID !== 'undefined' && window.CURRENT_USER_ID !== null) ? Number(window.CURRENT_USER_ID) : null;
        const serverFlag = (typeof msg.is_sent !== 'undefined') ? Boolean(msg.is_sent) : null;
        const localFlag = (currentUser !== null) ? (Number(msg.sender_id) === currentUser) : null;
        let isSent;
        if (otherId !== null) {
            // message is sent by current user when sender_id !== otherId
            isSent = Number(msg.sender_id) !== Number(otherId);
        } else if (serverFlag !== null && localFlag === null) {
            isSent = serverFlag;
        } else if (localFlag !== null) {
            isSent = localFlag;
        } else if (serverFlag !== null) {
            isSent = serverFlag;
        } else {
            isSent = false;
        }
        console.debug('renderCommunicationMessages:', { otherId, currentUser, sender: msg.sender_id, serverFlag, localFlag, isSent, msg });
        return `
            <div class="message-bubble ${isSent ? 'sent' : ''}">
                <p>${msg.text}</p>
                <div class="message-meta">${msg.created_at}</div>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function sendCommunicationMessage() {
    const receiverId = activeCommunicationUserId;
    const input = document.getElementById('communication-message-input');
    const text = input?.value.trim();

    if (!receiverId) {
        showNotification('error', window.t ? window.t('alert.select_chat') : 'Please select a chat to send a message.');
        return;
    }
    if (!text) {
        showNotification('error', window.t ? window.t('alert.enter_message') : 'Please enter message text.');
        return;
    }

    fetchJson('/communication-send-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ receiver_id: receiverId, text }) })
    .then(() => {
        input.value = '';
        openCommunicationChat(receiverId);
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

function updateWorkspace(title, desc, html = '') {
    const titleEl = document.getElementById('workspace-title');
    if (titleEl) {
        if (titleEl.hasAttribute('data-i18n')) titleEl.removeAttribute('data-i18n');
        if (title) titleEl.innerText = title;
    }
    
    const viewEl = document.getElementById('workspace-view');
    if (viewEl) {
        viewEl.innerHTML = html;
        // prevent global i18n from wiping dynamic workspace content by
        // removing the data-i18n marker on the container itself while
        // preserving data-i18n attributes of inserted children
        if (viewEl.hasAttribute('data-i18n')) viewEl.removeAttribute('data-i18n');
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    }
}

function setActiveClass(el) {
    document.querySelectorAll('.sidebar .menu-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
}

function renderStars(rating) {
    return Array.from({ length: 5 }, (_, index) => {
        return `<span class="star ${index < rating ? 'active' : ''}">★</span>`;
    }).join('');
}

function loadReviewComments() {
    const html = `
        <div class="review-panel">
            <div class="review-summary-grid">
                <div class="review-stat-box">
                    <div class="review-stat-label" data-i18n="review.avg_label">Average rating</div>
                    <div class="review-stat-value" id="review-average-rating">—</div>
                </div>
                <div class="review-stat-box">
                    <div class="review-stat-label" data-i18n="review.approved_label">Approved</div>
                    <div class="review-stat-value" id="review-approved-count">0</div>
                </div>
                <div class="review-stat-box">
                    <div class="review-stat-label" data-i18n="review.rejected_label">Rejected</div>
                    <div class="review-stat-value" id="review-rejected-count">0</div>
                </div>
            </div>
            <div class="review-sections">
                <section class="review-section">
                    <h3 data-i18n="reviews.pending">Pending reviews</h3>
                    <div id="review-pending-list" class="review-list"></div>
                </section>
                <section class="review-section">
                    <h3 data-i18n="reviews.logs">Recent action log</h3>
                    <div id="review-logs-list" class="review-list"></div>
                </section>
            </div>
        </div>
    `;

    updateWorkspace('', '', html);
    // mark workspace title for translation
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', 'menu.review_comments');
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    refreshReviewComments();
}

function refreshReviewComments() {
    fetchJson('/review-comments-api/')
        .then(data => {
            document.getElementById('review-average-rating').innerText = `${data.average_rating.toFixed(1)} / 5`;
            document.getElementById('review-approved-count').innerText = data.approved_count;
            document.getElementById('review-rejected-count').innerText = data.rejected_count;
            renderPendingComments(data.pending);
            renderReviewLogs(data.logs);
        })
        .catch(error => {
            const pending = document.getElementById('review-pending-list');
            const logs = document.getElementById('review-logs-list');
            const msg = error.message || 'Error';
            if (pending) pending.innerHTML = `<div class="content-box">${msg}</div>`;
            if (logs) logs.innerHTML = `<div class="content-box">${msg}</div>`;
        });
}

function renderPendingComments(items) {
    const container = document.getElementById('review-pending-list');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div class="content-box" data-i18n="reviews.no_pending">No pending comments at the moment.</div>';
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
        return;
    }
    container.innerHTML = items.map(comment => `
        <div class="review-card">
            <div class="review-card-header">
                <div>
                    <div class="author-name">${comment.author_name}</div>
                    <div class="comment-meta">${comment.created_at}</div>
                </div>
                <div class="review-card-rating">${renderStars(comment.rating)}</div>
            </div>
            <p>${comment.text}</p>
            <div class="review-actions">
                <button class="review-action-btn approve-btn" data-id="${comment.id}" data-action="approve" data-i18n="review.action.approve">Approve</button>
                <button class="review-action-btn reject-btn" data-id="${comment.id}" data-action="reject" data-i18n="review.action.reject">Reject</button>
            </div>
        </div>
    `).join('');
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
    container.querySelectorAll('.review-action-btn').forEach(button => {
        button.addEventListener('click', () => {
            const commentId = button.dataset.id;
            const action = button.dataset.action;
            if (commentId && action) {
                submitReviewActions([{ id: commentId, action }]);
            }
        });
    });
}

function renderReviewLogs(items) {
    const container = document.getElementById('review-logs-list');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div class="content-box" data-i18n="reviews.no_logs">No recent review actions.</div>';
        if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
        return;
    }
    container.innerHTML = items.map(comment => `
        <div class="review-card review-log-card">
            <div class="review-card-header">
                <div>
                    <div class="author-name">${comment.author_name}</div>
                    <div class="comment-meta">${comment.created_at}</div>
                </div>
                <div class="review-card-rating">${renderStars(comment.rating)}</div>
            </div>
            <p>${comment.text}</p>
            <div class="review-log-meta">
                ${(() => {
                    const statusLabel = (window.t && typeof window.t === 'function') ? (window.t(`review.${(comment.status || '').toLowerCase()}_label`) || comment.status) : comment.status;
                    return `<span class="status-badge ${comment.status}">${statusLabel}</span>`;
                })()}
                <span class="reviewed-by">${(window.t && typeof window.t === 'function') ? (window.t('review.reviewed_by','Reviewed by')) : 'Reviewed by'} ${comment.reviewed_by || ((window.t && typeof window.t === 'function') ? window.t('review.system','System') : 'System')}</span>
                ${comment.reviewed_at ? `<span>${comment.reviewed_at}</span>` : ''}
            </div>
        </div>
    `).join('');
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
}

function submitReviewActions(actions) {
    fetchJson('/review-comments-action-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ actions }) })
    .then(() => {
        refreshReviewComments();
    })
    .catch(error => showNotification('error', error.message || (window.t ? window.t('server.error', 'Error') : 'Error')));
}

// Settings UI
function loadSettings() {
    const html = `
        <div class="settings-panel" style="padding:20px 16px;">
            <div class="settings-card" style="max-width:100%; padding:20px;">
                <h3 data-i18n="settings.profile">Profile</h3>
                <form id="profile-form">
                    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
                        <div style="flex: 0 0 180px; display:flex; flex-direction:column; align-items:center;">
                            <div id="avatar-preview" style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center; margin-top:12px"></div>
                            <div style="margin-top:10px;"><input type="file" id="profile-photo-input" accept="image/*"></div>
                        </div>
                        <div style="flex:1; min-width:260px;">
                            <label style="display:block; margin-bottom:8px;"><span data-i18n="settings.nickname">Nickname</span><br><input type="text" id="profile-nickname" class="form-input" data-i18n="placeholder.nickname" placeholder=""></label>
                            <label style="display:block; margin-bottom:8px;"><span data-i18n="settings.user_id">User ID</span><br><div id="profile-user-id" class="form-input" style="background:transparent; border:none; padding:6px 0;">&nbsp;</div></label>
                            <label style="display:block; margin-bottom:8px;"><span data-i18n="label.phone">Phone</span><br><input type="text" id="profile-phone" class="form-input" data-i18n="placeholder.phone" placeholder=""></label>
                            <div class="field-error" id="profile-phone-error"></div>
                            <label style="display:block; margin-bottom:8px;"><span data-i18n="placeholder.description">Description</span><br><textarea id="profile-description" class="form-input" rows="4" data-i18n="placeholder.description" placeholder=""></textarea></label>
                        </div>
                    </div>
                    <hr style="margin:18px 0; border-color:#eee">
                    <div style="margin-top:6px;">
                        <h4 data-i18n="settings.change_password">Change password</h4>
                        <label style="display:block; margin-bottom:8px;"><span data-i18n="settings.new_password">New password</span><br><input type="password" id="profile-new-password" class="form-input" data-i18n="placeholder.password" placeholder=""></label>
                        <label style="display:block; margin-bottom:8px;"><span data-i18n="settings.confirm_new_password">Confirm new password</span><br><input type="password" id="profile-new-password-confirm" class="form-input" data-i18n="placeholder.password" placeholder=""></label>
                    </div>
                    <div style="margin-top:16px;"><button id="profile-save-btn" class="coach-action-btn" data-i18n="settings.save_profile">Save profile</button></div>
                </form>
            </div>
        </div>
    `;

    updateWorkspace('', '', html);
    const wt = document.getElementById('workspace-title');
    if (wt) wt.setAttribute('data-i18n', 'menu.settings');
    if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');

    // fetch current profile
    fetchJson('/profile-api/')
        .then(data => {
            if (data.status !== 'success') throw new Error(data.message || 'Unable to load profile');
            const u = data.user;
            const nickEl = document.getElementById('profile-nickname');
            const phoneEl = document.getElementById('profile-phone');
            const descEl = document.getElementById('profile-description');
            const preview = document.getElementById('avatar-preview');

            if (nickEl) nickEl.value = u.nickname || '';
            const userIdEl = document.getElementById('profile-user-id');
            if (userIdEl) userIdEl.innerText = u.id || '';
            if (phoneEl) phoneEl.value = u.phone || '';
            if (descEl) descEl.value = u.description || '';
            if (preview) {
                if (u.avatar) preview.innerHTML = `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover">`;
                else preview.innerHTML = `<img src="${BASE_FOTO}" style="width:100%;height:100%;object-fit:cover">`;
            }

            // photo input preview
            const photoInput = document.getElementById('profile-photo-input');
            if (photoInput && preview) {
                photoInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const url = URL.createObjectURL(file);
                    preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
                });
            }

            const saveBtn = document.getElementById('profile-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const fd = new FormData();
                    if (nickEl) fd.append('nickname', nickEl.value);
                    if (phoneEl) fd.append('phone', phoneEl.value);
                    if (descEl) fd.append('description', descEl.value);
                    const newPassEl = document.getElementById('profile-new-password');
                    const newPassConfirmEl = document.getElementById('profile-new-password-confirm');
                    fd.append('new_password', newPassEl ? newPassEl.value || '' : '');
                    fd.append('new_password_confirm', newPassConfirmEl ? newPassConfirmEl.value || '' : '');
                    const file = photoInput && photoInput.files ? photoInput.files[0] : null;
                    if (file) fd.append('photo', file);

                    fetchJson('/profile-api/', { method: 'POST', body: fd, headers: {'X-CSRFToken': getCsrfToken()} })
                        .then(res => {
                            showNotification('success', 'Профиль обновлён');
                        })
                        .catch(err => {
                            const data = err && err.data;
                            if (data && data.errors) {
                                Object.keys(data.errors).forEach(field => {
                                    const fid = (field === 'phone') ? 'profile-phone' : field;
                                    const errEl = document.getElementById(fid + '-error');
                                    const input = document.getElementById(fid);
                                    if (errEl) errEl.textContent = data.errors[field];
                                    if (input) input.classList.add('input-invalid');
                                });
                                const summary = Object.values(data.errors).flat().slice(0,3).join('; ');
                                showNotification('error', summary || (err.message || 'Error'));
                                return;
                            }
                            showNotification('error', err.message || 'Error');
                        });
                });
            }
        })
        .catch(err => {
            const view = document.getElementById('workspace-view');
            if (view) view.innerHTML = `<div class="content-box">${err.message}</div>`;
        });
}

// hook settings menu item
document.addEventListener('DOMContentLoaded', () => {
    const settingsLink = document.getElementById('menu-settings');
    if (settingsLink) settingsLink.addEventListener('click', (e) => { e.preventDefault(); setActiveClass(settingsLink); loadSettings(); });
});

// expose core functions for console and ensure availability
try {
    window.fetchJson = fetchJson;
    window.loadCoachManagement = loadCoachManagement;
    window.loadClientManagement = loadClientManagement;
    window.loadAttendanceControl = loadAttendanceControl;
    window.loadReviewComments = loadReviewComments;
    window.loadCommunication = loadCommunication;
    window.loadSettings = loadSettings;
    console.log('cabinet.js: API exposed to window');
} catch (e) { console.warn('cabinet.js: could not expose to window', e); }