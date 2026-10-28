// Sanity checks for web/labs/thermostat.js physics. Run: node tools/test_thermostat.js [--tune]
require('../web/labs/thermostat.js');
const T = globalThis.ThermoPhys, assert = require('assert'), f = (x, n = 1) => x.toFixed(n);
const D = T.DEFAULTS, run = o => T.simulate(Object.assign({}, D, o));
const show = (n, r) => console.log(n.padEnd(22), 'OS', f(r.overshoot, 2), 'K | rise', f(r.rise, 0), 'min | settle', f(r.settle, 0), 'min | sse', f(r.sse, 2),
  'K | sw/h', f(r.swPerH, 1), '| recov', f(r.recover, 0), 'min | E', f(r.kWh, 2), 'kWh | band', f(r.band, 2));

if (process.argv.includes('--tune')) {  // grid search for a tuned PID and the Ziegler-Nichols point
  let best = null;
  for (const Kp of [.3, .5, .8, 1.2, 1.6, 2.4]) for (const Ti of [10, 20, 30, 45, 60, 90]) for (const Td of [0, 1, 2, 4, 6]) {
    const r = run({ mode: 3, Kp, Ti, Td }), cost = r.overshoot * 4 + r.settle / 30 + r.recover / 30;
    if (r.rise < 60 && (!best || cost < best.cost)) best = { Kp, Ti, Td, cost, r };
  }
  console.log('best', best.Kp, best.Ti, best.Td); show('tuned', best.r);
}

// Ziegler-Nichols: find the ultimate gain (P only, sustained oscillation) and its period
const zn = T.ultimate(D);
console.log('ultimate gain Ku', f(zn.Ku, 2), '/K, period Pu', f(zn.Pu, 1), 'min');
const znr = run({ mode: 3, Kp: .6 * zn.Ku, Ti: zn.Pu / 2, Td: zn.Pu / 8, aw: 1 });
show('Ziegler-Nichols PID', znr);
// analytic ultimate point of K/((1+s t1)(1+s t2)(1+s t3)): phase -180 deg, then |G| = 1/Ku
const K = D.Pmax / D.UA, ts = [T.C / D.UA, T.TAU_H, T.TAU_S];
let lo = 1e-5, hi = 1; for (let i = 0; i < 60; i++) { const w = (lo + hi) / 2; ts.reduce((a, t) => a + Math.atan(w * t), 0) < Math.PI ? (lo = w) : (hi = w); }
const w = lo, KuA = 1 / (K / ts.reduce((a, t) => a * Math.sqrt(1 + (w * t) ** 2), 1)), PuA = 2 * Math.PI / w / 60;
console.log('analytic Ku', f(KuA, 2), '/K, Pu', f(PuA, 1), 'min');
assert(Math.abs(zn.Ku - KuA) / KuA < .3 && Math.abs(zn.Pu - PuA) / PuA < .2, 'simulated ultimate point matches frequency-response theory');
const tunedR = run(T.OPT);
assert(znr.overshoot > tunedR.overshoot + .1, 'Ziegler-Nichols tuning overshoots more than the tuned PID (textbook: aggressive)');

const P = run({ mode: 1, Kp: .3 }), PI = run({ mode: 2, Kp: .3, Ti: 30 }), oo = run({ mode: 0, band: 1 }), oo01 = run({ mode: 0, band: .1 });
const wind = run({ mode: 2, Kp: .8, Ti: 10, aw: 0 }), noWind = run({ mode: 2, Kp: .8, Ti: 10, aw: 1 }), def = run({}), opt = run(T.OPT);
[['P only', P], ['PI', PI], ['on/off 1 K', oo], ['on/off 0.1 K', oo01], ['PI windup', wind], ['PI anti-windup', noWind], ['defaults', def], ['optimal preset', opt]].forEach(([n, r]) => show(n, r));
assert(P.sse > .3 && PI.sse < .1, 'P leaves an offset, I removes it');
assert(oo01.swPerH > 1.5 * oo.swPerH && oo01.band > .3, 'narrow band: more switching, but the lags keep a swing');
assert(wind.overshoot > noWind.overshoot + .3, 'windup adds overshoot');
assert(opt.overshoot < .3 && opt.rise < 60, 'optimal preset: little overshoot, fast rise');
// energy balance: heater energy = losses + stored heat
const e = def; assert(Math.abs(e.energyIn - e.energyLoss - e.energyStored) / e.energyIn < .01, 'energy balance');
console.log('energy in', f(e.energyIn / 3.6e6, 3), 'kWh = loss', f(e.energyLoss / 3.6e6, 3), '+ stored', f(e.energyStored / 3.6e6, 3));
// missions: defaults fail, each has a solution
const m1 = r => r.s.mode >= 2 && r.overshoot < .2 && r.rise <= 45, m2 = r => r.s.mode === 0 && r.band <= .5, m3 = r => r.s.Tout <= 0 && r.s.win && r.recover < 160 && r.overshootAfter < .2;
assert(!m1(def) && !m2(def) && !m3(def), 'defaults do not meet missions');
const s1 = run(T.OPT), s2 = run({ mode: 0, band: .1 }), s3 = run(Object.assign({}, T.OPT, { Tout: 0 }));
assert(!m3(run({ Tout: 0 })), 'default controller at 0 C does not meet mission 3');
show('mission 1 try', s1); show('mission 2 try', s2); show('mission 3 try', s3);
assert(m1(s1), 'mission 1 solvable'); assert(m2(s2), 'mission 2 solvable'); assert(m3(s3), 'mission 3 solvable');
console.log('THERMOSTAT PASS');
