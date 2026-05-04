const { randomUUID } = require('crypto');
const recoveryRepository = require('./recovery.repository');

async function createRecoveryMethod(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const methodType =
    typeof payload?.method_type === 'string' ? payload.method_type.trim() : '';

  if (!userId) {
    const error = new Error('Le champ user_id est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!methodType) {
    const error = new Error('Le champ method_type est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  const user = await recoveryRepository.findUserById(userId);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  return recoveryRepository.createRecoveryMethod({
    recovery_id: randomUUID(),
    user_id: userId,
    method_type: methodType,
    status: 'active',
  });
}

module.exports = {
  createRecoveryMethod,
};
