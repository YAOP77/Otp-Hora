const { randomBytes, randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const enterpriseRepository = require('./enterprise.repository');
const { createError } = require('../../common/errors');
const { normalizeToE164, ROLES } = require('../../common/phone');
const { normalizePinInput } = require('../../common/pinInput');
const { formatLoginHistoryLabel } = require('../../common/loginHistoryFormat');
const {
  signCompanyAccessToken,
  signCompanyRefreshToken,
  verifyCompanyRefreshToken,
} = require('../../common/userTokenAuth');
const {
  signEnterpriseEmailVerificationToken,
  verifyEnterpriseEmailVerificationToken,
} = require('../../common/emailTokenAuth');
const {
  sendEmailVerification,
  buildEnterpriseVerifyEmailUrl,
} = require('../../common/emailService');
const { encryptApiKey, decryptApiKey } = require('../../common/apiKeyCrypto');

const PIN_REGEX = /^\d{4,6}$/;
const LOGIN_HISTORY_PREVIEW = 5;
const LOGIN_HISTORY_DEFAULT_LIMIT = 50;
const LOGIN_HISTORY_MAX_LIMIT = 200;

function generateApiKey() {
  return randomBytes(32).toString('hex');
}

function validatePin(rawPin) {
  const pin = normalizePinInput(rawPin);
  if (!PIN_REGEX.test(pin)) {
    const error = new Error('Le PIN doit contenir 4 à 6 chiffres');
    error.statusCode = 400;
    error.code = 'INVALID_PIN_FORMAT';
    throw error;
  }
}

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

async function registerEnterprise(payload) {
  const nomEntreprise =
    (typeof payload?.nom_entreprise === 'string' && payload.nom_entreprise.trim()) ||
    (typeof payload?.nom === 'string' && payload.nom.trim()) ||
    '';

  const pin = normalizePinInput(payload?.pin);
  const phoneRaw =
    typeof payload?.phone === 'string'
      ? payload.phone
      : typeof payload?.phone_number === 'string'
        ? payload.phone_number
        : typeof payload?.contact === 'string'
          ? payload.contact
          : payload?.phone ?? payload?.phone_number ?? payload?.contact;

  if (!nomEntreprise) {
    throw createError('Le champ nom (ou nom_entreprise) est obligatoire', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const phone_e164 = normalizeToE164(
    typeof phoneRaw === 'string' ? phoneRaw : phoneRaw != null ? String(phoneRaw) : '',
  );

  const existing = await enterpriseRepository.findEnterpriseByPhoneE164(phone_e164);
  if (existing) {
    throw createError('Ce numéro est déjà enregistré', 409, 'PHONE_ALREADY_REGISTERED');
  }

  const rawApiKey = generateApiKey();
  const hashedApiKey = await bcrypt.hash(rawApiKey, 12);
  const encryptedApiKey = encryptApiKey(rawApiKey);
  const pin_hash = await bcrypt.hash(pin, 12);

  const enterprise = await enterpriseRepository.createEnterprise({
    company_id: randomUUID(),
    nom_entreprise: nomEntreprise,
    api_key: hashedApiKey,
    api_key_encrypted: encryptedApiKey,
    status: 'valider',
    phone_e164,
    pin_hash,
    token_version: 0,
  });

  const deviceMeta = payload.device_meta || {};
  await recordEnterpriseLogin(enterprise.company_id, deviceMeta);

  return {
    company: {
      company_id: enterprise.company_id,
      nom_entreprise: enterprise.nom_entreprise,
      status: enterprise.status,
      phone_e164: enterprise.phone_e164,
      role: ROLES.COMPANY,
    },
    api_key: rawApiKey,
    auth: {
      access_token: signCompanyAccessToken(enterprise.company_id, 0),
      refresh_token: signCompanyRefreshToken(enterprise.company_id, 0),
      token_type: 'Bearer',
    },
  };
}

async function recordEnterpriseLogin(companyId, deviceMeta) {
  await enterpriseRepository.createEnterpriseLoginHistory({
    history_id: randomUUID(),
    company_id: companyId,
    device_name: deviceMeta.device_name || null,
    user_agent: deviceMeta.user_agent || null,
  });
}

async function loginEnterprise(payload) {
  const pin = normalizePinInput(payload?.pin);
  const phoneRaw =
    typeof payload?.phone === 'string'
      ? payload.phone
      : typeof payload?.phone_number === 'string'
        ? payload.phone_number
        : typeof payload?.contact === 'string'
          ? payload.contact
          : payload?.phone ?? payload?.phone_number ?? payload?.contact;

  validatePin(pin);

  const phone_e164 = normalizeToE164(
    typeof phoneRaw === 'string' ? phoneRaw : phoneRaw != null ? String(phoneRaw) : '',
  );
  const enterprise = await enterpriseRepository.findEnterpriseByPhoneE164(phone_e164);

  if (
    !enterprise ||
    !enterprise.pin_hash ||
    (enterprise.status !== 'active' && enterprise.status !== 'valider')
  ) {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(pin, enterprise.pin_hash);
  if (!ok) {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  await recordEnterpriseLogin(enterprise.company_id, payload.device_meta || {});

  return {
    company: {
      company_id: enterprise.company_id,
      nom_entreprise: enterprise.nom_entreprise,
      status: enterprise.status,
      phone_e164: enterprise.phone_e164,
      role: ROLES.COMPANY,
    },
    auth: {
      access_token: signCompanyAccessToken(enterprise.company_id, enterprise.token_version),
      refresh_token: signCompanyRefreshToken(enterprise.company_id, enterprise.token_version),
      token_type: 'Bearer',
    },
  };
}

async function refreshEnterpriseToken(payload) {
  const refreshToken =
    typeof payload?.refresh_token === 'string' ? payload.refresh_token.trim() : '';

  if (!refreshToken) {
    throw createError('Le champ refresh_token est obligatoire', 400, 'INVALID_INPUT');
  }

  const tokenPayload = verifyCompanyRefreshToken(refreshToken);
  const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(tokenPayload.sub);
  if (
    !enterprise ||
    (enterprise.status !== 'active' && enterprise.status !== 'valider') ||
    !enterprise.pin_hash
  ) {
    throw createError('Entreprise introuvable ou inactive', 401, 'UNAUTHORIZED');
  }

  if (enterprise.token_version !== tokenPayload.tv) {
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }

  return {
    access_token: signCompanyAccessToken(enterprise.company_id, enterprise.token_version),
    refresh_token: signCompanyRefreshToken(enterprise.company_id, enterprise.token_version),
    token_type: 'Bearer',
  };
}

async function unlockEnterpriseSession(payload) {
  const pin = normalizePinInput(payload?.pin);
  const refreshToken =
    typeof payload?.refresh_token === 'string' ? payload.refresh_token.trim() : '';

  if (!refreshToken) {
    throw createError('Le champ refresh_token est obligatoire', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const tokenPayload = verifyCompanyRefreshToken(refreshToken);
  const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(tokenPayload.sub);

  if (
    !enterprise ||
    !enterprise.pin_hash ||
    (enterprise.status !== 'active' && enterprise.status !== 'valider')
  ) {
    throw createError('Session invalide', 401, 'INVALID_SESSION');
  }

  if (enterprise.token_version !== tokenPayload.tv) {
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }

  const ok = await bcrypt.compare(pin, enterprise.pin_hash);
  if (!ok) {
    throw createError('PIN incorrect', 401, 'INVALID_PIN');
  }

  await recordEnterpriseLogin(enterprise.company_id, payload.device_meta || {});

  return {
    auth: {
      access_token: signCompanyAccessToken(enterprise.company_id, enterprise.token_version),
      refresh_token: signCompanyRefreshToken(enterprise.company_id, enterprise.token_version),
      token_type: 'Bearer',
    },
  };
}

async function getEnterpriseProfile(companyId) {
  const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(companyId);
  if (!enterprise) {
    throw createError('Entreprise introuvable', 404, 'COMPANY_NOT_FOUND');
  }

  const [devices, linkedRows, historyRows] = await Promise.all([
    enterpriseRepository.listEnterpriseDevices(companyId),
    enterpriseRepository.findLinkedUsersForCompany(companyId),
    enterpriseRepository.listEnterpriseLoginHistory(companyId, LOGIN_HISTORY_PREVIEW),
  ]);

  const linked_users = linkedRows.map((row) => ({
    link_id: row.link_id,
    status: row.status,
    user: row.users
      ? {
          user_id: row.users.user_id,
          user_key: row.users.user_key,
          nom: row.users.nom,
          prenom: row.users.prenom,
          status: row.users.status,
        }
      : null,
  }));

  const login_history = historyRows.map((h) => ({
    history_id: h.history_id,
    label: formatLoginHistoryLabel(h.device_name, h.connected_at),
    device_name: h.device_name,
    connected_at: h.connected_at,
  }));

  return {
    company_id: enterprise.company_id,
    nom_entreprise: enterprise.nom_entreprise,
    status: enterprise.status,
    phone_e164: enterprise.phone_e164,
    email: enterprise.email,
    email_verified: Boolean(enterprise.email_verified_at),
    role: ROLES.COMPANY,
    devices,
    linked_users,
    login_history,
  };
}

async function updateEnterpriseAccount(payload) {
  const companyId =
    typeof payload?.company_id === 'string' ? payload.company_id.trim() : '';
  const nom_entreprise =
    typeof payload?.nom_entreprise === 'string' ? payload.nom_entreprise.trim() : '';
  const nom = typeof payload?.nom === 'string' ? payload.nom.trim() : '';
  const pin = normalizePinInput(payload?.pin);
  const phoneRaw =
    payload?.phone !== undefined
      ? payload.phone
      : payload?.phone_number !== undefined
        ? payload.phone_number
        : undefined;

  if (!companyId) {
    throw createError('company_id manquant', 400, 'INVALID_INPUT');
  }

  if (payload?.email !== undefined || payload?.recovery_email !== undefined) {
    throw createError(
      "L'email de récupération ne peut pas être modifié via cette route",
      400,
      'EMAIL_NOT_EDITABLE',
    );
  }

  const data = {};
  const name = nom_entreprise || nom;
  if (name) {
    data.nom_entreprise = name;
  }
  if (pin) {
    validatePin(pin);
    data.pin_hash = await bcrypt.hash(pin, 12);
  }

  if (phoneRaw !== undefined && phoneRaw !== null && String(phoneRaw).trim() !== '') {
    const phone_e164 = normalizeToE164(String(phoneRaw));
    const conflict = await enterpriseRepository.findAnotherEnterpriseByPhoneE164(
      phone_e164,
      companyId,
    );
    if (conflict) {
      throw createError('Ce numéro de téléphone est déjà utilisé', 409, 'PHONE_ALREADY_REGISTERED');
    }
    data.phone_e164 = phone_e164;
  }

  if (Object.keys(data).length === 0) {
    throw createError('Aucune modification demandée', 400, 'INVALID_INPUT');
  }

  try {
    return await enterpriseRepository.updateEnterpriseById(companyId, data);
  } catch {
    throw createError('Entreprise introuvable', 404, 'COMPANY_NOT_FOUND');
  }
}

async function deleteEnterpriseAccount(payload) {
  const companyId =
    typeof payload?.company_id === 'string' ? payload.company_id.trim() : '';
  const pin = normalizePinInput(payload?.pin);

  if (!companyId) {
    throw createError('company_id manquant', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(companyId);
  if (!enterprise || !enterprise.pin_hash) {
    throw createError('Entreprise introuvable', 404, 'COMPANY_NOT_FOUND');
  }

  const ok = await bcrypt.compare(pin, enterprise.pin_hash);
  if (!ok) {
    throw createError('PIN incorrect', 401, 'INVALID_PIN');
  }

  await enterpriseRepository.softDeleteEnterprise(companyId);

  return {
    message: 'Compte entreprise désactivé. Les liaisons actives ont été révoquées.',
    company_id: companyId,
    deleted: true,
  };
}

async function logoutEnterprise(companyId) {
  await enterpriseRepository.updateEnterpriseTokenVersion(companyId);
  return { message: 'Déconnexion réussie' };
}

async function registerEnterpriseDevice(payload) {
  const companyId =
    typeof payload?.company_id === 'string' ? payload.company_id.trim() : '';
  const fingerprint =
    typeof payload?.device_fingerprint === 'string' ? payload.device_fingerprint.trim() : '';

  if (!companyId || !fingerprint) {
    throw createError('company_id et device_fingerprint sont obligatoires', 400, 'INVALID_INPUT');
  }

  const now = new Date();
  return enterpriseRepository.upsertEnterpriseDevice({
    device_id: randomUUID(),
    company_id: companyId,
    device_fingerprint: fingerprint,
    trusted: false,
    device_name: payload.device_name || null,
    user_agent: payload.user_agent || null,
    last_seen_at: now,
  });
}

async function listEnterpriseLoginHistory(companyId, { page = 1, limit = LOGIN_HISTORY_DEFAULT_LIMIT } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(
    LOGIN_HISTORY_MAX_LIMIT,
    Math.max(1, Number.parseInt(limit, 10) || LOGIN_HISTORY_DEFAULT_LIMIT),
  );
  const offset = (safePage - 1) * safeLimit;
  const rows = await enterpriseRepository.listEnterpriseLoginHistory(companyId, safeLimit, offset);
  return {
    page: safePage,
    limit: safeLimit,
    items: rows.map((h) => ({
      history_id: h.history_id,
      label: formatLoginHistoryLabel(h.device_name, h.connected_at),
      device_name: h.device_name,
      connected_at: h.connected_at,
    })),
  };
}

async function setEnterpriseRecoveryEmail(payload) {
  const companyId =
    typeof payload?.company_id === 'string' ? payload.company_id.trim() : '';
  const emailRaw = typeof payload?.email === 'string' ? payload.email : '';

  if (!companyId) {
    throw createError('company_id manquant', 401, 'UNAUTHORIZED');
  }

  const email = normalizeEmail(emailRaw);
  if (!email) {
    throw createError('Email invalide', 400, 'INVALID_EMAIL');
  }

  // L'email de récupération ne peut être défini qu'une seule fois.
  const current = await enterpriseRepository.findEnterpriseByIdForAuth(companyId);
  if (current?.email) {
    throw createError(
      "L'email de récupération est déjà défini et ne peut plus être modifié",
      409,
      'RECOVERY_EMAIL_ALREADY_SET',
    );
  }

  const other = await enterpriseRepository.findEnterpriseByEmailExcluding(email, companyId);
  if (other) {
    throw createError('Cet email est déjà utilisé', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  await enterpriseRepository.updateEnterpriseById(companyId, {
    email,
    email_verified_at: null,
  });

  const token = signEnterpriseEmailVerificationToken(companyId, email);
  const verifyUrl = buildEnterpriseVerifyEmailUrl(token);
  await sendEmailVerification({ to: email, verifyUrl });

  return {
    message:
      'Un email de vérification a été envoyé (simulation en développement : voir les logs serveur).',
    email,
    email_verified: false,
  };
}

async function verifyEnterpriseRecoveryEmail(payload) {
  const token =
    typeof payload?.token === 'string' ? payload.token.trim() : '';

  if (!token) {
    throw createError('Le champ token est obligatoire', 400, 'INVALID_INPUT');
  }

  const decoded = verifyEnterpriseEmailVerificationToken(token);
  const enterprise = await enterpriseRepository.findEnterpriseByIdForAuth(decoded.sub);

  if (!enterprise || (enterprise.status !== 'active' && enterprise.status !== 'valider')) {
    throw createError('Entreprise introuvable', 404, 'COMPANY_NOT_FOUND');
  }

  const tokenEmail = normalizeEmail(decoded.email);
  if (!enterprise.email || normalizeEmail(enterprise.email) !== tokenEmail) {
    throw createError('Token incompatible avec le compte', 400, 'EMAIL_TOKEN_MISMATCH');
  }

  if (enterprise.email_verified_at) {
    return {
      message: 'Cet email est déjà vérifié.',
      email: enterprise.email,
      email_verified: true,
    };
  }

  await enterpriseRepository.updateEnterpriseById(enterprise.company_id, {
    email_verified_at: new Date(),
  });

  return {
    message:
      'Email vérifié. Vous pouvez utiliser la réinitialisation du PIN entreprise si besoin.',
    email: enterprise.email,
    email_verified: true,
  };
}

async function getApiKey(companyId) {
  if (!companyId) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }
  const row = await enterpriseRepository.findEncryptedApiKey(companyId);
  if (!row) {
    throw createError('Entreprise introuvable', 404, 'ENTERPRISE_NOT_FOUND');
  }
  if (!row.api_key_encrypted) {
    throw createError(
      'Clé API non récupérable (compte antérieur à cette fonctionnalité). Utilisez POST /api/enterprises/me/api-key/rotate pour obtenir une nouvelle clé.',
      410,
      'API_KEY_NOT_RETRIEVABLE',
    );
  }
  const plain = decryptApiKey(row.api_key_encrypted);
  if (!plain) {
    throw createError('Impossible de déchiffrer la clé API', 500, 'INTERNAL_ERROR');
  }
  return { api_key: plain };
}

async function rotateApiKeyService(companyId) {
  if (!companyId) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }
  const newKey = generateApiKey();
  const api_key = await bcrypt.hash(newKey, 12);
  const api_key_encrypted = encryptApiKey(newKey);
  await enterpriseRepository.rotateApiKey(companyId, { api_key, api_key_encrypted });
  return { api_key: newKey };
}

module.exports = {
  registerEnterprise,
  loginEnterprise,
  refreshEnterpriseToken,
  unlockEnterpriseSession,
  getEnterpriseProfile,
  updateEnterpriseAccount,
  deleteEnterpriseAccount,
  logoutEnterprise,
  registerEnterpriseDevice,
  listEnterpriseLoginHistory,
  setEnterpriseRecoveryEmail,
  verifyEnterpriseRecoveryEmail,
};
