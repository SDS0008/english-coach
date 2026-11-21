// Coach tab: shadowing with playback, "My mistakes" notebook, habit tracker,
// answer builder (STAR / PREP / Present-Past-Future / SWOT) and a 30-day plan.
import { wordsOf, sentences, near } from "./text.js";
import * as STT from "./stt-offline.js";

let X = null; // helpers from app.js
export function init(ctx) { X = ctx; }

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const DAY = 864e5;
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* ======================= habits ======================= */
const FILLERS = /\b(um+|uh+|erm|hmm+|like|basically|actually|you know|i mean|kind of|sort of)\b/gi;
export function habitStats(text) {
  const w = wordsOf(text), n = w.length;
  const fillers = (String(text).match(FILLERS) || []).length;
  const thatOne = (String(text).match(/\b(that|this) one\b/gi) || []).length;
  let repeats = 0;
  for (let i = 1; i < n; i++) if (w[i] === w[i - 1] && w[i].length < 8) repeats++;
  // A restart: the same 3 words said again within the next 12 words ("I didn't see… I didn't see…").
  // A run of repeated phrases counts once.
  let restarts = 0, inRun = false; const seen = new Map();
  for (let i = 0; i + 2 < n; i++) {
    const g = w[i] + " " + w[i + 1] + " " + w[i + 2];
    const d = seen.has(g) ? i - seen.get(g) : 0;
    const rep = d >= 3 && d <= 12;
    if (rep && !inRun) restarts++;
    inRun = rep;
    seen.set(g, i);
  }
  return { n, fillers, thatOne, repeats, restarts };
}
export function recordHabit(text, secs, wpm) {
  const h = habitStats(text);
  if (h.n < 4) return;
  const arr = lsGet("iec-habits", []);
  arr.push({ t: Date.now(), ...h, wpm: wpm || 0, secs: Math.round(secs || 0) });
  lsSet("iec-habits", arr.slice(-1500));
}

/* ======================= mistakes notebook ======================= */
const BOX_DAYS = [0, 1, 2, 4, 7, 15, 30];
const mkey = m => (m.kind + "|" + wordsOf(m.right).join(" ") + "|" + wordsOf(m.wrong || "").join(" "));
export function addMistake({ wrong = "", right, why = "", src = "", kind = "phrase" }) {
  if (!right || !String(right).trim()) return false;
  right = String(right).trim().slice(0, 300); wrong = String(wrong).trim().slice(0, 300);
  if (kind === "phrase" && wordsOf(wrong).join(" ") === wordsOf(right).join(" ")) return false;
  const list = lsGet("iec-mistakes", []);
  const item = { id: "m" + Date.now() + Math.random().toString(36).slice(2, 6), kind, wrong, right, why: String(why).slice(0, 200), src, box: 0, due: Date.now(), added: Date.now(), ok: 0, miss: 0 };
  if (list.some(m => mkey(m) === mkey(item))) return false;
  list.unshift(item);
  lsSet("iec-mistakes", list.slice(0, 400));
  return true;
}
const dueList = () => lsGet("iec-mistakes", []).filter(m => m.box < BOX_DAYS.length - 1 && m.due <= Date.now()).sort((a, b) => a.due - b.due);
function gradeMistake(id, passed) {
  const list = lsGet("iec-mistakes", []), m = list.find(x => x.id === id);
  if (!m) return;
  if (passed) { m.box = Math.min(m.box + 1, BOX_DAYS.length - 1); m.ok++; }
  else { m.box = 0; m.miss++; }
  m.due = startOfDay() + Math.max(1, BOX_DAYS[m.box]) * DAY;
  lsSet("iec-mistakes", list);
}
export const dueCount = () => dueList().length;

/* ======================= 30-day plan ======================= */
const MISSIONS = [
  ["Do the full warm-up routine", "Breathing, lip trills, a tongue twister, read-aloud and the 60-second talk.", "warm"],
  ["Introduce yourself in under 60 seconds", "Build your intro, then record it. Aim for 45–60 seconds.", "int", "intro"],
  ["Shadow 5 interview lines", "Listen, repeat with the same speed and tone, then compare your voice.", "coach", "shadow"],
  ["“Tell me about yourself” with zero “that one”", "Record it in 60–90 seconds. Replace “that one” with the real word.", "int", "single"],
  ["Fill your SWOT and record a strengths answer", "Answer builder → SWOT. Then record “What are your strengths?”.", "coach", "builder"],
  ["Paste and read a news paragraph, score 70+", "Pronounce → Paste and read. Read it in your own way.", "pron", "paste"],
  ["Clear today's mistakes quiz", "Say each correction out loud until it's right.", "coach", "mistakes"],
  ["STAR answer: a challenge you faced, 90 seconds", "Answer builder → STAR. Hit all four parts.", "coach", "builder"],
  ["V and W sounds: 4 sentences at 90%+", "Pronounce → V / W.", "pron", "sent"],
  ["Mock interview: 3 questions", "Use the free Claude option or the in-app one.", "int", "mock"],
  ["Shadow your own introduction", "Coach → Shadowing → My introduction.", "coach", "shadow"],
  ["Answer 3 questions from your PDF", "Interview → From my PDF. Aim for “Correct”.", "int", "pdf"],
  ["60-second talk with 0–2 fillers", "Warm-up step 5. Pause instead of “um”.", "warm"],
  ["Check your Habits chart and pick one habit", "Coach → Habits. Choose one habit to fix this week.", "coach", "habits"],
  ["TH sounds: 4 sentences at 90%+", "Pronounce → TH. Tongue between the teeth.", "pron", "sent"],
  ["PREP answer: “Why should we hire you?” in 60 s", "Answer builder → PREP.", "coach", "builder"],
  ["Read aloud inside the ideal speed band", "Warm-up step 4. Stay in the green band.", "warm"],
  ["Clear today's mistakes quiz", "Repeat until each one passes.", "coach", "mistakes"],
  ["STAR answer: a teamwork story", "Say “I” for your part and “we” for the team result.", "coach", "builder"],
  ["Same question twice, fewer fillers the second time", "Interview → Question bank. Compare the two results.", "int", "single"],
  ["Shadow 5 lines and match the ideal timing", "Try to finish within a second of the ideal voice.", "coach", "shadow"],
  ["Word stress: hear and repeat 10 words", "Pronounce → Word stress list.", "pron", "sent"],
  ["Answer 5 PDF questions at 75%+", "Interview → From my PDF.", "int", "pdf"],
  ["Weakness answer using your SWOT", "Show what you're doing to improve.", "coach", "builder"],
  ["Full mock interview: 6 questions", "Ask for the final report at the end.", "int", "mock"],
  ["Paste and read your introduction, score 85+", "Pronounce → Paste and read.", "pron", "paste"],
  ["Clear today's mistakes quiz", "Notice which ones keep coming back.", "coach", "mistakes"],
  ["STAR answer: a mistake you made", "Own it, fix it, say what you learned.", "coach", "builder"],
  ["Talk for 2 minutes about your goals, no restarts", "Warm-up step 5, but keep going for 2 minutes.", "warm"],
  ["Final: full mock interview + compare Habits with week 1", "See how far you've come.", "int", "mock"]
];
function plan() { return lsGet("iec-plan", null); }
function planDay(p = plan()) { return p ? Math.min(30, Math.max(1, Math.floor((startOfDay() - p.start) / DAY) + 1)) : 0; }
export function todayMission() {
  const p = plan(); if (!p) return null;
  const d = planDay(p), m = MISSIONS[d - 1];
  return { day: d, title: m[0], done: (p.done || []).includes(d), go: m[2], sub: m[3] };
}
function markDay(d, on) { const p = plan(); if (!p) return; p.done = (p.done || []).filter(x => x !== d); if (on) p.done.push(d); lsSet("iec-plan", p); }

/* ======================= answer builder templates ======================= */
const TEMPLATES = {
  star: { name: "STAR", use: "Stories about what you did: challenges, teamwork, mistakes, leadership.",
    questions: ["Tell me about a challenge you faced.", "Describe a time you worked in a team.", "Tell me about a mistake you made.", "Tell me about a time you met a tight deadline.", "Describe a time you showed leadership."],
    fields: [["s", "Situation", "Where were you, and what was happening?", "The situation was this:"], ["t", "Task", "What was your goal or responsibility?", "My task was to"], ["a", "Action", "What did YOU do, step by step?", "So I"], ["r", "Result", "What happened? Give a number if you can.", "As a result,"]] },
  prep: { name: "PREP", use: "Opinion and “why” questions: why you, why this job, your view on something.",
    questions: ["Why should we hire you?", "Why do you want to work here?", "Why did you choose this career?", "What makes a good team member?"],
    fields: [["p", "Point", "Your main answer in one sentence.", ""], ["r", "Reason", "Why is that true?", "This is because"], ["e", "Example", "A short real example.", "For example,"], ["p2", "Point again", "Repeat your main point in new words.", "So,"]] },
  ppf: { name: "Present–Past–Future", use: "“Tell me about yourself” and introductions.",
    questions: ["Tell me about yourself.", "Walk me through your resume."],
    fields: [["pr", "Present", "What you do now.", "Currently, I"], ["pa", "Past", "Your education, experience or one achievement.", "Before this,"], ["fu", "Future", "Why this role, and what you want next.", "Now I'm looking to"]] },
  swot: { name: "SWOT", use: "Strengths and weaknesses questions. Fill it once, use it many times.",
    questions: ["What are your strengths and weaknesses?", "What is your biggest weakness?", "What are your greatest strengths?"],
    fields: [["s", "Strengths", "2–3 strengths with a short proof.", "My main strengths are"], ["w", "Weaknesses", "One real, manageable weakness.", "One area I'm working on is"], ["o", "Opportunities", "What you're doing to grow (course, practice, mentor).", "To improve, I'm"], ["t", "Threats / challenges", "A challenge you watch for, and how you handle it.", "I also watch out for"]] }
};
const endDot = s => /[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + ".";
function buildScript(tpl, notes) {
  return tpl.fields.map(([k, , , lead]) => {
    const v = (notes[k] || "").trim(); if (!v) return "";
    const body = lead && !v.toLowerCase().startsWith(lead.toLowerCase().split(" ")[0]) ? lead + " " + v.charAt(0).toLowerCase() + v.slice(1) : v;
    return endDot(body.charAt(0).toUpperCase() + body.slice(1));
  }).filter(Boolean).join(" ");
}

/* ======================= render ======================= */
const MODES = [["shadow", "Shadowing"], ["mistakes", "My mistakes"], ["habits", "Habits"], ["builder", "Answer builder"], ["plan", "30-day plan"]];
export function render(body, mode) {
  const { el, esc } = X;
  body.innerHTML = "";
  const tm = todayMission(), due = dueCount();
  const top = el("div", "card");
  top.innerHTML = tm
    ? `<div class="row between" style="flex-wrap:nowrap"><div style="min-width:0"><p class="eyebrow">30-day plan · Day ${tm.day} of 30${tm.done ? " · done ✓" : ""}</p><h3>${esc(tm.title)}</h3></div><button class="btn primary" type="button" id="tmGo">${tm.done ? "Again" : "Start"}</button></div>`
    : `<div class="row between" style="flex-wrap:nowrap"><div style="min-width:0"><p class="eyebrow">30-day interview plan</p><h3>One small mission a day for 30 days</h3></div><button class="btn primary" type="button" id="tmGo">See plan</button></div>`;
  if (due) top.insertAdjacentHTML("beforeend", `<p class="small">You have <b>${due}</b> mistake${due > 1 ? "s" : ""} to practise today. <a href="#coach" id="dueGo">Practise now</a></p>`);
  body.append(top);
  top.querySelector("#tmGo").onclick = () => tm ? X.goTo(tm.go, tm.sub) : X.goTo("coach", "plan");
  const dg = top.querySelector("#dueGo"); if (dg) dg.onclick = e => { e.preventDefault(); X.goTo("coach", "mistakes"); };

  const chips = el("div", "row"); chips.setAttribute("role", "tablist");
  chips.innerHTML = MODES.map(([k, t]) => `<button class="chip" role="tab" type="button" data-cm="${k}" aria-pressed="${mode === k}" aria-selected="${mode === k}">${t}${k === "mistakes" && due ? ` · ${due}` : ""}</button>`).join("");
  chips.querySelectorAll(".chip").forEach(b => b.onclick = () => X.goTo("coach", b.dataset.cm));
  body.append(chips);
  const area = el("div", "stack"); area.style.gap = "14px"; body.append(area);
  ({ shadow: renderShadow, mistakes: renderMistakes, habits: renderHabits, builder: renderBuilder, plan: renderPlan })[mode](area);
}

/* ---------- Shadowing ---------- */
let shadow = { src: "lines", idx: 0, own: "" };
export function shadowText(text) { shadow = { src: "own", idx: 0, own: text }; }
let player = null;
function play(url) { try { if (player) player.pause(); player = new Audio(url); return player.play().then(() => new Promise(r => { player.onended = r; player.onpause = r; })); } catch { return Promise.resolve(); } }
function shadowSentences() {
  const S = shadow.src;
  if (S === "lines") return X.PHRASES;
  if (S === "read") return sentences(X.READS[X.state.profile.level]);
  if (S === "intro") return sentences((lsGet("iec-intro", {}).text || "").trim());
  if (S === "pdf") { const s = lsGet("iec-pdfsets", { sets: [] }); const set = s.sets.find(x => x.id === s.cur) || s.sets[0]; const it = set && set.items[Math.min(s.idx || 0, set.items.length - 1)]; return it && it.a ? sentences(it.a) : []; }
  return sentences(shadow.own || "");
}
function renderShadow(area) {
  const { el, esc, btn } = X;
  const intro = el("div", "card");
  intro.innerHTML = `<div class="row between"><h3>Shadowing</h3><span class="tag free">Free · works offline</span></div>
    <p class="small muted">Listen to the ideal voice, then repeat it with the same speed, stress and tone. Then play both and compare. This trains your mouth and ear together, and it's one of the fastest ways to sound natural.</p>
    <div class="row">${[["lines", "Interview lines"], ["read", "Read-aloud"], ["intro", "My introduction"], ["pdf", "My PDF answer"], ["own", "My own text"]].map(([k, t]) => `<button class="chip" type="button" data-src="${k}" aria-pressed="${shadow.src === k}">${t}</button>`).join("")}</div>
    ${shadow.src === "own" ? `<label class="f" for="shOwn">Your text<textarea id="shOwn" placeholder="Paste a few sentences to shadow">${esc(shadow.own)}</textarea></label><div class="row"><button class="btn" type="button" id="shUse">Use this text</button></div>` : ""}`;
  area.append(intro);
  intro.querySelectorAll("[data-src]").forEach(b => b.onclick = () => { shadow.src = b.dataset.src; shadow.idx = 0; X.goTo("coach", "shadow"); });
  const use = intro.querySelector("#shUse"); if (use) use.onclick = () => { shadow.own = intro.querySelector("#shOwn").value; shadow.idx = 0; X.goTo("coach", "shadow"); };

  const list = shadowSentences();
  if (!list.length) {
    area.append(el("p", "small muted", shadow.src === "intro" ? "No introduction saved yet. Write one in Interview → Self-intro builder." : shadow.src === "pdf" ? "No PDF answer yet. Upload a PDF in Interview → From my PDF." : "Add some text above to start."));
    return;
  }
  shadow.idx = (shadow.idx + list.length) % list.length;
  const sent = list[shadow.idx];
  const card = el("div", "card");
  card.innerHTML = `<div class="row between"><span class="eyebrow">Sentence ${shadow.idx + 1} of ${list.length}</span><div class="row"><button class="btn ghost pv" type="button" aria-label="Previous">←</button><button class="btn ghost nx" type="button" aria-label="Next">→</button></div></div>
    <p class="say">${esc(sent)}</p>
    <div class="row a1"></div>
    <div class="rec">
      <div class="row" style="gap:14px;flex-wrap:nowrap"><button class="mic shMic" type="button" aria-label="Record">${X.ICON_MIC}</button>
        <div style="min-width:0;flex:1"><div class="timer shT">0:00</div><div class="small muted shSt">Tap “Listen, then repeat”, or tap the mic and say it.</div></div></div>
      <div class="row a2" hidden></div>
      <div class="shRes stack" style="gap:8px"></div>
    </div>`;
  area.append(card);
  card.querySelector(".pv").onclick = () => { shadow.idx--; X.goTo("coach", "shadow"); };
  card.querySelector(".nx").onclick = () => { shadow.idx++; X.goTo("coach", "shadow"); };
  const mic = card.querySelector(".shMic"), st = card.querySelector(".shSt"), tm = card.querySelector(".shT"), a2 = card.querySelector(".a2"), res = card.querySelector(".shRes");
  const againRow = el("div", "row"); card.querySelector(".rec").insertBefore(againRow, a2);
  let idealSecs = null, cap = null, tick = null, t0 = 0, myUrl = null, gen = 0;
  // "Try again": stops recording and clears the recording and the result.
  const again = btn("↺ Try again", "", () => {
    gen++;
    if (cap) { cap.cancel(); cap = null; X.registerCapture(null); }
    clearInterval(tick); tm.textContent = "0:00";
    mic.classList.remove("live"); mic.innerHTML = X.ICON_MIC; mic.disabled = false;
    if (myUrl) { URL.revokeObjectURL(myUrl); myUrl = null; }
    a2.hidden = true; a2.innerHTML = ""; res.innerHTML = ""; again.hidden = true;
    st.textContent = "Cleared. Tap “Listen, then repeat” or the mic to try again.";
  });
  again.hidden = true; againRow.append(again);

  const listen = async rate => { const t = performance.now(); await X.sayAsync(sent, rate); const s = (performance.now() - t) / 1000; if (s > 0.5) idealSecs = s; };
  const a1 = card.querySelector(".a1");
  a1.append(btn("▶ Ideal", "", () => listen(X.L().rate)), btn("▶ Slow", "", () => listen(0.7)), btn("Listen, then repeat", "primary", async () => { await listen(X.L().rate); start(); }));

  if (!STT.supported()) { st.textContent = "Recording isn't supported in this browser. Use Chrome."; mic.disabled = true; return; }
  async function start() {
    if (cap) return;
    try { cap = await STT.startCapture(); } catch { st.textContent = "Microphone blocked. Allow it in Chrome's site settings."; return; }
    X.registerCapture({ cancel: () => { if (cap) cap.cancel(); cap = null; clearInterval(tick); } });
    mic.classList.add("live"); mic.innerHTML = X.ICON_STOP; st.textContent = "Recording… tap stop when you finish."; again.hidden = false;
    a2.hidden = true; res.innerHTML = "";
    t0 = performance.now(); tick = setInterval(() => { const s = (performance.now() - t0) / 1000; tm.textContent = Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }, 200);
  }
  async function stop() {
    const c = cap, myGen = gen; cap = null; X.registerCapture(null); clearInterval(tick);
    mic.classList.remove("live"); mic.innerHTML = X.ICON_MIC; mic.disabled = true; st.textContent = "Saving…";
    try {
      const { samples, blob } = await c.stop();
      if (myGen !== gen) { mic.disabled = false; return; }
      if (myUrl) URL.revokeObjectURL(myUrl); myUrl = URL.createObjectURL(blob);
      const t = STT.speechTiming(samples);
      a2.hidden = false; a2.innerHTML = "";
      a2.append(btn("▶ My voice", "", () => play(myUrl)), btn("▶ Ideal, then me", "primary", async () => { await X.sayAsync(sent, X.L().rate); await play(myUrl); }));
      let html = "";
      if (!t.speech) html = `<p class="small">Didn't hear anything. Hold the phone closer and try again.</p>`;
      else if (idealSecs) {
        const diff = t.secs - idealSecs, pct = Math.abs(diff) / idealSecs;
        const v = pct <= 0.15 ? ["Good timing: close to the ideal voice", "v-good"] : diff > 0 ? ["Slower than the ideal voice. Join the words more.", "v-warn"] : ["Faster than the ideal voice. Slow down a little.", "v-warn"];
        html = `<div class="row"><span class="verdict ${v[1]}">${v[0]}</span><span class="small mono">you ${t.secs.toFixed(1)}s · ideal ${idealSecs.toFixed(1)}s</span></div>`;
      } else html = `<p class="small muted">Tip: tap “▶ Ideal” first, so the app can compare your timing.</p>`;
      res.innerHTML = html;
      st.textContent = "Play both and compare: the stress, the speed, the ending sounds.";
      if (t.speech && STT.isReady()) {
        st.textContent = "Checking your words on this phone…";
        const words = await STT.transcribe(samples);
        if (myGen !== gen) { mic.disabled = false; return; }
        if (X.partlyHeard(sent, words)) { res.insertAdjacentHTML("beforeend", X.partlyHTML(words || "(nothing clear)")); st.textContent = "Tap “↺ Try again” and say the whole sentence."; mic.disabled = false; return; }
        const r = X.readResult(sent, words, t.secs, { verb: "said" }), sc = r.clarity;
        res.insertAdjacentHTML("beforeend", r.html +
          (sc < 60 ? `<p class="small">Low score? Speak a little closer to the mic, a bit slower, and make sure the ideal voice has finished before you start.</p>` : ""));
        X.wireMiss(res);
        X.addLog({ kind: "pron", label: "Shadow · " + sent.slice(0, 50), score: sc });
        st.textContent = "Play both and compare.";
      } else if (t.speech && !STT.isReady()) {
        res.insertAdjacentHTML("beforeend", `<p class="small muted">Download the offline mic (Settings) to also get a word-by-word check here.</p>`);
        X.addLog({ kind: "pron", label: "Shadow · " + sent.slice(0, 50) });
      }
    } catch (e) { st.textContent = "Couldn't save the recording. Try again."; }
    mic.disabled = false;
  }
  mic.onclick = () => cap ? stop() : start();
}

/* ---------- My mistakes ---------- */
function renderMistakes(area) {
  const { el, esc, btn } = X;
  const due = dueList(), all = lsGet("iec-mistakes", []);
  const qc = el("div", "card");
  area.append(qc);
  if (!due.length) {
    qc.innerHTML = `<div class="row between"><h3>Today's quiz</h3><span class="tag free">Free</span></div>
      <p class="small">${all.length ? "Nothing due today. Well done! Mistakes come back after 1, 2, 4, 7, 15 and 30 days until you've learned them." : "Your notebook is empty. It fills up by itself from pronunciation practice, the grammar check and AI feedback. You can also add your own below."}</p>`;
  } else {
    const m = due[0];
    qc.innerHTML = `<div class="row between"><h3>Today's quiz</h3><span class="small mono">${due.length} to go</span></div>
      ${m.kind === "word" ? `<p class="small muted">Say this word clearly:</p><p class="say">${esc(m.right)}</p>`
        : `<p class="small muted">Say this correctly:</p><div class="fix"><span class="x">${esc(m.wrong)}</span></div>
           <details class="reveal"><summary class="small" style="cursor:pointer;font-weight:600">Show the correct version</summary><div class="fix" style="margin-top:6px"><span class="y">${esc(m.right)}</span>${m.why ? `<span class="small muted">${esc(m.why)}</span>` : ""}</div></details>`}
      <div class="row q1"></div><div class="qres stack" style="gap:8px"></div>`;
    const q1 = qc.querySelector(".q1"), qres = qc.querySelector(".qres");
    q1.append(X.spkBtn(m.right, "Hear correct", X.L().rate),
      btn("I said it right", "ghost", () => { gradeMistake(m.id, true); X.toast("Nice. It comes back later."); X.goTo("coach", "mistakes"); }),
      btn("Skip", "ghost", () => { gradeMistake(m.id, false); X.goTo("coach", "mistakes"); }));
    X.makeRecorder(qc, { prompt: "Tap the mic and say it", onDone: (text, secs) => {
      if (!text) { qres.innerHTML = ""; return; }
      let pass;
      if (m.kind === "word") { const t = wordsOf(m.right)[0]; pass = wordsOf(text).some(w => near(t, w) === 2); }
      else { const al = X.alignWords(m.right, text); pass = al.filter(x => x.ok).length / Math.max(1, al.length) >= 0.85; }
      const det = qc.querySelector("details.reveal"); if (det) det.open = true;
      const r = X.readResult(m.right, text, secs, { verb: "said" });
      qres.innerHTML = `<p><span class="verdict ${pass ? "v-good" : "v-bad"}">${pass ? "Correct! It comes back in a few days." : "Not yet. Listen and try again tomorrow."}</span></p>${r.html}`;
      X.wireMiss(qres);
      gradeMistake(m.id, pass);
      qres.append(btn(due.length > 1 ? "Next mistake →" : "Finish", "primary", () => X.goTo("coach", "mistakes")));
    } });
  }

  const add = el("details", "card");
  add.innerHTML = `<summary><h3>Add a mistake</h3></summary>
    <p class="small muted">For example, a correction from Claude's free feedback.</p>
    <label class="f" for="mkW">What I said (wrong)<input id="mkW" placeholder="I am having 3 years experience"></label>
    <label class="f" for="mkR">Correct version<input id="mkR" placeholder="I have 3 years of experience"></label>
    <label class="f" for="mkN">Note (optional)<input id="mkN" placeholder="Don't use -ing with “have”"></label>
    <div class="row"><button class="btn primary" type="button" id="mkAdd">Add to my mistakes</button></div>`;
  area.append(add);
  add.querySelector("#mkAdd").onclick = () => {
    const w = add.querySelector("#mkW").value, r = add.querySelector("#mkR").value;
    if (!r.trim()) { X.toast("Write the correct version."); return; }
    X.toast(addMistake({ wrong: w, right: r, why: add.querySelector("#mkN").value, src: "Added by me", kind: w.trim() ? "phrase" : "word" }) ? "Added." : "That's already in your notebook.");
    X.goTo("coach", "mistakes");
  };

  const lc = el("div", "card");
  lc.innerHTML = `<div class="row between"><h3>All my mistakes</h3><span class="small mono">${all.length}</span></div>`;
  if (!all.length) lc.append(el("p", "small muted", "None yet."));
  const ul = el("div", "list");
  all.slice(0, 120).forEach(m => {
    const row = el("div", "fix");
    row.style.cssText = "grid-template-columns:1fr auto;display:grid;gap:8px;align-items:center";
    const learned = m.box >= BOX_DAYS.length - 1;
    row.innerHTML = `<div style="min-width:0">${m.kind === "word" ? `<span class="y">${esc(m.right)}</span> <span class="small muted">(word to say clearly)</span>` : `<span class="x">${esc(m.wrong)}</span><br><span class="y">${esc(m.right)}</span>`}
      <div class="small muted">${esc(m.src || "")} · ${learned ? "learned ✓" : "level " + m.box + " of 6"}</div></div>`;
    const del = btn("Delete", "ghost danger", () => { lsSet("iec-mistakes", lsGet("iec-mistakes", []).filter(x => x.id !== m.id)); X.goTo("coach", "mistakes"); });
    del.setAttribute("aria-label", "Delete this mistake");
    row.append(del); ul.append(row);
  });
  lc.append(ul); area.append(lc);
}

/* ---------- Habits ---------- */
function weekStart(t) { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
function renderHabits(area) {
  const { el, esc } = X;
  const hs = lsGet("iec-habits", []);
  const card = el("div", "card");
  card.innerHTML = `<div class="row between"><h3>Your speaking habits</h3><span class="tag free">Free</span></div>
    <p class="small muted">Counted from every recording you make in the app. Lower is better for fillers, “that one” and restarts. For speed, stay inside your ideal band (${X.L().lo}–${X.L().hi} words per minute).</p>`;
  area.append(card);
  if (hs.length < 2) { card.append(el("p", "small", "Record a few answers anywhere in the app, and your weekly charts appear here.")); return; }
  const thisW = weekStart(Date.now()), weeks = [];
  for (let i = 7; i >= 0; i--) weeks.push(thisW - i * 7 * DAY);
  const agg = weeks.map(ws => {
    const rs = hs.filter(h => h.t >= ws && h.t < ws + 7 * DAY), words = rs.reduce((n, h) => n + h.n, 0);
    const per = k => words ? rs.reduce((n, h) => n + h[k], 0) / words * 100 : null;
    const w = rs.filter(h => h.wpm > 0);
    return { ws, count: rs.length, fillers: per("fillers"), thatOne: per("thatOne"), restarts: words ? rs.reduce((n, h) => n + h.restarts + h.repeats, 0) / words * 100 : null, wpm: w.length ? w.reduce((n, h) => n + h.wpm, 0) / w.length : null };
  });
  const cur = agg[agg.length - 1], prev = [...agg].slice(0, -1).reverse().find(a => a.count);
  const metric = (key, label, unit, lowerBetter) => {
    const vals = agg.map(a => a[key]), max = Math.max(1, ...vals.filter(v => v != null)) * 1.15;
    const c = cur[key], p = prev ? prev[key] : null;
    let trend = "";
    if (c != null && p != null) {
      const better = lowerBetter ? c < p : (c >= X.L().lo && c <= X.L().hi);
      trend = `<span class="verdict ${better ? "v-good" : "v-warn"}">${lowerBetter ? (c < p ? "↓ better than last week" : c > p ? "↑ more than last week" : "same as last week") : (better ? "in your ideal band" : "outside your ideal band")}</span>`;
    }
    const bars = agg.map((a, i) => `<div title="${a[key] == null ? "no data" : a[key].toFixed(1)}" style="height:${a[key] == null ? 0 : Math.max(3, a[key] / max * 100)}%;${i === agg.length - 1 ? "" : "opacity:.55"}"></div>`).join("");
    return `<div class="card"><div class="row between"><h3>${label}</h3><span class="mono"><b>${c == null ? "–" : c.toFixed(key === "wpm" ? 0 : 1)}</b> <span class="small muted">${unit}</span></span></div>
      ${trend}<div class="bars" style="height:70px">${bars}</div>
      <div class="pace-scale"><span>8 weeks ago</span><span>this week</span></div></div>`;
  };
  const wrap = el("div", "stack"); wrap.style.gap = "14px";
  wrap.innerHTML = metric("fillers", "Filler words", "per 100 words", true) + metric("thatOne", "“that one / this one”", "per 100 words", true) + metric("restarts", "Restarts and repeated words", "per 100 words", true) + metric("wpm", "Speaking speed", "words/min", false);
  area.append(wrap);
  const worst = [["fillers", "Filler words: pause silently for one second instead of “um”, “like” or “basically”."], ["thatOne", "“that one”: say the real thing, for example “fix the mic” instead of “do that one”."], ["restarts", "Restarts: plan your sentence before you speak, and say it once, even if it's not perfect."]]
    .filter(([k]) => cur[k] != null).sort((a, b) => cur[b[0]] - cur[a[0]])[0];
  if (worst) area.append(el("div", "note", `<b>Focus this week:</b> ${esc(worst[1])}`));
  area.append(el("p", "small muted", `This week: ${cur.count} recordings.`));
}

/* ---------- Answer builder ---------- */
let builder = { tpl: "star", q: 0, target: 60, mode: "own" };
function renderBuilder(area) {
  const { el, esc, btn } = X;
  const tpl = TEMPLATES[builder.tpl];
  const notesAll = lsGet("iec-builder", {}), nkey = builder.tpl + "|" + builder.q, notes = notesAll[nkey] || (builder.tpl === "swot" ? (notesAll["swot|0"] || {}) : {});
  const card = el("div", "card");
  card.innerHTML = `<div class="row between"><h3>Answer builder</h3><span class="tag free">Free</span></div>
    <div class="row">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="chip" type="button" data-tp="${k}" aria-pressed="${builder.tpl === k}">${t.name}</button>`).join("")}</div>
    <p class="small muted">${esc(tpl.use)}</p>
    <label class="f" for="bq">Question<select id="bq">${tpl.questions.map((q, i) => `<option value="${i}" ${i === builder.q ? "selected" : ""}>${esc(q)}</option>`).join("")}</select></label>
    ${tpl.fields.map(([k, label, hint]) => `<label class="f" for="bf-${k}">${label}<textarea id="bf-${k}" data-k="${k}" style="min-height:60px" placeholder="${esc(hint)}">${esc(notes[k] || "")}</textarea></label>`).join("")}
    <div class="row"><button class="btn primary" type="button" id="bBuild">Build my answer</button></div>
    <div class="bOut stack" style="gap:10px"></div>`;
  area.append(card);
  card.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => { builder.tpl = b.dataset.tp; builder.q = 0; X.goTo("coach", "builder"); });
  card.querySelector("#bq").onchange = e => { builder.q = +e.target.value; X.goTo("coach", "builder"); };
  const read = () => { const n = {}; card.querySelectorAll("[data-k]").forEach(t => n[t.dataset.k] = t.value); const all = lsGet("iec-builder", {}); all[nkey] = n; lsSet("iec-builder", all); return n; };
  card.addEventListener("input", read);
  const out = card.querySelector(".bOut");
  const show = () => {
    const n = read(), script = buildScript(tpl, n);
    if (!script) { out.innerHTML = `<p class="small" style="color:var(--bad)">Write a few words in each box first.</p>`; return; }
    const q = tpl.questions[builder.q], words = wordsOf(script).length, secsAtPace = Math.round(words / ((X.L().lo + X.L().hi) / 2) * 60);
    out.innerHTML = `<h3>Your answer</h3><div class="fix small" style="white-space:pre-wrap">${esc(script)}</div>
      <p class="small muted">${words} words · about ${secsAtPace} seconds at your ideal pace.</p>
      <div class="row sp"></div>
      <div class="row" role="tablist" aria-label="Practice mode">
        <button class="chip" type="button" data-bm="read" aria-pressed="${builder.mode === "read"}">📖 Read it aloud</button>
        <button class="chip" type="button" data-bm="own" aria-pressed="${builder.mode !== "read"}">💬 My own words</button></div>
      ${builder.mode === "read" ? `<p class="small muted">Read your answer above out loud, slowly and clearly. The app checks every word and your speed.</p>`
        : `<div class="row"><span class="small" style="font-weight:600">Practise in:</span>${[30, 60, 90].map(s => `<button class="chip" type="button" data-tg="${s}" aria-pressed="${builder.target === s}">${s} s</button>`).join("")}</div>
      <p class="small">Now answer “${esc(q)}” in your own words, without reading. Try to hit every part.</p>`}
      <div class="bRes stack" style="gap:10px"></div>`;
    out.querySelector(".sp").append(X.spkBtn(script, "Hear it", X.L().rate), btn("Shadow it line by line", "ghost", () => { shadow.src = "own"; shadow.own = script; shadow.idx = 0; X.goTo("coach", "shadow"); }));
    out.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => { builder.target = +b.dataset.tg; out.querySelectorAll("[data-tg]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
    out.querySelectorAll("[data-bm]").forEach(b => b.onclick = () => { builder.mode = b.dataset.bm; show(); });
    const bRes = out.querySelector(".bRes");
    if (builder.mode === "read") {
      X.makeRecorder(out, { longForm: true, prompt: "Tap the mic and read your answer", onDone: (text, secs) => {
        if (!text) { bRes.innerHTML = ""; return; }
        if (X.partlyHeard(script, text)) { bRes.innerHTML = X.partlyHTML(text).replace("say the whole sentence", "read the whole answer"); return; }
        const r = X.readResult(script, text, secs);
        bRes.innerHTML = r.html;
        X.wireMiss(bRes);
        bRes.append(btn("Now say it in my own words", "", () => { builder.mode = "own"; show(); }));
        X.addLog({ kind: "read", label: tpl.name + " · " + q.slice(0, 45), wpm: r.a.wpm, fillers: r.a.fillers, score: r.clarity });
      } });
      return;
    }
    X.makeRecorder(out, { longForm: true, prompt: "Tap the mic and answer", onDone: (text, secs) => {
      if (!text) { bRes.innerHTML = ""; return; }
      const a = X.analyse(text, secs), tgt = builder.target;
      const tv = a.secs < tgt * 0.75 ? ["Too short: add more detail", "v-warn"] : a.secs > tgt * 1.2 ? ["Too long: cut to the main points", "v-warn"] : ["Good length", "v-good"];
      // A part counts as covered when you said at least 30% of its key words (or 3 of them) in any wording.
      const parts = tpl.fields.map(([k, label]) => {
        const v = (n[k] || "").trim(); if (!v) return null;
        const c = X.PDF.checkAnswer(v, text), w = c.points.reduce((s, p) => s + p.weight, 0) || 1;
        const pct = c.points.reduce((s, p) => s + p.pct * p.weight, 0) / w;
        return [label, pct >= 0.3 || pct * w >= 3];
      }).filter(Boolean);
      bRes.innerHTML = `<div class="row"><span class="verdict ${tv[1]}">${tv[0]}</span><span class="small mono">${a.secs}s of ${tgt}s</span></div>
        <h3>Parts you covered</h3><div class="row">${parts.map(([l, ok]) => `<span class="verdict ${ok ? "v-good" : "v-bad"}">${ok ? "✓" : "✗"} ${esc(l)}</span>`).join("")}</div>
        ${X.heardHTML(text)}
        ${parts.some(p => !p[1]) ? `<p class="small">Missing: <b>${parts.filter(p => !p[1]).map(p => esc(p[0])).join(", ")}</b>. Interviewers notice when the ${esc(parts.filter(p => !p[1]).map(p => p[0])[0])} is missing.</p>` : `<p class="small" style="color:var(--good);font-weight:600">You covered every part. Great structure!</p>`}
        ${X.paceMeter(a.wpm)}`;
      X.addLog({ kind: "answer", label: tpl.name + " · " + q.slice(0, 45), wpm: a.wpm, fillers: a.fillers });
    } });
  };
  card.querySelector("#bBuild").onclick = show;
  if (buildScript(tpl, notes)) show();
}

/* ---------- 30-day plan ---------- */
function renderPlan(area) {
  const { el, esc, btn } = X;
  const p = plan();
  const card = el("div", "card");
  area.append(card);
  if (!p) {
    card.innerHTML = `<div class="row between"><h3>30-day interview plan</h3><span class="tag free">Free</span></div>
      <p class="small">One mission a day, about 10–15 minutes. Each mission uses a part of this app and builds on the last. Start today.</p>
      <ol class="small" style="margin:0;padding-left:20px">${MISSIONS.slice(0, 5).map(m => `<li>${esc(m[0])}</li>`).join("")}<li class="muted">…and 25 more</li></ol>`;
    card.append(btn("Start the 30-day plan", "primary", () => { lsSet("iec-plan", { start: startOfDay(), done: [] }); X.goTo("coach", "plan"); }));
    return;
  }
  const d = planDay(p), done = new Set(p.done || []);
  const m = MISSIONS[d - 1];
  card.innerHTML = `<p class="eyebrow">Day ${d} of 30 · ${done.size} done</p><h2>${esc(m[0])}</h2><p class="small">${esc(m[1])}</p><div class="row pm"></div>`;
  card.querySelector(".pm").append(btn("Start this mission", "primary", () => X.goTo(m[2], m[3])),
    btn(done.has(d) ? "Mark not done" : "Mark as done", "", () => { markDay(d, !done.has(d)); if (!done.has(d)) X.toast("Mission done! See you tomorrow."); X.goTo("coach", "plan"); }));

  const grid = el("div", "card");
  grid.innerHTML = `<h3>All 30 days</h3><div class="list">${MISSIONS.map((mm, i) => { const n = i + 1; return `<div class="row" style="flex-wrap:nowrap;gap:10px;${n > d ? "opacity:.55" : ""}"><span class="box" style="${done.has(n) ? "background:var(--accent);border-color:var(--accent)" : ""}">${done.has(n) ? "✓" : ""}</span><span class="small" style="min-width:0"><b>Day ${n}${n === d ? " (today)" : ""}:</b> ${esc(mm[0])}</span></div>`; }).join("")}</div>`;
  area.append(grid);

  const rem = el("div", "card");
  rem.innerHTML = `<h3>Daily reminder</h3>
    <p class="small muted">The app can't wake your phone by itself, so it adds a daily reminder to Google Calendar instead. You'll get a normal phone notification.</p>
    <label class="f" for="remT">Reminder time<input id="remT" type="time" value="${lsGet("iec-remtime", "19:00")}"></label>
    <div class="row rb"></div>`;
  area.append(rem);
  rem.querySelector(".rb").append(btn("Add to Google Calendar", "primary", () => {
    const t = rem.querySelector("#remT").value || "19:00"; lsSet("iec-remtime", t);
    const [hh, mm] = t.split(":").map(Number), s = new Date(); s.setHours(hh, mm, 0, 0); if (s < new Date()) s.setDate(s.getDate() + 1);
    const e = new Date(s.getTime() + 15 * 60000), f = x => x.getFullYear() + String(x.getMonth() + 1).padStart(2, "0") + String(x.getDate()).padStart(2, "0") + "T" + String(x.getHours()).padStart(2, "0") + String(x.getMinutes()).padStart(2, "0") + "00";
    const url = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("English practice: today's mission") + "&details=" + encodeURIComponent("Open https://coach.sumanthcorp.online and do today's mission in Coach → 30-day plan.") + "&dates=" + f(s) + "/" + f(e) + "&ctz=" + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata") + "&recur=" + encodeURIComponent("RRULE:FREQ=DAILY;COUNT=30");
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.append(a); a.click(); a.remove();
  }), btn("Restart plan", "ghost danger", () => {
    const dlg = document.getElementById("modal"), box = document.getElementById("modalIn");
    box.innerHTML = `<h3>Restart the 30-day plan?</h3><p class="small">You'll start again from Day 1 today. Your practice history stays.</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="rpC">Cancel</button><button class="btn danger" type="button" id="rpY">Restart</button></div>`;
    box.querySelector("#rpC").onclick = () => dlg.close();
    box.querySelector("#rpY").onclick = () => { lsSet("iec-plan", { start: startOfDay(), done: [] }); dlg.close(); X.goTo("coach", "plan"); };
    dlg.showModal();
  }));
}
