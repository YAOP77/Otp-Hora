const authEventsRepository = require('./authEvents.repository');
const authRequestsRepository = require('../auth_requests/authRequests.repository');
const { createError } = require('../../common/errors');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_REGEX.test(value);
}

async function createEvent(request_id, action, tx = null) {
  return authEventsRepository.createEvent({ request_id, action }, tx);
}

async function listEventsForRequest(payload) {
  const companyId = payload?.company_id;
  const requestId =
    typeof payload?.request_id === 'string' ? payload.request_id.trim() : '';

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

  return authEventsRepository.findManyByRequestId(requestId);
}

module.exports = {
  createEvent,
  listEventsForRequest,
};
