const { Router } = require('express');
const usersController = require('./users.controller');
const { requireUserAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/users', usersController.createUser);
router.post('/users/login', usersController.loginUser);
router.post('/users/refresh-token', usersController.refreshUserToken);
router.post('/users/logout', requireUserAccessToken, usersController.logoutUser);
router.get('/users/:user_id', requireUserAccessToken, usersController.getUserProfile);
router.patch('/users/:user_id', requireUserAccessToken, usersController.updateUser);
router.delete('/users/:user_id', requireUserAccessToken, usersController.deleteUser);

module.exports = {
  usersRouter: router,
};
