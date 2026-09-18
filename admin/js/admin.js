/**
 * ANTES DA ESCOLA™ - PAINEL ADMINISTRATIVO (ADMIN JS)
 * Sistema de Analytics Comportamental do Funil & Landing Page
 * Atualização Automática em Tempo Quase Real (Intelligent Auto-Refresh Polling)
 * 
 * Funcionalidades:
 * 1. LIVE_REFRESH_INTERVAL = 5000 (5 segundos centralizado)
 * 2. Carga imediata ao abrir e ao alterar qualquer filtro
 * 3. Preservação estrita de filtros ativos (período, campanhas, criativos, dispositivos)
 * 4. Cancelamento de requisições sobrepostas via AbortController
 * 5. Pausa automática quando aba em background (document.visibilityState === 'hidden')
 * 6. Reconexão e busca instantânea ao recuperar foco ou visibilidade
 * 7. Indicador no Header: ● AO VIVO / ● PAUSADO / ● RECONECTANDO + "Atualizado agora / há Xs"
 * 8. Botão manual "↻ Atualizar" sem recarregar a página
 * 9. Atualizações in-place sem flicker, sem skeletons e com micro-transições suaves nos números
 * 10. Atualização não-destrutiva dos gráficos Chart.js (update('none'))
 * 11. Consulta estrita apenas do endpoint da aba ativa (Overview, Quiz, Respostas, LP, Aquisição, Sessões)
 * 12. Backoff exponencial em caso de erro de rede e interrupção imediata em 401 (redireciona para /login)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // CONFIGURAÇÃO CENTRAL DE TEMPO REAL
  // ==========================================================================
  const LIVE_REFRESH_INTERVAL = 5000; // 5 segundos
  const MAX_BACKOFF_INTERVAL = 30000;  // 30 segundos

  // Application State
  const state = {
    currentTab: 'overview',
    filters: {
      period: '30d',
      startDate: '',
      endDate: '',
      utm_campaign: '',
      utm_content: '',
      utm_source: '',
      device: '',
      groupBy: 'utm_content'
    },
    charts: {
      daily: null,
      quizRetention: null,
      lpRetention: null
    },
    isFetching: false,
    isPaused: false,
    pollTimer: null,
    relativeTimeTimer: null,
    lastGeneratedAt: null,
    consecutiveErrors: 0,
    activeAbortController: null
  };

  // DOM Elements - Navigation & Layout
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.dashboard-panel');
  const pageTitle = document.getElementById('page-title');
  const btnLogout = document.getElementById('btn-logout');
  const userDisplay = document.getElementById('user-display');
  const btnMobileToggle = document.getElementById('btn-mobile-toggle');
  const adminSidebar = document.getElementById('admin-sidebar');

  // DOM Elements - Live Header Status & Manual Refresh
  const liveBadge = document.getElementById('live-badge');
  const liveText = document.getElementById('live-text');
  const liveTime = document.getElementById('live-time');
  const btnManualRefresh = document.getElementById('btn-manual-refresh');
  const refreshIcon = document.getElementById('refresh-icon');
  const refreshLabel = document.getElementById('refresh-label');

  // DOM Elements - Filters
  const periodPills = document.querySelectorAll('.pill-btn');
  const customDateBox = document.getElementById('custom-date-box');
  const inputStartDate = document.getElementById('filter-start-date');
  const inputEndDate = document.getElementById('filter-end-date');
  const btnApplyCustomDate = document.getElementById('btn-apply-custom-date');
  const selectCampaign = document.getElementById('filter-campaign');
  const selectContent = document.getElementById('filter-content');
  const selectSource = document.getElementById('filter-source');
  const selectDevice = document.getElementById('filter-device');
  const selectAcquisitionGroupBy = document.getElementById('acquisition-group-by');

  // DOM Elements - Modal & Timeline
  const timelineModal = document.getElementById('session-timeline-modal');
  const btnCloseTimelineModal = document.getElementById('btn-close-timeline-modal');
  const timelineModalTitle = document.getElementById('timeline-modal-title');
  const timelineModalSubtitle = document.getElementById('timeline-modal-subtitle');
  const timelineModalBody = document.getElementById('timeline-modal-body');

  // ==========================================================================
  // 1. INITIALIZATION & AUTH STATUS
  // ==========================================================================
  async function initAuth() {
    try {
      const res = await fetch('/api/admin/me');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (data.user && userDisplay) {
        userDisplay.textContent = data.user;
      }
    } catch (err) {
      window.location.href = '/login';
    }
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
      } catch (e) {}
      window.location.href = '/login';
    });
  }

  if (btnMobileToggle && adminSidebar) {
    btnMobileToggle.addEventListener('click', () => {
      adminSidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!adminSidebar.contains(e.target) && e.target !== btnMobileToggle) {
        adminSidebar.classList.remove('open');
      }
    });
  }

  // ==========================================================================
  // 2. LIVE STATUS BADGE & RELATIVE TIME TICKER
  // ==========================================================================
  function setLiveStatus(status, text) {
    if (!liveBadge || !liveText) return;

    liveBadge.className = 'live-badge';
    if (status === 'online') {
      liveBadge.classList.add('live-status-online');
      liveText.textContent = text || 'AO VIVO';
    } else if (status === 'paused') {
      liveBadge.classList.add('live-status-paused');
      liveText.textContent = text || 'PAUSADO';
    } else if (status === 'reconnecting') {
      liveBadge.classList.add('live-status-reconnecting');
      liveText.textContent = text || 'RECONECTANDO';
    } else if (status === 'error') {
      liveBadge.classList.add('live-status-error');
      liveText.textContent = text || 'FALHA AO ATUALIZAR';
    }
  }

  function updateRelativeTimeDisplay() {
    if (!liveTime || !state.lastGeneratedAt) return;

    if (state.isPaused) {
      liveTime.textContent = 'Pausado em background';
      return;
    }

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - state.lastGeneratedAt.getTime()) / 1000));

    if (elapsedSec < 3) {
      liveTime.textContent = 'Atualizado agora';
    } else if (elapsedSec < 60) {
      liveTime.textContent = `Atualizado há ${elapsedSec}s`;
    } else {
      const min = Math.floor(elapsedSec / 60);
      const sec = elapsedSec % 60;
      liveTime.textContent = `Atualizado há ${min}m ${sec}s`;
    }
  }

  // Start 1-second relative time updater
  state.relativeTimeTimer = setInterval(updateRelativeTimeDisplay, 1000);

  // Manual Refresh Button Action
  if (btnManualRefresh) {
    btnManualRefresh.addEventListener('click', () => {
      if (btnManualRefresh.classList.contains('refreshing')) return;
      btnManualRefresh.classList.add('refreshing');
      if (refreshLabel) refreshLabel.textContent = 'Atualizando...';

      fetchActiveTabData({ manual: true }).finally(() => {
        setTimeout(() => {
          btnManualRefresh.classList.remove('refreshing');
          if (refreshLabel) refreshLabel.textContent = 'Atualizar';
        }, 300);
      });
    });
  }

  // ==========================================================================
  // 3. TAB NAVIGATION & ROUTING
  // ==========================================================================
  const TAB_TITLES = {
    overview: 'Visão Geral Comportamental',
    quiz: 'Funil do Quiz',
    answers: 'Respostas do Quiz',
    'landing-page': 'Desempenho da Landing Page',
    acquisition: 'Aquisição & Criativos',
    sessions: 'Sessões & Jornada'
  };

  function switchTab(tabKey) {
    if (state.currentTab === tabKey) return;
    state.currentTab = tabKey;

    // Update Nav Buttons
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabKey) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Panels
    panels.forEach(p => {
      if (p.id === `panel-${tabKey}`) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Update Page Title
    if (pageTitle) {
      pageTitle.textContent = TAB_TITLES[tabKey] || 'Visão Geral';
    }

    if (adminSidebar) {
      adminSidebar.classList.remove('open');
    }

    // Trigger immediate fetch for newly activated tab
    fetchActiveTabData({ immediate: true });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Check URL pathname for direct tab routing
  const path = window.location.pathname;
  if (path.includes('/quiz')) switchTab('quiz');
  else if (path.includes('/respostas')) switchTab('answers');
  else if (path.includes('/landing-page')) switchTab('landing-page');
  else if (path.includes('/aquisicao')) switchTab('acquisition');
  else if (path.includes('/sessoes')) switchTab('sessions');
  else switchTab('overview');

  // ==========================================================================
  // 4. FILTERS SETUP & PRESERVATION
  // ==========================================================================
  periodPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const period = pill.getAttribute('data-period');
      if (!period || state.filters.period === period) return;

      periodPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.period = period;

      if (period === 'custom') {
        if (customDateBox) customDateBox.style.display = 'flex';
      } else {
        if (customDateBox) customDateBox.style.display = 'none';
        // Immediately fetch with new filter
        fetchActiveTabData({ immediate: true });
      }
    });
  });

  if (btnApplyCustomDate) {
    btnApplyCustomDate.addEventListener('click', () => {
      state.filters.startDate = inputStartDate ? inputStartDate.value : '';
      state.filters.endDate = inputEndDate ? inputEndDate.value : '';
      if (state.filters.startDate && state.filters.endDate) {
        fetchActiveTabData({ immediate: true });
      }
    });
  }

  if (selectCampaign) {
    selectCampaign.addEventListener('change', () => {
      state.filters.utm_campaign = selectCampaign.value;
      fetchActiveTabData({ immediate: true });
    });
  }

  if (selectContent) {
    selectContent.addEventListener('change', () => {
      state.filters.utm_content = selectContent.value;
      fetchActiveTabData({ immediate: true });
    });
  }

  if (selectSource) {
    selectSource.addEventListener('change', () => {
      state.filters.utm_source = selectSource.value;
      fetchActiveTabData({ immediate: true });
    });
  }

  if (selectDevice) {
    selectDevice.addEventListener('change', () => {
      state.filters.device = selectDevice.value;
      fetchActiveTabData({ immediate: true });
    });
  }

  if (selectAcquisitionGroupBy) {
    selectAcquisitionGroupBy.addEventListener('change', () => {
      state.filters.groupBy = selectAcquisitionGroupBy.value;
      fetchActiveTabData({ immediate: true });
    });
  }

  // Load available UTM filter options dynamically from server without overwriting user's active choice
  async function loadFilterOptions() {
    try {
      const res = await fetch('/api/admin/filters', {
        headers: { 'Cache-Control': 'no-store' }
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!data.success || !data.data) return;

      const { campaigns, contents, sources } = data.data;

      const currentCamp = selectCampaign ? selectCampaign.value : '';
      const currentCont = selectContent ? selectContent.value : '';
      const currentSrc = selectSource ? selectSource.value : '';

      if (selectCampaign && campaigns) {
        selectCampaign.innerHTML = '<option value="">Todas as Campanhas</option>' +
          campaigns.map(c => `<option value="${escapeHtml(c)}" ${c === currentCamp ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      }

      if (selectContent && contents) {
        selectContent.innerHTML = '<option value="">Todos os Criativos</option>' +
          contents.map(c => `<option value="${escapeHtml(c)}" ${c === currentCont ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      }

      if (selectSource && sources) {
        selectSource.innerHTML = '<option value="">Todas as Origens</option>' +
          sources.map(s => `<option value="${escapeHtml(s)}" ${s === currentSrc ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
      }
    } catch (e) {}
  }

  // Build query string from active filters
  function getQueryString() {
    const params = new URLSearchParams();
    params.set('period', state.filters.period);
    if (state.filters.period === 'custom') {
      if (state.filters.startDate) params.set('startDate', state.filters.startDate);
      if (state.filters.endDate) params.set('endDate', state.filters.endDate);
    }
    if (state.filters.utm_campaign) params.set('utm_campaign', state.filters.utm_campaign);
    if (state.filters.utm_content) params.set('utm_content', state.filters.utm_content);
    if (state.filters.utm_source) params.set('utm_source', state.filters.utm_source);
    if (state.filters.device) params.set('device', state.filters.device);
    if (state.filters.groupBy) params.set('groupBy', state.filters.groupBy);
    return params.toString();
  }

  // Helper: Escape HTML strings to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Format Date
  function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }

  // Helper: Format Duration (seconds/minutes)
  function formatDurationSec(sec) {
    const s = Math.round(sec || 0);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  }

  // Helper: In-Place Text Update with Micro-Animation (Zero-Flicker)
  function updateTextWithAnimation(elementId, newText) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const formattedNew = String(newText !== undefined && newText !== null ? newText : '0');
    if (el.textContent !== formattedNew) {
      el.textContent = formattedNew;
      el.classList.remove('metric-value-updated');
      // Trigger reflow to restart CSS animation
      void el.offsetWidth;
      el.classList.add('metric-value-updated');
    }
  }

  // ==========================================================================
  // 5. INTELLIGENT AUTO-REFRESH ENGINE & POLLING SCHEDULER
  // ==========================================================================

  function scheduleNextPoll(overrideInterval) {
    clearTimeout(state.pollTimer);

    if (state.isPaused) return;

    let delay = overrideInterval || LIVE_REFRESH_INTERVAL;
    if (state.consecutiveErrors > 0) {
      // Exponential backoff: 5s -> 10s -> 20s -> 30s max
      delay = Math.min(LIVE_REFRESH_INTERVAL * Math.pow(2, state.consecutiveErrors - 1), MAX_BACKOFF_INTERVAL);
    }

    state.pollTimer = setTimeout(() => {
      fetchActiveTabData({ immediate: false });
    }, delay);
  }

  async function fetchActiveTabData(options = {}) {
    const { immediate = false, manual = false } = options;

    // If already fetching and this is an immediate user-triggered change, abort previous in-flight request
    if (state.isFetching) {
      if (immediate || manual) {
        if (state.activeAbortController) {
          state.activeAbortController.abort();
        }
      } else {
        // Skip routine cycle if one is already running
        return;
      }
    }

    // Set up new AbortController
    state.activeAbortController = new AbortController();
    const signal = state.activeAbortController.signal;
    state.isFetching = true;

    if (state.consecutiveErrors > 0) {
      setLiveStatus('reconnecting', 'RECONECTANDO');
    }

    const tab = state.currentTab;
    let promise;

    try {
      if (tab === 'overview') promise = loadOverview(signal);
      else if (tab === 'quiz') promise = loadQuizFunnel(signal);
      else if (tab === 'answers') promise = loadAnswers(signal);
      else if (tab === 'landing-page') promise = loadLandingPage(signal);
      else if (tab === 'acquisition') promise = loadAcquisition(signal);
      else if (tab === 'sessions') promise = loadSessions(signal);

      await promise;

      // On successful completion:
      state.consecutiveErrors = 0;
      setLiveStatus('online', 'AO VIVO');
      updateRelativeTimeDisplay();
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was intentionally cancelled due to filter change/tab switch - ignore
        return;
      }

      console.warn(`[Auto-Refresh Error on ${tab}]:`, err.message);
      state.consecutiveErrors++;
      setLiveStatus('error', 'FALHA AO ATUALIZAR');
    } finally {
      state.isFetching = false;
      scheduleNextPoll();
    }
  }

  // ==========================================================================
  // 6. VISIBILITY & WINDOW FOCUS LIFECYCLE LISTENERS
  // ==========================================================================
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Pause polling when browser tab is hidden
      state.isPaused = true;
      clearTimeout(state.pollTimer);
      setLiveStatus('paused', 'PAUSADO');
      updateRelativeTimeDisplay();
    } else {
      // Resume polling immediately when tab becomes visible
      state.isPaused = false;
      setLiveStatus('reconnecting', 'RECONECTANDO');
      fetchActiveTabData({ immediate: true });
      loadFilterOptions();
    }
  });

  window.addEventListener('focus', () => {
    if (!state.isPaused && state.lastGeneratedAt) {
      const elapsed = Date.now() - state.lastGeneratedAt.getTime();
      if (elapsed > 3000) {
        fetchActiveTabData({ immediate: true });
      }
    }
  });

  // ==========================================================================
  // 7. TAB DATA LOADERS & NON-DESTRUCTIVE RENDERERS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // A. VISÃO GERAL (OVERVIEW)
  // --------------------------------------------------------------------------
  async function loadOverview(signal) {
    const res = await fetch(`/api/admin/overview?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { kpi, funnel, biggestDrop, dailyChart } = json.data;

    // Update KPI Cards with micro-transitions
    updateTextWithAnimation('kpi-visitors', (kpi.totalVisitors || kpi.visitors || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('kpi-sessions', (kpi.totalSessions || kpi.sessions || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('kpi-started', (kpi.quizStarted || 0).toLocaleString('pt-BR'));

    const startedRate = (kpi.totalVisitors || kpi.visitors) > 0 ? Math.round(((kpi.quizStarted || 0) / (kpi.totalVisitors || kpi.visitors)) * 100) : 0;
    updateTextWithAnimation('kpi-started-rate', `${startedRate}% dos visitantes`);

    updateTextWithAnimation('kpi-completed', (kpi.quizCompleted || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('kpi-completion-rate', `${kpi.quizCompletionRate || 0}% concluíram`);
    updateTextWithAnimation('kpi-completion-percentage', `${kpi.quizCompletionRate || 0}%`);

    updateTextWithAnimation('kpi-lp', (kpi.lpViews || 0).toLocaleString('pt-BR'));
    const lpRate = (kpi.quizCompleted || 0) > 0 ? Math.round(((kpi.lpViews || 0) / (kpi.quizCompleted || 1)) * 100) : 0;
    updateTextWithAnimation('kpi-lp-rate', `${lpRate}% após resultado`);

    updateTextWithAnimation('kpi-cta-clicks', (kpi.ctaClicks || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('kpi-cta-ctr', `${kpi.ctaCtr || 0}%`);
    updateTextWithAnimation('kpi-lp-time', `${kpi.lpAvgTime || kpi.avgLpEngagedSeconds || 0}s`);
    updateTextWithAnimation('kpi-scroll-75', (kpi.scroll75 || 0).toLocaleString('pt-BR'));

    const scroll75Rate = (kpi.lpViews || 0) > 0 ? Math.round(((kpi.scroll75 || 0) / (kpi.lpViews || 1)) * 100) : 0;
    updateTextWithAnimation('kpi-scroll-75-rate', `${scroll75Rate}% dos que viram a LP`);

    // Update Biggest Drop-Off Highlight Card
    const dropDesc = document.getElementById('drop-highlight-desc');
    const dropVal = document.getElementById('drop-highlight-val');

    if (dropDesc && dropVal) {
      if (biggestDrop && biggestDrop.fromStep && biggestDrop.dropCount > 0 && biggestDrop.dropPercent > 0) {
        dropDesc.textContent = `${biggestDrop.fromStep} ➔ ${biggestDrop.toStep} (${biggestDrop.dropCount.toLocaleString('pt-BR')} abandonaram)`;
        updateTextWithAnimation('drop-highlight-val', `-${biggestDrop.dropPercent}%`);
      } else {
        dropDesc.textContent = biggestDrop && biggestDrop.message ? biggestDrop.message : 'Dados insuficientes para análise.';
        dropVal.textContent = '—';
      }
    }

    // Render Macro Funnel List In-Place
    const funnelContainer = document.getElementById('overview-funnel-list');
    if (funnelContainer && funnel) {
      if (funnel.length === 0 || (kpi.totalVisitors || kpi.visitors) === 0) {
        funnelContainer.innerHTML = '<div class="empty-state"><div class="empty-state-title">Sem dados no período</div><p class="empty-state-text">Nenhum evento registrado com os filtros selecionados.</p></div>';
      } else {
        funnelContainer.innerHTML = funnel.map(step => {
          const dropTag = step.dropPercent > 0 
            ? `<span class="funnel-drop-indicator">↓ -${step.dropPercent}% abandono</span>` 
            : '';

          return `
            <div class="funnel-row">
              <div class="funnel-meta">
                <span class="funnel-step-name">${escapeHtml(step.name)}</span>
                <div class="funnel-step-counts">
                  <span class="funnel-count">${step.count.toLocaleString('pt-BR')}</span>
                  <span class="funnel-percent">${step.percentOfStart}%</span>
                </div>
              </div>
              <div class="funnel-track">
                <div class="funnel-fill" style="width: ${Math.min(step.percentOfStart, 100)}%;"></div>
              </div>
              ${dropTag}
            </div>
          `;
        }).join('');
      }
    }

    // Update Daily Chart Non-Destructively
    renderDailyChart(dailyChart || []);
  }

  function renderDailyChart(data) {
    const canvas = document.getElementById('chart-daily-overview');
    if (!canvas) return;

    const labels = data.map(d => {
      const parts = (d.day || '').split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.day;
    });
    const visitors = data.map(d => d.visitors || 0);
    const started = data.map(d => d.quizStarted || 0);
    const completed = data.map(d => d.quizCompleted || 0);
    const lpViews = data.map(d => d.lpViews || 0);
    const ctaClicks = data.map(d => d.ctaClicks || 0);

    const safeLabels = labels.length > 0 ? labels : ['Sem dados'];

    if (state.charts.daily) {
      // In-Place update without canvas flicker or resize
      state.charts.daily.data.labels = safeLabels;
      state.charts.daily.data.datasets[0].data = visitors.length > 0 ? visitors : [0];
      state.charts.daily.data.datasets[1].data = started.length > 0 ? started : [0];
      state.charts.daily.data.datasets[2].data = completed.length > 0 ? completed : [0];
      state.charts.daily.data.datasets[3].data = lpViews.length > 0 ? lpViews : [0];
      state.charts.daily.data.datasets[4].data = ctaClicks.length > 0 ? ctaClicks : [0];
      state.charts.daily.update('none');
      return;
    }

    const ctx = canvas.getContext('2d');
    state.charts.daily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: safeLabels,
        datasets: [
          {
            label: 'Visitantes',
            data: visitors.length > 0 ? visitors : [0],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Quiz Início',
            data: started.length > 0 ? started : [0],
            borderColor: '#F59E0B',
            backgroundColor: 'transparent',
            tension: 0.3
          },
          {
            label: 'Quiz Concluído',
            data: completed.length > 0 ? completed : [0],
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            tension: 0.3
          },
          {
            label: 'Visitas LP',
            data: lpViews.length > 0 ? lpViews : [0],
            borderColor: '#EE603B',
            backgroundColor: 'transparent',
            tension: 0.3
          },
          {
            label: 'Cliques CTA',
            data: ctaClicks.length > 0 ? ctaClicks : [0],
            borderColor: '#8B5CF6',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // B. FUNIL DO QUIZ (QUIZ RETENTION & 8 STEPS TABLE)
  // --------------------------------------------------------------------------
  async function loadQuizFunnel(signal) {
    const res = await fetch(`/api/admin/quiz?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { totalStarted, steps, biggestDrop, longestQuestion, slowestQuestion } = json.data;

    // Update Highlights
    const activeLongest = longestQuestion || slowestQuestion;
    const dropDesc = document.getElementById('quiz-biggest-drop-desc');
    const dropVal = document.getElementById('quiz-biggest-drop-val');
    if (dropDesc && dropVal) {
      if (biggestDrop && (biggestDrop.fromStep || biggestDrop.step)) {
        dropDesc.textContent = `${biggestDrop.fromStep || biggestDrop.step} ➔ ${biggestDrop.toStep || ''} (${(biggestDrop.dropCount || biggestDrop.abandoned || 0).toLocaleString('pt-BR')} saídas)`;
        updateTextWithAnimation('quiz-biggest-drop-val', `-${biggestDrop.dropPercent}%`);
      } else {
        dropDesc.textContent = 'Sem abandonos significativos.';
        dropVal.textContent = '—';
      }
    }

    const timeDesc = document.getElementById('quiz-longest-time-desc');
    const timeVal = document.getElementById('quiz-longest-time-val');
    if (timeDesc && timeVal) {
      if (activeLongest && (activeLongest.step || activeLongest.title)) {
        timeDesc.textContent = `${activeLongest.title || `Pergunta ${activeLongest.step}`}`;
        updateTextWithAnimation('quiz-longest-time-val', `${activeLongest.avgTimeSeconds || activeLongest.avgSeconds || 0}s`);
      } else {
        timeDesc.textContent = 'Sem dados de tempo.';
        timeVal.textContent = '—';
      }
    }

    // Render Retention Chart
    renderQuizRetentionChart(steps || []);

    // Render Steps Table In-Place
    const tbody = document.getElementById('tbody-quiz-steps');
    if (tbody && steps) {
      if (steps.length === 0 || totalStarted === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-title">Sem dados no período</div></td></tr>';
      } else {
        tbody.innerHTML = steps.map(s => `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(s.title)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(s.subtitle)}</div>
            </td>
            <td class="col-numeric">${s.reached.toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${s.advanced.toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold">${s.retentionPercent}%</td>
            <td class="col-numeric" style="color: var(--color-danger);">${s.abandoned.toLocaleString('pt-BR')}</td>
            <td class="col-numeric" style="color: var(--color-danger); font-weight: 700;">-${s.dropPercent}%</td>
            <td class="col-numeric font-weight-bold">${(s.avgTimeSeconds || s.avgSeconds) > 0 ? `${s.avgTimeSeconds || s.avgSeconds}s` : '—'}</td>
          </tr>
        `).join('');
      }
    }
  }

  function renderQuizRetentionChart(steps) {
    const canvas = document.getElementById('chart-quiz-retention');
    if (!canvas) return;

    const labels = steps.map(s => s.title.replace('Pergunta ', 'Q').split(' • ')[0]);
    const retentionData = steps.map(s => s.retentionPercent || 0);

    const safeLabels = labels.length > 0 ? labels : ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

    if (state.charts.quizRetention) {
      state.charts.quizRetention.data.labels = safeLabels;
      state.charts.quizRetention.data.datasets[0].data = retentionData.length > 0 ? retentionData : [0, 0, 0, 0, 0, 0, 0, 0];
      state.charts.quizRetention.update('none');
      return;
    }

    const ctx = canvas.getContext('2d');
    state.charts.quizRetention = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: safeLabels,
        datasets: [
          {
            label: 'Retenção (%)',
            data: retentionData.length > 0 ? retentionData : [0, 0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#EE603B',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: val => `${val}%`
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // C. RESPOSTAS & RESULTADOS (ANSWERS & RESULTS DISTRIBUTION)
  // --------------------------------------------------------------------------
  async function loadAnswers(signal) {
    const res = await fetch(`/api/admin/answers?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { questions, resultsDistribution } = json.data;

    // Render Results Distribution Table In-Place
    const tbodyResults = document.getElementById('tbody-results-distribution');
    if (tbodyResults && resultsDistribution) {
      if (resultsDistribution.length === 0) {
        tbodyResults.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-title">Sem resultados concluídos no período</div></td></tr>';
      } else {
        tbodyResults.innerHTML = resultsDistribution.map(r => `
          <tr>
            <td><span class="badge-tag badge-primary" style="font-size:0.85rem;">${escapeHtml(r.category)}</span></td>
            <td class="col-numeric font-weight-bold">${r.count.toLocaleString('pt-BR')}</td>
            <td class="col-numeric">${r.percent}%</td>
            <td class="col-numeric">${(r.lpCount || 0).toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${r.lpRate}%</td>
            <td class="col-numeric">${(r.ctaClickCount || 0).toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-success);">${r.ctaRate}%</td>
          </tr>
        `).join('');
      }
    }

    // Render 8 Questions Breakdown Cards In-Place
    const container = document.getElementById('questions-grid-container');
    if (container && questions) {
      container.innerHTML = questions.map(q => {
        const optionsHtml = q.options.map(opt => `
          <div class="option-bar-item">
            <div class="option-bar-header">
              <div>
                <span class="option-label-text">${escapeHtml(opt.label)}</span>
                ${opt.sub ? `<span style="font-size: 0.76rem; color: var(--text-muted); display: block;">${escapeHtml(opt.sub)}</span>` : ''}
              </div>
              <div style="text-align: right;">
                <span class="option-bar-counts">${opt.count.toLocaleString('pt-BR')} (${opt.percent}%)</span>
                ${opt.quizCompletionRate !== undefined ? `<div class="option-completion-tag">✓ ${opt.quizCompletionRate}% concluíram o quiz</div>` : ''}
              </div>
            </div>
            <div class="option-track">
              <div class="option-fill" style="width: ${Math.min(opt.percent, 100)}%;"></div>
            </div>
          </div>
        `).join('');

        return `
          <div class="question-card">
            <div class="question-card-header">
              <div class="question-step-badge">${escapeHtml(q.title)} • Média: ${q.avgTimeSeconds || q.avgSeconds || 0}s</div>
              <h3 class="question-card-title">${escapeHtml(q.question)}</h3>
              <div class="question-responses-total">${q.totalResponses.toLocaleString('pt-BR')} respostas registradas</div>
            </div>
            <div class="options-distribution">
              ${optionsHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // --------------------------------------------------------------------------
  // D. LANDING PAGE (SEÇÕES, SCROLL & CTAs)
  // --------------------------------------------------------------------------
  async function loadLandingPage(signal) {
    const res = await fetch(`/api/admin/landing-page?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { summary, kpi, scrollDepth, sections, ctas } = json.data;
    const activeSummary = summary || kpi || {};

    // Summary KPIs with micro-animations
    updateTextWithAnimation('lp-kpi-views', (activeSummary.lpViews || activeSummary.lpVisitors || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('lp-kpi-avg-time', `${activeSummary.avgTimeSeconds || activeSummary.avgEngagedSeconds || 0}s`);
    updateTextWithAnimation('lp-kpi-med-time', `${activeSummary.medianTimeSeconds || activeSummary.medianEngagedSeconds || 0}s`);
    updateTextWithAnimation('lp-kpi-engaged', (activeSummary.engagedSessions || 0).toLocaleString('pt-BR'));
    
    const lpViewCount = activeSummary.lpViews || activeSummary.lpVisitors || 0;
    const engagedRate = lpViewCount > 0 ? Math.round(((activeSummary.engagedSessions || 0) / lpViewCount) * 100) : 0;
    updateTextWithAnimation('lp-kpi-engaged-rate', `${engagedRate}% da LP (≥10s / 2+ seções)`);

    updateTextWithAnimation('lp-kpi-cta-clicks', (activeSummary.totalCtaClicks || activeSummary.ctaClicks || 0).toLocaleString('pt-BR'));
    updateTextWithAnimation('lp-kpi-cta-ctr', `${activeSummary.overallCtaCtr || activeSummary.ctaCtr || 0}%`);

    // Render Scroll Depth Cards In-Place
    const scrollContainer = document.getElementById('scroll-depth-container');
    if (scrollContainer && scrollDepth) {
      scrollContainer.innerHTML = scrollDepth.map(sd => `
        <div class="scroll-depth-card">
          <div class="scroll-depth-header">
            <span class="scroll-depth-label">${sd.depth}%</span>
            <span class="scroll-depth-pct">${sd.percentOfLp}%</span>
          </div>
          <div class="scroll-depth-track">
            <div class="scroll-depth-fill" style="width: ${Math.min(sd.percentOfLp, 100)}%;"></div>
          </div>
          <div class="scroll-depth-count">${sd.sessionsCount.toLocaleString('pt-BR')} sessões</div>
        </div>
      `).join('');
    }

    // Render LP Sections Retention Chart Non-Destructively
    renderLpRetentionChart(sections || []);

    // Render LP Sections Table In-Place
    const tbodySections = document.getElementById('tbody-lp-sections');
    if (tbodySections && sections) {
      if (sections.length === 0 || lpViewCount === 0) {
        tbodySections.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-title">Sem dados de seções no período</div></td></tr>';
      } else {
        tbodySections.innerHTML = sections.map(s => `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(s.name)}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); font-family: monospace;">#${escapeHtml(s.id)}</div>
            </td>
            <td class="col-numeric font-weight-bold">${s.viewCount.toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${s.reachPercent}%</td>
            <td class="col-numeric">${s.avgEngagedSeconds}s</td>
            <td class="col-numeric" style="color: var(--color-success); font-weight: 700;">${s.advancedPercent}%</td>
            <td class="col-numeric" style="color: var(--color-danger); font-weight: 700;">-${s.dropPercent}%</td>
          </tr>
        `).join('');
      }
    }

    // Render LP CTAs Table In-Place
    const tbodyCtas = document.getElementById('tbody-lp-ctas');
    if (tbodyCtas && ctas) {
      if (ctas.length === 0) {
        tbodyCtas.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-title">Sem dados de CTAs no período</div></td></tr>';
      } else {
        tbodyCtas.innerHTML = ctas.map(c => {
          let ctrBadge = 'badge-info';
          if (c.ctr >= 20) ctrBadge = 'badge-success';
          else if (c.ctr < 5) ctrBadge = 'badge-warning';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(c.name)}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted); font-family: monospace;">id="${escapeHtml(c.ctaId || c.id)}"</div>
              </td>
              <td><span class="badge-tag badge-primary">${escapeHtml(c.sectionId || c.section_id)}</span></td>
              <td class="col-numeric">${c.views.toLocaleString('pt-BR')}</td>
              <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${c.clicks.toLocaleString('pt-BR')}</td>
              <td class="col-numeric"><span class="badge-tag ${ctrBadge}">${c.ctr}%</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function renderLpRetentionChart(sections) {
    const canvas = document.getElementById('chart-lp-sections-retention');
    if (!canvas) return;

    const labels = sections.map(s => s.name.split(' (')[0]);
    const reachData = sections.map(s => s.reachPercent || 0);

    const safeLabels = labels.length > 0 ? labels : ['Hero', 'Como Funciona', 'Oferta'];

    if (state.charts.lpRetention) {
      state.charts.lpRetention.data.labels = safeLabels;
      state.charts.lpRetention.data.datasets[0].data = reachData.length > 0 ? reachData : [0, 0, 0];
      state.charts.lpRetention.update('none');
      return;
    }

    const ctx = canvas.getContext('2d');
    state.charts.lpRetention = new Chart(ctx, {
      type: 'line',
      data: {
        labels: safeLabels,
        datasets: [
          {
            label: 'Alcance da Seção (% da LP)',
            data: reachData.length > 0 ? reachData : [0, 0, 0],
            borderColor: '#EE603B',
            backgroundColor: 'rgba(238, 96, 59, 0.1)',
            fill: true,
            tension: 0.25,
            pointBackgroundColor: '#EE603B',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: val => `${val}%`
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // E. AQUISIÇÃO & ATRIBUIÇÃO UTM (ACQUISITION)
  // --------------------------------------------------------------------------
  async function loadAcquisition(signal) {
    const res = await fetch(`/api/admin/acquisition?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { attributionTable, devices } = json.data;

    // Attribution Table In-Place
    const tbody = document.getElementById('tbody-acquisition');
    if (tbody && attributionTable) {
      if (attributionTable.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-state-title">Sem dados de tráfego no período</div></td></tr>';
      } else {
        tbody.innerHTML = attributionTable.map(r => `
          <tr>
            <td style="font-weight: 700; color: var(--text-main);">${escapeHtml(r.name)}</td>
            <td class="col-numeric font-weight-bold">${r.visitors.toLocaleString('pt-BR')}</td>
            <td class="col-numeric">${r.quizStarted.toLocaleString('pt-BR')}</td>
            <td class="col-numeric">${r.quizCompleted.toLocaleString('pt-BR')} (${r.quizCompletionRate}%)</td>
            <td class="col-numeric">${r.lpViews.toLocaleString('pt-BR')}</td>
            <td class="col-numeric">${r.scroll75.toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${r.ctaClicks.toLocaleString('pt-BR')}</td>
            <td class="col-numeric font-weight-bold" style="color: var(--color-success);">${r.ctaCtr}%</td>
            <td class="col-numeric">${r.lpAvgTime || r.avgLpSeconds || 0}s</td>
          </tr>
        `).join('');
      }
    }

    // Devices Table In-Place
    const tbodyDevices = document.getElementById('tbody-devices');
    if (tbodyDevices && devices) {
      if (devices.length === 0) {
        tbodyDevices.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-title">Sem dados por dispositivo</div></td></tr>';
      } else {
        tbodyDevices.innerHTML = devices.map(d => {
          let icon = '💻';
          if (d.device === 'mobile') icon = '📱';
          else if (d.device === 'tablet') icon = '📟';

          return `
            <tr>
              <td style="font-weight: 700;">${icon} ${escapeHtml(d.device)}</td>
              <td class="col-numeric font-weight-bold">${d.visitors.toLocaleString('pt-BR')}</td>
              <td class="col-numeric">${d.quizCompleted.toLocaleString('pt-BR')} (${d.quizCompletionRate}%)</td>
              <td class="col-numeric">${d.lpViews.toLocaleString('pt-BR')}</td>
              <td class="col-numeric">${d.scroll75.toLocaleString('pt-BR')}</td>
              <td class="col-numeric font-weight-bold" style="color: var(--color-primary);">${d.ctaClicks.toLocaleString('pt-BR')}</td>
              <td class="col-numeric font-weight-bold" style="color: var(--color-success);">${d.ctaCtr}%</td>
              <td class="col-numeric">${d.lpAvgTime || 0}s</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // --------------------------------------------------------------------------
  // F. SESSÕES ANÔNIMAS & TIMELINE (SESSIONS)
  // --------------------------------------------------------------------------
  async function loadSessions(signal) {
    const res = await fetch(`/api/admin/sessions?${getQueryString()}`, {
      signal,
      headers: { 'Cache-Control': 'no-store' }
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.generated_at) {
      state.lastGeneratedAt = new Date(json.generated_at);
    } else {
      state.lastGeneratedAt = new Date();
    }

    const { sessions } = json.data;

    const tbody = document.getElementById('tbody-sessions');
    if (tbody && sessions) {
      if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-state-title">Nenhuma sessão registrada no período</div></td></tr>';
      } else {
        tbody.innerHTML = sessions.map(s => {
          const rawId = s.session_id || s.sessionId || '';
          const shortId = s.shortId || (rawId ? '#' + rawId.substring(0, 8) : '#ANON');
          const utmParts = [s.utm_source || s.utmSource, s.utm_campaign || s.utmCampaign, s.utm_content || s.utmContent].filter(x => x && x !== '-').join(' / ') || 'Direto / Orgânico';
          
          const deviceType = s.device_type || s.deviceType || 'desktop';
          let deviceIcon = '💻';
          if (deviceType === 'mobile') deviceIcon = '📱';
          else if (deviceType === 'tablet') deviceIcon = '📟';

          const ctaCount = s.cta_clicked_count !== undefined ? s.cta_clicked_count : (s.cta_clicks || 0);
          const ctaBadge = ctaCount > 0 
            ? `<span class="badge-tag badge-success">${ctaCount} cliques</span>` 
            : `<span class="badge-tag badge-warning">0</span>`;

          const maxStep = s.statusBadge || s.max_step_reached || 'Visita';
          const activeDuration = s.totalLpEngagedSeconds !== undefined ? s.totalLpEngagedSeconds : (s.active_duration_seconds || 0);

          return `
            <tr>
              <td style="font-family: monospace; font-weight: 700; color: var(--color-primary);">${escapeHtml(shortId)}</td>
              <td>${formatDate(s.started_at || s.startedAt)}</td>
              <td style="max-width: 220px; word-break: break-all;">${escapeHtml(utmParts)}</td>
              <td>${deviceIcon} ${escapeHtml(deviceType)}</td>
              <td><span class="badge-tag badge-primary">${escapeHtml(maxStep)}</span></td>
              <td class="col-numeric">${s.event_count || s.pages_viewed || 1}</td>
              <td class="col-numeric font-weight-bold">${formatDurationSec(activeDuration)}</td>
              <td class="col-numeric">${ctaBadge}</td>
              <td class="col-numeric">
                <button class="btn-action btn-view-timeline" data-session-id="${escapeHtml(rawId)}">Ver Jornada ➔</button>
              </td>
            </tr>
          `;
        }).join('');

        // Attach Timeline Click Handlers
        document.querySelectorAll('.btn-view-timeline').forEach(btn => {
          btn.addEventListener('click', () => {
            const sessionId = btn.getAttribute('data-session-id');
            openSessionTimeline(sessionId);
          });
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // TIMELINE MODAL OPENER
  // --------------------------------------------------------------------------
  async function openSessionTimeline(sessionId) {
    if (!timelineModal) return;
    timelineModal.style.display = 'flex';
    timelineModalTitle.textContent = `Jornada da Sessão #${sessionId.substring(0, 8)}`;
    timelineModalSubtitle.textContent = 'Carregando eventos cronológicos...';
    timelineModalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Carregando timeline...</div></div>';

    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/timeline`, {
        headers: { 'Cache-Control': 'no-store' }
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        timelineModalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Erro ao carregar timeline</div></div>';
        return;
      }

      const { session, timeline } = json.data;

      const utmInfo = [
        session.utm_source ? `Origem: ${session.utm_source}` : null,
        session.utm_campaign ? `Campanha: ${session.utm_campaign}` : null,
        session.utm_content ? `Criativo: ${session.utm_content}` : null,
        session.device_type ? `Dispositivo: ${session.device_type}` : null
      ].filter(Boolean).join(' • ') || 'Acesso direto';

      timelineModalSubtitle.textContent = `${utmInfo} | Início: ${formatDate(session.started_at)}`;

      if (!timeline || timeline.length === 0) {
        timelineModalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhum evento registrado</div></div>';
        return;
      }

      // Render Chronological Timeline
      timelineModalBody.innerHTML = `
        <div class="timeline-list">
          ${timeline.map(item => {
            const isHighlight = item.type === 'cta_click' || item.type === 'quiz_complete';
            const dotClass = isHighlight ? 'timeline-dot highlight' : 'timeline-dot';

            let detailsHtml = '';
            if (item.details) {
              const parts = [];
              if (item.details.duration_ms) parts.push(`⏱️ ${(item.details.duration_ms / 1000).toFixed(1)}s`);
              if (item.details.question_id) parts.push(`Pergunta: <b>${escapeHtml(item.details.question_id)}</b>`);
              if (item.details.answer) parts.push(`Resposta: <b>${escapeHtml(item.details.answer)}</b>`);
              if (item.details.result) parts.push(`Perfil: <b>${escapeHtml(item.details.result)}</b>`);
              if (item.details.depth) parts.push(`Profundidade: <b>${item.details.depth}%</b>`);
              if (item.details.cta_id) parts.push(`Botão: <b>${escapeHtml(item.details.cta_id)}</b>`);
              if (item.details.section_id) parts.push(`Seção: <b>${escapeHtml(item.details.section_id)}</b>`);
              if (item.details.destination_type) parts.push(`Destino: <b>${escapeHtml(item.details.destination_type)}</b>`);

              if (parts.length > 0) {
                detailsHtml = `<div class="timeline-details">${parts.join(' | ')}</div>`;
              }
            }

            return `
              <div class="timeline-item">
                <div class="${dotClass}">${escapeHtml(item.icon || '•')}</div>
                <div class="timeline-header">
                  <span class="timeline-title">${escapeHtml(item.title)}</span>
                  <span class="timeline-time">${formatDate(item.timestamp || item.createdAt)}</span>
                </div>
                ${detailsHtml}
              </div>
            `;
          }).join('')}
        </div>
      `;

    } catch (err) {
      console.error('Erro ao carregar timeline:', err);
      timelineModalBody.innerHTML = '<div class="empty-state"><div class="empty-state-title">Erro ao carregar timeline</div></div>';
    }
  }

  // Close modal
  if (btnCloseTimelineModal && timelineModal) {
    btnCloseTimelineModal.addEventListener('click', () => {
      timelineModal.style.display = 'none';
    });

    timelineModal.addEventListener('click', (e) => {
      if (e.target === timelineModal) {
        timelineModal.style.display = 'none';
      }
    });
  }

  // ==========================================================================
  // 8. STARTUP INVOCATIONS (IMMEDIATE LOAD)
  // ==========================================================================
  initAuth();
  loadFilterOptions();
  // Immediate fetch of active tab data on page load
  fetchActiveTabData({ immediate: true });
});
