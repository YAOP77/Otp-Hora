const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const recoveryController = require('./recovery.controller');

const router = Router();

router.post('/recovery', requireEnterpriseApiKey, recoveryController.createRecoveryMethod);

module.exports = {
  recoveryRouter: router,
};
