// Unicode Collation Algorithm (UCA) default sort key generator.
//
// This module implements a small, self-contained slice of UTS #10: the
// "Default" (a.k.a. DUCET) ordering. We treat every code point as a single
// collation element and derive its three weights from a compact table that
// encodes the primary, secondary, and tertiary orderings used by the default
// Unicode Collation Algorithm. The result is a byte string that can be
// compared with ordinary bytewise comparison to get locale-independent,
// UCA-like ordering.
//
// Design trade-off: a full UCA implementation needs the entire DUCET table
// (tens of thousands of entries) plus normalisation and contraction handling.
// The table below is a deliberately small approximation that covers the
// ASCII range exactly and gives a reasonable default ordering for a handful
// of common Latin-1 and Greek letters. It is not a conformant UCA
// implementation; it is a practical sort-key generator for the common case of
// sorting mixed ASCII and accented Latin text without pulling in ICU.

/**
 * Maximum collation level produced by {@link collationSortKey}.
 *
 * Level 1 is the primary weight (base letter), level 2 is the secondary
 * weight (accent / diacritic), and level 3 is the tertiary weight (case and
 * other minor distinctions). The default of 3 matches the default strength
 * of the Unicode Collation Algorithm.
 */
export const DEFAULT_MAX_LEVEL = 3;

// Primary weights. We assign explicit, increasing values so that the default
// order is: control characters, space, punctuation, digits, uppercase and
// lowercase letters interleaved by base letter, then everything else.
//
// The values are arbitrary but stable; only their relative order matters.
// We use a plain object literal rather than a Map for the common case so that
// the hot path is a property lookup on a small, monomorphic object.
const PRIMARY = Object.create(null);

// Control characters (U+0000..U+001F) and DEL (U+007F).
let w = 0x0100;
for (let cp = 0x0000; cp <= 0x001f; cp++) PRIMARY[cp] = w++;
PRIMARY[0x007f] = w++;

// Space and common punctuation, in a fixed order.
const PUNCT = ' !"#%&\'()*,-./:;?@[\\]_{}¡§«¶·»¿';
for (let i = 0; i < PUNCT.length; i++) {
  const cp = PUNCT.codePointAt(i);
  if (PRIMARY[cp] === undefined) PRIMARY[cp] = w++;
}

// Digits 0-9.
for (let cp = 0x0030; cp <= 0x0039; cp++) PRIMARY[cp] = w++;

// Latin letters: uppercase and lowercase of the same base letter share a
// primary weight so that case is a tertiary difference only.
const LATIN_BASES = [
  ['a', 'A', 'á', 'Á', 'à', 'À', 'â', 'Â', 'ä', 'Ä', 'ã', 'Ã', 'å', 'Å', 'æ', 'Æ'],
  ['b', 'B'],
  ['c', 'C', 'ç', 'Ç'],
  ['d', 'D', 'ð', 'Ð'],
  ['e', 'E', 'é', 'É', 'è', 'È', 'ê', 'Ê', 'ë', 'Ë'],
  ['f', 'F'],
  ['g', 'G'],
  ['h', 'H'],
  ['i', 'I', 'í', 'Í', 'ì', 'Ì', 'î', 'Î', 'ï', 'Ï'],
  ['j', 'J'],
  ['k', 'K'],
  ['l', 'L'],
  ['m', 'M'],
  ['n', 'N', 'ñ', 'Ñ'],
  ['o', 'O', 'ó', 'Ó', 'ò', 'Ò', 'ô', 'Ô', 'ö', 'Ö', 'õ', 'Õ', 'ø', 'Ø'],
  ['p', 'P'],
  ['q', 'Q'],
  ['r', 'R'],
  ['s', 'S', 'ß'],
  ['t', 'T', 'þ', 'Þ'],
  ['u', 'U', 'ú', 'Ú', 'ù', 'Ù', 'û', 'Û', 'ü', 'Ü'],
  ['v', 'V'],
  ['w', 'W'],
  ['x', 'X'],
  ['y', 'Y', 'ý', 'Ý', 'ÿ', 'Ÿ'],
  ['z', 'Z'],
];

for (const group of LATIN_BASES) {
  const primary = w++;
  for (const ch of group) {
    const cp = ch.codePointAt(0);
    if (PRIMARY[cp] === undefined) PRIMARY[cp] = primary;
  }
}

// A few Greek letters, just enough to show the table is extensible.
const GREEK = [
  ['α', 'Α'], ['β', 'Β'], ['γ', 'Γ'], ['δ', 'Δ'], ['ε', 'Ε'],
  ['ζ', 'Ζ'], ['η', 'Η'], ['θ', 'Θ'], ['ι', 'Ι'], ['κ', 'Κ'],
  ['λ', 'Λ'], ['μ', 'Μ'], ['ν', 'Ν'], ['ξ', 'Ξ'], ['ο', 'Ο'],
  ['π', 'Π'], ['ρ', 'Ρ'], ['σ', 'Σ', 'ς'], ['τ', 'Τ'], ['υ', 'Υ'],
  ['φ', 'Φ'], ['χ', 'Χ'], ['ψ', 'Ψ'], ['ω', 'Ω'],
];
for (const group of GREEK) {
  const primary = w++;
  for (const ch of group) {
    const cp = ch.codePointAt(0);
    if (PRIMARY[cp] === undefined) PRIMARY[cp] = primary;
  }
}

// Secondary weights: base letters have no accent, so weight 0x0002. Accented
// forms get distinct secondary weights so that, for example, "a" < "á" < "à".
// The exact values are not meaningful beyond their ordering.
const SECONDARY = Object.create(null);

function setSecondary(chars, weight) {
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (SECONDARY[cp] === undefined) SECONDARY[cp] = weight;
  }
}

// Base (unaccented) forms: no secondary difference.
setSecondary('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 0x0002);

// Accented forms, ordered by accent class.
setSecondary('áÁćĆéÉíÍóÓúÚýÝ', 0x0003);
setSecondary('àÀèÈìÌòÒùÙ', 0x0004);
setSecondary('âÂêÊîÎôÔûÛ', 0x0005);
setSecondary('äÄëËïÏöÖüÜÿŸ', 0x0006);
setSecondary('ãÃñÑõÕ', 0x0007);
setSecondary('åÅ', 0x0008);
setSecondary('çÇ', 0x0009);
setSecondary('øØ', 0x000a);
setSecondary('æÆ', 0x000b);
setSecondary('ß', 0x000c);
setSecondary('ðÐ', 0x000d);
setSecondary('þÞ', 0x000e);

// Greek letters have no secondary difference in this table.
setSecondary('αβγδεζηθικλμνξοπρσςτυφχψω', 0x0002);
setSecondary('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ', 0x0002);

// Tertiary weights: lowercase before uppercase, matching the default UCA
// tertiary ordering. Non-letters get the neutral weight 0x0002.
const TERTIARY = Object.create(null);

function setTertiary(chars, weight) {
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (TERTIARY[cp] === undefined) TERTIARY[cp] = weight;
  }
}

setTertiary('abcdefghijklmnopqrstuvwxyzáàâäãåæçðéèêëíìîïñóòôöõøúùûüýÿþß', 0x0003);
setTertiary('ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÄÃÅÆÇÐÉÈÊËÍÌÎÏÑÓÒÔÖÕØÚÙÛÜÝŸÞ', 0x0004);
setTertiary('αβγδεζηθικλμνξοπρσςτυφχψω', 0x0003);
setTertiary('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ', 0x0004);

/**
 * Look up the primary weight for a code point.
 *
 * Unassigned code points sort after everything we know about. This mirrors
 * the UCA's treatment of unassigned code points as having a very high primary
 * weight, which keeps them at the end of the sort order.
 */
function primaryOf(cp) {
  const v = PRIMARY[cp];
  return v === undefined ? 0xffff : v;
}

function secondaryOf(cp) {
  const v = SECONDARY[cp];
  return v === undefined ? 0x0002 : v;
}

function tertiaryOf(cp) {
  const v = TERTIARY[cp];
  return v === undefined ? 0x0002 : v;
}

/**
 * Append a 16-bit weight to a byte array in big-endian order.
 *
 * Big-endian is required because the resulting byte string is compared with
 * ordinary lexical comparison, and 16-bit weights must compare in numeric
 * order. Little-endian would make e.g. 0x0100 sort before 0x00ff.
 */
function pushWeight(out, weight) {
  out.push((weight >>> 8) & 0xff);
  out.push(weight & 0xff);
}

/**
 * Generate a Unicode Collation Algorithm sort key for `input`.
 *
 * The returned `Uint8Array` can be compared with `compareSortKeys` or with
 * any bytewise comparison to obtain a locale-independent ordering that
 * approximates the UCA default order. The key is built by concatenating the
 * primary weights of every code point, then a zero separator, then the
 * secondary weights, another separator, and finally the tertiary weights.
 *
 * `maxLevel` controls how many levels are included. Valid values are 1, 2,
 * or 3. Anything else throws a `RangeError`. Lower levels ignore accent and
 * case differences, which is useful for grouping.
 *
 * @param {string} input
 * @param {{ maxLevel?: number }} [options]
 * @returns {Uint8Array}
 */
export function collationSortKey(input, options = {}) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  const maxLevel = options.maxLevel === undefined ? DEFAULT_MAX_LEVEL : options.maxLevel;
  if (maxLevel !== 1 && maxLevel !== 2 && maxLevel !== 3) {
    throw new RangeError('maxLevel must be 1, 2, or 3');
  }

  const out = [];

  // Level 1: primary weights.
  for (const ch of input) {
    pushWeight(out, primaryOf(ch.codePointAt(0)));
  }

  if (maxLevel >= 2) {
    out.push(0x00, 0x00);
    for (const ch of input) {
      pushWeight(out, secondaryOf(ch.codePointAt(0)));
    }
  }

  if (maxLevel >= 3) {
    out.push(0x00, 0x00);
    for (const ch of input) {
      pushWeight(out, tertiaryOf(ch.codePointAt(0)));
    }
  }

  return Uint8Array.from(out);
}

/**
 * Compare two sort keys produced by {@link collationSortKey}.
 *
 * Returns a negative number if `a` sorts before `b`, a positive number if
 * `a` sorts after `b`, and zero if they are equal. This is a thin wrapper
 * around bytewise comparison so that callers do not have to remember that
 * the keys are `Uint8Array` values.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {number}
 */
export function compareSortKeys(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}
