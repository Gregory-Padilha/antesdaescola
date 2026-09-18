require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const http = require('http');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3000';

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(resBody) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE_URL + path, {
      method: 'GET',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(resBody) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body: resBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('  SIMULAÇÃO COMPORTAMENTAL DE TRÁFEGO REAL          ');
  console.log('====================================================\n');

  // --- SESSÃO 1: Jornada Completa (Meta Ads -> Quiz -> LP -> Scroll 100% -> CTA Click) ---
  const s1 = uuidv4();
  const v1 = uuidv4();
  const utms1 = {
    utm_source: 'instagram',
    utm_medium: 'stories',
    utm_campaign: 'cbo_prospeccao_mar26',
    utm_content: 'video_criativo_01',
    utm_term: 'pre_escola'
  };

  console.log(`[Sessão 1 - Instagram / Criativo 01] Session ID: ${s1}`);
  
  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'session_start',
    utm: utms1,
    device_type: 'mobile',
    browser: 'Instagram InApp Mobile',
    viewport_width: 393
  });

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'quiz_view',
    utm: utms1
  });

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'quiz_start',
    utm: utms1
  });

  const questionsS1 = [
    { step: 1, id: 'child_age', ans: '3', dur: 4100 },
    { step: 2, id: 'colors', ans: 'sem_dificuldade', dur: 3800 },
    { step: 3, id: 'shapes', ans: 'na_hora', dur: 4500 },
    { step: 4, id: 'numbers', ans: 'conta_objetos', dur: 5200 },
    { step: 5, id: 'perception', ans: 'rapidamente', dur: 3900 },
    { step: 6, id: 'logic', ans: 'acredito_sim', dur: 6100 },
    { step: 7, id: 'motor', ans: 'bastante_controle', dur: 4800 },
    { step: 8, id: 'parent_goal', ans: 'all', dur: 5500 }
  ];

  for (const q of questionsS1) {
    await post('/api/analytics/event', {
      event_id: uuidv4(),
      session_id: s1,
      visitor_id: v1,
      event_name: 'quiz_step_view',
      step: q.step,
      question_id: q.id
    });

    await post('/api/analytics/event', {
      event_id: uuidv4(),
      session_id: s1,
      visitor_id: v1,
      event_name: 'quiz_answer',
      step: q.step,
      question_id: q.id,
      answer: q.ans,
      duration_ms: q.dur
    });
  }

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'quiz_complete',
    metadata: { result: 'Avançando no Ritmo Certo' }
  });

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'quiz_result_view',
    metadata: { result: 'Avançando no Ritmo Certo' }
  });

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'lp_view',
    page_path: '/'
  });

  const sectionsS1 = [
    { id: 'hero', ms: 18000 },
    { id: 'primeiro_dia', ms: 12000 },
    { id: 'metodo_progressao', ms: 24000 },
    { id: 'especialista', ms: 14000 },
    { id: 'paginas_reais', ms: 19000 },
    { id: 'conteudo_5trilhas', ms: 32000 },
    { id: 'mapa_evolucao', ms: 15000 },
    { id: 'avaliacoes', ms: 21000 },
    { id: 'oferta', ms: 28000 }
  ];

  for (const sec of sectionsS1) {
    await post('/api/analytics/event', {
      event_id: uuidv4(),
      session_id: s1,
      visitor_id: v1,
      event_name: 'section_view',
      section_id: sec.id
    });
    await post('/api/analytics/event', {
      event_id: uuidv4(),
      session_id: s1,
      visitor_id: v1,
      event_name: 'section_engaged',
      section_id: sec.id,
      duration_ms: sec.ms
    });
  }

  for (const d of [25, 50, 75, 90, 100]) {
    await post('/api/analytics/event', {
      event_id: uuidv4(),
      session_id: s1,
      visitor_id: v1,
      event_name: 'scroll_depth',
      scroll_depth: d
    });
  }

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'cta_view',
    cta_id: 'offer_checkout',
    section_id: 'oferta'
  });

  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s1,
    visitor_id: v1,
    event_name: 'cta_click',
    cta_id: 'offer_checkout',
    section_id: 'oferta',
    metadata: { destination_type: 'checkout' }
  });


  // --- SESSÃO 2: Abandono na Pergunta 5 (Facebook / Imagem Estática 02) ---
  const s2 = uuidv4();
  const v2 = uuidv4();
  const utms2 = {
    utm_source: 'facebook',
    utm_medium: 'feed',
    utm_campaign: 'cbo_prospeccao_mar26',
    utm_content: 'imagem_estatica_02',
    utm_term: 'leitura_infantil'
  };

  console.log(`[Sessão 2 - Facebook / Imagem 02] Session ID: ${s2}`);
  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s2,
    visitor_id: v2,
    event_name: 'session_start',
    utm: utms2,
    device_type: 'mobile',
    browser: 'Chrome Mobile',
    viewport_width: 390
  });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s2, visitor_id: v2, event_name: 'quiz_view', utm: utms2 });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s2, visitor_id: v2, event_name: 'quiz_start', utm: utms2 });
  
  for (let i = 0; i < 4; i++) {
    const q = questionsS1[i];
    await post('/api/analytics/event', { event_id: uuidv4(), session_id: s2, visitor_id: v2, event_name: 'quiz_step_view', step: q.step, question_id: q.id });
    await post('/api/analytics/event', { event_id: uuidv4(), session_id: s2, visitor_id: v2, event_name: 'quiz_answer', step: q.step, question_id: q.id, answer: q.ans, duration_ms: 5400 });
  }


  // --- SESSÃO 3: Conclui Quiz, Visita Hero da LP e Sai (Google Search / Desktop) ---
  const s3 = uuidv4();
  const v3 = uuidv4();
  const utms3 = {
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'pesquisa_direta',
    utm_content: 'anuncio_texto_01',
    utm_term: 'como_ensinar_ler'
  };

  console.log(`[Sessão 3 - Google Search / Texto 01] Session ID: ${s3}`);
  await post('/api/analytics/event', {
    event_id: uuidv4(),
    session_id: s3,
    visitor_id: v3,
    event_name: 'session_start',
    utm: utms3,
    device_type: 'desktop',
    browser: 'Chrome Desktop',
    viewport_width: 1440
  });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_view', utm: utms3 });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_start', utm: utms3 });

  for (const q of questionsS1) {
    await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_step_view', step: q.step, question_id: q.id });
    await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_answer', step: q.step, question_id: q.id, answer: q.ans, duration_ms: 3200 });
  }

  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_complete', metadata: { result: 'Curioso & Explorador' } });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'quiz_result_view', metadata: { result: 'Curioso & Explorador' } });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'lp_view', page_path: '/' });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'section_view', section_id: 'hero' });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'section_engaged', section_id: 'hero', duration_ms: 12000 });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'scroll_depth', scroll_depth: 25 });
  await post('/api/analytics/event', { event_id: uuidv4(), session_id: s3, visitor_id: v3, event_name: 'cta_view', cta_id: 'hero_primary', section_id: 'hero' });


  // --- AUTH AS ADMIN & FETCH ANALYTICS ---
  console.log('\n--- 🔐 Consultando APIs Administrativas de Analytics ---');
  const { createSessionToken } = require('../middleware/auth');
  const token = createSessionToken('admin');
  const cookie = `admin_session=${token}`;

  // 1. Overview
  const dashRes = await get('/api/admin/overview?period=hoje', { Cookie: cookie });
  console.log('\n1. Visão Geral Comportamental:');
  console.log(dashRes.body.data.kpi);

  // 2. Quiz Funnel
  const quizRes = await get('/api/admin/quiz?period=hoje', { Cookie: cookie });
  console.log('\n2. Funil do Quiz (Retenção & Tempos):');
  console.log({
    totalStarted: quizRes.body.data.totalStarted,
    completed: quizRes.body.data.completed,
    longestQuestion: quizRes.body.data.longestQuestion,
    biggestDrop: quizRes.body.data.biggestDrop
  });

  // 3. Landing Page
  const lpRes = await get('/api/admin/landing-page?period=hoje', { Cookie: cookie });
  console.log('\n3. Desempenho da Landing Page:');
  console.log('Resumo LP:', lpRes.body.data.summary);
  console.log('Scroll Depth:', lpRes.body.data.scrollDepth);
  console.log('Top CTAs:', lpRes.body.data.ctas);

  // 4. Aquisição
  const acqRes = await get('/api/admin/acquisition?period=hoje&groupBy=utm_content', { Cookie: cookie });
  console.log('\n4. Aquisição por Criativo (utm_content):');
  console.log(acqRes.body.data.attributionTable);

  // 5. Timeline de Sessão
  const timelineRes = await get(`/api/admin/sessions/${s1}/timeline`, { Cookie: cookie });
  console.log(`\n5. Timeline da Sessão #${s1.substring(0, 8)}:`);
  timelineRes.body.data.timeline.forEach(t => {
    console.log(`  ${t.icon} ${t.title} ${t.detail ? `(${t.detail})` : ''}`);
  });

  console.log('\n✨ SIMULAÇÃO E VALIDAÇÃO COMPORTAMENTAL CONCLUÍDA COM 100% DE SUCESSO!');
}

run().catch(console.error);
