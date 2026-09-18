const bcrypt = require('bcryptjs');
const db = require('../../db');
const { createSessionToken } = require('../../middleware/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'method_not_allowed' }) };
  }

  const clientIp = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || '127.0.0.1').split(',')[0].trim();

  // 1. Rate limiting check (max 5 failed attempts in 10 minutes)
  const failedAttempts = db.getRecentFailedLoginAttempts(clientIp, 10);
  if (failedAttempts >= 5) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' })
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    body = {};
  }

  const { login, password } = body;
  if (!login || !password) {
    db.recordLoginAttempt(clientIp, false);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'ID ou senha inválidos.' })
    };
  }

  const configuredLogin = process.env.ADMIN_LOGIN;
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredLogin || !configuredHash) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Painel administrativo não configurado no servidor.' })
    };
  }

  const loginMatch = String(login).trim() === configuredLogin.trim();
  let passwordMatch = false;
  try {
    passwordMatch = bcrypt.compareSync(String(password).trim(), configuredHash);
  } catch (err) {
    passwordMatch = false;
  }

  if (!loginMatch || !passwordMatch) {
    db.recordLoginAttempt(clientIp, false);
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'ID ou senha inválidos.' })
    };
  }

  // Success
  db.recordLoginAttempt(clientIp, true);
  const token = createSessionToken(configuredLogin);

  const cookie = `admin_session=${token}; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie
    },
    body: JSON.stringify({ success: true, redirectUrl: '/admin/dashboard' })
  };
};
