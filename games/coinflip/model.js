// The Broken Vase (coin-flip game) — model.
// Sequences are strings of "1" (= H, heads) and "0" (= T, tails).
// Works in the browser (window.COINFLIP) and in node (module.exports) for testing.
(function (root) {
  const DEFAULTS = { n: 50 };

  // ---- input normalisation -------------------------------------------------
  // Accepts H/T or 1/0 (any case). Ignores spaces, commas, newlines and a few other
  // separators. Anything else is counted in `bad` (and not added to the sequence).
  const SEPARATORS = /[\s,;.|\-_\/]/;
  function normalize(text) {
    let bits = "", bad = 0;
    for (const ch of String(text == null ? "" : text)) {
      if (ch === "H" || ch === "h" || ch === "1") bits += "1";
      else if (ch === "T" || ch === "t" || ch === "0") bits += "0";
      else if (!SEPARATORS.test(ch)) bad++;
    }
    return { bits, bad };
  }
  const toText = (bits) => bits.replace(/1/g, "H").replace(/0/g, "T");
  // "HTHHT THTHH ..." in groups of 10 for readability
  const grouped = (bits, g) => toText(bits).replace(new RegExp(".{1," + (g || 10) + "}", "g"), "$& ").trim();
  const isValid = (bits, n) => new RegExp("^[01]{" + (n || DEFAULTS.n) + "}$").test(bits);

  // ---- statistics ----------------------------------------------------------
  function runLengths(bits) {
    const out = []; let k = 0;
    for (let i = 0; i < bits.length; i++) {
      if (i > 0 && bits[i] === bits[i - 1]) k++; else { if (k) out.push(k); k = 1; }
    }
    if (k) out.push(k);
    return out;
  }
  const longestRun = (bits) => runLengths(bits).reduce((m, x) => Math.max(m, x), 0);
  const numRuns = (bits) => runLengths(bits).length;
  const switches = (bits) => Math.max(0, numRuns(bits) - 1);
  const switchRate = (bits) => bits.length > 1 ? switches(bits) / (bits.length - 1) : null;
  const heads = (bits) => (bits.match(/1/g) || []).length;
  function stats(bits) {
    return { longest: longestRun(bits), runs: numRuns(bits), switches: switches(bits), switchRate: switchRate(bits), heads: heads(bits) };
  }

  // ---- generators ----------------------------------------------------------
  // Real random bits from the browser's CSPRNG (falls back to Math.random).
  function randomBits(n) {
    const c = root.crypto || (typeof require === "function" ? require("crypto").webcrypto : null);
    let s = "";
    if (c && c.getRandomValues) {
      const a = new Uint8Array(n); c.getRandomValues(a);
      for (let i = 0; i < n; i++) s += a[i] & 1;
    } else for (let i = 0; i < n; i++) s += Math.random() < 0.5 ? "1" : "0";
    return s;
  }
  // Human-like "random": switches with probability pSwitch and never lets a run exceed maxRun.
  function humanBits(n, rng, pSwitch, maxRun) {
    rng = rng || Math.random; pSwitch = pSwitch == null ? 0.62 : pSwitch; maxRun = maxRun || 4;
    let cur = rng() < 0.5 ? 1 : 0, run = 1, s = String(cur);
    for (let i = 1; i < n; i++) {
      if (run >= maxRun || rng() < pSwitch) { cur = 1 - cur; run = 1; } else run++;
      s += cur;
    }
    return s;
  }
  // fair coin with an injectable RNG (for simulations and tests)
  function fairBits(n, rng) { rng = rng || Math.random; let s = ""; for (let i = 0; i < n; i++) s += rng() < 0.5 ? "1" : "0"; return s; }

  // mulberry32 seeded RNG
  function seeded(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- simulation of a fair coin -------------------------------------------
  // Returns the distribution of the longest run and the mean switch rate over `sims` sequences of n flips.
  function simulate(n, sims, rng) {
    n = n || DEFAULTS.n; sims = sims || 20000; rng = rng || Math.random;
    const dist = Array(n + 2).fill(0); let sumL = 0, sumS = 0, sumS2 = 0;
    for (let t = 0; t < sims; t++) {
      let prev = rng() < 0.5, run = 1, longest = 1, sw = 0;
      for (let i = 1; i < n; i++) {
        const b = rng() < 0.5;
        if (b === prev) { run++; if (run > longest) longest = run; } else { sw++; run = 1; prev = b; }
      }
      dist[longest]++; sumL += longest;
      const r = sw / (n - 1); sumS += r; sumS2 += r * r;
    }
    const meanS = sumS / sims;
    const pAtLeast = (k) => { let c = 0; for (let j = k; j < dist.length; j++) c += dist[j]; return c / sims; };
    return { n, sims, dist: dist.map((c) => c / sims), meanLongest: sumL / sims, pAtLeast,
             meanSwitch: meanS, sdSwitch: Math.sqrt(Math.max(0, sumS2 / sims - meanS * meanS)) };
  }

  // ---- grading -------------------------------------------------------------
  // rows: [{truth: "real"|"fake", guess: "real"|"fake"|null}]
  function confusion(rows) {
    const m = { realReal: 0, realFake: 0, fakeReal: 0, fakeFake: 0, guessed: 0, correct: 0, total: rows.length };
    rows.forEach((r) => {
      if (r.guess !== "real" && r.guess !== "fake") return;
      m.guessed++;
      if (r.truth === r.guess) m.correct++;
      m[r.truth + (r.guess === "real" ? "Real" : "Fake")]++;     // rows = truth, columns = guess
    });
    return m;
  }
  // The classroom heuristic: no run of 5 or more -> guess "fake"; otherwise "real".
  const heuristicGuess = (bits, minRun) => longestRun(bits) >= (minRun || 5) ? "real" : "fake";

  // ---- demo data -----------------------------------------------------------
  // `count` synthetic submissions: half true random, half human-like (switch prob ~0.62, max run 4), shuffled.
  function demoSubs(n, count, rng) {
    rng = rng || Math.random; n = n || DEFAULTS.n; count = count || 20;
    const kinds = Array.from({ length: count }, (_, i) => i % 2 ? "fake" : "real");
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    return kinds.map((k) => ({ truth: k, bits: k === "real" ? fairBits(n, rng) : humanBits(n, rng, 0.62, 4) }));
  }

  const API = { DEFAULTS, normalize, toText, grouped, isValid, runLengths, longestRun, numRuns, switches, switchRate, heads, stats,
                randomBits, humanBits, fairBits, seeded, simulate, confusion, heuristicGuess, demoSubs };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.COINFLIP = API;
})(typeof window !== "undefined" ? window : globalThis);
