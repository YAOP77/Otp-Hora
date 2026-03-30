class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.statusCode = status;
    this.code = code;
  }
}

function createError(message, status = 500, code = 'INTERNAL_ERROR') {
  return new AppError(message, status, code);
}

module.exports = {
  AppError,
  createError,
};
