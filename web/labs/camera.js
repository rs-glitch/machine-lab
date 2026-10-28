// Camera lab: thin lens, depth of field and the exposure triangle.
// Pure physics in CamPhys (testable in Node); the lab object registers only in the browser.
(function (G) {
  const CP = {
    SENS: [['Phone (1/1.3")', 3.6, 9.8], ['APS-C', 1.53, 23.5], ['Full frame', 1, 36]],  // name, crop factor, sensor width mm
    N: [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22],
    T: [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1],
    ISO: [100, 200, 400, 800, 1600, 3200, 6400, 12800],
    SCENE: [['Bright sun', 15], ['Overcast day', 12], ['Room at home', 7], ['Night street', 4]],  // EV at ISO 100 (typical table values)
    SUBJ: [['Flower', 1], ['Person', 3], ['Tree', 12]],  // name, distance m
    PX: 6000, LAMBDA: 550e-9, COC_FF: 0.03e-3,
    dist: k => .3 * Math.pow(100, k / 60),  // focus slider index -> metres (0.3 m to 30 m, log steps)
    tlabel: t => t >= 1 ? `${t} s` : `1/${Math.round(1 / t)} s`,
    solve(s) {
      const [sname, crop, wmm] = CP.SENS[s.sensor], f = s.feq / crop / 1000, N = CP.N[s.n], t = CP.T[s.t], iso = CP.ISO[s.iso], ev = CP.SCENE[s.scene][1];
      const c = CP.COC_FF / crop, S = Math.max(CP.dist(s.focus), f * 1.5), H = f * f / (N * c) + f;  // DOFMaster equations
      const near = S * (H - f) / (H + S - 2 * f), far = S < H ? S * (H - f) / (H - S) : Infinity;
      const blur = d => f * f / (N * (S - f)) * Math.abs(d - S) / d;  // defocus blur circle on the sensor, m
      const subj = CP.SUBJ.map(([n, d]) => ({ n, d, b: blur(d), k: blur(d) / c }));
      const airy = 2.44 * CP.LAMBDA * N;  // diffraction spot diameter, m
      const evCam = Math.log2(N * N / t), err = ev + Math.log2(iso / 100) - evCam;  // + = too bright (stops)
      const mblur = s.speed * t * f / (3 - f) / (wmm / 1000) * CP.PX;  // runner at 3 m, blur in pixels on a 6000 px image
      const noise = Math.sqrt(iso / 100) * crop;  // est.: relative shot noise against full frame at ISO 100
      const shake = t > 1 / s.feq;  // reciprocal rule for hand-held shots
      return { s, sname, crop, wmm, f, N, t, iso, ev, c, S, H, near, far, subj, airy, airyK: airy / c, evCam, err, mblur, noise, shake, D: f / N };
    },
  };
  // missions (also used by the Node test)
  CP.M = {
    portrait: r => r.subj[1].k <= 1 && r.subj[2].k >= 5 && Math.abs(r.err) <= .5,
    freeze: r => r.s.speed >= 5 && r.mblur <= 2 && Math.abs(r.err) <= .5 && r.s.scene >= 1 && r.subj[1].k <= 1,
    allSharp: r => r.subj.every(q => q.k <= 1) && r.airy <= r.c,
  };
  G.CamPhys = CP;
  if (typeof registerLab !== 'function') return;  // Node: physics only

  const SUBJ_Z = [.95, 1.8, 3.2], SUBJ_X = [.22, -.12, .35], SUBJ_COL = [0xe07fa0, 0xe0884a, 0x6f9a62];
  const ZA = .30, ZS = -.08, BODY_Z = -.15;  // aperture plane, sensor plane, body back (scene units)
  const cam = {
    id: 'camera', tab: 'Camera',
    charts: ['Depth of field against focus distance', 'The band shows what is sharp. Lines: flower 1 m, person 3 m, tree 12 m. Green dashed: optimal preset.',
      'Exposure against shutter speed', 'Zero is a correct exposure. Red zone: the runner or your hand blurs the photo.'],
    eyebrow: 'Lab 11 · Lenses, depth of field and exposure', concept: 'A lens bends light to a point; only one distance is truly sharp',
    text: 'A lens makes an image of each object at a distance that depends on the object distance (1/f = 1/u + 1/v). The sensor can sit at only one of those places. Objects nearer or farther make small blur circles. A small aperture makes the cones of light thin, so the blur circles shrink and more of the scene looks sharp.',
    home: 'For a blurry background, use a wide aperture (small f-number), a long lens, and get close. For a sharp landscape, use f/8 to f/11 and focus a little into the scene.',
    s: { sensor: 2, feq: 50, n: 4, focus: 30, t: 5, iso: 0, scene: 1, speed: 0 },
    sliders: [
      { k: 'sensor', label: 'Sensor', min: 0, max: 2, step: 1, fmt: v => CP.SENS[v][0] },
      { k: 'feq', label: 'Focal length (35 mm equivalent)', min: 14, max: 200, step: 2, unit: 'mm' },
      { k: 'n', label: 'Aperture', min: 0, max: 8, step: 1, fmt: v => 'f/' + CP.N[v] },
      { k: 'focus', label: 'Focus distance', min: 0, max: 60, step: 1, fmt: v => fmt(CP.dist(v), CP.dist(v) < 3 ? 2 : 1) + ' m' },
      { k: 't', label: 'Shutter speed', min: 0, max: 12, step: 1, fmt: v => CP.tlabel(CP.T[v]) },
      { k: 'iso', label: 'ISO', min: 0, max: 7, step: 1, fmt: v => CP.ISO[v] },
      { k: 'scene', label: 'Light', min: 0, max: 3, step: 1, fmt: v => CP.SCENE[v][0] },
      { k: 'speed', label: 'Runner speed', min: 0, max: 10, step: .5, unit: 'm/s' },
    ],
    presets: [
      { n: 'Sharp landscape (hyperfocal)', kind: 'opt', s: { sensor: 2, feq: 24, n: 5, focus: 28, t: 3, iso: 0, scene: 0, speed: 0 }, note: '24 mm at f/8, focused just past the hyperfocal distance (about 2.5 m). Everything from about 1.2 m to infinity is sharp, and the light is exactly right.' },
      { n: 'Phone snapshot', kind: 'typ', s: { sensor: 0, feq: 26, n: 1, focus: 30, t: 2, iso: 0, scene: 1, speed: 0 }, note: 'A small sensor and a short real focal length (about 7 mm) give a huge depth of field. That is why phones need software to fake a blurry background.' },
      { n: 'Indoor sport, too slow', kind: 'edge', s: { sensor: 2, feq: 86, n: 2, focus: 30, t: 7, iso: 0, scene: 2, speed: 6 }, note: 'Room light is about 250 times dimmer than sun. At 1/30 s the runner smears across hundreds of pixels, and the photo is still a little dark.' },
      { n: 'Tiny aperture f/22', kind: 'edge', s: { sensor: 1, feq: 50, n: 8, focus: 30, t: 6, iso: 0, scene: 0, speed: 0 }, note: 'At f/22 the light spreads by diffraction into a spot larger than the sharpness limit. The whole photo goes soft, even where it is in focus.' },
      { n: 'Focus missed (85 mm f/1.4)', kind: 'edge', s: { sensor: 2, feq: 86, n: 0, focus: 21, t: 1, iso: 0, scene: 1, speed: 0 }, note: 'The depth of field at f/1.4 is only a few centimetres. Focus at 1.5 m and the person at 3 m is a soft blob.' },
    ],
    missions: [
      { t: 'Blur the background', d: 'Make the person sharp and the tree blurred by 5 times the sharpness limit or more, with a correct exposure (±0.5 stop).', win: 'Done. Long lens, wide aperture: the cone of light from the tree is wide when it reaches the sensor.',
        check: r => CP.M.portrait(r) },
      { t: 'Freeze the runner', d: 'Runner at 5 m/s or more, cloudy or darker light. Keep motion blur at 2 px or less, the person sharp, and the exposure correct.', win: 'Done. A fast shutter freezes motion. You pay with a wider aperture or a higher ISO, so more noise.',
        check: r => CP.M.freeze(r) },
      { t: 'Everything sharp', d: 'Make the flower (1 m), the person (3 m) and the tree (12 m) all sharp, and keep diffraction below the sharpness limit.', win: 'Done. Short lens, middle aperture, focus at the hyperfocal distance. Close the aperture too far and diffraction wins.',
        check: r => CP.M.allSharp(r) },
    ],
    chipsList: [{ k: 'lens', l: 'Lens', c: '#7d9bb5' }, { k: 'aperture', l: 'Aperture', c: '#3d3833' }, { k: 'sensor', l: 'Sensor', c: '#4f8a4a' }],
    partInfo: {
      lens: 'Lens: glass bends light so that all rays from one point meet again at one point behind the lens. A longer focal length makes a bigger image and a shallower depth of field.',
      aperture: 'Aperture: the blades set the hole size. f-number = focal length ÷ hole diameter. Each full stop (f/4 to f/5.6) halves the light and makes the blur circles smaller.',
      sensor: 'Sensor: millions of pixels count photons. A blur circle smaller than the sharpness limit (0.03 mm on full frame) looks sharp. Fewer photons per pixel means more noise.',
    },
    decor: { u: 1, y: -.6, set: 'park' },
    build() {
      const sc = new THREE.Scene(); lights(sc);
      const ground = new THREE.Mesh(new THREE.BoxGeometry(3, .02, 5), M(0xcfd8b0, { roughness: .9, metalness: 0 })); ground.position.set(0, -.61, 1.4); sc.add(ground);
      // body (glass cutaway), lens barrel, elements, aperture blades, sensor, rear screen
      const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .36, .3), M(0x3d3833, { transparent: true, opacity: .22, depthWrite: false })); body.position.z = 0; sc.add(body);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(.1, .3, .12), M(0x3d3833, { roughness: .8 })); grip.position.set(-.22, -.02, .08); sc.add(grip);
      const top = new THREE.Mesh(new THREE.BoxGeometry(.18, .08, .16), M(0x3d3833, { roughness: .7 })); top.position.set(0, .22, 0); sc.add(top);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .32, 40, 1, true), M(0x2c2a28, { transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide }));
      barrel.rotation.x = Math.PI / 2; barrel.position.z = .31; sc.add(barrel);
      this.elements = [.22, .36, .45].map((z, i) => { const e = new THREE.Mesh(new THREE.SphereGeometry(.12, 32, 16), M(0xbfd9e6, { transparent: true, opacity: .35, depthWrite: false, metalness: .1, roughness: .1 }));
        e.scale.set(1, 1, i === 1 ? .12 : .22); e.position.z = z; sc.add(e); return e; });
      this.blades = [...Array(7)].map((_, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.12, .06, .006), M(0x2a2622, { roughness: .6 }));
        const g = new THREE.Group(); g.add(b); g.rotation.z = i / 7 * Math.PI * 2; g.position.z = ZA; sc.add(g); return g; });
      this.sensor = new THREE.Mesh(new THREE.BoxGeometry(.14, .095, .008), M(0x2e4a3a, { roughness: .4, metalness: .3 })); this.sensor.position.z = ZS; sc.add(this.sensor);
      this.lcdCanvas = document.createElement('canvas'); this.lcdCanvas.width = 256; this.lcdCanvas.height = 170;
      this.lcdTex = new THREE.CanvasTexture(this.lcdCanvas);
      const lcd = new THREE.Mesh(new THREE.PlaneGeometry(.3, .2), new THREE.MeshBasicMaterial({ map: this.lcdTex })); lcd.position.set(.04, 0, BODY_Z - .002); lcd.rotation.y = Math.PI; sc.add(lcd);
      // tripod
      [0, 1, 2].forEach(i => { const a = i / 3 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1, 8), M(0x3d3833));
        stretch(leg, V3(0, -.18, 0), V3(Math.cos(a) * .3, -.6, Math.sin(a) * .3)); sc.add(leg); });
      // subjects: flower, person (runner), tree
      const flower = new THREE.Group(), stem = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .3, 6), M(0x4f8a4a)); stem.position.y = .15; flower.add(stem);
      for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), M(SUBJ_COL[0])); const a = i / 6 * Math.PI * 2; p.position.set(Math.cos(a) * .04, .31 + Math.sin(a) * .04, 0); flower.add(p); }
      const ctr = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), M(0xf2c14e)); ctr.position.set(0, .31, .01); flower.add(ctr);
      const person = new THREE.Group(), torso = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .36, 14), M(SUBJ_COL[1])); torso.position.y = .42; person.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.065, 16, 12), M(0xe8c0a0)); head.position.y = .67; person.add(head);
      [-.04, .04].forEach(x => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .26, 8), M(0x3f5f86)); leg.position.set(x, .13, 0); person.add(leg); });
      const tree = new THREE.Group(), trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .5, 10), M(0x8a6a4a)); trunk.position.y = .25; tree.add(trunk);
      [[0, .7, 0, .3], [.15, .85, 0, .22], [-.12, .9, .05, .2]].forEach(([x, y, z, r]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(SUBJ_COL[2])); b.position.set(x, y, z); tree.add(b); });
      this.subj = [flower, person, tree].map((g, i) => { g.position.set(SUBJ_X[i], -.6, SUBJ_Z[i]); sc.add(g); return g; });
      // light rays: subject -> aperture edge -> through the image point -> sensor; blur spots on the sensor
      this.rays = SUBJ_COL.map(c => { const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c })); sc.add(l); return l; });
      this.spots = SUBJ_COL.map(c => { const r = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 32), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); r.position.z = ZS + .006; sc.add(r); return r; });
      this.apR = .05; this.run = 0;
      this.scene = sc; this.cam = { p: [-1.35, .55, -1.15], t: [0, 0, .9] };
    },
    apTarget() { const r = this.r; return Math.min(.11, .012 + .1 * Math.sqrt(r.D / .06)); },  // aperture radius drawn
    drawRays() {
      const r = this.r, a = this.apR, inv = d => 1 / (1 / r.f - 1 / d), vs = inv(r.S), EX = 9;  // EX exaggerates focus shifts so the eye can see them
      r.subj.forEach((q, i) => {
        const vk = inv(q.d), zk = ZA - (ZA - ZS) * (1 + (vk - vs) / vs * EX * (r.f / .05));
        const src = this.subj[i].position.clone().add(V3(0, i === 2 ? .7 : i === 1 ? .45 : .31, 0)), pts = [];
        [[a, 0], [-a, 0], [0, a], [0, -a]].forEach(([x, y]) => {
          const e = V3(x, y, ZA), cpt = V3(0, 0, zk), u = (ZA - ZS) / Math.max(.02, ZA - zk), s = e.clone().add(cpt.clone().sub(e).multiplyScalar(u));
          pts.push(src.x, src.y, src.z, e.x, e.y, e.z, e.x, e.y, e.z, s.x, s.y, s.z);
        });
        this.rays[i].geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); this.rays[i].geometry.computeBoundingSphere();
        const rad = Math.max(.003, Math.min(.06, a * Math.abs(zk - ZS) / Math.max(.02, ZA - zk)));
        this.spots[i].scale.set(rad, rad, 1); this.spots[i].position.x = (i - 1) * .002;
      });
    },
    drawLCD() {  // the photo as the sensor would record it
      const r = this.r, g = this.lcdCanvas.getContext('2d'), W = 256, H = 170, px = b => Math.min(14, b / (r.wmm / 1000) * W * 1.2);
      const gain = Math.pow(2, Math.max(-4, Math.min(4, r.err)));
      g.filter = 'none'; g.fillStyle = '#9fc7e0'; g.fillRect(0, 0, W, H); g.fillStyle = '#b9cf8e'; g.fillRect(0, H * .62, W, H);
      const draw = (i, fn) => { g.filter = `blur(${px(r.subj[i].b + (r.airy > r.c ? r.airy : 0)).toFixed(1)}px)`; fn(); };
      draw(2, () => { g.fillStyle = '#8a6a4a'; g.fillRect(170, 60, 8, 50); g.fillStyle = '#6f9a62'; g.beginPath(); g.arc(174, 52, 26, 0, 7); g.fill(); });
      draw(1, () => { const n = Math.max(1, Math.min(12, Math.round(r.mblur / 40))); for (let k = 0; k < n; k++) { g.globalAlpha = 1 / n + .1; const x = 110 + k * Math.min(6, r.mblur / 40);
        g.fillStyle = '#e0884a'; g.fillRect(x - 10, 70, 20, 40); g.fillStyle = '#e8c0a0'; g.beginPath(); g.arc(x, 62, 9, 0, 7); g.fill(); g.fillStyle = '#3f5f86'; g.fillRect(x - 9, 110, 18, 22); } g.globalAlpha = 1; });
      draw(0, () => { g.fillStyle = '#4f8a4a'; g.fillRect(58, 120, 4, 50); g.fillStyle = '#e07fa0'; g.beginPath(); g.arc(60, 116, 16, 0, 7); g.fill(); g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(60, 116, 6, 0, 7); g.fill(); });
      g.filter = 'none';
      if (gain > 1) { g.fillStyle = `rgba(255,255,255,${Math.min(.9, 1 - 1 / gain)})`; g.fillRect(0, 0, W, H); } else { g.fillStyle = `rgba(0,0,0,${Math.min(.9, 1 - gain)})`; g.fillRect(0, 0, W, H); }
      const nz = Math.min(.5, (r.noise - 1) * .05); if (nz > 0) for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},${nz})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      this.lcdTex.needsUpdate = true;
    },
    update() {
      const r = this.r = CP.solve(this.s), q = r.subj, k = v => v <= 1 ? 'good' : v <= 3 ? 'warn' : 'bad';
      tiles([
        { l: 'Exposure', v: (r.err >= 0 ? '+' : '') + fmt(r.err, 1), u: 'stops', cls: Math.abs(r.err) <= .5 ? 'good' : Math.abs(r.err) <= 1.5 ? 'warn' : 'bad', e: r.err > .5 ? 'too bright' : r.err < -.5 ? 'too dark' : 'correct' },
        { l: 'Sharp zone', v: `${fmt(r.near, r.near < 3 ? 2 : 1)}–${r.far === Infinity ? '∞' : fmt(r.far, 1)}`, u: 'm', e: `hyperfocal ${fmt(r.H, 1)} m` },
        { l: 'Flower blur', v: fmt(q[0].k, 1), u: '× limit', cls: k(q[0].k), e: '1 m away' },
        { l: 'Person blur', v: fmt(q[1].k, 1), u: '× limit', cls: k(q[1].k), e: '3 m away' },
        { l: 'Tree blur', v: fmt(q[2].k, 1), u: '× limit', cls: q[2].k >= 5 ? 'good' : '', e: '12 m away' },
        { l: 'Motion blur', v: fmt(Math.min(r.mblur, 9999)), u: 'px', cls: r.mblur > 2 ? 'bad' : '', e: r.shake ? 'hand shake likely' : `runner ${this.s.speed} m/s` },
        { l: 'Diffraction', v: fmt(r.airyK, 2), u: '× limit', cls: r.airyK > 1 ? 'bad' : r.airyK > .7 ? 'warn' : '', e: `spot ${fmt(r.airy * 1e6, 1)} µm` },
        { l: 'Noise', v: fmt(r.noise, 1), u: '×', cls: r.noise > 8 ? 'bad' : r.noise > 4 ? 'warn' : '', e: 'against full frame ISO 100 (est.)' },
      ]);
      $('#alarm').hidden = Math.abs(r.err) <= 2; $('#alarm').textContent = r.err > 0 ? 'Photo burnt out' : 'Photo too dark';
      if (this.rays) { this.drawRays(); this.drawLCD(); }
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, s = this.s, o = CP.solve(optOf(this)), cl = v => Math.min(100, Math.max(.3, v)), band = [], gN = [], gF = [];
      for (let k = 0; k <= 60; k++) { const q = CP.solve(Object.assign({}, s, { focus: k })), g = CP.solve(Object.assign({}, o.s, { focus: k }));
        band.push([q.S, cl(q.near), cl(q.far)]); gN.push([g.S, cl(g.near)]); gF.push([g.S, cl(g.far)]); }
      this.c1 = chart($('#c1'), { x: [.3, 30], y: [.3, 100], xlog: true, ylog: true, xt: [.3, 1, 3, 10, 30], yt: [.3, 1, 3, 10, 30, 100], xlab: 'Focus distance (m)', ylab: 'Distance that is sharp (m)',
        body: (X, Y) => `<path d="${path(band.map(b => [b[0], b[2]]).concat(band.slice().reverse().map(b => [b[0], b[1]])), X, Y)}Z" style="fill:color-mix(in srgb,var(--cold) 22%,transparent)"/>` +
          `<path class="s-mut dash" d="${path([[.3, .3], [30, 30]], X, Y)}"/><path class="ghost" d="${path(gN, X, Y)}"/><path class="ghost" d="${path(gF, X, Y)}"/>` +
          CP.SUBJ.map(([n, d], i) => `<line class="s-mut" x1="${X(.3)}" x2="${X(30)}" y1="${Y(d)}" y2="${Y(d)}" style="opacity:.6"/><text class="lbl" x="${X(.32)}" y="${Y(d) - 3}">${n}</text>`).join('') +
          `<text class="lbl-acc" x="${X(29)}" y="${Y(90) + 10}" text-anchor="end">∞ above here</text>` });
      moveDot(this.c1, r.S, r.S);
      const lines = [], gl = [];
      CP.T.forEach((t, i) => { const q = CP.solve(Object.assign({}, s, { t: i })), g = CP.solve(Object.assign({}, o.s, { t: i })); lines.push([1 / t, Math.max(-8, Math.min(8, q.err))]); gl.push([1 / t, Math.max(-8, Math.min(8, g.err))]); });
      const lim = CP.T.map((t, i) => CP.solve(Object.assign({}, s, { t: i }))).filter(q => q.mblur > 2 || q.shake).map(q => 1 / q.t), xmax = lim.length ? Math.max(...lim) : 0;
      this.c2 = chart($('#c2'), { x: [1, 4000], y: [-8, 8], xlog: true, xt: [1, 8, 60, 500, 4000], yt: [-8, -4, -2, 0, 2, 4, 8], xlab: 'Shutter speed (1/x s)', ylab: 'Exposure (stops, + = too bright)',
        body: (X, Y) => (xmax ? `<rect class="f-bad" x="${X(1)}" y="${Y(8)}" width="${X(Math.min(4000, xmax * 1.1)) - X(1)}" height="${Y(-8) - Y(8)}"/><text class="lbl-bad" x="${X(1.1)}" y="${Y(8) + 12}">blur</text>` : '') +
          `<rect x="${X(1)}" y="${Y(.5)}" width="${X(4000) - X(1)}" height="${Y(-.5) - Y(.5)}" style="fill:color-mix(in srgb,var(--ok) 18%,transparent)"/>` +
          `<path class="ghost" d="${path(gl, X, Y)}"/><path class="s-acc" d="${path(lines, X, Y)}"/>` });
      moveDot(this.c2, 1 / r.t, Math.max(-8, Math.min(8, r.err)));
    },
    frame(dt) {
      if (!this.r || !this.rays) return;
      const tgt = this.apTarget(); this.apR += (tgt - this.apR) * Math.min(1, dt * 6);
      this.blades.forEach(b => { b.children[0].position.set(this.apR + .06, 0, 0); b.children[0].rotation.z = .45; });
      if (Math.abs(tgt - this.apR) > 1e-4) this.drawRays();
      this.run += dt * this.s.speed * .08; const x = SUBJ_X[1] + Math.sin(this.run) * (this.s.speed ? .35 : 0);
      this.subj[1].position.x = x;
      const r = this.r;
      $('#caption').textContent = `${CP.SENS[this.s.sensor][0]} · ${fmt(r.f * 1000, 1)} mm real focal length · f/${r.N} · ${CP.tlabel(r.t)} · ISO ${r.iso} · rays drawn with exaggerated focus shift`;
    },
    pick(k) {
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text;
      const em = (list, on) => list.forEach(m => m.material.emissive && m.material.emissive.setHex(on ? 0x335533 : 0));
      em(this.elements, k === 'lens'); em(this.blades.map(b => b.children[0]), k === 'aperture'); em([this.sensor], k === 'sensor');
    },
    extra() { $('#extra').innerHTML = ''; },
    notes: [
      'Thin lens: 1/f = 1/u + 1/v. Depth of field and hyperfocal distance: H = f²/(N·c) + f, near = s(H−f)/(H+s−2f), far = s(H−f)/(H−s) (DOFMaster equations, https://www.dofmaster.com/equations.html).',
      'Circle of confusion c = 0.030 mm on full frame, divided by the crop factor (1.53 APS-C, 3.6 for a 1/1.3" phone sensor, est.). Check: 50 mm at f/8 on full frame gives a hyperfocal distance of 10.4 m.',
      'Exposure: correct when log2(N²/t) = EV100 + log2(ISO/100). Scene EV100: sun 15, overcast 12, home room 7, night street 4 (typical table values, est.). Check: the "sunny 16" rule (f/16, 1/125 s, ISO 100) gives 0.0 stop.',
      'Diffraction spot (Airy disc) diameter = 2.44·λ·N with λ = 550 nm. Motion blur: runner at 3 m, image of 6000 px across the sensor width. Noise index = √(ISO/100) × crop factor (est., photon shot noise only).',
      'The 3D rays are schematic: the shift of each image point is drawn about 9 times larger than real so it is visible.',
    ],
  };
  registerLab(cam);
})(globalThis);
