

const MARK='<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.6c.65 5.7 4.7 9.75 10.4 10.4-5.7.65-9.75 4.7-10.4 10.4-.65-5.7-4.7-9.75-10.4-10.4C7.3 11.35 11.35 7.3 12 1.6z"/></svg>';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const T=ms=>reduce?0:ms;

/* ---------- timing: every dwell, delay and typing speed in one place (durations and easings of CSS and
   WAAPI animations come from styles/tokens.css: --d-1…--d-5, --ease-*) ---------- */
const SEARCH={think:400, wordMax:26, streamCap:1200, settle:150}; // ms; think is real time (not motion), so reduced motion keeps it
const INTRO={sub:120, box:240, typeAfter:700, word:60, typeMs:30, rowStep:40, rowCap:240, intent:120}; // ms; list visible < 1 s
/* WAAPI reads its durations and easings from the CSS tokens, so one file sets every curve */
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim(), cssMs=n=>parseFloat(cssVar(n))||0;
const OPEN={restDelay:80};
const JTBD={total:900, gap:60}; // jobs matrix: every dot has landed by 900 ms; 60 ms beat between the grey jobs and the gold ones // ms: the rest of the page starts just after the camera move
const LOOP={demo:2, affordance:3, typeMs:55, caStep:3600, lfdStep:3000, slaHold:6000, slaDrop:240, slaReady:1200, slxRestart:4200, focusReplay:6500}; // ms; demos run LOOP.demo cycles, then hold

/* ---------- loops (W3-03): demos run 2 cycles, then hold their end state. They pause off-screen, on hover and on
   focus, and have a Pause toggle (aria-pressed). Under reduced motion they show their end state. ---------- */
function onAppear(sel,fn){ const seen=new WeakSet();
  const scan=r=>{ if(r.nodeType!==1&&r!==document) return; const list=(r.matches&&r.matches(sel)?[r]:[]).concat([...r.querySelectorAll(sel)]);
    list.forEach(el=>{ if(!seen.has(el)){ seen.add(el); fn(el); } }); };
  scan(document); new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(scan))).observe(document.documentElement,{childList:true,subtree:true}); }
function inView(el,fn,opts={threshold:.5}){ if(!('IntersectionObserver' in window)){ fn(true); return null; }
  const io=new IntersectionObserver(es=>es.forEach(e=>fn(e.isIntersecting)),opts); io.observe(el); return io; }
function loopCtl(host,{btn=null,btnHost=host,onChange}={}){
  const st=host.__lp={user:false,vis:false,hover:false,done:false};
  const deco=!!host.closest('.tbox,.th,[aria-hidden="true"]'); // thumbnails are decorative copies: same cycle cap, no control
  if(deco) btn=document.createElement('button');
  else if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.className='tl-jump lp-btn'; btnHost.appendChild(btn); }
  btn.innerHTML='<span aria-hidden="true">❚❚</span> Pause'; btn.setAttribute('aria-pressed','false'); btn.hidden=false;
  const paused=()=>st.user||!st.vis||st.hover;
  const apply=()=>{ host.classList.toggle('lp-paused',paused()); btn.setAttribute('aria-pressed',String(st.user)); if(onChange) onChange(paused()); };
  const finish=()=>{ st.done=true; btn.hidden=true; host.classList.remove('lp-paused'); };
  btn.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); st.user=!st.user; apply(); });
  host.addEventListener('pointerenter',()=>{ st.hover=true; apply(); }); host.addEventListener('pointerleave',()=>{ st.hover=false; apply(); });
  host.addEventListener('focusin',e=>{ if(e.target!==btn){ st.hover=true; apply(); } }); host.addEventListener('focusout',()=>{ st.hover=false; apply(); });
  host.classList.add('lp-paused'); inView(host,v=>{ st.vis=v; apply(); });
  return {paused,finish,btn,st};
}
/* CSS-only demos: a toggle per host; the 2 cycles come from the CSS iteration count. Hide the toggle once they end. */
function cssLoopCtl(host){ if(reduce) return; const c=loopCtl(host);
  host.addEventListener('animationend',()=>setTimeout(()=>{ if(host.getAnimations&&!host.getAnimations({subtree:true}).some(a=>a.playState!=='finished')) c.finish(); },50)); }

/* ---------- thumbnails ---------- */
let uid=0;
function uniq(svg){ const n=++uid; [...new Set([...svg.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))].forEach(id=>{ svg=svg.split(`id="${id}"`).join(`id="${id}-${n}"`).split(`#${id})`).join(`#${id}-${n})`).split(`href="#${id}"`).join(`href="#${id}-${n}"`); }); return svg; }
const HERO_IDS=['discount','send-time','audience'];
/* every case study's cover comes from the case study itself, so home always matches */
const STAGE_TPL={};
function hasStage(id){ if(document.getElementById('cs-'+id)) return true; try{ return !!(CS[id]&&CS[id].stage); }catch(e){ return false; } }
function caseTpl(id){ const t=document.getElementById('cs-'+id); if(t) return t.content; if(STAGE_TPL[id]) return STAGE_TPL[id].content;
  let html=''; try{ if(!CS[id]||!CS[id].stage) return null; html=caseRender(id); }catch(e){ return null; }
  const tp=document.createElement('template'); tp.innerHTML=html; STAGE_TPL[id]=tp; return tp.content; }
function thumbHTML(id){
  const p=P[id];
  if(hasStage(id)) return `<span class="tbox th hero-th" data-hero="${id}" data-mode="stage"></span>`;
  if(THUMBS[id]) return `<span class="tbox th">${uniq(THUMBS[id])}</span>`;
  if(p.img) return `<span class="tbox th"><img class="${p.contain?'contain':''}" src="${p.img}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'noimg',textContent:'${esc(p.title)}'}))"></span>`;
  return `<span class="tbox th"><span class="noimg">${esc(p.title)}</span></span>`;
}
function play(el,delay=0){ const t=el.classList.contains('th')?el:$('.th',el); if(!t) return; setTimeout(()=>{t.classList.remove('play'); void t.offsetWidth; t.classList.add('play')},delay); }
const badge=p=>'';

/* ---------- state ---------- */
const S={q:'',hits:[],answering:false,sel:0,auto:true,run:0,touched:false,first:true};
const inp=$('#q'), go=$('#go');

/* ---------- search scoring ---------- */
function hay(p){ return [p.title,p.org,p.role,p.stat,p.tip,p.sub,...p.tags,...(p.flow||[]).flat()].join(' ').toLowerCase(); }
function matchIds(q){
  q=q.trim().toLowerCase(); if(!q) return [];
  const words=q.split(/\s+/).filter(w=>w.length>2 && !STOP.has(w));
  if(!words.length) return [];
  return ORDER.map(id=>{ const h=hay(P[id]), t=P[id].title.toLowerCase(); let s=0;
      if(h.includes(q)) s+=5; words.forEach(w=>{ if(t.includes(w)) s+=3; else if(h.includes(w)) s+=1; }); return [id,s]; })
    .filter(x=>x[1]>=Math.max(1,Math.ceil(words.length/2))).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
}
const STOP=new Set("the and you your show what did does how are for with about work works working tell more some any can she her nila nila's me i'm all".split(' '));
function hl(text,q){
  const words=q.trim().toLowerCase().split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)); let out=esc(text);
  words.forEach(w=>{ out=out.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>'); });
  return out;
}

/* ---------- render results ---------- */
function rowHTML(id,i,q,hit){
  const p=P[id];
  const m=(typeof METRIC!=='undefined'&&METRIC[id])||null;
  return `<button class="sr ${hit?'hit':''}" data-open="${id}" data-i="${i}" role="option">${thumbHTML(id)}<span><span class="st">${hl(p.title,q)}</span><span class="sv">${hl((m&&m.v)||p.tip,q)}${m?`<span class="sm"><span class="sep"> · </span><b>${esc(m.n)}</b> ${esc(m.l)}</span>${hit?basisTag(id):''}`:''}</span></span><span class="se"><span class="m">${p.year}</span><span class="o">Open →</span></span></button>`;
}
function focusHTML(id,label){
  const p=P[id];
  const hl=(p.highlights||[]).map(h=>`<span class="fh">${esc(h[0])}</span>`).join('');
  return `<div class="focus-wrap">
    <a class="focus${hasStage(id)?' mini':''}" href="#${id}" data-open="${id}" aria-label="Open the ${esc(p.title)} case study">${hasStage(id)?`<span class="focus-art th hero-th" data-hero="${id}" data-mode="page"></span>`:`<span class="focus-art th">${uniq(THUMBS[id]||'')}</span>`}
    <span class="focus-body"><span class="focus-k">${esc(p.org)} · ${esc(p.role)} · ${p.year}</span><span class="focus-t">${esc(p.title)}</span><span class="focus-s">${esc(p.sub)}</span>
    <span class="focus-cta">Read the case study <span aria-hidden="true">→</span></span></span></a></div>`;
}
function cardHTML(id,hit){
  const p=P[id];
  return `<a class="pc ${hit?'hit':''}" href="#${id}" data-open="${id}">${thumbHTML(id)}<span class="pc-body"><span class="pc-title">${esc(p.title)} ${badge(p)}</span><span class="pc-stat">${esc(p.stat)}</span>${basisTag(id)}<span class="pc-foot"><span>${esc(p.org)} · ${p.year}</span><span class="pc-open">Open →</span></span></span></a>`;
}
function render(opts={}){
  const q=S.q, hits=S.hits, rest=ORDER.filter(id=>!hits.includes(id)&&id!==S.focus&&!isPG(id)&&id!=='system');
  const restLabel=hits.length?'Everything else':(S.focus?'More work':'All projects');
  const askable=q.trim().length>0 && !S.answering;
  const hitLabel=S.answerFor?'In this answer':`Matching “${esc(q.trim())}”`;
  let html='', i=0;
  if(askable) html+=`<button class="sr ask" data-ask data-i="${i++}" role="option"><span class="ai">${MARK}</span><span class="st">Ask <q>${esc(q.trim())}</q></span><span class="se"><span class="m">↵</span><span class="o">Ask ↵</span></span></button>`;
  if(hits.length) html+=`<div class="grp">${hitLabel}<b>${hits.length}</b></div>`+hits.map(id=>rowHTML(id,i++,S.answerFor?'':q,true)).join('');
  const res=$('#res'); res.innerHTML=html; res.style.display=html?'':'none';
  $('#more-list').innerHTML=rest.map(id=>rowHTML(id,i++,'',false)).join('');
  $('#more-h').textContent=restLabel; $('#more-n').textContent=rest.length+' projects';
  $('#more-list').classList.toggle('dim',hits.length>0);
  const rows=ALLROWS();
  if(opts.keepSel==null) S.sel = (askable && (q.trim().includes(' ')||!hits.length)) ? 0 : (askable?1:(hits.length?0:-1));
  rows.forEach((r,k)=>r.classList.toggle('sel',k===S.sel));
  if(opts.stagger) rows.forEach((r,k)=>{ r.classList.add('in'); r.style.animationDelay=Math.min(k*INTRO.rowStep,INTRO.rowCap)+'ms'; });
  rows.forEach(r=>r.addEventListener('mouseenter',()=>{ rows.forEach(x=>x.classList.remove('sel')); r.classList.add('sel'); S.sel=+r.dataset.i; play(r); }));
  // cards layout
  if(hits.length){ $$('#res .sr.hit').forEach((r,k)=>play(r,200+k*120)); }
  $('#clr').hidden=!(q||S.answerFor); $('#kbd').hidden=!!(q||S.answerFor);
  go.disabled=!(q.trim()||inp.value.trim()||(S.primed&&!S.answerFor));
}
const ALLROWS=()=>$$('#res .sr, #more-list .sr');
function moveSel(d){
  const rows=ALLROWS(); if(!rows.length) return;
  S.sel=(S.sel+d+rows.length)%rows.length; rows.forEach((r,k)=>r.classList.toggle('sel',k===S.sel));
  rows[S.sel].scrollIntoView({block:'nearest'}); play(rows[S.sel]);
}

async function ask(q,auto){
  q=q.trim(); if(!q) return;
  if(S.primed){ prime(false); }
  const rid=++S.run; S.touched=true; S.focus=null;
  inp.value=q; S.q=''; S.answering=true; S.answerFor=q; S.hits=[]; go.classList.remove('ready');
  $('#chips').style.display='none';
  const a=$('#ans'); a.classList.add('on'); a.setAttribute('aria-busy','true'); $('#ans-next').innerHTML=''; $('#ans-live').textContent='';
  // honest search (L9, D5): a fixed, short match step with one static line; no ticking timer, no quips
  a.innerHTML=`<div class="think">${MARK}<span>Matching…</span></div>`;
  render({keepSel:true}); ALLROWS().forEach(r=>r.classList.remove('sel'));
  const t0=performance.now(), r=route(q);
  await sleep(SEARCH.think); if(rid!==S.run) return;
  const took=((performance.now()-t0)/1000).toFixed(1);
  const words=r.text.split(' '), step=T(Math.min(SEARCH.wordMax, SEARCH.streamCap/words.length));
  a.innerHTML=`<div class="think done meta">${MARK}<span>Matched in ${took}s · Answers written by Nila</span></div><p class="ans-p">${words.map((w,i)=>`<span class="w" style="animation-delay:${Math.round(i*step)}ms">${esc(w)}</span>`).join(' ')}</p>`;
  await sleep(Math.round(words.length*step)+T(SEARCH.settle)); if(rid!==S.run) return;
  if(r.html) a.insertAdjacentHTML('beforeend',`<div class="ans-x up">${r.html}</div>`);
  if(r.focus){ a.insertAdjacentHTML('beforeend',focusHTML(r.focus,r.label)); const f=$('.focus',a); play(f,350); f.addEventListener('mouseenter',()=>play(f)); let plays=1; const lp=setInterval(()=>{ if(!document.contains(f)||plays>=LOOP.demo) return clearInterval(lp); if(!f.matches(':hover')&&$('#v-home').classList.contains('on')){ play(f); plays++; } },LOOP.focusReplay); S.focus=r.focus;
    if(auto&&!S.userScrolled){ const y=$('#box').getBoundingClientRect().top+scrollY-108; window.scrollTo({top:y,behavior:reduce?'auto':'smooth'}); } }
  const fol=pickNext(r,q);
  $('#ans-next').innerHTML=`<div class="fqs"><span>Ask next</span>${fol.map(c=>`<button class="fq" data-q="${esc(c.q)}">${esc(c.q)} <i>→</i></button>`).join('')}</div>`;
  S.answering=false; S.hits=r.ids; S.sel=-1; a.setAttribute('aria-busy','false'); $('#ans-live').textContent=r.text;
  render({keepSel:true});
}
function clearAll(){
  S.run++; S.q=''; S.hits=[]; S.answerFor=null; S.answering=false; S.focus=null; inp.value=PREFILL; S.primed=true; inp.placeholder='Ask about my work, or search projects'; setTimeout(()=>prime(true),0);
  $('#ans').classList.remove('on'); $('#ans').removeAttribute('aria-busy'); $('#ans-live').textContent=''; $('#ans').innerHTML=''; $('#ans-next').innerHTML=''; $('#chips').style.display='';
  render();
}

/* ---------- input wiring ---------- */
inp.addEventListener('input',()=>{
  S.touched=true; S.run++; S.answering=false; S.focus=null; go.classList.remove('ready'); if(S.primed&&inp.value!==PREFILL) prime(false);
  if(S.answerFor){ S.answerFor=null; $('#ans').classList.remove('on'); $('#ans').removeAttribute('aria-busy'); $('#ans-live').textContent=''; $('#ans').innerHTML=''; $('#ans-next').innerHTML=''; }
  $('#chips').style.display=inp.value?'none':'';
  S.q=inp.value; S.hits=matchIds(S.q); render();
});
inp.addEventListener('focus',()=>{ S.touched=true; });
inp.addEventListener('focus',()=>{ if(S.primed&&inp.value===PREFILL) inp.select(); });
inp.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); moveSel(e.key==='ArrowDown'?1:-1); }
  else if(e.key==='Escape'){ e.preventDefault(); clearAll(); }
});
$('#qform').addEventListener('submit',e=>{
  e.preventDefault();
  if(runPrimed()) return;
  const sel=ALLROWS()[S.sel];
  if(sel&&sel.dataset.open) return openCase(sel.dataset.open);
  ask(inp.value);
});
$('#clr').addEventListener('click',()=>{ clearAll(); inp.focus(); });
$('#res').addEventListener('click',e=>{ if(e.target.closest('[data-ask]')) ask(inp.value); });
document.addEventListener('click',e=>{ const c=e.target.closest('.chip[data-q],.fq[data-q]'); if(c) ask(c.dataset.q); });
$('#chips').innerHTML='';
addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); inp.focus(); inp.select(); }
  else if(e.key==='/'&&!e.target.matches('input,textarea')){ e.preventDefault(); inp.focus(); }
});

/* ---------- pages + routing (#send-time, #all, home) ---------- */
let booted=false, homeY=0;

/* ---------- case studies: a process tailored to each project ----------
   Each chapter is one step of that project's design process: {s: step name, d: one-line overview, k: kind, h2, body, blocks}
   kinds → treatment: overview/design = page · research = tint band · strategy = paper band · solution = dark band (the emphasis) · outcome = quiet page
   The process overview sits above the chapters; its tab row sticks under the site header while you read.
   blocks: stats [[big,text]] · quote {q,who} · img {src,cap,w} · imgs [{src|f,cap,win}] (+cover, top) · video {src,cap}
           pts [[h3,body]] · steps [..] · bars [{label,sub,w,val,hi}] · cards [{n,b,s,win}] · insight {k,t}
           state {big,note} · note [b,s] · swing {vals,agg,cap} · ba {before,after} · ph {t,s} · todo "…"
   Figma frames: {f: file name in assets/figma/, cap}. Shows assets/figma/<f>.png with its caption; add the PNG to restore a card (O12). */
const KIND={overview:"ch",research:"tint",strategy:"paper",design:"ch",solution:"ink",outcome:"ch"};
function figItem(i,single){
  const e=esc;
  if(i.f) return `<figure class="cs-fig fig${i.win?' win':''}"><img src="assets/figma/${i.f}.png" alt="${e(i.cap)}" loading="lazy"><figcaption class="cap">${e(i.cap)}</figcaption></figure>`;
  const sz=SZ[i.src], portrait=sz&&sz[1]>sz[0]*1.05;
  let mw=i.w||(single?(portrait?380:(sz?Math.min(1000,sz[0]):0)):0);
  const st=mw?` style="max-width:${mw}px"`:'';
  const media=/\.mp4$/.test(i.src)?`<video src="${i.src}" muted loop playsinline preload="metadata"></video>`:`<img src="${i.src}" alt="${e(i.cap)}" loading="lazy">`;
  return `<figure class="cs-fig${i.win?' win':''}${mw?' fit':''}"${st}>${media}<figcaption class="cap">${e(i.cap)}</figcaption></figure>`;
}
/* D4 (O10): the basis of a lift ("relative lift"), next to every figure that comes from P.stat. The text lives in Content's METRIC registry. */
function basisTag(id){ const f=((typeof METRIC!=='undefined'&&METRIC[id]&&METRIC[id].figs)||[]).find(x=>x.basis); return f?`<small data-basis="${esc(f.basis.split(' ')[0])}" data-fig="${id}">${esc(f.basis)}</small>`:''; }
function caseRender(id){
  const c=CS[id], p=P[id], e=esc;
  const stage=c.stage.html?`<div class="dd-stage lx-stage">${c.stage.html}</div>`:c.stage.thumb?`<div class="dd-stage cs-th th" data-t="${c.stage.thumb}"></div>`:c.stage.video?`<div class="dd-stage cs-media"><video src="${c.stage.video}" poster="${c.stage.video.replace(/\.mp4$/,'.jpg')}" muted loop playsinline autoplay preload="metadata"></video></div>`:`<div class="dd-stage cs-media${c.stage.contain?' contain':''}"><img src="${c.stage.img}" alt="${e(p.title)}"></div>`;
  const B=b=>{
    if(b.stats) return `<div class="dd-stats n${b.stats.length}">${b.stats.map(s=>`<div><b>${e(s[0])}</b><span>${e(s[1])}</span></div>`).join('')}</div>`;
    if(b.quote) return `<blockquote class="cs-q"><p>${e(b.quote.q)}</p><cite>${e(b.quote.who)}</cite></blockquote>`;
    if(b.img) return figItem(b.img,1);
    if(b.imgs) return `${b.sub?`<p class="h3 cs-subh">${e(b.sub)}</p>`:''}<div class="cs-imgs n${b.imgs.length}${b.cover?' cover':''}${b.top?' top':''}${b.narrow?' narrow':''}">${b.imgs.map(i=>figItem(i,0)).join('')}</div>`;
    if(b.video) return `<figure class="cs-fig"><video src="${b.video.src}" muted loop playsinline preload="metadata"></video><figcaption class="cap">${e(b.video.cap)}</figcaption></figure>`;
    if(b.pts) return `<div class="cs-pts n${b.pts.length}">${b.pts.map(x=>`<div><p class="h3">${e(x[0])}</p><p class="body">${e(x[1])}</p></div>`).join('')}</div>`;
    if(b.steps) return `${b.sub?`<p class="h3 cs-subh">${e(b.sub)}</p>`:''}<ol class="cs-steps">${b.steps.map((x,i)=>`<li><i>${i+1}</i>${e(x)}</li>`).join('')}</ol>`;
    if(b.bars) return `<div class="dd-bars cs-bars">${b.bars.map(x=>`<div class="dd-bar ${x.hi?'y':'g'}"><span>${e(x.label)}<small>${e(x.sub||'')}</small></span><s style="--w:${x.w}%"></s><b>${e(x.val)}</b></div>`).join('')}</div>${b.cap?`<p class="cap">${e(b.cap)}</p>`:''}`;
    if(b.cards) return `<div class="dd-cx n${b.cards.length}">${b.cards.map(x=>`<div class="${x.win?'win':''}"><small>${e(x.n)}</small><b>${e(x.b)}</b>${x.s?`<span>${e(x.s)}</span>`:''}</div>`).join('')}</div>`;
    if(b.insight) return `<div class="cs-ins"><small>${e(b.insight.k)}</small><p>${e(b.insight.t)}</p></div>`;
    if(b.state) return `<p class="cs-state">${e(b.state.big)}</p>${b.state.note&&b.state.note.length?`<p class="cs-note"><b>${e(b.state.note[0])}</b> ${e(b.state.note[1])}</p>`:''}`;
    if(b.note) return `<p class="cs-note"><b>${e(b.note[0])}</b> ${e(b.note[1])}</p>`;
    if(b.learn) return `<div class="dd-learn">${b.learn.map(x=>`<div><small>${e(x[0])}</small><b>${e(x[1])}</b>${x[2]?`<span>${e(x[2])}</span>`:''}</div>`).join('')}</div>`;
    if(b.swing) return `<div class="cs-swing"><div class="sw-rows">${b.swing.vals.map((v,i)=>`<div class="sw-r"><span>Send ${i+1}</span><div class="sw-t"><s class="${v<0?'neg':v>0?'pos':'zero'}" style="--v:${Math.abs(v)/2}%"></s></div><b>${v>0?'+':''}${v}%</b></div>`).join('')}</div><div class="sw-agg"><small>Same campaigns, measured together</small><b>${e(b.swing.agg)}</b><span>A small, steady effect</span></div></div>${b.swing.cap?`<p class="cap">${e(b.swing.cap)}</p>`:''}`;
    if(b.ba) return `<div class="cs-ba2"><div><small>Before</small><ul>${b.ba.before.map(x=>`<li><b>${e(x[0])}</b><span>${e(x[1])}</span></li>`).join('')}</ul></div><i aria-hidden="true">→</i><div class="after"><small>After</small><p class="badge"><svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M9 1 3 9h4l-1 6 6-8H8z"/></svg>${e(b.ba.after[0])}</p><span>${e(b.ba.after[1])}</span></div></div>`;
    if(b.personas) return `<div class="cs-per">${b.personas.map(x=>`<div><small>${e(x.n)}</small><b>${e(x.b)}</b><span>${e(x.s)}</span></div>`).join('')}</div>`;
    if(b.variants) return `<div class="cs-var">${b.variants.map(x=>`<div class="${x.win?'win':''}"><figure><img src="${x.img}" alt="${e(x.k)}" loading="lazy"></figure><small>${e(x.k)}</small><b>${e(x.t)}</b><ul>${x.pts.map(t=>`<li>${e(t)}</li>`).join('')}</ul>${x.h?`<p><i>Hypothesis</i>${e(x.h)}</p>`:''}</div>`).join('')}</div>`;
    if(b.yt) return `<a class="cs-yt" href="${b.yt.href}" target="_blank" rel="noopener"><span class="cs-yti" aria-hidden="true">▶</span><span><b>${e(b.yt.t)}</b><small>${e(b.yt.s)}</small></span><em>Watch on YouTube ↗</em></a>`;
    if(b.html) return b.html;
    if(b.ph) return `<div class="cs-ph"><small>Screen to add</small><b>${e(b.ph.t)}</b><span>${e(b.ph.s)}</span></div>`;
    if(b.todo) return ``;
    return '';
  };
  let mid=0; const bandFor=(ch,i)=>{ if(i===0){ mid=0; return 'tint'; } if(ch.k==='solution') return 'ink'; if(ch.k==='outcome') return 'ch'; mid++; return mid%2?'ch':'paper'; };
  const rich=c=>c.blocks.length>=3||c.blocks.some(b=>b.html||b.variants||b.personas||b.img||b.imgs||b.video||b.bars||b.cards||b.learn||b.swing||b.ba||(b.stats&&b.stats.length>=3));
  const chap=(ch,i)=>{ const want=bandFor(ch,i), t=(i===0||want==='ch'||want==='ink'||rich(ch))?want:'ch', cls=(t==='ch'?'ch':'band '+t)+(ch.k==='outcome'?' outcome':'');
    const last=i===c.ch.length-1;
    return `<section class="${cls}" data-chap="${i}" data-s="${e(ch.s)}" data-d="${e(ch.d||'')}"><div class="head"><p class="lbl">${String(i+1).padStart(2,'0')} · ${e(ch.s)}</p>${ch.h2?`<h2 class="h2">${e(ch.h2)}</h2>`:''}${ch.body?`<p class="body">${e(ch.body)}</p>`:''}</div>${ch.blocks.map(b=>`<div class="cs-b">${B(b)}</div>`).join('')}${last&&c.reflect?`<div class="cs-b cs-reflect"><small>Looking back</small><p>${e(c.reflect)}</p></div>`:''}</section>`; };
  return `<article class="dd" data-cs="${id}">
    <header class="dd-hero"><div class="cs-eyebrow">${isPG(id)?'Playground':'Case study'} · ${e(p.org)}${!isPG(id)&&p.role&&p.role!=='Playground'?' · '+e(p.role):''} · ${p.year}</div>
      <h1 class="cs-h1">${e(p.title)}</h1><p class="body">${e(c.sub)}</p>
</header>
    ${stage}
    <div class="dd-tldr">${c.tldr.filter(x=>x[0]!=='Insight').concat(P[id]&&P[id].stat?[['Impact',P[id].stat]]:[]).map(x=>`<div><span>${e(x[0])}</span><b>${e(x[1])}</b>${x[0]==='Impact'?basisTag(id):''}</div>`).join('')}</div>
    <div class="cs-proc" data-proc></div>
    ${c.ch.map(chap).join('')}
  </article>`;
}
/* process overview + sticky step bar, built from the sections on the page (works for the hand-built Discount page too) */
/* ---------- design process navigation: top-bar treatments to compare in place (temporary switcher, bottom-left) ---------- */
const NAVS=[["hlinks","Links + underline"]];
let NAVM='hlinks';
const SI=(()=>{ const p=(d,x='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${x}</svg>`;
  const I={quote:p('<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),ab:p('<rect x="3" y="5" width="7.5" height="14" rx="2"/><rect x="13.5" y="5" width="7.5" height="14" rx="2"/><path d="M17.2 10v4M15.2 12h4"/>'),chart:p('<path d="M4 19h16"/><path d="M6 15l4-4 3 2 5-6"/>'),ui:p('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h6"/><rect x="7" y="12" width="10" height="4" rx="2"/>'),num:p('<path d="M5 18l4-5 3 3 7-9"/><path d="M15 7h4v4"/>'),grid:p('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),fork:p('<path d="M6 4v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v2"/><path d="M18 4v4"/><circle cx="6" cy="4" r="1.5"/><circle cx="18" cy="4" r="1.5"/>'),alert:p('<path d="M12 4 21 19H3z"/><path d="M12 10v4M12 17h.01"/>'),flask:p('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>'),people:p('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19a6 6 0 0 1 12 0M14 19a4 4 0 0 1 7 0"/>'),nodes:p('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.5l3 8M16 7.5l-3 8M8.5 6h7"/>'),search:p('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),globe:p('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>'),star:p('<path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6l5.6-.6z"/>')};
  const M={Research:'quote',Experiment:'ab',Trust:'chart',Solution:'ui',Outcome:'num',Concepts:'grid',Directions:'grid',Decision:'fork',Principles:'fork',Reframe:'fork',Strategy:'fork',Problem:'alert',Friction:'alert',Testing:'flask','Co-design':'people','Model design':'nodes',Audit:'search',World:'globe',Artifacts:'star'};
  return s=>I[M[s]]||I.star; })();
function buildProc(root){
  const all=$$('section[data-chap]',root); if(all.length<2) return;
  const hasOv=all[0].dataset.s==='Overview', first=all[0], steps=hasOv?all.slice(1):all, n=steps.length, e=esc, pad=i=>String(i).padStart(2,'0');
  if(hasOv){ const fl=$('.head .lbl',first); if(fl) fl.textContent='Overview'; }
  steps.forEach((s,i)=>{ const l=$('.head .lbl',s); if(l) l.textContent=`${pad(i+1)} · ${s.dataset.s}`; });
  $$('.pr-bar,.pr-lead',root).forEach(x=>x.remove()); $$('.pvx').forEach(x=>x.remove());
  document.body.dataset.nav=NAVM;
  const hd=$('.site-head');
  const arrows=`<span class="hx-ar"><button type="button" data-step="-1" aria-label="Previous step">‹</button><button type="button" data-step="1" aria-label="Next step">›</button></span>`;
  const nm=i=>e(steps[i].dataset.s), ds=i=>e(steps[i].dataset.d||''), go=(i)=>`data-goto="${steps[i].dataset.chap}" data-seg="${i}"`;
  const line=`<div class="hx-line">${steps.map((s,i)=>`<button type="button" ${go(i)} data-tip="${pad(i+1)} · ${nm(i)}" aria-label="${nm(i)}"><s></s></button>`).join('')}</div>`;
  const cur=`<span class="hx-cur"><i data-pt="n">01</i><b data-pt="s">${nm(0)}</b><span class="hx-d" data-pt="d">${ds(0)}</span></span>`;
  $$('.tlp',root).forEach(x=>x.remove());
  if(NAVM==='timeline'){
    const N=all.length, tl=cls=>`<div class="tl ${cls}" style="--n:${N}"><div class="tl-track"><s></s></div>${all.map((s,i)=>`<button type="button" data-goto="${s.dataset.chap}" data-tseg="${i}"><i></i><span>${e(s.dataset.s)}</span></button>`).join('')}</div>`;
    const host=$('[data-proc]',root)||first; const pg=document.createElement('div'); pg.className='tlp';
    pg.innerHTML=`<p class="lbl">Design process</p>${tl('tl-lg')}`;
    (host===first?first.before(pg):host.after(pg));
    const el=document.createElement('nav'); el.className='pvx htl'; el.setAttribute('aria-label','Design process');
    el.innerHTML=`<div class="htl-in">${tl('tl-sm')}</div>`;
    hd.appendChild(el);
  } else
  if(NAVM==='header'){
    const el=document.createElement('div'); el.className='pvx pvn hp';
    el.innerHTML=`<div class="hp-in"><button type="button" class="hp-cur" aria-haspopup="true"><small>Design process</small><b><i data-pt="n">01</i> <span data-pt="s">${nm(0)}</span></b><svg class="cv" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button><div class="hp-ar"><button type="button" data-step="-1" aria-label="Previous step">‹</button><button type="button" data-step="1" aria-label="Next step">›</button></div>
      <div class="hp-menu" role="menu">${steps.map((s,i)=>`<button type="button" role="menuitem" ${go(i)}><i>${pad(i+1)}</i>${nm(i)}<span>${ds(i)}</span></button>`).join('')}</div></div>
      <div class="hp-line">${steps.map((s,i)=>`<button type="button" ${go(i)} data-tip="${pad(i+1)} · ${nm(i)}" aria-label="${nm(i)}"><s></s></button>`).join('')}</div>`;
    hd.appendChild(el);
  } else if(['crumb','hlinks','hchips','hlfull','hlpill','hldots','hltitle'].includes(NAVM)){
    const ttl=e(($('.cs-h1',root)||{}).textContent||'');
    const hl=`<div class="hp-line">${steps.map((s,i)=>`<button type="button" ${go(i)} data-tip="${pad(i+1)} · ${nm(i)}" aria-label="${nm(i)}"><s></s></button>`).join('')}</div>`;
    const menu=`<div class="hp-menu" role="menu">${steps.map((s,i)=>`<button type="button" role="menuitem" ${go(i)}><i>${pad(i+1)}</i>${nm(i)}<span>${ds(i)}</span></button>`).join('')}</div>`;
    let mid='';
    if(NAVM==='crumb') mid=`<div class="hb"><span class="sl">/</span><span class="hb-t">${ttl}</span><span class="sl">/</span><button type="button" class="hp-cur hb-c" aria-haspopup="true"><b><i data-pt="n">01</i> <span data-pt="s">${nm(0)}</span></b><svg class="cv" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button>${menu}</div>`;
    if(NAVM==='hlinks') mid=`<div class="hl">${steps.map((s,i)=>`<button type="button" ${go(i)}><i>${pad(i+1)}</i>${nm(i)}<s></s></button>`).join('')}</div>`;
    if(NAVM==='hlfull') mid=`<div class="hlf" style="--n:${n}">${steps.map((s,i)=>`<button type="button" ${go(i)}><span><i>${pad(i+1)}</i>${nm(i)}</span><s></s></button>`).join('')}</div>`;
    if(NAVM==='hlpill') mid=`<div class="hlp"><span class="ind"><s></s></span>${steps.map((s,i)=>`<button type="button" ${go(i)}><i>${pad(i+1)}</i>${nm(i)}</button>`).join('')}</div>`;
    if(NAVM==='hldots') mid=`<div class="hld">${steps.map((s,i)=>`<button type="button" ${go(i)}><b></b>${nm(i)}</button>`).join('')}</div>`;
    if(NAVM==='hltitle') mid=`<span class="hlt-t"><small><span data-pt="n">01</span>/${pad(n)}</small>${ttl}</span><div class="hl">${steps.map((s,i)=>`<button type="button" ${go(i)}>${nm(i)}<s></s></button>`).join('')}</div>`;
    if(NAVM==='hchips') mid=`<div class="hc">${steps.map((s,i)=>`<button type="button" ${go(i)} aria-label="${nm(i)}"><span class="ib">${SI(s.dataset.s)}</span><span class="t">${nm(i)}</span></button>`).join('')}</div>`;
    const el=document.createElement('div'); el.className=`pvx pvn hp hp-${NAVM}`;
    el.innerHTML=`<div class="hp-wrap">${mid}${['crumb','hlinks'].includes(NAVM)?'':`<span class="hx-ar">${arrows.replace(/<\/?span[^>]*>/g,'')}</span>`}</div>${['hlfull','hlpill','hlinks'].includes(NAVM)?'':hl}`;
    hd.appendChild(el);
  } else {
    let inner='';
    if(NAVM==='progress') inner=`<div class="hx-row"><span class="hx-k">Design process</span>${cur}${arrows}</div>${line}`;
    if(NAVM==='rail') inner=`<div class="hx-row"><span class="hx-k">Design process</span><div class="hx-rail" style="--n:${n}">${steps.map((s,i)=>`<button type="button" ${go(i)}><i></i><span><em>${pad(i+1)}</em>${nm(i)}</span></button>`).join('')}</div>${arrows}</div>`;
    if(NAVM==='chips') inner=`<div class="hx-row"><span class="hx-k">Design process</span><div class="hx-chips">${steps.map((s,i)=>`<button type="button" ${go(i)}><span class="ib">${SI(s.dataset.s)}</span>${nm(i)}<s></s></button>`).join('')}</div>${arrows}</div>`;
    if(NAVM==='icons') inner=`<div class="hx-row"><span class="hx-k">Design process</span><div class="hx-icons">${steps.map((s,i)=>`<button type="button" ${go(i)} data-tip="${pad(i+1)} · ${nm(i)}" aria-label="${nm(i)}">${SI(s.dataset.s)}</button>`).join('')}</div>${cur}${arrows}</div>`;
    if(NAVM==='headline') inner=`<div class="hx-row"><span class="hx-pill"><i data-pt="n">01</i><b data-pt="s">${nm(0)}</b></span><span class="hx-h" data-pt="h">${e(($('.h2',steps[0])||{}).textContent||'')}</span>${arrows}</div>${line}`;
    const el=document.createElement('nav'); el.className=`pvx pvn hx hx-${NAVM}`; el.setAttribute('aria-label','Design process');
    el.innerHTML=`<div class="hx-wrap">${inner}</div>`;
    hd.appendChild(el);
  }

  $$('img,video',root).forEach(m=>{ m.addEventListener('load',procSync,{once:true}); m.addEventListener('loadedmetadata',procSync,{once:true}); });
  procSync();
}
function procSync(){
  const root=$('#cs-body'), live=!!(root&&$('#v-cs').classList.contains('on')&&$('section[data-chap]',root));
  document.body.classList.toggle('cs-on',live); if(!live) return;
  const hd=$('.site-head'), hh=(hd||{offsetHeight:0}).offsetHeight, hx=$('.hx.show'), xh=hx?hx.offsetHeight:0;
  document.documentElement.style.setProperty('--hh',hh+'px');
  const line=hh+xh+110, steps=$$('section[data-chap]',root).filter(s=>s.dataset.s!=='Overview'); let a=-1;
  steps.forEach((s,i)=>{ if(s.getBoundingClientRect().top<=line) a=i; });
  const end=innerHeight+scrollY>=document.documentElement.scrollHeight-4;
  let f=0; if(a>=0){ const r=steps[a].getBoundingClientRect(); f=Math.max(0,Math.min(1,(line-r.top)/r.height)); }
  window.__pa=a;
  const show=steps[0].getBoundingClientRect().top<=innerHeight*.75;
  $$('.pvx.pvn').forEach(x=>x.classList.toggle('show',show));
  $$('.pvn [data-seg]').forEach(b=>{ const i=+b.dataset.seg; b.classList.toggle('on',i===a); b.classList.toggle('done',i<a); b.style.setProperty('--f', end?1:(i<a?1:i===a?f.toFixed(3):0)); });
  const ai=Math.max(0,a), st=steps[ai];
  $$('[data-pt="n"]').forEach(x=>x.textContent=String(ai+1).padStart(2,'0'));
  $$('[data-pt="s"]').forEach(x=>x.textContent=st.dataset.s);
  $$('[data-pt="d"]').forEach(x=>x.textContent=st.dataset.d||'');
  $$('[data-pt="h"]').forEach(x=>{ const t=($('.h2',st)||{}).textContent||''; if(x.textContent!==t){ x.textContent=t; x.classList.remove('in'); void x.offsetWidth; x.classList.add('in'); } });
  { const all=$$('section[data-chap]',root), tlp=$('.tlp',root); let A=-1;
    all.forEach((s,i)=>{ if(s.getBoundingClientRect().top<=line) A=i; });
    let F=0; if(A>=0){ const r=all[A].getBoundingClientRect(); F=Math.max(0,Math.min(1,(line-r.top)/r.height)); }
    const tp=end?1:Math.max(0,Math.min(1,(A<0?0:A+F)/Math.max(1,all.length-1)));
    $$('.tl').forEach(t=>t.style.setProperty('--tp',tp.toFixed(4)));
    $$('[data-tseg]').forEach(b=>{ const i=+b.dataset.tseg; b.classList.toggle('on',i===Math.max(0,A)); b.classList.toggle('done',i<A); });
    const docked=!!(tlp&&tlp.getBoundingClientRect().bottom<=hh-4);
    document.body.classList.toggle('tl-docked',docked); }
  $$('.pvn [data-step="-1"]').forEach(b=>b.disabled=a<=0); $$('.pvn [data-step="1"]').forEach(b=>b.disabled=a>=steps.length-1);
  $$('.hlp').forEach(p=>{ const o=$('button.on',p)||$('button',p), ind=$('.ind',p); if(o&&ind){ ind.style.transform=`translateX(${o.offsetLeft}px)`; ind.style.width=o.offsetWidth+'px'; ind.style.setProperty('--f',o.style.getPropertyValue('--f')||0); } });
  const on=$('.hx .on'), sc=on&&on.parentElement; if(sc&&sc.scrollWidth>sc.clientWidth){ const l=on.offsetLeft-sc.clientWidth/2+on.offsetWidth/2; if(Math.abs(sc.scrollLeft-l)>40) sc.scrollLeft=l; }
}
addEventListener('scroll',()=>{ if(!window.__prq){ window.__prq=1; requestAnimationFrame(()=>{ window.__prq=0; procSync(); }); } },{passive:true});
addEventListener('resize',procSync);
addEventListener('hashchange',()=>setTimeout(procSync,0));
document.addEventListener('click',ev=>{
  const m=ev.target.closest('[data-navm]'); if(m){ NAVM=m.dataset.navm; try{ localStorage.setItem('ng-nav3',NAVM); }catch(x){} const cb=$('#cs-body'); if(cb) buildProc(cb); return; }
  const cur=ev.target.closest('.hp-cur'); const hp=$('.hp'); if(cur){ hp.classList.toggle('open'); return; } if(hp&&!ev.target.closest('.hp-menu')) hp.classList.remove('open');
  const st=ev.target.closest('.pvn [data-step]'), g=ev.target.closest('[data-goto]'); if(!g&&!st) return;
  let idx; if(st){ const n=$$('#cs-body section[data-chap]').length-1, a=window.__pa??-1; idx=1+Math.max(0,Math.min(n-1,a+ +st.dataset.step)); } else idx=g.dataset.goto;
  if(hp) hp.classList.remove('open');
  const s=document.querySelector(`#cs-body [data-chap="${idx}"]`); if(!s) return;
  const hh=($('.site-head')||{offsetHeight:0}).offsetHeight, bh=($('.hx')||{offsetHeight:0}).offsetHeight;
  window.scrollTo({top:s.getBoundingClientRect().top+scrollY-hh-bh-24,behavior:reduce?'auto':'smooth'}); });
function initCase(root){
  buildProc(root);
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(en=>{ const el=en.target;
      if(el.tagName==='VIDEO'){ if(en.isIntersecting){ try{ const pr=el.play(); pr&&pr.catch&&pr.catch(()=>{}); }catch(x){} } else { try{ el.pause(); }catch(x){} } return; }
      if(en.isIntersecting){ el.classList.add(el.classList.contains('th')?'play':'on'); io.unobserve(el); } }),{threshold:.3});
    $$('video',root).forEach(v=>io.observe(v)); $$('.dd-bars',root).forEach(b=>io.observe(b)); $$('.cs-th',root).forEach(t=>io.observe(t)); $$('.cs-swing',root).forEach(t=>io.observe(t));
  } else { $$('.dd-bars,.cs-swing',root).forEach(b=>b.classList.add('on')); }
}

/* ---------- case study: Discount Affinity ---------- */
function drawMap(root){
  $$('.mg',root).forEach(g=>{
    const svg=$('.ln',g), dc=$('.dc',g), vs=$$('.vc',g); if(!svg||!dc||getComputedStyle(svg).display==='none') return;
    const gr=g.getBoundingClientRect(), dr=dc.getBoundingClientRect(), x2=dr.left-gr.left-12, y2=dr.top-gr.top+dr.height/2;
    svg.setAttribute('viewBox',`0 0 ${gr.width} ${gr.height}`);
    svg.innerHTML=vs.map(v=>{ const r=v.getBoundingClientRect(), x1=r.right-gr.left+6, y1=r.top-gr.top+r.height/2, mx=(x1+x2)/2;
      return `<path d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/>`; }).join('')+`<circle cx="${x2}" cy="${y2}" r="3.5" fill="#9C6B14"/>`;
  });
}


function initProto(root){
  const w=$('#dd-pt',root); if(!w) return;
  const app=$('.pt-app',w), frames=[...w.querySelectorAll('iframe')], tabs=[...w.querySelectorAll('[data-pt]')], full=$('.pt-full',w);
  const fit=()=>{ const s=app.clientWidth/1280; frames.forEach(f=>f.style.transform='scale('+s+')'); };
  // M4: the public build ships without assets/discount/proto/. Then each tab shows its recording instead
  // (assets/discount/rec-<flow>.webp, Content's files), and the guide, Restart and Full screen links stay hidden.
  // make-public.sh marks the public copy <html data-build="public">: recordings only, no request to proto/ at all
  const PUBLIC=document.documentElement.dataset.build==='public';
  const REC=['sms','email','flows','insights']; let protoOK=PUBLIC?Promise.resolve(false):null;
  const probe=()=>protoOK||(protoOK=fetch(frames[0].dataset.src.split('?')[0],{method:'HEAD'}).then(r=>r.ok).catch(()=>false));
  if(PUBLIC&&full) full.hidden=true;
  const useRec=(f)=>{ if(!f.__rec){ const im=document.createElement('img'); im.className='pt-rec'; im.src=`assets/discount/rec-${REC[+f.dataset.pf]||'sms'}.webp`; im.alt=`Recording of the ${f.title}`; f.after(im); f.__rec=im; }
    frames.forEach(x=>{ if(x.__rec) x.__rec.classList.toggle('on',x===f); }); app.classList.add('rec','ready'); full.hidden=true; rs.hidden=true; hide(); };
  const load=(f)=>{ probe().then(ok=>ok?loadProto(f):useRec(f)); };
  const loadProto=(f)=>{ if(!f.src){ app.classList.remove('ready'); f.addEventListener('load',()=>setTimeout(()=>app.classList.add('ready'),600),{once:true}); f.src=f.dataset.src; } else app.classList.add('ready'); };
  const show=(i)=>{ unidle(); tabs.forEach((t,j)=>{ t.classList.toggle('on',i===j); t.setAttribute('aria-selected',i===j); }); frames.forEach((f,j)=>f.classList.toggle('on',i===j)); load(frames[i]); full.href=frames[i].dataset.src; };
  // step-by-step helper for the SMS and Email prototypes: where to click next
  const G=$('.pt-guide',w), ring=$('.pg-ring',G), ghost=$('.pg-ghost',G), tip=$('.pg-tip',G), gn=$('[data-pg-n]',G), gt=$('[data-pg-t]',G), rs=$('[data-pg-restart]',w);
  let gTimer=null, cur=0;
  const unidle=()=>{ app.classList.remove('idle'); const b=app.querySelector('.pt-start'); if(b) b.remove(); };
  const vis=(el)=>{ while(el && el.getBoundingClientRect && el.getBoundingClientRect().width<12) el=el.parentElement; return el; };
  const affTog=(D)=>[...D.querySelectorAll('input[type=checkbox],[role=switch]')].find(c=>/Skip the coupon|Discount affinity/.test(c.getAttribute('aria-label')||''));
  const menuItem=(D)=>{ const s=D.querySelector('input[placeholder="Search coupons"]'); if(!s) return null; return vis(D.querySelector('[role="menuitem"],[role="option"]')||s); };
  const GUIDES={
    sms:{ steps:['Click the coupon icon to add a coupon.','Pick a coupon from the list.','Turn on Discount affinity.'],
      done:'Give each segment its own coupon, then preview each group above the phone.',
      find(D){ const t=affTog(D); const chip=D.querySelector('[data-chip]');
        if(chip && t && t.checked) return {step:3};
        const m=menuItem(D); if(m) return {step:1, el:m};
        if(chip && t) return {step:2, el:vis(t)};
        const b=[...D.querySelectorAll('button')].find(x=>/^\s*Add coupon\s*$/.test(x.textContent)||/Add coupon/.test(x.getAttribute('aria-label')||''));
        return {step:0, el:vis(b)}; } },
    email:{ steps:['Drag the Coupon block onto the email, or click it.','Pick a coupon from the list.','Turn on Discount affinity.'],
      done:'Switch the recipients above the email to preview who gets the code.',
      find(D){ const t=affTog(D);
        if(t && t.checked) return {step:3};
        if(D.querySelector('[name="csel"]') && t) return {step:2, el:vis(t)};
        const m=menuItem(D); if(m) return {step:1, el:m};
        const tile=[...D.querySelectorAll('.tileWrap')].find(x=>/^\s*Coupon\s*$/.test(x.textContent));
        return {step:0, el:tile, drag:true}; } }
  };
  const kind=(f)=>/in%20SMS/.test(f.dataset.src)?'sms':/in%20Email/.test(f.dataset.src)?'email':null;
  const hide=()=>{ G.classList.remove('on'); };
  const place=()=>{
    const f=frames[cur], k=kind(f), g=GUIDES[k];
    if(app.classList.contains('rec')){ hide(); return; }
    rs.hidden=!g; if(!g){ hide(); return; }
    let D; try{ D=f.contentDocument; }catch(e){ D=null; }
    let r;
    if(D && D.body){ try{ r=g.find(D); }catch(e){ hide(); return; } if(r&&r.el) r.b=r.el.getBoundingClientRect(); }
    else { try{ f.contentWindow.postMessage({t:'ptg?',k},'*'); }catch(e){} r=f.__ptg; if(!r){ hide(); return; } }
    const s=app.clientWidth/1280;
    if(r.step>=3){ G.className='pt-guide on done'; gn.textContent='Done'; gt.textContent=g.done; tip.style.left='50%'; tip.style.top='14px'; tip.style.transform='translateX(-50%)'; return; }
    const b=r.b; if(!b||!b.width){ hide(); return; }
    G.className='pt-guide on'+(r.drag?' drag':'');
    const x=b.left*s, y=b.top*s, wd=b.width*s, ht=b.height*s;
    Object.assign(ring.style,{left:(x-3)+'px',top:(y-3)+'px',width:(wd+6)+'px',height:(ht+6)+'px'});
    tip.style.transform=''; tip.style.left=Math.min(x+wd+12, app.clientWidth-250)+'px'; tip.style.top=(y-4)+'px';
    gn.textContent='Step '+(r.step+1)+' of 3'; gt.textContent=g.steps[r.step];
    if(r.drag){ const cx=app.clientWidth*0.62, cy=app.clientHeight*0.45; ghost.style.left=(x+wd*0.4)+'px'; ghost.style.top=(y+ht*0.35)+'px'; ghost.style.setProperty('--dx',(cx-x-wd*0.4)+'px'); ghost.style.setProperty('--dy',(cy-y-ht*0.35)+'px'); }
  };
  addEventListener('message',e=>{ const m=e.data; if(!m||m.t!=='ptg!') return; const f=frames.find(x=>x.contentWindow===e.source); if(f) f.__ptg=m.r; });
  let onScreen=false; inView(w,v=>{ onScreen=v; },{threshold:0});
  const startGuide=()=>{ clearInterval(gTimer); gTimer=setInterval(()=>{ if(onScreen) place(); },350); };
  rs.addEventListener('click',()=>{ unidle(); const f=frames[cur]; app.classList.remove('ready'); f.addEventListener('load',()=>setTimeout(()=>app.classList.add('ready'),600),{once:true}); f.src=f.dataset.src; });
  rs.hidden=true; startGuide();
  tabs.forEach((t,i)=>t.addEventListener('click',()=>{ cur=i; show(i); place(); }));
  fit(); if('ResizeObserver' in window) new ResizeObserver(fit).observe(app); else addEventListener('resize',fit);
  // L14, L17: the prototypes (megabytes of script) load only when someone asks for one: this button, or a tab
  const go=document.createElement('button'); go.type='button'; go.className='pt-start'; go.innerHTML=(PUBLIC?'Play the recording':'Load the interactive prototype')+' <span aria-hidden="true">→</span>';
  app.classList.add('idle'); app.appendChild(go);
  go.addEventListener('click',()=>{ unidle(); load(frames[cur]); try{ frames[cur].focus(); }catch(e){} });
}
function initHeroLx(root){
  const lx=$('#lx',root); if(!lx) return;
  const app=$('.lx-app',lx), cur=$('.lx-cursor',lx), sw=$('[data-lx-tg]',lx), code=$('[data-lx-code]',lx);
  const segs=[...lx.querySelectorAll('.lx-seg button')], rows=[...lx.querySelectorAll('.lx-row')];
  const CODES={all:'BF-20OFF',deal:'BF-20OFF',occ:'BF-10OFF'};
  const seg=v=>segs.find(b=>b.dataset.v===v);
  const at=(el)=>{ const a=app.getBoundingClientRect(), r=el.getBoundingClientRect(); cur.style.left=((r.left+r.width*.5-a.left)/a.width*100)+'%'; cur.style.top=((r.top+r.height*.6-a.top)/a.height*100)+'%'; };
  const click=()=>{ cur.classList.add('click'); setTimeout(()=>cur.classList.remove('click'),160); };
  const view=(v)=>{ segs.forEach(b=>b.classList.toggle('on',b.dataset.v===v)); rows.forEach(r=>r.classList.toggle('hl',r.dataset.t===v)); lx.classList.toggle('low',v==='full'); if(CODES[v]) code.textContent=CODES[v]; };
  const set=(on)=>{ lx.classList.toggle('on',on); if(!on) view('all'); };
  let tm=[], live=true; const stop=()=>{ live=false; tm.forEach(clearTimeout); tm=[]; cur.style.opacity=0; };
  sw.addEventListener('click',()=>{ stop(); set(!lx.classList.contains('on')); });
  segs.forEach(b=>b.addEventListener('click',()=>{ stop(); view(b.dataset.v); }));
  rows.forEach(r=>r.addEventListener('click',()=>{ if(!lx.classList.contains('on')) return; stop(); view(r.dataset.t); }));
  if(reduce){ set(true); return; }
  const T=(f,ms)=>tm.push(setTimeout(()=>{ if(live) f(); },ms));
  set(true); cur.style.opacity=0;
  const loop=()=>{ tm.forEach(clearTimeout); tm=[]; set(true); view('all'); cur.style.left='72%'; cur.style.top='80%';
    T(()=>{ cur.style.opacity=1; },1400);
    T(()=>at(seg('full')),1800); T(()=>{ click(); view('full'); },2600);
    T(()=>at(seg('occ')),4400); T(()=>{ click(); view('occ'); },5200);
    T(()=>at(seg('deal')),7000); T(()=>{ click(); view('deal'); },7800);
    T(()=>{ view('all'); set(false); },9800); T(()=>at(sw),10400); T(()=>{ click(); set(true); },11200);
    T(loop,13500); };
  // the hero holds still in its finished state; it stays clickable
  void loop;
}
function initSendTime(root){
  buildProc(root);
  const R=(s)=>$(s,root), RR=(s)=>$$(s,root);
  // deterministic dots with a preferred hour each
  let seed=11; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  const N=60, PEAKS=[[7.5,1.2,.18],[12.5,1.3,.24],[18.5,1.6,.34],[21,1.1,.14],[15,1.8,.10]];
  const gauss=()=>{ let u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const pref=[]; for(let i=0;i<N;i++){ let r=rnd(), acc=0, p=PEAKS[0]; for(const k of PEAKS){ acc+=k[2]; if(r<=acc){ p=k; break; } } let h=p[0]+gauss()*p[1]; h=((h%24)+24)%24; pref.push(h); }
  const hourOf={ fixed:()=>8, gradual:(i)=>8+(i%30)/10, sst:()=>10, pst:(i)=>Math.min(19.6,Math.max(11.2,pref[i]<11?11.2+(pref[i]%1)*1.6:pref[i]>19.6?18.4+(pref[i]%1)*1.2:pref[i])) };
  const build=(el,n)=>{ el.insertAdjacentHTML('beforeend',Array.from({length:n},(_,i)=>`<i class="d" style="--dl:${(i%20)*14}ms"></i>`).join('')); return [...el.querySelectorAll('i.d')]; };
  const layout=(el,dots,hours,opt={})=>{ const W=el.clientWidth||600, H=el.clientHeight||160, sz=opt.sz||8, gap=sz+2, per=opt.per||3; const cols={};
    dots.forEach((d,i)=>{ const h=hours[i]; if(h==null){ d.classList.add('x'); return; } d.classList.remove('x'); const c=Math.round(h*2)/2; (cols[c]=cols[c]||[]).push(d); d.__h=h; });
    const mx=Math.max(1,...Object.values(cols).map(v=>v.length)), rows=Math.max(1,Math.floor((H-8)/gap)); const pp=Math.max(per,Math.ceil(mx/rows));
    Object.keys(cols).forEach(c=>{ cols[c].forEach((d,k)=>{ const per=pp, row=Math.floor(k/per), col=k%per; const x=(+c/24)*W + (col-(per-1)/2)*gap; d.style.left=Math.max(4,Math.min(W-4,x))+'px'; d.style.bottom=(4+row*gap)+'px'; }); });
    dots.forEach((d,i)=>{ if(hours[i]==null){ d.style.left=(pref[i]/24*W)+'px'; d.style.bottom='4px'; } }); };
  const hoursFor=(m,filter)=>pref.map((_,i)=>{ const h=hourOf[m](i); return filter?filter(h,i):h; });

  // ---- hero: scheduler + delivery
  const hx=R('#st-hero');
  if(hx){
    const app=$('.lx-app',hx), cur=$('.lx-cursor',hx), sel=$('[data-st-sel]',hx), menu=$('[data-st-menu]',hx), type=$('[data-st-type]',hx), cap=$('[data-st-cap]',hx), ch=$('[data-st-chart="hero"]',hx);
    const dots=build(ch,N); const LBL={fixed:'Fixed send time',gradual:'Gradual send',sst:'Smart Send Time',pst:'✦ Personalized send time'};
    const CAP={fixed:'Everyone at 8:00 AM',gradual:'Spread over 8–11 AM',sst:'Everyone at 10:00 AM',pst:'Each person at their own best hour, 11 AM – 8 PM'};
    let pill=ch.querySelector('.st-pill'); if(!pill){ pill=document.createElement('i'); pill.className='st-pill'; ch.appendChild(pill); }
    const setM=(m)=>{ hx.classList.toggle('pst',m==='pst'); type.textContent=LBL[m]; cap.textContent=CAP[m]; layout(ch,dots,hoursFor(m),{sz:9,per:m==='pst'?1:2}); const one=m==='fixed'||m==='sst'; ch.classList.toggle('one',one); if(one) pill.style.left=(hourOf[m](0)/24*100)+'%'; };
    const open=(o)=>{ menu.classList.toggle('open',o); sel.classList.toggle('open',o); };
    const at=(el)=>{ const a=app.getBoundingClientRect(), r=el.getBoundingClientRect(); cur.style.left=((r.left+r.width*.5-a.left)/a.width*100)+'%'; cur.style.top=((r.top+r.height*.6-a.top)/a.height*100)+'%'; };
    const click=()=>{ cur.classList.add('click'); setTimeout(()=>cur.classList.remove('click'),160); };
    let tm=[], live=true; const stop=()=>{ live=false; tm.forEach(clearTimeout); tm=[]; cur.style.opacity=0; };
    sel.addEventListener('click',()=>{ stop(); open(!menu.classList.contains('open')); });
    $$('[data-st-opt]',hx).forEach(b=>b.addEventListener('click',()=>{ stop(); open(false); setM(b.dataset.stOpt); }));
    requestAnimationFrame(()=>setM('fixed'));
    if(!reduce){
      const T=(f,ms)=>tm.push(setTimeout(()=>{ if(live) f(); },ms));
      const pstB=$('[data-st-opt="pst"]',hx);
      const loop=()=>{ tm.forEach(clearTimeout); tm=[]; open(false); setM('fixed'); pstB.classList.remove('hl'); cur.style.opacity=1; cur.style.left='70%'; cur.style.top='82%';
        T(()=>at(sel),1400); T(()=>{ click(); open(true); },2300);
        T(()=>at(pstB),3300); T(()=>pstB.classList.add('hl'),3900); T(()=>{ click(); open(false); setM('pst'); pstB.classList.remove('hl'); },4300);
        T(()=>{ cur.style.left='78%'; cur.style.top='70%'; },5200);
        T(loop,11500); };
      if('IntersectionObserver' in window){ let st=false; const io=new IntersectionObserver(es=>{ if(es[0].isIntersecting&&!st&&live){ st=true; loop(); } },{threshold:.4}); io.observe(hx); } else loop();
    } else setM('pst');
    addEventListener('resize',()=>{ const m=hx.classList.contains('pst')?'pst':Object.keys(LBL).find(k=>LBL[k]===type.textContent)||'fixed'; layout(ch,dots,hoursFor(m),{sz:9,per:m==='pst'?1:2}); });
  }

  // ---- problem: send modes
  const mv=R('[data-st-modes]');
  if(mv){ const ch=$('[data-st-chart="modes"]',mv), dots=build(ch,N), mc=$('[data-st-mcap]',mv);
    const CAP={fixed:'Everyone at 8:00 AM, the one time you picked.',gradual:'Spread over a few hours, for deliverability. Still one plan for everyone.',sst:'The best single hour for the whole list. Still one hour for everyone.'};
    let m='fixed'; const go=()=>{ layout(ch,dots,hoursFor(m),{sz:9,per:3}); mc.textContent=CAP[m]; $$('[data-m]',mv).forEach(b=>b.classList.toggle('on',b.dataset.m===m)); };
    $$('[data-m]',mv).forEach(b=>b.addEventListener('click',()=>{ m=b.dataset.m; go(); }));
    requestAnimationFrame(go); addEventListener('resize',go); }

  // ---- research: before / after window
  const ba=R('[data-st-ba]');
  if(ba){ const ch=$('[data-st-chart="ba"]',ba), dots=build(ch,N), m=$('[data-ba-m]',ba), d=$('[data-ba-d]',ba);
    let s='before'; const go=()=>{ ba.classList.toggle('after',s==='after'); layout(ch,dots,hoursFor(s==='after'?'pst':'fixed'),{sz:9,per:s==='after'?2:3}); m.textContent=s==='after'?'The window: 11 AM – 8 PM':'One hour, for every recipient'; d.textContent=s==='after'?'Each person’s best hour inside it':'Nothing'; $$('[data-ba]',ba).forEach(b=>b.classList.toggle('on',b.dataset.ba===s)); };
    $$('[data-ba]',ba).forEach(b=>b.addEventListener('click',()=>{ s=b.dataset.ba; go(); }));
    requestAnimationFrame(go); addEventListener('resize',go); }

  // ---- tab groups (concepts, trust)
  RR('[data-tg]').forEach(g=>{ const bs=$$('[data-t]',g), ps=$$('[data-p]',g); bs.forEach(b=>b.addEventListener('click',()=>{ bs.forEach(x=>x.classList.toggle('on',x===b)); ps.forEach(p=>p.classList.toggle('on',p.dataset.p===b.dataset.t)); })); });

  // ---- significance states
  const sg=R('[data-st-sig]');
  if(sg){ const S=[['+8.0%','Significant','It’s real'],['+4.8%','Approaching','Keep watching'],['+1.1%','Not significant','Ignore it'],['—','Inconclusive','Too early']];
    const r=$('[data-sv-r]',sg), box=$('[data-sv]',sg); const go=()=>{ const v=+r.value, s=S[v]; box.dataset.s=v; $('[data-sv-n]',sg).textContent=s[0]; $('[data-sv-l]',sg).textContent=s[1]; $('[data-sv-t]',sg).textContent=s[2]; };
    r.addEventListener('input',go); go(); }

  // ---- solution: email vs sms
  const so=R('[data-st-ch]');
  if(so){ const ch=$('[data-st-chart="ch"]',so), dots=build(ch,N), cp=$('[data-chn-cap]',so);
    const em=(i)=>Math.min(22.6,Math.max(6.2,pref[i]));
    let c='email'; const go=()=>{ so.classList.toggle('sms',c==='sms'); layout(ch,dots,pref.map((_,i)=>{ const h=em(i); return c==='sms'?Math.min(20.6,Math.max(8.2,h)):h; }),{sz:9,per:2}); cp.textContent=c==='sms'?'SMS sends only where the window and quiet hours overlap, and the scheduler says so.':'Email sends anywhere inside the window.'; $$('[data-chn]',so).forEach(b=>b.classList.toggle('on',b.dataset.chn===c)); };
    $$('[data-chn]',so).forEach(b=>b.addEventListener('click',()=>{ c=b.dataset.chn; go(); }));
    requestAnimationFrame(go); addEventListener('resize',go); }
}

function initAudience(root){
  buildProc(root);
  const R=(s)=>$(s,root);
  // hero
  const hx=R('#ao-hero');
  if(hx){ const app=$('.lx-app',hx), cur=$('.lx-cursor',hx), tot=$('[data-ao-total]',hx); const st={skip:false,add:false};
    const fmt=n=>n.toLocaleString('en-US');
    let shown=120000, raf; const roll=(to)=>{ cancelAnimationFrame(raf); const from=shown, t0=performance.now(); const step=t=>{ const k=Math.min(1,(t-t0)/600), e=1-Math.pow(1-k,3); shown=Math.round(from+(to-from)*e); tot.textContent=fmt(shown); if(k<1) raf=requestAnimationFrame(step); }; raf=requestAnimationFrame(step); };
    const render=()=>{ ['skip','add'].forEach(k=>{ $(`[data-ao-tg="${k}"]`,hx).classList.toggle('on',st[k]); $(`[data-ao-r="${k}"]`,hx).classList.toggle('on',st[k]); $(`[data-ao-b="${k}"]`,hx).classList.toggle('on',st[k]); }); roll(120000-(st.skip?480:0)+(st.add?12000:0)); };
    const at=(el)=>{ const a=app.getBoundingClientRect(), r=el.getBoundingClientRect(); cur.style.left=((r.left+r.width*.5-a.left)/a.width*100)+'%'; cur.style.top=((r.top+r.height*.6-a.top)/a.height*100)+'%'; };
    const click=()=>{ cur.classList.add('click'); setTimeout(()=>cur.classList.remove('click'),160); };
    let tm=[], live=true; const stop=()=>{ live=false; tm.forEach(clearTimeout); tm=[]; cur.style.opacity=0; };
    $$('[data-ao-tg]',hx).forEach(b=>b.addEventListener('click',()=>{ stop(); st[b.dataset.aoTg]=!st[b.dataset.aoTg]; render(); }));
    if(reduce){ st.skip=st.add=true; render(); $('[data-ao-imp]',hx).classList.add('on'); }
    else { const T=(f,ms)=>tm.push(setTimeout(()=>{ if(live) f(); },ms)); const sk=$('[data-ao-tg="skip"]',hx), ad=$('[data-ao-tg="add"]',hx);
      const imp=$('[data-ao-imp]',hx); const loop=()=>{ tm.forEach(clearTimeout); tm=[]; st.skip=st.add=false; render(); imp.classList.remove('on'); cur.style.opacity=1; cur.style.left='72%'; cur.style.top='84%';
        T(()=>at(sk),1200); T(()=>{ click(); st.skip=true; render(); },2100);
        T(()=>at(ad),3600); T(()=>{ click(); st.add=true; render(); },4500);
        T(()=>{ at(imp); },5600); T(()=>{ imp.classList.add('on'); },6200); T(loop,12500); };
      if('IntersectionObserver' in window){ let s=false; const io=new IntersectionObserver(es=>{ if(es[0].isIntersecting&&!s&&live){ s=true; loop(); } },{threshold:.4}); io.observe(hx); } else loop(); }
  }
  // problem: list → skip → add → impact
  const pp=R('[data-ao-people]');
  if(pp){ const g=$('[data-ps-grid]',pp), cap=$('[data-ps-cap]',pp);
    let sd=5; const rr=()=>{ sd=(sd*9301+49297)%233280; return sd/233280; }; const X=new Set([13,37,58,71,86,104,112,119]), H=new Set(); while(H.size<36){ const k=Math.floor(rr()*120); if(!X.has(k)) H.add(k); } const Pp=new Set([2,9,12,17,22,27,30,35,41,44]);
    g.innerHTML=`<div><small>Your list</small><div class="ao-g l">${Array.from({length:120},(_,i)=>`<i data-r="${[X.has(i)?'x':'',H.has(i)?'h':''].join(' ').trim()}" style="--dl:${(i%20)*15}ms"></i>`).join('')}</div></div><div><small>Not on this list</small><div class="ao-g o">${Array.from({length:48},(_,i)=>`<i data-r="${Pp.has(i)?'p':''}" style="--dl:${(i%8)*30}ms"></i>`).join('')}</div></div>`;
    let t=[]; const seq=()=>{ t.forEach(clearTimeout); t=[]; g.className='ao-ppl'; g.className='ao-ppl s2'; return; t.push(setTimeout(()=>g.className='ao-ppl s1',900)); t.push(setTimeout(()=>g.className='ao-ppl s2',2200)); };
    const rp=$('[data-ps-replay]',pp); if(rp) rp.addEventListener('click',seq);
    if('IntersectionObserver' in window){ const io=new IntersectionObserver(es=>{ if(es[0].isIntersecting){ io.disconnect(); seq(); } },{threshold:.5}); io.observe(pp); } else g.className='ao-ppl s2';
  }
  // act jump links
  $$('[data-goact]',root).forEach(a=>a.addEventListener('click',e=>{ e.preventDefault(); const s=$(`[data-act="${a.dataset.goact}"]`,root); if(s) window.scrollTo({top:s.getBoundingClientRect().top+scrollY-80,behavior:'smooth'}); }));
  // maturity states
  const mt=R('[data-ao-mat]');
  if(mt){ const cs=$$('[data-mc]',mt), bs=$$('[data-m]',mt); const go=(i)=>{ cs.forEach(c=>c.classList.toggle('on',+c.dataset.mc===i)); bs.forEach(b=>b.classList.toggle('on',+b.dataset.m===i)); }; bs.forEach(b=>b.addEventListener('click',()=>go(+b.dataset.m))); go(0); }
  // problem: per-send swing vs aggregate
  const sw=R('[data-ao-swing]');
  if(sw){ const ch=$('.ao-sw-ch',sw), cap=$('[data-sw-cap]',sw);
    const SEND=[100,-100,0,100,-50,100,0,-100,100,-100,0,-100,50,100,-100,0];
    const ALL=[-100,-40,-30,-18,-12,-9,-7,-5,-4,-3.2,-2.6,-2.3,-2.1,-2,-1.9,-1.9];
    ch.insertAdjacentHTML('beforeend',SEND.map((_,i)=>`<s style="--dl:${i*35}ms"><b></b></s>`).join(''));
    const bars=$$('s',ch); let m='send';
    const go=()=>{ const v=m==='send'?SEND:ALL; bars.forEach((s,i)=>{ const x=v[i], h=Math.max(Math.abs(x)/100*48,x===0?0.8:1.2); const b=s.firstChild; s.classList.toggle('dn',x<0); b.style.height=h+'%'; b.style.top=(x>=0?50-h:50)+'%'; }); ch.classList.toggle('all',m==='all'); cap.textContent=m==='send'?'~400 people held back and one unsubscribe: a single send reads as +100% or −100%.':'Counted together, the same campaigns settle on about −1.9% unsubscribes.'; $$('[data-sw]',sw).forEach(b=>b.classList.toggle('on',b.dataset.sw===m)); };
    $$('[data-sw]',sw).forEach(b=>b.addEventListener('click',()=>{ m=b.dataset.sw; go(); })); go(); }
  // research: lift formats
  const fm=R('[data-ao-fmt]');
  if(fm){ const F=[['−1.9%','“Compared to what?”','Not trusted','+0.4%'],['−0.002 pp','“A little bit scammy.”','Read as a trick','+0.000 pp'],['−1.9%','Both rates, then the lift.','5 of 6 trusted it','+0.4%']];
    const box=$('.ao-fmt',fm); const go=(i)=>{ $('[data-f-v]',fm).textContent=F[i][0]; const v2=$('[data-f-v2]',fm); if(v2) v2.textContent=F[i][3]; $('[data-f-q]',fm).textContent=F[i][1]; $('[data-f-k]',fm).textContent=F[i][2]; box.classList.toggle('both',i===2); $$('[data-f]',fm).forEach(b=>b.classList.toggle('on',+b.dataset.f===i)); };
    $$('[data-f]',fm).forEach(b=>b.addEventListener('click',()=>go(+b.dataset.f))); go(0); }
  // tab groups
  $$('[data-tg]',root).forEach(g=>{ const bs=$$('[data-t]',g), ps=$$('[data-p]',g); bs.forEach(b=>b.addEventListener('click',()=>{ bs.forEach(x=>x.classList.toggle('on',x===b)); ps.forEach(p=>p.classList.toggle('on',p.dataset.p===b.dataset.t)); })); });
}

function initDiscount(root){
  buildProc(root); initHeroLx(root); initProto(root);
  const kinds=[].concat(Array(22).fill('a'),Array(8).fill('n'),Array(10).fill('w'));
  let seed=7; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  for(let i=kinds.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [kinds[i],kinds[j]]=[kinds[j],kinds[i]]; }
  const dots=$('#dd-dots',root); if(dots) dots.innerHTML=kinds.map((k,i)=>`<span class="dd-dot" data-k="${k}" style="--d:${(i%10)*30+Math.floor(i/10)*40}ms">20%</span>`).join('');
  const crowd=$('#dd-crowd',root), bars=$('#dd-bars',root);
  requestAnimationFrame(()=>drawMap(root)); setTimeout(()=>drawMap(root),400);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>drawMap(root));
  if(!window.__ddRs){ window.__ddRs=1; addEventListener('resize',()=>{ const cb=$('#cs-body'); if(cb&&$('#dd-map',cb)) drawMap(cb); }); }
  $$('video[data-rate]',root).forEach(v=>{ const r=+v.dataset.rate||1; v.addEventListener('play',()=>{ v.playbackRate=r; }); try{ v.playbackRate=r; }catch(x){} });
  if('IntersectionObserver' in window){ const vo=new IntersectionObserver(es=>es.forEach(en=>{ const v=en.target; if(en.isIntersecting){ try{ const p=v.play(); p&&p.catch&&p.catch(()=>{}); }catch(x){} } else { try{ v.pause(); }catch(x){} } }),{threshold:.4}); $$('video',root).forEach(v=>vo.observe(v)); }
  $$('[data-dt]',root).forEach(b=>b.addEventListener('click',()=>{ const i=b.dataset.dt; $$('[data-dt]',root).forEach(x=>x.classList.toggle('on',x===b)); $$('[data-dtp]',root).forEach(p=>p.classList.toggle('on',p.dataset.dtp===i)); }));
  $$('[data-cpt]',root).forEach(b=>b.addEventListener('click',()=>{ const i=b.dataset.cpt;
    $$('[data-cpt]',root).forEach(x=>x.classList.toggle('on',x===b));
    const di=b.closest('.dd-int'); if(di){ di.style.setProperty('--sel',i); $$('[data-cpt]',di).forEach(x=>x.classList.toggle('done',+x.dataset.cpt<+i)); }
    $$('[data-cptv]',root).forEach(f=>{ const on=f.dataset.cptv===i, v=$('video',f); f.classList.toggle('on',on); if(v){ if(on){ v.preload='auto'; try{ v.currentTime=0; const p=v.play(); p&&p.catch&&p.catch(()=>{}); }catch(x){} } else { try{ v.pause(); }catch(x){} } } }); }));
  const jp=$('#dd-jp',root), jl=jp&&($('.dd-journey.jp',jp)||$('ol.jm',jp)), jli=jl?$$('li',jl):[], jct=jp&&$('[data-jct]',jp);
  const JSTEP=700; const runJ=()=>{ if(!jl) return; clearTimeout(window.__jpt); jl.classList.remove('done','hot'); jp.classList.remove('fin','act2'); if(crowd) crowd.classList.remove('sent','split'); jli.forEach(l=>l.classList.remove('lit')); jl.style.setProperty('--jf',0); if(jct) jct.textContent='0';
    if(reduce){ jli.forEach(l=>l.classList.add('lit')); jl.classList.add('done','hot'); jl.style.setProperty('--jf',1); jp.classList.add('fin','act2'); if(crowd) crowd.classList.add('sent','split'); if(jct) jct.textContent=jli.length; return; }
    let i=0; const step=()=>{ const l=jli[i]; if(!l){ jl.classList.add('done'); jp.classList.add('act2'); if(crowd){ crowd.classList.add('sent'); window.__jpt=setTimeout(()=>{ crowd.classList.add('split'); window.__jpt=setTimeout(()=>jp.classList.add('fin'),900); },1700); } else jp.classList.add('fin'); return; } jl.style.setProperty('--jf',jli.length>1?i/(jli.length-1):1); const lit=()=>{ l.classList.add('lit'); if(l.classList.contains('warn')) jl.classList.add('hot'); if(jct) jct.textContent=i+1; i++; window.__jpt=setTimeout(step, 120); }; window.__jpt=setTimeout(lit, i===0?0:JSTEP); }; window.__jpt=setTimeout(step,300); };
  if(jp){ if('IntersectionObserver' in window){ const jo=new IntersectionObserver(es=>{ if(es[0].isIntersecting){ runJ(); jo.disconnect(); } },{threshold:.5}); jo.observe(jp); } else runJ();
    const rb=$('[data-jreplay]',jp); rb&&rb.addEventListener('click',runJ);
    const dlg=$('.dd-modal',root), wb=$('[data-watch]',jp);
    if(dlg&&wb){ const dv=$('video',dlg);
      wb.addEventListener('click',()=>{ try{ dlg.showModal(); }catch(x){ dlg.setAttribute('open',''); } if(dv){ dv.playbackRate=+dv.dataset.rate||1; const p=dv.play(); p&&p.catch&&p.catch(()=>{}); } });
      if(dv&&dv.dataset.steps){ const ST=JSON.parse(dv.dataset.steps), cap=$('[data-dm-cap]',dlg), seg=$$('[data-dm-seg] button',dlg); let cur=-1;
        const upd=()=>{ const t=dv.currentTime; let k=0; ST.forEach((x,i)=>{ if(t>=x[0]) k=i; }); if(k===cur) return; cur=k;
          $('.dm-n',cap).textContent=(k+1)+' / '+ST.length; $('.dm-t',cap).textContent=ST[k][1];
          seg.forEach((b,i)=>{ b.classList.toggle('on',i===k); b.classList.toggle('past',i<k); }); };
        dv.addEventListener('timeupdate',upd); dv.addEventListener('seeked',upd);
        seg.forEach(b=>b.addEventListener('click',()=>{ dv.currentTime=+b.dataset.t+.05; const p=dv.play(); p&&p.catch&&p.catch(()=>{}); })); upd(); }
      const close=()=>{ if(dv) dv.pause(); try{ dlg.close(); }catch(x){ dlg.removeAttribute('open'); } };
      $('[data-close]',dlg).addEventListener('click',close); dlg.addEventListener('click',e=>{ if(e.target===dlg) close(); }); dlg.addEventListener('close',()=>{ if(dv) dv.pause(); }); } }
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; const el=e.target;
      el.classList.add('on'); io.unobserve(el); }),{threshold:.4});
    bars&&io.observe(bars);
  } else { bars&&bars.classList.add('on'); }
}
function caseHTML(id){
  const tpl=document.getElementById('cs-'+id);
  if(!tpl && typeof CS!=='undefined' && CS[id]){ const G=ORDER.filter(i=>isPG(i)===isPG(id)), k=G.indexOf(id), prev=G[(k-1+G.length)%G.length], next=G[(k+1)%G.length];
    return caseRender(id)+`<nav class="pager" aria-label="More projects"><a href="#${prev}"><span class="k">← Previous</span><span class="v">${esc(P[prev].title)}</span></a><a class="nx" href="#${next}"><span class="k">Next →</span><span class="v">${esc(P[next].title)}</span></a></nav>`; }
  if(tpl){ const p=P[id]; const G=ORDER.filter(i=>isPG(i)===isPG(id)), k=G.indexOf(id), prev=G[(k-1+G.length)%G.length], next=G[(k+1)%G.length];
    return tpl.innerHTML+`<nav class="pager" aria-label="More projects"><a href="#${prev}"><span class="k">← Previous</span><span class="v">${esc(P[prev].title)}</span></a><a class="nx" href="#${next}"><span class="k">Next →</span><span class="v">${esc(P[next].title)}</span></a></nav>`; }
  const p=P[id], k=ORDER.indexOf(id), prev=ORDER[(k-1+ORDER.length)%ORDER.length], next=ORDER[(k+1)%ORDER.length];
  const flow=p.flow?`<div class="cs-flow">${p.flow.map(f=>`<div class="cs-fi"><div class="cs-fk">${f[0]}</div><div class="cs-fv">${esc(f[1])}</div><div class="cs-fs">${esc(f[2])}</div></div>`).join('')}</div>`:'';
  const art=THUMBS[id]?`<div class="cs-art th">${uniq(THUMBS[id])}</div>`:(p.img?`<div class="cs-art"><img src="${p.img}" alt=""></div>`:'');
  return `
    <div class="cs-eyebrow">${p.role==='Playground'?'Playground':'Case study'} · ${esc(p.org)}${p.role!=='Playground'?' · '+esc(p.role):''} · ${p.year} ${p.wip?'<span class="wip">In progress</span>':''}</div>
    <h1 class="cs-h1">${esc(p.title)}</h1><p class="cs-sub">${esc(p.sub)}</p>${art}${p.highlights?`<div class="cs-flow" style="grid-template-columns:repeat(3,1fr)">${p.highlights.map(f=>`<div class="cs-fi"><div class="cs-fk">Highlight</div><div class="cs-fv">${esc(f[0])}</div><div class="cs-fs">${esc(f[1])}</div></div>`).join('')}</div>`:(p.wipnote?`<div class="cs-wipnote">${esc(p.wipnote)}</div>`:flow)}
    <div class="cs-next"><span>Placeholder: the full case study content goes here next.</span><a href="https://nilagao.com/#${id}" target="_blank" rel="noopener">Current version on nilagao.com ↗</a></div>
    <nav class="pager" aria-label="More projects"><a href="#${prev}"><span class="k">← Previous</span><span class="v">${esc(P[prev].title)}</span></a><a class="nx" href="#${next}"><span class="k">Next →</span><span class="v">${esc(P[next].title)}</span></a></nav>`;
}
function acHTML(id){ const p=P[id]; return `<a class="ac" href="#${id}" data-open="${id}">${thumbHTML(id)}<span class="ac-b"><span class="ac-t">${esc(p.title)}</span><span class="ac-s">${esc(p.stat||p.tip)}</span><span class="ac-f"><i>Read case study →</i></span></span></a>`; }
function allHTML(){
  const W=ORDER.filter(i=>!isPG(i));
  return `<div class="crumb"><a href="#" data-home>← Home</a><span></span></div>
    <h1 class="cs-h1">All projects</h1>
    <div class="ac-grid">${W.map(acHTML).join('')}</div>`;
}
function aboutHTML(){
  const IG='https://www.instagram.com/nila.snippets/';
  return `<div class="crumb"><a href="#" data-home>← Home</a><span></span></div>
  <div class="ab">
    <figure class="ab-ph"><img src="assets/about-photo.jpg" alt="Nila Gao"></figure>
    <div class="ab-tx">
      <h1 class="cs-h1">About</h1>
      <p class="ab-lead">Hi, I’m Nila 👋</p>
      <p class="ab-p">By day, I’m a product designer at <b>Klaviyo</b>, teaching AI models some manners: when to send, who to skip, and when a discount is actually worth it.</p>
      <p class="ab-p">Before that, I was the founding designer at Athenic AI, and before that, a design student at Carnegie Mellon, where I learned to love sticky notes a little too much.</p>
      <p class="ab-p">When I’m not in Figma, I’m in a sketchbook. I travel, I eat, and then I draw what I ate. It all ends up at <a href="https://www.instagram.com/nila.snippets/" target="_blank" rel="noopener">@nila.snippets</a>. Ask me for a lobster roll recommendation.</p>
      <div class="ab-links"><a class="cbtn pri" href="https://www.linkedin.com/in/nila-gao/" target="_blank" rel="noopener">LinkedIn ↗</a><a class="cbtn" href="${IG}" target="_blank" rel="noopener">Instagram · @nila.snippets ↗</a><a class="cbtn" href="mailto:nilagao16@gmail.com">nilagao16@gmail.com</a><a class="cbtn" href="https://docs.google.com/document/d/1xMYgFVV8WB2Wj24K4v6swgLmBFmVYXQ8/edit" target="_blank" rel="noopener">Resume ↗</a></div>
    </div>
  </div>
  <div class="ab-sn"><div class="ab-snh"><b>From the sketchbook</b><a href="${IG}" target="_blank" rel="noopener">More on Instagram @nila.snippets ↗</a></div>
    <div class="ab-g"><a href="${IG}" target="_blank" rel="noopener"><img src="assets/explore/sketch-barharbor.jpg" alt="Sketchbook page: Bar Harbor" loading="lazy"></a><a href="${IG}" target="_blank" rel="noopener"><img src="assets/explore/sketch-acadia.jpg" alt="Sketchbook page: Acadia National Park" loading="lazy"></a></div></div>`;
}
function pgHTML(){
  return `<div class="crumb"><a href="#" data-home>← Home</a><a href="#all">All projects</a></div>
    <h1 class="cs-h1">Playground</h1><p class="cs-sub">Earlier work, and projects outside the day job.</p>
    <div class="ac-grid pg">${ORDER.filter(isPG).map(acHTML).join('')}</div>`;
}
function show(view){ $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+(view==='pg'?'all':view))); $('#nav-all').toggleAttribute('aria-current',view==='all'); const np=$('#nav-pg'); if(np) np.toggleAttribute('aria-current',view==='pg'); const na=$('#nav-about'); if(na) na.removeAttribute('aria-current'); }
let lastRoute=null;
function routeTo(){
  const h=decodeURIComponent(location.hash.slice(1));
  if(h===lastRoute) return; lastRoute=h;
  if(h&&P[h]){
    if($('#v-home').classList.contains('on')) homeY=scrollY;
    const cb=$('#cs-body'); cb.innerHTML=caseHTML(h); cb.classList.toggle('wide',!!document.getElementById('cs-'+h)||(typeof CS!=='undefined'&&!!CS[h]));
    $$('.th[data-t]',cb).forEach(el=>{ if(THUMBS[el.dataset.t]) el.innerHTML=uniq(THUMBS[el.dataset.t]); });
    addSolJump(cb);
    requestAnimationFrame(()=>setupReveal(cb));
    const runInit=()=>{ if(h==='discount') initDiscount(cb); else if(h==='send-time') initSendTime(cb); else if(h==='audience') initAudience(cb); else if(typeof CS!=='undefined'&&CS[h]){ initCase(cb); if(h==='subject-line') initSLA(cb); } };
    const fl=FLIP&&FLIP.id===h&&!reduce; cb.classList.toggle('noanim',!!fl);
    if(fl){ const lx=cb.querySelector('#lx'); if(lx) lx.classList.add('on'); show('cs'); window.scrollTo(0,0); flipIn(h,cb);
      // heavy setup (prototypes, charts) waits until the screen has finished growing
      setTimeout(()=>{ if(location.hash.slice(1)===h) runInit(); },cssMs('--d-5')+OPEN.restDelay); }
    else { runInit(); show('cs'); window.scrollTo(0,0); }
    document.title=P[h].title+' · Nila Gao';
    const a=$('#cs-body .cs-art.th'); if(a) setTimeout(()=>a.classList.add('play'),250);
  } else if(h==='playground'){
    if($('#v-home').classList.contains('on')) homeY=scrollY;
    $('#all-body').innerHTML=pgHTML(); show('pg'); window.scrollTo(0,0); document.title='Playground · Nila Gao';
    $$('#all-body .pc').forEach(c=>c.addEventListener('mouseenter',()=>play(c)));
  } else if(h==='about'){
    if($('#v-home').classList.contains('on')) homeY=scrollY;
    $('#all-body').innerHTML=aboutHTML(); show('all'); $('#nav-all').removeAttribute('aria-current'); const na=$('#nav-about'); if(na) na.setAttribute('aria-current','page'); window.scrollTo(0,0); document.title='About · Nila Gao';
  } else if(h==='all'){
    if($('#v-home').classList.contains('on')) homeY=scrollY;
    $('#all-body').innerHTML=allHTML(); show('all'); window.scrollTo(0,0); document.title='All projects · Nila Gao';
    $$('#all-body .pc').forEach(c=>c.addEventListener('mouseenter',()=>play(c)));
  } else {
    show('home'); document.title='Nila Gao, Product Designer';
    if(!booted){ booted=true; boot(); } else requestAnimationFrame(()=>window.scrollTo(0,homeY));
  }
  focusHeading();
}
/* screen readers: after a route change, focus moves to the page's heading (not on the first load) */
let routed=0;
function focusHeading(){ if(!routed++) return; requestAnimationFrame(()=>{ const v=$('.view.on'); const h=v&&(v.querySelector('.cs-h1')||v.querySelector('h1')); if(!h) return;
  if(!h.hasAttribute('tabindex')) h.setAttribute('tabindex','-1'); h.focus({preventScroll:true}); }); }
function openCase(id){ location.hash=id; }
addEventListener('hashchange',routeTo);
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-open]'); if(o){ e.preventDefault(); openCase(o.dataset.open); return; }
  const hm=e.target.closest('[data-home]'); if(hm){ e.preventDefault(); if(location.hash) history.pushState(null,'',location.pathname+location.search); routeTo(); }
});
$('#nav-all').addEventListener('click',()=>{ location.hash='all'; });
addEventListener('popstate',routeTo);
addEventListener('wheel',()=>{S.userScrolled=true},{passive:true}); addEventListener('touchmove',()=>{S.userScrolled=true},{passive:true});



/* AO release cycles: one cycle at a time */
document.addEventListener('click',e=>{ const b=e.target.closest('[data-aot]'); if(!b) return; const sec=b.closest('.ao-solk.tl'); if(!sec) return; const a=b.dataset.aot;
  const tabs=[...sec.querySelectorAll('.ao-tabs [data-aot]')];
  tabs.forEach(x=>{ const on=x.dataset.aot===a; x.classList.toggle('on',on); x.setAttribute('aria-selected',on); });
  sec.style.setProperty('--tli',tabs.findIndex(x=>x.dataset.aot===a));
  sec.querySelectorAll('.ao-actb').forEach(x=>x.classList.toggle('on',x.dataset.act===a));
  if(b.closest('.ao-nx')){ const t=sec.querySelector('.ao-tl'); window.scrollTo({top:t.getBoundingClientRect().top+scrollY-90,behavior:reduce?'auto':'smooth'}); } });

/* Subject Line Assistant hero: type a few words, AI suggests */
function initSLA(root){
  const w=root.querySelector('[data-sla]'); if(!w) return;
  const t=w.querySelector('[data-sla-t]'), dd=w.querySelector('[data-sla-dd]'), st=w.querySelector('[data-sla-st]');
  const full='Fall drop: new';
  const done=()=>{ t.textContent=full; dd.classList.add('on','ready'); st.textContent='Updated just now'; };
  if(reduce){ done(); return; }
  let tm=[], runs=0; const T=(f,ms)=>tm.push(setTimeout(f,ms)); const ctl=loopCtl(w);
  const run=()=>{ if(ctl.paused()){ T(run,250); return; } runs++; tm.forEach(clearTimeout); tm=[]; t.textContent=''; dd.classList.remove('on','ready'); st.textContent='Generating…';
    [...full].forEach((c,i)=>T(()=>{ t.textContent=full.slice(0,i+1); },500+i*LOOP.typeMs));
    const end=500+full.length*LOOP.typeMs;
    T(()=>dd.classList.add('on'),end+LOOP.slaDrop); T(()=>{ dd.classList.add('ready'); st.textContent='Updated just now'; if(runs>=LOOP.demo) ctl.finish(); },end+LOOP.slaReady);
    if(runs<LOOP.demo) T(run,end+LOOP.slaHold); };
  let started=false; inView(w,v=>{ if(v&&!started){ started=true; run(); } },{threshold:.3});
}

/* Discount Affinity: concept "next" cue, and a zoom view for the big boards */
document.addEventListener('click',e=>{
  const nx=e.target.closest('[data-cpt-next]');
  if(nx){ const w=nx.closest('.cs-b')||document; const bs=[...w.querySelectorAll('.dd-int > button[data-cpt]')]; const i=bs.findIndex(b=>b.classList.contains('on')); const n=bs[(i+1)%bs.length]; if(n) n.click(); return; }
  const cb=e.target.closest('.dd-int > button[data-cpt]');
  if(cb){ setTimeout(()=>{ const w=cb.closest('.cs-b'); if(!w) return; const bs=[...w.querySelectorAll('.dd-int > button[data-cpt]')]; const i=bs.indexOf(cb); const n=bs[(i+1)%bs.length]; const l=w.querySelector('[data-cpt-nl]'); if(l&&n) l.textContent=(n.querySelector('span')||n).textContent.replace(/^\d+/,'').trim(); const btn=w.querySelector('[data-cpt-next]'); if(btn) btn.firstChild.textContent=i===bs.length-1?'Back to: ':'Next concept: '; },0); }
  const z=e.target.closest('a[data-zoom]');
  if(z){ e.preventDefault(); let d=document.getElementById('zm'); if(!d){ d=document.createElement('dialog'); d.id='zm'; d.className='zm'; d.innerHTML='<div class="zm-bar"><span>Scroll to explore</span><button type="button" data-zm-close aria-label="Close">✕</button></div><div class="zm-in"><img alt=""></div>'; document.body.appendChild(d); d.addEventListener('click',ev=>{ if(ev.target===d||ev.target.closest('[data-zm-close]')) d.close(); }); }
    d.querySelector('img').src=z.getAttribute('href'); d.querySelector('img').alt=(z.querySelector('img')||{}).alt||''; try{ d.showModal(); }catch(x){ d.setAttribute('open',''); } }
});

/* AO solution: the audience step, live. Flip the toggles */
document.addEventListener('click',e=>{ const b=e.target.closest('.ao-live [data-ao-tg]'); if(!b) return; const w=b.closest('.ao-live'), k=b.dataset.aoTg, on=!b.classList.contains('on');
  w.querySelectorAll(`[data-ao-tg="${k}"],[data-ao-r="${k}"],[data-ao-b="${k}"]`).forEach(x=>x.classList.toggle('on',on));
  const sk=w.querySelector('[data-ao-tg="skip"].on')?480:0, ad=w.querySelector('[data-ao-tg="add"].on')?12000:0; const t=w.querySelector('[data-ao-total]'); if(t) t.textContent=(120000-sk+ad).toLocaleString('en-US'); });

/* Channel Affinity hero: one phone, swipe through each person's channel */
(function(){
  const go=(w,n)=>{ const t=w.querySelector('[data-ca-track]'); const N=t.children.length; n=(n+N)%N; w.__ci=n; t.style.transform=`translateX(${-n*100}%)`;
    w.querySelectorAll('[data-ca-i]').forEach(b=>{ const on=+b.dataset.caI===n; b.classList.toggle('on',on); if(b.tagName==='BUTTON') b.setAttribute('aria-selected',on); }); };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-ca-car] [data-ca-i]'); if(!b) return; const w=b.closest('[data-ca-car]'); w.__stop=1; go(w,+b.dataset.caI); });
  let sx=null; document.addEventListener('pointerdown',e=>{ const f=e.target.closest('[data-ca-car] .ca-frame'); if(f){ sx=e.clientX; f.__w=f.closest('[data-ca-car]'); window.__caf=f; } });
  document.addEventListener('pointerup',e=>{ const f=window.__caf; if(f&&sx!=null){ const dx=e.clientX-sx; if(Math.abs(dx)>30){ f.__w.__stop=1; go(f.__w,(f.__w.__ci||0)+(dx<0?1:-1)); } } sx=null; window.__caf=null; });
  // auto-advance: starts when half in view, pauses on hover, focus and off-screen, stops after LOOP.demo full cycles
  onAppear('[data-ca-car]',w=>{ if(reduce) return; const N=w.querySelector('[data-ca-track]').children.length; let steps=0;
    const ctl=loopCtl(w);
    const tick=()=>{ if(w.__stop||!document.contains(w)){ ctl.finish(); return; }
      if(!ctl.paused()){ go(w,(w.__ci||0)+1); if(++steps>=N*LOOP.demo){ w.__stop=1; ctl.finish(); return; } }
      setTimeout(tick,LOOP.caStep); };
    setTimeout(tick,LOOP.caStep); });
})();

/* case studies: scroll down = chapter bar, a quick scroll up = the regular site menu */
(function(){
  let ly=scrollY, lt=performance.now();
  addEventListener('scroll',()=>{ const y=scrollY, t=performance.now(), dy=y-ly, dt=Math.max(1,t-lt);
    if(document.body.classList.contains('cs-on')){
      const v=dy/dt; // px per ms
      if(dy<0 && (v<-0.6 || dy<-40)) document.body.classList.add('nav-up');
      else if(dy>6) document.body.classList.remove('nav-up');
      if(y<80) document.body.classList.remove('nav-up');
    } else document.body.classList.remove('nav-up');
    ly=y; lt=t; },{passive:true});
})();

/* Channel Affinity rebuilt screens: dropdowns that work */
(function(){
  const N={Email:{First:42310,Second:18200,Third:9120},SMS:{First:18420,Second:25110,Third:21300},Push:{First:6240,Second:9800,Third:30150}};
  const upd=(app)=>{ const ch=(app.querySelector('[data-k="ch"]')||{}).dataset, rk=(app.querySelector('[data-k="rank"]')||{}).dataset; if(!ch||!rk) return;
    const n=app.querySelector('[data-cx-n]'); if(n) n.textContent=(N[ch.v]&&N[ch.v][rk.v]||0).toLocaleString('en-US');
    const sm=app.querySelector('[data-cx-sum]'); if(sm) sm.textContent=`Engagement preference for ${ch.v} is ${rk.v}`;
    const sv=app.querySelector('[data-cx-save]'); if(sv) sv.classList.add('on'); };
  document.addEventListener('click',e=>{
    const sel=e.target.closest('.cx-sel'); const item=e.target.closest('.cx-menu button'); const tab=e.target.closest('.cx-tabs button');
    document.querySelectorAll('.cx-selw.open').forEach(w=>{ if(!w.contains(e.target)) w.classList.remove('open'); });
    if(tab){ tab.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===tab)); return; }
    if(item){ const w=item.closest('.cx-selw'), b=w.querySelector('.cx-sel'); b.dataset.v=item.dataset.v; b.textContent=item.dataset.v; w.querySelectorAll('.cx-menu button').forEach(x=>x.classList.toggle('on',x===item)); w.classList.remove('open'); upd(item.closest('.cx-app')); return; }
    if(sel){ const w=sel.closest('.cx-selw'); if(w.querySelector('.cx-menu')) w.classList.toggle('open'); }
  });
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-ca-car] [data-ca-i]'); if(b) b.closest('[data-ca-car]').classList.add('stop'); },true);
  document.addEventListener('pointerdown',e=>{ const f=e.target.closest('[data-ca-car] .ca-frame'); if(f) f.closest('[data-ca-car]').classList.add('stop'); });
})();
/* CA helper buddy: ring + tip on the next thing to try */
(function(){
  const STEPS={
    seg:[{q:'[data-k="ch"]',t:'Pick a channel.',k:'ch'},{q:'[data-k="rank"]',t:'Choose how highly it ranks.',k:'rank'}],
    prof:[{q:'.cx-tip',t:'Hover the column to see what the rank means.',k:'tip'}],
    flow:[{q:'[data-k="ch"]',t:'Split on a channel.',k:'ch'},{q:'[data-k="rank"]',t:'Set its rank.',k:'rank'},{q:'[data-cx-save]',t:'Save the split.',k:'save'}]
  };
  const DONE={seg:'The count updates with the prediction.',prof:'A rank, explained where people read it.',flow:'Each person now goes down their channel.'};
  const mk=app=>{ if(app.__g) return app.__g; const g=document.createElement('div'); g.className='pt-guide cx-guide'; g.setAttribute('aria-hidden','true');
    g.innerHTML='<div class="pg-ring"></div><div class="pg-tip"><small></small><b></b></div>'; app.appendChild(g); app.__g=g; app.__d=new Set(); return g; };
  const place=app=>{ const k=app.dataset.cx, st=STEPS[k]; if(!st) return; const g=mk(app), ring=g.firstChild, tip=g.lastChild;
    if(app.querySelector('.cx-selw.open')){ g.classList.remove('on'); return; }
    const i=st.findIndex(x=>!app.__d.has(x.k)); const A=app.getBoundingClientRect();
    if(i<0){ g.className='pt-guide cx-guide on done'; tip.className='pg-tip'; tip.firstChild.textContent='Done'; tip.lastChild.textContent=DONE[k]; tip.style.left=(A.width-Math.min(240,A.width-24)-12)+'px'; tip.style.top='12px'; return; }
    const el=app.querySelector(st[i].q); if(!el){ g.classList.remove('on'); return; } const b=el.getBoundingClientRect(); if(!b.width){ g.classList.remove('on'); return; }
    const x=b.left-A.left, y=b.top-A.top; g.className='pt-guide cx-guide on';
    Object.assign(ring.style,{left:(x-3)+'px',top:(y-3)+'px',width:(b.width+6)+'px',height:(b.height+6)+'px'});
    const right=false; tip.className='pg-tip'+(right?'':' below');
    tip.style.left=(right?x+b.width+14:Math.max(8,Math.min(x,A.width-232)))+'px'; tip.style.top=(right?y-4:y+b.height+12)+'px';
    tip.firstChild.textContent='Step '+(i+1)+' of '+st.length; tip.lastChild.textContent=st[i].t; };
  const all=()=>document.querySelectorAll('.cx-app[data-cx]').forEach(a=>{ if(!a.offsetParent) return; const r=a.getBoundingClientRect(); if(r.bottom>0&&r.top<innerHeight) place(a); });
  document.addEventListener('click',e=>{ const app=e.target.closest('.cx-app[data-cx]'); if(!app) return; mk(app);
    const it=e.target.closest('.cx-menu button'); if(it){ const s=it.closest('.cx-selw').querySelector('.cx-sel'); if(s&&s.dataset.k) app.__d.add(s.dataset.k); }
    if(e.target.closest('[data-cx-save]')) app.__d.add('save'); setTimeout(()=>place(app),30); });
  ['mouseover','focusin'].forEach(t=>document.addEventListener(t,e=>{ const tp=e.target.closest&&e.target.closest('.cx-tip'); if(!tp) return; const app=tp.closest('.cx-app'); if(!app) return; mk(app); app.__d.add('tip'); setTimeout(()=>place(app),900); }));
  setInterval(all,500); addEventListener('resize',all);
})();
/* "Jump to solution" under the Solution line at the top of every case study */
const SOL_RE=/^(solution|final design|artifacts)$/i;
function solSection(cb){ return [...cb.querySelectorAll('section[data-s]')].find(x=>SOL_RE.test((x.dataset.s||'').trim())); }
function addSolJump(cb){ if(!solSection(cb)) return; const cell=[...cb.querySelectorAll('.dd-tldr > div')].find(d=>{ const sp=d.querySelector('span'); return sp&&/solution/i.test(sp.textContent); }); if(!cell||cell.querySelector('.tl-jump')) return;
  cell.insertAdjacentHTML('beforeend','<button type="button" class="tl-jump" data-jump-sol>Jump to solution <span aria-hidden="true">↓</span></button>'); }
document.addEventListener('click',e=>{ const b=e.target.closest('[data-jump-sol]'); if(!b) return; const cb=b.closest('#cs-body')||document; const sec=solSection(cb); if(!sec) return;
  const y=sec.getBoundingClientRect().top+scrollY-72; window.scrollTo({top:y,behavior:reduce?'auto':'smooth'}); });
/* SLA experiment bars grow when seen */
(function(){
  onAppear('[data-sla-exp]',el=>inView(el,v=>{ if(v) el.classList.add('on'); },{rootMargin:'0px 0px -15% 0px'})); })();
/* LMS: reveal-on-view, replay, and the final-design demo */
(function(){
  onAppear('[data-inview]',el=>inView(el,v=>{ if(v) el.classList.add('on'); },{rootMargin:'0px 0px -15% 0px'}));
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-lm-replay]'); if(!b) return; const w=b.closest('[data-inview]'); w.classList.remove('on'); void w.offsetWidth; setTimeout(()=>w.classList.add('on'),60); });
  onAppear('.lm-m1,.lm-m3',el=>cssLoopCtl(el.closest('.lm-ccv')||el)); // concept mocks: 2 cycles, Pause, off-screen pause
  const set=(fd,n)=>{ fd.dataset.s=n; fd.querySelectorAll('[data-lfs]').forEach(b=>b.classList.toggle('on',b.dataset.lfs==n)); };
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-lfs]'); if(b){ const fd=b.closest('[data-lfd]'); fd.__stop=1; set(fd,b.dataset.lfs); if(fd.__ctl) fd.__ctl.finish(); return; }
  });
  const reduceM=matchMedia('(prefers-reduced-motion:reduce)').matches;
  onAppear('[data-lfd]',fd=>{ const c=fd.querySelector('[data-lfc]');
    if(reduceM){ fd.__stop=1; set(fd,3); if(c) c.hidden=true; return; } // end state: the final step
    const ctl=fd.__ctl=loopCtl(fd,{btn:c}); let steps=0;
    const tick=()=>{ if(fd.__stop||!document.contains(fd)){ ctl.finish(); return; }
      if(!ctl.paused()){ set(fd,(+fd.dataset.s%3)+1); if(++steps>=3*LOOP.demo-1){ fd.__stop=1; ctl.finish(); return; } }
      setTimeout(tick,LOOP.lfdStep); };
    setTimeout(tick,LOOP.lfdStep); });
})();
/* SLA solution: suggestions that follow what you type */
(function(){
  const STOP=new Set('the a an and or for to of on in at is are be our your you we new just this that with from it its my me us are coming next month week today now hurry'.split(' '));
  const T=[w=>`Countdown to ${w} Starts Now!`,w=>`Be First to Discover ${w}!`,w=>`Exciting ${w} Coming Your Way!`,w=>`${w}: Just Landed`,w=>`Your Next Favorite ${w}`,w=>`Don’t Miss Our ${w}`,w=>`Fresh ${w}, Picked for You`,w=>`${w} You’ll Love`,w=>`The ${w} Edit Is Here`];
  const EMPTY=[["Be the First to Explore New Picks!","Exciting New Arrivals Await!","New Items Just In, Shop Today!"],["Your Fall Favorites Are Back","Something New Just Dropped","Fresh Finds for Your Weekend"]];
  const cap=w=>w.charAt(0).toUpperCase()+w.slice(1);
  const kw=v=>{ const ws=v.toLowerCase().replace(/[^a-z\s']/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)); if(!ws.length) return ''; return ws.slice(-2).map(cap).join(' '); };
  const gen=(v,seed)=>{ const k=kw(v); if(!k) return EMPTY[seed%2]; const out=[]; for(let i=0;i<3;i++) out.push(T[(seed*3+i)%T.length](k)); return out; };
  const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function init(w){ if(w.__slx) return; w.__slx=1;
    const inp=w.querySelector('[data-slx-in]'), list=w.querySelector('[data-slx-list]'), et=w.querySelector('[data-slx-et]'), box=inp.closest('.slx-in');
    let seed=0, timer=null, words=0, auto=null;
    const skel=()=>{ list.innerHTML='<span class="slx-sk"></span><span class="slx-sk" style="width:70%"></span><span class="slx-sk" style="width:82%"></span>'; };
    const fill=()=>{ list.innerHTML=gen(inp.value,seed).map(t=>`<button type="button" data-slx-pick>${esc(t)}</button>`).join(''); };
    const refresh=(d=650)=>{ skel(); clearTimeout(w.__rt); w.__rt=setTimeout(fill,d); };
    const sync=()=>{ et.textContent=inp.value; w.classList.toggle('empty',!inp.value.trim()); };
    const open=()=>{ w.classList.add('open'); sync(); };
    const close=()=>w.classList.remove('open');
    inp.addEventListener('focus',()=>{ stopAuto(); open(); if(!list.children.length) refresh(400); });
    inp.addEventListener('input',e=>{ if(e.isTrusted) stopAuto(); box.classList.remove('ai'); open(); sync(); const n=inp.value.trim().split(/\s+/).filter(Boolean).length;
      clearTimeout(timer); if(n>=words+3||n<words){ words=n; seed++; refresh(); } else timer=setTimeout(()=>{ words=n; seed++; refresh(); },2000); });
    w.addEventListener('mousedown',e=>{ if(e.target.closest('.slx-dd')) e.preventDefault(); });
    w.addEventListener('click',e=>{ if(e.isTrusted) stopAuto(); const pk=e.target.closest('[data-slx-pick]'); if(pk){ inp.value=pk.textContent; box.classList.add('ai'); words=inp.value.split(/\s+/).length; close(); inp.focus(); setTimeout(close,0); return; }
      if(e.target.closest('[data-slx-rg]')){ seed++; refresh(); return; }
      if(e.target.closest('[data-slx-echo]')){ close(); return; } });
    inp.addEventListener('blur',()=>setTimeout(()=>{ if(document.activeElement!==inp) close(); },120));
    inp.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
    // a short demo plays until someone touches it
    const stopAuto=()=>{ if(auto){ clearTimeout(auto); auto=null; } w.classList.add('touched'); if(w.__ctl) w.__ctl.finish(); };
    const script="hurry! New shoes are coming next month";
    // the demo types at LOOP.typeMs per character, runs LOOP.demo times, then holds the picked line; any focus, click or typing stops it
    let runs=0; const wait=(f,ms)=>{ auto=setTimeout(function hold(){ if(w.classList.contains('touched')) return; if(w.__ctl&&w.__ctl.paused()){ auto=setTimeout(hold,250); return; } f(); },ms); };
    const play=()=>{ if(w.classList.contains('touched')) return; runs++; let i=0; inp.value=''; box.classList.remove('ai'); words=0; seed=0; open(); refresh(400);
      const step=()=>{ if(i<=script.length){ inp.value=script.slice(0,i++); inp.dispatchEvent(new Event('input')); wait(step,LOOP.typeMs); }
        else wait(()=>{ seed++; refresh(); wait(pick,1600); },900); };
      // pick a suggestion; if the list is mid-refresh (skeleton), try again shortly
      const pick=()=>{ const b=list.querySelector('[data-slx-pick]:nth-child(3)')||list.querySelector('[data-slx-pick]'); if(!b){ wait(pick,200); return; }
        b.classList.add('hi'); wait(()=>{ inp.value=b.textContent; box.classList.add('ai'); close();
          if(runs<LOOP.demo) wait(play,LOOP.slxRestart); else { auto=null; if(w.__ctl) w.__ctl.finish(); } },700); };
      wait(step,500); };
    const endState=()=>{ inp.value=gen(script,1)[2]||script; words=inp.value.split(/\s+/).length; sync(); }; // the line the demo picks; the "Try it" hint stays
    w.__end=endState;
    w.__play=play;
  }
  onAppear('[data-slx]',w=>{ init(w); if(reduce){ w.__end(); return; } w.__ctl=loopCtl(w);
    inView(w,v=>{ if(v&&!w.__started){ w.__started=1; w.__play(); } },{threshold:.5}); });
})();
/* case studies: reveal blocks on scroll */
function setupReveal(cb){
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const els=[...cb.querySelectorAll('article.dd > section > .head, article.dd > section > .cs-b, article.dd > section > :not(.head):not(.cs-b), .dd-tldr ~ .cs-proc ~ section .cs-b')];
  // colour bands are whole <section>s and never get .rv: only their content fades, so plum stays plum
  const uniqEls=[...new Set(els)].filter(el=>!el.closest('.dd-hero')&&!el.classList.contains('dd-stage'));
  const vh=innerHeight;
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  uniqEls.forEach(el=>{ const r=el.getBoundingClientRect(); if(r.top<vh*.92) return; el.classList.add('rv'); io.observe(el); });
}
/* All projects: soft light follows the cursor */
document.addEventListener('pointermove',e=>{ const c=e.target.closest&&e.target.closest('.ac'); if(!c) return; const r=c.getBoundingClientRect(); c.style.setProperty('--mx',(e.clientX-r.left)+'px'); c.style.setProperty('--my',(e.clientY-r.top)+'px'); },{passive:true});
/* PST solution tabs */
document.addEventListener('click',e=>{ const b=e.target.closest('[data-sxt]'); if(!b) return; const w=b.closest('[data-sx]'); if(!w) return; const i=b.dataset.sxt;
  w.querySelectorAll('[data-sxt]').forEach(x=>{ const on=x===b; x.classList.toggle('on',on); x.setAttribute('aria-selected',on); });
  w.querySelectorAll('[data-sxi]').forEach(x=>x.classList.toggle('on',x.dataset.sxi===i)); });
/* ---------- hero-screen thumbnails + open-into-the-screen transition ---------- */
const HERO_W=960, MINI_PAD=32;
const FOCUS_SEL='.lx-app, .lw-win, .ca-car, .cs-th > svg, .cs-media img, .cs-media video';
const heroRO=('ResizeObserver' in window)?new ResizeObserver(es=>es.forEach(e=>fitHero(e.target))):null;
function fitHero(el){ const w=el.clientWidth, h=el.clientHeight; if(!w) return;
  if(el.dataset.mode==='stage'&&!el.dataset.fw&&el.__meas&&!el.__mz){ el.__mz=1; el.__meas(); el.__mz=0; return; }
  if(el.dataset.mode==='stage'){ const W=+el.dataset.w||1000, H=+el.dataset.h||600;
    const fx=+el.dataset.fx||0, fy=+el.dataset.fy||0, fw=+el.dataset.fw||W, fh=+el.dataset.fh||H;
    if(el.closest('.sr-xp')) el.style.aspectRatio=(fw/fh).toFixed(4);
    const hh=el.clientHeight||h; const photo=!!el.querySelector('.hs-stage .cs-media img'); const k=photo?Math.max(w/fw, hh/fh):Math.min(w/fw, hh/fh);
    el.style.setProperty('--k',k); el.style.setProperty('--x',((w-fw*k)/2-fx*k)+'px'); el.style.setProperty('--y',((hh-fh*k)/2-fy*k)+'px'); return; }
  const k=el.dataset.mode==='page'?(w-2*MINI_PAD)/(+el.dataset.w||1000):Math.max(w/HERO_W, h/(HERO_W*0.6)); el.style.setProperty('--k',k); }
function heroFinal(w,id){
  w.querySelectorAll('.lx-cursor').forEach(n=>n.remove());
  const lx=w.querySelector('.lx'); if(!lx) return;
  if(id==='discount') lx.classList.add('on');
  if(id==='audience'){ w.querySelectorAll('[data-ao-tg],[data-ao-r],[data-ao-b],[data-ao-imp]').forEach(n=>n.classList.add('on')); const t=w.querySelector('[data-ao-total]'); if(t) t.textContent='131,520'; }
  if(id==='send-time'){ lx.classList.add('pst'); const ty=w.querySelector('[data-st-type]'); if(ty) ty.textContent='✦ Personalized send time'; const cp=w.querySelector('[data-st-cap]'); if(cp) cp.textContent='Each person at their own best hour, 11 AM – 8 PM';
    const ch=w.querySelector('[data-st-chart="hero"]'); if(ch){ let sd=11; const r=()=>{ sd=(sd*9301+49297)%233280; return sd/233280; }; const cols={}; let h='';
      for(let i=0;i<60;i++){ const hr=Math.round((11.2+r()*8.4)*2)/2; const k=cols[hr]=(cols[hr]||0)+1; h+=`<i class="d" style="left:${(hr/24*100).toFixed(2)}%;bottom:${4+(k-1)*11}px"></i>`; } ch.insertAdjacentHTML('beforeend',h); } }
}
function pageW(){ return Math.min(1000, (document.documentElement.clientWidth||innerWidth)-40); }
function fillHeroThumbs(){
  document.querySelectorAll('.hero-th[data-hero]:not(.filled)').forEach(el=>{
    const C=caseTpl(el.dataset.hero); if(!C) return;
    const page=el.dataset.mode==='page', stg=el.dataset.mode==='stage';
    const w=document.createElement('div'); w.className='dd hs'; w.setAttribute('aria-hidden','true');
    if(stg){ const sg=C.querySelector('.dd-hero + .dd-stage')||C.querySelector('.dd-stage'); if(!sg) return; w.classList.add('hs-stage'); w.appendChild(sg.cloneNode(true)); w.style.width=pageW()+'px'; el.dataset.w=pageW(); }
    else if(page){ const art=C.querySelector('article.dd'); const hd=art&&art.querySelector('.dd-hero'), st=art&&art.querySelector('.dd-hero + .dd-stage'); if(!hd) return;
      w.appendChild(hd.cloneNode(true)); if(st) w.appendChild(st.cloneNode(true)); w.style.width=pageW()+'px'; el.dataset.w=pageW(); heroFinal(w,el.dataset.hero); }
    else { const lx=C.querySelector('.lx-stage .lx'); if(!lx) return; w.appendChild(lx.cloneNode(true)); }
    heroFinal(w,el.dataset.hero);
    w.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    w.querySelectorAll('button,a,input,select,[tabindex]').forEach(n=>n.setAttribute('tabindex','-1'));
    w.querySelectorAll('.th[data-t]').forEach(n=>{ if(THUMBS[n.dataset.t]) n.innerHTML=uniq(THUMBS[n.dataset.t]); n.classList.add('play'); });
    // previews use the video's still frame, so they size correctly and never show an empty box
    w.querySelectorAll('video').forEach(v=>{ const ps=v.getAttribute('poster'); if(!ps){ v.muted=true; return; } const im=document.createElement('img'); im.src=ps; im.alt=''; const sz=(typeof SZ!=='undefined')&&SZ[ps]; if(sz){ im.width=sz[0]; im.height=sz[1]; } v.replaceWith(im); });
    el.appendChild(w); el.classList.add('filled');
    const meas=()=>{ if(stg){ el.dataset.h=w.offsetHeight||600; const fo=w.querySelector(FOCUS_SEL); const wr=w.getBoundingClientRect(), sc=wr.width/(+el.dataset.w||1)||1;
        if(fo){ const r=fo.getBoundingClientRect(); if(r.width){ el.dataset.fx=(r.left-wr.left)/sc; el.dataset.fy=(r.top-wr.top)/sc; el.dataset.fw=r.width/sc; el.dataset.fh=r.height/sc; } } } fitHero(el); if(stg) fitHero(el); };
    el.__meas=meas; meas(); w.querySelectorAll('img,video').forEach(m=>m.addEventListener(m.tagName==='IMG'?'load':'loadedmetadata',meas,{once:true}));
    if(heroRO) heroRO.observe(el);
  });
}
let heroQ=0; new MutationObserver(()=>{ if(heroQ) return; heroQ=requestAnimationFrame(()=>{ heroQ=0; fillHeroThumbs(); }); }).observe(document.body,{childList:true,subtree:true});
let FLIP=null;
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-open]'); if(!o) return; if(o.closest('#v-all')||o.classList.contains('pc')||o.classList.contains('ac')){ FLIP=null; return; }
  const th=[...((o.classList.contains('xp')&&o.querySelectorAll('.sr-xp .tbox'))||[]),...o.querySelectorAll('.tbox,.focus-art')].find(x=>x.getBoundingClientRect().width>0); FLIP=th?{id:o.dataset.open,r:th.getBoundingClientRect(),page:th.dataset.mode==='page',mode:th.dataset.mode||''}:null;
  const tt=o.querySelector('.st,.pc-title'); if(FLIP&&tt){ const r=tt.getBoundingClientRect(); if(r.width) FLIP.t={r,fs:parseFloat(getComputedStyle(tt).fontSize)||16}; }
},true);
function flipIn(id,cb){
  const f=FLIP; FLIP=null; if(!f||f.id!==id||reduce) return;
  if(f.page){
    const art=cb.querySelector('article.dd'), hd=art&&art.querySelector('.dd-hero'), st=hd&&hd.nextElementSibling&&hd.nextElementSibling.classList.contains('dd-stage')?hd.nextElementSibling:null; if(!hd) return;
    const h0=hd.getBoundingClientRect(); const k=(f.r.width-2*MINI_PAD)/h0.width;
    const ox=f.r.left+MINI_PAD, oy=f.r.top+MINI_PAD, visH=(f.r.height-MINI_PAD)/k;
    const D=cssMs('--d-5'), E=cssVar('--ease-emph');
    [hd,st].filter(Boolean).forEach(el=>{ const r=el.getBoundingClientRect();
      const tx=ox+(r.left-h0.left)*k-r.left, ty=oy+(r.top-h0.top)*k-r.top;
      const cut=Math.max(0,r.height-Math.max(0,visH-(r.top-h0.top)));
      el.style.willChange='transform';
      const a=el.animate([{transform:`translate(${tx}px,${ty}px) scale(${k})`,transformOrigin:'0 0',clipPath:`inset(0 0 ${cut}px 0)`},
                          {transform:'none',transformOrigin:'0 0',clipPath:'inset(0 0 0 0)'}],{duration:D,easing:E});
      a.finished&&a.finished.then(()=>{ el.style.willChange=''; });
    });
    [...art.children].filter(n=>n!==hd&&n!==st).forEach(n=>n.animate([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:cssMs('--d-4'),delay:OPEN.restDelay,easing:E,fill:'backwards'}));
    return;
  }
  if(f.mode==='stage'){
    const art=cb.querySelector('article.dd'), st=cb.querySelector('.dd-hero + .dd-stage'), h1=cb.querySelector('.dd-hero .cs-h1'); if(!art||!st) return;
    const D=cssMs('--d-5'), E=cssVar('--ease-emph');
    const r=st.getBoundingClientRect(); if(!r.width) return;
    const fo=st.querySelector(FOCUS_SEL), T=fo&&fo.getBoundingClientRect().width?fo.getBoundingClientRect():r;
    // the preview showed just the screen: start the stage so that screen sits exactly where the preview was
    const k=Math.min(f.r.width/T.width, f.r.height/T.height), ox=f.r.left+(f.r.width-T.width*k)/2, oy=f.r.top+(f.r.height-T.height*k)/2;
    // one camera move: hero and screen share the same zoom, so the title and the image arrive together
    const cam=el=>{ const E=el.getBoundingClientRect(); return `translate(${ox+(E.left-T.left)*k-E.left}px,${oy+(E.top-T.top)*k-E.top}px) scale(${k})`; };
    const lx=T.left-r.left, ly=T.top-r.top;
    const cl=Math.max(0,lx), ct=Math.max(0,ly), cr=Math.max(0,r.width-(lx+T.width)), cbm=Math.max(0,r.height-(ly+T.height));
    const hd=art.querySelector('.dd-hero'), tl=[...art.children].find(n=>n.classList.contains('dd-tldr'));
    const top=[hd,st,tl].filter(Boolean);
    top.forEach(el=>{ el.style.willChange='transform'; const kf=[{transform:cam(el),transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}];
      if(el===st){ kf[0].clipPath=`inset(${ct}px ${cr}px ${cbm}px ${cl}px round ${10/k}px)`; kf[1].clipPath='inset(0px 0px 0px 0px round 28px)'; }
      if(el===tl){ kf[0].opacity=0; kf[1].opacity=1; }
      const an=el.animate(kf,{duration:D,easing:E}); an.finished&&an.finished.then(()=>{ el.style.willChange=''; }); });
    if(hd) [...hd.children].filter(n=>n!==h1).forEach(n=>n.animate([{opacity:0},{opacity:1}],{duration:cssMs('--d-4'),easing:E,fill:'backwards'}));
    const rest=[...art.children].filter(n=>!top.includes(n)).concat([...cb.children].filter(n=>!n.contains(art)));
    rest.forEach(n=>n.animate([{opacity:0},{opacity:1}],{duration:cssMs('--d-4'),easing:E,fill:'backwards'}));
    return;
  }
  const tg=cb.querySelector('.lx-stage .lx')||cb.querySelector('.cs-art'); if(!tg) return;
  const r=tg.getBoundingClientRect(); if(!r.width) return;
  const k=f.r.width/r.width, dx=f.r.left-r.left, dy=f.r.top-r.top;
  tg.animate([{transform:`translate(${dx}px,${dy}px) scale(${k})`,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}],{duration:cssMs('--d-4'),easing:cssVar('--ease-emph')});
  const rest=[...cb.querySelectorAll('.dd-hero, .dd-hero ~ :not(.dd-stage), .cs-h1, .cs-sub, .cs-eyebrow, .crumb')].filter(n=>!n.contains(tg));
  rest.forEach(n=>n.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:cssMs('--d-5'),delay:0,easing:cssVar('--ease-out'),fill:'backwards'}));
}
/* ---------- the generation sequence ---------- */
// the intro plays once ever (L8): the first visit streams it, every later visit (and Home, and the logo) shows the end state
let introSeen=(()=>{ try{ return localStorage.getItem('ng-intro')==='1'; }catch(e){ return false; } })();
function headHTML(anim){ return ["Hey,","I'm","Nila"].map((w,i)=>`<span class="w${i===2?' it':''}"${anim?` style="animation-delay:${T(i*INTRO.word)}ms"`:''}>${esc(w)}</span>`).join(' '); }
async function boot(){
  const rid=++S.run; S.touched=false; S.q=''; S.hits=[]; S.answerFor=null; S.answering=false; S.focus=null;
  inp.value=''; $('#ans').classList.remove('on'); $('#ans').removeAttribute('aria-busy'); $('#ans-live').textContent=''; $('#ans').innerHTML=''; $('#ans-next').innerHTML=''; $('#chips').style.display='';
  const h1=$('#h1'), sub=$('#sub'), box=$('#box');
  $('#res').innerHTML=''; $('#more-list').innerHTML='';
  window.scrollTo(0,0);
  // returning visit: everything is already there, no replay
  if(introSeen){
    h1.innerHTML=headHTML(false); h1.querySelectorAll('.w').forEach(w=>w.style.animation='none');
    sub.className='sub'; sub.textContent=INTRO_S; box.style.opacity='1'; box.style.animation=$('#more').style.animation='none'; box.classList.add('in'); $('#more').classList.add('in'); render({stagger:false});
    inp.value=PREFILL; prime(true); return;
  }
  box.style.animation=$('#more').style.animation='';
  h1.innerHTML=''; sub.className='sub'; sub.textContent=''; box.classList.remove('in'); box.style.opacity=0; $('#more').classList.remove('in');
  introSeen=true; try{ localStorage.setItem('ng-intro','1'); }catch(e){}
  // the headline streams in at once; the sentence, then the box and the work list, follow within a second
  h1.innerHTML=headHTML(true);
  await sleep(T(INTRO.sub)); if(rid!==S.run) return;
  sub.textContent=INTRO_S; sub.classList.add('in');
  await sleep(T(INTRO.box)); if(rid!==S.run) return;
  box.style.opacity=''; box.classList.add('in'); $('#more').classList.add('in'); render({stagger:true});
  await sleep(T(INTRO.typeAfter)); if(rid!==S.run) return;
  await typePrompt(rid); if(rid!==S.run) return;
  prime(true);
}
function prime(on){ S.primed=on; inp.placeholder='Ask about my work, or search projects'; go.disabled=!(on||inp.value.trim()); go.classList.toggle('nudge',on); $('#box').classList.toggle('primed',on); }
function runPrimed(){ const v=inp.value.trim(); if(!S.primed||(v&&v!==PREFILL)) return false; prime(false); ask(PREFILL); return true; }
async function typePrompt(rid){ inp.value=''; for(let i=1;i<=PREFILL.length;i++){ if(rid!==S.run||S.touched) break; inp.value=PREFILL.slice(0,i); $('#kbd').hidden=true; await sleep(T(INTRO.typeMs)); } if(rid===S.run&&!S.touched) inp.value=PREFILL; }

function goHomeReplay(e){ if(e) e.preventDefault(); if(location.hash) history.pushState(null,'',location.pathname+location.search); booted=true; lastRoute=''; show('home'); document.title='Nila Gao, Product Designer'; boot(); routed++; focusHeading(); }
$('#logo').addEventListener('click',goHomeReplay);


/* home rows: hover a project and the row itself opens to show its opening screen */
(function(){
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let cur=null, t=null;
  const build=(row)=>{ let x=row.querySelector('.sr-xp'); if(x) return x; const id=row.dataset.open; if(!id) return null;
    x=document.createElement('span'); x.className='sr-xp'; x.setAttribute('aria-hidden','true');
    x.innerHTML='<span class="sr-xpi">'+(hasStage(id)?`<span class="tbox th hero-th" data-hero="${id}" data-mode="stage"></span>`:(THUMBS[id]?`<span class="tbox th">${uniq(THUMBS[id])}</span>`:''))+'</span>';
    row.appendChild(x); return x; };
  const prebuild=()=>{ document.querySelectorAll('#v-home .sr[data-open]').forEach(build); fillHeroThumbs(); };
  const close=(r)=>{ if(!r) return; r.classList.remove('xp'); const x=r.querySelector('.sr-xp'); if(x) x.style.height='0px'; };
  const open=(row)=>{ const x=build(row); if(!x) return; fillHeroThumbs();
    const sv=x.querySelector('.tbox:not(.hero-th)'); if(sv) sv.classList.add('play');
    x.querySelectorAll('.hero-th').forEach(fitHero);
    x.style.height='0px'; row.classList.add('xp'); requestAnimationFrame(()=>{ x.style.height=x.firstChild.scrollHeight+'px'; }); };
  // build every preview ahead of time, so hovering is instant
  const list=document.getElementById('more'); if(list) list.addEventListener('mouseenter',prebuild);
  setTimeout(()=>{ (window.requestIdleCallback||setTimeout)(prebuild); },1500);
  let opened=null, armed=true, mv=0, lx=null, ly=null;
  // a new answer or list resets everything: nothing opens until the mouse actually moves onto a row
  const reset=()=>{ clearTimeout(t); if(opened) close(opened); opened=null; cur=null; armed=false; mv=0; lx=null; };
  ['res','more-list'].forEach(id=>{ const el=document.getElementById(id); if(el) new MutationObserver(reset).observe(el,{childList:true}); });
  document.addEventListener('mousemove',e=>{ if(armed) return; if(lx!==null) mv+=Math.abs(e.clientX-lx)+Math.abs(e.clientY-ly); lx=e.clientX; ly=e.clientY; if(mv>12){ armed=true; cur=null; } },{passive:true});
  const busy=()=>!armed||(typeof S!=='undefined'&&S.answering)||!!document.querySelector('#ans.thinking');
  const swap=(row)=>{ if(opened&&opened!==row) close(opened); if(opened!==row||!row.classList.contains('xp')) open(row); opened=row; };
  document.addEventListener('mouseover',e=>{ if(busy()) return; const row=e.target.closest('#v-home .sr[data-open]'); if(row===cur) return; clearTimeout(t); cur=row; if(row&&row!==opened){ const first=!opened||!document.contains(opened); if(first) swap(row); else t=setTimeout(()=>{ if(cur===row) swap(row); },INTRO.intent); } });
  document.addEventListener('focusin',e=>{ if(typeof S!=='undefined'&&S.answering) return; const row=e.target.closest('#v-home .sr[data-open]'); if(row&&row!==opened&&row.matches(':focus-visible')) swap(row); });
  document.addEventListener('mouseleave',()=>{ clearTimeout(t); cur=null; });
})();

routeTo();
/* W3-09d: the jobs matrix tells its point: low-value jobs land first, the gold high-value ones last, all within JTBD.total */
onAppear('.lm-mx',svg=>{
  const ds=[...svg.querySelectorAll('.lm-dot')], gold=ds.filter(d=>d.classList.contains('q4')), grey=ds.filter(d=>!d.classList.contains('q4'));
  const span=JTBD.total-cssMs('--d-3'), greyEnd=Math.round(span*.6);
  const spread=(list,from,to)=>list.forEach((d,i)=>d.style.setProperty('--d',Math.round(list.length>1?from+i*(to-from)/(list.length-1):from)+'ms'));
  spread(grey,0,greyEnd); spread(gold,greyEnd+JTBD.gap,span);
});
/* W3-10 (fix #16): real tabs. A group that swaps a panel becomes tablist / tab / tabpanel, with a roving tabindex and
   ←/→ (also ↑/↓, Home, End) that move and select. The existing click handlers still do the switching; "on" stays the
   source of truth and the ARIA follows it. Segment controls that change a view in place drop role=tablist and use aria-pressed. */
let tabN=0;
const decoCopy=el=>!!el.closest('.th,.tbox,.hs,[aria-hidden="true"],[inert]'); // thumbnail copies of a page stay inert
function realTabs(list,tabs,panes){
  if(!list||list.__tabs||tabs.length<2||decoCopy(list)) return; list.__tabs=1; const uid='tb'+(++tabN);
  list.setAttribute('role','tablist');
  [...list.children].forEach(c=>{ if(!tabs.includes(c)) c.setAttribute('role','presentation'); });
  panes.forEach((p,i)=>{ if(!p.id) p.id=uid+'-p'+i; p.setAttribute('role','tabpanel'); });
  tabs.forEach((t,i)=>{ if(!t.id) t.id=uid+'-t'+i; t.setAttribute('role','tab'); const p=panes.length===tabs.length?panes[i]:panes[0]; if(p) t.setAttribute('aria-controls',p.id); });
  const sync=()=>{ const k=Math.max(0,tabs.findIndex(t=>t.classList.contains('on')));
    tabs.forEach((t,i)=>{ t.setAttribute('aria-selected',i===k?'true':'false'); t.tabIndex=i===k?0:-1; });
    panes.forEach((p,i)=>p.setAttribute('aria-labelledby',tabs[panes.length===tabs.length?i:k].id)); };
  sync(); new MutationObserver(sync).observe(list,{subtree:true,attributes:true,attributeFilter:['class']});
  list.addEventListener('keydown',e=>{ const i=tabs.indexOf(document.activeElement); if(i<0) return;
    const n=tabs.length, j={ArrowRight:(i+1)%n,ArrowDown:(i+1)%n,ArrowLeft:(i-1+n)%n,ArrowUp:(i-1+n)%n,Home:0,End:n-1}[e.key];
    if(j===undefined) return; e.preventDefault(); tabs[j].focus(); tabs[j].click(); });
}
// the panel is the element right after the tab list: one child per tab, a run of sibling panes, or one shared region
function panesAfter(list,n){ const nx=list.nextElementSibling; if(!nx) return [];
  const c=nx.classList[0], sib=c?[...list.parentElement.children].filter(x=>x.classList.contains(c)):[];
  const ok=a=>a.every(x=>!/^(IMG|VIDEO|PICTURE|CANVAS|SVG)$/i.test(x.tagName)); // media can't be a tabpanel: the container is
  if(sib.length===n&&ok(sib)) return sib; if(nx.children.length===n&&ok([...nx.children])) return [...nx.children]; return [nx]; }
onAppear('.dt-nav,.pt-tabs,.ao-tabs,.ca-ppl,.sla-ctabs,.sla-etabs',l=>{ const t=[...l.querySelectorAll(':scope > button')]; realTabs(l,t,panesAfter(l,t.length)); });
// LMS storyboard: the three step buttons share a row with Stop and a link, so they get their own (layout-free) tab list
onAppear('.lm-fdst',row=>{ const steps=[...row.querySelectorAll(':scope > [data-lfs]')]; if(steps.length<2) return;
  const w=document.createElement('span'); w.className='lm-fdtabs'; w.setAttribute('aria-label','Steps'); row.insertBefore(w,steps[0]); steps.forEach(b=>w.appendChild(b));
  realTabs(w,steps,[row.closest('[data-lfd]').querySelector('.lm-fdw')].filter(Boolean)); });
// segment controls: pressed buttons, not tabs
onAppear('.lx-seg,.st-seg',g=>{ if(g.__seg||decoCopy(g)) return; g.__seg=1; g.setAttribute('role','group'); const bs=[...g.querySelectorAll(':scope > button')];
  const sync=()=>bs.forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false'));
  sync(); new MutationObserver(sync).observe(g,{subtree:true,attributes:true,attributeFilter:['class']}); });
// SLA suggestions: a labelled group, not a listbox; when someone is using it, a polite line says how many came back
onAppear('.slx-dd',dd=>{ if(decoCopy(dd)) return; dd.removeAttribute('role'); dd.setAttribute('role','group'); dd.setAttribute('aria-label','Suggested subject lines');
  const live=document.createElement('p'); live.className='sr-only'; live.setAttribute('aria-live','polite'); dd.parentElement.appendChild(live);
  const list=dd.querySelector('[data-slx-list]')||dd; let last='';
  new MutationObserver(()=>{ const w=dd.closest('[data-slx]'); if(!w||!w.contains(document.activeElement)) return; // not while the demo plays by itself
    const n=dd.querySelectorAll('[data-slx-pick]').length; const msg=n?`${n} new suggestions`:''; if(msg&&msg!==last){ live.textContent=msg; last=msg; setTimeout(()=>{ last=''; },1500); } }).observe(list,{childList:true,subtree:true}); });
/* E5: input modality, for focus rings that :focus-visible doesn't cover (the search field, the prototype iframe) */
addEventListener('keydown',e=>{ if(e.key==='Tab'||e.key.startsWith('Arrow')||e.key==='Enter'||e.key===' ') document.documentElement.classList.add('kb'); },true);
addEventListener('pointerdown',()=>document.documentElement.classList.remove('kb'),true);
// focus entering an iframe blurs this window; mark that iframe so it can show a ring
addEventListener('blur',()=>setTimeout(()=>{ const a=document.activeElement; document.querySelectorAll('iframe.kbf').forEach(x=>x.classList.remove('kbf')); if(a&&a.tagName==='IFRAME') a.classList.add('kbf'); },0));
addEventListener('focus',()=>document.querySelectorAll('iframe.kbf').forEach(x=>x.classList.remove('kbf')));
