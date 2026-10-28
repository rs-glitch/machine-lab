// Checks for web/labs/windturbine.js physics. Run: node tools/test_windturbine.js
require('../web/labs/windturbine.js');
const W = globalThis.WindPhys, assert = require('assert'), f = (x, n = 2) => x.toFixed(n);
const base = { mode: 0, v: 8, lam: 7, beta: 0, R: 56, meanU: 7.5, T: 15 };

// Cp fit: peak about 0.48 at about 8.1, never above Betz
let best = [0, 0];
for (let l = .5; l <= 14; l += .01) for (const b of [0, 5, 10, 20, 30]) { const c = W.cp(l, b); assert(c < W.BETZ, 'below Betz'); if (b === 0 && c > best[1]) best = [l, c]; }
console.log('Cp max', f(best[1], 3), 'at λ', f(best[0], 2));
assert(Math.abs(best[1] - .48) < .01 && Math.abs(best[0] - 8.1) < .3, 'Cp peak matches the published fit');
assert(W.cp(8, 10) < W.cp(8, 0), 'pitch lowers Cp');
assert(Math.abs(W.induction(W.BETZ) - 1 / 3) < 1e-3, 'Betz at a = 1/3');

// power curve: zero below cut-in, rises as v^3, caps at rated, zero above cut-out
const cur = W.curve(base), vr = W.ratedWind(base);
console.log('rated wind', f(vr, 2), 'm/s; P(6)', f(W.autoP(base, 6) / 1e6), 'MW; P(9)', f(W.autoP(base, 9) / 1e6), 'MW');
assert(W.autoP(base, 2.5) === 0 && W.autoP(base, 26) === 0, 'cut-in / cut-out');
assert(vr > 9.5 && vr < 13.5, 'rated wind in the usual 10-13 m/s range');
for (let i = 1; i < cur.length; i++) if (cur[i][0] <= 25) assert(cur[i][1] >= cur[i - 1][1] - 1, 'monotonic up to cut-out');
assert(Math.abs(W.autoP(base, 18) - W.RATED) / W.RATED < .005, 'pitch holds rated');
const r9 = W.solve(Object.assign({}, base, { v: 9 }));
assert(Math.abs(r9.l - 8.1) < .01 && r9.b === 0, 'controller tracks best λ below rated');

// energy per year
for (const U of [6, 7.5, 9]) { const r = W.solve(Object.assign({}, base, { meanU: U })); console.log(' mean', U, 'm/s: AEP', f(r.aep / 1000, 1), 'GWh, CF', f(r.cf * 100, 0), '%'); }
const r75 = W.solve(base); assert(r75.cf > .25 && r75.cf < .45, 'capacity factor plausible at 7.5 m/s');
assert(W.solve(Object.assign({}, base, { T: -20 })).P > W.solve(Object.assign({}, base, { T: 35 })).P, 'cold air is denser');

// missions: defaults and presets do not satisfy them; each one is solvable
const ok = s => W.checks.map(c => c(W.solve(s)));
assert(!ok(base).some(Boolean), 'defaults complete no mission');
W.presets.forEach(p => { const st = Object.assign({}, base, p.s), res = ok(st); assert(!res.some(Boolean), 'preset ' + p.n + ' completes a mission');
  const r = W.solve(st); console.log(' preset', p.n.padEnd(28), 'P', f(r.raw / 1e6), 'MW Cp', f(r.Cp), 'λ', f(r.l, 1), 'β', f(r.b, 1), r.overload ? 'OVERLOAD' : '', r.stopped ? 'stopped' : ''); });
assert(ok(Object.assign({}, base, { mode: 1, v: 9, lam: 8.1, beta: 0 }))[0], 'mission 1 solvable');
let m2 = null;
for (let lam = 3; lam <= 6 && !m2; lam += .1) for (let b = 0; b <= 40; b++) { const st = Object.assign({}, base, { mode: 1, v: 18, lam: +lam.toFixed(1), beta: b }); if (ok(st)[1]) { m2 = st; break; } }
assert(m2, 'mission 2 solvable'); console.log(' mission 2 example λ', m2.lam, 'β', m2.beta);
let m3 = null; for (let R = 30; R <= 80 && !m3; R++) if (ok(Object.assign({}, base, { meanU: 6.5, R }))[2]) m3 = R;
assert(m3, 'mission 3 solvable'); console.log(' mission 3: R ≥', m3, 'm');
console.log('WINDTURBINE PASS');
