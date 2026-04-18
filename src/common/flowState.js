const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { createError } = require('./errors');

// Short-lived JWT used to carry link_id (and optionally user_id after login)
// between /flow/consent HTML forms. Prevents CSRF and tampering.
function signFlowState(payload) {
  return jwt.sign(
    {
      type: 'flow_state',
      link_id: payload.link_id,
      user_id: payload.user_id || null,
    },
    env.flowStateSecret,
    { expiresIn: env.flowStateTtl },
  );
}

function verifyFlowState(state) {
  try {
    const decoded = jwt.verify(state, env.flowStateSecret);
    if (!decoded || decoded.type !== 'flow_state' || !decoded.link_id) {
      throw createError('State invalide', 400, 'INVALID_STATE');
    }
    return decoded;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('State invalide ou expiré', 400, 'INVALID_STATE');
  }
}

// Short-lived (5 min) JWT used to skip login if the user just authenticated
// and we redirect them back to /flow/consent for a second link.
function signFlowUserToken(userId) {
  return jwt.sign(
    { type: 'flow_user', user_id: userId },
    env.flowStateSecret,
    { expiresIn: 300 },
  );
}

function verifyFlowUserToken(token) {
  try {
    const decoded = jwt.verify(token, env.flowStateSecret);
    if (!decoded || decoded.type !== 'flow_user' || !decoded.user_id) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { signFlowState, verifyFlowState, signFlowUserToken, verifyFlowUserToken };
