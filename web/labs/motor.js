// Electric motor lab: a brushed permanent-magnet DC motor (550 size, the kind in cordless drills, fans and toys).
// Pure physics in MotorPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const MP = {
    // 12 V "550-size" brushed DC motor, est. from typical catalogue values (no-load ~19 700 rpm, stall ~0.28 N m / 48 A at 12 V)
    R0: 0.25,      // ohm, winding + brush resistance at 20 C, est.
    KT: 0.0058,    // N m/A = V s/rad (Kt = Ke in SI units)
    TF: 0.004,     // N m, brush and bearing friction, est.
    B: 1.2e-6,     // N m s/rad, viscous loss (fan cooling, windage), est.
    ALPHA: 0.0039, // 1/K, copper resistance rise
    RTH: 1.5,      // K/W, winding to air with the built-in fan, est.
    TAMB: 25, TMAX: 130, VMAX: 18,
    FAN: 6e-8,     // N m s2, fan torque coefficient at 100 % (T = c w^2)
    DRILL: 0.3,    // N m, drill torque at 100 %
    LOADS: ['Fan blade', 'Drill bit', 'No load'],
    load(s, w) { return s.load === 0 ? s.amt / 100 * MP.FAN * w * w : s.load === 1 ? s.amt / 100 * MP.DRILL : 0; },
    res: Tw => MP.R0 * (1 + MP.ALPHA * (Tw - 20)),
    // motor speed (rad/s) at shaft torque T, from Kt (V - Kt w)/R - Tf - B w = T
    line: (V, R, T) => Math.max(0, (MP.KT * V / R - MP.TF - T) / (MP.KT * MP.KT / R + MP.B)),
    at(s, Tw) {
      const R = MP.res(Tw), f = w => MP.KT * (s.V - MP.KT * w) / R - MP.TF - MP.B * w - MP.load(s, w);
      let w = 0;
      if (f(0) > 0) { let lo = 0, hi = s.V / MP.KT; for (let n = 0; n < 60; n++) { const m = (lo + hi) / 2; f(m) > 0 ? lo = m : hi = m; } w = (lo + hi) / 2; }
      return { R, w, i: (s.V - MP.KT * w) / R };
    },
    solve(s) {
      let Tw = MP.TAMB + 20, o = MP.at(s, Tw);
      for (let k = 0; k < 60; k++) {  // steady winding temperature: heat i^2 R raises R, which changes the current
        o = MP.at(s, Tw); const nt = Math.min(400, MP.TAMB + o.i * o.i * o.R * MP.RTH);
        if (Math.abs(nt - Tw) < .02) { Tw = nt; break; } Tw = .5 * Tw + .5 * nt;
      }
      const { R, w, i } = o, Tl = MP.load(s, w), Pin = s.V * i, Pout = Tl * w;
      const Tstall = MP.KT * s.V / R - MP.TF, best = MP.best(s.V, R), Tmp = Tstall / 2;
      return { s, w, rpm: w * 30 / Math.PI, i, R, Tl, Tm: MP.KT * i, Pin, Pout, heat: i * i * R, eta: Pin > 0 ? Pout / Pin : 0, Tw, burn: Tw > MP.TMAX, stall: w < 1,
        rpm0: MP.line(s.V, R, 0) * 30 / Math.PI, Tstall, Is: s.V / R, best, Pmax: Tmp * MP.line(s.V, R, Tmp) };
    },
    // highest efficiency on the motor line at voltage V and resistance R
    best(V, R) {
      let b = { eta: 0, T: 0 };
      const Ts = MP.KT * V / R - MP.TF;
      for (let k = 1; k < 400; k++) { const T = Ts * k / 400, w = MP.line(V, R, T), i = (V - MP.KT * w) / R, e = T * w / (V * i); if (e > b.eta) b = { eta: e, T, w, i }; }
      return b;
    },
    // efficiency at torque T and speed w with a cold winding; null if it needs more than VMAX
    map(T, w) { const i = (T + MP.TF + MP.B * w) / MP.KT, V = i * MP.R0 + MP.KT * w; return V > MP.VMAX ? null : T * w / (V * i); },
  };
  G.MotorPhys = MP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const motor = {
    id: 'motor', tab: 'Electric motor',
    charts: ['Speed against torque', 'The straight line is the motor. The curve is the load. They meet at the operating point. Green dashed: optimal preset.',
      'Efficiency map', 'Darker = more efficient. The motor line crosses the map; the dot is where it runs now. The best point is at low torque, not at full power.'],
    eyebrow: 'Lab 7 · Motor torque, back-EMF and efficiency', concept: 'A motor slows down until its back-voltage lets just enough current through',
    text: 'Current in the coils feels a force in the magnet field (torque = Kt × current). As the rotor spins, the coils also make a back-voltage that opposes the battery (E = Ke × speed). More load slows the rotor, the back-voltage falls, and more current flows. That is why a stalled motor draws huge current and gets hot.',
    home: 'A drill that stalls in hard wood draws its full stall current and heats up fast. Let it spin: a motor is most efficient at light load and high speed.',
    s: { V: 12, load: 0, amt: 50 },
    sliders: [
      { k: 'V', label: 'Battery voltage', min: 3, max: 18, step: .5, unit: 'V' },
      { k: 'load', label: 'Load on the shaft', min: 0, max: 2, step: 1, fmt: v => MP.LOADS[v] },
      { k: 'amt', label: 'Load size', min: 0, max: 100, step: 1, unit: '%', hint: 'Fan: blade size. Drill: torque, 100 % = 0.30 N·m (more than the motor can give at 12 V).' },
    ],
    presets: [
      { n: 'Best efficiency drill', kind: 'opt', s: { V: 12, load: 1, amt: 11 }, note: 'A light drilling load of about 0.033 N·m. The motor runs fast and draws only about 7 A, so copper loss is small. Efficiency is at its peak, about 71 %.' },
      { n: 'Desk fan', kind: 'typ', s: { V: 12, load: 0, amt: 50 }, note: 'A medium fan. The fan torque grows with speed squared, so the motor settles where its line meets the fan curve.' },
      { n: 'Stalled drill bit', kind: 'edge', s: { V: 12, load: 1, amt: 100 }, note: 'The bit jams. Speed is zero, so there is no back-voltage. A cold winding draws V / R = 48 A. All the input power becomes heat, and the winding goes far past its 130 °C limit.' },
      { n: 'Overvolted, no load', kind: 'edge', s: { V: 18, load: 2, amt: 0 }, note: 'No load and 18 V: the rotor runs near 29 000 rpm. Current is small, but brushes and bearings wear fast at this speed.' },
      { n: 'Big fan on a weak battery', kind: 'edge', s: { V: 6, load: 0, amt: 100 }, note: 'A large fan on 6 V turns at only about 7 000 rpm and moves much less air. Efficiency falls to about 62 %, because the current is high for the speed.' },
    ],
    missions: [
      { t: 'The sweet spot', d: 'Use the drill load at 9 V or less. Find the load size that gives the highest efficiency at that voltage.', win: 'Done. Peak efficiency is at a low torque, where the current is the geometric mean of the no-load and stall currents.',
        check: r => r.s.load === 1 && r.s.V <= 9 && !r.stall && r.eta >= r.best.eta - .005 },
      { t: 'Peak power, safely', d: 'Use the drill load. Get within 3 % of the maximum output power at your voltage, with the winding below 130 °C.', win: 'Done. Maximum power is at half the stall torque. It is hot, so it needs a lower voltage.',
        check: r => r.s.load === 1 && Math.abs(r.Pout - r.Pmax) / r.Pmax < .03 && !r.burn },
      { t: 'Fast but cool fan', d: 'Use the fan at 80 % size or more. Reach 9 000 rpm or more with the winding below 100 °C.', win: 'Done. Fan load grows with speed squared, so a small voltage change makes a big change in heat.',
        check: r => r.s.load === 0 && r.s.amt >= 80 && r.rpm >= 9000 && r.Tw < 100 },
    ],
    chipsList: [{ k: 'magnets', l: 'Magnets', c: '#c2453a' }, { k: 'coils', l: 'Coils', c: '#c87533' }, { k: 'brushes', l: 'Commutator', c: '#3d3833' }, { k: 'load', l: 'Load', c: '#2f7d73' }],
    partInfo: {
      magnets: 'Magnets: two curved permanent magnets, one north and one south, make a steady field across the rotor. The arrows show its direction.',
      coils: 'Coils: copper windings on the iron arms of the rotor. Current in the field makes the twisting force. The coils turn red when they get hot.',
      brushes: 'Commutator and brushes: carbon brushes press on a split copper ring. Each half turn they reverse the current in the coils, so the torque always pushes the same way. The sparks are real.',
      load: 'Load: the fan torque rises with speed squared; the drill torque stays the same at any speed. The motor speed settles where motor torque = load torque.',
    },
    decor: { u: 100, y: 0, items: [['slab', [1.1, .55], 0, 0], ['wall', [1.8, .9], .32, 0], ['frame', [0x7d9bb5], .3, .25, .45], ['books', [], .2, -.42], ['mug', [0xc8734f], .1, .38], ['plant', [.6], .22, .5]] },
    build() {
      const sc = new THREE.Scene(); lights(sc);  // units: cm, motor axis along x, 5.5 cm above the bench
      const steel = M(0xa9b2b9, { metalness: .7, roughness: .35 }), copper = M(0xc87533, { metalness: .6, roughness: .35 }), iron = M(0x5b636a, { metalness: .5, roughness: .45 });
      const ax = new THREE.Group(); ax.position.y = 5.5; sc.add(ax); this.ax = ax;
      const cylX = (r1, r2, h, m, open, t0, tl) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 40, 1, !!open, t0 || 0, tl || Math.PI * 2), m); c.rotation.z = Math.PI / 2; return c; };
      const can = cylX(2.6, 2.6, 6, M(0xb7bec4, { metalness: .6, roughness: .4, side: THREE.DoubleSide }), true, .35 * Math.PI, 1.3 * Math.PI); can.rotation.x = -.6; ax.add(can); this.can = can;
      const cap = cylX(2.6, 2.6, .3, M(0x8a9198, { transparent: true, opacity: .35, depthWrite: false })); cap.position.x = 3.15; ax.add(cap);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3.2), M(0x6b6f72, { roughness: .7, metalness: .3 })); bracket.position.set(0, -4, 0); ax.add(bracket);
      this.mags = [[.12, 0xc2453a], [1.12, 0x3f86b0]].map(([t0, c]) => { const m = cylX(2.35, 2.35, 4.4, M(c, { roughness: .6, metalness: .1, side: THREE.DoubleSide }), true, t0 * Math.PI, .76 * Math.PI); m.rotation.x = -.6; ax.add(m); return m; });
      const field = new THREE.Group(); ax.add(field); this.field = field;
      for (let k = -2; k <= 2; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 10), M(0xe0b55a, { roughness: .6, metalness: 0 })); c.position.set(k * .9, 0, 2.05); c.rotation.z = Math.PI; field.add(c); }
      const rotor = new THREE.Group(); ax.add(rotor); this.rotor = rotor;
      const shaft = cylX(.25, .25, 13, steel); shaft.position.x = -1.5; rotor.add(shaft);
      this.coils = [];
      for (let k = 0; k < 3; k++) {
        const arm = new THREE.Group(); arm.rotation.x = k * 2 * Math.PI / 3; rotor.add(arm);
        const core = new THREE.Mesh(new THREE.BoxGeometry(4, 1.7, .5), iron); core.position.y = .95; arm.add(core);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(4, .25, 1.9), iron); shoe.position.y = 1.95; arm.add(shoe);
        const coil = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, .95), M(0xc87533, { metalness: .6, roughness: .35 })); coil.position.y = 1; arm.add(coil); this.coils.push(coil);
      }
      const comm = cylX(.65, .65, 1.1, copper); comm.position.x = 3.9; rotor.add(comm);
      for (let k = 0; k < 3; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.12, .08, .2), iron); sl.rotation.x = k * 2 * Math.PI / 3; sl.position.set(3.9, .62 * Math.cos(k * 2 * Math.PI / 3), .62 * Math.sin(k * 2 * Math.PI / 3)); rotor.add(sl); }
      this.brushes = [1, -1].map(d => { const b = new THREE.Mesh(new THREE.BoxGeometry(.6, .9, .6), M(0x3d3833, { roughness: .8, metalness: 0 })); b.position.set(3.9, d * 1.15, 0); ax.add(b);
        const sp = new THREE.Mesh(helixGeo(.18, 5, .04), steel); sp.scale.y = .8; sp.position.set(3.9, d * 1.95, 0); ax.add(sp); return b; });
      this.spark = new THREE.PointLight(0x9fd0ff, 0, 4); this.spark.position.set(3.9, 0, 1); ax.add(this.spark);
      // loads on the shaft end
      const fan = new THREE.Group(); fan.position.x = -7.4; rotor.add(fan); this.fan = fan;
      fan.add(cylX(.8, .8, 1, M(0x3d3833, { roughness: .7, metalness: .1 })));
      this.blades = [];
      for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(.12, 4, 1.6), M(0x2f7d73, { roughness: .6, metalness: 0 })); bl.position.y = 2.6; bl.rotation.y = .5;
        const g = new THREE.Group(); g.rotation.x = k * Math.PI / 2; g.add(bl); fan.add(g); this.blades.push(bl); }
      const drill = new THREE.Group(); drill.position.x = -7.2; rotor.add(drill); this.drill = drill;
      drill.add(cylX(.9, .7, 1.8, steel));
      const bit = cylX(.22, .22, 5, M(0x8a7b52, { metalness: .7, roughness: .3 })); bit.position.x = -3.2; drill.add(bit);
      const wood = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 6), M(0xb8875b, { roughness: .9, metalness: 0 })); wood.position.set(-14.3, 5.5, 0); sc.add(wood); this.wood = wood;
      this.scene = sc; this.cam = { p: [9, 10, 19], t: [-2.5, 5, 0] };
    },
    update() {
      const r = this.r = MP.solve(this.s);
      const hot = r.burn ? 'bad' : r.Tw > 100 ? 'warn' : '';
      tiles([
        { l: 'Speed', v: fmt(r.rpm), u: 'rpm', e: `no load ${fmt(r.rpm0)} rpm` },
        { l: 'Current', v: fmt(r.i, 1), u: 'A', e: `stall ${fmt(r.Is)} A`, cls: r.stall ? 'bad' : '' },
        { l: 'Torque', v: fmt(r.Tl, 3), u: 'N·m', e: `stall ${fmt(r.Tstall, 2)} N·m` },
        { l: 'Output power', v: fmt(r.Pout, 1), u: 'W', e: `max ${fmt(r.Pmax)} W at this voltage` },
        { l: 'Efficiency', v: fmt(r.eta * 100), u: '%', e: `best ${fmt(r.best.eta * 100)} % here`, cls: r.eta > r.best.eta - .03 ? 'good' : r.eta < .4 ? 'warn' : '' },
        { l: 'Heat in winding', v: fmt(r.heat, 1), u: 'W', e: `input ${fmt(r.Pin)} W` },
        { l: 'Winding temperature', v: fmt(r.Tw), u: '°C', e: r.burn ? 'insulation burns' : 'limit 130 °C', cls: hot },
      ]);
      $('#alarm').hidden = !(r.burn || r.stall); $('#alarm').textContent = r.stall ? 'Stalled: full current' : 'Winding overheats';
      if (this.fan) { this.fan.visible = this.s.load === 0; this.drill.visible = this.wood.visible = this.s.load === 1;
        const k = .4 + this.s.amt / 100 * .9; this.blades.forEach(b => b.scale.set(1, k, 1)); }
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, o = MP.solve(optOf(this)), s = this.s;
      const tmax = Math.max(r.Tstall, o.Tstall, .05) * 1.05, ymax = Math.ceil(Math.max(r.rpm0, o.rpm0) / 5000) * 5000;
      const lineOf = q => [[0, MP.line(q.s.V, q.R, 0) * 30 / Math.PI], [q.Tstall, 0]];
      let loadPath = '';
      if (s.load === 0) { const pts = []; for (let w = 0; w <= ymax * Math.PI / 30; w += ymax * Math.PI / 30 / 60) pts.push([MP.load(s, w), w * 30 / Math.PI]); loadPath = pts.filter(p => p[0] <= tmax); }
      else if (s.load === 1) loadPath = [[r.Tl, 0], [r.Tl, ymax]];
      this.c1 = chart($('#c1'), { x: [0, tmax], y: [0, ymax], xlab: 'Torque on the shaft (N·m)', ylab: 'Speed (rpm)',
        body: (X, Y) => `<path class="ghost" d="${path(lineOf(o), X, Y)}"/><circle class="ghost" r="4" cx="${X(o.Tl)}" cy="${Y(o.rpm)}"/>` +
          `<path class="s-acc" d="${path(lineOf(r), X, Y)}"/>` + (loadPath ? `<path class="s-hot" d="${path(loadPath, X, Y)}"/>` : '') +
          `<text class="lbl" x="${X(tmax * .03)}" y="${Y(r.rpm0) + 16}">no load ${fmt(r.rpm0)} rpm</text><text class="lbl-bad" x="${X(r.Tstall) - 4}" y="${Y(ymax * .06)}" text-anchor="end">stall</text>` +
          (loadPath ? `<text class="lbl" x="${X(tmax * .55)}" y="${Y(ymax * .92)}">${MP.LOADS[s.load].toLowerCase()} load</text>` : '') });
      moveDot(this.c1, r.Tl, r.rpm);
      const nx = 28, ny = 20, T1 = .32, W1 = 31000 * Math.PI / 30;
      let cells = '';
      this.c2 = chart($('#c2'), { x: [0, T1], y: [0, 31000], xlab: 'Torque (N·m)', ylab: 'Speed (rpm)',
        body: (X, Y) => {
          for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
            const T = (a + .5) / nx * T1, w = (b + .5) / ny * W1, e = MP.map(T, w);
            if (e === null || e <= 0) continue;
            cells += `<rect x="${X(a / nx * T1).toFixed(1)}" y="${Y((b + 1) / ny * 31000).toFixed(1)}" width="${(X(T1 / nx) - X(0) + .5).toFixed(1)}" height="${(Y(0) - Y(31000 / ny) + .5).toFixed(1)}" fill="var(--accent)" fill-opacity="${(e * e * .9).toFixed(2)}"/>`;
          }
          return cells + `<path class="s-ink dash" d="${path(lineOf(r).map(p => [Math.min(p[0], T1), p[1]]), X, Y)}"/><circle class="ghost" r="4" cx="${X(o.Tl)}" cy="${Y(o.rpm)}"/>` +
            `<text class="lbl" x="${X(T1 * .5)}" y="${Y(29000)}">above 18 V: out of reach</text>`;
        } });
      moveDot(this.c2, Math.min(r.Tl, T1), r.rpm);
    },
    frame(dt) {
      if (!this.r) return;
      const r = this.r, vis = Math.min(r.w, 3200) / 3200 * 4 * Math.PI;  // shown slowed: 30 000 rpm -> 2 turns per second
      this.rotor.rotation.x += vis * dt;
      const heat = Math.max(0, Math.min(1, (r.Tw - 60) / 100));
      this.coils.forEach(c => c.material.emissive.setRGB(heat * .7, heat * .12, 0));
      this.spark.intensity = r.w > 1 ? Math.min(3, r.i / 12) * Math.random() : 0;
      this.ax.position.x = r.stall && r.s.load === 1 ? (Math.random() - .5) * .08 : 0;
      $('#caption').textContent = `${fmt(r.rpm)} rpm · ${fmt(r.i, 1)} A · ${fmt(r.Tw)} °C · shown ${fmt(Math.max(1, r.w / Math.max(vis, .01)))}× slower`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      const em = (list, on) => list.forEach(m => m.material.emissive && m.material.emissive.setHex(on ? 0x443300 : 0));
      em(this.mags, k === 'magnets'); em(this.brushes, k === 'brushes'); em(this.blades, k === 'load');
      this.field.visible = true; this.field.scale.setScalar(k === 'magnets' ? 1.5 : 1);
      if (k === 'coils') this.coils.forEach(c => c.material.emissive.setHex(0x443300));
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Brushed DC motor: V = i·R + Ke·ω and T = Kt·i, with Kt = Ke = 0.0058 N·m/A (SI units make them equal). Inductance is ignored, so this is the steady state.',
      'Motor constants are estimates for a typical 12 V "550-size" motor (no-load ≈ 19 700 rpm, stall ≈ 0.28 N·m and 48 A at 12 V). Check against the datasheet of your motor.',
      'Friction 0.004 N·m plus 1.2·10⁻⁶ N·m·s/rad viscous loss (est.). Winding resistance rises 0.39 %/K; winding-to-air thermal resistance 1.5 K/W (est.). Steady-state temperature only, no time to heat up.',
      'Peak efficiency is at current √(I₀·I_stall); maximum power is at half the stall torque. Both are standard results for a linear DC motor.',
      'Fan torque c·ω² with c = 6·10⁻⁸ N·m·s² at 100 % (est.). Drill torque constant, 0.30 N·m at 100 % (est.).',
    ],
  };
  registerLab(motor);
})(globalThis);
