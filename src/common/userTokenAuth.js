const jwt = require('jsonwebtoken');
const { createError } = require('./errors');
const { env } = require('../config/env');
const { prisma } = require('../config/prisma');
const { ROLES } = require('./phone');

function signUserAccessToken(userId, tokenVersion) {
  return jwt.sign(
    { sub: userId, type: 'access', tv: tokenVersion, role: ROLES.USER },
    env.userAccessTokenSecret,
    { expiresIn: env.userAccessTokenTtl },
  );
}

function signUserRefreshToken(userId, tokenVersion) {
  return jwt.sign(
    { sub: userId, type: 'refresh', tv: tokenVersion, role: ROLES.USER },
    env.userRefreshTokenSecret,
    { expiresIn: env.userRefreshTokenTtl },
  );
}

function signCompanyAccessToken(companyId, tokenVersion) {
  return jwt.sign(
    { sub: companyId, type: 'access', tv: tokenVersion, role: ROLES.COMPANY },
    env.userAccessTokenSecret,
    { expiresIn: env.userAccessTokenTtl },
  );
}

function signCompanyRefreshToken(companyId, tokenVersion) {
  return jwt.sign(
    { sub: companyId, type: 'refresh', tv: tokenVersion, role: ROLES.COMPANY },
    env.userRefreshTokenSecret,
    { expiresIn: env.userRefreshTokenTtl },
  );
}

function verifyUserRefreshToken(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.userRefreshTokenSecret);
    if (!payload || payload.type !== 'refresh' || !payload.sub || payload.tv === undefined) {
      throw createError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }
    const role = payload.role || ROLES.USER;
    if (role !== ROLES.USER) {
      throw createError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }
    return payload;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }
}

function verifyCompanyRefreshToken(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.userRefreshTokenSecret);
    if (!payload || payload.type !== 'refresh' || !payload.sub || payload.tv === undefined) {
      throw createError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }
    if (payload.role !== ROLES.COMPANY) {
      throw createError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }
    return payload;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }
}

async function requireUserAccessToken(req, _res, next) {
  try {
    const authHeader = req.header('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next(createError('Authorization Bearer token est obligatoire', 401, 'MISSING_TOKEN'));
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return next(createError('Authorization Bearer token est obligatoire', 401, 'MISSING_TOKEN'));
    }

    const payload = jwt.verify(token, env.userAccessTokenSecret);
    const role = payload.role || ROLES.USER;
    if (!payload || payload.type !== 'access' || !payload.sub || payload.tv === undefined) {
      return next(createError('Token invalide', 401, 'INVALID_TOKEN'));
    }
    if (role !== ROLES.USER) {
      return next(createError('Token invalide', 401, 'INVALID_TOKEN'));
    }

    const user = await prisma.users.findUnique({
      where: { user_id: payload.sub },
      select: {
        user_id: true,
        status: true,
        token_version: true,
      },
    });

    if (!user || user.status !== 'active' || user.token_version !== payload.tv) {
      return next(createError('Token invalide ou expiré', 401, 'INVALID_TOKEN'));
    }

    req.userAuth = {
      user_id: payload.sub,
      token_version: payload.tv,
      role: ROLES.USER,
    };
    return next();
  } catch {
    return next(createError('Token invalide ou expiré', 401, 'INVALID_TOKEN'));
  }
}

async function requireCompanyAccessToken(req, _res, next) {
  try {
    const authHeader = req.header('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next(createError('Authorization Bearer token est obligatoire', 401, 'MISSING_TOKEN'));
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return next(createError('Authorization Bearer token est obligatoire', 401, 'MISSING_TOKEN'));
    }

    const payload = jwt.verify(token, env.userAccessTokenSecret);
    if (
      !payload ||
      payload.type !== 'access' ||
      !payload.sub ||
      payload.tv === undefined ||
      payload.role !== ROLES.COMPANY
    ) {
      return next(createError('Token invalide', 401, 'INVALID_TOKEN'));
    }

    const enterprise = await prisma.enterprise_accounts.findUnique({
      where: { company_id: payload.sub },
      select: {
        company_id: true,
        nom_entreprise: true,
        status: true,
        token_version: true,
      },
    });

    if (
      !enterprise ||
      (enterprise.status !== 'active' && enterprise.status !== 'valider') ||
      enterprise.token_version !== payload.tv
    ) {
      return next(createError('Token invalide ou expiré', 401, 'INVALID_TOKEN'));
    }

    req.companyAuth = {
      company_id: payload.sub,
      token_version: payload.tv,
      role: ROLES.COMPANY,
      nom_entreprise: enterprise.nom_entreprise,
      status: enterprise.status,
    };
    return next();
  } catch {
    return next(createError('Token invalide ou expiré', 401, 'INVALID_TOKEN'));
  }
}

module.exports = {
  signUserAccessToken,
  signUserRefreshToken,
  signCompanyAccessToken,
  signCompanyRefreshToken,
  verifyUserRefreshToken,
  verifyCompanyRefreshToken,
  requireUserAccessToken,
  requireCompanyAccessToken,
};
