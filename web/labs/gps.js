// GPS lab: position from signal travel times. Pseudoranges, a 4-unknown least-squares fix, geometry (DOP) and the error budget.
// Pure physics in GpsPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const D2 = Math.PI / 180;
  const GP = {
    C: 299792458, MU: 3.986004418e14, RE: 6371e3, A: 26560e3, INC: 55 * D2, PLANES: 6, PER: 4,
    REL_US_DAY: 38.6,  // net relativistic clock rate of a GPS satellite: +45.7 (gravity) - 7.1 (speed) us/day (Ashby 2003)
    RX_BIAS: 1e-4,     // receiver clock error, s (cheap quartz clock), solved as the 4th unknown
    period() { return 2 * Math.PI * Math.sqrt(GP.A ** 3 / GP.MU); },
    sats(t) {  // ECI positions, z = north; 6 planes x 4 satellites, staggered
      const out = [], n = 2 * Math.PI / GP.period();
      for (let p = 0; p < GP.PLANES; p++) for (let j = 0; j < GP.PER; j++) {
        const O = p * 60 * D2, u = (j * 90 + p * 15) * D2 + n * t, ci = Math.cos(GP.INC), si = Math.sin(GP.INC);
        out.push({ id: p * GP.PER + j, plane: p, p: [GP.A * (Math.cos(u) * Math.cos(O) - Math.sin(u) * ci * Math.sin(O)), GP.A * (Math.cos(u) * Math.sin(O) + Math.sin(u) * ci * Math.cos(O)), GP.A * Math.sin(u) * si] });
      }
      return out;
    },
    rx: lat => [GP.RE * Math.cos(lat * D2), 0, GP.RE * Math.sin(lat * D2)],
    enu: lat => ({ E: [0, 1, 0], N: [-Math.sin(lat * D2), 0, Math.cos(lat * D2)], U: [Math.cos(lat * D2), 0, Math.sin(lat * D2)] }),
    relU: id => ((id * 0.6180339887) % 1),  // fixed spread of clock-setting times per satellite
    sigma(s, el) {  // 1-sigma range error parts, m (est. typical values)
      const rtk = s.corr === 2, co = [.8, .5, .02][s.corr], ionoZ = rtk ? .01 : s.iono ? .3 : s.corr === 1 ? .5 : 1.2;  // single frequency: residual after the broadcast (Klobuchar) model
      const F = 1 / Math.sqrt(1 - (Math.cos(el) * GP.RE / (GP.RE + 350e3)) ** 2), sin = Math.sin(el);
      const parts = { clock: co, iono: ionoZ * F, trop: (rtk ? .01 : .3) / (sin + .05), multi: s.mp * (rtk ? .05 : 1) * (.3 + .7 * (1 - sin)), noise: rtk ? .005 : .3 };
      return { parts, total: Math.sqrt(Object.values(parts).reduce((a, b) => a + b * b, 0)) };
    },
    geometry(s, t) {
      const r = GP.rx(s.lat), { U } = GP.enu(s.lat), all = GP.sats(t);
      all.forEach(q => { const d = q.p.map((v, i) => v - r[i]), L = Math.hypot(...d); q.el = Math.asin(d.reduce((a, v, i) => a + v * U[i], 0) / L); });
      const vis = all.filter(q => q.el >= s.mask * D2).sort((a, b) => b.el - a.el);
      return { all, vis, used: vis.slice(0, s.maxSats), r };
    },
    solve4(A, b) {  // Gaussian elimination with partial pivoting, n x n
      const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
      for (let c = 0; c < n; c++) { let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
        [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-30) return null;
        for (let i = 0; i < n; i++) if (i !== c) { const f = M[i][c] / M[c][c]; for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k]; } }
      return M.map((row, i) => row[n] / row[i]);
    },
    dop(used, r, lat) {
      if (used.length < 4) return null;
      const Gm = used.map(q => { const d = q.p.map((v, i) => v - r[i]), L = Math.hypot(...d); return [-d[0] / L, -d[1] / L, -d[2] / L, 1]; });
      const N = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => Gm.reduce((a, g) => a + g[i] * g[j], 0)));
      const Q = [0, 1, 2, 3].map(j => GP.solve4(N, [0, 1, 2, 3].map(i => +(i === j))));
      if (Q.some(c => !c)) return null;
      const { E, N: Nn } = GP.enu(lat), qf = v => v.reduce((a, vi, i) => a + vi * v.reduce((b, vj, j) => b + Q[j][i] * vj, 0), 0);
      const pd = Q[0][0] + Q[1][1] + Q[2][2];
      return { G: Math.sqrt(pd + Q[3][3]), P: Math.sqrt(pd), H: Math.sqrt(qf(E) + qf(Nn)), V: Math.sqrt(Math.max(0, pd - qf(E) - qf(Nn))) };
    },
    fix(s, geo, rand, noisy = true) {  // simulate pseudoranges and solve x, y, z, c*b by Gauss-Newton
      const used = geo.used; if (used.length < 4) return null;
      const r = geo.r, rel = GP.C * GP.REL_US_DAY * 1e-6 / 86400 * s.rel * 3600;
      const rho = used.map(q => Math.hypot(...q.p.map((v, i) => v - r[i])) + GP.C * GP.RX_BIAS + (noisy ? GP.sigma(s, q.el).total * rand() : 0) + rel * GP.relU(q.id));
      const x = [0, 0, 0, 0];
      for (let it = 0; it < 15; it++) {
        const Gm = [], res = [];
        used.forEach((q, i) => { const d = q.p.map((v, k) => v - x[k]), L = Math.hypot(...d); Gm.push([-d[0] / L, -d[1] / L, -d[2] / L, 1]); res.push(rho[i] - (L + x[3])); });
        const N = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => Gm.reduce((a, g) => a + g[i] * g[j], 0))), b = [0, 1, 2, 3].map(i => Gm.reduce((a, g, k) => a + g[i] * res[k], 0));
        const dx = GP.solve4(N, b); if (!dx) return null;
        dx.forEach((v, i) => x[i] += v); if (Math.hypot(...dx) < 1e-6) break;
      }
      const e = x.slice(0, 3).map((v, i) => v - r[i]), { E, N, U } = GP.enu(s.lat), dot = (a, c) => a.reduce((z, v, i) => z + v * c[i], 0);
      return { x, e: dot(e, E), n: dot(e, N), u: dot(e, U), bias: x[3] / GP.C };
    },
    rng(seed) { let a = seed >>> 0; const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()); },
    state(s, t, nFix = 80, seed = 1) {
      const geo = GP.geometry(s, t), dop = GP.dop(geo.used, geo.r, s.lat), rand = GP.rng(seed), fixes = [];
      for (let i = 0; nFix && i < nFix; i++) { const f = GP.fix(s, geo, rand); if (f) fixes.push(f); }
      const sig = geo.used.length ? Math.sqrt(geo.used.reduce((a, q) => a + GP.sigma(s, q.el).total ** 2, 0) / geo.used.length) : NaN;
      const rms = fixes.length ? Math.sqrt(fixes.reduce((a, f) => a + f.e * f.e + f.n * f.n, 0) / fixes.length) : Infinity;
      const h = fixes.map(f => Math.hypot(f.e, f.n)).sort((a, b) => a - b), r95 = h.length ? h[Math.floor(.95 * (h.length - 1))] : Infinity;
      return { s, t, geo, dop, sig, exp: dop ? dop.H * sig : Infinity, fixes, rms, r95, nVis: geo.vis.length, nUsed: geo.used.length };
    },
  };
  GP.M = {  // missions (the two-step Einstein mission keeps a flag in the lab)
    einstein: (st, flag) => flag && st.s.rel === 0 && st.rms <= 20,
    einsteinArm: st => st.s.rel >= 1 && st.rms >= 100,
    valley: st => st.s.mask >= 25 && st.dop && st.dop.H <= 2 && st.nUsed >= 4,
    cm: st => st.rms <= .5,
  };
  G.GpsPhys = GP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const K = 1 / GP.RE, toV = p => V3(p[0] * K, p[2] * K, -p[1] * K);  // ECI (z north) -> scene (y up), Earth radius = 1
  const gps = {
    id: 'gps', tab: 'GPS',
    charts: ['Position error against satellites used', 'Expected horizontal error = HDOP × range error. More satellites, spread across the sky, give a smaller error. Green dashed: optimal preset.',
      'Where the fixes land', 'Each dot is one position fix, east and north of the true spot (centre). The ring holds 95 % of the fixes.'],
    eyebrow: 'Lab 12 · Satellite navigation', concept: 'Your phone finds itself by timing radio signals from space',
    text: 'Each GPS satellite sends the time from its atomic clock. Your phone measures how late the signal arrives: 1 ns of delay means 30 cm of distance. Your phone clock is not perfect, so it solves four unknowns (east, north, up and its own clock error) from four or more satellites.',
    home: 'Open sky gives about 5 m. Tall buildings block satellites and bounce signals, so the dot jumps. Without the relativity correction in each satellite clock, the error would grow by about 11 km per day.',
    s: { time: 0, lat: 40, mask: 10, maxSats: 8, iono: 0, corr: 0, mp: 2, rel: 0 },
    sliders: [
      { k: 'time', label: 'Time of day (moves the satellites)', min: 0, max: 12, step: .25, unit: 'h' },
      { k: 'lat', label: 'Your latitude', min: 0, max: 70, step: 1, unit: '°' },
      { k: 'mask', label: 'Sky blocked below (elevation mask)', min: 0, max: 45, step: 1, unit: '°', hint: 'Buildings, trees and hills hide satellites low in the sky.' },
      { k: 'maxSats', label: 'Satellites the receiver uses (highest first)', min: 4, max: 12, step: 1 },
      { k: 'iono', label: 'Frequencies', min: 0, max: 1, step: 1, fmt: v => v ? 'Dual (L1 + L5)' : 'Single (L1)' },
      { k: 'corr', label: 'Correction service', min: 0, max: 2, step: 1, fmt: v => ['None', 'SBAS (WAAS/EGNOS)', 'RTK base station'][v] },
      { k: 'mp', label: 'Signal reflections (multipath)', min: 0, max: 10, step: .5, unit: 'm' },
      { k: 'rel', label: 'Hours without relativity correction', min: 0, max: 24, step: .5, unit: 'h' },
    ],
    presets: [
      { n: 'Open sky, dual frequency + SBAS', kind: 'opt', s: { time: 0, lat: 40, mask: 5, maxSats: 12, iono: 1, corr: 1, mp: .5, rel: 0 }, note: 'Every visible satellite, spread over the whole sky, and two frequencies cancel most of the ionosphere delay. The fixes stay within about 1–2 m.' },
      { n: 'Phone in a park', kind: 'typ', s: { time: 0, lat: 40, mask: 10, maxSats: 8, iono: 0, corr: 0, mp: 2, rel: 0 }, note: 'A normal phone: one frequency, no corrections. 95 % of the fixes fall within about 5 m, close to the 4.9 m that gps.gov quotes for phones under open sky.' },
      { n: 'Urban canyon', kind: 'edge', s: { time: 0, lat: 40, mask: 35, maxSats: 12, iono: 0, corr: 0, mp: 8, rel: 0 }, note: 'Tall buildings hide everything below 35° and bounce the signals. Few satellites remain, all near the top of the sky, so the geometry is poor and the dot jumps tens of metres.' },
      { n: 'Four clustered satellites', kind: 'edge', s: { time: 0, lat: 40, mask: 5, maxSats: 4, iono: 0, corr: 0, mp: 2, rel: 0 }, note: 'The four highest satellites sit close together. Their lines of sight are almost parallel, so small range errors make a large position error (high DOP).' },
      { n: 'No relativity correction (2 h)', kind: 'edge', s: { time: 0, lat: 40, mask: 10, maxSats: 8, iono: 0, corr: 0, mp: 2, rel: 2 }, note: 'Satellite clocks run 38.6 µs per day fast. After only 2 hours, each clock is off by up to about 1 km of range, and the fix is useless.' },
    ],
    missions: [
      { t: 'Prove Einstein', d: 'Turn off the relativity correction for 1 hour or more and see the error pass 100 m. Then set it back to 0 h and get the error under 20 m.', win: 'Done. Gravity makes the satellite clocks run fast and speed makes them run slow. GPS corrects the net 38.6 µs per day.',
        check: st => { if (GP.M.einsteinArm(st)) gps.sawRel = true; return GP.M.einstein(st, gps.sawRel); } },
      { t: 'Valley geometry', d: 'Block the sky below 25° or more. Find a time of day when the satellites still give an HDOP of 2 or less.', win: 'Done. Geometry changes as the satellites move. Survey crews plan their work around good-DOP hours.',
        check: st => GP.M.valley(st) },
      { t: 'Centimetre fix', d: 'Get the RMS horizontal error down to 0.5 m or less.', win: 'Done. RTK compares your signals with a base station a few km away, so almost all errors cancel. Tractors and drones steer with it.',
        check: st => GP.M.cm(st) },
    ],
    chipsList: [{ k: 'sats', l: 'Satellites', c: '#e0b55a' }, { k: 'signals', l: 'Signals', c: '#4f8a4a' }, { k: 'mask', l: 'Sky mask', c: '#c8734f' }],
    partInfo: {
      sats: 'Satellites: 24 or more, 20,200 km up on 6 orbit planes tilted 55°. Each orbit takes 11 h 58 min, half a sidereal day, so the pattern repeats each day.',
      signals: 'Signals: a radio signal takes about 67–86 ms to reach you. The receiver measures the delay to about 1 ns. Green lines: used satellites. Grey: visible but not used.',
      mask: 'Sky mask: the cone shows the sky the receiver can see. Satellites below its edge are hidden by buildings or terrain, and low signals pass more air and reflect more.',
    },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M(0x7d9bb5, { roughness: .8, metalness: 0 })); sc.add(earth);
      const gr = []; for (let la = -60; la <= 60; la += 30) for (let lo = 0; lo < 360; lo += 6) { const a = lo * D2, b = (lo + 6) * D2, c = Math.cos(la * D2), y = Math.sin(la * D2); gr.push(c * Math.cos(a) * 1.002, y * 1.002, c * Math.sin(a) * 1.002, c * Math.cos(b) * 1.002, y * 1.002, c * Math.sin(b) * 1.002); }
      for (let lo = 0; lo < 360; lo += 30) for (let la = -84; la < 84; la += 6) { const a = lo * D2, p = la * D2, q = (la + 6) * D2; gr.push(Math.cos(p) * Math.cos(a) * 1.002, Math.sin(p) * 1.002, Math.cos(p) * Math.sin(a) * 1.002, Math.cos(q) * Math.cos(a) * 1.002, Math.sin(q) * 1.002, Math.cos(q) * Math.sin(a) * 1.002); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gr, 3)); sc.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xdfe8ee })));
      [[.8, .55, .3, 0x8fae8b], [-.3, .3, .9, 0x8fae8b], [.2, -.4, -.88, 0xb8875b], [-.7, .62, -.3, 0x8fae8b]].forEach(([x, y, z, c]) => {
        const land = new THREE.Mesh(new THREE.SphereGeometry(.35, 20, 12), M(c, { roughness: .9, metalness: 0 })); land.position.set(x, y, z).normalize().multiplyScalar(.7); land.scale.set(1, .9, 1); sc.add(land); });
      const ice = new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 10), M(0xfbf7ef, { roughness: .9 })); ice.position.y = .86; ice.scale.y = .4; sc.add(ice);
      // receiver (phone) and its sky-mask cone
      this.rxG = new THREE.Group(); sc.add(this.rxG);
      const phone = new THREE.Mesh(new THREE.BoxGeometry(.06, .11, .015), M(0x2a2521, { roughness: .5 })); phone.position.y = .06; this.rxG.add(phone);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.05, .09), new THREE.MeshBasicMaterial({ color: 0x6fc0b2 })); scr.position.set(0, .06, .008); this.rxG.add(scr);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(.025, 12, 8), M(0xc2453a)); pin.position.y = .14; this.rxG.add(pin);
      this.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true), M(0xe0b55a, { transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide })); this.rxG.add(this.cone);
      // orbits and satellites
      for (let p = 0; p < GP.PLANES; p++) { const pts = []; for (let i = 0; i <= 96; i++) { const O = p * 60 * D2, u = i / 96 * Math.PI * 2, ci = Math.cos(GP.INC), si = Math.sin(GP.INC);
        pts.push(toV([GP.A * (Math.cos(u) * Math.cos(O) - Math.sin(u) * ci * Math.sin(O)), GP.A * (Math.cos(u) * Math.sin(O) + Math.sin(u) * ci * Math.cos(O)), GP.A * Math.sin(u) * si])); }
        sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc9bfae, transparent: true, opacity: .55 }))); }
      const gold = M(0xe0b55a, { metalness: .5, roughness: .4 }), panel = M(0x3f5f86, { metalness: .3, roughness: .5 });
      this.satM = [...Array(GP.PLANES * GP.PER)].map(() => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), gold));
        [-1, 1].forEach(sx => { const w = new THREE.Mesh(new THREE.BoxGeometry(.26, .01, .1), panel); w.position.x = sx * .2; g.add(w); }); sc.add(g); return g; });
      this.sigUsed = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4f8a4a })); sc.add(this.sigUsed);
      this.sigVis = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9a9289, transparent: true, opacity: .6 })); sc.add(this.sigVis);
      const stars = new THREE.InstancedMesh(new THREE.SphereGeometry(.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xf3e6cf }), 160), m = new THREE.Matrix4(), rnd = GP.rng(7);
      for (let i = 0; i < 160; i++) { const v = V3(rnd(), rnd(), rnd()).normalize().multiplyScalar(14 + Math.abs(rnd()) * 3); m.makeTranslation(v.x, v.y, v.z); stars.setMatrixAt(i, m); } sc.add(stars);
      this.play = 0; this.acc = 0; this.playing = !reduced; this.seed = 1;
      this.scene = sc; this.cam = { p: [6.2, 4.2, 7.6], t: [0, .4, 0] };
    },
    tNow() { return this.s.time * 3600 + (this.play || 0); },
    placeRx() {
      const lat = this.s.lat * D2, up = V3(Math.cos(lat), Math.sin(lat), 0);
      this.rxG.position.copy(up); this.rxG.quaternion.setFromUnitVectors(V3(0, 1, 0), up);
      const h = .7, half = (90 - this.s.mask) * D2, rad = Math.min(2.2, h * Math.tan(half));
      this.cone.scale.set(rad, h, rad); this.cone.position.y = h / 2; this.cone.rotation.x = Math.PI;  // apex at the receiver, opening upward
    },
    update() {
      const st = this.st = GP.state(this.s, this.tNow(), 80, this.seed++), d = st.dop, rel = GP.C * GP.REL_US_DAY * 1e-6;
      tiles([
        { l: 'Satellites used', v: `${st.nUsed} / ${st.nVis}`, cls: st.nUsed < 4 ? 'bad' : st.nUsed < 6 ? 'warn' : 'good', e: 'used / visible' },
        { l: 'HDOP (geometry)', v: d ? fmt(d.H, 2) : '–', cls: !d ? 'bad' : d.H <= 1.5 ? 'good' : d.H <= 3 ? 'warn' : 'bad', e: d ? `PDOP ${fmt(d.P, 2)} · VDOP ${fmt(d.V, 2)}` : 'need 4 satellites' },
        { l: 'Range error σ', v: fmt(st.sig, st.sig < 1 ? 2 : 1), u: 'm', e: 'per satellite (UERE)' },
        { l: 'Expected error', v: isFinite(st.exp) ? fmt(st.exp, st.exp < 1 ? 2 : 1) : '–', u: 'm', e: 'HDOP × σ' },
        { l: 'Measured error', v: isFinite(st.rms) ? fmt(st.rms, st.rms < 1 ? 2 : 1) : 'no fix', u: isFinite(st.rms) ? 'm' : '', cls: st.rms <= 5 ? 'good' : st.rms <= 20 ? 'warn' : 'bad', e: 'RMS of 80 fixes' },
        { l: '95 % radius', v: isFinite(st.r95) ? fmt(st.r95, st.r95 < 1 ? 2 : 1) : '–', u: 'm', e: 'gps.gov phones: 4.9 m' },
        { l: 'Relativity', v: this.s.rel ? fmt(rel / 86400 * this.s.rel * 3600 / 1000, 2) : '0', u: 'km', e: this.s.rel ? 'clock drift, worst satellite' : `corrected: ${fmt(rel / 1000, 1)} km/day avoided` },
        { l: 'Phone clock error', v: st.fixes.length ? fmt(st.fixes[0].bias * 1e6, 1) : '–', u: 'µs', e: 'solved as unknown 4' },
      ]);
      $('#alarm').hidden = st.nUsed >= 4 && st.rms <= 50; $('#alarm').textContent = st.nUsed < 4 ? 'No fix: fewer than 4 satellites' : 'Position jumps';
      if (this.rxG) this.placeRx();
      this.drawCharts(); checkMissions(this, st);
    },
    drawCharts() {
      const st = this.st, s = this.s, o = optOf(this), t = this.tNow(), cur = [], gh = [];
      const gC = GP.geometry(s, t), gO = GP.geometry(o, t);
      for (let n = 4; n <= 12; n++) {
        const u1 = gC.vis.slice(0, n), u2 = gO.vis.slice(0, n), d1 = u1.length === n && GP.dop(u1, gC.r, s.lat), d2 = u2.length === n && GP.dop(u2, gO.r, o.lat);
        const sg = (u, ss) => Math.sqrt(u.reduce((a, q) => a + GP.sigma(ss, q.el).total ** 2, 0) / u.length);
        if (d1) cur.push([n, Math.max(.01, Math.min(1000, d1.H * sg(u1, s)))]); if (d2) gh.push([n, Math.max(.01, Math.min(1000, d2.H * sg(u2, o)))]);
      }
      this.c1 = chart($('#c1'), { x: [4, 12], y: [.01, 1000], ylog: true, yt: [.01, .1, 1, 10, 100, 1000], xt: [4, 6, 8, 10, 12], xlab: 'Satellites used', ylab: 'Expected horizontal error (m)',
        body: (X, Y) => `<rect x="${X(4)}" y="${Y(5)}" width="${X(12) - X(4)}" height="${Y(.01) - Y(5)}" style="fill:color-mix(in srgb,var(--ok) 10%,transparent)"/>` +
          `<text class="lbl-acc" x="${X(11.9)}" y="${Y(5) - 4}" text-anchor="end">phone-grade 5 m</text>` +
          (gh.length ? `<path class="ghost" d="${path(gh, X, Y)}"/>` : '') + (cur.length ? `<path class="s-acc" d="${path(cur, X, Y)}"/>` + cur.map(p => `<circle class="pt" r="2.4" cx="${X(p[0])}" cy="${Y(p[1])}"/>`).join('') : `<text class="lbl-bad" x="${X(5)}" y="${Y(100)}">fewer than 4 satellites visible</text>`) });
      if (isFinite(st.exp)) moveDot(this.c1, Math.min(12, Math.max(4, st.nUsed)), Math.max(.01, Math.min(1000, st.exp)));
      const f = st.fixes, R0 = f.length ? Math.max(...f.map(q => Math.max(Math.abs(q.e), Math.abs(q.n)))) : 1;
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(R0, .01)))), R = Math.ceil(R0 * 1.15 / mag) * mag;
      this.c2 = chart($('#c2'), { x: [-R, R], y: [-R, R], xlab: 'East error (m)', ylab: 'North error (m)',
        body: (X, Y) => `<line class="s-mut" x1="${X(-R)}" x2="${X(R)}" y1="${Y(0)}" y2="${Y(0)}" style="opacity:.5"/><line class="s-mut" x1="${X(0)}" x2="${X(0)}" y1="${Y(-R)}" y2="${Y(R)}" style="opacity:.5"/>` +
          (isFinite(st.r95) ? `<ellipse cx="${X(0)}" cy="${Y(0)}" rx="${X(st.r95) - X(0)}" ry="${Y(0) - Y(st.r95)}" class="s-hot dash"/>` : '') +
          f.map(q => `<circle class="trail" r="2" cx="${X(q.e).toFixed(1)}" cy="${Y(q.n).toFixed(1)}"/>`).join('') });
      if (f.length) moveDot(this.c2, f[0].e, f[0].n);
    },
    frame(dt) {
      if (!this.st || !this.satM) return;
      if (this.playing) { this.play += dt * 120; this.acc += dt; if (this.acc > .5) { this.acc = 0; this.update(); } }  // 2 minutes of orbit per second
      const t = this.tNow(), all = GP.sats(t), rx = this.rxG.position, used = new Set(this.st.geo.used.map(q => q.id)), vis = new Set(this.st.geo.vis.map(q => q.id)), pu = [], pv = [];
      all.forEach(q => { const v = toV(q.p), m = this.satM[q.id]; m.position.copy(v); m.lookAt(0, 0, 0);
        if (used.has(q.id)) pu.push(rx.x, rx.y, rx.z, v.x, v.y, v.z); else if (vis.has(q.id)) pv.push(rx.x, rx.y, rx.z, v.x, v.y, v.z); });
      this.sigUsed.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pu, 3)); this.sigUsed.geometry.computeBoundingSphere();
      this.sigVis.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3)); this.sigVis.geometry.computeBoundingSphere();
      const hh = t / 3600 % 24;
      $('#caption').textContent = `t = ${Math.floor(hh)} h ${String(Math.floor(hh % 1 * 60)).padStart(2, '0')} min · ${this.st.nUsed} used, ${this.st.nVis} visible · shown 120× faster · Earth rotation not shown`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      this.satM.forEach(g => g.children[0].material.emissive.setHex(k === 'sats' ? 0x554400 : 0));
      this.sigUsed.material.color.setHex(k === 'signals' ? 0x2f7d73 : 0x4f8a4a);
      this.cone.material.opacity = k === 'mask' ? .4 : .18;
    },
    extra() {
      $('#extra').innerHTML = '';
      stageButtons([{ id: 'gpsPlay', l: this.playing ? 'Pause orbits' : 'Play orbits', f: e => { this.playing = !this.playing; e.textContent = this.playing ? 'Pause orbits' : 'Play orbits'; } }]);
    },
    notes: [
      'Orbits: radius 26,560 km, 6 planes at 55°, period 2π√(a³/μ) = 11 h 58 min (gps.gov/systems/gps/space). This model uses an ideal 24-satellite pattern; the real constellation has about 31 satellites.',
      'Fix: pseudoranges ρ = |s − r| + c·b + errors; Gauss-Newton least squares for x, y, z and the receiver clock bias b. DOP from (GᵀG)⁻¹, rotated to east-north-up for HDOP.',
      'Range errors (1σ, est.): satellite clock and orbit 0.8 m (0.5 m with SBAS); ionosphere at zenith 1.2 m on one frequency after the broadcast model (0.5 m with SBAS grid corrections), 0.3 m on two, scaled for slant; troposphere 0.3 m/sin(elevation); multipath set by the slider, worse at low elevation; receiver noise 0.3 m. RTK removes almost all except a little multipath. Errors are treated as independent each fix.',
      'Check: phone under open sky, 95 % of fixes within about 5 m; gps.gov quotes 4.9 m (16 ft) for GPS-enabled smartphones (gps.gov/systems/gps/performance/accuracy).',
      'Relativity: satellite clocks gain 45.7 µs/day from weaker gravity and lose 7.1 µs/day from speed, net 38.6 µs/day (Ashby, Living Reviews in Relativity 2003). Earth rotation and the Sagnac effect are not modelled.',
    ],
  };
  registerLab(gps);
})(globalThis);
