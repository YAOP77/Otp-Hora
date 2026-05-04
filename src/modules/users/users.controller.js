const usersService = require('./users.service');
const { getDeviceMeta } = require('../../common/requestDeviceMeta');
const {
  validate,
  recoveryEmailSchema,
  emailVerifySchema,
} = require('../../common/validators');
const { pinFromBody } = require('../../common/pinInput');

async function createUser(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await usersService.createUser({
      nom: req.body?.nom,
      prenom: req.body?.prenom,
      username: req.body?.username,
      pin: pinFromBody(req.body),
      pin_confirmation: req.body?.pin_confirmation || req.body?.confirmation_pin,
      security_questions: req.body?.security_questions,
      device_meta: meta,
    });
    return res.status(201).json({
      data: result.user,
      auth: result.auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function loginUser(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await usersService.loginUser({
      phone_number: req.body?.phone_number ?? req.body?.phone ?? req.body?.contact,
      pin: pinFromBody(req.body),
      device_meta: meta,
    });
    return res.status(200).json({
      data: result.user,
      auth: result.auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function unlockUserSession(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await usersService.unlockUserSession({
      pin: pinFromBody(req.body),
      refresh_token: req.body?.refresh_token,
      device_meta: meta,
    });
    return res.status(200).json({
      data: result.auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function getUserProfile(req, res, next) {
  try {
    const user = await usersService.getUserProfile({
      user_id: req.params?.user_id,
      include_pin_hash: req.query?.include_pin_hash === 'true',
      requester_user_id: req.userAuth?.user_id,
    });
    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.userAuth?.user_id;
    const user = await usersService.getUserProfile({
      user_id: userId,
      requester_user_id: userId,
    });
    return res.status(200).json({ data: user });
  } catch (error) {
    return next(error);
  }
}

async function refreshUserToken(req, res, next) {
  try {
    const auth = await usersService.refreshUserToken({
      refresh_token: req.body?.refresh_token,
    });
    return res.status(200).json({
      data: auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function logoutUser(req, res, next) {
  try {
    const result = await usersService.logoutUser({
      requester_user_id: req.userAuth?.user_id,
    });
    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const body = req.body || {};
    const patch = {
      user_id: req.params?.user_id,
      requester_user_id: req.userAuth?.user_id,
      nom: body.nom,
      prenom: body.prenom,
      pin: pinFromBody(body),
      email: body.email,
      recovery_email: body.recovery_email,
    };
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      patch.username = body.username;
    }
    const user = await usersService.updateUser(patch);
    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await usersService.deleteUser({
      user_id: req.params?.user_id,
      requester_user_id: req.userAuth?.user_id,
    });
    return res.status(200).json({
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getUserKey(req, res, next) {
  try {
    const data = await usersService.getUserKey(req.userAuth.user_id);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function listUserLoginHistory(req, res, next) {
  try {
    const result = await usersService.listUserLoginHistory(req.userAuth.user_id, {
      page: req.query?.page,
      limit: req.query?.limit,
    });
    return res.status(200).json({
      data: {
        page: result.page,
        limit: result.limit,
        login_history: result.items,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function setRecoveryEmail(req, res, next) {
  try {
    const body = validate(recoveryEmailSchema, req.body);
    const data = await usersService.setRecoveryEmail({
      requester_user_id: req.userAuth.user_id,
      email: body.email,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function verifyRecoveryEmail(req, res, next) {
  try {
    const body = validate(emailVerifySchema, req.body);
    const data = await usersService.verifyRecoveryEmail({ token: body.token });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function getSecurityQuestions(req, res, next) {
  try {
    const data = await usersService.getSecurityQuestionsForRecovery({
      phone_number: req.body?.phone_number || req.query?.phone_number,
      phone: req.body?.phone || req.query?.phone,
      contact: req.body?.contact || req.query?.contact,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function verifySecurityQuestions(req, res, next) {
  try {
    const data = await usersService.verifySecurityQuestionsAndResetPin({
      user_id: req.body?.user_id,
      answers: req.body?.answers,
      pin: pinFromBody(req.body),
      pin_confirmation: req.body?.pin_confirmation || req.body?.confirmation_pin,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function deactivateDevice(req, res, next) {
  try {
    const data = await usersService.deactivateUserDevice({
      requester_user_id: req.userAuth?.user_id,
      device_id: req.params?.device_id || req.body?.device_id,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
  loginUser,
  unlockUserSession,
  getUserProfile,
  refreshUserToken,
  logoutUser,
  updateUser,
  deleteUser,
  listUserLoginHistory,
  getUserKey,
  getMe,
  setRecoveryEmail,
  verifyRecoveryEmail,
  getSecurityQuestions,
  verifySecurityQuestions,
  deactivateDevice,
};
