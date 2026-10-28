// Airplane wing lab: lift, stall and the drag polar of a light-aircraft wing (Cessna 172 class, NACA 2412 section).
// Pure physics in WingPhys (testable in Node); the lab registers only in the browser.
(function (G) {
  const AF = {
    S: 16.2, AR: 7.32, CHORD: 1.49, E: .70, CD0: .032, G: 9.81,  // m², -, m, Oswald factor (est.), parasite drag (est.)
    A2D: .105, ALPHA0: -2.1, CLMAX: 1.6,  // NACA 2412: lift slope per degree and zero-lift angle (published section data); 3D wing CLmax (est.)
    rho(h) { const T = 288.15 - .0065 * h; return 101325 * (T / 288.15) ** 5.2559 / (287.05 * T); },  // ISA troposphere
    cla() { const a = AF.A2D * 180 / Math.PI; return a / (1 + a / (Math.PI * .9 * AF.AR)) * Math.PI / 180; },  // finite-wing slope per degree
    flap: d => ({ dCL0: .9 * d / 30, dCLmax: .5 * d / 30, dCD0: .0007 * d }),  // est. plain/slotted flap effects
    stallAngle(d) { const f = AF.flap(d); return AF.ALPHA0 + (AF.CLMAX + f.dCLmax - f.dCL0) / AF.cla(); },
    CL(a, d) {
      const f = AF.flap(d), max = AF.CLMAX + f.dCLmax, as = AF.stallAngle(d);
      if (a <= as) return AF.cla() * (a - AF.ALPHA0) + f.dCL0;
      return max * (1 - .35 * (1 - Math.exp(-(a - as) / 3)));  // separated flow: lift falls away past stall (est. shape)
    },
    CD(a, d) {
      const f = AF.flap(d), cl = AF.CL(a, d), as = AF.stallAngle(d);
      return AF.CD0 + f.dCD0 + cl * cl / (Math.PI * AF.E * AF.AR) + (a > as ? .5 * (1 - Math.exp(-(a - as) / 4)) : 0);
    },
    best(d) { let b = [0, 0]; for (let a = -6; a <= 24; a += .05) { const ld = AF.CL(a, d) / AF.CD(a, d); if (ld > b[1]) b = [a, ld]; } return { a: b[0], ld: b[1] }; },
    solve(s) {
      const rho = AF.rho(s.alt), q = .5 * rho * s.V ** 2, cl = AF.CL(s.aoa, s.flap), cd = AF.CD(s.aoa, s.flap), W = s.mass * AF.G;
      const L = q * AF.S * cl, D = q * AF.S * cd, f = AF.flap(s.flap), clmax = AF.CLMAX + f.dCLmax, as = AF.stallAngle(s.flap), bst = AF.best(s.flap);
      const clNeed = W / (q * AF.S);
      return { s, rho, q, CL: cl, CD: cd, L, D, W, n: L / W, LD: cl / cd, LDmax: bst.ld, aBest: bst.a, CLmax: clmax, aStall: as, stalled: s.aoa > as,
        Vs: Math.sqrt(2 * W / (rho * AF.S * clmax)), clNeed, aNeed: clNeed <= clmax ? AF.ALPHA0 + (clNeed - f.dCL0) / AF.cla() : null, Preq: D * s.V };
    },
  };
  // optimal preset: best L/D angle, at the speed that makes lift equal weight at sea level (rounded to the slider steps)
  const b0 = AF.best(0), aB = Math.round(b0.a * 2) / 2, vB = Math.round(Math.sqrt(2 * 1111 * AF.G / (AF.rho(0) * AF.S * AF.CL(aB, 0))) * 2) / 2;
  AF.presets = [
    { n: 'Best glide (most lift per drag)', kind: 'opt', s: { V: vB, aoa: aB, flap: 0, alt: 0, mass: 1111 },
      note: `At about ${aB}° the wing gives the most lift for each newton of drag (L/D about ${b0.ld.toFixed(1)}). At ${vB} m/s this lift carries the full weight. With the engine off, this angle glides furthest.` },
    { n: 'Cruise at 1500 m', kind: 'typ', s: { V: 60, aoa: 2, flap: 0, alt: 1500, mass: 1111 },
      note: 'Fast flight needs only a small angle of attack: the dynamic pressure is high, so a small lift coefficient carries the weight.' },
    { n: 'Stall: nose too high', kind: 'edge', s: { V: 32, aoa: 20, flap: 0, alt: 0, mass: 1111 },
      note: 'Past about 17° the air cannot follow the curved upper surface. It separates, lift drops and drag jumps. The streaks above the wing turn into a turbulent wake.' },
    { n: 'Too slow without flaps', kind: 'edge', s: { V: 23, aoa: 14, flap: 0, alt: 0, mass: 1111 },
      note: 'At 23 m/s the clean wing cannot make enough lift even at its best angle. The aircraft sinks. Flaps raise the maximum lift coefficient.' },
    { n: 'Hot and high take-off', kind: 'edge', s: { V: 28, aoa: 10, flap: 10, alt: 3000, mass: 1111 },
      note: 'At 3000 m the air is about 26 % thinner. The same speed and angle give much less lift, so the take-off run gets long.' },
  ];
  AF.checks = [
    r => r.s.V >= 55 && r.s.V <= 62 && r.s.flap === 0 && Math.abs(r.n - 1) <= .02 && !r.stalled,
    r => r.s.alt >= 3000 && r.s.flap === 0 && r.LD >= .98 * r.LDmax && Math.abs(r.n - 1) <= .03 && !r.stalled,
    r => r.s.V <= 25 && r.n >= .97 && !r.stalled,
  ];
  G.WingPhys = AF;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  // ---- Joukowski airfoil and its potential flow, used only for the streak picture (lift numbers come from AF) ----
  const cx = { mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    sqrt: a => { const r = Math.hypot(a[0], a[1]); let re = Math.sqrt((r + a[0]) / 2), im = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [re, a[1] < 0 ? -im : im]; } };
  const JB = .25, JC = [-.022, .01], JA = Math.hypot(JB - JC[0], JC[1]), JBETA = Math.asin(JC[1] / JA);  // circle through ζ = b: sharp trailing edge, 2 % camber, ~12 % thick
  const toZ = z => { const i = cx.div([JB * JB, 0], z); return [z[0] + i[0], z[1] + i[1]]; };
  const toZeta = z => { const r = cx.sqrt([z[0] * z[0] - z[1] * z[1] - 4 * JB * JB, 2 * z[0] * z[1]]), p = [(z[0] + r[0]) / 2, (z[1] + r[1]) / 2], m = [(z[0] - r[0]) / 2, (z[1] - r[1]) / 2];
    return Math.hypot(p[0] - JC[0], p[1] - JC[1]) >= Math.hypot(m[0] - JC[0], m[1] - JC[1]) ? p : m; };
  function flowStep(zeta, al, dt) {  // advect in the circle plane: dζ/dt = conj(W'(ζ)) / |dz/dζ|²
    const d = [zeta[0] - JC[0], zeta[1] - JC[1]], e = [Math.cos(al), -Math.sin(al)], e2 = [Math.cos(al), Math.sin(al)];
    const G2 = 2 * JA * Math.sin(al + JBETA);  // Γ/(2π) with U = 1 (Kutta condition)
    const t1 = cx.div(cx.mul([JA * JA, 0], e2), cx.mul(d, d)), t2 = cx.div([0, G2], d);
    const w = [e[0] - t1[0] + t2[0], e[1] - t1[1] + t2[1]];  // W'(ζ) = u - iv
    const zp = [1 - cx.div([JB * JB, 0], cx.mul(zeta, zeta))[0], -cx.div([JB * JB, 0], cx.mul(zeta, zeta))[1]], m2 = Math.max(.04, zp[0] * zp[0] + zp[1] * zp[1]);
    const vel = [w[0] / m2, -w[1] / m2];
    // physical speed |W'(ζ)| / |z'(ζ)|, and the direction in the z plane: conj(W'/z')
    const q = cx.div(w, zp), sp = Math.min(3, Math.hypot(q[0], q[1]));
    return { z: [zeta[0] + vel[0] * dt, zeta[1] + vel[1] * dt], sp, dir: Math.atan2(-q[1], q[0]) };
  }
  const outline = flap => {  // airfoil outline in chord units (about -0.51..0.5), trailing part turned down by the flap
    const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2; pts.push(toZ([JC[0] + JA * Math.cos(t), JC[1] + JA * Math.sin(t)])); }
    const hx = .25, hy = .012, c = Math.cos(-flap * D2R), sn = Math.sin(-flap * D2R);
    return pts.map(([x, y]) => x > hx ? [hx + (x - hx) * c - (y - hy) * sn, hy + (x - hx) * sn + (y - hy) * c] : [x, y]);
  };
  const upperY = (() => { const o = outline(0), up = []; o.forEach(([x, y]) => { const k = Math.round((x + .6) * 50); if (k >= 0 && k < 60 && (up[k] === undefined || y > up[k])) up[k] = y; });
    return x => { const k = Math.max(0, Math.min(59, Math.round((x + .6) * 50))); for (let j = k; j >= 0; j--) if (up[j] !== undefined) return up[j]; return 0; }; })();

  const K = 1.5, SPAN = 1.6;  // metres per chord unit; shown span
  const kt = v => v * 1.944;
  const lab = {
    id: 'airfoil', tab: 'Airplane wing',
    charts: ['Lift coefficient against angle of attack', 'The wing lifts more as its angle grows, until the flow separates (stall). Green dashed: the optimal preset. Grey dashed: lift needed for level flight.',
      'Drag polar', 'Lift coefficient against drag coefficient. The line from the origin touches the curve at the best lift-to-drag ratio.'],
    eyebrow: 'Lab 10 · Lift, drag and stall', concept: 'A wing lifts by turning the air down',
    text: 'The wing meets the air at a small angle. Air over the curved top speeds up and its pressure drops; air below slows and its pressure rises. The wing pushes air down, and the air pushes the wing up. More angle gives more lift, until the air can no longer follow the top surface: the wing stalls.',
    home: 'Lift grows with the square of speed. Twice the speed gives four times the lift, so slow flight needs a big angle or flaps. This is why planes land with flaps down and nose up.',
    decor: { u: 1, y: -1.6, items: [['cloud', [], 7, -3.5, 3.2], ['cloud', [], 9, 2.5, 4.2], ['cloud', [], 11, -.5, 2.2], ['cloud', [], 8, 5, 2.8], ['cloud', [], 12, -6, 3.8]] },
    s: { V: 45, aoa: 6, flap: 0, alt: 0, mass: 1111 },
    sliders: [
      { k: 'V', label: 'Airspeed', min: 15, max: 80, step: .5, fmt: v => `${v} m/s · ${fmt(kt(v))} kt` },
      { k: 'aoa', label: 'Angle of attack', min: -6, max: 24, step: .5, unit: '°', hint: 'Angle between the wing chord and the oncoming air.' },
      { k: 'flap', label: 'Flaps', min: 0, max: 30, step: 10, unit: '°' },
      { k: 'alt', label: 'Altitude', min: 0, max: 4000, step: 100, unit: 'm' },
      { k: 'mass', label: 'Aircraft mass', min: 700, max: 1200, step: 10, unit: 'kg' },
    ],
    presets: AF.presets,
    missions: [
      { t: 'Level cruise', d: 'Fly between 55 and 62 m/s with flaps up. Make lift equal weight within 2 %.',
        win: 'Done. At cruise speed a small angle is enough. The pilot trims the nose to hold exactly this angle.', check: AF.checks[0] },
      { t: 'High-altitude glide', d: 'At 3000 m or higher with flaps up, fly at 98 % of the best lift-to-drag ratio with lift equal to weight (within 3 %).',
        win: 'Done. The best angle does not change with height, but thin air needs more speed to carry the same weight.', check: AF.checks[1] },
      { t: 'Slow flight', d: 'Fly at 25 m/s or slower with lift at least 97 % of weight, without stalling.',
        win: 'Done. Flaps add camber, so the wing makes more lift at the same angle and stalls at a higher lift coefficient.', check: AF.checks[2] },
    ],
    chipsList: [{ k: 'wing', l: 'Wing section', c: '#e9e3d7' }, { k: 'flap', l: 'Flap', c: '#d9733c' }, { k: 'air', l: 'Air streaks', c: '#3f86b0' }, { k: 'forces', l: 'Forces', c: '#4f8a4a' }],
    partInfo: {
      wing: 'Wing section: a NACA 2412-like shape, 1.5 m chord as on a Cessna 172. The picture uses an exact potential-flow solution for a Joukowski airfoil of similar shape.',
      flap: 'Flap: the rear 25 % of the wing turns down. It adds camber, so the wing makes more lift at the same angle, with more drag.',
      air: 'Air streaks: warm colours are fast air with low pressure, cool colours are slow air with high pressure. The fast air over the top is what gives most of the lift.',
      forces: 'Forces: green is lift, dark is weight, red is drag (drawn 5× longer). Level flight needs lift equal to weight.',
    },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      this.grp = new THREE.Group(); sc.add(this.grp);
      this.wingMat = M(0xe9e3d7, { roughness: .45, metalness: .15 });
      this.wing = new THREE.Mesh(new THREE.BufferGeometry(), this.wingMat); this.grp.add(this.wing);
      this.flapMat = M(0xd9733c, { roughness: .5 }); this.flapMark = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, SPAN * .98), this.flapMat); this.grp.add(this.flapMark);
      this.NP = 420; this.air = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, .02, .02), new THREE.MeshBasicMaterial({ transparent: true, opacity: .95 }), this.NP); this.grp.add(this.air);
      this.P = Array.from({ length: this.NP }, () => this.spawn({}, Math.random() * 3.6));
      const arrow = c => { const g = new THREE.Group(), m = M(c, { roughness: .6 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 10), m); b.position.y = .5; g.add(b);
        const h = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 14), m); h.position.y = 1.06; g.add(h); g.body = b; g.head = h; sc.add(g); return g; };
      this.fl = arrow(0x4f8a4a); this.fw = arrow(0x3d3833); this.fd = arrow(0xc2453a);
      this.fw.rotation.z = Math.PI; this.fd.rotation.z = -Math.PI / 2;
      this.aVis = this.s.aoa; this.flapBuilt = null;
      this.scene = sc; this.cam = { p: [.15, .1, 3.0], t: [0, 0, 0] };
    },
    spawn(p, ahead = 0) {  // a streak on a line across the oncoming air, upstream of the wing
      const al = (this.alFlow || 0) * D2R, t = (Math.random() * 2 - 1) * 1.15, z = [-1.7 * Math.cos(al) - t * Math.sin(al), -1.7 * Math.sin(al) + t * Math.cos(al)];
      p.zeta = toZeta(z); p.zz = SPAN * (.08 + .4 * Math.random());  // front half of the span, so the streaks read as a side view p.sep = 0;
      for (let i = 0; i < ahead * 20; i++) p.zeta = flowStep(p.zeta, al, .05).z;
      return p;
    },
    setWing() {
      if (this.flapBuilt === this.s.flap) return; this.flapBuilt = this.s.flap;
      const sh = new THREE.Shape(); outline(this.s.flap).forEach(([x, y], i) => i ? sh.lineTo(x * K, y * K) : sh.moveTo(x * K, y * K));
      const g = new THREE.ExtrudeGeometry(sh, { depth: SPAN, bevelEnabled: false }); g.translate(0, 0, -SPAN / 2);
      this.wing.geometry.dispose(); this.wing.geometry = g;
      const c = Math.cos(-this.s.flap * D2R), sn = Math.sin(-this.s.flap * D2R);
      this.flapMark.position.set((.25 + .2 * c) * K, (.012 + .2 * sn) * K, 0); this.flapMark.rotation.z = -this.s.flap * D2R;
    },
    update() {
      const r = this.r = AF.solve(this.s); if (this.wing) this.setWing();
      const lvl = Math.abs(r.n - 1) <= .02;
      tiles([
        { l: 'Lift ÷ weight', v: fmt(r.n, 2), cls: r.stalled ? 'bad' : lvl ? 'good' : r.n < .9 ? 'warn' : '', e: r.n > 1.02 ? 'climbing' : r.n < .98 ? 'sinking' : 'level flight' },
        { l: 'Lift', v: fmt(r.L / 1000, 1), u: 'kN', e: `weight ${fmt(r.W / 1000, 1)} kN` },
        { l: 'Lift coefficient CL', v: fmt(r.CL, 2), cls: r.stalled ? 'bad' : '', e: `max ${fmt(r.CLmax, 2)} at ${fmt(r.aStall, 1)}°` },
        { l: 'Lift ÷ drag', v: fmt(r.LD, 1), cls: r.LD >= .98 * r.LDmax ? 'good' : '', e: `best ${fmt(r.LDmax, 1)} at ${fmt(r.aBest, 1)}°` },
        { l: 'Drag', v: fmt(r.D), u: 'N', e: `${fmt(r.Preq / 1000)} kW to fly` },
        { l: 'Stall speed', v: fmt(kt(r.Vs)), u: 'kt', e: `${fmt(r.Vs, 1)} m/s with these flaps` },
        { l: 'Airspeed', v: fmt(kt(this.s.V)), u: 'kt', e: `${fmt(this.s.V * 3.6)} km/h` },
        { l: 'Air density', v: fmt(r.rho, 3), u: 'kg/m³', e: `${this.s.alt} m altitude` },
      ]);
      $('#alarm').hidden = !r.stalled; $('#alarm').textContent = 'Stall';
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, s = this.s, o = optOf(this), cur = [], gh = [], pol = [];
      for (let a = -6; a <= 24.001; a += .25) { cur.push([a, AF.CL(a, s.flap)]); gh.push([a, AF.CL(a, o.flap)]); pol.push([AF.CD(a, s.flap), AF.CL(a, s.flap)]); }
      const as = r.aStall, need = r.clNeed;
      this.c1 = chart($('#c1'), { x: [-6, 24], y: [-.5, 2.5], yt: [-.5, 0, .5, 1, 1.5, 2, 2.5], xlab: 'Angle of attack (°)', ylab: 'Lift coefficient CL',
        body: (X, Y) => `<rect class="f-bad" x="${X(as)}" y="${Y(2.5)}" width="${X(24) - X(as)}" height="${Y(-.5) - Y(2.5)}"/><text class="lbl-bad" x="${X(as) + 3}" y="${Y(2.5) + 12}">stall</text>` +
          (need < 2.5 ? `<line class="s-mut dash" x1="${X(-6)}" x2="${X(24)}" y1="${Y(need)}" y2="${Y(need)}"/><text x="${X(-5.5)}" y="${Y(need) - 4}">needed for level flight at ${s.V} m/s</text>` : '') +
          `<path class="ghost" d="${path(gh, X, Y)}"/><path class="s-acc" d="${path(cur, X, Y)}"/>` });
      moveDot(this.c1, s.aoa, r.CL);
      const cdm = .25, b = AF.best(s.flap), cb = AF.CL(b.a, s.flap), db = AF.CD(b.a, s.flap);
      this.c2 = chart($('#c2'), { x: [0, cdm], y: [-.5, 2.5], yt: [-.5, 0, .5, 1, 1.5, 2, 2.5], xt: [0, .05, .1, .15, .2, .25], xlab: 'Drag coefficient CD', ylab: 'Lift coefficient CL',
        body: (X, Y) => `<path class="s-mut dash" d="${path([[0, 0], [db * 2.2, cb * 2.2]], X, Y)}"/><text class="lbl-acc" x="${X(db) + 6}" y="${Y(cb) + 14}">best L/D ${fmt(b.ld, 1)}</text>` +
          `<path class="s-acc" d="${path(pol.filter(q => q[0] <= cdm * 1.2), X, Y)}"/>` });
      moveDot(this.c2, Math.min(r.CD, cdm), r.CL);
    },
    frame(dt) {
      if (!this.r || !this.air) return;
      const r = this.r, s = this.s, k = 1 - Math.exp(-dt / .4);
      this.aVis += (s.aoa - this.aVis) * k;
      this.grp.rotation.z = -this.aVis * D2R;
      // flow picture: attached potential flow up to the stall angle, plus a turbulent wake when stalled
      const fe = AF.flap(s.flap).dCL0 / AF.cla(), alF = Math.min(this.aVis, r.aStall) - AF.ALPHA0 + fe - JBETA / D2R;  // same lift sign and zero as the model
      this.alFlow = alF; const al = alF * D2R, sep = r.stalled ? Math.min(1, (s.aoa - r.aStall) / 5 + .3) : 0;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = V3(0, 0, 1), col = new THREE.Color(), sc3 = V3(1, 1, 1), h = dt * .55;
      this.P.forEach((p, i) => {
        const prev = p.zeta, st = flowStep(prev, al, h); p.zeta = st.z; let z = toZ(p.zeta), sp = st.sp, dir = st.dir;
        if (sep && z[0] > -.15 && z[0] < 1.6 && z[1] > upperY(Math.min(z[0], .5)) - .01 && z[1] < upperY(Math.min(z[0], .5)) + .45 * sep) {
          p.sep = Math.min(1, p.sep + dt * 3);  // separated air: slow, churning
          p.zeta = [prev[0] + (st.z[0] - prev[0]) * .3, prev[1] + (st.z[1] - prev[1]) * .3 + (Math.random() - .5) * .02 * sep]; z = toZ(p.zeta); sp = .3; dir += (Math.random() - .5) * 2.5;
        } else p.sep = Math.max(0, p.sep - dt);
        if (z[0] * Math.cos(al) + z[1] * Math.sin(al) > 1.9 || Math.hypot(z[0], z[1]) > 2.6) this.spawn(p);
        q.setFromAxisAngle(ax, dir); sc3.set(.5 + sp * .8, 1, 1); m.compose(V3(z[0] * K, z[1] * K, p.zz), q, sc3); this.air.setMatrixAt(i, m);
        tempColor(-30 + (sp - .55) * 105, col); if (p.sep > .3) col.lerp(new THREE.Color(0x8a7f74), p.sep); this.air.setColorAt(i, col);
      });
      this.air.instanceMatrix.needsUpdate = true; if (this.air.instanceColor) this.air.instanceColor.needsUpdate = true;
      // forces at the quarter chord, in world axes (lift up, weight down, drag downstream)
      const a = -this.aVis * D2R, qx = -.25 * K * Math.cos(a), qy = -.25 * K * Math.sin(a), z0 = SPAN / 2 + .1, L = Math.max(.05, Math.min(2, r.n)) * .55;
      this.fl.position.set(qx, qy, z0); this.fl.scale.set(1, L, 1);
      this.fw.position.set(qx, qy, z0); this.fw.scale.set(1, .55, 1);
      this.fd.position.set(qx, qy, z0); this.fd.scale.set(1, Math.max(.05, Math.min(1.5, r.D / r.W * 5 * .55)), 1);
      $('#caption').textContent = `${fmt(s.V)} m/s · ${fmt(s.aoa, 1)}° · lift ${fmt(r.n * 100)} % of weight${r.stalled ? ' · STALLED' : ''} · streaks slowed, drag arrow ×5`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      this.wingMat.emissive.setHex(k === 'wing' ? 0x333322 : 0); this.flapMat.emissive.setHex(k === 'flap' ? 0x553311 : 0);
      this.air.material.opacity = k === 'air' ? 1 : .95;
      [this.fl, this.fw, this.fd].forEach(g => g.children.forEach(c => c.material.emissive.setHex(k === 'forces' ? 0x333333 : 0)));
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Section: NACA 2412, lift slope about 0.105 per degree and zero-lift angle about −2.1° (published section data, Abbott & von Doenhoff, Theory of Wing Sections; values from memory, est.). Finite wing: a = a₀/(1 + a₀/(π·0.9·AR)) with aspect ratio 7.32.',
      'Aircraft: Cessna 172 class, wing area 16.2 m², chord 1.49 m, mass 1111 kg. Maximum lift coefficient 1.6 clean, +0.5 with 30° flaps; flap ΔCL0 = 0.9·δ/30 (all est.). Past stall, lift falls by up to 35 % and drag rises (est. shape).',
      'Drag polar CD = CD0 + CL²/(π·e·AR), CD0 = 0.032, e = 0.70 (est.). Check: best L/D about 11; Cessna 172 glide ratios near 9:1 (with a windmilling propeller) are often quoted. The model clean stall speed at 1111 kg is about 26 m/s (51 kt); published C172 stall speeds are about 48–53 kt (est., from memory).',
      'Air density from the ISA troposphere model. Lift L = ½ρv²S·CL, drag D = ½ρv²S·CD, power to fly = D·v.',
      'Streak picture: exact potential flow (circulation set by the Kutta condition) around a Joukowski airfoil with about 12 % thickness and 2 % camber, close to the NACA 2412 shape. Past the stall angle the picture adds a slow, turbulent wake over the top. The flap changes the outline and the flow angle only; this is a simplification.',
    ],
  };
  registerLab(lab);
})(globalThis);
