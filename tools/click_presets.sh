#!/bin/sh
# Headless check: click every preset in every lab, then one slider; report errors, notes and mission state.
# Needs: python3 -m http.server $PORT (default 8765) serving web/
cd "$(dirname "$0")/.." || exit 1
. tools/env.sh
{ echo '<!doctype html><html><head><meta charset="utf-8">'
  echo '<script>window.__err=[];addEventListener("error",e=>__err.push(String(e.message)));'
  echo 'setTimeout(()=>{const out=[];for(const lab of ["fridge","engine","washer"]){document.querySelector(`[data-lab=${lab}]`).click();'
  echo 'document.querySelectorAll("#presets .preset").forEach(b=>{b.click();out.push(lab+" | "+b.textContent+" | "+document.querySelector("#pnote").textContent.slice(0,60)+" | done="+document.querySelectorAll("#missions li.done").length)});'
  echo 'const i=document.querySelector("#sliders input");i.value=i.min;i.dispatchEvent(new Event("input"));out.push(lab+" | manual | "+document.querySelector("#pnote").textContent)}'
  echo 'const p=document.createElement("pre");p.id="status";p.textContent=JSON.stringify({err:__err,out});document.body.appendChild(p)},4000)</script>'
  echo '</head><body>'; cat web/index.html; echo '</body></html>'; } > web/_test.html
"$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=12000 --user-data-dir="$(mktemp -d)" \
  --dump-dom "http://127.0.0.1:$PORT/_test.html" 2>/dev/null | sed -n 's/.*<pre id="status">\(.*\)<\/pre>.*/\1/p' | sed 's/","/\n/g'
rm -f web/_test.html
