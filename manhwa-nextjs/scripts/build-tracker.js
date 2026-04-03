const fs = require('fs/promises');
const path = require('path');
const { minify } = require('terser');

const INPUT = path.resolve(__dirname, '../src/lib/tracker.sdk.js');
const OUTPUT = path.resolve(__dirname, '../public/tracker.min.js');
const MAX_BYTES = 5 * 1024;

async function buildTracker() {
    const code = await fs.readFile(INPUT, 'utf8');

    const result = await minify(code, {
        module: true,
        toplevel: true,
        compress: {
            passes: 2,
            dead_code: true,
            keep_fargs: false,
            pure_getters: true,
            unsafe: false,
            drop_console: true,
        },
        mangle: true,
        format: {
            comments: false,
        },
    });

    if (!result.code) {
        throw new Error('No se pudo minificar tracker.js');
    }

    await fs.writeFile(OUTPUT, result.code, 'utf8');

    const bytes = Buffer.byteLength(result.code, 'utf8');
    if (bytes > MAX_BYTES) {
        throw new Error(`tracker.min.js excede 5KB: ${bytes} bytes`);
    }

    console.log(`tracker.min.js generado correctamente (${bytes} bytes)`);
}

buildTracker().catch((error) => {
    console.error('[build-tracker] error:', error.message);
    process.exit(1);
});
