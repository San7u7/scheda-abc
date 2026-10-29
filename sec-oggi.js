"use strict";
/* Askesis v3 · sezione «oggi» (FASE 2). Regole e API: V3_CONTRATTO.md. Design approvato: askesis-ux/oggi/confronto_oggi_griglia.html (v3.2).
   Ordine: intestazione → «La tua giornata» (riga del momento con bordo lime + la prossima, «Apri» porta a Cibo/Palestra)
   + «Vedi tutta la giornata» (pagina interna) → box lime «I numeri di oggi» 2×2 → «Lo sapevi?» + Leo.
   Sola lettura di S: le scritture passano dai pulsanti vecchi (data-act="water", "tiles-edit", foglio pasto «meal-open»). */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3;
  let sub = null; // null = pagina principale, "giornata" = pagina interna

  if (!document.getElementById("v3-sec-oggi")) {
    const st = document.createElement("style");
    st.id = "v3-sec-oggi";
    st.textContent = `
    #view.v3 .v3-oggi-tl { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-oggi-tl .v3-when { width: 46px; }
    #view.v3 .v3-oggi-tl .v3-rs { display: -webkit-box !important; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    #view.v3 .v3-oggi-ttl { display: flex; flex-direction: column; gap: 4px; }
    .v3-oggi-w { display: flex; flex-direction: column; gap: 12px; }
    .v3-sheet .v3-oggi-w .v3-row { background: var(--v3-s2); }
    .v3-sheet .v3-oggi-w .v3-row.sm { min-height: 56px; }
    .v3-sheet .v3-apri:disabled { opacity: .4; }`;
    document.head.appendChild(st);
  }

  /* ---------- dati della giornata (sola lettura) ---------- */
  const MT = data.MEAL_TIME; // audit B6: una sola tabella degli orari (v3.js), uguale ai promemoria di settings.js
  const mins = hm => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + (m || 0); };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const prefs = () => Object.assign({ remind: "18:00" }, (typeof lsGet === "function" ? lsGet("prefs", {}) : {}) || {});
  const dayRaw = () => S.days[localISO()] || null; // mai dayLog: non deve creare il giorno
  const mstate = k => { const v = dayRaw(); return v ? mealState({ meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {} }, k) : "open"; };
  const kidWords = () => { const g = data.profile().group; return g === "bambino" || g === "over65"; };
  const sessName = n => kidWords() ? String(n).replace(/^Seduta\b/, "Allenamento") : n;
  const weekLab = () => kidWords() ? "Allenamenti della settimana" : "Sedute della settimana";

  function timeline() {
    const items = [];
    for (const x of data.dayMeals(localISO())) // audit M13: stessi pasti del diario (piano di oggi + quelli già segnati)
      items.push({ kind: "meal", key: x.k, title: x.label, sub: x.m ? x.m.t : x.st === "custom" && x.c ? x.c.text : x.st === "plan" ? "Come da piano" : "Segna cosa hai mangiato", when: MT[x.k], t: mins(MT[x.k]), done: x.eaten, skip: x.st === "skip" });
    /* 28/10 (Giovanni): l'allenamento c'è sempre: da fare, in corso, fatto, riposo o settimana completa (che apre il riepilogo) */
    const s = data.todaySession(), wk = data.week().sessions, full = wk.planned > 0 && wk.done >= wk.planned, n = nowMin();
    if (s.state === "in-corso") items.push({ kind: "sess", title: sessName(s.name) + " in corso", sub: `${s.doneSets} di ${s.sets} serie fatte`, when: "Ora", t: -1, live: true });
    else if (full) items.push({ kind: "week", title: "Settimana completa ✓", sub: "Complimenti, hai tenuto il ritmo", when: `${wk.done}/${wk.planned}`, t: n });
    else if (s.state === "da-fare") { const r = prefs().remind || "18:00"; items.push({ kind: "sess", title: sessName(s.name) + " oggi", sub: `${s.exercises} esercizi · circa ${s.minutes} min`, when: r, t: mins(r) }); }
    else if (s.state === "fatta") { const d = doneToday(), dt = d ? new Date(d.date) : null; items.push({ kind: "sess", title: sessName(s.name), sub: `${wk.done} di ${wk.planned} questa settimana`, when: dt ? dt.getHours() + ":" + String(dt.getMinutes()).padStart(2, "0") : "", t: dt ? dt.getHours() * 60 + dt.getMinutes() : 0, done: true }); }
    else if (s.state === "riposo" && s.name) items.push({ kind: "sess", title: "Oggi riposo", sub: `Prossima: ${sessName(s.name)} · ${wk.done} di ${wk.planned} fatte`, when: "Oggi", t: n });
    return items.sort((a, b) => a.t - b.t);
  }
  /* riga del momento + la prossima: seduta in corso prima di tutto, poi le voci aperte non ancora passate da 2 ore */
  function upcoming(items) { // 28/10: il pasto del momento + sempre la riga dell'allenamento (in corso = prima)
    const ck = data.currentMeal(), tr = items.find(x => x.kind !== "meal"); // audit B6: pasto del momento uguale a Cibo
    const meal = items.find(x => x.kind === "meal" && x.key === ck);
    return (tr && tr.live ? [tr, meal] : [meal, tr]).filter(Boolean);
  }
  const rowOf = (x, on) => {
    const o = { title: x.title, sub: x.sub, when: x.when, on };
    if (x.done) { o.value = x.kind === "meal" ? "Mangiato ✓" : kidWords() ? "Fatto ✓" : "Fatta ✓"; o.sub = x.kind === "sess" ? x.sub : o.sub; }
    else if (x.skip) o.value = "Non mangiato";
    o.act = x.kind === "meal" ? "pasto" : x.kind === "week" ? "riepilogo" : "seduta"; o.arg = x.key || "";
    return ui.row(o);
  };

  /* ---------- riquadri «I numeri di oggi» ---------- */
  const FV = /(frutt[aoi](?!\s+secc)|verdur|vegetal|insalat|ortagg|spremut|\bmel[ae]\b|banan|aranc|\bper[ae]\b|kiwi|pomodor|zucchin|spinac|broccol|carot|finocch|cavol|fagiolin|bietol|peperon|melanzan|frutti di bosco)/i;
  function fruitVeg() { // porzioni di oggi: stesso calcolo dello storico e dei report (V3Stats), così i numeri coincidono ovunque
    if (window.V3Stats) { V3Stats.clear(); const d = V3Stats.day(localISO()); return d.fv == null ? 0 : d.fv; }
    if (!hasPlanNow()) return null;
    const dw = new Date().getDay(); let n = 0;
    for (const [k] of MEALS) if (mstate(k) === "plan") { const m = mealOf(dw, k); if (m) n += (m.i || []).filter(t => FV.test(t)).length; }
    return n;
  }
  function moveMin() { // M3: stessa regola di Progressi e report (V3Stats.move, obiettivo 60 al giorno per i minori)
    const t = localISO();
    if (window.V3Stats && V3Stats.move) return Math.round(V3Stats.move(t, t).min || 0);
    return Math.round(S.sessions.filter(s => localISO(new Date(s.date)) === t).reduce((m, s) => m + (s.tempi && s.tempi.total ? s.tempi.total / 60 : 0), 0));
  }
  function tileKeys() {
    const p = data.profile(), saved = typeof lsGet === "function" ? lsGet("tiles", null) : null;
    const def = data.tilesDefault(); // audit B13: stessi riquadri iniziali di board.js
    let k = Array.isArray(saved) && saved.length === 4 ? saved.slice() : def;
    if (p.minor) k = k.map(x => x === "kcal" || x === "peso" ? "mov" : x); // minori: niente calorie né peso in Oggi
    return k.filter((x, i) => k.indexOf(x) === i).concat(def).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
  }
  function tile(k) {
    const d = data.today();
    if (k === "sess") {
      const w = data.week().sessions;
      if (!w.planned) return ({ label: weekLab(), value: "–", miss: "Crea la scheda", act: "go", arg: "palestra" });
      return ({ label: weekLab(), value: w.done, of: w.planned, pct: ui.pct(w.done, w.planned), act: "riepilogo" });
    }
    if (k === "pro") return ({ label: "Proteine", value: d.pro, of: d.proT, unit: "g", pct: ui.pct(d.pro, d.proT), act: "numeri" });
    if (k === "kcal") return ({ label: "Calorie", value: d.kcal, of: d.kcalT, pct: ui.pct(d.kcal, d.kcalT), act: "numeri" });
    if (k === "carb") return ({ label: "Carboidrati", value: d.cho, of: d.choT || null, unit: "g", pct: d.choT ? ui.pct(d.cho, d.choT) : null, act: "numeri" });
    if (k === "fat") return ({ label: "Grassi", value: d.fat, of: d.fatT || null, unit: "g", pct: d.fatT ? ui.pct(d.fat, d.fatT) : null, act: "numeri" });
    if (k === "water") { const w = water(); return ({ label: "Acqua", value: ui.nf(w.l, 2), of: ui.nf(w.t, 2), unit: "L", pct: ui.pct(w.l, w.t), act: "numeri" }); }
    if (k === "mov") { const m = moveMin(); return ({ label: "Movimento", value: m, of: 60, unit: "min", pct: ui.pct(m, 60), act: "go", arg: "palestra" }); }
    if (k === "fv") { const n = fruitVeg(); return n == null ? ({ label: "Frutta e verdura", value: "–", miss: "Serve il piano dei pasti", act: "numeri" })
      : ({ label: "Frutta e verdura", value: n, of: 5, unit: "porzioni", pct: ui.pct(n, 5), act: "numeri" }); }
    if (k === "peso") { const a = data.weight().avg7, w = a[a.length - 1]; return ({ label: "Peso", value: w ? ui.nf(w.kg) : "–", unit: w ? "kg" : null, miss: w ? "media 7 giorni" : "Nessuna pesata", act: "peso" }); } // audit B1: come Progressi
    return null;
  }
  const water = () => data.water(localISO()); // audit B2: acqua e obiettivo da un punto solo (v3.js)
  /* 29/10: stessi conti per Cibo › «I numeri di oggi» (sec-cibo.js), così i numeri sono identici a questi riquadri */
  window.V3Num = { fruitVeg, water };

  /* ---------- «Lo sapevi?» legato alla giornata e all'età ---------- */
  const FACTS = {
    train: ["Perché i carboidrati prima della seduta", "Riempiono le scorte di glicogeno dei muscoli. Un pasto 2 o 3 ore prima ti fa arrivare in palestra con più energia.", "Cosa mangio prima della seduta?"],
    rest: ["Il muscolo cresce nei giorni di riposo", "Dopo lo sforzo il muscolo si ripara e si rinforza. Oggi proteine e sonno contano quanto la seduta.", "Cosa fare nel giorno di riposo?"],
    pro: ["Le proteine vanno divise nei pasti", "Il corpo le usa meglio se le distribuisci in 4 o 5 pasti, da 20 a 40 g ciascuno.", "Come divido le proteine nella giornata?"],
    water: ["Quanta acqua bere quando ti alleni", "Con il sudore perdi acqua e sali. In seduta bevi a piccoli sorsi, circa un bicchiere ogni 15 o 20 minuti.", "Quanta acqua devo bere oggi?"],
    mov: ["Un'ora di movimento al giorno", "L'Organizzazione mondiale della sanità consiglia almeno 60 minuti al giorno sotto i 18 anni. Valgono anche gioco, bici e corsa.", "Che cosa conta come movimento?"],
    bones: ["Il movimento rende le ossa più forti", "Saltare, correre e sollevare pesi leggeri fa crescere ossa più dense. Le ossa costruite da giovani durano tutta la vita.", "Perché il movimento fa bene alle ossa?"],
    fv: ["Cinque porzioni di frutta e verdura", "Danno fibre, vitamine e acqua. Una porzione è circa un frutto o un piatto di verdura.", "Quanto è una porzione di verdura?"],
    segna: ["Segnare i pasti ti fa vedere cosa mangi davvero", "Quello che ricordiamo a fine giornata è spesso diverso da quello che abbiamo mangiato. Segnarlo subito rende i numeri veri.", "Perché segnare i pasti?"],
    o65: ["Le proteine proteggono i muscoli", "Dopo i 65 anni il muscolo si perde più in fretta. Proteine a ogni pasto e allenamento lo mantengono forte.", "Quante proteine mi servono?"]
  };
  function fact() {
    const p = data.profile(), train = data.today().train, doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    const pool = p.minor ? ["mov", "bones", "water"] : p.over65 ? ["fv", "o65", "water"] : [train ? "train" : "rest", "pro", "water"];
    const k = doy % 2 === 0 ? pool[0] : pool[1 + (doy >> 1) % 2];
    return [k].concat(FACTS[k]);
  }

  /* ---------- pagine ---------- */
  function mainPage() {
    const p = data.profile(), items = timeline(), up = upcoming(items), f = fact();
    const rows = up.length ? up.map((x, i) => rowOf(x, i === 0)).join("")
      : ui.row({ title: items.length ? "Giornata completa" : "Nessun pasto in programma", sub: items.length ? "Hai segnato tutto per oggi" : "Crea il piano alimentare", act: items.length ? null : "go", arg: "cibo" });
    return ui.header(p.nome ? "Ciao " + p.nome : "Oggi") +
      `<section class="v3-sec">${ui.label("La tua giornata")}<div class="v3-oggi-tl">${rows}${items.length ? ui.secondary("Vedi tutta la giornata", "giornata") : ""}</div></section>` +
      ui.limeBox({ title: "I numeri di oggi", action: { label: "Scegli i numeri", act: "riquadri" }, tiles: tileKeys().map(tile).filter(Boolean) }) +
      ui.end(f[1], { act: "sap", arg: f[0], leoQ: f[3] });
  }
  function dayPage() {
    const items = timeline(), meals = items.filter(x => x.kind === "meal"), done = data.mealsDone(localISO()), up = upcoming(items), cur = up[0];
    const verdict = meals.length ? `${done} di ${meals.length} pasti segnati` : "Nessun pasto in programma";
    /* audit M9/M14: nel diario le sedute di oggi già fatte sono righe del diario (tutte, si correggono come i giorni passati); i pasti restano su Cibo */
    const row = x => x.kind === "sess" && x.done && window.V3Giorni ? V3Giorni.sessRows(localISO()) : rowOf(x, x === cur);
    /* settimana completa o seduta in corso: le sedute fatte oggi restano nel diario, al loro orario */
    const fatte = S.sessions.filter(z => localISO(new Date(z.date)) === localISO()).map(z => new Date(z.date)).sort((a2, b2) => a2 - b2);
    const list = window.V3Giorni && fatte.length && !items.some(x => x.kind === "sess" && x.done) ? items.concat({ kind: "fatte", t: fatte[0].getHours() * 60 + fatte[0].getMinutes() }).sort((a2, b2) => a2.t - b2.t) : items;
    const row2 = x => x.kind === "fatte" ? V3Giorni.sessRows(localISO(), true) : row(x);
    if (window.V3Giorni) return V3Giorni.render({ title: ui.dateSub(), verdict, rows: list.map(row2).join("") }); // 29/10 modifica 3: diario con i giorni passati
    return ui.back() + `<div class="v3-oggi-ttl"><h1 class="v3-t1">La tua giornata</h1><p class="v3-sub">${ui.esc(verdict)}</p></div>` +
      `<div class="v3-oggi-tl">${items.map(x => rowOf(x, x === cur)).join("")}</div>` +
      ui.end(FACTS.segna[0], { act: "sap", arg: "segna", leoQ: FACTS.segna[2] });
  }

  /* 29/10: «La tua settimana» tolta (coerenza): la settimana ha una casa sola, Palestra › La mia settimana */

  /* ---------- azioni ---------- */
  function openMeal(k) { V3.open("cibo", { meal: k }); } // apre il pasto k in Cibo; Indietro torna a Oggi
  function waterSheet() {
    const w = water(), body = () => ui.big(`${ui.nf(w.l, 2)} <span class="v3-of">/${ui.nf(w.t, 2)} L</span>`, "Si segna a passi di 0,25 L");
    const s = V3.sheet(`<h2 class="v3-sh1">Acqua di oggi</h2><div class="v3-oggi-w"><div data-oggi-w>${body()}</div>
      <div class="v3-pm2"><button data-act="water" data-v="-1" data-v3act="wupd">Togli 0,25 L</button><button data-act="water" data-v="1" data-v3act="wupd">Aggiungi 0,25 L</button></div></div>${ui.secondary("Chiudi", "close")}`,
    { label: "Acqua di oggi", on: { wupd(a, btn) { const x = water(); toast(btn && btn.dataset.v === "-1" ? "Tolti 0,25 L" : "Aggiunti 0,25 L", { sub: `${ui.nf(x.l, 2)} di ${ui.nf(x.t, 2)} L oggi` }); w.l = x.l; const b = s.el.querySelector("[data-oggi-w]"); if (b) b.innerHTML = body(); } } });
  }

  /* «Personalizza sezione»: scegli 4 riquadri. Salva nella chiave esistente «tiles» di board.js (stesso formato: 4 chiavi) */
  const TL = { sess: "Sedute della settimana", pro: "Proteine", water: "Acqua", kcal: "Calorie", carb: "Carboidrati", fat: "Grassi", peso: "Peso", mov: "Movimento", fv: "Frutta e verdura" };
  function tilesSheet() {
    const p = data.profile(), opts = Object.keys(TL).filter(k => !(p.minor && (k === "kcal" || k === "peso")));
    let sel = tileKeys().slice(); TL.sess = weekLab();
    const html = () => `<h2 class="v3-sh1">Scegli 4 riquadri</h2><p class="v3-shp">${sel.length === 4 ? "Tocca un riquadro scelto per toglierlo." : `Scegline ancora ${4 - sel.length}.`}</p>
      <div class="v3-oggi-w">${opts.map(k => { const i = sel.indexOf(k); return `<button class="v3-row sm${i >= 0 ? " on" : ""}" data-v3act="tsel" data-v3arg="${k}" aria-pressed="${i >= 0}"><span class="v3-rx"><span class="v3-rt" style="display:block">${ui.esc(TL[k])}</span></span><span class="v3-val">${i >= 0 ? (i + 1) + " ✓" : ""}</span></button>`; }).join("")}</div>
      <button class="v3-apri wide" data-v3act="tsave"${sel.length === 4 ? "" : " disabled"}>Salva i 4 riquadri</button>${ui.secondary("Ripristina i riquadri iniziali", "treset")}`;
    const paint = () => { s.el.innerHTML = '<div class="v3-grab"></div>' + html(); };
    const s = V3.sheet(html(), { label: "Scegli 4 riquadri", on: {
      tsel(k) { const i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else if (sel.length < 4) sel.push(k); paint(); },
      tsave() { if (sel.length !== 4) return; lsSet("tiles", sel); s.close(); toast("Riquadri aggiornati"); },
      treset() { lsSet("tiles", null); s.close(); }
    }, onClose: () => setTimeout(() => V3.refresh(), 0) });
  }

  V3.register("oggi", {
    enter(o) { if (o && o.day && window.V3Giorni) { V3Giorni.reset(o.day); sub = "giornata"; V3.page(() => { sub = null; }); } }, // da Palestra › La mia settimana
    render(el) {
      el.innerHTML = sub === "giornata" ? dayPage() : mainPage();
    },
    on: {
      pasto(k) { openMeal(k); },
      seduta() { V3.open("palestra"); },
      giornata() { if (window.V3Giorni) V3Giorni.reset(); sub = "giornata"; V3.page(() => { sub = null; }); },
      ...(window.V3Giorni ? V3Giorni.on : {}),
      riepilogo() { V3.open("palestra", { settimana: true }); },
      acqua() { waterSheet(); },
      numeri() { V3.open("cibo", { numeri: true }); }, // 29/10: riquadri → Cibo › «I numeri di oggi»
      peso() { V3.open("progressi", { storico: { view: "settimana", param: "peso" } }); },
      riquadri() { tilesSheet(); },
      sap(k) {
        const f = FACTS[k] || FACTS.pro;
        V3.sheet(`<h2 class="v3-sh1">${ui.esc(f[0])}</h2><p class="v3-shp">${ui.esc(f[1])}</p>${ui.secondary("Chiudi", "close")}`);
      }
    }
  });
})();
