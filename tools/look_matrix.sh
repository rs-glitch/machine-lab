#!/bin/sh
# Render every look x every lab headlessly; count console/shader errors; build one contact sheet per look.
# Needs: python3 -m http.server $PORT (default 8765) serving web/.  Usage: sh tools/look_matrix.sh <outdir>
cd "$(dirname "$0")/.." || exit 1
O=$(mkdir -p "$1" && cd "$1" && pwd); . tools/env.sh; C=$CHROME
LOOKS=${LOOKS:-"ink comic chalk dither blueprint riso pencil pixel neon"}; LABS=${LABS:-"fridge engine washer heatpump microwave bicycle motor pump windturbine airfoil camera gps battery thermostat"}
for lk in $LOOKS; do
  { echo '<!doctype html><html><head><meta charset="utf-8">'; echo "<script>try{localStorage.setItem('eml-look',JSON.stringify('$lk'))}catch(e){}</script></head><body>"; cat web/index.html; echo '</body></html>'; } > "web/_m_$lk.html"
  for lab in $LABS; do
    n=$("$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --hide-scrollbars --window-size=1400,1000 --virtual-time-budget=7000 \
      --enable-logging=stderr --v=0 --user-data-dir="$(mktemp -d)" --screenshot="$(nativepath "$O/${lk}_$lab.png")" "http://127.0.0.1:$PORT/_m_$lk.html#$lab" 2>&1 | grep -c "shader error\|not valid\|Uncaught")
    [ "$n" != "0" ] && echo "ERR $lk/$lab: $n"
  done
done; wait
rm -f web/_m_*.html
LABS="$LABS" "$PY" - "$O" $LOOKS <<'EOF'
import sys
from PIL import Image, ImageDraw
o, looks = sys.argv[1], sys.argv[2:]
import os, math
labs = os.environ["LABS"].split()
for lk in looks:
    rows = math.ceil(len(labs) / 4); W = Image.new('RGB', (1600, rows * 320), 'white'); d = ImageDraw.Draw(W)
    for i, lab in enumerate(labs):
        try: im = Image.open(f"{o}/{lk}_{lab}.png")
        except Exception: continue
        W.paste(im.crop((300, 300, 870, 1000)).resize((400, 300 * 700 // 570 if False else 300)), ((i % 4) * 400, (i // 4) * 320 + 20))
        d.text(((i % 4) * 400 + 4, (i // 4) * 320 + 4), f"{lk} / {lab}", fill='red')
    W.save(f"{o}/sheet_{lk}.png")
print("sheets done")
EOF
