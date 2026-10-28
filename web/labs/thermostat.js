// Thermostat lab: feedback control of a heated room. On/off with hysteresis, P, PI and PID, anti-windup, an open-window disturbance.
// Pure physics in ThermoPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TP = {
    C: 4e5, TAU_H: 300, TAU_S: 120, T0: 15, DUR: 6 * 3600, DT: 5,   // J/K room air + fast contents; s heater lag; s sensor lag; start C; s; s (est.)
    WIN: [180 * 60, 200 * 60], UA_WIN: 150,                        // window open from 3:00 to 3:20; extra loss W/K (est.)
    MODES: ['On/off', 'P', 'PI', 'PID'],
    DEFAULTS: { mode: 2, sp: 21, Kp: 1, Ti: 15, Td: 0, band: 1, Tout: 5, Pmax: 2000, UA: 60, aw: 1, win: 1 },
    OPT: { mode: 3, sp: 21, Kp: 1.6, Ti: 45, Td: 2, band: 1, Tout: 5, Pmax: 2000, UA: 60, aw: 1, win: 1 },
    simulate(o) {
      const s = Object.assign({}, TP.DEFAULTS, o), dt = TP.DT, pts = [];
      let T = TP.T0, Ts = TP.T0, prev = TP.T0, q = 0, I = 0, on = 0, u = 0, sw = 0, Ein = 0, Eloss = 0;
      for (let k = 0, t = 0; t < TP.DUR; k++, t += dt) {
        const e = s.sp - Ts;
        let un;
        if (s.mode === 0) { if (Ts < s.sp - s.band / 2) on = 1; else if (Ts > s.sp + s.band / 2) on = 0; un = on; }
        else {
          const D = s.mode === 3 ? -s.Td * 60 * (Ts - prev) / dt : 0;  // derivative on measurement: no kick when the set point moves
          const raw = s.Kp * (e + (s.mode >= 2 ? I : 0) + D);
          if (s.mode >= 2) { const sat = (raw >= 1 && e > 0) || (raw <= 0 && e < 0); if (!(s.aw && sat)) I += e * dt / (s.Ti * 60); }
          un = clamp(raw, 0, 1);
        }
        if (s.mode === 0 && un !== u && t >= 3600 && t < TP.WIN[0]) sw++;
        u = un; prev = Ts;
        const open = s.win && t >= TP.WIN[0] && t < TP.WIN[1], UA = s.UA + (open ? TP.UA_WIN : 0);
        q = u * s.Pmax + (q - u * s.Pmax) * Math.exp(-dt / TP.TAU_H);
        const loss = UA * (T - s.Tout);
        T += (q - loss) * dt / TP.C; Ts += (T - Ts) * (1 - Math.exp(-dt / TP.TAU_S));
        Ein += q * dt; Eloss += loss * dt;
        if (k % 6 === 0) pts.push([t / 3600, T, Ts, q, u * s.Pmax, open ? 1 : 0]);
      }
      const at = (a, b) => pts.filter(p => p[0] * 60 >= a && p[0] * 60 < b), sp = s.sp;
      const riseP = pts.find(p => p[1] >= sp - .5), rise = riseP ? riseP[0] * 60 : 360;
      const pre = at(rise, 180), overshoot = Math.max(0, ...pre.map(p => p[1] - sp));
      const off = at(0, 180).filter(p => Math.abs(p[1] - sp) > .3), settle = off.length ? off[off.length - 1][0] * 60 + .5 : 0;
      const late = at(120, 180), sse = late.reduce((a, p) => a + Math.abs(sp - p[1]), 0) / Math.max(1, late.length);
      const band = Math.max(...at(90, 180).map(p => Math.abs(p[1] - sp)));
      const after = at(200, 360), rec = after.find(p => Math.abs(p[1] - sp) <= .3), recover = !s.win ? 0 : rec ? rec[0] * 60 - 200 : 160;
      const overshootAfter = Math.max(0, ...at(rec ? rec[0] * 60 : 200, 360).map(p => p[1] - sp));
      return { s, pts, rise, overshoot, settle, sse, band, recover, overshootAfter, swPerH: sw / 2, kWh: Ein / 3.6e6,
        energyIn: Ein, energyLoss: Eloss, energyStored: TP.C * (T - TP.T0), Tend: T };
    },
    // Ziegler-Nichols ultimate point: smallest P gain with sustained oscillation, and its period (min)
    ultimate(o) {
      const grow = Kp => { const r = TP.simulate(Object.assign({}, o, { mode: 1, Kp, win: 0 })), p = r.pts.filter(q => q[0] > 1);
        const pk = []; for (let i = 1; i < p.length - 1; i++) if (p[i][1] > p[i - 1][1] && p[i][1] >= p[i + 1][1]) pk.push(p[i]);
        if (pk.length < 4) return { g: 0, P: 0 };
        const tr = i => Math.min(...p.filter(q => q[0] > pk[i][0] && q[0] < pk[i + 1][0]).map(q => q[1]));
        const a1 = pk[1][1] - tr(1), a2 = pk[pk.length - 2][1] - tr(pk.length - 2);
        return { g: a2 / Math.max(1e-9, a1), P: (pk[pk.length - 1][0] - pk[1][0]) / (pk.length - 2) * 60 };
      };
      let lo = .1, hi = 40;
      for (let i = 0; i < 24; i++) { const m = Math.sqrt(lo * hi); grow(m).g >= .95 ? (hi = m) : (lo = m); }
      return { Ku: hi, Pu: grow(hi).P };
    },
  };
  G.ThermoPhys = TP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const tColor = (T, out) => out.setRGB(0.36, 0.55, 0.78).lerp(new THREE.Color(0.93, 0.55, 0.3), clamp((T - 15) / 10, 0, 1));
  const lab = {
    id: 'thermostat', tab: 'Thermostat',
    charts: ['Room temperature', 'Solid: room air. Dashed: what the thermostat sensor reads (it lags). The shaded strip is the open window. Green dashed: the optimal preset.',
      'Heater power', 'Solid: heat the radiator gives to the room. Dashed: what the controller asks for. The radiator is slow to warm up.'],
    eyebrow: 'Lab 14 · Feedback control', concept: 'A thermostat measures, compares and corrects, again and again',
    text: 'The sensor reads the room. The controller compares it with the set point and decides the heater power. A simple thermostat switches fully on or off. A PID controller acts on the error now (P), the error it has added up (I) and how fast the error changes (D). Slow parts in the loop, like a radiator that takes minutes to warm, cause overshoot.',
    home: 'An old thermostat clicks on and off and the room swings by a degree. A smart thermostat learns your room and holds it steady, and it saves energy because it does not overshoot.',
    s: Object.assign({}, TP.DEFAULTS),
    sliders: [
      { k: 'mode', label: 'Controller', min: 0, max: 3, step: 1, fmt: v => TP.MODES[v] },
      { k: 'sp', label: 'Set point', min: 16, max: 25, step: .5, unit: '°C' },
      { k: 'Kp', label: 'Gain Kp (power per kelvin)', min: .05, max: 4, step: .05, fmt: v => `${Math.round(v * 100)} %/K` },
      { k: 'Ti', label: 'Integral time Ti', min: 2, max: 120, step: 1, unit: 'min', hint: 'Used by PI and PID. Short Ti acts fast but overshoots.' },
      { k: 'Td', label: 'Derivative time Td', min: 0, max: 15, step: .5, unit: 'min', hint: 'Used by PID. It brakes the heater before the room gets there.' },
      { k: 'band', label: 'On/off band (hysteresis)', min: .1, max: 3, step: .1, unit: 'K' },
      { k: 'Tout', label: 'Outdoor temperature', min: -15, max: 15, step: 1, unit: '°C' },
      { k: 'aw', label: 'Anti-windup', min: 0, max: 1, step: 1, fmt: v => v ? 'On' : 'Off' },
      { k: 'win', label: 'Open the window at 3:00', min: 0, max: 1, step: 1, fmt: v => v ? 'Yes, 20 min' : 'No' },
    ],
    presets: [
      { n: 'Tuned PID', kind: 'opt', s: Object.assign({}, TP.OPT), note: 'Moderate gain, slow integral and a little derivative. The room reaches 21 °C in about 40 min with no overshoot, settles in about 40 min, and recovers in about 20 min after the window.' },
      { n: 'Old on/off thermostat', kind: 'typ', s: { mode: 0, band: 1, sp: 21, Tout: 5, win: 1, aw: 1, Kp: 1, Ti: 15, Td: 0 }, note: 'The heater is fully on or off. The room swings around the set point, a bit more than the 1 K band because of the lags.' },
      { n: 'Band too narrow', kind: 'edge', s: { mode: 0, band: .1, sp: 21, Tout: 5, win: 1, aw: 1, Kp: 1, Ti: 15, Td: 0 }, note: 'A 0.1 K band makes the relay click more often (short cycling), which wears relays and boilers. The room still swings by about 0.4 K, because the sensor and radiator lags set the swing, not the band.' },
      { n: 'P only', kind: 'edge', s: { mode: 1, Kp: .3, sp: 21, Tout: 5, win: 1, aw: 1, Ti: 15, Td: 0, band: 1 }, note: 'A P controller needs an error to make any power. The room settles below the set point: the steady-state offset.' },
      { n: 'Integral windup', kind: 'edge', s: { mode: 2, Kp: .8, Ti: 10, Td: 0, aw: 0, sp: 21, Tout: 5, win: 1, band: 1 }, note: 'While the heater is at full power, the integral keeps adding up. Then the room overshoots by about 5 K before the integral unwinds.' },
    ],
    missions: [
      { t: 'No overshoot', d: 'With PI or PID, reach the set point within 45 min and overshoot by less than 0.2 K.', win: 'Done. Enough gain to rise fast, a slow integral, and derivative action to brake early.',
        check: r => r.s.mode >= 2 && r.overshoot < .2 && r.rise <= 45 },
      { t: 'Tight on/off', d: 'With on/off control, keep the room within 0.5 K of the set point (1:30 to 3:00).', win: 'Done. A narrow band holds the room closer, but the relay clicks more often. The lags set a limit you cannot beat with the band alone.',
        check: r => r.s.mode === 0 && r.band <= .5 },
      { t: 'Window shock', d: 'At 0 °C outside or colder, with the window event on, get back to the set point after the window closes and overshoot by less than 0.2 K.', win: 'Done. The heater limit sets how fast you recover. Good tuning decides how cleanly you arrive: derivative action and anti-windup stop the overshoot.',
        check: r => r.s.Tout <= 0 && r.s.win && r.recover < 160 && r.overshootAfter < .2 },
    ],
    chipsList: [{ k: 'sensor', l: 'Thermostat', c: '#2f7d73' }, { k: 'heater', l: 'Radiator', c: '#d9673f' }, { k: 'window', l: 'Window', c: '#7d9bb5' }],
    partInfo: {
      sensor: 'Thermostat: it reads the air near it about 2 min late (sensor lag), compares the reading with the set point and sends a power command.',
      heater: 'Radiator: up to 2 kW. Its metal and water take about 5 min to warm up or cool down, so the room keeps heating after the controller says stop.',
      window: 'Window: open for 20 min at 3:00. It adds 150 W/K of heat loss (est.). The controller must notice, push hard, and then not overshoot.',
    },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const wallM = M(0xeadfcd, { roughness: .9, metalness: 0 }), white = M(0xf8f4ec, { roughness: .6, metalness: 0 });
      const bx = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); sc.add(b); return b; };
      bx(4.5, .05, 3.5, M(0xb8875b, { roughness: .8, metalness: 0 }), 0, -.025, 0);
      const H = 2.6, wz = -1.75, x0 = -.2, x1 = 1.0, y0 = .95, y1 = 2.05;
      bx(x0 + 2.25, H, .1, wallM, (-2.25 + x0) / 2, H / 2, wz); bx(2.25 - x1, H, .1, wallM, (x1 + 2.25) / 2, H / 2, wz);
      bx(x1 - x0, y0, .1, wallM, (x0 + x1) / 2, y0 / 2, wz); bx(x1 - x0, H - y1, .1, wallM, (x0 + x1) / 2, (H + y1) / 2, wz);
      bx(.1, H, 3.5, wallM, -2.25, H / 2, 0);
      [[x1 - x0 + .08, .05, (x0 + x1) / 2, y0], [x1 - x0 + .08, .05, (x0 + x1) / 2, y1]].forEach(([w, h, x, y]) => bx(w, h, .14, white, x, y, wz));
      [x0, x1].forEach(x => bx(.05, y1 - y0, .14, white, x, (y0 + y1) / 2, wz));
      const sash = new THREE.Group(); sash.position.set(x0, 0, wz + .05); sc.add(sash); this.sash = sash;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - .04, y1 - y0 - .04, .02), new THREE.MeshStandardMaterial({ color: 0xbfd9e6, transparent: true, opacity: .35 }));
      pane.position.set((x1 - x0) / 2, (y0 + y1) / 2, 0); sash.add(pane);
      [[x1 - x0, .04, (x1 - x0) / 2, y0 + .02], [x1 - x0, .04, (x1 - x0) / 2, y1 - .02], [.04, y1 - y0, .02, (y0 + y1) / 2], [.04, y1 - y0, x1 - x0 - .02, (y0 + y1) / 2]]
        .forEach(([w, h, x, y]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), white); f.position.set(x, y, 0); sash.add(f); });
      // radiator under the window
      this.radM = M(0xf3efe6, { roughness: .4, metalness: .2 }); this.fins = [];
      for (let i = 0; i < 9; i++) this.fins.push(bx(.07, .58, .09, this.radM, (x0 + x1) / 2 - .44 + i * .11, .45, wz + .14));
      bx(1.0, .04, .05, this.radM, (x0 + x1) / 2, .16, wz + .14); bx(1.0, .04, .05, this.radM, (x0 + x1) / 2, .74, wz + .14);
      // wall thermostat with a live display
      const tb = bx(.03, .16, .12, white, -2.18, 1.45, .2);
      this.cv = document.createElement('canvas'); this.cv.width = 128; this.cv.height = 96; this.tex = new THREE.CanvasTexture(this.cv);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(.1, .075), new THREE.MeshBasicMaterial({ map: this.tex })); disp.rotation.y = Math.PI / 2; disp.position.set(-2.16, 1.46, .2); sc.add(disp);
      this.thermo = tb;
      // living room: sofa, rug, plant, lamp, frame (shared props)
      const sage = M(0x8fae8b, { roughness: .9, metalness: 0 });
      bx(.8, .4, 1.8, sage, -1.6, .2, .55); bx(.2, .45, 1.8, sage, -1.95, .62, .55); bx(.8, .6, .2, sage, -1.6, .3, -.25); bx(.8, .6, .2, sage, -1.6, .3, 1.35);
      if (typeof PROPS === 'object') {
        const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; sc.add(o); };
        put(PROPS.rug(1.1), .4, 0, .1); put(PROPS.plant(1.4), -1.85, 0, -1.35); put(PROPS.lamp(), 1.9, 0, -1.3);
        put(PROPS.frame(0x7d9bb5, .6, .45), -2.18, 1.6, -.8, Math.PI / 2); put(PROPS.books(), 1.9, 0, .4);
      }
      // air tint, heat plume and cold draft
      this.air = new THREE.Mesh(new THREE.BoxGeometry(4.3, 2.5, 3.3), new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: .035, depthWrite: false }));
      this.air.position.set(0, 1.25, 0); sc.add(this.air);
      this.hN = 90; this.heat = new THREE.InstancedMesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8854a }), this.hN); sc.add(this.heat);
      this.hp = [...Array(this.hN)].map(() => [(x0 + x1) / 2 + (Math.random() - .5) * .9, Math.random() * 1.6, wz + .2 + Math.random() * .4, Math.random()]);
      this.cN = 50; this.draft = new THREE.InstancedMesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fc4d8 }), this.cN); sc.add(this.draft);
      this.cp = [...Array(this.cN)].map(() => [x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), Math.random() * 2.5]);
      this.scene = sc; this.cam = { p: [2.9, 2.3, 3.9], t: [-.3, 1.0, -.9] };
      this.tc = 0; this.speed = 1800; this.lastTxt = '';
    },
    update() {
      const r = this.r = TP.simulate(this.s), s = this.s, ctl = TP.MODES[s.mode];
      tiles([
        { l: 'Time to set point', v: r.rise >= 360 ? 'never' : fmt(r.rise), u: r.rise >= 360 ? '' : 'min', e: 'within 0.5 K' },
        { l: 'Overshoot', v: fmt(r.overshoot, 2), u: 'K', cls: r.overshoot > 1 ? 'bad' : r.overshoot > .3 ? 'warn' : 'good', e: 'before the window opens' },
        { l: 'Settling time', v: fmt(r.settle), u: 'min', e: 'stays within 0.3 K after this' },
        { l: 'Steady error', v: fmt(r.sse, 2), u: 'K', cls: r.sse > .3 ? 'warn' : '', e: 'mean, 2:00 to 3:00' },
        { l: 'Swing', v: fmt(r.band, 2), u: 'K', e: 'largest error, 1:30 to 3:00' },
        { l: s.mode === 0 ? 'Switching' : 'Controller', v: s.mode === 0 ? fmt(r.swPerH, 1) : ctl, u: s.mode === 0 ? '/h' : '', cls: s.mode === 0 && r.swPerH > 6 ? 'bad' : '', e: s.mode === 0 ? 'relay clicks per hour' : `Kp ${Math.round(s.Kp * 100)} %/K` },
        { l: 'Window recovery', v: s.win ? (r.recover >= 160 ? 'never' : fmt(r.recover)) : 'off', u: s.win && r.recover < 160 ? 'min' : '', e: 'back within 0.3 K' },
        { l: 'Energy, 6 h', v: fmt(r.kWh, 1), u: 'kWh', e: `≈ $${fmt(r.kWh * .17, 2)} at $0.17/kWh` },
      ]);
      $('#alarm').hidden = !(r.overshoot > 1 || (s.mode === 0 && r.swPerH > 6)); $('#alarm').textContent = r.overshoot > 1 ? 'Overshoot' : 'Short cycling';
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, s = this.s, g = TP.simulate(optOf(this)), all = r.pts.concat(g.pts);
      const lo = Math.floor(Math.min(...all.map(p => p[1])) - .5), hi = Math.max(s.sp + 2, Math.ceil(Math.max(...all.map(p => p[1])) + .5));
      const win = s.win ? (X, Y, y0, y1) => `<rect x="${X(3)}" y="${Y(y1)}" width="${X(3 + 1 / 3) - X(3)}" height="${Y(y0) - Y(y1)}" style="fill:color-mix(in srgb,var(--cold) 18%,transparent)"/><text class="lbl-acc" x="${X(3) + 3}" y="${Y(y1) + 12}">window</text>` : () => '';
      this.c1 = chart($('#c1'), { x: [0, 6], y: [lo, hi], xt: [0, 1, 2, 3, 4, 5, 6], xlab: 'Time (h)', ylab: 'Temperature (°C)',
        body: (X, Y) => win(X, Y, lo, hi) +
          (s.mode === 0 ? `<rect x="${X(0)}" y="${Y(s.sp + s.band / 2)}" width="${X(6) - X(0)}" height="${Y(s.sp - s.band / 2) - Y(s.sp + s.band / 2)}" style="fill:color-mix(in srgb,var(--accent) 12%,transparent)"/>` : '') +
          `<line class="s-ink dash" x1="${X(0)}" x2="${X(6)}" y1="${Y(s.sp)}" y2="${Y(s.sp)}"/><text class="lbl" x="${X(6) - 3}" y="${Y(s.sp) - 5}" text-anchor="end">set point ${s.sp} °C</text>` +
          `<path class="ghost" d="${path(g.pts.map(p => [p[0], p[1]]), X, Y)}"/><path class="s-mut dash" d="${path(r.pts.map(p => [p[0], p[2]]), X, Y)}"/><path class="s-acc" d="${path(r.pts.map(p => [p[0], p[1]]), X, Y)}"/>` });
      const pk = s.Pmax / 1000 * 1.08;
      this.c2 = chart($('#c2'), { x: [0, 6], y: [0, pk], xt: [0, 1, 2, 3, 4, 5, 6], xlab: 'Time (h)', ylab: 'Heater power (kW)',
        body: (X, Y) => win(X, Y, 0, pk) + `<path class="s-mut dash" d="${path(r.pts.map(p => [p[0], p[4] / 1000]), X, Y)}"/><path class="s-hot" d="${path(r.pts.map(p => [p[0], p[3] / 1000]), X, Y)}"/>` });
    },
    drawDisplay(Ts, sp, on) {
      const txt = `${Ts.toFixed(1)}|${sp}|${on}`; if (txt === this.lastTxt) return; this.lastTxt = txt;
      const c = this.cv.getContext('2d'); c.fillStyle = '#1f2a26'; c.fillRect(0, 0, 128, 96);
      c.fillStyle = '#e9f5e8'; c.font = 'bold 40px monospace'; c.fillText(Ts.toFixed(1) + '°', 8, 50);
      c.font = '18px monospace'; c.fillStyle = '#a6d4b0'; c.fillText('set ' + sp, 8, 82);
      if (on) { c.fillStyle = '#f08a5d'; c.beginPath(); c.arc(108, 76, 9, 0, 7); c.fill(); }
      this.tex.needsUpdate = true;
    },
    frame(dt) {
      const r = this.r; if (!r || !this.sash) return;
      this.tc = (this.tc + dt * this.speed / 3600) % 6;  // hours of simulated time
      const p = r.pts[Math.min(r.pts.length - 1, Math.floor(this.tc / 6 * r.pts.length))], frac = p[3] / this.s.Pmax;
      moveDot(this.c1, p[0], p[1]); moveDot(this.c2, p[0], p[3] / 1000);
      this.sash.rotation.y = -(p[5] ? 1.1 : 0);
      this.radM.emissive.setRGB(.7 * frac, .25 * frac, .05 * frac);
      tColor(p[1], this.air.material.color);
      this.drawDisplay(p[2], this.s.sp, p[4] > 0 ? 1 : 0);
      const m = new THREE.Matrix4(), shown = Math.round(this.hN * frac);
      this.hp.forEach((h, i) => {
        h[1] += dt * (.25 + .35 * frac); h[2] += dt * .12; if (h[1] > 2.4) { h[1] = .75; h[2] = -1.55 + Math.random() * .3; }
        m.makeTranslation(h[0] + Math.sin(h[1] * 3 + i) * .05, i < shown ? h[1] : -10, h[2]); this.heat.setMatrixAt(i, m);
      });
      this.heat.instanceMatrix.needsUpdate = true;
      this.cp.forEach((c, i) => { c[2] += dt * .5; if (c[2] > 2.5) c[2] = 0; m.makeTranslation(c[0], p[5] ? c[1] - c[2] * .35 : -10, -1.7 + c[2]); this.draft.setMatrixAt(i, m); });
      this.draft.instanceMatrix.needsUpdate = true;
      const hh = Math.floor(p[0]), mm = Math.floor((p[0] - hh) * 60);
      $('#caption').textContent = `${hh}:${String(mm).padStart(2, '0')} · room ${fmt(p[1], 1)} °C · sensor ${fmt(p[2], 1)} °C · heater ${fmt(p[3] / 1000, 2)} kW${p[5] ? ' · window open' : ''} · ×${this.speed}`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      this.thermo.material.emissive.setHex(k === 'sensor' ? 0x335544 : 0);
      this.fins.forEach(f => f.scale.z = k === 'heater' ? 1.3 : 1);
      this.sash.children[0].material.opacity = k === 'window' ? .7 : .35;
    },
    extra() {
      $('#extra').innerHTML = '';
      const speeds = [600, 1800, 3600];
      stageButtons([
        { id: 'tsSpeed', l: `Fast-forward ×${this.speed}`, f: e => { this.speed = speeds[(speeds.indexOf(this.speed) + 1) % 3]; e.textContent = `Fast-forward ×${this.speed}`; } },
        { id: 'tsRestart', l: 'Restart day', f: () => { this.tc = 0; } },
      ]);
    },
    notes: [
      'Room: one lumped heat capacity C = 400 kJ/K (air plus fast contents, est.) and heat loss UA = 60 W/K (est., a well-insulated room); time constant C/UA ≈ 1.9 h. Start at 15 °C.',
      'Heater: 2 kW electric radiator, first-order lag 5 min (est.). Sensor: first-order lag 2 min (est.). The window adds 150 W/K for 20 min from 3:00 (est.).',
      'Controllers: on/off with hysteresis band; PID in standard form u = Kp·(e + (1/Ti)∫e dt − Td·dT_sensor/dt), output limited to 0–100 %, derivative on the measurement. Anti-windup = conditional integration.',
      'Check against textbook behaviour: P alone leaves a steady-state offset; adding I removes it; Ziegler–Nichols tuning from the ultimate gain gives an aggressive, overshooting response (Ziegler & Nichols 1942; Åström & Hägglund, PID Controllers, 1995).',
      'Energy cost uses $0.17/kWh (est.).',
    ],
  };
  registerLab(lab);
})(globalThis);
