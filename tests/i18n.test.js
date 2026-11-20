const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SUPPORTED_LANGS,
    DEFAULT_LANG,
    normalizeLang,
    inferLangFromText,
} = require('../i18n-helpers');

test('declares the supported and default languages', () => {
    assert.deepEqual(SUPPORTED_LANGS, ['es', 'en']);
    assert.equal(DEFAULT_LANG, 'es');
    assert.ok(Object.isFrozen(SUPPORTED_LANGS));
});

test('normalizes regional language tags and invalid values', () => {
    assert.equal(normalizeLang(' EN-us '), 'en');
    assert.equal(normalizeLang('es_MX'), 'es');
    assert.equal(normalizeLang('fr-FR'), 'es');
    assert.equal(normalizeLang(null), 'es');
});

test('infers language only when the text has a clear signal', () => {
    assert.equal(inferLangFromText('Please recommend a dungeon manhwa'), 'en');
    assert.equal(inferLangFromText('Recomienda un manhwa de venganza'), 'es');
    assert.equal(inferLangFromText('Solo Leveling'), null);
    assert.equal(inferLangFromText('the protagonista'), null);
});
