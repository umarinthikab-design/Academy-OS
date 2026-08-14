const fs = require("fs");
const path = require("path");
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".next", ".git", "prisma", "scripts", ".vercel", "backup"].includes(e.name)) walk(p);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
  }
}
walk(".");
const re = /(?:from\s+|require\(\s*|import\(\s*)(['"])([^'"]+)\1/g;
const bad = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const imp = m[2];
    if (!imp.startsWith(".")) continue;
    const base = path.resolve(path.dirname(f), imp);
    const candidates = [base, base + ".ts", base + ".tsx", base + ".js", base + ".jsx", path.join(base, "index.ts"), path.join(base, "index.tsx")];
    if (!candidates.some((c) => fs.existsSync(c))) bad.push(f + " -> " + imp);
  }
}
console.log(bad.length ? "MISSING:\n" + bad.join("\n") : "All relative imports resolve.");
