"use strict";
/* Site mode: Google Gemini with the user's own key (kept only on this device), local photo storage, file downloads.
   Exposes the same interface the app uses on claude.ai: sample(input, opts) -> {text}, sample.json(input, opts) -> value. */

const AI_KEY = "gemini_key", AI_MODEL = "gemini_model";
const GEM = "https://generativelanguage.googleapis.com/v1beta";
function getAIKey() { try { return localStorage.getItem(AI_KEY) || ""; } catch (_) { return ""; } }
function setAIKey(k) { try { k ? localStorage.setItem(AI_KEY, k) : (localStorage.removeItem(AI_KEY), localStorage.removeItem(AI_MODEL)); } catch (_) {} }

const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });

async function geminiModels(key) {
  // Pick the newest general "flash" models that support generateContent; skip image, audio, live and embedding variants.
  const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (r.status === 400 || r.status === 401 || r.status === 403) throw { code: "bad_key", message: "Chiave non valida" };
  if (!r.ok) throw { code: "upstream_error", message: "HTTP " + r.status };
  const list = ((await r.json()).models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => m.name.replace(/^models\//, ""))
    .filter(n => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|embedding|thinking-exp|exp-\d/.test(n));
  const ver = n => parseFloat((/gemini-([\d.]+)/.exec(n) || [])[1] || 0);
  const score = n => ver(n) * 10 - (/lite/.test(n) ? 3 : 0) - (/preview|exp/.test(n) ? 1 : 0);
  return [...new Set(list)].sort((a, b) => score(b) - score(a)).slice(0, 4);
}

function makeGemini(key) {
  let models = null;
  try { const c = JSON.parse(localStorage.getItem(AI_MODEL) || "null"); if (c && Date.now() - c.at < 7 * 864e5) models = c.list; } catch (_) {}
  async function getModels() {
    if (!models || !models.length) { models = await geminiModels(key); try { localStorage.setItem(AI_MODEL, JSON.stringify({ list: models, at: Date.now() })); } catch (_) {} }
    if (!models.length) throw { code: "upstream_error", message: "Nessun modello Gemini disponibile per questa chiave" };
    return models;
  }
  async function toContents(input, images) {
    const msgs = typeof input === "string" ? [{ role: "user", content: input }] : input;
    const contents = msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
    const imgs = images ? (images instanceof Blob ? [images] : Array.from(images)) : [];
    if (imgs.length) { const last = contents[contents.length - 1]; for (const b of imgs.slice(0, 6)) last.parts.unshift({ inline_data: { mime_type: b.type || "image/jpeg", data: await blobToB64(b) } }); }
    return contents;
  }
  async function call(input, opts = {}, json = false) {
    const body = { contents: await toContents(input, opts.images), generationConfig: { temperature: json ? 0.2 : 0.6, maxOutputTokens: json ? 8192 : 1500 } };
    if (json) body.generationConfig.responseMimeType = "application/json";
    let last;
    for (const m of await getModels()) {
      const r = await fetch(`${GEM}/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: opts.signal });
      if (r.ok) {
        const d = await r.json(), c = (d.candidates || [])[0];
        const text = c && c.content && (c.content.parts || []).map(p => p.text || "").join("") || "";
        if (!text) { last = { code: c && c.finishReason === "SAFETY" ? "refused" : "empty_completion", message: "Risposta vuota" }; continue; }
        return { text, truncated: c.finishReason === "MAX_TOKENS", modelApplied: m };
      }
      if (r.status === 400 && /API key/i.test(await r.clone().text())) throw { code: "bad_key", message: "Chiave non valida" };
      if (r.status === 401 || r.status === 403) throw { code: "bad_key", message: "Chiave non valida" };
      last = { code: r.status === 429 ? "rate_limited" : "upstream_error", message: "HTTP " + r.status };
      if (r.status === 404) { models = null; try { localStorage.removeItem(AI_MODEL); } catch (_) {} }
    }
    throw last || { code: "upstream_error", message: "Errore" };
  }
  const notify = e => { if (e && e.code === "bad_key" && typeof toast === "function") toast("Chiave Gemini non valida: controllala nelle impostazioni"); if (e && e.code === "rate_limited" && typeof toast === "function") toast("Limite gratuito di Gemini raggiunto per ora: riprova più tardi"); throw e; };
  const sample = async (input, opts = {}) => { try { const r = await call(input, opts, false); if (opts.onText) opts.onText({ text: r.text, delta: r.text }); return r; } catch (e) { notify(e); } };
  sample.json = async (input, opts = {}) => {
    try {
      const r = await call(input, opts, true), t = r.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      try { return JSON.parse(t); } catch (_) { const m = /[\[{][\s\S]*[\]}]/.exec(t); if (m) return JSON.parse(m[0]); throw { code: "invalid_json", message: "JSON non valido" }; }
    } catch (e) { notify(e); }
  };
  sample.limits = async () => ({ maxPromptBytes: 900000, images: { maxCount: 6, maxInputBytes: 15e6, mediaTypes: ["image/jpeg", "image/png", "image/webp"] } });
  sample.provider = "gemini";
  return sample;
}

/* ---------- local photos (IndexedDB) and downloads ---------- */
function idb() { return new Promise((res, rej) => { const r = indexedDB.open("scheda-foto", 1); r.onupgradeneeded = () => r.result.createObjectStore("blobs"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbPut(id, blob) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbGet(id) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction("blobs").objectStore("blobs").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
const siteAssets = { upload: async blob => { const id = "a" + Date.now(); await idbPut(id, blob); return { id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type }; } };
const siteDownloads = { save: async ({ filename, data }) => { const b = data instanceof Blob ? data : new Blob([data], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } };
function saveLocalPhotos() { try { localStorage.setItem("photos", JSON.stringify(S.photos.map(({ url, ...r }) => r))); } catch (_) {} }
async function loadLocalPhotos() {
  let meta = []; try { meta = JSON.parse(localStorage.getItem("photos") || "[]"); } catch (_) {}
  const out = []; for (const p of meta) { try { const b = await idbGet(p.assetId); if (b) { out.push({ ...p, url: URL.createObjectURL(b) }); S.blobs[p.id] = b; } } catch (_) {} }
  return out;
}

/* ---------- site setup and key box ---------- */
async function setupSite() {
  S.site = true; S.assets = siteAssets; S.downloads = siteDownloads;
  const k = getAIKey(); S.sample = k ? makeGemini(k) : null;
  S.sync = k ? "Dati su questo telefono · AI Gemini attiva" : "Dati su questo telefono";
  try { S.photos = await loadLocalPhotos(); } catch (_) {}
}
function aiKeyBox() {
  const k = getAIKey();
  return k ? `<div class="card"><h2>AI attiva: Google Gemini</h2><p class="small muted">Coach, stime dei pasti, lettura di foto, etichette e documenti usano la tua chiave, salvata solo su questo telefono.</p>
      <div class="row2"><button class="ghost" data-act="ai-test">Prova la chiave</button><button class="ghost" data-act="ai-remove">Rimuovi chiave</button></div></div>`
    : `<div class="card"><h2>Attiva l'AI gratis</h2><p class="small muted">Serve una chiave gratuita di Google Gemini: apri <b>aistudio.google.com/apikey</b>, accedi con un account Google, tocca «Create API key» e incollala qui. Resta solo su questo telefono. Sul piano gratuito Google può usare le richieste per migliorare i suoi modelli.</p>
      <input type="text" id="ai-key" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Incolla la chiave (inizia con AIza…)" style="height:48px;border-radius:14px;border:0;background:var(--raised);padding:0 14px;font-size:15px;width:100%">
      <button class="primary" data-act="ai-save">Attiva AI</button></div>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "ai-save") {
    const el = document.getElementById("ai-key"), k = (el && el.value || "").trim();
    if (!/^[\w-]{20,}$/.test(k)) { toast("Incolla una chiave valida"); return; }
    b.disabled = true; b.textContent = "Verifico…";
    try { await geminiModels(k); setAIKey(k); await setupSite(); toast("AI attivata"); }
    catch (err) { toast(err && err.code === "bad_key" ? "Chiave non valida: ricopiala da AI Studio" : "Non riesco a contattare Google: riprova"); }
    render();
  } else if (act === "ai-remove") { setAIKey(""); await setupSite(); render(); toast("Chiave rimossa"); }
  else if (act === "ai-test") {
    b.disabled = true; b.textContent = "Provo…";
    try { const r = await S.sample("Rispondi solo con: ok"); toast(`Funziona (${r.modelApplied})`); } catch (_) {}
    b.disabled = false; b.textContent = "Prova la chiave";
  }
});
