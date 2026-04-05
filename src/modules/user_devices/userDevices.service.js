const { randomUUID } = require('crypto');
const userDevicesRepository = require('./userDevices.repository');

async function registerDevice(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const deviceFingerprint =
    typeof payload?.device_fingerprint === 'string'
      ? payload.device_fingerprint.trim()
      : '';

  if (!userId) {
    const error = new Error('Le contexte utilisateur est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!deviceFingerprint) {
    const error = new Error('Le champ device_fingerprint est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  const user = await userDevicesRepository.findUserById(userId);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  return userDevicesRepository.upsertUserDevice({
    device_id: randomUUID(),
    user_id: userId,
    device_fingerprint: deviceFingerprint,
    trusted: false,
    device_name: payload.device_name || null,
    user_agent: payload.user_agent || null,
    last_seen_at: now,
  });
}

module.exports = {
  registerDevice,
};
