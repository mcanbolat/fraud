// Catalogue of Fraud Analytics games.
// standalone: true = a page with no database (no session code, no dashboard.js, not listed in admin).
// status: "live" games have a folder under games/<key>/ with index.html, model.js and dashboard.js.
window.FRAUD_CATALOG = [
  { key: "coinflip", prefix: "FLIP", num: "Game 1", topic: "Spotting fabricated data", title: "The Broken Vase", status: "live",
    blurb: "A toddler is told to flip a coin 50 times. Did the toddler really flip it, or just make the results up? Submit one sequence and see whether your instructor can tell." },
  { key: "benford", num: "Game 2", topic: "Digit analysis", title: "Benford's Law", status: "live", standalone: true,
    blurb: "Analyze 80,000 US Census population counts: do first digits follow Benford's Law, what survives rescaling, and which kinds of tampering does it catch?" }
];
window.FRAUD_GAMES = window.FRAUD_GAMES || {};
