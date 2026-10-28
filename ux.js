"use strict";
/* UX v3 (cards, detail screens, focus session, dashboard). Loaded AFTER the main script: it replaces views by assignment. */
(function () {
  const isGen = typeof setTraining === "function";
  const PHOTOS = isGen && !(window.APP && APP.ns === "abc:") ? ["img/climb.jpg", "img/rack.jpg", "img/hero.jpg"] : ["img/bench.jpg", "img/rack.jpg", "img/hero.jpg"];
  const photoFor = k => PHOTOS[Math.max(0, DAYS.indexOf(k)) % PHOTOS.length];
  const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  const I = {
    kcal: '<svg viewBox="0 0 24 24"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 0-3 0-5.5.5-8z"/></svg>',
    pro: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
    water: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/></svg>',
    peso: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0M12 12l1.5-2"/></svg>',
    sess: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 19h16M7 16V9M12 16V5M17 16v-4"/></svg>',
    time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"/></svg>'
  };
  window.TILE_ICONS = I;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const estMin = p => Math.max(10, Math.round(p.items.reduce((m, it) => m + it.sets * (it.rest + 40), 0) / 300) * 5);
  const nameOf = () => (S.profile && S.profile.nome) || (typeof ownerName === "function" ? ownerName() : "");
  const ring = (done, total, size = 64) => { const r = size / 2 - 5, c = 2 * Math.PI * r, f = total ? done / total : 0;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--raised)" stroke-width="7"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`; };
  const statTile = (ic, val, lab, bar, act, v, badge) => `<button class="stile" ${act ? `data-act="${act}"${v ? ` data-v="${v}"` : ""}` : "disabled"}${badge ? ' aria-label="' + lab + ': aggiungi un bicchiere da 250 ml"' : ""}><span class="ic">${ic}</span>${badge ? `<span class="badge-plus" aria-hidden="true">${badge}</span>` : ""}<span class="tv num">${val}</span><span class="tl">${lab}</span>${bar != null ? `<span class="tb"><i style="width:${Math.max(0, Math.min(100, bar))}%"></i></span>` : ""}</button>`;

  window.statTile = statTile;
  /* ---------- OGGI ---------- */
  function supChips(v) {
    if (typeof supplements === "function") { const s = supplements(); return s.length ? s.map(x => `<button class="pill-t" data-act="sup" data-v="${x.id}" aria-pressed="${!!(v.sup && v.sup[x.id])}">${esc(x.name)}</button>`).join("") : ""; }
    return `<button class="pill-t" data-act="sup" data-v="creatina" aria-pressed="${v.creatina != null}">Creatina ${fmt(S.state.creatinaG || 3)} g</button><button class="pill-t" data-act="sup" data-v="omega" aria-pressed="${!!v.omega}">Omega 3</button>`;
  }
  window.viewOggi = function () {
    const now = new Date(), iso = localISO(), v = dayLog(iso), dw = now.getDay(), it = intake(iso), T = PLAN.kcal;
    const nd = nextDay(), p = nd ? P[nd] : null, a = activeDay(), dt0 = doneToday(), wt = weightTrend();
    const warns = signals().filter(s => s.s === "warn" && s.k !== "Fatica").slice(0, 1);
    const tiles = `<div class="stiles">
      ${statTile(I.kcal, `${fmt(Math.round(it.eaten.kcal))}<small> / ${fmt(T)}</small>`, "Calorie", it.eaten.kcal / T * 100, "kcal-sheet")}
      ${statTile(I.pro, `${Math.round(it.eaten.p)}<small> / ${PLAN.pro} g</small>`, "Proteine", it.eaten.p / PLAN.pro * 100, "kcal-sheet")}
      ${statTile(I.water, `${fmt(v.water * 0.25)}<small> / ${fmt(PLAN.waterL)} L</small>`, "Acqua", v.water * 0.25 / PLAN.waterL * 100, "water", "1", "+")}
      ${statTile(I.peso, v.peso ? `${fmt(v.peso)}<small> kg</small>` : "–", wt.rate != null ? `Peso · ${wt.rate >= 0 ? "+" : ""}${fmt(+wt.rate.toFixed(2))}%/sett` : "Peso · tocca per registrare", null, "sheet", "peso")}</div>`;
    let sess;
    if (!p) sess = `<div class="card"><h2>Nessuna scheda di allenamento</h2><p class="muted">Caricala come testo, foto o PDF, oppure fattene creare una di base.</p><button class="primary go" data-act="redo" data-v="2">Carica la scheda</button></div>`;
    else if (dt0) sess = `<div class="pcard done" style="background-image:url(${photoFor(dt0.day)})"><div class="pc-top"><span class="ph-tag">Fatta oggi</span></div><div class="pc-bot"><div class="pc-title">Seduta <span class="hl">${dt0.day}</span></div>
        <div class="srow"><span><b>${dt0.items.length}</b>esercizi</span><span><b>${dt0.durata || "–"}</b>minuti</span><span><b>${dt0.fatica != null ? dt0.fatica + "/10" : "–"}</b>fatica</span></div>
        <button class="primary go" data-act="tab" data-v="progressi">Vedi i progressi</button></div></div>`;
    else { const ups = p.items.filter(x => plan(x).up).length, d = a ? S.drafts[a] : null, all = d ? P[a].items.flatMap(x => d.sets[x.id]) : [];
      sess = `<div class="pcard" style="background-image:url(${photoFor(nd)})"><div class="pc-top"><span class="ph-tag">${a ? "In corso" : p.day || "Prossima"}</span>${a ? `<span class="pc-ring">${ring(all.filter(s => s.done).length, all.length, 46)}</span>` : ""}</div><div class="pc-bot">
        <div class="pc-title">Seduta <span class="hl">${nd}</span></div><p class="pc-sub">${esc(p.focus)}</p>
        <div class="srow"><span><b>${p.items.length}</b>esercizi</span><span><b>${p.items.reduce((s, x) => s + x.sets, 0)}</b>serie</span><span><b>~${estMin(p)}</b>minuti</span>${ups ? `<span><b class="hl">${ups}</b>da alzare</span>` : ""}</div>
        <div class="row2"><button class="primary go" data-act="start" data-v="${nd}">${a ? "Riprendi" : "Inizia"}</button><button class="ghost dark" data-act="open-day" data-v="${nd}" aria-label="Dettaglio seduta ${nd}">Dettagli</button></div></div></div>`; }
    const meals = MEALS.map(([k, l]) => { const m = mealOf(dw, k), st = mealState(v, k), on = st === "plan" || st === "custom";
      const kc = st === "custom" ? v.custom[k].kcal : st === "skip" ? 0 : m ? nutOf(dw, k).kcal : null;
      const title = st === "custom" ? v.custom[k].text : m ? m.t : st === "skip" ? "Saltato" : "Da registrare";
      return `<div class="mcard ${on ? "on" : ""} ${st === "skip" ? "skip" : ""}"><button class="mc-main" data-act="meal-open" data-v="${k}"><span class="mc-l">${l}</span><span class="mc-t">${esc(title)}</span><span class="mc-k num">${kc != null ? fmt(Math.round(kc)) + " kcal" : "+ aggiungi"}</span></button>
        <button class="check" data-act="${m && st !== "custom" ? "meal" : "mealalt"}" data-v="${k}" aria-pressed="${on}" aria-label="${l}">${on || m ? CHECK : '<svg viewBox="0 0 24 24" style="stroke:var(--faint)"><path d="M12 6v12M6 12h12"/></svg>'}</button></div>`; }).join("");
    const done = MEALS.filter(([k]) => ["plan", "custom"].includes(mealState(v, k))).length;
    const sc = supChips(v);
    return `<div class="hello-row"><div><p class="greet-date">${DOW[dw]} ${now.getDate()} ${now.toLocaleDateString("it-IT", { month: "long" })}</p><h1>Ciao <span class="hl">${esc(nameOf())}</span></h1></div></div>
      <div class="block">${tiles}</div>
      <div class="block"><div class="card lime"><p class="coach-line">${coachLine()}</p><div class="chips"><button class="ghost" data-act="chat">Chiedi al coach</button>${S.sample ? `<button class="ghost" data-act="ask" data-v="${QUICK[0]}">Fai il punto</button>` : ""}</div></div>${warns.map(w => `<div class="alert">${esc(w.k)}: ${esc(w.v)}</div>`).join("")}</div>
      <div class="block">${sess}</div>
      <div class="block"><div class="block-h"><h2>Pasti di <span class="hl">oggi</span></h2><span class="small muted num">${done} di 5</span></div>
        <div class="hscroll">${meals}<button class="mcard add" data-act="mealalt" data-v="extra"><span class="mc-l">Fuori pasto</span><span class="mc-t">Aggiungi uno spuntino o un cibo extra</span><span class="mc-k">+ aggiungi</span></button></div>
        ${v.extra.length ? `<p class="small muted">${v.extra.map(x => `${esc(x.text)} · ${fmt(Math.round(x.kcal))} kcal`).join(" · ")}</p>` : ""}</div>
      ${sc ? `<div class="block"><h2>Integratori</h2><div class="chips">${sc}</div></div>` : ""}`;
  };

  /* ---------- ALLENAMENTO ---------- */
  /* glossario 28/10: «Seduta» per adulto e ragazzo, «Allenamento» per bambino e over 65 */
  const altG = () => { try { const g = window.V3 && V3.data.profile().group; return g === "bambino" || g === "over65"; } catch (_) { return false; } };
  const tv = (sed, all) => altG() ? all : sed;
  function dayCard(k, isNext, i, n) {
    const p = P[k], ups = p.items.filter(x => plan(x).up).length, doneW = Object.values(weekDone()).includes(k), a = activeDay();
    return `<div class="dslide ${isNext ? "next" : ""}" data-i="${i}"><button class="dcard ${isNext ? "next" : ""} ${doneW ? "done" : ""}" data-act="open-day" data-v="${k}" style="--img:url(${photoFor(k)})" aria-label="Seduta ${k}, ${i + 1} di ${n}">
      <span class="dc-img"></span><span class="dc-tag">${doneW ? "Fatta" : isNext ? "Prossima" : p.day || "Seduta"}</span>
      <span class="dc-body"><span class="dc-title">Seduta ${k}</span><span class="dc-sub">${esc(p.focus || p.nome || "")}</span>
      <span class="dc-meta num">${plural(p.items.length, "esercizio", "esercizi")} · ~${estMin(p)} min${ups ? ` · <b>${ups} con carico in aumento</b>` : ""}</span></span>${isNext ? "" : `<span class="dc-go">${ARROW}</span>`}</button>${isNext ? `<button class="primary dc-start" data-act="start" data-v="${k}">${a === k ? "Riprendi" : "Inizia"} seduta ${k}</button>` : ""}</div>`;
  }
  function viewDayDetail(k) {
    const p = P[k], ups = p.items.filter(x => plan(x).up).length;
    const rows = p.items.map(it => { const pl = plan(it), b = pl.b;
      return `<li><span class="dl-n">${esc(short(exName(it)))}${pl.up ? ` <span class="pill up">+${fmt(pl.kg - b.kg)} kg</span>` : ""}</span><span class="dl-m num">${it.sets}×${it.min}–${it.max}${it.unit === "zavorra" ? (pl.kg ? ` · +${fmt(pl.kg)} kg` : " · corpo libero") : b.kg != null && it.unit !== "none" ? ` · ${fmt(pl.kg)} kg` : ""}</span></li>`; }).join("");
    return `<button class="back" data-act="detail-back">${BACK}Sedute</button>
      <div class="dhero" style="background-image:url(${photoFor(k)})"><span class="ph-tag">${p.day || "Seduta"}</span><div class="dh-title">Seduta <span class="hl">${k}</span></div><p class="dh-sub">${esc(p.focus || "")}</p></div>
      <div class="srow boxed"><span><b>${p.items.length}</b>esercizi</span><span><b>${p.items.reduce((s, x) => s + x.sets, 0)}</b>serie</span><span><b>~${estMin(p)}</b>minuti</span><span><b class="${ups ? "hl" : ""}">${ups}</b>carico in aumento</span></div>
      <div class="block"><h2>Esercizi</h2><ul class="dlist">${rows}</ul></div>
      <p class="small muted">Primo esercizio per ogni muscolo: prima fai 1 serie leggera.</p>
      <div class="sticky-cta"><button class="primary go" data-act="start" data-v="${k}">${activeDay() === k ? "Riprendi seduta" : "Inizia seduta " + k}</button></div>`;
  }
  const baseAllen = window.viewAllenamento;
  window.viewAllenamento = function () {
    const a = activeDay();
    if (a) return viewFocus(a);
    if (!DAYS.length) return baseAllen();
    if (S.detail && P[S.detail]) return viewDayDetail(S.detail);
    const nd = nextDay();
    return `<h1>Scegli la <span class="hl">seduta</span></h1><p class="muted" style="margin-top:4px">I carichi sono già quelli della volta scorsa.</p>
      <div class="dcar" role="region" aria-roledescription="carosello" aria-label="Sedute">${DAYS.map((k, i) => dayCard(k, k === nd, i, DAYS.length)).join("")}</div>
      ${DAYS.length > 1 ? `<div class="ddots">${DAYS.map((k, i) => `<button data-dot="${i}" aria-label="Vai alla seduta ${k}" ${k === nd ? 'aria-current="true"' : ""}></button>`).join("")}</div>` : ""}`;
  };
  function viewFocus(a) {
    const d = draft(a), items = P[a].items; if (!items.some(x => x.id === d.cur.id)) { d.cur = firstOpen(a, d); saveDrafts(); }
    const idx = items.findIndex(x => x.id === d.cur.id), it = items[idx];
    const all = items.flatMap(x => d.sets[x.id]), doneN = all.filter(s => s.done).length, allDone = doneN === all.length;
    const exDone = items.filter(x => d.sets[x.id].every(s => s.done)).length;
    const nav = `<div class="fnav"><button class="ghost" data-act="ex-step" data-v="-1" ${idx === 0 ? "disabled" : ""}>‹ Esercizio precedente</button><button class="ghost" data-act="ex-step" data-v="1" ${idx === items.length - 1 ? "disabled" : ""}>Esercizio successivo ›</button></div>`;
    if (typeof isCardio === "function" && isCardio(it) && !allDone) // modifica 5, tavola CardioSeduta: titolo, card del cardio, comandi; niente demo né serie
      return `<div class="cdo-top"><h1>${tv("Seduta", "Allenamento")} ${a}</h1><p>Cardio ${cardioWhen(it) === "prima" ? "prima dei pesi" : "dopo i pesi"}</p></div><div class="cdo-main">${activeCard(it, d)}</div>${nav}
      <div class="block"><button class="ghost" data-act="exlist">Tutti gli esercizi</button></div>`;
    return `<div class="fhead"><button class="back" data-act="exlist">${'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'}Tutti gli esercizi</button>
        <div class="fring">${ring(doneN, all.length, 54)}<span class="num">${exDone}/${items.length}</span></div></div>
      <p class="small muted" style="margin:6px 0 10px">Esercizio ${idx + 1} di ${items.length} · ${tv("Seduta", "Allenamento")} ${a}</p>
      ${allDone ? `<div class="card lime" style="margin-bottom:12px"><p class="coach-line">Tutte le serie fatte</p><p class="small">${all.length} serie${d.startedAt ? " in " + Math.max(1, Math.round((Date.now() - d.startedAt) / 60000)) + " minuti" : ""}</p><button class="primary go" data-act="finish">${tv("Concludi la seduta", "Concludi l'allenamento")}</button></div>` : ""}
      ${demoBox(it)}
      ${(S.sample || (window.LIB && it.lib && window.LIB[it.lib])) ? `<button class="swapbar" data-act="alts"><span>Attrezzo occupato?</span><b>Cambia esercizio ${'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>'}</b></button>` : ""}
      ${activeCard(it, d)}
      <div class="fnav"><button class="ghost" data-act="ex-step" data-v="-1" ${idx === 0 ? "disabled" : ""}>‹ Esercizio precedente</button><button class="ghost" data-act="ex-step" data-v="1" ${idx === items.length - 1 ? "disabled" : ""}>Esercizio successivo ›</button></div>
      <div class="block"><button class="link small" data-act="finish" style="align-self:center">${tv("Concludi la seduta", "Concludi l'allenamento")}</button></div>`;
  }

  /* ---------- PROGRESSI ---------- */
  const baseProgress = window.viewProgress;
  window.viewProgress = function () {
    const r = periodRange(), from = r.from;
    const ses = S.sessions.filter(s => localISO(new Date(s.date)) >= from).sort((x, y) => x.date < y.date ? 1 : -1);
    const vol = ses.reduce((m, s) => m + s.items.reduce((a2, e) => a2 + e.sets.reduce((b2, x) => b2 + (+x.kg || 0) * (+x.reps || 0), 0), 0), 0);
    const kd = []; for (let d = from; d < r.to; d = addDays(d, 1)) if (S.days[d]) { const x = intake(d); if (x.logged) kd.push(x.eaten.kcal); }
    const w = weights().filter(x => x.date >= from), wch = w.length > 1 ? w[w.length - 1].kg - w[0].kg : null;
    const tiles = `<div class="stiles">
      ${statTile(I.sess, `${ses.length}`, "Sedute nel periodo", null, "psub", "carichi")}
      ${statTile(I.vol, vol >= 10000 ? `${fmt(Math.round(vol / 100) / 10)}<small> t</small>` : `${fmt(Math.round(vol))}<small> kg</small>`, "Volume sollevato", null, "psub", "carichi")}
      ${statTile(I.kcal, kd.length ? `${fmt(Math.round(kd.reduce((a2, b2) => a2 + b2, 0) / kd.length / 10) * 10)}` : "–", "Kcal medie al giorno", null, "psub", "calorie")}
      ${statTile(I.peso, wch != null ? `${wch >= 0 ? "+" : ""}${fmt(+wch.toFixed(1))}<small> kg</small>` : "–", "Peso nel periodo", null, "psub", "peso")}</div>`;
    const recent = ses.slice(0, 4).map(s => { const nSets = s.items.reduce((m, e) => m + e.sets.length, 0);
      return `<button class="rcard" data-act="sess-open" data-v="${esc(s.id)}"><span class="rc-day">${s.day}</span><span class="rc-body"><b>Seduta ${s.day}</b><span class="small muted">${dt(s.date)} · ${plural(nSets, "serie", "serie")}${s.durata ? ` · ${s.durata} min` : ""}${s.fatica != null ? ` · fatica ${s.fatica}/10` : ""}</span></span><span class="dc-go">${ARROW}</span></button>`; }).join("");
    const base = baseProgress().replace(/^<h1>[\s\S]*?<\/h1>/, "");
    const segPeriod = periodSeg();
    return `<h1>I tuoi <span class="hl">progressi</span></h1>${segPeriod}<div class="block">${tiles}</div>
      ${recent ? `<div class="block"><div class="block-h"><h2>Sedute recenti</h2><span class="small muted">${esc(r.lab)}</span></div><div class="stack" style="gap:8px">${recent}</div></div>` : ""}
      <div class="block"><h2>Dettagli</h2></div>${base.replace(periodSeg(), "")}`;
  };

  /* ---------- sheets ---------- */
  const baseSheet = window.renderSheet;
  window.renderSheet = function () {
    const sh = S.sheet, o = $("#overlay");
    if (!["meal", "kcal", "exlist", "sess"].includes(sh)) return baseSheet();
    let html = "";
    if (sh === "meal") {
      const k = S.mealKey, dw = new Date().getDay(), v = dayLog(localISO()), m = mealOf(dw, k), st = mealState(v, k), l = (MEALS.find(x => x[0] === k) || [])[1];
      html = `<div class="block-h"><h2>${l}</h2><button class="link small" data-act="close" style="padding:0">Chiudi</button></div>
        ${st === "custom" ? `<div class="card"><b>${esc(v.custom[k].text)}</b><p class="small muted">${fmt(Math.round(v.custom[k].kcal))} kcal · ${Math.round(v.custom[k].p)} g proteine (stima)</p></div>` : ""}
        ${m ? `<div class="card"><div class="block-h"><b>${esc(m.t)}</b><span class="small muted num">${fmt(nutOf(dw, k).kcal)} kcal</span></div><ul class="plain muted">${m.i.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : `<p class="muted">Per questo pasto non c'è un piano: registra cosa hai mangiato.</p>`}
        ${m && st !== "custom" ? `<button class="primary" data-act="meal" data-v="${k}">${st === "plan" ? "Segna come non fatto" : "Fatto come da piano"}</button>` : ""}
        <button class="ghost" data-act="mealalt" data-v="${k}">${st === "custom" ? "Modifica cosa ho mangiato" : "Ho mangiato altro"}</button>
        <button class="link small" data-act="mealskip" data-v="${k}" style="align-self:center">${st === "skip" ? "Annulla «saltato»" : "L'ho saltato"}</button>`;
    } else if (sh === "kcal") {
      const v = dayLog(localISO());
      html = `<div class="block-h"><h2>Calorie di <span class="hl">oggi</span></h2><button class="link small" data-act="close" style="padding:0">Chiudi</button></div>${energyCard()}
        <div class="card"><div class="block-h"><div><b>Acqua</b><div class="small muted num">${fmt(v.water * 0.25)} di ${fmt(PLAN.waterL)} L</div></div><div class="hctl"><button class="icon-btn" data-act="water" data-v="-1" aria-label="Togli un bicchiere"><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><button class="icon-btn" data-act="water" data-v="1" aria-label="Aggiungi un bicchiere da 250 ml"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></div></div></div>`;
    } else if (sh === "exlist") {
      const a = activeDay(), d = draft(a);
      html = `<div class="block-h"><h2>Seduta ${a}</h2><button class="link small" data-act="close" style="padding:0">Chiudi</button></div>
        <div class="stack" style="gap:8px">${P[a].items.map((it, i) => { const sets = d.sets[it.id], n = sets.filter(s => s.done).length, full = n === sets.length;
          return `<button class="xrow ${full ? "done" : ""}" data-act="jump" data-v="${it.id}" ${it.id === d.cur.id ? 'aria-current="true"' : ""}><span class="st ${full ? "full" : n ? "part" : ""}">${CHECK}</span><span class="nm">${i + 1}. ${esc(short(exName(it)))}</span><span class="rt num">${it.misura === "cardio" ? (full ? sets[0].min + " minuti fatti" : "Cardio · " + sets[0].min + " minuti") : n + "/" + sets.length}</span></button>`; }).join("")}</div>`;
    } else if (sh === "sess") {
      const s = S.sessions.find(x => x.id === S.sessId);
      if (!s) { S.sheet = null; return baseSheet(); }
      html = `<div class="block-h"><h2>Seduta <span class="hl">${s.day}</span> · ${dt(s.date)}</h2><button class="link small" data-act="close" style="padding:0">Chiudi</button></div>
        <div class="srow boxed"><span><b>${s.items.length}</b>esercizi</span><span><b>${s.items.reduce((m, e) => m + e.sets.length, 0)}</b>serie</span><span><b>${s.durata || "–"}</b>minuti</span><span><b>${s.fatica != null ? s.fatica : "–"}</b>fatica</span></div>
        <div class="list">${s.items.map(e => `<div class="lrow"><span>${esc(short(e.name))}</span><span class="r small">${e.cardio ? `${e.cardio.min != null ? e.cardio.min + " minuti" : "Cardio"}${e.cardio.km ? " · " + fmt(e.cardio.km) + " km" : ""}` : e.sets.map(x => x.kg != null ? `${fmt(x.kg)}×${x.reps}` : x.reps).join(" · ")}</span></div>`).join("")}</div>
        ${s.note ? `<p class="muted">Note: ${esc(s.note)}</p>` : ""}`;
    }
    o.innerHTML = `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  };

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "open-day") { S.detail = v; S.tab = "allenamento"; lsSet("tab2", S.tab); window.scrollTo(0, 0); render(); }
    else if (act === "detail-back") { S.detail = null; window.scrollTo(0, 0); render(); }
    else if (act === "meal-open") { S.mealKey = v; S.sheet = "meal"; renderSheet(); }
    else if (act === "kcal-sheet") { S.sheet = "kcal"; renderSheet(); }
    else if (act === "exlist") { S.sheet = "exlist"; renderSheet(); }
    else if (act === "jump") { const d = draft(activeDay()), sets = d.sets[v], i = sets.findIndex(s => !s.done); d.cur = { id: v, i: i >= 0 ? i : 0 }; saveDrafts(); S.sheet = null; render(); window.scrollTo(0, 0); }
    else if (act === "ex-step") { const a = activeDay(), d = draft(a), items = P[a].items, idx = items.findIndex(x => x.id === d.cur.id), nx = items[Math.max(0, Math.min(items.length - 1, idx + (+v)))], i = d.sets[nx.id].findIndex(s => !s.done); d.cur = { id: nx.id, i: i >= 0 ? i : 0 }; saveDrafts(); render(); window.scrollTo(0, 0); }
    else if (act === "sess-open") { S.sessId = v; S.sheet = "sess"; renderSheet(); }
    else if (act === "start" || act === "tab") S.detail = null;
  }, true);

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
  html, body { overscroll-behavior: none; }
  body.nobar .wrap { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
  .hello-row h1 { margin-top: 2px; }
  .stiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stile { text-align: left; border: 0; background: var(--surface); border-radius: 22px; padding: 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; color: var(--text); }
  .stile:active { background: var(--raised); }
  .stile { position: relative; }
  .badge-plus { position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; border-radius: 999px; background: var(--accent); color: var(--lime-ink); font-size: 20px; font-weight: 800; display: grid; place-items: center; line-height: 1; }
  .stile .ic { width: 34px; height: 34px; border-radius: 999px; background: var(--accent-soft); display: grid; place-items: center; }
  .stile .ic svg { width: 18px; height: 18px; stroke: var(--accent); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .stile .tv { font-size: 24px; line-height: 28px; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
  .stile .tv small { font-size: 13px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
  .stile .tl { font-size: 12px; color: var(--muted); }
  .stile .tb { height: 6px; border-radius: 3px; background: var(--raised); overflow: hidden; }
  .stile .tb i { display: block; height: 100%; background: var(--accent); }
  .pcard { position: relative; border-radius: 28px; overflow: hidden; min-height: 330px; background: #0d0d0d center 30% / cover no-repeat; display: flex; flex-direction: column; justify-content: space-between; }
  .pcard::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.35) 40%, rgba(10,10,10,.96) 75%); }
  .pcard > * { position: relative; }
  .pc-top { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px; }
  .pc-top .ph-tag, .dhero .ph-tag { background: var(--accent); color: var(--lime-ink); font-weight: 700; font-size: 13px; padding: 6px 12px; border-radius: 999px; }
  .pc-ring { background: rgba(0,0,0,.55); border-radius: 999px; padding: 4px; }
  .pc-bot { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 10px; }
  .pc-title, .dh-title { font-size: 40px; line-height: 40px; font-weight: 800; letter-spacing: -0.04em; }
  .pc-sub, .dh-sub { color: var(--muted); margin: 0; }
  .srow { display: flex; gap: 8px; }
  .srow > span { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--muted); }
  .srow b { font-size: 20px; line-height: 24px; color: var(--text); font-weight: 800; font-variant-numeric: tabular-nums; }
  .srow b.hl { color: var(--accent); }
  .srow.boxed { background: var(--surface); border-radius: 20px; padding: 14px 16px; margin-top: 14px; }
  .srow.boxed > span + span { border-left: 1px solid var(--rule); padding-left: 12px; }
  .ghost.dark { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.2); flex: 0 0 auto; min-height: 52px; padding: 0 18px; }
  .row2 .primary { flex: 1; }
  .hscroll { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 calc(-1 * max(16px, env(safe-area-inset-left, 0px))); padding: 2px max(16px, env(safe-area-inset-left, 0px)) 6px; scrollbar-width: none; }
  .hscroll::-webkit-scrollbar { display: none; }
  .mcard { flex: 0 0 64%; scroll-snap-align: start; background: var(--surface); border-radius: 22px; padding: 14px; display: flex; gap: 10px; align-items: flex-start; min-height: 132px; border: 0; color: var(--text); }
  .mcard.on { background: var(--accent); color: var(--lime-ink); }
  .mcard.on .mc-l, .mcard.on .mc-k { color: rgba(0,0,0,.65); }
  .mcard.on .check { background: #000; border-color: #000; } .mcard.on .check svg { stroke: var(--accent); }
  .mcard.skip .mc-t { text-decoration: line-through; color: var(--faint); }
  .mcard.add { flex-basis: 48%; flex-direction: column; text-align: left; border: 1.5px dashed var(--control); background: transparent; }
  .mc-main { flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; color: inherit; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .mc-l { font-size: 12px; color: var(--faint); }
  .mc-t { font-weight: 700; line-height: 20px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .mc-k { font-size: 13px; color: var(--muted); margin-top: auto; }
  .dcar { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; padding: 0 16px; margin: 16px -16px 0; overscroll-behavior-x: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .dcar::-webkit-scrollbar { display: none; }
  .dslide { position: relative; flex: 0 0 calc(100% - 56px); scroll-snap-align: start; scroll-snap-stop: always; height: 360px; display: flex; }
  .dslide .dcard { flex: 1; min-height: 0; }
  .dslide .dcard .dc-img { height: 170px; }
  .dslide .dc-sub { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dslide.next .dcard { padding-bottom: 72px; }
  .dslide .dc-start { position: absolute; left: 14px; right: 14px; bottom: 14px; width: auto; min-height: 52px; margin: 0; background: #0a0a0a; color: var(--accent); border: 0; border-radius: 999px; font-weight: 800; font-size: 16px; box-shadow: none; }
  .dcard.done .dc-tag { background: var(--raised); color: var(--muted); }
  .ddots { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
  .ddots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: var(--control); transition: width .2s, background .2s; position: relative; }
  .ddots button::after { content: ""; position: absolute; inset: -18px -8px; }
  .ddots button[aria-current="true"] { width: 20px; background: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .dcar { scroll-behavior: auto; } }
  .dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  .dcard { position: relative; text-align: left; border: 0; padding: 0; border-radius: 24px; overflow: hidden; background: var(--surface); color: var(--text); display: flex; flex-direction: column; min-height: 250px; }
  .dcard:first-child:nth-last-child(odd), .dgrid .dcard.next:first-child { }
  .dcard .dc-img { height: 120px; background: var(--img) center 30% / cover no-repeat; filter: grayscale(1); }
  .dcard .dc-tag { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,.6); color: var(--text); font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; }
  .dcard.next { background: var(--accent); color: var(--lime-ink); }
  .dcard.next .dc-tag { background: var(--accent); color: var(--lime-ink); }
  .dcard.next .dc-sub, .dcard.next .dc-meta { color: rgba(0,0,0,.7); }
  .dc-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .dc-title { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
  .dc-sub { font-size: 13px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dc-meta { font-size: 12px; color: var(--muted); margin-top: auto; padding-right: 40px; }
  .dc-meta b { color: inherit; }
  .dc-go { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; border-radius: 999px; background: #000; color: var(--accent); display: grid; place-items: center; }
  .dcard:not(.next) .dc-go { background: var(--accent); color: var(--lime-ink); }
  .dgrid .dcard:last-child:nth-child(odd) { grid-column: 1 / -1; min-height: 200px; }
  .dgrid .dcard:last-child:nth-child(odd) .dc-img { height: 100px; }
  .dhero { position: relative; border-radius: 28px; overflow: hidden; min-height: 260px; margin-top: 8px; background: #0d0d0d center 30% / cover; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px 18px; gap: 6px; }
  .dhero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,10,10,.95) 100%); }
  .dhero > * { position: relative; }
  .dhero .ph-tag { position: absolute; top: 14px; left: 14px; }
  .dlist { margin: 0; padding: 0; list-style: none; background: var(--surface); border-radius: 20px; padding: 2px 16px; }
  .dlist li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 13px 0; border-top: 1px solid var(--rule); }
  .dlist li:first-child { border-top: 0; }
  .dl-n { min-width: 0; font-weight: 600; }
  .dl-m { color: var(--muted); font-size: 13px; flex: none; }
  .pill.up { display: inline-block; background: var(--accent); color: var(--lime-ink); font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px; margin-left: 4px; vertical-align: 2px; }
  .sticky-cta { position: sticky; bottom: calc(70px + env(safe-area-inset-bottom, 0px)); margin-top: 16px; padding-top: 10px; background: var(--ground); }
  .fhead { display: flex; justify-content: space-between; align-items: center; }
  .fring { position: relative; width: 54px; height: 54px; }
  .fring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 12px; font-weight: 800; }
  .fnav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  .fnav .ghost { min-height: 50px; }
  .rcard { width: 100%; text-align: left; border: 0; background: var(--surface); border-radius: 20px; padding: 12px; display: flex; align-items: center; gap: 12px; color: var(--text); position: relative; }
  .rc-day { width: 46px; height: 46px; border-radius: 14px; background: var(--accent); color: var(--lime-ink); display: grid; place-items: center; font-weight: 800; font-size: 20px; flex: none; }
  .rc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .rcard .dc-go { position: static; }
  .xrow[aria-current="true"] { outline: 2px solid var(--accent); }
  .swapbar { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1.5px dashed var(--control); background: transparent; color: var(--muted); border-radius: 16px; padding: 10px 14px; margin-bottom: 10px; text-align: left; font-size: 13px; }
  .swapbar b { color: var(--accent); display: inline-flex; gap: 6px; align-items: center; font-size: 14px; flex: none; }
  `;
  document.head.appendChild(css);

  /* no rubber-band scrolling; no tab-bar padding on screens without the bar */
  const baseRender = window.render;
  window.render = function () { baseRender(); const bar = document.getElementById("bar"); document.body.classList.toggle("nobar", !(bar && bar.innerHTML.trim())); };
  /* re-render with the new views once every module in this file has loaded */
  setTimeout(() => render(), 0);
})();

/* ---------- exercise demos (Free Exercise DB, public domain) and rotating tips ---------- */
(function () {
  const IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
  const BY_ID = { A1: "Leverage_Incline_Chest_Press", A2: "Hack_Squat", A3: "Butterfly", A4: "Leg_Extensions", A5: "Low_Cable_Crossover", A6: "Barbell_Hip_Thrust", A7: "Seated_Leg_Curl", A8: "Triceps_Pushdown", A9: "Standing_Calf_Raises", A10: "Hanging_Leg_Raise",
    B1: "Romanian_Deadlift", B2: "Pullups", B3: "Seated_One-arm_Cable_Pulley_Rows", B4: "Cable_Seated_Lateral_Raise", B5: "Reverse_Machine_Flyes", B6: "Machine_Bicep_Curl", B7: "Standing_Calf_Raises", B8: "Hanging_Leg_Raise", B9: "Cable_Rope_Overhead_Triceps_Extension",
    C1: "Incline_Dumbbell_Press", C2: "Leg_Press", C3: "Machine_Shoulder_Military_Press", C4: "Lying_Leg_Curls", C5: "Wide-Grip_Lat_Pulldown", C6: "Seated_Cable_Rows", C7: "Cable_Crossover", C8: "Lying_One-Arm_Lateral_Raise", C9: "Hanging_Leg_Raise" };
  // Italian gym words -> English tokens used by the dataset
  const IT = [[/sopra la testa|overhead/, "cable rope overhead triceps extension"], [/skull|french/, "ez-bar skullcrusher"], [/squat bulgaro|split squat/, "split squat"], [/croci.*cavi|crossover/, "cable crossover"], [/croci|\bfly\b|pec ?deck|peck|butterfly/, "butterfly"],
    [/panca piana|distensioni/, "barbell bench press medium grip"], [/panca inclinata|inclinata/, "incline dumbbell press"], [/chest press|spinte? (al|alla) macchina/, "machine bench press"],
    [/lat ?machine|lat pulldown|pulldown/, "wide-grip lat pulldown"], [/trazion|pull.?up/, "pullups"], [/pulley|rematore (ai )?cavi|seated row/, "seated cable rows"], [/rematore.*manubri/, "one-arm dumbbell row"], [/rematore|\brow\b/, "bent over barbell row"],
    [/stacco rumeno|romanian/, "romanian deadlift"], [/stacco/, "barbell deadlift"], [/hack/, "hack squat"], [/squat/, "barbell squat"], [/leg press|pressa/, "leg press"], [/leg extension/, "leg extensions"],
    [/leg curl.*sedut|seated leg curl/, "seated leg curl"], [/leg curl|nordic/, "lying leg curls"], [/affond|lunge/, "dumbbell lunges"], [/hip thrust|ponte/, "barbell hip thrust"], [/polpacci|calf/, "standing calf raises"],
    [/alzate laterali|\blateral raise/, "side lateral raise"], [/alzate frontali/, "front dumbbell raise"], [/reverse|posterior/, "reverse machine flyes"], [/lento avanti|military|shoulder press|spinte? manubri/, "dumbbell shoulder press"],
    [/curl.*martello|hammer/, "hammer curls"], [/curl/, "barbell curl"], [/push.?down|ercolina|tricip/, "triceps pushdown"], [/\bdip/, "dips triceps version"],
    [/addominal.*sbarra|leg raise|toes to bar/, "hanging leg raise"], [/crunch/, "crunches"], [/plank/, "plank"], [/piegament|push.?up/, "pushups"]];
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const STEM = { flyes: "fly", flye: "fly", flies: "fly", raises: "raise", curls: "curl", extensions: "extension", rows: "row", crunches: "crunch", presses: "press", squats: "squat", lunges: "lunge", pullups: "pullup", pushups: "pushup", deadlifts: "deadlift", pulldowns: "pulldown", dips: "dip", laterals: "lateral" };
  const NOUNS = new Set(["fly", "press", "curl", "row", "raise", "squat", "lunge", "pullup", "pushup", "deadlift", "pulldown", "dip", "extension", "crunch", "thrust", "bridge", "crossover", "pushdown", "lateral", "plank", "shrug", "kickback", "skullcrusher", "butterfly"]);
  const words = s => norm(s).split(/[\s-]+/).filter(w => w.length > 1).map(w => STEM[w] || w);
  function bestMatch(text) {
    const db = window.EXDB || [], qa = words(text).filter(w => w.length > 2), q = new Set(qa); if (!q.size) return null;
    const noun = [...qa].reverse().find(w => NOUNS.has(w));
    let best = null, bs = 0;
    for (const [id, name] of db) { const w = words(name); if (noun && !w.includes(noun)) continue; let hit = 0, extra = 0; for (const x of w) { if (q.has(x)) hit += x.length; else extra++; } const sc = hit - extra * 2; if (hit && sc > bs) { bs = sc; best = id; } }
    return bs >= 5 ? best : null;
  }
  const cache = {};
  window.demoFor = function (it) {
    const sub = curSub(it), name = exName(it), key = it.id + "|" + name;
    if (key in cache) return cache[key];
    let id = null;
    if (!sub && it.demo) id = it.demo;
    if (!id && !sub && BY_ID[it.id] && !isGenApp()) id = BY_ID[it.id];
    if (!id && it.en) id = bestMatch(it.en);
    if (!id) { const en = (/\(([^)]*)\)\s*$/.exec(name) || [])[1]; if (en) id = bestMatch(en); }
    if (!id) { const n = norm(name.replace(/\([^)]*\)\s*$/, "")); for (const [re, en] of IT) if (re.test(n)) { id = bestMatch(en); if (id) break; } }
    return cache[key] = id;
  };
  const isGenApp = () => typeof setTraining === "function";
  const GENERAL = ["Scendi in 2–3 secondi, risali deciso.", "Espira mentre spingi o tiri, inspira nel ritorno.", "Fermati a 1–2 ripetizioni dal cedimento.", "Stesso arco di movimento in ogni ripetizione.", "Se la tecnica cede, la serie è finita."];
  window.tipsFor = function (it) {
    const sub = curSub(it), list = [];
    const split = t => String(t || "").split(/(?<=[.!?])\s+/).map(x => x.trim().replace(/\.$/, "")).filter(x => x.length > 6).map(x => x.charAt(0).toUpperCase() + x.slice(1));
    if (sub && sub.cue) list.push(...split(sub.cue)); list.push(...split(it.tech)); if (it.note) list.push(...split(it.note));
    const g = (() => { try { return window.V3 && V3.data.profile().group; } catch (_) { return null; } })();
    const gen = g === "bambino" || g === "over65" ? GENERAL.map(t => /cedimento/.test(t) ? "Fermati quando il movimento non è più pulito." : t) : GENERAL;
    return list.concat(gen).slice(0, 8);
  };
  window.demoBox = function (it) {
    const id = demoFor(it), tips = tipsFor(it);
    S.tips = tips; S.tipI = 0;
    return `<div class="demo">${id ? `<div class="demo-img" aria-label="Come si fa: ${esc(short(exName(it)))}" role="img"><img src="${IMG}${encodeURIComponent(id)}/0.jpg" alt="" loading="eager" onerror="this.closest('.demo').classList.add('noimg')"><img src="${IMG}${encodeURIComponent(id)}/1.jpg" alt="" class="b" loading="eager"></div>` : ""}
      <div class="tip" aria-live="polite"><span class="tip-k">Consiglio</span><span id="tip-t">${esc(tips[0] || "")}</span></div></div>`;
  };
  const st = document.createElement("style");
  st.textContent = `
  .demo { background: var(--surface); border-radius: 22px; overflow: hidden; margin-bottom: 10px; }
  .demo-img { position: relative; aspect-ratio: 16 / 10; background: #fff; }
  .demo-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: grayscale(1) contrast(1.05); }
  .demo-img img.b { animation: demoflip 2.4s steps(1, end) infinite; }
  @keyframes demoflip { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
  .demo.noimg .demo-img { display: none; }
  .tip { display: flex; gap: 10px; align-items: baseline; padding: 12px 14px; min-height: 48px; }
  .tip-k { flex: none; background: var(--accent); color: var(--lime-ink); font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
  #tip-t { font-size: 14px; line-height: 20px; transition: opacity .25s; }
  #tip-t.out { opacity: 0; }
  @media (prefers-reduced-motion: reduce) { .demo-img img.b { animation: none; opacity: 0; } }
  `;
  document.head.appendChild(st);
  /* session carousel: start on the next session, dots follow, dots scroll */
  const rC = window.render;
  window.render = function () { rC(); const c = document.querySelector(".dcar"); if (!c || c.dataset.init) return; c.dataset.init = "1";
    const n = c.querySelector(".dslide.next"); if (n) c.scrollLeft = n.offsetLeft - 16;
    const dots = [...document.querySelectorAll(".ddots button")];
    c.addEventListener("scroll", () => { const w = c.querySelector(".dslide").offsetWidth + 12, i = Math.round(c.scrollLeft / w); dots.forEach((d, j) => d.toggleAttribute("aria-current", j === i)); if (dots[i]) dots[i].setAttribute("aria-current", "true"); }, { passive: true });
    dots.forEach((d, j) => d.addEventListener("click", () => { const sl = c.querySelectorAll(".dslide")[j]; if (sl) c.scrollTo({ left: sl.offsetLeft - 16, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }));
  };
})();
