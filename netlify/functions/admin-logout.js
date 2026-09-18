exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;'
    },
    body: JSON.stringify({ success: true, redirectUrl: '/login' })
  };
};
