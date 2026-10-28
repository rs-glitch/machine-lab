// Sanity checks for web/labs/gps.js physics. Run: node tools/test_gps.js
require('../web/labs/gps.js');
const G = globalThis.GpsPhys, assert = require('assert'), f = (x, n = 2) => x.toFixed(n);
const base = { time: 0, lat: 40, mask: 10, maxSats: 8, iono: 0, corr: 0, mp: 2, rel: 0 };

// orbit: radius 26,560 km gives a period of about 11 h 58 min (half a sidereal day)
const T = G.period(); console.log('period', f(T / 3600, 3), 'h');
assert(Math.abs(T - (11 * 3600 + 58 * 60)) < 60, 'period 11 h 58 min');
// satellites stay on the orbit sphere
G.sats(1234).forEach(q => assert(Math.abs(Math.hypot(...q.p) - G.A) < 1e-3, 'orbit radius'));
// zero noise: the solver recovers the true position and clock bias
const geo = G.geometry(base, 0), fx = G.fix(base, geo, () => 0, false);
console.log('zero-noise error', f(Math.hypot(fx.e, fx.n, fx.u), 6), 'm; bias', fx.bias);
assert(Math.hypot(fx.e, fx.n, fx.u) < 1e-3 && Math.abs(fx.bias - G.RX_BIAS) < 1e-12, 'zero-noise fix');
// solver works with exactly four satellites
assert(Math.hypot(...['e', 'n', 'u'].map(k => G.fix({ ...base, maxSats: 4 }, G.geometry({ ...base, maxSats: 4 }, 0), () => 0, false)[k])) < 1e-3, '4-satellite fix');
// more satellites -> lower HDOP (at a fixed time)
const g12 = G.geometry({ ...base, maxSats: 12, mask: 5 }, 0), d4 = G.dop(g12.vis.slice(0, 4), g12.r, 40), d8 = G.dop(g12.vis.slice(0, 8), g12.r, 40);
console.log('HDOP with 4 highest', f(d4.H), 'with 8', f(d8.H), '; visible at mask 5:', g12.vis.length);
assert(d8.H < d4.H, 'more satellites, better geometry');
// typical phone: 95 % radius near the gps.gov 4.9 m figure
const typ = G.state(base, 0, 400, 3); console.log('phone: rms', f(typ.rms), 'm, 95 %', f(typ.r95), 'm, expected', f(typ.exp), 'm');
assert(typ.r95 > 2.5 && typ.r95 < 10, 'phone accuracy in range');
// relativity: 38.6 us/day = 11.6 km/day of range
assert(Math.abs(G.C * 38.6e-6 / 1000 - 11.57) < .01, 'relativity scale');

// presets and missions
const P = {
  opt: { time: 0, lat: 40, mask: 5, maxSats: 12, iono: 1, corr: 1, mp: .5, rel: 0 }, typ: base,
  canyon: { ...base, mask: 35, maxSats: 12, mp: 8 }, four: { ...base, mask: 5, maxSats: 4 }, rel: { ...base, rel: 2 },
};
const S = Object.fromEntries(Object.entries(P).map(([k, s]) => [k, G.state(s, s.time * 3600, 200, 5)]));
for (const [k, st] of Object.entries(S)) console.log(' preset', k, 'used', st.nUsed, 'HDOP', st.dop ? f(st.dop.H) : '-', 'rms', f(st.rms), 'm');
assert(S.opt.rms < S.typ.rms && S.opt.rms < 2.5, 'optimal preset best');
assert(S.canyon.rms > 10 || S.canyon.nUsed < 4, 'urban canyon bad');
assert(S.four.dop.H > 2 * S.typ.dop.H, 'four clustered satellites: high DOP');
assert(S.rel.rms > 100, 'no relativity correction: > 100 m');
for (const [k, st] of Object.entries(S)) { assert(!G.M.valley(st), `preset ${k} not valley`); assert(!G.M.cm(st), `preset ${k} not cm`); assert(!G.M.einstein(st, false), `preset ${k} not einstein`); }
const def = G.state(base, 0, 80, 1); assert(!G.M.valley(def) && !G.M.cm(def) && !G.M.einstein(def, false), 'defaults complete nothing');
// solvable: valley (search the time of day), centimetre fix, Einstein two-step
let best = null; for (let h = 0; h <= 12; h += .25) { const st = G.state({ ...base, mask: 25, maxSats: 12, time: h }, h * 3600, 0); if (st.dop && (!best || st.dop.H < best.H)) best = { h, H: st.dop.H }; }
console.log('valley: best HDOP at mask 25 is', f(best.H), 'at', best.h, 'h');
assert(G.M.valley(G.state({ ...base, mask: 25, maxSats: 12, time: best.h }, best.h * 3600, 20)), 'valley solvable');
const cm = G.state({ ...base, corr: 2, iono: 1, mp: 0, mask: 10, maxSats: 12 }, 0, 200, 9); console.log('RTK rms', f(cm.rms, 3), 'm');
assert(G.M.cm(cm), 'centimetre fix solvable');
assert(G.M.einsteinArm(G.state({ ...base, rel: 1 }, 0, 80, 2)) && G.M.einstein(G.state(base, 0, 80, 2), true), 'Einstein two-step solvable');
console.log('GPS PASS');
