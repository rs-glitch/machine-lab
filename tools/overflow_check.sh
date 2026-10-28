#!/bin/sh
# Text-in-box check: for every look, count text elements whose content is wider/taller than their box,
# and leaf text that sits outside its panel. Needs python3 -m http.server $PORT (default 8765) in web/.
# Usage: W=1400 H=1000 LAB=engine sh tools/overflow_check.sh
cd "$(dirname "$0")/.." || exit 1
. tools/env.sh; C=$CHROME; W=${W:-1400}; H=${H:-1000}; LAB=${LAB:-engine}; T=0
for lk in clean cad ink comic chalk dither blueprint riso pencil pixel neon; do
  { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    echo "<script>try{localStorage.setItem('eml-look',JSON.stringify('$lk'))}catch(e){};setTimeout(()=>{const bad=[];"
    echo "document.querySelectorAll(FIT).forEach(el=>{const one=getComputedStyle(el).whiteSpace==='nowrap';if(el.clientWidth&&(el.scrollWidth>el.clientWidth+1||(!one&&el.scrollHeight>el.clientHeight+3)))bad.push('clip:'+(el.id||el.className||el.tagName)+':'+el.textContent.trim().slice(0,24))});"
    echo "document.querySelectorAll('.panel,.tile,.chip,.btn,.preset,nav button,.looks button').forEach(box=>{const b=box.getBoundingClientRect();box.querySelectorAll('*').forEach(el=>{if(el.children.length||!el.textContent.trim()||el.closest('svg')||(el.closest('details:not([open])')&&!el.closest('summary')))return;const r=el.getBoundingClientRect();if(r.width&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1))bad.push('out:'+el.textContent.trim().slice(0,24))})});"
    echo "const p=document.createElement('pre');p.id='ov';p.textContent=bad.length+' '+bad.slice(0,6).join(' | ');document.body.appendChild(p)},5000)</script></head><body>"
    cat web/index.html; echo '</body></html>'; } > "web/_ov_${PORT}_$lk.html"
  r=$("$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=$W,$H --virtual-time-budget=7000 --user-data-dir="$(mktemp -d)" \
    --dump-dom "http://127.0.0.1:$PORT/_ov_${PORT}_$lk.html#$LAB" 2>/dev/null | sed -n 's/.*<pre id="ov">\(.*\)<\/pre>.*/\1/p')
  rm -f "web/_ov_${PORT}_$lk.html"; echo "$lk $r"; T=$((T + ${r%% *}))
done
echo "TOTAL $T"
