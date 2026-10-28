// Wind turbine lab: power in the wind, the Betz limit, tip-speed ratio and pitch control.
// Pure physics in WindPhys (testable in Node); the lab registers only in the browser.
(function (G) {
  const WP = {
    RATED: 3.0e6, ETA: 0.94, TIPMAX: 80, CUTIN: 3, CUTOUT: 25, HUB: 94, LOPT: 8.1,  // W; drivetrain; tip m/s; m/s; m/s; hub m; best λ
    BETZ: 16 / 27, HOME: 4.0,  // MWh per home per year (est., EU-type household)
    rho: T => 101325 / (287.05 * (T + 273.15)),
    // Cp(λ, β) fit of the form used in the Heier / MATLAB wind-turbine model: Cp max ≈ 0.48 at λ ≈ 8.1, β = 0
    cp(l, b) {
      if (l <= .1) return 0;
      const li = 1 / (1 / (l + 0.08 * b) - 0.035 / (b ** 3 + 1));
      return Math.max(0, 0.5176 * (116 / li - 0.4 * b - 5) * Math.exp(-21 / li) + 0.0068 * l);
    },
    aero(s, v, l, b) {
      const A = Math.PI * s.R ** 2, rho = WP.rho(s.T), Cp = WP.cp(l, b), Pw = .5 * rho * A * v ** 3;
      return { A, rho, Cp, Pw, Pa: Cp * Pw };
    },
    // controller: best λ below rated (limited by tip speed), pitch to hold rated above it, stop outside cut-in..cut-out
    auto(s, v) {
      if (v < WP.CUTIN || v > WP.CUTOUT) return { l: 0, b: v > WP.CUTOUT ? 90 : 0, stopped: true };
      const w = Math.min(WP.LOPT * v / s.R, WP.TIPMAX / s.R), l = w * s.R / v;
      let b = 0;
      if (WP.ETA * WP.aero(s, v, l, 0).Pa > WP.RATED) {
        let lo = 0, hi = 45;
        for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; WP.ETA * WP.aero(s, v, l, m).Pa > WP.RATED ? lo = m : hi = m; }
        b = (lo + hi) / 2;
      }
      return { l, b, stopped: false };
    },
    induction(Cp) {  // axial induction a from Cp = 4a(1-a)^2, a in [0, 1/3]
      let lo = 0, hi = 1 / 3;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; 4 * m * (1 - m) ** 2 < Cp ? lo = m : hi = m; }
      return (lo + hi) / 2;
    },
    autoP(s, v) { const c = WP.auto(s, v); return c.stopped ? 0 : Math.min(WP.RATED, WP.ETA * WP.aero(s, v, c.l, c.b).Pa); },
    curve(s) { const o = []; for (let v = 0; v <= 30.001; v += .5) o.push([v, WP.autoP(s, v)]); return o; },
    // yearly energy from a Rayleigh (Weibull k = 2) wind distribution with mean meanU
    aep(s) {
      let e = 0; const U = s.meanU, dv = .25;
      for (let v = dv / 2; v < 35; v += dv) e += WP.autoP(s, v) * Math.PI * v / (2 * U * U) * Math.exp(-Math.PI * v * v / (4 * U * U)) * dv;
      return e * 8760 / 1e6;  // MWh
    },
    ratedWind(s) { for (let v = WP.CUTIN; v <= WP.CUTOUT; v += .05) if (WP.autoP(s, v) >= WP.RATED * .999) return v; return null; },
    solve(s) {
      const v = s.v, c = s.mode ? null : WP.auto(s, v);
      const stopped = c ? c.stopped : v <= 0, l = c ? c.l : s.lam, b = c ? c.b : s.beta;
      const a = WP.aero(s, v, stopped ? 0 : l, b), raw = stopped ? 0 : WP.ETA * a.Pa, P = Math.min(raw, WP.RATED);
      const w = stopped || v <= 0 ? 0 : l * v / s.R, ind = WP.induction(stopped ? 0 : a.Cp), aep = WP.aep(s);
      return { s, v, l: stopped ? 0 : l, b, w, rpm: w * 60 / (2 * Math.PI), tip: w * s.R, Cp: stopped ? 0 : a.Cp, Pw: a.Pw, raw, P, stopped,
        overload: raw > 1.1 * WP.RATED, overspeed: w * s.R > 1.2 * WP.TIPMAX, a: ind, wake: v * (1 - 2 * ind), rho: a.rho,
        aep, cf: aep / (WP.RATED * 8760 / 1e6), homes: aep / WP.HOME, vr: WP.ratedWind(s) };
    },
  };
  WP.presets = [
    { n: 'Best aerodynamic point', kind: 'opt', s: { mode: 0, v: 9, lam: 7, beta: 0, R: 56, meanU: 8, T: 15 },
      note: 'Below rated wind the controller holds the tip-speed ratio near 8.1, where Cp peaks at about 48 %. That is 81 % of the Betz limit.' },
    { n: 'Breezy day', kind: 'typ', s: { mode: 0, v: 6.5, lam: 7, beta: 0, R: 56, meanU: 7, T: 15 },
      note: 'A 6.5 m/s breeze. Power grows with the cube of wind speed, so the turbine makes only about a quarter of its rated power.' },
    { n: 'Storm above cut-out', kind: 'edge', s: { mode: 0, v: 27, lam: 7, beta: 0, R: 56, meanU: 8, T: 15 },
      note: 'Above 25 m/s the controller turns the blades edge-on (feathered) and stops the rotor. The loads would be too high.' },
    { n: 'Rotor turns too slowly', kind: 'edge', s: { mode: 1, v: 10, lam: 3, beta: 0, R: 56, meanU: 8, T: 15 },
      note: 'At λ = 3 the blades meet the air at a very steep angle and stall. Cp falls to a few percent, and most of the wind passes unused.' },
    { n: 'No pitch control in a gale', kind: 'edge', s: { mode: 1, v: 17, lam: 4.7, beta: 0, R: 56, meanU: 8, T: 15 },
      note: 'Flat blades in a 17 m/s wind catch about twice the rated power. The generator would overheat. Real turbines pitch the blades to spill the extra power.' },
  ];
  WP.checks = [
    r => r.s.mode === 1 && r.v >= 5 && r.Cp >= .47,
    r => r.s.mode === 1 && r.v >= 16 && Math.abs(r.raw - WP.RATED) / WP.RATED <= .03 && !r.overspeed,
    r => r.s.mode === 0 && r.s.meanU <= 6.5 && r.cf >= .35,
  ];
  G.WindPhys = WP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const MW = x => x / 1e6;
  const lab = {
    id: 'windturbine', tab: 'Wind turbine',
    charts: ['Power curve', 'Electric power against wind speed. Green dashed: the optimal preset. Grey dashed: 59.3 % of the wind power (Betz limit).',
      'Power coefficient against tip-speed ratio', 'Cp is the share of the wind power that the rotor catches. No rotor can pass 59.3 %.'],
    eyebrow: 'Lab 9 · Betz limit and pitch control', concept: 'A wind turbine can never catch more than 59 % of the wind',
    text: 'The rotor slows the air down to take its energy. If it stopped the air completely, no new air could flow through. The best compromise slows the wind to one third of its speed behind the rotor: that is the Betz limit, 59.3 %. Real blades reach about 48 % when the blade tips move about 8 times faster than the wind.',
    home: 'Power grows with the cube of wind speed. A site with 20 % more wind gives about 70 % more energy, so turbines go on hills, at sea and on tall towers.',
    decor: { u: .1, y: 0, items: [['hill', [70, 0x8fae8b], 700, -300], ['hill', [60, 0x6f9a62], 760, 340], ['tree', [14], 70, -90], ['tree', [11], 90, -70],
      ['tree', [16], 80, 110], ['bush', [6], 45, -55], ['bush', [5], 50, 75], ['fence', [140], 35, 0]] },
    s: { mode: 0, v: 8, lam: 7, beta: 0, R: 56, meanU: 7.5, T: 15 },
    sliders: [
      { k: 'mode', label: 'Blade control', min: 0, max: 1, step: 1, fmt: v => v ? 'Manual: you set λ and pitch' : 'Automatic controller' },
      { k: 'v', label: 'Wind speed at the hub', min: 0, max: 30, step: .5, fmt: v => `${v} m/s · ${fmt(v * 3.6)} km/h` },
      { k: 'lam', label: 'Tip-speed ratio λ (manual)', min: 1, max: 14, step: .1, fmt: v => v.toFixed(1), hint: 'Blade-tip speed ÷ wind speed. Used only in manual mode.' },
      { k: 'beta', label: 'Blade pitch (manual)', min: 0, max: 40, step: 1, unit: '°' },
      { k: 'R', label: 'Rotor radius', min: 30, max: 80, step: 1, unit: 'm', hint: 'Swept area, and so power, grows with the radius squared.' },
      { k: 'meanU', label: 'Site mean wind (yearly)', min: 4, max: 11, step: .5, unit: 'm/s' },
      { k: 'T', label: 'Air temperature', min: -20, max: 40, step: 1, unit: '°C' },
    ],
    presets: WP.presets,
    missions: [
      { t: 'Catch the Betz limit', d: 'In manual mode, with wind of 5 m/s or more, reach a power coefficient Cp of 47 % or more.',
        win: 'Done. The best tip-speed ratio is about 8, with flat pitch. Then each blade section meets the air at its best angle.', check: WP.checks[0] },
      { t: 'Pitch through the gale', d: 'In manual mode, at 16 m/s or more, make the rated 3 MW within 3 %, with no overspeed.',
        win: 'Done. Turning the blades (pitch) lowers Cp, so the rotor spills the extra power. This is what the controller does all day.', check: WP.checks[1] },
      { t: 'Low-wind site', d: 'With the automatic controller at a site with a mean wind of 6.5 m/s or less, reach a capacity factor of 35 % or more.',
        win: 'Done. A bigger rotor for the same generator catches more of the light winds. This is why low-wind turbines have very long blades.', check: WP.checks[2] },
    ],
    chipsList: [{ k: 'blades', l: 'Blades', c: '#f2efe8' }, { k: 'nacelle', l: 'Nacelle', c: '#9aa6b0' }, { k: 'tower', l: 'Tower', c: '#d9d4c8' }, { k: 'air', l: 'Air flow', c: '#3f86b0' }],
    partInfo: {
      blades: 'Blades: shaped like long, twisted wings. Lift on each section turns the rotor. The pitch drive turns the whole blade to change how much power it catches.',
      nacelle: 'Nacelle: holds the main shaft, gearbox and generator. About 94 % of the rotor power becomes electricity (est.).',
      tower: 'Tower: about 94 m tall here. Wind is stronger and smoother higher up, so taller towers give more energy.',
      air: 'Air flow: the streaks slow down as they pass the rotor and the stream tube widens. Behind the rotor the air moves at about one third of its speed at the best point.',
    },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(75, 64), M(0x9db884, { roughness: .95, metalness: 0 })); ground.rotation.x = -Math.PI / 2; sc.add(ground);
      const H = WP.HUB / 10, white = M(0xf3f1ec, { roughness: .5, metalness: .05 });
      this.tower = new THREE.Mesh(new THREE.CylinderGeometry(.17, .32, H, 28), M(0xe9e5dc, { roughness: .6, metalness: .05 })); this.tower.position.y = H / 2; sc.add(this.tower);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(.7, .8, .12, 24), M(0xb9b2a5)); pad.position.y = .06; sc.add(pad);
      const nac = new THREE.Group(); nac.position.y = H + .1; sc.add(nac);
      this.nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.3, .45, .45), M(0xe6e2da, { roughness: .5 })); this.nacelle.position.x = .35; nac.add(this.nacelle);
      const cool = new THREE.Mesh(new THREE.BoxGeometry(.3, .16, .3), M(0xb9c2c8)); cool.position.set(.85, .3, 0); nac.add(cool);
      const rotor = new THREE.Group(); rotor.position.x = -.45; nac.add(rotor); this.rotor = rotor;
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(.24, 20, 14), white));
      const spin = new THREE.Mesh(new THREE.ConeGeometry(.24, .5, 24), white); spin.rotation.z = Math.PI / 2; spin.position.x = -.3; rotor.add(spin);
      // blade: planform in (chord, span), 5.6 units long at R = 56 m, extruded thin; chord along z, thickness along x
      const sh = new THREE.Shape(), N = 24, L = 5.6, ch = y => y < 1.2 ? .22 + .16 * (y - .2) : .38 - .31 * (y - 1.2) / (L - 1.2);
      const pts = []; for (let i = 0; i <= N; i++) { const y = .2 + (L - .2) * i / N; pts.push([.3 * ch(y), y]); }
      sh.moveTo(-.7 * ch(.2), .2); pts.forEach(p => sh.lineTo(p[0], p[1])); for (let i = N; i >= 0; i--) { const y = .2 + (L - .2) * i / N; sh.lineTo(-.7 * ch(y), y); }
      const bg = new THREE.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: false }); bg.rotateY(Math.PI / 2); bg.translate(-.03, 0, 0);
      this.blades = [0, 1, 2].map(k => {
        const arm = new THREE.Group(); arm.rotation.x = k * 2 * Math.PI / 3; rotor.add(arm);
        const piv = new THREE.Group(); arm.add(piv);
        const bl = new THREE.Mesh(bg, white.clone()); piv.add(bl);
        const root = new THREE.Mesh(new THREE.CylinderGeometry(.11, .13, .3, 16), white); root.position.y = .2; piv.add(root);
        return { arm, piv, bl };
      });
      // air streaks (InstancedMesh): x along the wind, r0/phi upstream position; streamtube widens behind the rotor
      this.NP = 320; const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .75 });
      this.air = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .03, .03), mat, this.NP); sc.add(this.air);
      this.P = Array.from({ length: this.NP }, () => ({ x: -26 + Math.random() * 52, r0: Math.sqrt(Math.random()) * 9, ph: Math.random() * Math.PI * 2 }));
      const cloudM = M(0xfbf7ef, { roughness: 1, metalness: 0 });
      [[-30, 24, -40], [10, 27, -48], [40, 22, -30]].forEach(([x, y, z]) => { const g = new THREE.Group();
        [[0, 0, 3], [3.2, -.4, 2.3], [-3, -.5, 2.1]].forEach(([a, b, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudM); m.position.set(a, b, 0); m.scale.y = .6; g.add(m); });
        g.position.set(x, y, z); sc.add(g); });
      this.ang = 0; this.wv = 0; this.bv = 0;
      this.scene = sc; this.cam = { p: [-12, 8.5, 9.5], t: [0, 8.2, 0] };
    },
    update() {
      const r = this.r = WP.solve(this.s); this.curveNow = WP.curve(this.s); this.curveOpt = this.curveOpt || WP.curve(optOf(this));
      const pct = r.P / WP.RATED * 100;
      tiles([
        { l: 'Electric power', v: fmt(MW(r.P), 2), u: 'MW', e: `${fmt(pct)} % of the rated 3 MW`, cls: r.overload ? 'bad' : pct > 99 ? 'good' : '' },
        { l: 'Power coefficient Cp', v: fmt(r.Cp * 100, 1), u: '%', e: `Betz limit 59.3 %`, cls: r.Cp >= .45 ? 'good' : r.Cp < .2 && !r.stopped ? 'warn' : '' },
        { l: 'Tip-speed ratio λ', v: fmt(r.l, 1), e: 'best is about 8.1' },
        { l: 'Rotor speed', v: fmt(r.rpm, 1), u: 'rpm', e: `tip ${fmt(r.tip)} m/s`, cls: r.overspeed ? 'bad' : '' },
        { l: 'Blade pitch', v: fmt(r.b, 1), u: '°', e: r.stopped && r.v > WP.CUTOUT ? 'feathered: storm stop' : this.s.mode ? 'set by you' : 'set by the controller' },
        { l: 'Wind behind rotor', v: fmt(Math.max(0, r.wake), 1), u: 'm/s', e: `induction a = ${fmt(r.a, 2)}` },
        { l: 'Energy per year', v: fmt(r.aep / 1000, 1), u: 'GWh', e: `≈ ${fmt(r.homes)} homes (4 MWh each, est.)` },
        { l: 'Capacity factor', v: fmt(r.cf * 100), u: '%', e: `site mean wind ${this.s.meanU} m/s` },
      ]);
      $('#alarm').hidden = !(r.overload || r.overspeed); $('#alarm').textContent = r.overload ? 'Generator overload' : 'Rotor overspeed';
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, cur = this.curveNow, opt = this.curveOpt, ymax = 4;
      const betz = []; for (let v = 0; v <= 30; v += .5) betz.push([v, Math.min(ymax + 1, MW(WP.BETZ * WP.ETA * .5 * r.rho * Math.PI * this.s.R ** 2 * v ** 3))]);
      const vr = r.vr;
      this.c1 = chart($('#c1'), { x: [0, 30], y: [0, ymax], xlab: 'Wind speed at hub (m/s)', ylab: 'Electric power (MW)',
        body: (X, Y) => `<rect class="f-bad" x="${X(WP.CUTOUT)}" y="${Y(ymax)}" width="${X(30) - X(WP.CUTOUT)}" height="${Y(0) - Y(ymax)}"/>` +
          `<text class="lbl-bad" x="${X(25.4)}" y="${Y(ymax) + 12}">stopped</text>` +
          `<path class="s-mut dash" d="${path(betz, X, Y)}"/><path class="ghost" d="${path(opt.map(q => [q[0], MW(q[1])]), X, Y)}"/>` +
          `<path class="s-acc" d="${path(cur.map(q => [q[0], MW(q[1])]), X, Y)}"/>` +
          `<line class="s-mut dash" x1="${X(WP.CUTIN)}" x2="${X(WP.CUTIN)}" y1="${Y(0)}" y2="${Y(ymax)}"/><text x="${X(WP.CUTIN) + 3}" y="${Y(ymax) + 24}">cut-in</text>` +
          (vr ? `<line class="s-mut dash" x1="${X(vr)}" x2="${X(vr)}" y1="${Y(0)}" y2="${Y(ymax)}"/><text x="${X(vr) + 3}" y="${Y(.25)}">rated at ${fmt(vr, 1)} m/s</text>` : '') +
          `<text class="lbl" x="${X(13)}" y="${Y(3.0) - 6}">3 MW rated</text>` });
      moveDot(this.c1, r.v, Math.min(MW(r.raw), ymax));
      const lams = [], lam0 = [];
      for (let l = .5; l <= 14; l += .1) { lams.push([l, WP.cp(l, r.b)]); lam0.push([l, WP.cp(l, 0)]); }
      this.c2 = chart($('#c2'), { x: [0, 14], y: [0, .65], yt: [0, .1, .2, .3, .4, .5, .6], xlab: 'Tip-speed ratio λ', ylab: 'Power coefficient Cp',
        body: (X, Y) => `<line class="s-bad" x1="${X(0)}" x2="${X(14)}" y1="${Y(WP.BETZ)}" y2="${Y(WP.BETZ)}"/><text class="lbl-bad" x="${X(.4)}" y="${Y(WP.BETZ) - 5}">Betz limit 59.3 %</text>` +
          `<path class="s-mut dash" d="${path(lam0, X, Y)}"/><path class="s-acc" d="${path(lams, X, Y)}"/>` +
          `<text class="lbl-acc" x="${X(9.5)}" y="${Y(.08)}">pitch ${fmt(r.b, 1)}°</text><text x="${X(9.5)}" y="${Y(.02)}">dashed: pitch 0°</text>` });
      moveDot(this.c2, Math.min(r.l, 14), r.Cp);
    },
    frame(dt) {
      if (!this.r || !this.air) return;
      const r = this.r, s = this.s, k = 1 - Math.exp(-dt / .6);
      this.wv += (r.w - this.wv) * k; this.bv += (Math.min(r.b, 90) - this.bv) * k;
      this.ang += this.wv * dt; this.rotor.rotation.x = this.ang;
      const sc = s.R / 56;
      this.blades.forEach(b => { b.piv.rotation.y = this.bv * D2R; b.piv.scale.y = sc; });
      // actuator-disc flow: u(x) = V(1 - a(1 + x/sqrt(x²+R²))); streamtube radius from continuity
      const Rm = s.R, V = Math.max(r.v, .01), a = r.a, rTube = Rm * Math.sqrt(1 - a) / 10, H = WP.HUB / 10 + .1;
      const m = new THREE.Matrix4(), col = new THREE.Color(), cIn = new THREE.Color(0x3f86b0), cOut = new THREE.Color(0xa9c9dd), show = 3;
      this.P.forEach((p, i) => {
        const xm = p.x * 10, u = V * (1 - a * (1 + xm / Math.sqrt(xm * xm + Rm * Rm)));
        p.x += u * dt * show / 10; if (p.x > 26) { p.x -= 52; p.r0 = Math.sqrt(Math.random()) * 9; p.ph = Math.random() * Math.PI * 2; }
        const inT = p.r0 < rTube, rr = inT ? p.r0 * Math.sqrt(V / Math.max(u, .05 * V)) : p.r0;
        m.makeScale(Math.max(.25, u / 10), 1, 1).setPosition(p.x, H + rr * Math.sin(p.ph), rr * Math.cos(p.ph));
        this.air.setMatrixAt(i, m); this.air.setColorAt(i, col.copy(inT ? cIn : cOut));
      });
      this.air.instanceMatrix.needsUpdate = true; if (this.air.instanceColor) this.air.instanceColor.needsUpdate = true;
      $('#caption').textContent = r.stopped ? (r.v > WP.CUTOUT ? `${fmt(r.v, 1)} m/s: storm stop, blades feathered` : `${fmt(r.v, 1)} m/s: below cut-in, rotor parked`)
        : `${fmt(r.v, 1)} m/s wind · ${fmt(r.rpm, 1)} rpm (real time) · ${fmt(MW(r.P), 2)} MW · air streaks shown ${show}× faster`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      const em = (list, on) => list.forEach(x => x.material.emissive && x.material.emissive.setHex(on ? 0x554422 : 0));
      em(this.blades.map(b => b.bl), k === 'blades'); em([this.nacelle], k === 'nacelle'); em([this.tower], k === 'tower');
      this.air.material.opacity = k === 'air' ? 1 : .75;
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Rotor power P = ½·ρ·A·Cp(λ, β)·v³, with A = πR². Cp(λ, β) uses the published analytic fit Cp = 0.5176(116/λi − 0.4β − 5)e^(−21/λi) + 0.0068λ, 1/λi = 1/(λ + 0.08β) − 0.035/(β³ + 1) (Heier; as in the MATLAB/Simulink wind-turbine block). Its peak is Cp ≈ 0.48 at λ ≈ 8.1.',
      'Betz limit: Cp ≤ 16/27 = 0.593 for any open rotor (actuator-disc theory). Axial induction a comes from Cp = 4a(1 − a)²; wake speed = v(1 − 2a). The flow streaks use the actuator-disc velocity along the axis; this is a simplification.',
      'Turbine data close to a 112 m, 3 MW class machine (est.): rated 3.0 MW, cut-in 3 m/s, cut-out 25 m/s, hub 94 m, tip speed limit 80 m/s, drivetrain and generator efficiency 94 %. Check: the model reaches rated power at about 10.4 m/s. Real machines of this size usually reach it at about 11–13 m/s (est., not checked against a datasheet), because real Cp near rated wind is lower than this fit.',
      'Yearly energy uses a Rayleigh wind distribution (Weibull shape k = 2) with the site mean wind. No losses for wakes, icing or availability. One home = 4 MWh per year (est.).',
      'Air density from the temperature at sea-level pressure: ρ = p/(R·T).',
    ],
  };
  registerLab(lab);
})(globalThis);
