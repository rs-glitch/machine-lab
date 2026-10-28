// Sanity checks for web/labs/camera.js physics. Run: node tools/test_camera.js
require('../web/labs/camera.js');
const C = globalThis.CamPhys, assert = require('assert'), f = (x, n = 2) => x.toFixed(n);
const base = { sensor: 2, feq: 50, n: 4, focus: 30, t: 5, iso: 0, scene: 1, speed: 0 };
const idx = (arr, v) => arr.findIndex(x => Math.abs(x - v) < 1e-9);

// hyperfocal: 50 mm f/8 full frame = 10.4 m (widely published; DOFMaster equations)
const h = C.solve({ ...base, n: idx(C.N, 8) });
console.log('H 50mm f/8 FF:', f(h.H), 'm');
assert(Math.abs(h.H - 10.47) < .05, 'hyperfocal 50 mm f/8');
// DOF at 10 m: near 5.12 m, far ~222 m by the same equations
const k10 = Math.round(60 * Math.log(10 / .3) / Math.log(100)), d = C.solve({ ...base, n: idx(C.N, 8), focus: k10 });
const Hh = d.H, S = d.S, fl = d.f, nearX = S * (Hh - fl) / (Hh + S - 2 * fl);
assert(Math.abs(d.near - nearX) < 1e-9 && d.near < S && d.far > S, 'near/far bracket the focus distance');
// focusing at the hyperfocal distance gives near ~ H/2 and far = infinity
const q = C.solve({ ...base, feq: 24, n: idx(C.N, 8), focus: 60 });
assert(q.far === Infinity, 'beyond H the far limit is infinite');
// sunny 16: f/16, 1/125 s, ISO 100 in sun is correct within 0.1 stop
const sun = C.solve({ ...base, scene: 0, n: idx(C.N, 16), t: C.T.indexOf(1 / 125) });
console.log('sunny 16 error:', f(sun.err), 'stops');
assert(Math.abs(sun.err) < .1, 'sunny 16 rule');
// trends: smaller aperture -> less defocus blur, more diffraction; longer lens -> more background blur
const a = C.solve({ ...base, n: 0 }), b = C.solve({ ...base, n: 8 });
assert(b.subj[2].k < a.subj[2].k && b.airy > a.airy, 'aperture trend');
assert(C.solve({ ...base, feq: 100 }).subj[2].k > C.solve(base).subj[2].k, 'focal length trend');
assert(C.solve({ ...base, sensor: 0 }).subj[2].k < C.solve(base).subj[2].k, 'small sensor -> deeper DOF');
// thin lens: image distance and magnification for 50 mm at 3 m
const v = 1 / (1 / .05 - 1 / 3); assert(Math.abs(v * 1000 - 50.85) < .01, 'thin lens v');

// presets as described; missions not met by defaults or presets but solvable
const presets = {
  opt: { sensor: 2, feq: 24, n: 5, focus: 28, t: 3, iso: 0, scene: 0, speed: 0 }, phone: { sensor: 0, feq: 26, n: 1, focus: 30, t: 2, iso: 0, scene: 1, speed: 0 },
  sport: { sensor: 2, feq: 86, n: 2, focus: 30, t: 7, iso: 0, scene: 2, speed: 6 }, f22: { sensor: 1, feq: 50, n: 8, focus: 30, t: 6, iso: 0, scene: 0, speed: 0 },
  missed: { sensor: 2, feq: 86, n: 0, focus: 21, t: 1, iso: 0, scene: 1, speed: 0 },
};
const R = Object.fromEntries(Object.entries(presets).map(([k, s]) => [k, C.solve(s)]));
console.log('opt: err', f(R.opt.err), 'near', f(R.opt.near), 'far', R.opt.far, '| sport: err', f(R.sport.err), 'blur px', f(R.sport.mblur, 0),
  '| f22 airy x', f(R.f22.airyK), 'err', f(R.f22.err), '| missed person x', f(R.missed.subj[1].k, 0), 'err', f(R.missed.err), '| phone err', f(R.phone.err));
assert(Math.abs(R.opt.err) <= .5 && R.opt.far === Infinity && R.opt.subj[1].k <= 1 && R.opt.subj[2].k <= 1, 'optimal preset');
assert(R.sport.err < -.5 && R.sport.mblur > 100, 'indoor sport preset');
assert(R.f22.airyK > 1 && Math.abs(R.f22.err) <= .5, 'f/22 preset');
assert(R.missed.subj[1].k > 10 && Math.abs(R.missed.err) <= .5, 'missed focus preset');
assert(Math.abs(R.phone.err) <= .5, 'phone preset exposure');
for (const [m, fn] of Object.entries(C.M)) {
  assert(!fn(C.solve(base)), `defaults do not complete ${m}`);
  for (const [k, r] of Object.entries(R)) assert(!fn(r), `preset ${k} does not complete ${m}`);
}
const sol = {
  portrait: { sensor: 2, feq: 86, n: 2, focus: 30, t: 3, iso: 0, scene: 1, speed: 0 },
  freeze: { sensor: 2, feq: 24, n: 1, focus: 30, t: 0, iso: 2, scene: 1, speed: 5 },
  allSharp: { sensor: 2, feq: 24, n: 6, focus: 26, t: 3, iso: 0, scene: 0, speed: 0 },
};
for (const [m, s] of Object.entries(sol)) { const r = C.solve(s);
  console.log('solution', m, 'err', f(r.err), 'blur x', r.subj.map(z => f(z.k, 1)).join('/'), 'mblur', f(r.mblur, 1), 'airy x', f(r.airyK));
  assert(C.M[m](r), `mission ${m} solvable`); }
console.log('CAMERA PASS');
