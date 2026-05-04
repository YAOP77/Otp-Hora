const { randomUUID } = require('crypto');
const userContactsRepository = require('./userContacts.repository');
const { normalizeToE164 } = require('../../common/phone');

async function createContact(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const rawPhone =
    typeof payload?.phone_number === 'string' ? payload.phone_number : '';

  if (!userId) {
    const error = new Error('Le champ user_id est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!rawPhone) {
    const error = new Error('Le champ phone_number est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  const user = await userContactsRepository.findUserById(userId);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  const phone_number = normalizeToE164(rawPhone);

  return userContactsRepository.createContact({
    contact_id: randomUUID(),
    user_id: userId,
    phone_number,
  });
}

module.exports = {
  createContact,
};
