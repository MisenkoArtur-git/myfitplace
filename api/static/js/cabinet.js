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

// debug: confirm script loaded
try { console.log('cabinet.js: loaded'); } catch (e) {}

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
        const msg = (data && data.message) ? data.message : resp.statusText || 'Request failed';
        throw new Error(msg);
    }
    return data;
}

function initCabinet() {
    const logoutBtn = document.getElementById('logout-btn');
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

            if (this.id === 'menu-review-comments') {
                loadReviewComments();
                return;
            }

            if (this.id === 'menu-communication') {
                loadCommunication();
                return;
            }


            const title = this.innerText.trim();
            updateWorkspace(title, '', `<p>Ви обрали розділ: <strong>${title}</strong></p>
                                        <div class="content-box">Тут буде динамічний контент для ${title}.</div>`);
        });
    });

    // Also attach delegated handler in case menu nodes are replaced by other scripts
    document.body.addEventListener('click', function(e) {
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
        if (el.id === 'menu-review-comments') return loadReviewComments();
        if (el.id === 'menu-communication') return loadCommunication();

        const title = el.innerText.trim();
        updateWorkspace(title, '', `<p>Ви обрали розділ: <strong>${title}</strong></p>
                                    <div class="content-box">Тут буде динамічний контент для ${title}.</div>`);
    });
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

    let html = '<option value="">Select hall</option>';
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
        const photoUrl = coach.photo_url || 'https://via.placeholder.com/400x240?text=No+photo';
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
                    <img id="coach-photo-preview" class="photo-preview" src="${coach.photo_url || 'https://via.placeholder.com/400x240?text=Photo'}" alt="Photo preview">
                    <input id="coach-last-name" name="last_name" type="text" data-i18n="placeholder.last_name" placeholder="" value="${lastName}">
                    <input id="coach-first-name" name="first_name" type="text" data-i18n="placeholder.first_name" placeholder="" value="${firstName}">
                    <input id="coach-middle-name" name="middle_name" type="text" data-i18n="placeholder.middle_name" placeholder="" value="${middleName}">
                </div>
                <div class="form-column">
                    <input id="coach-spec" name="spec" type="text" data-i18n="placeholder.spec" placeholder="" value="${coach.spec || ''}">
                    <textarea id="coach-description" name="description" data-i18n="placeholder.description" placeholder="">${coach.description || ''}</textarea>
                    <select id="coach-hall" name="hall"></select>
                    <input id="coach-email" name="email" type="email" data-i18n="placeholder.email" placeholder="" value="${coach.email || ''}" ${canEdit ? '' : 'required'}>
                    <input id="coach-phone" name="phone" type="text" data-i18n="placeholder.phone" placeholder="" value="${coach.phone || ''}">
                    <input id="coach-password" name="password" type="password" data-i18n="placeholder.password" placeholder="" ${canEdit ? '' : 'required'}>
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

    if (!email) {
        alert(window.t ? window.t('alert.email_required') : 'Email is required');
        return;
    }

    if (mode === 'create' && !password) {
        alert(window.t ? window.t('alert.password_required_coach') : 'Password is required for new coach');
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
    .catch(error => alert(error.message));
}

function deleteCoach(coachId) {
    fetchJson('/coach-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action: 'delete', id: coachId }) })
    .then(() => {
        refreshCoachList();
    })
    .catch(error => alert(error.message));
}

function loadClientManagement() {
    const html = `
        <div class="coach-panel">
            <div class="coach-panel-header">
                <div class="coach-search-box">
                    <input id="client-search-input" type="search" placeholder="Search for client...">
                </div>
                <button id="add-client-btn" class="coach-action-btn">Add client</button>
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
        const photoUrl = client.photo_url || 'https://via.placeholder.com/400x240?text=No+photo';
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
                    <img id="client-photo-preview" class="photo-preview" src="${client.photo_url || 'https://via.placeholder.com/400x240?text=Photo'}" alt="Photo preview">
                    <input id="client-full-name" name="nickname" type="text" placeholder="Full name" value="${fullName}">
                    <input id="client-email" name="email" type="email" placeholder="Email" value="${client.email || ''}" ${canEdit ? '' : 'required'}>
                    <input id="client-phone" name="phone" type="text" placeholder="Phone number" value="${client.phone || ''}">
                </div>
                <div class="form-column">
                    <textarea id="client-description" name="description" placeholder="Notes or description">${client.description || ''}</textarea>
                    <select id="client-hall" name="hall"></select>
                    <input id="client-password" name="password" type="password" placeholder="Password ${canEdit ? '(leave blank to keep)' : ''}" ${canEdit ? '' : 'required'}>
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
    const fullName = document.getElementById('client-full-name')?.value.trim();
    const phone = document.getElementById('client-phone')?.value.trim();
    const description = document.getElementById('client-description')?.value.trim();
    const hallId = document.getElementById('client-hall')?.value;
    const photoInput = document.getElementById('client-photo-input');

    if (!email) {
        alert(window.t ? window.t('alert.email_required') : 'Email is required');
        return;
    }

    if (mode === 'create' && !password) {
        alert(window.t ? window.t('alert.password_required_client') : 'Password is required for new client');
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
    .catch(error => alert(error.message));
}

function deleteClient(clientId) {
    fetchJson('/client-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action: 'delete', id: clientId }) })
    .then(() => {
        refreshClientList();
    })
    .catch(error => alert(error.message));
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
                    <label for="attendance-start" data-i18n="label.date">Start date</label>
                    <input id="attendance-start" type="date">
                </div>
                <div class="filter-group">
                    <label for="attendance-end" data-i18n="label.date">End date</label>
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
        .catch(() => {
            coachCache = [];
        });
}

function renderTrainerOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    let html = '<option value="">Select trainer</option>';
    coachCache.forEach(coach => {
        html += `<option value="${coach.id}">${coach.nickname || coach.email}</option>`;
    });

    select.innerHTML = html;
}

function addAttendanceRecord() {
    const trainerId = document.getElementById('attendance-add-trainer')?.value;
    const trainingDateStr = document.getElementById('attendance-add-date')?.value;
    const status = document.getElementById('attendance-add-status')?.value || 'UNKNOWN';

    if (!trainerId || !trainingDateStr) {
        alert(window.t ? window.t('alert.select_trainer_date') : 'Please select trainer and date & time');
        return;
    }

    const trainingDate = new Date(trainingDateStr).toISOString();

    fetchJson('/attendance-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ action:'create', trainer_id:trainerId, training_date:trainingDate, status }) })
    .then(data => {
        alert(window.t ? window.t('alert.attendance_marked') : 'Attendance marked successfully');
        document.getElementById('attendance-add-trainer').value = '';
        document.getElementById('attendance-add-date').value = '';
        document.getElementById('attendance-add-status').value = 'UNKNOWN';
    })
    .catch(error => alert(error.message));
}

function generateAttendanceReport() {
    const hallId = document.getElementById('attendance-hall')?.value;
    const startDate = document.getElementById('attendance-start')?.value;
    const endDate = document.getElementById('attendance-end')?.value;

    if (!startDate || !endDate) {
        alert(window.t ? window.t('alert.choose_dates') : 'Please choose start and end dates');
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
        alert(window.t ? window.t('alert.no_attendance_data') : 'No attendance data to save');
        return;
    }

    fetchJson('/attendance-save-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ items }) })
    .then(data => {
        alert(window.t ? window.t('alert.attendance_saved') : 'Attendance saved');
    })
    .catch(error => alert(error.message));
}

function loadCommunication() {
    const html = `
        <div class="communication-panel">
            <div class="contacts-panel">
                <div class="contacts-panel-header">
                    <h3 data-i18n="communication.chats_label">Chats</h3>
                    <input id="communication-search" type="search" data-i18n="communication.search_placeholder" placeholder="">
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
        renderCommunicationContacts(filterCommunicationContacts(document.getElementById('communication-search').value));
    });
    document.getElementById('communication-send-btn')?.addEventListener('click', sendCommunicationMessage);
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
            <div>
                <h4>${contact.nickname}</h4>
                <p>${contact.email}</p>
                <p class="contact-meta">${contact.role} ${contact.hall_name ? '| Hall: ' + contact.hall_name : ''}</p>
            </div>
            <div class="contact-last">
                ${contact.last_date ? `<p class="contact-meta">${contact.last_date}</p>` : ''}
                ${contact.last_message ? `<p class="contact-snippet">${contact.last_message.slice(0, 45)}</p>` : '<p class="contact-meta">Немає повідомлень</p>'}
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
        heading.innerText = `Чат з ${contact.nickname}`;
    }
    document.getElementById('communication-message-input').value = '';
    fetchJson(`/communication-messages-api/?other_id=${contactId}`)
        .then(data => {
            communicationMessages = data.messages || [];
            renderCommunicationMessages();
            renderCommunicationContacts(filterCommunicationContacts(document.getElementById('communication-search').value));
        })
        .catch(error => {
            document.getElementById('communication-messages').innerHTML = `<div class="content-box">${error.message}</div>`;
        });
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
        const isSent = msg.sender_id !== activeCommunicationUserId;
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
        alert(window.t ? window.t('alert.select_chat') : 'Please select a chat to send a message.');
        return;
    }
    if (!text) {
        alert(window.t ? window.t('alert.enter_message') : 'Please enter message text.');
        return;
    }

    fetchJson('/communication-send-api/', { method: 'POST', headers: {'Content-Type':'application/json','X-CSRFToken':getCsrfToken()}, body: JSON.stringify({ receiver_id: receiverId, text }) })
    .then(() => {
        input.value = '';
        openCommunicationChat(receiverId);
    })
    .catch(error => alert(error.message));
}

function updateWorkspace(title, desc, html = '') {
    const titleEl = document.getElementById('workspace-title');
    if (titleEl) titleEl.innerText = title;
    
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
                    <div class="review-stat-label">Average rating</div>
                    <div class="review-stat-value" id="review-average-rating">—</div>
                </div>
                <div class="review-stat-box">
                    <div class="review-stat-label">Approved</div>
                    <div class="review-stat-value" id="review-approved-count">0</div>
                </div>
                <div class="review-stat-box">
                    <div class="review-stat-label">Rejected</div>
                    <div class="review-stat-value" id="review-rejected-count">0</div>
                </div>
            </div>
            <div class="review-sections">
                <section class="review-section">
                    <h3>Pending reviews</h3>
                    <div id="review-pending-list" class="review-list"></div>
                </section>
                <section class="review-section">
                    <h3>Recent action log</h3>
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
                <button class="review-action-btn repost-btn" data-id="${comment.id}" data-action="repost" data-i18n="review.action.repost">Send back</button>
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
                <span class="status-badge ${comment.status}">${comment.status}</span>
                <span data-i18n="">Reviewed by ${comment.reviewed_by || 'System'}</span>
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
    .catch(error => alert(error.message));
}

// Settings UI
function loadSettings() {
    const html = `
        <div class="settings-panel" style="padding:20px 16px;">
            <div class="settings-card" style="max-width:100%; padding:20px;">
                <h3>Profile</h3>
                <form id="profile-form">
                    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
                        <div style="flex: 0 0 180px; display:flex; flex-direction:column; align-items:center;">
                            <div id="avatar-preview" style="width:180px;height:180px;border-radius:50%;overflow:hidden;background:#eee;display:flex;align-items:center;justify-content:center; margin-top:12px"></div>
                            <div style="margin-top:10px;"><input type="file" id="profile-photo-input" accept="image/*"></div>
                        </div>
                        <div style="flex:1; min-width:260px;">
                            <label style="display:block; margin-bottom:8px;">Nickname<br><input type="text" id="profile-nickname" class="form-input"></label>
                            <label style="display:block; margin-bottom:8px;">Phone<br><input type="text" id="profile-phone" class="form-input"></label>
                            <label style="display:block; margin-bottom:8px;">Description<br><textarea id="profile-description" class="form-input" rows="4"></textarea></label>
                        </div>
                    </div>
                    <hr style="margin:18px 0; border-color:#eee">
                    <div style="margin-top:6px;">
                        <h4>Change password</h4>
                        <label style="display:block; margin-bottom:8px;">New password<br><input type="password" id="profile-new-password" class="form-input"></label>
                        <label style="display:block; margin-bottom:8px;">Confirm new password<br><input type="password" id="profile-new-password-confirm" class="form-input"></label>
                    </div>
                    <div style="margin-top:16px;"><button id="profile-save-btn" class="coach-action-btn">Save profile</button></div>
                </form>
            </div>
        </div>
    `;

    updateWorkspace('Settings', '', html);

    // fetch current profile
    fetchJson('/profile-api/')
        .then(data => {
            if (data.status !== 'success') throw new Error(data.message || 'Unable to load profile');
            const u = data.user;
            document.getElementById('profile-nickname').value = u.nickname || '';
            document.getElementById('profile-phone').value = u.phone || '';
            document.getElementById('profile-description').value = u.description || '';
            const preview = document.getElementById('avatar-preview');
            if (u.avatar) preview.innerHTML = `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover">`;
            else preview.innerHTML = '';

            // photo input preview
            const photoInput = document.getElementById('profile-photo-input');
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
            });

            document.getElementById('profile-save-btn').addEventListener('click', (ev) => {
                ev.preventDefault();
                const fd = new FormData();
                fd.append('nickname', document.getElementById('profile-nickname').value);
                fd.append('phone', document.getElementById('profile-phone').value);
                fd.append('description', document.getElementById('profile-description').value);
                fd.append('new_password', document.getElementById('profile-new-password').value || '');
                fd.append('new_password_confirm', document.getElementById('profile-new-password-confirm').value || '');
                const file = document.getElementById('profile-photo-input').files[0];
                if (file) fd.append('photo', file);

                fetchJson('/profile-api/', { method: 'POST', body: fd, headers: {'X-CSRFToken': getCsrfToken()} })
                    .then(res => {
                        alert(window.t ? window.t('alert.profile_updated') : 'Profile updated');
                    })
                    .catch(err => alert(err.message || 'Error'));
            });
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