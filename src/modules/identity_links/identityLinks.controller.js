const identityLinksService = require('./identityLinks.service');

async function requestLink(req, res, next) {
  try {
    const link = await identityLinksService.requestLinkByUserKey({
      company_id: req.enterprise?.company_id,
      user_key: req.body?.user_key,
    });
    return res.status(link.status === 'pending' ? 201 : 200).json({ data: link });
  } catch (error) {
    return next(error);
  }
}

async function getLinkStatus(req, res, next) {
  try {
    const link = await identityLinksService.getLinkStatus({
      company_id: req.enterprise?.company_id,
      link_id: req.params?.link_id,
    });
    return res.status(200).json({ data: link });
  } catch (error) {
    return next(error);
  }
}

async function getPublicLinkInfo(req, res, next) {
  try {
    const info = await identityLinksService.getPublicLinkInfo({
      link_id: req.params?.link_id,
    });
    return res.status(200).json({ data: info });
  } catch (error) {
    return next(error);
  }
}

async function listCompanyLinks(req, res, next) {
  try {
    const links = await identityLinksService.listCompanyLinks({
      company_id: req.enterprise?.company_id,
      status: req.query?.status,
    });
    return res.status(200).json({ data: links });
  } catch (error) {
    return next(error);
  }
}

async function listMyLinks(req, res, next) {
  try {
    const links = await identityLinksService.listMyLinks({
      requester_user_id: req.userAuth?.user_id,
      status: req.query?.status,
    });
    return res.status(200).json({ data: links });
  } catch (error) {
    return next(error);
  }
}

async function approveLink(req, res, next) {
  try {
    const link = await identityLinksService.approveLink({
      requester_user_id: req.userAuth?.user_id,
      link_id: req.params?.link_id,
    });
    return res.status(200).json({ data: link });
  } catch (error) {
    return next(error);
  }
}

async function rejectLink(req, res, next) {
  try {
    const link = await identityLinksService.rejectLink({
      requester_user_id: req.userAuth?.user_id,
      link_id: req.params?.link_id,
    });
    return res.status(200).json({ data: link });
  } catch (error) {
    return next(error);
  }
}

async function deleteMyLink(req, res, next) {
  try {
    const result = await identityLinksService.deleteMyLink({
      requester_user_id: req.userAuth?.user_id,
      link_id: req.params?.link_id,
    });
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requestLink,
  getLinkStatus,
  getPublicLinkInfo,
  listCompanyLinks,
  listMyLinks,
  approveLink,
  rejectLink,
  deleteMyLink,
};
