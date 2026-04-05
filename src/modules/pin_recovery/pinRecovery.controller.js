const pinRecoveryService = require('./pinRecovery.service');
const enterprisePinRecoveryService = require('./enterprisePinRecovery.service');
const { pinFromBody } = require('../../common/pinInput');
const {
  validate,
  pinRecoveryRequestSchema,
  pinRecoveryConfirmSchema,
} = require('../../common/validators');

async function requestPinReset(req, res, next) {
  try {
    const body = validate(pinRecoveryRequestSchema, req.body);
    const data = await pinRecoveryService.requestPinReset(body);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function confirmPinReset(req, res, next) {
  try {
    const body = validate(pinRecoveryConfirmSchema, req.body);
    const data = await pinRecoveryService.confirmPinReset(body);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function requestEnterprisePinReset(req, res, next) {
  try {
    const body = validate(pinRecoveryRequestSchema, req.body);
    const data = await enterprisePinRecoveryService.requestEnterprisePinReset(body);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function confirmEnterprisePinReset(req, res, next) {
  try {
    const body = validate(pinRecoveryConfirmSchema, {
      token: req.body?.token,
      pin: pinFromBody(req.body),
    });
    const data = await enterprisePinRecoveryService.confirmEnterprisePinReset(body);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requestPinReset,
  confirmPinReset,
  requestEnterprisePinReset,
  confirmEnterprisePinReset,
};
