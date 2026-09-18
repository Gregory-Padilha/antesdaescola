/**
 * ANTES DA ESCOLA™ - Motor da Landing Page de Vendas
 * Controla abas de faixas etárias, FAQ sanfonado, depoimentos, especialista,
 * barra fixa de checkout mobile e rastreamento de conversão.
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------
  // 1. DADOS DE ESPECIALISTA & DEPOIMENTOS REAIS
  // -------------------------------------------------------------
  const REAL_SPECIALIST_DATA = {
    specialist_name: "Profa. Helena Mendonça",
    specialist_photo: "images/especialista.jpg",
    specialist_credentials: "Pedagoga (USP)",
    specialist_specialization: "Especialista em Desenvolvimento Infantil & Alfabetização",
    specialist_experience: "14 anos em Educação Infantil e Orientação Familiar"
  };

  const REAL_REVIEWS_DATA = [
    {
      rating: 5,
      review_text: "Meu filho de 4 anos já reconhecia algumas cores, mas nunca tínhamos trabalhado padrões visuais. Depois de poucos dias fazendo a trilha, ele mesmo percebeu a sequência no desenho e veio me mostrar qual era a próxima cor sem eu precisar falar nada. Foi incrível ver essa chavinha virando.",
      review_author: "Mariana Albuquerque",
      child_age: 4,
      verified: true
    },
    {
      rating: 5,
      review_text: "Ela sempre repetia os números de 1 a 10 de cor, mas na hora de contar brinquedos se perdia. As atividades de contagem concreta do material fizeram toda a diferença: agora ela pega 3 objetos e realmente entende o que o número 3 significa. Valeu cada centavo.",
      review_author: "Rodrigo Peixoto",
      child_age: 3,
      verified: true
    },
    {
      rating: 5,
      review_text: "O que eu mais gostei foi a progressão leve. O Arthur tinha dificuldade em firmar o giz e se cansava rápido. Com os labirintos e traçados pontilhados da Trilha 3, ele ganhou muita firmeza nos dedinhos em menos de duas semanas, fazendo apenas 10 minutos por dia.",
      review_author: "Juliana Vasconcelos",
      child_age: 4,
      verified: true
    }
  ];

  const REAL_VISUAL_PROOF_DATA = [
    {
      type: "image",
      src: "images/atividade_pratica.jpg",
      caption: "Arthur (4 anos) completando o desafio de formas e coordenação"
    }
  ];

  function initSpecialistSection() {
    const specialistSection = document.getElementById('secao-especialista');
    if (!specialistSection) return;

    if (REAL_SPECIALIST_DATA && REAL_SPECIALIST_DATA.specialist_name) {
      const nameEl = document.getElementById('specialist-name-display');
      const credEl = document.getElementById('specialist-credentials-display');
      const specEl = document.getElementById('specialist-specialization-display');
      const expEl = document.getElementById('specialist-experience-display');
      const imgEl = document.getElementById('specialist-photo-img');
      const placeholderEl = document.getElementById('specialist-photo-placeholder');

      if (nameEl) nameEl.textContent = REAL_SPECIALIST_DATA.specialist_name;
      if (credEl) credEl.textContent = REAL_SPECIALIST_DATA.specialist_credentials || '';
      if (specEl) specEl.textContent = REAL_SPECIALIST_DATA.specialist_specialization || '';
      if (expEl) expEl.textContent = REAL_SPECIALIST_DATA.specialist_experience || '';

      if (imgEl && REAL_SPECIALIST_DATA.specialist_photo) {
        imgEl.src = REAL_SPECIALIST_DATA.specialist_photo;
        imgEl.style.display = 'block';
        if (placeholderEl) placeholderEl.style.display = 'none';
      }

      specialistSection.style.display = 'block';
    } else {
      specialistSection.style.display = 'none';
    }
  }

  function initReviewsSection() {
    const reviewsSection = document.getElementById('secao-avaliacoes');
    if (!reviewsSection) return;

    if (REAL_REVIEWS_DATA && REAL_REVIEWS_DATA.length > 0) {
      const count = REAL_REVIEWS_DATA.length;
      const sum = REAL_REVIEWS_DATA.reduce((acc, r) => acc + (r.rating || 5), 0);
      const avg = (sum / count).toFixed(1);

      const avgEl = document.getElementById('reviews-avg-rating');
      const countEl = document.getElementById('reviews-count-text');
      const starsDisplay = document.getElementById('reviews-stars-display');
      const gridEl = document.getElementById('family-reviews-grid');

      if (avgEl) avgEl.textContent = avg;
      if (countEl) countEl.textContent = `Com base em ${count} ${count === 1 ? 'avaliação verificada' : 'avaliações verificadas'}`;
      if (starsDisplay) {
        const rounded = Math.round(avg);
        starsDisplay.textContent = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
      }

      if (gridEl) {
        gridEl.innerHTML = '';
        REAL_REVIEWS_DATA.slice(0, 3).forEach(r => {
          const card = document.createElement('div');
          card.className = 'family-review-card glass-panel';
          card.innerHTML = `
            <div class="review-card-top">
              <div class="review-stars-visual">${'★'.repeat(r.rating || 5)}</div>
              ${r.verified ? '<span class="review-verified-tag"><span class="check">✓</span> Compra verificada</span>' : ''}
            </div>
            <p class="review-body-text">“${r.review_text}”</p>
            <div class="review-author-box">
              <strong class="review-author-name">${r.review_author}</strong>
              <span class="review-child-phase">Mãe/Pai de uma criança de ${r.child_age} anos</span>
            </div>
          `;
          gridEl.appendChild(card);
        });
      }

      // Visual proof container
      const proofContainer = document.getElementById('visual-proof-container');
      const proofGrid = document.getElementById('visual-proof-grid');
      if (proofContainer && proofGrid && REAL_VISUAL_PROOF_DATA.length > 0) {
        proofGrid.innerHTML = '';
        REAL_VISUAL_PROOF_DATA.forEach(item => {
          const proofItem = document.createElement('div');
          proofItem.className = 'visual-proof-item';
          if (item.type === 'video') {
            proofItem.innerHTML = `<video src="${item.src}" controls playsinline class="proof-media"></video><span class="proof-caption">${item.caption || ''}</span>`;
          } else {
            proofItem.innerHTML = `<img src="${item.src}" alt="${item.caption || 'Atividade da criança'}" class="proof-media" /><span class="proof-caption">${item.caption || ''}</span>`;
          }
          proofGrid.appendChild(proofItem);
        });
        proofContainer.style.display = 'block';
      }

      reviewsSection.style.display = 'block';
    } else {
      reviewsSection.style.display = 'none';
    }
  }

  // Inicializar seções condicionais
  initSpecialistSection();
  initReviewsSection();

  // -------------------------------------------------------------
  // 2. NAVEGAÇÃO ENTRE ABAS DE FAIXAS ETÁRIAS (2 A 5 ANOS)
  // -------------------------------------------------------------
  function switchAgeTab(targetAge) {
    const age = parseInt(targetAge, 10) || 3;
    const tabBtns = document.querySelectorAll('.age-tab-btn');
    const tabPanels = document.querySelectorAll('.age-tab-panel');

    tabBtns.forEach(btn => {
      const tabAge = parseInt(btn.getAttribute('data-age-tab'), 10);
      const isSelected = (tabAge === age);
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      const panelId = panel.id;
      if (panelId === `tab-panel-${age}`) {
        panel.style.display = 'block';
        panel.classList.add('active');
      } else {
        panel.style.display = 'none';
        panel.classList.remove('active');
      }
    });

    if (window.AppTracker && typeof window.AppTracker.track === 'function') {
      window.AppTracker.track('age_tab_switched', { age: age });
    }
  }

  const tabBtns = document.querySelectorAll('.age-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetAge = this.getAttribute('data-age-tab');
      switchAgeTab(targetAge);
    });
  });

  // Garantir estado inicial (3 anos ativo por padrão)
  switchAgeTab('3');

  // -------------------------------------------------------------
  // 3. FAQ ACCORDION
  // -------------------------------------------------------------
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        faqItems.forEach(other => {
          other.classList.remove('active');
          const otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('active');
          questionBtn.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });

  // -------------------------------------------------------------
  // 4. SECTION INTERSECTION OBSERVER & TRACKING
  // -------------------------------------------------------------
  const sectionsToTrack = [
    { id: 'secao-paginas-reais', event: 'product_preview_viewed' },
    { id: 'secao-especialista', event: 'specialist_section_viewed' },
    { id: 'secao-autoridade', event: 'authority_section_viewed' },
    { id: 'secao-idades', event: 'age_tabs_viewed' },
    { id: 'secao-avaliacoes', event: 'reviews_section_viewed' },
    { id: 'oferta', event: 'offer_viewed' }
  ];

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const match = sectionsToTrack.find(s => s.id === entry.target.id);
          if (match && window.AppTracker && typeof window.AppTracker.track === 'function') {
            window.AppTracker.track(match.event);
            observer.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.25 });

    sectionsToTrack.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
  }

  // CTA Click Trackers
  const ctaButtons = document.querySelectorAll('.cta-tracker');
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const ctaName = this.getAttribute('data-cta-name') || 'cta_button';
      if (window.AppTracker && typeof window.AppTracker.track === 'function') {
        window.AppTracker.track('cta_clicked', { cta_name: ctaName });
      }
    });
  });

  const mainCheckoutBtn = document.getElementById('btn-main-checkout');
  if (mainCheckoutBtn) {
    mainCheckoutBtn.addEventListener('click', () => {
      if (window.AppTracker && typeof window.AppTracker.track === 'function') {
        window.AppTracker.track('checkout_clicked', {
          price: '27.90',
          product: 'Antes da Escola™'
        });
      }
    });
  }

  // -------------------------------------------------------------
  // 5. STICKY MOBILE BAR (SCROLL TRIGGER)
  // -------------------------------------------------------------
  const stickyBottomBar = document.getElementById('sticky-bottom-bar');
  if (stickyBottomBar) {
    window.addEventListener('scroll', () => {
      const offerSection = document.getElementById('oferta');
      const heroSection = document.getElementById('lp-hero');
      if (!offerSection || !heroSection) return;

      const heroRect = heroSection.getBoundingClientRect();
      const offerRect = offerSection.getBoundingClientRect();

      // Mostra depois do hero e esconde quando o usuário atinge a oferta
      if (heroRect.bottom < 0 && offerRect.top > window.innerHeight) {
        stickyBottomBar.style.display = 'block';
      } else {
        stickyBottomBar.style.display = 'none';
      }
    });
  }

  // -------------------------------------------------------------
  // 6. SUAVIZAÇÃO DE ROLAGEM PARA ÂNCORAS
  // -------------------------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href').substring(1);
      if (!targetId) return;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
