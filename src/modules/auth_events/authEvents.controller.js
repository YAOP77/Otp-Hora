const authEventsService = require('./authEvents.service');

async function listEventsByRequest(req, res, next) {
  try {
    const events = await authEventsService.listEventsForRequest({
      company_id: req.enterprise?.company_id,
      request_id: req.params?.request_id,
    });

    return res.status(200).json({
      data: events,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listEventsByRequest,
};
