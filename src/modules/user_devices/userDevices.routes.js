const { Router } = require('express');
const userDevicesController = require('./userDevices.controller');

const router = Router();

router.post('/devices', userDevicesController.createDevice);

module.exports = {
  userDevicesRouter: router,
};
