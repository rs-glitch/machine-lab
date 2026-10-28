# Lab plug-ins

Each extra machine is one classic script `labs/<id>.js`, loaded after the main script in `index.html`.
It ends with `registerLab(myLab)`. Globals from the main script are available:
`$, P, fmt, store, chart, path, moveDot, tiles, checkMissions, optOf, stageButtons, THREE, M, V3, tube, stretch, helixGeo, glassBox, lights, tempColor, fitCam, D2R, reduced`.

Required fields (same as `fridge`, `engine`, `washer` in index.html):
- `id`, `tab` (nav label), `charts: [c1 title, c1 caption, c2 title, c2 caption]`, `eyebrow`, `concept`, `text`, `home`, `notes[]`
- `s` (slider state), `sliders[]` ({k,label,min,max,step,unit,fmt,hint})
- `presets[]` ({n, kind: 'opt'|'typ'|'edge', s, note}); exactly one `opt`; the optimum is drawn as a `.ghost` path on the main chart
- `missions[]` ({t, d, win, check(state)}); call `checkMissions(this, state)` in `update()` or `frame()`
- `chipsList[]`, `partInfo{}`, `pick(k)`, `build()` (sets `this.scene` and `this.cam = {p, t}`), `update()`, `drawCharts()`, `frame(dt)`, `extra()`
- Optional `onPreset()`.
- Teaching content goes in `web/teach.js` under the lab id, not in the lab file: `key` (tile labels shown first on a phone), `myth {m, t, a}`, and one `missions[]` entry per mission with a prediction `q`, three options `o`, the right index `a`, and the tile labels `f` to outline. Labels match by prefix. Check every answer and every "test it" step against the lab's own model.
- Do not use the lab property names `keyTiles`, `myth` or `taught`; the shell sets them.

Rules: physics in plain functions inside the lab file (or `labs/<id>-data.js` for tables), checked by `tools/test_<id>.js` in Node.
Numbers from estimates are marked "est." in `notes`. Text in ASD-STE100 style.

## Layout and look rules (since v11)
- 10 visual looks are post-process shaders; never rely on colour alone. Light parts get outlines automatically.
- Tiles have a 2-line label slot and a 2-line caption slot; keep labels short. Text auto-shrinks to fit (fitText); do not set font sizes.
- Background props: set `decor: { u, y, set }` with an existing set (kitchen, garage, laundry, garden, counter, park) or `decor: { u, y, items: [[propName, args, behind_m, side_m, height_m]] }` using `PROPS` from index.html. u = scene units per metre, y = floor height in scene units.
- Checks before done (PORT = your port): `PORT=.. LAB=<id> sh tools/overflow_check.sh` (TOTAL 0), `PORT=.. LAB=<id> sh tools/layout_check.sh` (WORST 0), and the same at `W=500 H=1100`.
