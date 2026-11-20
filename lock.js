// Password screen. The app only starts after the right password.
// It asks every time the app is opened, and again after the app has been in the background
// for more than a minute. Only a salted fingerprint (PBKDF2-SHA256) of the password is stored
// in lock-config.js, never the password itself. Set or change it with set-password.ps1.
import { LOCK } from "./lock-config.js";

const AWAY_MS = 60 * 1000;
let started = false, hiddenAt = 0;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const fromHex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

async function check(pw) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(LOCK.salt), iterations: LOCK.iterations }, key, 256);
  return hex(bits) === LOCK.hash;
}

function startApp() {
  document.documentElement.classList.remove("locked");
  if (!started) { started = true; import("./app.js"); }
}

function showLock(reason) {
  if (document.getElementById("lockScreen")) return;
  document.documentElement.classList.add("locked");
  const box = document.createElement("div");
  box.id = "lockScreen";
  box.innerHTML = `
    <form class="lock-card" autocomplete="off">
      <div class="lock-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
      <h1>Interview English</h1>
      <p class="lock-sub">${reason || "Enter your password to open the app."}</p>
      <label for="lockPw" class="lock-label">Password</label>
      <input id="lockPw" type="password" autocomplete="current-password" required>
      <p class="lock-err" id="lockErr" aria-live="polite"></p>
      <button type="submit" id="lockGo">Open</button>
    </form>`;
  document.body.append(box);
  const form = box.querySelector("form"), pw = box.querySelector("#lockPw"), err = box.querySelector("#lockErr"), go = box.querySelector("#lockGo");
  let fails = 0, waitUntil = 0;
  setTimeout(() => pw.focus(), 50);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (Date.now() < waitUntil) { err.textContent = `Too many tries. Wait ${Math.ceil((waitUntil - Date.now()) / 1000)} seconds.`; return; }
    go.disabled = true; err.textContent = "Checking…";
    let ok = false;
    try { ok = await check(pw.value); } catch { err.textContent = "This browser can't check the password. Open the link in Chrome."; go.disabled = false; return; }
    if (ok) { box.remove(); startApp(); return; }
    fails++; pw.value = ""; go.disabled = false;
    if (fails >= 5) { waitUntil = Date.now() + 30000; fails = 0; err.textContent = "Wrong password 5 times. Wait 30 seconds."; }
    else err.textContent = "Wrong password. Try again.";
    pw.focus();
  });
}

// Lock again after the app has been in the background for a while.
document.addEventListener("visibilitychange", () => {
  if (!LOCK) return;
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) showLock("Welcome back. Enter your password to continue.");
});

if (LOCK && LOCK.hash) showLock();
else startApp(); // no password set yet
