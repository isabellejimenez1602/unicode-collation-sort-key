# unicode-collation-sort-key

Generates Unicode Collation Algorithm default sort keys from strings for locale-independent comparison.

```js
import { collationSortKey, compareSortKeys } from './src/index.js';

const a = collationSortKey('café');
const b = collationSortKey('cafe');

console.log(compareSortKeys(a, b)); // > 0, because 'café' sorts after 'cafe'

const words = ['banana', 'Apple', 'apple', 'apricot', 'BANANA', 'Ápple'];
words.sort((x, y) => compareSortKeys(collationSortKey(x), collationSortKey(y)));
// [ 'apple', 'Apple', 'Ápple', 'apricot', 'banana', 'BANANA' ]
```

## Why this exists

Sorting strings with JavaScript's default `Array.prototype.sort` uses UTF-16 code unit order, which puts `Z` before `a` and places accented letters in code point order rather than in the order a reader expects. A full Unicode Collation Algorithm implementation needs the DUCET table, normalisation, and contraction handling. That is a lot of data and code for the common case of sorting mixed ASCII and accented Latin text.

This library takes the opposite trade-off: a small, dependency-free table that covers the ASCII range exactly and gives a sensible default ordering for common Latin-1 and Greek letters. It is not a conformant UCA implementation. It is a practical sort-key generator that produces byte strings you can compare directly, with no runtime dependencies and no locale data to load.

## What is implemented

- Three collation levels: primary (base letter), secondary (accent), tertiary (case).
- `collationSortKey(input, { maxLevel })` returns a `Uint8Array`.
- `compareSortKeys(a, b)` compares two keys and returns a number.
- `DEFAULT_MAX_LEVEL` is `3`.

The default ordering places control characters first, then spaces and punctuation, then digits, then letters (with uppercase and lowercase of the same base letter sharing a primary weight), then Greek letters, then unassigned code points. Lowercase sorts before uppercase at the tertiary level, matching the default UCA tertiary ordering.

## The awkward edge

This is not a conformant UCA implementation. Code points outside the small table are treated as unassigned and sort after everything else, and there is no normalisation step, so canonically equivalent strings that differ in composition (for example `"é"` as a single code point versus `"e"` followed by a combining acute accent) will not compare equal. If you need full UCA conformance, use a library that ships the DUCET table.
