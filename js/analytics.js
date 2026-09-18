/**
 * ANTES DA ESCOLA™ - Motor de Analytics Comportamental First-Party
 * Rastreamento de Sessão (30 min timeout), UTMs Originais, Visibilidade de Seções,
 * Tempo Engajado Ativo (VisibilityState), Marcos de Scroll (25-100%) e CTAs.
 */

window.AppTracker = (function() {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inatividade
  const VISITOR_KEY = 'ae_visitor_id';
  const SESSION_KEY = 'ae_session_id';
  const SESSION_TIME_KEY = 'ae_session_last_activity';
  const UTM_KEY = 'ae_original_utm_params';

  // Helper: UUID v4 seguro
  function generateUUID() {
    if (typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 1. Visitor ID (Identificador Anônimo Persistente do Navegador)
  function getOrCreateVisitorId() {
    let visitorId = null;
    try {
      visitorId = localStorage.getItem(VISITOR_KEY);
      if (!visitorId) {
        visitorId = generateUUID();
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
    } catch(e) {
      visitorId = visitorId || generateUUID();
    }
    return visitorId;
  }

  // 2. Session ID (Sessão com Expiração por 30 min de inatividade)
  let isNewSession = false;
  function getOrCreateSessionId() {
    const now = Date.now();
    let sessionId = null;
    let lastActivity = 0;

    try {
      sessionId = localStorage.getItem(SESSION_KEY);
      lastActivity = parseInt(localStorage.getItem(SESSION_TIME_KEY) || '0', 10);
    } catch(e) {}

    // Se não houver sessão ou se passaram mais de 30 minutos de inatividade: nova sessão
    if (!sessionId || !lastActivity || (now - lastActivity > SESSION_TIMEOUT_MS)) {
      sessionId = generateUUID();
      isNewSession = true;
      try {
        localStorage.setItem(SESSION_KEY, sessionId);
        localStorage.setItem(SESSION_TIME_KEY, String(now));
      } catch(e) {}
    } else {
      // Atualiza timestamp de atividade
      try {
        localStorage.setItem(SESSION_TIME_KEY, String(now));
      } catch(e) {}
    }

    return sessionId;
  }

  // 3. Captura e Preservação de UTMs First-Touch
  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    
    let originalUtms = null;
    try {
      const stored = localStorage.getItem(UTM_KEY);
      if (stored) {
        originalUtms = JSON.parse(stored);
      }
    } catch(e) {}

    let currentUrlUtms = {};
    let hasUrlUtms = false;

    utmKeys.forEach(key => {
      const val = params.get(key);
      if (val) {
        currentUrlUtms[key] = val;
        hasUrlUtms = true;
      }
    });

    if (hasUrlUtms) {
      if (!originalUtms || Object.keys(originalUtms).length === 0 || isNewSession) {
        originalUtms = {
          ...currentUrlUtms,
          referrer: document.referrer || null,
          landing_path: window.location.pathname
        };
        try {
          localStorage.setItem(UTM_KEY, JSON.stringify(originalUtms));
        } catch(e) {}
      }
      return originalUtms;
    }

    return originalUtms || { referrer: document.referrer || null, landing_path: window.location.pathname };
  }

  // 4. Detecção Técnica Básica
  function getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getBrowserName() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    if (ua.includes('Edge') || ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Outro';
  }

  const visitorId = getOrCreateVisitorId();
  const sessionId = getOrCreateSessionId();
  const utms = getUtmParams();
  const deviceType = getDeviceType();
  const browserName = getBrowserName();

  // Helper: Atualizar timestamp de atividade
  function touchActivity() {
    try {
      localStorage.setItem(SESSION_TIME_KEY, String(Date.now()));
    } catch(e) {}
  }

  // Helper: Enviar evento server-side
  function sendServerEvent(eventName, payload = {}) {
    touchActivity();
    try {
      const eventId = generateUUID();
      const body = {
        event_id: eventId,
        session_id: sessionId,
        visitor_id: visitorId,
        event_name: eventName,
        page_path: payload.page_path || window.location.pathname,
        section_id: payload.section_id || null,
        cta_id: payload.cta_id || null,
        step: payload.step ? parseInt(payload.step, 10) : null,
        question_id: payload.question_id || null,
        answer: payload.answer || null,
        scroll_depth: payload.scroll_depth ? parseInt(payload.scroll_depth, 10) : null,
        duration_ms: payload.duration_ms ? parseInt(payload.duration_ms, 10) : null,
        metadata: payload.metadata || payload,
        device_type: deviceType,
        browser: browserName,
        viewport_width: window.innerWidth || null,
        utm: utms
      };

      const endpoint = '/api/analytics/event';
      const jsonStr = JSON.stringify(body);

      if (typeof fetch === 'function') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr,
          keepalive: true
        }).catch(() => {});
      } else if (navigator.sendBeacon) {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      }
    } catch(err) {}
  }

  // 5. Interface Pública de Tracking
  function track(eventName, properties = {}) {
    // Normalização de eventos
    let normalizedEvent = eventName;
    if (eventName === 'quiz_started') normalizedEvent = 'quiz_start';
    if (eventName === 'quiz_completed') normalizedEvent = 'quiz_complete';
    if (eventName === 'quiz_answered') normalizedEvent = 'quiz_answer';
    if (eventName === 'sales_page_viewed') normalizedEvent = 'lp_view';

    sendServerEvent(normalizedEvent, properties);

    // Disparar evento DOM interno para debugging se necessário
    try {
      window.dispatchEvent(new CustomEvent('analytics_event', {
        detail: { eventName: normalizedEvent, properties, sessionId, visitorId }
      }));
    } catch(e) {}
  }

  // ============================================================================
  // 6. OBSERVER DE SEÇÕES (SECTION VIEW & SECTION ENGAGEMENT)
  // ============================================================================
  const viewedSections = new Set();
  const activeSectionTimers = new Map(); // sectionId -> startTime
  let activeSectionEngagedMs = new Map(); // sectionId -> totalMs

  function initSectionObserver() {
    const sections = document.querySelectorAll('[data-section-id]');
    if (!sections || sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

    // Threshold de 50% de visibilidade
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const sectionId = entry.target.getAttribute('data-section-id');
        if (!sectionId) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // Iniciar temporizador de visibilidade mínima (750ms) para contar como vista
          if (!viewedSections.has(sectionId)) {
            const viewTimeout = setTimeout(() => {
              if (!viewedSections.has(sectionId)) {
                viewedSections.add(sectionId);
                track('section_view', { section_id: sectionId });
              }
            }, 750);
            entry.target._viewTimeout = viewTimeout;
          }

          // Iniciar timer de engajamento ativo se a aba estiver visível
          if (document.visibilityState === 'visible' && !activeSectionTimers.has(sectionId)) {
            activeSectionTimers.set(sectionId, Date.now());
          }
        } else {
          // Cancelar timeout de visualização se saiu antes de 750ms
          if (entry.target._viewTimeout) {
            clearTimeout(entry.target._viewTimeout);
            entry.target._viewTimeout = null;
          }

          // Parar timer de engajamento e acumular tempo
          if (activeSectionTimers.has(sectionId)) {
            const start = activeSectionTimers.get(sectionId);
            const duration = Date.now() - start;
            activeSectionTimers.delete(sectionId);

            if (duration > 500) {
              const prev = activeSectionEngagedMs.get(sectionId) || 0;
              activeSectionEngagedMs.set(sectionId, prev + duration);
              track('section_engaged', { section_id: sectionId, duration_ms: duration });
            }
          }
        }
      });
    }, { threshold: [0.5] });

    sections.forEach(sec => observer.observe(sec));
  }

  // ============================================================================
  // 7. OBSERVER DE CTAs (CTA VIEW & CTA CLICK)
  // ============================================================================
  const viewedCtas = new Set();

  function initCtaObserver() {
    const ctas = document.querySelectorAll('[data-cta-id], .cta-tracker');
    if (!ctas || ctas.length === 0) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const ctaObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const ctaId = entry.target.getAttribute('data-cta-id') || entry.target.getAttribute('data-cta-name') || entry.target.id;
            if (ctaId && !viewedCtas.has(ctaId)) {
              viewedCtas.add(ctaId);
              const parentSection = entry.target.closest('[data-section-id]');
              const sectionId = parentSection ? parentSection.getAttribute('data-section-id') : null;
              track('cta_view', { cta_id: ctaId, section_id: sectionId });
            }
          }
        });
      }, { threshold: [0.5] });

      ctas.forEach(cta => ctaObserver.observe(cta));
    }

    // CTA Click Handlers
    ctas.forEach(cta => {
      cta.addEventListener('click', function(e) {
        const ctaId = this.getAttribute('data-cta-id') || this.getAttribute('data-cta-name') || this.id || 'cta_unknown';
        const parentSection = this.closest('[data-section-id]');
        const sectionId = parentSection ? parentSection.getAttribute('data-section-id') : null;
        const href = this.getAttribute('href') || '';
        
        let destinationType = 'internal_anchor';
        if (href.startsWith('http://') || href.startsWith('https://')) {
          destinationType = href.includes('checkout') || href.includes('pay.kiwify') ? 'checkout' : 'external';
        }

        track('cta_click', {
          cta_id: ctaId,
          section_id: sectionId,
          destination_type: destinationType,
          page_path: window.location.pathname
        });

        if (destinationType === 'checkout') {
          track('external_link_click', { link_type: 'checkout', cta_id: ctaId });
        }
      });
    });
  }

  // ============================================================================
  // 8. RASTREAMENTO DE SCROLL DEPTH (25%, 50%, 75%, 90%, 100%)
  // ============================================================================
  const triggeredScrolls = new Set();

  function initScrollTracking() {
    const thresholds = [25, 50, 75, 90, 100];
    let scrollTimeout = null;

    function checkScroll() {
      const docHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      );
      const winHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (docHeight <= winHeight) return;

      const currentPercent = Math.min(100, Math.round(((scrollTop + winHeight) / docHeight) * 100));

      thresholds.forEach(t => {
        if (currentPercent >= t && !triggeredScrolls.has(t)) {
          triggeredScrolls.add(t);
          track('scroll_depth', { scroll_depth: t });
        }
      });
    }

    window.addEventListener('scroll', () => {
      if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
          checkScroll();
          scrollTimeout = null;
        }, 150);
      }
    }, { passive: true });
  }

  // ============================================================================
  // 9. TEMPO ATIVO NA LANDING PAGE & VISIBILITY CHANGE HANDLER
  // ============================================================================
  let lpStartTime = null;
  let lpEngagedInterval = null;

  function initLpEngagementTracking() {
    const salesSection = document.getElementById('sales-page-section');
    if (!salesSection) return;

    // Observar quando a LP é exibida
    const checkLpVisible = () => {
      const isLpVisible = salesSection.style.display !== 'none' && salesSection.offsetParent !== null;
      if (isLpVisible && !lpStartTime) {
        lpStartTime = Date.now();
        track('lp_view', { page_path: '/oferta' });
        initSectionObserver();
        initCtaObserver();
        initScrollTracking();

        // Heartbeat de engajamento ativo a cada 10 segundos
        if (!lpEngagedInterval) {
          lpEngagedInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
              track('page_engaged', { duration_ms: 10000 });
            }
          }, 10000);
        }
      }
    };

    // Observer de mutação para detectar abertura da LP
    const mutObserver = new MutationObserver(checkLpVisible);
    mutObserver.observe(salesSection, { attributes: true, attributeFilter: ['style', 'class'] });
    checkLpVisible();
  }

  // Pausar/retomar temporizadores em visibilitychange
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Pausar e registrar tempo acumulado das seções ativas
      activeSectionTimers.forEach((start, sectionId) => {
        const duration = Date.now() - start;
        if (duration > 500) {
          track('section_engaged', { section_id: sectionId, duration_ms: duration });
        }
      });
      activeSectionTimers.clear();
    } else if (document.visibilityState === 'visible') {
      // Re-iniciar timers das seções atualmente visíveis
      document.querySelectorAll('[data-section-id]').forEach(sec => {
        const rect = sec.getBoundingClientRect();
        const winHeight = window.innerHeight;
        const visibleHeight = Math.min(rect.bottom, winHeight) - Math.max(rect.top, 0);
        if (visibleHeight > (rect.height * 0.5)) {
          const sectionId = sec.getAttribute('data-section-id');
          if (sectionId) activeSectionTimers.set(sectionId, Date.now());
        }
      });
    }
  });

  // Flush ao descarregar a página
  window.addEventListener('beforeunload', () => {
    activeSectionTimers.forEach((start, sectionId) => {
      const duration = Date.now() - start;
      if (duration > 500) {
        track('section_engaged', { section_id: sectionId, duration_ms: duration });
      }
    });
  });

  // ============================================================================
  // 10. INICIALIZAÇÃO NO CARREGAMENTO
  // ============================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Session start se for nova sessão
    if (isNewSession) {
      track('session_start', {
        landing_path: window.location.pathname,
        device_type: deviceType,
        browser: browserName
      });
    }

    // 2. Page view inicial
    track('page_view', { page_path: window.location.pathname });

    // 3. LP view inicial
    track('lp_view', { page_path: window.location.pathname });

    // 4. Inicializar observers
    initLpEngagementTracking();
    initCtaObserver();
  });

  return {
    track,
    getSessionId: () => sessionId,
    getVisitorId: () => visitorId,
    getUtms: () => utms,
    getDevice: () => deviceType
  };
})();
