// Q-Bank: topic-based speaking questions (daily conversation, interview, presentation,
// group discussion, convincing, polite declining and more), a daily task of 3 questions
// per topic, and record / listen / "We heard" practice. Works online and offline.
// The questions live in qbank.json; when online, the app fetches the latest copy, so
// new questions published to the site appear automatically.
import { wordsOf } from "./text.js";

let X = null;
export function init(ctx) { X = ctx; }

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const PER_DAY = 3;
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/* ---------- loading and updating the bank ---------- */
let bank = lsGet("iec-qbank", null), status = bank ? "saved" : "loading", loading = null;
export function load() {
  if (loading) return loading;
  loading = fetch("qbank.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error("http"); return r.json(); })
    .then(fresh => {
      if (!fresh || !Array.isArray(fresh.models)) throw new Error("bad");
      const before = bank ? new Set(bank.models.flatMap(m => m.questions.map(q => q.id))) : null;
      const isNew = !bank || bank.version !== fresh.version;
      bank = fresh; lsSet("iec-qbank", fresh); lsSet("iec-qbank-checked", Date.now());
      status = navigator.onLine ? "updated" : "saved";
      if (isNew && before) {
        const added = fresh.models.flatMap(m => m.questions).filter(q => !before.has(q.id)).length;
        if (added) X.toast(`Q-Bank updated: ${added} new question${added > 1 ? "s" : ""}.`);
      }
      return bank;
    })
    .catch(() => { status = bank ? "saved" : "missing"; return bank; })
    .finally(() => { loading = null; });
  return loading;
}

/* ---------- daily task ---------- */
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rand(seed) { return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// The same 3 questions all day for each topic; they change tomorrow. Questions you
// answered recently are less likely to come back soon.
function todays(model, day = dayKey()) {
  const done = lsGet("iec-qb-done", {});
  const r = rand(hash(day + "|" + model.id));
  // Only answers from earlier days push a question back; today's answers keep today's list stable.
  const order = model.questions.map(q => ({ q, k: r() + ((done[q.id] || []).some(d => d < day) ? 0.6 : 0) })).sort((a, b) => a.k - b.k).map(x => x.q);
  return order.slice(0, Math.min(PER_DAY, order.length));
}
const doneToday = () => new Set(Object.entries(lsGet("iec-qb-done", {})).filter(([, days]) => days.includes(dayKey())).map(([id]) => id));
function markDone(id) {
  const d = lsGet("iec-qb-done", {}); d[id] = d[id] || [];
  if (!d[id].includes(dayKey())) d[id].push(dayKey());
  d[id] = d[id].slice(-30); lsSet("iec-qb-done", d);
}
export function todayProgress() {
  if (!bank) return null;
  const dt = doneToday(); let total = 0, got = 0;
  bank.models.forEach(m => todays(m).forEach(q => { total++; if (dt.has(q.id)) got++; }));
  return { got, total };
}

/* ---------- screens ---------- */
let view = "today", browseModel = null, current = null; // current = {mid, qid}
export function render(body) {
  const { el, esc, btn } = X;
  body.innerHTML = "";
  if (!bank) {
    body.append(el("div", "card", `<p class="small">${status === "missing" ? "The question bank couldn't load. Connect to the internet once, then it works offline too." : "Loading questions…"}</p>`));
    load().then(b => { if (b) render(body); });
    return;
  }
  const p = todayProgress();
  const checked = lsGet("iec-qbank-checked", 0);
  const head = el("div", "card");
  head.innerHTML = `<div class="row between"><h3>Today's task</h3><span class="mono small qbCount">${p.got} of ${p.total}</span></div>
    <div class="prog"><div class="qbBar" style="width:${p.total ? p.got / p.total * 100 : 0}%"></div></div>
    <p class="small muted">${PER_DAY} questions from every topic, new ones each day. Record your answer, listen back, and see what the mic heard.</p>
    <p class="small muted">${navigator.onLine ? "● Questions up to date" : "● Offline: using saved questions"}${checked ? ` · checked ${new Date(checked).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""} · ${bank.models.reduce((n, m) => n + m.questions.length, 0)} questions in ${bank.models.length} topics</p>`;
  body.append(head);

  const chips = el("div", "row");
  chips.innerHTML = [["today", "Today's task"], ["browse", "Browse all"]].map(([k, t]) => `<button class="chip" type="button" data-qv="${k}" aria-pressed="${view === k}">${t}</button>`).join("");
  chips.querySelectorAll("[data-qv]").forEach(b => b.onclick = () => { view = b.dataset.qv; current = null; render(body); });
  body.append(chips);

  if (current) { renderPractice(body); }
  if (view === "today") renderToday(body); else renderBrowse(body);
}

function rowFor(q, m, isDone, body) {
  const { el, esc, btn } = X;
  const row = el("div", "check" + (isDone ? " on" : ""));
  row.innerHTML = `<span class="box" aria-hidden="true">${isDone ? "✓" : ""}</span><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${esc(q.q)}</div></div>`;
  row.append(btn(isDone ? "Again" : "Practise", "ghost", () => { current = { mid: m.id, qid: q.id }; render(body); window.scrollTo({ top: 0, behavior: "smooth" }); }));
  return row;
}

function renderToday(body) {
  const { el, esc } = X;
  const dt = doneToday();
  let opened = false;
  bank.models.forEach(m => {
    const qs = todays(m), got = qs.filter(q => dt.has(q.id)).length;
    const d = el("details", "card");
    if (!opened && got < qs.length && !current) { d.open = true; opened = true; }
    d.innerHTML = `<summary><div style="min-width:0"><h3>${esc(m.name)} ${got === qs.length ? "✓" : ""}</h3><p class="small muted">${got} of ${qs.length} done · ${esc(m.about)}</p></div></summary><div class="list"></div>`;
    const list = d.querySelector(".list");
    qs.forEach(q => list.append(rowFor(q, m, dt.has(q.id), body)));
    body.append(d);
  });
}

function renderBrowse(body) {
  const { el, esc } = X;
  browseModel = browseModel || bank.models[0].id;
  const chips = el("div", "row");
  chips.innerHTML = bank.models.map(m => `<button class="chip" type="button" data-bm="${m.id}" aria-pressed="${browseModel === m.id}">${esc(m.name)}</button>`).join("");
  chips.querySelectorAll("[data-bm]").forEach(b => b.onclick = () => { browseModel = b.dataset.bm; render(body); });
  body.append(chips);
  const m = bank.models.find(x => x.id === browseModel) || bank.models[0];
  const done = lsGet("iec-qb-done", {});
  const card = el("div", "card");
  card.innerHTML = `<h3>${esc(m.name)}</h3><p class="small muted">${esc(m.about)}</p><div class="list"></div>`;
  m.questions.forEach(q => card.querySelector(".list").append(rowFor(q, m, !!(done[q.id] && done[q.id].length), body)));
  body.append(card);
}

function nextUndone(fromId) {
  const dt = doneToday();
  const all = bank.models.flatMap(m => todays(m).map(q => ({ m, q })));
  const i = all.findIndex(x => x.q.id === fromId);
  return [...all.slice(i + 1), ...all.slice(0, i + 1)].find(x => !dt.has(x.q.id) && x.q.id !== fromId) || null;
}

// A phrase counts as used when most of its words appear in your answer.
function usedPhrase(p, said) {
  const w = wordsOf(p).filter(x => x.length > 2);
  if (!w.length) return false;
  const s = new Set(said);
  return w.filter(x => s.has(x)).length / w.length >= 0.6;
}

function renderPractice(body) {
  const { el, esc, btn } = X;
  const m = bank.models.find(x => x.id === current.mid), q = m && m.questions.find(x => x.id === current.qid);
  if (!q) { current = null; return; }
  const card = el("div", "card");
  card.style.borderColor = "var(--accent)";
  card.innerHTML = `<div class="row between"><span class="eyebrow">${esc(m.name)}</span><button class="btn ghost close" type="button">✕ Close</button></div>
    <h2>${esc(q.q)}</h2>
    <p class="small"><b>Tip:</b> ${esc(q.tip)}</p>
    <div class="row sp"></div>
    <div><p class="small" style="font-weight:600">Useful phrases</p><div class="row ph"></div></div>
    <div class="res stack" style="gap:12px"></div>`;
  body.append(card);
  card.querySelector(".close").onclick = () => { current = null; render(body); };
  card.querySelector(".sp").append(X.spkBtn(q.q, "Hear the question", () => X.L().rate));
  const ph = card.querySelector(".ph");
  q.phrases.forEach(p => { const c = el("button", "chip"); c.type = "button"; c.textContent = p; c.onclick = () => X.say(p, X.L().rate); ph.append(c); });
  const res = card.querySelector(".res");

  X.makeRecorder(card, { longForm: true, prompt: "Tap the mic and answer out loud", onDone: (text, secs) => {
    if (!text) { res.innerHTML = ""; ph.querySelectorAll(".chip").forEach(c => c.removeAttribute("aria-pressed")); return; }
    const a = X.analyse(text, secs), said = wordsOf(text);
    const used = q.phrases.map(p => usedPhrase(p, said));
    ph.querySelectorAll(".chip").forEach((c, i) => c.setAttribute("aria-pressed", used[i]));
    const c = X.PDF.checkAnswer(q.sample, text);
    res.innerHTML = `<div class="stats"><div class="stat"><b>${a.secs}s</b><span>Length</span></div><div class="stat"><b>${a.n}</b><span>Words</span></div><div class="stat"><b>${a.fillers}</b><span>Fillers</span></div></div>
      ${X.heardHTML(text)}
      <p class="small">You used <b>${used.filter(Boolean).length} of ${q.phrases.length}</b> useful phrases${used.some(Boolean) ? " (dark chips above)" : ". Try to use at least one next time"}.</p>
      ${X.paceMeter(a.wpm)}
      <details class="card" style="padding:12px"><summary><h3>Compare with a sample answer</h3></summary>
        <p class="small muted">This is just one good way to answer. Your own words are fine.</p>
        <div class="fix small" style="white-space:pre-wrap">${esc(q.sample)}</div>
        <p class="small">Your answer shared <b>${c.content ?? 0}%</b> of the sample's key ideas.</p>
        <div class="row smp"></div></details>
      <div class="nxt row"></div>`;
    res.querySelector(".smp").append(X.spkBtn(q.sample, "Hear the sample", () => X.L().rate), btn("Shadow it", "ghost", () => X.shadowText(q.sample)));
    const core = `${X.learner()}\nSpeaking practice topic: ${m.name}.\nQuestion: "${q.q}"\nMy spoken answer (speech-to-text, ignore punctuation): """${text.slice(0, 1500)}"""\nMeasured: ${a.secs} seconds, ${a.wpm} words per minute, ${a.fillers} filler words.`;
    X.aiPanel(res, { label: "AI feedback on this answer",
      freePrompt: () => `${X.COACH}\n${core}\nGive short feedback: 1) how natural and polite it sounds for this situation, 2) up to 4 grammar or phrasing corrections as ❌ → ✅, 3) 3 better phrases for this situation, 4) a stronger version of my answer in under 90 words.` });
    markDone(q.id);
    const tp = todayProgress(), cnt = body.querySelector(".qbCount"), bar = body.querySelector(".qbBar");
    if (cnt) cnt.textContent = `${tp.got} of ${tp.total}`;
    if (bar) bar.style.width = (tp.total ? tp.got / tp.total * 100 : 0) + "%";
    X.addLog({ kind: "qbank", label: m.name + " · " + q.q.slice(0, 50), wpm: a.wpm, fillers: a.fillers });
    const nx = nextUndone(q.id), nxt = res.querySelector(".nxt");
    if (nx) nxt.append(btn(`Next: ${nx.m.name} →`, "primary", () => { current = { mid: nx.m.id, qid: nx.q.id }; render(body); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    else nxt.append(el("p", "small", `<b style="color:var(--good)">Today's task is complete. Well done!</b>`));
  } });
}
