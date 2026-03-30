const userDevicesService = require('./userDevices.service');

async function createDevice(req, res, next) {
  try {
    const device = await userDevicesService.createDevice({
      user_id: req.body?.user_id,
      device_fingerprint: req.body?.device_fingerprint,
    });

    return res.status(201).json({
      data: device,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createDevice,
};
