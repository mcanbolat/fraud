// Catalogue of Fraud Analytics games.
// status: "live" games have a folder under games/<key>/ with index.html, model.js and dashboard.js.
window.FRAUD_CATALOG = [
  { key: "coinflip", prefix: "FLIP", num: "Game 1", topic: "Spotting fabricated data", title: "The Broken Vase", status: "live",
    blurb: "A toddler is told to flip a coin 50 times. Did the toddler really flip it, or just make the results up? Submit one sequence and see whether your instructor can tell." },
  { key: "benford", prefix: "BEN", num: "Game 2", topic: "Digit analysis", title: "Benford's Law", status: "soon",
    blurb: "Why do the first digits of real-world numbers follow a pattern that invented numbers rarely match?" }
];
window.FRAUD_GAMES = window.FRAUD_GAMES || {};
