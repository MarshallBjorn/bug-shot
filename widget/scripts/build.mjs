// BugShot widget — build.
//
// Widget to klasyczny, globalny browser script (IIFE), NIE ESM. Ten skrypt
// NIE bundluje w sensie Webpack/Rollup/Vite — tylko deterministycznie
// konkatenuje pliki w DOKLADNIE tej kolejnosci, w jakiej sa ladowane
// w widget/index.html (zweryfikowane w repo, nie zalozone):
//
//   config.js                 <- POMIJANE w dist (per-srodowisko, konsument
//                                 sam ustawia window.BUGSHOT_CONFIG przed
//                                 zaladowaniem widget.js; config.js jest
//                                 tez w .gitignore z tego samego powodu)
//   vendor/html-to-image.js
//   mask.js
//   capture.js
//   widget.js
//
// Build failuje twardo (exit 1), jesli ktoregos z wymaganych plikow brakuje.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BUNDLE_ORDER = [
  "vendor/html-to-image.js",
  "mask.js",
  "capture.js",
  "widget.js",
];

const missing = BUNDLE_ORDER.filter((rel) => !existsSync(join(ROOT, rel)));
if (missing.length > 0) {
  console.error("Build FAILED — brak wymaganych plikow wejsciowych:");
  for (const m of missing) console.error(`  - widget/${m}`);
  process.exit(1);
}

if (!existsSync(join(ROOT, "styles.css"))) {
  console.error("Build FAILED — brak widget/styles.css");
  process.exit(1);
}

mkdirSync(join(ROOT, "dist"), { recursive: true });

const bundle = BUNDLE_ORDER
  .map((rel) => readFileSync(join(ROOT, rel), "utf8").replace(/\s+$/, ""))
  .join("\n;\n");

writeFileSync(join(ROOT, "dist/widget.js"), bundle + "\n");
copyFileSync(join(ROOT, "styles.css"), join(ROOT, "dist/widget.css"));

console.log(`OK  widget/dist/widget.js  (${bundle.length} B, ${BUNDLE_ORDER.length} plikow polaczonych)`);
console.log("OK  widget/dist/widget.css");
console.log("Pominieto celowo: config.js (per-srodowisko, konsument ustawia window.BUGSHOT_CONFIG sam).");
