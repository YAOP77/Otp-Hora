const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { env } = require('./config/env');
const { requestId } = require('./common/requestId');
const logger = require('./common/logger');
const { notFoundHandler, errorHandler } = require('./common/errorHandler');
const { registerRoutes } = require('./modules');
const { registerWebFlowRoutes } = require('./webFlow');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.set('env', env.nodeEnv);

  app.use(requestId);

  // Helmet avec CSP adapté : les routes /flow servent du HTML avec des formulaires
  app.use((req, res, next) => {
    if (req.path.startsWith('/flow')) {
      return helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        },
      })(req, res, next);
    }
    return helmet()(req, res, next);
  });
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
        : true,
      credentials: true,
    }),
  );
  morgan.token('request-id', (req) => req.id || '-');
  app.use(
    morgan(
      (tokens, req, res) =>
        JSON.stringify({
          module: 'http',
          action: 'request',
          method: tokens.method(req, res),
          path: tokens.url(req, res),
          status: Number.parseInt(tokens.status(req, res), 10),
          response_time_ms: Number.parseFloat(tokens['response-time'](req, res)),
          request_id: req.id || null,
          company_id: req.enterprise?.company_id || null,
          result:
            Number.parseInt(tokens.status(req, res), 10) >= 400 ? 'failure' : 'success',
        }),
      {
        stream: {
          write: (line) => {
            try {
              logger.info(JSON.parse(line));
            } catch {
              logger.info({
                module: 'http',
                action: 'request',
                result: 'success',
              });
            }
          },
        },
      },
    ),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  registerRoutes(app);
  registerWebFlowRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
