#!/bin/sh
# Headless check: wrap web/index.html, open each lab, save screenshots and a DOM status dump.
# Usage: sh tools/shot.sh [outdir]   (needs: python3 -m http.server on $PORT (default 8765) serving web/)
cd "$(dirname "$0")/.." || exit 1
. tools/env.sh
TEST=_test_$PORT.html
OUT=$(cd "$(dirname "$0")/.." && mkdir -p "${1:-shots}" && cd "${1:-shots}" && pwd)
{ echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  echo '<script>window.__err=[];addEventListener("error",e=>__err.push(String(e.message)));setTimeout(()=>{const p=document.createElement("pre");p.id="status";p.textContent=JSON.stringify({err:__err,tiles:[...document.querySelectorAll(".tile")].map(t=>t.innerText.replace(/\s+/g," ")).slice(0,9)});document.body.appendChild(p)},6000)</script>'
  echo '</head><body>'; cat web/index.html; echo '</body></html>'; } > "web/$TEST"
for lab in ${LABS:-fridge engine washer}; do
  for size in ${SIZES:-1280,900 500,1000}; do
    W=${size%,*}
    "$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --hide-scrollbars \
      --window-size=$size --virtual-time-budget=9000 --user-data-dir="$(mktemp -d)" \
      --screenshot="$(nativepath "$OUT/${lab}_$W.png")" "http://127.0.0.1:$PORT/$TEST#$lab" 2>/dev/null
  done
  "$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=9000 --user-data-dir="$(mktemp -d)" \
    --dump-dom "http://127.0.0.1:$PORT/$TEST#$lab" 2>/dev/null | sed -n 's/.*<pre id="status">\(.*\)<\/pre>.*/\1/p' | sed "s/^/$lab: /"
done
rm -f "web/$TEST"
