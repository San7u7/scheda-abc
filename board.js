"use strict";
/* Oggi = one "Adesso" card (the single next action) + up to 4 macro-category boxes that open a wider page.
   Boxes can be shown/hidden and reordered. Loaded after hub.js and before coachui.js. */
(function () {
  const BOX = [
    ["nums", "I numeri di oggi", "4 riquadri a tua scelta"],
    ["train", "Allenamento", "Sedute, settimana, record"],
    ["food", "Alimentazione", "Pasti, acqua, integratori, menù"],
    ["body", "Peso e corpo", "Peso, andamento, foto"],
    ["prog", "Progressi", "Carichi, volume, calorie, storico"]
  ];
  const DEF = { order: BOX.map(b => b[0]), off: [] };
  const cfg = () => { const c = lsGet("board2", null) || DEF, order = (c.order || []).filter(k => BOX.some(b => b[0] === k)); BOX.forEach(b => { if (!order.includes(b[0])) order.push(b[0]); }); return { order, off: c.off || [] }; };
  const save = c => lsSet("board2", c);

  /* ---------- the 4 number tiles, each slot chosen by the user ---------- */
  const TI = { carb: '<svg viewBox="0 0 24 24"><path d="M12 21V8M12 8c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5zM12 14c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5z"/></svg>',
    fat: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="6.5" ry="8"/><circle cx="12" cy="15" r="2.6"/></svg>' };
  const TILES = [["kcal", "Calorie"], ["pro", "Proteine"], ["carb", "Carboidrati"], ["fat", "Grassi"], ["water", "Acqua"], ["peso", "Peso"], ["sess", "Sedute della settimana"]];
  const tileCfg = () => { const t = lsGet("tiles", null); return Array.isArray(t) && t.length === 4 ? t : ["kcal", "pro", "fat", "water"]; };
  function tile(k) {
    const I = window.TILE_ICONS || {}, T = planTargets(), iso = localISO(), v = dayLog(iso), e = intake(iso).eaten, st = window.statTile;
    const g = (val, tgt, lab, ic) => st(ic, `${fmt(Math.round(val))}<small> / ${fmt(Math.round(tgt))} g</small>`, lab, tgt ? val / tgt * 100 : null, "kcal-sheet");
    if (k === "kcal") return st(I.kcal, `${fmt(Math.round(e.kcal))}<small> / ${fmt(T.kcal)}</small>`, "Calorie", e.kcal / T.kcal * 100, "kcal-sheet");
    if (k === "pro") return g(e.p, T.pro, "Proteine", I.pro);
    if (k === "carb") return T.cho ? g(e.c, T.cho, "Carboidrati", TI.carb) : st(TI.carb, `${fmt(Math.round(e.c))}<small> g</small>`, "Carboidrati", null, "kcal-sheet");
    if (k === "fat") return T.fat ? g(e.f, T.fat, "Grassi", TI.fat) : st(TI.fat, `${fmt(Math.round(e.f))}<small> g</small>`, "Grassi", null, "kcal-sheet");
    if (k === "water") return st(I.water, `${fmt(v.water * 0.25)}<small> / ${fmt(T.waterL)} L</small>`, "Acqua", v.water * 0.25 / T.waterL * 100, "water", "1", "+");
    if (k === "peso") { const w = weights(), l = w[w.length - 1]; return st(I.peso, v.peso ? `${fmt(v.peso)}<small> kg</small>` : l ? `${fmt(l.kg)}<small> kg</small>` : "–", v.peso ? "Peso di oggi" : "Peso · tocca per registrare", null, "sheet", "peso"); }
    if (k === "sess") { const n = Object.keys(weekDone()).length, tot = DAYS.length || 3; return st(I.sess, `${n}<small> / ${tot}</small>`, "Sedute della settimana", n / tot * 100, "macro", "train"); }
    return "";
  }
  const tilesHtml = (edit) => `<div>${edit ? `<div class="block-h" style="margin-bottom:10px"><h2>I numeri di <span class="hl">oggi</span></h2><button class="link small" data-act="tiles-edit">Modifica</button></div>` : ""}<div class="stiles">${tileCfg().map(tile).join("")}</div></div>`;
  const DOWL = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const CHEV = '<svg class="mb-chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>';
  const IC = {
    train: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M15 3c-1.5 2-2 4-2 6s1 3 2 3v9"/>',
    body: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10a3 3 0 0 1 6 0M12 10l1-2"/>',
    prog: '<path d="M4 19h16M6 15l4-4 3 3 5-6"/>'
  };
  const ic = k => `<span class="mb-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg></span>`;

  /* ---------- data helpers ---------- */
  /* week plan: the scheda's days, or this week's override after a move (dow 0=Sunday -> session key) */
  const monKey = () => localISO(mondayOf(new Date()));
  const basePlan = () => { const m = {}; ((S.training && S.training.sedute) || []).forEach((s, i) => { if (s.dow != null && DAYS[i]) m[s.dow] = DAYS[i]; }); return m; };
  const shift = () => { const x = lsGet("shift", null); return x && x.week === monKey() ? x.map : null; };
  const planMap = () => shift() || basePlan();
  window.weekPlanMap = planMap;
  const idx = dw => (dw + 6) % 7; // Monday-first index used by weekDone()
  function missedDays() { const m = planMap(), done = weekDone(), t = idx(new Date().getDay()); return Object.keys(m).map(Number).filter(dw => idx(dw) < t && !done[idx(dw)]); }
  function autoShift() { // put the sessions not done yet on today and the following days, with a rest day between when there is room
    const done = Object.values(weekDone()), m = planMap(), t = idx(new Date().getDay());
    const left = Object.keys(m).map(Number).sort((a, b) => idx(a) - idx(b)).map(dw => m[dw]).filter(d => !done.includes(d));
    const days = []; for (let i = t; i < 7; i++) days.push((i + 1) % 7);
    const n = days.length, k = Math.min(left.length, n), out = {}; // spread evenly over the days left
    left.slice(0, k).forEach((d, i) => { out[days[k === 1 ? 0 : Math.round(i * (n - 1) / (k - 1))]] = d; });
    Object.keys(m).map(Number).filter(dw => idx(dw) < t && done.includes(m[dw])).forEach(dw => { out[dw] = m[dw]; });
    lsSet("shift", { week: monKey(), map: out });
    return left.length - Object.values(out).filter(d => left.includes(d)).length;
  }
  function syncLabels() { // session cards show this week's day after a move
    const sh = shift();
    DAYS.forEach(k => { const p = P[k]; if (!p) return; if (!("_day" in p)) { p._day = p.day; p._dow = p.dow; }
      if (sh) { const dw = Object.keys(sh).map(Number).find(x => sh[x] === k); p.day = dw != null ? DOW[dw] : "Fuori settimana"; p.dow = dw != null ? dw : null; }
      else { p.day = p._day; p.dow = p._dow; } });
  }
  const r0 = window.render; window.render = function () { try { syncLabels(); } catch (_) {} r0(); };
  const baseNext = window.nextDay;
  window.nextDay = function () {
    const a = activeDay(); if (a) return a;
    const sh = shift(); if (!sh) return baseNext();
    const done = Object.values(weekDone()), t = idx(new Date().getDay());
    if (sh[new Date().getDay()] && !doneToday()) return sh[new Date().getDay()];
    const up = Object.keys(sh).map(Number).filter(dw => idx(dw) > t && !done.includes(sh[dw])).sort((x, y) => idx(x) - idx(y));
    return up.length ? sh[up[0]] : baseNext();
  };
  function nextPlanned() { const m = planMap(), nd = nextDay(); if (!nd) return null; for (let i = 0; i < 7; i++) { const dw = (new Date().getDay() + i) % 7; if (m[dw] === nd) return { day: nd, when: i === 0 ? "oggi" : i === 1 ? "domani" : DOWL[dw] }; } return { day: nd, when: "" }; }
  function weekStreak() { // consecutive complete weeks (all planned sessions done); the current week counts only once complete
    const need = Math.max(1, DAYS.length); let n = 0, best = 0, run = 0;
    const weeks = {}; for (const s of S.sessions) { const k = localISO(mondayOf(new Date(s.date))); weeks[k] = (weeks[k] || 0) + 1; }
    const cur = localISO(mondayOf(new Date())); let w = new Date(mondayOf(new Date()));
    if ((weeks[cur] || 0) >= need) n++; w.setDate(w.getDate() - 7);
    for (let i = 0; i < 104; i++, w.setDate(w.getDate() - 7)) { if ((weeks[localISO(w)] || 0) >= need) n++; else break; }
    for (const k of Object.keys(weeks).sort()) { run = weeks[k] >= need ? run + 1 : 0; best = Math.max(best, run); }
    return { n, best };
  }
  window.weekStreak = weekStreak;
  function recentRecords(days = 30) {
    const from = addDays(localISO(), -days), best = {}, recent = {};
    for (const s of S.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1)) { const d = localISO(new Date(s.date));
      for (const e of s.items) { const m = Math.max(0, ...e.sets.map(x => +x.kg || 0)); if (!m) continue; if (best[e.name] != null && m > best[e.name] && d >= from) recent[e.name] = { kg: m, gain: m - best[e.name], d }; best[e.name] = Math.max(best[e.name] || 0, m); } }
    return Object.entries(recent).sort((a, b) => a[1].d < b[1].d ? 1 : -1);
  }
  const lastPhotoDays = () => { const l = S.photos.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0]; return l ? Math.floor((Date.now() - new Date(l.date)) / 864e5) : null; };
  const ago = iso => { const n = Math.round((new Date(localISO()) - new Date(iso)) / 864e5); return n <= 0 ? "oggi" : n === 1 ? "ieri" : n + " giorni fa"; };

  /* ---------- blocks reused by the macro pages ---------- */
  function weekCard() {
    const done = weekDone(), m = planMap(), today = (new Date().getDay() + 6) % 7, plan = {}; Object.entries(m).forEach(([dw, d]) => { plan[(+dw + 6) % 7] = d; });
    const cells = ["L", "M", "M", "G", "V", "S", "D"].map((l, i) => { const d = done[i], p = plan[i], cls = d ? "on" : p ? (i < today ? "miss" : "plan") : "rest";
      const edit = !d && i >= today;
      return `<${edit ? `button data-act="wk-day" data-v="${(i + 1) % 7}" aria-label="Cambia ${["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"][i]}"` : "div"} class="wk ${cls} ${i === today ? "today" : ""} ${edit ? "ed" : ""}"><span class="wk-l">${l}</span><span class="wk-d">${d || p || "·"}</span></${edit ? "button" : "div"}>`; }).join("");
    const n = Object.keys(done).length, tot = Object.keys(plan).length || DAYS.length, ws = weekStreak(), miss = missedDays();
    return `<div class="card"><div class="block-h"><h2>La tua <span class="hl">settimana</span></h2><span class="small muted num">${n} di ${tot}</span></div><div class="wkrow">${cells}</div>
      ${miss.length ? `<button class="primary go" data-act="wk-auto">Sposta la settimana</button>` : ""}
      <p class="small muted" style="margin:0">Tocca un giorno da oggi in poi per cambiare seduta o mettere riposo. Vale solo per questa settimana.${shift() ? ` <button class="link small" data-act="wk-reset" style="padding:0">Torna alla scheda</button>` : ""}</p>
      <p class="small muted" style="margin:0">${ws.n >= 2 ? `${ws.n} settimane complete di fila${ws.best > ws.n ? ` (migliore: ${ws.best})` : ""}.` : ws.best ? `La tua serie migliore: ${ws.best} settimane complete. Completa questa e riparte.` : "Completa tutte le sedute della settimana per iniziare una serie."}</p></div>`;
  }
  function weightCard() {
    const from = addDays(localISO(), -30), w = weights().filter(x => x.date >= from);
    if (w.length < 2) return `<div class="card"><h2>Andamento del <span class="hl">peso</span></h2><p class="muted">${w.length ? "Ancora una pesata e vedi la curva." : "Pesati 2–3 mattine a settimana e qui vedi la curva."}</p><button class="ghost" data-act="sheet" data-v="peso">Registra il peso</button></div>`;
    const ks = w.map(x => Math.round(x.kg * 10) / 10), ch = ks[ks.length - 1] - ks[0];
    return `<div class="card"><div class="block-h"><h2>Andamento del <span class="hl">peso</span></h2><span class="small muted num">${ch >= 0 ? "+" : ""}${fmt(+ch.toFixed(1))} kg in 30 giorni</span></div>${spark(ks, 70)}
      <div class="block-h"><span class="small muted num">${fmt(ks[0])} kg</span><button class="link small" data-act="sheet" data-v="peso">Registra oggi</button><span class="small num"><b>${fmt(ks[ks.length - 1])} kg</b></span></div></div>`;
  }
  function spark(ks, h) { const lo = Math.min(...ks), span = Math.max(...ks) - lo || 1, W = 300;
    const pts = ks.map((k, i) => `${(i / (ks.length - 1) * W).toFixed(1)},${(h - 5 - (k - lo) / span * (h - 10)).toFixed(1)}`).join(" ");
    return `<svg class="spark" style="height:${h}px" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`; }
  function recordsCard() {
    const list = recentRecords().slice(0, 5);
    return `<div class="card"><h2>Record del <span class="hl">mese</span></h2>${list.length ? `<ul class="plain">${list.map(([n, r]) => `<li><b>${esc(short(n))}</b> ${fmt(r.kg)} kg <span class="hl">+${fmt(r.gain)}</span> <span class="small muted">· ${ago(r.d)}</span></li>`).join("")}</ul>` : `<p class="muted">Ancora nessun record questo mese. Quando chiudi il range in tutte le serie il carico sale, e il record arriva.</p>`}</div>`;
  }
  function photoCard() {
    const d = lastPhotoDays(), msg = d == null ? "Nessuna foto ancora: scattane una oggi come punto di partenza." : d >= 14 ? `Ultima foto ${d} giorni fa: è un buon momento per la prossima.` : `Ultima foto ${d ? d + " giorni fa" : "oggi"}. La prossima tra ${14 - d} giorni, stessa luce e stessa posa.`;
    return `<div class="card"><h2>Foto <span class="hl">progressi</span></h2><p class="muted">${msg}</p><button class="ghost" data-act="board-go" data-v="foto">Vai alle foto</button></div>`;
  }

  /* ---------- "Adesso": the one next action ---------- */
  function now() {
    const a = activeDay(), dt0 = doneToday(), np = nextPlanned(), v = dayLog(localISO()), meal = MEALS.find(([k]) => mealState(v, k) === "open"), mo = meal && mealOf(new Date().getDay(), meal[0]);
    let t, s, acts;
    if (a) { t = `Seduta <span class="hl-ink">${a}</span> in corso`; s = "Riprendi da dove eri rimasto: carichi e serie fatte sono salvati."; acts = `<button class="primary now-go" data-act="start" data-v="${a}">Riprendi</button>`; }
    else if (np && np.when === "oggi" && !dt0) { const ups = P[np.day].items.filter(it => plan(it).up).length;
      t = `Oggi tocca alla seduta <span class="hl-ink">${np.day}</span>`; s = ups ? `${ups === 1 ? "Un esercizio è pronto" : ups + " esercizi sono pronti"} a salire di carico.` : "Punta a una ripetizione in più per serie.";
      acts = `<button class="primary now-go" data-act="start" data-v="${np.day}">Inizia</button><button class="ghost dark" data-act="open-day" data-v="${np.day}">Dettagli</button>`; }
    else if (missedDays().length && lsGet("shift_no", "") !== monKey() && !dt0) { const DN = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"], md = missedDays(), last = md.sort((x, y) => idx(x) - idx(y))[md.length - 1];
      t = `${DN[last]} è saltato, capita`; s = `Sposto le sedute che restano nei prossimi giorni, con un giorno di riposo in mezzo quando c'è spazio?`;
      acts = `<button class="primary now-go" data-act="wk-auto">Sposta la settimana</button><button class="ghost dark" data-act="wk-no">Lascia così</button>`; }
    else if (meal && mo) { t = `Prossimo: <span class="hl-ink">${meal[1].toLowerCase()}</span>`; s = esc(mo.t) + "." + (dt0 ? ` Seduta ${dt0.day} fatta: ora contano proteine e acqua.` : np ? ` Prossima seduta: ${np.day}, ${np.when}.` : "");
      acts = `<button class="primary now-go" data-act="meal" data-v="${meal[0]}">L'ho mangiato</button><button class="ghost dark" data-act="meal-open" data-v="${meal[0]}">Ho mangiato altro</button>`; }
    else { t = dt0 ? `Seduta ${dt0.day} fatta` : "Giornata in ordine"; s = np ? `Prossima seduta: ${np.day}, ${np.when}. Riposo e sonno fanno il resto.` : "Hai registrato tutto per oggi."; acts = ""; }
    return `<div class="card lime now"><p class="now-k">Adesso</p><h2 class="now-t">${t}</h2><p class="now-s">${s}</p><div class="now-acts">${acts}<button class="ghost dark" data-act="coach-open">Chiedi a ${esc(((S.profile && S.profile.coach && S.profile.coach.nome) || "Leo"))}</button></div></div>`;
  }

  /* ---------- the 4 boxes ---------- */
  function box(k) {
    const meta = BOX.find(b => b[0] === k); let metric = "", state = "", vis = "", quick = "";
    if (k === "train") { const done = weekDone(), m = planMap(), today = (new Date().getDay() + 6) % 7, plan = {}; Object.entries(m).forEach(([dw, d]) => { plan[(+dw + 6) % 7] = d; });
      const tot = Object.keys(plan).length || DAYS.length, np = nextPlanned(), ws = weekStreak();
      metric = `${Object.keys(done).length}<small> di ${tot} sedute</small>`;
      vis = `<div class="mb-dots">${[0, 1, 2, 3, 4, 5, 6].map(i => `<i class="${done[i] ? "on" : plan[i] ? (i < today ? "miss" : "plan") : ""} ${i === today ? "today" : ""}"></i>`).join("")}</div>`;
      state = np ? `Prossima: <b>${np.day}</b>${np.when ? ", " + np.when : ""}` : "Nessuna scheda caricata"; if (ws.n >= 2) state += ` · ${ws.n} settimane complete`; }
    if (k === "food") { const T = planTargets(), e = intake(localISO()).eaten, v = dayLog(localISO()), meal = MEALS.find(([mk]) => mealState(v, mk) === "open");
      const h = new Date().getHours() + new Date().getMinutes() / 60, exp = Math.max(0, Math.min(1, (h - 7) / 14));
      metric = `${fmt(Math.round(e.kcal))}<small> / ${fmt(T.kcal)} kcal</small>`;
      vis = `<div class="mb-bar"><span style="width:${Math.min(100, e.kcal / T.kcal * 100)}%"></span><em style="left:${exp * 100}%" title="atteso a quest'ora"></em></div>`;
      state = (meal ? `Prossimo: <b>${meal[1].toLowerCase()}</b>` : "Pasti completati") + ` · acqua ${fmt(v.water * .25)} / ${fmt(T.waterL)} L`;
      quick = `<span class="mb-quick" role="button" tabindex="0" data-act="water" data-v="1" aria-label="Aggiungi un bicchiere d'acqua">+ acqua</span>`; }
    if (k === "body") { const w = weights(), last = w[w.length - 1], from = addDays(localISO(), -30), w30 = w.filter(x => x.date >= from), d = lastPhotoDays();
      metric = last ? `${fmt(Math.round(last.kg * 10) / 10)}<small> kg</small>` : `–<small> kg</small>`;
      if (w30.length > 1) { const ch = w30[w30.length - 1].kg - w30[0].kg; vis = spark(w30.map(x => x.kg), 34); state = `${ch >= 0 ? "+" : ""}${fmt(+ch.toFixed(1))} kg in 30 giorni`; } else state = last ? `Ultima pesata ${ago(last.date)}` : "Tocca per registrare il peso";
      state += d == null ? " · nessuna foto" : d >= 14 ? " · è ora di una foto" : ` · foto tra ${14 - d} giorni`; }
    if (k === "prog") { const r = recentRecords(), last = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
      metric = `${r.length}<small> record nel mese</small>`; state = last ? `Ultima seduta: <b>${last.day}</b>, ${ago(localISO(new Date(last.date)))}` : "Ancora nessuna seduta registrata"; }
    return `<div class="mbox" role="button" tabindex="0" data-act="macro" data-v="${k}" aria-label="${meta[1]}: apri la sezione"><div class="mb-h">${ic(k)}<b>${meta[1]}</b>${CHEV}</div>
      <div class="mb-m num">${metric}</div>${vis}<p class="mb-s">${state}</p><div class="mb-f"><span>${meta[2]}</span>${quick}</div></div>`;
  }

  /* ---------- views ---------- */
  const base = window.viewOggi;
  const back = `<button class="back" data-act="macro" data-v=""><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>Oggi</button>`;
  window.viewOggi = function () {
    const tpl = document.createElement("template"); tpl.innerHTML = base();
    const parts = {}, head = [];
    for (const el of [...tpl.content.children]) { const h = el.outerHTML;
      if (!el.classList.contains("block")) head.push(h);
      else if (h.includes("coach-line")) parts.coach = h;
      else if (h.includes("pcard") || h.includes("Nessuna scheda")) parts.session = h;
      else if (h.includes('data-act="meal')) parts.meals = h;
      else if (h.includes("<h2>Integratori")) parts.sup = h;
      else if (!parts.stats) parts.stats = h; }
    const B = x => `<div class="block">${x}</div>`;
    if (S.macro === "train") return back + `<h1>Il tuo <span class="hl">allenamento</span></h1>` + B(weekCard()) + (parts.session || "") + B(recordsCard()) + B(`<button class="ghost" data-act="tab" data-v="allenamento">Tutte le sedute e la scheda</button>`);
    if (S.macro === "food") return back + `<h1>La tua <span class="hl">alimentazione</span></h1>` + B(tilesHtml(true)) + (parts.meals || "") + (parts.sup || "") + B(`<div class="stack" style="gap:8px"><button class="ghost" data-act="board-go" data-v="menu">Il menù della settimana</button><button class="ghost" data-act="board-go" data-v="piano">Piano alimentare e i miei alimenti</button></div>`);
    if (S.macro === "body") return back + `<h1>Peso e <span class="hl">corpo</span></h1>` + B(weightCard()) + B(photoCard()) + B(`<button class="ghost" data-act="board-go" data-v="peso">Andamento completo del peso</button>`);
    const c = cfg(), ed = !!S.boardEdit, vis = c.order.filter(k => !c.off.includes(k)), hid = c.order.filter(k => c.off.includes(k));
    const boxes = vis.map((k, i) => { const nm = BOX.find(b => b[0] === k)[1];
      return `<div class="bx ${ed ? "jig" : ""}" data-k="${k}" style="--d:${(i % 3) * 60}ms">${ed ? `<button class="bx-del" data-act="bx-del" data-v="${k}" aria-label="Nascondi ${nm}"><span aria-hidden="true">−</span></button><button class="bx-h" data-act="bx-h" data-v="${k}" aria-label="Sposta ${nm}: trascina, oppure usa le frecce su e giù">≡</button>` : ""}${k === "nums" ? tilesHtml(!ed) : box(k)}</div>`; }).join("");
    return head.join("") + B(now()) + `<div class="block mgrid ${ed ? "editing" : ""}">${boxes}</div>` +
      (hid.length ? `<div class="block"><button class="bx-add" data-act="bx-add"><span aria-hidden="true">+</span> Aggiungi sezione</button></div>` : ed ? `<p class="small muted" style="text-align:center">Stai già vedendo tutto.</p>` : "") +
      (ed ? `<button class="bx-fine" data-act="bx-fine">Fine</button>` : `<div class="block" style="display:flex;justify-content:center"><button class="ghost sm" data-act="bx-edit">Modifica Oggi</button></div>`);
  };

  const prevSheet = window.renderSheet;
  window.renderSheet = function () {
    if (S.sheet === "wkday") {
      const dw = S.wkday, DN = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"], cur = planMap()[dw] || "", done = Object.values(weekDone());
      $("#overlay").innerHTML = `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Cosa fai ${DN[dw]}"><div class="grab"></div>
        <h2>Cosa fai <span class="hl">${DN[dw]}</span>?</h2><p class="muted">Vale solo per questa settimana. Se scegli una seduta già in programma un altro giorno, i due giorni si scambiano.</p>
        <div class="seg wrap" role="group">${DAYS.map(d => `<button data-act="wk-set" data-v="${d}" aria-pressed="${cur === d}" ${done.includes(d) ? "disabled" : ""}>Seduta ${d}${done.includes(d) ? " (fatta)" : ""}</button>`).join("")}<button data-act="wk-set" data-v="" aria-pressed="${!cur}">Riposo</button></div>
        <button class="ghost" data-act="close" style="margin-top:14px">Chiudi</button></div></div>`;
      return;
    }
    if (S.sheet === "tiles") {
      const t = tileCfg();
      $("#overlay").innerHTML = `<div class="scrim" data-act="close"><div class="sheet full" role="dialog" aria-modal="true" aria-label="Modifica i riquadri"><div class="grab"></div>
        <h2>I tuoi <span class="hl">4 riquadri</span></h2><p class="muted">Scegli cosa mostrare in ogni riquadro. Valgono in Oggi e in Alimentazione.</p>
        ${t.map((cur, i) => `<div class="block" style="margin-top:14px"><p class="small muted" style="margin:0 0 8px">Riquadro ${i + 1} · ${i % 2 ? "a destra" : "a sinistra"}, ${i < 2 ? "in alto" : "in basso"}</p><div class="seg wrap" role="group">${TILES.map(([k, l]) => `<button data-act="tile-set" data-i="${i}" data-v="${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</div></div>`).join("")}
        <button class="primary" data-act="close" style="margin-top:16px">Fatto</button><button class="link small" data-act="tiles-reset" style="align-self:center">Ripristina: calorie, proteine, grassi, acqua</button></div></div>`;
      return;
    }
    if (S.sheet !== "bxadd") return prevSheet();
    const c = cfg(), hid = c.order.filter(k => c.off.includes(k));
    $("#overlay").innerHTML = `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Aggiungi a Oggi"><div class="grab"></div>
      <h2>Aggiungi a <span class="hl">Oggi</span></h2>${hid.length ? `<div class="blist">${hid.map(k => { const b = BOX.find(x => x[0] === k); return `<button class="brow add" data-act="bx-put" data-v="${k}">${k === "nums" ? '<span class="mb-ic">#</span>' : ic(k)}<span class="b-t"><b>${b[1]}</b><small>${b[2]}</small></span><span class="bx-plus" aria-hidden="true">+</span></button>`; }).join("")}</div>` : `<p class="muted">Stai già vedendo tutto.</p>`}
      <button class="ghost" data-act="close">Chiudi</button></div></div>`;
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "tab") { S.macro = null; S.boardEdit = false; }
    if (act === "macro") { e.stopPropagation(); if (v === "prog") { S.macro = null; S.tab = "progressi"; lsSet("tab2", S.tab); } else S.macro = v || null; window.scrollTo(0, 0); render(); }
    else if (act === "wk-day") { S.wkday = +v; S.sheet = "wkday"; renderSheet(); }
    else if (act === "wk-set") { const m = { ...planMap() }, dw = S.wkday, prev = m[dw]; const other = v ? Object.keys(m).map(Number).find(x => x !== dw && m[x] === v) : null;
      if (other != null) { if (prev) m[other] = prev; else delete m[other]; } if (v) m[dw] = v; else delete m[dw];
      lsSet("shift", { week: monKey(), map: m }); S.sheet = null; renderSheet(); render(); toast("Settimana aggiornata"); }
    else if (act === "wk-auto") { const lost = autoShift(); render(); toast(lost ? `Spostate. ${lost === 1 ? "Una seduta non ci sta" : lost + " sedute non ci stanno"} più questa settimana: riparti lunedì.` : "Settimana spostata: guarda i nuovi giorni in Allenamento."); }
    else if (act === "wk-no") { lsSet("shift_no", monKey()); render(); }
    else if (act === "wk-reset") { lsSet("shift", null); render(); toast("Tornata la settimana della scheda"); }
    else if (act === "tiles-edit") { S.sheet = "tiles"; renderSheet(); }
    else if (act === "tile-set") { const t = tileCfg().slice(), i = +b.dataset.i, j = t.indexOf(v); if (j >= 0 && j !== i) t[j] = t[i]; t[i] = v; lsSet("tiles", t); renderSheet(); render(); }
    else if (act === "tiles-reset") { lsSet("tiles", ["kcal", "pro", "fat", "water"]); renderSheet(); render(); }
    else if (act === "board-go") { e.stopPropagation(); S.macro = null;
      if (v === "menu" || v === "piano") { S.tab = "piano"; S.hub = v === "menu" ? "menu" : ""; }
      else { S.tab = "progressi"; S.psub = v; }
      lsSet("tab2", S.tab); window.scrollTo(0, 0); render();
      if (v === "foto" || v === "peso") setTimeout(() => { const h = [...document.querySelectorAll("h2")].find(x => x.textContent === "Dettagli"); if (h) h.scrollIntoView({ behavior: "smooth" }); }, 50); }
  }, true);
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('.mbox, .mb-quick')) { e.preventDefault(); e.target.click(); } });

  /* ---------- edit Oggi like the iPhone Home Screen ---------- */
  const nameOf = k => BOX.find(b => b[0] === k)[1];
  const setEdit = on => { S.boardEdit = on; render(); };
  function undoToast(msg, undo) {
    document.querySelectorAll(".utoast").forEach(x => x.remove());
    const t = document.createElement("div"); t.className = "toast utoast"; t.setAttribute("role", "status");
    t.innerHTML = `<span>${esc(msg)}</span><button>Annulla</button>`; document.body.appendChild(t);
    t.querySelector("button").onclick = () => { undo(); t.remove(); }; setTimeout(() => t.remove(), 5000);
  }
  let press = null, swallow = false, fired = false;
  document.addEventListener("touchstart", e => {
    const bx = e.target.closest(".bx"); if (!bx || S.boardEdit || S.tab !== "oggi" || S.macro || e.touches.length !== 1) return;
    const t0 = e.touches[0]; press = { x: t0.clientX, y: t0.clientY, id: setTimeout(() => { press = null; fired = true; try { navigator.vibrate && navigator.vibrate(12); } catch (_) {} setEdit(true); }, 500) };
  }, { passive: true });
  document.addEventListener("touchmove", e => { if (!press) return; const t0 = e.touches[0]; if (Math.hypot(t0.clientX - press.x, t0.clientY - press.y) > 10) { clearTimeout(press.id); press = null; } }, { passive: true });
  document.addEventListener("touchend", () => { if (press) { clearTimeout(press.id); press = null; } if (fired) { fired = false; swallow = true; setTimeout(() => { swallow = false; }, 400); } }, { passive: true });
  document.addEventListener("contextmenu", e => { if (e.target.closest(".bx")) e.preventDefault(); });
  document.addEventListener("click", e => {
    if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!S.boardEdit) return;
    const b = e.target.closest("[data-act]"), act = b && b.dataset.act;
    if (["bx-del", "bx-h", "bx-add", "bx-fine", "bx-put", "close", "tiles-edit", "tile-set", "tiles-reset"].includes(act) || e.target.closest(".sheet, .tabs, .toast")) return;
    e.preventDefault(); e.stopPropagation();
    if (!e.target.closest(".bx")) setEdit(false); // tap on empty space ends editing
  }, true);
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "bx-edit") setEdit(true);
    else if (act === "bx-fine") setEdit(false);
    else if (act === "bx-add") { S.sheet = "bxadd"; renderSheet(); }
    else if (act === "bx-put") { const c = cfg(); c.off = c.off.filter(x => x !== v); save(c); S.sheet = null; renderSheet(); render(); toast(`Sezione ${nameOf(v)} aggiunta a Oggi`); }
    else if (act === "bx-del") {
      const el = b.closest(".bx"), c = cfg(); el.classList.add("gone");
      setTimeout(() => { c.off = [...c.off, v]; save(c); render(); undoToast(`Sezione ${nameOf(v)} nascosta. I dati restano.`, () => { const c2 = cfg(); c2.off = c2.off.filter(x => x !== v); save(c2); render(); }); }, 200);
    }
  });
  // reorder: drag the ≡ handle (keyboard: arrows)
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const h = e.target.closest(".bx-h"); if (!h) return; e.preventDefault();
    const el = h.closest(".bx"); drag = { el, y0: e.clientY, off: 0 }; el.classList.add("lift"); h.setPointerCapture && h.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return; e.preventDefault();
    const { el } = drag; let dy = e.clientY - drag.y0 - drag.off;
    const prev = el.previousElementSibling, next = el.nextElementSibling;
    if (next && next.classList.contains("bx") && dy > next.offsetHeight / 2) { const hgt = next.offsetHeight + 12; el.parentNode.insertBefore(next, el); drag.off += hgt; dy -= hgt; }
    else if (prev && prev.classList.contains("bx") && -dy > prev.offsetHeight / 2) { const hgt = prev.offsetHeight + 12; el.parentNode.insertBefore(el, prev); drag.off -= hgt; dy += hgt; }
    el.style.transform = `translateY(${dy}px) scale(1.03)`;
    if (e.clientY < 90) window.scrollBy(0, -10); else if (e.clientY > innerHeight - 110) window.scrollBy(0, 10);
  }, { passive: false });
  const endDrag = () => { if (!drag) return; const { el } = drag; drag = null; el.style.transform = ""; el.classList.remove("lift");
    const dom = [...document.querySelectorAll(".mgrid > .bx")].map(x => x.dataset.k), c = cfg(); c.order = [...dom, ...c.order.filter(k => !dom.includes(k))]; save(c); render(); };
  document.addEventListener("pointerup", endDrag); document.addEventListener("pointercancel", endDrag);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && S.boardEdit) return setEdit(false);
    const h = e.target.closest && e.target.closest(".bx-h"); if (!h || !["ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault();
    const c = cfg(), vis = c.order.filter(k => !c.off.includes(k)), i = vis.indexOf(h.dataset.v), j = i + (e.key === "ArrowUp" ? -1 : 1); if (j < 0 || j >= vis.length) return;
    [vis[i], vis[j]] = [vis[j], vis[i]]; c.order = [...vis, ...c.order.filter(k => c.off.includes(k))]; save(c); render();
    const nh = document.querySelector(`.bx-h[data-v="${h.dataset.v}"]`); if (nh) nh.focus();
  });
  // fresh data without a gesture: recompute when the app comes back and when the day changes
  let lastDay = localISO();
  const refresh = () => { const d = localISO(); if (d !== lastDay) { lastDay = d; toast("Nuovo giorno, contatori azzerati."); } if (!S.sheet) render(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  window.addEventListener("pageshow", e => { if (e.persisted) refresh(); });

  const st = document.createElement("style");
  st.textContent = `
  .now { gap: 8px; }
  .now-k { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
  .now-t { margin: 0; font-size: 26px; line-height: 30px; }
  .now-s { margin: 0; }
  .now-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .now-acts > * { flex: 0 0 auto; }
  .hl-ink { text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 4px; }
  .mgrid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .mbox { position: relative; display: flex; flex-direction: column; gap: 8px; background: var(--surface); border: 1px solid var(--raised); border-radius: 24px; padding: 16px 16px 14px; cursor: pointer; transition: transform .12s, border-color .12s; -webkit-tap-highlight-color: transparent; }
  .mbox:active { transform: scale(.98); border-color: var(--accent); }
  .mb-h { display: flex; align-items: center; gap: 10px; font-size: 17px; }
  .mb-h b { flex: 1; }
  .mb-ic { width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; background: var(--accent-soft, #26300f); color: var(--accent); flex: none; }
  .mb-chev { color: var(--accent); flex: none; }
  .mb-m { font-size: 30px; font-weight: 800; line-height: 1.1; }
  .mb-m small { font-size: 15px; font-weight: 500; color: var(--muted); }
  .mb-s { margin: 0; color: var(--muted); font-size: 14px; }
  .mb-s b { color: var(--text); }
  .mb-f { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--raised); padding-top: 10px; margin-top: 2px; font-size: 13px; color: var(--faint); }
  .mb-quick { flex: none; min-height: 36px; padding: 0 14px; display: inline-flex; align-items: center; border-radius: 999px; background: var(--accent); color: var(--lime-ink); font-weight: 700; font-size: 14px; }
  .mb-dots { display: flex; gap: 6px; }
  .mb-dots i { flex: 1; height: 8px; border-radius: 999px; background: var(--surface-2); }
  .mb-dots i.on { background: var(--accent); } .mb-dots i.plan { background: none; box-shadow: inset 0 0 0 2px var(--accent); } .mb-dots i.miss { background: none; box-shadow: inset 0 0 0 2px var(--control); }
  .mb-dots i.today:not(.on):not(.plan):not(.miss) { background: var(--faint); }
  .now .now-go { background: #0a0a0a; color: var(--accent); border: 0; min-height: 52px; padding: 0 22px; border-radius: 999px; font-weight: 700; flex: 0 0 auto; }
  .mb-bar { position: relative; height: 8px; border-radius: 999px; background: var(--surface-2); }
  .mb-bar span { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--accent); }
  .mb-bar em { position: absolute; top: -4px; width: 2px; height: 16px; background: var(--text); border-radius: 2px; opacity: .6; }
  .wkrow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .wk { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wk-l { font-size: 12px; color: var(--muted); }
  .wk-d { width: 100%; aspect-ratio: 1; max-width: 42px; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: 15px; background: var(--surface-2); color: var(--faint); }
  .wk.on .wk-d { background: var(--accent); color: var(--lime-ink); }
  .wk.plan .wk-d { box-shadow: inset 0 0 0 2px var(--accent); background: none; color: var(--accent); }
  .wk.miss .wk-d { box-shadow: inset 0 0 0 2px var(--control); background: none; color: var(--muted); }
  .wk.today .wk-l { color: var(--text); font-weight: 700; }
  button.wk { background: none; border: 0; padding: 0; color: inherit; font: inherit; }
  .wk.ed .wk-d { position: relative; }
  .wk.ed.rest .wk-d { box-shadow: inset 0 0 0 1px var(--control); }
  .spark { width: 100%; display: block; }
  .blist { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 4px; }
  .brow { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border-radius: 16px; padding: 8px 8px 8px 12px; }
  .brow.off .b-t { opacity: .5; }
  .b-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .b-t small { color: var(--muted); font-size: 12px; }
  .icon-btn.sm { width: 40px; height: 40px; } .icon-btn[disabled] { opacity: .3; }
  .bx { position: relative; touch-action: manipulation; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; transition: transform .2s; }
  .bx.jig { animation: jig .26s ease-in-out var(--d) infinite alternate; }
  .bx.lift { animation: none; z-index: 5; transition: none; box-shadow: 0 16px 40px rgba(0,0,0,.6); border-radius: 24px; }
  .bx.gone { transform: scale(.8); opacity: 0; transition: transform .18s, opacity .18s; }
  @keyframes jig { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }
  .editing .mbox, .editing .stile { pointer-events: none; }
  .bx-del { position: absolute; top: -12px; left: -12px; z-index: 3; width: 44px; height: 44px; border: 0; background: none; padding: 0; display: grid; place-items: center; }
  .bx-del span { width: 26px; height: 26px; border-radius: 999px; background: #3a3a3c; color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 700; line-height: 1; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
  .bx-h { position: absolute; top: 8px; right: 8px; z-index: 3; width: 44px; height: 44px; border-radius: 12px; border: 0; background: var(--raised); color: var(--text); font-size: 22px; touch-action: none; cursor: grab; }
  .bx-add { width: 100%; min-height: 64px; border-radius: 24px; border: 2px dashed var(--control); background: none; color: var(--muted); font-size: 16px; font-weight: 600; }
  .bx-add span { color: var(--accent); font-size: 22px; margin-right: 6px; }
  .bx-fine { position: fixed; top: calc(10px + env(safe-area-inset-top, 0px)); right: 16px; z-index: 20; min-height: 40px; padding: 0 20px; border-radius: 999px; border: 0; background: var(--accent); color: var(--lime-ink); font-weight: 800; font-size: 16px; }
  .brow.add { width: 100%; border: 0; color: inherit; text-align: left; font: inherit; }
  .bx-plus { width: 32px; height: 32px; border-radius: 999px; background: var(--accent); color: var(--lime-ink); display: grid; place-items: center; font-weight: 800; font-size: 20px; flex: none; }
  .utoast { display: flex; align-items: center; gap: 14px; }
  .utoast button { border: 0; background: none; color: #000; font-weight: 800; text-decoration: underline; padding: 6px 0; font-size: 15px; }
  @media (prefers-reduced-motion: reduce) { .bx.jig { animation: none; outline: 2px dashed var(--accent); outline-offset: 4px; border-radius: 24px; } }
  .bsw { flex: none; width: 50px; height: 30px; border-radius: 999px; border: 0; background: var(--control); position: relative; padding: 0; }
  .bsw span { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 999px; background: #fff; transition: transform .18s; }
  .bsw[aria-checked="true"] { background: var(--accent); }
  .bsw[aria-checked="true"] span { transform: translateX(20px); background: var(--lime-ink); }`;
  document.head.appendChild(st);
})();
