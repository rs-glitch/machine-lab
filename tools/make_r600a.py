"""Build web/r600a.js: R-600a (isobutane) property tables from CoolProp for the fridge lab.

Saturation table: Tsat -45..75 C, step 1 K.
Superheat table: same Tsat rows x superheat 0..120 K, step 5 K -> h, s, v.
Units: P kPa, h kJ/kg, s kJ/kg/K, v m3/kg.
"""
import json
from pathlib import Path
import CoolProp
import CoolProp.CoolProp as CP

F = "Isobutane"
TS = list(range(-45, 76))
DT = list(range(0, 121, 5))
r = lambda x, n=4: round(x, n)

sat = {"T": TS, "P": [], "hf": [], "hg": [], "sf": [], "sg": [], "vg": []}
sh = {"dT": DT, "h": [], "s": [], "v": []}
for t in TS:
    T = t + 273.15
    P = CP.PropsSI("P", "T", T, "Q", 0, F)
    sat["P"].append(r(P / 1e3, 3))
    for q, hk, sk in ((0, "hf", "sf"), (1, "hg", "sg")):
        sat[hk].append(r(CP.PropsSI("H", "T", T, "Q", q, F) / 1e3, 3))
        sat[sk].append(r(CP.PropsSI("S", "T", T, "Q", q, F) / 1e3, 5))
    sat["vg"].append(r(1 / CP.PropsSI("D", "T", T, "Q", 1, F), 6))
    hrow, srow, vrow = [], [], []
    for d in DT:
        if d == 0:  # saturated vapour; PT flash is ill-posed exactly on the dome
            hrow.append(sat["hg"][-1]); srow.append(sat["sg"][-1]); vrow.append(sat["vg"][-1])
            continue
        hrow.append(r(CP.PropsSI("H", "T", T + d, "P", P, F) / 1e3, 3))
        srow.append(r(CP.PropsSI("S", "T", T + d, "P", P, F) / 1e3, 5))
        vrow.append(r(1 / CP.PropsSI("D", "T", T + d, "P", P, F), 6))
    sh["h"].append(hrow); sh["s"].append(srow); sh["v"].append(vrow)

meta = {"fluid": "R-600a (isobutane)", "source": f"CoolProp {CoolProp.__version__}, IIR reference state"}
out = Path(__file__).resolve().parent.parent / "web" / "r600a.js"
out.parent.mkdir(exist_ok=True)
out.write_text("globalThis.R600A=" + json.dumps({"meta": meta, "sat": sat, "sh": sh}, separators=(",", ":")) + ";\n")
print(out, out.stat().st_size, "bytes")
