// Checks for web/labs/airfoil.js physics. Run: node tools/test_airfoil.js
require('../web/labs/airfoil.js');
const A = globalThis.WingPhys, assert = require('assert'), f = (x, n = 2) => x.toFixed(n);
const base = { V: 45, aoa: 6, flap: 0, alt: 0, mass: 1111 };

// lift curve: zero lift near -2.1°, linear slope below the 2D value, stall then drop
assert(Math.abs(A.CL(A.ALPHA0, 0)) < 1e-9, 'zero lift at alpha0');
console.log('3D lift slope', f(A.cla(), 4), '/deg (2D', A.A2D, '); stall', f(A.stallAngle(0), 1), '° clean,', f(A.stallAngle(30), 1), '° with 30° flaps');
assert(A.cla() < A.A2D && A.cla() > .07, 'finite wing slope below 2D slope');
assert(A.CL(A.stallAngle(0) + 4, 0) < A.CLMAX, 'lift drops past stall');
assert(A.CD(A.stallAngle(0) + 4, 0) > 2 * A.CD(A.stallAngle(0) - 1, 0), 'drag more than doubles past stall');
assert(A.CL(4, 30) > A.CL(4, 0) && A.CD(4, 30) > A.CD(4, 0), 'flaps add lift and drag');

// performance numbers against the published class values (est.)
const b = A.best(0), r0 = A.solve(base);
console.log('best L/D', f(b.ld, 1), 'at', f(b.a, 1), '°; clean stall', f(r0.Vs, 1), 'm/s =', f(r0.Vs * 1.944, 0), 'kt');
assert(b.ld > 9 && b.ld < 13, 'best L/D in light-aircraft range');
assert(r0.Vs * 1.944 > 45 && r0.Vs * 1.944 < 56, 'clean stall near published 48-53 kt');
assert(Math.abs(A.rho(0) - 1.225) < .002 && Math.abs(A.rho(3000) / A.rho(0) - .742) < .01, 'ISA density');
const cruise = A.solve({ V: 60, aoa: r0.aNeed, flap: 0, alt: 0, mass: 1111 });
assert(Math.abs(A.solve({ ...base, V: 60, aoa: A.solve({ ...base, V: 60 }).aNeed }).n - 1) < 1e-6, 'aNeed gives level flight');
console.log('level at 60 m/s needs', f(A.solve({ ...base, V: 60 }).aNeed, 2), '°; at 25 m/s clean needs CL', f(A.solve({ ...base, V: 25 }).clNeed, 2));

// missions: defaults and presets do not satisfy them; each is solvable
const ok = s => A.checks.map(c => c(A.solve(s)));
assert(!ok(base).some(Boolean), 'defaults complete no mission');
A.presets.forEach(p => { const r = A.solve(p.s); console.log(' preset', p.n.padEnd(32), 'n', f(r.n), 'L/D', f(r.LD, 1), r.stalled ? 'STALLED' : '');
  assert(!ok(p.s).some(Boolean), 'preset ' + p.n + ' completes a mission'); });
const snap = (st) => { const a = A.solve(st).aNeed; return a === null ? null : Object.assign({}, st, { aoa: Math.round(a * 2) / 2 }); };
const find = (cands, i) => cands.map(snap).find(st => st && ok(st)[i]);
assert(find([55, 56, 57, 58, 59, 60, 61, 62].map(V => ({ ...base, V })), 0), 'mission 1 solvable on slider steps');
let m2 = null; for (let V = 40; V <= 60 && !m2; V += .5) { const st = { ...base, V, alt: 3000, aoa: Math.round(A.best(0).a * 2) / 2 }; if (ok(st)[1]) m2 = st; }
assert(m2, 'mission 2 solvable'); console.log(' mission 2 example V', m2.V, 'aoa', m2.aoa);
assert(find([{ ...base, V: 25, flap: 30 }, { ...base, V: 25, flap: 20 }, { ...base, V: 24.5, flap: 30 }], 2), 'mission 3 solvable with flaps');
assert(!find([{ ...base, V: 25, flap: 0 }], 2), 'mission 3 not solvable clean');
console.log('AIRFOIL PASS');
