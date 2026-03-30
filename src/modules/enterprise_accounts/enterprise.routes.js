const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const enterpriseController = require('./enterprise.controller');

const router = Router();

router.post('/enterprises', requireEnterpriseApiKey, enterpriseController.createEnterprise);

module.exports = {
  enterpriseRouter: router,
};
