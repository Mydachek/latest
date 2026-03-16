// Legacy compatibility entrypoint.
// Some older builds referenced /js/village/index.js from village.html.
// The current UI bootstrap lives in /js/app.js, so we simply forward here.
import "../app.js";