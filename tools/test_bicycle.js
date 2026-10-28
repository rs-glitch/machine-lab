// Sanity checks for web/labs/bicycle.js physics. Run: node tools/test_bicycle.js
require('../web/labs/bicycle.js');
const B = globalThis.BikePhys, assert = require('assert'), f = (x, n = 1) => x.toFixed(n);
const base = { P: 200, slope: 0, ring: 1, cog: 5, pos: 2, bar: 6, wind: 0, mass: 85 };

// power balance: solved speed reproduces the rider power
for (const s of [base, { ...base, slope: 10 }, { ...base, slope: -6, P: 50 }, { ...base, wind: 30, pos: 0 }]) {
  const r = B.solve(s);
  assert(Math.abs(r.total - s.P) < 0.5, `power balance ${JSON.stringify(s)}`);
}
// gear kinematics: 50/17 at 30 km/h
const cad = B.cadence(base, 30 / 3.6), expect = 30 / 3.6 / 2.105 * 60 / (50 / 17);
assert(Math.abs(cad - expect) < 1e-9 && Math.abs(cad - 80.8) < 0.1, 'cadence 50/17 @30 km/h = 80.8 rpm');
// speed does not depend on gear in steady state; cadence does
assert(Math.abs(B.solve({ ...base, cog: 0 }).v - B.solve(base).v) < 1e-9, 'gear does not change steady speed');
// aero dominates on the flat above ~25 km/h
const n25 = B.need(base, 25 / 3.6), n12 = B.need(base, 12 / 3.6);
assert(n25.aero > 2 * n25.roll, 'aero > 2x rolling at 25 km/h'); assert(n12.aero < 3 * n12.roll, 'rolling matters at 12 km/h');
// published-range sanity: 200 W flat on the drops ~30-34 km/h
const r = B.solve(base);
console.log('200 W drops flat:', f(r.kmh), 'km/h; aero share', f(r.shAero * 100, 0), '%; cadence', f(r.cad, 0));
assert(r.kmh >= 30 && r.kmh <= 34.5, '200 W drops = 30-34 km/h');
// presets as described, missions not solved by defaults/presets, but solvable
const P = {
  opt: { P: 200, slope: 0, ring: 1, cog: 5, pos: 2, bar: 6.5, wind: 0, mass: 80 }, commute: { P: 120, slope: 1, ring: 0, cog: 4, pos: 0, bar: 4, wind: 0, mass: 90 },
  climbTop: { P: 250, slope: 12, ring: 1, cog: 0, pos: 1, bar: 6, wind: 0, mass: 85 }, headwind: { P: 150, slope: 0, ring: 0, cog: 6, pos: 0, bar: 4, wind: 30, mass: 90 },
  flat: { P: 150, slope: 0, ring: 1, cog: 7, pos: 1, bar: 1, wind: 0, mass: 85 } };
for (const [k, s] of Object.entries(P)) { const q = B.solve(s); console.log(' preset', k, f(q.kmh), 'km/h', f(q.cad, 0), 'rpm', f(q.force, 0), 'N; aero/roll/climb %', f(q.shAero * 100, 0), f(q.shRoll * 100, 0), f(q.shClimb * 100, 0)); }
const M = [r => r.s.slope >= 8 && r.s.P >= 200 && r.cad >= 85 && r.cad <= 95, r => r.s.wind >= 15 && r.kmh >= 30 && r.s.P <= 240, r => r.s.slope >= 12 && r.force <= 300 && r.cad >= 50];
const defaults = { P: 200, slope: 0, ring: 1, cog: 5, pos: 1, bar: 6, wind: 0, mass: 85 };
for (const s of [defaults, ...Object.values(P)]) M.forEach((m, i) => assert(!m(B.solve(s)), `mission ${i + 1} not given away`));
assert(M[0](B.solve({ ...defaults, slope: 8, P: 250, ring: 0, cog: 11 })), 'mission 1 solvable');
assert(M[1](B.solve({ ...defaults, wind: 15, P: 240, pos: 3, bar: 8 })), 'mission 2 solvable');
assert(M[2](B.solve({ ...defaults, slope: 12, P: 250, ring: 0, cog: 11 })), 'mission 3 solvable');
assert(B.solve(P.climbTop).force > 800 && B.solve(P.flat).shRoll > 2 * B.solve({ ...P.flat, bar: 6 }).shRoll * 0.9, 'edge presets behave');
console.log('BICYCLE PASS');
