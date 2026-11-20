// Offline speech-to-text: records the microphone, then turns the recording into words
// on the phone with Whisper. No internet is needed once the model has been downloaded.

export const MODELS = {
  tiny: { id: "Xenova/whisper-tiny.en", mb: 41, label: "Fast · about 41 MB" },
  base: { id: "Xenova/whisper-base.en", mb: 77, label: "More accurate · about 77 MB (slower)" }
};
const LS = "iec-offline-model";
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- model state ---------- */
export function chosenModel() { return lsGet(LS, { model: "tiny", ready: {} }).model; }
export function setChosenModel(m) { const s = lsGet(LS, { model: "tiny", ready: {} }); s.model = MODELS[m] ? m : "tiny"; lsSet(LS, s); }
export function isReady(m = chosenModel()) { return !!lsGet(LS, { ready: {} }).ready?.[m]; }
function markReady(m, v) { const s = lsGet(LS, { model: "tiny", ready: {} }); s.ready = s.ready || {}; s.ready[m] = v; lsSet(LS, s); }
export async function removeModels() {
  try { await caches.delete("transformers-cache"); } catch {}
  lsSet(LS, { model: chosenModel(), ready: {} });
  if (worker) { worker.terminate(); worker = null; }
}

/* ---------- background worker ---------- */
let worker = null, seq = 0;
const pending = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./whisper-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = e => {
    const { id, type, ...d } = e.data, p = pending.get(id);
    if (!p) return;
    if (type === "progress") { p.onProgress && p.onProgress(d); return; }
    pending.delete(id);
    type === "done" ? p.resolve(d) : p.reject(new Error(d.message || "Offline speech engine failed."));
  };
  worker.onerror = () => { pending.forEach(p => p.reject(new Error("The offline speech engine couldn't start."))); pending.clear(); worker = null; };
  return worker;
}
function call(msg, onProgress, transfer) {
  const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onProgress }); getWorker().postMessage({ id, ...msg }, transfer || []); });
}

// Downloads the model (once). onProgress gets a 0–100 number.
export async function download(m = chosenModel(), onProgress) {
  const files = {};
  await call({ type: "load", model: MODELS[m].id }, d => {
    if (d.file && d.total) files[d.file] = { loaded: d.loaded, total: d.total };
    const all = Object.values(files), tot = all.reduce((n, f) => n + f.total, 0), got = all.reduce((n, f) => n + f.loaded, 0);
    if (tot && onProgress) onProgress(Math.min(99, Math.round(got / tot * 100)));
  });
  markReady(m, true);
  onProgress && onProgress(100);
}

export async function transcribe(samples, m = chosenModel()) {
  const { text } = await call({ type: "transcribe", model: MODELS[m].id, audio: samples }, null, [samples.buffer]);
  return String(text || "")
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, " ") // [BLANK_AUDIO], (coughs), music marks
    .replace(/\s+/g, " ").trim();
}

/* ---------- microphone capture ---------- */
export async function startCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(1000);
  const release = () => stream.getTracks().forEach(t => t.stop());
  return {
    async stop() {
      await new Promise(r => { rec.onstop = r; try { rec.stop(); } catch { r(); } });
      release();
      return decodeTo16k(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    },
    cancel() { try { rec.stop(); } catch {} release(); }
  };
}

async function decodeTo16k(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let audio;
  try { audio = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { ctx.close(); }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * 16000)), 16000);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return new Float32Array(out.getChannelData(0));
}

// Finds when speech starts and ends in the recording, and counts long pauses (over 2.5 s).
export function speechTiming(samples) {
  const frame = 480; // 30 ms at 16 kHz
  const rms = [];
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let s = 0; for (let j = i; j < i + frame; j++) s += samples[j] * samples[j];
    rms.push(Math.sqrt(s / frame));
  }
  if (!rms.length) return { secs: 0, pauses: 0, speech: false };
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)];
  const peak = sorted[Math.floor(sorted.length * 0.98)];
  const thr = Math.max(0.008, floor * 3, peak * 0.12);
  const on = rms.map(v => v > thr);
  const first = on.indexOf(true), last = on.lastIndexOf(true);
  if (first < 0 || peak < 0.01) return { secs: 0, pauses: 0, speech: false };
  let pauses = 0, run = 0;
  for (let i = first; i <= last; i++) { if (!on[i]) run++; else { if (run * 0.03 > 2.5) pauses++; run = 0; } }
  return { secs: (last - first + 1) * 0.03, pauses, speech: true };
}

export const supported = () => !!(window.MediaRecorder && navigator.mediaDevices && window.Worker && window.OfflineAudioContext);
