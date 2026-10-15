import fs from "node:fs";
const css = fs.readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
function collect(selectorRe) {
  const map = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (!selectors.some((s) => selectorRe.test(s))) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) map[d[1]] = d[2].trim();
  }
  return map;
}
const light = collect(/^:root$/);
const dark = { ...light, ...collect(/^:root\[data-theme=["']dark["']\]$/) };
const THEMES = { light, dark };
function toRgb(v) {
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a < 1) return null;
    return [+m[1], +m[2], +m[3]];
  }
  return null;
}
function resolve(theme, name, depth = 0) {
  if (depth > 12) return null;
  const v = THEMES[theme][name];
  if (v === undefined) return null;
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (ref) return resolve(theme, ref[1], depth + 1) ?? (ref[2] ? toRgb(ref[2].trim()) : null);
  return toRgb(v);
}
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const TEXTS = ["--text", "--text-muted", "--text-faint", "--text-heading", "--text-brand"];
const SURFACES = ["--bg", "--surface", "--surface-muted"];
const PAIRS = [];
for (const t of TEXTS) for (const s of SURFACES) PAIRS.push([t, s, 4.5]);
PAIRS.push(["--btn-primary-text", "--btn-primary-bg", 4.5]);
PAIRS.push(["--btn-approval-text", "--btn-approval-bg", 4.5]);
PAIRS.push(["--btn-secondary-text", "--secondary", 4.5]);
PAIRS.push(["--on-secondary", "--secondary", 4.5]);
PAIRS.push(["--sidebar-text", "--sidebar-bg", 4.5]);
PAIRS.push(["--sidebar-text-strong", "--sidebar-bg", 4.5]);
PAIRS.push(["--sidebar-active-text", "--sidebar-active-bg", 4.5]);
PAIRS.push(["--sidebar-text", "--sidebar-hover-bg", 4.5]);
let failures = 0;
const failedByTheme = { light: 0, dark: 0 };
console.log("\nTheme | Foreground | Background | Ratio | Result");
console.log("------|------------|------------|-------|-------");
for (const theme of Object.keys(THEMES)) {
  for (const [fg, bg, min] of PAIRS) {
    const a = resolve(theme, fg), b = resolve(theme, bg);
    if (!a || !b) { failures++; failedByTheme[theme]++; console.log(`${theme} | ${fg} | ${bg} | -- | UNRESOLVED (${!a ? fg : bg} is not defined or not a solid colour)`); continue; }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) { failures++; failedByTheme[theme]++; }
    console.log(`${theme} | ${fg} | ${bg} | ${r.toFixed(2)} | ${ok ? (r >= 7 ? "PASS (AAA)" : "PASS (AA)") : "FAIL (needs " + min + ")"}`);
  }
}
console.log(`\nLight theme: ${failedByTheme.light ? failedByTheme.light + " problem(s)" : "all pass"}`);
console.log(`Dark theme:  ${failedByTheme.dark ? failedByTheme.dark + " problem(s)" : "all pass"}`);
console.log(failures ? `\nRESULT: FAIL (${failures})` : "\nRESULT: PASS");
process.exit(failures ? 1 : 0);
