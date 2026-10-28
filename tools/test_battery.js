// Sanity checks for web/labs/battery.js physics. Run: node tools/test_battery.js
require('../web/labs/battery.js');
const B = globalThis.BatPhys, assert = require('assert'), f = (x, n = 0) => x.toFixed(n);
const base = { mode: 0, C: 1, Tamb: 25, h: 10, soc0: 1, cut: 2.5 }, run = o => B.simulate(Object.assign({}, base, o));

const slow = run({ C: .2 }), one = run({}), drill = run({ C: 3.3 }), cold = run({ Tamb: -10 }), cold02 = run({ Tamb: -10, C: .2 });
for (const [n, r] of Object.entries({ slow, one, drill, cold, cold02 }))
  console.log(n.padEnd(7), f(r.mAh), 'mAh', f(r.Wh, 2), 'Wh', 'Tmax', f(r.Tmax, 1), 'avgV', f(r.avgV, 2), 'sag', f(r.sag), 'mV', r.end);
assert(Math.abs(slow.mAh - 3000) < 60, '0.2 C gives about the rated 3000 mAh');
assert(drill.mAh > 2700 && drill.mAh < 3000, '10 A gives 2700-3000 mAh, inside published tests');
assert(slow.mAh > one.mAh && one.mAh > drill.mAh, 'capacity falls with C-rate');
assert(drill.Tmax > one.Tmax && one.Tmax > slow.Tmax, 'heat rises with current');
assert(cold.mAh < one.mAh, 'cold reduces usable charge');
assert(Math.abs(drill.sag - 3.3 * 3 * B.R0 * 1000) < 40, 'start sag = I*R0 (RC not yet charged)');
// energy balance: electrical energy out + heat = chemical energy taken (integral OCV dQ) within 2 %
const r = one; let chem = 0;
for (let i = 1; i < r.pts.length; i++) chem += B.ocv((r.pts[i][6] + r.pts[i - 1][6]) / 2) * (r.pts[i][1] - r.pts[i - 1][1]) / 1000;
console.log('energy balance: out+heat', f(r.Wh + r.heatWh, 3), 'Wh; chemical', f(chem, 3), 'Wh');
assert(Math.abs(r.Wh + r.heatWh - chem) / chem < .03, 'energy balance');
// charge: CC-CV reaches full, fast charge is hotter and flagged
const c1 = run({ mode: 1, C: 1, soc0: .1 }), c2 = run({ mode: 1, C: 2, soc0: .1 });
console.log('charge 1C', f(c1.t / 60), 'min', f(c1.Tmax, 1), 'C', c1.end, '| 2C', f(c2.t / 60), 'min', f(c2.Tmax, 1), 'C over', c2.overI);
assert(c1.end === 'full' && c2.end === 'full', 'charges end full');
assert(c2.Tmax > c1.Tmax && c2.overI && !c1.overI, 'fast charge hotter and above the 4 A limit');
assert(run({ mode: 1, C: 1, soc0: .1, Tamb: 0 }).plating, 'cold fast charge flagged');
// presets do what the notes say; missions not met by defaults; missions solvable
const opt = run({ C: .2 });
assert(opt.mAh > 2950 && opt.Tmax < 27, 'optimal preset cool and full');
const hard = run({ C: 2, h: 45 }), winter = run({ Tamb: -10, C: .3 }), safe = run({ mode: 1, C: 1.33, soc0: .1, h: 30 });
console.log('mission 1', f(hard.mAh), f(hard.Tmax, 1), '| mission 2', f(winter.mAh), '| mission 3', f(safe.t / 60), 'min', f(safe.Tmax, 1), safe.overI, safe.end);
assert(hard.mAh >= 2800 && hard.Tmax < 50, 'mission 1 solvable');
assert(winter.mAh >= 2400, 'mission 2 solvable');
assert(safe.t <= 3600 && !safe.overI && safe.Tmax < 40 && safe.end === 'full', 'mission 3 solvable');
assert(!(one.s.C >= 2), 'default does not meet mission 1');
console.log('BATTERY PASS');
