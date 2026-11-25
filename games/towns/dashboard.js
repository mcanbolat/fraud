// Instructor dashboard: Invent a Town.
// Before the reveal: counts, and (optional, hidden by default) the pooled first-digit chart.
// After the reveal: pooled class vs Benford vs US Census, MAD/chi-square, last digits, per-student table, fun facts.
(function () {
  const T = TOWNS, B = BENFORD, D = T.DEFAULTS;
  const FAKE = "#7a5bb5", CEN = "#00533e", BEN = "#d08a00";
  const showPooled = {};                         // session id -> bool (toggle, default hidden)
  let census = null, censusErr = null, censusP = null;

  const css = document.createElement("style");
  css.textContent = `.best td{background:var(--goldsoft);font-weight:700}.vdl{font-weight:600}`;
  document.head.appendChild(css);

  function loadCensus() {
    if (!censusP) censusP = fetch(new URL("games/benford/data/us_census_2017.csv", location.href).href)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then((t) => { const v = B.parseCensus(t).map((r) => r.pop2010).filter((x) => x != null && x > 0); census = { values: v, first: B.analyze(v, "first"), median: T.median(v) }; })
      .catch((e) => { censusErr = e.message; });
    return censusP;
  }

  function subsOf(data) {
    const P = Object.fromEntries((data.players || []).map((p) => [p.id, p]));
    return (data.subs || []).filter((s) => s.kind === "main" && s.data && Array.isArray(s.data.nums) && s.data.nums.length)
      .sort((a, b) => (a.id > b.id) - (a.id < b.id))
      .map((s) => ({ id: s.id, nick: (P[s.player_id] || {}).nickname || "", nums: s.data.nums, st: T.stats(s.data.nums), created_at: s.created_at, updated_at: s.updated_at }));
  }

  let last = null;
  function render(el, session, data, act) {
    last = { el, session, data, act };
    const subs = subsOf(data), revealed = !!session.revealed, show = revealed || !!showPooled[session.id];
    if (show && !census && !censusErr) loadCensus().then(() => act.reload());
    const sig = JSON.stringify([session.id, revealed, show, !!census, censusErr, (data.players || []).length, subs.map((s) => [s.id, s.nick, s.nums.join(",")])]);
    const root0 = el.firstElementChild;
    if (root0 && root0.__sig === sig) return;
    DK.reset();
    const root = document.createElement("div"); root.__sig = sig;
    const pooled = [].concat(...subs.map((s) => s.nums));
    root.innerHTML = head(session, data, subs, revealed, show) + (show ? body(subs, pooled, revealed) : "");
    el.innerHTML = ""; el.appendChild(root);
    if (show) draw(root, pooled);
    const $ = (id) => root.querySelector("#" + id);
    const tb = $("btnPool"); if (tb) tb.onclick = () => { showPooled[session.id] = !showPooled[session.id]; render(last.el, last.session, last.data, last.act); };
    const rb = $("btnReveal");
    if (rb) rb.onclick = async () => {
      if (!subs.length) { alert("No submissions yet."); return; }
      if (!confirm(`Reveal now? ${subs.length} students have submitted. Students can no longer submit or change their numbers after the reveal.`)) return;
      rb.disabled = true;
      try { await act.setRevealed(true); } catch (e) { alert(e.message); rb.disabled = false; }
    };
    const hb = $("btnHide");
    if (hb) hb.onclick = async () => { try { await act.setRevealed(false); } catch (e) { alert(e.message); } };
  }

  function head(session, data, subs, revealed, show) {
    if (revealed) return `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;flex:1">Results</h2>
        <span class="pill open">Revealed</span><button class="ghost sm" id="btnHide">Hide results again</button></div></div>`;
    return DK.kpis([["Joined", (data.players || []).length], ["Submitted", subs.length], ["Numbers collected", subs.reduce((s, x) => s + x.nums.length, 0)]]) +
      `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <h2 style="margin:0;flex:1">Invent a Town</h2>
        <button class="ghost sm" id="btnPool">${show ? "Hide pooled chart" : "Show pooled chart"}</button>
        <button class="gold" id="btnReveal" ${subs.length ? "" : "disabled"}>Reveal</button></div>
       <p class="small muted" style="margin:8px 0 0">Each student invents ${D.n} town populations. The pooled chart is hidden by default so the projector does not spoil the game. <b>Reveal</b> shows the full analysis (and the class results on student phones) and locks submissions.</p>
       ${subs.length ? "" : `<p class="muted" style="margin:10px 0 0">Waiting for submissions. Students join with code <b>${DK.esc(session.code)}</b>.</p>`}</div>`;
  }

  const verdictCls = (v) => v === B.VERDICTS[0] ? "ok" : v === B.VERDICTS[3] ? "err" : "";
  const vtxt = (v) => `<span class="vdl ${verdictCls(v)}">${v || "–"}</span>`;

  function body(subs, pooled, revealed) {
    if (!subs.length) return "";
    const ps = T.stats(pooled), a = ps.first, ce = census && census.first;
    const chi = (x) => `χ² = ${DK.f(x.chi2, 1)} (df ${x.df}), p ${x.p < 0.0001 ? "< 0.0001" : "= " + DK.f(x.p, 4)}`;
    const kp = [["Students", subs.length], ["Pooled numbers", pooled.length], ["Class MAD (first digit)", DK.f(a.mad, 4)], ["Class verdict", vtxt(a.verdict)]];
    if (ce) kp.push(["US Census MAD", DK.f(ce.mad, 4)], ["Census verdict", vtxt(ce.verdict)]);
    let h = DK.kpis(kp);
    h += `<div class="grid2">` + DK.card("First digit: class vs expected vs US Census", DK.canvas("cFirst", 300) +
      `<p class="small muted" style="margin:6px 0 0">${censusErr ? `Census data could not be loaded (${DK.esc(censusErr)}).` : census ? `US Census: ${census.values.length.toLocaleString("en-US")} places (2010 population, zero or missing excluded).` : "Loading US Census data..."}</p>`) +
      DK.card("How close? (class pooled vs census)", `<table><tr><th></th><th>MAD</th><th>Verdict (Nigrini)</th><th>Chi-square</th></tr>
         <tr><td>Class (invented), n = ${pooled.length}</td><td>${DK.f(a.mad, 4)}</td><td>${vtxt(a.verdict)}</td><td class="small">${chi(a)}</td></tr>
         <tr><td>US Census, n = ${ce ? census.values.length.toLocaleString("en-US") : "…"}</td><td>${ce ? DK.f(ce.mad, 4) : "–"}</td><td>${ce ? vtxt(ce.verdict) : "–"}</td><td class="small">${ce ? chi(ce) : ""}</td></tr></table>
         <p class="small muted" style="margin:8px 0 0">MAD (mean absolute deviation of the 9 digit shares from the expected pattern) is the better yardstick: with a huge sample chi-square rejects almost anything, even real data. Nigrini's bands for the first digit: below 0.006 close, to 0.012 acceptable, to 0.015 marginal, above 0.015 nonconformity.</p>`) + `</div>`;
    if (!revealed) return h;
    const la = B.analyze(pooled, "last");
    const mode = T.modeDigit(ps.firstCounts, 1), cMed = census ? census.median : null;
    h += DK.kpis([["Most common first digit", mode == null ? "–" : mode], ["Start with 1 (class / expected)", `${DK.pct(ps.start1)} / 30%`],
      ["End in 0", DK.pct(ps.end0) + " (expect ~10%)"], ["End in 0 or 5", DK.pct(ps.end05) + " (expect ~20%)"],
      ["Median invented", T.fmt(ps.median)], ["Median census", cMed == null ? "–" : T.fmt(cMed)]]);
    h += `<div class="grid2">` + DK.card("Last digit: class vs expected", DK.canvas("cLast", 280) +
      `<p class="small muted" style="margin:6px 0 0">Real counts end in every digit about equally (about 10% each). Invented numbers heap on 0 and 5. Last-digit chi-square: ${chi(la)}.</p>`) +
      DK.card("Who faked best?", `<p class="small muted" style="margin:0 0 8px">Students sorted by first-digit MAD (lowest = closest to real data). With only ${D.n} numbers each, one student's verdict is noisy; the pooled class is the stronger test.</p>${studentTable(subs)}`) + `</div>`;
    return h;
  }

  function studentTable(subs) {
    const rows = subs.slice().sort((x, y) => x.st.mad - y.st.mad);
    return `<div class="scroll"><table><tr><th>Student</th><th>MAD</th><th>Verdict</th><th>End in 0/5</th><th>Start with 1</th></tr>${rows.map((s, i) =>
      `<tr class="${i === 0 ? "best" : ""}"><td>${i === 0 ? "★ " : ""}${DK.esc(s.nick)}${i === 0 ? " (best faker)" : ""}</td><td>${DK.f(s.st.mad, 4)}</td><td>${vtxt(s.st.verdict)}</td><td>${DK.pct(s.st.end05)}</td><td>${DK.pct(s.st.start1)}</td></tr>`).join("")}</table></div>`;
  }

  function draw(root, pooled) {
    const $ = (id) => root.querySelector("#" + id), a = B.analyze(pooled, "first"), ce = census && census.first;
    if (!$("cFirst")) return;
    const pc = (x) => +(x * 100).toFixed(2);
    const ds = [{ label: `Class invented (n=${a.n})`, data: a.props.map(pc), backgroundColor: FAKE, order: 2 }];
    if (ce) ds.push({ label: "US Census (actual)", data: ce.props.map(pc), backgroundColor: CEN, order: 2 });
    ds.push({ label: "Expected for real data", type: "line", data: a.expected.map(pc), borderColor: BEN, backgroundColor: BEN, borderWidth: 2, pointRadius: 4, order: 1 });
    const opts = (xt) => ({ scales: { x: { title: { display: true, text: xt } }, y: { beginAtZero: true, ticks: { callback: (v) => v + "%" }, title: { display: true, text: "% of numbers" } } } });
    DK.chart($("cFirst"), { type: "bar", data: { labels: a.digits, datasets: ds }, options: opts("First digit") });
    const la = B.analyze(pooled, "last");
    if ($("cLast")) DK.chart($("cLast"), { type: "bar", data: { labels: la.digits, datasets: [
      { label: "Class invented", data: la.props.map(pc), backgroundColor: FAKE, order: 2 },
      { label: "Expected for real data", type: "line", data: la.expected.map(pc), borderColor: BEN, backgroundColor: BEN, borderWidth: 2, pointRadius: 4, order: 1 }] }, options: opts("Last digit") });
  }

  function csvRows(session, data) {
    return [].concat(...subsOf(data).map((s) => T.numberRows(session.code, s.nick, s.nums)));
  }
  function csvSummary(session, data) {
    return subsOf(data).map((s) => ({ session: session.code, nickname: s.nick, n: s.st.n, first_digit_mad: +s.st.mad.toFixed(5), verdict: s.st.verdict,
      chi2: +s.st.chi2.toFixed(3), chi2_p: +s.st.p.toFixed(5), share_end_0: +s.st.end0.toFixed(4), share_end_0_or_5: +s.st.end05.toFixed(4),
      share_start_1: +s.st.start1.toFixed(4), median: s.st.median, submitted_at: s.created_at, updated_at: s.updated_at }));
  }

  function demo(session) {
    const players = DK.fakePlayers(25), now = Date.now(), cls = T.demoClass(25, 20260);
    const subs = cls.map((nums, i) => ({ id: i + 1, player_id: players[i].id, kind: "main", data: { nums }, label: null, guess: null,
      created_at: new Date(now - (25 - i) * 15000).toISOString(), updated_at: new Date(now - (25 - i) * 15000).toISOString() }));
    return { players, subs };
  }

  window.FRAUD_GAMES.towns = { key: "towns", title: "Invent a Town", codePrefix: "TOWN", defaults: D,
    params: [{ key: "n", label: "Towns per student", type: "number", min: 10, max: 100, step: 1 }],
    render, demo, csvRows, csvSummary };
})();
