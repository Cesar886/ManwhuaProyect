const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');
const exts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css', '.module.css'];

function existsResolved(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const ext of exts) {
    if (fs.existsSync(base + ext)) return true;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of exts) {
      if (fs.existsSync(path.join(base, 'index' + ext))) return true;
    }
  }
  return false;
}

function walk(dir, out = []) {
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
      continue;
    }
    if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(src);
const issues = [];
const re = /\b(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+|import\()\s*['"]([^'"]+)['"]/g;

for (const file of files) {
  const text = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
  let m;
  while ((m = re.exec(text))) {
    const spec = m[1];
    if (!spec) continue;
    if (spec.startsWith('http') || spec.startsWith('node:')) continue;
    if (!(spec.startsWith('.') || spec.startsWith('@/'))) continue;

    const target = spec.startsWith('@/')
      ? path.join(src, spec.slice(2))
      : path.resolve(path.dirname(file), spec);

    if (!existsResolved(target)) {
      issues.push({ file: path.relative(root, file), spec });
    }
  }
}

if (issues.length === 0) {
  console.log('OK: no unresolved local imports found in src');
  process.exit(0);
}

console.log('UNRESOLVED IMPORTS:');
for (const issue of issues) {
  console.log(`${issue.file} -> ${issue.spec}`);
}
process.exit(1);
