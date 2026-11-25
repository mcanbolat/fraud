# Fraud Analytics games: classroom games for the short Fraud Analytics course

Short web games that students play on their phones or laptops while the data is collected for discussion. Same pattern as the POM Games site (GitHub Pages + Supabase, no build step).

| Piece | What it is |
|---|---|
| `index.html` | Hub page that lists the games (the Benford analysis links straight to its page) |
| `admin.html` | Instructor dashboard (with a **Benford Analysis** button in the header that opens the standalone page): create sessions, see submissions, record guesses, reveal, export CSV (same login as the POM games and the newsvendor game) |
| `games/<key>/index.html` | The student game |
| `games/<key>/model.js`, `dashboard.js` | The game's logic and its dashboard view |
| `schema.sql` | Shared Supabase tables and functions (`fraud_*`). Run it once in the SQL Editor; it is safe to re-run |
| `games.js` | Catalogue of games and their status (live / coming soon) |
| `fraud.js`, `fraud.css`, `dashkit.js` | Shared student client, styles and dashboard helpers |
| `config.js` | Supabase URL and publishable key (same project as the POM site) |
| `vendor/` | Supabase JS client and Chart.js, copied locally |

**Setup (once).** Open Supabase, SQL Editor, New query, paste `schema.sql`, Run. Then enable GitHub Pages (Settings, Pages, deploy from branch `main`, folder `/ (root)`). The site is at `https://mcanbolat.github.io/fraud/`.

**Data model.** One generic structure for every game: `fraud_sessions` (game key + params as JSON, `is_open`, `revealed`), `fraud_players` (nickname + secret token) and `fraud_submissions` (one row per player and kind: `data` JSON, private `label`, and the instructor's `guess`). Students can only call `fraud_join`, `fraud_resume`, `fraud_submit` and `fraud_ping`. Row-level security means only you can read the data, and you can edit only the `guess` column. Until you reveal, students never see your guess; after you reveal, they cannot change their submission. For SQL analysis use `select * from fraud_v_submissions where code = 'FLIP12';`

**Running a game.** Open `admin.html`, create a session, and show the code or QR code. Keep **Live** ticked while students submit. Export the CSV at the end.

## Games
- **Game 1: The Broken Vase** (`coinflip`, codes start with `FLIP`). A toddler is told to flip a coin 50 times but makes some of it up. Each student makes two sequences offline (one real, one invented) and submits ONE, privately labelled real or made up. The dashboard shows anonymous sequences as strips of H/T squares. You mark each Real or Fake by eye, with no statistics and no truth shown. Press **Reveal** to lock submissions and show the truth, your accuracy, the confusion matrix, longest run, number of runs, switch rate, charts, and an in-browser simulation of a fair coin (expected longest run about 6, P(run of 5 or more) about 0.82, switch rate 0.5). Students then see their own longest run, switches and whether you guessed theirs right. Debrief rule of thumb: "no run of 5+ means fake".
- **Game 2: Invent a Town** (`towns`, codes start with `TOWN`). Hook for the Benford lesson. Each student plays a clerk who lost the records of 50 towns and types 50 made-up populations (whole numbers 1 to 50,000,000; one per line or separated by spaces/semicolons; `12,345` counts as 12345; no random-number button). Stored as `{"nums":[...]}`. The dashboard shows the count of submissions and an optional **Show pooled chart** toggle (hidden by default, so the projector does not spoil it). **Reveal** locks submissions and shows the pooled class first-digit distribution against Benford's expectation and the real US Census (2010 populations), MAD with Nigrini's verdict and chi-square, the last-digit chart (invented numbers heap on 0 and 5), a per-student table sorted by first-digit MAD (the "best faker" is highlighted), and fun facts (most common first digit, % ending in 0, medians). Export CSV downloads two files: one row per number, and a per-student summary. Students see their own first-digit bars, MAD, verdict and last-digit counts after the reveal. One student's MAD over 50 numbers is noisy; the pooled class is the real test. **Database:** the game needs a `towns` branch in `fraud_submit`: re-run `schema.sql` in the SQL Editor (safe to re-run), or run only the `create or replace function public.fraud_submit(...)` statement from it (kept as `towns_migration.sql` outside the repo if you asked for it; grants are unchanged because the signature is the same).
- **Game 3: Benford's Law** (`games/benford/`, standalone, no database, no session code). An interactive analysis page for projecting in class or for students to explore on their own: pick US Census population counts (80,000 rows, `games/benford/data/us_census_2017.csv`, Census sub-est2017_all) or paste your own numbers; run first, second, first-two and last digit tests (chi-square, MAD with Nigrini's conformity bands, z per digit); rescale the data to see scale invariance (with a uniform non-Benford comparison); a tamper lab (rounding, threshold inflation with a bunching histogram, fabricated rows); and a growth demo of why Benford arises. `benford.js` is the model and can be tested in node (`node tests/benford.test.js`). Zero, blank and non-numeric populations (such as "A", no 2010 count) are excluded and reported. It is marked `standalone: true` in `games.js`, so the hub links straight to it and `admin.html` ignores it. The seed shown at the top makes simulated and tampered data repeatable; Reshuffle draws a new one.

**Demo mode.** Add `?demo` to any page URL (for example `admin.html?demo`) to try it without saving anything. The instructor demo has 20 simulated students (half true random, half human-like) so you can rehearse guessing and the reveal. The student demo keeps data in your browser only and has a button to simulate the reveal.

**Publishing an update.** Bump the number in `version.txt` and the `V="…"` and `?v=…` values in the pages. Open pages then reload themselves automatically.

**Adding a game.** Add `games/<key>/` with `index.html`, `model.js` and `dashboard.js` (copy the coinflip game as a template), set its status to `"live"` in `games.js`, and register `window.FRAUD_GAMES.<key>` in its `dashboard.js` (with `render`, `demo`, `csvRows`). Store the student's answer in `fraud_submissions.data`. You don't need to change the tables; the only database change is an optional `elsif s.game = '<key>'` validation branch inside `fraud_submit` in `schema.sql` (re-run the file).

Research use: get IRB approval before publishing data collected in class.

### Datasets on the Digit Analysis page (`games/benford/`)
US Census (default), NIH contract amounts, ~1,000 Project Gutenberg classics (words, characters, sentences, syllables, downloads), Shakespeare line lengths, Bible verse lengths, Quran verse lengths (Arabic and English), powers of 2 and Fibonacci numbers, or paste your own. Only the numbers (lengths, counts, amounts) are stored in `games/benford/data/`, not the texts. Student-facing pages before the lecture avoid the name "Benford" (hub tile "Digit Analysis", admin link "Analysis").
