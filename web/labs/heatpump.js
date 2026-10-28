// Heat pump lab: reversible R-290 vapour-compression cycle (winter heating, summer cooling).
// Physics first (pure, Node-testable as globalThis.HPPhys), then the UI lab that calls registerLab().
// index.html does not list the property table, so load it here, before boot() runs.
if (typeof document !== 'undefined' && !globalThis.HP_R290) document.write('<script src="labs/heatpump-data.js"><\/script>');

globalThis.HPPhys = (function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const T = () => globalThis.HP_R290;
  function satAt(Tc) {
    const S = T().sat; Tc = clamp(Tc, S.T[0], S.T[S.T.length - 1]);
    const i = clamp(Math.floor(Tc - S.T[0]), 0, S.T.length - 2), f = Tc - S.T[i], L = k => S[k][i] + (S[k][i + 1] - S[k][i]) * f;
    return { T: Tc, P: L('P'), hf: L('hf'), hg: L('hg'), sf: L('sf'), sg: L('sg'), vg: L('vg') };
  }
  function shAt(Tsat, dT, k) {
    const S = T().sat, H = T().sh;
    const i = clamp(Math.floor(Tsat - S.T[0]), 0, S.T.length - 2), fi = Tsat - S.T[i];
    const j = clamp(Math.floor(dT / 5), 0, H.dT.length - 2), fj = dT / 5 - j;
    const r = ii => H[k][ii][j] + (H[k][ii][j + 1] - H[k][ii][j]) * fj;
    return r(i) + (r(i + 1) - r(i)) * fi;
  }
  function shInvert(Tsat, k, target) {
    let lo = 0, hi = 120;
    for (let n = 0; n < 40; n++) { const m = (lo + hi) / 2; (shAt(Tsat, m, k) < target ? (lo = m) : (hi = m)); }
    return (lo + hi) / 2;
  }
  const DEF = {
    mode: 0,            // 0 heating (winter), 1 cooling (summer)
    Tout: 7, Tin: 20, rpm: 3000, foul: 0, UA: 150,
    SH: 5, SC: 3, etaIs: .72, etaMotor: .9,
    disp: 25,           // cm3, rotary compressor of a 3.5 kW split unit, est.
    mref: .012,         // kg/s mass flow at which the coil approaches below apply, est.
    gains: 400,         // W internal + solar gains in summer, est.
  };
  // One steady operating point. Coil temperature differences grow with refrigerant flow (est.),
  // so a slow inverter compressor runs closer to room and outdoor temperatures and gets a better COP.
  function cycle(o) {
    const p = Object.assign({}, DEF, o), heat = p.mode === 0;
    let q = 1, Te, Tc, e, c, h1, s1, v1, h2, T2, h3, h4, etaV, mdot, PR;
    for (let it = 0; it < 8; it++) {
      const dOut = 3 + 6 * q + 0.1 * p.foul, dIn = 6 + 12 * q;  // K
      Te = clamp(heat ? p.Tout - dOut : p.Tin - dIn, -44, 40);
      Tc = clamp(heat ? p.Tin + dIn : p.Tout + 3 + dOut, Te + 5, 74);
      e = satAt(Te); c = satAt(Tc);
      h1 = shAt(Te, p.SH, 'h'); s1 = shAt(Te, p.SH, 's'); v1 = shAt(Te, p.SH, 'v');
      const h2s = shAt(Tc, shInvert(Tc, 's', s1), 'h');
      PR = c.P / e.P; const eta = clamp(p.etaIs - 0.04 * (PR - 3), 0.45, p.etaIs);  // efficiency falls at high pressure ratio, est.
      h2 = h1 + (h2s - h1) / eta; T2 = Tc + shInvert(Tc, 'h', h2);
      h3 = satAt(Tc - p.SC).hf; h4 = h3;
      etaV = clamp(1 - 0.04 * (Math.pow(PR, 1 / 1.15) - 1), 0, 1);
      mdot = etaV * p.disp * 1e-6 * p.rpm / 60 / v1;
      q = q + 0.6 * (mdot / p.mref - q);  // damped fixed point
    }
    const Qe = mdot * (h1 - h4) * 1e3, W = mdot * (h2 - h1) * 1e3, Pel = W / p.etaMotor;
    const Qh = Qe + Pel;  // hermetic compressor: motor losses also end in the refrigerant, so Qh = Qe + Pel
    const frost = heat && Te < 0 && p.Tout < 6 && p.Tout > -15;
    const fd = frost ? 0.07 : 0;  // defrost time fraction in the humid frost band, est.
    const cap = heat ? Qh * (1 - fd) : Qe;
    const load = Math.max(0, heat ? p.UA * (p.Tin - p.Tout) : p.UA * (p.Tout - p.Tin) + p.gains);
    const duty = cap > 0 ? load / cap : Infinity, holds = duty <= 1;
    const backup = heat ? Math.max(0, load - cap) : 0;
    const Pavg = Pel * (1 + (heat ? fd : 0)) * Math.min(duty, 1) + backup;  // defrost reverses the cycle: extra run time
    const TeK = Te + 273.15, TcK = Tc + 273.15;
    return {
      p, heat, Te, Tc, Pe: e.P, Pc: c.P, PR, T1: Te + p.SH, T2, T3: Tc - p.SC, h1, h2, h3, h4, x4: (h4 - e.hf) / (e.hg - e.hf),
      etaV, mdot, Qe, Qh, W, Pel, COPh: Qh / Pel, COPc: Qe / Pel, COP: heat ? cap / (Pel * (1 + fd)) : Qe / Pel,
      carnot: heat ? TcK / (TcK - TeK) : TeK / (TcK - TeK), frost, fd, cap, load, duty, holds, backup, Pavg,
      resist: heat ? load : null,
    };
  }
  // outdoor temperature where heating capacity equals the house heat loss (bisection); null if none in -25..25 C
  function balance(o) {
    const g = t => { const r = cycle(Object.assign({}, o, { mode: 0, Tout: t })); return r.cap - r.load; };
    let lo = -25, hi = 25;
    if (g(lo) > 0 || g(hi) < 0) return null;
    for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; (g(m) < 0 ? (lo = m) : (hi = m)); }
    return (lo + hi) / 2;
  }
  function dome() {
    const S = T().sat, liq = [], vap = [];
    S.T.forEach((t, i) => { liq.push([S.hf[i], S.P[i]]); vap.push([S.hg[i], S.P[i]]); });
    return liq.concat(vap.reverse());
  }
  return { satAt, shAt, cycle, balance, dome, DEF };
})();

if (typeof registerLab === 'function') (function () {
  const H = globalThis.HPPhys;
  const lab = {
    id: 'heatpump', tab: 'Heat pump',
    charts: ['Pressure–enthalpy diagram', 'One trip of the refrigerant. The white dot follows the bright particle in the pipes. Green dashed: the optimal preset.',
      'Capacity, house load and COP against outdoor temperature', 'Where the capacity line crosses the house line is the balance point. Below it, a backup heater must help.'],
    eyebrow: 'Lab 4 · Reversible heat pump', concept: 'A heat pump moves heat, so 1 kW of electricity can give 3 kW of heat',
    text: 'In winter the outdoor coil is colder than the outdoor air, so it takes heat even from cold air. The compressor lifts that heat to a high temperature, and the indoor coil gives it to the room. In summer a 4-way valve reverses the flow, and the same machine cools the house.',
    home: 'A resistive heater turns 1 kW into 1 kW of heat. A heat pump turns 1 kW into 3–5 kW, because most of the heat comes from outside. The colder the outdoor air, the smaller this gain.',
    s: { mode: 0, Tout: 7, Tin: 20, rpm: 3000, foul: 0, UA: 150 },
    sliders: [
      { k: 'mode', label: 'Mode (4-way valve)', min: 0, max: 1, step: 1, fmt: v => v ? 'Cooling (summer)' : 'Heating (winter)' },
      { k: 'Tout', label: 'Outdoor temperature', min: -20, max: 45, step: 1, unit: '°C' },
      { k: 'Tin', label: 'Indoor set point', min: 16, max: 28, step: 1, unit: '°C' },
      { k: 'rpm', label: 'Compressor speed (inverter)', min: 1200, max: 6000, step: 100, unit: 'rpm', hint: 'Slower means smaller coil temperature differences and a better COP.' },
      { k: 'foul', label: 'Outdoor coil ice or dirt', min: 0, max: 100, step: 5, unit: '%' },
      { k: 'UA', label: 'House heat loss', min: 60, max: 320, step: 10, unit: 'W/K', hint: '60 is a new, well-insulated flat; 300 is an old, leaky house.' },
    ],
    presets: [
      { n: 'Mild day, slow compressor', kind: 'opt', s: { mode: 0, Tout: 7, Tin: 20, rpm: 2000, foul: 0, UA: 150 }, note: 'A small lift and slow, gentle flow through large coils. The COP is near 5: each kilowatt-hour of electricity gives about 5 kWh of heat.' },
      { n: 'Typical winter day', kind: 'typ', s: { mode: 0, Tout: 2, Tin: 21, rpm: 3500, foul: 10, UA: 150 }, note: 'A COP of about 3. The outdoor coil runs below 0 °C, so frost forms and the unit must defrost now and then.' },
      { n: 'Cold snap −20 °C', kind: 'edge', s: { mode: 0, Tout: -20, Tin: 21, rpm: 6000, foul: 0, UA: 150 }, note: 'The suction vapour is thin, so capacity falls just when the house needs the most heat. A resistive backup heater fills the gap at COP 1.' },
      { n: 'Iced outdoor coil', kind: 'edge', s: { mode: 0, Tout: 1, Tin: 21, rpm: 4000, foul: 90, UA: 150 }, note: 'Ice blocks the airflow. The evaporator runs much colder, the COP falls, and the unit reverses itself to melt the ice (defrost).' },
      { n: 'Leaky old house', kind: 'edge', s: { mode: 0, Tout: -5, Tin: 21, rpm: 6000, foul: 0, UA: 300 }, note: 'The heat loss is twice as large. The heat pump is too small for this house, so the backup heater runs a lot. Insulation comes first.' },
      { n: 'Heatwave, dirty coil', kind: 'edge', s: { mode: 1, Tout: 42, Tin: 24, rpm: 6000, foul: 70, UA: 150 }, note: 'In cooling the outdoor coil is the condenser. Hot air and dirt push the condensing temperature near 65 °C. The COP falls to about 1.5, so each unit of cooling costs about twice the electricity of a mild day.' },
    ],
    missions: [
      { t: 'Beat the heater 3 times', d: 'In heating mode at −5 °C outdoors or colder, get a COP of 3 or more and keep the house warm with no backup heater.', win: 'Done. Three units of heat for one unit of electricity: two of them came from the cold outdoor air.',
        check: r => r.heat && r.p.Tout <= -5 && r.COP >= 3 && r.holds },
      { t: 'Find the balance point', d: 'In heating mode, set the outdoor temperature to within 1 °C of the balance point (see the second chart).', win: 'Done. Above this point the heat pump alone is enough. Installers size heat pumps with this point.',
        check: r => r.heat && lab.bal !== null && Math.abs(r.p.Tout - lab.bal) <= 1 },
      { t: 'Efficient summer', d: 'Cool the house on a 35 °C day or hotter with a cooling COP of 3.5 or more, and keep the room at its set point.', win: 'Done. A warmer set point and a slower compressor both shrink the lift.',
        check: r => !r.heat && r.p.Tout >= 35 && r.COPc >= 3.5 && r.holds },
    ],
    chipsList: [{ k: 'comp', l: 'Compressor', c: '#e0552f' }, { k: 'in', l: 'Indoor coil', c: '#d9733c' }, { k: 'exv', l: 'Expansion valve', c: '#b59a3a' }, { k: 'out', l: 'Outdoor coil', c: '#3f8fc4' }, { k: 'valve', l: '4-way valve', c: '#7a8a96' }],
    partInfo: {
      comp: 'Compressor: it lifts the vapour from the low pressure to the high pressure. All of its electricity also becomes heat in the refrigerant.',
      in: 'Indoor coil: in winter it is the condenser and gives heat to the room. In summer it is the evaporator and takes heat out of the room.',
      exv: 'Expansion valve: it drops the pressure, so the liquid flashes and gets cold. It sits in the outdoor unit.',
      out: 'Outdoor coil: in winter it is the evaporator and takes heat from the outdoor air, even at −20 °C. Below about 0 °C, frost grows on it.',
      valve: '4-way valve: a sliding valve that swaps which coil gets the hot discharge gas. It reverses the cycle for summer cooling and for defrost.',
    },
    notes: [
      'Refrigerant R-290 (propane): CoolProp tables, saturation every 1 K and superheat every 5 K. R-290 has a global warming potential of about 3 (R-410A: about 2090), so many new heat pumps use it.',
      'Compressor 25 cm³ (est.), isentropic efficiency 72 % falling by 4 points per unit of pressure ratio above 3 (est.), motor and inverter efficiency 90 % (est.), clearance volumetric efficiency. Hermetic compressor: motor losses end up in the refrigerant, so COP(heating) = COP(cooling) + 1.',
      'Coil temperature differences grow with refrigerant flow: outdoor 3 + 6·q K, indoor 6 + 12·q K, q = flow ÷ 0.012 kg/s (est.). Ice or dirt adds up to 10 K on the outdoor coil.',
      'Frost forms when the outdoor coil is below 0 °C and the air is between −15 and 6 °C. Defrost costs 7 % of the heating time (est.).',
      'House: heat loss = UA × (indoor − outdoor). In summer, add 400 W of internal and solar gains (est.). A backup resistive heater covers any heating shortfall at COP 1.',
    ],
    u: 0, hl: null,

    build() {
      const sc = new THREE.Scene(); lights(sc);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), M(0x8796a3, { transparent: true, opacity: .18 })); ground.rotation.x = -Math.PI / 2; ground.position.x = .3; sc.add(ground);
      const wall = glassBox(.08, 2.6, 1.6, 0xd9cfbf, .22); wall.position.set(0, 1.3, 0); sc.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, 1.7), M(0x9a7b62, { transparent: true, opacity: .35 })); roof.position.set(-.55, 2.63, 0); sc.add(roof);
      // indoor wall unit
      const iu = new THREE.Mesh(new THREE.BoxGeometry(.24, .3, .95), M(0xf4f5f6, { transparent: true, opacity: .35, depthWrite: false })); iu.position.set(-.16, 2.02, 0); sc.add(iu);
      const ifan = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .85, 16), M(0x7d8a94)); ifan.rotation.x = Math.PI / 2; ifan.position.set(-.2, 1.93, 0); sc.add(ifan); this.ifan = ifan;
      // outdoor unit
      const ou = new THREE.Mesh(new THREE.BoxGeometry(.34, .64, .82), M(0xe6e8ea, { transparent: true, opacity: .25, depthWrite: false })); ou.position.set(1.0, .37, 0); sc.add(ou);
      const fan = new THREE.Group(); fan.position.set(1.16, .42, .08); sc.add(fan); this.ofan = fan;
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.02, .2, .07), M(0x3b4349)); b.position.y = .1; const g = new THREE.Group(); g.rotation.x = i * 2 * Math.PI / 3; g.add(b); fan.add(g); }
      const grille = new THREE.Mesh(new THREE.TorusGeometry(.23, .008, 6, 40), M(0x5d666d)); grille.rotation.y = Math.PI / 2; grille.position.set(1.17, .42, .08); sc.add(grille);
      const comp = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .2, 24), M(0x23292e, { metalness: .5 })); comp.position.set(1.0, .25, -.25); sc.add(comp);
      const valve = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .12), M(0x7a8a96, { metalness: .6 })); valve.position.set(1.0, .52, -.25); sc.add(valve); this.valve = valve;
      // refrigerant loop, heating order: compressor -> gas line -> indoor coil -> liquid line -> EXV -> outdoor coil -> compressor
      const compP = [[1.0, .52, -.2], [1.02, .34, -.2], [1.0, .24, -.25], [.98, .34, -.3], [1.0, .52, -.3]];
      const inP = [[1.0, .52, -.3], [.75, .6, -.36], [.1, .6, -.36], [.1, 1.9, -.36], [-.1, 1.97, -.38]];
      for (let i = 0; i < 4; i++) { const y = 2.12 - i * .05, z0 = i % 2 ? .4 : -.4; inP.push([-.16, y, z0 * .95]); inP.push([-.16, y, -z0 * .95]); }
      inP.push([-.1, 1.88, .4], [.1, 1.86, .4], [.1, .5, .4], [.7, .45, .36], [.82, .45, .3]);
      const exvP = [[.82, .45, .3], [.84, .47, .26], [.86, .45, .22]];
      const outP = [[.86, .45, .22], [.84, .7, .36]];
      for (let i = 0; i < 6; i++) { const y = .7 - i * .1, z0 = i % 2 ? -.36 : .36; outP.push([.84, y, z0]); outP.push([.84, y - .1, z0]); }
      outP.push([.84, .1, -.36], [.95, .4, -.2], [1.0, .52, -.2]);
      const mk = (pts, r, c, k, t = .08) => Object.assign(tube(pts, r, M(c), t), { k });
      this.segs = { comp: mk(compP, .012, 0xe0552f, 'comp'), in: mk(inP, .01, 0xd9733c, 'in'), exv: mk(exvP, .005, 0xb59a3a, 'exv', .02), out: mk(outP, .01, 0x3f8fc4, 'out') };
      Object.values(this.segs).forEach(s => sc.add(s.mesh));
      const ice = new THREE.Mesh(new THREE.BoxGeometry(.05, .66, .8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); ice.position.set(.84, .4, 0); sc.add(ice); this.ice = ice;
      const N = 240; this.parts = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial(), N); this.N = N; sc.add(this.parts);
      this.tracer = new THREE.Mesh(new THREE.SphereGeometry(.026, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); sc.add(this.tracer);
      this.scene = sc; this.cam = { p: [2.6, 2.2, 3.0], t: [.45, 1.0, 0] };
    },
    // the flow order of the processes; in cooling the 4-way valve reverses everything except the compressor
    seq() {
      const S = this.segs;
      return this.r.heat ? [[S.comp, 0, 'comp'], [S.in, 0, 'cond'], [S.exv, 0, 'exp'], [S.out, 0, 'evap']]
        : [[S.comp, 0, 'comp'], [S.out, 1, 'cond'], [S.exv, 1, 'exp'], [S.in, 1, 'evap']];
    },
    locate(u) {
      const q = this.seq(), tot = q.reduce((a, s) => a + s[0].len, 0); let d = (u % 1) * tot;
      for (const s of q) { if (d <= s[0].len) { const f = d / s[0].len; return { s, f, at: s[1] ? 1 - f : f }; } d -= s[0].len; }
      const s = q[3]; return { s, f: 1, at: s[1] ? 0 : 1 };
    },
    stateAt(type, f) {  // [h, P, T] at fraction f of a process
      const r = this.r, e = H.satAt(r.Te), c = H.satAt(r.Tc), lg = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * f);
      if (type === 'comp') return [r.h1 + f * (r.h2 - r.h1), lg(r.Pe, r.Pc), r.T1 + f * (r.T2 - r.T1)];
      if (type === 'cond') { const h = r.h2 + f * (r.h3 - r.h2);
        return [h, r.Pc, h > c.hg ? r.Tc + (r.T2 - r.Tc) * (h - c.hg) / (r.h2 - c.hg) : h > c.hf ? r.Tc : r.Tc - (c.hf - h) / Math.max(1e-6, c.hf - r.h3) * (r.Tc - r.T3)]; }
      if (type === 'exp') return [r.h3, lg(r.Pc, r.Pe), r.T3 + f * (r.Te - r.T3)];
      const h = r.h4 + f * (r.h1 - r.h4);
      return [h, r.Pe, h < e.hg ? r.Te : r.Te + (r.T1 - r.Te) * (h - e.hg) / Math.max(1e-6, r.h1 - e.hg)];
    },
    update() {
      if (!globalThis.HP_R290) return;
      const r = this.r = H.cycle(this.s), heat = r.heat, kw = w => fmt(w / 1000, 2);
      this.bal = H.balance(this.s);
      tiles(heat ? [
        { l: 'COP (heat ÷ power)', v: fmt(r.COP, 2), e: `Carnot limit ${fmt(r.carnot, 1)}`, cls: r.COP >= 3 ? 'good' : r.COP < 2 ? 'warn' : '' },
        { l: 'Heat to the room', v: kw(r.cap), u: 'kW', e: `${kw(r.Qe)} kW of it from outdoor air` },
        { l: 'Compressor power', v: kw(r.Pel), u: 'kW' },
        { l: 'Resistive heater would use', v: kw(r.load), u: 'kW', e: r.load > 0 ? `heat pump uses ${kw(r.Pavg)} kW: ${fmt(100 * (1 - r.Pavg / r.load))} % less` : 'no heat needed' },
        { l: 'House heat loss', v: kw(r.load), u: 'kW', e: r.holds ? `unit runs ${fmt(r.duty * 100)} % of the time` : 'more than the unit can give', cls: r.holds ? '' : 'warn' },
        { l: 'Backup heater', v: kw(r.backup), u: 'kW', cls: r.backup > 0 ? 'bad' : 'good', e: 'resistive, COP 1' },
        { l: 'Outdoor coil', v: fmt(r.Te), u: '°C', e: r.frost ? 'frost grows: defrost needed' : 'no frost', cls: r.frost ? 'warn' : '' },
        { l: 'Balance point', v: this.bal === null ? '–' : fmt(this.bal), u: this.bal === null ? '' : '°C', e: 'outdoor temperature' },
        { l: 'Discharge temperature', v: fmt(r.T2), u: '°C', cls: r.T2 > 100 ? 'bad' : '' },
      ] : [
        { l: 'COP (cooling ÷ power)', v: fmt(r.COP, 2), e: `Carnot limit ${fmt(r.carnot, 1)}`, cls: r.COP >= 3.5 ? 'good' : r.COP < 2 ? 'warn' : '' },
        { l: 'Cooling capacity', v: kw(r.cap), u: 'kW' },
        { l: 'Compressor power', v: kw(r.Pel), u: 'kW' },
        { l: 'Heat into the house', v: kw(r.load), u: 'kW', e: r.holds ? `unit runs ${fmt(r.duty * 100)} % of the time` : 'room warms up', cls: r.holds ? '' : 'bad' },
        { l: 'Heat out of the condenser', v: kw(r.Qh), u: 'kW', e: 'cooling + power' },
        { l: 'Indoor coil', v: fmt(r.Te), u: '°C', e: 'cold coil also dries the air' },
        { l: 'Condensing', v: fmt(r.Tc), u: '°C', e: `${fmt(r.Pc)} kPa`, cls: r.Tc > 60 ? 'warn' : '' },
        { l: 'Discharge temperature', v: fmt(r.T2), u: '°C', cls: r.T2 > 100 ? 'bad' : '' },
      ]);
      $('#alarm').hidden = r.holds; $('#alarm').textContent = heat ? 'Backup heater on' : 'Room warming';
      if (this.segs) { this.segs.in.mesh.material.color.setHex(heat ? 0xd9733c : 0x3f8fc4); this.segs.out.mesh.material.color.setHex(heat ? 0x3f8fc4 : 0xd9733c); }  // hot side orange, cold side blue
      $('#c2p').textContent = heat ? this.charts[3] : 'In summer the house gains heat. Where the cooling capacity drops below the gain line, the room warms up.';
      this.drawCharts(); checkMissions(this, r);
    },
    drawCharts() {
      const r = this.r, dome = H.dome(), g = H.cycle(optOf(this)), heat = r.heat, hl = this.hl;
      const loop = c => [[c.h1, c.Pe], [c.h2, c.Pc], [c.h3, c.Pc], [c.h4, c.Pe], [c.h1, c.Pe]];
      const cyc = [[[r.h1, r.Pe], [r.h2, r.Pc]], [[r.h2, r.Pc], [r.h3, r.Pc]], [[r.h3, r.Pc], [r.h4, r.Pe]], [[r.h4, r.Pe], [r.h1, r.Pe]]];
      const keys = ['comp', heat ? 'in' : 'out', 'exv', heat ? 'out' : 'in'], cls = ['s-hot', 's-hot', 's-mut', 's-cold'];
      this.c1 = chart($('#c1'), { x: [80, 760], y: [50, 4000], ylog: true, yt: [50, 100, 200, 500, 1000, 2000, 4000], xlab: 'Specific enthalpy h (kJ/kg)', ylab: 'Pressure (kPa, log scale)',
        body: (X, Y) => `<path class="dome" d="${path(dome, X, Y)}Z"/><path class="ghost" d="${path(loop(g), X, Y)}"/><text class="lbl-ok" x="${X(g.h2) + 4}" y="${Y(g.Pc) + 12}">optimal</text>` +
          cyc.map((s, i) => `<path class="${cls[i]} ${hl === keys[i] ? 'hl' : ''}" d="${path(s, X, Y)}"/>`).join('') +
          `<text class="lbl" x="${X(r.h3) + 6}" y="${Y(r.Pc) - 6}">${heat ? 'indoor coil' : 'outdoor coil'}</text><text class="lbl" x="${X(r.h4) - 4}" y="${Y(r.Pe) + 14}">${heat ? 'outdoor coil' : 'indoor coil'}</text>` });
      $('#c1').setAttribute('aria-label', `Pressure-enthalpy diagram of R-290. Low side ${fmt(r.Pe)} kPa, high side ${fmt(r.Pc)} kPa.`);
      const sw = [], x0 = heat ? -20 : 15, x1 = heat ? 20 : 45, at = t => sw[Math.round(t - x0)];
      for (let t = x0; t <= x1; t += 1) { const q = H.cycle(Object.assign({}, this.s, { Tout: t })); sw.push([t, q.cap / 1000, q.load / 1000, q.COP]); }
      const ymax = Math.min(10, Math.ceil(Math.max(...sw.map(s => Math.max(s[1], heat ? 0 : s[2]))) + 1)), lack = sw.filter(s => s[1] < s[2]).map(s => s[0]);
      const b = this.bal;
      this.c2 = chart($('#c2'), { x: [x0, x1], y: [0, ymax], xlab: 'Outdoor temperature (°C)', ylab: 'kW, or COP',
        body: (X, Y) => (heat && lack.length ? `<rect class="f-bad" x="${X(x0)}" y="${Y(ymax)}" width="${X(Math.max(...lack) + .5) - X(x0)}" height="${Y(0) - Y(ymax)}"/><text class="lbl-bad" x="${X(x0 + 1)}" y="${Y(ymax) + 12}">backup heater needed</text>` : '') +
          `<line class="s-mut dash" x1="${X(x0)}" x2="${X(x1)}" y1="${Y(1)}" y2="${Y(1)}"/><text x="${X(x1) - 4}" y="${Y(1) - 4}" text-anchor="end">${heat ? 'resistive heater, COP 1' : 'COP 1'}</text>` +
          `<path class="s-ink dash" d="${path(sw.map(s => [s[0], Math.min(s[2], ymax)]), X, Y)}"/><path class="s-acc" d="${path(sw.map(s => [s[0], Math.min(s[1], ymax)]), X, Y)}"/><path class="s-hot" d="${path(sw.map(s => [s[0], Math.min(s[3], ymax)]), X, Y)}"/>` +
          (heat && b !== null ? `<line class="s-mut" x1="${X(b)}" x2="${X(b)}" y1="${Y(0)}" y2="${Y(ymax)}"/><text class="lbl" x="${X(b) + 4}" y="${Y(ymax * .55)}">balance ${fmt(b)} °C</text>` : '') +
          `<text class="lbl-acc" x="${X(x1) - 4}" y="${Y(Math.min(ymax * .95, at(x1)[1])) + 14}" text-anchor="end">${heat ? 'heating' : 'cooling'} capacity</text>` +
          `<text class="lbl" x="${X(heat ? x0 + 1 : x1 - 1)}" y="${Y(Math.min(ymax * .85, at(heat ? x0 + 1 : x1 - 1)[2])) - 8}" text-anchor="${heat ? 'start' : 'end'}">house ${heat ? 'heat loss' : 'heat gain'}</text>` +
          `<text class="lbl-bad" x="${X(x0 + (x1 - x0) * .55)}" y="${Y(Math.min(ymax * .97, at(x0 + (x1 - x0) * .55)[3])) - 8}" style="fill:var(--hot)">COP</text>` });
      moveDot(this.c2, r.p.Tout, Math.min(r.COP, ymax));
    },
    frame(dt) {
      if (!this.r || !this.segs) return;
      const r = this.r;
      this.u = (this.u + dt * .03 * this.s.rpm / 3000) % 1;
      const m = new THREE.Matrix4(), col = new THREE.Color();
      for (let i = 0; i < this.N; i++) {
        const L = this.locate((this.u + i / this.N) % 1), st = this.stateAt(L.s[2], L.f), liquid = (L.s[2] === 'cond' && L.f > .6) || L.s[2] === 'exp';
        const sc = liquid ? 1.25 : .8; m.makeScale(sc, sc, sc).setPosition(L.s[0].curve.getPointAt(L.at)); this.parts.setMatrixAt(i, m); this.parts.setColorAt(i, tempColor(st[2], col));
      }
      this.parts.instanceMatrix.needsUpdate = true; if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
      const L = this.locate(this.u), st = this.stateAt(L.s[2], L.f);
      this.tracer.position.copy(L.s[0].curve.getPointAt(L.at)); moveDot(this.c1, st[0], st[1]);
      this.ofan.rotation.x += dt * (4 + this.s.rpm / 400) * (r.heat && r.frost && this.s.foul > 60 ? .3 : 1);
      this.ifan.rotation.y += dt * 6;
      this.ice.material.opacity = r.heat && r.Te < 0 ? Math.min(.75, .12 + this.s.foul / 130) : 0;
      this.valve.material.emissive.setHex(r.heat ? 0x331100 : 0x001833);
      const names = { comp: 'compressing', cond: 'condensing', exp: 'expanding', evap: 'boiling' };
      $('#caption').textContent = `${r.heat ? 'heating' : 'cooling'} · white dot: ${names[L.s[2]]} · ${fmt(st[1])} kPa · ${fmt(st[2])} °C`;
    },
    pick(k) {
      this.hl = k; const S = this.segs;
      Object.values(S).forEach(s => s.mesh.material.emissive.setHex(s.k === k ? 0x553300 : 0));
      this.valve.material.emissive.setHex(k === 'valve' ? 0x555500 : 0);
      $('#conceptText').textContent = k ? this.partInfo[k] : this.text; this.drawCharts();
    },
    extra() { $('#extra').innerHTML = ''; },
  };
  registerLab(lab);
})();
