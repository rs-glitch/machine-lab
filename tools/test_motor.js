// Sanity checks for web/labs/motor.js physics. Run: node tools/test_motor.js
require('../web/labs/motor.js');
const P = globalThis.MotorPhys, assert = require('assert'), f = (x, n = 1) => x.toFixed(n);

// catalogue-like numbers at 12 V, cold winding
const R0 = P.R0, rpm0 = P.line(12, R0, 0) * 30 / Math.PI, Ts = P.KT * 12 / R0 - P.TF;
console.log('12 V: no-load', f(rpm0, 0), 'rpm, stall', f(Ts, 3), 'N m,', f(12 / R0, 0), 'A');
assert(rpm0 > 18000 && rpm0 < 21000 && Ts > .25 && Ts < .3, '550-size motor range');

// steady state: motor torque = load torque + friction; power balance Pin = Pout + copper + friction losses
for (const s of [{ V: 12, load: 0, amt: 50 }, { V: 12, load: 1, amt: 11 }, { V: 6, load: 0, amt: 100 }, { V: 18, load: 2, amt: 0 }]) {
  const r = P.solve(s), Tf = P.TF + P.B * r.w;
  assert(Math.abs(r.Tm - r.Tl - Tf) < 1e-6, 'torque balance ' + JSON.stringify(s));
  assert(Math.abs(r.Pin - r.Pout - r.heat - Tf * r.w) < 1e-6, 'power balance');
  assert(r.eta < 1 && r.eta >= 0, 'efficiency in 0..1');
}
// more load -> slower, more current; more voltage -> faster
const a = P.solve({ V: 12, load: 1, amt: 10 }), b = P.solve({ V: 12, load: 1, amt: 30 });
assert(b.rpm < a.rpm && b.i > a.i, 'load slows the motor and raises current');
assert(P.solve({ V: 9, load: 1, amt: 10 }).rpm < a.rpm, 'voltage sets speed');
// peak efficiency current ~ sqrt(I0 * Istall)
const best = P.best(12, R0), I0 = (P.TF + P.B * best.w) / P.KT;
console.log('best eta', f(best.eta * 100), '% at', f(best.T, 3), 'N m,', f(best.i, 1), 'A; sqrt(I0 Is) =', f(Math.sqrt(I0 * 12 / R0), 1));
assert(Math.abs(best.i - Math.sqrt(I0 * 12 / R0)) / best.i < .15, 'peak efficiency near sqrt(I0 Is)');

// presets
const pre = { opt: { V: 12, load: 1, amt: 11 }, fan: { V: 12, load: 0, amt: 50 }, stall: { V: 12, load: 1, amt: 100 }, over: { V: 18, load: 2, amt: 0 }, weak: { V: 6, load: 0, amt: 100 } };
for (const [k, s] of Object.entries(pre)) { const r = P.solve(s); console.log(k.padEnd(6), f(r.rpm, 0), 'rpm', f(r.i, 1), 'A', f(r.eta * 100), '%', f(r.Tw), 'C', r.stall ? 'STALL' : '', r.burn ? 'BURN' : ''); }
const ro = P.solve(pre.opt);
assert(ro.eta > ro.best.eta - .005 && !ro.burn, 'opt preset is at peak efficiency');
assert(P.solve(pre.stall).stall && P.solve(pre.stall).burn, 'stall preset stalls and burns');
assert(P.solve(pre.over).rpm > 25000, 'overvolted spins fast');

// missions: m1 needs exact peak (preset is close but must not complete it), m2 and m3 reachable, defaults fail
const m1 = r => r.s.load === 1 && r.s.V <= 9 && !r.stall && r.eta >= r.best.eta - .005;
const m2 = r => r.s.load === 1 && Math.abs(r.Pout - r.Pmax) / r.Pmax < .03 && !r.burn;
const m3 = r => r.s.load === 0 && r.s.amt >= 80 && r.rpm >= 9000 && r.Tw < 100;
const def = P.solve({ V: 12, load: 0, amt: 50 });
for (const [k, s] of Object.entries(pre)) { const r = P.solve(s); assert(!m1(r) && !m2(r) && !m3(r), 'preset completes a mission: ' + k); }
assert(!m1(def) && !m2(def) && !m3(def), 'defaults complete a mission');
const grid = []; for (let V = 3; V <= 18; V += .5) for (let amt = 0; amt <= 100; amt++) for (const load of [0, 1]) grid.push(P.solve({ V, load, amt }));
const s1 = grid.find(m1), s2 = grid.find(m2), s3 = grid.find(m3);
console.log('m1', s1 && JSON.stringify(s1.s), 'm2', s2 && JSON.stringify(s2.s), 'm3', s3 && JSON.stringify(s3.s));
assert(s1 && s2 && s3, 'all missions reachable on the slider grid');
console.log('MOTOR PASS');
