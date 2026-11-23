// Fraud Analytics games — helpers for instructor dashboard modules.
(function () {
  const charts = [];
  const DK = {
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    mean: (a) => { a = a.filter((x) => x != null && isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; },
    f: (x, d) => x == null || !isFinite(x) ? "–" : Number(x).toFixed(d),
    pct: (x) => x == null || !isFinite(x) ? "–" : Math.round(x * 100) + "%",
    reset() { charts.splice(0).forEach((c) => c.destroy()); },
    chart(canvas, cfg) {
      cfg.options = Object.assign({ maintainAspectRatio: false, animation: false, plugins: { legend: { position: "bottom" } } }, cfg.options || {});
      const c = new Chart(canvas, cfg); charts.push(c); return c;
    },
    kpis: (arr) => `<div class="kpis">${arr.map(([k, v]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>`,
    card: (title, inner, extra) => `<div class="card" ${extra || ""}><h3>${title}</h3>${inner}</div>`,
    canvas: (id, h) => `<div style="height:${h || 240}px"><canvas id="${id}"></canvas></div>`,
    table: (head, rows) => `<div class="scroll"><table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`,
    // demo helper: fake player list
    fakePlayers(n) {
      const names = ["Ava", "Ben", "Cara", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivan", "Jade", "Kai", "Lia", "Milo", "Nora", "Omar", "Pia", "Quin", "Rosa", "Sam", "Tess", "Uri", "Vera", "Wes", "Xena", "Yuri", "Zoe"];
      return Array.from({ length: n }, (_, i) => ({ id: "p" + i, nickname: names[i % names.length] + (i >= names.length ? i : ""), joined_at: new Date().toISOString() }));
    }
  };
  window.DK = DK;
})();
