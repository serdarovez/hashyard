/**
 * Proves the admin panel's central claim: the config drives the customer site.
 *
 * PlatformProvider seeds its state from CONFIG on mount, so mutating CONFIG
 * between renders is the same data path a slider takes - context state ->
 * econ(rig, share, cfg) -> every page. If the marketplace numbers do not move
 * here, the sliders would not move them either.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';

let hash = '#/machines';
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  scrollTo() {},
  localStorage: { getItem: () => null, setItem() {} }
};
Object.defineProperty(globalThis.window, 'location', { get: () => ({ hash }), configurable: true });
globalThis.localStorage = globalThis.window.localStorage;
globalThis.matchMedia = globalThis.window.matchMedia;
globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, getElementById: () => null };

const { CONFIG } = await import('./app/data/config.js');
const { RIGS } = await import('./app/data/catalog.js');
const { econ } = await import('./app/lib/economics.js');
const { default: App } = await import('./app/App.js');

const render = () => renderToString(React.createElement(App));

// what the page claims for the S21 Pro, scraped back out of the markup
const s21 = (html) => {
  const m = html.match(/\+(\d+\.\d\d)<\/span>/g) || [];
  return m.slice(0, 6).map((x) => x.replace(/[^\d.]/g, ''));
};

const rows = [];
for (const rate of [0.04, 0.062, 0.09, 0.12]) {
  CONFIG.powerRate = rate;
  const html = render();
  const sellable = RIGS.filter((r) => econ(r, CONFIG.splitStandard, CONFIG).viable).length;
  const expected = econ(RIGS.find((r) => r.id === 's21pro'), CONFIG.splitStandard, CONFIG).you.toFixed(2);
  // React SSR separates adjacent text children with <!-- -->
  const inMarkup = html.includes('<!-- -->' + expected + '</span>');
  rows.push({ rate, sellable, expected, inMarkup, bytes: html.length });
}
CONFIG.powerRate = 0.062;

console.log('power tariff -> what the rendered marketplace actually says\n');
console.log('  $/kWh   sellable   S21 Pro/day   present in HTML');
for (const r of rows) {
  console.log(
    '  ' + r.rate.toFixed(3).padEnd(8) +
    (r.sellable + '/' + RIGS.length).padEnd(11) +
    r.expected.padStart(9) + '     ' +
    (r.inMarkup ? 'yes' : 'NO')
  );
}

const moved = new Set(rows.map((r) => r.expected)).size === rows.length;
const allPresent = rows.every((r) => r.inMarkup);
console.log('\nfigures changed with the config:', moved ? 'yes' : 'NO');
console.log('every figure reached the markup:', allPresent ? 'yes' : 'NO');

// the split control feeds the same path
CONFIG.splitStandard = 0.9;
const proHtml = render();
const proExpected = econ(RIGS.find((r) => r.id === 's21pro'), 0.9, CONFIG).you.toFixed(2);
CONFIG.splitStandard = 0.8;
const proFound = proHtml.includes('<!-- -->' + proExpected + '</span>');
console.log('split 90/10 shows ' + proExpected + ':', proFound ? 'yes' : 'NO');

process.exit(moved && allPresent && proFound ? 0 : 1);
