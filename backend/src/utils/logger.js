/* Minimal leveled logger. Swap for pino/winston without touching call sites. */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configuredLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info');
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  if (meta instanceof Error) out(line, '\n', meta.stack);
  else if (meta !== undefined) out(line, meta);
  else out(line);
}

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
  // Used by morgan for HTTP access logs
  stream: { write: (message) => write('info', message.trim()) },
};

module.exports = logger;
