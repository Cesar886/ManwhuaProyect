/**
 * Logger simple y controlado por entorno
 * - En `production` sólo se muestran `warn` y `error`.
 * - En desarrollo se muestran `debug`, `info`, `warn`, `error`.
 */
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

module.exports = {
    debug,
    info,
    warn,
    error
};
