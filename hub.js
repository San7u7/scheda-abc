"use strict";
/* Piano = control centre: training plan (edit / load new), diet plan (menu / edit / load new), my foods (photo / manual),
   profile, AI key, data. Loaded after ux.js; replaces viewPiano and adds its own sheets and events. */
(function () {
  const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  const DOWN = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"], DOWI = [1, 2, 3, 4, 5, 6, 0];
  const T = () => S.training || (S.training = { sedute: [] });
  const saveTraining = () => { persistDoc("training", S.training); S.drafts = {}; saveDrafts(); applyAll(); };
  const saveDiet = () => { persistDoc("diet", S.diet); applyAll(); };
  const goalName = () => ((typeof GOALS !== "undefined" && GOALS.find(g => g[0] === (S.profile || {}).obiettivo)) || [0, "Mantenere"])[1];
  const backBtn = `<button class="back" data-act="hub" data-v="">${BACK}Piano</button>`;

  /* ---------- hub ---------- */
  function hubHome() {
    const tr = T(), nEx = tr.sedute.reduce((m, s) => m + s.esercizi.length, 0), d = S.diet || {}, pr = S.profile || {};
    const week = DOWI.map((dw, i) => { const s = tr.sedute.findIndex(x => x.dow === dw); return `<span class="wd ${s >= 0 ? "on" : ""}"><small>${DOWN[i]}</small><b>${s >= 0 ? String.fromCharCode(65 + s) : "–"}</b></span>`; }).join("");
    const foods = S.foods || [];
    return `<h1>Il tuo <span class="hl">piano</span></h1><p class="muted" style="margin-top:4px">Cosa ti alleni e cosa mangi questa settimana.</p>
      <div class="block"><div class="hcard"><div class="hc-h"><span class="hc-ic">${'<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>'}</span><div><h2>Scheda di allenamento</h2><p class="small muted">${tr.sedute.length ? `${tr.sedute.length} sedute · ${nEx} esercizi` : "Nessuna scheda caricata"}</p></div></div>
        ${tr.sedute.length ? `<div class="wstrip">${week}</div>` : ""}
        <div class="hc-acts">${tr.sedute.length ? `<button class="primary go" data-act="hub" data-v="train">Modifica scheda</button>` : ""}${tr.sedute.length ? `<button class="link small" data-act="redo" data-v="2">Carica una nuova scheda</button>` : `<button class="primary go" data-act="redo" data-v="2">Carica la scheda</button>`}</div></div></div>
      <div class="block"><div class="hcard"><div class="hc-h"><span class="hc-ic">${'<svg viewBox="0 0 24 24"><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 21V3c-2 1.5-3 4-3 7v3h3"/></svg>'}</span><div><h2>Piano alimentare</h2><p class="small muted">${hasMealPlan() ? `${esc(d.origine || "Piano caricato")} · circa ${fmt(PLAN.kcal)} kcal` : `Obiettivo calcolato: ${fmt(PLAN.kcal)} kcal`}</p></div></div>
        <div class="mini-kv"><span><b>${fmt(PLAN.kcal)}</b>kcal</span><span><b>${PLAN.pro} g</b>proteine</span><span><b>${PLAN.cho || "–"} g</b>carbo</span><span><b>${PLAN.fat || "–"} g</b>grassi</span></div>
        <div class="hc-acts">${hasMealPlan() ? `<button class="primary go" data-act="hub" data-v="menu">Vedi il menù</button><button class="ghost" data-act="hub" data-v="diet">Modifica i pasti</button>` : ""}${hasMealPlan() ? `<button class="link small" data-act="redo" data-v="3">Carica un nuovo piano</button>` : `<button class="primary go" data-act="redo" data-v="3">Carica il piano alimentare</button>`}</div></div></div>
      <div class="block"><div class="hcard"><div class="hc-h"><span class="hc-ic">${'<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.2"/><path d="M8.5 6l1.5-2h4l1.5 2"/></svg>'}</span><div><h2>I miei alimenti</h2><p class="small muted">${foods.length ? `${foods.length} salvati, con i valori per 100 g` : "Fotografa l'etichetta di ciò che mangi spesso"}</p></div></div>
        ${foods.length ? `<div class="flist">${foods.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(x => `<div class="frow"><span><b>${esc(x.nome)}</b><small class="num">${fmt(x.per100.kcal)} kcal · P ${fmt(x.per100.p)} · C ${fmt(x.per100.c)} · G ${fmt(x.per100.f)} per 100 g</small></span><button class="link small" data-act="libdel" data-v="${x.id}">${S.confirmDel === x.id ? "Conferma" : "Elimina"}</button></div>`).join("")}</div>` : ""}
        <div class="hc-acts"><label class="primary file-btn">${S.hubBusy ? "Leggo l'etichetta…" : "Aggiungi da foto"}<input type="file" accept="image/*" data-act="hub-food-photo" ${S.hubBusy ? "disabled" : ""}></label><button class="ghost" data-act="hub-sheet" data-v="food-new">Aggiungi a mano</button></div></div></div>
      `;
  }
  window.rulesBlock = () => `<div class="block"><details class="hcard"><summary><h2>Regole e consigli</h2></summary><ul class="plain muted" style="margin-top:10px"><li>Prima le ripetizioni, poi il carico: quando chiudi il range in tutte le serie, il carico sale.</li><li>RIR 1–2 sui multiarticolari, 0–1 nell'ultima serie degli isolamenti.</li><li>Riscaldamento: 5–8 minuti di cardio, stretching sotto i 60″ per posizione, 1 serie di avvicinamento sul primo esercizio di ogni gruppo muscolare.</li><li>Scarico: con fatica ≥ 8/10 per due settimane, una settimana a metà serie.</li>${(PLAN.rules || []).map(r => `<li>${esc(r)}</li>`).join("")}${supplements().map(x => `<li>${esc(x.name)}${x.plan ? ": " + esc(x.plan) : ""}.</li>`).join("")}</ul></details></div>`;
  window.settingsBlocks = () => { const pr = S.profile || {}; return `
      <div class="block"><div class="hcard"><div class="hc-h"><span class="hc-ic">${'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'}</span><div><h2>Profilo e obiettivo</h2><p class="small muted">${pr.nome ? `${esc(pr.nome)}, ${pr.eta} anni, ${fmt(pr.peso)} kg · ${esc(goalName())}` : "Da completare"}</p></div></div>
        <div class="hc-acts"><button class="ghost" data-act="redo" data-v="1">Modifica profilo e colore</button></div></div></div>
      ${S.site && typeof aiKeyBox === "function" ? `<div class="block">${aiKeyBox()}</div>` : ""}
      <div class="block"><div class="hcard"><h2>I tuoi dati</h2><p class="small muted">${S.site ? "Restano solo su questo telefono: se cancelli i dati del browser li perdi." : "Sono salvati nel tuo account."}</p>
        <div class="hc-acts">${S.site ? `<button class="primary go" data-act="backup">Salva una copia dei dati</button><label class="ghost file-btn">Ripristina da una copia<input type="file" accept=".json,application/json" data-act="restore"></label><p class="small muted" style="margin:0">La copia contiene sedute, pasti, foto, impostazioni e chiave AI. Salvala in File o mandatela per email: serve per cambiare telefono o reinstallare l'app.</p>` : ""}${S.downloads ? `<button class="ghost" data-act="export" data-v="sedute">Esporta allenamenti (CSV)</button><button class="ghost" data-act="export" data-v="diario">Esporta peso e pasti (CSV)</button>` : ""}<button class="link small" data-act="wipe" style="color:var(--warn-ink)">${S.confirmWipe ? "Conferma: cancella tutti i miei dati" : "Cancella tutti i miei dati"}</button></div></div></div>
      <p class="credits">Foto in bianco e nero da collezioni aperte (CC0, pubblico dominio, CC BY 2.0 di vanitystudiosphotography su Flickr). Animazioni degli esercizi: Free Exercise DB (pubblico dominio). Le calorie sono stime; l'app non sostituisce medico, dietista o allenatore.</p>`;
  }

  /* ---------- training editor ---------- */
  function trainEditor() {
    const tr = T(), locked = !!activeDay();
    return `${backBtn}<h1>Modifica la <span class="hl">scheda</span></h1>
      ${locked ? `<div class="alert" style="margin-top:12px">Hai una seduta in corso: concludila o scartala prima di cambiare la scheda.</div>` : `<p class="muted" style="margin-top:4px">Tocca un esercizio per cambiarlo. Le frecce cambiano l'ordine.</p>`}
      ${tr.sedute.map((s, si) => `<div class="block"><div class="hcard">
        <div class="ed-h"><div><h2>${String.fromCharCode(65 + si)} · ${esc(s.nome || "Seduta")}</h2><p class="small muted">${esc(s.focus || "")}</p></div>${locked ? "" : `<button class="ghost sm" data-act="hub-sheet" data-v="sess-edit" data-s="${si}">Modifica</button>`}</div>
        <div class="ed-list">${s.esercizi.map((e, ei) => `<div class="ed-row"><button class="ed-main" data-act="hub-sheet" data-v="ex-edit" data-s="${si}" data-e="${ei}" ${locked ? "disabled" : ""}><b>${esc(e.nome)}</b><small class="num">${e.serie}×${e.min}${e.max !== e.min ? "–" + e.max : ""}${e.corpo_libero ? " · corpo libero" : e.kg != null ? ` · ${fmt(e.kg)} kg` : ""} · rec. ${mmss(e.recupero || 90)}</small></button>
          ${locked ? "" : `<button class="icon-btn sm" data-act="ex-move" data-s="${si}" data-e="${ei}" data-v="-1" aria-label="Sposta su" ${ei === 0 ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button><button class="icon-btn sm" data-act="ex-move" data-s="${si}" data-e="${ei}" data-v="1" aria-label="Sposta giù" ${ei === s.esercizi.length - 1 ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>`}</div>`).join("")}</div>
        ${locked ? "" : `<button class="ghost" data-act="hub-sheet" data-v="ex-edit" data-s="${si}" data-e="new">+ Aggiungi esercizio</button>`}</div></div>`).join("")}
      ${locked ? "" : `<div class="block"><button class="ghost" data-act="sess-add">+ Aggiungi una seduta</button></div>`}`;
  }

  /* ---------- diet: menu and editor ---------- */
  function dayChips() { const dw = S.dietDow ?? new Date().getDay(); return `<div class="seg scroll" role="group" aria-label="Giorno">${DOWI.map((d, i) => `<button data-act="ddow" data-v="${d}" aria-pressed="${d === dw}">${DOWN[i]}</button>`).join("")}</div>`; }
  function menuView(edit) {
    const dw = S.dietDow ?? new Date().getDay(), tot = MEALS.reduce((m, [k]) => m + nutOf(dw, k).kcal, 0);
    return `${backBtn}<h1>${edit ? "Modifica i <span class=\"hl\">pasti</span>" : "Il tuo <span class=\"hl\">menù</span>"}</h1><p class="muted" style="margin-top:4px">${edit ? "Tocca un pasto per cambiarlo: puoi applicare la modifica anche agli altri giorni." : `${esc((S.diet || {}).origine || "Piano caricato")}. Questo giorno: circa ${fmt(tot)} kcal${Math.abs(tot - PLAN.kcal) > 20 ? `. L'obiettivo di ${fmt(PLAN.kcal)} kcal è la media della settimana: i singoli giorni variano un po'.` : "."}`}</p>
      <div class="block">${dayChips()}</div>
      <div class="block stack" style="gap:8px">${MEALS.map(([k, l]) => { const m = mealOf(dw, k), n = nutOf(dw, k);
        return `<${edit ? "button" : "div"} class="mrow" ${edit ? `data-act="hub-sheet" data-v="meal-edit" data-k="${k}"` : ""}><span class="mr-l">${l}${m ? ` · ${fmt(n.kcal)} kcal` : ""}</span><b>${m ? esc(m.t) : "Non previsto"}</b>${m && m.i.length ? `<ul class="plain muted small">${m.i.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${edit ? `<span class="mr-edit">Modifica ${ARROW}</span>` : ""}</${edit ? "button" : "div"}>`; }).join("")}</div>
      ${edit ? "" : `<div class="block"><button class="ghost" data-act="hub" data-v="diet">Modifica i pasti</button></div>`}`;
  }

  window.viewPiano = function () {
    if (S.hub === "train") return trainEditor();
    if (S.hub === "menu") return menuView(false);
    if (S.hub === "diet") return menuView(true);
    return hubHome();
  };

  /* ---------- sheets ---------- */
  const prevSheet = window.renderSheet;
  const num2 = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
  const field = (id, label, val, type = "text", mode = "text") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="text" inputmode="${mode}" autocomplete="off" value="${esc(val ?? "")}"></div>`;
  window.renderSheet = function () {
    const sh = S.sheet, o = $("#overlay");
    if (!["ex-edit", "sess-edit", "meal-edit", "food-new"].includes(sh)) return prevSheet();
    const h = S.hubArg || {}; let html = "";
    if (sh === "ex-edit") {
      const s = T().sedute[h.s], isNew = h.e === "new", e = isNew ? { nome: "", serie: 3, min: 8, max: 12, kg: null, recupero: 90, tecnica: "", corpo_libero: false } : s.esercizi[h.e];
      html = `<div class="block-h"><h2>${isNew ? "Nuovo esercizio" : "Modifica esercizio"}</h2><button class="link small" data-act="close" style="padding:0">Annulla</button></div>
        ${field("xe-nome", "Nome", e.nome)}
        <div class="grid3">${field("xe-serie", "Serie", e.serie, "text", "numeric")}${field("xe-min", "Rip. min", e.min, "text", "numeric")}${field("xe-max", "Rip. max", e.max, "text", "numeric")}</div>
        <div class="grid3">${field("xe-kg", "Kg", e.kg, "text", "decimal")}${field("xe-rec", "Recupero s", e.recupero, "text", "numeric")}<div class="field"><span class="lab">Corpo libero</span><button class="pill-t" data-act="xe-bw" aria-pressed="${!!e.corpo_libero}" id="xe-bw">${e.corpo_libero ? "Sì" : "No"}</button></div></div>
        <div class="field"><label for="xe-tec">Tecnica e consigli</label><textarea id="xe-tec" rows="3">${esc(e.tecnica || "")}</textarea></div>
        <div id="xe-err"></div>
        <button class="primary" data-act="xe-save">${isNew ? "Aggiungi" : "Salva"}</button>
        ${isNew ? "" : `<button class="link small" data-act="xe-del" style="align-self:center;color:var(--warn-ink)">${S.confirmXe ? "Conferma: elimina l'esercizio" : "Elimina esercizio"}</button>`}`;
    } else if (sh === "sess-edit") {
      const s = T().sedute[h.s];
      html = `<div class="block-h"><h2>Seduta ${String.fromCharCode(65 + h.s)}</h2><button class="link small" data-act="close" style="padding:0">Annulla</button></div>
        ${field("se-nome", "Nome", s.nome)}${field("se-focus", "Muscoli allenati", s.focus)}
        <div class="field"><span class="lab">Giorno della settimana</span><div class="seg scroll" role="group">${DOWI.map((d, i) => `<button data-act="se-dow" data-v="${d}" aria-pressed="${s.dow === d}">${DOWN[i]}</button>`).join("")}<button data-act="se-dow" data-v="" aria-pressed="${s.dow == null}">Libero</button></div></div>
        <button class="primary" data-act="se-save">Salva</button>
        <button class="link small" data-act="se-del" style="align-self:center;color:var(--warn-ink)">${S.confirmSe ? "Conferma: elimina la seduta e i suoi esercizi" : "Elimina seduta"}</button>`;
    } else if (sh === "meal-edit") {
      const dw = S.dietDow ?? new Date().getDay(), m = mealOf(dw, h.k) || { t: "", i: [], kcal: 0, p: 0, c: 0, f: 0 }, l = (MEALS.find(x => x[0] === h.k) || [])[1];
      html = `<div class="block-h"><h2>${l} · ${DOW[dw]}</h2><button class="link small" data-act="close" style="padding:0">Annulla</button></div>
        ${field("me-t", "Titolo del pasto", m.t)}
        <div class="field"><label for="me-i">Alimenti e grammature (uno per riga)</label><textarea id="me-i" rows="5">${esc((m.i || []).join("\n"))}</textarea></div>
        <div class="grid4">${field("me-k", "Kcal", m.kcal, "text", "numeric")}${field("me-p", "Prot. g", m.p, "text", "decimal")}${field("me-c", "Carbo g", m.c, "text", "decimal")}${field("me-f", "Grassi g", m.f, "text", "decimal")}</div>
        ${S.sample ? `<button class="ghost" data-act="me-est">${S.hubBusy ? "Calcolo…" : "Calcola calorie dagli alimenti"}</button>` : ""}
        <div class="field"><span class="lab">Applica a</span><div class="seg" role="group"><button data-act="me-scope" data-v="day" aria-pressed="${(S.meScope || "day") === "day"}">Solo ${DOW[dw].toLowerCase()}</button><button data-act="me-scope" data-v="all" aria-pressed="${S.meScope === "all"}">Tutti i giorni</button></div></div>
        <button class="primary" data-act="me-save">Salva il pasto</button>
        ${m.t ? `<button class="link small" data-act="me-clear" style="align-self:center">Togli questo pasto dal piano</button>` : ""}`;
    } else if (sh === "food-new") {
      html = `<div class="block-h"><h2>Nuovo alimento</h2><button class="link small" data-act="close" style="padding:0">Annulla</button></div>
        ${field("fn-nome", "Nome", "")}
        <p class="small muted">Valori per 100 g, come sull'etichetta.</p>
        <div class="grid4">${field("fn-k", "Kcal", "", "text", "numeric")}${field("fn-p", "Prot. g", "", "text", "decimal")}${field("fn-c", "Carbo g", "", "text", "decimal")}${field("fn-f", "Grassi g", "", "text", "decimal")}</div>
        ${field("fn-por", "Porzione abituale (g)", "100", "text", "numeric")}
        <div id="fn-err"></div><button class="primary" data-act="fn-save">Salva alimento</button>`;
    }
    o.innerHTML = `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  };
  const err = (id, t) => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="alert">${esc(t)}</div>`; };

  /* ---------- events ---------- */
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "tab" && v === "piano") S.hub = "";
    if (act === "wipe" && !S.confirmWipe) { e.stopPropagation(); S.confirmWipe = true; render(); return; }
    if (act === "hub") { S.hub = v; S.dietDow = S.dietDow ?? new Date().getDay(); window.scrollTo(0, 0); render(); }
    else if (act === "hub-sheet") { S.hubArg = { s: +b.dataset.s, e: b.dataset.e === "new" ? "new" : +b.dataset.e, k: b.dataset.k }; S.confirmXe = S.confirmSe = false; S.meScope = "day"; S.sheet = v; renderSheet(); }
    else if (act === "xe-bw") { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "Sì" : "No"; }
    else if (act === "xe-save") {
      const h = S.hubArg, s = T().sedute[h.s], nome = $("#xe-nome").value.trim(), serie = Math.round(num2($("#xe-serie").value) || 0), lo = Math.round(num2($("#xe-min").value) || 0), hi = Math.round(num2($("#xe-max").value) || lo);
      if (!nome) return err("xe-err", "Scrivi il nome dell'esercizio.");
      if (serie < 1 || serie > 10 || lo < 1 || hi < lo || hi > 50) return err("xe-err", "Controlla serie (1–10) e ripetizioni (minimo ≤ massimo).");
      const bw = $("#xe-bw").getAttribute("aria-pressed") === "true", prev = h.e === "new" ? {} : s.esercizi[h.e];
      const ex = { ...prev, nome, serie, min: lo, max: hi, kg: bw ? null : num2($("#xe-kg").value), recupero: Math.round(num2($("#xe-rec").value) || 90), tecnica: $("#xe-tec").value.trim(), corpo_libero: bw };
      if (prev.nome && prev.nome !== nome) { delete ex.lib; delete ex.demo; delete ex.en; delete ex.last; }
      if (h.e === "new") s.esercizi.push({ muscolo: "Altro", ...ex }); else s.esercizi[h.e] = ex;
      saveTraining(); S.sheet = null; render(); toast(h.e === "new" ? "Esercizio aggiunto" : "Esercizio aggiornato");
    }
    else if (act === "xe-del") { if (!S.confirmXe) { S.confirmXe = true; renderSheet(); return; } const h = S.hubArg; T().sedute[h.s].esercizi.splice(h.e, 1); saveTraining(); S.sheet = null; render(); toast("Esercizio eliminato"); }
    else if (act === "ex-move") { const s = T().sedute[+b.dataset.s], i = +b.dataset.e, j = i + (+v); if (j < 0 || j >= s.esercizi.length) return; [s.esercizi[i], s.esercizi[j]] = [s.esercizi[j], s.esercizi[i]]; saveTraining(); render(); }
    else if (act === "sess-add") { T().sedute.push({ nome: "Seduta " + String.fromCharCode(65 + T().sedute.length), dow: null, focus: "", esercizi: [] }); saveTraining(); render(); S.hubArg = { s: T().sedute.length - 1 }; S.sheet = "sess-edit"; renderSheet(); }
    else if (act === "se-dow") { document.querySelectorAll('[data-act="se-dow"]').forEach(x => x.setAttribute("aria-pressed", String(x === b))); S.hubArg.dow = v === "" ? null : +v; }
    else if (act === "se-save") { const s = T().sedute[S.hubArg.s]; s.nome = $("#se-nome").value.trim() || s.nome; s.focus = $("#se-focus").value.trim(); if ("dow" in S.hubArg) s.dow = S.hubArg.dow; saveTraining(); S.sheet = null; render(); toast("Seduta aggiornata"); }
    else if (act === "se-del") { if (!S.confirmSe) { S.confirmSe = true; renderSheet(); return; } T().sedute.splice(S.hubArg.s, 1); saveTraining(); S.sheet = null; render(); toast("Seduta eliminata"); }
    else if (act === "me-scope") { S.meScope = v; document.querySelectorAll('[data-act="me-scope"]').forEach(x => x.setAttribute("aria-pressed", String(x === b))); }
    else if (act === "me-est") {
      const items = $("#me-i").value.trim(); if (!items || !S.sample) return; S.hubBusy = true; b.textContent = "Calcolo…"; b.disabled = true;
      try { const out = await S.sample.json(NUT_PROMPT + "\n\nDESCRIZIONE:\n" + items, { fast: true, modelTier: "quick" }); const tot = (out.alimenti || []).reduce((a2, x) => ({ kcal: a2.kcal + num(x.kcal), p: a2.p + num(x.p), c: a2.c + num(x.c), f: a2.f + num(x.f) }), { kcal: 0, p: 0, c: 0, f: 0 });
        $("#me-k").value = Math.round(tot.kcal); $("#me-p").value = Math.round(tot.p); $("#me-c").value = Math.round(tot.c); $("#me-f").value = Math.round(tot.f); } catch (_) { toast("Stima non riuscita: scrivi tu i valori"); }
      S.hubBusy = false; b.textContent = "Calcola calorie dagli alimenti"; b.disabled = false;
    }
    else if (act === "me-save" || act === "me-clear") {
      const dw = S.dietDow ?? new Date().getDay(), k = S.hubArg.k, d = S.diet || (S.diet = { fonte: "piano", giorni: {} }); d.giorni = d.giorni || {}; d.fonte = "piano";
      const meal = act === "me-clear" ? null : { t: $("#me-t").value.trim(), i: $("#me-i").value.split(/\n+/).map(x => x.trim()).filter(Boolean), kcal: Math.round(num2($("#me-k").value) || 0), p: num2($("#me-p").value) || 0, c: num2($("#me-c").value) || 0, f: num2($("#me-f").value) || 0 };
      if (meal && !meal.t) return toast("Scrivi il titolo del pasto");
      for (const day of (S.meScope === "all" && act === "me-save" ? DOWI : [dw])) { d.giorni[day] = d.giorni[day] || {}; if (meal) d.giorni[day][k] = { ...meal }; else delete d.giorni[day][k]; }
      const days = Object.values(d.giorni).filter(g => Object.keys(g).length); if (days.length) { d.kcal = Math.round(days.reduce((a2, g) => a2 + Object.values(g).reduce((s2, m) => s2 + (m.kcal || 0), 0), 0) / days.length); d.p = Math.round(days.reduce((a2, g) => a2 + Object.values(g).reduce((s2, m) => s2 + (m.p || 0), 0), 0) / days.length); }
      saveDiet(); S.sheet = null; render(); toast(act === "me-clear" ? "Pasto tolto" : "Pasto salvato");
    }
    else if (act === "fn-save") {
      const nome = $("#fn-nome").value.trim(), k = num2($("#fn-k").value);
      if (!nome || !k) return err("fn-err", "Scrivi almeno nome e calorie per 100 g.");
      S.foods.push({ id: "f" + Date.now(), nome, per100: { kcal: k, p: num2($("#fn-p").value) || 0, c: num2($("#fn-c").value) || 0, f: num2($("#fn-f").value) || 0 }, porzione: num2($("#fn-por").value) || 100, tipo: "manuale", used: 0, pending: true });
      persistFoods(); S.sheet = null; render(); toast("Alimento salvato");
    }
  }, true);
  document.addEventListener("change", async e => {
    const t = e.target; if (!t.dataset || t.dataset.act !== "hub-food-photo" || !t.files || !t.files[0]) return;
    if (!S.sample) { toast("Per leggere le etichette attiva l'AI gratuita qui sotto"); return; }
    S.hubBusy = true; render();
    try {
      const blob = await shrink(t.files[0]), out = await S.sample.json(LABEL_PROMPT, { images: [blob], modelTier: "quick", fast: true });
      const p = out && out.per100 || {}, per100 = { kcal: num(p.kcal), p: num(p.p), c: num(p.c), f: num(p.f) };
      if (!per100.kcal) throw new Error("vuoto");
      S.foods.push({ id: "f" + Date.now(), nome: String(out.nome || "Alimento"), per100, porzione: num(out.porzione_g) || 100, tipo: out.tipo === "etichetta" ? "etichetta" : "stima", used: 0, pending: true });
      persistFoods(); toast(`Salvato: ${out.nome || "alimento"}`);
    } catch (_) { toast("Non riesco a leggere i valori: riprova con l'etichetta dritta e ben illuminata"); }
    S.hubBusy = false; render();
  });

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
  .hcard { background: var(--surface); border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  details.hcard summary { list-style: none; cursor: pointer; } details.hcard summary::-webkit-details-marker { display: none; }
  details.hcard summary h2::after { content: " +"; color: var(--accent); } details.hcard[open] summary h2::after { content: " −"; }
  .hc-h { display: flex; gap: 12px; align-items: center; }
  .hc-ic { width: 42px; height: 42px; border-radius: 14px; background: var(--accent); display: grid; place-items: center; flex: none; }
  .hc-ic svg { width: 22px; height: 22px; stroke: var(--lime-ink); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .hc-acts { display: flex; flex-direction: column; gap: 8px; }
  .hc-acts .ghost { min-height: 46px; }
  .wstrip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .wd { background: var(--raised); border-radius: 12px; padding: 6px 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .wd small { font-size: 11px; color: var(--faint); } .wd b { font-size: 15px; color: var(--faint); }
  .wd.on { background: var(--accent); } .wd.on small, .wd.on b { color: var(--lime-ink); }
  .mini-kv { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .mini-kv span { background: var(--raised); border-radius: 14px; padding: 8px 10px; display: flex; flex-direction: column; font-size: 12px; color: var(--muted); }
  .mini-kv b { font-size: 16px; color: var(--text); font-variant-numeric: tabular-nums; }
  .flist { display: flex; flex-direction: column; gap: 6px; }
  .frow { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--raised); border-radius: 14px; padding: 10px 12px; }
  .frow > span { display: flex; flex-direction: column; min-width: 0; } .frow small { color: var(--muted); font-size: 12px; }
  label.primary.file-btn { display: flex; align-items: center; justify-content: center; }
  .ed-h { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .ghost.sm { min-height: 36px; padding: 4px 14px; font-size: 13px; }
  .ed-list { display: flex; flex-direction: column; gap: 6px; }
  .ed-row { display: flex; align-items: center; gap: 6px; }
  .ed-main { flex: 1; min-width: 0; text-align: left; border: 0; background: var(--raised); color: var(--text); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
  .ed-main small { color: var(--muted); font-size: 12px; }
  .icon-btn.sm { width: 40px; height: 40px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .grid4 .field, .grid3 .field { min-width: 0; }
  .field input[type=text] { height: 48px; border-radius: 14px; border: 0; background: var(--raised); padding: 0 12px; font-size: 16px; width: 100%; color: var(--text); }
  .mrow { width: 100%; text-align: left; border: 0; background: var(--surface); color: var(--text); border-radius: 20px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
  .mr-l { font-size: 12px; color: var(--faint); }
  .mr-edit { display: inline-flex; gap: 6px; align-items: center; color: var(--accent); font-size: 13px; font-weight: 700; }
  `;
  document.head.appendChild(st);
  render();
})();

/* Backup and restore of everything kept on this phone (localStorage + photo blobs). */
(function () {
  const blobToUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  async function photos() {
    try { const d = await idb(); return await new Promise((res, rej) => { const st = d.transaction("blobs").objectStore("blobs"), out = {}; const c = st.openCursor(); c.onsuccess = async () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); }; c.onerror = () => rej(c.error); }); } catch (_) { return {}; }
  }
  async function backup() {
    const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(NS) || k === "gemini_key" || k === "gemini_models_v2") ls[k] = localStorage.getItem(k); }
    const ph = await photos(), pu = {}; for (const k in ph) if (ph[k] instanceof Blob) pu[k] = await blobToUrl(ph[k]);
    const name = `askesis-copia-${localISO()}.json`, file = new File([JSON.stringify({ app: "askesis", ns: NS, v: 1, date: new Date().toISOString(), ls, photos: pu })], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); toast("Copia pronta: salvala in File"); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    siteDownloads.save({ filename: name, data: file }); toast("Copia scaricata");
  }
  async function restore(f) {
    try {
      const j = JSON.parse(await f.text()); if (!j || j.app !== "askesis" || !j.ls) throw new Error("x");
      if (j.ns !== NS) { toast("Questa copia è dell'altra app: aprila lì."); return; }
      for (const k in j.ls) localStorage.setItem(k, j.ls[k]);
      for (const k in j.photos || {}) { const r = await fetch(j.photos[k]); await idbPut(k, await r.blob()); }
      toast("Dati ripristinati"); setTimeout(() => location.reload(), 700);
    } catch (_) { toast("File non valido: scegli una copia salvata da Askesis."); }
  }
  document.addEventListener("click", e => { const b = e.target.closest('[data-act="backup"]'); if (b) backup().catch(() => toast("Non sono riuscito a creare la copia.")); });
  document.addEventListener("change", e => { const i = e.target; if (i.dataset && i.dataset.act === "restore" && i.files && i.files[0]) { restore(i.files[0]); i.value = ""; } });
})();

/* My foods everywhere: suggestions while typing a meal, and the estimate uses the saved label values. */
(function () {
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const toks = s => norm(s).split(/\s+/).filter(w => w.length >= 3);
  function matches(text) {
    const words = toks(text); if (!words.length) return [];
    const has = t => words.some(w => w.startsWith(t.slice(0, Math.max(4, t.length - 2))) || t.startsWith(w.slice(0, Math.max(4, w.length - 2))));
    const taken = new Set(((S.food && S.food.items) || []).map(x => x.fid).filter(Boolean));
    return S.foods.filter(f => !taken.has(f.id)).map(f => { const t = toks(f.nome), n = t.filter(has).length; return { f, n, ok: n >= 2 || (n === 1 && (t.length === 1 || t.some(x => has(x) && x.length >= 5))) }; })
      .filter(x => x.ok).sort((a, b) => b.n - a.n || (b.f.used || 0) - (a.f.used || 0)).slice(0, 4).map(x => x.f);
  }
  const sugg = () => { const el = document.getElementById("fsugg"), ta = document.getElementById("ftext"); if (!el || !ta) return; const m = matches(ta.value);
    el.innerHTML = m.length ? `<p class="small muted" style="margin:0 0 6px">Dai tuoi alimenti, con i valori dell'etichetta:</p><div class="chips">${m.map(f => `<button class="primary sm" data-act="fadd-s" data-v="${f.id}">+ ${esc(f.nome)} · ${fmt(f.porzione || 100)} g</button>`).join("")}</div>` : ""; };
  const prev = window.renderSheet;
  window.renderSheet = function () { prev(); if (S.sheet === "food") { const ta = document.getElementById("ftext"); if (ta && !document.getElementById("fsugg")) { ta.insertAdjacentHTML("afterend", '<div id="fsugg"></div>'); sugg(); } } };
  document.addEventListener("input", e => { if (e.target && e.target.id === "ftext") { if (S.food) S.food.text = e.target.value; sugg(); } });
  document.addEventListener("click", e => { const b = e.target.closest('[data-act="fadd-s"]'); if (!b) return; e.stopPropagation();
    const fo = S.foods.find(x => x.id === b.dataset.v); if (!fo || !S.food) return;
    const ta = document.getElementById("ftext"); if (ta) S.food.text = ta.value;
    S.food.items.push({ nome: fo.nome, per100: fo.per100, g: fo.porzione || 100, src: "lib", fid: fo.id }); renderSheet(); }, true);

  // estimate: the AI must reuse the saved label values when the text names a saved food
  window.estimateFood = async function () {
    const f = S.food, t = (($("#ftext") || {}).value || "").trim(); f.text = t;
    if (!t) { f.err = "Scrivi cosa hai mangiato, con le quantità se le sai."; renderSheet(); return; }
    blurAll(); f.busy = "text"; f.err = null; renderSheet();
    const lib = S.foods.slice().sort((x, y) => (y.used || 0) - (x.used || 0)).slice(0, 40);
    const extra = lib.length ? `\n\nALIMENTI SALVATI DALL'UTENTE (valori per 100 g letti dall'etichetta). Se la descrizione nomina uno di questi, anche in modo approssimativo, usa ESATTAMENTE questi valori, metti il suo "id" e i "grammi" mangiati (se la quantità manca usa la porzione abituale):\n${lib.map(x => `${x.id} | ${x.nome} | ${x.per100.kcal} kcal, P ${x.per100.p}, C ${x.per100.c}, G ${x.per100.f} per 100 g | porzione abituale ${x.porzione || 100} g`).join("\n")}\nPer questi aggiungi all'oggetto anche "id":"…" e "grammi":0.` : "";
    try {
      f.ac = new AbortController(); const t0 = Date.now(); clearInterval(f.tick); f.tick = setInterval(() => { const el = document.getElementById("f-busy"); if (el) el.textContent = `Sto stimando… ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
      const out = await S.sample.json(NUT_PROMPT + extra + "\n\nDESCRIZIONE:\n" + t, { modelTier: "quick", fast: true, signal: f.ac.signal });
      const items = (out && Array.isArray(out.alimenti) ? out.alimenti : []).map(x => {
        const fo = x.id && S.foods.find(y => y.id === x.id);
        if (fo) return { nome: fo.nome, per100: fo.per100, g: num(x.grammi) || gramsOf(x.quantita) || fo.porzione || 100, src: "stima", fid: fo.id };
        return { nome: String(x.nome || "Alimento"), quantita: String(x.quantita || ""), g: gramsOf(x.quantita), kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f), src: "stima" };
      });
      if (!items.length || !items.some(x => x.kcal > 0 || x.per100)) throw new Error("vuoto");
      f.items = f.items.filter(x => x.src !== "stima").concat(items);
      const used = items.filter(x => x.fid).length; f.note = (used ? `${used === 1 ? "Un alimento preso" : used + " alimenti presi"} dalle tue etichette. ` : "") + (out.note || "");
    } catch (e) {
      f.err = e && e.code === "cancelled" ? "Stima annullata." : e && e.code === "timeout" ? "Gemini non ha risposto in tempo: riprova, oppure scrivi tu i valori." : "Non sono riuscito a stimare: riprova o aggiungi dai tuoi alimenti.";
    }
    clearInterval(f.tick); f.busy = false; renderSheet();
  };
})();
