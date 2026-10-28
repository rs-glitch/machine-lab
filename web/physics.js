// Pure physics for the three labs. No DOM. Loaded by index.html and by tools/test_physics.js.
// Values marked "est." are engineering estimates, not measured data.
(function (G) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Fridge: vapour-compression cycle, R-600a tables from CoolProp ----------
  function satAt(Tc) {
    const S = G.R600A.sat, i = clamp(Math.floor(Tc - S.T[0]), 0, S.T.length - 2), f = Tc - S.T[i];
    const L = k => S[k][i] + (S[k][i + 1] - S[k][i]) * f;
    return { T: Tc, P: L('P'), hf: L('hf'), hg: L('hg'), sf: L('sf'), sg: L('sg'), vg: L('vg') };
  }
  // superheated property k at saturation temperature Tsat and superheat dT (bilinear)
  function shAt(Tsat, dT, k) {
    const S = G.R600A.sat, H = G.R600A.sh;
    const i = clamp(Math.floor(Tsat - S.T[0]), 0, S.T.length - 2), fi = Tsat - S.T[i];
    const j = clamp(Math.floor(dT / 5), 0, H.dT.length - 2), fj = dT / 5 - j;
    const r = (ii) => H[k][ii][j] + (H[k][ii][j + 1] - H[k][ii][j]) * fj;
    return r(i) + (r(i + 1) - r(i)) * fi;
  }
  // superheat at which property k equals target on the Tsat isobar
  function shInvert(Tsat, k, target) {
    let lo = 0, hi = 120;
    for (let n = 0; n < 40; n++) { const m = (lo + hi) / 2; (shAt(Tsat, m, k) < target ? (lo = m) : (hi = m)); }
    return (lo + hi) / 2;
  }

  const FRIDGE_DEFAULTS = {
    Troom: 25, Tset: -18, evapGap: 8, approach: 12, SH: 5, SC: 3, etaIs: 0.65, rpm: 3000,
    disp: 6.0,  // cm3, est. typical household reciprocating compressor
    UA: 1.2,    // W/K cabinet heat leak, est.
    door: 5,    // W average from door openings, est.
    etaMotor: 0.8,
  };
  function fridgeCycle(o) {
    const p = Object.assign({}, FRIDGE_DEFAULTS, o);
    const Te = p.Tset - p.evapGap, Tc = p.Troom + p.approach;
    const e = satAt(Te), c = satAt(Tc);
    const h1 = shAt(Te, p.SH, 'h'), s1 = shAt(Te, p.SH, 's'), v1 = shAt(Te, p.SH, 'v');
    const h2s = shAt(Tc, shInvert(Tc, 's', s1), 'h');
    const h2 = h1 + (h2s - h1) / p.etaIs;
    const T2 = Tc + shInvert(Tc, 'h', h2);
    const h3 = satAt(Tc - p.SC).hf;  // subcooled liquid ~ saturated liquid at same T
    const h4 = h3, x4 = (h4 - e.hf) / (e.hg - e.hf);
    const PR = c.P / e.P;
    const etaV = clamp(1 - 0.035 * (Math.pow(PR, 1 / 1.1) - 1), 0, 1);  // clearance model, c = 3.5 % est.
    const mdot = etaV * p.disp * 1e-6 * p.rpm / 60 / v1;              // kg/s
    const Qe = mdot * (h1 - h4) * 1e3, Wc = mdot * (h2 - h1) * 1e3, Pel = Wc / p.etaMotor;
    const load = p.UA * (p.Troom - p.Tset) + p.door;
    const duty = load / Qe;
    return {
      p, Te, Tc, Pe: e.P, Pc: c.P, PR, T1: Te + p.SH, T2, T3: Tc - p.SC, x4, h1, h2, h2s, h3, h4, s1, etaV, mdot,
      Qe, Wc, Pel, Qc: Qe + Wc, COP: Qe / Pel, COPcycle: (h1 - h4) / (h2 - h1),
      COPcarnot: (Te + 273.15) / (Tc - Te), load, duty, holds: duty <= 1,
      kWhDay: Pel * Math.min(duty, 1) * 24 / 1000,
    };
  }
  function satDome() {
    const S = G.R600A.sat, liq = [], vap = [];
    S.T.forEach((t, i) => { if (t <= 70) { liq.push([S.hf[i], S.P[i]]); vap.push([S.hg[i], S.P[i]]); } });
    return liq.concat(vap.reverse());
  }

  // ---------- Engine: single-zone spark-ignition cycle, Wiebe burn, Livengood-Wu knock ----------
  const ENGINE_DEFAULTS = {
    CR: 10, spark: 25, pInt: 100, rpm: 2000, octane: 91, nCyl: 4,
    B: 0.081, S: 0.0864, L: 0.144,   // m; bore/stroke/rod of a common 1.8 L four-cylinder, est.
    gamma: 1.3, Tivc: 340, pExh: 105, AFR: 14.7, LHV: 44e6, etaComb: 0.95,
    wall: 0.18,                      // fraction of heat release lost to walls, est. (lumped)
    wa: 5, wm: 2, burn: 50,          // Wiebe a, m and 0-100 % burn duration (deg), typical textbook values
  };
  function engineGeom(p) {
    const Vd = Math.PI / 4 * p.B * p.B * p.S, Vc = Vd / (p.CR - 1), R = 2 * p.L / p.S;
    const V = th => { const t = th * Math.PI / 180, s = Math.sin(t);
      return Vc + Vd / 2 * (R + 1 - Math.cos(t) - Math.sqrt(R * R - s * s)); };
    return { Vd, Vc, V };
  }
  // pistonY: crank-slider position (m from crank centre) for the 3D view
  function pistonY(p, th) {
    const t = th * Math.PI / 180, a = p.S / 2;
    return a * Math.cos(t) + Math.sqrt(p.L * p.L - a * a * Math.sin(t) ** 2);
  }
  function engineCycle(o) {
    const p = Object.assign({}, ENGINE_DEFAULTS, o), g = p.gamma, { Vd, Vc, V } = engineGeom(p);
    const dth = 0.5, Rair = 287;
    const mAir = p.pInt * 1e3 * V(-180) / (Rair * p.Tivc), mf = mAir / p.AFR;
    const Qin = mf * p.LHV * p.etaComb;
    const th0 = -p.spark;
    const xb = th => th <= th0 ? 0 : 1 - Math.exp(-p.wa * Math.pow(Math.min((th - th0) / p.burn, 1.5), p.wm + 1));
    const pts = [];  // [theta, V (m3), p (kPa), xb]
    for (let th = -360; th < -180; th += dth) pts.push([th, V(th), p.pInt, 0]);
    let P = p.pInt * 1e3, knockI = 0, knockAt = null, Pmax = 0, thPmax = 0;
    const pivc = P, dt = dth / (6 * p.rpm);  // s per step
    for (let th = -180; th < 180; th += dth) {
      const V0 = V(th), V1 = V(th + dth), dQ = Qin * (1 - p.wall) * (xb(th + dth) - xb(th));
      P += -g * P / V0 * (V1 - V0) + (g - 1) / V0 * dQ;
      const x = xb(th + dth);
      if (x < 0.9) {  // end gas still unburned
        const Tu = p.Tivc * Math.pow(P / pivc, (g - 1) / g), Patm = P / 101325;
        const tau = 3.2 * 17.68e-3 * Math.pow(p.octane / 100, 3.402) * Math.pow(Patm, -1.7) * Math.exp(3800 / Tu); // Douaud-Eyzat, s; x3.2 calibration (est.): single zone overpredicts end-gas T
        knockI += dt / tau;
        if (knockI >= 1 && knockAt === null) knockAt = th;
      }
      if (P > Pmax) { Pmax = P; thPmax = th + dth; }
      pts.push([th + dth, V1, P / 1e3, x]);
    }
    for (let th = 180; th < 360; th += dth) pts.push([th, V(th), p.pExh, 1]);
    let W = 0, Wpump = 0;
    for (let i = 1; i < pts.length; i++) {
      const dW = (pts[i][2] + pts[i - 1][2]) / 2 * 1e3 * (pts[i][1] - pts[i - 1][1]);
      W += dW; if (pts[i][0] <= -180 || pts[i][0] > 180) Wpump += dW;
    }
    const imep = W / Vd / 1e5, pmep = -Wpump / Vd / 1e5, N = p.rpm / 1000;
    const fmep = 0.97 + 0.15 * N + 0.05 * N * N;  // bar, simple SI friction fit, est.
    const bmep = imep - fmep, nCyl = p.nCyl;
    const torque = bmep * 1e5 * Vd * nCyl / (4 * Math.PI);
    return {
      p, pts, Vd, Vc, mAir, mf, Qin, W, imep, pmep, fmep, bmep, etaI: W / (mf * p.LHV),
      etaB: Math.max(bmep, 0) * 1e5 * Vd / (mf * p.LHV), etaOtto: 1 - Math.pow(p.CR, 1 - g),
      torque, power: torque * p.rpm * 2 * Math.PI / 60 / 1e3, Pmax: Pmax / 1e5, thPmax,
      knock: knockAt !== null, knockAt, knockI,
    };
  }
  // inline engines: firing offset of cylinders 1..n (deg of the 720 deg cycle) and the firing order
  const FIRING = { 1: [[0], '1'], 2: [[0, 360], '1-2'], 3: [[0, 480, 240], '1-3-2'], 4: [[0, 540, 180, 360], '1-3-4-2'],
    5: [[0, 144, 576, 288, 432], '1-2-4-5-3'], 6: [[0, 480, 240, 600, 120, 360], '1-5-3-6-2-4'] };
  // gas-pressure torque at the crank (N m) over one cycle, all cylinders summed; piston inertia ignored
  function crankTorque(r, n) {
    const pts = r.pts, N = pts.length, dth = 0.5 * Math.PI / 180, one = [];
    for (let i = 0; i < N; i++) one.push((pts[i][2] - 100) * 1e3 * (pts[(i + 1) % N][1] - pts[(i - 1 + N) % N][1]) / (2 * dth));
    const out = [];
    for (let i = 0; i < N; i += 4) { let T = 0; for (const o of FIRING[n][0]) T += one[((i - 2 * o) % N + N) % N]; out.push([pts[i][0], T]); }
    const v = out.map(q => q[1]), mean = v.reduce((a, b) => a + b) / v.length, max = Math.max(...v), min = Math.min(...v);
    return { pts: out, mean, max, min, ripple: (max - min) / Math.abs(mean) };
  }
  function sparkSweep(o) {
    const out = [];
    for (let s = 0; s <= 50; s += 2) { const r = engineCycle(Object.assign({}, o, { spark: s })); out.push([s, r.torque, r.knock]); }
    return out;
  }

  // ---------- Washer: unbalanced drum on springs and dampers ----------
  const WASHER_DEFAULTS = {
    M: 40,       // kg suspended tub + drum + counterweights (40 kg in Springer doi 10.1186/2196-1166-1-3)
    fn: 2.5,     // Hz suspension natural frequency, est. (1-2.5 Hz typical)
    zeta: 0.15,  // damping ratio, est.
    mu: 0.3,     // kg imbalance (wet clothes clump)
    e: 0.24,     // m drum radius
    gap: 0.02,   // m tub-to-cabinet clearance, est.
    spin: 1200, ramp: 120,  // rpm, rpm/s
    Mcab: 30, friction: 0.4,
  };
  function washerSteady(o, rpm) {
    const p = Object.assign({}, WASHER_DEFAULTS, o), w = rpm * Math.PI / 30, wn = 2 * Math.PI * p.fn;
    const r = w / wn, den = Math.sqrt((1 - r * r) ** 2 + (2 * p.zeta * r) ** 2);
    const X = p.mu * p.e / p.M * r * r / den;
    const k = p.M * wn * wn, c = 2 * p.zeta * p.M * wn;
    return { r, X, F: X * Math.sqrt(k * k + (c * w) ** 2), Fwalk: p.friction * (p.M + p.Mcab) * 9.81 };
  }
  // one integration step of the planar tub motion; s = {t, phi, w, x, y, vx, vy}
  function washerStep(o, s, dt, wTarget) {
    const p = Object.assign({}, WASHER_DEFAULTS, o), wn = 2 * Math.PI * p.fn;
    const k = p.M * wn * wn, c = 2 * p.zeta * p.M * wn, aMax = p.ramp * Math.PI / 30;
    const alpha = clamp((wTarget - s.w) / dt, -aMax, aMax);
    s.w += alpha * dt; s.phi += s.w * dt; s.t += dt;
    const me = p.mu * p.e, cs = Math.cos(s.phi), sn = Math.sin(s.phi);
    const Fx = me * (s.w * s.w * cs + alpha * sn), Fy = me * (s.w * s.w * sn - alpha * cs);
    s.vx += (Fx - c * s.vx - k * s.x) / p.M * dt; s.x += s.vx * dt;  // semi-implicit Euler, stable for dt << 1/fn
    s.vy += (Fy - c * s.vy - k * s.y) / p.M * dt; s.y += s.vy * dt;
    s.amp = Math.hypot(s.x, s.y);
    s.F = Math.hypot(k * s.x + c * s.vx, k * s.y + c * s.vy);
    s.hit = s.amp > p.gap;
    return s;
  }

  G.Phys = { satAt, shAt, fridgeCycle, satDome, FRIDGE_DEFAULTS, engineCycle, engineGeom, pistonY, sparkSweep,
    ENGINE_DEFAULTS, FIRING, crankTorque, washerSteady, washerStep, WASHER_DEFAULTS };
})(globalThis);
