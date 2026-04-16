const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { createError } = require('./errors');

function signFlowState(payload) {
  return jwt.sign(
    {
      type: 'flow_state',
      link_id: payload.link_id,
      request_id: payload.request_id,
      callback_url: payload.callback_url || null,
      external_state: payload.external_state || null,
    },
    env.flowStateSecret,
    { expiresIn: env.flowStateTtl },
  );
}

function verifyFlowState(state) {
  try {
    const decoded = jwt.verify(state, env.flowStateSecret);
    if (
      !decoded ||
      decoded.type !== 'flow_state' ||
      !decoded.link_id
    ) {
      throw createError('State invalide', 400, 'INVALID_STATE');
    }
    return decoded;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('State invalide ou expiré', 400, 'INVALID_STATE');
  }
}

// Token court (5 min) pour éviter de redemander le login lors du 2ème passage
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

