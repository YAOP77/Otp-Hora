const { Router } = require('express');
const enterpriseController = require('./enterprise.controller');

const router = Router();

router.post('/enterprises', enterpriseController.createEnterprise);

module.exports = {
  enterpriseRouter: router,
};
