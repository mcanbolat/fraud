// Catalogue of Fraud Analytics games.
// standalone: true = a page with no database (no session code, no dashboard.js, not listed in admin).
// status: "live" games have a folder under games/<key>/ with index.html, model.js and dashboard.js.
window.FRAUD_CATALOG = [
  { key: "coinflip", prefix: "FLIP", num: "Game 1", topic: "Spotting fabricated data", title: "The Broken Vase", status: "live",
    blurb: "A toddler is told to flip a coin 50 times. Did the toddler really flip it, or just make the results up? Submit one sequence and see whether your instructor can tell." },
  { key: "towns", prefix: "TOWN", num: "Game 2", topic: "Digit analysis", title: "Invent a Town", status: "live",
    blurb: "Make up 50 town populations. Can invented numbers pass the test real census data passes?" },
  { key: "benford", num: "Game 3", topic: "Digit analysis", title: "Digit Analysis", status: "live", standalone: true,
    blurb: "Analyze 80,000 US Census population counts and other datasets: which first and last digits do real numbers have, what survives rescaling, and which kinds of tampering can be caught?" }
];
window.FRAUD_GAMES = window.FRAUD_GAMES || {};
