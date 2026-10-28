// Sanity checks for web/labs/heatpump.js physics. Run: node tools/test_heatpump.js
require('../web/labs/heatpump-data.js'); require('../web/labs/heatpump.js');
const H = globalThis.HPPhys, assert = require('assert'), f = (x, n = 2) => x.toFixed(n);

assert(Math.abs(H.satAt(0).P - 474.46) < 0.1, 'Psat(0 C) of R-290 matches CoolProp');
assert(Math.abs(H.satAt(0).hg - 574.87) < 0.1, 'hg(0 C) matches CoolProp');

const show = (n, o) => { const r = H.cycle(o);
  console.log(n.padEnd(26), `Te ${f(r.Te, 1)} Tc ${f(r.Tc, 1)} COP ${f(r.COP)} carnot ${f(r.carnot, 1)} cap ${f(r.cap / 1e3)} kW load ${f(r.load / 1e3)} kW Pel ${f(r.Pel / 1e3)} backup ${f(r.backup / 1e3)} T2 ${f(r.T2, 0)} holds ${r.holds}`);
  return r; };
const d = show('default (heat, 7 C)', {});
assert(Math.abs(d.COPh - d.COPc - 1) < 1e-9, 'COP heating = COP cooling + 1');
assert(d.COPh < d.carnot, 'below Carnot');
const cold = show('heat, -10 C', { Tout: -10 });
assert(cold.COP < d.COP && cold.cap < d.cap, 'colder outdoor air: lower COP and capacity');
assert(show('heat, slow 2000 rpm', { rpm: 2000 }).COP > d.COP, 'slow inverter compressor is more efficient');
assert(show('heat, iced 90 %', { Tout: 1, foul: 90, rpm: 4000 }).COP < show('heat, clean, 1 C', { Tout: 1, rpm: 4000 }).COP, 'ice lowers COP');
const cool = show('cool, 35 C', { mode: 1, Tout: 35, Tin: 24 });
assert(cool.COPc < cool.carnot, 'cooling below Carnot');
console.log('balance point (default house):', f(H.balance({}), 1), 'C; leaky house:', f(H.balance({ UA: 300, rpm: 6000 }), 1), 'C');

console.log('-- presets');
const presets = { opt: { mode: 0, Tout: 7, Tin: 20, rpm: 2000, foul: 0, UA: 150 }, typ: { mode: 0, Tout: 2, Tin: 21, rpm: 3500, foul: 10, UA: 150 },
  snap: { mode: 0, Tout: -20, Tin: 21, rpm: 6000, foul: 0, UA: 150 }, ice: { mode: 0, Tout: 1, Tin: 21, rpm: 4000, foul: 90, UA: 150 },
  leaky: { mode: 0, Tout: -5, Tin: 21, rpm: 6000, foul: 0, UA: 300 }, heatwave: { mode: 1, Tout: 42, Tin: 24, rpm: 6000, foul: 70, UA: 150 } };
const P = {}; for (const [k, o] of Object.entries(presets)) P[k] = show(k, o);
assert(P.opt.COP > 4, 'optimal preset COP above 4');
assert(!P.snap.holds && P.snap.backup > 0, 'cold snap needs backup');
assert(!P.leaky.holds, 'leaky house needs backup');
assert(P.heatwave.COP < 2, 'heatwave + dirty coil: poor COP');

console.log('-- missions reachable, not met by defaults');
const m1 = r => r.heat && r.p.Tout <= -5 && r.COP >= 3 && r.holds, m3 = r => !r.heat && r.p.Tout >= 35 && r.COPc >= 3.5 && r.holds;
assert(!m1(d) && !m3(d), 'defaults do not complete missions');
let ok1 = null, ok3 = null;
for (const rpm of [1200, 1600, 2000, 2400, 3000, 4000]) for (const Tin of [16, 18, 20, 22, 24, 26, 28]) for (const UA of [60, 100, 150]) {
  if (!ok1 && m1(H.cycle({ Tout: -5, Tin, rpm, UA }))) ok1 = { rpm, Tin, UA };
  if (!ok3 && m3(H.cycle({ mode: 1, Tout: 35, Tin, rpm, UA }))) ok3 = { rpm, Tin, UA };
}
console.log('mission 1 example', ok1, '; mission 3 example', ok3);
assert(ok1 && ok3, 'missions 1 and 3 reachable');
console.log('HEATPUMP PASS');
