/**
 * ANTES DA ESCOLA™ - Funil Interativo & Quiz Engine Otimizado
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentStep: 1,
    totalSteps: 8,
    isTransitioning: false,
    answers: {
      child_age: '3',
      colors: 'provavelmente',
      shapes: 'talvez',
      numbers: 'pequenas_quantidades',
      perception: 'provavelmente',
      logic: 'talvez',
      motor: 'segue_linhas',
      parent_goal: 'all'
    },
    scores: {
      colors: 2,
      shapes: 2,
      numbers: 2,
      perception: 2,
      logic: 2,
      motor: 2
    }
  };

  // Pillar Definitions
  const PILLAR_CONFIG = {
    colors_shapes: {
      id: 'colors',
      name: 'Cores e Formas',
      icon: '🎨',
      goalKey: 'colors_shapes'
    },
    numbers: {
      id: 'numbers',
      name: 'Números e Quantidades',
      icon: '🔢',
      goalKey: 'numbers'
    },
    motor: {
      id: 'motor',
      name: 'Coordenação Pré-Escrita',
      icon: '✏️',
      goalKey: 'coordination'
    },
    perception: {
      id: 'perception',
      name: 'Percepção Visual',
      icon: '👁️',
      goalKey: 'perception'
    },
    logic: {
      id: 'logic',
      name: 'Raciocínio e Padrões',
      icon: '🧠',
      goalKey: 'reasoning'
    }
  };

  // DOM Elements
  const screens = {
    quiz: document.getElementById('screen-quiz'),
    loading: document.getElementById('screen-loading'),
    result: document.getElementById('screen-result'),
    sales: document.getElementById('sales-page-section')
  };

  const btnPrevQuestion = document.getElementById('btn-prev-question');
  const btnSeeProgram = document.getElementById('btn-see-program');
  const quizProgressBar = document.getElementById('quiz-progress-bar');
  const quizStepCounter = document.getElementById('quiz-step-counter');
  const stickyBottomBar = document.getElementById('sticky-bottom-bar');

  // Load state from sessionStorage if exists
  try {
    const savedState = sessionStorage.getItem('antes_da_escola_answers');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      state.answers = { ...state.answers, ...parsed.answers };
      state.scores = { ...state.scores, ...parsed.scores };
    }
  } catch(e) {}

  // Apply default/saved age personalization upfront
  applyAgePersonalization(state.answers.child_age || '3');

  // -------------------------------------------------------------
  // INITIALIZE QUIZ DIRECTLY ON LOAD
  // -------------------------------------------------------------
  state.currentStep = 1;
  updateStepView();
  window.AppTracker.track('quiz_started');

  // -------------------------------------------------------------
  // SCREEN SWITCHER HELPER
  // -------------------------------------------------------------
  function showScreen(targetScreenKey) {
    Object.keys(screens).forEach(key => {
      const el = screens[key];
      if (el) {
        if (key === targetScreenKey) {
          el.style.display = (key === 'sales') ? 'block' : 'flex';
          setTimeout(() => el.classList.add('active'), 20);
        } else if (key !== 'sales' || targetScreenKey !== 'sales') {
          el.classList.remove('active');
          el.style.display = 'none';
        }
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // -------------------------------------------------------------
  // NAVEGAÇÃO ENTRE ETAPAS DO QUIZ
  // -------------------------------------------------------------
  function updateStepView() {
    const steps = document.querySelectorAll('.quiz-step');
    steps.forEach(stepEl => {
      if (stepEl.classList.contains('microfeedback-step')) {
        stepEl.style.display = 'none';
        return;
      }
      const stepNum = parseInt(stepEl.getAttribute('data-step'), 10);
      if (stepNum === state.currentStep) {
        stepEl.style.display = 'block';
      } else {
        stepEl.style.display = 'none';
      }
    });

    // Update Progress Bar
    const progressPercent = (state.currentStep / state.totalSteps) * 100;
    if (quizProgressBar) quizProgressBar.style.width = `${progressPercent}%`;
    if (quizStepCounter) quizStepCounter.textContent = `Pergunta ${state.currentStep} de ${state.totalSteps}`;

    // Back button state: hidden on Step 1, visible on Step 2+
    if (btnPrevQuestion) {
      if (state.currentStep === 1) {
        btnPrevQuestion.style.visibility = 'hidden';
        btnPrevQuestion.disabled = true;
      } else {
        btnPrevQuestion.style.visibility = 'visible';
        btnPrevQuestion.disabled = false;
      }
    }
  }

  // Back button click
  if (btnPrevQuestion) {
    btnPrevQuestion.addEventListener('click', () => {
      if (state.currentStep > 1 && !state.isTransitioning) {
        state.currentStep--;
        updateStepView();
      }
    });
  }

  // Option Click Handler
  const optionCards = document.querySelectorAll('.option-card');
  optionCards.forEach(card => {
    card.addEventListener('click', function(e) {
      if (state.isTransitioning) return;

      const key = this.getAttribute('data-key');
      const val = this.getAttribute('data-value');
      const score = parseInt(this.getAttribute('data-score') || '0', 10);

      // Visual Selection Animation
      const parentStep = this.closest('.quiz-step');
      parentStep.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');

      // Save answer & score
      state.answers[key] = val;
      if (key !== 'parent_goal' && key !== 'child_age') {
        state.scores[key] = score;
      }

      // Track Question Answered
      window.AppTracker.track('quiz_answered', { question_step: state.currentStep, key, value: val, score });

      if (key === 'child_age') {
        applyAgePersonalization(val);
        window.AppTracker.track('quiz_question_1_completed', { age_selected: parseInt(val, 10) });
      }

      try {
        sessionStorage.setItem('antes_da_escola_answers', JSON.stringify({
          answers: state.answers,
          scores: state.scores
        }));
      } catch(e) {}

      state.isTransitioning = true;

      // Handle Interstitial Microfeedbacks
      if (state.currentStep === 4) {
        setTimeout(() => {
          showMicrofeedback('microfeedback-1', () => {
            state.currentStep = 5;
            updateStepView();
            state.isTransitioning = false;
          });
        }, 260);
        return;
      }

      if (state.currentStep === 6) {
        setTimeout(() => {
          showMicrofeedback('microfeedback-2', () => {
            state.currentStep = 7;
            updateStepView();
            state.isTransitioning = false;
          });
        }, 260);
        return;
      }

      // Advance with brief timeout for smooth feel
      setTimeout(() => {
        if (state.currentStep < state.totalSteps) {
          state.currentStep++;
          updateStepView();
          state.isTransitioning = false;
        } else {
          // Finish Quiz
          window.AppTracker.track('quiz_completed', state.answers);
          startProcessingScreen();
        }
      }, 250);
    });
  });

  // Microfeedback transition helper
  function showMicrofeedback(elementId, onComplete) {
    const steps = document.querySelectorAll('.quiz-step');
    steps.forEach(s => s.style.display = 'none');

    const mfElement = document.getElementById(elementId);
    if (mfElement) {
      mfElement.style.display = 'block';
      mfElement.classList.add('fade-in');
    }

    setTimeout(() => {
      if (mfElement) mfElement.style.display = 'none';
      if (typeof onComplete === 'function') onComplete();
    }, 1700);
  }

  // -------------------------------------------------------------
  // 3. TELA DE PROCESSAMENTO / ANÁLISE REFINADA
  // -------------------------------------------------------------
  function startProcessingScreen() {
    showScreen('loading');

    const loadingMsg = document.getElementById('loading-message');
    const loadingBar = document.getElementById('loading-progress-bar');
    const check1 = document.getElementById('check-step-1');
    const check2 = document.getElementById('check-step-2');
    const check3 = document.getElementById('check-step-3');
    const check4 = document.getElementById('check-step-4');

    if (loadingBar) loadingBar.style.width = '10%';

    const timeline = [
      {
        time: 500,
        action: () => {
          if (loadingBar) loadingBar.style.width = '35%';
          if (check1) check1.className = 'check-item done';
          if (check2) check2.className = 'check-item in-progress';
          if (loadingMsg) loadingMsg.textContent = 'Identificando os fundamentos já explorados...';
        }
      },
      {
        time: 1200,
        action: () => {
          if (loadingBar) loadingBar.style.width = '70%';
          if (check2) check2.className = 'check-item done';
          if (check3) check3.className = 'check-item in-progress';
          if (loadingMsg) loadingMsg.textContent = 'Mapeando oportunidades de estímulo em casa...';
        }
      },
      {
        time: 2000,
        action: () => {
          if (loadingBar) loadingBar.style.width = '95%';
          if (check3) check3.className = 'check-item done';
          if (check4) check4.className = 'check-item in-progress';
          if (loadingMsg) loadingMsg.textContent = 'Organizando seu mapa de desenvolvimento...';
        }
      },
      {
        time: 2600,
        action: () => {
          if (loadingBar) loadingBar.style.width = '100%';
          if (check4) check4.className = 'check-item done';
        }
      },
      {
        time: 2900,
        action: () => {
          renderCalculatedResult();
          showScreen('result');
          window.AppTracker.track('result_viewed', { answers: state.answers, scores: state.scores });
        }
      }
    ];

    timeline.forEach(item => setTimeout(item.action, item.time));
  }

  // -------------------------------------------------------------
  // 4. CÁLCULO E RENDERIZAÇÃO DO RESULTADO
  // -------------------------------------------------------------
  function renderCalculatedResult() {
    const age = state.answers.child_age || '3';
    const ageDisplay = document.getElementById('dynamic-user-age');
    if (ageDisplay) ageDisplay.textContent = `${age} anos`;

    // 1. Calculate 5 Pillar Scores
    // Cores e Formas: média de Q2 e Q3
    const colorsShapesScore = ((state.scores.colors || 0) + (state.scores.shapes || 0)) / 2;
    const numbersScore = state.scores.numbers || 0;
    const motorScore = state.scores.motor || 0;
    const perceptionScore = state.scores.perception || 0;
    const logicScore = state.scores.logic || 0;

    const pillars = [
      { key: 'colors_shapes', name: 'Cores e Formas', score: colorsShapesScore, elId: 'colors', goalKey: 'colors_shapes' },
      { key: 'numbers', name: 'Números e Quantidades', score: numbersScore, elId: 'numbers', goalKey: 'numbers' },
      { key: 'motor', name: 'Coordenação Pré-Escrita', score: motorScore, elId: 'motor', goalKey: 'coordination' },
      { key: 'perception', name: 'Percepção Visual', score: perceptionScore, elId: 'perception', goalKey: 'perception' },
      { key: 'logic', name: 'Raciocínio e Padrões', score: logicScore, elId: 'logic', goalKey: 'reasoning' }
    ];

    // Update Visual Gauge Bars
    pillars.forEach(p => {
      const badge = document.getElementById(`status-badge-${p.elId}`);
      const gauge = document.getElementById(`gauge-fill-${p.elId}`);

      let label = 'Começando';
      let statusClass = 'comecando';
      let widthPercent = 35;

      if (p.score >= 2.3) {
        label = 'Avançando';
        statusClass = 'avancando';
        widthPercent = Math.min(80 + (p.score - 2.3) * 20, 95);
      } else if (p.score >= 1.3) {
        label = 'Em construção';
        statusClass = 'construcao';
        widthPercent = 55 + (p.score - 1.3) * 15;
      } else {
        label = 'Começando';
        statusClass = 'comecando';
        widthPercent = 25 + (p.score * 12);
      }

      if (badge) {
        badge.textContent = label;
        badge.className = `pillar-status-badge status-${statusClass}`;
      }
      if (gauge) {
        gauge.style.width = `${widthPercent}%`;
        gauge.className = `pillar-gauge-fill fill-${statusClass}`;
      }
    });

    // 2. TIES & STRENGTHS LOGIC REFINEMENT
    // Sort pillars descending by score
    const sortedDesc = [...pillars].sort((a, b) => b.score - a.score);
    const highestScore = sortedDesc[0].score;
    const lowestScore = sortedDesc[sortedDesc.length - 1].score;
    const diffMaxMin = highestScore - lowestScore;

    const leadTextEl = document.getElementById('dynamic-lead-text');

    // Rule: Never state "já está bastante desenvolvido" if status is Começando
    if (diffMaxMin <= 0.6 || highestScore <= 1.2) {
      // All or most tied or all in early phase
      if (leadTextEl) {
        leadTextEl.innerHTML = `Pelas suas respostas, seu filho está começando a construir diferentes fundamentos pré-escolares ao mesmo tempo.`;
      }
    } else if (sortedDesc[0].score === sortedDesc[1].score || (sortedDesc[0].score - sortedDesc[1].score <= 0.2)) {
      // 2 Pillars tied for highest
      if (leadTextEl) {
        leadTextEl.innerHTML = `Pelas suas respostas, <strong>${sortedDesc[0].name}</strong> e <strong>${sortedDesc[1].name}</strong> aparecem entre os fundamentos que vocês já exploraram com maior frequência.`;
      }
    } else {
      // 1 Pillar strictly highest
      if (leadTextEl) {
        leadTextEl.innerHTML = `Pelas suas respostas, <strong>${sortedDesc[0].name}</strong> aparece entre os fundamentos que vocês já exploraram com maior frequência.`;
      }
    }

    // 3. NEXT STEPS RECOMMENDATION (Lowest Scores + Parent Goal Tiebreaker)
    const userGoal = state.answers.parent_goal || 'all';
    
    // Sort ascending to get lowest scores
    const sortedAsc = [...pillars].sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      // If score is tied, prioritize if matches parent_goal
      if (a.goalKey === userGoal) return -1;
      if (b.goalKey === userGoal) return 1;
      return 0;
    });

    const opp1 = sortedAsc[0];
    const opp2 = sortedAsc[1];

    const opp1El = document.getElementById('opp-item-1');
    const opp2El = document.getElementById('opp-item-2');

    if (opp1El) opp1El.textContent = opp1.name;
    if (opp2El) opp2El.textContent = opp2.name;

    // Track Recommended Area
    window.AppTracker.track('recommended_area_viewed', {
      recommended_pillars: [opp1.name, opp2.name],
      highest_pillar: sortedDesc[0].name
    });
  }

  // -------------------------------------------------------------
  // 5. TRANSIÇÃO SUAVE PARA LANDING PAGE
  // -------------------------------------------------------------
  if (btnSeeProgram) {
    btnSeeProgram.addEventListener('click', () => {
      const salesSection = screens.sales;
      if (salesSection) {
        salesSection.style.display = 'block';
        setTimeout(() => salesSection.classList.add('active'), 20);
        
        window.AppTracker.track('sales_page_viewed', { age: state.answers.child_age });

        // Smooth scroll to hero
        const heroSection = document.getElementById('lp-hero');
        if (heroSection) {
          heroSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // -------------------------------------------------------------
  // 6. PERSONALIZAÇÃO DA LANDING PAGE
  // -------------------------------------------------------------
  function applyAgePersonalization(ageStr) {
    const age = parseInt(ageStr, 10) || 3;

    // Update Hero Tag
    const heroTag = document.getElementById('dynamic-hero-tag');
    if (heroTag) {
      heroTag.textContent = `PLANO PARA CRIANÇAS DE ${age} ANOS`;
    }

    // Update Age Tabs in LP
    const tabBtns = document.querySelectorAll('.age-tab-btn');
    const tabPanels = document.querySelectorAll('.age-tab-panel');

    tabBtns.forEach(btn => {
      const tabAge = parseInt(btn.getAttribute('data-age-tab'), 10);
      const isSelected = (tabAge === age);
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');

      const badge = btn.querySelector('.tab-rec-badge');
      if (badge) {
        badge.style.display = isSelected ? 'inline-block' : 'none';
        badge.textContent = 'Selecionado no seu quiz';
      }
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
  }

  // Age Tab Click Listeners
  const tabBtns = document.querySelectorAll('.age-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetAge = this.getAttribute('data-age-tab');
      applyAgePersonalization(targetAge);
    });
  });

  // -------------------------------------------------------------
  // 7. REAL SPECIALIST & DYNAMIC REVIEWS ENGINE
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

  // Initialize sections conditionally
  initSpecialistSection();
  initReviewsSection();

  // -------------------------------------------------------------
  // 8. FAQ ACCORDION
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
  // 9. SECTION INTERSECTION OBSERVER & TRACKING
  // -------------------------------------------------------------
  const sectionsToTrack = [
    { id: 'secao-paginas-reais', event: 'product_preview_viewed' },
    { id: 'secao-especialista', event: 'specialist_section_viewed' },
    { id: 'secao-autoridade', event: 'authority_section_viewed' },
    { id: 'secao-avaliacoes', event: 'reviews_section_viewed' },
    { id: 'oferta', event: 'offer_viewed' }
  ];

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const match = sectionsToTrack.find(s => s.id === entry.target.id);
          if (match) {
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
      window.AppTracker.track('cta_clicked', { cta_name: ctaName });
    });
  });

  const mainCheckoutBtn = document.getElementById('btn-main-checkout');
  if (mainCheckoutBtn) {
    mainCheckoutBtn.addEventListener('click', () => {
      window.AppTracker.track('checkout_clicked', {
        price: '27.90',
        product: 'Antes da Escola™',
        age: state.answers.child_age
      });
    });
  }

  // Sticky Mobile Bar scroll trigger
  window.addEventListener('scroll', () => {
    if (!stickyBottomBar) return;
    const offerSection = document.getElementById('oferta');
    const heroSection = document.getElementById('lp-hero');
    if (!offerSection || !heroSection) return;

    const heroRect = heroSection.getBoundingClientRect();
    const offerRect = offerSection.getBoundingClientRect();

    // Show after scrolling past hero and hide when reaching offer
    if (heroRect.bottom < 0 && offerRect.top > window.innerHeight) {
      stickyBottomBar.style.display = 'block';
    } else {
      stickyBottomBar.style.display = 'none';
    }
  });

});
