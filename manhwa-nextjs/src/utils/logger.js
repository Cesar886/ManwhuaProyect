// Logger ligero para el frontend (Next.js)
const isProd = process.env.NODE_ENV === 'production';

const debug = (...args) => {
  if (!isProd) console.debug(...args);
};

const info = (...args) => {
  if (!isProd) console.info(...args);
};

const warn = (...args) => {
  console.warn(...args);
};

const error = (...args) => {
  console.error(...args);
};

const logger = {
  debug,
  info,
  warn,
  error
};

export default logger;
