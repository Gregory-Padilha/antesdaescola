const { checkAuth } = require('./auth-helper');

exports.handler = async (event) => {
  const session = checkAuth(event);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'unauthorized' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, user: session.login })
  };
};
