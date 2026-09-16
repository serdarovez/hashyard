// node verify.mjs - prints the catalogue's estimated economics at the default
// settings. Real payouts come from Daily results in the admin panel; this is
// the model behind the "you earn about" figures in the shop.
import { CONFIG } from './src/data/config.js';
import { RIGS } from './src/data/catalog.js';
import { econ, priceFor, paybackMonths, breakEvenUptime } from './src/lib/economics.js';

const P = (s, n) => String(s).padStart(n);
const E = (s, n) => String(s).padEnd(n);

console.log(E('machine', 28), P('price', 7), P('Pro', 7), P('/month', 9), P('payback', 9));
for (const r of RIGS) {
  const e = econ(r, CONFIG.splitStandard, CONFIG);
  console.log(
    E(r.model, 28),
    P(priceFor(r, CONFIG.splitStandard, CONFIG), 7),
    P(priceFor(r, CONFIG.splitPro, CONFIG), 7),
    P((e.you * 30.44).toFixed(2), 9),
    P((paybackMonths(r, CONFIG.splitStandard, CONFIG) ?? '-') + ' mo', 9)
  );
}
console.log(`\n${RIGS.length} machines | unsellable at these prices: ${RIGS.filter((r) => !econ(r, CONFIG.splitStandard, CONFIG).viable).length}`);
console.log(`guarantee break-even uptime: Standard ${(breakEvenUptime(CONFIG.splitStandard) * 100).toFixed(1)}%, Pro ${(breakEvenUptime(CONFIG.splitPro) * 100).toFixed(1)}%`);
