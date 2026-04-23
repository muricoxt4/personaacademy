const navHeader = document.getElementById('navHeader');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (navHeader) {
    window.addEventListener('scroll', () => {
        navHeader.classList.toggle('scrolled', window.scrollY > 100);
    }, { passive: true });
}

const getAnchorOffset = () => {
    const headerHeight = navHeader ? navHeader.offsetHeight : 0;
    return headerHeight + 16;
};

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
        const target = document.querySelector(anchor.getAttribute('href'));
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

const fadeElements = document.querySelectorAll('.fade-in');

if ('IntersectionObserver' in window) {
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach((element) => fadeObserver.observe(element));
} else {
    fadeElements.forEach((element) => element.classList.add('visible'));
}

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('heroVideo');
    const unmuteBtn = document.getElementById('unmuteBtn');

    if (!video || !unmuteBtn) {
        return;
    }

    const updateUnmuteLabel = () => {
        unmuteBtn.textContent = video.muted ? 'Ativar som' : 'Desativar som';
    };

    video.muted = true;
    updateUnmuteLabel();

    const revealToggle = () => {
        unmuteBtn.style.display = 'inline-flex';
    };

    video.play().then(revealToggle).catch(revealToggle);

    unmuteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        updateUnmuteLabel();
    });
});
