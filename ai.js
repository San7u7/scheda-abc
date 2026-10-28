"use strict";
/* Site mode: Google Gemini with the user's own key (kept only on this device), local photo storage, file downloads.
   Exposes the same interface the app uses on claude.ai: sample(input, opts) -> {text}, sample.json(input, opts) -> value. */

const AI_KEY = "gemini_key", AI_MODEL = "gemini_models_v3";
const GEM = "https://generativelanguage.googleapis.com/v1beta";
function getAIKey() { try { return localStorage.getItem(AI_KEY) || ""; } catch (_) { return ""; } }
function setAIKey(k) { try { k ? localStorage.setItem(AI_KEY, k) : (localStorage.removeItem(AI_KEY), localStorage.removeItem(AI_MODEL)); } catch (_) {} }

const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });

async function geminiModels(key) {
  // Pick the newest general "flash" models that support generateContent; skip image, audio, live and embedding variants.
  const r = await fetch(`${GEM}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (r.status === 400 || r.status === 401 || r.status === 403) { const t = await r.text().catch(() => ""); throw { code: /API key|API_KEY|permission|unauth/i.test(t) || r.status !== 400 ? "bad_key" : "upstream_error", message: t.slice(0, 200) }; }
  if (!r.ok) throw { code: "upstream_error", message: "HTTP " + r.status };
  const list = ((await r.json()).models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => m.name.replace(/^models\//, ""))
    .filter(n => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|audio|live|embedding|thinking-exp|exp-\d/.test(n));
  const ver = n => parseFloat((/gemini-([\d.]+)/.exec(n) || [])[1] || 0);
  const score = n => ver(n) * 10 - (/lite/.test(n) ? 3 : 0) - (/preview|exp/.test(n) ? 1 : 0);
  const sorted = [...new Set(list)].sort((a, b) => score(b) - score(a));
  const full = sorted.filter(n => !/lite/.test(n)).slice(0, 2), lite = sorted.filter(n => /lite/.test(n)).slice(0, 1);
  return full.concat(lite);
}

function makeGemini(key) {
  let models = null;
  try { const c = JSON.parse(localStorage.getItem(AI_MODEL) || "null"); if (c && Date.now() - c.at < 7 * 864e5) models = c.list; } catch (_) {}
  async function getModels() {
    if (!models || !models.length) { models = await geminiModels(key); try { localStorage.setItem(AI_MODEL, JSON.stringify({ list: models, at: Date.now() })); } catch (_) {} }
    if (!models.length) throw { code: "upstream_error", message: "Nessun modello Gemini disponibile per questa chiave" };
    return models;
  }
  // smaller uploads: phones drop big requests, and 1024 px is plenty for the model
  async function downscale(b) {
    try { if (!/^image\//.test(b.type || "image/jpeg") || b.size < 250000) return b;
      const bm = await createImageBitmap(b), k = Math.min(1, 1024 / Math.max(bm.width, bm.height)); if (k === 1 && b.size < 600000) return b;
      const c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(x => r(x || b), "image/jpeg", 0.8)); } catch (_) { return b; }
  }
  async function toContents(input, images) {
    const msgs = typeof input === "string" ? [{ role: "user", content: input }] : input;
    const contents = msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
    const imgs = images ? (images instanceof Blob ? [images] : Array.from(images)) : [];
    if (imgs.length) { const last = contents[contents.length - 1]; for (const b0 of imgs.slice(0, 6)) { const b = await downscale(b0); last.parts.unshift({ inline_data: { mime_type: b.type || "image/jpeg", data: await blobToB64(b) } }); } }
    return contents;
  }
  // Gemini 3 reasons at HIGH by default (slow): ask for LOW; 2.5 Flash can switch reasoning off. Retry without it if refused.
  const thinkingFor = m => /^gemini-(?:[3-9]|\d{2,})/.test(m) ? { thinkingLevel: "low" } : /^gemini-2\.5-flash/.test(m) ? { thinkingBudget: 0 } : null;
  async function attempt(m, body, opts, timeoutMs) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort("timeout"), timeoutMs);
    const onUser = () => ac.abort("user"); if (opts.signal) { if (opts.signal.aborted) throw { code: "cancelled" }; opts.signal.addEventListener("abort", onUser); }
    try { return await fetch(`${GEM}/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: ac.signal }); }
    catch (e) { if (opts.signal && opts.signal.aborted) throw { code: "cancelled" }; if (ac.signal.aborted) return { timeout: true }; throw { code: "network", message: String(e && e.message || e) }; }
    finally { clearTimeout(timer); if (opts.signal) opts.signal.removeEventListener("abort", onUser); }
  }
  async function call(input, opts = {}, json = false) {
    const P = aiProgress(input, opts, json);
    try { return await callInner(input, opts, json, P); } finally { P.end(); }
  }
  async function callInner(input, opts, json, P) {
    P.stage(opts.images ? "Preparo le immagini" : "Preparo i tuoi dati");
    const contents = await toContents(input, opts.images);
    const base = { temperature: json ? 0.2 : 0.6, maxOutputTokens: json ? (opts.fast ? 4096 : 16384) : 1500 };
    if (json) base.responseMimeType = "application/json";
    let last;
    const all = await getModels(), lite = all.filter(n => /lite/.test(n)), full = all.filter(n => !/lite/.test(n));
    // try the best models first, then a well-known stable one; images need a vision-capable full model
    const order = [...new Set(opts.fast && !opts.images ? lite.concat(full) : full.concat(lite))].slice(0, 3);
    const errs = [];
    const SAFE = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map(category => ({ category, threshold: "BLOCK_ONLY_HIGH" }));
    const gmsg = t => { try { return JSON.parse(t).error.message; } catch (_) { return String(t || "").slice(0, 160); } };
    for (const [mi, m] of order.entries()) {
      if (mi) P.stage("Provo un altro modello");
      const th = thinkingFor(m);
      // variants: if Google refuses the request shape (400), retry simpler: without relaxed filters, then without thinking settings
      const variants = opts.images ? [{ safe: true, th }, { safe: false, th }, { safe: false, th: null }] : [{ safe: false, th }, { safe: false, th: null }];
      let nextModel = false;
      for (const v of variants) {
        if (nextModel) break;
        const body = { contents, generationConfig: v.th ? { ...base, thinkingConfig: v.th } : base };
        if (v.safe) body.safetySettings = SAFE;
        P.stage("Invio a Google"); const slow = setTimeout(() => P.stage(opts.images ? "Leo sta guardando le immagini" : "Leo sta ragionando"), 900);
        let r;
        try { r = await attempt(m, body, opts, opts.modelTier === "complex" ? 120000 : opts.images ? 90000 : opts.fast ? 25000 : 40000); }
        catch (e) { clearTimeout(slow); if (e && e.code === "network") { last = { code: "network", message: e.message }; P.stage("Connessione interrotta, riprovo"); await new Promise(z => setTimeout(z, 1500)); continue; } throw e; }
        clearTimeout(slow);
        if (r.timeout) { last = { code: "timeout", message: "Nessuna risposta in tempo" }; nextModel = true; break; }
        if (r.ok) {
          P.stage("Leggo la risposta"); const d = await r.json(), c = (d.candidates || [])[0];
          const text = c && c.content && (c.content.parts || []).filter(p => !p.thought).map(p => p.text || "").join("") || "";
          const why = (d.promptFeedback && d.promptFeedback.blockReason) || (c && c.finishReason) || "";
          if (!text) { last = { code: /SAFETY|PROHIBITED|BLOCK|SPII/i.test(why) ? "refused" : "empty_completion", message: "Risposta vuota " + why }; continue; }
          return { text, truncated: c.finishReason === "MAX_TOKENS", modelApplied: m };
        }
        const t = await r.text().catch(() => "");
        if ((r.status === 400 && /API key|API_KEY_INVALID/i.test(t)) || r.status === 401 || r.status === 403) throw { code: "bad_key", message: "Chiave non valida" };
        last = { code: r.status === 429 ? "rate_limited" : "upstream_error", message: `${m}: HTTP ${r.status} · ${gmsg(t)}` }; errs.push(last);
        if (r.status === 404) { models = null; try { localStorage.removeItem(AI_MODEL); } catch (_) {} nextModel = true; }
        if (r.status === 429) nextModel = true;
      }
    }
    // the first error is the informative one (best model); if every model failed, the cached list may be stale: refresh once
    if (!opts._fresh && errs.length) { models = null; try { localStorage.removeItem(AI_MODEL); } catch (_) {} P.stage("Aggiorno l'elenco dei modelli"); return callInner(input, { ...opts, _fresh: true }, json, P); }
    throw (errs[0] && last && last.code !== "timeout" && last.code !== "refused" ? errs[0] : last) || { code: "upstream_error", message: "Errore" };
  }
  const notify = e => {
    const msg = { bad_key: "Chiave di Google non valida: controllala nelle Impostazioni", rate_limited: "Limite gratuito raggiunto per ora: riprova più tardi", timeout: "Leo non ha risposto in tempo. Riprova tra un minuto.", truncated: "Documento troppo lungo per una volta sola: caricalo in due parti", network: "Connessione assente: riprova quando sei online" }[e && e.code];
    if (msg && typeof toast === "function") toast(msg); throw e;
  };
  const sample = async (input, opts = {}) => { try { const r = await call(input, opts, false); if (opts.onText) opts.onText({ text: r.text, delta: r.text }); return r; } catch (e) { notify(e); } };
  sample.json = async (input, opts = {}) => {
    try {
      const r = await call(input, opts, true), t = r.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      if (r.truncated) throw { code: "truncated", message: "Risposta troppo lunga" };
      try { return JSON.parse(t); } catch (_) { const m = /[\[{][\s\S]*[\]}]/.exec(t); if (m) return JSON.parse(m[0]); throw { code: "invalid_json", message: "JSON non valido" }; }
    } catch (e) { notify(e); }
  };
  sample.limits = async () => ({ maxPromptBytes: 900000, images: { maxCount: 6, maxInputBytes: 15e6, mediaTypes: ["image/jpeg", "image/png", "image/webp"] } });
  sample.provider = "gemini";
  return sample;
}

/* ---------- local photos (IndexedDB) and downloads ---------- */
const photoDb = () => NS === "abc:" ? "scheda-foto" : "foto-" + NS.replace(/\W/g, "");
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(photoDb(), 1); r.onupgradeneeded = () => r.result.createObjectStore("blobs"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbPut(id, blob) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbGet(id) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction("blobs").objectStore("blobs").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
const siteAssets = { upload: async blob => { const id = "a" + Date.now(); await idbPut(id, blob); return { id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type }; } };
const siteDownloads = { save: async ({ filename, data }) => { const b = data instanceof Blob ? data : new Blob([data], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } };
function saveLocalPhotos() { lsSet("photos", S.photos.map(({ url, ...r }) => r)); }
async function loadLocalPhotos() {
  const meta = lsGet("photos", []);
  const out = []; for (const p of meta) { try { const b = await idbGet(p.assetId); if (b) { out.push({ ...p, url: URL.createObjectURL(b) }); S.blobs[p.id] = b; } } catch (_) {} }
  return out;
}

/* ---------- site setup and key box ---------- */
async function setupSite() {
  S.site = true; S.assets = siteAssets; S.downloads = siteDownloads;
  const k = getAIKey(); S.sample = k ? makeGemini(k) : null;
  S.sync = k ? "Sul telefono · Leo attivo" : "Sul telefono";
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  try { S.photos = await loadLocalPhotos(); } catch (_) {}
}
function aiKeyBox() {
  const k = getAIKey();
  return k ? `<div class="card"><h2>Leo usa Google Gemini</h2><p class="small muted">Risposte di Leo, stime dei pasti, lettura di foto, etichette e documenti usano la tua chiave, salvata solo su questo telefono.</p>
      <div class="row2"><button class="ghost" data-act="ai-test">Prova la chiave</button><button class="ghost" data-act="ai-remove">Rimuovi chiave</button></div></div>`
    : `<div class="card aikey"><h2>Attiva Leo (gratis)</h2><p class="small muted" style="margin:0">Ti serve una chiave personale di Google: bastano due minuti.</p>
      <ul class="plain ai-why"><li><b>Leo</b>: risponde su allenamento e alimentazione partendo dai tuoi dati.</li><li><b>Foto e documenti</b>: legge scheda, piano alimentare ed etichette da foto o PDF, e confronta le foto del corpo.</li><li><b>Pasti</b>: stima calorie e proteine da una foto o da una descrizione.</li></ul>
      <ol class="ai-steps"><li>Tocca «Apri Google AI Studio» e accedi con il tuo account Google.</li><li>Accetta i termini se te li chiede, poi tocca «Create API key».</li><li>Tocca l'icona di copia accanto alla chiave (inizia con «AIza»).</li><li>Torna qui: tocca «◀ Askesis» in alto a sinistra, oppure riapri l'app. Poi tocca «Incolla chiave».</li></ol>
      <a class="primary go" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center">Apri Google AI Studio</a>
      ${navigator.clipboard && navigator.clipboard.readText ? `<button class="primary" data-act="ai-paste">Incolla chiave</button>` : ""}
      <input type="text" id="ai-key" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" placeholder="Oppure incollala qui (inizia con AIza…)" style="height:48px;border-radius:14px;border:0;background:var(--raised);padding:0 14px;color:var(--text);font-size:16px">
      <button class="ghost" data-act="ai-save">Attiva Leo</button>
      <p class="small muted" style="margin:0">La chiave resta solo su questo telefono: Askesis non ha server e non la vede. Le richieste vanno direttamente a Google. Il piano gratuito ha limiti giornalieri e Google può usare le richieste per migliorare i suoi modelli. Senza chiave funzionano comunque profilo, scheda e dieta inserite a mano, allenamenti e progressi.</p></div>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "ai-save") {
    const el = document.getElementById("ai-key");
    // clean what iOS adds when pasting: spaces, line breaks, invisible characters, "smart" dashes and quotes
    const k = (el && el.value || "").replace(/[\s\u200B-\u200D\u2060\uFEFF"'«»“”‘’]/g, "").replace(/\u2014/g, "--").replace(/[\u2013\u2212]/g, "-");
    if (k.length < 20) { toast("La chiave sembra incompleta: copiala di nuovo da AI Studio"); return; }
    b.disabled = true; b.textContent = "Verifico…";
    try { await geminiModels(k); setAIKey(k); await setupSite(); toast("Leo attivato"); }
    catch (err) { toast(err && err.code === "bad_key" ? "Questa chiave non funziona. Ricopiala da AI Studio: deve iniziare con AIza." : err && err.code === "rate_limited" ? "Per oggi hai raggiunto il limite gratuito. Riprova più tardi." : "Google non risponde. Controlla la connessione e riprova."); }
    render();
  } else if (act === "ai-paste") {
    try { const t = await navigator.clipboard.readText(), el = document.getElementById("ai-key"); if (el) el.value = t || ""; if (!t) { toast("Gli appunti sono vuoti: copia la chiave in AI Studio"); return; } const sv = document.querySelector('[data-act="ai-save"]'); if (sv) sv.click(); }
    catch (_) { toast("Non posso leggere gli appunti: tieni premuto nel campo e scegli «Incolla»"); }
  } else if (act === "ai-remove") { setAIKey(""); await setupSite(); render(); toast("Chiave rimossa"); }
  else if (act === "ai-test") {
    b.disabled = true; b.textContent = "Provo…";
    const t0 = Date.now();
    try { const r = await S.sample("Rispondi solo con: ok", { fast: true }); toast(`Funziona: ${r.modelApplied}, ${((Date.now() - t0) / 1000).toFixed(1)} s`); }
    catch (e) { toast(`Prova non riuscita (${e && e.code || "errore"}${e && e.message ? ": " + String(e.message).slice(0, 80) : ""})`); }
    b.disabled = false; b.textContent = "Prova la chiave";
  }
});

/* AI progress feedback, everywhere: what is happening, elapsed time, about how much is left. */
function aiProgress(input, opts, json) {
  const text = typeof input === "string" ? input : String((input[input.length - 1] || {}).content || "");
  const task = opts.task || (opts.images && /etichett/i.test(text) ? "Leggo l'etichetta" : opts.images && /fisico|percorso|preparatore|livell/i.test(text) ? "Valuto le foto" : opts.images ? "Leggo l'immagine"
    : /crea|genera|progetta/i.test(text) && /sedut|scheda|allenament/i.test(text) && json ? "Creo la tua scheda" : /SCHEDA|scheda di allenamento/i.test(text) && json ? "Leggo la scheda" : /piano alimentare|dieta/i.test(text) && json && text.length > 2000 ? "Leggo il piano alimentare"
    : /alternativ|sostitu/i.test(text) ? "Cerco alternative" : /calorie|macro/i.test(text) && json ? "Stimo calorie e proteine" : json ? "Elaboro" : "Leo sta pensando");
  const est = (opts.modelTier === "complex" && !opts.images ? 50 : opts.images ? (opts.fast ? 12 : 35) : json ? (opts.fast ? 8 : 20) : 10) * 1000;
  const id = Date.now() + Math.random(), t0 = Date.now();
  const st = { id, task, stage: "", t0, est };
  aiProgress.list.set(id, st); aiProgress.paint();
  return { stage(x) { st.stage = x; aiProgress.paint(); }, end() { aiProgress.list.delete(id); aiProgress.paint(true); } };
}
aiProgress.list = new Map();
aiProgress.paint = function (ended) {
  let el = document.getElementById("aiprog");
  if (!el) { el = document.createElement("div"); el.id = "aiprog"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el);
    const css = document.createElement("style"); css.textContent = `#aiprog { position: fixed; left: 12px; right: 12px; top: calc(8px + env(safe-area-inset-top, 0px)); z-index: 90; max-width: 520px; margin: 0 auto; background: #1c1c1e; border: 1px solid var(--raised, #2a2a2a); border-radius: 18px; padding: 10px 14px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.6); color: var(--text, #fff); font-size: 14px; transition: opacity .25s, transform .25s; }
    #aiprog[hidden] { display: block; opacity: 0; transform: translateY(-12px); pointer-events: none; }
    #aiprog .ap-h { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; } #aiprog b { font-size: 15px; } #aiprog .ap-t { color: var(--muted, #aaa); font-variant-numeric: tabular-nums; font-size: 13px; white-space: nowrap; }
    #aiprog .ap-s { color: var(--muted, #aaa); font-size: 13px; margin-top: 2px; } #aiprog .ap-bar { height: 4px; border-radius: 99px; background: var(--raised, #333); margin-top: 8px; overflow: hidden; }
    #aiprog .ap-bar span { display: block; height: 100%; background: var(--accent, #c6f24e); border-radius: 99px; transition: width .4s linear; }
    @media (prefers-reduced-motion: reduce) { #aiprog, #aiprog .ap-bar span { transition: none; } }`; document.head.appendChild(css); }
  const cur = [...aiProgress.list.values()].pop();
  if (!cur) { if (ended && !el.hidden) { el.querySelector("b") && (el.querySelector("b").textContent = "Fatto"); const sp = el.querySelector(".ap-bar span"); if (sp) sp.style.width = "100%"; setTimeout(() => { if (!aiProgress.list.size) el.hidden = true; }, 500); } else el.hidden = true; clearInterval(aiProgress.tick); aiProgress.tick = null; return; }
  const t = Date.now() - cur.t0, frac = Math.min(.95, 1 - Math.exp(-t / (cur.est * .7))), left = Math.round((cur.est - t) / 1000);
  el.hidden = false;
  el.innerHTML = `<div class="ap-h"><b>${cur.task}…</b><span class="ap-t">${Math.round(t / 1000)} s${left > 0 ? ` · circa ${left} s` : ""}</span></div><div class="ap-s">${cur.stage || ""}${left <= 0 ? (cur.stage ? " · " : "") + "ci vuole un po' più del solito" : ""}</div><div class="ap-bar"><span style="width:${(frac * 100).toFixed(0)}%"></span></div>`;
  if (!aiProgress.tick) aiProgress.tick = setInterval(() => aiProgress.paint(), 500);
};
