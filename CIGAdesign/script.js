/**
 * CIGA design Brasil · Homepage · Presskit Index
 * script.js
 */

(function () {
    'use strict';

    /* ================================================================
       NAV SCROLL EFFECT
       Adiciona classe "scrolled" no header quando o usuário rola
       mais de 60px, ativando o fundo escuro e o blur da nav.
    ================================================================ */
    const navHeader = document.getElementById('navHeader');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 60) {
            navHeader.classList.add('scrolled');
        } else {
            navHeader.classList.remove('scrolled');
        }
    }, { passive: true });


    /* ================================================================
       SMOOTH SCROLL
       Faz os links de âncora (#colecao, #sobre, #contato) rolarem
       suavemente até a seção, descontando a altura da nav fixa (80px).
    ================================================================ */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });


    /* ================================================================
       FILTER BUTTONS — COLEÇÃO
       Filtra os cards da grade por gênero (todos / masculino / feminino).
       Cards não correspondentes recebem classe "hidden" (display: none).
       Cards featured (Blue Planet) são forçados para coluna simples
       quando o filtro feminino está ativo.
    ================================================================ */
    const filterBtns = document.querySelectorAll('.filter-btn');
    const watchCards = document.querySelectorAll('.watch-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            watchCards.forEach(card => {
                if (filter === 'todos' || card.dataset.gender === filter) {
                    card.classList.remove('hidden');
                    card.style.animation = 'cardReveal 0.4s ease both';
                } else {
                    card.classList.add('hidden');
                }
            });

            const featuredCards = document.querySelectorAll('.watch-card--featured');
            featuredCards.forEach(c => {
                c.style.gridColumn = filter === 'feminino' && !c.classList.contains('hidden') ? '1' : '';
            });
        });
    });


    /* ================================================================
       CARD REVEAL — INTERSECTION OBSERVER
       Anima os cards da coleção conforme entram na viewport ao rolar.
       Usa delay escalonado por posição (a cada 4 cards, reinicia o delay).
    ================================================================ */
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

    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = Array.from(watchCards).indexOf(entry.target);
                entry.target.style.animationDelay = `${(idx % 4) * 80}ms`;
                entry.target.classList.add('visible');
                cardObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    watchCards.forEach(card => cardObserver.observe(card));


    /* ================================================================
       FADE-IN — SOBRE E CONTATO
       Anima as seções "Sobre a Marca" e "Contato" com fade + slide up
       conforme entram na viewport.
    ================================================================ */
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
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.about-inner, .contact-inner').forEach(el => fadeObserver.observe(el));


    /* ================================================================
       COUNT-UP — ESTATÍSTICAS DO HERO
       Anima os números da seção hero (13 modelos, 1 prêmio, 23.5K+)
       com efeito de contagem crescente ao entrar na viewport.
    ================================================================ */
    const statNumbers = document.querySelectorAll('.hero-stat-number');

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const text = el.textContent.trim();
            const dur = 1200;

            const run = (from, to, suffix, decimals) => {
                const started = performance.now();
                const tick = (now) => {
                    const p = Math.min((now - started) / dur, 1);
                    const ease = 1 - Math.pow(1 - p, 4);
                    el.textContent = (from + (to - from) * ease).toFixed(decimals) + suffix;
                    if (p < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            };

            if (text === '13')     run(0, 13, '', 0);
            if (text === '1')      run(0, 1, '', 0);
            if (text === '23.5K+') run(0, 23.5, 'K+', 1);

            statsObserver.unobserve(el);
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statsObserver.observe(el));


    /* ================================================================
       CURSOR GLOW — GRADE DE RELÓGIOS
       Rastreia a posição do mouse sobre a grade e expõe as variáveis
       CSS --mouse-x e --mouse-y para efeitos de luz no CSS, se houver.
    ================================================================ */
    const grid = document.querySelector('.watches-grid');
    if (grid) {
        grid.addEventListener('mousemove', (e) => {
            const rect = grid.getBoundingClientRect();
            grid.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            grid.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    }

})();
