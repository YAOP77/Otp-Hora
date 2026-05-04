const { Router } = require('express');
const userDevicesController = require('./userDevices.controller');
const { requireUserAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/devices', requireUserAccessToken, userDevicesController.registerDevice);

module.exports = {
  userDevicesRouter: router,
};
