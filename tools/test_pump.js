// Sanity checks for web/labs/pump.js physics. Run: node tools/test_pump.js
require('../web/labs/pump.js');
const P = globalThis.PumpPhys, assert = require('assert'), f = (x, n = 1) => x.toFixed(n);
const base = { rpm: 2850, height: 2, dia: 16, valve: 100, lift: 2, temp: 15 };

console.log('BEP', f(P.QBEP0, 2), 'm3/h at', f(P.ETABEP * 100), '%');
assert(P.ETABEP > .4 && P.ETABEP < .6, 'small-pump efficiency range');
// operating point: pump head = system head
for (const s of [base, { ...base, height: 14, dia: 25 }, { ...base, valve: 10 }, { ...base, rpm: 1800 }]) {
  const r = P.solve(s); if (r.dead) continue;
  assert(Math.abs(r.H - (r.Hs + r.C * r.Q * r.Q)) < 1e-6, 'head balance ' + JSON.stringify(s));
}
// affinity laws on the pump alone
const r1 = 2000 / 2850; assert(Math.abs(P.head(0, 2000) - 40 * r1 * r1) < 1e-9 && Math.abs(P.shaft(0, 2000) - 250 * r1 ** 3) < 1e-9, 'affinity');
// trends: closing the valve cuts flow; higher tank cuts flow; above shut-off head no flow
assert(P.solve({ ...base, valve: 20 }).Q < P.solve(base).Q, 'valve cuts flow');
assert(P.solve({ ...base, height: 20 }).Q < P.solve(base).Q, 'height cuts flow');
assert(P.solve({ ...base, height: 40 }).dead, 'dead-head above shut-off');
// vapour pressure: 100 C ~ 101 kPa, 20 C ~ 2.3 kPa
assert(Math.abs(P.pv(90) - 70.1) < 2 && Math.abs(P.pv(20) - 2.34) < .05, "vapour pressure vs steam tables (90 C 70.1 kPa, 20 C 2.34 kPa)");
// speed control beats throttling at the same flow (10 m tank, ~30 L/min)
const thr = (() => { let lo = 5, hi = 100; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; P.solve({ ...base, height: 10, dia: 25, valve: m }).Lmin < 30 ? lo = m : hi = m; } return P.solve({ ...base, height: 10, dia: 25, valve: lo }); })();
const spd = (() => { let lo = 1000, hi = 3500; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; P.solve({ ...base, height: 10, dia: 25, rpm: m }).Lmin < 30 ? lo = m : hi = m; } return P.solve({ ...base, height: 10, dia: 25, rpm: lo }); })();
console.log('30 L/min to 10 m: throttled', f(thr.Pel), 'W, speed control', f(spd.Pel), 'W at', f(spd.s.rpm, 0), 'rpm');
assert(spd.Pel < thr.Pel * .85, 'speed control saves power');

const pre = { opt: { rpm: 2850, height: 25, dia: 25, valve: 100, lift: 2, temp: 15 }, wide: { ...base, height: 8, dia: 25 }, shut: { ...base, height: 5, dia: 25, valve: 5 },
  high: { ...base, height: 40, dia: 25 }, hot: { ...base, height: 5, dia: 25, lift: 6, temp: 85 } };
for (const [k, s] of Object.entries(pre)) { const r = P.solve(s); console.log(k.padEnd(5), f(r.Lmin), 'L/min', f(r.H), 'm', f(r.eta * 100), '%', f(r.Pel), 'W', 'bep', f(r.bep, 2), 'npsh', f(r.margin, 2), 'useful', f(r.useful * 100), r.cav ? 'CAV' : '', r.dead ? 'DEAD' : ''); }
assert(Math.abs(P.solve(pre.opt).bep - 1) < .05, 'opt preset at BEP');
assert(P.solve(pre.shut).useful < .1 && P.solve(pre.opt).useful > 2 * P.solve(pre.shut).useful, 'throttled: little power lifts water');
assert(P.solve(pre.high).dead, 'tank out of reach: no flow');
assert(P.solve(pre.hot).cav, 'hot deep well cavitates');
assert(!P.solve(pre.opt).cav && !P.solve(base).cav, 'no cavitation in normal use');
assert(Object.values(pre).every(s => P.solve(s).useful <= P.solve(pre.opt).useful + 1e-9), 'opt preset lifts water most efficiently');

const m1 = r => r.s.rpm <= 2000 && r.s.height >= 8 && !r.dead && Math.abs(r.bep - 1) < .05;
const m2 = r => r.s.height >= 10 && r.s.valve >= 95 && r.Lmin >= 25 && r.Lmin <= 35;
const m3 = r => r.s.lift >= 5 && r.s.temp >= 60 && r.Lmin >= 20 && !r.cav;
for (const [k, s] of Object.entries(pre)) { const r = P.solve(s); assert(!m1(r) && !m2(r) && !m3(r), 'preset completes a mission: ' + k); }
const g = []; for (let rpm = 1000; rpm <= 3500; rpm += 50) for (const height of [8, 10, 11, 12, 18, 20, 25]) for (const dia of [13, 20, 25, 32, 40]) for (const valve of [50, 100]) for (const [lift, temp] of [[2, 15], [5, 60], [6, 70]]) g.push(P.solve({ rpm, height, dia, valve, lift, temp }));
const a = g.find(m1), b = g.find(m2), c = g.find(m3);
console.log('m1', a && JSON.stringify(a.s), '\nm2', b && JSON.stringify(b.s), '\nm3', c && JSON.stringify(c.s));
assert(a && b && c, 'missions reachable');
console.log('PUMP PASS');
