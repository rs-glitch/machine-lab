// Checks for web/labs/microwave.js physics. Run: node tools/test_microwave.js
const MW = require('../web/labs/microwave.js'), assert = require('assert');
const f = (x, n = 1) => x.toFixed(n);
const F = MW.field(), base = { food: 0, power: 100, time: 120, turn: 1, stir: 0, R: 10, off: 0, fork: 0 };

console.log('lambda', f(MW.lam * 100, 2), 'cm; modes', F.modes.length);
assert(Math.abs(MW.lam - 0.1224) < 0.001, 'wavelength 12.2 cm at 2.45 GHz');

// hot-spot spacing on several lines across the cavity should be near lambda/2
const sp = [];
for (const yo of [0.08, 0.12, 0.15, 0.18, 0.22]) {
  const pts = []; for (let q = 0; q <= 300; q++) { const x = 0.03 + 0.24 * q / 300; pts.push([x * 100, MW.sampleI(F, x, yo)]); }
  const pk = MW.peaks(pts); if (pk.length > 1) sp.push((pk[pk.length - 1][0] - pk[0][0]) / (pk.length - 1));
}
const msp = sp.reduce((a, b) => a + b) / sp.length, choc = MW.spotSpacing(F, { R: 10, off: 0 });
console.log('hot-spot spacing on 5 lines', sp.map(v => f(v)).join(', '), 'cm; mean', f(msp), '; chocolate line', f(choc, 2), 'vs lambda/2', f(MW.lam * 50, 2));
assert(msp > MW.lam * 100 * 0.4 && msp < MW.lam * 100 * 0.8, 'spot spacing between 0.4 and 0.8 lambda');
assert(Math.abs(choc - MW.lam * 50) / (MW.lam * 50) < 0.1, 'chocolate line spacing within 10 % of lambda/2');

// turntable reduces the temperature spread
const std = r => { const T = r.snaps[r.snaps.length - 1], m = r.mean; return Math.sqrt(T.reduce((a, v) => a + (v - m) ** 2, 0) / T.length); };
const on = MW.simulate(base, F), off = MW.simulate({ ...base, turn: 0 }, F);
console.log('std turntable on', f(std(on)), 'off', f(std(off)), 'K; mean', f(on.mean), f(off.mean));
assert(std(on) < std(off), 'turntable reduces spread');

// energy balance for every food, incl. boiling and thawing
for (const s of [base, { ...base, time: 600 }, { ...base, food: 1, time: 600 }, { ...base, food: 2, turn: 0, time: 60 }, { ...base, power: 30, stir: 1, time: 300 }]) {
  const r = MW.simulate(s, F), err = Math.abs(r.Estored + r.Eboil - r.Ein) / r.Ein;
  console.log(MW.FOODS[s.food].n, s.time + 's p' + s.power, 'Ein', f(r.Ein / 1e3), 'kJ stored+boil', f((r.Estored + r.Eboil) / 1e3), 'kJ err', (err * 100).toFixed(3) + '%',
    'min/mean/max', f(r.min), f(r.mean), f(r.max), 'boiled', f(r.boiled * 1e3), 'g thaw', f(r.thawFrac * 100) + '%');
  assert(err < 0.01, 'energy balance within 1 %');
}

// presets and missions: what each one gives
const P = {
  opt: { food: 0, power: 60, time: 420, turn: 1, stir: 1, R: 10, off: 3, fork: 0 },
  quick: base, frozen: { food: 1, power: 100, time: 300, turn: 0, stir: 0, R: 8, off: 0, fork: 0 },
  long: { ...base, time: 420 }, fork: { ...base, fork: 1 },
};
for (const [k, s] of Object.entries(P)) { const r = MW.simulate(s, F);
  console.log('preset', k, 'min', f(r.min), 'mean', f(r.mean), 'max', f(r.max), 'boiled', f(r.boiled * 1e3), 'g below74', f(r.below * 100), '% thaw', f(r.thawFrac * 100), '% Pavg', f(r.Pavg), 'W'); }
const opt = MW.simulate(P.opt, F);
assert(opt.min >= 74 && opt.boiled === 0, 'optimal preset is safe and even');
assert(MW.simulate(base, F).min < 74, 'default does not finish mission 2');
for (const s of [base, P.frozen]) { const r = MW.simulate(s, F); assert(!(r.s.food === 1 && r.thawFrac >= .999 && r.max <= 40), 'defaults/presets do not finish mission 3'); }
const fr = MW.simulate(P.frozen, F); assert(fr.boiled > 0 || fr.max > 90, 'frozen block runaway');
// a thaw that satisfies mission 3 exists
let ok = null;
for (const power of [10, 20, 30]) for (const time of [600, 900, 1200]) for (const R of [6, 7, 8]) {
  const r = MW.simulate({ food: 1, power, time, turn: 1, stir: 1, R, off: 3, fork: 0 }, F);
  if (!ok && r.thawFrac >= .999 && r.max <= 40) ok = { power, time, R, max: f(r.max) };
}
console.log('mission 3 solution', ok); assert(ok, 'mission 3 solvable');
console.log('MICROWAVE PASS');
