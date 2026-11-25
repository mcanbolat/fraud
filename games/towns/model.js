// Invent a Town (towns game) — model.
// Parsing/validation of the 50 invented populations and the digit statistics used by the
// student page and the instructor dashboard. Works in the browser (window.TOWNS, needs
// window.BENFORD loaded first) and in node (module.exports) for testing.
(function (root) {
  const B = root.BENFORD || (typeof require !== "undefined" ? require("../benford/benford.js") : null);
  const DEFAULTS = { n: 50 };
  const MIN = 1, MAX = 50000000;
  const THOUS = /^\d{1,3}(,\d{3})+$/;

  // ---- parsing ---------------------------------------------------------------
  // Separators: whitespace (incl. new lines) and semicolons. A token like "12,345" (comma
  // thousands style) is ONE number, 12345. Any other token containing commas (for example
  // "500,1200,300") is split at the commas. Decimals, negatives, text and numbers outside
  // 1..50,000,000 are reported in `invalid` (with a reason) and not counted.
  function parse(text) {
    const nums = [], invalid = [];
    const toks = String(text == null ? "" : text).split(/[\s;]+/).filter(Boolean);
    for (let tok of toks) {
      tok = tok.replace(/^,+|,+$/g, "");
      if (!tok) continue;
      const parts = tok.includes(",") && !THOUS.test(tok) ? tok.split(",").filter(Boolean) : [tok];
      for (const p of parts) {
        const t = THOUS.test(p) ? p.replace(/,/g, "") : p;
        if (/^-/.test(t)) { invalid.push({ token: p, reason: "negative" }); continue; }
        if (/^\d*[.]\d*$/.test(t) && /\d/.test(t)) { invalid.push({ token: p, reason: "decimal" }); continue; }
        if (!/^\d+$/.test(t)) { invalid.push({ token: p, reason: "not a whole number" }); continue; }
        const v = Number(t);
        if (v < MIN) invalid.push({ token: p, reason: "must be at least 1" });
        else if (v > MAX) invalid.push({ token: p, reason: "above 50,000,000" });
        else nums.push(v);
      }
    }
    return { nums, invalid };
  }
  const isValidNums = (nums, n) => Array.isArray(nums) && nums.length === (n || DEFAULTS.n) &&
    nums.every((v) => Number.isInteger(v) && v >= MIN && v <= MAX);
  const fmt = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // ---- statistics ------------------------------------------------------------
  const lastDigitOf = (x) => x % 10;
  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function digitCounts(nums, fn, lo, hi) {
    const c = new Array(hi - lo + 1).fill(0);
    for (const v of nums) { const d = fn(v); if (d != null) c[d - lo]++; }
    return c;
  }
  // Statistics for one set of numbers (one student, or the whole class pooled).
  function stats(nums) {
    const n = nums.length, a = B.analyze(nums, "first");
    const end0 = nums.filter((v) => lastDigitOf(v) === 0).length;
    const end05 = nums.filter((v) => { const d = lastDigitOf(v); return d === 0 || d === 5; }).length;
    const start1 = nums.filter((v) => B.firstDigit(v) === 1).length;
    return { n, first: a, mad: a.mad, verdict: a.verdict, chi2: a.chi2, p: a.p,
      firstCounts: a.counts, lastCounts: digitCounts(nums, lastDigitOf, 0, 9),
      end0: n ? end0 / n : null, end05: n ? end05 / n : null, start1: n ? start1 / n : null,
      median: median(nums) };
  }
  const modeDigit = (counts, lo) => { let b = 0; counts.forEach((c, i) => { if (c > counts[b]) b = i; }); return counts.some((c) => c) ? b + lo : null; };

  // ---- CSV rows --------------------------------------------------------------
  function numberRows(code, nick, nums) {
    return nums.map((v, i) => ({ session: code, nickname: nick, index: i + 1, value: v, first_digit: B.firstDigit(v), last_digit: lastDigitOf(v) }));
  }

  // ---- demo data (rehearsal) ---------------------------------------------------
  const DW = [1, 1.1, 1.2, 1.3, 1.3, 1.3, 1.2, 1.1, 1];       // first digit: roughly uniform, a bit more 3-7
  const LEN = [[2, 0.05], [3, 0.2], [4, 0.35], [5, 0.3], [6, 0.1]];
  function pickW(rng, items) { let r = rng() * items.reduce((s, x) => s + x[1], 0); for (const it of items) { r -= it[1]; if (r < 0) return it[0]; } return items[items.length - 1][0]; }
  // human-like invented number: uniform-ish first digit, magnitudes mostly 500-50,000, many round numbers
  function humanNumber(rng, roundness) {
    const len = pickW(rng, LEN), d = pickW(rng, DW.map((w, i) => [i + 1, w]));
    let s = String(d);
    for (let i = 1; i < len; i++) s += Math.floor(rng() * 10);
    if (rng() < roundness) { const keep = len >= 3 && rng() < 0.35 ? 2 : 1; s = s.slice(0, keep) + "0".repeat(len - keep); }
    else if (len >= 2 && rng() < 0.15) s = s.slice(0, -1) + "5";
    return Math.max(1, Math.min(MAX, +s));
  }
  // a careful student who draws log-uniform sizes (hard to catch)
  const logUniformNumber = (rng) => Math.max(1, Math.round(Math.pow(10, 1.5 + rng() * 4)));
  function demoStudent(rng, careful) {
    const round = 0.3 + 0.25 * rng(), out = [];
    for (let i = 0; i < DEFAULTS.n; i++) out.push(careful ? logUniformNumber(rng) : humanNumber(rng, round));
    return out;
  }
  function demoClass(students, seed) {
    const rng = B.seeded(seed || 20260), out = [];
    for (let i = 0; i < students; i++) out.push(demoStudent(rng, i % 12 === 5));
    return out;
  }

  const API = { DEFAULTS, MIN, MAX, parse, isValidNums, fmt, lastDigitOf, median, digitCounts, stats, modeDigit, numberRows, humanNumber, demoStudent, demoClass };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.TOWNS = API;
})(typeof window !== "undefined" ? window : globalThis);
