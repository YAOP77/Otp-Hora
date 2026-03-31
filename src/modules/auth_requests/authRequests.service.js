const { randomUUID } = require('crypto');
const authRequestsRepository = require('./authRequests.repository');
const { env } = require('../../config/env');
const logger = require('../../common/logger');
const { createError } = require('../../common/errors');

const REQUEST_EXPIRATION_MINUTES = 3;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function computeExpiresAt() {
  const now = Date.now();
  return new Date(now + REQUEST_EXPIRATION_MINUTES * 60 * 1000);
}

function isUuid(value) {
  return UUID_REGEX.test(value);
}

function hasExpired(expiresAt, now = Date.now()) {
  return now >= expiresAt.getTime();
}

function logAudit({ request_id, company_id, action, result }) {
  logger.info({
    module: 'auth_requests',
    action,
    request_id: request_id || null,
    company_id: company_id || null,
    result,
  });
}

async function enforceRateLimitForCreate(companyId) {
  const since = new Date(Date.now() - env.rateLimitWindowMs);
  const count = await authRequestsRepository.countRecentAuthRequestsByCompany(
    companyId,
    since,
  );
  if (count >= env.rateLimitCreatePerWindow) {
    throw createError('Trop de requetes, veuillez reessayer plus tard', 429, 'RATE_LIMITED');
  }
}

async function enforceRateLimitForResolveUser(userId) {
  const since = new Date(Date.now() - env.rateLimitWindowMs);
  const count = await authRequestsRepository.countRecentResolveEventsByUser(userId, since);
  if (count >= env.rateLimitResolvePerWindow) {
    throw createError('Trop de requetes, veuillez reessayer plus tard', 429, 'RATE_LIMITED');
  }
}

async function validateRequestOwnershipForEnterprise(companyId, requestId) {
  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }

  if (!requestId) {
    throw createError('Le parametre request_id est obligatoire', 400, 'INVALID_INPUT');
  }

  if (!isUuid(requestId)) {
    throw createError(
      'Le parametre request_id doit etre un UUID valide',
      400,
      'INVALID_UUID',
    );
  }

  const request = await authRequestsRepository.findAuthRequestById(requestId);
  if (!request) {
    throw createError('Demande introuvable', 404, 'REQUEST_NOT_FOUND');
  }

  const link = await authRequestsRepository.findLinkById(request.link_id);
  if (!link) {
    throw createError('Link introuvable', 404, 'LINK_NOT_FOUND');
  }

  if (link.company_id !== companyId) {
    throw createError(
      "Cette demande n'appartient pas a cette entreprise",
      403,
      'FORBIDDEN',
    );
  }

  return request;
}

async function validateRequestOwnershipForUser(userId, requestId) {
  if (!userId) {
    throw createError('Le champ user_id est obligatoire', 400, 'INVALID_INPUT');
  }

  if (!isUuid(userId)) {
    throw createError('Le champ user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  if (!requestId) {
    throw createError('Le parametre request_id est obligatoire', 400, 'INVALID_INPUT');
  }

  if (!isUuid(requestId)) {
    throw createError(
      'Le parametre request_id doit etre un UUID valide',
      400,
      'INVALID_UUID',
    );
  }

  const request = await authRequestsRepository.findAuthRequestById(requestId);
  if (!request) {
    throw createError('Demande introuvable', 404, 'REQUEST_NOT_FOUND');
  }

  const link = await authRequestsRepository.findLinkById(request.link_id);
  if (!link) {
    throw createError('Link introuvable', 404, 'LINK_NOT_FOUND');
  }

  if (link.user_id !== userId) {
    throw createError(
      "Cette demande ne concerne pas cet utilisateur OTP Hora",
      403,
      'FORBIDDEN',
    );
  }

  return { request, link };
}

async function createAuthRequest(payload) {
  const companyId = payload?.company_id;
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';

  if (!companyId) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }
  await enforceRateLimitForCreate(companyId);

  if (!linkId) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError('Le champ link_id est obligatoire', 400, 'INVALID_INPUT');
  }

  if (!isUuid(linkId)) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError('Le champ link_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  const link = await authRequestsRepository.findLinkById(linkId);
  if (!link) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError('Link introuvable', 404, 'LINK_NOT_FOUND');
  }

  if (link.company_id !== companyId) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError(
      "Ce link_id n'appartient pas a cette entreprise",
      403,
      'FORBIDDEN',
    );
  }

  if (link.status !== 'active' || !link.user_id) {
    logAudit({
      request_id: null,
      company_id: companyId,
      action: 'create_request',
      result: 'failure',
    });
    throw createError(
      "Le lien d'identité doit être actif et confirmé par l'utilisateur",
      409,
      'LINK_NOT_ACTIVE',
    );
  }

  const created = await authRequestsRepository.createAuthRequestWithEvent({
    request_id: randomUUID(),
    link_id: link.link_id,
    status: 'pending',
    expires_at: computeExpiresAt(),
  });

  logAudit({
    request_id: created.request_id,
    company_id: companyId,
    action: 'create_request',
    result: 'success',
  });

  return created;
}

async function getAuthRequestStatus(payload) {
  const companyId = payload?.company_id;
  const requestId =
    typeof payload?.request_id === 'string' ? payload.request_id.trim() : '';
  const request = await validateRequestOwnershipForEnterprise(companyId, requestId);

  const now = Date.now();
  const isExpired = hasExpired(request.expires_at, now);
  const status =
    request.status === 'pending' && isExpired ? 'expired' : request.status;

  return {
    request_id: request.request_id,
    status,
    expires_at: request.expires_at,
  };
}

async function resolveRequest(payload, targetStatus, action) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const requestId =
    typeof payload?.request_id === 'string' ? payload.request_id.trim() : '';

  const { request, link } = await validateRequestOwnershipForUser(userId, requestId);
  await enforceRateLimitForResolveUser(userId);
  const now = Date.now();

  const companyId = link?.company_id || null;

  if (request.status === 'approved' || request.status === 'rejected') {
    if (request.status === targetStatus) {
      logAudit({
        request_id: request.request_id,
        company_id: companyId,
        action,
        result: 'success',
      });
      return {
        request_id: request.request_id,
        status: request.status,
        expires_at: request.expires_at,
      };
    }

    logAudit({
      request_id: request.request_id,
      company_id: companyId,
      action,
      result: 'failure',
    });
    throw createError('La demande est deja resolue', 409, 'ALREADY_RESOLVED');
  }

  if (request.status === 'pending' && hasExpired(request.expires_at, now)) {
    logAudit({
      request_id: request.request_id,
      company_id: companyId,
      action,
      result: 'failure',
    });
    throw createError('La demande est expiree', 410, 'REQUEST_EXPIRED');
  }

  const resolved = await authRequestsRepository.resolveAuthRequestIfPending(
    request.request_id,
    targetStatus,
    action,
    new Date(now),
  );

  if (!resolved.updated) {
    const current = resolved.current;

    if (current && current.status === targetStatus) {
      logAudit({
        request_id: request.request_id,
        company_id: companyId,
        action,
        result: 'success',
      });
      return {
        request_id: current.request_id,
        status: current.status,
        expires_at: current.expires_at,
      };
    }

    if (current && current.status === 'pending') {
      if (hasExpired(current.expires_at, now)) {
        logAudit({
          request_id: request.request_id,
          company_id: companyId,
          action,
          result: 'failure',
        });
        throw createError('La demande est expiree', 410, 'REQUEST_EXPIRED');
      }

      if (action === targetStatus) {
        logAudit({
          request_id: request.request_id,
          company_id: companyId,
          action,
          result: 'success',
        });
        return {
          request_id: current.request_id,
          status: current.status,
          expires_at: current.expires_at,
        };
      }
    }

    if (current && current.status === 'pending' && hasExpired(current.expires_at, now)) {
      logAudit({
        request_id: request.request_id,
        company_id: companyId,
        action,
        result: 'failure',
      });
      throw createError('La demande est expiree', 410, 'REQUEST_EXPIRED');
    }

    logAudit({
      request_id: request.request_id,
      company_id: companyId,
      action,
      result: 'failure',
    });
    throw createError('La demande est deja resolue', 409, 'ALREADY_RESOLVED');
  }

  logAudit({
    request_id: request.request_id,
    company_id: companyId,
    action,
    result: 'success',
  });

  return resolved.current;
}

async function approveRequest(payload) {
  return resolveRequest(payload, 'approved', 'approved');
}

async function rejectRequest(payload) {
  return resolveRequest(payload, 'rejected', 'rejected');
}

module.exports = {
  createAuthRequest,
  getAuthRequestStatus,
  approveRequest,
  rejectRequest,
};
