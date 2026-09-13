/**
 * Builds a single-file, no-install preview of the site from the same sources
 * Vite uses. Concatenates the modules in dependency order, strips the ES module
 * syntax, and lets Babel-standalone transform the JSX in the browser.
 *
 *   node bundle.mjs            -> hashyard-site.html
 *
 * This is for sharing a preview only. `npm run dev` is the real thing.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = [
  'src/data/config.js',
  'src/data/catalog.js',
  'src/lib/economics.js',
  'src/data/account.js',
  'src/data/admin.js',
  'src/state/PlatformContext.jsx',
  'src/lib/useRouter.js',
  'src/lib/useTheme.js',
  'src/components/RigDrawing.jsx',
  'src/components/PayoutChart.jsx',
  'src/components/MachineCard.jsx',
  'src/components/SplitSelector.jsx',
  'src/components/Ledger.jsx',
  'src/components/Header.jsx',
  'src/pages/Machines.jsx',
  'src/pages/MachineDetail.jsx',
  'src/pages/Checkout.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/Settlement.jsx',
  'src/pages/Wallet.jsx',
  'src/pages/Referrals.jsx',
  'src/admin/AdminLayout.jsx',
  'src/admin/Overview.jsx',
  'src/admin/Fleet.jsx',
  'src/admin/Withdrawals.jsx',
  'src/admin/Customers.jsx',
  'src/admin/Pricing.jsx',
  'src/App.jsx'
];

const strip = (src) =>
  src
    // import ... from '...';  (including the multi-line named form)
    .replace(/^import[\s\S]*?from\s+'[^']+';\s*$/gm, '')
    .replace(/^import\s+'[^']+';\s*$/gm, '')
    .replace(/^export\s+default\s+function/gm, 'function')
    .replace(/^export\s+function/gm, 'function')
    .replace(/^export\s+const/gm, 'const')
    .trim();

const modules = ORDER.map(
  (f) => `/* ===== ${f} ===== */\n${strip(readFileSync(f, 'utf8'))}`
).join('\n\n');

const css = readFileSync('src/styles.css', 'utf8');

const html = `<title>Hashyard</title>
<style>
${css}
#root { min-height: 100vh; }
.boot-msg { max-width: 46ch; margin: 18vh auto; padding: 24px; font-family: var(--f-body); color: var(--ink-2); }
.boot-msg h1 { font-size: 20px; color: var(--ink); margin-bottom: 10px; }
.boot-msg code { font-family: var(--f-mono); font-size: 13px; background: var(--panel-2); padding: 2px 6px; border-radius: 5px; }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">

<div id="root"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>

<script type="text/babel" data-presets="react" data-type="module">
const { useState, useEffect, useMemo, useCallback, useId, useContext, createContext, Fragment } = React;

${modules}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script>

<script>
/* Babel-standalone is only needed for this preview build, and cdnjs version
   paths move. Try a few, and say something useful rather than showing a blank
   page if none of them load. */
(function () {
  var VERSIONS = ['7.26.4', '7.25.6', '7.24.7', '7.23.5'];
  var root = document.getElementById('root');

  function fail(why) {
    root.innerHTML =
      '<div class="boot-msg"><h1>Preview could not start</h1><p>' + why +
      '</p><p style="margin-top:10px">The project itself is unaffected — run ' +
      '<code>npm install &amp;&amp; npm run dev</code> in <code>hashyard-web/</code>, ' +
      'which uses Vite and needs none of this.</p></div>';
  }

  function run() {
    try {
      window.Babel.transformScriptTags();
    } catch (e) {
      fail('The preview bundle failed to compile: ' + e.message);
    }
  }

  function load(i) {
    if (i >= VERSIONS.length) return fail('The JSX compiler could not be loaded from the CDN.');
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/' + VERSIONS[i] + '/babel.min.js';
    s.onload = function () { window.Babel ? run() : load(i + 1); };
    s.onerror = function () { load(i + 1); };
    document.head.appendChild(s);
  }

  if (!window.React || !window.ReactDOM) return fail('React could not be loaded from the CDN.');
  load(0);
})();
</script>
`;

writeFileSync('hashyard-site.html', html);
console.log('wrote hashyard-site.html —', (html.length / 1024).toFixed(1), 'KB from', ORDER.length, 'modules');
