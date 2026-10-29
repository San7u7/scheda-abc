"use strict";
/* Askesis · modifica 3 «Giorni» (tavole 53-57 sulla tela VbzJRaYwKqEgjRuQgGX1Yr, decisioni in askesis-ux/Giorni_PROPOSTA.md).
   Diario dentro Oggi › «Vedi tutta la giornata»: striscia della settimana, si tocca un giorno e si vedono le stesse righe di oggi.
   Solo pasti e sedute, fino a 13 giorni fa, mai il futuro. Oggi usa ancora le righe e i fogli di Cibo e Palestra (li passa sec-oggi).
   Scritture: dayLog/saveDay per i pasti (snap e target del giorno come in Cibo); S.sessions per le sedute (+ online);
   S.state.ex solo se la seduta toccata è (o era) l'ultima di quell'esercizio. Niente festa né toast di record per le correzioni. */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3, e = ui.esc, nf = ui.nf;
  const GG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const MT = data.MEAL_TIME; // audit B6: una sola tabella degli orari (v3.js)
  const T = () => localISO();
  const minIso = () => addDays(T(), -13);
  const okIso = iso => !!iso && iso >= minIso() && iso <= T();
  const dt = iso => new Date(iso + "T12:00:00");
  const gName = iso => GG[dt(iso).getDay()];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dLong = iso => cap(`${gName(iso)} ${dt(iso).getDate()} ${MESI[dt(iso).getMonth()]}`);
  const dShort = iso => `${gName(iso)} ${dt(iso).getDate()}`;
  const LAB = k => (MEALS.find(m => m[0] === k) || [k, k])[1];
  const prof = () => data.profile();
  const kid = () => prof().group === "bambino";
  const minor = () => prof().minor; // audit A5: niente calorie sotto i 18 anni
  const kw = () => { const g = prof().group; return g === "bambino" || g === "over65"; };
  const sessWord = () => kw() ? "allenamento" : "seduta";
  const sName = k => { const n = P[k] ? (P[k].nome || "Seduta " + k) : "Seduta " + k; return kw() ? n.replace(/^Seduta\b/, "Allenamento") : n; };
  const hm = iso => { const d = new Date(iso); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const clone = x => JSON.parse(JSON.stringify(x));

  if (!document.getElementById("v3-giorni")) {
    const st = document.createElement("style"); st.id = "v3-giorni";
    st.textContent = `
    #view.v3 .v3-g-ttl { display: flex; flex-direction: column; gap: 4px; }
    #view.v3 .v3-g-v { color: var(--v3-lime); font-weight: 600; }
    #view.v3 .v3-g-wk { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-g-wk .v3-lab-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    #view.v3 .v3-g-prev { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 0; background: transparent; box-shadow: inset 0 0 0 1.5px var(--v3-lime); color: var(--v3-lime); font: 700 14px/1 inherit; font-family: inherit; }
    #view.v3 .v3-g-prev:disabled { opacity: .35; }
    #view.v3 .v3-g-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    #view.v3 .v3-g-c { min-height: 72px; border-radius: 16px; border: 0; background: var(--v3-s1); color: var(--v3-t1); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0; font-family: inherit; }
    #view.v3 .v3-g-c span { font-size: 12px; font-weight: 600; color: var(--v3-t2); }
    #view.v3 .v3-g-c b { font-size: 18px; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-g-c.today { box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.6); }
    #view.v3 .v3-g-c.today span { color: var(--v3-t1); }
    #view.v3 .v3-g-c[aria-current="date"] { background: color-mix(in srgb, var(--v3-lime) 12%, transparent); box-shadow: inset 0 0 0 1.5px var(--v3-lime); color: var(--v3-lime); }
    #view.v3 .v3-g-c[aria-current="date"] span { color: var(--v3-lime); }
    #view.v3 .v3-g-c:disabled { background: transparent; box-shadow: inset 0 0 0 1px var(--v3-s3); color: var(--v3-t3); }
    #view.v3 .v3-g-c:disabled span { color: var(--v3-t3); }
    #view.v3 .v3-g-d { display: flex; gap: 3px; height: 6px; align-items: center; }
    #view.v3 .v3-g-d i { width: 5px; height: 5px; border-radius: 50%; background: var(--v3-lime); }
    #view.v3 .v3-g-d i.s { width: 6px; height: 6px; border-radius: 2px; background: var(--v3-t1); }
    #view.v3 .v3-g-list { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-g-list .v3-when { width: 46px; }
    #view.v3 .v3-g-hd, #view.v3 .v3-g-set { display: grid; grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: center; }
    #view.v3 .v3-g-hd { padding: 0 12px; font-size: 14px; color: var(--v3-t2); text-align: center; }
    #view.v3 .v3-g-set { border-radius: 18px; background: var(--v3-s1); padding: 8px 12px; }
    #view.v3 .v3-g-set.ch { box-shadow: inset 0 0 0 1.5px var(--v3-lime); }
    #view.v3 .v3-g-set > b { text-align: center; font-size: 15px; color: var(--v3-t2); }
    #view.v3 .v3-g-set .stepper { display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; align-items: center; }
    #view.v3 .v3-g-set .stepper button { font-size: 20px; font-family: inherit; padding: 0; }
    #view.v3 .v3-g-set .stepper span { text-align: center; font-weight: 700; font-size: 16px; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-g-set .v3-g-na { text-align: center; color: var(--v3-t3); }
    #view.v3 .v3-g-ex { display: flex; flex-direction: column; gap: 8px; }
    #view.v3 .v3-g-row { display: flex; align-items: center; gap: 12px; }
    #view.v3 .v3-g-row.off { opacity: .7; }
    #view.v3 .v3-g-acts { display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
    .v3-sheet .v3-g-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .v3-sheet .v3-g-note { padding-left: 16px; font-size: 15px; color: var(--v3-t2); margin: 0; }`;
    document.head.appendChild(st);
  }

  /* ---------- lettura ---------- */
  const dayV = iso => { const v = S.days[iso]; return v ? { meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {}, extra: v.extra || [] } : { meals: {}, custom: {}, skip: {}, extra: [] }; };
  /* audit M13: i pasti di quel giorno (piano + segnati anche se il piano di oggi non li prevede più), da v3.js */
  const mealsOf = iso => data.dayMeals(iso);
  /* audit M14: tutte le sedute del giorno, dalla prima all'ultima */
  const sessAll = iso => S.sessions.filter(s => localISO(new Date(s.date)) === iso).sort((a, b) => a.date < b.date ? -1 : 1);
  const nSets = s => (s.items || []).reduce((m, x) => m + (x.cardio ? 0 : (x.sets || []).length), 0);
  const locked = () => { if (!activeDay()) return false; toast(`Concludi prima ${kw() ? "l'allenamento" : "la seduta"} di oggi`); return true; };

  /* ---------- stato (solo in memoria) ---------- */
  let sel = null, wOff = 0;
  const pile = []; // pagine sopra il diario: {p:"seduta", id, work, orig, exp} | {p:"nuova", iso, day, items, exp}
  function open(o) { pile.unshift(o); V3.page(() => { pile.shift(); }); }
  const top = () => pile[0] || null;

  /* ---------- diario ---------- */
  function strip() {
    const t = T(), from = addDays(localISO(mondayOf(new Date())), -7 * wOff), canPrev = addDays(from, -1) >= minIso();
    const cells = Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(from, i), dis = iso > t || iso < minIso(), ms = dis ? [] : mealsOf(iso), done = dis ? 0 : data.mealsDone(iso), s = !dis && sessAll(iso).length > 0;
      const dots = "<i></i>".repeat(Math.min(5, done)) + (s ? '<i class="s"></i>' : "");
      const aria = `${cap(gName(iso))} ${dt(iso).getDate()} ${MESI[dt(iso).getMonth()]}${iso === t ? ", oggi" : ""}${dis ? "" : `, ${done} ${done === 1 ? "pasto" : "pasti"}${s ? ", " + sessWord() + " fatta" : ""}`}`;
      return `<button class="v3-g-c${iso === t ? " today" : ""}"${iso === sel ? ' aria-current="date"' : ""}${dis ? " disabled aria-disabled=\"true\"" : ` data-v3act="g-day" data-v3arg="${iso}"`} aria-label="${e(aria)}"><span>${iso === t ? "oggi" : "LMMGVSD"[i]}</span><b>${dt(iso).getDate()}</b><span class="v3-g-d" aria-hidden="true">${dots}</span></button>`;
    }).join("");
    return `<div class="v3-g-wk"><div class="v3-lab-row"><h2 class="v3-lab">${wOff ? "Settimana prima" : "Questa settimana"}</h2>` +
      (wOff ? `<button class="v3-g-prev" data-v3act="g-wk" data-v3arg="${wOff - 1}">Settimana dopo</button>` : `<button class="v3-g-prev" data-v3act="g-wk" data-v3arg="${wOff + 1}"${canPrev ? "" : " disabled"}>Settimana prima</button>`) +
      `</div><div class="v3-g-strip" role="group" aria-label="Giorni della settimana">${cells}</div></div>`;
  }
  function mealRow(iso, x) {
    const done = x.st === "plan" || x.st === "custom";
    const sub = x.st === "plan" ? "Come da piano" : x.st === "custom" ? "Altro: " + x.c.text : x.st === "skip" ? "Non mangiato" : x.m ? x.m.t : "Non segnato";
    return ui.row({ title: LAB(x.k) + (done ? " ✓" : ""), sub, when: MT[x.k], act: "g-meal", arg: x.k, apri: x.st === "open" ? "Segna" : "Cambia" });
  }
  function sessRow(iso, only) { // only = solo le sedute fatte (oggi, accanto alle righe di sec-oggi)
    const all = sessAll(iso);
    if (all.length) return all.map(s => ui.row({ title: sName(s.day), sub: `${nSets(s)} serie${s.late ? " · segnata dopo" : ""}`, when: s.late ? "" : hm(s.date), act: "g-sess", arg: s.id })).join("");
    if (only || !DAYS.length) return "";
    return ui.row({ title: kw() ? "Nessun allenamento" : "Nessuna seduta", sub: "Ti sei allenato senza app?", act: "g-new", apri: "Segna" });
  }
  /* host = { title, verdict, rows } per oggi (le righe di sempre di sec-oggi) */
  function diary(host) {
    if (!sel || !okIso(sel)) sel = T();
    const p = top(); if (p) return p.p === "seduta" ? sessPage(p) : newPage(p);
    let head, rows;
    if (sel === T()) { head = [host.title, host.verdict]; rows = host.rows; }
    else {
      const ms = mealsOf(sel), done = data.mealsDone(sel), ns = sessAll(sel).length;
      head = [dLong(sel), (ms.length ? `${done} ${done === 1 ? "pasto" : "pasti"} su ${ms.length}` : "Nessun pasto in programma") + (ns === 1 ? ` e ${sessWord()} fatta` : ns > 1 ? ` e ${ns} ${kw() ? "allenamenti fatti" : "sedute fatte"}` : "")];
      rows = ms.map(x => mealRow(sel, x)).join("") + sessRow(sel);
    }
    return ui.back() + `<div class="v3-g-ttl"><h1 class="v3-t1">${e(head[0])}</h1><p class="v3-sub v3-g-v">${e(head[1])}</p></div>` + strip() +
      `<div class="v3-g-list">${rows}</div>` +
      ui.end(SAP[0], { act: "g-sap", leoQ: "Perché segnare i pasti?" });
  }

  /* audit B8: il foglio «Lo sapevi?» ripete il testo dell'anteprima e lo spiega */
  const SAP = ["Puoi sistemare pasti e sedute fino a due settimane fa", "Tocca un giorno nella striscia, poi il pasto o la seduta da correggere. Cambiano solo i numeri di quel giorno."];
  function sapSheet() { V3.sheet(`<h2 class="v3-sh1">${e(SAP[0])}</h2><p class="v3-shp">${e(SAP[1])}</p>${ui.secondary("Chiudi", "close")}`, { label: "Lo sapevi?" }); }

  /* ---------- pasto di un giorno passato (tavola GiorniPasto) ---------- */
  function setMeal(iso, k, how) {
    if (!okIso(iso)) return null;
    const first = !(S.days[iso] && intake(iso).logged), d = dayLog(iso), prev = { m: d.meals[k], c: d.custom[k] ? clone(d.custom[k]) : null, s: d.skip[k] };
    delete d.custom[k]; delete d.skip[k]; d.meals[k] = how === "plan"; if (how === "skip") d.skip[k] = true;
    saveDay(iso); if (first && how === "plan") { try { data.saveDayTarget(iso); } catch (_) {} }
    return () => { const dd = dayLog(iso); if (prev.c) dd.custom[k] = prev.c; else delete dd.custom[k]; dd.meals[k] = prev.m || false; if (prev.s) dd.skip[k] = prev.s; else delete dd.skip[k]; saveDay(iso); V3.refresh(); };
  }
  function mealSheet(iso, k) {
    let ask = false, then = null;
    const g = gName(iso), fem = ["col", "mer", "cen"].includes(k);
    const html = () => {
      const x = mealsOf(iso).find(y => y.k === k) || { k, m: hasPlanNow() ? mealOf(dt(iso).getDay(), k) : null, st: mealState(dayV(iso), k), c: dayV(iso).custom[k] }, di = data.day(iso);
      const what = x.st === "plan" ? "Segnato come da piano" : x.st === "custom" ? "Segnato: " + x.c.text : x.st === "skip" ? "Segnato come non mangiato" : x.m ? `Da piano: ${x.m.t}${minor() || x.m.kcal == null ? "" : " · " + nf(x.m.kcal, 0) + " calorie"}` : "Non ancora segnato";
      const nums = kid() ? "" : ui.limeBox({ title: `I numeri di ${g}`, tiles: [...(minor() ? [] : [{ label: "Calorie", value: di.kcal, of: di.kcalT, pct: ui.pct(di.kcal, di.kcalT) }]), { label: "Proteine", value: di.pro, of: di.proT, unit: "g", pct: ui.pct(di.pro, di.proT) }] });
      const acts = ask
        ? `<p class="v3-shp">${x.st === "skip" ? "Si cancella il segno «non mangiato»." : "Si cancellano il segno e i numeri di questo pasto."}</p><button class="v3-apri wide" data-v3act="g-unyes">Sì, rimetti tra i pasti da fare</button><button class="v3-b2" data-v3act="g-unno">No, ${fem ? "lasciala segnata" : "lascialo segnato"}</button>`
        : (x.m && x.st !== "plan" ? `<button class="v3-apri wide" data-v3act="g-plan">Segna come da piano</button>` : "") +
          `<div class="v3-g-two"><button class="v3-b2" data-v3act="g-text">${x.st === "custom" ? "Cambia cosa" : "Scrivi cosa"}</button>` +
          (x.st === "open" ? `<button class="v3-b2" data-v3act="g-skip">Non l'ho mangiato</button>` : `<button class="v3-b2" data-v3act="g-un">Rimetti tra i pasti da fare</button>`) + `</div>`;
      return `<h2 class="v3-sh1">${e(LAB(k))} di ${e(g)}</h2><p class="v3-shp">${e(what)}</p>${nums}${acts}<p class="v3-g-note">Conta nei numeri di ${e(g)}, non di oggi.</p>`;
    };
    const paint = () => { s.el.innerHTML = '<div class="v3-grab"></div>' + html(); };
    const done = (msg, undo) => { s.close(); toast(msg, { sub: dLong(iso), undo }); };
    const s = V3.sheet(html(), { label: `${LAB(k)} di ${g}`, on: {
      "g-plan"() { const u = setMeal(iso, k, "plan"); if (u) done(`${LAB(k)} segnato come da piano`, u); },
      "g-skip"() { const u = setMeal(iso, k, "skip"); if (u) done(`${LAB(k)} segnato come non mangiato`, u); },
      "g-un"() { ask = true; paint(); }, "g-unno"() { ask = false; paint(); },
      "g-unyes"() { const u = setMeal(iso, k, "open"); if (u) done(`${LAB(k)} di nuovo da fare`, u); },
      /* audit M10: «Scrivi cosa» apre il compositore di «I miei alimenti» su quel giorno (senza alimenti.js resta il foglio vecchio) */
      "g-text"() { const c = dayV(iso).custom[k]; then = window.V3Alim ? () => V3.open("cibo", { altra: k, iso }) : () => { S.food = { key: k, text: c ? c.text : "", items: [], note: "", busy: false, err: null, iso }; openSheet("food"); }; s.close(); }
    }, onClose: () => setTimeout(() => { if (then) then(); else V3.refresh(); }, 0) });
  }

  /* ---------- carichi: S.state.ex segue l'ultima seduta di ogni esercizio ---------- */
  const lastWith = name => S.sessions.filter(s => (s.items || []).some(x => x.name === name && !x.cardio && (x.sets || []).length)).sort((a, b) => a.date < b.date ? 1 : -1)[0] || null;
  function lastIds(names) { const o = {}; for (const n of names) { const l = lastWith(n); o[n] = l ? l.id : null; } return o; }
  const namesOf = (...ss) => [...new Set(ss.flatMap(s => s ? (s.items || []).filter(x => !x.cardio).map(x => x.name) : []))];
  function rebuildEx(id, before) {
    let ch = false;
    for (const name of Object.keys(before)) {
      const L = lastWith(name);
      if (before[name] !== id && (!L || L.id !== id)) continue; // la seduta toccata non è l'ultima: i carichi restano come sono
      const its = DAYS.flatMap(k => P[k].items).filter(it => !isCardio(it) && exName(it) === name);
      for (const it of its) {
        const key = exKey(it), st = S.state.ex[key];
        if (st && st.upAt && L && st.upAt > L.date) continue; // aumento accettato dopo quella seduta (modifica 4): il carico nuovo resta
        if (!L) { if (st) { delete S.state.ex[key]; ch = true; } continue; }
        const x = L.items.find(y => y.name === name), wk = x.sets.filter(z => !z.dr), kgs = wk.map(z => z.kg).filter(v => v != null);
        const kg = it.unit === "none" || !kgs.length ? null : Math.max(...kgs), ls = wk.map(z => +z.reps || 0), date = localISO(new Date(L.date));
        if (st) { st.kg = kg; st.lastSets = ls; st.date = date; if ("kg1" in st) st.kg1 = wk.length && wk[0].kg != null ? wk[0].kg : null; ch = true; }
        else if (tipoOf(it) === "uguali") { S.state.ex[key] = { kg, lastSets: ls, date }; ch = true; }
      }
    }
    if (ch) persistState();
  }
  function writeAll() { lsSet("sessions", S.sessions); }
  function putOnline(s) { if (S.db) S.db.doc(S.base + "/" + s.id).set({ kind: "session", ...clone(s) }).catch(() => syncMsg("Correzione salvata solo sul telefono, non online")); }
  function dropOnline(id) { if (S.db) S.db.doc(S.base + "/" + id).delete().catch(() => {}); }

  /* ---------- stepper chili / ripetizioni (riga di una serie) ---------- */
  const kgOn = (it, z) => !kid() && z.kg != null;
  function setRows(ix, sets, orig) {
    const st = (si, f, v) => `<div class="stepper"><button data-v3act="g-st" data-v3arg="${ix}:${si}:${f}:-1" aria-label="${f === "kg" ? "Chili" : "Ripetizioni"} serie ${si + 1}: meno">−</button><span aria-live="polite">${f === "kg" ? nf(v) : v}</span><button data-v3act="g-st" data-v3arg="${ix}:${si}:${f}:1" aria-label="${f === "kg" ? "Chili" : "Ripetizioni"} serie ${si + 1}: più">+</button></div>`;
    return `<div class="v3-g-hd" aria-hidden="true"><span>Serie</span><span>Chili</span><span>Ripetizioni</span></div>` + sets.map((z, si) => {
      const o = orig && orig[si], ch = o && (o.kg !== z.kg || o.reps !== z.reps);
      return `<div class="v3-g-set${ch ? " ch" : ""}"><b>${si + 1}</b>${kgOn(null, z) ? st(si, "kg", z.kg) : `<span class="v3-g-na">–</span>`}${st(si, "reps", z.reps)}</div>`;
    }).join("");
  }
  function step(items, arg) {
    const [ix, si, f, d] = arg.split(":"), z = items[+ix] && items[+ix].sets[+si]; if (!z) return;
    if (f === "kg") z.kg = Math.max(0, Math.round((+z.kg + 0.5 * d) * 2) / 2); else z.reps = Math.max(1, (+z.reps || 0) + +d);
  }
  const summ = x => { const s = x.sets || [], z = s[0] || {}; return `${s.length} serie${z.kg != null && !kid() ? ` · ${nf(z.kg)} kg × ${z.reps}` : ` · ${z.reps} ripetizioni`}`; };
  const best = x => { const k = (x.sets || []).filter(z => !z.dr).map(z => z.kg).filter(v => v != null); return k.length ? Math.max(...k) : null; };

  /* ---------- correggi una seduta (tavola GiorniSeduta) e cancellala (GiorniConferma) ---------- */
  function sessPage(p) {
    const s = S.sessions.find(x => x.id === p.id); if (!s) return ui.back() + `<p class="v3-sub">${cap(sessWord())} non trovata</p>`;
    const iso = localISO(new Date(s.date)), changed = JSON.stringify(p.work) !== JSON.stringify(p.orig);
    const exs = p.work.map((x, ix) => {
      if (x.cardio) return ui.row({ title: x.name, sub: `${x.cardio.min} minuti di cardio` });
      if (ix === p.exp) return `<div class="v3-g-ex"><h2 class="v3-lab">${e(x.name)}</h2>${setRows(ix, x.sets, p.orig[ix].sets)}</div>`;
      return ui.row({ title: x.name, sub: summ(x), act: "g-exp", arg: ix, apri: "Correggi" });
    }).join("");
    let box = "";
    if (!kid()) for (let ix = 0; ix < p.work.length && !box; ix++) { const a = best(p.orig[ix]), b = best(p.work[ix]); if (a != null && b != null && a !== b) box = ui.limeBox({ title: (b > a ? "Nuovo carico migliore: " : "Carico migliore: ") + nf(b) + " kg", html: `<p class="v3-bd">${e(p.work[ix].name)}, prima era ${nf(a)} kg</p>` }); }
    const t = s.tempi && s.tempi.total ? ` · ${Math.round(s.tempi.total / 60)} minuti` : "";
    return ui.back() + `<div class="v3-g-ttl"><h1 class="v3-t1">${e(sName(s.day))} · ${e(dShort(iso))}</h1><p class="v3-sub">${s.late ? "Segnata dopo" : "Fatta alle " + hm(s.date)}${t}</p></div>` +
      `<div class="v3-g-list">${exs}</div>${box}<div class="v3-g-acts"><button class="v3-apri wide" data-v3act="g-save"${changed ? "" : " disabled"}>Salva le correzioni</button>${ui.secondary(`Cancella ${kw() ? "l'allenamento" : "la seduta"}`, "g-del")}</div>`;
  }
  function saveEdit(p) {
    const s = S.sessions.find(x => x.id === p.id); if (!s || locked()) return;
    const before = lastIds(namesOf(s)), old = clone(s.items);
    s.items = clone(p.work); s.edited = new Date().toISOString(); writeAll(); putOnline(s); rebuildEx(s.id, before);
    V3.back();
    toast("Correzioni salvate", { sub: dLong(localISO(new Date(s.date))), undo: () => { const b = lastIds(namesOf(s)); s.items = old; writeAll(); putOnline(s); rebuildEx(s.id, b); V3.refresh(); } });
  }
  function delSheet(p) {
    const s = S.sessions.find(x => x.id === p.id); if (!s || locked()) return;
    const iso = localISO(new Date(s.date)), g = gName(iso);
    let rec = "";
    if (!kid()) for (const x of s.items) {
      const b = best(x); if (b == null) continue;
      const others = S.sessions.filter(o => o.id !== s.id).flatMap(o => (o.items || []).filter(y => y.name === x.name)).map(best).filter(v => v != null);
      const mx = others.length ? Math.max(...others) : null;
      if (mx != null && b > mx) { rec = ui.limeBox({ title: `Il record di ${x.name.toLowerCase()} torna ${nf(mx)} kg`, html: `<p class="v3-bd">Era di questa ${sessWord()}</p>` }); break; }
    }
    const n = nSets(s);
    let then = null;
    const sh = V3.sheet(`<h2 class="v3-sh1">Cancellare ${kw() ? "l'allenamento" : "la seduta"} di ${e(g)}?</h2><p class="v3-shp">Tolgo ${n} serie dai progressi e dalla settimana.</p>${rec}` +
      `<button class="v3-apri wide" data-v3act="g-delyes">Sì, cancella ${kw() ? "l'allenamento" : "la seduta"}</button><button class="v3-b2" data-v3act="close">No, ${kw() ? "tienilo" : "tienila"}</button>`,
    { label: `Cancellare ${sessWord()} di ${g}?`, on: { "g-delyes"() {
      const before = lastIds(namesOf(s)), keep = clone(s);
      S.sessions = S.sessions.filter(x => x.id !== s.id); writeAll(); dropOnline(s.id); rebuildEx(s.id, before);
      then = () => { V3.back(); toast(`${cap(kw() ? "allenamento cancellato" : "seduta cancellata")}`, { sub: dLong(iso), undo: () => { const b = lastIds(namesOf(keep)); S.sessions.push(keep); writeAll(); putOnline(keep); rebuildEx(keep.id, b); V3.refresh(); } }); };
      sh.close();
    } }, onClose: () => setTimeout(() => { const t = then; then = null; if (t) t(); }, 0) });
  }

  /* ---------- seduta fatta senza app (tavola GiorniNuova) ---------- */
  function build(day) {
    return P[day].items.map(it => isCardio(it) ? { id: it.id, name: exName(it), cardio: { min: +it.dur || 20, int: it.int || null, km: null }, on: true }
      : { id: it.id, name: exName(it), sets: draftSets(it, null).filter(z => !z.w).map(z => ({ kg: it.unit === "none" || z.kg === "" || z.kg == null ? null : +z.kg, reps: +z.reps || it.min || 1, ...(z.dr ? { dr: 1 } : {}) })), on: true });
  }
  function guessDay(iso) { const dw = dt(iso).getDay(); return DAYS.find(k => P[k].dow === dw) || nextDay() || DAYS[0]; }
  function newPage(p) {
    const n = p.items.filter(x => x.on && !x.cardio).reduce((m, x) => m + x.sets.length, 0);
    const rows = p.items.map((x, ix) => {
      const sub = !x.on ? "Non fatto" : x.cardio ? `${x.cardio.min} minuti di cardio` : summ(x);
      const tog = `<button class="v3-progressi-tog" role="switch" aria-checked="${x.on}" aria-pressed="${x.on}" aria-label="${e(x.name)}: fatto" data-v3act="g-tog" data-v3arg="${ix}"><i></i></button>`;
      const row = `<div class="v3-row${x.on ? "" : " off"}" style="${x.on ? "" : "opacity:.7"}"><span class="v3-rx"><span class="v3-rt" style="display:block">${e(x.name)}</span><span class="v3-rs" style="display:block">${e(sub)}</span></span>` +
        (x.on && !x.cardio ? `<button class="v3-b2" data-v3act="g-exp" data-v3arg="${ix}" aria-expanded="${ix === p.exp}" style="width:auto">${ix === p.exp ? "Chiudi" : "Cambia"}</button>` : "") + tog + `</div>`;
      return row + (x.on && !x.cardio && ix === p.exp ? `<div class="v3-g-ex">${setRows(ix, x.sets, null)}</div>` : "");
    }).join("");
    return ui.back() + `<div class="v3-g-ttl"><h1 class="v3-t1">${e(dLong(p.iso))}</h1><p class="v3-sub">${cap(sessWord())} fatta senza app · ${n} serie</p></div>` +
      (DAYS.length > 1 ? ui.seg(DAYS.map(sName), DAYS.indexOf(p.day), "g-pick", `Quale ${sessWord()}`) : "") +
      `<section class="v3-sec">${ui.label("Come da scheda")}<div class="v3-g-list">${rows}</div></section>` +
      `<div class="v3-g-acts"><button class="v3-apri wide" data-v3act="g-add">Salva ${kw() ? "l'allenamento" : "la seduta"} di ${e(gName(p.iso))}</button></div>`;
  }
  async function saveNew(p) {
    if (locked() || !okIso(p.iso)) return;
    if (sessAll(p.iso).length) { toast(`C'è già ${kw() ? "un allenamento" : "una seduta"} in questo giorno`); return; }
    const items = p.items.filter(x => x.on && (x.cardio || x.sets.length)).map(x => { const o = { id: x.id, name: x.name, sets: x.cardio ? [] : clone(x.sets) }; if (x.cardio) o.cardio = clone(x.cardio); return o; });
    if (!items.length) { toast("Segna almeno un esercizio"); return; }
    const s = { id: "s" + Date.now(), date: new Date(p.iso + "T18:00:00").toISOString(), day: p.day, items, late: true };
    const before = lastIds(namesOf(s)); await persistSession(s); rebuildEx(s.id, before);
    V3.back();
    toast(`${cap(kw() ? "allenamento" : "seduta")} di ${gName(p.iso)} ${kw() ? "salvato" : "salvata"}`, { sub: `${nSets(s)} serie`, undo: () => { const b = lastIds(namesOf(s)); S.sessions = S.sessions.filter(x => x.id !== s.id); writeAll(); dropOnline(s.id); rebuildEx(s.id, b); V3.refresh(); } });
  }

  /* ---------- API per sec-oggi ---------- */
  window.V3Giorni = {
    render: diary,
    sessRows: (iso, only) => sessRow(iso, only),
    reset(iso) { sel = okIso(iso) ? iso : T(); wOff = 0; const mon = localISO(mondayOf(new Date())); while (sel < addDays(mon, -7 * wOff)) wOff++; pile.length = 0; },
    on: {
      "g-sap"() { sapSheet(); },
      "g-day"(iso) { if (okIso(iso)) { sel = iso; V3.refresh(); } },
      "g-wk"(n) { wOff = Math.max(0, +n); const from = addDays(localISO(mondayOf(new Date())), -7 * wOff); sel = wOff ? (addDays(from, 6) >= minIso() ? addDays(from, 6) : sel) : T(); V3.refresh(); },
      "g-meal"(k) { if (okIso(sel)) mealSheet(sel, k); },
      "g-sess"(id) { if (locked()) return; const s = S.sessions.find(x => x.id === id); if (!s) return; open({ p: "seduta", id, work: clone(s.items), orig: clone(s.items), exp: s.items.findIndex(x => !x.cardio) }); },
      "g-new"() { if (locked() || !DAYS.length || !okIso(sel)) return; const day = guessDay(sel); open({ p: "nuova", iso: sel, day, items: build(day), exp: null }); },
      "g-exp"(ix) { const p = top(); if (p) { p.exp = p.exp === +ix && p.p === "nuova" ? null : +ix; V3.refresh(); } },
      "g-st"(arg) { const p = top(); if (p) { step(p.p === "seduta" ? p.work : p.items, arg); V3.refresh(); } },
      "g-tog"(ix) { const p = top(); if (p && p.items[+ix]) { p.items[+ix].on = !p.items[+ix].on; if (!p.items[+ix].on && p.exp === +ix) p.exp = null; V3.refresh(); } },
      "g-pick"(i) { const p = top(), k = DAYS[+i]; if (p && k && k !== p.day) { p.day = k; p.items = build(k); p.exp = null; V3.refresh(); } },
      "g-save"() { const p = top(); if (p) saveEdit(p); },
      "g-del"() { const p = top(); if (p) delSheet(p); },
      "g-add"() { const p = top(); if (p) saveNew(p); }
    }
  };
})();
