// Shared text helpers: word normalising and forgiving word matching.

export const norm = w => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");
export const wordsOf = s => String(s || "").split(/\s+/).map(norm).filter(Boolean);
export const sentences = t => (String(t).match(/[^.!?]+[.!?]*/g) || [t]).map(s => s.trim()).filter(Boolean);

const NUMW = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");

export function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// 2 = same word, 1 = close (probably said slightly differently), 0 = different
export function near(a, b) {
  if (a === b) return 2;
  if (NUMW[+a] === b || NUMW[+b] === a) return 2;
  if (a.length >= 4 && b.length >= 3 && lev(a, b) <= (a.length >= 7 ? 2 : 1)) return 1;
  return 0;
}

export const STOP = new Set(("a an the and or but if of to in on at for with by from as is are was were be been being am i im me my we our you your he she they them their it its this that these those there here have has had do does did will would can could should may might must not no so than then too very just also about into over under again more most some such only own same other both each few all any what which who whom whose when where why how because while during before after up down out off once etc " +
  "ive id ill youre dont doesnt didnt cant wont isnt arent wasnt").split(" "));
