const { Router } = require('express');
const usersController = require('./users.controller');
const { requireUserAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/users', usersController.createUser);
router.post('/users/refresh-token', usersController.refreshUserToken);
router.get('/users/:user_id', requireUserAccessToken, usersController.getUserProfile);

module.exports = {
  usersRouter: router,
};
