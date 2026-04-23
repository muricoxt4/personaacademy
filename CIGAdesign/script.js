/**
 * CIGA design Brasil · Homepage · Presskit Index
 * script.js
 */

(function () {
    'use strict';

    const navHeader = document.getElementById('navHeader');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (navHeader) {
        window.addEventListener('scroll', () => {
            navHeader.classList.toggle('scrolled', window.scrollY > 60);
        }, { passive: true });
    }

    const getAnchorOffset = () => {
        const headerHeight = navHeader ? navHeader.offsetHeight : 0;
        return headerHeight + 16;
    };

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (!target) {
                return;
            }

            event.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - getAnchorOffset();
            window.scrollTo({
                top,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        });
    });

    const filterBtns = document.querySelectorAll('.filter-btn');
    const watchCards = document.querySelectorAll('.watch-card');

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((button) => button.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            watchCards.forEach((card) => {
                const isMatch = filter === 'todos' || card.dataset.gender === filter;
                card.classList.toggle('hidden', !isMatch);

                if (isMatch && !prefersReducedMotion) {
                    card.style.animation = 'cardReveal 0.4s ease both';
                } else {
                    card.style.animation = '';
                }
            });

            document.querySelectorAll('.watch-card--featured').forEach((card) => {
                card.style.gridColumn = filter === 'feminino' && !card.classList.contains('hidden') ? '1' : '';
            });
        });
    });

    const revealStyle = document.createElement('style');
    revealStyle.textContent = `
        @keyframes cardReveal {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .watch-card { opacity: 0; transform: translateY(20px); }
        .watch-card.visible {
            animation: cardReveal 0.55s cubic-bezier(0.4, 0, 0.2, 1) both;
            opacity: 1; transform: none;
        }
    `;
    document.head.appendChild(revealStyle);

    if ('IntersectionObserver' in window) {
        const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const idx = Array.from(watchCards).indexOf(entry.target);
                if (!prefersReducedMotion) {
                    entry.target.style.animationDelay = `${(idx % 4) * 80}ms`;
                }
                entry.target.classList.add('visible');
                cardObserver.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        watchCards.forEach((card) => cardObserver.observe(card));

        const fadeStyle = document.createElement('style');
        fadeStyle.textContent = `
            .about-inner, .contact-inner {
                opacity: 0; transform: translateY(24px);
                transition: opacity 0.7s ease, transform 0.7s ease;
            }
            .about-inner.visible, .contact-inner.visible {
                opacity: 1; transform: none;
            }
        `;
        document.head.appendChild(fadeStyle);

        const fadeObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('.about-inner, .contact-inner').forEach((element) => fadeObserver.observe(element));

        const statNumbers = document.querySelectorAll('.hero-stat-number');
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const el = entry.target;
                const text = el.textContent.trim();

                if (prefersReducedMotion) {
                    statsObserver.unobserve(el);
                    return;
                }

                const dur = 1200;
                const run = (from, to, suffix, decimals) => {
                    const started = performance.now();
                    const tick = (now) => {
                        const p = Math.min((now - started) / dur, 1);
                        const ease = 1 - Math.pow(1 - p, 4);
                        el.textContent = (from + (to - from) * ease).toFixed(decimals) + suffix;
                        if (p < 1) {
                            requestAnimationFrame(tick);
                        }
                    };
                    requestAnimationFrame(tick);
                };

                if (text === '13') run(0, 13, '', 0);
                if (text === '1') run(0, 1, '', 0);
                if (text === '23.5K+') run(0, 23.5, 'K+', 1);

                statsObserver.unobserve(el);
            });
        }, { threshold: 0.5 });

        statNumbers.forEach((el) => statsObserver.observe(el));
    } else {
        watchCards.forEach((card) => card.classList.add('visible'));
        document.querySelectorAll('.about-inner, .contact-inner').forEach((element) => element.classList.add('visible'));
    }

    const grid = document.querySelector('.watches-grid');
    if (grid) {
        grid.addEventListener('mousemove', (event) => {
            const rect = grid.getBoundingClientRect();
            grid.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
            grid.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
        }, { passive: true });
    }
})();
