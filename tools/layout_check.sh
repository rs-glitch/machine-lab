#!/bin/sh
# Layout lock check: for each look, record the boxes of the main panels and compare them with the Clean look.
# Needs: python3 -m http.server $PORT (default 8765) serving web/.  Usage: W=1400 H=1000 LAB=engine sh tools/layout_check.sh
cd "$(dirname "$0")/.." || exit 1
Q=${Q:-}
. tools/env.sh; C=$CHROME; W=${W:-1400}; H=${H:-1000}; LAB=${LAB:-engine}
OUT=$(mktemp)
for lk in clean cad ink comic chalk dither blueprint riso pencil pixel neon; do
  { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    echo "<script>window.Q='$Q';try{localStorage.setItem('eml-look',JSON.stringify('$lk'))}catch(e){};setTimeout(()=>{const q=(window.Q||'header,nav,#looks,.intro,#tiles,.ctl,#stage,#c1,#c2,.learn,#missions').split(',');"
    echo "const r=q.map(s=>{const b=document.querySelector(s).getBoundingClientRect();return s+':'+[b.x,b.y,b.width,b.height].map(v=>Math.round(v)).join(',')});const p=document.createElement('pre');p.id='lay';p.textContent=r.join(' ');document.body.appendChild(p)},4000)</script></head><body>"
    cat web/index.html; echo '</body></html>'; } > "web/_lay_${PORT}_$lk.html"
  "$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=$W,$H --virtual-time-budget=6000 --user-data-dir="$(mktemp -d)" \
    --dump-dom "http://127.0.0.1:$PORT/_lay_${PORT}_$lk.html#$LAB" 2>/dev/null | sed -n 's/.*<pre id="lay">\(.*\)<\/pre>.*/\1/p' | sed "s/^/$lk /" >> "$OUT"
  rm -f "web/_lay_${PORT}_$lk.html"
done
"$PY" - "$OUT" <<'EOF'
import sys
rows = [l.split() for l in open(sys.argv[1]) if l.strip()]
base = {k: list(map(int, v.split(','))) for k, v in (t.split(':') for t in rows[0][1:])}
worst = 0
for r in rows:
    d = {k: list(map(int, v.split(','))) for k, v in (t.split(':') for t in r[1:])}
    diffs = {k: max(abs(a - b) for a, b in zip(d[k], base[k])) for k in base}
    bad = {k: v for k, v in diffs.items() if v > 1}
    worst = max(worst, max(diffs.values()))
    print(r[0], " ".join(x for x in r[1:] if x.split(":")[0] in ("header","main","h1"))) if __import__("os").environ.get("RAW") else None; print(f"{r[0]:10s} max shift {max(diffs.values()):4d}px", ("moved: " + ", ".join(f"{k} {v}" for k, v in bad.items())) if bad else "ok")
print("WORST", worst)
EOF
rm -f "$OUT"
