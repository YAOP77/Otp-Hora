const jwt = require('jsonwebtoken');
const { createError } = require('./errors');
const { env } = require('../config/env');

function signUserAccessToken(userId) {
  return jwt.sign({ sub: userId, type: 'access' }, env.userAccessTokenSecret, {
    expiresIn: env.userAccessTokenTtl,
  });
}

function signUserRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.userRefreshTokenSecret, {
    expiresIn: env.userRefreshTokenTtl,
  });
}

function verifyUserRefreshToken(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, env.userRefreshTokenSecret);
    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      throw createError('Refresh token invalide', 401, 'INVALID_REFRESH_TOKEN');
    }
    return payload;
  } catch {
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }
}

function requireUserAccessToken(req, _res, next) {
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
    if (!payload || payload.type !== 'access' || !payload.sub) {
      return next(createError('Token invalide', 401, 'INVALID_TOKEN'));
    }

    req.userAuth = {
      user_id: payload.sub,
    };
    return next();
  } catch {
    return next(createError('Token invalide ou expiré', 401, 'INVALID_TOKEN'));
  }
}

module.exports = {
  signUserAccessToken,
  signUserRefreshToken,
  verifyUserRefreshToken,
  requireUserAccessToken,
};
