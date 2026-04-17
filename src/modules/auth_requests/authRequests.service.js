const { randomUUID } = require('crypto');
const authRequestsRepository = require('./authRequests.repository');
const { env } = require('../../config/env');
const logger = require('../../common/logger');
const { createError } = require('../../common/errors');

const REQUEST_EXPIRATION_MINUTES = 15;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_ENTERPRISE_STATUSES = new Set(['pending']);

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

function buildValidationUrl({ linkId, requestId }) {
  const base = (env.publicAppUrl || '').replace(/\/+$/, '');
  return `${base}/flow/consent?link_id=${encodeURIComponent(linkId)}&request_id=${encodeURIComponent(requestId)}`;
}

function normalizeIdUser(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
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

async function validateCompanyAndIdUser(companyId, idUser, statusInput) {
  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }
  if (!idUser) {
    throw createError('Le champ id_user est obligatoire', 400, 'INVALID_INPUT');
  }
  const normalizedStatus = typeof statusInput === 'string' ? statusInput.trim().toLowerCase() : '';
  if (statusInput !== undefined && !VALID_ENTERPRISE_STATUSES.has(normalizedStatus)) {
    throw createError(
      "Le statut fourni par l'entreprise doit être `pending`",
      400,
      'INVALID_STATUS',
    );
  }
}

async function findOrCreateIdentityLink(companyId, idUser) {
  const existing = await authRequestsRepository.findLinkByCompanyAndExternalRef(companyId, idUser);
  if (existing) {
    return existing;
  }

  return authRequestsRepository.createIdentityLink({
    link_id: randomUUID(),
    company_id: companyId,
    user_id: null,
    external_ref: idUser,
    status: 'pending',
  });
}

async function getCurrentStatusByIdUser(companyId, idUser) {
  const link = await authRequestsRepository.findLinkByCompanyAndExternalRef(companyId, idUser);
  if (!link) {
    return null;
  }
  const latest = await authRequestsRepository.findLatestAuthRequestByLinkId(link.link_id);
  if (!latest) {
    return null;
  }
  return {
    request: latest,
    link,
  };
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
  const idUser = normalizeIdUser(payload?.id_user);
  const inputStatus = payload?.status;

  await validateCompanyAndIdUser(companyId, idUser, inputStatus);
  await enforceRateLimitForCreate(companyId);

  const currentState = await getCurrentStatusByIdUser(companyId, idUser);
  if (currentState && currentState.request.status === 'pending' && !hasExpired(currentState.request.expires_at)) {
    return {
      request_id: currentState.request.request_id,
      id_user: idUser,
      status: 'pending',
      expires_at: currentState.request.expires_at,
      validation_url: buildValidationUrl({
        linkId: currentState.link.link_id,
        requestId: currentState.request.request_id,
      }),
    };
  }

  const link = await findOrCreateIdentityLink(companyId, idUser);
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

  return {
    request_id: created.request_id,
    id_user: idUser,
    status: created.status,
    expires_at: created.expires_at,
    validation_url: buildValidationUrl({
      linkId: link.link_id,
      requestId: created.request_id,
    }),
  };
}

async function getAuthRequestStatus(payload) {
  const companyId = payload?.company_id;
  const idUser = normalizeIdUser(payload?.id_user);
  const requestId =
    typeof payload?.request_id === 'string' ? payload.request_id.trim() : '';

  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }

  if (requestId) {
    const request = await validateRequestOwnershipForEnterprise(companyId, requestId);
    return {
      request_id: request.request_id,
      status: request.status,
      expires_at: request.expires_at,
    };
  }

  if (!idUser) {
    throw createError(
      'Le champ id_user (ou request_id) est obligatoire pour verifier le statut',
      400,
      'INVALID_INPUT',
    );
  }

  const currentState = await getCurrentStatusByIdUser(companyId, idUser);
  if (!currentState) {
    return {
      id_user: idUser,
      status: 'pending',
      request_id: null,
    };
  }

  return {
    request_id: currentState.request.request_id,
    id_user: idUser,
    status: currentState.request.status,
    expires_at: currentState.request.expires_at,
  };
}

async function resolveRequest(payload, targetStatus, action) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';
  const requestId =
    typeof payload?.request_id === 'string' ? payload.request_id.trim() : '';

  if (requesterUserId && requesterUserId !== userId) {
    throw createError("Accès interdit pour cette action d'authentification", 403, 'FORBIDDEN');
  }

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
