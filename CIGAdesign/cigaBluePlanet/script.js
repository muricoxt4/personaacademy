// Video Sound Control
document.addEventListener("DOMContentLoaded", function() {
    const video = document.getElementById("heroVideo");
    const unmuteBtn = document.getElementById("unmuteBtn");

    // Forçamos o início silenciado para garantir o autoplay
    video.muted = true;
    
    // Tenta dar o play explicitamente
    video.play().then(() => {
        unmuteBtn.style.display = "inline-block";
    }).catch(() => {
        unmuteBtn.style.display = "inline-block";
    });

    unmuteBtn.addEventListener("click", () => {
        if(video.muted) {
            video.muted = false;
            unmuteBtn.innerHTML = "🔇 Desativar Som";
        } else {
            video.muted = true;
            unmuteBtn.innerHTML = "🔊 Ativar Som";
        }
    });
});

// Scroll Effects
const navHeader = document.getElementById('navHeader');

window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navHeader.classList.add('scrolled');
    } else {
        navHeader.classList.remove('scrolled');
    }
});

// Fade In Animation on Scroll
const fadeElements = document.querySelectorAll('.fade-in');

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

fadeElements.forEach(el => fadeObserver.observe(el));

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
