document.addEventListener('DOMContentLoaded', () => {
    // Robust fetch helper: returns parsed JSON or throws with clear message.
    async function fetchJson(url, opts) {
        const resp = await fetch(url, opts);
        const text = await resp.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { throw new Error(text || 'Server returned non-JSON response'); }
        if (!resp.ok) {
            const msg = (data && data.message) ? data.message : resp.statusText || 'Request failed';
            throw new Error(msg);
        }
        return data;
    }
    // 1. Инициализация элементов
    const modal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    
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
    if (submitLogin) {
        submitLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                await fetchJson('/login-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ 'login-email': email, 'login-password': password })
                });
                window.location.reload();
            } catch (error) { alert(error.message || 'Невірний логін або пароль'); }
        });
    }

    // 5. Логика отправки Sign Up
    if (submitSignup) {
        submitSignup.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const nickname = document.getElementById('signup-nickname').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-password-confirm').value;
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (password !== confirmPassword) {
                alert('Паролі не співпадають!');
                return;
            }

            try {
                await fetchJson('/signup-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ 'signup-nickname': nickname, 'signup-email': email, 'signup-password': password, 'signup-password-confirm': confirmPassword })
                });
                alert('Реєстрація успішна!');
                window.location.reload();
            } catch (error) {
                console.error('Ошибка:', error);
                alert(error.message || 'Помилка при реєстрації.');
            }
        });
    }

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
                // check corresponding radio if exists
                const radio = document.querySelector(`input[name="rating-full"][value="${value}"]`);
                if (radio) radio.checked = true;
                commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= value));
            });
        });
    } catch (err) {
        console.error('Error attaching star listeners', err);
    }

    // Radios under stars: update hidden input and star visuals
    const ratingRadios = document.querySelectorAll('input[name="rating-full"]');
    if (ratingRadios && ratingRadios.length) {
        ratingRadios.forEach(r => {
            r.addEventListener('change', () => {
                const val = Number(r.value);
                if (commentRatingFull) commentRatingFull.value = val;
                commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= val));
            });
        });
    }

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
                    ? `<span class="pending-label">Pending approval</span>`
                    : '';
                const mineLabel = comment.is_mine ? '<span class="mine-label">(Your review)</span>' : '';
                
                // Generate star rating display
                const stars = Array.from({length: 5}, (_, i) => 
                    i < comment.rating ? '★' : '☆'
                ).join('');

                const avatarHtml = comment.author_avatar
                    ? `<img class="comment-avatar" src="${comment.author_avatar}" alt="avatar">`
                    : `<span class="comment-avatar placeholder"></span>`;

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
            const rating = Number(commentRatingInput?.value || 0);
            const text = commentText.value.trim();
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (!text) {
                alert('Please enter a review message.');
                return;
            }

            try {
                await fetchJson('/comment-create-api/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, body: JSON.stringify({ comment_text: text, comment_rating: rating }) });
                alert('Your review was submitted and is pending admin approval.');
                commentText.value = '';
                if (commentRatingInput) commentRatingInput.value = '0';
                updateStarDisplay(0);
                loadComments();
            } catch (error) {
                alert(error.message || 'Server error while sending your comment.');
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
            if (!authFlag) {
                // open auth modal for anonymous users
                if (modal) modal.style.display = 'flex';
                return;
            }
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            if (!text) {
                alert('Please enter a review message.');
                return;
            }

            try {
                await fetchJson('/comment-create-api/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }, body: JSON.stringify({ comment_text: text, comment_rating: rating }) });
                alert('Your review was submitted and is pending admin approval.');
                commentTextFull.value = '';
                if (commentRatingFull) commentRatingFull.value = '5';
                // reset radios to default 5
                const defaultRadio = document.querySelector('input[name="rating-full"][value="5"]');
                if (defaultRadio) defaultRadio.checked = true;
                commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= 5));
                loadComments();
            } catch (error) {
                alert(error.message || 'Server error while sending your comment.');
            }
        });
    }

    loadComments();
});

