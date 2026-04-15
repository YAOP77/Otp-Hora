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
      !decoded.link_id ||
      !decoded.request_id
    ) {
      throw createError('State invalide', 400, 'INVALID_STATE');
    }
    return decoded;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('State invalide ou expiré', 400, 'INVALID_STATE');
  }
}

module.exports = { signFlowState, verifyFlowState };

