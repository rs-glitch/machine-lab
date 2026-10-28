// Lab: microwave oven. Standing waves in a metal cavity, hot spots, turntable averaging, thawing runaway.
// Physics is plain JS (MW) so tools/test_microwave.js can check it in Node. Values marked "est." are estimates.
(function () {
  const MW = (() => {
    const c0 = 299792458, f = 2.45e9, lam = c0 / f, k = 2 * Math.PI / lam;
    const A = 0.30, B = 0.30, C = 0.20, ZF = 0.035, NG = 90;          // cavity 30 x 30 x 20 cm (est.), food plane 3.5 cm up
    const PMAG = 1000, ETA_MAG = 0.65, L0 = 0.08, H = 0.02, NP = 48;  // magnetron W (est.), its efficiency (est.), load constant (est.), food depth m
    const DT = 0.5, CYCLE = 20, OMEGA = 2 * Math.PI / 12, KCOND = 0.5; // s, duty-cycle period s (est.), turntable 1 turn / 12 s, W/m/K
    const FOODS = [
      { n: 'Soup', eps: 12, rho: 1030, c: 3900, T0: 5 },
      { n: 'Frozen block', eps: 12, epsF: 3, rho: 950, c: 3900, cF: 2100, Lf: 300e3, T0: -18 },
      { n: 'Chocolate bar', eps: 1, rho: 1300, c: 1600, T0: 20, melt: 34 },
    ];
    function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    // |E|^2 on the food plane: sum of cavity modes near 2.45 GHz, weighted by a loaded-Q resonance, fixed random phases
    function field(Q = 30, seed = 5, pmax = 6) {
      const r = rng(seed), modes = [];
      for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) for (let p = 0; p <= pmax; p++) {
        const km = Math.PI * Math.hypot(m / A, n / B, p / C), w = 1 / (1 + (Q * (km - k) / k) ** 2);
        if (w > .03) modes.push({ m, n, p, w, ph: r() * 2 * Math.PI, cz: Math.cos(p * Math.PI * ZF / C) });
      }
      const I = new Float32Array(NG * NG); let sum = 0;
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) {
        const x = (i + .5) / NG * A, y = (j + .5) / NG * B; let re = 0, im = 0;
        for (const md of modes) { const a = md.w * md.cz * Math.sin(md.m * Math.PI * x / A) * Math.sin(md.n * Math.PI * y / B); re += a * Math.cos(md.ph); im += a * Math.sin(md.ph); }
        sum += I[j * NG + i] = re * re + im * im;
      }
      const mean = sum / I.length; for (let q = 0; q < I.length; q++) I[q] /= mean;
      return { I, modes };
    }
    function sampleI(F, x, y) {  // bilinear, oven coordinates in m; 0 outside the cavity
      if (x < 0 || y < 0 || x > A || y > B) return 0;
      const gx = Math.min(NG - 1.001, Math.max(0, x / A * NG - .5)), gy = Math.min(NG - 1.001, Math.max(0, y / B * NG - .5));
      const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, I = F.I;
      return (I[j * NG + i] * (1 - fx) + I[j * NG + i + 1] * fx) * (1 - fy) + (I[(j + 1) * NG + i] * (1 - fx) + I[(j + 1) * NG + i + 1] * fx) * fy;
    }
    function simulate(s, F) {
      const fd = FOODS[s.food], R = s.R / 100, d = s.off / 100, dx = 2 * R / NP, dA = dx * dx, m = fd.rho * dA * H;
      const cells = [], idx = new Int32Array(NP * NP).fill(-1);
      for (let j = 0; j < NP; j++) for (let i = 0; i < NP; i++) { const u = -R + (i + .5) * dx, v = -R + (j + .5) * dx;
        if (u * u + v * v <= R * R) { idx[j * NP + i] = cells.length; cells.push({ i, j, u, v }); } }
      const n = cells.length;
      // specific enthalpy (J/kg), 0 = solid at 0 C for frozen food, liquid at 0 C otherwise
      const Hof = T => fd.Lf ? (T < 0 ? fd.cF * T : fd.Lf + fd.c * T) : fd.c * T;
      const Tof = h => fd.Lf ? (h < 0 ? h / fd.cF : h < fd.Lf ? 0 : (h - fd.Lf) / fd.c) : h / fd.c;
      const epsOf = h => fd.Lf ? (h < 0 ? fd.epsF : h < fd.Lf ? fd.epsF + (fd.eps - fd.epsF) * h / fd.Lf : fd.eps) : fd.eps;
      const Hc = new Float64Array(n).fill(Hof(fd.T0)), H0 = Hof(fd.T0), hBoil = Hof(100);
      const pairs = []; cells.forEach((c, q) => { const r1 = c.i + 1 < NP ? idx[c.j * NP + c.i + 1] : -1, d1 = c.j + 1 < NP ? idx[(c.j + 1) * NP + c.i] : -1;
        if (r1 >= 0) pairs.push(q, r1); if (d1 >= 0) pairs.push(q, d1); });
      const cond = KCOND * H * DT / m;  // J/kg per K of neighbour difference per step (face area H*dx over distance dx)
      const steps = Math.round(s.time / DT), every = Math.max(1, Math.ceil(steps / 100));
      const Ii = new Float32Array(n), e = new Float32Array(n), hist = [], snaps = [], snapT = [];
      let Ein = 0, Eboil = 0, boiled = 0, onTime = 0, t = 0;
      const record = () => { const T = new Float32Array(n); let mn = 1e9, mx = -1e9, sm = 0, lo = 0;
        for (let q = 0; q < n; q++) { const v = T[q] = Tof(Hc[q]); mn = Math.min(mn, v); mx = Math.max(mx, v); sm += v; if (v < 74) lo++; }
        hist.push([t, mn, sm / n, mx]); snaps.push(T); snapT.push(t); return { mn, mx, mean: sm / n, below: lo / n }; };
      record();
      for (let st = 0; st < steps; st++) {
        const th = s.turn ? OMEGA * t : 0, cs = Math.cos(th), sn = Math.sin(th);
        const on = (t % CYCLE) < s.power / 100 * CYCLE - 1e-9 ? 1 : 0;
        let L = 0;
        for (let q = 0; q < n; q++) { const px = d + cells[q].u, py = cells[q].v;
          Ii[q] = sampleI(F, A / 2 + px * cs - py * sn, B / 2 + px * sn + py * cs); e[q] = epsOf(Hc[q]); L += e[q] * Ii[q] * dA; }
        const Pabs = L > 0 ? on * PMAG * (s.fork ? .6 : 1) * L / (L + L0) : 0;  // shortcut: a fork just reflects 40 % (est.)
        if (Pabs > 0) for (let q = 0; q < n; q++) Hc[q] += Pabs * e[q] * Ii[q] * dA / L * DT / m;
        Ein += Pabs * DT; onTime += on * DT;
        for (let p = 0; p < pairs.length; p += 2) { const a = pairs[p], b = pairs[p + 1], fl = cond * (Tof(Hc[b]) - Tof(Hc[a])); Hc[a] += fl; Hc[b] -= fl; }
        if (!fd.melt) for (let q = 0; q < n; q++) if (Hc[q] > hBoil) { const ex = (Hc[q] - hBoil) * m; Eboil += ex; boiled += ex / 2257e3; Hc[q] = hBoil; }
        t += DT;
        if (s.stir && st === Math.floor(steps / 2)) { let sm = 0; for (let q = 0; q < n; q++) sm += Hc[q]; Hc.fill(sm / n); }
        if ((st + 1) % every === 0 || st === steps - 1) record();
      }
      const last = snaps[snaps.length - 1]; let mn = 1e9, mx = -1e9, sm = 0, lo = 0, thaw = 0, melt = 0;
      for (let q = 0; q < n; q++) { const v = last[q]; mn = Math.min(mn, v); mx = Math.max(mx, v); sm += v; if (v < 74) lo++;
        if (fd.Lf && Hc[q] >= fd.Lf) thaw++; if (fd.melt && v >= fd.melt) melt++; }
      let Estored = 0; for (let q = 0; q < n; q++) Estored += (Hc[q] - H0) * m;
      return { s, fd, R, d, dx, n, m, cells, idx, hist, snaps, snapT, min: mn, max: mx, mean: sm / n, below: lo / n,
        thawFrac: fd.Lf ? thaw / n : 1, meltFrac: fd.melt ? melt / n : 0, Ein, Eboil, boiled, Estored, onTime,
        Eel: PMAG * onTime / ETA_MAG, Pavg: Ein / s.time, mass: m * n };
    }
    function cross(r, T) {  // temperature along the food's centre line (cm, C)
      const j = Math.floor(NP / 2), out = [];
      for (let i = 0; i < NP; i++) { const q = r.idx[j * NP + i]; if (q >= 0) out.push([r.cells[q].u * 100, T[q]]); }
      return out;
    }
    function peaks(pts) {  // local maxima above the line mean
      const mean = pts.reduce((a, p) => a + p[1], 0) / pts.length, out = [];
      for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1] && pts[i][1] > mean) out.push(pts[i]);
      return out;
    }
    // hot-spot spacing along the food centre line with the turntable stopped (cm)
    function spotSpacing(F, s) {
      const R = s.R / 100, d = s.off / 100, pts = [];
      for (let q = 0; q <= 200; q++) { const u = -R + 2 * R * q / 200; pts.push([u * 100, sampleI(F, A / 2 + d + u, B / 2)]); }
      const pk = peaks(pts); if (pk.length < 2) return NaN;
      return (pk[pk.length - 1][0] - pk[0][0]) / (pk.length - 1);
    }
    return { c0, f, lam, k, A, B, C, ZF, NG, NP, PMAG, ETA_MAG, OMEGA, CYCLE, FOODS, field, sampleI, simulate, cross, peaks, spotSpacing };
  })();
  if (typeof module !== 'undefined') module.exports = MW;
  if (typeof registerLab !== 'function') return;

  const lab = {
    id: 'microwave', tab: 'Microwave',
    charts: ['Temperature across the food', 'Along the centre line of the food, at the time shown. Green dashed: the optimal preset at the end.',
      'Coldest, mean and hottest point against time', 'Blue: coldest point. Black: mean. Red: hottest point. Steps show the magnetron switching on and off.'],
    eyebrow: 'Lab 5 · Standing waves and dielectric heating', concept: 'A microwave heats in spots, because its waves stand still',
    text: 'The magnetron sends 2.45 GHz waves into a metal box. The waves reflect from the walls and make a fixed pattern of strong and weak spots, about 6 cm apart. Water molecules in the food turn with the field and make heat. The turntable moves the food through the spots, so the heat spreads more evenly.',
    home: 'This is why the label says "stir halfway" and "let it stand". Frozen food thaws in patches: thawed water absorbs much more than ice, so a thawed spot gets hotter and hotter.',
    s: { food: 0, power: 100, time: 120, turn: 1, stir: 0, R: 10, off: 0, fork: 0, meas: 15 },
    sliders: [
      { k: 'food', label: 'Food', min: 0, max: 2, step: 1, fmt: v => MW.FOODS[v].n },
      { k: 'power', label: 'Power level', min: 10, max: 100, step: 10, unit: '%', hint: 'Below 100 % the magnetron switches on and off in a 20 s cycle.' },
      { k: 'time', label: 'Cooking time', min: 10, max: 1200, step: 10, fmt: v => v >= 60 ? `${Math.floor(v / 60)} min ${v % 60} s` : `${v} s` },
      { k: 'turn', label: 'Turntable', min: 0, max: 1, step: 1, fmt: v => v ? 'On' : 'Off' },
      { k: 'stir', label: 'Stir at half time', min: 0, max: 1, step: 1, fmt: v => v ? 'Yes' : 'No' },
      { k: 'R', label: 'Food radius (2 cm deep)', min: 5, max: 14, step: .5, unit: 'cm' },
      { k: 'off', label: 'Food position off centre', min: 0, max: 8, step: .5, unit: 'cm' },
      { k: 'fork', label: 'Metal fork', min: 0, max: 1, step: 1, fmt: v => v ? 'Fork in the food' : 'No fork' },
      { k: 'meas', label: 'Your measured spot spacing', min: 2, max: 15, step: .1, unit: 'cm', hint: 'For the chocolate test: read the gap between melted peaks on the chart.' },
    ],
    presets: [
      { n: 'Even and safe reheat', kind: 'opt', s: { food: 0, power: 60, time: 420, turn: 1, stir: 1, R: 10, off: 3, fork: 0 }, note: 'Medium power (60 %), the bowl off centre on the turntable, and a stir at half time. All of the soup reaches the safe 74 °C, and no spot boils.' },
      { n: 'Quick reheat', kind: 'typ', s: { food: 0, power: 100, time: 120, turn: 1, stir: 0, R: 10, off: 0, fork: 0 }, note: 'Two minutes on full power. The soup is only warm (about 40–50 °C), and no point reaches the safe 74 °C.' },
      { n: 'Frozen block, no turntable', kind: 'edge', s: { food: 1, power: 100, time: 300, turn: 0, stir: 0, R: 8, off: 0, fork: 0 }, note: 'Thawed spots absorb 4 times more than frozen ones (est.). They boil while other parts are still ice: thermal runaway.' },
      { n: 'Soup on full power, too long', kind: 'edge', s: { food: 0, power: 100, time: 420, turn: 1, stir: 0, R: 10, off: 0, fork: 0 }, note: 'The hot spots reach 100 °C and boil over long before the cold spots are safe.' },
      { n: 'Fork left in the soup', kind: 'edge', s: { food: 0, power: 100, time: 120, turn: 1, stir: 0, R: 10, off: 0, fork: 1 }, note: 'Metal reflects the waves. Sharp tines concentrate the field and make sparks (arcing). Less power reaches the soup.' },
    ],
    missions: [
      { t: 'Chocolate test', d: 'Choose the chocolate bar and stop the turntable. Read the gap between the melted peaks on the chart, and set "Your measured spot spacing".', win: 'Done. The spots are half a wavelength apart, so λ ≈ 2 × spacing ≈ 12 cm. Then c = f·λ ≈ 3 × 10⁸ m/s: you measured the speed of light.',
        check: r => r.s.food === 2 && !r.s.turn && Number.isFinite(lab.spacing) && Math.abs(r.s.meas - lab.spacing) / lab.spacing < .12 },
      { t: 'Safe and even soup', d: 'Heat the soup so that every point reaches 74 °C and no point boils. Use no fork.', win: 'Done. Lower power gives heat time to spread; stirring mixes the hot and cold spots.',
        check: r => r.s.food === 0 && !r.s.fork && r.min >= 74 && r.boiled === 0 },
      { t: 'Thaw, do not cook', d: 'Thaw the whole frozen block, but keep every point at 40 °C or less.', win: 'Done. This is what the defrost setting does: short bursts of power with pauses, so heat can move from thawed spots into the ice.',
        check: r => r.s.food === 1 && r.thawFrac >= .999 && r.max <= 40 },
    ],
    chipsList: [{ k: 'mag', l: 'Magnetron', c: '#c97b3a' }, { k: 'guide', l: 'Waveguide', c: '#9aa5ae' }, { k: 'turn', l: 'Turntable', c: '#8fc3d9' }, { k: 'field', l: 'Show wave pattern', c: '#ff9a3d' }],
    partInfo: {
      mag: 'Magnetron: a vacuum tube with a magnet. Electrons spin past small cavities and make 2.45 GHz waves, about 1000 W. Only about 65 % of the electricity becomes waves (est.).',
      guide: 'Waveguide: a metal duct that carries the waves from the magnetron into the oven box.',
      turn: 'Turntable: it moves the food through the fixed hot and cold spots. One turn takes about 12 s.',
      field: 'Wave pattern: the strength of the standing wave at the height of the food. Bright spots heat fast; dark spots hardly heat. The pattern does not move. Only the food moves.',
    },
    notes: [
      'Field: sum of the cavity modes of a 30 × 30 × 20 cm metal box (est.) near 2.45 GHz (λ = 12.2 cm), with a loaded Q of 30 (est.) and fixed random phases. Only |E|² on the food plane is used. Hot spots on the centre line of the food are 6.4 cm apart; along other lines the gap is 5–9 cm, because spots are λ/2 apart only along the direction of the wave.',
      'Heating: local power ∝ ε″·|E|². ε″ ≈ 12 for soup and water (approx. published range 10–15 at 2.45 GHz), 3 for frozen food (est.; pure ice is near 0.003), 1 for chocolate (est.).',
      'Absorbed power = 1000 W × L / (L + L₀) with L = Σ ε″|E|²·area (est. load model). Magnetron efficiency 65 % (est.). A fork reflects 40 % more (est.); real arcing is not modelled.',
      'Food is a 2 cm deep disc with heat conduction (0.5 W/m·K), latent heat of thawing, and boiling at 100 °C. Heat loss to the air is ignored.',
      'Safe reheat temperature 74 °C (165 °F): USDA Food Safety and Inspection Service guidance for leftovers.',
    ],
    F: null, tp: 0, si: -1,
    update() {
      if (!this.F) this.F = MW.field();
      const r = this.r = MW.simulate(this.s, this.F);
      if (!this.ghost) this.ghost = MW.simulate(optOf(this), this.F);
      this.spacing = MW.spotSpacing(this.F, this.s);
      if (this.food && this.builtR !== this.s.R) this.makeFood();
      if (this.fork) this.fork.visible = !!this.s.fork;
      const ef = r.Ein / Math.max(1, r.Eel), fd = r.fd, list = [
        { l: 'Mean temperature', v: fmt(r.mean), u: '°C', e: `start ${fd.T0} °C · ${fmt(r.mass * 1000)} g` },
        { l: 'Coldest point', v: fmt(r.min), u: '°C', cls: r.min >= 74 ? 'good' : 'warn', e: 'safe reheat 74 °C' },
        { l: 'Hottest point', v: fmt(r.max), u: '°C', cls: r.boiled > 0 ? 'bad' : '', e: r.boiled > 0 ? `${fmt(r.boiled * 1000)} g boiled off` : 'no boiling' },
        { l: 'Below 74 °C', v: fmt(r.below * 100), u: '%', e: 'of the food' },
        { l: 'Power into food', v: fmt(r.Pavg), u: 'W', e: `average over ${fmt(this.s.time)} s` },
        { l: 'Electricity used', v: fmt(r.Eel / 3600, 1), u: 'Wh', e: `${fmt(ef * 100)} % ends up in the food` },
      ];
      if (fd.Lf) list.push({ l: 'Thawed', v: fmt(r.thawFrac * 100), u: '%', cls: r.thawFrac >= .999 ? 'good' : '' });
      if (fd.melt) list.push({ l: 'Speed of light from your spacing', v: fmt(2 * this.s.meas / 100 * MW.f / 1e8, 2), u: '×10⁸ m/s', e: 'c = 2 × spacing × 2.45 GHz' });
      tiles(list);
      $('#alarm').hidden = !(r.boiled > 0 || this.s.fork); $('#alarm').textContent = this.s.fork ? 'Arcing' : 'Boiling over';
      this.si = -1; this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, si = this.si < 0 ? r.snaps.length - 1 : this.si, cs = MW.cross(r, r.snaps[si]);
      const g = this.ghost, gcs = MW.cross(g, g.snaps[g.snaps.length - 1]);
      const pk = (r.s.food === 2 || !r.s.turn) ? MW.peaks(cs) : [];
      this.c1 = chart($('#c1'), { x: [-14, 14], y: [-20, 110], xt: [-12, -8, -4, 0, 4, 8, 12], yt: [-20, 0, 20, 40, 60, 74, 100], xlab: 'Position across the food (cm)', ylab: 'Temperature (°C)',
        body: (X, Y) => `<line class="s-bad" x1="${X(-14)}" x2="${X(14)}" y1="${Y(74)}" y2="${Y(74)}"/><text class="lbl-bad" x="${X(-13.5)}" y="${Y(74) - 4}">safe 74 °C</text>` +
          `<line class="s-mut dash" x1="${X(-14)}" x2="${X(14)}" y1="${Y(0)}" y2="${Y(0)}"/>` +
          `<path class="ghost" d="${path(gcs, X, Y)}"/><text class="lbl-ok" x="${X(gcs[gcs.length - 1][0]) - 40}" y="${Y(gcs[gcs.length - 1][1]) - 6}">optimal</text>` +
          `<path class="s-acc" d="${path(cs, X, Y)}"/>` +
          pk.map(p => `<circle class="pt" r="3" cx="${X(p[0])}" cy="${Y(p[1])}"/><text x="${X(p[0])}" y="${Y(p[1]) - 7}" text-anchor="middle">${p[0].toFixed(1)}</text>`).join('') });
      const hot = cs.reduce((a, b) => (b[1] > a[1] ? b : a));
      moveDot(this.c1, hot[0], Math.min(110, hot[1]));
      if (this.si < 0 || !this.c2 || this.c2t !== r) {
        const h = r.hist, T = this.s.time;
        this.c2 = chart($('#c2'), { x: [0, T], y: [-20, 110], yt: [-20, 0, 20, 40, 60, 74, 100], xlab: 'Time (s)', ylab: 'Temperature (°C)',
          body: (X, Y) => `<line class="s-bad" x1="${X(0)}" x2="${X(T)}" y1="${Y(74)}" y2="${Y(74)}"/>` +
            `<path class="s-cold" d="${path(h.map(q => [q[0], q[1]]), X, Y)}"/><path class="s-ink" d="${path(h.map(q => [q[0], q[2]]), X, Y)}"/><path class="s-hot" d="${path(h.map(q => [q[0], q[3]]), X, Y)}"/>` });
        this.c2t = r;
      }
      const hq = r.hist[Math.min(si, r.hist.length - 1)]; moveDot(this.c2, hq[0], hq[2]);
    },
    build() {
      const sc = new THREE.Scene(); lights(sc); const A = MW.A, B = MW.B, C = MW.C;
      const cav = glassBox(A, C, B, 0xb8c4cc, .1); cav.position.y = C / 2; sc.add(cav);
      const body = glassBox(.50, .28, .40, 0x9fb3c2, .04); body.position.set(.08, .1, 0); sc.add(body);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.13, .22, .01), M(0x2b3136)); panel.position.set(.25, .1, .2); sc.add(panel);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, .01), M(0x8a949c)); b.position.set(.23 + (i % 2) * .04, .16 - Math.floor(i / 2) * .035, .207); sc.add(b); }
      const disp = new THREE.Mesh(new THREE.BoxGeometry(.09, .03, .005), new THREE.MeshBasicMaterial({ color: 0x3fd47a })); disp.position.set(.25, .195, .207); sc.add(disp);
      const mag = new THREE.Group(); mag.position.set(.25, .1, -.07); sc.add(mag); this.mag = mag;
      mag.add(new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .07, 24), M(0xc97b3a, { metalness: .7, roughness: .3 })));
      for (let i = 0; i < 7; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, .003, .1), M(0xb7bec4, { metalness: .8 })); fin.position.y = -.03 + i * .01; mag.add(fin); }
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .04, 10), M(0xdddddd)); ant.position.y = .055; mag.add(ant);
      const guide = new THREE.Mesh(new THREE.BoxGeometry(.11, .035, .08), M(0x9aa5ae, { metalness: .7, transparent: true, opacity: .8 })); guide.position.set(.2, .16, -.07); sc.add(guide); this.guide = guide;
      const tt = new THREE.Group(); tt.position.y = .012; sc.add(tt); this.tt = tt;
      tt.add(new THREE.Mesh(new THREE.CylinderGeometry(.135, .135, .006, 48), new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: .45, roughness: .1, depthWrite: false })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.08, .006, 8, 40), M(0x555b60)); ring.rotation.x = Math.PI / 2; ring.position.y = -.008; sc.add(ring);
      this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = MW.NP;
      this.tex = new THREE.CanvasTexture(this.canvas);
      this.makeFood();
      // standing-wave pattern on the food plane (hidden until picked)
      const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fx = fc.getContext('2d'), img = fx.createImageData(128, 128);
      if (!this.F) this.F = MW.field();
      for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
        const u = (px + .5) / 128, v = 1 - (py + .5) / 128, X = (u - .5) * A, Z = -(v - .5) * B, I = MW.sampleI(this.F, X + A / 2, Z + B / 2) / 3;
        const o = (py * 128 + px) * 4, a = Math.min(1, I); img.data[o] = 255; img.data[o + 1] = 120 + 135 * a; img.data[o + 2] = 40 + 200 * a * a; img.data[o + 3] = 230 * a;
      }
      fx.putImageData(img, 0, 0);
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(A, B), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      fp.rotation.x = -Math.PI / 2; fp.position.y = MW.ZF + .03; fp.visible = false; sc.add(fp); this.fieldPlane = fp;
      const fork = new THREE.Group(), fm = M(0xd9dde0, { metalness: .9, roughness: .2 });
      const handle = new THREE.Mesh(new THREE.BoxGeometry(.012, .004, .12), fm); handle.position.z = .07; fork.add(handle);
      for (let i = 0; i < 4; i++) { const tine = new THREE.Mesh(new THREE.BoxGeometry(.002, .003, .04), fm); tine.position.set(-.0045 + i * .003, 0, -.01); fork.add(tine); }
      fork.position.set(.02, .05, 0); fork.rotation.set(.5, .6, 0); this.foodG.add(fork); this.fork = fork; fork.visible = !!this.s.fork;
      this.spark = new THREE.PointLight(0x9fd8ff, 0, .3); this.spark.position.set(.02, .05, -.02); this.foodG.add(this.spark);
      this.glow = new THREE.PointLight(0xffd59a, 0, .6); this.glow.position.set(0, .17, 0); sc.add(this.glow);
      this.scene = sc; this.cam = { p: [.5, .62, .78], t: [.04, .05, 0] };
    },
    makeFood() {
      const R = this.s.R / 100; if (this.foodG) this.tt.remove(this.foodG);
      const g = new THREE.Group(); this.foodG = g; this.builtR = this.s.R;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(R + .012, R + .006, .008, 48), M(0xf2f2ef, { metalness: 0, roughness: .6 })); plate.position.y = .007; g.add(plate);
      const food = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .02, 48), [M(0xb86b3c, { metalness: 0, roughness: .8 }), new THREE.MeshStandardMaterial({ map: this.tex, roughness: .5 }), M(0x8a5a3c)]);
      food.position.y = .021; g.add(food); this.food = food;
      if (this.fork) g.add(this.fork); if (this.spark) g.add(this.spark);
      this.tt.add(g);
    },
    paint(T) {
      const r = this.r, N = MW.NP, x = this.canvas.getContext('2d'), img = x.createImageData(N, N), fd = r.fd;
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const u = -((py + .5) / N * 2 - 1) * r.R, v = ((px + .5) / N * 2 - 1) * r.R;  // cap UV: canvas x ↔ local Z, canvas y ↔ −local X
        const i = Math.floor((u + r.R) / r.dx), j = Math.floor((v + r.R) / r.dx), q = i >= 0 && j >= 0 && i < N && j < N ? r.idx[j * N + i] : -1;
        const o = (py * N + px) * 4; let c;
        if (q < 0) c = [240, 240, 236];
        else { const t = T[q];
          if (fd.melt) c = t >= fd.melt ? [150, 96, 62] : [86, 54, 38];
          else if (fd.Lf && t <= 0) c = [214, 232, 244];
          else { const a = Math.max(0, Math.min(1, t / 100)); c = a < .5 ? [42 + 380 * a, 133 + 140 * a, 192 - 300 * a] : [232, 203 - 250 * (a - .5), 42 + 10 * (a - .5)]; } }
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0); this.tex.needsUpdate = true;
    },
    frame(dt) {
      const r = this.r; if (!r || !this.tt) return;
      const T = this.s.time, show = 8;  // whole cook shown in 8 s, then 2 s hold, looped
      this.tp += dt * T / show; if (this.tp > T * 1.25) this.tp = 0;
      const tp = Math.min(this.tp, T), si = Math.round(tp / T * (r.snaps.length - 1));
      if (si !== this.si) { this.si = si; this.paint(r.snaps[si]); this.drawCharts(); }
      this.tt.rotation.y = this.s.turn ? -MW.OMEGA * tp : 0;
      const on = this.tp <= T && (tp % MW.CYCLE) < this.s.power / 100 * MW.CYCLE;
      this.glow.intensity = on ? 1.2 : 0;
      this.spark.intensity = on && this.s.fork ? 3 * Math.random() : 0;
      $('#caption').textContent = `t = ${fmt(tp)} s of ${T} s · magnetron ${on ? 'on' : 'off'} · shown ${fmt(T / show)}× faster`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      this.fieldPlane.visible = k === 'field';
      this.mag.children[0].material.emissive.setHex(k === 'mag' ? 0x553300 : 0);
      this.guide.material.emissive.setHex(k === 'guide' ? 0x333333 : 0);
    },
    extra() { $('#extra').innerHTML = ''; },
  };
  registerLab(lab);
})();
