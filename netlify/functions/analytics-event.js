const db = require('../../db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const {
      event_id, session_id, visitor_id, event_name, page_path,
      section_id, cta_id, step, question_id, answer, scroll_depth,
      duration_ms, metadata, device_type, browser, viewport_width, utm
    } = payload;

    if (!session_id || !event_name) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'missing_required_fields' }) };
    }

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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        event_id: eventResult.event_id,
        deduplicated: eventResult.deduplicated || false
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
