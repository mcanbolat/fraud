// Benford's Law analysis: model (digit extraction, tests, tampering, CSV parsing).
// Works in the browser (window.BENFORD) and in node (module.exports) for testing.
(function (root) {
  // ---------- numbers & digits ----------
  // Parse a cell to a finite number. Strips $, %, spaces and thousands commas.
  // Anything non-numeric (blank, "A", "n/a") returns null.
  function parseNum(s) {
    if (typeof s === "number") return isFinite(s) ? s : null;
    if (s == null) return null;
    const t = String(s).trim().replace(/[\s$€£%]/g, "").replace(/,/g, "");
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
    const v = Number(t);
    return isFinite(v) ? v : null;
  }
  // First significant digit 1..9 (sign ignored). 0 / non-finite -> null.
  // toExponential(10) rounds away floating-point noise (e.g. 2.9999999999999996 -> 3).
  function firstDigit(x) {
    x = Math.abs(x); if (!x || !isFinite(x)) return null;
    return +x.toExponential(10)[0];
  }
  // Second significant digit 0..9 (a one-digit number such as 3 has second digit 0).
  function secondDigit(x) {
    x = Math.abs(x); if (!x || !isFinite(x)) return null;
    const s = x.toExponential(10); return +s[2];
  }
  // First two significant digits 10..99.
  function firstTwo(x) {
    x = Math.abs(x); if (!x || !isFinite(x)) return null;
    const s = x.toExponential(10); return +(s[0] + s[2]);
  }
  // Last digit 0..9, only for |x| >= 10. Integers use x mod 10; decimals use the last
  // digit of their plain decimal text (12 significant digits). Exponent forms are skipped.
  function lastDigit(x) {
    x = Math.abs(x); if (!isFinite(x) || x < 10) return null;
    if (Number.isInteger(x)) return x < 9e15 ? x % 10 : null;
    const s = String(Number(x.toPrecision(12)));
    if (/e/i.test(s)) return null;
    return +s[s.length - 1];
  }

  // Position of the last digit = number of significant-digit places up to the last one shown
  // (4,580 -> 4; 12.37 -> 4). Used to weight the Benford k-th digit law for the last-digit test.
  function lastPos(x) {
    x = Math.abs(x); if (!isFinite(x) || x < 10) return null;
    const s = Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12)));
    if (/e/i.test(s)) return null;
    return s.replace(".", "").replace(/^0+/, "").length;
  }
  // Benford probability that the k-th significant digit equals d (k >= 2). Exact for k <= 5,
  // uniform beyond (the deviation is below 0.0001).
  const KTH = {};
  function kthDigitProb(k, d) {
    if (k > 5) return 0.1;
    const key = k + ":" + d; if (KTH[key] != null) return KTH[key];
    let s = 0; const lo = Math.pow(10, k - 2), hi = Math.pow(10, k - 1);
    for (let j = lo; j < hi; j++) s += Math.log10(1 + 1 / (10 * j + d));
    return (KTH[key] = s);
  }
  // Expected last-digit shares for a given dataset: mix of k-th digit laws by number length.
  function lastExpected(values) {
    const w = {}; let n = 0;
    for (const v of values) { const k = lastPos(v); if (k == null) continue; w[k] = (w[k] || 0) + 1; n++; }
    const e = new Array(10).fill(0);
    if (!n) return e.map(() => 0.1);
    for (const k in w) for (let d = 0; d < 10; d++) e[d] += (w[k] / n) * kthDigitProb(+k, d);
    return e;
  }

  const log10 = Math.log10;
  const TESTS = {
    first:  { id: "first",  name: "First digit",      lo: 1,  hi: 9,  fn: firstDigit, thr: [0.006, 0.012, 0.015], expected: (d) => log10(1 + 1 / d) },
    second: { id: "second", name: "Second digit",     lo: 0,  hi: 9,  fn: secondDigit, thr: [0.008, 0.010, 0.012],
              expected: (d) => { let s = 0; for (let k = 1; k <= 9; k++) s += log10(1 + 1 / (10 * k + d)); return s; } },
    two:    { id: "two",    name: "First two digits", lo: 10, hi: 99, fn: firstTwo, thr: [0.0012, 0.0018, 0.0022], expected: (d) => log10(1 + 1 / d) },
    last:   { id: "last",   name: "Last digit",       lo: 0,  hi: 9,  fn: lastDigit, thr: null, expected: () => 0.1, expectedFor: lastExpected }
  };
  const VERDICTS = ["Close conformity", "Acceptable conformity", "Marginally acceptable conformity", "Nonconformity"];
  function verdict(test, mad) {
    const t = TESTS[test].thr; if (!t) return null;
    return mad < t[0] ? VERDICTS[0] : mad < t[1] ? VERDICTS[1] : mad < t[2] ? VERDICTS[2] : VERDICTS[3];
  }

  // ---------- statistics ----------
  function lgamma(x) {   // Lanczos
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  // Regularized upper incomplete gamma Q(a, x)
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
      return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a)));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  const chiSqP = (chi2, df) => gammaQ(df / 2, chi2 / 2);
  // Nigrini's z with continuity correction: (|p-e| - 1/(2n)) / sqrt(e(1-e)/n)
  function zStat(p, e, n) {
    if (!n) return 0;
    const diff = Math.abs(p - e), cc = 1 / (2 * n), num = diff > cc ? diff - cc : diff;
    return num / Math.sqrt(e * (1 - e) / n);
  }
  const mad = (props, exp) => { let s = 0; for (let i = 0; i < props.length; i++) s += Math.abs(props[i] - exp[i]); return s / props.length; };

  // Full digit analysis of an array of numbers for test "first" | "second" | "two" | "last".
  function analyze(values, test) {
    const T = TESTS[test], k = T.hi - T.lo + 1, counts = new Array(k).fill(0);
    let n = 0;
    for (let i = 0; i < values.length; i++) {
      const d = T.fn(values[i]); if (d == null) continue;
      counts[d - T.lo]++; n++;
    }
    const digits = [], expected = [], props = [], z = [];
    const expFor = T.expectedFor ? T.expectedFor(values) : null;
    let chi2 = 0;
    for (let i = 0; i < k; i++) {
      const d = T.lo + i, e = expFor ? expFor[i] : T.expected(d), p = n ? counts[i] / n : 0;
      digits.push(d); expected.push(e); props.push(p); z.push(zStat(p, e, n));
      if (n) chi2 += (counts[i] - n * e) ** 2 / (n * e);
    }
    const df = k - 1, m = n ? mad(props, expected) : NaN;
    return { test, n, digits, counts, props, expected, z, chi2, df, p: n ? chiSqP(chi2, df) : NaN, mad: m, verdict: n ? verdict(test, m) : null };
  }

  // ---------- seeded RNG ----------
  function seeded(seed) {   // mulberry32
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function randomSeed() {
    try { const a = new Uint32Array(1); (root.crypto || require("crypto").webcrypto).getRandomValues(a); return a[0] % 1000000; }
    catch (_) { return Math.floor(Math.random() * 1000000); }
  }

  // ---------- scale invariance ----------
  const scale = (values, m) => { const o = new Array(values.length); for (let i = 0; i < values.length; i++) o[i] = values[i] * m; return o; };
  function uniformData(n, seed) { const r = seeded(seed), o = []; for (let i = 0; i < n; i++) o.push(1 + Math.floor(r() * 9999)); return o; }

  // ---------- tampering (each returns a NEW array; the input is untouched) ----------
  // Round to nearest `unit`. Values that round to 0 are dropped (no first digit).
  function roundTo(values, unit) {
    const o = []; for (const v of values) { const r = Math.round(v / unit) * unit; if (r !== 0) o.push(r); } return o;
  }
  // Every value in [T(1-w), T) is pushed to just above T: T*(1+u*0.02), rounded up to a whole number.
  function thresholdInflate(values, T, w, rng) {
    let moved = 0; const lo = T * (1 - w), o = values.slice();
    for (let i = 0; i < o.length; i++) if (o[i] >= lo && o[i] < T) { o[i] = Math.ceil(T * (1 + rng() * 0.02)); moved++; }
    return { values: o, moved };
  }
  // Counts of values in `nb` equal bins covering [T(1-hw), T(1+hw)).
  function bunching(values, T, hw, nb) {
    hw = hw || 0.2; nb = nb || 40;
    const lo = T * (1 - hw), width = 2 * hw * T / nb, counts = new Array(nb).fill(0), edges = [];
    for (let i = 0; i < nb; i++) edges.push(lo + i * width);
    for (const v of values) { const i = Math.floor((v - lo) / width); if (i >= 0 && i < nb) counts[i]++; }
    return { counts, edges, width, lo };
  }
  // One invented number: "human" = first digit uniform-ish with preference for 3-7, 2-5 digits, other digits uniform;
  // "uniform" = uniform integer between 100 and 99,999.
  const HUMAN_W = [1, 2, 3, 3, 3, 3, 3, 1, 1];   // weights for first digit 1..9
  function inventNumber(mode, rng) {
    if (mode === "uniform") return 100 + Math.floor(rng() * 99900);
    let r = rng() * HUMAN_W.reduce((a, b) => a + b, 0), d = 1;
    for (let i = 0; i < 9; i++) { r -= HUMAN_W[i]; if (r < 0) { d = i + 1; break; } }
    const len = 2 + Math.floor(rng() * 4); let s = String(d);
    for (let i = 1; i < len; i++) s += Math.floor(rng() * 10);
    return +s;
  }
  // Replace round(frac * n) randomly chosen rows with invented numbers.
  function fabricate(values, frac, mode, rng) {
    const o = values.slice(), n = o.length, k = Math.round(frac * n), idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) { const j = i + Math.floor(rng() * (n - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; o[idx[i]] = inventNumber(mode, rng); }
    return { values: o, replaced: k };
  }

  // ---------- growth ----------
  // Years a quantity growing at rate r spends with first digit d on its way from 10^k to 10^(k+1).
  function growth(r) {
    const total = Math.log(10) / Math.log(1 + r), rows = [];
    for (let d = 1; d <= 9; d++) { const yrs = Math.log(1 + 1 / d) / Math.log(1 + r); rows.push({ d, years: yrs, share: yrs / total, benford: log10(1 + 1 / d) }); }
    return { total, rows };
  }

  // ---------- CSV / pasted text ----------
  function parseDelimited(text, delim) {
    const rows = []; let row = [], f = "", q = false;
    const n = text.length;
    for (let i = 0; i < n; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f === "") q = true;
      else if (c === delim) { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); if (row.length > 1 || row[0] !== "") rows.push(row); }
    return rows;
  }
  const detectDelimiter = (text) => {
    const line = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const c = { "\t": 0, ";": 0, ",": 0 }; let q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch in c) c[ch]++; }
    return c["\t"] ? "\t" : c[";"] > c[","] ? ";" : c[","] ? "," : "\t";
  };
  // Turn pasted/uploaded text into {columns:[{name, values:[number|null...]}], single:boolean}.
  // A plain list of numbers (one per line, thousands commas allowed) becomes one column.
  function parseTable(text) {
    text = String(text || "").replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { columns: [], single: true };
    if (lines.every((l) => parseNum(l) !== null))
      return { columns: [{ name: "Numbers", values: lines.map(parseNum) }], single: true };
    const rows = parseDelimited(text, detectDelimiter(text));
    const ncol = Math.max(...rows.map((r) => r.length));
    const hasHeader = rows[0].some((c) => c.trim() !== "" && parseNum(c) === null);
    const head = hasHeader ? rows[0] : null, body = hasHeader ? rows.slice(1) : rows, columns = [];
    for (let j = 0; j < ncol; j++) {
      const vals = body.map((r) => parseNum(r[j])), good = vals.filter((v) => v !== null).length;
      if (good >= Math.max(1, body.length * 0.5)) columns.push({ name: head && head[j] ? head[j].trim() : "Column " + (j + 1), values: vals });
    }
    return { columns, single: false };
  }
  // Split raw values into usable (non-zero numeric) and excluded counts.
  function clean(values) {
    const use = []; let zero = 0, missing = 0;
    for (const v of values) { if (v === null || v === undefined || !isFinite(v)) missing++; else if (v === 0) zero++; else use.push(v); }
    return { values: use, zero, missing, excluded: zero + missing };
  }
  // Census CSV text -> rows {sumlev, name, state, pop2010, pop2017}; non-numeric populations (e.g. "A") become null.
  function parseCensus(text) {
    const rows = parseDelimited(String(text).replace(/^﻿/, ""), ","), out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      out.push({ sumlev: r[0], name: r[1], state: r[2], pop2010: parseNum(r[3]), pop2017: parseNum(r[4]) });
    }
    return out;
  }

  const API = { parseNum, firstDigit, secondDigit, firstTwo, lastDigit, lastPos, kthDigitProb, lastExpected, TESTS, VERDICTS, verdict, gammaQ, chiSqP, zStat, mad, analyze,
                seeded, randomSeed, scale, uniformData, roundTo, thresholdInflate, bunching, inventNumber, fabricate, growth,
                parseDelimited, parseTable, clean, parseCensus };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.BENFORD = API;
})(typeof window !== "undefined" ? window : globalThis);
