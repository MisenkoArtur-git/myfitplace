document.addEventListener('DOMContentLoaded', () => {
    // Robust fetch helper: returns parsed JSON or throws with clear message.
    async function fetchJson(url, opts) {
        const resp = await fetch(url, opts);
        const text = await resp.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { throw new Error(text || 'Server returned non-JSON response'); }
        if (!resp.ok) {
            const msg = (data && (data.error || data.message)) ? (data.error || data.message) : resp.statusText || 'Request failed';
            const err = new Error(msg);
            err.data = data;
            throw err;
        }
        return data;
    }
    // Simple toast notification
    function showNotification(type, message, timeout = 5000) {
        try {
            const container = document.getElementById('site-notification') || (() => {
                const el = document.createElement('div'); el.id = 'site-notification'; document.body.appendChild(el); return el;
            })();
            // remove existing banner(s) so there's only one
            Array.from(container.children).forEach(c => c.remove());
            const toast = document.createElement('div');
            toast.className = 'site-toast ' + (type === 'error' ? 'site-toast-error' : 'site-toast-success');
            // single-line centered message (no title)
            toast.textContent = message;
            container.appendChild(toast);
            // Auto-remove after timeout
            const tm = setTimeout(() => { toast.remove(); }, timeout);
            // clicking anywhere clears
            toast.addEventListener('click', () => { clearTimeout(tm); toast.remove(); });
        } catch (e) { console.error('showNotification error', e); }
    }
    // expose globally so other scripts can call it
    try { window.showNotification = showNotification; } catch (e) {}
    function tr(key, fallback) {
        try { return (window.t && typeof window.t === 'function') ? window.t(key) : fallback; } catch (e) { return fallback; }
    }
        const BASE_FOTO = (window.location && window.location.origin ? window.location.origin : '') + '/media/users/base_foto.jpg';
    // 1. Инициализация элементов
    const modal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const fabToggle = document.getElementById('fab-toggle');
    const fabMenu = document.getElementById('fab-menu');
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const recoveryForm = document.getElementById('recovery-form');
    
    const toSignup = document.getElementById('to-signup');
    const toLogin = document.getElementById('to-login');
    const toRecovery = document.getElementById('to-recovery');
    const backToLogin = document.getElementById('back-to-login');
    
    const submitLogin = document.getElementById('submit-login');
    const submitSignup = document.getElementById('submit-signup');

    // 2. Логика модального окна
    if (openAuthBtn && modal) {
        openAuthBtn.addEventListener('click', (e) => { e.preventDefault(); modal.style.cssText = 'display: flex !important'; });
    }
    const openAuthBtn2 = document.getElementById('open-auth-btn-2');
    if (openAuthBtn2 && modal) {
        openAuthBtn2.addEventListener('click', (e) => { e.preventDefault(); modal.style.cssText = 'display: flex !important'; });
    }
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', (e) => {
            const header = document.querySelector('.main-header');
            if (!header) return;
            const open = header.classList.toggle('menu-open');
            mobileMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            mobileMenuToggle.textContent = open ? 'Close' : 'Menu';
            // adjust main padding based on new header size when menu opens/closes
            try { updateHeaderHeight(); } catch (e) {}
        });
    }
    // Floating FAB toggle: open/close vertical menu
    if (fabToggle && fabMenu) {
        fabToggle.addEventListener('click', (e) => {
            const open = document.body.classList.toggle('fab-open');
            fabToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            fabMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
            // update header height after menu change
            try { updateHeaderHeight(); } catch (e) {}
        });
        // close on outside click
        window.addEventListener('click', (e) => {
            if (!document.body.classList.contains('fab-open')) return;
            if (e.target === fabToggle || fabToggle.contains(e.target) || fabMenu.contains(e.target)) return;
            document.body.classList.remove('fab-open');
            fabToggle.setAttribute('aria-expanded', 'false');
            fabMenu.setAttribute('aria-hidden', 'true');
            try { updateHeaderHeight(); } catch (e) {}
        });
        // close on Escape
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.body.classList.remove('fab-open'); fabToggle.setAttribute('aria-expanded', 'false'); fabMenu.setAttribute('aria-hidden', 'true'); try { updateHeaderHeight(); } catch (err) {} } });
    }

    // Dynamically compute header height and set CSS variable so main content
    // is always positioned below the fixed header (prevents header overlapping hero)
    function updateHeaderHeight() {
        const header = document.querySelector('.main-header');
        if (!header) return;
        const rect = header.getBoundingClientRect();
        const h = Math.ceil(rect.height);
        // Also measure mobile toolbar height (if visible) and expose as CSS variable
        let mt = 0;
        try {
            const mobileToolbar = document.querySelector('.mobile-toolbar');
            if (mobileToolbar) {
                const style = window.getComputedStyle(mobileToolbar);
                const r2 = mobileToolbar.getBoundingClientRect();
                    if (r2.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') mt = Math.ceil(r2.height);
                    // add small buffer so content never gets too close to toolbar
                    if (mt > 0) mt = mt + 18; // extra 18px padding
            }
        } catch (e) { mt = 0; }

        document.documentElement.style.setProperty('--header-height', h + 'px');
        document.documentElement.style.setProperty('--mobile-toolbar-height', mt + 'px');
    }
    // Call on load and when window resizes
    try { updateHeaderHeight(); } catch (e) {}
    window.addEventListener('resize', () => { try { updateHeaderHeight(); } catch (e) {} });
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => { modal.style.cssText = 'display: none !important'; });
    }
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.cssText = 'display: none !important'; });

    // 3. Логика переключения форм
    function showForm(formToShow) {
        [loginForm, signupForm, recoveryForm].forEach(form => {
            if (form) form.classList.add('hidden-block');
        });
        if (formToShow) formToShow.classList.remove('hidden-block');
    }

    toSignup?.addEventListener('click', (e) => { e.preventDefault(); showForm(signupForm); });
    toLogin?.addEventListener('click', (e) => { e.preventDefault(); showForm(loginForm); });
    toRecovery?.addEventListener('click', (e) => { e.preventDefault(); showForm(recoveryForm); });
    backToLogin?.addEventListener('click', (e) => { e.preventDefault(); showForm(loginForm); });

    // 4. Логика отправки Login
    // Universal AJAX form submit helper
    async function ajaxSubmitForm(formEl, url, opts = {}) {
        // opts: onSuccess(json), method
        const method = (opts.method || 'POST').toUpperCase();
        // clear previous invalid markers
        formEl.querySelectorAll('.input-invalid').forEach(el => el.classList.remove('input-invalid'));

        // collect data from inputs with name
        const data = {};
        formEl.querySelectorAll('input[name], textarea[name], select[name]').forEach(el => {
            const name = el.getAttribute('name');
            if (!name) return;
            if (el.type === 'checkbox') data[name] = el.checked;
            else data[name] = el.value;
        });

        // basic client-side validation rules (email, password, nickname)
        const emailEl = formEl.querySelector('input[type="email"][name]');
        if (emailEl && emailEl.value) {
            const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
            if (!emailRe.test(emailEl.value)) {
                emailEl.classList.add('input-invalid');
                showNotification('error', tr('validation.email_invalid', 'Please enter a valid email.'));
                return;
            }
        }

        const passEl = formEl.querySelector('input[type="password"][name*="password"]');
        const passConfirmEl = formEl.querySelector('input[type="password"][name*="confirm"]');
        // Only enforce strong-password rules on signup form (not on login)
        if (formEl && formEl.id === 'signup-form' && passEl && passEl.value) {
            const pw = passEl.value;
            if (pw.length < 8) {
                passEl.classList.add('input-invalid');
                showNotification('error', tr('validation.password_short', 'Password must be at least 8 characters.'));
                return;
            }
            // require at least one uppercase, one lowercase, one digit and one special char
            if (!/[A-Z]/.test(pw)) {
                passEl.classList.add('input-invalid');
                showNotification('error', 'Пароль должен содержать хотя бы одну заглавную букву.');
                return;
            }
            if (!/[a-z]/.test(pw)) {
                passEl.classList.add('input-invalid');
                showNotification('error', 'Пароль должен содержать хотя бы одну строчную букву.');
                return;
            }
            if (!/\d/.test(pw)) {
                passEl.classList.add('input-invalid');
                showNotification('error', 'Пароль должен содержать хотя бы одну цифру.');
                return;
            }
            if (!/[!@#$%^&*()_+\-\=\[\]{};':"\\|,.<>\/\?]/.test(pw)) {
                passEl.classList.add('input-invalid');
                showNotification('error', 'Пароль должен содержать хотя бы один специальный символ.');
                return;
            }
        }
        if (formEl && formEl.id === 'signup-form' && passEl && passConfirmEl && passEl.value !== passConfirmEl.value) {
            passConfirmEl.classList.add('input-invalid');
            showNotification('error', tr('validation.passwords_mismatch', 'Passwords do not match.'));
            return;
        }

        const nicknameEl = formEl.querySelector('input[name="signup-nickname"]');
        if (nicknameEl && nicknameEl.value) {
            if (nicknameEl.value.length < 2 || nicknameEl.value.length > 50) {
                    nicknameEl.classList.add('input-invalid');
                    showNotification('error', tr('validation.nickname_length', 'Nickname must be between 2 and 50 characters.'));
                return;
            }
        }

        // send JSON
        const csrfTokenEl = document.querySelector('[name=csrfmiddlewaretoken]');
        const headers = { 'Content-Type': 'application/json' };
        if (csrfTokenEl) headers['X-CSRFToken'] = csrfTokenEl.value;

        let resp;
        try {
            resp = await fetch(url, { method, headers, body: JSON.stringify(data) });
        } catch (err) {
            showNotification('error', tr('network.error', 'Network error'));
            return;
        }

        if (resp.ok) {
            let json = {};
            try { json = await resp.json(); } catch (e) {}
            const msg = (json && (json.message || json.status === 'success' && json.message)) || tr('generic.success', 'Success');
            showNotification('success', msg);
            if (typeof opts.onSuccess === 'function') opts.onSuccess(json);
            return json;
        }

        // handle error response
        let errJson = null;
        try { errJson = await resp.json(); } catch (e) {}
        // If server returned structured field errors, display them under inputs
        if (errJson && errJson.errors) {
            try {
                Object.keys(errJson.errors).forEach(field => {
                    // map server field keys to form input names/ids
                    const fieldId = field.startsWith('signup-') ? field : field;
                    const el = formEl.querySelector(`[name="${fieldId}"]`) || formEl.querySelector(`[name*="${field}"]`);
                    const errEl = document.getElementById((el && el.getAttribute('name')) ? el.getAttribute('name') + '-error' : (field + '-error'));
                    if (errEl) errEl.textContent = Array.isArray(errJson.errors[field]) ? errJson.errors[field].join('; ') : errJson.errors[field];
                    if (el) el.classList.add('input-invalid');
                });
            } catch (e) { console.error('Rendering field errors failed', e); }
            // also show a brief toast summary
            const summary = Object.values(errJson.errors).flat().slice(0,3).join('; ');
            showNotification('error', summary || tr('validation.error', 'Validation error'));
            return;
        }

        const errMsg = (errJson && (errJson.error || errJson.message)) || resp.statusText || tr('server.error', 'Server error');
        showNotification('error', errMsg);
        return null;
    }

    if (submitLogin) {
            submitLogin.addEventListener('click', (e) => {
                e.preventDefault();
                ajaxSubmitForm(loginForm, '/login-api/', { onSuccess: (json) => {
                    // Remember email logic...
                    const email = document.getElementById('login-email')?.value || '';
                    const rememberCb = document.getElementById('login-remember');
                    try {
                        if (rememberCb && rememberCb.checked) localStorage.setItem('rememberedEmail', email);
                        else localStorage.removeItem('rememberedEmail');
                    } catch (err) {}

                    // ИСПРАВЛЕННЫЙ БЛОК:
                    // Мы принудительно используем только функцию перевода tr()
                    showNotification('success', tr('auth.logged_in', 'Logged in'));
                    setTimeout(() => window.location.reload(), 900);
                }});
            });
        }

    // On load, prefill login email only if user previously chose Remember me
    try {
        const saved = localStorage.getItem('rememberedEmail');
        const emailInput = document.getElementById('login-email');
        const rememberCb = document.getElementById('login-remember');
        if (saved && emailInput) {
            emailInput.value = saved;
            if (rememberCb) rememberCb.checked = true;
        } else if (rememberCb) {
            rememberCb.checked = false;
        }
    } catch (err) { /* ignore storage errors */ }

    // Logout handler: intercept logout link and perform POST to return JSON
    const logoutLink = document.getElementById('logout-btn');
        if (logoutLink) {
            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = logoutLink.getAttribute('href') || '/logout/';
                const csrfTokenEl = document.querySelector('[name=csrfmiddlewaretoken]');
                const headers = { 'Content-Type': 'application/json' };
                if (csrfTokenEl) headers['X-CSRFToken'] = csrfTokenEl.value;
                
                try {
                    const resp = await fetch(url, { method: 'POST', headers });
                    if (resp.ok) {
                        // Используем ТОЛЬКО tr(), игнорируя сообщение сервера
                        showNotification('success', tr('auth.logged_out', 'You have logged out'));
                        setTimeout(() => window.location.reload(), 900);
                    } else {
                        // Используем ТОЛЬКО tr() для ошибки
                        showNotification('error', tr('auth.logout_error', 'Error logging out'));
                    }
                } catch (err) {
                    showNotification('error', tr('network.error', 'Network error'));
                }
            });
        }

    // Also bind mobile logout button if present
    const logoutLinkMobile = document.getElementById('logout-btn-mobile');
    if (logoutLinkMobile) {
        logoutLinkMobile.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = logoutLinkMobile.getAttribute('href') || '/logout/';
            const csrfTokenEl = document.querySelector('[name=csrfmiddlewaretoken]');
            const headers = { 'Content-Type': 'application/json' };
            if (csrfTokenEl) headers['X-CSRFToken'] = csrfTokenEl.value;
            try {
                const resp = await fetch(url, { method: 'POST', headers });
                if (resp.ok) {
                    showNotification('success', tr('auth.logged_out', 'You have logged out'));
                    setTimeout(() => window.location.reload(), 900);
                } else {
                    showNotification('error', tr('auth.logout_error', 'Error logging out'));
                }
            } catch (err) {
                showNotification('error', tr('network.error', 'Network error'));
            }
        });
    }

    // show/hide password checkboxes (styled like Remember me)
    document.querySelectorAll('.show-pass-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const targets = (cb.dataset.targets || cb.getAttribute('data-targets') || cb.dataset.target || cb.getAttribute('data-target'));
            if (!targets) return;
            const ids = targets.split(',').map(s => s.trim()).filter(Boolean);
            ids.forEach(id => {
                const input = document.getElementById(id);
                if (!input) return;
                input.type = cb.checked ? 'text' : 'password';
            });
        });
    });

    // 5. Логика отправки Sign Up
    if (submitSignup) {
        submitSignup.addEventListener('click', (e) => {
            e.preventDefault();
            ajaxSubmitForm(signupForm, '/signup-api/', { onSuccess: () => window.location.reload() });
        });
    }

    // Real-time validation for signup fields (optional immediate feedback)
    function renderPwChecklist(elId, pw) {
        const pwChecks = {
            length: pw.length >= 8,
            upper: /[A-Z]/.test(pw),
            lower: /[a-z]/.test(pw),
            digit: /\d/.test(pw),
            special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
        };
        const el = document.getElementById(elId + '-error');
        if (!el) return;
        el.innerHTML = `<ul class="pw-req">
            <li class="${pwChecks.length ? 'met' : 'unmet'}">At least 8 characters</li>
            <li class="${pwChecks.upper ? 'met' : 'unmet'}">At least one uppercase letter</li>
            <li class="${pwChecks.lower ? 'met' : 'unmet'}">At least one lowercase letter</li>
            <li class="${pwChecks.digit ? 'met' : 'unmet'}">At least one number</li>
            <li class="${pwChecks.special ? 'met' : 'unmet'}">At least one special character</li>
        </ul>`;
    }

    const liveChecks = [
        { id: 'signup-email', fn: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) || 'Введите корректный email.' },
        { id: 'signup-password', fn: (v) => true },
        { id: 'signup-password-confirm', fn: (v) => true },
        { id: 'signup-nickname', fn: (v) => (!v || (v.length >=2 && v.length <=50)) || 'Никнейм должен быть от 2 до 50 символов.' },
    ];
    liveChecks.forEach(ch => {
        const el = document.getElementById(ch.id);
        if (!el) return;
        el.addEventListener('input', () => {
            const res = ch.fn(el.value);
            const errEl = document.getElementById(ch.id + '-error');
            if (ch.id === 'signup-password') {
                renderPwChecklist('signup-password', el.value);
                if (el.value.length === 0) {
                    if (errEl) errEl.textContent = '';
                    el.classList.remove('input-invalid');
                }
                return;
            }
            if (res === true) {
                if (errEl) errEl.textContent = '';
                el.classList.remove('input-invalid');
            } else {
                if (errEl) errEl.textContent = res;
                el.classList.add('input-invalid');
            }
        });
    });

    // Small footer controls (deprecated) - kept for backward compatibility
    const commentStars = document.querySelectorAll('#comment-stars .star');
    const commentRatingInput = document.getElementById('comment-rating');
    const commentText = document.getElementById('comment-text');
    const submitCommentBtn = document.getElementById('submit-comment');

    // Full-width controls
    const commentStarsFull = document.querySelectorAll('#comment-stars-full .star');
    const commentRatingFull = document.getElementById('comment-rating-full');
    const commentTextFull = document.getElementById('comment-text-full');
    const submitCommentFull = document.getElementById('submit-comment-full');

    // Debug: ensure elements exist
    if (!commentStarsFull || commentStarsFull.length === 0) console.debug('No full-width stars found');
    if (!commentRatingFull) console.debug('No commentRatingFull input found');
    if (!commentTextFull) console.debug('No commentTextFull textarea found');
    if (!submitCommentFull) console.debug('No submitCommentFull button found');

    function updateStarDisplay(rating) {
        commentStars.forEach(star => {
            const value = Number(star.dataset.value);
            star.classList.toggle('active', value <= rating);
        });
    }

    commentStars.forEach(star => {
        star.addEventListener('click', () => {
            const value = Number(star.dataset.value);
            if (commentRatingInput) commentRatingInput.value = value;
            updateStarDisplay(value);
        });
    });

    try {
        commentStarsFull.forEach(star => {
            star.addEventListener('click', () => {
                const value = Number(star.dataset.value);
                    if (commentRatingFull) commentRatingFull.value = value;
                    // Update star visuals only; radios were removed from the template
                    commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= value));
            });
        });
    } catch (err) {
        console.error('Error attaching star listeners', err);
    }

    // Radios removed: no listeners needed — stars update the hidden input directly

    async function loadComments() {
        const commentsList = document.getElementById('comments-list') || document.getElementById('comments-list-full');
        if (!commentsList) return;

        try {
            const data = await fetchJson('/comments-api/');
            if (data.status !== 'success') throw new Error(data.message || 'Unable to load comments');

            // Public API doesn't return aggregate rating/counts — ignore aggregates here.

            if (!data.comments.length) {
                const msg = window.t ? window.t('reviews.no_pending') : 'No reviews yet. Be the first to leave one!';
                commentsList.innerHTML = `<p class="no-comments">${msg}</p>`;
                if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
                return;
            }

            commentsList.innerHTML = data.comments.map(comment => {
                const statusBadge = comment.status === 'pending'
                    ? `<span class="pending-label">${(window.t && typeof window.t === 'function') ? window.t('review.pending_label','Pending approval') : 'Pending approval'}</span>`
                    : '';
                const mineLabel = comment.is_mine ? '<span class="mine-label">(Your review)</span>' : '';
                
                // Generate star rating display
                const stars = Array.from({length: 5}, (_, i) => 
                    i < comment.rating ? '★' : '☆'
                ).join('');

                const avatarHtml = `<img class="comment-avatar" src="${comment.author_avatar || BASE_FOTO}" alt="avatar">`;

                return `
                    <div class="comment-item">
                        <div class="comment-top">
                            <div style="display:flex; align-items:center; gap:12px;">
                                ${avatarHtml}
                                <div>
                                    <div class="author-name">${comment.author_name} ${mineLabel}</div>
                                    <div class="comment-meta">${comment.created_at} <span class="rating-display">${stars}</span> ${statusBadge}</div>
                                </div>
                            </div>
                        </div>
                        <p>${comment.text}</p>
                    </div>
                `;
            }).join('');
                if (window.applyTranslations) window.applyTranslations(localStorage.getItem('site_lang') || 'en');
        } catch (error) {
            const userMsg = window.t ? window.t('reviews.load_error') : 'Unable to load reviews at the moment.';
            if (commentsList) commentsList.innerHTML = `<p class="no-comments">${userMsg}</p>`;
            console.error('loadComments error:', error);
        }
    }

    if (submitCommentBtn) {
        submitCommentBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.IS_AUTH === false || document.getElementById('open-auth-btn')) {
                showNotification('error', tr('comments.auth_required', 'Only registered users can leave comments.'));
                return;
            }
            const rating = Number(commentRatingInput?.value || 0);
            const text = commentText.value.trim();
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (!text) {
                showNotification('error', tr('comment.enter_text', 'Please enter review text.'));
                return;
            }

            try {
                await fetchJson('/comment-create-api/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, body: JSON.stringify({ comment_text: text, comment_rating: rating }) });
                showNotification('success', tr('comment.sent_success', 'Review sent — it will be reviewed by the administrator.'));
                commentText.value = '';
                if (commentRatingInput) commentRatingInput.value = '0';
                updateStarDisplay(0);
                loadComments();
            } catch (error) {
                showNotification('error', error.message || tr('comment.send_error', 'Error sending review.'));
            }
        });
    }

    if (submitCommentFull) {
        submitCommentFull.addEventListener('click', async (e) => {
            e.preventDefault();
            let rating = Number(commentRatingFull?.value || 0);
            if (!rating || rating < 1 || rating > 5) rating = 5; // enforce 1-5
            const text = commentTextFull.value.trim();
            const authFlag = submitCommentFull.dataset.auth === '1';
            if (!authFlag || window.IS_AUTH === false) {
                showNotification('error', tr('comments.auth_required', 'Only registered users can leave comments.'));
                return;
            }
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (!text) {
                showNotification('error', tr('comment.enter_text', 'Please enter review text.'));
                return;
            }

            try {
                await fetchJson('/comment-create-api/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, body: JSON.stringify({ comment_text: text, comment_rating: rating }) });
                showNotification('success', tr('comment.sent_success', 'Review sent — it will be reviewed by the administrator.'));
                commentTextFull.value = '';
                if (commentRatingFull) commentRatingFull.value = '5';
                // Radios were removed from template; just reset hidden input and visuals
                commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= 5));
                loadComments();
            } catch (error) {
                showNotification('error', error.message || tr('comment.send_error', 'Error sending review.'));
            }
        });
    }

    loadComments();
});

