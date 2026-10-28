# Progress

**Goal:** a portfolio-grade, phone-friendly web lab of everyday machines. Each machine has a 3D model, live physics, charts and missions.

## 2026-10-23 · v1
- **First three labs:**
  - Refrigerator: an R-600a vapour-compression cycle on a P–h chart.
  - Car engine: a Wiebe spark-ignition cycle with knock, a P–V chart and an MBT sweep.
  - Washing machine: a 2-DOF unbalanced spin-up showing resonance and the force on the floor.
- **Missions:** three per lab, saved per viewer in localStorage.
- **Decisions:**
  - The 3D geometry is procedural three.js, not CAD exports, so the parts can animate.
  - The property tables are precomputed (81 KB) instead of shipping the 6 MB CoolProp WASM.
  - The knock-delay calibration is ×3.2 (est.). The washer is set to fn 2.5 Hz and M 40 kg.

## 2026-10-23 · v3 to v6
- **Workbench layout:** controls, 3D view and charts sit in one row, with a readout strip on top. This fixed a canvas resize loop.
- **Presets per machine:** optimal, typical and edge cases. The optimal preset is drawn as a green ghost on the main chart. Presets do not complete missions.
- **Engine:** 1–6 inline cylinders with firing orders, plus a crank-torque chart and a torque-swing tile.

## 2026-10-23 · v7 to v10
- **Plug-in labs:** labs register themselves through `registerLab()`. Each extra lab lives in `web/labs/<id>.js` (contract in `web/labs/README.md`) and has a Node test in `tools/test_<id>.js`.
- **New labs:** heat pump, microwave and bicycle.
- **Looks:** a look switcher with Clean and 9 post-process styles, saved per viewer. Every look renders the whole scene in 4 passes: opaque normals, glass normals, colour with an alpha mask, then the post pass.
- **Layout lock:** the same type metrics in every look. `tools/layout_check.sh` reports 0 px shift.
- **Lesson:** three.js shader compile errors do not raise window errors. Check the Chrome console log instead (`--enable-logging=stderr`, grep "shader error").

## 2026-10-23 · v11 to v15
- **Visual pass:**
  - Softer palettes.
  - Outlines on light objects.
  - Background sets per lab (kitchen, garage, laundry, garden, counter, park).
  - `fitText()` for text that would overflow. `tools/overflow_check.sh` reports 0.
- **Eight more labs from the machine survey:** electric motor, water pump, wind turbine, airplane wing, camera, GPS, battery and thermostat.
- **Navigation:** one wrapping grid of 14 tabs with group labels, and no sideways scroll.
- **New look:** CAD edges, which draws crisp edge lines on solid meshes.

## 2026-10-26 · Repo
- **Pages run standalone:** they used to rely on the hosting page.
  - Added a doctype, charset and viewport to `web/index.html` and the two docs pages. Without the charset, text showed as "Â°C".
  - Added the base reset: `body` margin 0 and `[hidden]`.
- **Tools work on macOS, Linux and Windows:**
  - Added `tools/env.sh`, which finds Chrome and Python, with `CHROME=` and `PORT=` overrides.
- **Engine lab:** lowered the garage pegboard so it reads as a pegboard. Before, only the ends of its tools showed, as large stripes across the top of the view.
- **Lab numbers:** they now run 1–14 without repeats. Microwave is 5, camera is 11 and GPS is 12.
- **Checks:**
  - All 12 Node suites pass.
  - `shot.sh` shows 0 console errors on all 14 labs at 1400 and 500 px.
  - Layout shift and overflow are 0 for engine, fridge and GPS at 1400 and 500 px.

## Open
- Choose the house look and the next machines from `docs/machine_survey*.md`. The top of the second survey lists a tuned mass damper, a rocket, a roller coaster, a golf ball and a gyroscope.
- Known weak views:
  - Battery props sit out of frame.
  - The thermostat has low contrast in Clean.
  - The airplane wing crops at some widths.
- Validation pages that compare each lab with published data.
- Nothing has been tested on a real phone yet.
