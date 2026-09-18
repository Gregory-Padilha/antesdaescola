/**
 * ANTES DA ESCOLA™ - Test Suite Completa de Autenticação, Proteção de Rotas e Analytics Comportamental Real
 */

const http = require('http');
const bcrypt = require('bcryptjs');
const app = require('../server');
const db = require('../db');

// Test Config
const TEST_PORT = 3199;
const TEST_LOGIN = 'admin_test_user';
const TEST_PASSWORD = 'super_secret_test_password_123';
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 12);

process.env.PORT = String(TEST_PORT);
process.env.ADMIN_LOGIN = TEST_LOGIN;
process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
process.env.SESSION_SECRET = 'test_secret_32_characters_long_key_abc_123';

let server;
let serverUrl;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch(e) {}

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      let bodyData = options.body;
      if (typeof options.body === 'object') {
        bodyData = JSON.stringify(options.body);
        req.setHeader('Content-Type', 'application/json');
      }
      req.setHeader('Content-Length', Buffer.byteLength(bodyData));
      req.write(bodyData);
    }

    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  INICIANDO BATERIA DE TESTES ANALYTICS COMPORTAMENTAL');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Start Test Server
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        serverUrl = `http://127.0.0.1:${TEST_PORT}`;
        resolve();
      });
    });

    console.log('--- 1. TESTES DE ROTAS PÚBLICAS & HEADERS ---');
    
    // Test 1: Landing Page
    const lpRes = await request('/');
    assert(lpRes.status === 200 && lpRes.body.includes('Antes da Escola'), 'Landing page pública acessível em /');

    // Test 2: Login Page
    const loginRes = await request('/login');
    assert(loginRes.status === 200, '/login acessível publicamente');
    assert(loginRes.headers['x-robots-tag'] && loginRes.headers['x-robots-tag'].includes('noindex'), '/login possui header noindex, nofollow');

    console.log('\n--- 2. TESTES DE PROTEÇÃO DE ROTAS ADMIN ---');

    // Test 3: Unauthenticated access to /admin/dashboard redirects to /login
    const adminRes = await request('/admin/dashboard', { headers: { Accept: 'text/html' } });
    assert(adminRes.status === 302 && adminRes.headers.location === '/login', 'Acesso não autenticado a /admin/dashboard redireciona para /login');

    // Test 4: Unauthenticated API call returns 401
    const apiRes = await request('/api/admin/overview', { headers: { Accept: 'application/json' } });
    assert(apiRes.status === 401, 'API /api/admin/overview não autorizada retorna 401');

    console.log('\n--- 3. TESTES DE AUTENTICAÇÃO, SESSÃO & RATE LIMITING ---');

    // Test 5: Invalid credentials
    const badLoginRes = await request('/api/admin/login', {
      method: 'POST',
      body: { login: TEST_LOGIN, password: 'wrong_password' }
    });
    assert(badLoginRes.status === 401 && badLoginRes.json.error === 'ID ou senha inválidos.', 'Login com senha incorreta retorna erro genérico');

    // Test 6: Rate Limiting (trigger 5 failed attempts)
    for (let i = 0; i < 4; i++) {
      await request('/api/admin/login', {
        method: 'POST',
        body: { login: TEST_LOGIN, password: 'wrong_password' }
      });
    }
    const rateLimitRes = await request('/api/admin/login', {
      method: 'POST',
      body: { login: TEST_LOGIN, password: 'wrong_password' }
    });
    assert(rateLimitRes.status === 429 && rateLimitRes.json.error.includes('Muitas tentativas'), 'Rate limit bloqueia após 5 tentativas inválidas');

    // Reset failed attempts for test to continue testing
    db.db.prepare('DELETE FROM login_attempts').run();

    // Test 7: Valid Login
    const validLoginRes = await request('/api/admin/login', {
      method: 'POST',
      body: { login: TEST_LOGIN, password: TEST_PASSWORD }
    });
    assert(validLoginRes.status === 200 && validLoginRes.json.success === true, 'Login válido autentica com sucesso');
    
    const setCookie = validLoginRes.headers['set-cookie'] ? validLoginRes.headers['set-cookie'][0] : '';
    assert(setCookie.includes('admin_session=') && setCookie.includes('HttpOnly'), 'Cookie HttpOnly admin_session configurado no login');

    const authCookieHeader = { Cookie: setCookie.split(';')[0] };

    // Test 8: Authenticated request to /admin/dashboard
    const authAdminRes = await request('/admin/dashboard', { headers: { ...authCookieHeader, Accept: 'text/html' } });
    assert(authAdminRes.status === 200 && authAdminRes.body.includes('ANTES DA ESCOLA'), 'Administrador autenticado acessa /admin/dashboard');

    console.log('\n--- 4. TESTES DE INGESTÃO DE ANALYTICS COMPORTAMENTAL ---');

    const testSessionId = 'test-behavior-session-uuid-999';
    const testVisitorId = 'test-visitor-uuid-111';
    const testUtm = {
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'cbo_prospeccao_mar26',
      utm_content: 'criativo_01_video'
    };

    // 1. Session start
    const evStart = await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_sess_start_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'session_start',
        utm: testUtm,
        device_type: 'mobile',
        browser: 'Chrome Mobile',
        viewport_width: 390
      }
    });
    assert(evStart.status === 200 && evStart.json.success === true, 'Evento session_start registrado');

    // 2. Duplicate event check
    const evDup = await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_sess_start_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'session_start'
      }
    });
    assert(evDup.status === 200 && evDup.json.deduplicated === true, 'Deduplicação de evento por event_id idempotente');

    // 3. Quiz Start
    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_quiz_start_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'quiz_start'
      }
    });

    // 4. Quiz Questions 1 to 8 with duration_ms
    const questionsFlow = [
      { step: 1, question_id: 'child_age', answer: '3', duration_ms: 4200 },
      { step: 2, question_id: 'colors', answer: 'sem_dificuldade', duration_ms: 5100 },
      { step: 3, question_id: 'shapes', answer: 'na_hora', duration_ms: 3800 },
      { step: 4, question_id: 'numbers', answer: 'conta_objetos', duration_ms: 6200 },
      { step: 5, question_id: 'perception', answer: 'rapidamente', duration_ms: 4900 },
      { step: 6, question_id: 'logic', answer: 'acredito_sim', duration_ms: 5500 },
      { step: 7, question_id: 'motor', answer: 'bastante_controle', duration_ms: 4700 },
      { step: 8, question_id: 'parent_goal', answer: 'all', duration_ms: 6800 }
    ];

    for (const q of questionsFlow) {
      await request('/api/analytics/event', {
        method: 'POST',
        body: {
          event_id: `ev_step_view_${q.step}`,
          session_id: testSessionId,
          visitor_id: testVisitorId,
          event_name: 'quiz_step_view',
          step: q.step,
          question_id: q.question_id
        }
      });

      await request('/api/analytics/event', {
        method: 'POST',
        body: {
          event_id: `ev_ans_${q.step}`,
          session_id: testSessionId,
          visitor_id: testVisitorId,
          event_name: 'quiz_answer',
          step: q.step,
          question_id: q.question_id,
          answer: q.answer,
          duration_ms: q.duration_ms
        }
      });
    }

    // 5. Complete quiz & view result
    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_quiz_complete_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'quiz_complete',
        metadata: { result: 'Avançando no Ritmo Certo' }
      }
    });

    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_quiz_res_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'quiz_result_view',
        metadata: { result: 'Avançando no Ritmo Certo' }
      }
    });

    // 6. Enter Landing Page
    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_lp_view_01',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'lp_view',
        page_path: '/'
      }
    });

    // 7. LP Section Views & Engagement
    const sectionsFlow = [
      { section_id: 'hero', duration_ms: 18000 },
      { section_id: 'primeiro_dia', duration_ms: 12000 },
      { section_id: 'metodo_progressao', duration_ms: 15000 },
      { section_id: 'especialista', duration_ms: 10000 },
      { section_id: 'conteudo_5trilhas', duration_ms: 22000 },
      { section_id: 'oferta', duration_ms: 25000 }
    ];

    for (const s of sectionsFlow) {
      await request('/api/analytics/event', {
        method: 'POST',
        body: {
          event_id: `ev_sec_view_${s.section_id}`,
          session_id: testSessionId,
          visitor_id: testVisitorId,
          event_name: 'section_view',
          section_id: s.section_id
        }
      });

      await request('/api/analytics/event', {
        method: 'POST',
        body: {
          event_id: `ev_sec_eng_${s.section_id}`,
          session_id: testSessionId,
          visitor_id: testVisitorId,
          event_name: 'section_engaged',
          section_id: s.section_id,
          duration_ms: s.duration_ms
        }
      });
    }

    // 8. Scroll depth triggers
    for (const depth of [25, 50, 75]) {
      await request('/api/analytics/event', {
        method: 'POST',
        body: {
          event_id: `ev_scroll_${depth}`,
          session_id: testSessionId,
          visitor_id: testVisitorId,
          event_name: 'scroll_depth',
          scroll_depth: depth
        }
      });
    }

    // 9. CTA View & Click
    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_cta_view_offer',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'cta_view',
        cta_id: 'offer_checkout',
        section_id: 'oferta'
      }
    });

    await request('/api/analytics/event', {
      method: 'POST',
      body: {
        event_id: 'ev_cta_click_offer',
        session_id: testSessionId,
        visitor_id: testVisitorId,
        event_name: 'cta_click',
        cta_id: 'offer_checkout',
        section_id: 'oferta',
        metadata: { destination_type: 'checkout' }
      }
    });

    console.log('\n--- 5. TESTES DE APIS ANALÍTICAS DO DASHBOARD ---');

    // 1. Overview API
    const overviewRes = await request('/api/admin/overview?period=30d', { headers: authCookieHeader });
    assert(overviewRes.status === 200, 'API /api/admin/overview retorna 200');
    assert(overviewRes.json.data.kpi.totalVisitors >= 1, 'Overview calcula visitantes únicos');
    assert(overviewRes.json.data.kpi.quizStarted >= 1, 'Overview calcula inícios do quiz');
    assert(overviewRes.json.data.kpi.quizCompleted >= 1, 'Overview calcula conclusões do quiz');
    assert(overviewRes.json.data.kpi.lpViews >= 1, 'Overview calcula visualizações da LP');
    assert(overviewRes.json.data.kpi.ctaClicks >= 1, 'Overview calcula cliques em CTA');
    assert(overviewRes.json.data.kpi.scroll75 >= 1, 'Overview calcula sessões com scroll 75%');
    assert(overviewRes.json.data.kpi.purchases === undefined, 'Confirmação: ZERO métricas de compras/vendas no KPI do Overview');

    // 2. Quiz Funnel API
    const quizFunnelRes = await request('/api/admin/quiz?period=30d', { headers: authCookieHeader });
    assert(quizFunnelRes.status === 200, 'API /api/admin/quiz retorna 200');
    assert(quizFunnelRes.json.data.steps.length === 8, 'Quiz funnel retorna exatamente as 8 perguntas');
    assert(quizFunnelRes.json.data.steps[0].avgTimeSeconds > 0, 'Quiz funnel calcula tempo médio por pergunta');

    // 3. Answers API
    const answersRes = await request('/api/admin/answers?period=30d', { headers: authCookieHeader });
    assert(answersRes.status === 200, 'API /api/admin/answers retorna 200');
    assert(answersRes.json.data.questions.length === 8, 'Answers API retorna todas as 8 perguntas');
    assert(answersRes.json.data.resultsDistribution.length >= 1, 'Answers API retorna distribuição de resultados do quiz');

    // 4. Landing Page API
    const lpResApi = await request('/api/admin/landing-page?period=30d', { headers: authCookieHeader });
    assert(lpResApi.status === 200, 'API /api/admin/landing-page retorna 200');
    assert(lpResApi.json.data.summary.lpViews >= 1, 'LP API calcula total de visitas');
    assert(lpResApi.json.data.summary.avgTimeSeconds > 0, 'LP API calcula tempo médio engajado');
    assert(lpResApi.json.data.scrollDepth.length === 5, 'LP API retorna marcos de scroll 25%, 50%, 75%, 90%, 100%');
    assert(lpResApi.json.data.sections.length === 16, 'LP API retorna todas as 16 seções semânticas da LP');
    assert(lpResApi.json.data.ctas.length >= 1, 'LP API retorna desempenho dos CTAs com visualizações e cliques');

    // 5. Acquisition API
    const acqRes = await request('/api/admin/acquisition?period=30d&groupBy=utm_content', { headers: authCookieHeader });
    assert(acqRes.status === 200, 'API /api/admin/acquisition retorna 200');
    assert(acqRes.json.data.attributionTable.length >= 1, 'Acquisition API retorna tabela de criativos com scroll 75% e CTA Clicks');
    assert(acqRes.json.data.devices.length >= 1, 'Acquisition API retorna breakdown por dispositivo');

    // 6. Sessions API & Journey Timeline
    const sessionsRes = await request('/api/admin/sessions?period=30d', { headers: authCookieHeader });
    assert(sessionsRes.status === 200 && sessionsRes.json.data.sessions.length >= 1, 'API /api/admin/sessions lista sessões anônimas');

    const timelineRes = await request(`/api/admin/sessions/${testSessionId}/timeline`, { headers: authCookieHeader });
    assert(timelineRes.status === 200, 'API /api/admin/sessions/:sessionId/timeline retorna 200');
    assert(timelineRes.json.data.timeline.length >= 10, 'Timeline retorna jornada cronológica completa de eventos da sessão');

    // 7. Filters API
    const filtersRes = await request('/api/admin/filters', { headers: authCookieHeader });
    assert(filtersRes.status === 200 && Array.isArray(filtersRes.json.data.campaigns), 'API /api/admin/filters retorna opções dinâmicas');

    console.log('\n--- 6. TESTES DE TEMPO REAL: HEADERS E TIMESTAMP ---');
    assert(!!overviewRes.json.generated_at, 'Overview API retorna generated_at timestamp');
    assert(new Date(overviewRes.json.generated_at).getTime() > 0, 'Overview generated_at é uma data ISO válida');
    assert(overviewRes.headers['cache-control'] && overviewRes.headers['cache-control'].includes('no-store'), 'Overview API possui Cache-Control: no-store');
    assert(!!quizFunnelRes.json.generated_at, 'Quiz API retorna generated_at timestamp');
    assert(!!lpResApi.json.generated_at, 'LP API retorna generated_at timestamp');
    assert(!!acqRes.json.generated_at, 'Acquisition API retorna generated_at timestamp');
    assert(!!sessionsRes.json.generated_at, 'Sessions API retorna generated_at timestamp');

    console.log('\n--- 7. TESTE DE LOGOUT ---');
    const logoutRes = await request('/api/admin/logout', { method: 'POST', headers: authCookieHeader });
    assert(logoutRes.status === 200, 'Logout executado com sucesso');

  } catch (err) {
    console.error('Erro fatal durante execução dos testes:', err);
    failed++;
  } finally {
    if (server) server.close();
  }

  console.log('\n====================================================');
  console.log(`  RESULTADO: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
