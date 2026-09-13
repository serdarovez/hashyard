import { CONFIG } from './src/data/config.js';
import { RIGS, byId } from './src/data/catalog.js';
import { econ, dayEcon, breakEvenUptime } from './src/lib/economics.js';
import { buildAccount, WEEK } from './src/data/account.js';
import { SEED_FLEET } from './src/data/admin.js';

const P=(s,n)=>String(s).padStart(n), E=(s,n)=>String(s).padEnd(n);
console.log('catalog:', RIGS.length, '| unique ids:', new Set(RIGS.map(r=>r.id)).size===RIGS.length);
console.log('non-viable:', RIGS.filter(r=>!econ(r,CONFIG.splitStandard,CONFIG).viable).map(r=>r.model));

const a = buildAccount(CONFIG);
console.log('week paid', a.weekTotal.toFixed(2), '| credit', a.weekCredit.toFixed(2),
            '| uptime', (a.weekUptime*100).toFixed(1)+'%', '| tx rows', a.tx.length);

for (const sp of [CONFIG.splitStandard, CONFIG.splitPro]) {
  const be = breakEvenUptime(sp, CONFIG);
  const probe = u => { const d = dayEcon({hp:1, up:u}, a.myRig, sp, CONFIG); return d.fee - d.credit; };
  console.log(`split ${sp}: break-even ${(be*100).toFixed(2)}% | below ${probe(be-0.005).toFixed(4)} | above ${probe(be+0.005).toFixed(4)}`);
}

// the admin panel edits config; the whole model must move with it
console.log('\nconfig is live — sweeping the power tariff:');
console.log(E('$/kWh',8), P('sellable',9), P('S21 Pro/day',13));
for (const rate of [0.04, 0.062, 0.09, 0.12]) {
  const cfg = { ...CONFIG, powerRate: rate };
  const sellable = RIGS.filter(r => econ(r, cfg.splitStandard, cfg).viable).length;
  const one = econ(byId('s21pro'), cfg.splitStandard, cfg);
  console.log(E(rate.toFixed(3),8), P(sellable+'/'+RIGS.length,9), P(one.you.toFixed(2),13));
}
console.log('\nfleet fixtures:', SEED_FLEET.length, '| all rigIds valid:',
  SEED_FLEET.every(f => !!byId(f.rigId)));
