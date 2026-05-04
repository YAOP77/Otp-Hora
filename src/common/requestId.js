const { randomUUID } = require('crypto');

/**
 * Attaches a unique id to each request for log correlation.
 */
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };
