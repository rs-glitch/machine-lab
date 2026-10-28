// Water pump lab: a small centrifugal pump lifting water from a well to a garden tank.
// Pure physics in PumpPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const PP = {
    // small 0.5 kW garden pump at 2850 rpm, est.: shut-off head 40 m, run-out flow 4.6 m3/h
    N0: 2850, H0: 40, QMAX: 4.6, P0: 250, KP: 56,  // shaft power P = P0 + KP*Q at N0 (W, Q in m3/h), est.
    ETAM: .75, RHO: 998, G: 9.81, L: 25, F: .025, KFIT: 3, KSUC: 1.5,  // motor eff.; delivery pipe m; friction factor; fitting losses (est.)
    r: N => N / PP.N0,
    head: (Q, N) => PP.H0 * PP.r(N) ** 2 - PP.H0 / PP.QMAX ** 2 * Q * Q,           // affinity: H0 ~ N^2, run-out flow ~ N
    shaft: (Q, N) => PP.P0 * PP.r(N) ** 3 + PP.KP * Q * PP.r(N) ** 2,               // affinity: P ~ N^3 at similar points
    hyd: (Q, H) => PP.RHO * PP.G * Q / 3600 * Math.max(H, 0),
    eta: (Q, N) => PP.hyd(Q, PP.head(Q, N)) / PP.shaft(Q, N),
    qbep: N => PP.QBEP0 * PP.r(N),
    npshr: (Q, N) => PP.r(N) ** 2 * (.8 + 1.6 * (Q / PP.qbep(N)) ** 2),             // m, est.
    pv: T => .61094 * Math.exp(17.625 * T / (T + 243.04)),                          // kPa, Magnus formula for water vapour
    area: d => Math.PI * (d / 1000) ** 2 / 4,
    coef: (k, d) => k / (2 * PP.G * PP.area(d) ** 2) / 3600 ** 2,                   // m per (m3/h)^2 for a loss factor k
    sysC(s) { const kv = 2 / Math.max(.05, s.valve / 100) ** 2 - 2; return PP.coef(PP.F * PP.L / (s.dia / 1000) + PP.KFIT + kv, s.dia); },
    sucC: s => PP.coef(PP.F * (s.lift + 1) / (s.dia / 1000) + PP.KSUC, s.dia),
    npsha: (s, Q) => (101.325 - PP.pv(s.temp)) * 1000 / (PP.RHO * PP.G) - s.lift - PP.sucC(s) * Q * Q,
    solve(s) {
      const N = s.rpm, Hs = s.height + s.lift, C = PP.sysC(s), Cs = PP.sucC(s);
      const num = PP.H0 * PP.r(N) ** 2 - Hs, Q = num > 0 ? Math.sqrt(num / (PP.H0 / PP.QMAX ** 2 + C + Cs)) : 0;
      const H = Math.max(0, PP.head(Q, N)), Psh = PP.shaft(Q, N), Ph = PP.hyd(Q, H), Pel = Psh / PP.ETAM;
      const na = PP.npsha(s, Q), nr = PP.npshr(Q, N), qb = PP.qbep(N);
      const useful = PP.hyd(Q, Hs) / Pel;  // share of electric power that lifts water (the rest: motor, pump, pipe and valve losses)
      return { s, Q, Lmin: Q * 1000 / 60, H, Hs, C: C + Cs, Psh, Ph, Pel, useful, eta: Psh > 0 ? Ph / Psh : 0, loss: Psh - Ph, qb, bep: Q / qb,
        na, nr, margin: na - nr, cav: Q > 0 && na < nr, dead: Q < 1e-6, whm3: Q > 0 ? Pel / Q : Infinity };
    },
  };
  { let b = 0, q = 0; for (let Q = .01; Q < PP.QMAX; Q += .005) { const e = PP.eta(Q, PP.N0); if (e > b) { b = e; q = Q; } } PP.QBEP0 = q; PP.ETABEP = b; }
  G.PumpPhys = PP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const pump = {
    id: 'pump', tab: 'Water pump',
    charts: ['Pump curve meets system curve', 'The pump gives less head as flow rises; the pipes need more head as flow rises. They cross at the operating point. Green dashed: optimal preset.',
      'Cavitation check (NPSH)', 'Pressure at the pump inlet (blue) must stay above what the pump needs (red). Where red is higher, the water boils inside the pump.'],
    eyebrow: 'Lab 8 · Pump and system curves', concept: 'A pump does not choose its flow: the pipes do',
    text: 'The spinning impeller throws water outwards and gives it head (pressure, in metres of water). More flow means less head. The pipes need head to lift the water and to push it through friction, and that need grows with flow squared. The pump runs where the two curves cross.',
    home: 'Throttling a pump with a valve wastes power as heat. A slower pump speed gives the same flow for much less power, because power falls with speed cubed.',
    s: { rpm: 2850, height: 8, dia: 25, valve: 100, lift: 2, temp: 15 },
    sliders: [
      { k: 'rpm', label: 'Pump speed', min: 1000, max: 3500, step: 50, unit: 'rpm' },
      { k: 'height', label: 'Tank height above ground', min: 0, max: 40, step: 1, unit: 'm' },
      { k: 'valve', label: 'Valve opening', min: 5, max: 100, step: 1, unit: '%' },
      { k: 'dia', label: 'Pipe bore (25 m long)', min: 13, max: 40, step: 1, unit: 'mm' },
      { k: 'lift', label: 'Suction lift from the well', min: 0, max: 8, step: .5, unit: 'm', hint: 'Height from the water in the well up to the pump.' },
      { k: 'temp', label: 'Water temperature', min: 5, max: 90, step: 1, unit: '°C' },
    ],
    presets: [
      { n: 'Best efficiency point', kind: 'opt', s: { rpm: 2850, height: 25, dia: 25, valve: 100, lift: 2, temp: 15 }, note: 'A 25 m tank through a 25 mm pipe: the pump runs at its best point (about 38 L/min, 49 %), and pipe friction is small, so about a third of the electric power lifts water.' },
      { n: 'Wide pipe, low tank', kind: 'typ', s: { rpm: 2850, height: 8, dia: 25, valve: 100, lift: 2, temp: 15 }, note: 'A wide pipe has little friction, so the pump runs out past its best point: lots of flow, but lower efficiency and less margin against cavitation.' },
      { n: 'Valve almost shut', kind: 'edge', s: { rpm: 2850, height: 5, dia: 25, valve: 5, lift: 2, temp: 15 }, note: 'The pump still works near its own best point, but almost all of its head is burned in the valve. Only a few per cent of the electric power lifts water.' },
      { n: 'Tank out of reach', kind: 'edge', s: { rpm: 2850, height: 40, dia: 25, valve: 100, lift: 2, temp: 15 }, note: 'The tank is higher than the shut-off head. No water moves, and all 250 W of shaft power heats the water in the casing.' },
      { n: 'Hot water, deep well', kind: 'edge', s: { rpm: 2850, height: 5, dia: 25, valve: 100, lift: 6, temp: 85 }, note: 'Hot water boils at a lower pressure, and a deep lift lowers the inlet pressure. Vapour bubbles form and collapse on the impeller: cavitation.' },
    ],
    missions: [
      { t: 'Slow and sweet', d: 'Run at 2000 rpm or less, fill a tank 8 m or higher, and hit the best efficiency flow within 5 %.', win: 'Done. The best point moves with speed: its flow scales with rpm and its head with rpm squared.',
        check: r => r.s.rpm <= 2000 && r.s.height >= 8 && !r.dead && Math.abs(r.bep - 1) < .05 },
      { t: 'Speed, not the valve', d: 'Fill a 10 m tank at 25–35 L/min with the valve fully open. Use the pump speed.', win: 'Done. Compare with the valve-throttled case: the same flow at lower speed needs much less power.',
        check: r => r.s.height >= 10 && r.s.valve >= 95 && r.Lmin >= 25 && r.Lmin <= 35 },
      { t: 'Hot well, no bubbles', d: 'Pump water at 60 °C or hotter from 5 m lift or more, at 20 L/min or more, with no cavitation.', win: 'Done. A bigger suction pipe or a lower speed raises the inlet margin.',
        check: r => r.s.lift >= 5 && r.s.temp >= 60 && r.Lmin >= 20 && !r.cav },
    ],
    chipsList: [{ k: 'impeller', l: 'Impeller', c: '#2f7d73' }, { k: 'volute', l: 'Volute', c: '#7d9bb5' }, { k: 'valve', l: 'Valve', c: '#c8734f' }, { k: 'tank', l: 'Tank', c: '#3f86b0' }],
    partInfo: {
      impeller: 'Impeller: curved vanes spin at 2850 rpm and fling water outwards. The tip speed sets the maximum head (about 40 m here).',
      volute: 'Volute: the snail-shaped casing slows the water down and turns its speed into pressure.',
      valve: 'Valve: closing it adds a loss to the system curve. The curve gets steeper, and the operating point moves to low flow.',
      tank: 'Tank: its height is the static head. The pump must lift the water this far before any flow starts.',
    },
    decor: { u: 1, y: 0, set: 'garden' },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const ground = new THREE.Mesh(new THREE.BoxGeometry(6, .04, 4), M(0xa9b98f, { roughness: .95, metalness: 0, transparent: true, opacity: .55, depthWrite: false })); ground.position.y = -.02; sc.add(ground);
      const metal = M(0x7d9bb5, { metalness: .5, roughness: .4 }), pipeM = M(0x9aa5ae, { metalness: .5, roughness: .4, transparent: true, opacity: .4, depthWrite: false });
      this.pipeM = pipeM;
      const xs = (r1, r2, h, m, seg = 32) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); c.rotation.z = Math.PI / 2; return c; };
      const pumpG = new THREE.Group(); pumpG.position.y = .25; sc.add(pumpG);
      const base = new THREE.Mesh(new THREE.BoxGeometry(.8, .05, .35), M(0x5b636a, { metalness: .4, roughness: .6 })); base.position.set(-.15, -.22, 0); pumpG.add(base);
      const mot = xs(.12, .12, .32, M(0x2f7d73, { metalness: .3, roughness: .5 })); mot.position.x = -.28; pumpG.add(mot);
      for (let k = 0; k < 7; k++) { const fin = new THREE.Mesh(new THREE.TorusGeometry(.12, .012, 6, 24), M(0x2f7d73, { metalness: .3, roughness: .5 })); fin.rotation.y = Math.PI / 2; fin.position.x = -.41 + k * .045; pumpG.add(fin); }
      const foot = new THREE.Mesh(new THREE.BoxGeometry(.3, .16, .2), M(0x5b636a)); foot.position.set(-.28, -.13, 0); pumpG.add(foot);
      const back = xs(.19, .19, .04, metal); back.position.x = .0; pumpG.add(back);
      const vol = new THREE.Mesh(new THREE.TorusGeometry(.15, .055, 12, 40), metal); vol.rotation.y = Math.PI / 2; vol.position.x = .05; pumpG.add(vol); this.vol = vol;
      const cover = xs(.19, .19, .02, M(0xbfd9e6, { transparent: true, opacity: .3, depthWrite: false })); cover.position.x = .1; pumpG.add(cover);
      const imp = new THREE.Group(); imp.position.x = .05; pumpG.add(imp); this.imp = imp;
      imp.add(xs(.115, .115, .012, M(0xe0b55a, { metalness: .5, roughness: .4 })));
      this.vanes = [];
      for (let k = 0; k < 6; k++) { const g = new THREE.Group(); g.rotation.x = k * Math.PI / 3; imp.add(g);
        const v = new THREE.Mesh(new THREE.BoxGeometry(.03, .09, .012), M(0xe0b55a, { metalness: .5, roughness: .4 })); v.position.set(.015, .06, 0); v.rotation.x = .5; g.add(v); this.vanes.push(v); }
      // well, tank and pipes (pipes rebuilt when heights change)
      this.well = new THREE.Group(); sc.add(this.well);
      const tank = new THREE.Group(); tank.position.x = 1.35; sc.add(tank); this.tank = tank;
      this.tankBody = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .6, 32, 1, true), M(0x7d9bb5, { transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })); tank.add(this.tankBody);
      this.water = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 1, 32), M(0x3f86b0, { transparent: true, opacity: .75, roughness: .2, metalness: 0 })); tank.add(this.water);
      this.legs = [0, 1, 2, 3].map(k => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 8), M(0xb8875b, { roughness: .8, metalness: 0 })); tank.add(l); l.k = k; return l; });
      this.valveG = new THREE.Group(); sc.add(this.valveG);
      this.valveG.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .12, 16), M(0xc8734f, { metalness: .4, roughness: .4 })));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .1, 8), pipeM); stem.rotation.x = Math.PI / 2; stem.position.z = .08; this.valveG.add(stem);
      this.wheel = new THREE.Mesh(new THREE.TorusGeometry(.05, .01, 8, 20), M(0xc2453a, { roughness: .5 })); this.wheel.position.z = .13; this.valveG.add(this.wheel);
      const N = 140; this.parts = new THREE.InstancedMesh(new THREE.SphereGeometry(.014, 8, 6), new THREE.MeshBasicMaterial(), N); this.N = N; sc.add(this.parts);
      this.bub = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24); sc.add(this.bub);
      this.u = 0; this.level = .2;
      this.scene = sc; this.cam = { p: [2.6, 2.1, 3.3], t: [.6, .7, 0] };
    },
    layout() {  // visual heights (not to scale): the tank climbs 7.5 cm per metre, the well deepens 12 cm per metre of lift
      const s = this.s, ty = .75 + s.height * .075, wb = -.35 - s.lift * .12, key = `${ty}|${wb}`;
      if (key === this.key) return; this.key = key;
      this.tank.position.y = ty + .3;
      this.legs.forEach(l => { const a = l.k * Math.PI / 2 + Math.PI / 4; stretch(l, V3(.25 * Math.cos(a), -.3, .25 * Math.sin(a)), V3(.3 * Math.cos(a), -ty - .3, .3 * Math.sin(a))); });
      this.well.clear();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, -wb + .05, 24, 1, true), M(0x8a7b6b, { transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
      shaft.position.set(.45, wb / 2, 0); this.well.add(shaft);
      const ww = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .2, 24), M(0x3f86b0, { transparent: true, opacity: .7, roughness: .2, metalness: 0 })); ww.position.set(.45, wb + .1, 0); this.well.add(ww);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.29, .03, 8, 28), M(0xb8b0a2, { roughness: .9, metalness: 0 })); rim.rotation.x = Math.PI / 2; rim.position.set(.45, .02, 0); this.well.add(rim);
      const pts = [[.45, wb + .08, 0], [.45, .1, 0], [.45, .25, 0], [.25, .25, 0], [.12, .25, 0], [.05, .25, 0], [.05, .4, .02], [.05, .55, .02], [.05, .75, .02], [.05, .95, .02], [.35, .98, .02],
        [1.35, .98 + (ty - .6) * 0, .02], [1.35, ty + .62, .02], [1.35, ty + .45, 0]];
      // route the delivery pipe up the stand and over the tank rim
      pts.splice(11, 3, [1.0, .98, .02], [1.0, ty + .7, .02], [1.35, ty + .7, .02], [1.35, ty + .55, 0]);
      const t = tube(pts, .02, this.pipeM, .02); this.well.add(t.mesh); this.curve = t.curve; this.len = t.len;
      this.iImp = 5 / (pts.length - 1);  // curve fraction where water meets the impeller
      this.valveG.position.set(.05, .78, .02);
    },
    update() {
      const r = this.r = PP.solve(this.s);
      if (this.tank) this.layout();
      tiles([
        { l: 'Flow', v: fmt(r.Lmin), u: 'L/min', e: `${fmt(r.Q, 2)} m³/h` },
        { l: 'Pump head', v: fmt(r.H, 1), u: 'm', e: `static ${fmt(r.Hs)} m + friction` },
        { l: 'Pump efficiency', v: fmt(r.eta * 100), u: '%', e: `best ${fmt(PP.ETABEP * 100)} % at ${fmt(r.qb * 1000 / 60)} L/min`, cls: Math.abs(r.bep - 1) < .1 && !r.dead ? 'good' : r.eta < .25 ? 'warn' : '' },
        { l: 'Electric power', v: fmt(r.Pel), u: 'W', e: `shaft ${fmt(r.Psh)} W` },
        { l: 'Energy per m³', v: r.dead ? '–' : fmt(r.whm3), u: 'Wh', e: `${fmt(r.useful * 100)} % of power lifts water`, cls: r.useful < .1 ? 'warn' : '' },
        { l: 'Heat into water', v: fmt(r.loss), u: 'W', e: r.dead ? 'no flow: casing heats up' : 'shaft power not used', cls: r.dead ? 'bad' : '' },
        { l: 'NPSH margin', v: fmt(r.margin, 1), u: 'm', e: r.cav ? 'cavitation' : 'must stay above 0', cls: r.cav ? 'bad' : r.margin < .5 ? 'warn' : 'good' },
      ]);
      $('#alarm').hidden = !(r.cav || r.dead); $('#alarm').textContent = r.cav ? 'Cavitation' : 'No flow: dead-head';
      if (this.wheel) this.wheel.rotation.z = this.s.valve / 100 * Math.PI * 3;
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, s = this.s, o = PP.solve(optOf(this)), qx = 6;
      const pc = (N, top) => { const a = []; for (let Q = 0; Q <= qx; Q += .05) { const h = PP.head(Q, N); if (h < 0) break; a.push([Q, top ? Math.min(h, 50) : h]); } return a; };
      const sc = (q) => { const a = []; for (let Q = 0; Q <= qx; Q += .05) { const h = q.Hs + q.C * Q * Q; if (h > 52) break; a.push([Q, h]); } return a; };
      this.c1 = chart($('#c1'), { x: [0, qx], y: [0, 50], xlab: 'Flow (m³/h)', ylab: 'Head (m of water)',
        body: (X, Y) => `<path class="ghost" d="${path(sc(o), X, Y)}"/><circle class="ghost" r="4" cx="${X(o.Q)}" cy="${Y(o.H)}"/>` +
          (s.rpm !== PP.N0 ? `<path class="s-mut dash" d="${path(pc(PP.N0), X, Y)}"/>` : '') +
          `<path class="s-acc" d="${path(pc(s.rpm), X, Y)}"/><path class="s-hot" d="${path(sc(r), X, Y)}"/>` +
          `<line class="s-mut dash" x1="${X(r.qb)}" x2="${X(r.qb)}" y1="${Y(0)}" y2="${Y(50)}"/><text x="${X(r.qb) + 3}" y="${Y(47)}">best efficiency</text>` +
          `<text class="lbl-acc" x="${X(.1)}" y="${Y(Math.min(48, PP.head(0, s.rpm)) ) - 5}">pump ${s.rpm} rpm</text><text class="lbl" x="${X(qx * .62)}" y="${Y(Math.min(49, r.Hs + r.C * (qx * .62) ** 2)) + 14}">pipes</text>` });
      moveDot(this.c1, r.Q, r.H);
      const nr = [], na = [], gna = [];
      for (let Q = 0; Q <= qx; Q += .05) { nr.push([Q, Math.min(PP.npshr(Q, s.rpm), 14)]); na.push([Q, Math.max(PP.npsha(s, Q), 0)]); gna.push([Q, Math.max(PP.npsha(optOf(this), Q), 0)]); }
      const cav = []; for (let i = 0; i < nr.length; i++) if (nr[i][1] > na[i][1]) cav.push(i);
      this.c2 = chart($('#c2'), { x: [0, qx], y: [0, 12], xlab: 'Flow (m³/h)', ylab: 'NPSH (m)',
        body: (X, Y) => (cav.length ? `<path class="f-bad" d="${path(cav.map(i => nr[i]).concat(cav.slice().reverse().map(i => na[i])), X, Y)}Z"/>` : '') +
          `<path class="ghost" d="${path(gna, X, Y)}"/><path class="s-hot" d="${path(nr, X, Y)}"/><path class="s-cold" d="${path(na, X, Y)}"/>` +
          `<text class="lbl" x="${X(.1)}" y="${Y(Math.min(11, na[0][1])) - 5}">available at the inlet</text><text class="lbl-bad" x="${X(qx * .7)}" y="${Y(Math.min(11.5, PP.npshr(qx * .7, s.rpm))) - 5}">needed</text>` });
      moveDot(this.c2, r.Q, Math.max(0, r.na));
    },
    frame(dt) {
      if (!this.r || !this.curve) return;
      const r = this.r, sp = r.s.rpm / PP.N0 * 4 * Math.PI;  // shown slowed: 2850 rpm -> 2 turns per second
      this.imp.rotation.x -= sp * dt;
      this.u = (this.u + dt * r.Q / 4.6 * .25) % 1;
      const m = new THREE.Matrix4(), col = new THREE.Color();
      for (let i = 0; i < this.N; i++) {
        const u = (this.u + i / this.N) % 1, p = this.curve.getPointAt(u), hf = u < this.iImp ? .1 : .5 + .5 * (r.H / 40);
        const k = r.dead ? 0 : 1; m.makeScale(k, k, k).setPosition(p); this.parts.setMatrixAt(i, m); this.parts.setColorAt(i, tempColor(-25 + hf * 90, col));
      }
      this.parts.instanceMatrix.needsUpdate = true; if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2, rr = .02 + Math.random() * .08, k = r.cav ? .5 + Math.random() : 0;
        m.makeScale(k, k, k).setPosition(.05 + Math.random() * .03, .25 + rr * Math.cos(a), rr * Math.sin(a)); this.bub.setMatrixAt(i, m);
      }
      this.bub.instanceMatrix.needsUpdate = true;
      this.level = r.dead ? this.level : (this.level + dt * r.Q / 4.6 * .08) % .55;
      this.water.scale.y = .02 + this.level; this.water.position.y = -.3 + (.02 + this.level) / 2;
      pumpShake(this, r);
      $('#caption').textContent = `${fmt(r.Lmin)} L/min · head ${fmt(r.H, 1)} m · ${r.s.rpm} rpm · heights not to scale`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      const em = (list, on) => list.forEach(m => m.material.emissive && m.material.emissive.setHex(on ? 0x443300 : 0));
      em(this.vanes, k === 'impeller'); em([this.vol], k === 'volute'); em(this.valveG.children, k === 'valve'); em([this.water], k === 'tank');
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Pump curve H = H₀(N/N₀)² − a·Q², with H₀ = 40 m and run-out flow 4.6 m³/h at 2850 rpm (est., typical 0.5 kW garden pump). Shaft power P = P₀(N/N₀)³ + k·Q(N/N₀)², P₀ = 250 W, k = 56 W per m³/h (est.). Both follow the affinity laws: Q ∝ N, H ∝ N², P ∝ N³.',
      'Efficiency = ρ·g·Q·H / shaft power. Best efficiency ≈ 49 % at ≈ 2.3 m³/h (small pumps are often 40–60 %; est.). Motor efficiency 75 % (est.).',
      'System curve: static head (tank height + suction lift) + Darcy friction (f = 0.025, 25 m pipe) + fittings (K = 3) + valve (K = 2 / opening² − 2), all est.',
      'NPSH available = (101.325 kPa − vapour pressure) / ρg − lift − suction losses; vapour pressure from the Magnus formula. NPSH required = (0.8 + 1.6·(Q/Q_bep)²)·(N/N₀)² m (est.).',
      'Heights in the 3D view are not to scale. Dead-head heating: with no flow, all shaft power heats the water in the casing.',
    ],
  };
  function pumpShake(lab, r) { lab.vol.position.y = r.cav ? (Math.random() - .5) * .004 : 0; }
  registerLab(pump);
})(globalThis);
