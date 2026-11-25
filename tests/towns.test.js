const assert = require("assert"), T = require("../games/towns/model.js"), B = require("../games/benford/benford.js");
const nums = (s) => T.parse(s).nums, bad = (s) => T.parse(s).invalid.map((x) => x.token);
// separators
assert.deepStrictEqual(nums("12 345\n6789;10"), [12, 345, 6789, 10]);
assert.deepStrictEqual(nums("  500\r\n1200\t30 "), [500, 1200, 30]);
// thousands commas vs list commas
assert.deepStrictEqual(nums("12,345 1,234,567"), [12345, 1234567]);
assert.deepStrictEqual(nums("500,1200,300"), [500, 1200, 300]);
assert.deepStrictEqual(nums("500, 1200, 300,"), [500, 1200, 300]);
assert.deepStrictEqual(nums("1,234,5"), [1, 234, 5]);
// rejections
assert.deepStrictEqual(bad("1.5 2. .5 -3 abc 0 50000001 12e3 7"), ["1.5", "2.", ".5", "-3", "abc", "0", "50000001", "12e3"]);
assert.deepStrictEqual(nums("1.5 -3 0 7 50000000"), [7, 50000000]);
assert.deepStrictEqual(T.parse("").nums, []); assert.deepStrictEqual(T.parse(null).invalid, []);
assert.strictEqual(T.parse("-5").invalid[0].reason, "negative"); assert.strictEqual(T.parse("1.5").invalid[0].reason, "decimal");
assert.strictEqual(T.parse("1 1 1").nums.length, 3);
// validation
const ok = Array.from({ length: 50 }, (_, i) => i + 1);
assert.ok(T.isValidNums(ok)); assert.ok(!T.isValidNums(ok.slice(1))); assert.ok(!T.isValidNums(ok.map((x) => x === 3 ? 0 : x)));
assert.ok(!T.isValidNums(ok.map((x) => x === 3 ? 1.5 : x))); assert.ok(!T.isValidNums(ok.map((x) => x === 3 ? 5e7 + 1 : x))); assert.ok(!T.isValidNums("x"));
assert.strictEqual(T.fmt(1234567), "1,234,567");
// stats
const s = T.stats([10, 15, 20, 100, 1500, 7, 12345]);
assert.strictEqual(s.n, 7); assert.deepStrictEqual(s.firstCounts, [5, 1, 0, 0, 0, 0, 1, 0, 0]);
assert.strictEqual(s.lastCounts[0], 4); assert.strictEqual(s.lastCounts[5], 2);
assert.ok(Math.abs(s.end0 - 4 / 7) < 1e-12 && Math.abs(s.end05 - 6 / 7) < 1e-12 && Math.abs(s.start1 - 5 / 7) < 1e-12);
assert.strictEqual(T.median([3, 1, 2]), 2); assert.strictEqual(T.median([4, 1, 2, 3]), 2.5); assert.strictEqual(T.median([]), null);
assert.strictEqual(T.modeDigit([1, 5, 2], 1), 2); assert.strictEqual(T.modeDigit([0, 0], 1), null);
// perfect Benford sample has tiny MAD; uniform digits do not
const bs = []; for (let d = 1; d <= 9; d++) for (let i = 0; i < Math.round(B.TESTS.first.expected(d) * 1e4); i++) bs.push(d * 100 + 7);
assert.ok(T.stats(bs).mad < 1e-3);
const rows = T.numberRows("TOWN1", "Ava", [1234, 50]); assert.deepStrictEqual(rows[1], { session: "TOWN1", nickname: "Ava", index: 2, value: 50, first_digit: 5, last_digit: 0 });
// demo class: valid, human-like (nonconforming, round numbers common)
const cls = T.demoClass(25, 1); assert.strictEqual(cls.length, 25);
cls.forEach((c) => assert.ok(T.isValidNums(c)));
const pooled = [].concat(...cls), ps = T.stats(pooled);
assert.strictEqual(ps.verdict, "Nonconformity"); assert.ok(ps.end0 > 0.25, "end0 " + ps.end0); assert.ok(ps.start1 < 0.25);
console.log("towns tests ok; demo pooled MAD", ps.mad.toFixed(4), ps.verdict, "end0", ps.end0.toFixed(2), "start1", ps.start1.toFixed(2));
