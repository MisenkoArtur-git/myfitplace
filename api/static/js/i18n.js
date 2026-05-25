// Shared client-side i18n for EN/UK
(function(){
    // translations will be loaded from a JSON file at runtime
    let translations = null;

    function applyTranslations(lang){
        const map = (translations && translations[lang]) ? translations[lang] : (translations && translations['en']) ? translations['en'] : {};
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const text = map[key];
            if (!text) return;
            if (key === 'hero.title' && el.querySelector('[data-i18n="hero.highlight"]')){
                const hl = map['hero.highlight'] || '';
                el.innerHTML = `${text} <span class="text-green">${hl}</span>`;
                return;
            }
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
                el.setAttribute('placeholder', text);
                return;
            }
            // preserve icon elements (e.g., <i data-lucide>) when setting text
            const icon = el.querySelector('i[data-lucide], svg');
            if (icon) {
                // remove stray text nodes to avoid duplicate labels (icon + original text)
                Array.from(el.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        node.parentNode.removeChild(node);
                    }
                });

                // find or create a span for text
                let span = el.querySelector('.i18n-text-span');
                if (!span) {
                    span = document.createElement('span');
                    span.className = 'i18n-text-span';
                    // insert span after icon
                    if (icon.nextSibling) icon.parentNode.insertBefore(span, icon.nextSibling);
                    else icon.parentNode.appendChild(span);
                }
                span.innerText = text;
            } else {
                el.innerText = text;
            }
        });
        document.documentElement.lang = (lang === 'uk' ? 'uk' : 'en');
        // ensure icons are rendered (lucide) after translations that may add icon elements
        try { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); } catch(e) { /* ignore */ }
    }

    // expose for other scripts to call after dynamic DOM updates
    window.applyTranslations = applyTranslations;

    // simple getter for single keys with optional param substitution
    window.t = function(key, params){
        try{
            const lang = localStorage.getItem('site_lang') || 'en';
            const map = (translations && translations[lang]) ? translations[lang] : (translations && translations['en']) ? translations['en'] : {};
            let text = map[key] || key;
            if (params && typeof params === 'object'){
                Object.keys(params).forEach(k => {
                    text = text.replace(new RegExp('\{'+k+'\}', 'g'), params[k]);
                });
            }
            return text;
        } catch (e) { return key; }
    };

    function init(){
        const langSwitch = document.getElementById('lang-switch');
        let lang = localStorage.getItem('site_lang') || 'en';
        // load JSON resource
        fetch('/static/js/i18n-data.json').then(r => r.json()).then(data => {
            translations = data;
            applyTranslations(lang);
            if (!langSwitch) return;
            function refreshPills(){
                const pills = langSwitch.querySelectorAll('.lang-pill');
                pills.forEach(p => p.classList.toggle('active', p.getAttribute('data-lang') === lang));
            }
            refreshPills();
            langSwitch.addEventListener('click', (e) => {
                const pill = e.target.closest('.lang-pill');
                if (!pill) return;
                const chosen = pill.getAttribute('data-lang') || 'en';
                if (chosen === lang) return;
                lang = chosen;
                localStorage.setItem('site_lang', lang);
                applyTranslations(lang);
                refreshPills();
            });
        }).catch(err => {
            console.error('i18n load failed', err);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // react to changes in other tabs/windows so selection persists everywhere
    window.addEventListener('storage', (e) => {
        if (e.key === 'site_lang') {
            const newLang = e.newValue || 'en';
            applyTranslations(newLang);
            // if lang-switch exists, refresh visual pills
            const ls = document.getElementById('lang-switch');
            if (ls) {
                ls.querySelectorAll('.lang-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-lang') === newLang));
            }
        }
    });
})();
