const { env } = require('../config/env');
const logger = require('./logger');

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: {
      message: 'Ressource introuvable',
      code: 'NOT_FOUND',
      status: 404,
    },
  });
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message =
    status >= 500 && env.nodeEnv === 'production'
      ? 'Erreur interne du serveur'
      : err.message || 'Erreur interne du serveur';

  logger.error({
    module: 'http',
    action: 'error_handler',
    request_id: req.id || null,
    company_id: req.enterprise?.company_id || null,
    result: 'failure',
    error: {
      message: err.message || 'unknown',
      code,
      status,
    },
  });

  return res.status(status).json({
    error: {
      message,
      code,
      status,
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
