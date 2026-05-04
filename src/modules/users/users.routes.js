const { Router } = require('express');
const usersController = require('./users.controller');
const { requireUserAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/users', usersController.createUser);
router.post('/users/login', usersController.loginUser);
router.post('/users/session/unlock', usersController.unlockUserSession);
router.post('/users/refresh-token', usersController.refreshUserToken);
router.put(
  '/users/me/recovery-email',
  requireUserAccessToken,
  usersController.setRecoveryEmail,
);
router.post('/users/email/verify', usersController.verifyRecoveryEmail);
router.get('/users/me', requireUserAccessToken, usersController.getMe);
router.get('/users/me/login-history', requireUserAccessToken, usersController.listUserLoginHistory);
router.get('/users/me/user-key', requireUserAccessToken, usersController.getUserKey);
router.post('/users/logout', requireUserAccessToken, usersController.logoutUser);
router.get('/users/:user_id', requireUserAccessToken, usersController.getUserProfile);
router.patch('/users/:user_id', requireUserAccessToken, usersController.updateUser);
router.delete('/users/:user_id', requireUserAccessToken, usersController.deleteUser);

// Nouvelles routes de sécurité
router.post('/users/pin-recovery/questions', usersController.getSecurityQuestions);
router.post('/users/pin-recovery/confirm', usersController.verifySecurityQuestions);
router.post('/users/me/devices/:device_id/deactivate', requireUserAccessToken, usersController.deactivateDevice);

module.exports = {
  usersRouter: router,
};
