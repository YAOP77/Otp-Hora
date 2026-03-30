const enterpriseRepository = require('../modules/enterprise_accounts/enterprise.repository');
const bcrypt = require('bcrypt');
const logger = require('./logger');
const { createError } = require('./errors');
const { env } = require('../config/env');
const apiKeyCache = require('./apiKeyCache');

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

module.exports = {
  requireEnterpriseApiKey,
};
