// Instructor dashboard: The Broken Vase (coin-flip game)
// Before the reveal: anonymous sequences + Real/Fake guess buttons. No stats, no truth, no names.
// After the reveal: truth, guess, run statistics, confusion matrix, charts and a teaching panel.
(function () {
  const C = COINFLIP, D = C.DEFAULTS;
  const REAL = "#00533e", FAKE = "#7a5bb5";
  const simCache = {};

  const css = document.createElement("style");
  css.textContent = `
  .seqrow{display:grid;grid-template-columns:110px 1fr auto;gap:6px 14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule)}
  .seqrow .no{font-weight:700;white-space:nowrap}
  .seqrow .raw{grid-column:2;font-size:12px;color:var(--muted);word-break:break-all}
  .seqrow .gb{grid-row:1;grid-column:3;display:flex;gap:6px}
  .strip{display:flex;gap:2px}
  .strip i{flex:1 1 0;min-width:11px;max-width:18px;height:22px;border-radius:3px;font:700 9px/22px ui-monospace,Menlo,monospace;text-align:center;font-style:normal;color:#fff;background:var(--h)}
  .strip i.t{background:var(--t);color:#4a3600}
  .gb button.sel.real{background:${REAL};color:#fff;border-color:${REAL}}
  .gb button.sel.fake{background:${FAKE};color:#fff;border-color:${FAKE}}
  .pill{white-space:nowrap}
  .pill.real{background:#d6ece4;color:${REAL}} .pill.fake{background:#e6def5;color:#4f3a86}
  .legend-sq{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin:0 3px 0 8px}
  table.conf td,table.conf th{text-align:center}
  td.strip-cell{min-width:300px;text-align:left}
  .ok-mark{color:var(--good);font-weight:700} .bad-mark{color:var(--bad);font-weight:700}
  @media (max-width:760px){.seqrow{grid-template-columns:1fr}.seqrow .raw,.seqrow .gb{grid-column:1;grid-row:auto}}`;
  document.head.appendChild(css);

  const strip = (bits) => `<div class="strip">${bits.split("").map((b) => b === "1" ? `<i>H</i>` : `<i class="t">T</i>`).join("")}</div>`;
  const pill = (v) => v === "real" ? `<span class="pill real">Real</span>` : v === "fake" ? `<span class="pill fake">Made up</span>` : `<span class="muted">–</span>`;

  // anonymous, stably numbered list of submissions
  function subsOf(data) {
    const P = Object.fromEntries((data.players || []).map((p) => [p.id, p]));
    return (data.subs || []).filter((s) => s.kind === "main" && s.data && typeof s.data.seq === "string")
      .sort((a, b) => (a.id > b.id) - (a.id < b.id))
      .map((s, i) => ({ id: s.id, no: i + 1, bits: s.data.seq, truth: s.label, guess: s.guess || null, nick: (P[s.player_id] || {}).nickname || "",
        created_at: s.created_at, updated_at: s.updated_at, st: C.stats(s.data.seq) }));
  }

  function render(el, session, data, act) {
    const P = { ...D, ...session.params }, n = P.n, subs = subsOf(data), revealed = !!session.revealed;
    const sig = JSON.stringify([session.id, revealed, n, (data.players || []).length, subs.map((s) => [s.id, s.bits, s.truth, s.guess])]);
    const root0 = el.firstElementChild;
    if (root0 && root0.__sig === sig) return;                    // nothing changed: keep the DOM (and scroll position)
    DK.reset();
    const root = document.createElement("div"); root.__sig = sig;
    root.innerHTML = revealed ? revealedHtml(session, data, subs, P) : hiddenHtml(session, data, subs, P);
    el.innerHTML = ""; el.appendChild(root);
    if (revealed) drawCharts(root, subs, P); else wireGuess(root, subs, act);
    const $ = (id) => root.querySelector("#" + id);
    const rb = $("btnReveal");
    if (rb) rb.onclick = async () => {
      const open = subs.filter((s) => !s.guess).length;
      if (!subs.length) { alert("No submissions yet."); return; }
      if (open && !confirm(`${open} of ${subs.length} sequences still have no guess. Reveal anyway? Students can no longer submit or change their sequence after the reveal.`)) return;
      rb.disabled = true;
      try { await act.setRevealed(true); } catch (e) { alert(e.message); rb.disabled = false; }
    };
    const hb = $("btnHide");
    if (hb) hb.onclick = async () => { try { await act.setRevealed(false); } catch (e) { alert(e.message); } };
  }

  // ------------------------------------------------------------ before the reveal
  function hiddenHtml(session, data, subs, P) {
    const guessed = subs.filter((s) => s.guess).length;
    return DK.kpis([["Joined", (data.players || []).length], ["Submitted", subs.length], ["Your guesses", `${guessed} / ${subs.length}`]]) +
      `<div class="card"><div class="toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <h2 style="margin:0;flex:1">Sequences (anonymous)</h2>
        <button class="gold" id="btnReveal" ${subs.length ? "" : "disabled"}>Reveal</button></div>
       <p class="small muted" style="margin:8px 0 0">Each student submitted ONE sequence of ${P.n} flips, either from a real coin or invented by hand. Decide by eye, record your guess, and explain how you decided. Truth, names and statistics stay hidden until you press <b>Reveal</b> (which also locks student submissions).
       <span class="legend-sq" style="background:var(--h)"></span>H <span class="legend-sq" style="background:var(--t)"></span>T</p>
       <div id="list">${subs.length ? subs.map((s) => `<div class="seqrow" data-id="${DK.esc(s.id)}"><div class="no">Sequence #${s.no}</div>${strip(s.bits)}
         <div class="gb"><button class="ghost sm real ${s.guess === "real" ? "sel" : ""}" data-g="real">Real</button><button class="ghost sm fake ${s.guess === "fake" ? "sel" : ""}" data-g="fake">Fake</button></div>
         <div class="raw mono">${C.grouped(s.bits)}</div></div>`).join("") : `<p class="muted" style="margin-top:14px">Waiting for submissions. Students join with code <b>${DK.esc(session.code)}</b>.</p>`}</div></div>`;
  }
  function wireGuess(root, subs, act) {
    root.querySelectorAll(".seqrow").forEach((row) => {
      const s = subs.find((x) => String(x.id) === row.dataset.id);
      row.querySelectorAll("button[data-g]").forEach((b) => b.onclick = async () => {
        const g = b.dataset.g === s.guess ? null : b.dataset.g;     // click again to clear
        row.querySelectorAll("button").forEach((x) => x.disabled = true);
        try { await act.setGuess(s.id, g); } catch (e) { alert(e.message); }
        await act.reload();
      });
    });
  }

  // ------------------------------------------------------------ after the reveal
  function simFor(n) { return simCache[n] || (simCache[n] = C.simulate(n, 20000)); }
  function revealedHtml(session, data, subs, P) {
    const n = P.n, sim = simFor(n), conf = C.confusion(subs.map((s) => ({ truth: s.truth, guess: s.guess })));
    const real = subs.filter((s) => s.truth === "real"), fake = subs.filter((s) => s.truth === "fake");
    const m = (arr, k) => DK.mean(arr.map((s) => s.st[k]));
    const hit = subs.filter((s) => C.heuristicGuess(s.bits, 5) === s.truth).length;
    const ge5 = (arr) => arr.length ? arr.filter((s) => s.st.longest >= 5).length / arr.length : null;
    const row = (s) => [`#${s.no}`, `<div class="strip">${s.bits.split("").map((b) => b === "1" ? `<i>H</i>` : `<i class="t">T</i>`).join("")}</div>`,
      pill(s.truth), pill(s.guess), s.guess ? (s.guess === s.truth ? `<span class="ok-mark">✓</span>` : `<span class="bad-mark">✗</span>`) : "–",
      s.st.longest, s.st.runs, DK.f(s.st.switchRate, 2)];
    const tbl = `<div class="scroll"><table><tr><th>Seq</th><th>${n} flips</th><th>Truth</th><th>Your guess</th><th>Right?</th><th>Longest run</th><th>Runs</th><th>Switch rate</th></tr>
      ${subs.map((s) => { const r = row(s); return `<tr>${r.map((c, i) => `<td class="${i === 1 ? "strip-cell" : ""}" style="${i < 2 ? "text-align:left" : "text-align:center"}">${c}</td>`).join("")}</tr>`; }).join("")}</table></div>`;
    const cm = `<table class="conf"><tr><th></th><th colspan="2">You guessed</th></tr><tr><th>Truth</th><th>Real</th><th>Made up</th></tr>
      <tr><th style="text-align:left">Real (${real.length})</th><td><b>${conf.realReal}</b></td><td>${conf.realFake}</td></tr>
      <tr><th style="text-align:left">Made up (${fake.length})</th><td>${conf.fakeReal}</td><td><b>${conf.fakeFake}</b></td></tr></table>
      <p class="small muted">Correct guesses are on the diagonal. Real sequences you called "Made up": ${conf.realFake}. Made-up sequences you called "Real": ${conf.fakeReal}.${conf.guessed < subs.length ? ` (${subs.length - conf.guessed} sequences had no guess and are not counted.)` : ""}</p>`;
    return `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">Results</h2>
        <span class="pill open">Revealed</span><button class="ghost sm" id="btnHide">Hide results again</button></div></div>` +
      DK.kpis([["Your accuracy", conf.guessed ? `${conf.correct} / ${conf.guessed} (${DK.pct(conf.correct / conf.guessed)})` : "–"],
        ["Real / made up", `${real.length} / ${fake.length}`],
        ["Avg longest run: real", DK.f(m(real, "longest"), 1)], ["Avg longest run: made up", DK.f(m(fake, "longest"), 1)],
        ["Avg switch rate: real", DK.f(m(real, "switchRate"), 2)], ["Avg switch rate: made up", DK.f(m(fake, "switchRate"), 2)]]) +
      `<div class="grid2">${DK.card("Confusion matrix", cm)}
         ${DK.card("My rule of thumb", `<p style="margin:0 0 8px"><b>"I only looked at the longest streak: no run of 5 or more, so I guessed fake."</b></p>
           <p class="small" style="margin:0">Applied mechanically to this class, that rule gets <b>${hit} / ${subs.length}</b> right (${DK.pct(subs.length ? hit / subs.length : null)}).
           A run of 5+ appears in <b>${DK.pct(ge5(real))}</b> of the real sequences and in <b>${DK.pct(ge5(fake))}</b> of the made-up ones.</p>`)}</div>
       <div class="grid2">${DK.card("Longest run: real vs made up", DK.canvas("cHist", 260))}${DK.card("Switch rate: real vs made up", DK.canvas("cSw", 260) +
          `<p class="small muted" style="margin:6px 0 0">Switch rate = switches ÷ ${n - 1} (a switch is H→T or T→H). Each dot is one sequence; the diamond is the group mean.</p>`)}</div>
       ${DK.card("What should a fair coin do? (simulated)", `<div class="grid2"><div>
          <p style="margin:0 0 8px">In your browser we just simulated <b>${sim.sims.toLocaleString("en-US")}</b> sequences of <b>${n}</b> fair flips:</p>
          <ul class="small" style="margin:0;padding-left:18px">
            <li>Expected longest run ≈ <b>${DK.f(sim.meanLongest, 1)}</b></li>
            <li>P(longest run ≥ 5) ≈ <b>${DK.f(sim.pAtLeast(5), 2)}</b>; P(≥ 6) ≈ ${DK.f(sim.pAtLeast(6), 2)}; P(≥ 7) ≈ ${DK.f(sim.pAtLeast(7), 2)}</li>
            <li>Expected switch rate ≈ <b>${DK.f(sim.meanSwitch, 2)}</b> (theory: 0.50; sd ≈ ${DK.f(sim.sdSwitch, 2)})</li>
          </ul>
          <p class="small" style="margin:10px 0 0"><b>Humans</b> typically switch too often (≈ 0.6) and avoid long runs, rarely writing more than 3 or 4 of the same symbol in a row. A real coin produces streaks that feel "too streaky" to be random.</p>
          </div><div>${DK.canvas("cSim", 200)}</div></div>`)}
       ${DK.card("Debrief", `<ol class="small" style="margin:0;padding-left:18px">
          <li><b>How did mom know?</b> Truly random sequences contain long runs. Invented ones are too "evenly mixed": too many switches, too few long streaks.</li>
          <li><b>Ask the class:</b> what did you do to make your invented sequence look random? What did you look at when guessing?</li>
          <li><b>One simple statistic</b> (longest run) already beats guessing. Combining it with the switch rate does better still.</li>
          <li><b>Fraud analytics link:</b> fabricated data tends to be "too clean". Checking whether data has the irregularity real processes produce (runs here, leading digits next) is a standard way to flag manipulation.</li>
          <li><b>Caution:</b> a flag is evidence for a closer look, not proof. Some real sequences have no run of 5 (about ${DK.pct(1 - sim.pAtLeast(5))}), and some people fake well.</li></ol>`)}
       ${DK.card("All sequences", tbl)}`;
  }

  function drawCharts(root, subs, P) {
    const n = P.n, sim = simFor(n), $ = (id) => root.querySelector("#" + id);
    const real = subs.filter((s) => s.truth === "real"), fake = subs.filter((s) => s.truth === "fake");
    const maxL = Math.max(9, ...subs.map((s) => s.st.longest)), xs = Array.from({ length: maxL }, (_, i) => i + 1);
    const count = (arr, k) => arr.filter((s) => s.st.longest === k).length;
    DK.chart($("cHist"), { type: "bar", data: { labels: xs, datasets: [
      { label: `Real (${real.length})`, data: xs.map((k) => count(real, k)), backgroundColor: REAL },
      { label: `Made up (${fake.length})`, data: xs.map((k) => count(fake, k)), backgroundColor: FAKE }] },
      options: { scales: { x: { title: { display: true, text: "Longest run of the same symbol" } }, y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Sequences" } } } } });
    DK.chart($("cSim"), { type: "bar", data: { labels: xs, datasets: [{ label: "Fair coin: % of sequences", data: xs.map((k) => +(100 * (sim.dist[k] || 0)).toFixed(2)), backgroundColor: "#8aa39a" }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: "Fair coin: longest run (% of simulated sequences)" } },
        scales: { x: { title: { display: true, text: "Longest run" } }, y: { beginAtZero: true, ticks: { callback: (v) => v + "%" } } } } });
    const jit = (i, len) => (((i * 0.618034) % 1) - 0.5) * 0.5;    // deterministic horizontal jitter
    const dots = (arr, x) => arr.map((s, i) => ({ x: x + jit(i), y: s.st.switchRate }));
    const mean = (arr) => DK.mean(arr.map((s) => s.st.switchRate));
    DK.chart($("cSw"), { type: "scatter", data: { datasets: [
      { label: "Real", data: dots(real, 0), backgroundColor: REAL + "cc", pointRadius: 5 },
      { label: "Made up", data: dots(fake, 1), backgroundColor: FAKE + "cc", pointRadius: 5 },
      { label: "Group mean", data: [{ x: 0, y: mean(real) }, { x: 1, y: mean(fake) }], backgroundColor: "#18201d", pointStyle: "rectRot", pointRadius: 9 },
      { label: "Fair coin: 0.5", type: "line", data: [{ x: -0.6, y: 0.5 }, { x: 1.6, y: 0.5 }], borderColor: "#5d6762", borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }] },
      options: { scales: { x: { min: -0.6, max: 1.6, ticks: { stepSize: 1, callback: (v) => v === 0 ? "Real" : v === 1 ? "Made up" : "" }, grid: { display: false } },
        y: { min: 0, max: 1, title: { display: true, text: "Switch rate" } } } } });
  }

  // ------------------------------------------------------------ CSV
  function csvRows(session, data) {
    return subsOf(data).map((s) => ({ session: session.code, seq_no: s.no, nickname: s.nick, sequence: C.toText(s.bits), truth: s.truth, guess: s.guess,
      correct: s.guess ? (s.guess === s.truth ? 1 : 0) : "", longest_run: s.st.longest, runs: s.st.runs, switch_rate: +s.st.switchRate.toFixed(4),
      submitted_at: s.created_at, updated_at: s.updated_at }));
  }

  // ------------------------------------------------------------ demo (rehearsal) data
  function demo(session) {
    const P = { ...D, ...session.params }, players = DK.fakePlayers(20), now = Date.now();
    const subs = C.demoSubs(P.n, 20).map((d, i) => ({ id: i + 1, player_id: players[i].id, kind: "main", data: { seq: d.bits }, label: d.truth, guess: null,
      created_at: new Date(now - (20 - i) * 20000).toISOString(), updated_at: new Date(now - (20 - i) * 20000).toISOString() }));
    return { players, subs };
  }

  window.FRAUD_GAMES.coinflip = { key: "coinflip", title: "The Broken Vase", codePrefix: "FLIP", defaults: D,
    params: [{ key: "n", label: "Sequence length (flips)", type: "number", min: 20, max: 100, step: 1 }],
    render, demo, csvRows };
})();
