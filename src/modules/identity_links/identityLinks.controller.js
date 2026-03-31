const identityLinksService = require('./identityLinks.service');

async function requestIdentityLink(req, res, next) {
  try {
    const link = await identityLinksService.requestIdentityLink({
      company_id: req.enterprise?.company_id,
      external_ref: req.body?.external_ref,
    });

    return res.status(201).json({
      data: link,
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmIdentityLink(req, res, next) {
  try {
    const link = await identityLinksService.confirmIdentityLink({
      link_id: req.body?.link_id,
      user_id: req.body?.user_id,
    });

    return res.status(200).json({
      data: link,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requestIdentityLink,
  confirmIdentityLink,
};
