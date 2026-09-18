const db = require('../../db');
const { checkAuth } = require('./auth-helper');

exports.handler = async (event) => {
  const session = checkAuth(event);
  if (!session) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      },
      body: JSON.stringify({ success: false, error: 'unauthorized' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit, 10) || 50;
    const offset = parseInt(params.offset, 10) || 0;
    const data = db.getSessionsMetrics(params, limit, offset);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      },
      body: JSON.stringify({ success: true, generated_at: new Date().toISOString(), data })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
