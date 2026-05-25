document.addEventListener('DOMContentLoaded', () => {
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
                const response = await fetch('/login-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ 
                        'login-email': email, 
                        'login-password': password 
                    })
                });
                
                const result = await response.json();
                if (response.ok) { 
                    window.location.reload();
                } else { 
                    alert(result.message || 'Невірний логін або пароль'); 
                }
            } catch (error) { alert('Помилка сервера.'); }
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
                const response = await fetch('/signup-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ 
                        'signup-nickname': nickname, 
                        'signup-email': email, 
                        'signup-password': password,
                        'signup-password-confirm': confirmPassword
                    })
                });
                
                const result = await response.json();
                if (response.ok) {
                    alert('Реєстрація успішна!');
                    window.location.reload(); 
                } else {
                    alert(result.message || 'Помилка при реєстрації.');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Помилка сервера.');
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

    commentStarsFull.forEach(star => {
        star.addEventListener('click', () => {
            const value = Number(star.dataset.value);
            if (commentRatingFull) commentRatingFull.value = value;
            commentStarsFull.forEach(s => s.classList.toggle('active', Number(s.dataset.value) <= value));
        });
    });

    async function loadComments() {
        const commentsList = document.getElementById('comments-list') || document.getElementById('comments-list-full');
        if (!commentsList) return;

        try {
            const response = await fetch('/comments-api/');
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.message || 'Unable to load comments');

            // Public API doesn't return aggregate rating/counts — ignore aggregates here.

            if (!data.comments.length) {
                commentsList.innerHTML = '<p class="no-comments">No reviews yet. Be the first to leave one!</p>';
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

                return `
                    <div class="comment-item">
                        <div class="comment-top">
                            <div>
                                <div class="author-name">${comment.author_name} ${mineLabel}</div>
                                <div class="comment-meta">${comment.created_at} <span class="rating-display">${stars}</span> ${statusBadge}</div>
                            </div>
                        </div>
                        <p>${comment.text}</p>
                    </div>
                `;
            }).join('');
        } catch (error) {
            if (commentsList) commentsList.innerHTML = `<p class="no-comments">${error.message}</p>`;
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
                const response = await fetch('/comment-create-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ comment_text: text, comment_rating: rating })
                });
                const data = await response.json();
                if (response.ok) {
                    alert('Your review was submitted and is pending admin approval.');
                    commentText.value = '';
                    if (commentRatingInput) commentRatingInput.value = '0';
                    updateStarDisplay(0);
                    loadComments();
                } else {
                    alert(data.message || 'Unable to submit comment.');
                }
            } catch (error) {
                alert('Server error while sending your comment.');
            }
        });
    }

    if (submitCommentFull) {
        submitCommentFull.addEventListener('click', async (e) => {
            e.preventDefault();
            const rating = Number(commentRatingFull?.value || 0);
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
                const response = await fetch('/comment-create-api/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ comment_text: text, comment_rating: rating })
                });
                const data = await response.json();
                if (response.ok) {
                    alert('Your review was submitted and is pending admin approval.');
                    commentTextFull.value = '';
                    if (commentRatingFull) commentRatingFull.value = '0';
                    commentStarsFull.forEach(s => s.classList.remove('active'));
                    loadComments();
                } else {
                    alert(data.message || 'Unable to submit comment.');
                }
            } catch (error) {
                alert('Server error while sending your comment.');
            }
        });
    }

    loadComments();
});