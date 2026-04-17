const authRequestsService = require('./authRequests.service');

async function createAuthRequest(req, res, next) {
  try {
    const authRequest = await authRequestsService.createAuthRequest({
      company_id: req.enterprise?.company_id,
      id_user: req.body?.id_user,
      status: req.body?.status,
    });

    return res.status(201).json({
      data: authRequest,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAuthRequestStatus(req, res, next) {
  try {
    const authRequest = await authRequestsService.getAuthRequestStatus({
      company_id: req.enterprise?.company_id,
      id_user: req.body?.id_user,
      request_id: req.params?.request_id,
    });

    return res.status(200).json({
      data: authRequest,
    });
  } catch (error) {
    return next(error);
  }
}

async function approveRequest(req, res, next) {
  try {
    const authRequest = await authRequestsService.approveRequest({
      user_id: req.body?.user_id,
      requester_user_id: req.userAuth?.user_id,
      request_id: req.params?.request_id,
    });

    return res.status(200).json({
      data: authRequest,
    });
  } catch (error) {
    return next(error);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const authRequest = await authRequestsService.rejectRequest({
      user_id: req.body?.user_id,
      requester_user_id: req.userAuth?.user_id,
      request_id: req.params?.request_id,
    });

    return res.status(200).json({
      data: authRequest,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAuthRequest,
  getAuthRequestStatus,
  approveRequest,
  rejectRequest,
};
