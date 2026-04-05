const usersService = require('./users.service');
const { getDeviceMeta } = require('../../common/requestDeviceMeta');

async function createUser(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await usersService.createUser({
      nom: req.body?.nom,
      prenom: req.body?.prenom,
      pin: req.body?.pin,
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
      pin: req.body?.pin ?? req.body?.PIN ?? req.body?.code_pin,
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
      pin: req.body?.pin ?? req.body?.PIN ?? req.body?.code_pin,
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
    const user = await usersService.updateUser({
      user_id: req.params?.user_id,
      requester_user_id: req.userAuth?.user_id,
      nom: req.body?.nom,
      pin: req.body?.pin,
    });
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

async function listUserLoginHistory(req, res, next) {
  try {
    const rows = await usersService.listUserLoginHistory(req.userAuth.user_id);
    return res.status(200).json({
      data: { login_history: rows },
    });
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
};
