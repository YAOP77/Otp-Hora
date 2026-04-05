const userDevicesService = require('./userDevices.service');
const { getDeviceMeta } = require('../../common/requestDeviceMeta');

async function registerDevice(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const device = await userDevicesService.registerDevice({
      user_id: req.userAuth?.user_id,
      device_fingerprint: req.body?.device_fingerprint,
      device_name: meta.device_name,
      user_agent: meta.user_agent,
    });

    return res.status(201).json({
      data: device,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerDevice,
};
