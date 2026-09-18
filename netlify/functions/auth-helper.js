const { verifySessionToken } = require('../../middleware/auth');

function checkAuth(event) {
  const cookieHeader = event.headers.cookie || event.headers.Cookie || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  const token = match ? match[1] : null;
  const session = verifySessionToken(token);
  return session;
}

module.exports = { checkAuth };
