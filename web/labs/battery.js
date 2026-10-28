// Battery lab: a Li-ion 18650 cell (Samsung INR18650-30Q class). Voltage sag, usable capacity and heat against C-rate and temperature.
// Pure physics in BatPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SOC = [0, .02, .05, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1];
  const OCV = [2.55, 3.0, 3.25, 3.42, 3.55, 3.62, 3.68, 3.74, 3.82, 3.9, 3.98, 4.07, 4.18];  // V, est. NCA/NMC shape
  const BP = {
    Q: 3.0, VMAX: 4.2, R0: .018, R1: .012, C1: 2500,       // Ah; V; ohm (est., datasheet AC impedance <= 26 mohm); RC tau 30 s (est.)
    MASS: .047, CP: 1000, AREA: .0042, ICHG: 4, IDIS: 15,  // kg (published 46-48 g); J/kg/K (est.); m2 can surface; A datasheet max charge / continuous discharge
    ocv(s) { s = clamp(s, 0, 1); let i = 0; while (i < SOC.length - 2 && s > SOC[i + 1]) i++; return OCV[i] + (OCV[i + 1] - OCV[i]) * (s - SOC[i]) / (SOC[i + 1] - SOC[i]); },
    rT: T => Math.exp(3200 * (1 / (T + 273.15) - 1 / 298.15)),  // resistance factor vs 25 C (Arrhenius, Ea/R = 3200 K, est.)
    capF: T => clamp(1 - .004 * Math.max(0, 25 - T), .7, 1),    // usable capacity factor in the cold (est.)
    rateF: C => 1 / (1 + .03 * Math.max(0, C - .2)),             // Peukert-like: charge that diffusion cannot reach at high rate (est.)
    // s = { mode: 0 discharge | 1 charge, C: C-rate, Tamb (C), h (W/m2/K cooling), soc0, cut (V) }
    simulate(s) {
      const chg = s.mode === 1, I0 = s.C * BP.Q, dt = clamp(3600 / Math.max(s.C, .05) / 2500, .5, 15), tau = BP.R1 * BP.C1;
      let soc = chg ? s.soc0 : s.soc0, T = s.Tamb, vrc = 0, t = 0, q = 0, E = 0, H = 0, I = chg ? -I0 : I0, cv = false, Tmax = T, V = BP.ocv(soc);
      const hA = s.h * BP.AREA, pts = [], every = Math.max(1, Math.round(3600 / Math.max(s.C, .05) / dt / 300));
      let n = 0, V0 = null, end = 'time';
      while (t < 30 * 3600) {
        const f = BP.rT(T);
        if (chg && cv) { I = Math.min(0, (BP.ocv(soc) - vrc - BP.VMAX) / (BP.R0 * f)); if (-I < .05 * BP.Q) { end = 'full'; break; } }
        const e = Math.exp(-dt / (tau * f));
        vrc = vrc * e + I * BP.R1 * f * (1 - e);
        V = BP.ocv(soc) - I * BP.R0 * f - vrc;
        if (V0 === null) V0 = V;
        if (!chg && V <= s.cut) { end = 'cutoff'; break; }
        if (!chg && soc <= 0) { end = 'empty'; break; }
        if (chg && !cv && V >= BP.VMAX) { cv = true; continue; }
        if (chg && soc >= 1) { end = 'full'; break; }
        const heat = I * I * BP.R0 * f + vrc * vrc / (BP.R1 * f);
        T += (heat - hA * (T - s.Tamb)) / (BP.MASS * BP.CP) * dt;
        soc -= I * dt / 3600 / (BP.Q * BP.capF(T) * (chg ? 1 : BP.rateF(s.C)));
        t += dt; q += Math.abs(I) * dt / 3.6; E += Math.abs(V * I) * dt / 3600; H += heat * dt / 3600; Tmax = Math.max(Tmax, T);
        if (n++ % every === 0) pts.push([t, q, V, T, heat, Math.abs(V * I), soc, Math.abs(I)]);
      }
      pts.push([t, q, V, T, 0, 0, soc, 0]);
      const plating = chg && s.Tamb < 10 && s.C > .5, overI = chg ? I0 > BP.ICHG + 1e-9 : I0 > BP.IDIS + 1e-9;
      return { s, pts, t, mAh: q, Wh: E, heatWh: H, eff: chg ? E / (E + H) : E / (E + H), Tmax, V0, sag: (BP.ocv(s.soc0) - V0) * 1000, I: I0, end,
        avgV: q > 0 ? E / (q / 1000) : V, plating, overI, deep: !chg && s.cut < 2.5, hot: Tmax > 60 };
    },
  };
  G.BatPhys = BP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const WEDGE0 = 1.43, WEDGE = Math.PI * 1.5;  // cutaway: open quarter faces the camera
  const lab = {
    id: 'battery', tab: 'Battery',
    charts: ['Voltage against charge', 'The cell voltage as charge flows. Thin lines: 0.2 C, 1 C and 3.3 C at the same temperature. Green dashed: the optimal preset.',
      'Cell temperature and heat', 'Solid: cell temperature (left axis). Dashed: heat made inside the cell (right axis, W).'],
    eyebrow: 'Lab 13 · Li-ion cell: voltage sag and heat', concept: 'A battery is a pump for charge, with a small resistor inside',
    text: 'Lithium ions shuttle between two coated foils through a thin separator. Electrons take the long way, through your device. The cell has a small internal resistance. More current means more voltage lost inside and more heat: the loss grows with the square of the current. Cold makes the resistance much higher.',
    home: 'Your phone dies early in the snow, and a fast charger makes it warm. Both come from the same small resistance inside the cell.',
    s: { mode: 0, C: 1, Tamb: 25, h: 10, soc0: 1, cut: 2.5 },
    sliders: [
      { k: 'mode', label: 'Direction', min: 0, max: 1, step: 1, fmt: v => v ? 'Charge' : 'Discharge' },
      { k: 'C', label: 'Current (C-rate)', min: .1, max: 5, step: .1, fmt: v => `${v.toFixed(1)} C · ${(v * BP.Q).toFixed(1)} A` },
      { k: 'Tamb', label: 'Air temperature', min: -20, max: 45, step: 1, unit: '°C' },
      { k: 'h', label: 'Cooling (still air → fan)', min: 5, max: 60, step: 1, unit: 'W/m²K', hint: 'About 10 in still air, 30–60 with a fan or a metal holder (est.).' },
      { k: 'soc0', label: 'Start state of charge', min: 0, max: 1, step: .05, fmt: v => Math.round(v * 100) + ' %' },
      { k: 'cut', label: 'Discharge cut-off voltage', min: 2, max: 3.3, step: .05, fmt: v => v.toFixed(2) + ' V', hint: 'The datasheet minimum is 2.5 V.' },
    ],
    presets: [
      { n: 'Gentle 0.2 C at 25 °C', kind: 'opt', s: { mode: 0, C: .2, Tamb: 25, h: 10, soc0: 1, cut: 2.5 }, note: 'A slow drain at room temperature. Almost no voltage is lost inside, the cell stays cool, and you get the full rated 3000 mAh.' },
      { n: 'E-bike pack, 1 C', kind: 'typ', s: { mode: 0, C: 1, Tamb: 25, h: 10, soc0: 1, cut: 2.5 }, note: 'One hour to empty. The voltage sits about 0.1 V lower and the cell warms a few degrees.' },
      { n: 'Power drill, 10 A', kind: 'edge', s: { mode: 0, C: 3.3, Tamb: 25, h: 10, soc0: 1, cut: 2.5 }, note: 'A high drain. The voltage sags at once, and still air cannot remove the heat, so the cell gets hot.' },
      { n: 'Cold morning, −10 °C', kind: 'edge', s: { mode: 0, C: 1, Tamb: -10, h: 10, soc0: 1, cut: 2.5 }, note: 'The internal resistance is about 4 times higher. The voltage hits the cut-off early, so less charge comes out, until the cell warms itself.' },
      { n: 'Fast charge, 2 C', kind: 'edge', s: { mode: 1, C: 2, Tamb: 25, h: 10, soc0: .1, cut: 2.5 }, note: '6 A is above the 4 A datasheet charge limit. The cell heats fast and reaches the 4.2 V limit early, so the charger must slow down.' },
    ],
    missions: [
      { t: 'Hard work, cool cell', d: 'Discharge at 2 C or more. Get 2800 mAh or more and keep the cell below 50 °C.', win: 'Done. Heat made inside grows with current squared. Cooling decides how hot the cell gets.',
        check: r => r.s.mode === 0 && r.s.C >= 2 && r.mAh >= 2800 && r.Tmax < 50 },
      { t: 'Winter rescue', d: 'In air at −10 °C or colder, get 2400 mAh or more out of the cell with the 2.5 V cut-off.', win: 'Done. In the cold, a moderate current warms the cell from the inside, so its resistance falls. Insulation helps too. A very slow drain stays cold.',
        check: r => r.s.mode === 0 && r.s.Tamb <= -10 && r.s.cut >= 2.5 && r.mAh >= 2400 },
      { t: 'Fast but safe charge', d: 'Charge from 10 % or less to full in 60 min or less. Stay at or below the 4 A limit and below 40 °C, in air of 10 °C or warmer.', win: 'Done. Fast charging is a trade: current against heat. Chargers slow down near full and when the cell is cold.',
        check: r => r.s.mode === 1 && r.s.soc0 <= .1 && r.t <= 3600 && !r.overI && r.Tmax < 40 && r.s.Tamb >= 10 && r.end === 'full' },
    ],
    chipsList: [{ k: 'roll', l: 'Jelly roll', c: '#7d6b5d' }, { k: 'ions', l: 'Lithium ions', c: '#e0b55a' }, { k: 'load', l: 'Circuit', c: '#2f7d73' }],
    partInfo: {
      roll: 'Jelly roll: a long sandwich of copper foil with graphite, a plastic separator and aluminium foil with metal oxide, wound into a spiral. About 60 cm of each foil fit in this 18650 can.',
      ions: 'Lithium ions: on discharge they leave the graphite and move through the liquid electrolyte into the oxide. Each ion that moves inside matches one electron that moves outside, through your device.',
      load: 'Circuit: electrons flow from the negative end, through the load, to the positive cap. Power = voltage × current. The voltage drop inside the cell is lost as heat.',
    },
    decor: { u: 10, y: 0, items: [['slab', [1.1, .6], 0, 0], ['wall', [1.6, .9, 0xeadfcd], .32, 0, -.02], ['books', [], .2, -.3], ['mug', [0xc8734f], .12, .3], ['plant', [.6], .2, .42], ['frame', [0x8fae8b], .3, -.12, .32], ['clock', [], .3, .22, .55]] },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const H = .65, R = .09, cell = new THREE.Group(); sc.add(cell); this.cell = cell;
      const open = (r, h, m, y = H / 2) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true, WEDGE0, WEDGE), m); c.position.y = y; m.side = THREE.DoubleSide; cell.add(c); return c; };
      this.wrap = open(R, H - .02, M(0xe58fa6, { roughness: .6, metalness: 0 }));
      this.can = open(R * .975, H - .01, M(0xb8c0c6, { metalness: .8, roughness: .3 }));
      this.layers = [];
      for (let i = 0; i < 9; i++) {
        const r = .016 + i * .0075, kind = i % 3, col = [0x3a3d40, 0xf2efe8, 0x8a6f5e][kind];
        this.layers.push(open(r, H - .08, M(col, { roughness: .7, metalness: kind === 2 ? .3 : .1 }))); this.layers[i].kind = kind;
      }
      const mandrel = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, H - .06, 16), M(0x9aa5ae)); mandrel.position.y = H / 2; cell.add(mandrel);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .025, 32), M(0xd5dce1, { metalness: .8, roughness: .25 })); cap.position.y = H + .005; cell.add(cap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .008, 8, 40), M(0x3d3833)); ring.rotation.x = Math.PI / 2; ring.position.y = H - .005; cell.add(ring);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R * .975, R * .975, .01, 48), M(0xb8c0c6, { metalness: .8, roughness: .3 })); base.position.y = .005; cell.add(base);
      // external circuit: cap -> load -> base
      const wire = [V3(0, H + .02, 0), V3(0, H + .14, 0), V3(.42, H + .14, 0), V3(.42, .42, 0), V3(.42, .22, 0), V3(.42, .03, 0), V3(.1, .03, 0)];
      this.curve = new THREE.CatmullRomCurve3(wire, false, 'catmullrom', .02);
      sc.add(new THREE.Mesh(new THREE.TubeGeometry(this.curve, 80, .008, 6), M(0x3d3833, { roughness: .6, metalness: .2 })));
      this.bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0, roughness: .3 })); this.bulb.position.set(.42, .36, 0); sc.add(this.bulb);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .05, 16), M(0x9aa5ae, { metalness: .6 })); sock.position.set(.42, .29, 0); sc.add(sock);
      this.charger = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .1), M(0x2f7d73, { roughness: .5 })); this.charger.position.set(.42, .36, 0); sc.add(this.charger);
      this.light = new THREE.PointLight(0xffd59a, 0, 1.2); this.light.position.copy(this.bulb.position); sc.add(this.light);
      this.eN = 40; this.elec = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3f86b0 }), this.eN); sc.add(this.elec);
      this.iN = 70; this.ions = new THREE.InstancedMesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe0b55a }), this.iN); cell.add(this.ions);
      this.ionSeed = [...Array(this.iN)].map(() => ({ k: Math.floor(Math.random() * 3), a: WEDGE0 + WEDGE + Math.random() * (Math.PI * 2 - WEDGE), y: .08 + Math.random() * (H - .16), ph: Math.random() }));
      this.scene = sc; this.cam = { p: [1.15, .95, 1.55], t: [.14, .36, 0] };
      this.u = 0; this.eu = 0;
    },
    update() {
      const r = this.r = BP.simulate(this.s);
      this.refs = [.2, 1, 3.3].map(c => BP.simulate(Object.assign({}, this.s, { mode: 0, C: c, soc0: 1, cut: 2.5 })));
      const chg = this.s.mode === 1, mins = r.t / 60;
      tiles([
        { l: chg ? 'Charge stored' : 'Charge delivered', v: fmt(r.mAh), u: 'mAh', e: `${fmt(r.mAh / 30)} % of rated 3000`, cls: !chg && r.mAh < 2600 ? 'warn' : '' },
        { l: chg ? 'Energy in' : 'Energy out', v: fmt(r.Wh, 2), u: 'Wh', e: `average ${fmt(r.avgV, 2)} V` },
        { l: chg ? 'Charge time' : 'Run time', v: mins < 120 ? fmt(mins) : fmt(mins / 60, 1), u: mins < 120 ? 'min' : 'h', e: { cutoff: 'stops at the cut-off', empty: 'cell empty', full: 'cell full', time: 'time limit' }[r.end] },
        { l: 'Current', v: fmt(r.I, 1), u: 'A', e: r.overI ? (chg ? 'above 4 A charge limit' : 'above 15 A limit') : `${fmt(this.s.C, 1)} C`, cls: r.overI ? 'bad' : '' },
        { l: 'Voltage lost inside', v: fmt(Math.abs(r.sag)), u: 'mV', e: 'at the start (I × R)' },
        { l: 'Peak temperature', v: fmt(r.Tmax, 1), u: '°C', cls: r.Tmax > 60 ? 'bad' : r.Tmax > 45 ? 'warn' : '', e: chg ? 'charge limit 50 °C' : 'discharge limit 75 °C' },
        { l: 'Heat made', v: fmt(r.heatWh, 2), u: 'Wh', e: `${fmt(100 - r.eff * 100, 1)} % of the energy` },
        { l: 'Warnings', v: r.plating ? 'Plating' : r.deep ? 'Deep' : r.overI ? 'Over-current' : r.hot ? 'Hot' : 'None', e: r.plating ? 'cold fast charge: lithium plating risk' : r.deep ? 'below 2.5 V: copper dissolves' : '', cls: r.plating || r.deep || r.overI || r.hot ? 'bad' : 'good' },
      ]);
      $('#alarm').hidden = !(r.plating || r.hot || r.deep); $('#alarm').textContent = r.plating ? 'Lithium plating risk' : r.hot ? 'Cell too hot' : 'Over-discharge';
      if (this.bulb) { this.bulb.visible = !chg; this.charger.visible = chg; }
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, s = this.s, chg = s.mode === 1, g = BP.simulate(optOf(this)), xmax = 3200;
      const vc = p => p.map(q => [Math.min(q[1], xmax), q[2]]);
      this.c1 = chart($('#c1'), { x: [0, xmax], y: [2, 4.4], xt: [0, 500, 1000, 1500, 2000, 2500, 3000], yt: [2, 2.5, 3, 3.5, 4, 4.2], xlab: chg ? 'Charge put in (mAh)' : 'Charge taken out (mAh)', ylab: 'Cell voltage (V)',
        body: (X, Y) => `<line class="s-bad" x1="${X(0)}" x2="${X(xmax)}" y1="${Y(s.cut)}" y2="${Y(s.cut)}"/><text class="lbl-bad" x="${X(xmax) - 4}" y="${Y(s.cut) - 4}" text-anchor="end">cut-off ${s.cut.toFixed(2)} V</text>` +
          (chg ? '' : this.refs.map((q, i) => `<path class="s-mut" style="opacity:.45;stroke-width:1" d="${path(vc(q.pts), X, Y)}"/><text x="${X(600 + i * 450)}" y="${Y((q.pts.find(z => z[1] >= 600 + i * 450) || q.pts[0])[2]) + 13}" text-anchor="middle">${['0.2 C', '1 C', '3.3 C'][i]}</text>`).join('')) +
          `<path class="ghost" d="${path(vc(g.pts), X, Y)}"/><path class="s-acc" d="${path(vc(r.pts), X, Y)}"/>` });
      const tmax = Math.max(1, r.t / 60), Tlo = Math.floor(Math.min(s.Tamb, ...r.pts.map(q => q[3])) / 5) * 5 - 5, Thi = Math.max(Tlo + 20, Math.ceil(r.Tmax / 5) * 5 + 5);
      const wmax = Math.max(.5, ...r.pts.map(q => q[4])) * 1.1, W = w => Tlo + w / wmax * (Thi - Tlo);
      this.c2 = chart($('#c2'), { x: [0, tmax], y: [Tlo, Thi], xlab: 'Time (min)', ylab: 'Cell temperature (°C)',
        body: (X, Y) => (Thi > 60 ? `<rect class="f-bad" x="${X(0)}" y="${Y(Thi)}" width="${X(tmax) - X(0)}" height="${Y(Math.max(60, Tlo)) - Y(Thi)}"/><text class="lbl-bad" x="${X(0) + 4}" y="${Y(Thi) + 12}">above 60 °C</text>` : '') +
          `<path class="s-hot dash" d="${path(r.pts.map(q => [q[0] / 60, W(q[4])]), X, Y)}"/><path class="s-acc" d="${path(r.pts.map(q => [q[0] / 60, q[3]]), X, Y)}"/>` +
          [0, .5, 1].map(f => `<text x="${X(tmax) - 3}" y="${Y(W(wmax / 1.1 * f)) - 3}" text-anchor="end" class="lbl-acc">${(wmax / 1.1 * f).toFixed(1)} W</text>`).join('') });
    },
    frame(dt) {
      const r = this.r; if (!r || !this.cell) return;
      this.u = (this.u + dt / 12) % 1;  // one full run every 12 s
      const pts = r.pts, i = Math.min(pts.length - 1, Math.floor(this.u * pts.length)), q = pts[i], chg = this.s.mode === 1;
      moveDot(this.c1, Math.min(q[1], 3200), q[2]); moveDot(this.c2, q[0] / 60, q[3]);
      const warm = Math.max(0, Math.min(1, (q[3] - 25) / 40)), cold = Math.max(0, Math.min(1, (10 - q[3]) / 30));
      [this.wrap, this.can].forEach(m => m.material.emissive.setRGB(.6 * warm, .12 * warm, .25 * cold));
      const p = q[5], pr = Math.min(1, p / 40);
      this.bulb.material.emissive.setRGB(pr, pr * .85, pr * .55); this.light.intensity = chg ? 0 : pr * 1.5;
      const amps = q[7], m = new THREE.Matrix4();
      this.eu = (this.eu + dt * amps * .03 * (chg ? -1 : 1) + 1) % 1;
      for (let k = 0; k < this.eN; k++) { const u = ((this.eu + k / this.eN) % 1 + 1) % 1; m.makeTranslation(...this.curve.getPointAt(u).toArray()); this.elec.setMatrixAt(k, m); }
      this.elec.instanceMatrix.needsUpdate = true;
      this.ionSeed.forEach((o, k) => {
        o.ph = (o.ph + dt * amps * .08 * (chg ? -1 : 1) + 1) % 1;
        const r0 = .016 + (o.k * 3) * .0075, r1 = r0 + .015, rr = r0 + (r1 - r0) * o.ph;
        m.makeTranslation(rr * Math.sin(o.a), o.y, rr * Math.cos(o.a)); this.ions.setMatrixAt(k, m);
      });
      this.ions.instanceMatrix.needsUpdate = true;
      $('#caption').textContent = `${fmt(q[0] / 60)} min · ${fmt(q[2], 2)} V · ${fmt(amps, 1)} A · ${fmt(q[3], 1)} °C · state of charge ${fmt(q[6] * 100)} % · replay 12 s`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      this.layers.forEach(l => l.material.emissive.setHex(k === 'roll' ? 0x333322 : 0));
      this.ions.scale.setScalar(k === 'ions' ? 1.8 : 1);
      this.elec.scale.setScalar(1); this.elec.material.color.setHex(k === 'load' ? 0x1f5f8a : 0x3f86b0);
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Cell data: Samsung INR18650-30Q, 3000 mAh rated, 4.20 V charge, 2.5 V cut-off, 4 A max charge, 15 A continuous, AC impedance ≤ 26 mΩ at 1 kHz, mass about 47 g. Sources: https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/196/samsung_5F00_30q_5F00_data_5F00_sheet.pdf and https://www.18650batterystore.com/en-gb/products/samsung-30q (published).',
      'Model: open-circuit voltage OCV(SoC) table (shape est. for NCA/NMC), series resistance R0 = 18 mΩ and one RC pair (R1 = 12 mΩ, τ = 30 s) (est.). Charge is constant current, then constant voltage at 4.2 V until the current falls to C/20.',
      'Rate: usable charge × 1/(1 + 0.03·(C − 0.2)) for diffusion limits (est., Peukert-like). Temperature: resistance × exp(3200·(1/T − 1/298)) (est., about 4× at −10 °C); usable capacity falls 0.4 %/K below 25 °C (est.). Heat = I²R0 + V_RC²/R1; cooling h·A with A = 42 cm² of can surface; heat capacity 47 J/K (est.).',
      'Check: the model gives about 3000 mAh at 0.2 C and about 2900 mAh at 3.3 C (10 A) at 25 °C. Published 10 A tests give 2700–2900 mAh depending on the cell revision (lygte-info.dk, endless-sphere).',
      'Ignored: ageing, the entropic heat term, temperature gradients inside the cell, and the self-heating of the tabs.',
    ],
  };
  registerLab(lab);
})(globalThis);
