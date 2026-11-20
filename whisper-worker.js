// Runs the Whisper speech-to-text model on the device, in the background, so the screen stays smooth.
// The model files are downloaded once from Hugging Face and then kept on the phone.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;

let asr = null, current = null;

async function getModel(model, id) {
  if (asr && current === model) return asr;
  asr = null;
  asr = await pipeline("automatic-speech-recognition", model, {
    dtype: "q8",
    device: "wasm",
    progress_callback: p => {
      if (p.status === "progress") postMessage({ id, type: "progress", file: p.file, loaded: p.loaded, total: p.total });
    }
  });
  current = model;
  return asr;
}

self.onmessage = async e => {
  const { id, type, model, audio } = e.data;
  try {
    const run = await getModel(model, id);
    if (type === "load") { postMessage({ id, type: "done" }); return; }
    const out = await run(audio, { chunk_length_s: 30, stride_length_s: 5 });
    postMessage({ id, type: "done", text: (out && out.text) || "" });
  } catch (err) {
    postMessage({ id, type: "error", message: String((err && err.message) || err) });
  }
};
