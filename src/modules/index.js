const { healthRouter } = require('./health/health.routes');
const { usersRouter } = require('./users/users.routes');
const { enterpriseRouter } = require('./enterprise_accounts/enterprise.routes');
const { identityLinksRouter } = require('./identity_links/identityLinks.routes');
const { authRequestsRouter } = require('./auth_requests/authRequests.routes');
const { authEventsRouter } = require('./auth_events/authEvents.routes');
const { recoveryRouter } = require('./recovery_methods/recovery.routes');
const { userContactsRouter } = require('./user_contacts/userContacts.routes');
const { userDevicesRouter } = require('./user_devices/userDevices.routes');

function registerRoutes(app) {
  app.use(healthRouter);
  app.use(usersRouter);
  app.use(enterpriseRouter);
  app.use(identityLinksRouter);
  app.use(authRequestsRouter);
  app.use(authEventsRouter);
  app.use(recoveryRouter);
  app.use(userContactsRouter);
  app.use(userDevicesRouter);
}

module.exports = { registerRoutes };
