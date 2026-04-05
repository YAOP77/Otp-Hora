const enterpriseService = require('./enterprise.service');
const { getDeviceMeta } = require('../../common/requestDeviceMeta');

async function createEnterprise(req, res, next) {
  try {
    const enterprise = await enterpriseService.createEnterprise({
      nom_entreprise: req.body?.nom_entreprise,
    });

    return res.status(201).json({
      data: enterprise,
    });
  } catch (error) {
    return next(error);
  }
}

async function registerEnterprise(req, res, next) {
  try {
    const meta = getDeviceMeta(req, req.body);
    const result = await enterpriseService.registerEnterprise({
      nom: req.body?.nom,
      nom_entreprise: req.body?.nom_entreprise,
      phone: req.body?.phone,
      phone_number: req.body?.phone_number,
      pin: req.body?.pin,
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
      pin: req.body?.pin,
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
      pin: req.body?.pin,
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
      pin: req.body?.pin,
    });
    return res.status(200).json({ data: updated });
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
  createEnterprise,
  registerEnterprise,
  loginEnterprise,
  refreshEnterpriseToken,
  unlockEnterpriseSession,
  getEnterpriseMe,
  patchEnterpriseMe,
  logoutEnterprise,
  listEnterpriseDevices,
  registerEnterpriseDevice,
  listEnterpriseLinkedUsers,
  listEnterpriseLoginHistory,
};
