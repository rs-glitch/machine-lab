# Everyday Machine Lab: survey of future machine tabs

Date: 2026-10-23. Status: research only. No code changed.

## How to read this file

- Score = teaching value (T) + first-10-second wow (W) + validation data available (V) - effort (E). Each is 1 to 5.
- Effort scale: low = 1 to 2, medium = 3, high = 4 to 5.
- Tie-break for equal scores: pick the machine with less overlap, then a new domain.
- Validation tag: **[src]** = a URL in the Sources list was read during this survey. **[known]** = textbook or datasheet-class value from memory; the exact page was not checked. **[est.]** = estimate by the author. Treat [known] and [est.] as unverified until a page is opened.
- Web search was weak for this task. engineersuniverse.com returned no result (unverified whether it has a labs section). Most explainer lists (Real Engineering, Engineer Guy, HowStuffWorks, PhET catalogue) were not fetched in full. Candidates come from the partial lists below plus common syllabus content (author knowledge, unverified).
- Existing tabs (do not repeat): refrigerator, car engine, washing machine, heat pump, microwave, bicycle. Earlier shortlist (not built): vacuum cleaner, pressure cooker, brakes/ABS, loudspeaker/guitar, wind turbine, induction cooktop, elevator, espresso machine, electric motor. I could not parse the scored table in docs/directions.html (it holds the shortlist rows after the three visual directions); only the style cards were read.

## Ranked table

| # | Machine | Domain | T | W | V | E | Score | Effort | Overlap with existing tabs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Electric motor (DC / BLDC) | E&M | 5 | 5 | 5 | 3 | 12 | medium | none |
| 2 | Wind turbine | Fluids / E&M | 5 | 4 | 5 | 2 | 12 | low | none |
| 3 | Airplane wing (airfoil) | Fluids | 5 | 5 | 5 | 3 | 12 | medium | none |
| 4 | Centrifugal pump + system curve | Fluids | 5 | 4 | 5 | 2 | 12 | low | none |
| 5 | Camera lens and sensor | Optics | 5 | 5 | 4 | 3 | 11 | medium | none |
| 6 | Li-ion battery cell | Chem / storage | 5 | 3 | 5 | 2 | 11 | low | none |
| 7 | GPS receiver | Digital / waves | 5 | 4 | 5 | 3 | 11 | medium | none |
| 8 | Thermostat + PID (home heating) | Control | 5 | 3 | 4 | 1 | 11 | low | light: heat pump |
| 9 | Solar PV cell + MPPT | E&M / chem | 5 | 3 | 5 | 2 | 11 | low | none |
| 10 | Car suspension (quarter car) | Mech / vibration | 4 | 4 | 5 | 2 | 11 | low | medium: washing machine damping |
| 11 | Induction cooktop | E&M / thermal | 4 | 5 | 4 | 3 | 10 | medium | none |
| 12 | Stirling engine | Thermal | 5 | 5 | 3 | 3 | 10 | medium | light: engine cycle |
| 13 | Car brakes + ABS | Mech / control | 5 | 4 | 4 | 3 | 10 | medium | light: engine tab car frame |
| 14 | Loudspeaker | E&M / waves | 5 | 4 | 4 | 3 | 10 | medium | none |
| 15 | Guitar string + Helmholtz body | Vibration / waves | 4 | 4 | 4 | 2 | 10 | low | light: washing machine resonance |
| 16 | Planetary gear / automatic transmission | Mech | 5 | 4 | 4 | 3 | 10 | medium | medium: bicycle gears |
| 17 | Inverted pendulum (Segway) | Control | 5 | 5 | 3 | 3 | 10 | medium | none |
| 18 | Quadcopter drone | Control / mech | 5 | 5 | 4 | 4 | 10 | high | none |
| 19 | Mechanical watch escapement | Mech | 5 | 5 | 4 | 4 | 10 | high | none |
| 20 | Pressure cooker | Thermal | 4 | 3 | 4 | 2 | 9 | low | light: refrigerator (saturation) |
| 21 | Electric kettle (boiling + thermostat) | Thermal | 3 | 3 | 4 | 1 | 9 | low | none |
| 22 | Vacuum flask (thermos) | Thermal | 4 | 3 | 3 | 1 | 9 | low | none |
| 23 | Hydraulic ram pump | Fluids | 4 | 4 | 3 | 2 | 9 | low | none |
| 24 | Venturi atomizer / carburetor | Fluids | 4 | 3 | 3 | 1 | 9 | low | light: engine |
| 25 | Hydraulic jack | Fluids | 4 | 3 | 4 | 2 | 9 | low | none |
| 26 | Vacuum cleaner | Fluids | 4 | 3 | 4 | 2 | 9 | low | none |
| 27 | Transformer / phone charger | E&M | 4 | 3 | 4 | 2 | 9 | low | none |
| 28 | LCD pixel (polarisers) | Optics | 4 | 4 | 4 | 3 | 9 | medium | none |
| 29 | QR code (error correction) | Digital | 3 | 4 | 4 | 2 | 9 | low | none |
| 30 | Digital audio sampling | Digital | 4 | 3 | 4 | 2 | 9 | low | light: loudspeaker |
| 31 | Reusable hand warmer | Chem | 3 | 4 | 3 | 1 | 9 | low | none |
| 32 | Espresso machine | Thermal / fluids | 3 | 4 | 4 | 3 | 8 | medium | none |
| 33 | Water hammer in a pipe | Fluids | 4 | 4 | 3 | 3 | 8 | medium | none |
| 34 | Peltier cooler | Thermal / E&M | 3 | 3 | 4 | 2 | 8 | low | light: refrigerator |
| 35 | Wireless phone charger | E&M | 4 | 4 | 3 | 3 | 8 | medium | none |
| 36 | Noise-cancelling headphones | Waves / control | 4 | 3 | 3 | 2 | 8 | low | none |
| 37 | PEM fuel cell | Chem | 4 | 3 | 4 | 3 | 8 | medium | light: Li-ion |
| 38 | Radar speed gun (Doppler) | Waves | 4 | 3 | 3 | 2 | 8 | low | light: microwave |
| 39 | Capacitive touchscreen | Digital / E&M | 4 | 4 | 3 | 3 | 8 | medium | none |
| 40 | Car radiator / heat exchanger | Thermal | 4 | 3 | 3 | 3 | 7 | medium | light: refrigerator |
| 41 | Elevator with counterweight | Mech | 3 | 2 | 4 | 2 | 7 | low | none |
| 42 | Air conditioner (psychrometrics) | Thermal | 4 | 3 | 4 | 4 | 7 | high | heavy: refrigerator + heat pump |
| 43 | Toilet siphon cistern | Fluids | 3 | 3 | 2 | 2 | 6 | low | none |

Machines 1 to 10 cover seven of the eight domains. Digital has GPS (7) and QR code (29). Pure digital and control items score lower on wow, so pair them with a 3D hook.

## Candidate detail

Presets: O = optimal point, E1 and E2 = edge cases. Equations are the minimum set for a real-time browser model.

### Thermal

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation numbers | Source |
|---|---|---|---|---|---|---|
| 11 Induction cooktop | Eddy currents heat the pan; frequency and pan material set efficiency | Skin depth d = sqrt(2 rho / (omega mu); P = I^2 R_eff; lumped pan heat balance C dT/dt = P - hA(T - Ta) | Field lines through pan base; pan glows by temperature; aluminium pan fails to couple | O: steel pan, 25 kHz. E1: aluminium pan. E2: pan lifted 15 mm | Typical frequency 20 to 50 kHz [known]. Vendor claim: about 3 times more efficient than gas (Bosch) | [src] Bosch page seen in search; independent test data not found |
| 12 Stirling engine | Gas is heated and cooled at constant volume; regenerator saves heat | Ideal-gas pV = nRT; four-process cycle; efficiency = 1 - Tc/Th with regenerator; Schmidt isothermal model for crank | Glass displacer and power piston; flywheel; hot cup of water drives it | O: 90 C source, 20 C sink. E1: no regenerator. E2: dT too small, stalls | Carnot limit 1 - 293/363 = 19% (calculated). Real low-dT engines run at a few percent [est.] | none checked |
| 20 Pressure cooker | Higher pressure raises boiling point and cuts cooking time | Clausius-Clapeyron / Antoine for water; ideal-gas headspace; valve force balance; Arrhenius cooking rate k = A exp(-Ea/RT) | Cutaway pot; steam bubbles; weight valve lifts and jiggles | O: 15 psi gauge (121 C). E1: valve stuck, over-pressure. E2: high altitude 3000 m open pot | Water boils at 100 C at 101.3 kPa; about 121 C at 200 kPa abs [known, steam tables] | none checked (steam tables, unverified URL) |
| 21 Electric kettle | Power, mass and latent heat set boil time; bimetal shuts off the power | Q = m c dT; P = V^2 / R; latent heat m L; bimetal switch at 100 C; loss hA dT | Heating element, rising bubbles, steam vent to the switch | O: 1.7 L, 2.2 kW. E1: scale on element. E2: low-voltage 110 V grid | 1 L from 20 C to 100 C needs 335 kJ (calculated: 4.186 x 80); about 2.5 min at 2.2 kW ideal | none needed (calculated) |
| 22 Vacuum flask | Vacuum, silver coat and cap stop conduction, convection and radiation | Radiation q = sigma eps (T1^4 - T2^4); conduction through neck; lumped cooling dT/dt | Cutaway double wall; infrared glow arrows; cooling curve | O: good vacuum, eps 0.03. E1: lost vacuum. E2: scratched coating | Quality flasks keep hot liquids above about 60 C for many hours (maker claims) [est.] | none checked |
| 31 Hand warmer | Supercooled sodium acetate releases latent heat when it crystallises | Latent heat fusion, nucleation switch; lumped heating; Newton cooling | Crystal front sweeps through the pad when the disc is clicked | O: click at 20 C. E1: pad not fully remelted. E2: cold 0 C ambient | Sodium acetate trihydrate melts near 58 C, latent heat about 265 kJ/kg [known] | none checked |
| 32 Espresso machine | Pump pressure, grind size and flow set extraction | Darcy flow through puck: Q = k A dP / (mu L); boiler PID; pump curve | Puck cross-section; flow lines; extraction streaks | O: 9 bar, 25 to 30 s shot. E1: grind too fine, choked. E2: grind too coarse, channelling | 9 bar, 90 to 96 C, 25 to 30 s is the common guide [known] | none checked |
| 34 Peltier cooler | Current pumps heat; Joule heat limits the cold side | Qc = S I Tc - 0.5 I^2 R - K dT; COP = Qc / (V I) | Two-ceramic sandwich with colour map and heat-sink fan | O: I at max COP. E1: I too high, Joule dominates. E2: no heat sink | Typical module max dT about 65 to 70 K [known] | none checked |
| 40 Car radiator | Effectiveness-NTU sets heat rejection | eps-NTU, Q = eps C_min (Th - Tc); pump flow; fan airflow | Core fins; coolant colour map | O: highway flow. E1: idle, fan off. E2: blocked fins | Engine coolant about 90 to 105 C [known] | none checked |
| 42 Air conditioner | Cooling plus dehumidifying on a psychrometric chart | Psychrometric relations; vapour-compression cycle; latent plus sensible load | Moist-air state path on a chart | O: 26 C, 50% RH. E1: very humid. E2: undersized unit | ASHRAE comfort zone [known] | none checked |

### Fluids

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 2 Wind turbine | Betz limit and tip-speed ratio | P = 0.5 rho A Cp v^3; Cp(lambda, beta) analytic fit; Betz Cp max = 16/27 = 0.593; rotor inertia ODE with generator torque | Rotating blades with pitch; streamtube widening behind rotor; power curve dot | O: lambda about 7, Cp about 0.45. E1: stall at high wind. E2: furl / cut-out | Betz 0.593 (mathematical result). Utility turbines reach Cp 0.45 to 0.50 [known]. Cut-in about 3 m/s, rated about 12 m/s [known] | none checked (NREL/ manufacturer power curves suggested) |
| 3 Airfoil / wing | Pressure difference from curved flow gives lift; stall | Thin-airfoil CL = 2 pi alpha; stall model; L = 0.5 rho v^2 S CL; drag polar CD = CD0 + k CL^2; panel method or potential flow for streamlines | Streamlines and pressure colours on a 3D wing; angle-of-attack slider | O: alpha 4 to 6 deg, max L/D. E1: stall at 16 deg. E2: slow speed, low Re | Cessna-class CL max about 1.5 to 1.6 [known]; NACA 2412 data [known] | Ciechanowski has an "Airfoil" article, [src] ciechanow.ski/archives |
| 4 Centrifugal pump | Pump curve meets system curve at the operating point | H_pump = H0 - a Q^2; H_sys = Hs + K Q^2; affinity laws Q ~ N, H ~ N^2, P ~ N^3; eta(Q); NPSH cavitation check | Impeller with vanes; flow arrows; operating point on H-Q chart | O: best efficiency point. E1: throttled valve. E2: cavitation, low NPSH | Typical BEP efficiency 70 to 85% for mid-size pumps [known]; manufacturer curves public | none checked |
| 23 Hydraulic ram pump | Water hammer pulse lifts part of the flow with no motor | Waste valve cycle; pressure surge dP = rho c dv; delivery valve and air chamber | Waste valve clacks; delivery stream | O: 1:7 drive/lift ratio. E1: lift too high. E2: waste valve stuck open | Practical Engineering has "How Does a Hydraulic Ram Pump Work?" [src]; typical efficiency 60 to 70% [est.] | [src] simkl listing |
| 24 Venturi atomizer | Bernoulli: fast flow lowers pressure | p1 + 0.5 rho v1^2 = p2 + 0.5 rho v2^2; continuity A1 v1 = A2 v2 | Spray bottle cutaway | O: throat ratio 4:1. E1: low flow. E2: blocked throat | Bernoulli is exact for ideal flow | none needed |
| 25 Hydraulic jack | Pascal's law gives force gain | F2 / F1 = A2 / A1; work conservation; leak flow | Pump stroke, valve ball | O: 1:30 gain. E1: leak. E2: air in fluid | 2-tonne bottle jack force ratio from piston areas (calculated) | none needed |
| 26 Vacuum cleaner | Fan curve and orifice give suction vs airflow | Fan curve dP = dP0 (1 - (Q/Qmax)^2); orifice dP = K Q^2; air watts = dP Q | Cutaway with dust bag filling and filter clogging | O: clean filter. E1: full bag. E2: blocked hose | Typical air watts 200 to 400 W [est.] | none checked |
| 33 Water hammer | Sudden valve closure creates a pressure wave | Joukowsky dP = rho c dv; method of characteristics in a pipe | Pressure wave running along a pipe, valve slam | O: slow close. E1: fast close. E2: add surge tank | Practical Engineering "What is Water Hammer?" [src]; c in steel pipe about 1000 to 1300 m/s [known] | [src] simkl listing |
| 43 Toilet siphon | Siphon starts when the bend fills | Bernoulli with head loss, prime state machine | Cutaway tank, bowl | O: full tank. E1: low water. E2: partial blockage | none | none |

### Mechanics and vibration

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 10 Car suspension | Ride versus handling: damping ratio | m x'' + c(x' - u') + k(x - u) = 0 quarter car with tyre spring; zeta = c / (2 sqrt(k m)) | Car body on a bumpy road; wheel hop | O: zeta 0.3 to 0.4. E1: worn damper (zeta 0.05). E2: over-stiff | Body natural frequency about 1 to 1.5 Hz, wheel hop 10 to 15 Hz [known] | none checked |
| 13 Brakes + ABS | Friction circle and slip ratio | Pacejka or simple mu(slip) curve; wheel ODE I w' = -T_b + F x R; bang-bang ABS | Wheel with disc and caliper; heat glow; stopping car | O: ABS on dry road. E1: ice. E2: brake fade (hot disc) | Dry mu about 0.8 to 1.0; stopping from 100 km/h about 35 to 40 m (calculated at mu 0.9: v^2 / 2 mu g = 43.7 m) | none checked |
| 14 Loudspeaker | Voice coil force; resonance and enclosure | Thiele-Small: m x'' + R x' + k x = B l i; L di/dt + Re i = V - B l x'; SPL | Cone moves, magnet, coil, sound wave rings | O: sealed box Qtc 0.707. E1: undersized box, boomy. E2: over-excursion | Datasheet T-S parameters (Fs, Qts, Vas) are public for many drivers [known] | none checked |
| 15 Guitar string | Frequency set by length, tension, mass | f = (1/2L) sqrt(T / mu); wave equation modes; Helmholtz f = (c / 2 pi) sqrt(A / (V L)) | String shows modes; body air resonance | O: E2 string 82.4 Hz. E1: loose string. E2: capo near end | Open E2 = 82.41 Hz; A4 = 440 Hz (standard tuning) | none needed |
| 16 Planetary gear | Ring, sun and carrier give several ratios | Willis: (ws - wc)/(wr - wc) = -Zr/Zs; torque balance | 3D gear set with brake/clutch toggles | O: 1st gear ratio. E1: lock-up direct. E2: reverse | Typical 6-speed ratios 4.17 to 0.60 (one model) [est.] | none checked |
| 19 Watch escapement | Escapement regulates the mainspring | Balance wheel theta'' = -(k/I) theta - damping; impulse each half cycle | Ciechanowski-style cutaway | O: 4 Hz (28,800 vph). E1: dirty (more friction). E2: low amplitude | 28,800 beats/hour is a standard rate [known] | [src] ciechanow.ski/archives (Mechanical Watch article exists) |
| 41 Elevator | Counterweight cuts motor power | Newton + counterweight balance, P = (m_car - m_cw + ...) g v | Cab, rope, sheave | O: 50% counterweight. E1: empty. E2: full + emergency stop | Typical 1 m/s, 8 to 13 person [est.] | none |

### Electricity and magnetism

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 1 Electric motor | Lorentz force, back-EMF, torque-speed line | Tm = Kt i; E = Ke w; V = i R + L di/dt + E; J w' = Tm - Tload; efficiency = Pout / Pin | Rotor, magnets, commutator or 3-phase coil sequence; field arrows | O: load at half stall torque (max efficiency). E1: stall (heating). E2: no-load runaway speed | Torque-speed line and efficiency curve from any small-motor datasheet (e.g. a Maxon or Mabuchi sheet) [known] | none checked |
| 9 Solar PV cell | I-V curve and maximum power point | Single-diode: I = Iph - I0 (exp(V / n Vt) - 1) - V / Rsh; MPPT perturb and observe | Panel, sun angle, shade strip | O: MPP at 1000 W/m2. E1: partial shade. E2: 70 C hot cell | STC: 1000 W/m2, 25 C; typical panel Voc about 40 V, efficiency 20% [known] | none checked |
| 11 Induction cooktop | see Thermal | | | | | |
| 27 Transformer / charger | Turns ratio and core saturation | V2/V1 = N2/N1; flux B = V / (4.44 f N A); core loss | Core with flux loops | O: rated load. E1: overload. E2: DC input, saturation | Mains 230/120 V to 5 V USB [known] | none |
| 35 Wireless charger | Resonant inductive coupling | Coupled coils: k = M / sqrt(L1 L2); eta vs k and Q | Two coils, field, misalignment | O: aligned, k 0.8. E1: offset 15 mm. E2: foreign metal | Qi standard 5 to 15 W, 110 to 205 kHz [known] | none checked |

### Optics and waves

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 5 Camera | Aperture, shutter, ISO and depth of field | Thin lens 1/f = 1/do + 1/di; N = f / D; DoF formulas; exposure EV = log2(N^2 / t) | Ray bundles through lens; blur circle; live preview | O: f/8 landscape. E1: f/1.4 portrait. E2: f/22 diffraction blur | Sunny-16 rule: f/16, 1/ISO s [known]. Ciechanowski has "Cameras and Lenses" [src] | [src] ciechanow.ski/archives |
| 28 LCD pixel | Polarisers and twisted crystal block or pass light | Malus I = I0 cos^2 theta; twisted-nematic Jones calculus | Layer stack, light colours | O: 90 deg twist, bright. E1: voltage on, dark. E2: crossed off-axis | Malus's law exact | none needed |
| 36 Noise-cancelling headphones | Anti-phase sound cancels | Destructive interference; LMS adaptive filter; latency limit | Waves from outside and speaker add to flat line | O: low-frequency hum. E1: high frequency, fails. E2: delay too long | ANC works mainly below about 1 kHz [known] | none checked |
| 38 Radar speed gun | Doppler shift | df = 2 v f0 / c | Waves bouncing from car | O: 24 GHz, 100 km/h. E1: cosine error. E2: ... | 24.15 GHz K-band, df about 4.5 kHz at 100 km/h (calculated: 2 x 27.8 x 24.15e9 / 3e8 = 4.47 kHz) | none needed |
| 14 Loudspeaker | see Mechanics | | | | | |

### Chemistry and energy storage

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 6 Li-ion cell | Voltage sag, capacity and heat vs C-rate | OCV(SoC) table; Thevenin RC: V = OCV - I R0 - V_rc; heat I^2 R; Peukert-like loss | Cell layers, ions moving, heat colours | O: 0.2C. E1: 10 A high drain. E2: cold 0 C or over-discharge cutoff | Samsung 30Q: 3000 mAh, 3.6 V nominal, 4.20 V charge, 2.5 V cutoff, 15 A continuous, AC impedance <= 26 mohm at 1 kHz; about 2900 mAh at 10 A (revision-dependent: an older spec lists 2700 mAh at 10 A) | [src] 18650batterystore, TI-hosted Samsung PDF, lygte-info, endless-sphere |
| 37 PEM fuel cell | Activation, ohmic and mass-transport losses | V = E0 - activation (Tafel) - i R - concentration term; polarisation curve | Membrane, gas channels | O: mid current, best efficiency. E1: high current, flooding. E2: dry membrane | Ideal H2/O2 cell 1.23 V; operating about 0.6 to 0.7 V [known] | none checked |
| 9 Solar PV | see E&M | | | | | |

### Control systems

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 8 Thermostat + PID | Hysteresis vs PID; overshoot and settling | C dT/dt = P - UA (T - Ta); u = Kp e + Ki integral(e) + Kd de/dt; on/off with deadband | House cutaway with colour map; room temperature chart | O: tuned PID, no overshoot. E1: too much Ki, oscillation. E2: bang-bang with narrow band, short cycling | Typical time constants from lumped model (est.); LearnChemE has process-control resources [src] | [src] learncheme.com/course-overview/process-control-resources |
| 17 Inverted pendulum | Unstable system stabilised by feedback | m l^2 th'' = m g l sin th - u; LQR or PD | Segway-like balancing body | O: tuned PD. E1: too slow, falls. E2: saturated motor | Linear model poles from physics (calculated) | none needed |
| 18 Quadcopter | Attitude and altitude loops | Rigid body 6-DOF; thrust ~ w^2; cascaded PID | Drone flying through gates | O: hover. E1: motor fail. E2: wind gust | Typical 5 inch drone thrust-to-weight 5:1 or more [est.] | none |
| 36 Noise-cancelling | see Optics/waves | | | | | |

### Digital

| Machine | One concept | Browser model (equations) | 3D hook | Presets | Validation | Source |
|---|---|---|---|---|---|---|
| 7 GPS | Position from signal travel times | Pseudorange rho_i = |x - s_i| + c b; Gauss-Newton solve for 4 unknowns; DOP | Earth, satellite orbits, receiver; user places buildings to block sats | O: 8 sats good geometry. E1: 4 sats in line, high DOP. E2: urban canyon | Orbit radius about 26,560 km; 31 satellites active; civil accuracy about 5 m [known]. Ciechanowski has a GPS article [src] | [src] ciechanow.ski/archives |
| 29 QR code | Reed-Solomon error correction | GF(256) Reed-Solomon; levels L 7%, M 15%, Q 25%, H 30% [known] | Scan a code on screen; damage it with a brush | O: level M, clean. E1: 20% damage on level L, fails. E2: level H with logo | ISO/IEC 18004 levels [known] | none checked |
| 30 Digital audio | Sampling, aliasing, quantisation | Nyquist fs > 2 fmax; SNR = 6.02 N + 1.76 dB | Sine wave, sample dots, DAC staircase | O: 44.1 kHz 16 bit. E1: 8 kHz, aliasing. E2: 4 bit | CD: 44.1 kHz, 16 bit, about 98 dB SNR (calculated) | none needed |
| 39 Touchscreen | Finger changes capacitance | Mutual capacitance grid; centroid interpolation | Grid lighting up under finger | O: finger. E1: glove. E2: water drop | none | none |

## Top 8: short notes

1. **Electric motor (score 12).** One equation set (V = iR + E, T = Kt i) gives the torque-speed line, the efficiency hill and the stall-heat danger. A user sees the rotor spin, then drags the load slider and watches speed fall and current rise. Datasheets are free, so validation is easy. Risk: the "optimal" point is at about half stall torque, which is a good surprise for users.
2. **Wind turbine (12).** The Betz limit of 0.593 is a clean hard ceiling. A tip-speed-ratio slider moves the operating point up a Cp curve and down again. Low effort: one analytic Cp surface and a rotor inertia ODE. Pairs well with the motor tab (generator).
3. **Airfoil (12).** Strong first-10-second wow: streamlines bend and the wing lifts. The model can use thin-airfoil theory plus a stall curve, so it runs in real time. Ciechanowski already did a famous article, so a new tab must differ by adding a flight envelope and a drag polar. Check the overlap with his work for style only.
4. **Centrifugal pump (12).** Pump curve meets system curve, and the operating point moves when the valve closes. Affinity laws let users change speed. It teaches how every water system works. Low effort, strong data (manufacturer curves).
5. **Camera lens and sensor (11).** Thin-lens ray bundles with a live blur circle. Aperture, focal length and distance give depth of field. Ciechanowski has an article, but a phone-sized interactive with an exposure triangle goal is new.
6. **Li-ion battery cell (11).** The best-validated item: a real datasheet (Samsung 30Q) gives capacity, impedance and limits. The Thevenin model shows voltage sag and heat at high C-rate. Visual hook is weaker, so add ion motion in the electrode layers.
7. **GPS receiver (11).** Four unknowns, four satellites. Users move satellites and see DOP grow. A Gauss-Newton solve is cheap. The 3D Earth with orbit rings gives wow. Published constants are well known.
8. **Thermostat + PID (11).** The lowest effort of all (E = 1) and the only tab that teaches feedback directly. Users see bang-bang short cycling against a tuned PID. A house cutaway keeps the 3D hook. It also gives the Lab a reusable control block for later tabs (cruise control, drone).

Runners-up at 11: solar PV cell (tie-break lost on domain diversity; it is a strong ninth) and quarter-car suspension (heavy overlap with the washing machine tab).

## Sources

Read or seen during this survey (search result pages or fetched pages; content not independently verified):

- Ciechanowski article list (22 titles incl. Airfoil, Bicycle, Sound, Mechanical Watch, GPS, Internal Combustion Engine, Cameras and Lenses, Lights and Shadows, Gears): https://ciechanow.ski/archives/
- Practical Engineering episode listings (water hammer, hydraulic jump, ram pump; third-party TV database, titles may differ from YouTube): https://simkl.com/tv/1420832/practical-engineering/episodes/
- Samsung INR18650-30Q cell data: https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/196/samsung_5F00_30q_5F00_data_5F00_sheet.pdf ; https://www.18650batterystore.com/en-gb/products/samsung-30q ; https://lygte-info.dk/review/batteries2012/Samsung%20INR18650-30Q%203000mAh%20(Pink)%20UK.html ; https://endless-sphere.com/sphere/threads/samsung-30q-high-drain-18650-li-ion-cells-capacity-test.100300/post-1471891
- LearnChemE (process control, separations): https://learncheme.com/course-overview/process-control-resources/ ; https://learncheme.com/course-overview/separations-resources
- Bosch sustainability page (vendor claim on induction vs gas, marketing): https://www.bosch-home.com/us/sustainability
- ASEE paper on a virtual mechanisms lab (Simscape): https://peer.asee.org/45583.pdf
- PhET (titles only seen: Waves on a String, Series and Parallel Circuits): https://phet.colorado.edu/en/search?q=power

Not verified:

- engineersuniverse.com: no search result. Whether it has labs is unknown.
- Real Engineering, Engineer Guy, HowStuffWorks, Technology Connections video lists: not fetched. A newsletter said Technology Connections made long dishwasher videos (secondhand, https://wellactually.substack.com/p/the-internets-weird-appliance-guy).
- All values tagged [known] come from author memory of textbooks and datasheets. Open a primary source before putting any of them in the app.
- The scored table in docs/directions.html was not read in full.
