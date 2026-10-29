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
  const MT = { col: "7:30", spu: "10:30", pra: "13:00", mer: "16:30", cen: "20:00" }; // stessi orari dei promemoria (settings.js)
  const mins = hm => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + (m || 0); };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const prefs = () => Object.assign({ remind: "18:00" }, (typeof lsGet === "function" ? lsGet("prefs", {}) : {}) || {});
  const dayRaw = () => S.days[localISO()] || null; // mai dayLog: non deve creare il giorno
  const mstate = k => { const v = dayRaw(); return v ? mealState({ meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {} }, k) : "open"; };
  const kidWords = () => { const g = data.profile().group; return g === "bambino" || g === "over65"; };
  const sessName = n => kidWords() ? String(n).replace(/^Seduta\b/, "Allenamento") : n;
  const weekLab = () => kidWords() ? "Allenamenti della settimana" : "Sedute della settimana";

  function timeline() {
    const dw = new Date().getDay(), plan = hasMealPlan(), items = [];
    for (const [k, label] of MEALS) {
      const m = plan ? mealOf(dw, k) : null;
      if (plan && !m) continue;
      const st = mstate(k);
      items.push({ kind: "meal", key: k, title: label, sub: m ? m.t : "Segna cosa hai mangiato", when: MT[k], t: mins(MT[k]), done: st === "plan" || st === "custom", skip: st === "skip" });
    }
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
    const n = nowMin(), meals = items.filter(x => x.kind === "meal" && !x.done && !x.skip), tr = items.find(x => x.kind !== "meal");
    const meal = meals.find(x => x.t + 120 > n) || meals[meals.length - 1];
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
  function fruitVeg() { // porzioni dai pasti del piano segnati come fatti oggi
    if (!hasMealPlan()) return null;
    const dw = new Date().getDay(); let n = 0;
    for (const [k] of MEALS) if (mstate(k) === "plan") { const m = mealOf(dw, k); if (m) n += (m.i || []).filter(t => FV.test(t)).length; }
    return n;
  }
  function moveMin() { // minuti di palestra registrati oggi (tempo misurato dal cronometro)
    const t = localISO();
    return Math.round(S.sessions.filter(s => localISO(new Date(s.date)) === t).reduce((m, s) => m + (s.tempi && s.tempi.total ? s.tempi.total / 60 : 0), 0));
  }
  function tileKeys() {
    const p = data.profile(), saved = typeof lsGet === "function" ? lsGet("tiles", null) : null;
    const def = ["sess", "pro", "water", p.minor ? "mov" : p.over65 ? "fv" : "kcal"];
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
    if (k === "pro") return ({ label: "Proteine", value: d.pro, of: d.proT, unit: "g", pct: ui.pct(d.pro, d.proT), act: "go", arg: "cibo" });
    if (k === "kcal") return ({ label: "Calorie", value: d.kcal, of: d.kcalT, pct: ui.pct(d.kcal, d.kcalT), act: "go", arg: "cibo" });
    if (k === "carb") return ({ label: "Carboidrati", value: d.cho, of: d.choT || null, unit: "g", pct: d.choT ? ui.pct(d.cho, d.choT) : null, act: "go", arg: "cibo" });
    if (k === "fat") return ({ label: "Grassi", value: d.fat, of: d.fatT || null, unit: "g", pct: d.fatT ? ui.pct(d.fat, d.fatT) : null, act: "go", arg: "cibo" });
    if (k === "water") { const w = water(); return ({ label: "Acqua", value: ui.nf(w.l, 2), of: ui.nf(w.t, 2), unit: "L", pct: ui.pct(w.l, w.t), act: "acqua" }); }
    if (k === "mov") { const m = moveMin(); return ({ label: "Movimento", value: m, of: 60, unit: "min", pct: ui.pct(m, 60), act: "go", arg: "palestra" }); }
    if (k === "fv") { const n = fruitVeg(); return n == null ? ({ label: "Frutta e verdura", value: "–", miss: "Serve il piano dei pasti", act: "go", arg: "cibo" })
      : ({ label: "Frutta e verdura", value: n, of: 5, unit: "porzioni", pct: ui.pct(n, 5), act: "go", arg: "cibo" }); }
    if (k === "peso") { const w = data.weight().last; return ({ label: "Peso", value: w ? ui.nf(w.kg) : "–", unit: w ? "kg" : null, miss: w ? null : "Nessuna pesata", act: "go", arg: "progressi" }); }
    return null;
  }
  const water = () => { const v = dayRaw(); return { l: (v && v.water || 0) * 0.25, t: planTargets().waterL || 2 }; };

  /* ---------- «Lo sapevi?» legato alla giornata e all'età ---------- */
  const FACTS = {
    train: ["Perché i carboidrati prima della seduta", "Riempiono le scorte di glicogeno dei muscoli. Un pasto 2 o 3 ore prima ti fa arrivare in palestra con più energia.", "Cosa mangio prima della seduta?"],
    rest: ["Il muscolo cresce nei giorni di riposo", "Dopo lo sforzo il muscolo si ripara e si rinforza. Oggi proteine e sonno contano quanto la seduta.", "Cosa fare nel giorno di riposo?"],
    pro: ["Le proteine vanno divise nei pasti", "Il corpo le usa meglio se le distribuisci in 4 o 5 pasti, da 20 a 40 g ciascuno.", "Come divido le proteine nella giornata?"],
    water: ["Quanta acqua bere quando ti alleni", "Con il sudore perdi acqua e sali. In seduta bevi a piccoli sorsi, circa un bicchiere ogni 15 o 20 minuti.", "Quanta acqua devo bere oggi?"],
    mov: ["Un'ora di movimento al giorno", "L'Organizzazione mondiale della sanità consiglia almeno 60 minuti al giorno sotto i 18 anni. Valgono anche gioco, bici e corsa.", "Che cosa conta come movimento?"],
    bones: ["Il movimento rende le ossa più forti", "Saltare, correre e sollevare pesi leggeri fa crescere ossa più dense. Le ossa costruite da giovani durano tutta la vita.", "Perché il movimento fa bene alle ossa?"],
    fv: ["Cinque porzioni di frutta e verdura", "Danno fibre, vitamine e acqua. Una porzione è circa un frutto o un piatto di verdura.", "Quanto è una porzione di verdura?"],
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
    const items = timeline(), meals = items.filter(x => x.kind === "meal"), done = meals.filter(x => x.done).length, up = upcoming(items), cur = up[0];
    const verdict = meals.length ? `${done} di ${meals.length} pasti segnati` : "Nessun pasto in programma";
    if (window.V3Giorni) return V3Giorni.render({ title: ui.dateSub(), verdict, rows: items.map(x => rowOf(x, x === cur)).join("") }); // 29/10 modifica 3: diario con i giorni passati
    return ui.back() + `<div class="v3-oggi-ttl"><h1 class="v3-t1">La tua giornata</h1><p class="v3-sub">${ui.esc(verdict)}</p></div>` +
      `<div class="v3-oggi-tl">${items.map(x => rowOf(x, x === cur)).join("")}</div>` +
      ui.end("Segnare i pasti ti fa vedere cosa mangi davvero", { act: "sap", arg: "pro", leoQ: "Perché segnare i pasti?" });
  }

  /* ---------- riepilogo settimana (28/10, tela tavola 13): kg mossi per giorno incrociati con le proteine ---------- */
  let wOff = 0;
  function weekData(off) {
    const from = addDays(localISO(mondayOf(new Date())), -7 * off), days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const ss = S.sessions.filter(x => { const d = localISO(new Date(x.date)); return d >= from && d <= days[6]; });
    const kgOf = x => (x.items || []).reduce((m, it) => m + (it.sets || []).reduce((a, z) => a + (+z.kg || 0) * (+z.reps || 0), 0), 0);
    const per = days.map(iso => { const di = data.day(iso), l = ss.filter(x => localISO(new Date(x.date)) === iso);
      return { iso, n: l.length, kg: l.reduce((m, x) => m + kgOf(x), 0), proOk: !!(di.logged && di.proT && di.pro >= di.proT * .9) }; });
    const fat = ss.filter(x => x.fatica != null).map(x => +x.fatica), gym = per.filter(d => d.n);
    return { per, done: ss.length, planned: DAYS.length, kg: Math.round(per.reduce((m, d) => m + d.kg, 0)), fat: fat.length ? Math.round(fat.reduce((a, b) => a + b, 0) / fat.length) : null, gym: gym.length, proGym: gym.filter(d => d.proOk).length };
  }
  function weekPage() {
    const w = weekData(wOff), kid = data.profile().group === "bambino", kw = kidWords(), full = w.planned && w.done >= w.planned;
    const nx = P[nextDay()], nxName = nx ? sessName(nx.nome || "Seduta " + nextDay()) : "";
    const verdict = full ? (wOff === 0 && !kid && w.kg > weekData(1).kg ? "Settimana piena, carichi in aumento" : "Settimana piena")
      : wOff === 0 ? (w.done ? `${kw ? "Fatti" : "Fatte"} ${w.done} di ${w.planned}: resta ${nxName}` : "Settimana da iniziare") : `${w.done} di ${w.planned} ${kw ? "allenamenti fatti" : "sedute fatte"}`;
    const max = Math.max(1, ...w.per.map(d => kid ? d.n : d.kg));
    const bars = w.per.map((d, i) => { const v = kid ? d.n : d.kg; return `<span class="v3-wk-b${v ? (d.proOk ? " ok" : " lo") : ""}" style="height:${v ? Math.max(8, v / max * 100) : 3}%" title="${"LMMGVSD"[i]}"></span>`; }).join("");
    const aria = w.per.filter(d => d.n).map(d => `${["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"][new Date(d.iso + "T12:00:00").getDay()]} ${kid ? d.n + " allenamento" : ui.nf(Math.round(d.kg)) + " kg"}${d.proOk ? ", proteine raggiunte" : ", proteine sotto"}`).join("; ") || (kw ? "Nessun allenamento" : "Nessuna seduta");
    const ups = DAYS.reduce((m, k) => m + (P[k] ? P[k].items.filter(it => plan(it).up).length : 0), 0);
    return ui.back() + `<div class="v3-oggi-ttl"><h1 class="v3-t1">La tua settimana</h1><p class="v3-sub v3-wk-v">${ui.esc(verdict)}</p></div>` +
      ui.seg(["Questa settimana", "Settimana scorsa"], wOff, "wsel", "Settimana") +
      ui.card(`<div class="v3-wk-h"><span>${kid ? "Allenamenti" : "Peso sollevato"}</span><b>${w.done} di ${w.planned} ${kw ? "allenamenti" : "sedute"}</b></div>` +
        `<p class="v3-bn">${kid ? w.done : ui.nf(w.kg) + ' <span class="v3-of">kg</span>'}</p>` +
        `<div class="v3-wk-c" role="img" aria-label="${ui.esc(aria)}">${bars}</div><div class="v3-wk-d" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div>` +
        `<p class="v3-bd">Barra piena: proteine raggiunte quel giorno</p>`) +
      `<div class="v3-oggi-tl">${ui.row({ title: "Proteine raggiunte", sub: w.gym ? `${w.proGym} ${kw ? (w.proGym === 1 ? "allenamento" : "allenamenti") : (w.proGym === 1 ? "seduta" : "sedute")} su ${w.gym}` : (kw ? "Nessun allenamento ancora" : "Nessuna seduta ancora"), act: "go", arg: "cibo" })}` +
      ui.row(kid ? { title: "Prossimo allenamento", sub: nxName, act: "go", arg: "palestra" } : { title: w.fat != null ? `Fatica media: ${w.fat} su 10` : "Fatica non segnata", sub: ups ? `${ups} ${ups === 1 ? "carico pronto" : "carichi pronti"} a salire` : "Carichi stabili", act: "go", arg: "palestra" }) + `</div>` +
      ui.end("Il muscolo cresce a riposo, se mangi proteine.", { act: "sap", arg: "pro", leoQ: "Perché le proteine contano nei giorni di palestra?" });
  }
  if (!document.getElementById("v3-sec-oggi-wk")) { const st = document.createElement("style"); st.id = "v3-sec-oggi-wk"; st.textContent = `
    #view.v3 .v3-wk-v { color: var(--v3-lime); font-weight: 600; }
    #view.v3 .v3-wk-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; } #view.v3 .v3-wk-h span { font-size: 15px; font-weight: 600; color: var(--v3-t2); } #view.v3 .v3-wk-h b { font-size: 15px; color: var(--v3-lime); }
    #view.v3 .v3-wk-c { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; align-items: end; height: 120px; border-bottom: 1px solid var(--v3-s3); }
    #view.v3 .v3-wk-b { display: block; background: var(--v3-s3); border-radius: 6px 6px 0 0; } #view.v3 .v3-wk-b.ok { background: #fff; } #view.v3 .v3-wk-b.lo { background: rgba(255,255,255,.4); }
    #view.v3 .v3-wk-d { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; text-align: center; font-size: 13px; color: var(--v3-t3); }`; document.head.appendChild(st); }

  /* ---------- azioni ---------- */
  function openMeal(k) { V3.go("cibo", { meal: k }); } // apre Cibo direttamente sulla pagina del pasto k
  function waterSheet() {
    const w = water(), body = () => ui.big(`${ui.nf(w.l, 2)} <span class="v3-of">/${ui.nf(w.t, 2)} L</span>`, "Un bicchiere = 250 ml");
    const s = V3.sheet(`<h2 class="v3-sh1">Acqua di oggi</h2><div class="v3-oggi-w"><div data-oggi-w>${body()}</div>
      <div class="v3-pm2"><button data-act="water" data-v="-1" data-v3act="wupd">Togli bicchiere</button><button data-act="water" data-v="1" data-v3act="wupd">Aggiungi bicchiere</button></div></div>${ui.secondary("Chiudi", "close")}`,
    { label: "Acqua di oggi", on: { wupd(a, btn) { const x = water(); toast(btn && btn.dataset.v === "-1" ? "Bicchiere tolto" : "Bicchiere aggiunto", { sub: `${ui.nf(x.l, 2)} di ${ui.nf(x.t, 2)} L oggi` }); w.l = x.l; const b = s.el.querySelector("[data-oggi-w]"); if (b) b.innerHTML = body(); } } });
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
      el.innerHTML = sub === "giornata" ? dayPage() : sub === "settimana" ? weekPage() : mainPage();
    },
    on: {
      pasto(k) { openMeal(k); },
      seduta() { V3.go("palestra"); },
      giornata() { if (window.V3Giorni) V3Giorni.reset(); sub = "giornata"; V3.page(() => { sub = null; }); },
      ...(window.V3Giorni ? V3Giorni.on : {}),
      riepilogo() { const prev = sub; sub = "settimana"; wOff = 0; V3.page(() => { sub = prev; }); },
      wsel(i) { wOff = +i; V3.refresh(); },
      acqua() { waterSheet(); },
      riquadri() { tilesSheet(); },
      sap(k) {
        const f = FACTS[k] || FACTS.pro;
        V3.sheet(`<h2 class="v3-sh1">${ui.esc(f[0])}</h2><p class="v3-shp">${ui.esc(f[1])}</p>${ui.secondary("Chiudi", "close")}`);
      }
    }
  });
})();
