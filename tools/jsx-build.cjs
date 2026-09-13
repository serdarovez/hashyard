/**
 * Minimal JSX -> React.createElement transform, built on the Babel parser that
 * ships with the local TypeScript install. No @babel/preset-react needed.
 * Emits plain ESM into ./app so Node can import and render the real components.
 */
const fs = require('fs');
const path = require('path');

const M = 'C:/Users/Seri/AppData/Local/Microsoft/TypeScript/6.0/node_modules';
const parser = require(M + '/@babel/parser');
const traverse = require(M + '/@babel/traverse').default;
const generate = require(M + '/@babel/generator').default;
const t = require(M + '/@babel/types');

const SRC = process.argv[2];
const OUT = process.argv[3];

const nameOf = (node) => {
  if (t.isJSXIdentifier(node)) return node.name;
  if (t.isJSXMemberExpression(node)) return nameOf(node.object) + '.' + node.property.name;
  return 'unknown';
};

const elementType = (node) => {
  if (t.isJSXMemberExpression(node)) {
    return t.memberExpression(elementType(node.object), t.identifier(node.property.name));
  }
  const n = node.name;
  // lowercase tag = intrinsic DOM element, becomes a string
  return /^[a-z]/.test(n) ? t.stringLiteral(n) : t.identifier(n);
};

const attrsToObject = (attrs) => {
  if (!attrs.length) return t.nullLiteral();
  const props = [];
  for (const a of attrs) {
    if (t.isJSXSpreadAttribute(a)) {
      props.push(t.spreadElement(a.argument));
      continue;
    }
    const key = a.name.name;
    const id = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? t.identifier(key) : t.stringLiteral(key);
    let value;
    if (a.value == null) value = t.booleanLiteral(true);          // <input disabled />
    else if (t.isJSXExpressionContainer(a.value)) value = a.value.expression;
    else value = a.value;                                          // StringLiteral
    props.push(t.objectProperty(id, value));
  }
  return t.objectExpression(props);
};

const childrenOf = (node) => {
  const out = [];
  for (const c of node.children) {
    if (t.isJSXText(c)) {
      // JSX text semantics: collapse whitespace, drop lines that are only space
      const text = c.value.replace(/\s*\n\s*/g, ' ');
      if (text.trim() === '') continue;
      out.push(t.stringLiteral(text));
    } else if (t.isJSXExpressionContainer(c)) {
      if (!t.isJSXEmptyExpression(c.expression)) out.push(c.expression);
    } else if (t.isJSXSpreadChild(c)) {
      out.push(t.spreadElement(c.expression));
    } else {
      out.push(c); // nested element/fragment, already transformed bottom-up
    }
  }
  return out;
};

const createEl = (type, props, kids) =>
  t.callExpression(
    t.memberExpression(t.identifier('React'), t.identifier('createElement')),
    [type, props, ...kids]
  );

function transform(code, file) {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });

  traverse(ast, {
    // exit = bottom-up, so children are already plain calls
    JSXElement: {
      exit(p) {
        const open = p.node.openingElement;
        p.replaceWith(createEl(elementType(open.name), attrsToObject(open.attributes), childrenOf(p.node)));
      }
    },
    JSXFragment: {
      exit(p) {
        p.replaceWith(createEl(
          t.memberExpression(t.identifier('React'), t.identifier('Fragment')),
          t.nullLiteral(),
          childrenOf(p.node)
        ));
      }
    },
    // .jsx specifiers become .js in the emitted tree
    ImportDeclaration(p) {
      const v = p.node.source.value;
      if (v.startsWith('.') && v.endsWith('.jsx')) p.node.source = t.stringLiteral(v.slice(0, -4) + '.js');
    }
  });

  return generate(ast, { retainLines: false, compact: false }, code).code;
}

let n = 0;
(function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, path.join(rel, e.name)); continue; }
    if (!/\.(js|jsx)$/.test(e.name)) continue;
    const outDir = path.join(OUT, rel);
    fs.mkdirSync(outDir, { recursive: true });
    const outName = e.name.replace(/\.jsx$/, '.js');
    fs.writeFileSync(path.join(outDir, outName), transform(fs.readFileSync(p, 'utf8'), p));
    n++;
  }
})(SRC);

console.log('transformed', n, 'files ->', OUT);
