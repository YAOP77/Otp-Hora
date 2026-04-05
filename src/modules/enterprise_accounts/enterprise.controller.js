const enterpriseService = require('./enterprise.service');
const { getDeviceMeta } = require('../../common/requestDeviceMeta');
const {
  validate,
  enterpriseDeleteSchema,
  recoveryEmailSchema,
  emailVerifySchema,
} = require('../../common/validators');
const { pinFromBody } = require('../../common/pinInput');

async function registerEnterprise(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await enterpriseService.registerEnterprise({
      nom: req.body?.nom,
      nom_entreprise: req.body?.nom_entreprise,
      phone: req.body?.phone,
      phone_number: req.body?.phone_number,
      contact: req.body?.contact,
      pin: pinFromBody(req.body),
      device_meta: meta,
    });
    return res.status(201).json({
      data: result.company,
      api_key: result.api_key,
      auth: result.auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function loginEnterprise(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await enterpriseService.loginEnterprise({
      phone: req.body?.phone,
      phone_number: req.body?.phone_number,
      contact: req.body?.contact,
      pin: pinFromBody(req.body),
      device_meta: meta,
    });
    return res.status(200).json({
      data: result.company,
      auth: result.auth,
    });
  } catch (error) {
    return next(error);
  }
}

async function refreshEnterpriseToken(req, res, next) {
  try {
    const auth = await enterpriseService.refreshEnterpriseToken({
      refresh_token: req.body?.refresh_token,
    });
    return res.status(200).json({ data: auth });
  } catch (error) {
    return next(error);
  }
}

async function unlockEnterpriseSession(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await enterpriseService.unlockEnterpriseSession({
      pin: pinFromBody(req.body),
      refresh_token: req.body?.refresh_token,
      device_meta: meta,
    });
    return res.status(200).json({ data: result.auth });
  } catch (error) {
    return next(error);
  }
}

async function getEnterpriseMe(req, res, next) {
  try {
    const profile = await enterpriseService.getEnterpriseProfile(req.companyAuth.company_id);
    return res.status(200).json({ data: profile });
  } catch (error) {
    return next(error);
  }
}

async function patchEnterpriseMe(req, res, next) {
  try {
    const updated = await enterpriseService.updateEnterpriseAccount({
      company_id: req.companyAuth.company_id,
      nom_entreprise: req.body?.nom_entreprise ?? req.body?.nom,
      phone: req.body?.phone,
      phone_number: req.body?.phone_number,
      pin: pinFromBody(req.body),
      email: req.body?.email,
      recovery_email: req.body?.recovery_email,
    });
    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
}

async function setEnterpriseRecoveryEmail(req, res, next) {
  try {
    const body = validate(recoveryEmailSchema, req.body);
    const data = await enterpriseService.setEnterpriseRecoveryEmail({
      company_id: req.companyAuth.company_id,
      email: body.email,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function verifyEnterpriseEmail(req, res, next) {
  try {
    const body = validate(emailVerifySchema, req.body);
    const data = await enterpriseService.verifyEnterpriseRecoveryEmail({ token: body.token });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function deleteEnterpriseMe(req, res, next) {
  try {
    const body = validate(enterpriseDeleteSchema, req.body);
    const data = await enterpriseService.deleteEnterpriseAccount({
      company_id: req.companyAuth.company_id,
      pin: body.pin,
    });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

async function logoutEnterprise(req, res, next) {
  try {
    const result = await enterpriseService.logoutEnterprise(req.companyAuth.company_id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

async function listEnterpriseDevices(req, res, next) {
  try {
    const profile = await enterpriseService.getEnterpriseProfile(req.companyAuth.company_id);
    return res.status(200).json({ data: { devices: profile.devices } });
  } catch (error) {
    return next(error);
  }
}

async function registerEnterpriseDevice(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const device = await enterpriseService.registerEnterpriseDevice({
      company_id: req.companyAuth.company_id,
      device_fingerprint: req.body?.device_fingerprint,
      device_name: meta.device_name,
      user_agent: meta.user_agent,
    });
    return res.status(201).json({ data: device });
  } catch (error) {
    return next(error);
  }
}

async function listEnterpriseLinkedUsers(req, res, next) {
  try {
    const profile = await enterpriseService.getEnterpriseProfile(req.companyAuth.company_id);
    return res.status(200).json({ data: { linked_users: profile.linked_users } });
  } catch (error) {
    return next(error);
  }
}

async function listEnterpriseLoginHistory(req, res, next) {
  try {
    const rows = await enterpriseService.listEnterpriseLoginHistory(
      req.companyAuth.company_id,
    );
    return res.status(200).json({ data: { login_history: rows } });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerEnterprise,
  loginEnterprise,
  refreshEnterpriseToken,
  unlockEnterpriseSession,
  getEnterpriseMe,
  patchEnterpriseMe,
  setEnterpriseRecoveryEmail,
  verifyEnterpriseEmail,
  deleteEnterpriseMe,
  logoutEnterprise,
  listEnterpriseDevices,
  registerEnterpriseDevice,
  listEnterpriseLinkedUsers,
  listEnterpriseLoginHistory,
};
