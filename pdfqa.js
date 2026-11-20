// PDF question-and-answer practice: read a PDF on the device, find the questions and answers,
// and check a spoken answer against the PDF's answer. Everything here runs on the phone, for free.
import { wordsOf, near, sentences, STOP } from "./text.js";

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";

let pdfjsReady = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsReady) pdfjsReady = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; res(window.pdfjsLib); };
    s.onerror = () => { pdfjsReady = null; rej(new Error("Couldn't load the PDF reader. Check your internet and try again.")); };
    document.head.append(s);
  });
  return pdfjsReady;
}

// Returns the PDF's text as an array of lines.
export async function pdfToLines(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let p = 1; p <= Math.min(doc.numPages, 80); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let cur = "", lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && cur.trim()) { lines.push(cur.trim()); cur = ""; }
      cur += it.str;
      if (it.hasEOL) { if (cur.trim()) lines.push(cur.trim()); cur = ""; }
      if (y !== null) lastY = y;
    }
    if (cur.trim()) lines.push(cur.trim());
    lines.push(""); // page break
  }
  return lines;
}

const Q_MARK = /^\s*(?:Q(?:uestion)?\s*(?:no\.?\s*)?\d*\s*[:.)\-–]|\d{1,3}\s*[.)]\s+)/i;
const A_MARK = /^\s*(?:A(?:ns(?:wer)?)?\s*\d*\s*[:.)\-–])\s*/i;
const ASK_WORD = /^(what|why|how|when|where|who|which|tell|describe|explain|walk|give|can|could|would|do|did|does|have|has|are|is|should|share|define|list|name)\b/i;

// Finds question / answer pairs in lines of text.
export function parseQA(lines) {
  const out = []; let cur = null;
  const push = () => { if (cur && cur.q.trim().length > 5) out.push({ q: cur.q.trim(), a: cur.a.trim() }); cur = null; };
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^(page\s*)?\d{1,3}(\s*(of|\/)\s*\d{1,3})?$/i.test(line)) continue; // page numbers
    const isA = A_MARK.test(line);
    const body = line.replace(Q_MARK, "").trim();
    const marked = !isA && Q_MARK.test(line) && (body.includes("?") || ASK_WORD.test(body));
    const bareQ = !isA && /\?\s*$/.test(line) && line.length < 220 && (!cur || cur.qDone);
    if (marked || bareQ) {
      push();
      cur = { q: body, a: "", qDone: /[?.]\s*$/.test(body) };
      continue;
    }
    if (!cur) continue;
    if (!cur.qDone) {
      if (isA) { cur.qDone = true; cur.a = line.replace(A_MARK, ""); }
      else { cur.q += " " + line; if (/[?]\s*$/.test(line) || cur.q.length > 300) cur.qDone = true; }
      continue;
    }
    cur.a += " " + line.replace(A_MARK, "");
  }
  push();
  return out.map(x => ({ q: x.q.slice(0, 400), a: x.a.slice(0, 3000) }));
}

const keywords = t => [...new Set(wordsOf(t).filter(w => w.length >= 3 && !STOP.has(w)))];
// "learning", "learned", "learns" -> "learn"; "clearly" -> "clear"
const stem = w => w.length > 4 ? w.replace(/(ingly|edly|ations?|ing|ness|ment|ly|ed|es|s)$/, "") : w;

// Compares a spoken answer with the PDF answer. Wording can differ; it looks for the key ideas.
export function checkAnswer(expected, spoken) {
  const said = wordsOf(spoken);
  const saidStems = said.map(stem);
  const best = kw => { const k = stem(kw); let m = 0; for (let i = 0; i < said.length && m < 2; i++) m = Math.max(m, near(kw, said[i]), saidStems[i] === k ? 2 : near(k, saidStems[i])); return m; };
  const points = sentences(expected).map(s => {
    const kws = keywords(s);
    if (!kws.length) return null;
    let got = 0; const missed = [], close = [];
    kws.forEach(k => { const b = best(k); if (b === 2) got++; else if (b === 1) { got += 0.8; close.push(k); } else missed.push(k); });
    return { text: s, pct: got / kws.length, missed, close, weight: kws.length };
  }).filter(Boolean);
  const totalW = points.reduce((n, p) => n + p.weight, 0) || 1;
  const raw = points.reduce((n, p) => n + p.pct * p.weight, 0) / totalW;
  // Half the score is key words (~65% of them = full marks), half is how many PDF points were covered.
  const words = Math.min(100, raw / 0.65 * 100);
  const covered = points.length ? points.filter(p => p.pct >= 0.5).length / points.length * 100 : 100;
  const content = expected.trim() ? Math.round(words * 0.5 + covered * 0.5) : null;
  const verdict = content === null ? null : content >= 80 ? ["Correct: you covered the main points", "v-good"] : content >= 45 ? ["Partly correct: some points missing", "v-warn"] : ["Not quite: most points missing", "v-bad"];
  const missedWords = [...new Set(points.flatMap(p => p.missed))];
  const closeWords = [...new Set(points.flatMap(p => p.close))];

  // Fumbles: repeated words ("I I", "the the") and restarts.
  const repeats = [];
  for (let i = 1; i < said.length; i++) if (said[i] === said[i - 1] && said[i].length < 8) repeats.push(said[i] + " " + said[i]);
  return { content, verdict, points, missedWords, closeWords, repeats };
}

// Free grammar check (LanguageTool's public service). Casing and punctuation are skipped
// because speech-to-text text has none.
export async function grammarCheck(text) {
  text = text.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|ll|d)\b/gi, "I'$1"); // speech-to-text often writes "i"
  const body = new URLSearchParams({ text: text.slice(0, 5000), language: "en-US" });
  const r = await fetch("https://api.languagetool.org/v2/check", { method: "POST", body });
  if (r.status === 429) throw new Error("The free grammar checker is busy. Wait a minute and try again.");
  if (!r.ok) throw new Error("Couldn't reach the grammar checker. Check your internet.");
  const j = await r.json();
  const skip = new Set(["CASING", "PUNCTUATION", "TYPOGRAPHY", "STYLE", "REDUNDANCY"]);
  return j.matches
    .filter(m => !skip.has(m.rule?.category?.id) && !/UPPERCASE|COMMA|WHITESPACE|PUNCT|EN_QUOTES/.test(m.rule?.id || ""))
    .filter(m => { const said = text.substr(m.offset, m.length), fix = m.replacements?.[0]?.value || ""; return said.toLowerCase() !== fix.toLowerCase(); })
    .map(m => ({
      said: text.substr(m.offset, m.length),
      fix: (m.replacements && m.replacements[0] && m.replacements[0].value) || "",
      why: m.shortMessage || m.message,
      sentence: (m.sentence || "").trim().slice(0, 300),
      spelling: m.rule?.issueType === "misspelling"
    }));
}
