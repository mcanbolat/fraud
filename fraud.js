// Fraud Analytics games — shared student-side client.
// Talks to Supabase RPC functions (fraud_join, fraud_resume, fraud_submit).
// Without keys in config.js, or with ?demo in the URL, it runs a local demo engine.
(function () {
  const cfg = window.FRAUD_CONFIG || {};
  const DEMO = !cfg.SUPABASE_URL || !cfg.SUPABASE_KEY || /YOUR/.test(cfg.SUPABASE_URL) ||
               new URLSearchParams(location.search).has("demo");
  let sb = null;
  function client() {
    if (!sb) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    return sb;
  }

  // ---- local demo engine (one browser, nothing leaves the device) ----
  function demoEngine(game, defaults) {
    const KEY = "fraud_demo_" + game;
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; } };
    const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
    const view = (st) => { const v = JSON.parse(JSON.stringify(st)); if (!v.session.revealed) v.submissions.forEach((s) => { s.guess = null; }); return v; };
    return {
      fraud_join(a) {
        const st = { player_id: "demo", token: "demo", nickname: a.p_nickname || "Anon" + (1000 + Math.floor(Math.random() * 9000)),
          session: { code: "DEMO", title: "Demo session", game, params: { ...defaults }, is_open: true, revealed: false }, submissions: [] };
        save(st); return view(st);
      },
      fraud_resume() { const st = load(); if (!st) throw new Error("Player not found."); return view(st); },
      fraud_submit(a) {
        const st = load(); if (!st) throw new Error("Player not found.");
        if (st.session.revealed) throw new Error("The instructor has already revealed the results. Submissions are locked.");
        const sub = { kind: a.p_kind, data: a.p_data, label: a.p_label, guess: null, updated_at: new Date().toISOString() };
        const i = st.submissions.findIndex((s) => s.kind === a.p_kind);
        if (i >= 0) st.submissions[i] = sub; else st.submissions.push(sub);
        save(st); return view(st);
      },
      // demo only: pretend to be the instructor (random guesses), then reveal
      demoReveal() {
        const st = load(); if (!st) return;
        st.submissions.forEach((s) => { s.guess = Math.random() < 0.7 ? s.label : (s.label === "real" ? "fake" : "real"); });
        st.session.revealed = true; save(st);
      },
      reset() { localStorage.removeItem(KEY); }
    };
  }

  let demo = null;
  const FRAUD = {
    DEMO,
    // a game calls FRAUD.setup({game, defaults}) once
    setup(o) { this.game = o.game; if (DEMO) demo = demoEngine(o.game, o.defaults || {}); },
    async rpc(fn, args) {
      if (DEMO) return demo[fn](args || {});
      const { data, error } = await client().rpc(fn, args || {});
      if (error) throw new Error(error.message);
      return data;
    },
    demoReveal() { if (demo) demo.demoReveal(); },
    // remember the player in this browser so a refresh resumes
    saved() { try { return JSON.parse(localStorage.getItem("fraud_player_" + this.game)) || null; } catch (_) { return null; } },
    remember(st) { try { localStorage.setItem("fraud_player_" + this.game, JSON.stringify({ id: st.player_id, token: st.token, code: st.session.code })); } catch (_) {} },
    forget() { try { localStorage.removeItem("fraud_player_" + this.game); } catch (_) {} if (demo) demo.reset(); },
    async join(code, nickname) {
      const st = await this.rpc("fraud_join", { p_code: code, p_game: this.game, p_nickname: nickname || null, p_user_agent: navigator.userAgent });
      this.remember(st); return st;
    },
    async resume() {
      const s = this.saved(); if (!s) return null;
      try { return await this.rpc("fraud_resume", { p_player: s.id, p_token: s.token }); }
      catch (_) { this.forget(); return null; }
    },
    submit(st, kind, data, label) {
      return this.rpc("fraud_submit", { p_player: st.player_id, p_token: st.token, p_kind: kind, p_data: data, p_label: label });
    },
    // small helpers
    $: (id) => document.getElementById(id),
    esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
    urlCode() { return (new URLSearchParams(location.search).get("code") || "").toUpperCase(); }
  };
  window.FRAUD = FRAUD;
})();
