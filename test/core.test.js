import test from 'node:test';
import assert from 'node:assert/strict';

import { collationSortKey, compareSortKeys, DEFAULT_MAX_LEVEL } from '../src/index.js';

// Helper: compare two strings by their default sort keys.
function cmp(a, b) {
  return compareSortKeys(collationSortKey(a), collationSortKey(b));
}

// Helper: hex string of a key, for readable failure messages.
function hex(key) {
  return Array.from(key, (b) => b.toString(16).padStart(2, '0')).join('');
}

test('default max level is 3', () => {
  assert.equal(DEFAULT_MAX_LEVEL, 3);
});

test('identical strings produce identical keys', () => {
  assert.equal(hex(collationSortKey('hello')), hex(collationSortKey('hello')));
});

test('empty string produces a key with only level separators', () => {
  assert.deepEqual(collationSortKey(''), Uint8Array.from([0, 0, 0, 0]));
});

test('primary order: digits before letters', () => {
  assert.ok(cmp('1', 'a') < 0);
  assert.ok(cmp('9', 'A') < 0);
});

test('primary order: letters are ordered alphabetically', () => {
  assert.ok(cmp('a', 'b') < 0);
  assert.ok(cmp('b', 'c') < 0);
  assert.ok(cmp('z', 'a') > 0);
});

test('case is a tertiary difference only', () => {
  // At level 1 and 2, 'a' and 'A' are equal.
  const a1 = collationSortKey('a', { maxLevel: 1 });
  const A1 = collationSortKey('A', { maxLevel: 1 });
  assert.equal(hex(a1), hex(A1));

  const a2 = collationSortKey('a', { maxLevel: 2 });
  const A2 = collationSortKey('A', { maxLevel: 2 });
  assert.equal(hex(a2), hex(A2));

  // At level 3, lowercase sorts before uppercase.
  assert.ok(cmp('a', 'A') < 0);
});

test('accents are a secondary difference', () => {
  // 'a' and 'á' share a primary weight.
  const a1 = collationSortKey('a', { maxLevel: 1 });
  const aacute1 = collationSortKey('á', { maxLevel: 1 });
  assert.equal(hex(a1), hex(aacute1));

  // At level 2 they differ, and unaccented sorts first.
  assert.ok(cmp('a', 'á') < 0);
  assert.ok(cmp('á', 'à') < 0);
});

test('maxLevel 1 ignores accents and case', () => {
  assert.equal(
    hex(collationSortKey('café', { maxLevel: 1 })),
    hex(collationSortKey('CAFE', { maxLevel: 1 })),
  );
});

test('maxLevel 2 ignores case but not accents', () => {
  assert.equal(
    hex(collationSortKey('café', { maxLevel: 2 })),
    hex(collationSortKey('CAFÉ', { maxLevel: 2 })),
  );
  assert.notEqual(
    hex(collationSortKey('café', { maxLevel: 2 })),
    hex(collationSortKey('cafe', { maxLevel: 2 })),
  );
});

test('letters interleave by base letter across case', () => {
  // 'a' < 'B' because 'a' and 'A' share the primary weight for 'a',
  // which is less than the primary weight for 'b'.
  assert.ok(cmp('a', 'B') < 0);
  assert.ok(cmp('A', 'b') < 0);
});

test('unassigned code points sort after assigned ones', () => {
  assert.ok(cmp('a', '\u{1F600}') < 0);
  assert.ok(cmp('z', '\u{1F600}') < 0);
});

test('non-string input throws TypeError', () => {
  assert.throws(() => collationSortKey(42), TypeError);
  assert.throws(() => collationSortKey(null), TypeError);
  assert.throws(() => collationSortKey(undefined), TypeError);
});

test('invalid maxLevel throws RangeError', () => {
  assert.throws(() => collationSortKey('a', { maxLevel: 0 }), RangeError);
  assert.throws(() => collationSortKey('a', { maxLevel: 4 }), RangeError);
  assert.throws(() => collationSortKey('a', { maxLevel: 1.5 }), RangeError);
});

test('compareSortKeys returns 0 for equal keys', () => {
  const a = collationSortKey('test');
  const b = collationSortKey('test');
  assert.equal(compareSortKeys(a, b), 0);
});

test('compareSortKeys handles prefix ordering', () => {
  const a = collationSortKey('ab');
  const b = collationSortKey('abc');
  assert.ok(compareSortKeys(a, b) < 0);
  assert.ok(compareSortKeys(b, a) > 0);
});

test('keys are Uint8Array instances', () => {
  const key = collationSortKey('x');
  assert.ok(key instanceof Uint8Array);
});

test('sorting a list with the comparator gives the expected order', () => {
  const words = ['banana', 'Apple', 'apple', 'apricot', 'BANANA', 'Ápple'];
  const sorted = [...words].sort((a, b) => cmp(a, b));
  // Primary weights: a < b, so all 'a' words come before 'b' words.
  // Within 'a' words, 'Apple' and 'apple' share primary and secondary,
  // and lowercase sorts first at tertiary level.
  assert.deepEqual(sorted, ['apple', 'Apple', 'Ápple', 'apricot', 'banana', 'BANANA']);
});
