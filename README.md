# Interview English Coach

A phone app (a web app you install from Chrome) for practising interview English: warm-ups, pronunciation checks, speaking-speed coaching, paste-and-read scoring, interview questions and a mock interview.

- **Free:** all practice, voice checking, scores, speed, progress. AI coaching opens Claude with your answer filled in, using your free Claude account.
- **Paid (optional):** AI feedback inside the app using your own Anthropic API key. It's off until you set it up in Settings. It's locked with a PIN, shows the cost before every use, and has a monthly limit.

## Put it online with GitHub Pages (free, no software needed)

1. Sign in at github.com and click **New repository**. Name it, for example, `english-coach`, choose **Public**, and click **Create repository**.
2. On the new repository page, click **uploading an existing file**.
3. Drag in everything from this folder **except** the `.claude` folder: `index.html`, `app.js`, `ai.js`, `sw.js`, `manifest.webmanifest`, `README.md`, and the `icons` folder. Click **Commit changes**.
4. Go to **Settings → Pages**. Under **Branch**, choose `main` and `/ (root)`, then click **Save**.
5. After 1–2 minutes your app is live at `https://YOUR-USERNAME.github.io/english-coach/`.

## Install on your phone

1. Open that link in **Chrome** on your phone.
2. Tap **⋮ → Install app** (or **Add to Home screen**).
3. Open it from your home screen. Allow the microphone when asked.

## Updating later

Upload the changed files to the same repository again (same steps 2–3). The phone picks up the new version the next time the app is opened with internet.

## What stays private

- The code on GitHub contains no keys or personal data.
- Your progress and your API key (if you add one) are stored only on your phone. The key is encrypted with your PIN.
