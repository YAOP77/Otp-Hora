const jwt = require('jsonwebtoken');
const enterpriseRepository = require('../modules/enterprise_accounts/enterprise.repository');
const bcrypt = require('bcrypt');
const logger = require('./logger');
const { createError } = require('./errors');
const { env } = require('../config/env');
const apiKeyCache = require('./apiKeyCache');
const { ROLES } = require('./phone');

async function requireEnterpriseApiKey(req, res, next) {
  try {
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      logger.warn({
        module: 'security',
        action: 'api_key_auth',
        request_id: req.id || null,
        company_id: null,
        result: 'failure',
        error: {
          message: 'x-api-key manquant',
          code: 'MISSING_API_KEY',
          status: 401,
        },
      });
      return next(createError('x-api-key est obligatoire', 401, 'MISSING_API_KEY'));
    }

    const cached = apiKeyCache.getCachedEnterprise(apiKey);
    if (cached) {
      req.enterprise = cached;
      logger.info({
        module: 'security',
        action: 'api_key_auth',
        request_id: req.id || null,
        company_id: cached.company_id,
        result: 'success',
        cache: 'hit',
      });
      return next();
    }

    const enterprises = await enterpriseRepository.findActiveEnterprises();

    let enterprise = null;
    for (const item of enterprises) {
      const isValid = await bcrypt.compare(apiKey, item.api_key);
      if (isValid) {
        enterprise = item;
        break;
      }
    }

    if (!enterprise) {
      logger.warn({
        module: 'security',
        action: 'api_key_auth',
        request_id: req.id || null,
        company_id: null,
        result: 'failure',
        error: {
          message: 'API key invalide ou entreprise inactive',
          code: 'INVALID_API_KEY',
          status: 403,
        },
      });
      return next(
        createError('API key invalide ou entreprise inactive', 403, 'INVALID_API_KEY'),
      );
    }

    req.enterprise = {
      company_id: enterprise.company_id,
      nom_entreprise: enterprise.nom_entreprise,
      status: enterprise.status,
    };

    apiKeyCache.setCachedEnterprise(
      apiKey,
      enterprise,
      env.apiKeyCacheTtlMs,
      env.apiKeyCacheMaxEntries,
    );

    logger.info({
      module: 'security',
      action: 'api_key_auth',
      request_id: req.id || null,
      company_id: enterprise.company_id,
      result: 'success',
      cache: 'miss',
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Routes partenaires : `Authorization: Bearer <access_token>` (rôle company) ou `x-api-key`.
 */
async function requireEnterpriseAuth(req, res, next) {
  const authHeader = req.header('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return next(createError('Authorization Bearer token est obligatoire', 401, 'MISSING_TOKEN'));
    }
    try {
      const payload = jwt.verify(token, env.userAccessTokenSecret);
      if (
        !payload ||
        payload.type !== 'access' ||
        payload.role !== ROLES.COMPANY ||
        !payload.sub ||
        payload.tv === undefined
      ) {
        return next(createError('Token entreprise invalide', 401, 'INVALID_TOKEN'));
      }

      const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(payload.sub);
      if (
        !enterprise ||
        (enterprise.status !== 'active' && enterprise.status !== 'valider') ||
        enterprise.token_version !== payload.tv
      ) {
        return next(createError('Token entreprise invalide ou expiré', 401, 'INVALID_TOKEN'));
      }

      req.enterprise = {
        company_id: enterprise.company_id,
        nom_entreprise: enterprise.nom_entreprise,
        status: enterprise.status,
      };
      req.enterpriseAuth = {
        company_id: enterprise.company_id,
        token_version: payload.tv,
        role: ROLES.COMPANY,
      };
      return next();
    } catch {
      return next(createError('Token entreprise invalide ou expiré', 401, 'INVALID_TOKEN'));
    }
  }

  return requireEnterpriseApiKey(req, res, next);
}

module.exports = {
  requireEnterpriseApiKey,
  requireEnterpriseAuth,
};
