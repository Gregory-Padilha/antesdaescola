const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

// Default session expiration: 8 hours
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'antes-da-escola-secure-session-fallback-secret-2026-key';
}

// Helper: Sign session token
function createSessionToken(login) {
  const secret = getSessionSecret();
  const payload = {
    login,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

// Helper: Verify session token
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const secret = getSessionSecret();
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Extract client IP address safely
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket ? req.socket.remoteAddress : req.ip || '127.0.0.1');
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  return ip;
}

// Middleware: Route Security & Headers
function adminSecurityHeaders(req, res, next) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// Middleware: Require Authenticated Session
function requireAdminAuth(req, res, next) {
  adminSecurityHeaders(req, res, () => {
    const token = req.cookies ? req.cookies.admin_session : null;
    const session = verifySessionToken(token);

    if (!session) {
      // If client requests HTML (browser navigation), redirect to /login
      const accept = req.headers['accept'] || '';
      if (accept.includes('text/html') || req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.redirect('/login');
      }
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    req.adminUser = session;
    next();
  });
}

// Middleware: Redirect authenticated user if already on /login
function redirectIfAuthenticated(req, res, next) {
  adminSecurityHeaders(req, res, () => {
    const token = req.cookies ? req.cookies.admin_session : null;
    const session = verifySessionToken(token);

    if (session) {
      return res.redirect('/admin/dashboard');
    }
    next();
  });
}

// Authentication Controller Logic
function handleLogin(req, res) {
  const ip = getClientIp(req);

  // 1. Rate Limiting Check (Max 5 failed attempts in 10 minutes)
  const failedAttempts = db.getRecentFailedLoginAttempts(ip, 10);
  if (failedAttempts >= 5) {
    return res.status(429).json({
      success: false,
      error: 'Muitas tentativas. Aguarde alguns minutos.'
    });
  }

  const { login, password } = req.body || {};

  if (!login || !password) {
    db.recordLoginAttempt(ip, false);
    return res.status(400).json({
      success: false,
      error: 'ID ou senha inválidos.'
    });
  }

  const configuredLogin = process.env.ADMIN_LOGIN;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;

  // Verify server configuration
  if (!configuredLogin || !configuredHash) {
    console.error('⚠️ [Segurança] ADMIN_LOGIN ou ADMIN_PASSWORD_HASH não estão configurados no ambiente (.env.local).');
    return res.status(503).json({
      success: false,
      error: 'Painel administrativo não configurado no servidor.'
    });
  }

  // Constant-time or strict login matching
  const loginMatch = String(login).trim() === configuredLogin.trim();

  let passwordMatch = false;
  try {
    passwordMatch = bcrypt.compareSync(String(password).trim(), configuredHash);
  } catch (err) {
    console.error('⚠️ [Segurança] Erro ao comparar hash de senha:', err.message);
  }

  if (!loginMatch || !passwordMatch) {
    db.recordLoginAttempt(ip, false);
    return res.status(401).json({
      success: false,
      error: 'ID ou senha inválidos.'
    });
  }

  // Success: Record valid attempt (clears failure count for IP)
  db.recordLoginAttempt(ip, true);

  // Create session token
  const token = createSessionToken(configuredLogin);

  // Set secure HttpOnly cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS
  });

  return res.json({
    success: true,
    redirectUrl: '/admin/dashboard'
  });
}

// Logout Controller Logic
function handleLogout(req, res) {
  res.clearCookie('admin_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    success: true,
    redirectUrl: '/login'
  });
}

module.exports = {
  adminSecurityHeaders,
  requireAdminAuth,
  redirectIfAuthenticated,
  handleLogin,
  handleLogout,
  createSessionToken,
  verifySessionToken
};

