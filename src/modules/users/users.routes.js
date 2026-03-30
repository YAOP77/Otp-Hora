const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const usersController = require('./users.controller');

const router = Router();

router.post('/users', requireEnterpriseApiKey, usersController.createUser);

module.exports = {
  usersRouter: router,
};
