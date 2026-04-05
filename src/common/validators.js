const Joi = require('joi');
const { createError } = require('./errors');
const { normalizePinInput } = require('./pinInput');

/** PIN JSON : chaîne ou nombre (ex. client mobile). Valeur normalisée en chaîne. */
const pinFieldSchema = Joi.any()
  .custom((value, helpers) => {
    const n = normalizePinInput(value);
    if (!/^\d{4,6}$/.test(n)) {
      return helpers.error('any.invalid');
    }
    return n;
  }, 'pin 4-6 digits')
  .messages({
    'any.invalid': 'Le PIN doit contenir 4 à 6 chiffres',
  });

const recoveryEmailSchema = Joi.object({
  email: Joi.string().email().max(320).required(),
});

/** Au moins un des champs ; sortie normalisée en `{ contact }` pour les services. */
const pinRecoveryRequestSchema = Joi.object({
  contact: Joi.string().min(5).max(32).optional(),
  phone: Joi.string().min(5).max(32).optional(),
  phone_number: Joi.string().min(5).max(32).optional(),
}).custom((value, helpers) => {
  const raw = value.contact ?? value.phone ?? value.phone_number;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length < 5) {
    return helpers.error('any.invalid');
  }
  return { contact: trimmed };
}, 'pin recovery phone')
  .messages({
    'any.invalid':
      'Le champ contact (téléphone) est obligatoire (contact, phone ou phone_number, E.164 recommandé)',
  });

const pinRecoveryConfirmSchema = Joi.object({
  token: Joi.string().min(32).max(512).required(),
  pin: pinFieldSchema.required(),
});

const emailVerifySchema = Joi.object({
  token: Joi.string().min(20).required(),
});

const enterpriseDeleteSchema = Joi.object({
  pin: pinFieldSchema.required(),
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
