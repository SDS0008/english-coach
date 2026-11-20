import * as AI from "./ai.js";
import { norm, wordsOf, sentences, near } from "./text.js";
import * as PDF from "./pdfqa.js";
import * as STT from "./stt-offline.js";
import * as Coach from "./coach.js";

/* ================= content ================= */
const LEVELS = {
  beginner:     {name:"Beginner",     lo:100, hi:120, rate:0.8},
  intermediate: {name:"Intermediate", lo:120, hi:140, rate:0.9},
  advanced:     {name:"Advanced",     lo:140, hi:160, rate:1.0}
};
const FIXES = [
  ["I am having 3 years of experience.","I have 3 years of experience.","\"Have\" for possession is not used in the -ing form."],
  ["Myself Ravi, from Hyderabad.","I'm Ravi, and I'm from Hyderabad.","\"Myself\" can't start a sentence as the subject."],
  ["I passed out from college in 2023.","I graduated in 2023.","Abroad, \"passed out\" means fainted."],
  ["I completed my graduation in B.Com.","I completed my B.Com degree.","Name the degree directly."],
  ["We discussed about the project.","We discussed the project.","\"Discuss\" takes no \"about\"."],
  ["Please revert back to me.","Please get back to me.","\"Revert\" already means go back; most interviewers say \"reply\"."],
  ["I am knowing Java and Python.","I know Java and Python.","\"Know\" is not used in the -ing form."],
  ["I did my internship in Infosys.","I did my internship at Infosys.","Use \"at\" for a company."],
  ["My native is Vijayawada.","My hometown is Vijayawada.","\"Native\" needs a noun; \"hometown\" is clearer."],
  ["I am interested to work here.","I am interested in working here.","\"Interested in\" + -ing."],
  ["Can you tell me your good name?","May I know your name?","\"Good name\" is not used outside India."],
  ["I have done B.Tech in 2022.","I did my B.Tech in 2022.","With a past year, use the simple past."],
  ["What is the salary package?","Could you share the salary range for this role?","More polite and direct."],
  ["I will do the needful.","I'll take care of it.","\"Do the needful\" sounds old-fashioned."]
];
const PHRASES = [
  "I'm a quick learner and I adapt well to new situations.",
  "In my previous role, I was responsible for improving the reporting process.",
  "One thing I'm proud of is how I handled a tight deadline last year.",
  "I'd describe my working style as organised and collaborative.",
  "That's a good question. Let me think for a moment.",
  "Could you please clarify what you mean by that?",
  "I'm currently working on improving my public speaking.",
  "I believe my skills are a strong match for this role.",
  "What would success look like in the first six months?",
  "I took ownership of the problem and kept the team updated."
];
const PRON_SETS = {
  "V / W": ["I will work very well with the whole team.","We value your views on the new workflow.","Vivek went to Vizag with Vinay on Wednesday.","Our vision is to deliver world-class value."],
  "TH": ["I think this is the third thing they thought about.","Thank you for this opportunity, I'm thrilled.","They gathered three thousand thoughtful answers.","Both of them think the theory is worth it."],
  "Endings": ["She asked about the tasks and the tests.","He worked hard and finished the project last month.","I managed three products and their costs.","The clients wanted fast results."],
  "Interview lines": ["I'm a quick learner who adapts well to new environments.","In my previous role, I led a team of five people.","I'd like to understand more about the team's priorities.","My greatest strength is solving problems under pressure."]
};
const STRESS = [
  ["development","de-VEL-op-ment","DE-vel-op-ment"],["career","ca-REER","CA-reer"],["comfortable","COM-for-ta-ble","com-FOR-ta-ble"],
  ["determine","de-TER-mine","de-ter-MINE"],["analysis","a-NAL-y-sis","an-a-LY-sis"],["photography","pho-TOG-ra-phy","PHO-to-gra-phy"],
  ["develop","de-VEL-op","DE-ve-lop"],["executive","ex-EC-u-tive","EX-e-cu-tive"],["hotel","ho-TEL","HO-tel"],["company","COM-pa-ny","com-PA-ny"]
];
const TWISTERS = [
  "Very well, we will wait while the wind whistles.","Three thin thinkers thinking thick thoughts.","Red lorry, yellow lorry.",
  "She sells seashells by the seashore.","Unique New York, you need New York, you know you need unique New York."
];
const READS = {
  beginner:"Good morning. My name is Priya. I finished my degree last year. I like working with people and I learn new things quickly. I am looking for a job where I can grow.",
  intermediate:"In my last internship, I worked with a small team to improve customer support. I learned how to listen carefully, explain solutions clearly, and stay calm when customers were upset. I'm now looking for a role where I can use these skills every day.",
  advanced:"Over the past three years, I've led projects that required balancing tight deadlines with high quality standards. What I enjoy most is turning unclear problems into simple, practical plans, and then bringing people together to deliver them. I'm keen to bring that approach to a team that is growing quickly."
};
const TOPICS = ["A skill you learned recently","Your favourite place in your city","A goal you achieved and how","Why teamwork matters","Your typical day","A mistake that taught you something","A person who inspires you","What you would do with one free week"];
const QUESTIONS = [
  ["Tell me about yourself.","Present → past → future: what you do now, one or two achievements, and why this role. Aim for 60–90 seconds."],
  ["Why do you want to work here?","Mention something specific about the company, then connect it to your skills and goals."],
  ["What are your strengths?","Pick two strengths and prove each with a short real example."],
  ["What is your biggest weakness?","Choose a real but manageable weakness and say what you are doing to improve it."],
  ["Tell me about a challenge you faced and how you handled it.","Use STAR: Situation, Task, Action, Result. Spend most time on Action."],
  ["Describe a time you worked in a team.","Say your own role clearly. Use \"I\" for what you did, \"we\" for the team result."],
  ["Why should we hire you?","Summarise: skills they need + proof you have them + your attitude."],
  ["Where do you see yourself in five years?","Show ambition that fits the company: growing skills, taking more responsibility."],
  ["Tell me about a time you made a mistake.","Own it, explain how you fixed it, and what you changed afterwards."],
  ["Why are you leaving your current job?","Stay positive. Talk about growth you want, not problems with your current employer."],
  ["What are your salary expectations?","Give a researched range and show flexibility."],
  ["Do you have any questions for us?","Always ask one or two: about the team, success in the role, or next steps."]
];
const FILLERS = /\b(um+|uh+|erm|hmm+|like|basically|actually|you know|i mean|kind of|sort of)\b/gi;

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dayKey = (t=Date.now()) => { const d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const joinText = (a,b) => [a,b].map(s=>(s||"").trim()).filter(Boolean).join(" ");
const ICON_SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.append(t); setTimeout(()=>t.remove(),2800); }
function lsGet(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} }
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
function btn(text, cls, onclick){ const b=el("button","btn "+(cls||"")); b.type="button"; b.textContent=text; b.onclick=onclick; return b; }

/* ================= state ================= */
const state = {
  profile: Object.assign({level:"intermediate", role:"", weak:[], voice:"", recLang:"en-IN"}, lsGet("iec-profile",{})),
  log: lsGet("iec-log", []),
  pronMode:"sent", pasteText: lsGet("iec-paste",""), pasteActive:false,
  fixIdx:0, pronSet:"V / W", pronIdx:0, pronCustom:null, intMode:"single", qIdx:0
};
const L = () => LEVELS[state.profile.level] || LEVELS.intermediate;
function saveProfile(){ lsSet("iec-profile", state.profile); }
function addLog(entry){
  entry.t = Date.now();
  state.log.unshift(entry); state.log = state.log.slice(0,300);
  lsSet("iec-log", state.log);
  renderToday(); renderProgress();
}
const learner = () => `Learner: Indian English speaker, ${L().name} level, preparing for job interviews${state.profile.role?` for the role: ${state.profile.role}`:""}.`;

/* ================= voice out (browser speech) ================= */
let voices = [];
function loadVoices(){ try{ voices = speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)); }catch{ voices=[]; } renderVoiceSel(); }
if("speechSynthesis" in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(){
  if(state.profile.voice){ const v=voices.find(v=>v.voiceURI===state.profile.voice); if(v) return v; }
  return voices.find(v=>/en-GB/i.test(v.lang)) || voices.find(v=>/en-US/i.test(v.lang)) || voices.find(v=>/en-IN/i.test(v.lang)) || voices[0] || null;
}
function say(text, rate){
  if(!("speechSynthesis" in window)){ toast("Voice playback isn't available in this browser."); return; }
  rate = rate || L().rate;
  speechSynthesis.cancel();
  const v = pickVoice();
  // Long text is spoken sentence by sentence; some phones cut long utterances short.
  sentences(text).forEach(s=>{ const u=new SpeechSynthesisUtterance(s); u.rate=rate; if(v){u.voice=v;u.lang=v.lang;} else u.lang="en-US"; speechSynthesis.speak(u); });
}
// Speaks and resolves when the voice has finished (used by shadowing to start recording after it).
function sayAsync(text, rate){
  return new Promise(res=>{
    if(!("speechSynthesis" in window)){ res(); return; }
    speechSynthesis.cancel();
    const v=pickVoice(), parts=sentences(text); let left=parts.length;
    const timer=setTimeout(res, 4000+text.length*120);
    parts.forEach(s=>{ const u=new SpeechSynthesisUtterance(s); u.rate=rate||L().rate; if(v){u.voice=v;u.lang=v.lang;} else u.lang="en-US";
      u.onend=u.onerror=()=>{ if(--left<=0){ clearTimeout(timer); res(); } }; speechSynthesis.speak(u); });
  });
}
function spkBtn(text, label, rate){
  const b=el("button","spk",ICON_SPK+esc(label||"Listen")); b.type="button";
  b.onclick=()=>say(typeof text==="function"?text():text, typeof rate==="function"?rate():rate);
  return b;
}

/* ================= voice in (Chrome speech recognition) ================= */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
// Phones end a recognition session after every short pause. The engine restarts it at once
// and keeps the words, so a long answer is captured as one piece. Events from an old session
// are ignored, so a finished session can never stop a new one.
const isAndroid = /Android/i.test(navigator.userAgent);
const Speech = {
  rec:null, want:false, committed:"", h:null, lastErr:null, fails:0, wake:null,
  start(h){
    const oldH=this.h, wasLive=!!this.rec;
    this.want=false; if(this.rec){ try{ this.rec.abort(); }catch{} } this.rec=null;
    if(wasLive && oldH && oldH!==h) oldH.state("idle");
    this.h=h; this.want=true; this.committed=""; this.lastErr=null; this.fails=0;
    this._wake(true); this._run();
  },
  async _wake(on){
    try{
      if(on && "wakeLock" in navigator && !this.wake){ this.wake=await navigator.wakeLock.request("screen"); this.wake.addEventListener("release",()=>{ this.wake=null; }); }
      if(!on && this.wake){ const w=this.wake; this.wake=null; await w.release(); }
    }catch{}
  },
  _run(){
    const r=new SR(), h=this.h; this.rec=r;
    r.lang=state.profile.recLang||"en-IN"; r.continuous=!isAndroid; r.interimResults=true; r.maxAlternatives=1;
    let sessionFinal="";
    const live=()=>this.rec===r;
    r.onstart=()=>{ if(live()){ this.fails=0; h.state("listening"); } };
    r.onresult=e=>{
      if(!live()) return;
      const fins=[]; let interim="";
      for(let i=0;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) fins.push(t); else interim+=t; }
      // Some Android versions repeat earlier text inside later results; keep the longest version.
      const ded=[]; fins.forEach(f=>{ const p=ded[ded.length-1]; if(p!==undefined && f.trim().toLowerCase().startsWith(p.trim().toLowerCase())) ded[ded.length-1]=f; else ded.push(f); });
      sessionFinal=ded.map(s=>s.trim()).filter(Boolean).join(" ");
      h.text(joinText(this.committed, sessionFinal), interim.trim());
    };
    r.onerror=e=>{ if(live()) this.lastErr=e.error; };
    const ended=()=>{
      if(!live()) return;
      this.committed=joinText(this.committed, sessionFinal); sessionFinal="";
      const err=this.lastErr; this.lastErr=null;
      const fatal=["not-allowed","service-not-allowed","network","audio-capture","language-not-supported"].includes(err);
      if(this.want && !fatal && this.fails<6){ this.fails++; setTimeout(()=>{ if(this.want && this.rec===r) this._run(); },150); return; }
      this.want=false; this.rec=null; this._wake(false);
      h.state("idle", err);
    };
    r.onend=ended;
    try{ r.start(); }catch{ setTimeout(ended,0); }
  },
  stop(){ this.want=false; const r=this.rec; if(r){ try{ r.stop(); }catch{} } }
};
document.addEventListener("visibilitychange",()=>{ if(document.hidden && Speech.rec) Speech.stop(); });

/* ================= mic mode: Online / Offline / Auto ================= */
let offlineActive = null; // the offline recording in progress, so leaving a screen can stop it
function netQuality(){
  if(!navigator.onLine) return "none";
  const c=navigator.connection;
  if(c){
    if(c.saveData) return "slow";
    if(["slow-2g","2g"].includes(c.effectiveType)) return "slow";
    if(c.downlink && c.downlink<0.7) return "slow";
    if(c.rtt && c.rtt>900) return "slow";
  }
  return "good";
}
const micMode = () => state.profile.micMode || "auto";
function engineNow(){
  const m=micMode();
  if(m==="offline") return "offline";
  if(m==="online") return SR ? "online" : "offline";
  return (netQuality()==="none" || !SR) ? "offline" : "online";
}
let tipDismissed=false;
function renderModebar(){
  const m=micMode(), q=netQuality(), eng=engineNow(), ready=STT.isReady();
  document.querySelectorAll(".seg button").forEach(b=>b.setAttribute("aria-checked", b.dataset.mode===m));
  const dot={good:"var(--good)",slow:"var(--amber)",none:"var(--bad)"}[q];
  const net={good:"Good internet",slow:"Slow internet",none:"No internet"}[q];
  const using = eng==="offline" ? (ready?"using Offline mic":"Offline mic not downloaded") : "using Online mic";
  $("#netStat").innerHTML=`<span class="dot" style="background:${dot}"></span>${net} · ${using}`;
  const tip=$("#netTip"); tip.hidden=true; tip.innerHTML="";
  const show=(text, btnText, onClick)=>{ tip.hidden=false; tip.append(el("span","",esc(text))); if(btnText) tip.append(btn(btnText,"primary",onClick)); tip.append(btn("Dismiss","ghost",()=>{ tipDismissed=true; tip.hidden=true; })); };
  if(tipDismissed) return;
  if(eng==="offline" && !ready) show("The offline mic needs a one-time download (about 65 MB). Use Wi-Fi.","Download",()=>openDownload());
  else if(m==="auto" && q==="slow") show("Your internet is slow, so the Online mic may cut out. Switch to Offline?", ready?"Use Offline":"Download Offline", ()=>{ if(ready){ setMode("offline"); } else openDownload(()=>setMode("offline")); });
  else if(m==="online" && q==="none") show("No internet, so the Online mic won't work. Switch to Offline?", ready?"Use Offline":"Download Offline", ()=>{ if(ready){ setMode("offline"); } else openDownload(()=>setMode("offline")); });
}
function setMode(m){ state.profile.micMode=m; saveProfile(); tipDismissed=false; renderModebar(); toast({auto:"Auto: Online when the internet is good, Offline when there's none.",online:"Online mic: words appear live. Needs internet.",offline:"Offline mic: works without internet."}[m]); }
document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{
  const m=b.dataset.mode;
  if(m==="offline" && !STT.isReady()){ openDownload(()=>setMode("offline")); return; }
  setMode(m);
});
window.addEventListener("online",()=>{ tipDismissed=false; renderModebar(); });
window.addEventListener("offline",()=>{ tipDismissed=false; renderModebar(); });
if(navigator.connection) navigator.connection.addEventListener("change",renderModebar);

// One-time download of the offline speech model, with a progress bar.
function openDownload(after){
  const dlg=$("#modal"), box=$("#modalIn");
  if(!STT.supported()){ toast("The offline mic isn't supported in this browser. Use Chrome."); return; }
  const m=STT.chosenModel(), info=STT.MODELS[m];
  box.innerHTML=`<div class="row between"><h3>Download offline mic</h3><span class="tag free">Free</span></div>
    <p class="small">This downloads a speech model (<b>${info.label}</b>) plus the engine that runs it, about <b>${info.mb+24} MB</b> in total, once. After that the mic works with no internet. Use Wi-Fi if you can.</p>
    <div class="prog"><div id="dlBar"></div></div><p class="small muted" id="dlTxt">Not started</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="dlClose">Not now</button><button class="btn primary" type="button" id="dlGo">Download</button></div>`;
  const go=box.querySelector("#dlGo"), txt=box.querySelector("#dlTxt"), bar=box.querySelector("#dlBar"), close=box.querySelector("#dlClose");
  close.onclick=()=>dlg.close();
  go.onclick=async()=>{
    if(!navigator.onLine){ txt.textContent="You're offline. Connect to the internet to download."; return; }
    go.disabled=true; close.textContent="Hide"; txt.textContent="Downloading…";
    try{
      await STT.download(m,p=>{ bar.style.width=p+"%"; txt.textContent=`Downloading… ${p}%`; });
      bar.style.width="100%"; txt.textContent="Done. The offline mic is ready.";
      go.hidden=true; close.textContent="Close"; renderModebar(); renderSettings();
      if(after) after();
    }catch(err){ txt.textContent="Download failed: "+(err.message||"try again")+". Check your internet and try again."; go.disabled=false; }
  };
  dlg.showModal();
}
let activeRec = null;

function analyse(text, secs){
  const n = wordsOf(text).length;
  const wpm = secs>0.8 && n>1 ? Math.round(n/(secs/60)) : 0;
  const fillers = (String(text).match(FILLERS)||[]).length;
  return {n, wpm, fillers, secs:Math.round(secs)};
}
function paceVerdict(wpm){
  const {lo,hi}=L();
  if(!wpm) return ["No pace yet","v-warn"];
  if(wpm<lo-15) return ["Too slow","v-bad"];
  if(wpm<lo) return ["A little slow","v-warn"];
  if(wpm<=hi) return ["Ideal pace","v-good"];
  if(wpm<=hi+15) return ["A little fast","v-warn"];
  return ["Too fast","v-bad"];
}
function paceMeter(wpm){
  const min=60,max=200,{lo,hi}=L();
  const pct=v=>Math.max(0,Math.min(100,(v-min)/(max-min)*100));
  const [label,cls]=paceVerdict(wpm);
  return `<div class="stack" style="gap:4px">
    <div class="row between"><span class="small"><b class="mono">${wpm||"–"}</b> words per minute</span><span class="verdict ${cls}">${label}</span></div>
    <div class="pace" role="img" aria-label="Your pace ${wpm} words per minute; ideal ${lo} to ${hi}">
      <div class="band" style="left:${pct(lo)}%;width:${pct(hi)-pct(lo)}%"></div>
      ${wpm?`<div class="mark" style="left:${pct(wpm)}%"></div>`:""}
    </div>
    <div class="pace-scale"><span>60</span><span>100</span><span>140</span><span>200</span></div>
    <p class="small muted">Ideal for your level: ${lo}–${hi} wpm. ${wpm&&wpm>hi?"Pause after each idea and breathe.":wpm&&wpm<lo?"Join words in groups; don't stop after every word.":""}</p>
  </div>`;
}

function makeRecorder(host, {onDone, prompt="Tap the mic and speak", longForm=false}){
  const wrap=el("div","rec");
  const useMic = !!SR || (STT.supported() && STT.isReady());
  wrap.innerHTML = `
    <div class="row" style="gap:14px;flex-wrap:nowrap">
      <button class="mic" type="button" aria-label="Start speaking">${ICON_MIC}</button>
      <div style="min-width:0;flex:1"><div class="timer">0:00</div>
        <div class="small muted st">${useMic?prompt:"Voice checking needs Chrome. Tap the mic to start the timer, then speak with your keyboard's mic button (or type)."}</div></div>
    </div>
    ${useMic?`<div class="live-text" aria-live="polite"><span class="fin"></span><span class="partial"></span></div>`:""}
    <textarea class="ans" ${useMic?"hidden":""} placeholder="Your words appear here" style="min-height:${longForm?120:70}px"></textarea>
    <div class="row"><button class="btn primary done" type="button" disabled>Check</button><button class="btn ghost redo" type="button" hidden>Try again</button></div>`;
  host.append(wrap);
  const mic=wrap.querySelector(".mic"), timer=wrap.querySelector(".timer"), st=wrap.querySelector(".st"),
        ta=wrap.querySelector(".ans"), fin=wrap.querySelector(".fin"), part=wrap.querySelector(".partial"),
        done=wrap.querySelector(".done"), redo=wrap.querySelector(".redo");
  let t0=0, elapsed=0, tick=null, live=false, idleWait=null;
  // Speaking time runs from the first word heard to the last word heard,
  // so the pause before you start and the wait after you tap stop are not counted.
  let sFirst=0, sLast=0, spoken=0, hearing=false, pauses=0;
  const mark=()=>{ if(!hearing) return; const n=performance.now(); if(!sFirst) sFirst=n; if(sLast && n-sLast>2800) pauses++; sLast=n; };
  const closeSpan=()=>{ if(sFirst){ spoken+=(sLast-sFirst)/1000+0.6; sFirst=0; sLast=0; } };
  const fmt=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
  function startClock(){ if(t0) return; t0=performance.now(); clearInterval(tick); tick=setInterval(()=>{ timer.textContent=fmt((elapsed+performance.now()-t0)/1000); },250); }
  function stopClock(){ if(t0){ elapsed+=performance.now()-t0; t0=0; } clearInterval(tick); timer.textContent=fmt(elapsed/1000); }
  function setLive(on){ live=on; mic.classList.toggle("live",on); mic.innerHTML=on?ICON_STOP:ICON_MIC; mic.setAttribute("aria-label",on?"Stop":"Start speaking"); }
  const typing = () => { ta.hidden=false; };
  const api = {
    text(full, interim){ mark(); fin.textContent=full; part.textContent=interim?(" "+interim):""; ta.value=full; done.disabled=!full.trim(); },
    state(s, err){
      if(s==="listening"){ hearing=true; setLive(true); startClock(); st.textContent="Listening… keep talking. Tap stop when you finish."; }
      if(s==="idle"){
        hearing=false; closeSpan(); setLive(false); stopClock(); if(activeRec===api) activeRec=null;
        if(err==="not-allowed"||err==="service-not-allowed"){ st.textContent="Microphone blocked. Allow it in Chrome's site settings, or type instead."; typing(); }
        else if(err==="network"){ st.textContent="Voice checking needs internet. Connect and try again, or type instead."; typing(); }
        else if(err==="audio-capture"){ st.textContent="No microphone found. Type instead."; typing(); }
        else if(!ta.value.trim() && err==="no-speech"){ st.textContent="Didn't hear anything. Hold the phone closer and tap the mic again."; }
        else st.textContent = ta.value.trim() ? "Done. Tap Check, or tap the mic to add more." : prompt;
        if(idleWait){ idleWait(); idleWait=null; }
      }
    }
  };
  // ---- offline path: record, then turn the recording into words on the phone ----
  let offRec=null, offBusy=false, myUrl=null, playBtn=null;
  async function startOffline(){
    if(activeRec && activeRec!==api) Speech.stop();
    if(offlineActive) offlineActive.cancel();
    try{ offRec=await STT.startCapture(); }
    catch{ st.textContent="Microphone blocked. Allow it in Chrome's site settings, or type instead."; typing(); return; }
    const r=offRec; offlineActive={cancel:()=>{ r.cancel(); offRec=null; offlineActive=null; setLive(false); stopClock(); Speech._wake(false); }};
    Speech._wake(true);
    setLive(true); startClock();
    fin.textContent=ta.value; part.textContent=" (your words appear after you stop)";
    st.textContent="Recording offline… tap stop when you finish.";
  }
  async function stopOffline(){
    if(!offRec || offBusy) return;
    offBusy=true; const r=offRec; offRec=null; offlineActive=null;
    setLive(false); stopClock(); mic.disabled=true; done.disabled=true;
    st.textContent="Turning your speech into words on this phone… (about 10–30 seconds)";
    try{
      const {samples:audio, blob}=await r.stop();
      // Keep the recording so you can play it back.
      if(myUrl) URL.revokeObjectURL(myUrl); myUrl=URL.createObjectURL(blob);
      if(!playBtn){ playBtn=btn("▶ Play my recording","",()=>{ try{ new Audio(myUrl).play(); }catch{} }); done.parentNode.append(playBtn); }
      const t=STT.speechTiming(audio);
      if(!t.speech){ st.textContent="Didn't hear anything. Hold the phone closer and tap the mic again."; part.textContent=""; }
      else{
        const words=await STT.transcribe(audio);
        const full=joinText(ta.value, words); ta.value=full; fin.textContent=full; part.textContent="";
        spoken+=t.secs; pauses+=t.pauses;
        st.textContent = words ? "Done. Tap Check, or tap the mic to add more." : "Couldn't make out the words. Try again a little louder.";
      }
    }catch(err){ st.textContent="The offline mic had a problem ("+(err.message||"unknown")+"). Try again."; part.textContent=""; }
    Speech._wake(false); mic.disabled=false; done.disabled=!ta.value.trim(); offBusy=false;
  }
  function pickEngine(){
    let e=engineNow();
    if(e==="offline"){
      if(!STT.supported()){ st.textContent="The offline mic isn't supported in this browser."; return (SR && navigator.onLine) ? "online" : null; }
      if(!STT.isReady()){ st.textContent="The offline mic isn't downloaded yet."; openDownload(); return null; }
      return "offline";
    }
    if(!navigator.onLine){ st.textContent="No internet. Choose Offline at the top of the screen."; return null; }
    return "online";
  }

  mic.onclick = () => {
    if(offBusy) return;
    if(offRec){ stopOffline(); return; }
    if(useMic && ta.hidden){
      if(live){ hearing=false; Speech.stop(); st.textContent="Finishing…"; return; }
      const eng=pickEngine();
      if(!eng) return;
      if(eng==="offline"){ startOffline(); return; }
      if(activeRec && activeRec!==api) Speech.stop();
      activeRec=api; st.textContent="Starting…";
      Speech.start(api);
    } else {
      if(live){ setLive(false); stopClock(); st.textContent="Timer stopped. Tap Check."; }
      else { setLive(true); startClock(); st.textContent="Timer running. Speak now, then tap stop."; ta.hidden=false; ta.focus(); }
    }
  };
  ta.addEventListener("input",()=>{ done.disabled=!ta.value.trim(); });
  done.onclick = async () => {
    if(offRec) await stopOffline();
    if(offBusy) return;
    if(live){
      if(useMic && ta.hidden){ hearing=false; await new Promise(res=>{ idleWait=res; Speech.stop(); setTimeout(res,1500); }); }
      else { setLive(false); stopClock(); }
    }
    hearing=false; closeSpan();
    const text = ta.value.trim() || (fin? fin.textContent.trim() : "");
    if(!text) return;
    redo.hidden=false;
    const secs = (useMic && ta.hidden && spoken>0) ? spoken : elapsed/1000;
    try{ const an=analyse(text,secs); Coach.recordHabit(text, an.secs, an.wpm); }catch{}
    onDone(text, secs, {pauses});
  };
  redo.onclick = () => { if(offRec){ offRec.cancel(); offRec=null; offlineActive=null; setLive(false); stopClock(); } elapsed=0; spoken=0; sFirst=0; sLast=0; pauses=0; timer.textContent="0:00"; ta.value=""; if(fin){fin.textContent=""; part.textContent="";} done.disabled=true; redo.hidden=true; st.textContent=useMic?prompt:"Tap the mic to start the timer."; onDone(null); };
  return wrap;
}

/* ================= word matching ================= */
function alignWords(target, spoken){
  const toks = target.split(/\s+/).filter(t=>norm(t));
  const a = toks.map(norm), b = wordsOf(spoken);
  const dp = Array.from({length:a.length+1},()=>new Array(b.length+1).fill(0));
  for(let i=a.length-1;i>=0;i--) for(let j=b.length-1;j>=0;j--)
    dp[i][j] = near(a[i],b[j])===2 ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  const ok = new Array(a.length).fill(false); let i=0,j=0;
  while(i<a.length&&j<b.length){ if(near(a[i],b[j])===2){ok[i]=true;i++;j++;} else if(dp[i+1][j]>=dp[i][j+1]) i++; else j++; }
  return toks.map((t,k)=>({t, w:a[k], ok:ok[k]}));
}
const SMALL = new Set("a an the of to and in is it for on at as by or be are was am i so that this with my me we our".split(" "));
function alignLoose(target, spoken){
  const toks=target.split(/\s+/).filter(t=>norm(t)), a=toks.map(norm), b=wordsOf(spoken);
  const A=a.length,B=b.length, dp=Array.from({length:A+1},()=>new Float32Array(B+1));
  for(let i=A-1;i>=0;i--) for(let j=B-1;j>=0;j--){ const s=near(a[i],b[j]); dp[i][j]=Math.max(dp[i+1][j],dp[i][j+1], s?dp[i+1][j+1]+s:0); }
  const m=new Array(A).fill(0); let i=0,j=0;
  while(i<A&&j<B){ const s=near(a[i],b[j]); if(s && dp[i][j]===dp[i+1][j+1]+s){ m[i]=s; i++; j++; } else if(dp[i+1][j]>=dp[i][j+1]) i++; else j++; }
  return toks.map((t,k)=>({t, w:a[k], m:m[k], small:SMALL.has(a[k])}));
}
function readScores(al, a){
  let pts=0; al.forEach(x=>{ pts += x.m===2?1 : x.m===1?0.85 : x.small?0.7 : 0; });
  const clarity=Math.round(pts/Math.max(1,al.length)*100);
  const {lo,hi}=L(); const off = !a.wpm?40 : a.wpm<lo?lo-a.wpm : a.wpm>hi?a.wpm-hi : 0;
  const pace = !a.wpm?50 : Math.max(40, 100-off*2);
  const minutes=Math.max(0.5,a.secs/60), fluency=Math.max(0, Math.round(100 - (a.fillers/minutes)*10));
  return {clarity,pace,fluency,overall:Math.round(clarity*0.6+pace*0.25+fluency*0.15)};
}

/* ================= AI panel (free + paid) ================= */
function aiPanel(host, {label, freePrompt, paidTitle, paid, paidChars}){
  const box=el("div","ai-box");
  box.innerHTML=`<b class="small">${esc(label)}</b><div class="row btns"></div><div class="out stack" style="gap:10px"></div>`;
  const btns=box.querySelector(".btns"), out=box.querySelector(".out");
  const f=btn("Free · in Claude ↗","primary",()=>{ AI.openFree(freePrompt()); toast("Opening Claude. The message is also copied."); });
  btns.append(f);
  if(AI.hasKey() && paid){
    const est=AI.rupees(AI.estimateINR(paidChars ? paidChars() : 3000));
    btns.append(btn(`Paid · in app ≈ ${est}`,"paid",()=>paid(out)));
  } else if(paid){
    btns.append(el("span","small muted",`Paid in-app option: <a href="#settings">set up</a>`));
  }
  host.append(box);
  return box;
}
async function paidJSON(out, title, system, user, render){
  out.innerHTML=`<p class="small muted">Thinking… (10–40 seconds)</p>`;
  try{
    const {text,cost}=await AI.runPaid({title, system, messages:[{role:"user",content:user}]});
    const r=AI.parseJSON(text);
    out.innerHTML=""; render(r, out);
    out.insertAdjacentHTML("beforeend",`<p class="small muted">This used about ${AI.rupees(cost)} of your API credit.</p>`);
  }catch(e){
    out.innerHTML = e.code==="cancelled" ? "" : `<p class="small" style="color:var(--bad)">${esc(e.message||"Something went wrong.")}</p>`;
  }
}
const COACH = "You are a kind, expert English interview and pronunciation coach for Indian English speakers. Be honest, specific and encouraging.";

/* ================= TODAY ================= */
function streak(){
  const days=new Set(state.log.map(l=>dayKey(l.t)));
  let n=0, d=new Date(); if(!days.has(dayKey(d))) d.setDate(d.getDate()-1);
  while(days.has(dayKey(d))){ n++; d.setDate(d.getDate()-1); }
  return n;
}
function renderToday(){
  $("#todayDate").textContent = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  const lv=L();
  $("#lvlPill").textContent = lv.name;
  $("#paceNote").textContent = `Ideal pace ${lv.lo}–${lv.hi} wpm`;
  $("#lvlChips").innerHTML = Object.entries(LEVELS).map(([k,v])=>`<button class="chip" type="button" data-l="${k}" aria-pressed="${k===state.profile.level}">${v.name}</button>`).join("");
  $("#lvlChips").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ state.profile.level=b.dataset.l; saveProfile(); renderAll(); });
  if(document.activeElement!==$("#roleIn")) $("#roleIn").value=state.profile.role||"";
  const today=state.log.filter(l=>dayKey(l.t)===dayKey());
  const pronN=today.filter(l=>l.kind==="pron"||l.kind==="read").length;
  const items=[
    ["Warm-up routine", today.some(l=>l.kind==="warmup"), "warm", "Breathing, twisters, read-aloud"],
    ["Pronunciation: 3 tries", pronN>=3, "pron", `${Math.min(3,pronN)} of 3 done`],
    ["Answer 1 interview question", today.some(l=>l.kind==="answer"||l.kind==="mock"), "int", "Record an answer and check your pace"]
  ];
  const tm=Coach.todayMission(), due=Coach.dueCount();
  if(tm) items.push([`Day ${tm.day} mission: ${tm.title}`, tm.done, "coach:plan", "30-day plan"]);
  else items.push(["Start the 30-day interview plan", false, "coach:plan", "One small mission a day"]);
  if(due) items.push([`Practise ${due} saved mistake${due>1?"s":""}`, false, "coach:mistakes", "Coach → My mistakes"]);
  $("#plan").innerHTML=items.map(([t,on,v,sub])=>`<div class="check ${on?"on":""}"><span class="box" aria-hidden="true">${on?"✓":""}</span><div style="flex:1;min-width:0"><div style="font-weight:600">${t}</div><div class="small muted">${sub}</div></div><button class="btn ghost" type="button" data-go="${v}">${on?"Again":"Start"}</button></div>`).join("");
  $("#plan").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ const [v,sub]=b.dataset.go.split(":"); goTo(v,sub); });
  $("#streakTxt").textContent=`${streak()}-day streak`;
  const dayN=Math.floor(Date.now()/864e5);
  const f=FIXES[(dayN+state.fixIdx)%FIXES.length];
  $("#fixDay").innerHTML=`<div class="fix"><span class="x">${esc(f[0])}</span><span class="y">${esc(f[1])}</span><span class="small muted">${esc(f[2])}</span></div>`;
  const ph=PHRASES[dayN%PHRASES.length];
  $("#phraseDay").textContent=ph;
  const ps=$("#phraseSpk"); ps.innerHTML=""; ps.append(spkBtn(ph,"Listen"), spkBtn(ph,"Slow",0.75));
}

/* ================= WARM-UP ================= */
function renderWarm(){
  const host=$("#warmList"); host.innerHTML="";
  const today=state.log.filter(l=>dayKey(l.t)===dayKey()&&l.kind==="warmup").map(l=>l.label);
  const step=(n,title,sub,label)=>{ const d=el("details","card");
    d.innerHTML=`<summary><div class="step ${today.includes(label)?"done":""}"><span class="n">${today.includes(label)?"✓":n}</span><div><h3>${title}</h3><p class="small muted">${sub}</p></div></div></summary><div class="body stack" style="gap:12px"></div>`;
    host.append(d); return d.querySelector(".body"); };
  const doneBtn=label=>btn("Mark as done","",()=>{ addLog({kind:"warmup",label}); toast("Nice. Marked as done."); renderWarm(); });

  let b=step(1,"Box breathing","Calm your nerves and support your voice · 1 min","breath");
  b.innerHTML=`<p class="small">Sit straight. Breathe through your nose into your stomach, not your chest. Follow the circle for 4 rounds.</p><div class="breath">Ready</div><div class="row"><button class="btn primary go" type="button">Start</button></div>`;
  b.append(doneBtn("breath"));
  b.querySelector(".go").onclick=e=>{
    const c=b.querySelector(".breath"), phases=[["Breathe in",1.35],["Hold",1.35],["Breathe out",1],["Hold",1]];
    let k=0, round=0; e.target.disabled=true;
    const next=()=>{ if(round>=4){ c.textContent="Well done"; c.style.transform="scale(1)"; e.target.disabled=false; return; }
      const [txt,sc]=phases[k]; let s=4; c.style.transform=`scale(${sc})`; c.textContent=`${txt} · ${s}`;
      const iv=setInterval(()=>{ s--; if(s>0) c.textContent=`${txt} · ${s}`; else { clearInterval(iv); k=(k+1)%4; if(k===0) round++; next(); } },1000); };
    next();
  };

  b=step(2,"Lip trills and humming","Relax your face, warm your voice · 1 min","hum");
  b.innerHTML=`<div class="list small">
    <div>• <b>Lip trill (20 s):</b> close your lips loosely and blow so they flutter, like a motorbike "brrr". Slide your voice low to high.</div>
    <div>• <b>Humming (20 s):</b> hum "mmmm" and feel your lips and nose vibrate. Then open it: "mmm-ah, mmm-ee, mmm-oh".</div>
    <div>• <b>Jaw and tongue (20 s):</b> say "ah-ee-oo" slowly 5 times with a wide mouth. Then stretch your tongue out and to each side.</div></div>
    <div class="row"><span class="timer">1:00</span><button class="btn primary go" type="button">Start 60-second timer</button></div>`;
  b.append(doneBtn("hum"));
  b.querySelector(".go").onclick=e=>{ let s=60; const t=b.querySelector(".timer"); e.target.disabled=true;
    const iv=setInterval(()=>{ s--; t.textContent="0:"+String(s).padStart(2,"0"); if(s<=0){ clearInterval(iv); t.textContent="Done"; e.target.disabled=false; } },1000); };

  b=step(3,"Tongue twisters","Train fast, clear mouth movements · 2 min","twister");
  let tw=Math.floor(Math.random()*TWISTERS.length);
  const twBox=el("div","stack"); twBox.style.gap="10px"; b.append(twBox);
  const drawTw=()=>{ twBox.innerHTML=`<p class="small muted">Say it slowly 3 times, then faster. Clear beats fast.</p><p class="say">${esc(TWISTERS[tw])}</p><div class="row sp"></div><div class="res"></div>`;
    const sp=twBox.querySelector(".sp"); sp.append(spkBtn(()=>TWISTERS[tw],"Slow",0.75), spkBtn(()=>TWISTERS[tw],"Normal",()=>L().rate), btn("Another","ghost",()=>{ tw=(tw+1)%TWISTERS.length; drawTw(); }));
    const res=twBox.querySelector(".res");
    makeRecorder(twBox,{onDone:text=>{ if(!text){res.innerHTML="";return;} const al=alignWords(TWISTERS[tw],text), sc=Math.round(al.filter(x=>x.ok).length/al.length*100);
      res.innerHTML=`<div class="words">${al.map(x=>`<span class="w ${x.ok?"ok":"miss"}">${esc(x.t)}</span>`).join(" ")}</div><p class="small"><b class="mono">${sc}%</b> clear</p>`; }});
  };
  drawTw(); b.append(doneBtn("twister"));

  b=step(4,"Read aloud at the ideal speed","Find your natural interview pace · 1 min","read");
  const rd=READS[state.profile.level];
  b.innerHTML=`<p class="small muted">Listen first and notice where the voice pauses. Then read it aloud. The app measures your speed.</p><p class="say">${esc(rd)}</p><div class="row sp"></div><div class="res"></div>`;
  b.querySelector(".sp").append(spkBtn(rd,"Ideal voice",()=>L().rate));
  const rdRes=b.querySelector(".res");
  makeRecorder(b,{prompt:"Tap the mic and read the paragraph",onDone:(text,secs)=>{ if(!text){rdRes.innerHTML="";return;}
    const a=analyse(text,secs), al=alignLoose(rd,text), s=readScores(al,a);
    rdRes.innerHTML=paceMeter(a.wpm)+`<p class="small" style="margin-top:6px"><b class="mono">${s.clarity}%</b> of words heard clearly</p>`;
    addLog({kind:"warmup",label:"read",wpm:a.wpm,score:s.clarity}); }});
  b.append(doneBtn("read"));

  b=step(5,"60-second talk","Speak without stopping. Fewer fillers. · 1 min","talk");
  let tp=Math.floor(Math.random()*TOPICS.length);
  b.innerHTML=`<p class="small muted">Talk about the topic for one minute without stopping. If you get stuck, say "Let me think" and continue. Avoid "basically", "actually", "like", "um".</p><div class="row between"><p class="say tp">${esc(TOPICS[tp])}</p><button class="btn ghost nt" type="button">New topic</button></div><div class="res"></div>`;
  b.querySelector(".nt").onclick=()=>{ tp=(tp+1)%TOPICS.length; b.querySelector(".tp").textContent=TOPICS[tp]; };
  const tkRes=b.querySelector(".res");
  makeRecorder(b,{longForm:true,onDone:(text,secs)=>{ if(!text){tkRes.innerHTML="";return;} const a=analyse(text,secs);
    tkRes.innerHTML=`<div class="stats"><div class="stat"><b>${a.secs}s</b><span>Spoke for</span></div><div class="stat"><b>${a.n}</b><span>Words</span></div><div class="stat"><b>${a.fillers}</b><span>Fillers</span></div></div>`+paceMeter(a.wpm);
    addLog({kind:"warmup",label:"talk",wpm:a.wpm,fillers:a.fillers}); }});
  b.append(doneBtn("talk"));
}

/* ================= PRONOUNCE: sentences ================= */
function pronList(){ return state.pronCustom || PRON_SETS[state.pronSet]; }
function practiseLines(lines){ state.pronCustom=lines.filter(Boolean); state.pronIdx=0; state.pronMode="sent"; go("pron"); }
function renderPron(){
  $("#pronModes").innerHTML=[["sent","Practice sentences"],["paste","Paste and read"]].map(([k,t])=>`<button class="chip" role="tab" type="button" data-pm="${k}" aria-pressed="${state.pronMode===k}" aria-selected="${state.pronMode===k}">${t}</button>`).join("");
  $("#pronModes").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ state.pronMode=b.dataset.pm; renderPron(); });
  $("#pronSentMode").hidden = state.pronMode!=="sent";
  $("#pronPasteMode").hidden = state.pronMode!=="paste";
  if(state.pronMode==="paste"){ renderPaste(); return; }

  const sets=[...Object.keys(PRON_SETS), ...(state.pronCustom?["Mine"]:[])];
  $("#pronSets").innerHTML=sets.map(s=>`<button class="chip" type="button" data-s="${esc(s)}" aria-pressed="${(state.pronCustom?"Mine":state.pronSet)===s}">${esc(s)}</button>`).join("");
  $("#pronSets").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ if(b.dataset.s!=="Mine"){ state.pronSet=b.dataset.s; state.pronCustom=null; } state.pronIdx=0; renderPron(); });
  const list=pronList(); state.pronIdx=(state.pronIdx+list.length)%list.length;
  const sent=list[state.pronIdx], card=$("#pronCard");
  card.innerHTML=`<span class="eyebrow">${esc(state.pronCustom?"Your sentences":state.pronSet)} · ${state.pronIdx+1} of ${list.length}</span><p class="say">${esc(sent)}</p><div class="row sp"></div><div class="res stack" style="gap:10px"></div>`;
  card.querySelector(".sp").append(spkBtn(sent,"Ideal voice",()=>L().rate), spkBtn(sent,"Slow",0.7));
  const res=card.querySelector(".res");
  makeRecorder(card,{prompt:"Tap the mic and say the sentence",onDone:(text,secs)=>{
    if(!text){res.innerHTML="";return;}
    const al=alignWords(sent,text), sc=Math.round(al.filter(x=>x.ok).length/al.length*100), a=analyse(text,secs);
    const miss=al.filter(x=>!x.ok).map(x=>x.w);
    res.innerHTML=`<div class="words">${al.map(x=>x.ok?`<span class="w ok">${esc(x.t)}</span>`:`<button type="button" class="w miss" data-w="${esc(x.w)}">${esc(x.t)}</button>`).join(" ")}</div>
      <p class="small">We heard: <i>${esc(text)}</i></p>
      <div class="row"><span class="verdict ${sc>=90?"v-good":sc>=70?"v-warn":"v-bad"}">${sc}% clear</span>${a.wpm?`<span class="verdict ${paceVerdict(a.wpm)[1]}">${a.wpm} wpm · ${paceVerdict(a.wpm)[0]}</span>`:""}</div>
      ${miss.length?"":`<p class="small" style="color:var(--good);font-weight:600">Every word came through clearly.</p>`}`;
    res.querySelectorAll(".miss").forEach(m=>m.onclick=()=>say(m.dataset.w,0.7));
    if(miss.length){
      const core=`${learner()}\nThe learner tried to say: "${sent}"\nSpeech recognition heard: "${text}"\nThese words were not recognised: ${miss.join(", ")}.`;
      aiPanel(res,{label:`How do I say ${miss.length>1?"these words":"this word"}?`,
        freePrompt:()=>`${COACH}\n${core}\nFor each word, give: a simple respelling with the STRESSED syllable in capitals, and a short tip on mouth and tongue position and the common mistake Indian speakers make. Keep it short.`,
        paidChars:()=>core.length, paidTitle:"Pronunciation tips",
        paid:out=>paidJSON(out,"Pronunciation tips",COACH,`${core}\nReply with only a JSON array of {"word": string, "sounds_like": string (respelling, STRESSED syllable in capitals), "tip": string (max 25 words)}.`,
          r=>{ out.innerHTML=`<div class="list">${(Array.isArray(r)?r:[]).map(t=>`<div class="fix"><div class="row between"><b>${esc(t.word)}</b><span class="mono small">${esc(t.sounds_like)}</span></div><span class="small">${esc(t.tip)}</span></div>`).join("")}</div>`; })});
    }
    const weak=new Set(state.profile.weak||[]); miss.forEach(w=>weak.add(w)); state.profile.weak=[...weak].slice(-40); saveProfile();
    miss.filter(w=>w.length>=3).slice(0,5).forEach(w=>Coach.addMistake({kind:"word", right:w, src:"Pronunciation practice"}));
    addLog({kind:"pron",label:sent.slice(0,60),score:sc,wpm:a.wpm});
  }});
  $("#stressList").innerHTML=STRESS.map(([w,good,bad])=>`<div class="row between" style="flex-wrap:nowrap"><div style="min-width:0"><b>${w}</b><div class="small"><span class="mono" style="color:var(--good)">${good}</span> · <span class="mono" style="color:var(--bad);text-decoration:line-through">${bad}</span></div></div><span data-w="${w}"></span></div>`).join("");
  $("#stressList").querySelectorAll("[data-w]").forEach(s=>s.append(spkBtn(s.dataset.w,"Hear",0.75)));
  const g=$("#genAi"); g.innerHTML="";
  const focus=state.pronCustom?"mixed difficult sounds":state.pronSet;
  const genCore=`${learner()}\nWrite 6 new practice sentences for pronunciation focus "${focus}" (sounds that are difficult for Indian English speakers), useful in job interviews, ${L().name} level, 8–16 words each.`;
  aiPanel(g,{label:"Need new sentences?",
    freePrompt:()=>`${genCore}\nList them one per line with no numbering, so I can copy them into my practice app.`,
    paidChars:()=>genCore.length,
    paid:out=>paidJSON(out,"New practice sentences",COACH,`${genCore}\nReply with only a JSON array of 6 strings.`,
      r=>{ if(Array.isArray(r)&&r.length) practiseLines(r.map(String).slice(0,8)); })});
}

/* ================= PRONOUNCE: paste and read ================= */
function renderPaste(){
  const inp=$("#pasteIn"); if(document.activeElement!==inp && !inp.value) inp.value=state.pasteText||"";
  const card=$("#pasteCard");
  if(!state.pasteActive || !state.pasteText.trim()){ card.hidden=true; return; }
  card.hidden=false;
  const text=state.pasteText.trim(), n=wordsOf(text).length, mins=n/((L().lo+L().hi)/2);
  card.innerHTML=`<span class="eyebrow">${n} words · about ${mins<1?Math.max(10,Math.round(mins*60))+" sec":Math.round(mins*10)/10+" min"} at your ideal pace</span>
    <div class="readbox">${esc(text)}</div><div class="row sp"></div><div class="res stack" style="gap:12px"></div>`;
  card.querySelector(".sp").append(spkBtn(text,"Hear it at ideal speed",()=>L().rate));
  const box=card.querySelector(".readbox"), res=card.querySelector(".res");
  makeRecorder(card,{longForm:true,prompt:"Tap the mic and read the text in your own way",onDone:(spoken,secs)=>{
    if(!spoken){ box.textContent=text; res.innerHTML=""; return; }
    const al=alignLoose(text,spoken), a=analyse(spoken,secs), s=readScores(al,a);
    const grade=s.overall>=85?["Excellent","v-good"]:s.overall>=70?["Good","v-good"]:s.overall>=55?["Fair","v-warn"]:["Keep practising","v-bad"];
    box.innerHTML=al.map(x=>x.m===2?`<span class="w">${esc(x.t)}</span>`:x.m===1?`<span class="w near">${esc(x.t)}</span>`:x.small?`<span class="w skip">${esc(x.t)}</span>`:`<button type="button" class="w miss" data-w="${esc(x.w)}">${esc(x.t)}</button>`).join(" ");
    box.querySelectorAll(".miss").forEach(m=>m.onclick=()=>say(m.dataset.w,0.7));
    const missWords=[...new Set(al.filter(x=>!x.m&&!x.small).map(x=>x.w))];
    const nearWords=[...new Set(al.filter(x=>x.m===1).map(x=>x.w))];
    const runs=[]; let cur=[]; al.forEach(x=>{ if(!x.m) cur.push(x.t); else { if(cur.length>=3) runs.push(cur.join(" ")); cur=[]; } }); if(cur.length>=3) runs.push(cur.join(" "));
    res.innerHTML=`<div class="row" style="gap:16px;flex-wrap:nowrap"><div><div class="big-num">${s.overall}</div><div class="small muted">out of 100</div></div><div style="min-width:0"><span class="verdict ${grade[1]}">${grade[0]}</span><p class="small muted" style="margin-top:4px">Clear words 60% · Speed 25% · Fluency 15%</p></div></div>
      <div class="stats"><div class="stat"><b>${s.clarity}%</b><span>Clear words</span></div><div class="stat"><b>${a.wpm||"–"}</b><span>Words/min</span></div><div class="stat"><b>${a.fillers}</b><span>Fillers</span></div></div>
      ${paceMeter(a.wpm)}
      <h3>Where to improve</h3>
      <p class="small muted">In your text: <span class="w near">amber</span> = almost right, <span class="w miss" style="cursor:default">red</span> = not heard clearly (tap to hear), <span class="w skip">grey</span> = small word skipped (that's fine).</p>
      ${missWords.length?`<div><p class="small" style="font-weight:600">Words to work on</p><div class="row mw"></div></div>`:`<p class="small" style="color:var(--good);font-weight:600">Every important word came through.</p>`}
      ${nearWords.length?`<p class="small">Almost right: ${nearWords.slice(0,12).map(esc).join(", ")}</p>`:""}
      ${runs.length?`<p class="small">Skipped or unclear parts: ${runs.slice(0,4).map(r=>`“${esc(r)}”`).join(" · ")}</p>`:""}
      <p class="small muted">We heard: <i>${esc(spoken.slice(0,1200))}</i></p>`;
    const mw=res.querySelector(".mw"); if(mw) missWords.slice(0,16).forEach(w=>{ const c=el("button","chip"); c.type="button"; c.textContent=w; c.onclick=()=>say(w,0.7); mw.append(c); });
    const words=missWords.concat(nearWords).slice(0,15);
    const core=`${learner()}\nThe learner read this text aloud in their own way. Small changes are fine; judge overall clarity and fluency, not exact wording.\nText: """${text.slice(0,1500)}"""\nSpeech recognition heard: """${spoken.slice(0,1500)}"""\nMeasured: ${a.wpm} words per minute (ideal ${L().lo}–${L().hi}), ${a.fillers} filler words, clear-word score ${s.clarity}%. Words not recognised clearly: ${words.join(", ")||"none"}.`;
    aiPanel(res,{label:"Coach review",
      freePrompt:()=>`${COACH}\n${core}\nGive: a 2-sentence summary; pronunciation tips for up to 5 words (respelling with STRESSED syllable in capitals); up to 3 fluency tips (pace, pausing, linking, intonation); one exercise for tomorrow. Keep it short.`,
      paidChars:()=>core.length,
      paid:out=>paidJSON(out,"Coach review",COACH,`${core}\nReply with only JSON: {"summary": string, "pronunciation": [{"word": string, "sounds_like": string, "tip": string}] (up to 5), "fluency_tips": [string] (up to 3), "next_step": string}`,
        r=>{ out.innerHTML=`<p>${esc(r.summary)}</p>
          ${(r.pronunciation||[]).length?`<h3>Pronunciation</h3><div class="list">${r.pronunciation.map(t=>`<div class="fix"><div class="row between"><b>${esc(t.word)}</b><span class="mono small">${esc(t.sounds_like)}</span></div><span class="small">${esc(t.tip)}</span></div>`).join("")}</div>`:""}
          ${(r.fluency_tips||[]).length?`<h3>Fluency</h3><div class="list small">${r.fluency_tips.map(t=>`<div>• ${esc(t)}</div>`).join("")}</div>`:""}
          ${r.next_step?`<h3>Tomorrow</h3><p class="small">${esc(r.next_step)}</p>`:""}`; })});
    const weak=new Set(state.profile.weak||[]); missWords.slice(0,10).forEach(w=>weak.add(w)); state.profile.weak=[...weak].slice(-40); saveProfile();
    missWords.filter(w=>w.length>=4).slice(0,5).forEach(w=>Coach.addMistake({kind:"word", right:w, src:"Paste and read"}));
    addLog({kind:"read",label:text.slice(0,60),score:s.overall,wpm:a.wpm,fillers:a.fillers});
  }});
}

/* ================= INTERVIEW ================= */
const mock={turns:[], busy:false, autoSpeak:true, started:false};
function renderInt(){
  const modes=[["single","Question bank"],["pdf","From my PDF"],["mock","Mock interview"],["intro","Self-intro builder"]];
  $("#intModes").innerHTML=modes.map(([k,t])=>`<button class="chip" role="tab" type="button" data-m="${k}" aria-pressed="${state.intMode===k}" aria-selected="${state.intMode===k}">${t}</button>`).join("");
  $("#intModes").querySelectorAll(".chip").forEach(b=>b.onclick=()=>{ state.intMode=b.dataset.m; renderInt(); });
  const body=$("#intBody"); body.innerHTML="";
  ({single:renderSingle, pdf:renderPdf, mock:renderMock, intro:renderIntro})[state.intMode](body);
}
function renderSingle(body){
  const [q,tip]=QUESTIONS[state.qIdx];
  const card=el("div","card");
  card.innerHTML=`<div class="row between"><span class="eyebrow">Question ${state.qIdx+1} of ${QUESTIONS.length}</span><div class="row"><button class="btn ghost pv" type="button" aria-label="Previous question">←</button><button class="btn ghost nx" type="button" aria-label="Next question">→</button></div></div>
    <h2>${esc(q)}</h2><p class="small muted">Tip: ${esc(tip)}</p><div class="row sp"></div><div class="res stack" style="gap:12px"></div>`;
  body.append(card);
  card.querySelector(".pv").onclick=()=>{ state.qIdx=(state.qIdx-1+QUESTIONS.length)%QUESTIONS.length; renderInt(); };
  card.querySelector(".nx").onclick=()=>{ state.qIdx=(state.qIdx+1)%QUESTIONS.length; renderInt(); };
  card.querySelector(".sp").append(spkBtn(q,"Hear the question",()=>L().rate));
  const res=card.querySelector(".res");
  makeRecorder(card,{longForm:true,prompt:"Tap the mic and answer as if you're in the interview",onDone:(text,secs)=>{
    if(!text){res.innerHTML="";return;}
    const a=analyse(text,secs);
    res.innerHTML=`<div class="stats"><div class="stat"><b>${a.secs}s</b><span>Length</span></div><div class="stat"><b>${a.n}</b><span>Words</span></div><div class="stat"><b>${a.fillers}</b><span>Fillers</span></div></div>${paceMeter(a.wpm)}
      ${a.secs<30?`<p class="small">Tip: most answers should be 45–90 seconds. Add an example.</p>`:a.secs>120?`<p class="small">Tip: over 2 minutes is long. Keep to the main points.</p>`:""}`;
    addLog({kind:"answer",label:q,wpm:a.wpm,fillers:a.fillers});
    const core=`${learner()}\nInterview question: "${q}"\nMy spoken answer (speech-to-text, ignore punctuation): """${text.slice(0,1800)}"""\nMeasured: ${a.secs} seconds, ${a.wpm} words per minute (ideal ${L().lo}–${L().hi}), ${a.fillers} filler words.`;
    aiPanel(res,{label:"AI feedback on this answer",
      freePrompt:()=>`${COACH}\n${core}\nGive feedback: scores out of 10 (overall, fluency, grammar, content); up to 5 corrections as ❌ what I said → ✅ better version (short reason), including Indian-English patterns; 3 stronger professional words; one tip on structure (e.g. STAR); a stronger model answer of 80–130 words using my real details; up to 4 words from my answer to pronounce carefully with the stress in CAPITALS.`,
      paidChars:()=>core.length+600,
      paid:out=>paidJSON(out,"Interview feedback",COACH,`${core}\nReply with only JSON: {"overall": number, "fluency": number, "grammar": number, "content": number (all 1-10), "summary": string (2 sentences), "corrections": [{"said": string, "better": string, "why": string}] (up to 5), "vocabulary": [{"instead": string, "use": string}] (up to 3), "structure": string, "model_answer": string (80-130 words, using my real details), "pronunciation_watch": [string] (up to 4, stress in CAPITALS)}`,
        (r,out)=>renderFeedback(r,out))});
  }});
}
function renderFeedback(r,out){
  (r.corrections||[]).forEach(c=>Coach.addMistake({wrong:c.said, right:c.better, why:c.why, src:"AI interview feedback"}));
  const sc=(n,l)=>`<div class="stat"><b>${Number(n)||"–"}<small style="font-size:12px">/10</small></b><span>${l}</span></div>`;
  out.innerHTML=`<div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">${sc(r.overall,"Overall")}${sc(r.fluency,"Fluency")}${sc(r.grammar,"Grammar")}${sc(r.content,"Content")}</div>
    <p>${esc(r.summary)}</p>
    ${(r.corrections||[]).length?`<h3>Corrections</h3><div class="list">${r.corrections.map(c=>`<div class="fix"><span class="x">${esc(c.said)}</span><span class="y">${esc(c.better)}</span><span class="small muted">${esc(c.why)}</span></div>`).join("")}</div>`:""}
    ${(r.vocabulary||[]).length?`<h3>Stronger words</h3><div class="list small">${r.vocabulary.map(v=>`<div>Instead of <b>${esc(v.instead)}</b> → say <b style="color:var(--good)">${esc(v.use)}</b></div>`).join("")}</div>`:""}
    ${r.structure?`<h3>Structure</h3><p class="small">${esc(r.structure)}</p>`:""}
    ${(r.pronunciation_watch||[]).length?`<h3>Say these carefully</h3><div class="row">${r.pronunciation_watch.map(w=>`<span class="mono small" style="background:var(--sunk);padding:4px 8px;border-radius:6px">${esc(w)}</span>`).join("")}</div>`:""}
    <h3>A stronger answer</h3><p class="small">${esc(r.model_answer)}</p><div class="row mab"></div>`;
  const mab=out.querySelector(".mab");
  mab.append(spkBtn(r.model_answer||"","Hear it at ideal speed",()=>L().rate), btn("Practise saying it","ghost",()=>practiseLines(sentences(r.model_answer||""))));
}
function mockRules(){ return `You are a professional but friendly job interviewer AND English coach running a spoken mock interview.\n${learner()}\nRules:\n- Ask exactly ONE interview question at a time. Mix HR, behavioural (STAR) and role-specific questions suited to the role and level.\n- After each answer, reply in this format:\nFeedback: one short sentence of praise or advice. If there is a grammar or phrasing error, add one line "Say: <corrected version>".\nNext question: <your next question>\n- Use simple, clear English for ${L().name} level. Keep each reply under 70 words.\n- My answers come from speech-to-text, so ignore punctuation.\n- After my 6th answer, instead of a next question, give "Final report:" with 3 strengths, 3 things to improve, and an overall score out of 10.`; }
function renderMock(body){
  const card=el("div","card");
  card.innerHTML=`<div class="row between"><h3>Mock interview · 6 questions</h3><label class="small row" style="gap:6px"><input type="checkbox" id="autoSpk" style="width:auto" ${mock.autoSpeak?"checked":""}> Read questions aloud</label></div><div class="chat"></div><div class="ctrl stack" style="gap:10px"></div>`;
  body.append(card);
  card.querySelector("#autoSpk").onchange=e=>mock.autoSpeak=e.target.checked;
  const chat=card.querySelector(".chat"), ctrl=card.querySelector(".ctrl");
  chat.innerHTML=mock.turns.slice(1).map(t=>`<div class="bubble ${t.role==="assistant"?"ai":"me"}">${esc(t.content)}</div>`).join("");
  if(!mock.started){
    chat.innerHTML=`<p class="small muted">An AI interviewer asks 6 questions for ${esc(state.profile.role||"your role")}, corrects one mistake after each answer, and gives you a final report.</p>
      <p class="small"><span class="tag free">Free</span> opens the interview in Claude. In the Claude app you can tap the voice button and talk.</p>`;
    const row=el("div","row");
    row.append(btn("Free · start in Claude ↗","primary",()=>{ AI.openFree(mockRules()+"\nStart now with a one-line greeting and your first question."); toast("Opening Claude. The message is also copied."); }));
    if(AI.hasKey()){
      row.append(btn("Paid · in this app (≈ ₹2 per answer)","paid",()=>{ mock.started=true; mock.turns=[{role:"user",content:"Start the interview now with a one-line greeting and your first question in the format \"Next question: ...\"."}]; renderInt(); askMock(); }));
    } else row.append(el("span","small muted",`Paid in-app option: <a href="#settings">set up</a>`));
    ctrl.append(row);
    return;
  }
  const answers=mock.turns.filter(t=>t.role==="user").length-1;
  const finished=mock.turns.some(t=>t.role==="assistant"&&/Final report:/i.test(t.content));
  const status=el("p","small muted"); ctrl.append(status);
  if(mock.busy) status.textContent="Interviewer is thinking…";
  else if(!finished && mock.turns[mock.turns.length-1].role==="assistant"){
    status.textContent=`Answer ${answers+1} of 6`;
    makeRecorder(ctrl,{longForm:true,prompt:"Tap the mic and answer",onDone:(text,secs)=>{ if(!text) return; const a=analyse(text,secs);
      mock.turns.push({role:"user",content:text}); addLog({kind:"mock",label:"Mock answer "+(answers+1),wpm:a.wpm,fillers:a.fillers}); renderInt(); askMock(); }});
  } else if(!finished){ ctrl.append(btn("Try again","",askMock)); }
  ctrl.append(btn(finished?"Start a new interview":"End interview","ghost",()=>{ mock.started=false; mock.turns=[]; mock.busy=false; renderInt(); }));
}
async function askMock(){
  mock.busy=true; renderInt();
  try{
    const {text}=await AI.runPaid({title:"Mock interview reply", system:mockRules(), messages:mock.turns, maxTokens:3000});
    mock.turns.push({role:"assistant",content:text}); mock.busy=false; renderInt();
    if(mock.autoSpeak){ const m=text.match(/Next question:\s*([\s\S]+)/i); say(m?m[1].trim():text); }
  }catch(e){
    mock.busy=false;
    if(mock.turns.length===1 && e.code==="cancelled"){ mock.started=false; mock.turns=[]; }
    renderInt(); if(e.code!=="cancelled") toast(e.message||"Something went wrong.");
  }
}
function renderIntro(body){
  const saved=lsGet("iec-intro",{});
  const card=el("div","card");
  card.innerHTML=`<h3>Build your "Tell me about yourself"</h3><p class="small muted">Fill in short notes. AI writes a 60–90 second answer at your level. Then paste or keep it below and practise.</p>
    <div class="grid2"><label class="f" for="inName">First name<input id="inName" value="${esc(saved.name||"")}"></label><label class="f" for="inCity">From (city)<input id="inCity" value="${esc(saved.city||"")}"></label></div>
    <label class="f" for="inEdu">Education<input id="inEdu" placeholder="e.g. B.Tech CSE, 2024" value="${esc(saved.edu||"")}"></label>
    <label class="f" for="inExp">Experience / projects / internships<textarea id="inExp" placeholder="e.g. 6-month internship at a startup building a billing app">${esc(saved.exp||"")}</textarea></label>
    <label class="f" for="inSkills">Key skills<input id="inSkills" placeholder="e.g. Java, SQL, communication" value="${esc(saved.skills||"")}"></label>
    <label class="f" for="inGoal">Why this role / your goal<input id="inGoal" value="${esc(saved.goal||"")}"></label>
    <div class="aih"></div>
    <label class="f" for="introText">Your introduction (paste from Claude, or write your own)<textarea id="introText" style="min-height:140px">${esc(saved.text||"")}</textarea></label>
    <div class="row ib"></div>`;
  body.append(card);
  const data=()=>{ const d={name:$("#inName").value,city:$("#inCity").value,edu:$("#inEdu").value,exp:$("#inExp").value,skills:$("#inSkills").value,goal:$("#inGoal").value,text:$("#introText").value}; lsSet("iec-intro",d); return d; };
  card.addEventListener("input",()=>data());
  const core=()=>{ const d=data(); delete d.text; return `${learner()}\nWrite my spoken answer to "Tell me about yourself" for a job interview: 130–170 words (60–90 seconds), first person, natural spoken English for ${L().name} level, structured present → past → future. Avoid Indian-English patterns like "myself X", "I am having", "passed out". Use only these facts and don't invent employers or numbers:\n${JSON.stringify(d)}`; };
  aiPanel(card.querySelector(".aih"),{label:"Write it with AI",
    freePrompt:()=>core()+"\nReply with only the answer text.",
    paidChars:()=>core().length,
    paid:async out=>{ out.innerHTML=`<p class="small muted">Writing…</p>`;
      try{ const {text,cost}=await AI.runPaid({title:"Write my introduction",system:COACH,messages:[{role:"user",content:core()+"\nReply with only the answer text."}],maxTokens:2000});
        $("#introText").value=text; data(); out.innerHTML=`<p class="small muted">Written below. This used about ${AI.rupees(cost)}.</p>`; }
      catch(e){ out.innerHTML=e.code==="cancelled"?"":`<p class="small" style="color:var(--bad)">${esc(e.message)}</p>`; } }});
  const ib=card.querySelector(".ib");
  ib.append(spkBtn(()=>$("#introText").value||"Write or paste your introduction first.","Hear at ideal speed",()=>L().rate),
    btn("Practise line by line","primary",()=>{ const t=$("#introText").value.trim(); if(!t){ toast("Write or paste your introduction first."); return; } practiseLines(sentences(t)); }),
    btn("Read it as a whole","ghost",()=>{ const t=$("#introText").value.trim(); if(!t){ toast("Write or paste your introduction first."); return; } state.pasteText=t; lsSet("iec-paste",t); state.pasteActive=true; $("#pasteIn").value=t; state.pronMode="paste"; go("pron"); }));
}

/* ================= INTERVIEW: questions from my PDF ================= */
const pdfStore = { get(){ return lsGet("iec-pdfsets",{sets:[],cur:null,idx:0}); }, set(v){ lsSet("iec-pdfsets",v); } };
const CLAUDE_PDF_PROMPT = "Read the attached PDF and list every interview question with its answer from the PDF, in exactly this format, one after another:\n\nQ: <question>\nA: <answer>\n\nDon't add anything else.";
function addPdfSet(name, items){
  const s=pdfStore.get();
  const id="s"+Date.now();
  s.sets.unshift({id, name:name.slice(0,60), items:items.slice(0,200), best:{}});
  s.sets=s.sets.slice(0,12); s.cur=id; s.idx=0;
  pdfStore.set(s);
}
function renderPdf(body){
  const s=pdfStore.get();
  const set=s.sets.find(x=>x.id===s.cur) || s.sets[0] || null;

  const up=el("div","card");
  up.innerHTML=`<div class="row between"><h3>Practise from your own PDF</h3><span class="tag free">Free</span></div>
    <p class="small muted">Upload a PDF of interview questions and answers. The app finds the questions, you answer by voice, and it tells you if your answer matches the PDF, what you missed, where you fumbled, and which words weren't clear. The PDF is read on your phone; it isn't uploaded anywhere.</p>
    <div class="row"><label class="btn primary" for="pdfIn" style="cursor:pointer">Upload PDF<input id="pdfIn" type="file" accept="application/pdf,.pdf" hidden></label></div>
    <p class="small pdfmsg" aria-live="polite"></p>
    ${s.sets.length?`<div class="row sets">${s.sets.map(x=>`<button class="chip" type="button" data-id="${x.id}" aria-pressed="${set&&x.id===set.id}">${esc(x.name)} · ${x.items.length}</button>`).join("")}</div>`:""}
    <details><summary class="small" style="cursor:pointer;font-weight:600">PDF not detected well, or it's a scanned PDF?</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <p class="small">Upload your PDF to Claude (free) with the message below, then paste Claude's reply here.</p>
        <div class="fix small" style="white-space:pre-wrap">${esc(CLAUDE_PDF_PROMPT)}</div>
        <div class="row"><button class="btn ghost cpy" type="button">Copy message</button></div>
        <label class="f" for="qaPaste">Paste questions and answers (Q: … A: …)<textarea id="qaPaste" placeholder="Q: Tell me about yourself.&#10;A: I'm a final-year B.Tech student…"></textarea></label>
        <div class="row"><button class="btn usepaste" type="button">Use this text</button></div>
      </div></details>`;
  body.append(up);
  const msg=up.querySelector(".pdfmsg");
  up.querySelector(".cpy").onclick=()=>{ navigator.clipboard.writeText(CLAUDE_PDF_PROMPT).then(()=>toast("Copied"),()=>toast("Select the text to copy it")); };
  up.querySelectorAll(".sets .chip").forEach(c=>c.onclick=()=>{ const v=pdfStore.get(); v.cur=c.dataset.id; v.idx=0; pdfStore.set(v); renderInt(); });
  up.querySelector(".usepaste").onclick=()=>{
    const items=PDF.parseQA(up.querySelector("#qaPaste").value.split(/\n/));
    if(!items.length){ msg.textContent="No questions found. Put \"Q:\" before each question and \"A:\" before each answer."; return; }
    addPdfSet("Pasted "+new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short"}), items); toast(`${items.length} questions added`); renderInt();
  };
  up.querySelector("#pdfIn").onchange=async e=>{
    const f=e.target.files[0]; e.target.value=""; if(!f) return;
    if(f.size>20*1024*1024){ msg.textContent="That PDF is over 20 MB. Try a smaller file."; return; }
    msg.textContent="Reading the PDF…";
    try{
      const lines=await PDF.pdfToLines(f);
      const text=lines.join(" ").trim();
      if(text.length<20){ msg.textContent="This PDF has no readable text (it may be a scanned image). Use the Claude option below."; return; }
      const items=PDF.parseQA(lines);
      if(!items.length){ msg.textContent="Couldn't find questions in this PDF. Questions should end with \"?\" or start with \"Q\" or a number. You can use the Claude option below."; return; }
      addPdfSet(f.name.replace(/\.pdf$/i,""), items);
      toast(`Found ${items.length} questions`); renderInt();
    }catch(err){ msg.textContent = err.message && /PDF reader/.test(err.message) ? err.message : "Couldn't open this PDF. If it has a password, remove it and try again."; }
  };
  if(!set) return;

  const idx=Math.min(Math.max(0,s.idx||0), set.items.length-1);
  const item=set.items[idx];
  const card=el("div","card");
  const best=set.best&&set.best[idx];
  card.innerHTML=`<div class="row between"><span class="eyebrow">${esc(set.name)} · ${idx+1} of ${set.items.length}${best!=null?` · best ${best}%`:""}</span>
      <div class="row"><button class="btn ghost pv" type="button" aria-label="Previous question">←</button><button class="btn ghost rnd" type="button" aria-label="Random question">⤮</button><button class="btn ghost nx" type="button" aria-label="Next question">→</button></div></div>
    <h2>${esc(item.q)}</h2>
    <div class="row sp"></div>
    ${item.a?`<details><summary class="small" style="cursor:pointer;font-weight:600">Show the answer from the PDF</summary><p class="small" style="margin-top:6px;white-space:pre-wrap">${esc(item.a)}</p></details>`:`<p class="small muted">This question has no answer in the PDF, so the app checks your speaking only (pace, fumbles, grammar).</p>`}
    <div class="res stack" style="gap:12px"></div>`;
  body.append(card);
  const move=n=>{ const v=pdfStore.get(); v.idx=(n+set.items.length)%set.items.length; pdfStore.set(v); renderInt(); };
  card.querySelector(".pv").onclick=()=>move(idx-1);
  card.querySelector(".nx").onclick=()=>move(idx+1);
  card.querySelector(".rnd").onclick=()=>move(Math.floor(Math.random()*set.items.length));
  card.querySelector(".sp").append(spkBtn(item.q,"Hear the question",()=>L().rate));
  if(item.a) card.querySelector(".sp").append(spkBtn(item.a,"Hear the answer",()=>L().rate));
  const res=card.querySelector(".res");

  makeRecorder(card,{longForm:true,prompt:"Tap the mic and answer in your own words",onDone:(text,secs,meta={})=>{
    if(!text){ res.innerHTML=""; return; }
    const a=analyse(text,secs), c=PDF.checkAnswer(item.a||"",text);
    const fumbles=c.repeats.length + a.fillers + (meta.pauses||0);
    res.innerHTML=`
      ${c.verdict?`<div class="row" style="gap:16px;flex-wrap:nowrap"><div><div class="big-num">${c.content}%</div><div class="small muted">matches the PDF</div></div><div style="min-width:0"><span class="verdict ${c.verdict[1]}">${c.verdict[0]}</span></div></div>`:""}
      <div class="stats"><div class="stat"><b>${a.wpm||"–"}</b><span>Words/min</span></div><div class="stat"><b>${fumbles}</b><span>Fumbles</span></div><div class="stat"><b>${a.secs}s</b><span>Length</span></div></div>
      ${c.points.length?`<h3>Points from the PDF answer</h3><div class="list">${c.points.map(p=>`<div class="fix" style="grid-template-columns:22px 1fr;display:grid;gap:8px"><b style="color:${p.pct>=0.5?"var(--good)":"var(--bad)"}">${p.pct>=0.5?"✓":"✗"}</b><span class="small">${esc(p.text)}</span></div>`).join("")}</div>`:""}
      ${c.missedWords.length?`<div><p class="small" style="font-weight:600">Key words you didn't say (tap to hear)</p><div class="row mw"></div></div>`:""}
      ${c.closeWords.length?`<p class="small"><b>Maybe not pronounced clearly:</b> ${c.closeWords.slice(0,10).map(esc).join(", ")}. The app heard something close but different.</p>`:""}
      <div><h3>Fumbling</h3><div class="list small">
        <div>• Filler words (um, basically, actually…): <b>${a.fillers}</b></div>
        <div>• Repeated words: <b>${c.repeats.length}</b>${c.repeats.length?` (${c.repeats.slice(0,5).map(esc).join(", ")})`:""}</div>
        <div>• Long pauses (over 3 seconds): <b>${meta.pauses||0}</b></div>
      </div></div>
      ${paceMeter(a.wpm)}
      <p class="small muted">We heard: <i>${esc(text.slice(0,1500))}</i></p>
      <div class="gram stack" style="gap:8px"></div>`;
    const mw=res.querySelector(".mw"); if(mw) c.missedWords.slice(0,16).forEach(w=>{ const b=el("button","chip"); b.type="button"; b.textContent=w; b.onclick=()=>say(w,0.75); mw.append(b); });
    const gram=res.querySelector(".gram");
    const gb=btn("Check grammar (free)","",async()=>{
      gb.disabled=true; gb.textContent="Checking…";
      try{
        const issues=await PDF.grammarCheck(text);
        let saved=0;
        issues.filter(i=>!i.spelling && i.fix).slice(0,6).forEach(i=>{ const s=i.sentence||i.said; if(Coach.addMistake({wrong:s, right:s.replace(i.said,i.fix), why:i.why, src:"Grammar check"})) saved++; });
        if(saved) setTimeout(()=>toast(`${saved} saved to Coach → My mistakes`),300);
        gram.innerHTML=`<h3>Grammar and word check</h3>`+(issues.length?`<div class="list">${issues.slice(0,12).map(i=>`<div class="fix"><span class="x">${esc(i.said)}</span>${i.fix?`<span class="y">${esc(i.fix)}</span>`:""}<span class="small muted">${i.spelling?"Heard as a misspelled word, so this word may not have been pronounced clearly.":esc(i.why)}</span></div>`).join("")}</div>`:`<p class="small" style="color:var(--good);font-weight:600">No grammar mistakes found.</p>`)
          +`<p class="small muted">Checked by LanguageTool's free service. Your answer text is sent to languagetool.org for this check.</p>`;
      }catch(err){ gram.innerHTML=`<p class="small" style="color:var(--bad)">${esc(err.message)}</p>`; gram.append(gb); gb.disabled=false; gb.textContent="Check grammar (free)"; }
    });
    gram.append(gb);
    const core=`${learner()}\nInterview question: "${item.q}"\n${item.a?`Expected answer from my study PDF: """${item.a.slice(0,1500)}"""\n`:""}My spoken answer (speech-to-text, so ignore punctuation): """${text.slice(0,1500)}"""\nMeasured: ${a.wpm} words per minute (ideal ${L().lo}–${L().hi}), ${a.fillers} filler words, ${c.repeats.length} repeated words, ${meta.pauses||0} long pauses.`;
    aiPanel(res,{label:"Detailed AI review",
      freePrompt:()=>`${COACH}\n${core}\nTell me: 1) Is my answer correct compared with the PDF answer? What did I miss or get wrong? 2) Grammar mistakes as ❌ what I said → ✅ correct (short reason). 3) Where I fumbled and how to sound more fluent. 4) Words that may have been mispronounced (speech-to-text mishearings are a clue), with stress in CAPITALS. 5) A better version of my answer in 80–120 words.`,
      paidChars:()=>core.length+600,
      paid:out=>paidJSON(out,"PDF answer review",COACH,`${core}\nReply with only JSON: {"correct": "yes"|"partly"|"no", "summary": string (2 sentences), "missed_points": [string] (up to 4), "corrections": [{"said": string, "better": string, "why": string}] (up to 5), "fluency_tips": [string] (up to 3), "pronunciation_watch": [string] (up to 4, stress in CAPITALS), "better_answer": string (80-120 words)}`,
        (r,o)=>{ (r.corrections||[]).forEach(x=>Coach.addMistake({wrong:x.said, right:x.better, why:x.why, src:"AI PDF review"})); o.innerHTML=`<p><span class="verdict ${r.correct==="yes"?"v-good":r.correct==="partly"?"v-warn":"v-bad"}">${r.correct==="yes"?"Correct":r.correct==="partly"?"Partly correct":"Not correct"}</span></p><p>${esc(r.summary)}</p>
          ${(r.missed_points||[]).length?`<h3>Missed points</h3><div class="list small">${r.missed_points.map(t=>`<div>• ${esc(t)}</div>`).join("")}</div>`:""}
          ${(r.corrections||[]).length?`<h3>Corrections</h3><div class="list">${r.corrections.map(x=>`<div class="fix"><span class="x">${esc(x.said)}</span><span class="y">${esc(x.better)}</span><span class="small muted">${esc(x.why)}</span></div>`).join("")}</div>`:""}
          ${(r.fluency_tips||[]).length?`<h3>Fluency</h3><div class="list small">${r.fluency_tips.map(t=>`<div>• ${esc(t)}</div>`).join("")}</div>`:""}
          ${(r.pronunciation_watch||[]).length?`<h3>Say these carefully</h3><p class="small mono">${r.pronunciation_watch.map(esc).join(" · ")}</p>`:""}
          <h3>A better answer</h3><p class="small">${esc(r.better_answer)}</p>`; })});
    if(c.content!=null){ const v=pdfStore.get(); const ss=v.sets.find(x=>x.id===set.id); if(ss){ ss.best=ss.best||{}; ss.best[idx]=Math.max(ss.best[idx]||0,c.content); pdfStore.set(v); } }
    addLog({kind:"answer",label:"PDF · "+item.q.slice(0,50),wpm:a.wpm,fillers:a.fillers,score:c.content??undefined});
  }});

  const manage=el("details","card");
  manage.innerHTML=`<summary><h3>All questions in "${esc(set.name)}"</h3></summary><div class="list ql"></div><div class="row"><button class="btn danger del" type="button">Delete this PDF's questions</button></div>`;
  body.append(manage);
  manage.querySelector(".ql").innerHTML=set.items.map((it,i)=>`<button type="button" class="btn" data-i="${i}" style="justify-content:flex-start;text-align:left;font-weight:500;min-width:0">${i+1}. ${esc(it.q)}${set.best&&set.best[i]!=null?` <span class="mono small muted">· ${set.best[i]}%</span>`:""}</button>`).join("");
  manage.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>move(+b.dataset.i));
  manage.querySelector(".del").onclick=()=>{
    const dlg=$("#modal"), box=$("#modalIn");
    box.innerHTML=`<h3>Delete these questions?</h3><p class="small">This removes "${esc(set.name)}" (${set.items.length} questions) from this phone. Your PDF file itself isn't touched.</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="dC">Cancel</button><button class="btn danger" type="button" id="dY">Delete</button></div>`;
    box.querySelector("#dC").onclick=()=>dlg.close();
    box.querySelector("#dY").onclick=()=>{ const v=pdfStore.get(); v.sets=v.sets.filter(x=>x.id!==set.id); v.cur=v.sets[0]?.id||null; v.idx=0; pdfStore.set(v); dlg.close(); renderInt(); };
    dlg.showModal();
  };
}

/* ================= PROGRESS ================= */
function renderProgress(){
  const log=state.log, avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
  const wpms=log.filter(l=>l.wpm>0).map(l=>l.wpm);
  const prons=log.filter(l=>(l.kind==="pron"||l.kind==="read")&&typeof l.score==="number").slice(0,20).map(l=>l.score);
  const answers=log.filter(l=>l.kind==="answer"||l.kind==="mock").length;
  $("#progStats").innerHTML=`<div class="stat"><b>${streak()}</b><span>Day streak</span></div><div class="stat"><b>${avg(wpms.slice(0,10))||"–"}</b><span>Avg wpm</span></div><div class="stat"><b>${prons.length?avg(prons)+"%":"–"}</b><span>Clarity</span></div>`;
  const {lo,hi}=L(); $("#paceTarget").textContent=`target ${lo}–${hi}`;
  const last=wpms.slice(0,15).reverse(), mx=Math.max(200,...last);
  $("#paceBars").innerHTML=last.map(w=>`<div title="${w} wpm" style="height:${w/mx*100}%;${w<lo||w>hi?"background:var(--amber)":""}"></div>`).join("");
  $("#paceEmpty").textContent=last.length?`Green = ideal pace, amber = too slow or fast. ${answers} interview answers practised.`:"Record a warm-up or an interview answer to see your pace here.";
  const ww=$("#weakWords"); ww.innerHTML="";
  const weak=state.profile.weak||[];
  weak.slice().reverse().slice(0,24).forEach(w=>{ const c=el("button","chip"); c.type="button"; c.textContent=w; c.onclick=()=>say(w,0.7); ww.append(c); });
  if(!weak.length) ww.innerHTML=`<p class="small muted">None yet.</p>`;
  else ww.append(btn("Practise these words","ghost",()=>{ const ws=weak.slice(-8); practiseLines([ws.slice(0,4).join(", ")+".", ...(ws.length>4?[ws.slice(4).join(", ")+"."]:[])]); }));
  const names={warmup:"Warm-up",read:"Paste and read",pron:"Pronunciation",answer:"Interview answer",mock:"Mock interview"};
  $("#recent").innerHTML=log.slice(0,12).map(l=>`<div class="row between" style="flex-wrap:nowrap;border-bottom:1px solid var(--line);padding-bottom:8px"><div style="min-width:0"><div style="font-weight:600;font-size:14px">${names[l.kind]||l.kind}</div><div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.label||"")}</div></div><div class="small mono" style="text-align:right;flex:none">${l.wpm?l.wpm+" wpm":""}${typeof l.score==="number"?"<br>"+l.score+"%":""}</div></div>`).join("") || `<p class="small muted">Nothing yet. Start with today's plan.</p>`;
}

/* ================= SETTINGS ================= */
function renderVoiceSel(){
  const s=$("#voiceSel"); if(!s) return;
  s.innerHTML=`<option value="">Automatic</option>`+voices.map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===state.profile.voice?"selected":""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
}
function renderSettings(){
  renderVoiceSel();
  $("#recLang").value=state.profile.recLang||"en-IN";
  const has=AI.hasKey();
  $("#paidSetup").hidden=has; $("#paidManage").hidden=!has;
  $("#paidStatus").innerHTML = has
    ? `<span class="tag paid">On</span> Key saved and locked with your PIN. This month: <b>${AI.rupees(AI.spendThisMonth())}</b> of ${AI.rupees(AI.getLimit())} limit.`
    : `<span class="tag free">Off</span> Not set up. Only the free options are used.`;
  $("#limitIn").value=AI.getLimit();
  const om=STT.chosenModel();
  $("#offModel").innerHTML=Object.entries(STT.MODELS).map(([k,v])=>`<option value="${k}" ${k===om?"selected":""}>${esc(v.label)}${STT.isReady(k)?" · downloaded":""}</option>`).join("");
  const ready=STT.isReady();
  $("#offStatus").innerHTML = !STT.supported() ? `<span class="tag paid">Not supported</span> This browser can't run the offline mic. Use Chrome.`
    : ready ? `<span class="tag free">Ready</span> The offline mic works without internet.` : `<span class="tag paid">Not downloaded</span> Download it once on Wi-Fi to use the mic without internet.`;
  $("#offDownload").hidden=ready; $("#offRemove").hidden=!Object.keys(STT.MODELS).some(k=>STT.isReady(k));
}
$("#offModel").onchange=e=>{ STT.setChosenModel(e.target.value); renderSettings(); renderModebar(); };
$("#offDownload").onclick=()=>openDownload();
$("#offRemove").onclick=async()=>{ await STT.removeModels(); if(micMode()==="offline") state.profile.micMode="auto", saveProfile(); toast("Offline mic removed. It frees the space on your phone."); renderSettings(); renderModebar(); };
$("#voiceSel").onchange=e=>{ state.profile.voice=e.target.value; saveProfile(); };
$("#voiceTest").onclick=()=>say("Hello! I'm your interview English coach. Let's practise together.");
$("#recLang").onchange=e=>{ state.profile.recLang=e.target.value; saveProfile(); toast("Saved."); };
$("#keySave").onclick=async()=>{
  const k=$("#keyIn").value.trim(), p1=$("#pin1").value, p2=$("#pin2").value;
  if(!/^sk-ant-/.test(k)){ toast("That doesn't look like an Anthropic API key (it starts with sk-ant-)."); return; }
  if(!/^\d{4}$/.test(p1)){ toast("PIN must be 4 digits."); return; }
  if(p1!==p2){ toast("The two PINs don't match."); return; }
  if(!window.crypto?.subtle){ toast("Secure storage needs the app to be opened over https."); return; }
  AI.setLimit($("#limitIn").value);
  await AI.saveKey(k,p1);
  $("#keyIn").value=""; $("#pin1").value=""; $("#pin2").value="";
  toast("Key saved and locked with your PIN."); renderSettings();
};
$("#keyRemove").onclick=()=>{ AI.removeKey(); toast("Key removed. Only free options are used now."); renderSettings(); };
$("#limitEdit").onclick=()=>{
  const dlg=$("#modal"), box=$("#modalIn");
  box.innerHTML=`<h3>Monthly limit</h3><label class="f" for="limNew">Limit in ₹<input id="limNew" type="number" min="0" step="10" value="${AI.getLimit()}"></label><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="limC">Cancel</button><button class="btn primary" type="button" id="limS">Save</button></div>`;
  box.querySelector("#limC").onclick=()=>dlg.close();
  box.querySelector("#limS").onclick=()=>{ AI.setLimit(box.querySelector("#limNew").value); dlg.close(); renderSettings(); };
  dlg.showModal();
};
$("#exportBtn").onclick=()=>{
  const data={v:1, profile:state.profile, log:state.log, intro:lsGet("iec-intro",{}), paste:state.pasteText};
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));
  a.download=`english-coach-backup-${dayKey()}.json`; document.body.append(a); a.click(); a.remove();
};
$("#importIn").onchange=async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(!d||!Array.isArray(d.log)) throw 0;
    state.profile=Object.assign(state.profile,d.profile||{}); state.log=d.log; saveProfile(); lsSet("iec-log",state.log);
    if(d.intro) lsSet("iec-intro",d.intro); if(d.paste){ state.pasteText=d.paste; lsSet("iec-paste",d.paste); }
    toast("Backup restored."); renderAll(); }
  catch{ toast("That file isn't a backup from this app."); }
  e.target.value="";
};
$("#resetBtn").onclick=()=>{
  const dlg=$("#modal"), box=$("#modalIn");
  box.innerHTML=`<h3>Reset progress?</h3><p class="small">This deletes your streak, history and practice words on this phone. Your API key and settings stay. This can't be undone.</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="rC">Cancel</button><button class="btn danger" type="button" id="rY">Delete progress</button></div>`;
  box.querySelector("#rC").onclick=()=>dlg.close();
  box.querySelector("#rY").onclick=()=>{ state.log=[]; state.profile.weak=[]; lsSet("iec-log",[]); saveProfile(); dlg.close(); toast("Progress reset."); renderAll(); };
  dlg.showModal();
};
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; $("#installBtn").hidden=false; });
$("#installBtn").onclick=async()=>{ if(!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(()=>{}); installEvt=null; $("#installBtn").hidden=true; };

/* ================= nav ================= */
const VIEWS=["today","warm","pron","int","coach","prog","settings"];
// Opens a screen, and a section inside it (for example Interview → From my PDF).
function goTo(v, sub){
  if(sub){ if(v==="int") state.intMode=sub; else if(v==="pron") state.pronMode=sub; else if(v==="coach") state.coachMode=sub; }
  go(v);
}
function renderCoach(){ Coach.render($("#coachBody"), state.coachMode||"shadow"); }
let lastView="today";
function go(v){
  if(!VIEWS.includes(v)) v="today";
  if(v!=="settings") lastView=v;
  if(offlineActive) offlineActive.cancel();
  $("#gear").setAttribute("aria-pressed", v==="settings");
  if(activeRec) Speech.stop();
  VIEWS.forEach(k=>{ $("#v-"+k).hidden = k!==v; });
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected", t.dataset.v===v));
  ({warm:renderWarm, pron:renderPron, int:renderInt, coach:renderCoach, prog:renderProgress, today:renderToday, settings:renderSettings})[v]();
  if(location.hash.slice(1)!==v) history.replaceState(null,"","#"+v);
  if(!(v==="pron" && state.pronMode==="paste" && state.pasteActive)) window.scrollTo(0,0);
}
function renderAll(){ renderToday(); renderProgress(); const v=location.hash.slice(1); if(["warm","pron","int","settings"].includes(v)) go(v); }
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>go(t.dataset.v));
// Settings opens as its own history step, so the phone's Back button (or the ← button) closes it.
const closeSettings=()=>{ if(history.state && history.state.settings) history.back(); else go(lastView); };
$("#gear").onclick=()=>{ if(!$("#v-settings").hidden){ closeSettings(); return; } history.pushState({settings:true},"","#settings"); go("settings"); };
$("#setBack").onclick=closeSettings;
$("#setDone").onclick=closeSettings;
window.addEventListener("popstate",()=>go(location.hash.slice(1)||lastView));
$("#lvlPill").onclick=()=>{ const ks=Object.keys(LEVELS); state.profile.level=ks[(ks.indexOf(state.profile.level)+1)%ks.length]; saveProfile(); renderAll(); toast("Level: "+L().name); };
$("#roleIn").addEventListener("input",e=>{ state.profile.role=e.target.value.slice(0,80); saveProfile(); });
$("#fixNext").onclick=()=>{ state.fixIdx++; renderToday(); };
$("#fixSave").onclick=()=>{ const f=FIXES[(Math.floor(Date.now()/864e5)+state.fixIdx)%FIXES.length]; toast(Coach.addMistake({wrong:f[0], right:f[1], why:f[2], src:"Fix of the day"}) ? "Saved to Coach → My mistakes." : "Already in My mistakes."); renderToday(); };
$("#goPaste").onclick=()=>{ state.pronMode="paste"; go("pron"); };
$("#pasteIn").addEventListener("input",e=>{ state.pasteText=e.target.value.slice(0,6000); lsSet("iec-paste",state.pasteText); });
$("#pasteUse").onclick=()=>{ state.pasteText=$("#pasteIn").value.trim().slice(0,6000); lsSet("iec-paste",state.pasteText); if(!state.pasteText){ toast("Paste some text first."); return; } state.pasteActive=true; renderPaste(); $("#pasteCard").scrollIntoView({behavior:"smooth",block:"start"}); };
$("#pasteSample").onclick=()=>{ $("#pasteIn").value=READS[state.profile.level]; $("#pasteUse").onclick(); };
$("#useCustom").onclick=()=>{ const t=$("#customSent").value.trim(); if(!t) return; practiseLines(t.split(/\n+/).flatMap(sentences)); };
$("#pronPrev").onclick=()=>{ state.pronIdx--; renderPron(); };
$("#pronNext").onclick=()=>{ state.pronIdx++; renderPron(); };

Coach.init({ $, el, btn, esc, toast, say, sayAsync, spkBtn, makeRecorder, analyse, paceMeter, alignWords, L, addLog, goTo, state, PDF,
  PHRASES, READS, ICON_MIC, ICON_STOP, registerCapture: c=>{ offlineActive=c; } });
renderModebar();
if(!SR && !STT.isReady()){ $("#envNote").hidden=false; $("#envNote").textContent="Voice checking works in Chrome on Android or a computer. In this browser, tap the mic to start a timer and speak with your keyboard's mic button."; }
go(location.hash.slice(1)||"today");

/* ================= version and updates ================= */
const VERSION = "1.4";
const WHATS_NEW = "New Coach tab: shadowing with playback, My mistakes, Habits, Answer builder and a 30-day plan.";
document.querySelectorAll(".appver").forEach(e=>e.textContent="Version "+VERSION);
if(lsGet("iec-ver",null)!==VERSION){ if(lsGet("iec-ver",null) || lsGet("iec-profile",null)) setTimeout(()=>toast(`Updated to version ${VERSION}. ${WHATS_NEW}`),600); lsSet("iec-ver",VERSION); }
if("serviceWorker" in navigator && location.protocol!=="file:"){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(reg=>{
    reg.update().catch(()=>{});
    document.addEventListener("visibilitychange",()=>{ if(!document.hidden) reg.update().catch(()=>{}); });
  }).catch(()=>{});
  // When a new version takes over, reload once so the new files are used straight away.
  let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(hadController && !reloaded && !activeRec){ reloaded=true; location.reload(); } });
}
$("#checkUpdate").onclick=async()=>{
  const b=$("#checkUpdate"); b.disabled=true; b.textContent="Checking…";
  try{
    const reg=await navigator.serviceWorker?.getRegistration();
    if(reg) await reg.update();
    const keys=await caches.keys(); await Promise.all(keys.filter(k=>/^iec-v\d+$/.test(k)).map(k=>caches.delete(k)));
  }catch{}
  location.reload();
};
