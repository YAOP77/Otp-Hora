function write(level, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

function info(payload) {
  write('info', payload);
}

function warn(payload) {
  write('warn', payload);
}

function error(payload) {
  write('error', payload);
}

module.exports = {
  info,
  warn,
  error,
};
