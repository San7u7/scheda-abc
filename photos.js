"use strict";
/* «Il tuo percorso»: visual progress over time from the physique photos (team review: trainer + psychologist).
   First vs last photo of each pose, at least 8 weeks apart, one comparison every 28 days, consent before sending,
   no aesthetic judgement, fat only as a trend behind a tap. Plus a Before|After slider. Loaded after board.js. */
(function () {
  const MIN_SPAN = 56, COOLDOWN = 28, DAY = 864e5;
  const POSES = ["frontale", "laterale", "posteriore"];
  const longDate = ms => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  function pick() {
    const by = {}; for (const p of S.photos) (by[p.pose || "frontale"] = by[p.pose || "frontale"] || []).push(p);
    const out = []; let first = Infinity, last = 0;
    for (const pose of POSES) { const l = (by[pose] || []).slice().sort((a, b) => a.date < b.date ? -1 : 1); if (l.length < 2) continue;
      const a = l[0], z = l[l.length - 1]; out.push(a, z); first = Math.min(first, +new Date(a.date)); last = Math.max(last, +new Date(z.date)); }
    return { photos: out, span: out.length ? Math.round((last - first) / DAY) : 0, first, last };
  }
  const cache = () => lsGet("percorso", null);
  function state() {
    const s = pick(), c = cache(), next = c ? c.at + COOLDOWN * DAY : 0;
    if (!s.photos.length) return { s, code: "few" };
    if (s.span < MIN_SPAN) return { s, code: "span", from: s.first + MIN_SPAN * DAY };
    if (c && Date.now() < next) return { s, code: "wait", from: next };
    return { s, code: "ok" };
  }
  async function small(p) {
    const blob = S.blobs[p.id] || (S.blobs[p.id] = await (await fetch(p.url)).blob());
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
    const k = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement("canvas");
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(r, "image/jpeg", 0.8));
  }
  function context(s) {
    const w = weights().filter(x => +new Date(x.date) >= s.first - 3 * DAY), weeks = Math.max(1, Math.round(s.span / 7));
    const mus = [...new Set(DAYS.flatMap(d => P[d].items.map(it => it.mus)).filter(m => m && m !== "Altro"))];
    const done = S.sessions.filter(x => +new Date(x.date) >= s.first).length, exp = weeks * Math.max(1, DAYS.length), adh = Math.min(1, done / exp);
    return { w, weeks, mus, adh, done, exp };
  }
  const PROMPT = (cx, s) => `Sei il preparatore di un'app di allenamento. Ricevi foto dello stesso fisico in date diverse: per ogni posa la più vecchia e poi la più recente, con posa e data indicate sotto.
L'utente ha obiettivo «${(S.profile && S.profile.obiettivo) || "massa"}»${(S.profile && S.profile.obiettivo) === "massa" ? ": un lieve aumento di grasso è atteso e non è un problema" : ""}. Contesto: ${cx.w.length > 1 ? `peso ${fmt(cx.w[0].kg)} kg → ${fmt(cx.w[cx.w.length - 1].kg)} kg` : "peso non registrato"} in ${cx.weeks} settimane; sedute fatte ${cx.done} su ${cx.exp} previste.
Prima verifica se luce, distanza, posa e abiti sono confrontabili: se non lo sono, dillo in note_foto e limita il giudizio.
Descrivi solo cambiamenti chiaramente visibili, distretto per distretto; nel dubbio usa "stabile" o "non valutabile".
Il grasso solo come tendenza e come intervallo di almeno 3 punti.
Niente diagnosi, salute, dieta, calorie o integratori. Niente giudizi estetici, aggettivi sul corpo o confronti con altre persone o canoni. Ignora volto, pelle, tatuaggi, ambiente.
Tono neutro e concreto da allenatore. Per "gruppo" usa solo questi nomi: ${cx.mus.join(", ") || "Petto, Dorsali, Spalle, Braccia, Gambe, Addome"}. Per enfasi_scheda al massimo 2 gruppi.
Italiano, senza trattini lunghi. Rispondi SOLO con JSON valido:
{"confrontabilita":"buona|parziale|scarsa","note_foto":"string","distretti":[{"gruppo":"string","posa":"frontale|laterale|posteriore","variazione":"migliorato|stabile|non valutabile","osservazione":"breve"}],"grasso_tendenza":"in calo|stabile|in aumento|non valutabile","grasso_range_attuale":"NN-NN%","sintesi":"2 frasi","enfasi_scheda":[{"gruppo":"string","motivo":"string"}],"confidenza":"bassa|media|alta"}

FOTO, nell'ordine in cui le ricevi:
${s.photos.map((p, i) => `${i + 1}. posa ${p.pose}, ${dt(p.date)}`).join("\n")}`;

  async function run() {
    const st = state(); if (st.code !== "ok" || !S.sample) return;
    S.pp = { busy: true }; render();
    try {
      const cx = context(st.s), imgs = await Promise.all(st.s.photos.map(small));
      const out = await S.sample.json(PROMPT(cx, st.s), { images: imgs, modelTier: "complex" });
      if (!out || !Array.isArray(out.distretti)) throw new Error("vuoto");
      lsSet("percorso", { at: Date.now(), weeks: cx.weeks, adh: cx.adh, n: st.s.photos.length, out });
      S.pp = null; S.ppOpen = true;
    } catch (e) { S.pp = { err: e && e.code === "timeout" ? "Leo non ha risposto in tempo. Riprova tra un minuto." : "Il confronto non è riuscito: riprova tra poco." }; }
    render();
  }

  function result(c) {
    const o = c.out, better = (o.distretti || []).filter(d => d.variazione === "migliorato").slice(0, 3), stable = (o.distretti || []).filter(d => d.variazione === "stabile").map(d => d.gruppo);
    const enf = (o.enfasi_scheda || [])[0];
    const action = c.adh < 0.8 ? `Prima la costanza: hai fatto ${Math.round(c.adh * 100)}% delle sedute previste. Conviene restare sulla scheda attuale e completare le settimane.` : enf ? `${esc(enf.gruppo)}: ${esc(enf.motivo)}` : "";
    return `<div class="pp-res">
      <h3>Cosa è cambiato in ${c.weeks} settimane</h3>
      ${o.sintesi ? `<p>${esc(o.sintesi)}</p>` : ""}
      ${better.length ? `<ul class="plain pp-list">${better.map(d => `<li><b>${esc(d.gruppo)}</b> <span class="small muted">(${esc(d.posa)})</span><br><span class="muted">${esc(d.osservazione || "")}</span></li>`).join("")}</ul>` : `<p class="muted">Nessun cambiamento ancora evidente in foto: succede, i muscoli cambiano più lentamente della bilancia.</p>`}
      ${stable.length ? `<p class="small muted">Stabili: ${stable.map(esc).join(", ")}.</p>` : ""}
      ${action ? `<div class="pp-act"><b>Su cosa lavorare</b><p>${action}</p></div>` : ""}
      <details class="pp-fat"><summary>Mostra la stima del grasso</summary><p>${esc(o.grasso_tendenza || "non valutabile")}${o.grasso_range_attuale ? `, intorno al ${esc(o.grasso_range_attuale)}` : ""}. Stima da foto con errore di ±3–5 punti: non è una misura clinica.</p></details>
      <p class="small faint">${esc(o.note_foto || "")} Foto confrontabili: ${esc(o.confrontabilita || "–")} · Stima sicura: ${esc(o.confidenza || "–")}. Analisi del ${dt(new Date(c.at).toISOString())}.</p></div>`;
  }

  function percorso() {
    const st = state(), c = cache(), pp = S.pp || {};
    let body;
    if (pp.busy) body = `<button class="ghost" disabled>Sto confrontando le foto…</button><p class="small muted">Ci vuole circa mezzo minuto.</p>`;
    else if (S.ppConsent) body = `<p>Le ${st.s.photos.length} foto vengono inviate a Google Gemini solo per questo confronto e non vengono salvate fuori dal telefono. Procedo?</p><div class="row2"><button class="primary" data-act="pp-go">Sì, invia e confronta</button><button class="ghost" data-act="pp-no">No, tienile sul telefono</button></div>`;
    else if (st.code === "few") body = `<p class="muted">Servono almeno due foto nella stessa posa, scattate a distanza di settimane. Inizia con una serie frontale, laterale e posteriore: sarà il tuo punto di partenza.</p>`;
    else if (st.code === "span") body = `<p class="muted">Il primo confronto è disponibile dal ${longDate(st.from)}. I cambiamenti si vedono in settimane, non in giorni.</p>`;
    else if (st.code === "wait") body = `<p class="muted">Il prossimo confronto è disponibile dal ${longDate(st.from)}. I cambiamenti si vedono in settimane, non in giorni.</p>`;
    else body = !S.sample ? `<p class="muted">Per il confronto attiva Leo in Impostazioni.</p>` : `<button class="primary go" data-act="pp-ask">Confronta le foto con Leo</button><p class="small muted">Prima e ultima foto di ogni posa, ${Math.round(st.s.span / 7)} settimane di distanza.</p>`;
    const err = pp.err ? `<div class="alert">${esc(pp.err)}</div>` : "";
    const res = c ? (S.ppOpen || st.code !== "ok" ? result(c) : `<button class="link small" data-act="pp-open">Rivedi l'ultimo confronto</button>`) : "";
    return `<div class="block"><div class="card pp"><h2>Foto del <span class="hl">corpo</span></h2>${steps(st)}${shelf()}${body}${err}${res}</div></div>` + slider();
  }

  function steps(st) {
    const n = POSES.filter(ps => S.photos.some(p => (p.pose || "frontale") === ps)).length, c = st.code;
    const s1 = n === 3, s2 = st.s.span >= MIN_SPAN, s3 = !!cache();
    const li = (done, t) => `<li class="${done ? "ok" : ""}"><span aria-hidden="true">${done ? "✓" : ""}</span>${t}</li>`;
    return `<ol class="pp-steps">${li(s1, `Scatta la serie di partenza: frontale, laterale, posteriore${n && !s1 ? ` (${n} di 3)` : ""}`)}${li(s2, "Ripeti le stesse 3 foto dopo almeno 8 settimane")}${li(s3, "Confronta le foto")}</ol>`;
  }
  function shelf() {
    if (!S.assets) return `<div class="alert">Il salvataggio delle foto non è disponibile in questo browser.</div>`;
    return `<div class="pp-shelf"><p class="small muted" style="margin:0">Tocca una foto per valutarla o eliminarla.</p>${POSES.map(ps => { const l = S.photos.filter(p => (p.pose || "frontale") === ps).sort((a, b) => a.date < b.date ? 1 : -1);
      return `<div class="pp-row"><div class="pp-rh"><b>${ps[0].toUpperCase() + ps.slice(1)}</b><span class="small muted">${l.length ? `${l.length} ${l.length === 1 ? "foto" : "foto"} · ultima ${dt(l[0].date)}` : "nessuna foto"}</span></div>
        <div class="pp-thumbs">${l.slice(0, 4).map(p => `<span class="pp-th ${S.ppSel === p.id ? "sel" : ""}"><button class="pp-tb" data-act="pp-sel" data-v="${p.id}" aria-label="Foto ${ps} del ${dt(p.date)}: tocca per eliminarla"><img src="${esc(p.url)}" alt="" loading="lazy"></button>${S.ppSel === p.id ? `<button class="pp-x" data-act="pp-del" data-v="${p.id}" aria-label="Elimina la foto ${ps} del ${dt(p.date)}">×</button>` : ""}</span>`).join("")}<label class="pp-add" data-pose="${ps}" aria-label="Aggiungi foto ${ps}">+<input type="file" accept="image/*" data-act="upload"></label></div></div>`; }).join("")}</div>`;
  }
  function slider() {
    const pose = S.ppPose || "frontale", l = S.photos.filter(p => (p.pose || "frontale") === pose).sort((a, b) => a.date < b.date ? -1 : 1);
    const poses = POSES.filter(ps => S.photos.filter(p => (p.pose || "frontale") === ps).length >= 2);
    if (!poses.length) return "";
    if (l.length < 2) { S.ppPose = poses[0]; return slider(); }
    const a = l[0], z = l[l.length - 1], v = S.ppCut ?? 50;
    return `<div class="block"><div class="card"><div class="block-h"><h2>Prima e <span class="hl">dopo</span></h2><span class="small muted">${dt(a.date)} → ${dt(z.date)}</span></div>
      ${poses.length > 1 ? `<div class="seg" role="group">${poses.map(ps => `<button data-act="pp-pose" data-v="${ps}" aria-pressed="${ps === pose}">${ps[0].toUpperCase() + ps.slice(1)}</button>`).join("")}</div>` : ""}
      <div class="pp-cmp" style="--cut:${v}%"><img src="${esc(z.url)}" alt="Foto ${pose} del ${dt(z.date)}"><img class="pp-old" src="${esc(a.url)}" alt="Foto ${pose} del ${dt(a.date)}"><span class="pp-line" aria-hidden="true"></span><span class="pp-tag l">Prima</span><span class="pp-tag r">Dopo</span></div>
      <input class="pp-range" type="range" min="0" max="100" value="${v}" aria-label="Sposta il confine tra prima e dopo"></div></div>`;
  }

  window.percorsoCard = () => percorso();
  const base = window.viewPhotos;
  const strip = h => h.replace(/<div class="posesel seg"[\s\S]*?<\/div>\s*<button class="primary file-btn">[\s\S]*?<\/button>/, "").replace(/<div class="ph-grid">[\s\S]*?<\/button><\/div>/, "")
    .replace(/<div class="empty"><h2>Nessuna foto ancora<\/h2>[\s\S]*?<\/div>/, "").replace(/<p class="small faint">Tocca una foto[\s\S]*?<\/p>/, "");
  window.viewPhotos = function () { return percorso() + strip(base()).replace(/(<button class="ph" data-act="pick" data-v="([^"]+)" aria-pressed="true">)/g, '$1<span class="ph-x pp-x" data-act="pp-del" data-v="$2" role="button" aria-label="Elimina questa foto">×</span>'); };
  /* 28/10 (DS 1): toast standard con «Annulla»; la cancellazione vera parte dopo 5 secondi se non annulli */
  function undoToast(msg, undo, commit) {
    let undone = false;
    toast(msg, { undo: () => { undone = true; undo(); } });
    setTimeout(() => { if (!undone) commit(); }, 5000);
  }
  function delPhoto(id) {
    const i = S.photos.findIndex(p => p.id === id); if (i < 0) return; const ph = S.photos[i];
    S.photos.splice(i, 1); S.sel = S.sel.filter(x => x !== id); S.ppSel = null; S.analysis = null; render();
    undoToast("Foto eliminata", () => { S.photos.splice(i, 0, ph); render(); }, async () => {
      try { if (S.db) await S.db.doc(S.base + "/" + id).delete(); else { saveLocalPhotos(); const d = await idb(); d.transaction("blobs", "readwrite").objectStore("blobs").delete(ph.assetId || id); } } catch (_) {}
      delete S.blobs[id];
    });
    if (!S.db) saveLocalPhotos();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "pp-ask") { S.ppConsent = true; render(); }
    else if (act === "pp-no") { S.ppConsent = false; render(); }
    else if (act === "pp-go") { S.ppConsent = false; run(); }
    else if (act === "pp-open") { S.ppOpen = true; render(); }
    else if (act === "pp-pose") { S.ppPose = b.dataset.v; render(); }
    else if (act === "pp-sel") { const id = b.dataset.v; S.ppSel = S.ppSel === id ? null : id; S.sel = S.ppSel ? [S.ppSel] : []; S.analysis = null; render(); }
    else if (act === "pp-del") { e.stopPropagation(); delPhoto(b.dataset.v); }
  });
  document.addEventListener("click", e => { const l = e.target.closest(".pp-add"); if (l) S.pose = l.dataset.pose; }, true);
  document.addEventListener("input", e => { if (e.target.classList && e.target.classList.contains("pp-range")) { S.ppCut = +e.target.value; const c = e.target.parentElement.querySelector(".pp-cmp"); if (c) c.style.setProperty("--cut", S.ppCut + "%"); } });

  const st = document.createElement("style");
  st.textContent = `
  .pp-res { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--raised); padding-top: 12px; }
  .pp-res h3 { margin: 0; font-size: 18px; }
  .pp-list li { margin-bottom: 8px; }
  .pp-act { background: var(--raised); border-radius: 16px; padding: 12px; } .pp-act p { margin: 4px 0 0; }
  .pp-fat summary { color: var(--accent); font-weight: 600; cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .pp-fat p { margin: 0; color: var(--muted); }
  .pp-cmp { position: relative; aspect-ratio: 3 / 4; border-radius: 16px; overflow: hidden; background: #000; }
  .pp-cmp img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .pp-cmp .pp-old { clip-path: inset(0 calc(100% - var(--cut)) 0 0); }
  .pp-line { position: absolute; top: 0; bottom: 0; left: var(--cut); width: 3px; margin-left: -1.5px; background: var(--accent); }
  .pp-tag { position: absolute; top: 10px; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.6); font-size: 12px; font-weight: 700; }
  .pp-tag.l { left: 10px; } .pp-tag.r { right: 10px; }
  .pp-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .pp-steps li { display: flex; gap: 10px; align-items: flex-start; color: var(--muted); font-size: 14px; }
  .pp-steps li span { flex: none; width: 20px; height: 20px; border-radius: 999px; box-shadow: inset 0 0 0 2px var(--control); display: grid; place-items: center; font-size: 12px; font-weight: 800; }
  .pp-steps li.ok { color: var(--text); } .pp-steps li.ok span { background: var(--accent); color: var(--lime-ink); box-shadow: none; }
  .pp-shelf { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--raised); padding-top: 12px; }
  .pp-rh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .pp-thumbs { display: flex; gap: 8px; }
  .pp-thumbs img { width: 56px; height: 72px; object-fit: cover; border-radius: 10px; background: var(--raised); }
  .pp-th { position: relative; flex: none; }
  .pp-tb { border: 0; padding: 0; background: none; border-radius: 10px; display: block; }
  .pp-th.sel img { outline: 3px solid var(--accent); outline-offset: 1px; }
  .pp-x { position: absolute; top: -10px; right: -10px; z-index: 2; width: 28px; height: 28px; border-radius: 999px; border: 2px solid #000; background: #ff453a; color: #fff; font-size: 18px; font-weight: 800; line-height: 1; display: grid; place-items: center; padding: 0; }
  .pp-x::after { content: ""; position: absolute; inset: -8px; }
  .ph { position: relative; } .ph-x { top: 6px; right: 6px; }
  .pp-add { position: relative; width: 56px; height: 72px; border-radius: 10px; border: 2px dashed var(--accent); color: var(--accent); display: grid; place-items: center; font-size: 26px; font-weight: 700; cursor: pointer; overflow: hidden; }
  .pp-add input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
  .pp-range { width: 100%; height: 44px; accent-color: var(--accent); touch-action: pan-y; }`;
  document.head.appendChild(st);
})();
