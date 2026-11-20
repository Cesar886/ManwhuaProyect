const test = require('node:test');
const assert = require('node:assert/strict');

const { rewriteQuery, levenshtein, setLogger } = require('../query-rewriter');

setLogger({ info() {}, warn() {} });

test('calculates edit distance with an optional early cutoff', () => {
    assert.equal(levenshtein('solo', 'solo'), 0);
    assert.equal(levenshtein('levling', 'leveling'), 1);
    assert.equal(levenshtein('abc', 'abcdefgh', 2), 3);
});

test('corrects a known concept typo without changing the rest', () => {
    const result = rewriteQuery('manhwa de nicromante');
    assert.equal(result.text, 'manhwa de nigromante');
    assert.equal(result.changed, true);
    assert.deepEqual(result.corrections[0], {
        from: 'nicromante',
        to: 'nigromante',
        kind: 'concept',
        dist: 1,
    });
});

test('corrects a catalog title typo', () => {
    const result = rewriteQuery('parecido a slo leveling', {
        seriesCache: [{ id: 7, title: 'Solo Leveling', _searchTitle: 'solo leveling' }],
    });
    assert.equal(result.text, 'parecido a Solo Leveling');
    assert.equal(result.corrections.at(-1).kind, 'title');
    assert.equal(result.corrections.at(-1).seriesId, 7);
});

test('leaves empty, exact and ambiguous queries unchanged', () => {
    assert.equal(rewriteQuery('').changed, false);
    assert.equal(rewriteQuery('venganza').changed, false);
    assert.equal(rewriteQuery('Solo Leveling', {
        seriesCache: [{ id: 7, title: 'Solo Leveling', _searchTitle: 'solo leveling' }],
    }).changed, false);
});
