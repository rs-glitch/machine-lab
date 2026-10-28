// Sanity checks for web/physics.js. Run: node tools/test_physics.js
require('../web/r600a.js'); require('../web/physics.js');
const P = globalThis.Phys, assert = require('assert');
const f = (x, n = 2) => x.toFixed(n);

// Fridge: reference conditions and trends
const r = P.fridgeCycle({});
console.log('fridge', { Te: r.Te, Tc: r.Tc, Pe: f(r.Pe), Pc: f(r.Pc), T2: f(r.T2, 1), x4: f(r.x4), Qe: f(r.Qe, 1),
  Pel: f(r.Pel, 1), COP: f(r.COP), COPcarnot: f(r.COPcarnot), duty: f(r.duty), kWh: f(r.kWhDay) });
assert(Math.abs(P.satAt(-20).P - 72.48) < 0.1, 'Psat(-20C) matches CoolProp');
assert(r.h2 > r.h2s && r.h2s > r.h1 && r.h1 > r.h4, 'enthalpy order');
assert(r.COP < r.COPcarnot, 'below Carnot');
assert(P.fridgeCycle({ Troom: 35 }).COP < r.COP, 'hotter room lowers COP');
assert(P.fridgeCycle({ approach: 22 }).T2 > r.T2, 'dirty condenser raises discharge T');

// Engine: efficiency trends, MBT, knock with compression ratio and octane
const e = P.engineCycle({});
console.log('engine', { imep: f(e.imep), bmep: f(e.bmep), Nm: f(e.torque, 1), kW: f(e.power, 1), etaI: f(e.etaI, 3),
  etaB: f(e.etaB, 3), otto: f(e.etaOtto, 3), Pmax: f(e.Pmax, 1), thPmax: e.thPmax, knockI: f(e.knockI) });
const sw = P.sparkSweep({}), best = sw.reduce((a, b) => (b[1] > a[1] ? b : a));
console.log('MBT spark', best[0], 'deg; knock from', (sw.find(s => s[2]) || ['none'])[0]);
assert(best[0] > 10 && best[0] < 40, 'MBT in plausible range');
assert(P.engineCycle({ CR: 12 }).etaI > e.etaI, 'higher CR more efficient');
assert(P.engineCycle({ pInt: 40 }).pmep > e.pmep, 'throttling adds pumping loss');
assert(P.engineCycle({ CR: 14, octane: 87 }).knockI > P.engineCycle({ CR: 14, octane: 98 }).knockI, 'octane resists knock');
for (const cr of [8, 10, 12, 14]) console.log(' CR', cr, 'knockI@87', f(P.engineCycle({ CR: cr, octane: 87, rpm: 1500 }).knockI),
  '@98', f(P.engineCycle({ CR: cr, octane: 98, rpm: 1500 }).knockI));

// Washer: steady-state peak near fn; time sim matches steady state at 1200 rpm
const pk = [...Array(600).keys()].map(n => [n, P.washerSteady({}, n).X]).reduce((a, b) => (b[1] > a[1] ? b : a));
console.log('washer peak at', pk[0], 'rpm, X', f(pk[1] * 1e3, 1), 'mm; at 1200:', f(P.washerSteady({}, 1200).X * 1e3, 2), 'mm',
  'F', f(P.washerSteady({}, 1200).F, 0), 'N');
assert(Math.abs(pk[0] - 150) < 10, 'resonance at fn*60');
const s = { t: 0, phi: 0, w: 0, x: 0, y: 0, vx: 0, vy: 0 };
let maxAmp = 0;
for (let i = 0; i < 30000; i++) { P.washerStep({}, s, 1e-3, 1200 * Math.PI / 30); if (s.t > 2 && s.t < 6) maxAmp = Math.max(maxAmp, s.amp); }
console.log('sim at 1200 rpm X', f(s.amp * 1e3, 2), 'mm; max during ramp', f(maxAmp * 1e3, 1), 'mm');
assert(Math.abs(s.amp - P.washerSteady({}, 1200).X) / s.amp < 0.1, 'time sim matches steady state');
console.log('ALL PASS');

// Engine cylinders: torque scales with n; crank-torque mean matches the cycle work; more cylinders run smoother
const one = P.engineCycle({ nCyl: 1 }), six = P.engineCycle({ nCyl: 6 });
assert(Math.abs(six.torque / one.torque - 6) < 1e-9, 'torque scales with cylinders');
let prev = Infinity;
for (const n of [1, 2, 3, 4, 5, 6]) {
  const r = P.engineCycle({ nCyl: n }), ct = P.crankTorque(r, n);
  console.log(' cyl', n, P.FIRING[n][1], 'mean gas', f(ct.mean, 1), 'N m; expect', f(n * r.W / (4 * Math.PI), 1), '; ripple', f(ct.ripple, 2), 'min', f(ct.min, 0));
  assert(Math.abs(ct.mean - n * r.W / (4 * Math.PI)) / ct.mean < 0.02, 'crank torque mean = n W / 4 pi');
  assert(ct.ripple < prev + 1e-9, 'ripple falls with more cylinders'); prev = ct.ripple;
}
console.log('CYL PASS');
