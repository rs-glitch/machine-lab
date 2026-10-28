#!/bin/sh
# Debug: print geometry of a few elements in one look. Usage: LOOK=pixel LAB=engine sh tools/debug_fit.sh
cd "$(dirname "$0")/.." || exit 1
. tools/env.sh; C=$CHROME; LOOK=${LOOK:-pixel}; LAB=${LAB:-engine}
{ echo '<!doctype html><html><head><meta charset="utf-8">'
  echo "<script>try{localStorage.setItem('eml-look',JSON.stringify('$LOOK'))}catch(e){};setTimeout(()=>{const o=[];"
  echo "const d=(s)=>{const el=document.querySelector(s);if(!el){o.push(s+' none');return}const r=el.getBoundingClientRect();o.push(s+' x'+Math.round(r.left)+' w'+Math.round(r.width)+' h'+Math.round(r.height)+' sw'+el.scrollWidth+' cw'+el.clientWidth+' sh'+el.scrollHeight+' ch'+el.clientHeight+' fs'+getComputedStyle(el).fontSize+' inl'+el.style.fontSize)};"
  echo "['.ctl','.sliders','.sl','.sl label','.sl label span','.sl output','.sl input','.preset.edge','.intro h2','#presets','.ctl .eyebrow'].forEach(d);"
  echo "const p=document.createElement('pre');p.id='dbg';p.textContent=o.join(' || ');document.body.appendChild(p)},5000)</script></head><body>"
  cat web/index.html; echo '</body></html>'; } > web/_dbg.html
"$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1400,1000 --virtual-time-budget=7000 --user-data-dir="$(mktemp -d)" \
  --dump-dom "http://127.0.0.1:$PORT/_dbg.html#$LAB" 2>/dev/null | sed -n 's/.*<pre id="dbg">\(.*\)<\/pre>.*/\1/p' | sed 's/ || /\n/g'
rm -f web/_dbg.html
