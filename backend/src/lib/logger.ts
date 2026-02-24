type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[minLevel];
}

function log(level: LogLevel, tag: string, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const entry = `${ts} [${level.toUpperCase()}] [${tag}] ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) {
    fn(entry, meta);
  } else {
    fn(entry);
  }
}

export const logger = {
  debug: (tag: string, msg: string, meta?: unknown) => log('debug', tag, msg, meta),
  info:  (tag: string, msg: string, meta?: unknown) => log('info', tag, msg, meta),
  warn:  (tag: string, msg: string, meta?: unknown) => log('warn', tag, msg, meta),
  error: (tag: string, msg: string, meta?: unknown) => log('error', tag, msg, meta),
};
