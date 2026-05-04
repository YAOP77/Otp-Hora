const { guessDeviceNameFromUserAgent } = require('./phone');

/**
 * Resolves device display name from explicit header/body or User-Agent.
 */
function getDeviceMeta(req, body) {
  const fromHeader = req.header('x-device-name') || req.header('X-Device-Name');
  const fromBody =
    typeof body?.device_name === 'string' ? body.device_name.trim() : '';
  const ua = req.headers['user-agent'] || '';
  const guessed = guessDeviceNameFromUserAgent(ua);

  const device_name = (fromHeader && fromHeader.trim()) || fromBody || guessed || null;
  const user_agent = typeof ua === 'string' && ua.length > 0 ? ua.slice(0, 512) : null;

  return { device_name, user_agent };
}

module.exports = {
  getDeviceMeta,
};
