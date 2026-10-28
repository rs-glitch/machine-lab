"""Build a refrigerant property table (JS) from CoolProp, same layout as make_r600a.py.

Usage: python tools/make_fluid.py <CoolProp fluid> <global name> <out .js> [Tmin Tmax]
Example: python tools/make_fluid.py Propane HP_R290 web/labs/heatpump-data.js -45 75
Saturation table every 1 K; superheat table 0..120 K every 5 K -> h, s, v.
Units: P kPa, h kJ/kg, s kJ/kg/K, v m3/kg.
"""
import json, sys
from pathlib import Path
import CoolProp
import CoolProp.CoolProp as CP

F, NAME, OUT = sys.argv[1], sys.argv[2], Path(sys.argv[3])
T0, T1 = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (-45, 75)
TS = list(range(T0, T1 + 1))
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

meta = {"fluid": F, "source": f"CoolProp {CoolProp.__version__}, IIR reference state"}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(f"globalThis.{NAME}=" + json.dumps({"meta": meta, "sat": sat, "sh": sh}, separators=(",", ":")) + ";\n")
print(OUT, OUT.stat().st_size, "bytes")
