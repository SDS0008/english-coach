// AI coaching: a free route (opens Claude with the message filled in) and an optional
// paid route (the user's own Anthropic API key, locked with a PIN, stored only on this device).

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm";
const MODEL = "claude-opus-5-5";
// Claude Opus 5.5 list price, US$ per million tokens. Rupee rate is approximate.
const USD_IN = 4, USD_OUT = 20, INR_PER_USD = 85;

const LS_KEY = "iec-apikey", LS_SPEND = "iec-spend", LS_LIMIT = "iec-limit", LS_FAILS = "iec-pinfails";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- free route ---------- */
export async function openFree(prompt) {
  try { await navigator.clipboard.writeText(prompt); } catch {}
  const url = "https://claude.ai/new?q=" + encodeURIComponent(prompt);
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
}

/* ---------- key storage (AES-GCM, key derived from the PIN) ---------- */
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export function hasKey() { return !!lsGet(LS_KEY, null); }
export async function saveKey(apiKey, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await deriveKey(pin, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(apiKey)));
  lsSet(LS_KEY, { salt: b64(salt), iv: b64(iv), ct: b64(ct) });
  lsSet(LS_FAILS, { n: 0, until: 0 });
  unlocked = null;
}
export function removeKey() { try { localStorage.removeItem(LS_KEY); } catch {} unlocked = null; }
async function decryptKey(pin) {
  const s = lsGet(LS_KEY, null); if (!s) throw new Error("nokey");
  const k = await deriveKey(pin, unb64(s.salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, k, unb64(s.ct));
  return dec.decode(pt);
}
let unlocked = null; // {key, until}

/* ---------- spending ---------- */
const monthKey = () => new Date().toISOString().slice(0, 7);
export function spendThisMonth() { const s = lsGet(LS_SPEND, {}); return s[monthKey()] || 0; }
function addSpend(inr) { const s = lsGet(LS_SPEND, {}); s[monthKey()] = (s[monthKey()] || 0) + inr; lsSet(LS_SPEND, s); }
export function getLimit() { return lsGet(LS_LIMIT, 200); }
export function setLimit(v) { lsSet(LS_LIMIT, Math.max(0, Number(v) || 0)); }
export function estimateINR(promptChars, outTokens = 1500) {
  const inTok = promptChars / 3.5 + 400;
  return ((inTok * USD_IN + outTokens * USD_OUT) / 1e6) * INR_PER_USD;
}
export const rupees = v => v < 1 ? "₹" + v.toFixed(2) : "₹" + v.toFixed(1);

/* ---------- PIN dialog ---------- */
function pinDialog(title, costText) {
  const dlg = document.getElementById("modal"), box = document.getElementById("modalIn");
  const fails = lsGet(LS_FAILS, { n: 0, until: 0 });
  const lockedFor = Math.ceil((fails.until - Date.now()) / 60000);
  return new Promise(resolve => {
    box.innerHTML = `
      <div class="row between"><h3>${title}</h3><span class="tag paid">Paid</span></div>
      <p class="small">This uses your paid API credit: about <b>${costText}</b>.<br>This month: ${rupees(spendThisMonth())} of ${rupees(getLimit())} limit.</p>
      ${lockedFor > 0 ? `<p class="small" style="color:var(--bad)">Too many wrong PINs. Try again in ${lockedFor} min.</p>` :
      `<label class="f" for="pinAsk">Enter your PIN<input id="pinAsk" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></label>
       <label class="small row" style="gap:6px"><input type="checkbox" id="pinStay" style="width:auto"> Don't ask again for 10 minutes</label>
       <p class="small" id="pinErr" style="color:var(--bad)" hidden></p>`}
      <div class="row" style="justify-content:flex-end">
        <button class="btn" type="button" id="pinCancel">Cancel</button>
        ${lockedFor > 0 ? "" : `<button class="btn paid" type="button" id="pinOk">Pay and continue</button>`}
      </div>`;
    const done = v => { dlg.close(); resolve(v); };
    box.querySelector("#pinCancel").onclick = () => done(null);
    dlg.oncancel = e => { e.preventDefault(); done(null); };
    const ok = box.querySelector("#pinOk");
    if (ok) {
      const inp = box.querySelector("#pinAsk"), err = box.querySelector("#pinErr");
      const submit = async () => {
        ok.disabled = true;
        try {
          const key = await decryptKey(inp.value);
          lsSet(LS_FAILS, { n: 0, until: 0 });
          if (box.querySelector("#pinStay").checked) unlocked = { key, until: Date.now() + 10 * 60000 };
          done(key);
        } catch {
          const f = lsGet(LS_FAILS, { n: 0, until: 0 }); f.n++;
          if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; }
          lsSet(LS_FAILS, f);
          err.hidden = false; err.textContent = f.until > Date.now() ? "Too many wrong PINs. Locked for 5 minutes." : "Wrong PIN.";
          inp.value = ""; ok.disabled = f.until > Date.now();
        }
      };
      ok.onclick = submit;
      inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      setTimeout(() => inp.focus(), 50);
    }
    dlg.showModal();
  });
}

/* ---------- paid call ---------- */
export class AiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

export async function runPaid({ title, system, messages, maxTokens = 4000 }) {
  if (!hasKey()) throw new AiError("nokey", "Set up paid AI in Settings first.");
  if (!navigator.onLine) throw new AiError("offline", "You're offline. Connect to the internet and try again.");
  const chars = (system || "").length + messages.reduce((n, m) => n + String(m.content).length, 0);
  const est = estimateINR(chars);
  if (spendThisMonth() + est > getLimit()) throw new AiError("limit", `This would go over your monthly limit of ${rupees(getLimit())}. Change it in Settings.`);
  let key;
  if (unlocked && unlocked.until > Date.now()) key = unlocked.key;
  else { key = await pinDialog(title, "≈ " + rupees(est)); if (!key) throw new AiError("cancelled", "Cancelled."); }

  let Anthropic;
  try { ({ default: Anthropic } = await import(SDK_URL)); }
  catch { throw new AiError("offline", "Couldn't load the AI library. Check your internet."); }
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  let resp;
  try {
    resp = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages
    });
  } catch (e) {
    const s = e && e.status;
    if (s === 401) throw new AiError("auth", "The API key isn't valid. Remove it and add it again in Settings.");
    if (s === 403) throw new AiError("auth", "This API key isn't allowed to use this model.");
    if (s === 429) throw new AiError("rate", "Too many requests. Wait a minute and try again.");
    if (s === 400 && /credit|balance|billing/i.test(String(e.message))) throw new AiError("credit", "Your API credit has run out. Add credit at console.anthropic.com.");
    if (s >= 500) throw new AiError("server", "Claude is busy right now. Try again shortly.");
    throw new AiError("network", "Couldn't reach Claude. Check your internet and try again.");
  }
  const u = resp.usage || {};
  const cost = (((u.input_tokens || 0) * USD_IN + (u.output_tokens || 0) * USD_OUT) / 1e6) * INR_PER_USD;
  addSpend(cost);
  if (resp.stop_reason === "refusal") throw new AiError("refused", "Claude couldn't answer this one. Try rewording.");
  const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!text) throw new AiError("empty", "No answer came back. Try again.");
  return { text, cost };
}

export function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = text.search(/[\[{]/), b = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  throw new AiError("format", "The answer came back in an odd format. Try again.");
}
