const INTRO_H="Hey, I'm Nila";
const INTRO_S="I design the AI experience @ Klaviyo. I like making models feel intuitive, trustworthy, and a little bit human.";
const PREFILL="Walk me through Nila's design process";
const SUGGEST=[
  {l:"Design process, start to finish",q:PREFILL},
  {l:"Send Time",q:"Show me personalized send time"},
  {l:"AI and LLM work",q:"Show me AI and LLM work"},
  {l:"ML features",q:"Show me ML and personalization features"},
  {l:"How does Nila work?",q:"How does Nila work?"},
  {l:"How does Nila use AI?",q:"How does Nila use AI in her work?"},
  {l:"Before Klaviyo",q:"What did Nila do before Klaviyo?"},
  {l:"Who is Nila?",q:"Who is Nila outside of work?"},
  {l:"Get in touch",q:"How do I get in touch?"},
];

/* ---------- answers (scripted from the case studies) ---------- */
const ALIASES={"discount":/discount/,"send-time":/send ?time|\bsto\b/,"subject-line":/subject ?line/,"brand-voice":/brand ?voice/,"channel-affinity":/channel affinity|\bchannel\b/,"audience":/audience/,"system":/personalization system/,"data-xray":/x-?ray|athenic/,"lms":/\blms\b|canvas/,"sitematch":/site ?match/,"peoples-vertex":/vertex/,"4run2":/4 ?run/};
const IGL='<a href="https://www.instagram.com/nila.snippets/" target="_blank" rel="noopener">@nila.snippets</a>';
function route(q){
  const s=q.toLowerCase().trim();
  if(/^(hi|hey|hello|hiya|howdy|yo|sup|heya|good (morning|afternoon|evening))\b|how are (you|u|things)|how'?s it going|how have you been|what'?s up|how'?s your day/.test(s)){
    const line='If it’s sunny, you’ll find me running on the Charles. If it’s rainy, I’m sketching.'; // static greeting: no weather call (L14)
    return {text:"Great! "+line,html:`<p class="ans-p" style="margin:0">Check out my sketches at ${IGL}.</p>`,ids:[],next:["Show me Nila's favorite project","Who is Nila outside of work?"]}; }
  if(/^(thanks|thank you|thx|ty|appreciate it)\b/.test(s)) return {text:"Anytime! Want to see the project I’m proudest of?",ids:[],next:["Show me Nila's favorite project"]};
  if(/^(bye|goodbye|see you|see ya|later)\b/.test(s)) return {text:"Bye for now! The fastest way to reach me is LinkedIn or email.",ids:[],next:["How do I get in touch?"]};
  // small question bank, kept short and true to the case studies
  if(/\bcode\b|\bcoding\b|claude|build (it|things)|engineer(ing)? skills|ship(ped)? code|develop/.test(s)&&!/engineers?\b.*work|work.*engineers?/.test(s)) return {tag:'ai',text:"Yes. I designed and built Audience Optimization’s campaign reporting in Claude Code, and it shipped to production. I also help other designers start building with agents.",ids:["audience"],next:["What tools does Nila use?","How does Nila use AI in her work?"]};
  if(/trust|explain|transparen|honest|black box|calibrat|inconclusive/.test(s)) return {tag:'ml',text:"By showing the evidence: a held-back group, both rates next to every lift, and “not enough data yet” states instead of early wins. I also design how a model calibrates (empty data, calibration in progress, reset, mature reporting), with a badge wherever personalization ran.",ids:["system","send-time","audience"]};
  if(/agent|agentic/.test(s)) return {tag:'ai',text:"I’ve explored how agent recommendations could appear inside Klaviyo’s AI chat, so it opens with a useful next step instead of an empty screen.",ids:[]};
  if(/\bmeasure|success|metric|prove|experiment|holdout|control group|did it work/.test(s)) return {tag:'ml',text:"Where it matters, I ship against a held-back group. Send Time and Channel Affinity were both measured against a control, so the lift, or the lack of one, is visible. Send Time: +2.97% email clicks across 1.8B+ messages.",ids:["send-time","channel-affinity"]};
  if(/engineer|developer|\bpms?\b|product manager|data scien|collaborat|cross.?functional|stakeholder/.test(s)) return {tag:'process',text:"Early, with something real. I bring working prototypes to PM, engineering and data science, so we react to the same thing instead of a spec.",ids:[]};
  if(/\btools?\b|figma|software|\bstack\b/.test(s)) return {tag:'process',text:"Claude Code and Claude for prototypes and handoff, Figma and FigJam for exploring, and Glean for product answers.",ids:[]};
  if(/where .*(based|live|located|from)|\blocation\b|\bboston\b|which city/.test(s)) return {tag:'personal',text:"Boston. On sunny days I’m running along the Charles.",ids:[]};
  if(/sketch|draw|\bart\b|illustrat|instagram|snippets/.test(s)) return {tag:'personal',text:"The places I travel and the food I find there.",html:`<p class="ans-p" style="margin:0">They end up at ${IGL}.</p>`,ids:[]};
  if(/\bfood\b|\beat\b|lobster|restaurant|hungry|favorite meal/.test(s)) return {tag:'personal',text:"I travel, I eat, then I draw what I ate. Ask me for a lobster roll recommendation.",ids:[]};
  if(/working on (now|currently|lately)|currently|right now|these days|\blatest\b/.test(s)) return {tag:'ml',text:"Discount Affinity, now in beta, and the personalization system that ties the ML features together.",ids:["discount","system"]};
  if(/why (ai|ml|personalization|design)|what drives|motivat|passion/.test(s)) return {tag:'ai',text:"I like making models feel intuitive, trustworthy, and a little bit human.",ids:[]};
  // Discount Affinity is the walkthrough (L6, D6): the prefill prompt and the old "favorite" wording both open it, before the process branch
  if(/walk (me )?through .*process|process,? start to finish|how nila designs|best|favou?rite|\btop\b|proud|strongest|standout|one project|start with/.test(s)) return {text:"Discount Affinity is the clearest look at how I work. I mapped 16 competitors screen by screen, prototyped five entry points as working flows, and tested them with 8 brands. They’d let AI hold back a discount, but not pick who deserves one, so the design suppresses instead of selecting. It’s live in beta with 254 companies.",ids:[],focus:"discount"};
  if(/discount/.test(s)&&/send ?time/.test(s)) return {text:"Two from my personalization work at Klaviyo. In both, the model was ready. The design problem was getting marketers to trust it.",ids:["discount","send-time"]};
  if(/(work|working|use|uses|design) with (ai|llm)|how .*use ai|ai in (her|your) (work|workflow|process)/.test(s)) return {text:"I use AI throughout my design process. I explore early ideas in Claude artifacts, which are fast and messy and good for getting quick alignment. Once a direction is clear, I move it into Claude Design, where I build interactive prototypes and handoff files that engineers use the way they’d use a Figma handover. I pair those with Loom walkthroughs for async design reviews. I use Glean to check how the product works today, and I use AI coding tools to open frontend PRs myself so small UI changes don’t wait on engineering. The result is that I go from concept to a testable prototype in hours instead of days. That keeps PMs, engineers and reviewers aligned on something real, not static mocks.",ids:[],tag:"ai",next:["Does Nila code?","How does Nila make AI trustworthy?"]};
  // a project named directly wins over every topic keyword
  const named=Object.entries(ALIASES).filter(([id,re])=>re.test(s)).map(([id])=>id);
  if(named.length===1){ const p=P[named[0]]; return {text:`${p.tip}. ${p.stat}.`,ids:[],focus:named[0],label:"Project"}; }
  if(named.length>1) return {text:"Here are the ones you asked about.",ids:named.slice(0,4)};
  if(/contact|touch|email|hire|reach|linkedin|resume|\bcv\b/.test(s)) return {text:"The fastest way is LinkedIn or email. My resume is linked too.",html:`<div class="contact"><a class="cbtn pri" href="https://www.linkedin.com/in/nila-gao/" target="_blank" rel="noopener">LinkedIn ↗</a><a class="cbtn" href="mailto:nilagao16@gmail.com">nilagao16@gmail.com</a><a class="cbtn" href="https://docs.google.com/document/d/1xMYgFVV8WB2Wj24K4v6swgLmBFmVYXQ8/edit" target="_blank" rel="noopener">Resume ↗</a></div>`,ids:[]};
  if(/who are|who is|about you|about nila|outside of work|\bfun\b|hobby|hobbies|soup|\bpersonal\b/.test(s)) return {tag:'personal',text:"Outside of work, I keep a sketchbook. I draw the places I travel and the food I find there, and share them on Instagram at @nila.snippets.",
    html:`<div class="about-row"><img src="about-photo.jpg" alt="Nila Gao" onerror="this.remove()"><p class="ans-p" style="margin:0">By day I’m a product designer at <b>Klaviyo</b>, working on AI and personalization. <a href="#about">More about me →</a></p></div>`,ids:["peoples-vertex","4run2"]};
  if(/process|how do you|how does|approach|method|work with/.test(s)) return {tag:'process',text:"I put early designs in front of customers, then let experiments settle the arguments. On Send Time I bet on a banner, and the inline dropdown won, so that’s what shipped. When a model’s effect is small, I make it legible instead of selling it: show the comparison, not the conclusion.",ids:["send-time","audience"]};
  if(/before|earlier|startup|school|cmu|carnegie|past|previous/.test(s)) return {text:"Before Klaviyo I was the founding designer at Athenic AI, and before that I studied at Carnegie Mellon.",ids:["data-xray","sitematch","lms"],tag:"past"};
  if(/playground|side project|installation|branding/.test(s)) return {tag:'past',text:"Fun work outside the day job: installations, branding, exhibitions.",ids:["peoples-vertex","4run2"]};
  if(/\bai\b|llm|generative|gen ?ai|writing/.test(s)) return {text:"Subject Line Assist made AI proactive: suggestions show up as you type, and that pattern became how Klaviyo designs proactive AI. I also built Brand Voice from zero, so AI copy sounds like the brand.",ids:["subject-line","data-xray"],next:["How does Nila use AI in her work?","Does Nila code?"]};
  if(/\bml\b|model|predict|machine learning|personaliz/.test(s)) return {text:"I’m the sole designer on Klaviyo’s personalization features. My focus is making the model explainable: honest lift, clear “inconclusive” states, and showing where personalization ran.",ids:["send-time","channel-affinity","audience","discount","system"],next:["How does Nila make AI trustworthy?"]};
  const m=matchIds(q);
  if(m.length) return {text:m.length===1?P[m[0]].tip+".":"These are the closest matches.",ids:m.slice(0,4)};
  return {text:"I only know what’s in my case studies, so I couldn’t match that. Try one of these:",ids:[],follow:true};
}
/* follow-ups: three at most, matched to what was just shown, rotating so they don't repeat */
const ASKED=new Set();
const BANK={
  ml:["How does Nila make AI trustworthy?","How does Nila measure whether a model worked?","Show me personalized send time","Show me AI and LLM work"],
  ai:["How does Nila use AI in her work?","Does Nila code?","How does Nila make AI trustworthy?","Show me ML and personalization features"],
  process:["How does Nila measure whether a model worked?","How does Nila work with engineers?","What tools does Nila use?","How does Nila use AI in her work?"],
  personal:["Where is Nila based?","What does Nila sketch?","Show me Nila's favorite project","How do I get in touch?"],
  past:["Show me LMS Canvas","Show me SiteMatch","Show me Data XRay"],
  general:["Show me Nila's favorite project","How does Nila use AI in her work?","Show me ML and personalization features","Who is Nila outside of work?","How do I get in touch?"]
};
const ML_IDS=["send-time","channel-affinity","audience","discount","system"], AI_IDS=["subject-line","data-xray"], PAST_IDS=["lms","sitematch","peoples-vertex","4run2"];
function pickNext(r,q){
  const k=q.toLowerCase().trim(); ASKED.add(k);
  const ids=[...(r.ids||[]),r.focus].filter(Boolean);
  const tag=r.tag||(ids.some(i=>ML_IDS.includes(i))?'ml':ids.some(i=>AI_IDS.includes(i))?'ai':ids.some(i=>PAST_IDS.includes(i))?'past':'general');
  const pool=[...new Set([...(r.next||[]),...(BANK[tag]||[]),...BANK.general])].filter(x=>x.toLowerCase()!==k);
  const fresh=pool.filter(x=>!ASKED.has(x.toLowerCase()));
  let out=fresh.slice(0,3);
  if(out.length<3){ const used=pool.filter(x=>!out.includes(x)); const n=ASKED.size; for(let i=0;i<used.length&&out.length<3;i++) out.push(used[(i+n)%used.length]); }
  return [...new Set(out)].slice(0,3).map(x=>({q:x,l:x}));
}
