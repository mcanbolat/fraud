const assert = require("assert"), B = require("../games/benford/benford.js");
const near = (a, b, t) => assert.ok(Math.abs(a - b) < (t || 1e-6), a + " vs " + b);
// digits
assert.strictEqual(B.firstDigit(0.00345), 3); assert.strictEqual(B.firstDigit(-9876), 9); assert.strictEqual(B.firstDigit(0), null);
assert.strictEqual(B.firstDigit(2.9999999999999996), 3); assert.strictEqual(B.firstDigit(1e21), 1);
assert.strictEqual(B.secondDigit(0.00345), 4); assert.strictEqual(B.secondDigit(3), 0); assert.strictEqual(B.secondDigit(-1999), 9); assert.strictEqual(B.secondDigit(10), 0);
assert.strictEqual(B.firstTwo(0.00345), 34); assert.strictEqual(B.firstTwo(7), 70); assert.strictEqual(B.firstTwo(-12345), 12);
assert.strictEqual(B.lastDigit(1234), 4); assert.strictEqual(B.lastDigit(-1235), 5); assert.strictEqual(B.lastDigit(9), null);
assert.strictEqual(B.lastDigit(10), 0); assert.strictEqual(B.lastDigit(12.37), 7);
// parsing
assert.strictEqual(B.parseNum("1,234"), 1234); assert.strictEqual(B.parseNum("A"), null); assert.strictEqual(B.parseNum(""), null); assert.strictEqual(B.parseNum("$5.5"), 5.5);
const rows = B.parseDelimited('a,b\n1,"x, y"\r\n2,"he said ""hi"""\n', ",");
assert.deepStrictEqual(rows, [["a", "b"], ["1", "x, y"], ["2", 'he said "hi"']]);
const t = B.parseTable("name,val\nA,1000\nB,2,000\n"); assert.ok(t.columns.length >= 1);
assert.deepStrictEqual(B.parseTable("1,234\n5,678\n").columns[0].values, [1234, 5678]);
const c = B.clean([5, 0, null, 7]); assert.deepStrictEqual([c.values.length, c.zero, c.missing], [2, 1, 1]);
// chi-square p-values (critical values)
near(B.chiSqP(15.507, 8), 0.05, 1e-3); near(B.chiSqP(3.841, 1), 0.05, 1e-3); near(B.chiSqP(16.919, 9), 0.05, 1e-3); near(B.chiSqP(0, 5), 1); near(B.chiSqP(122.942, 89), 0.01, 5e-4);
// expected sums
for (const k of ["first", "second", "two", "last"]) { const T = B.TESTS[k]; let s = 0; for (let d = T.lo; d <= T.hi; d++) s += T.expected(d); near(s, 1, 1e-9); }
near(B.TESTS.first.expected(1), 0.30103, 1e-5); near(B.TESTS.second.expected(0), 0.11968, 1e-5);
// analyze exact Benford sample -> MAD ~ 0
const sample = []; for (let d = 1; d <= 9; d++) for (let i = 0; i < Math.round(B.TESTS.first.expected(d) * 1e5); i++) sample.push(d * 10);
const a = B.analyze(sample, "first"); assert.ok(a.mad < 1e-4); assert.strictEqual(a.verdict, "Close conformity");
const u = B.analyze(B.uniformData(5000, 1), "first"); assert.strictEqual(u.verdict, "Nonconformity");
// MAD & verdict boundaries, z
near(B.mad([0.5, 0.5], [0.4, 0.6]), 0.1); assert.strictEqual(B.verdict("first", 0.0061), "Acceptable conformity"); assert.strictEqual(B.verdict("two", 0.0025), "Nonconformity"); assert.strictEqual(B.verdict("last", 0.5), null);
near(B.zStat(0.35, 0.30, 1000), (0.05 - 0.0005) / Math.sqrt(0.3 * 0.7 / 1000), 1e-9); near(B.zStat(0.3001, 0.3, 1000), 0.0001 / Math.sqrt(0.21 / 1000), 1e-9);
// scale invariance on log-uniform data, not on uniform
const r = B.seeded(5), lu = Array.from({ length: 50000 }, () => Math.pow(10, r() * 6));
assert.ok(B.analyze(B.scale(lu, Math.PI), "first").mad < 0.006);
assert.ok(B.analyze(B.scale(B.uniformData(5000, 2), 3.3), "first").mad > 0.015);
// tampering
const tr = B.thresholdInflate([4600, 4999, 5000, 3000], 5000, 0.1, B.seeded(1)); assert.strictEqual(tr.moved, 2); assert.ok(tr.values[0] >= 5000 && tr.values[0] <= 5100 && tr.values[3] === 3000);
assert.deepStrictEqual(B.roundTo([4, 149, 151, 1049], 100), [100, 200, 1000]);
const f = B.fabricate(lu, 0.1, "human", B.seeded(3)); assert.strictEqual(f.replaced, 5000); assert.strictEqual(f.values.length, lu.length);
const bn = B.bunching([4000, 4999, 5000, 6000], 5000); assert.strictEqual(bn.counts.reduce((x, y) => x + y), 3); assert.strictEqual(bn.counts[19], 1); assert.strictEqual(bn.counts[20], 1);
// growth
const g = B.growth(0.12); near(g.total, Math.log(10) / Math.log(1.12), 1e-9); near(g.rows[0].share, 0.30103, 1e-5); near(g.rows.reduce((s, x) => s + x.share, 0), 1, 1e-9);
console.log("benford tests ok");
// last-digit expectation: k-th digit Benford law weighted by number length
{
  const near2 = (a, b, t) => { if (Math.abs(a - b) > t) throw new Error(a + " vs " + b); };
  assert.strictEqual(B.lastPos(4580), 4); assert.strictEqual(B.lastPos(12.37), 4); assert.strictEqual(B.lastPos(9), null);
  near2(B.kthDigitProb(2, 0), B.TESTS.second.expected(0), 1e-12);
  for (const k of [2, 3, 4, 5]) { let s = 0; for (let d = 0; d < 10; d++) s += B.kthDigitProb(k, d); near2(s, 1, 1e-9); }
  const e2 = B.lastExpected([12, 34, 56]); near2(e2[0], B.TESTS.second.expected(0), 1e-12);
  const e4 = B.lastExpected([1234, 5678]); near2(e4[0], 0.1, 0.0005);
  const a = B.analyze([10, 11, 12, 1234], "last"); let s = 0; a.expected.forEach((x) => s += x); near2(s, 1, 1e-9);
}
console.log("last-digit expectation tests ok");
