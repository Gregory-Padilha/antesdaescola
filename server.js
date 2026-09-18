require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const db = require('./db');
const {
  requireAdminAuth,
  redirectIfAuthenticated,
  handleLogin,
  handleLogout,
  adminSecurityHeaders
} = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for IP rate limiting behind reverse proxies
app.set('trust proxy', 1);

// ============================================================================
// SECURITY HEADERS & CORE MIDDLEWARE
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://fast.wistia.com",
          "https://fast.wistia.net",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://fast.wistia.com",
          "https://fast.wistia.net"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:",
          "https://fast.wistia.com",
          "https://fast.wistia.net"
        ],
        mediaSrc: ["'self'", "https://fast.wistia.com", "https://fast.wistia.net", "blob:"],
        frameSrc: ["'self'", "https://fast.wistia.com", "https://fast.wistia.net", "https://pay.kiwify.com.br"],
        connectSrc: ["'self'", "https://fast.wistia.com", "https://fast.wistia.net", "https://pipedream.wistia.com"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ============================================================================
// PUBLIC ROUTES & STATIC ASSETS
// ============================================================================

// Static assets for the public site
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Public Funnel Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin Login UI (Public, with noindex)
app.get('/login', redirectIfAuthenticated, adminSecurityHeaders, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Admin Static Assets (CSS, JS, Icons)
app.use('/admin-assets/css', adminSecurityHeaders, express.static(path.join(__dirname, 'admin', 'css')));
app.use('/admin-assets/js', adminSecurityHeaders, express.static(path.join(__dirname, 'admin', 'js')));

// ============================================================================
// PROTECTED ADMIN HTML PAGES
// ============================================================================

const adminRoutes = [
  '/admin',
  '/admin/dashboard',
  '/admin/quiz',
  '/admin/respostas',
  '/admin/landing-page',
  '/admin/aquisicao',
  '/admin/sessoes'
];

adminRoutes.forEach(route => {
  app.get(route, requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
  });
});

// ============================================================================
// AUTHENTICATION APIS
// ============================================================================

app.post('/api/admin/login', handleLogin);
app.post('/api/admin/logout', handleLogout);

app.get('/api/admin/me', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    user: req.adminUser.login
  });
});

// ============================================================================
// ANALYTICS INGESTION API (PUBLIC & NON-BLOCKING)
// ============================================================================

app.post('/api/analytics/event', (req, res) => {
  try {
    const {
      event_id,
      session_id,
      visitor_id,
      event_name,
      page_path,
      section_id,
      cta_id,
      step,
      question_id,
      answer,
      scroll_depth,
      duration_ms,
      metadata,
      device_type,
      browser,
      viewport_width,
      utm
    } = req.body || {};

    if (!session_id || !event_name) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    // Record behavioral event with deduplication
    const eventResult = db.recordEvent({
      event_id,
      session_id,
      visitor_id,
      event_name,
      page_path,
      section_id,
      cta_id,
      step,
      question_id,
      answer,
      scroll_depth,
      duration_ms,
      metadata,
      device_type,
      browser,
      viewport_width,
      utm
    });

    // If it's a quiz answer, also update quiz_answers table with duration
    if (event_name === 'quiz_answer' || event_name === 'quiz_answered') {
      if (question_id && step !== undefined) {
        const finalAnswer = answer !== undefined ? answer : (metadata && metadata.value);
        db.recordAnswer({
          session_id,
          question_id,
          step,
          answer: String(finalAnswer || ''),
          duration_ms: duration_ms ? parseInt(duration_ms, 10) : 0
        });
      }
    }

    return res.json({
      success: true,
      event_id: eventResult.event_id,
      deduplicated: eventResult.deduplicated || false
    });
  } catch (err) {
    console.error('⚠️ [Analytics Ingestion Error]:', err.message);
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ============================================================================
// ADMIN ANALYTICS APIS (PROTECTED)
// ============================================================================

// 1. Visão Geral (Overview Behavioral KPIs & Macro Funnel)
app.get(['/api/admin/overview', '/api/admin/dashboard'], requireAdminAuth, (req, res) => {
  try {
    const data = db.getOverviewMetrics(req.query);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Overview Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 2. Funil do Quiz (8 Etapas, Retenção, Drop-off e Tempos)
app.get('/api/admin/quiz', requireAdminAuth, (req, res) => {
  try {
    const data = db.getQuizFunnelMetrics(req.query);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Quiz Funnel Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 3. Respostas do Quiz (Opções Reais e Conclusão por Opção)
app.get('/api/admin/answers', requireAdminAuth, (req, res) => {
  try {
    const data = db.getAnswersMetrics(req.query);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Answers Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 4. Landing Page (Seções Reais, Retenção, Scroll e CTAs)
app.get('/api/admin/landing-page', requireAdminAuth, (req, res) => {
  try {
    const data = db.getLandingPageMetrics(req.query);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Landing Page Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 5. Aquisição (Análise Comportamental por Criativo, Campanha e Origem)
app.get('/api/admin/acquisition', requireAdminAuth, (req, res) => {
  try {
    const data = db.getAcquisitionMetrics(req.query, req.query.groupBy || req.query.group_by);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Acquisition Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 6. Sessões Anônimas (Lista com Status e Filtros)
app.get('/api/admin/sessions', requireAdminAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const data = db.getSessionsMetrics(req.query, limit, offset);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Sessions Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 7. Timeline Cronológica de uma Sessão Individual
app.get('/api/admin/sessions/:sessionId/timeline', requireAdminAuth, (req, res) => {
  try {
    const data = db.getSessionTimeline(req.params.sessionId);
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Session Timeline Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// 8. Opções Dinâmicas dos Filtros Globais
app.get('/api/admin/filters', requireAdminAuth, (req, res) => {
  try {
    const data = db.getFilterDropdowns();
    res.json({ success: true, generated_at: new Date().toISOString(), data });
  } catch (err) {
    console.error('⚠️ [Admin Filters Error]:', err.message);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// Redirect any unmatched /admin/* routes to /admin/dashboard
app.get('/admin/*', requireAdminAuth, (req, res) => {
  res.redirect('/admin/dashboard');
});

// Fallback route for 404s
app.use((req, res) => {
  res.redirect('/');
});

// ============================================================================
// START SERVER
// ============================================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🌱 ANTES DA ESCOLA™ - Servidor Ativo na porta ${PORT}`);
    console.log(`  🔗 Landing Page: http://localhost:${PORT}/`);
    console.log(`  🔒 Login Admin:  http://localhost:${PORT}/login`);
    console.log(`====================================================`);
  });
}

module.exports = app;
