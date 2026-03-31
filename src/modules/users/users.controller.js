const usersService = require('./users.service');

async function createUser(req, res, next) {
  try {
    const result = await usersService.createUser({
      nom: req.body?.nom,
      prenom: req.body?.prenom,
      pin: req.body?.pin,
    });
    return res.status(201).json({
      data: result.user,
      auth: result.auth,
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

module.exports = {
  createUser,
  getUserProfile,
  refreshUserToken,
};