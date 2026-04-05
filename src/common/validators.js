const Joi = require('joi');
const { createError } = require('./errors');

const recoveryEmailSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
});

const pinRecoveryRequestSchema = Joi.object({
  contact: Joi.string().min(5).max(32).required(),
});

const pinRecoveryConfirmSchema = Joi.object({
  token: Joi.string().min(32).max(512).required(),
  pin: Joi.string().pattern(/^\d{4,6}$/).required(),
});

const emailVerifySchema = Joi.object({
  token: Joi.string().min(20).required(),
});

const enterpriseDeleteSchema = Joi.object({
  pin: Joi.string().pattern(/^\d{4,6}$/).required(),
});

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const msg = error.details.map((d) => d.message).join('; ');
    throw createError(msg, 400, 'VALIDATION_ERROR');
  }
  return value;
}

module.exports = {
  recoveryEmailSchema,
  pinRecoveryRequestSchema,
  pinRecoveryConfirmSchema,
  emailVerifySchema,
  enterpriseDeleteSchema,
  validate,
};
