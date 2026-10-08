#!/usr/bin/env node
// Contrast checker for Touchline dark mode tokens
// Parses globals.css for both :root (light) and :root[data-theme="dark"] (dark)
// Resolves var() chains, computes WCAG AA/AAA contrast ratios (>= 4.5:1)
// Labels every row with its theme, prints summary, exits 1 on failure

import fs from "fs";
import path from "path";

const CSS_PATH = path.resolve("./app/globals.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

// ——— Extract declarations from a single CSS block ———
function extractBlockDeclarations(blockText) {
  const decls = {};
  const regex = /--([\w-]+)\s*:\s*([^;]+)/g;
  let m;
  while ((m = regex.exec(blockText)) !== null) {
    const name = "--" + m[1].trim();
    const value = m[2].trim();
    if (!(name in decls)) decls[name] = value;
  }
  return decls;
}

// ——— Split CSS into :root and :root[data-theme="dark"] blocks ———
function splitThemeBlocks(cssText) {
  const lightRegex = /:root\s*\{([\s\S]*?)\}(?=\s*:root|$)/m;
  const lightMatch = cssText.match(lightRegex);
  const lightDecls = lightMatch ? extractBlockDeclarations(lightMatch[1]) : {};

  const darkRegex = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}(?=\s*\*|\s*\.|$)/m;
  const darkMatch = cssText.match(darkRegex);
  const darkDecls = darkMatch ? extractBlockDeclarations(darkMatch[1]) : {};

  return { lightDecls, darkDecls };
}

// ——— Resolve a token: one-level var chain + hex ———
function resolveOneLevel(tokenName, decls) {
  const value = decls[tokenName];
  if (!value) return null;
  if (/^#[\w]{6}$/i.test(value)) return value;
  const varMatch = value.match(/^var\(--([\w-]+)\)$/);
  if (varMatch) return decls["--" + varMatch[1]];
  return null;
}

// ——— sRGB luminance (linear) ———
function toLinear(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ——— Contrast ratio ———
function contrastRatio(l1, l2) { return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

// ——— WCAG level ———
function wcagLevel(ratio) { return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "fail"; }

// ——— Parse both theme blocks ———
const { lightDecls, darkDecls } = splitThemeBlocks(css);

// ——— Light theme pairs ———
const LIGHT_PAIRS = [
  ["--text", "--bg", "light"], ["--text", "--surface", "light"], ["--text", "--surface-muted", "light"],
  ["--text-muted", "--bg", "light"], ["--text-muted", "--surface", "light"],
  ["--text-faint", "--bg", "light"], ["--text-faint", "--surface", "light"],
  ["--text-heading", "--bg", "light"], ["--text-heading", "--surface", "light"],
  ["--text-brand", "--bg", "light"], ["--text-brand", "--surface", "light"],
  ["--btn-primary-text", "--btn-primary-bg", "light"],
  // Sidebar pairs - resolved with explicit var chains
  ["--sidebar-text", "--sidebar-bg", "light"],
  ["--sidebar-text-strong", "--sidebar-bg", "light"],
  ["--sidebar-active-text", "--sidebar-bg", "light"],
];

// ——— Dark theme pairs ———
const DARK_PAIRS = [
  ["--text", "--bg", "dark"], ["--text", "--surface", "dark"], ["--text", "--surface-muted", "dark"],
  ["--text-muted", "--bg", "dark"], ["--text-muted", "--surface", "dark"],
  ["--text-faint", "--bg", "dark"], ["--text-faint", "--surface", "dark"],
  ["--text-heading", "--bg", "dark"], ["--text-heading", "--surface", "dark"],
  ["--text-brand", "--bg", "dark"], ["--text-brand", "--surface", "dark"],
  ["--btn-primary-text", "--btn-primary-bg", "dark"],
  // Sidebar pairs - resolved via var chain
  ["--sidebar-text", "--sidebar-bg", "dark"],
  ["--sidebar-text-strong", "--sidebar-bg", "dark"],
  ["--sidebar-active-text", "--sidebar-bg", "dark"],
];

// ——— Helper: one-level var resolution ———
function resolveOneLevel(tokenName, decls) {
  const value = decls[tokenName];
  if (!value) return null;
  if (/^#[\w]{6}$/i.test(value)) return value;
  const varMatch = value.match(/^var\(--([\w-]+)\)$/);
  if (varMatch) return decls["--" + RegExp.$1];
  return null;
}

// ——— Helper: compute contrast ———
function checkPair(fgToken, bgToken, theme) {
  const decls = theme === "light" ? lightDecls : darkDecls;

  // Resolve fg color: try direct lookup, then one-level var chain
  let fgHex = decls[fgToken];
  if (!fgHex) fgHex = resolveOneLevel(fgToken, decls);
  if (!fgHex) { results.push({ fg: fgToken, bg: "N/A", theme, ratio: null, level: "missing", pass: false }); allPass = false; return; }

  // Resolve bg color
  let bgHex = decls[bgToken];
  if (!bgHex) bgHex = resolveOneLevel(bgToken, decls);
  if (!bgHex) { results.push({ fg: fgToken, bg: "N/A", theme, ratio: null, level: "missing", pass: false }); allPass = false; return; }

  const l1 = toLinear(fgHex);
  const l2 = toLinear(bgHex);
  const ratio = contrastRatio(l1, l2);
  const level = wcagLevel(ratio);
  const pass = level !== "fail";

  results.push({ fg: fgToken, bg: bgToken, theme, ratio: ratio.toFixed(2), level, pass });
  if (!pass) allPass = false;
}

// ——— Evaluate all pairs ———

let allPass = true;
const results = [];

// Evaluate light theme pairs
for (const [fgToken, bgToken, theme] of LIGHT_PAIRS) {
  checkPair(fgToken, bgToken, "light");
}

// Evaluate dark theme pairs
for (const [fgToken, bgToken, theme] of DARK_PAIRS) {
  checkPair(fgToken, bgToken, "dark");
}

// ——— Print output ———

console.log("\n=== Touchline Contrast Check ===");
console.log(`Light theme: ${allPass ? "ALL PASS" : "SOME FAIL"}`);
console.log(`Dark theme: ${allPass ? "ALL PASS" : "SOME FAIL"}\n`);

console.log("=== Contrast Ratio Summary ===");
console.log("Theme | FG | BG | Ratio | WCAG |");
console.log("------|----|----|-------|------|");
results.forEach(r => {
  const ratioStr = r.ratio ? r.ratio : "N/A";
  const levelStr = r.level || "N/A";
  const passStr = r.pass ? "PASS" : "FAIL";
  console.log(`${r.theme} | ${r.fg} | ${r.bg} | ${ratioStr}   | ${levelStr}   | ${passStr}`);
});

console.log("\n");

// Exit 1 on failure
process.exit(allPass ? 0 : 1);