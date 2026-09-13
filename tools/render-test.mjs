/**
 * Actually renders the app. Not a parse, not a lint - React executes every
 * component for every route and any real error throws here.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';

// ---- minimal browser surface the app touches ----
const listeners = {};
let hash = '';
const store = new Map();

globalThis.window = {
  get location() { return { hash }; },
  set location(v) { hash = v; },
  addEventListener: (k, f) => { (listeners[k] ||= []).push(f); },
  removeEventListener: (k, f) => { listeners[k] = (listeners[k] || []).filter((x) => x !== f); },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  scrollTo: () => {},
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
};
Object.defineProperty(globalThis.window, 'location', {
  get: () => ({ get hash() { return hash; }, set hash(v) { hash = v; } }),
  configurable: true
});
globalThis.localStorage = globalThis.window.localStorage;
globalThis.matchMedia = globalThis.window.matchMedia;
globalThis.document = {
  documentElement: { setAttribute() {}, removeAttribute() {} },
  getElementById: () => null
};

const { default: App } = await import('./app/App.js');

const ROUTES = [
  ['#/machines', 'Marketplace'],
  ['#/machine/s21pro', 'Machine detail - whole unit'],
  ['#/machine/sh-s21pro-14', 'Machine detail - share'],
  ['#/machine/av1066', 'Machine detail - underwater unit'],
  ['#/machine/does-not-exist', 'Machine detail - bad id'],
  ['#/checkout/sh-s21pro-14', 'Checkout - affordable'],
  ['#/checkout/s21e3u', 'Checkout - short balance'],
  ['#/dashboard', 'Dashboard'],
  ['#/settlement', 'Settlement'],
  ['#/wallet', 'Wallet'],
  ['#/referrals', 'Referrals'],
  ['#/admin', 'Admin - overview'],
  ['#/admin-fleet', 'Admin - fleet'],
  ['#/admin-withdrawals', 'Admin - withdrawals'],
  ['#/admin-users', 'Admin - customers'],
  ['#/admin-pricing', 'Admin - pricing & risk']
];

let pass = 0;
const failures = [];

for (const [route, label] of ROUTES) {
  hash = route;
  try {
    const html = renderToString(React.createElement(App));
    if (!html || html.length < 200) throw new Error(`suspiciously small output (${html.length} bytes)`);
    console.log(`  PASS  ${label.padEnd(34)} ${String(html.length).padStart(7)} bytes`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${e.message.split('\n')[0]}`);
    failures.push([label, e]);
  }
}

console.log(`\n${pass}/${ROUTES.length} routes rendered`);

// ---- spot-check that real figures reached the markup ----
if (!failures.length) {
  hash = '#/machines';
  const html = renderToString(React.createElement(App));
  const checks = [
    ['entry price 250', /250/],
    ['S21 Pro monthly 130.38', /130\.38/],
    ['machine count 16', /16<\/b>|>16</],
    ['a hydro machine listed', /Hydro/],
    ['plain-language card wording', /Pays for itself in about/],
    ['J/TH kept off the marketplace', /J\/TH/, true]
  ];
  for (const [what, re, absent] of checks) {
    const hit = re.test(html);
    console.log(`  ${(absent ? !hit : hit) ? 'ok  ' : 'MISS'}  ${what}`);
  }
}

process.exit(failures.length ? 1 : 0);
