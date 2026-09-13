/**
 * Static check for the whole source tree, using the Babel parser that ships
 * with the TypeScript install on this machine. No npm install required.
 *
 *   node check.cjs
 *
 * It catches the three failure modes that actually bite before first run:
 *   1. JSX / JS syntax errors            (parse throws)
 *   2. identifiers used but never bound  (forgotten or misspelled import)
 *   3. imports of names a module does not export
 */
const fs = require('fs');
const path = require('path');

const M = 'C:/Users/Seri/AppData/Local/Microsoft/TypeScript/6.0/node_modules';
const parser = require(M + '/@babel/parser');
const traverse = require(M + '/@babel/traverse').default;

const GLOBALS = new Set([
  'window', 'document', 'console', 'localStorage', 'sessionStorage', 'navigator',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Set', 'Map', 'WeakMap', 'Promise', 'Symbol', 'Intl', 'Error', 'TypeError',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'URLSearchParams', 'URL', 'fetch', 'matchMedia', 'getComputedStyle', 'structuredClone',
  'React', 'ReactDOM', 'globalThis', 'undefined', 'NaN', 'Infinity', 'process', 'crypto',
  'parseFloat', 'parseInt', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'alert'
]);

const SRC = 'src';
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) files.push(p.replace(/\\/g, '/'));
  }
})(SRC);

const parsed = new Map();
const problems = [];

// ---- pass 1: parse ----
for (const f of files) {
  try {
    parsed.set(f, parser.parse(fs.readFileSync(f, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx']
    }));
  } catch (e) {
    problems.push(`SYNTAX  ${f}: ${e.message}`);
  }
}

// ---- pass 2: what each module exports ----
const exportsOf = new Map();
for (const [f, ast] of parsed) {
  const names = new Set();
  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (node.declaration.declarations) {
          for (const d of node.declaration.declarations) if (d.id.name) names.add(d.id.name);
        } else if (node.declaration.id) names.add(node.declaration.id.name);
      }
      for (const s of node.specifiers || []) names.add(s.exported.name);
    }
    if (node.type === 'ExportDefaultDeclaration') names.add('default');
  }
  exportsOf.set(f, names);
}

const resolve = (from, spec) => {
  if (!spec.startsWith('.')) return null; // bare = npm package
  const base = path.join(path.dirname(from), spec).replace(/\\/g, '/');
  for (const c of [base, base + '.js', base + '.jsx', base + '/index.js', base + '/index.jsx']) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return false; // relative but missing
};

// ---- pass 3: imports resolve, and names exist ----
for (const [f, ast] of parsed) {
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const target = resolve(f, node.source.value);
    if (target === null) continue;
    if (target === false) {
      problems.push(`MISSING ${f}: cannot resolve '${node.source.value}'`);
      continue;
    }
    const has = exportsOf.get(target);
    if (!has) continue;
    for (const s of node.specifiers) {
      const want = s.type === 'ImportDefaultSpecifier' ? 'default'
        : s.type === 'ImportSpecifier' ? s.imported.name : null;
      if (want && !has.has(want)) {
        problems.push(`EXPORT  ${f}: '${node.source.value}' does not export '${want}'`);
      }
    }
  }
}

// ---- pass 4: unbound identifiers ----
for (const [f, ast] of parsed) {
  const seen = new Set();
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      // JSX intrinsics (<div>) are lowercase and are not references
      if (p.parent.type === 'JSXOpeningElement' || p.parent.type === 'JSXClosingElement') {
        if (/^[a-z]/.test(name)) return;
      }
      if (p.parent.type === 'JSXAttribute' && p.parent.name === p.node) return;
      if (GLOBALS.has(name) || seen.has(name)) return;
      if (!p.scope.hasBinding(name, true)) {
        seen.add(name);
        problems.push(`UNBOUND ${f}:${p.node.loc ? p.node.loc.start.line : '?'} '${name}'`);
      }
    }
  });
}

console.log(`parsed ${parsed.size}/${files.length} files`);
if (!problems.length) {
  console.log('OK — no syntax errors, all imports resolve, no unbound identifiers');
  process.exit(0);
}
for (const p of problems) console.log('  ' + p);
console.log(`\n${problems.length} problem(s)`);
process.exit(1);
