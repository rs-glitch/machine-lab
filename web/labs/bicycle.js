// Bicycle lab: gears as mechanical advantage, and where the rider's power goes.
// Pure physics in BikePhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const BP = {
    RHO: 1.225, GR: 9.81, CIRC: 2.105, ETA: 0.97, CRANK: 0.1725,  // air kg/m3; 700x25c wheel circumference m; drivetrain; crank m
    RINGS: [34, 50], COGS: [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28, 32],
    POS: [['Upright (city bike)', 0.40], ['Hands on hoods', 0.34], ['Hands in drops', 0.31], ['Aero bars', 0.25]],  // CdA m2, est.
    crr: bar => 0.0045 * Math.sqrt(6 / bar),  // est.: 0.0045 at 6 bar, rises as the tyre goes soft
    forces(s, v) {
      const th = Math.atan(s.slope / 100), va = v + s.wind / 3.6;
      return { aero: .5 * BP.RHO * BP.POS[s.pos][1] * va * Math.abs(va), roll: BP.crr(s.bar) * s.mass * BP.GR * Math.cos(th), climb: s.mass * BP.GR * Math.sin(th) };
    },
    need(s, v) {  // pedal power (W) to hold ground speed v (m/s)
      const f = BP.forces(s, v), k = v / BP.ETA;
      return { aero: f.aero * k, roll: f.roll * k, climb: f.climb * k, total: (f.aero + f.roll + f.climb) * k };
    },
    speed(s) { let lo = 0, hi = 40; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (BP.need(s, m).total < s.P) lo = m; else hi = m; } return (lo + hi) / 2; },
    ratio: s => BP.RINGS[s.ring] / BP.COGS[s.cog],
    cadence: (s, v) => v / BP.CIRC * 60 / BP.ratio(s),
    cadEff: c => Math.max(0.4, 1 - ((c - 80) / 80) ** 2),  // est. relative muscle efficiency, best near 80 rpm
    solve(s) {
      const v = BP.speed(s), n = BP.need(s, v), c = BP.cadence(s, v), ratio = BP.ratio(s);
      const force = s.P / Math.max(1e-3, 2 * Math.PI * c / 60) / BP.CRANK;  // average tangential pedal force, N
      const pos = n.aero + n.roll + Math.max(0, n.climb) || 1;
      return { s, v, kmh: v * 3.6, aero: n.aero, roll: n.roll, climb: n.climb, total: n.total, cad: c, ratio, dev: ratio * BP.CIRC, force,
        kcalh: s.P / (0.22 * BP.cadEff(c)) * 3600 / 4184, shAero: n.aero / pos, shRoll: n.roll / pos, shClimb: Math.max(0, n.climb) / pos, min10: 10000 / v / 60 };
    },
  };
  G.BikePhys = BP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const gearName = s => `${BP.RINGS[s.ring]}/${BP.COGS[s.cog]}`;
  const area = (top, bot, X, Y) => path(top.concat(bot.slice().reverse()), X, Y) + 'Z';
  function gearMesh(teeth, color) {  // flat sprocket with teeth, radius from 1/2-inch chain pitch
    const r = teeth * 0.0127 / (2 * Math.PI), sh = new THREE.Shape();
    for (let i = 0; i <= teeth * 2; i++) { const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r - .002 : r + .003; i ? sh.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : sh.moveTo(rr, 0); }
    const hole = new THREE.Path(); hole.absarc(0, 0, r * .55, 0, Math.PI * 2, true); sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .003, bevelEnabled: false }), M(color, { metalness: .7, roughness: .3 }));
    m.r = r; return m;
  }

  const bike = {
    id: 'bicycle', tab: 'Bicycle',
    charts: ['Where the power goes', 'Pedal power needed at each speed: rolling, air and climbing. Where the stack meets your power line is your speed. Green dashed: optimal preset.',
      'Cadence against speed in each gear', 'Each line is one gear. Shift to stay in the green band (80–100 rpm), where legs work best.'],
    eyebrow: 'Lab 6 · Gears, drag and power', concept: 'Gears trade pedal force for pedal speed; air takes most of your power',
    text: 'Your legs make power: force times pedal speed. Gears do not add power. They let you choose a comfortable pedal speed for any road speed. On flat roads above about 20 km/h, most of the power pushes air out of the way, and air drag grows with the square of speed.',
    home: 'Tuck low and you go faster for free. On a steep hill, shift to the small front ring and a big rear cog, or your knees take a huge force at a slow cadence.',
    s: { P: 200, slope: 0, ring: 1, cog: 5, pos: 1, bar: 6, wind: 0, mass: 85 },
    sliders: [
      { k: 'P', label: 'Rider power at the pedals', min: 50, max: 600, step: 10, unit: 'W' },
      { k: 'slope', label: 'Road slope', min: -8, max: 15, step: 1, unit: '%' },
      { k: 'ring', label: 'Front chainring', min: 0, max: 1, step: 1, fmt: v => BP.RINGS[v] + ' teeth' },
      { k: 'cog', label: 'Rear cog', min: 0, max: 11, step: 1, fmt: v => BP.COGS[v] + ' teeth' },
      { k: 'pos', label: 'Riding position', min: 0, max: 3, step: 1, fmt: v => `${BP.POS[v][0]} · CdA ${BP.POS[v][1]}` },
      { k: 'bar', label: 'Tyre pressure', min: 1, max: 8, step: .5, unit: 'bar' },
      { k: 'wind', label: 'Headwind (negative = tailwind)', min: -20, max: 40, step: 1, unit: 'km/h' },
      { k: 'mass', label: 'Rider + bike mass', min: 60, max: 130, step: 1, unit: 'kg' },
    ],
    presets: [
      { n: 'Efficient cruise', kind: 'opt', s: { P: 200, slope: 0, ring: 1, cog: 5, pos: 2, bar: 6.5, wind: 0, mass: 80 }, note: 'Hands in the drops, hard tyres, and a gear (50/17) that gives about 90 rpm. 200 W gives about 34 km/h, and air takes about 80 % of the power.' },
      { n: 'City commute', kind: 'typ', s: { P: 120, slope: 1, ring: 0, cog: 4, pos: 0, bar: 4, wind: 0, mass: 90 }, note: 'Upright on a city bike. 120 W gives about 20 km/h. Air and the slight slope share the work.' },
      { n: '12 % climb in top gear', kind: 'edge', s: { P: 250, slope: 12, ring: 1, cog: 0, pos: 1, bar: 6, wind: 0, mass: 85 }, note: 'The speed is only about 8 km/h, so 50/11 gives a cadence near 15 rpm. Each pedal stroke needs almost 1000 N. Climbing takes almost all the power.' },
      { n: 'Upright into a headwind', kind: 'edge', s: { P: 150, slope: 0, ring: 0, cog: 6, pos: 0, bar: 4, wind: 30, mass: 90 }, note: 'A 30 km/h headwind and an upright position. The air speed is much higher than the road speed, so the bike crawls at about 14 km/h.' },
      { n: 'Flat tyre', kind: 'edge', s: { P: 150, slope: 0, ring: 1, cog: 7, pos: 1, bar: 1, wind: 0, mass: 85 }, note: 'At 1 bar the tyre flexes a lot. Rolling resistance is more than twice the normal value, and the rolling share of the power jumps.' },
    ],
    missions: [
      { t: 'Spin up the hill', d: 'On a slope of 8 % or more, at 200 W or more, keep your cadence between 85 and 95 rpm.', win: 'Done. A low gear (small ring, big cog) lets the legs spin fast with a moderate force.',
        check: r => r.s.slope >= 8 && r.s.P >= 200 && r.cad >= 85 && r.cad <= 95 },
      { t: 'Beat the headwind', d: 'Into a headwind of 15 km/h or more, ride at 30 km/h or more with 240 W or less.', win: 'Done. Aero bars cut the drag area by about a quarter. Into wind, that is the biggest saving.',
        check: r => r.s.wind >= 15 && r.kmh >= 30 && r.s.P <= 240 },
      { t: 'Save your knees', d: 'Climb a slope of 12 % or more with a pedal force of 300 N or less and a cadence of 50 rpm or more.', win: 'Done. Same power, lower gear: more pedal speed, less force. That is the job of gears.',
        check: r => r.s.slope >= 12 && r.force <= 300 && r.cad >= 50 },
    ],
    chipsList: [{ k: 'gears', l: 'Gears and chain', c: '#0d7480' }, { k: 'tyres', l: 'Tyres', c: '#3b4349' }, { k: 'air', l: 'Air', c: '#2a85c0' }],
    partInfo: {
      gears: 'Gears: the gear ratio is front teeth ÷ rear teeth. 50/17 = 2.94, so the wheel turns 2.94 times for each pedal turn and the bike moves 6.2 m.',
      tyres: 'Tyres: a soft tyre flexes as it rolls, and the flexing turns energy into heat. Higher pressure means less loss on smooth roads.',
      air: 'Air: drag force grows with the square of air speed, so drag power grows with the cube of speed. A headwind adds to your air speed but not to your road speed.',
    },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const world = new THREE.Group(); sc.add(world); this.world = world;
      const road = new THREE.Mesh(new THREE.BoxGeometry(14, .02, 1.4), M(0x5b6670, { roughness: .9, metalness: 0 })); road.position.y = -.01; world.add(road);
      this.dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .005, .05), new THREE.MeshBasicMaterial({ color: 0xf2f2ee }), 14); world.add(this.dashes);
      this.wind = new THREE.InstancedMesh(new THREE.BoxGeometry(.3, .004, .004), new THREE.MeshBasicMaterial({ color: 0x7fc4ec, transparent: true, opacity: .6 }), 36); world.add(this.wind);
      this.windPos = [...Array(36)].map(() => [Math.random() * 12 - 6, .2 + Math.random() * 1.2, Math.random() - .5]);
      const bk = new THREE.Group(); world.add(bk);
      const frame = M(0x0d7480, { metalness: .4, roughness: .35 }), alloy = M(0xb8c0c6, { metalness: .8, roughness: .25 }), black = M(0x22282d, { roughness: .8, metalness: .1 });
      const B = V3(-.07, .27, 0), R = V3(-.48, .335, 0), F = V3(.52, .335, 0), S = V3(-.2, .82, 0), H = V3(.38, .8, 0), Hb = V3(.43, .64, 0);
      const tubeM = (a, b, r, m) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), m); stretch(t, a, b); bk.add(t); return t; };
      tubeM(B, S, .016, frame); tubeM(S, H, .015, frame); tubeM(B, Hb, .02, frame); tubeM(Hb, H, .02, frame);
      [-.05, .05].forEach(z => { tubeM(B.clone().setZ(z * .6), R.clone().setZ(z), .009, frame); tubeM(S.clone().setZ(z * .3), R.clone().setZ(z), .008, frame); tubeM(Hb.clone().setZ(z * .5), F.clone().setZ(z), .01, frame); });
      tubeM(S, S.clone().add(V3(-.02, .1, 0)), .012, alloy);
      const sad = new THREE.Mesh(new THREE.BoxGeometry(.26, .03, .1), black); sad.position.copy(S).add(V3(-.04, .11, 0)); bk.add(sad);
      tubeM(H, H.clone().add(V3(.02, .07, 0)), .012, alloy);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .42, 10), black); bar.rotation.x = Math.PI / 2; bar.position.copy(H).add(V3(.1, .07, 0)); bk.add(bar);
      tubeM(H.clone().add(V3(.02, .07, 0)), H.clone().add(V3(.1, .07, 0)), .012, alloy);
      // wheels with spokes
      this.wheels = [R, F].map(c => {
        const w = new THREE.Group(); w.position.copy(c); bk.add(w);
        const tyre = new THREE.Mesh(new THREE.TorusGeometry(.322, .014, 10, 64), black); w.add(tyre);
        w.add(new THREE.Mesh(new THREE.TorusGeometry(.305, .008, 8, 64), alloy));
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .1, 12), alloy); hub.rotation.x = Math.PI / 2; w.add(hub);
        const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, z = i % 2 ? .035 : -.035; pts.push(0, 0, z, .3 * Math.cos(a), .3 * Math.sin(a), 0); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        w.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9aa5ae })));
        w.tyre = tyre; return w;
      });
      // drivetrain: chainrings, cassette, cranks, chain, derailleur
      this.B = B; this.R = R; this.bk = bk;
      this.rings = BP.RINGS.map((t, i) => { const g = gearMesh(t, 0x8b959c); g.position.set(B.x, B.y, [.066, .076][i]); bk.add(g); return g; });
      this.cogs = BP.COGS.map((t, i) => { const g = gearMesh(t, 0x8b959c); g.position.set(R.x, R.y, .085 - i * .0041); bk.add(g); return g; });
      const crank = new THREE.Group(); crank.position.copy(B); bk.add(crank); this.crank = crank;
      [[.095, -1], [-.095, 1]].forEach(([z, d]) => { const arm = new THREE.Mesh(new THREE.BoxGeometry(.025, BP.CRANK, .012), alloy); arm.position.set(0, d * BP.CRANK / 2, z); crank.add(arm);
        const ped = new THREE.Group(); ped.position.set(0, d * BP.CRANK, z + Math.sign(z) * .04); crank.add(ped);
        ped.add(new THREE.Mesh(new THREE.BoxGeometry(.09, .015, .07), black)); crank['ped' + (z > 0 ? 'R' : 'L')] = ped; });
      this.derail = new THREE.Group(); bk.add(this.derail);
      [[0, -.07], [.03, -.13]].forEach(([dx, dy]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .008, 16), black); p.rotation.x = Math.PI / 2; p.position.set(R.x + dx, R.y + dy, 0); this.derail.add(p); });
      const cage = new THREE.Mesh(new THREE.BoxGeometry(.02, .09, .006), alloy); cage.position.set(R.x + .015, R.y - .1, 0); cage.rotation.z = -.45; this.derail.add(cage);
      this.links = new THREE.InstancedMesh(new THREE.BoxGeometry(.012, .005, .006), M(0x5d666d, { metalness: .8 }), 110); bk.add(this.links);
      this.scene = sc; this.cam = { p: [.35, .95, 2.5], t: [0, .48, 0] };
      this.wAng = 0; this.cAng = 0; this.cu = 0; this.road = 0; this.builtGear = null;
    },
    setGear() {  // highlight the active ring and cog, rebuild the chain path between them
      const s = this.s; if (this.builtGear === gearName(s)) return; this.builtGear = gearName(s);
      this.rings.forEach((g, i) => g.material.color.setHex(i === s.ring ? 0x0d7480 : 0x8b959c));
      this.cogs.forEach((g, i) => g.material.color.setHex(i === s.cog ? 0x0d7480 : 0x8b959c));
      const B = this.B, R = this.R, rr = this.rings[s.ring].r + .003, rc = this.cogs[s.cog].r + .003, zr = this.rings[s.ring].position.z, zc = this.cogs[s.cog].position.z;
      this.chain = new THREE.CatmullRomCurve3([V3(B.x, B.y + rr, zr), V3(R.x, R.y + rc, zc), V3(R.x - rc, R.y, zc), V3(R.x, R.y - .07 + .018, zc),
        V3(R.x + .03, R.y - .13 - .018, zc), V3(B.x, B.y - rr, zr), V3(B.x + rr, B.y, zr)], true, 'centripetal');
      this.derail.position.z = zc;
    },
    update() {
      const r = this.r = BP.solve(this.s); if (this.rings) this.setGear();
      const kmh = r.kmh, cadCls = r.cad < 60 || r.cad > 110 ? 'bad' : r.cad < 80 || r.cad > 100 ? 'warn' : 'good';
      tiles([
        { l: 'Speed', v: fmt(kmh, 1), u: 'km/h', e: `10 km in ${fmt(r.min10)} min` },
        { l: 'Cadence', v: fmt(r.cad), u: 'rpm', cls: cadCls, e: 'legs like 80–100' },
        { l: 'Gear', v: gearName(this.s), e: `ratio ${fmt(r.ratio, 2)} · ${fmt(r.dev, 1)} m per pedal turn` },
        { l: 'Pedal force', v: fmt(Math.min(r.force, 9999)), u: 'N', cls: r.force > 600 ? 'bad' : r.force > 350 ? 'warn' : '', e: 'average, per stroke' },
        { l: 'Air drag share', v: fmt(r.shAero * 100), u: '%', e: `${fmt(r.aero)} W` },
        { l: 'Rolling share', v: fmt(r.shRoll * 100), u: '%', e: `${fmt(r.roll)} W · Crr ${fmt(BP.crr(this.s.bar), 4)}` },
        { l: 'Climbing share', v: fmt(r.shClimb * 100), u: '%', e: r.climb < 0 ? `gravity gives ${fmt(-r.climb)} W` : `${fmt(r.climb)} W` },
        { l: 'Food energy', v: fmt(r.kcalh), u: 'kcal/h', e: 'est. muscle efficiency 22 %' },
      ]);
      $('#alarm').hidden = r.force <= 600; $('#alarm').textContent = 'Knee strain: shift down';
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const s = this.s, r = this.r, o = optOf(this), V = [], vmax = 60;
      for (let k = 0; k <= vmax; k += 1) { const n = BP.need(s, k / 3.6), g = BP.need(o, k / 3.6); V.push({ k, roll: n.roll, ra: n.roll + n.aero, t: n.total, g: g.total }); }
      const ymax = Math.max(400, Math.ceil(s.P * 1.6 / 100) * 100), ymin = Math.min(0, Math.floor(Math.min(...V.map(q => q.t)) / 100) * 100);
      const cl = (y) => Math.max(ymin - 50, Math.min(ymax + 50, y));
      this.c1 = chart($('#c1'), { x: [0, vmax], y: [ymin, ymax], xlab: 'Road speed (km/h)', ylab: 'Pedal power (W)',
        body: (X, Y) => {
          const zero = V.map(q => [q.k, 0]), roll = V.map(q => [q.k, cl(q.roll)]), ra = V.map(q => [q.k, cl(q.ra)]), tot = V.map(q => [q.k, cl(q.t)]);
          return `<path d="${area(roll, zero, X, Y)}" style="fill:color-mix(in srgb,var(--muted) 30%,transparent)"/>` +
            `<path d="${area(ra, roll, X, Y)}" style="fill:color-mix(in srgb,var(--cold) 30%,transparent)"/>` +
            `<path d="${area(tot, ra, X, Y)}" style="fill:color-mix(in srgb,var(--hot) ${s.slope >= 0 ? 28 : 12}%,transparent)"/>` +
            `<path class="s-ink" d="${path(tot, X, Y)}"/><path class="ghost" d="${path(V.map(q => [q.k, cl(q.g)]), X, Y)}"/>` +
            `<line class="s-acc dash" x1="${X(0)}" x2="${X(vmax)}" y1="${Y(s.P)}" y2="${Y(s.P)}"/><text class="lbl-acc" x="${X(1.5)}" y="${Y(s.P) - 5}">your power ${s.P} W</text>` +
            `<text class="lbl" x="${X(vmax - 1)}" y="${Y(ymin) - 6}" text-anchor="end">grey: rolling · blue: air · red: climbing</text>`; } });
      moveDot(this.c1, Math.min(r.kmh, vmax), s.P);
      const cmax = 140;
      this.c2 = chart($('#c2'), { x: [0, vmax], y: [0, cmax], xlab: 'Road speed (km/h)', ylab: 'Cadence (rpm)',
        body: (X, Y) => `<rect x="${X(0)}" y="${Y(100)}" width="${X(vmax) - X(0)}" height="${Y(80) - Y(100)}" style="fill:color-mix(in srgb,var(--ok) 16%,transparent)"/>` +
          BP.RINGS.map((rt, ri) => BP.COGS.map((ct, ci) => { const cur = ri === s.ring && ci === s.cog, c60 = vmax / 3.6 / BP.CIRC * 60 / (rt / ct);
            const pts = [[0, 0], c60 > cmax ? [vmax * cmax / c60, cmax] : [vmax, c60]];
            return `<path class="${cur ? 's-acc' : 's-mut'}" style="${cur ? '' : `opacity:.35;stroke-width:1;${ri ? '' : 'stroke-dasharray:3 2'}`}" d="${path(pts, X, Y)}"/>`; }).join('')).join('') +
          `<text class="lbl" x="${X(2)}" y="${Y(cmax) + 12}">solid: ${BP.RINGS[1]}T ring · dashed: ${BP.RINGS[0]}T ring</text>` });
      moveDot(this.c2, Math.min(r.kmh, vmax), Math.min(r.cad, cmax));
    },
    frame(dt) {
      if (!this.r || !this.chain) { if (this.rings) this.setGear(); return; }
      const slow = .25, r = this.r, v = r.v * slow;  // shown 4x slower so the spokes stay readable
      this.world.rotation.z = Math.atan(this.s.slope / 100);
      this.wAng += v / (BP.CIRC / (2 * Math.PI)) * dt; this.cAng = this.wAng / r.ratio;
      this.wheels.forEach(w => w.rotation.z = -this.wAng);
      this.crank.rotation.z = -this.cAng; ['pedR', 'pedL'].forEach(k => this.crank[k].rotation.z = this.cAng);  // pedals stay level
      this.cu = (this.cu + (r.cad / 60) * slow * dt * (this.rings[this.s.ring].r * 2 * Math.PI) / this.chain.getLength()) % 1;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(1, 0, 0), sc = V3(1, 1, 1);
      for (let i = 0; i < 110; i++) { const u = (this.cu + i / 110) % 1, p = this.chain.getPointAt(u), t = this.chain.getTangentAt(u);
        q.setFromUnitVectors(up, t); m.compose(p, q, sc); this.links.setMatrixAt(i, m); }
      this.links.instanceMatrix.needsUpdate = true;
      this.road = (this.road + v * dt) % 1;
      for (let i = 0; i < 14; i++) { m.makeTranslation(-7 + i + .5 - this.road, .001, .5); this.dashes.setMatrixAt(i, m); }
      this.dashes.instanceMatrix.needsUpdate = true;
      const air = (r.v + this.s.wind / 3.6) * slow;
      this.windPos.forEach((w, i) => { w[0] -= air * dt * 1.5; if (w[0] < -6) w[0] += 12; if (w[0] > 6) w[0] -= 12; m.makeTranslation(w[0], w[1], w[2]); this.wind.setMatrixAt(i, m); });
      this.wind.instanceMatrix.needsUpdate = true;
      $('#caption').textContent = `${fmt(r.kmh, 1)} km/h · ${fmt(r.cad)} rpm in ${gearName(this.s)} · slope ${this.s.slope} % · shown 4× slower`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      const em = (list, on) => list.forEach(x => x.material.emissive && x.material.emissive.setHex(on ? 0x335533 : 0));
      em(this.rings.concat(this.cogs), k === 'gears'); em(this.wheels.map(w => w.tyre), k === 'tyres');
      this.wind.material.opacity = k === 'air' ? 1 : .6;
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Steady-state power balance: P·η = (½ρ·CdA·v_air² + Crr·m·g·cosθ + m·g·sinθ)·v, with ρ = 1.225 kg/m³ and drivetrain efficiency η = 97 % (typical published value for a clean chain).',
      'Drag area CdA: upright 0.40, hoods 0.34, drops 0.31, aero bars 0.25 m² (est., inside published ranges for road riders). Acceleration and wind gusts are ignored.',
      'Rolling resistance Crr = 0.0045·√(6 bar / pressure) (est.; road tyres are about 0.004–0.006 at normal pressure).',
      'Gears: 50/34 compact chainrings and an 11–32 cassette; wheel circumference 2.105 m (700×25c). Crank 172.5 mm. Pedal force is the average tangential force.',
      'Food energy uses a gross muscle efficiency of 22 % that falls away from about 80 rpm (est.). Check: 200 W on the drops on flat ground gives about 34 km/h.',
    ],
  };
  registerLab(bike);
})(globalThis);
