/* ============================================================
   CIGA Design - Playbook de Vendas
   Arquivo JavaScript (script.js)
   ============================================================ */

/**
 * ============================================================
 * CLASSE DECK
 * Gerencia toda a navegação e interação do playbook
 * ============================================================
 */
class Deck {
  
  /* ----------------------------------------------------------
     CONSTRUTOR
     Inicializa as propriedades e referências do DOM
     ---------------------------------------------------------- */
  constructor() {
    // 1. Referências aos slides
    this.slides = [...document.querySelectorAll('.slide')];
    this.total = this.slides.length;
    this.cur = 0; // Slide atual
    
    // 2. Referências aos elementos de UI
    this.idx = document.getElementById('idx');       // Overlay do índice
    this.ctr = document.getElementById('ctr');       // Contador de slides
    this.dots = document.getElementById('ndots');    // Container dos dots
    
    // 3. Inicializa o deck
    this.init();
  }

  /* ----------------------------------------------------------
     INIT
     Configura todos os event listeners e observadores
     ---------------------------------------------------------- */
  init() {
    // 1. Cria os dots de navegação
    this.createDots();
    
    // 2. Atualiza estado inicial dos dots
    this.updateDots();
    
    // 3. Configura navegação por teclado
    this.setupKeyboardNavigation();
    
    // 4. Configura navegação por touch (mobile)
    this.setupTouchNavigation();
    
    // 5. Configura cliques no índice
    this.setupIndexNavigation();
    
    // 6. Configura botão de fechar índice
    this.setupCloseButton();
    
    // 7. Inicia observador de intersecção
    this.observe();
  }

  /* ----------------------------------------------------------
     CRIAR DOTS
     Gera os dots de navegação lateral
     ---------------------------------------------------------- */
  createDots() {
    this.slides.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'ndot';
      dot.onclick = () => this.go(i);
      this.dots.appendChild(dot);
    });
  }

  /* ----------------------------------------------------------
     NAVEGAÇÃO POR TECLADO
     Setas, espaço e ESC
     ---------------------------------------------------------- */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
        case ' ':
          // Próximo slide
          this.next();
          break;
        case 'ArrowUp':
          // Slide anterior
          this.prev();
          break;
        case 'Escape':
          // Toggle índice
          this.toggleIdx();
          break;
      }
    });
  }

  /* ----------------------------------------------------------
     NAVEGAÇÃO POR TOUCH
     Swipe up/down no mobile
     ---------------------------------------------------------- */
  setupTouchNavigation() {
    let startY = null;
    
    // Captura posição inicial do touch
    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    // Calcula direção do swipe
    document.addEventListener('touchend', (e) => {
      if (startY === null) return;
      
      const deltaY = startY - e.changedTouches[0].clientY;
      
      // Swipe mínimo de 50px
      if (Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          // Swipe para cima = próximo
          this.next();
        } else {
          // Swipe para baixo = anterior
          this.prev();
        }
      }
      
      startY = null;
    }, { passive: true });
  }

  /* ----------------------------------------------------------
     NAVEGAÇÃO PELO ÍNDICE
     Cliques nos itens do índice
     ---------------------------------------------------------- */
  setupIndexNavigation() {
    document.querySelectorAll('.idx-i').forEach((item) => {
      item.addEventListener('click', () => {
        const targetId = item.dataset.target;
        const targetIndex = this.slides.findIndex(s => s.id === targetId);
        
        if (targetIndex >= 0) {
          this.go(targetIndex);
          this.toggleIdx();
        }
      });
    });
  }

  /* ----------------------------------------------------------
     BOTÃO FECHAR ÍNDICE
     ---------------------------------------------------------- */
  setupCloseButton() {
    document.getElementById('idx-close').onclick = () => this.toggleIdx();
  }

  /* ----------------------------------------------------------
     OBSERVER
     Detecta qual slide está visível usando Intersection Observer
     ---------------------------------------------------------- */
  observe() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 1. Atualiza slide atual
            this.cur = parseInt(entry.target.dataset.i);
            
            // 2. Atualiza contador
            this.updateCtr();
            
            // 3. Atualiza dots
            this.updateDots();
            
            // 4. Anima elementos com reveal
            entry.target.querySelectorAll('.rv').forEach((el) => {
              el.classList.add('vis');
            });
          }
        });
      },
      { threshold: 0.15 } // 50% do slide visível
    );
    
    // Observa todos os slides
    this.slides.forEach((slide) => observer.observe(slide));
  }

  /* ----------------------------------------------------------
     IR PARA SLIDE
     Navega suavemente para um slide específico
     ---------------------------------------------------------- */
  go(index) {
    this.slides[index].scrollIntoView({ behavior: 'smooth' });
  }

  /* ----------------------------------------------------------
     PRÓXIMO SLIDE
     ---------------------------------------------------------- */
  next() {
    if (this.cur < this.total - 1) {
      this.go(this.cur + 1);
    }
  }

  /* ----------------------------------------------------------
     SLIDE ANTERIOR
     ---------------------------------------------------------- */
  prev() {
    if (this.cur > 0) {
      this.go(this.cur - 1);
    }
  }

  /* ----------------------------------------------------------
     TOGGLE ÍNDICE
     Mostra/esconde o overlay do índice
     ---------------------------------------------------------- */
  toggleIdx() {
    this.idx.classList.toggle('show');
  }

  /* ----------------------------------------------------------
     ATUALIZAR CONTADOR
     Atualiza o texto "XX / YY" no canto
     ---------------------------------------------------------- */
  updateCtr() {
    const current = String(this.cur + 1).padStart(2, '0');
    this.ctr.textContent = `${current} / ${this.total}`;
  }

  /* ----------------------------------------------------------
     ATUALIZAR DOTS
     Marca o dot atual como ativo
     ---------------------------------------------------------- */
  updateDots() {
    this.dots.querySelectorAll('.ndot').forEach((dot, index) => {
      dot.classList.toggle('on', index === this.cur);
    });
  }
}

/* ============================================================
   INICIALIZAÇÃO
   Cria instância do Deck quando o DOM estiver pronto
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  new Deck();
});

/* ============================================================
   FIM DO ARQUIVO JAVASCRIPT
   ============================================================ */
