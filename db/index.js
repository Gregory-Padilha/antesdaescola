const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'analytics.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ============================================================================
// DATABASE SCHEMA & MIGRATIONS
// ============================================================================
// 1. Create tables if they do not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_visitors (
    visitor_id TEXT PRIMARY KEY,
    first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id TEXT PRIMARY KEY,
    visitor_id TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    fbclid TEXT,
    referrer TEXT,
    landing_path TEXT,
    device_type TEXT DEFAULT 'desktop',
    browser TEXT,
    viewport_width INTEGER,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
    quiz_started_at TEXT,
    quiz_completed_at TEXT,
    quiz_result TEXT,
    lp_viewed_at TEXT,
    total_lp_engaged_ms INTEGER DEFAULT 0,
    max_scroll_depth INTEGER DEFAULT 0,
    cta_clicked_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    visitor_id TEXT,
    event_name TEXT NOT NULL,
    page_path TEXT,
    section_id TEXT,
    cta_id TEXT,
    step INTEGER,
    question_id TEXT,
    answer TEXT,
    scroll_depth INTEGER,
    duration_ms INTEGER,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    answer TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, step)
  );

  CREATE TABLE IF NOT EXISTS section_engagement (
    session_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    viewed INTEGER DEFAULT 1,
    engaged_ms INTEGER DEFAULT 0,
    last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, section_id)
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    attempted_at INTEGER NOT NULL,
    success INTEGER DEFAULT 0
  );
`);

// 2. Safe Column Migrations for existing DB instances
function ensureColumnExists(tableName, columnName, columnDefinition) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = tableInfo.some(col => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
  } catch(e) {
    console.error(`Migration error adding ${columnName} to ${tableName}:`, e.message);
  }
}

ensureColumnExists('analytics_sessions', 'visitor_id', 'TEXT');
ensureColumnExists('analytics_sessions', 'utm_source', 'TEXT');
ensureColumnExists('analytics_sessions', 'utm_medium', 'TEXT');
ensureColumnExists('analytics_sessions', 'utm_campaign', 'TEXT');
ensureColumnExists('analytics_sessions', 'utm_content', 'TEXT');
ensureColumnExists('analytics_sessions', 'utm_term', 'TEXT');
ensureColumnExists('analytics_sessions', 'fbclid', 'TEXT');
ensureColumnExists('analytics_sessions', 'referrer', 'TEXT');
ensureColumnExists('analytics_sessions', 'landing_path', 'TEXT');
ensureColumnExists('analytics_sessions', 'device_type', "TEXT DEFAULT 'desktop'");
ensureColumnExists('analytics_sessions', 'browser', 'TEXT');
ensureColumnExists('analytics_sessions', 'viewport_width', 'INTEGER');
ensureColumnExists('analytics_sessions', 'started_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'last_activity_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'quiz_started_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'quiz_completed_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'quiz_result', 'TEXT');
ensureColumnExists('analytics_sessions', 'lp_viewed_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'total_lp_engaged_ms', 'INTEGER DEFAULT 0');
ensureColumnExists('analytics_sessions', 'max_scroll_depth', 'INTEGER DEFAULT 0');
ensureColumnExists('analytics_sessions', 'cta_clicked_count', 'INTEGER DEFAULT 0');
ensureColumnExists('analytics_sessions', 'created_at', 'TEXT');
ensureColumnExists('analytics_sessions', 'updated_at', 'TEXT');

// If older db had 'device', copy to 'device_type' if device_type is null
try {
  const info = db.prepare(`PRAGMA table_info(analytics_sessions)`).all();
  if (info.some(c => c.name === 'device')) {
    db.exec(`UPDATE analytics_sessions SET device_type = device WHERE device_type IS NULL OR device_type = 'desktop'`);
  }
} catch(e) {}

ensureColumnExists('analytics_events', 'visitor_id', 'TEXT');
ensureColumnExists('analytics_events', 'page_path', 'TEXT');
ensureColumnExists('analytics_events', 'section_id', 'TEXT');
ensureColumnExists('analytics_events', 'cta_id', 'TEXT');
ensureColumnExists('analytics_events', 'step', 'INTEGER');
ensureColumnExists('analytics_events', 'question_id', 'TEXT');
ensureColumnExists('analytics_events', 'answer', 'TEXT');
ensureColumnExists('analytics_events', 'scroll_depth', 'INTEGER');
ensureColumnExists('analytics_events', 'duration_ms', 'INTEGER');
ensureColumnExists('analytics_events', 'metadata', 'TEXT');

ensureColumnExists('quiz_answers', 'duration_ms', 'INTEGER DEFAULT 0');

// 3. Create Indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON analytics_sessions(visitor_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON analytics_sessions(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_utm_campaign ON analytics_sessions(utm_campaign);
  CREATE INDEX IF NOT EXISTS idx_sessions_utm_content ON analytics_sessions(utm_content);
  CREATE INDEX IF NOT EXISTS idx_sessions_utm_source ON analytics_sessions(utm_source);
  CREATE INDEX IF NOT EXISTS idx_sessions_device_type ON analytics_sessions(device_type);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_id ON analytics_events(event_id);
  CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics_events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_event_name ON analytics_events(event_name);
  CREATE INDEX IF NOT EXISTS idx_events_section_id ON analytics_events(section_id);
  CREATE INDEX IF NOT EXISTS idx_events_cta_id ON analytics_events(cta_id);
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics_events(created_at);

  CREATE INDEX IF NOT EXISTS idx_answers_session_id ON quiz_answers(session_id);
  CREATE INDEX IF NOT EXISTS idx_answers_step ON quiz_answers(step);
  CREATE INDEX IF NOT EXISTS idx_answers_question_id ON quiz_answers(question_id);

  CREATE INDEX IF NOT EXISTS idx_sec_eng_session ON section_engagement(session_id);
  CREATE INDEX IF NOT EXISTS idx_sec_eng_section ON section_engagement(section_id);

  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);
`);

// ============================================================================
// PREPARED STATEMENTS
// ============================================================================

// Upsert Visitor
const upsertVisitorStmt = db.prepare(`
  INSERT INTO analytics_visitors (visitor_id, first_seen_at, last_seen_at)
  VALUES (?, datetime('now'), datetime('now'))
  ON CONFLICT(visitor_id) DO UPDATE SET
    last_seen_at = datetime('now');
`);

// Upsert Session (Keeps original first-touch UTMs intact)
const upsertSessionStmt = db.prepare(`
  INSERT INTO analytics_sessions (
    session_id, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, referrer, landing_path, device_type, browser, viewport_width,
    started_at, last_activity_at, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    datetime('now'), datetime('now'), datetime('now'), datetime('now')
  )
  ON CONFLICT(session_id) DO UPDATE SET
    visitor_id = COALESCE(analytics_sessions.visitor_id, excluded.visitor_id),
    utm_source = COALESCE(analytics_sessions.utm_source, excluded.utm_source),
    utm_medium = COALESCE(analytics_sessions.utm_medium, excluded.utm_medium),
    utm_campaign = COALESCE(analytics_sessions.utm_campaign, excluded.utm_campaign),
    utm_content = COALESCE(analytics_sessions.utm_content, excluded.utm_content),
    utm_term = COALESCE(analytics_sessions.utm_term, excluded.utm_term),
    fbclid = COALESCE(analytics_sessions.fbclid, excluded.fbclid),
    referrer = COALESCE(analytics_sessions.referrer, excluded.referrer),
    device_type = COALESCE(excluded.device_type, analytics_sessions.device_type),
    browser = COALESCE(excluded.browser, analytics_sessions.browser),
    viewport_width = COALESCE(excluded.viewport_width, analytics_sessions.viewport_width),
    last_activity_at = datetime('now'),
    updated_at = datetime('now');
`);

// Insert Event with Deduplication
const insertEventStmt = db.prepare(`
  INSERT INTO analytics_events (
    event_id, session_id, visitor_id, event_name, page_path, section_id, cta_id,
    step, question_id, answer, scroll_depth, duration_ms, metadata, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const checkEventIdExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE event_id = ? LIMIT 1`);
const checkEventNameExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE session_id = ? AND event_name = ? LIMIT 1`);
const checkSectionViewExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE session_id = ? AND event_name = 'section_view' AND section_id = ? LIMIT 1`);
const checkCtaViewExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE session_id = ? AND event_name = 'cta_view' AND cta_id = ? LIMIT 1`);
const checkScrollDepthExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE session_id = ? AND event_name = 'scroll_depth' AND scroll_depth = ? LIMIT 1`);
const checkStepEventExistsStmt = db.prepare(`SELECT id FROM analytics_events WHERE session_id = ? AND event_name = ? AND step = ? LIMIT 1`);

// Upsert Quiz Answer with Duration
const upsertAnswerStmt = db.prepare(`
  INSERT INTO quiz_answers (session_id, question_id, step, answer, duration_ms, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(session_id, step) DO UPDATE SET
    answer = excluded.answer,
    question_id = excluded.question_id,
    duration_ms = COALESCE(excluded.duration_ms, quiz_answers.duration_ms),
    created_at = datetime('now')
`);

// Upsert Section Engagement
const upsertSectionEngStmt = db.prepare(`
  INSERT INTO section_engagement (session_id, section_id, viewed, engaged_ms, last_updated_at)
  VALUES (?, ?, 1, ?, datetime('now'))
  ON CONFLICT(session_id, section_id) DO UPDATE SET
    viewed = 1,
    engaged_ms = section_engagement.engaged_ms + excluded.engaged_ms,
    last_updated_at = datetime('now')
`);

// Rate Limiting
const insertLoginAttemptStmt = db.prepare(`INSERT INTO login_attempts (ip, attempted_at, success) VALUES (?, ?, ?)`);
const getFailedAttemptsStmt = db.prepare(`SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at >= ?`);
const clearFailedAttemptsStmt = db.prepare(`DELETE FROM login_attempts WHERE ip = ?`);

// ============================================================================
// FILTER QUERY BUILDER
// ============================================================================
function buildDateCondition(period, customStart, customEnd, tableAlias = 's') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const params = [];
  let sql = '';

  if (period === 'hoje') {
    sql = `date(${prefix}created_at, 'localtime') = date('now', 'localtime')`;
  } else if (period === 'ontem') {
    sql = `date(${prefix}created_at, 'localtime') = date('now', 'localtime', '-1 day')`;
  } else if (period === '7d' || period === '7_dias') {
    sql = `date(${prefix}created_at, 'localtime') >= date('now', 'localtime', '-7 days')`;
  } else if (period === '30d' || period === '30_dias') {
    sql = `date(${prefix}created_at, 'localtime') >= date('now', 'localtime', '-30 days')`;
  } else if (period === 'custom' && customStart && customEnd) {
    sql = `date(${prefix}created_at, 'localtime') >= date(?) AND date(${prefix}created_at, 'localtime') <= date(?)`;
    params.push(customStart, customEnd);
  } else {
    // Default 30 days
    sql = `date(${prefix}created_at, 'localtime') >= date('now', 'localtime', '-30 days')`;
  }

  return { sql, params };
}

function buildFilterClauses(filters = {}, tableAlias = 's') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const conditions = [];
  const params = [];

  const { sql: dateSql, params: dateParams } = buildDateCondition(
    filters.period,
    filters.startDate || filters.start_date,
    filters.endDate || filters.end_date,
    tableAlias
  );

  if (dateSql) {
    conditions.push(dateSql);
    params.push(...dateParams);
  }

  if (filters.utm_campaign) {
    conditions.push(`${prefix}utm_campaign = ?`);
    params.push(filters.utm_campaign);
  }

  if (filters.utm_content) {
    conditions.push(`${prefix}utm_content = ?`);
    params.push(filters.utm_content);
  }

  if (filters.utm_source) {
    conditions.push(`${prefix}utm_source = ?`);
    params.push(filters.utm_source);
  }

  if (filters.device || filters.device_type) {
    conditions.push(`${prefix}device_type = ?`);
    params.push(filters.device || filters.device_type);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

// REAL LP SECTIONS DEFINITION IN ACTUAL PAGE ORDER
const LP_SECTIONS_DEF = [
  { id: 'hero', name: 'Hero (Apresentação)' },
  { id: 'primeiro_dia', name: 'Antes do Primeiro Dia' },
  { id: 'metodo_progressao', name: 'Método (5 Níveis de Progressão)' },
  { id: 'especialista', name: 'Revisão Pedagógica' },
  { id: 'paginas_reais', name: 'Por Dentro do Material' },
  { id: 'autoridade', name: 'Origem do Programa / Equipe' },
  { id: 'conexao_emocional', name: 'Momento de Conexão ("Ele Aprendeu")' },
  { id: 'como_funciona_15min', name: '15 Minutos Bem Usados (3 Passos)' },
  { id: 'faixas_etarias', name: 'Dos 2 aos 5 Anos (Tabs por Idade)' },
  { id: 'conteudo_5trilhas', name: 'Conteúdo Completo (5 Trilhas)' },
  { id: 'mapa_evolucao', name: 'Mapa de Evolução (Checklist)' },
  { id: 'avaliacoes', name: 'Experiências de Famílias' },
  { id: 'oferta', name: 'Oferta Principal (Acesso Completo)' },
  { id: 'garantia', name: 'Garantia Incondicional 7 Dias' },
  { id: 'faq', name: 'Dúvidas Frequentes (FAQ)' },
  { id: 'cta_final', name: 'CTA Final' }
];

// ============================================================================
// DATABASE OPERATIONS EXPORTS
// ============================================================================
const dbOperations = {
  db,

  // Upsert session and update visitor
  saveSession({ session_id, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, referrer, landing_path, device_type, browser, viewport_width }) {
    if (!session_id) return;
    const finalVisitorId = visitor_id || session_id;
    upsertVisitorStmt.run(finalVisitorId);
    upsertSessionStmt.run(
      session_id,
      finalVisitorId,
      utm_source || null,
      utm_medium || null,
      utm_campaign || null,
      utm_content || null,
      utm_term || null,
      fbclid || null,
      referrer || null,
      landing_path || '/',
      device_type || 'desktop',
      browser || 'Desconhecido',
      viewport_width || null
    );
  },

  // Record behavioral event with deduplication
  recordEvent({ event_id, session_id, visitor_id, event_name, page_path, section_id, cta_id, step, question_id, answer, scroll_depth, duration_ms, metadata, device_type, browser, viewport_width, utm = {} }) {
    if (!session_id || !event_name) {
      return { success: false, error: 'missing_required_fields' };
    }

    const finalEventId = event_id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const finalVisitorId = visitor_id || session_id;

    // Ensure session exists
    dbOperations.saveSession({
      session_id,
      visitor_id: finalVisitorId,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      fbclid: utm.fbclid,
      referrer: utm.referrer,
      landing_path: page_path || '/',
      device_type,
      browser,
      viewport_width
    });

    // Check if event_id already recorded (Strict Idempotency)
    const existingById = checkEventIdExistsStmt.get(finalEventId);
    if (existingById) {
      return { success: true, deduplicated: true };
    }

    // Deduplication rules for single milestone events per session
    const singleMilestones = ['session_start', 'quiz_view', 'quiz_start', 'quiz_complete', 'quiz_result_view', 'lp_view', 'landing_page_view'];
    if (singleMilestones.includes(event_name)) {
      const existingByName = checkEventNameExistsStmt.get(session_id, event_name);
      if (existingByName) {
        return { success: true, deduplicated: true };
      }
    }

    if (event_name === 'section_view' && section_id) {
      const secExists = checkSectionViewExistsStmt.get(session_id, section_id);
      if (secExists) {
        return { success: true, deduplicated: true };
      }
    }

    if (event_name === 'cta_view' && cta_id) {
      const ctaExists = checkCtaViewExistsStmt.get(session_id, cta_id);
      if (ctaExists) {
        return { success: true, deduplicated: true };
      }
    }

    if (event_name === 'scroll_depth' && scroll_depth) {
      const depthExists = checkScrollDepthExistsStmt.get(session_id, parseInt(scroll_depth, 10));
      if (depthExists) {
        return { success: true, deduplicated: true };
      }
    }

    if (event_name === 'quiz_step_view' && step) {
      const stepExists = checkStepEventExistsStmt.get(session_id, event_name, parseInt(step, 10));
      if (stepExists) {
        return { success: true, deduplicated: true };
      }
    }

    const metaStr = metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata)) : null;

    insertEventStmt.run(
      finalEventId,
      session_id,
      finalVisitorId,
      event_name,
      page_path || '/',
      section_id || null,
      cta_id || null,
      step ? parseInt(step, 10) : null,
      question_id || null,
      answer || null,
      scroll_depth ? parseInt(scroll_depth, 10) : null,
      duration_ms ? parseInt(duration_ms, 10) : null,
      metaStr
    );

    // Update session milestone timestamps and metrics
    if (event_name === 'quiz_start' || event_name === 'quiz_started') {
      db.prepare(`UPDATE analytics_sessions SET quiz_started_at = datetime('now'), last_activity_at = datetime('now') WHERE session_id = ? AND quiz_started_at IS NULL`).run(session_id);
    } else if (event_name === 'quiz_complete' || event_name === 'quiz_completed') {
      const resultVal = (metadata && metadata.result) || null;
      db.prepare(`UPDATE analytics_sessions SET quiz_completed_at = datetime('now'), quiz_result = COALESCE(?, quiz_result), last_activity_at = datetime('now') WHERE session_id = ?`).run(resultVal, session_id);
    } else if (event_name === 'quiz_result_view' || event_name === 'result_viewed') {
      const resultVal = (metadata && metadata.result) || null;
      db.prepare(`UPDATE analytics_sessions SET quiz_result = COALESCE(?, quiz_result), last_activity_at = datetime('now') WHERE session_id = ?`).run(resultVal, session_id);
    } else if (event_name === 'lp_view' || event_name === 'landing_page_view' || event_name === 'sales_page_viewed') {
      db.prepare(`UPDATE analytics_sessions SET lp_viewed_at = datetime('now'), last_activity_at = datetime('now') WHERE session_id = ? AND lp_viewed_at IS NULL`).run(session_id);
    } else if (event_name === 'section_view' && section_id) {
      upsertSectionEngStmt.run(session_id, section_id, 0);
      db.prepare(`UPDATE analytics_sessions SET last_activity_at = datetime('now') WHERE session_id = ?`).run(session_id);
    } else if (event_name === 'section_engaged' && section_id && duration_ms) {
      const ms = parseInt(duration_ms, 10) || 0;
      upsertSectionEngStmt.run(session_id, section_id, ms);
      db.prepare(`UPDATE analytics_sessions SET total_lp_engaged_ms = total_lp_engaged_ms + ?, last_activity_at = datetime('now') WHERE session_id = ?`).run(ms, session_id);
    } else if (event_name === 'page_engaged' && duration_ms) {
      const ms = parseInt(duration_ms, 10) || 0;
      db.prepare(`UPDATE analytics_sessions SET total_lp_engaged_ms = total_lp_engaged_ms + ?, last_activity_at = datetime('now') WHERE session_id = ?`).run(ms, session_id);
    } else if (event_name === 'scroll_depth' && scroll_depth) {
      const depth = parseInt(scroll_depth, 10) || 0;
      db.prepare(`UPDATE analytics_sessions SET max_scroll_depth = MAX(max_scroll_depth, ?), last_activity_at = datetime('now') WHERE session_id = ?`).run(depth, session_id);
    } else if (event_name === 'cta_click') {
      db.prepare(`UPDATE analytics_sessions SET cta_clicked_count = cta_clicked_count + 1, last_activity_at = datetime('now') WHERE session_id = ?`).run(session_id);
    } else {
      db.prepare(`UPDATE analytics_sessions SET last_activity_at = datetime('now') WHERE session_id = ?`).run(session_id);
    }

    return { success: true, event_id: finalEventId };
  },

  // Record answer to a quiz step with timing
  recordAnswer({ session_id, question_id, step, answer, duration_ms }) {
    if (!session_id || !question_id || step === undefined) return;
    const dur = duration_ms ? parseInt(duration_ms, 10) : 0;
    upsertAnswerStmt.run(session_id, question_id, parseInt(step, 10), String(answer), dur);
    db.prepare(`UPDATE analytics_sessions SET last_activity_at = datetime('now') WHERE session_id = ?`).run(session_id);
  },

  // Rate Limiting
  recordLoginAttempt(ip, success) {
    const now = Math.floor(Date.now() / 1000);
    insertLoginAttemptStmt.run(ip, now, success ? 1 : 0);
    if (success) {
      clearFailedAttemptsStmt.run(ip);
    }
  },

  getRecentFailedLoginAttempts(ip, windowMinutes = 10) {
    const cutoff = Math.floor(Date.now() / 1000) - (windowMinutes * 60);
    const row = getFailedAttemptsStmt.get(ip, cutoff);
    return row ? row.count : 0;
  },

  // ============================================================================
  // 1. VISÃO GERAL (OVERVIEW BEHAVIORAL DASHBOARD)
  // ============================================================================
  getOverviewMetrics(filters = {}) {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    // Core Behavioral KPIs
    const kpiQuery = `
      SELECT
        COUNT(DISTINCT s.visitor_id) as total_visitors,
        COUNT(DISTINCT s.session_id) as total_sessions,
        COUNT(DISTINCT CASE WHEN s.quiz_started_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_start', 'quiz_started')) OR EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id) THEN s.session_id END) as quiz_started,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view', 'cta_click')) THEN s.session_id END) as quiz_completed,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL OR s.cta_clicked_count > 0 OR s.max_scroll_depth > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('lp_view', 'landing_page_view', 'section_view', 'cta_click', 'scroll_depth')) THEN s.session_id END) as lp_views,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'cta_click') THEN s.session_id END) as cta_clicks,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 75 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 75) THEN s.session_id END) as scroll_75,
        COALESCE(AVG(CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.total_lp_engaged_ms END), 0) as avg_lp_engaged_ms
      FROM analytics_sessions s
      ${whereSql}
    `;

    const kpiRaw = db.prepare(kpiQuery).get(...params) || {};

    const visitors = kpiRaw.total_visitors || 0;
    const sessions = kpiRaw.total_sessions || 0;
    const quizStarted = kpiRaw.quiz_started || 0;
    const quizCompleted = kpiRaw.quiz_completed || 0;
    const lpViews = kpiRaw.lp_views || 0;
    const ctaClicks = kpiRaw.cta_clicks || 0;
    const scroll75 = kpiRaw.scroll_75 || 0;
    const avgLpEngagedSeconds = Math.round((kpiRaw.avg_lp_engaged_ms || 0) / 100) / 10; // e.g. 24.5s

    const quizCompletionRate = quizStarted > 0 ? Math.round((quizCompleted / quizStarted) * 1000) / 10 : 0;
    const ctaCtr = lpViews > 0 ? Math.round((ctaClicks / lpViews) * 1000) / 10 : 0;
    const scroll75Rate = lpViews > 0 ? Math.round((scroll75 / lpViews) * 1000) / 10 : 0;

    // Macro Behavioral Funnel
    const macroFunnelQuery = `
      SELECT
        COUNT(DISTINCT s.session_id) as step_0_visitors,
        COUNT(DISTINCT CASE WHEN s.quiz_started_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_start', 'quiz_started')) OR EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id) THEN s.session_id END) as step_1_quiz_start,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view', 'cta_click')) THEN s.session_id END) as step_2_quiz_complete,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL OR s.cta_clicked_count > 0 OR s.max_scroll_depth > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('lp_view', 'landing_page_view', 'section_view', 'cta_click', 'scroll_depth')) THEN s.session_id END) as step_3_lp,
        COUNT(DISTINCT CASE WHEN (s.total_lp_engaged_ms >= 10000 OR s.max_scroll_depth >= 50 OR s.cta_clicked_count > 0 OR (SELECT COUNT(*) FROM section_engagement se WHERE se.session_id = s.session_id) >= 2) THEN s.session_id END) as step_4_engaged,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 75 OR s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 75) THEN s.session_id END) as step_5_scroll_75,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'cta_click') THEN s.session_id END) as step_6_cta_click
      FROM analytics_sessions s
      ${whereSql}
    `;

    const funnelRaw = db.prepare(macroFunnelQuery).get(...params) || {};

    const macroStagesDef = [
      { id: 'visitors', name: 'Visitantes' },
      { id: 'quiz_start', name: 'Quiz Iniciado' },
      { id: 'quiz_complete', name: 'Quiz Concluído' },
      { id: 'lp_view', name: 'Chegaram à LP' },
      { id: 'engaged', name: 'Sessões Engajadas (≥10s / ≥2 seções)' },
      { id: 'scroll_75', name: 'Scroll 75% da LP' },
      { id: 'cta_click', name: 'CTA Clicado (Intenção)' }
    ];

    const baseCount = funnelRaw.step_0_visitors || sessions || 0;
    const funnel = [];
    let biggestDrop = { fromStep: null, toStep: null, dropCount: 0, dropPercent: 0, message: baseCount < 3 ? 'Dados insuficientes.' : null };
    let maxDropPct = 0;
    let prevCount = baseCount;

    for (let i = 0; i < macroStagesDef.length; i++) {
      const def = macroStagesDef[i];
      const count = funnelRaw[`step_${i}_${def.id}`] !== undefined ? funnelRaw[`step_${i}_${def.id}`] : (funnelRaw[`step_${i}_visitors`] || 0);
      const percentOfStart = baseCount > 0 ? Math.round((count / baseCount) * 1000) / 10 : 0;
      let dropCount = 0;
      let dropPercent = 0;

      if (i > 0) {
        dropCount = Math.max(0, prevCount - count);
        dropPercent = prevCount > 0 ? Math.round((dropCount / prevCount) * 1000) / 10 : 0;

        if (baseCount >= 3 && dropPercent > maxDropPct && dropCount > 0) {
          maxDropPct = dropPercent;
          biggestDrop = {
            fromStep: macroStagesDef[i - 1].name,
            toStep: def.name,
            dropCount,
            dropPercent,
            message: null
          };
        }
      }

      funnel.push({
        id: def.id,
        name: def.name,
        count,
        percentOfStart,
        dropCount,
        dropPercent
      });

      prevCount = count;
    }

    if (baseCount < 3 || biggestDrop.dropCount === 0) {
      biggestDrop = { fromStep: null, toStep: null, dropCount: 0, dropPercent: 0, message: 'Dados insuficientes.' };
    }

    // Daily Activity Chart
    const dailyQuery = `
      SELECT
        date(s.created_at, 'localtime') as day,
        COUNT(DISTINCT s.session_id) as visitors,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL THEN s.session_id END) as quizCompleted,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.session_id END) as lpViews,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 THEN s.session_id END) as ctaClicks
      FROM analytics_sessions s
      ${whereSql}
      GROUP BY date(s.created_at, 'localtime')
      ORDER BY date(s.created_at, 'localtime') ASC
    `;

    const dailyChart = db.prepare(dailyQuery).all(...params) || [];

    return {
      kpi: {
        totalVisitors: visitors,
        totalSessions: sessions,
        visitors,
        sessions,
        quizStarted,
        quizCompleted,
        quizCompletionRate,
        lpViews,
        ctaClicks,
        ctaCtr,
        scroll75,
        scroll75Rate,
        lpAvgTime: avgLpEngagedSeconds,
        avgLpEngagedSeconds
      },
      funnel,
      biggestDrop,
      dailyChart
    };
  },

  // ============================================================================
  // 2. FUNIL DO QUIZ (8 ETAPAS, TEMPO MÉDIO E DROP-OFF)
  // ============================================================================
  getQuizFunnelMetrics(filters = {}) {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    const stepDefinitions = [
      { step: 1, title: 'Pergunta 1 • Idade', subtitle: 'Pra começar: qual é a idade do seu filho?' },
      { step: 2, title: 'Pergunta 2 • Cores', subtitle: 'Se você apontasse para o vermelho agora, seu filho saberia identificar?' },
      { step: 3, title: 'Pergunta 3 • Formas', subtitle: 'E se você perguntasse: “Qual deles é o triângulo?”' },
      { step: 4, title: 'Pergunta 4 • Números', subtitle: 'Seu filho apenas repete os números… ou já entende o que representam?' },
      { step: 5, title: 'Pergunta 5 • Percepção', subtitle: 'Se você perguntasse “qual deles é diferente?”, seu filho encontraria?' },
      { step: 6, title: 'Pergunta 6 • Raciocínio', subtitle: 'E este desafio? Seu filho descobriria o que vem depois?' },
      { step: 7, title: 'Pergunta 7 • Coordenação', subtitle: 'Quando pega lápis, giz ou canetinha, o que ele já consegue fazer?' },
      { step: 8, title: 'Pergunta 8 • Desejo', subtitle: 'Antes do primeiro dia de escola, o que mais te daria orgulho de ver seu filho fazendo?' }
    ];

    // Query for reach & monotonic progression through all 8 steps
    const query = `
      SELECT
        COUNT(DISTINCT CASE WHEN s.quiz_started_at IS NOT NULL OR EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id) OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_start', 'quiz_started')) THEN s.session_id END) as total_started,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 1) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 1 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s1,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 2) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 2 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s2,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 3) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 3 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s3,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 4) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 4 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s4,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 5) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 5 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s5,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 6) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 6 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s6,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 7) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 7 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s7,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM quiz_answers a WHERE a.session_id = s.session_id AND a.step >= 8) OR s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND (e.step >= 8 OR e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view'))) THEN s.session_id END) as s8,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view')) THEN s.session_id END) as completed,
        COUNT(DISTINCT CASE WHEN s.quiz_result IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_result_view', 'result_viewed', 'lp_view', 'landing_page_view')) THEN s.session_id END) as result_viewed,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('lp_view', 'landing_page_view')) THEN s.session_id END) as lp_reached
      FROM analytics_sessions s
      ${whereSql}
    `;

    const raw = db.prepare(query).get(...params) || {};
    const totalStarted = raw.total_started || 0;

    // Average duration per question
    const durationQuery = `
      SELECT
        a.step,
        COALESCE(AVG(a.duration_ms), 0) as avg_duration_ms
      FROM quiz_answers a
      JOIN analytics_sessions s ON s.session_id = a.session_id
      ${whereSql}
      GROUP BY a.step
    `;
    const durations = db.prepare(durationQuery).all(...params) || [];
    const durationMap = {};
    durations.forEach(d => {
      durationMap[d.step] = Math.round((d.avg_duration_ms || 0) / 100) / 10; // seconds (e.g. 5.2s)
    });

    const rows = [];
    let prevCount = totalStarted;
    let maxDropPct = 0;
    let biggestDrop = { fromStep: null, toStep: null, dropCount: 0, dropPercent: 0, message: totalStarted < 3 ? 'Dados insuficientes.' : null };
    let slowestQuestion = { step: null, title: null, avgSeconds: 0, avgTimeSeconds: 0 };

    for (let i = 0; i < stepDefinitions.length; i++) {
      const def = stepDefinitions[i];
      const count = raw[`s${def.step}`] || 0;
      const retentionPercent = totalStarted > 0 ? Math.round((count / totalStarted) * 1000) / 10 : 0;
      const dropped = Math.max(0, prevCount - count);
      const dropPercent = prevCount > 0 ? Math.round((dropped / prevCount) * 1000) / 10 : 0;
      const avgSeconds = durationMap[def.step] || 0;

      if (totalStarted >= 3 && dropPercent > maxDropPct && dropped > 0) {
        maxDropPct = dropPercent;
        biggestDrop = {
          fromStep: i === 0 ? 'Quiz Iniciado' : stepDefinitions[i - 1].title,
          toStep: def.title,
          dropCount: dropped,
          dropPercent,
          message: null
        };
      }

      if (avgSeconds > slowestQuestion.avgSeconds) {
        slowestQuestion = {
          step: def.step,
          title: def.title,
          avgSeconds,
          avgTimeSeconds: avgSeconds
        };
      }

      rows.push({
        step: def.step,
        title: def.title,
        subtitle: def.subtitle,
        reached: prevCount,
        advanced: count,
        abandoned: dropped,
        retentionPercent,
        dropPercent,
        avgSeconds,
        avgTimeSeconds: avgSeconds
      });

      prevCount = count;
    }

    if (totalStarted < 3 || biggestDrop.dropCount === 0) {
      biggestDrop = { fromStep: null, toStep: null, dropCount: 0, dropPercent: 0, message: 'Dados insuficientes.' };
    }

    return {
      totalStarted,
      completed: raw.completed || 0,
      resultViewed: raw.result_viewed || 0,
      lpReached: raw.lp_reached || 0,
      completionRate: totalStarted > 0 ? Math.round(((raw.completed || 0) / totalStarted) * 1000) / 10 : 0,
      biggestDrop,
      slowestQuestion,
      longestQuestion: slowestQuestion,
      steps: rows
    };
  },

  // ============================================================================
  // 3. RESPOSTAS DO QUIZ (OPÇÕES REAIS + TAXA DE CONCLUSÃO POR OPÇÃO)
  // ============================================================================
  getAnswersMetrics(filters = {}) {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    const QUIZ_SCHEMA = [
      {
        step: 1,
        question_id: 'child_age',
        title: 'Etapa 1 • Idade',
        question: 'Pra começar: qual é a idade do seu filho?',
        options: [
          { value: '2', label: '2 anos', sub: 'Fase de descobertas e primeiras palavras' },
          { value: '3', label: '3 anos', sub: 'Explosão de vocabulário e curiosidade' },
          { value: '4', label: '4 anos', sub: 'Construção de raciocínio e autonomia' },
          { value: '5', label: '5 anos', sub: 'Preparação direta para o 1º ano escolar' }
        ]
      },
      {
        step: 2,
        question_id: 'colors',
        title: 'Etapa 2 • Cores',
        question: 'Se você apontasse para o vermelho agora, seu filho saberia identificar?',
        options: [
          { value: 'sem_dificuldade', label: 'Sim, sem dificuldade', sub: 'Aponta e reconhece prontamente' },
          { value: 'provavelmente', label: 'Provavelmente sim', sub: 'Reconhece a maioria das vezes com facilidade' },
          { value: 'confunde', label: 'Ainda confunde algumas cores', sub: 'Às vezes troca os nomes ou chuta' },
          { value: 'nao_comecamos', label: 'Ainda não começamos a ensinar', sub: 'Estamos começando a explorar agora' }
        ]
      },
      {
        step: 3,
        question_id: 'shapes',
        title: 'Etapa 3 • Formas Geométricas',
        question: 'E se você perguntasse: “Qual deles é o triângulo?”',
        options: [
          { value: 'na_hora', label: 'Ele saberia na hora', sub: 'Aponta sem hesitar' },
          { value: 'talvez', label: 'Talvez acertasse', sub: 'Reconheceria com alguma dúvida ou dica' },
          { value: 'confunde', label: 'Ainda confunde as formas', sub: 'Sabe que são figuras diferentes, mas troca os nomes' },
          { value: 'nunca_ensinei', label: 'Nunca ensinei isso', sub: 'Ainda não apresentamos essas formas estruturadas' }
        ]
      },
      {
        step: 4,
        question_id: 'numbers',
        title: 'Etapa 4 • Números & Quantidades',
        question: 'Seu filho apenas repete os números… ou já entende o que eles representam?',
        options: [
          { value: 'conta_objetos', label: 'Já consegue contar objetos', sub: 'Relaciona a quantidade física ao número dito' },
          { value: 'pequenas_quantidades', label: 'Conta algumas quantidades pequenas', sub: 'Conta 2 ou 3 itens com facilidade' },
          { value: 'repete_mas_confunde', label: 'Fala os números, mas ainda confunde quantidades', sub: 'Recita a sequência de cor, mas aponta aleatoriamente' },
          { value: 'comecando', label: 'Ainda estamos começando', sub: 'Ainda não iniciamos atividades com numerais' }
        ]
      },
      {
        step: 5,
        question_id: 'perception',
        title: 'Etapa 5 • Percepção Visual',
        question: 'Se você perguntasse “qual deles é diferente?”, seu filho encontraria?',
        options: [
          { value: 'rapidamente', label: 'Sim, rapidamente', sub: 'Encontra o item destoante com facilidade' },
          { value: 'provavelmente', label: 'Provavelmente conseguiria', sub: 'Percebe a diferença com um pouco de observação' },
          { value: 'precisaria_ajuda', label: 'Precisaria de ajuda', sub: 'Precisa que você aponte e mostre a diferença' },
          { value: 'nunca_fizemos', label: 'Nunca fizemos desafios assim', sub: 'Ainda não apresentamos comparações estruturadas' }
        ]
      },
      {
        step: 6,
        question_id: 'logic',
        title: 'Etapa 6 • Raciocínio & Padrões',
        question: 'E este desafio? Seu filho descobriria o que vem depois?',
        options: [
          { value: 'acredito_sim', label: 'Sim, acredito que sim', sub: 'Tem facilidade em notar repetições e prever a sequência' },
          { value: 'talvez', label: 'Talvez', sub: 'Se falarmos o ritmo em voz alta juntos' },
          { value: 'dificil', label: 'Acho que ainda seria difícil', sub: 'Ainda não compreende a alternância' },
          { value: 'nunca_testamos', label: 'Nunca testamos padrões assim', sub: 'Nunca fizemos desafios de lógica em casa' }
        ]
      },
      {
        step: 7,
        question_id: 'motor',
        title: 'Etapa 7 • Coordenação das Mãos',
        question: 'Quando pega lápis, giz ou canetinha, o que ele já consegue fazer?',
        options: [
          { value: 'bastante_controle', label: 'Traça e contorna com bastante controle', sub: 'Firma bem os dedinhos e tem precisão' },
          { value: 'segue_linhas', label: 'Já consegue seguir algumas linhas', sub: 'Faz traços livres e segue caminhos simples' },
          { value: 'rabisca_ajuda', label: 'Ainda rabisca e precisa de ajuda', sub: 'Pega de forma frouxa ou se cansa rápido' },
          { value: 'quase_nao_fazemos', label: 'Quase não fazemos atividades com lápis', sub: 'Ainda não criamos esse hábito em casa' }
        ]
      },
      {
        step: 8,
        question_id: 'parent_goal',
        title: 'Etapa 8 • Desejo Principal',
        question: 'Antes do primeiro dia de escola, o que mais te daria orgulho de ver seu filho fazendo sozinho?',
        options: [
          { value: 'colors_shapes', label: 'Reconhecendo cores e formas', sub: 'Nomear e classificar o mundo ao redor com segurança' },
          { value: 'numbers', label: 'Contando e entendendo pequenas quantidades', sub: 'Construir a noção concreta de quantidade física' },
          { value: 'coordination', label: 'Fazendo traçados com mais coordenação', sub: 'Firmeza na pegada do lápis para futura escrita' },
          { value: 'reasoning', label: 'Resolvendo padrões e pequenos desafios', sub: 'Pensamento lógico e resolução autônoma' },
          { value: 'all', label: 'Quero vê-lo avançando em tudo isso', sub: 'Uma base completa e progressiva para todos os fundamentos' }
        ]
      }
    ];

    const answersQuery = `
      SELECT
        a.step,
        a.question_id,
        a.answer,
        COUNT(DISTINCT a.session_id) as count,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL THEN a.session_id END) as completed_count
      FROM quiz_answers a
      JOIN analytics_sessions s ON s.session_id = a.session_id
      ${whereSql}
      GROUP BY a.step, a.question_id, a.answer
    `;

    const rawAnswers = db.prepare(answersQuery).all(...params) || [];
    
    const answerMap = {};
    rawAnswers.forEach(r => {
      const k = `${r.step}_${r.answer}`;
      answerMap[k] = { count: r.count, completedCount: r.completed_count };
    });

    const resultQuestions = QUIZ_SCHEMA.map(q => {
      let totalResponsesForQuestion = 0;
      const optionsWithCount = q.options.map(opt => {
        const item = answerMap[`${q.step}_${opt.value}`] || { count: 0, completedCount: 0 };
        const count = item.count;
        totalResponsesForQuestion += count;
        const completionRate = count > 0 ? Math.round((item.completedCount / count) * 1000) / 10 : 0;

        return {
          value: opt.value,
          label: opt.label,
          sub: opt.sub,
          count,
          completionRate,
          quizCompletionRate: completionRate
        };
      });

      const optionsWithPct = optionsWithCount.map(opt => ({
        ...opt,
        percent: totalResponsesForQuestion > 0 ? Math.round((opt.count / totalResponsesForQuestion) * 1000) / 10 : 0
      }));

      return {
        step: q.step,
        question_id: q.question_id,
        title: q.title,
        question: q.question,
        totalResponses: totalResponsesForQuestion,
        options: optionsWithPct
      };
    });

    // Results Categories Distribution
    const resultsQuery = `
      SELECT
        COALESCE(s.quiz_result, 'Não classificado') as result_category,
        COUNT(DISTINCT s.session_id) as count,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.session_id END) as lp_views,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 THEN s.session_id END) as cta_clicks
      FROM analytics_sessions s
      ${whereSql ? whereSql + ' AND s.quiz_completed_at IS NOT NULL' : 'WHERE s.quiz_completed_at IS NOT NULL'}
      GROUP BY COALESCE(s.quiz_result, 'Não classificado')
    `;

    const rawResults = db.prepare(resultsQuery).all(...params) || [];
    const totalClassified = rawResults.reduce((acc, r) => acc + r.count, 0);

    const resultsDistribution = rawResults.map(r => ({
      category: r.result_category,
      count: r.count,
      percent: totalClassified > 0 ? Math.round((r.count / totalClassified) * 1000) / 10 : 0,
      lpCount: r.lp_views,
      lpRate: r.count > 0 ? Math.round((r.lp_views / r.count) * 1000) / 10 : 0,
      ctaClickCount: r.cta_clicks,
      ctaRate: r.count > 0 ? Math.round((r.cta_clicks / r.count) * 1000) / 10 : 0
    }));

    return {
      questions: resultQuestions,
      resultsDistribution
    };
  },

  // ============================================================================
  // 4. LANDING PAGE (SEÇÕES REAIS, RETENÇÃO, SCROLL, TEMPO ENGAJADO E CTAS)
  // ============================================================================
  getLandingPageMetrics(filters = {}) {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    // 1. LP Summary KPIs
    const lpKpiQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL OR s.max_scroll_depth > 0 OR s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('lp_view', 'landing_page_view', 'section_view', 'cta_click', 'scroll_depth')) THEN s.session_id END) as lp_visitors,
        COALESCE(AVG(CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.total_lp_engaged_ms END), 0) as avg_engaged_ms,
        COUNT(DISTINCT CASE WHEN (s.total_lp_engaged_ms >= 10000 OR s.max_scroll_depth >= 50 OR s.cta_clicked_count > 0 OR (SELECT COUNT(*) FROM section_engagement se WHERE se.session_id = s.session_id) >= 2) THEN s.session_id END) as engaged_sessions,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'cta_click') THEN s.session_id END) as cta_clicks,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 25 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 25) THEN s.session_id END) as scroll_25,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 50 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 50) THEN s.session_id END) as scroll_50,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 75 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 75) THEN s.session_id END) as scroll_75,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 90 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 90) THEN s.session_id END) as scroll_90,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 100 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 100) THEN s.session_id END) as scroll_100
      FROM analytics_sessions s
      ${whereSql}
    `;

    const lpKpiRaw = db.prepare(lpKpiQuery).get(...params) || {};
    const lpVisitors = lpKpiRaw.lp_visitors || 0;
    const avgEngagedSeconds = Math.round((lpKpiRaw.avg_engaged_ms || 0) / 100) / 10;
    const engagedSessions = lpKpiRaw.engaged_sessions || 0;
    const ctaClicks = lpKpiRaw.cta_clicks || 0;
    const ctaCtr = lpVisitors > 0 ? Math.round((ctaClicks / lpVisitors) * 1000) / 10 : 0;

    // Median Engaged Time
    const medianQuery = `
      SELECT total_lp_engaged_ms
      FROM analytics_sessions s
      ${whereSql ? whereSql + ' AND s.lp_viewed_at IS NOT NULL AND s.total_lp_engaged_ms > 0' : 'WHERE s.lp_viewed_at IS NOT NULL AND s.total_lp_engaged_ms > 0'}
      ORDER BY total_lp_engaged_ms ASC
    `;
    const times = db.prepare(medianQuery).all(...params) || [];
    let medianEngagedSeconds = 0;
    if (times.length > 0) {
      const mid = Math.floor(times.length / 2);
      const medianMs = times.length % 2 !== 0 ? times[mid].total_lp_engaged_ms : (times[mid - 1].total_lp_engaged_ms + times[mid].total_lp_engaged_ms) / 2;
      medianEngagedSeconds = Math.round(medianMs / 100) / 10;
    }

    const scrollMetrics = {
      s25: { count: lpKpiRaw.scroll_25 || 0, percent: lpVisitors > 0 ? Math.round(((lpKpiRaw.scroll_25 || 0) / lpVisitors) * 1000) / 10 : 0 },
      s50: { count: lpKpiRaw.scroll_50 || 0, percent: lpVisitors > 0 ? Math.round(((lpKpiRaw.scroll_50 || 0) / lpVisitors) * 1000) / 10 : 0 },
      s75: { count: lpKpiRaw.scroll_75 || 0, percent: lpVisitors > 0 ? Math.round(((lpKpiRaw.scroll_75 || 0) / lpVisitors) * 1000) / 10 : 0 },
      s90: { count: lpKpiRaw.scroll_90 || 0, percent: lpVisitors > 0 ? Math.round(((lpKpiRaw.scroll_90 || 0) / lpVisitors) * 1000) / 10 : 0 },
      s100: { count: lpKpiRaw.scroll_100 || 0, percent: lpVisitors > 0 ? Math.round(((lpKpiRaw.scroll_100 || 0) / lpVisitors) * 1000) / 10 : 0 }
    };

    // 2. Sections Breakdown
    const sectionViewsQuery = `
      SELECT
        se.section_id,
        COUNT(DISTINCT se.session_id) as reached_count,
        COALESCE(AVG(se.engaged_ms), 0) as avg_engaged_ms
      FROM section_engagement se
      JOIN analytics_sessions s ON s.session_id = se.session_id
      ${whereSql}
      GROUP BY se.section_id
    `;
    const rawSections = db.prepare(sectionViewsQuery).all(...params) || [];
    const sectionMap = {};
    rawSections.forEach(s => {
      sectionMap[s.section_id] = {
        reached: s.reached_count,
        avgSeconds: Math.round((s.avg_engaged_ms || 0) / 100) / 10
      };
    });

    const sectionsTable = [];
    const retentionChart = [];
    let prevSectionCount = lpVisitors;

    for (let i = 0; i < LP_SECTIONS_DEF.length; i++) {
      const def = LP_SECTIONS_DEF[i];
      const item = sectionMap[def.id] || { reached: 0, avgSeconds: 0 };
      // Monotonic guarantee for LP flow
      const count = Math.min(prevSectionCount, item.reached > 0 ? item.reached : (i === 0 ? lpVisitors : 0));
      const reachPercent = lpVisitors > 0 ? Math.round((count / lpVisitors) * 1000) / 10 : 0;
      const dropAfter = Math.max(0, prevSectionCount - count);
      const dropPercent = prevSectionCount > 0 ? Math.round((dropAfter / prevSectionCount) * 1000) / 10 : 0;

      sectionsTable.push({
        id: def.id,
        name: def.name,
        order: i + 1,
        reached: count,
        reachPercent,
        avgSeconds: item.avgSeconds,
        advanced: count,
        dropAfter,
        dropPercent
      });

      retentionChart.push({
        id: def.id,
        name: def.name,
        reachPercent
      });

      prevSectionCount = count;
    }

    // 3. CTAs Performance Table
    const ctasDef = [
      { id: 'hero_primary', name: 'Hero CTA ("Quero começar com meu filho")', section_id: 'hero' },
      { id: 'offer_checkout', name: 'Oferta Principal ("Quero o Antes da Escola™")', section_id: 'oferta' },
      { id: 'final_cta', name: 'CTA Final ("Quero começar agora")', section_id: 'cta_final' },
      { id: 'sticky_mobile_cta', name: 'Barra Fixa Mobile ("Começar Agora")', section_id: 'oferta' },
      { id: 'result_cta_to_lp', name: 'Resultado Quiz ("Mostrar como desenvolver")', section_id: 'resultado' }
    ];

    const ctaStatsQuery = `
      SELECT
        e.cta_id,
        COUNT(DISTINCT CASE WHEN e.event_name = 'cta_view' THEN e.session_id END) as views_count,
        COUNT(DISTINCT CASE WHEN e.event_name = 'cta_click' THEN e.session_id END) as clicks_count
      FROM analytics_events e
      JOIN analytics_sessions s ON s.session_id = e.session_id
      ${whereSql ? whereSql + " AND e.cta_id IS NOT NULL AND e.event_name IN ('cta_view', 'cta_click')" : "WHERE e.cta_id IS NOT NULL AND e.event_name IN ('cta_view', 'cta_click')"}
      GROUP BY e.cta_id
    `;
    const rawCtas = db.prepare(ctaStatsQuery).all(...params) || [];
    const ctaMap = {};
    rawCtas.forEach(c => {
      ctaMap[c.cta_id] = { views: c.views_count, clicks: c.clicks_count };
    });

    let highestCtrCta = null;
    let mostClickedCta = null;
    let mostViewedCta = null;
    let maxCtr = -1;
    let maxClicks = -1;
    let maxViews = -1;

    const ctasTable = ctasDef.map(def => {
      const stats = ctaMap[def.id] || { views: 0, clicks: 0 };
      const views = stats.views;
      const clicks = stats.clicks;
      const ctr = views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0;

      if (views >= 3 && ctr > maxCtr) {
        maxCtr = ctr;
        highestCtrCta = { ...def, views, clicks, ctr };
      }
      if (clicks > maxClicks && clicks > 0) {
        maxClicks = clicks;
        mostClickedCta = { ...def, views, clicks, ctr };
      }
      if (views > maxViews && views > 0) {
        maxViews = views;
        mostViewedCta = { ...def, views, clicks, ctr };
      }

      return {
        id: def.id,
        name: def.name,
        section_id: def.section_id,
        views,
        clicks,
        ctr
      };
    });

    return {
      summary: {
        lpViews: lpVisitors,
        lpVisitors,
        avgTimeSeconds: avgEngagedSeconds,
        avgEngagedSeconds,
        medianTimeSeconds: medianEngagedSeconds,
        medianEngagedSeconds,
        engagedSessions,
        totalCtaClicks: ctaClicks,
        ctaClicks,
        overallCtaCtr: ctaCtr,
        ctaCtr
      },
      kpi: {
        lpVisitors,
        avgEngagedSeconds,
        medianEngagedSeconds,
        engagedSessions,
        ctaClicks,
        ctaCtr
      },
      scrollDepth: [
        { depth: 25, sessionsCount: scrollMetrics.s25.count, percentOfLp: scrollMetrics.s25.percent },
        { depth: 50, sessionsCount: scrollMetrics.s50.count, percentOfLp: scrollMetrics.s50.percent },
        { depth: 75, sessionsCount: scrollMetrics.s75.count, percentOfLp: scrollMetrics.s75.percent },
        { depth: 90, sessionsCount: scrollMetrics.s90.count, percentOfLp: scrollMetrics.s90.percent },
        { depth: 100, sessionsCount: scrollMetrics.s100.count, percentOfLp: scrollMetrics.s100.percent }
      ],
      scrollMetrics,
      sections: sectionsTable.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        viewCount: s.reached,
        reachPercent: s.reachPercent,
        avgEngagedSeconds: s.avgSeconds,
        advancedPercent: s.reachPercent,
        dropPercent: s.dropPercent
      })),
      sectionsTable,
      retentionChart,
      ctas: ctasTable.map(c => ({
        ctaId: c.id,
        id: c.id,
        name: c.name,
        sectionId: c.section_id,
        views: c.views,
        clicks: c.clicks,
        ctr: c.ctr
      })),
      ctasTable,
      highlights: {
        highestCtrCta: highestCtrCta || { name: 'Dados insuficientes', ctr: 0 },
        mostClickedCta: mostClickedCta || { name: 'Dados insuficientes', clicks: 0 },
        mostViewedCta: mostViewedCta || { name: 'Dados insuficientes', views: 0 }
      }
    };
  },

  // ============================================================================
  // 5. AQUISIÇÃO (ANÁLISE COMPORTAMENTAL POR CRIATIVO, CAMPANHA E ORIGEM)
  // ============================================================================
  getAcquisitionMetrics(filters = {}, groupBy = 'utm_content') {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    const validGroups = ['utm_content', 'utm_campaign', 'utm_source', 'utm_medium', 'device_type'];
    const groupField = validGroups.includes(groupBy) ? groupBy : 'utm_content';

    const query = `
      SELECT
        COALESCE(s.${groupField}, '(Direto / Não identificado)') as dimension_value,
        COUNT(DISTINCT s.session_id) as sessions,
        COUNT(DISTINCT CASE WHEN s.quiz_started_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_start', 'quiz_started')) THEN s.session_id END) as quiz_started,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL OR s.lp_viewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('quiz_complete', 'quiz_completed', 'lp_view', 'landing_page_view')) THEN s.session_id END) as quiz_completed,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL OR s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name IN ('lp_view', 'landing_page_view', 'cta_click')) THEN s.session_id END) as lp_views,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 75 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'scroll_depth' AND e.scroll_depth >= 75) THEN s.session_id END) as scroll_75,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.event_name = 'cta_click') THEN s.session_id END) as cta_clicks,
        COALESCE(AVG(CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.total_lp_engaged_ms END), 0) as avg_engaged_ms
      FROM analytics_sessions s
      ${whereSql}
      GROUP BY s.${groupField}
      ORDER BY sessions DESC
      LIMIT 100
    `;

    const rows = db.prepare(query).all(...params) || [];

    const table = rows.map(r => ({
      name: r.dimension_value,
      visitors: r.sessions,
      sessions: r.sessions,
      quizStarted: r.quiz_started,
      quizCompleted: r.quiz_completed,
      quizCompletionRate: r.quiz_started > 0 ? Math.round((r.quiz_completed / r.quiz_started) * 1000) / 10 : 0,
      lpViews: r.lp_views,
      lpRate: r.sessions > 0 ? Math.round((r.lp_views / r.sessions) * 1000) / 10 : 0,
      scroll75: r.scroll_75,
      scroll75Rate: r.lp_views > 0 ? Math.round((r.scroll_75 / r.lp_views) * 1000) / 10 : 0,
      ctaClicks: r.cta_clicks,
      ctaCtr: r.lp_views > 0 ? Math.round((r.cta_clicks / r.lp_views) * 1000) / 10 : 0,
      lpAvgTime: Math.round((r.avg_engaged_ms || 0) / 100) / 10
    }));

    const deviceQuery = `
      SELECT
        COALESCE(s.device_type, 'desktop') as device,
        COUNT(DISTINCT s.session_id) as visitors,
        COUNT(DISTINCT CASE WHEN s.quiz_completed_at IS NOT NULL THEN s.session_id END) as quizCompleted,
        COUNT(DISTINCT CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.session_id END) as lpViews,
        COUNT(DISTINCT CASE WHEN s.max_scroll_depth >= 75 THEN s.session_id END) as scroll75,
        COUNT(DISTINCT CASE WHEN s.cta_clicked_count > 0 THEN s.session_id END) as ctaClicks,
        COALESCE(AVG(CASE WHEN s.lp_viewed_at IS NOT NULL THEN s.total_lp_engaged_ms END), 0) as avg_engaged_ms
      FROM analytics_sessions s
      ${whereSql}
      GROUP BY s.device_type
      ORDER BY visitors DESC
    `;
    const deviceRows = db.prepare(deviceQuery).all(...params) || [];
    const devices = deviceRows.map(d => ({
      device: d.device,
      visitors: d.visitors,
      quizCompleted: d.quizCompleted,
      quizCompletionRate: d.visitors > 0 ? Math.round((d.quizCompleted / d.visitors) * 1000) / 10 : 0,
      lpViews: d.lpViews,
      scroll75: d.scroll75,
      ctaClicks: d.ctaClicks,
      ctaCtr: d.lpViews > 0 ? Math.round((d.ctaClicks / d.lpViews) * 1000) / 10 : 0,
      lpAvgTime: Math.round((d.avg_engaged_ms || 0) / 100) / 10
    }));

    return {
      groupBy: groupField,
      attributionTable: table,
      devices
    };
  },

  // ============================================================================
  // 6. SESSÕES & JORNADAS ANÔNIMAS (TIMELINE COMPLETA)
  // ============================================================================
  getSessionsMetrics(filters = {}, limit = 50, offset = 0) {
    const { whereSql, params } = buildFilterClauses(filters, 's');

    const listQuery = `
      SELECT
        s.session_id,
        s.visitor_id,
        s.utm_source,
        s.utm_campaign,
        s.utm_content,
        s.device_type,
        s.browser,
        s.started_at,
        s.quiz_started_at,
        s.quiz_completed_at,
        s.quiz_result,
        s.lp_viewed_at,
        s.total_lp_engaged_ms,
        s.max_scroll_depth,
        s.cta_clicked_count,
        (SELECT COUNT(*) FROM analytics_events e WHERE e.session_id = s.session_id) as event_count
      FROM analytics_sessions s
      ${whereSql}
      ORDER BY s.started_at DESC
      LIMIT ? OFFSET ?
    `;

    const sessions = db.prepare(listQuery).all(...params, limit, offset) || [];

    const formattedSessions = sessions.map(s => {
      // Determine session milestone status badge
      let statusBadge = 'Visita';
      let badgeClass = 'badge-muted';

      if (s.cta_clicked_count > 0) {
        statusBadge = 'CTA Clicado';
        badgeClass = 'badge-success';
      } else if (s.lp_viewed_at) {
        statusBadge = 'Chegou à LP';
        badgeClass = 'badge-primary';
      } else if (s.quiz_completed_at) {
        statusBadge = 'Quiz Concluído';
        badgeClass = 'badge-info';
      } else if (s.quiz_started_at) {
        statusBadge = 'Quiz Iniciado';
        badgeClass = 'badge-warning';
      }

      // Short anonymous hash identifier
      const shortId = '#' + (s.session_id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase() || 'ANON');

      return {
        sessionId: s.session_id,
        shortId,
        visitorId: s.visitor_id,
        deviceType: s.device_type,
        browser: s.browser,
        utmSource: s.utm_source || '(Direto)',
        utmCampaign: s.utm_campaign || '-',
        utmContent: s.utm_content || '-',
        startedAt: s.started_at,
        quizResult: s.quiz_result,
        totalLpEngagedSeconds: Math.round((s.total_lp_engaged_ms || 0) / 100) / 10,
        maxScrollDepth: s.max_scroll_depth,
        ctaClickedCount: s.cta_clicked_count,
        eventCount: s.event_count,
        statusBadge,
        badgeClass
      };
    });

    return {
      sessions: formattedSessions,
      totalCount: formattedSessions.length
    };
  },

  // Detailed step-by-step chronological event timeline for a single session
  getSessionTimeline(sessionId) {
    if (!sessionId) return { session: {}, timeline: [], events: [] };

    const session = db.prepare(`SELECT * FROM analytics_sessions WHERE session_id = ?`).get(sessionId) || {};

    const eventsQuery = `
      SELECT
        e.id,
        e.event_id,
        e.event_name,
        e.page_path,
        e.section_id,
        e.cta_id,
        e.step,
        e.question_id,
        e.answer,
        e.scroll_depth,
        e.duration_ms,
        e.metadata,
        e.created_at
      FROM analytics_events e
      WHERE e.session_id = ?
      ORDER BY e.created_at ASC, e.id ASC
    `;

    const events = db.prepare(eventsQuery).all(sessionId) || [];

    const timeline = events.map(e => {
      let title = e.event_name;
      let detail = '';
      let icon = '📌';

      let parsedMeta = null;
      try {
        parsedMeta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
      } catch(err) {
        parsedMeta = null;
      }

      if (e.event_name === 'session_start') {
        title = 'Sessão Iniciada';
        detail = e.page_path || '/';
        icon = '🚀';
      } else if (e.event_name === 'quiz_view') {
        title = 'Quiz Aberto';
        icon = '👀';
      } else if (e.event_name === 'quiz_start') {
        title = 'Quiz Iniciado';
        icon = '▶️';
      } else if (e.event_name === 'quiz_step_view') {
        title = `Pergunta ${e.step} Visualizada`;
        icon = '❓';
      } else if (e.event_name === 'quiz_answer') {
        title = `Pergunta ${e.step} Respondida`;
        const durStr = e.duration_ms ? ` (${(e.duration_ms / 1000).toFixed(1)}s)` : '';
        detail = `Resposta: "${e.answer}"${durStr}`;
        icon = '✅';
      } else if (e.event_name === 'quiz_complete') {
        title = 'Quiz Concluído';
        icon = '🏆';
      } else if (e.event_name === 'quiz_result_view' || e.event_name === 'result_viewed') {
        title = 'Resultado do Quiz Visualizado';
        icon = '📊';
      } else if (e.event_name === 'lp_view' || e.event_name === 'landing_page_view') {
        title = 'Landing Page Aberta';
        icon = '📄';
      } else if (e.event_name === 'section_view') {
        const secDef = LP_SECTIONS_DEF.find(s => s.id === e.section_id);
        title = `Seção Vista: ${secDef ? secDef.name : e.section_id}`;
        icon = '👁️';
      } else if (e.event_name === 'section_engaged') {
        const secDef = LP_SECTIONS_DEF.find(s => s.id === e.section_id);
        const durStr = e.duration_ms ? `${(e.duration_ms / 1000).toFixed(1)}s engajado` : '';
        title = `Tempo na Seção: ${secDef ? secDef.name : e.section_id}`;
        detail = durStr;
        icon = '⏱️';
      } else if (e.event_name === 'scroll_depth') {
        title = `Rolagem: ${e.scroll_depth}% da página`;
        icon = '📜';
      } else if (e.event_name === 'cta_view') {
        title = `CTA Visto: ${e.cta_id}`;
        icon = '👀';
      } else if (e.event_name === 'cta_click') {
        title = `CTA Clicado: ${e.cta_id}`;
        detail = `Seção: ${e.section_id || '-'}`;
        icon = '🔥';
      }

      return {
        id: e.id,
        type: e.event_name,
        eventName: e.event_name,
        title,
        detail,
        details: {
          duration_ms: e.duration_ms,
          question_id: e.question_id,
          answer: e.answer,
          result: parsedMeta ? parsedMeta.result : null,
          depth: e.scroll_depth,
          cta_id: e.cta_id,
          section_id: e.section_id,
          destination_type: parsedMeta ? parsedMeta.destination_type : null
        },
        icon,
        timestamp: e.created_at,
        createdAt: e.created_at
      };
    });

    return {
      session,
      timeline,
      events: timeline
    };
  },

  // Dropdown filter options dynamically loaded from real data
  getFilterDropdowns() {
    const campaigns = db.prepare(`SELECT DISTINCT utm_campaign FROM analytics_sessions WHERE utm_campaign IS NOT NULL AND utm_campaign != '' ORDER BY utm_campaign ASC LIMIT 50`).all().map(r => r.utm_campaign);
    const contents = db.prepare(`SELECT DISTINCT utm_content FROM analytics_sessions WHERE utm_content IS NOT NULL AND utm_content != '' ORDER BY utm_content ASC LIMIT 50`).all().map(r => r.utm_content);
    const sources = db.prepare(`SELECT DISTINCT utm_source FROM analytics_sessions WHERE utm_source IS NOT NULL AND utm_source != '' ORDER BY utm_source ASC LIMIT 50`).all().map(r => r.utm_source);

    return { campaigns, contents, sources };
  }
};

module.exports = dbOperations;
