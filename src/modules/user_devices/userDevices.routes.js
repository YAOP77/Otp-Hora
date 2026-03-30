const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const userDevicesController = require('./userDevices.controller');

const router = Router();

router.post('/devices', requireEnterpriseApiKey, userDevicesController.createDevice);

module.exports = {
  userDevicesRouter: router,
};
