"use strict";
/* 29/10 tavole 85-87 (SedutaEsercizio, SedutaNuovoCarico, SedutaBambino): seduta in corso nel nuovo stile.
   Sostituisce la vista focus di ux.js per gli esercizi coi pesi; cardio, recupero (#tm-mini), barra Tempo totale + Concludi e fogli restano quelli di prima.
   Usa le stesse azioni della vista vecchia (kg, repsd, kgin, done, pickset, delset, addset, alts, exlist, ex-step, finish). Caricato dopo sec-palestra.js. */
(function () {
  const IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
  const kid = () => groupNow() === "bambino";
  const tv = (sed, all) => allenW() ? all : sed;
  const minWords = s => s % 60 ? mmss(s) : s === 60 ? "1 minuto" : s / 60 + " minuti";
  const base = window.viewAllenamento;

  window.viewAllenamento = function () {
    const a = activeDay(); if (!a) return base();
    const d = draft(a), items = P[a].items;
    if (!items.some(x => x.id === d.cur.id)) { d.cur = firstOpen(a, d); saveDrafts(); }
    const it = items.find(x => x.id === d.cur.id);
    return isCardio(it) ? base() : page(a, d, items, it);
  };

  /* nome di una serie per i pulsanti: «la serie 2», «il riscaldamento», «il calo», «il giro 1» */
  function setName(sets, x, k) {
    if (x.w) return "il riscaldamento";
    if (x.dr) return "il calo";
    return (k ? "il giro " : "la serie ") + (sets.filter(y => !y.w && !y.dr).indexOf(x) + 1);
  }
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  /* ---------- tavole 91-94: timer degli esercizi a tempo (plank e simili). Stato in d.tmr {id, i, ph: prep|run, t0, dur} ---------- */
  const PREP = 3, RR = 130, CC = +(2 * Math.PI * RR).toFixed(1);
  const secTxt = n => n < 60 ? `${n} secondi` : mmss(n);
  const ring = (txt, lab, frac, big) => `<div class="sx-ring${big ? " big" : ""}"><svg viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="${RR}"/><circle class="arc" id="sx-arc" cx="150" cy="150" r="${RR}" stroke-dasharray="${CC}" style="stroke-dashoffset:${(CC * (1 - frac)).toFixed(1)}"/></svg><div role="timer"><b id="sx-tt">${txt}</b><span id="sx-tl">${lab}</span></div></div>`;
  function tState(T) {
    const el = (Date.now() - T.t0) / 1000;
    if (T.ph === "prep") return { prep: true, left: PREP - el, txt: String(Math.max(1, Math.ceil(PREP - el))), lab: "mettiti in posizione", frac: 1 };
    const left = Math.max(0, T.dur - el);
    return { left, el, txt: mmss(Math.ceil(left)), lab: "mancano su " + mmss(T.dur), frac: T.dur ? left / T.dur : 0 };
  }
  /* ferma il recupero come «fine pausa» di timer.js: il recupero si ricalcola dall'ultimo evento «done» */
  function stopRest(d) { const ev = d.ev || (d.ev = []), l = ev[ev.length - 1]; if (l && l.type === "done") ev.push({ type: "go", t: Date.now() }); S.timer = null; }
  function tDone(sec, full) {
    const a = activeDay(), d = draft(a), T = d.tmr; if (!T) return;
    delete d.tmr;
    const sets = d.sets[T.id], it = P[a].items.find(x => x.id === T.id);
    if (!sets || !sets[T.i] || !it) { saveDrafts(); render(); return; }
    const s = sets[T.i], nx = sets.findIndex((x, j) => j > T.i && !x.done), keep = nx >= 0 ? sets[nx].reps : null;
    s.reps = Math.max(1, Math.round(sec)); d.cur = { id: T.id, i: T.i };
    if (window.sxBeep) sxBeep();
    markDone();
    if (nx >= 0 && !full) { sets[nx].reps = keep; saveDrafts(); render(); } // fermato prima: la serie dopo resta col tempo previsto
    toast("Serie fatta", { sub: `${short(exName(it))} · ${full ? secTxt(T.dur) : s.reps + " secondi su " + T.dur}` });
  }
  setInterval(() => {
    const a = activeDay(); if (!a) return;
    const d = draft(a), T = d.tmr; if (!T) return;
    const st = tState(T);
    if (st.prep && st.left <= 0) { T.ph = "run"; T.t0 += PREP * 1000; saveDrafts(); if (window.sxBeep) sxBeep(); try { navigator.vibrate && navigator.vibrate(60); } catch (_) {} render(); return; }
    if (!st.prep && st.left <= 0) { tDone(T.dur, true); return; }
    const tt = document.getElementById("sx-tt"), tl = document.getElementById("sx-tl"), arc = document.getElementById("sx-arc");
    if (tt) tt.textContent = st.txt; if (tl) tl.textContent = st.lab; if (arc) arc.style.strokeDashoffset = (CC * (1 - st.frac)).toFixed(1);
  }, 250);

  function page(a, d, items, it) {
    const idx = items.indexOf(it), sets = d.sets[it.id], i = d.cur.i, s = sets[i], X = itOf(it, d), pl = plan(X), b = pl.b, k = kid();
    const none = k || it.unit === "none", tmp = it.misura === "tempo", sub = curSub(it);
    const work = sets.filter(x => !x.w && !x.dr), wi = work.indexOf(s), nw = sets.filter(x => x.w).length;
    const all = items.flatMap(x => d.sets[x.id]), allDone = all.every(x => x.done);

    const setLab = s.w ? `Riscaldamento ${sets.filter(x => x.w).indexOf(s) + 1} di ${nw}` : s.dr ? "Serie con meno peso, senza pausa" : `${k ? "Giro" : "Serie"} ${wi + 1} di ${work.length}`;
    const restLab = k ? `riposo ${minWords(it.rest)}` : `recupero ${mmss(it.rest)}`;
    const up = pl.up && !k && !s.w;

    /* card del carico: cosa hai fatto l'ultima volta e cosa provare oggi (senza carico nuovo: lo dice l'etichetta) */
    let why = "";
    const kgTxt = b.kg != null && !none ? fmt(b.kg) + " kg × " : "";
    if (k) why = `${esc((tipsFor(it)[0] || "Muoviti piano e controlla il movimento"))}.${b.lastSets ? ` L'ultima volta ne hai fatti <b>${b.lastSets[0]}</b>.` : ""}`;
    else if (tipoOf(X) !== "uguali" || X.risc || (X.schema && X.schema.calo)) why = esc(schLabel(X)) + (b.lastSets ? `. L'ultima volta <b>${kgTxt}${b.lastSets.slice(0, it.sets).join(", ")}</b>.` : ".");
    else if (!up && b.lastSets) {
      const tgt = Math.min(it.max, Math.min(...b.lastSets.slice(0, it.sets).map(Number)) + (tmp ? 5 : 1));
      why = `Oggi: <b>${tgt} ${tmp ? "secondi" : "ripetizioni"}${b.kg != null && !none ? " con " + fmt(b.kg) + " kg" : ""}</b>. ${b.from === "scheda" ? "Dalla scheda" : "L'ultima volta"} ${b.lastSets.slice(0, it.sets).join(", ")}.`; // obiettivo prima (revisione copy 30/10)
    } else if (!up) why = `Prima volta: scegli un carico con cui fai ${it.min === it.max ? it.min : it.min + "–" + it.max} ${tmp ? "secondi" : "ripetizioni"} pulite.`;
    if (it.warm && !X.risc && i === 0 && !s.done && !k && !tmp) why += `${why ? " " : ""}Prima fai 1 serie leggera: metà del carico, 6–8 ripetizioni.`;
    if (sub) why += `${why ? " " : ""}Al posto di ${esc(short(it.name))}.`;

    const id = window.demoFor ? demoFor(it) : null, nm = esc(short(exName(it)));
    const fig = id ? `<div class="sx-fig" role="img" aria-label="${nm}: come si fa"><img src="${IMG}${encodeURIComponent(id)}/0.jpg" alt="" onerror="this.parentNode.remove()"><img class="b" src="${IMG}${encodeURIComponent(id)}/1.jpg" alt="" onerror="this.remove()"></div>` : "";

    const repLab = k ? "Quante volte" : tmp ? "Secondi" : "Ripetizioni", unitR = k ? " volte" : tmp ? " secondi" : "";
    const stepper = (lab, mid, act, mn, pl2) => `<div class="sx-f"><span class="sx-l">${lab}</span><div class="sx-st"><button data-act="${act}" data-v="-1" aria-label="${mn}">−</button>${mid}<button data-act="${act}" data-v="1" aria-label="${pl2}">+</button></div></div>`;
    const kgIn = `<input id="kg" inputmode="decimal" type="text" autocomplete="off" value="${s.kg == null ? "" : String(s.kg).replace(".", ",")}" placeholder="0" data-act="kgin" aria-label="${unitLab(it)}">`;
    const steppers = `<div class="sx-two${none ? " one" : ""}">${none ? "" : stepper(unitLab(it), kgIn, "kg", "Meno 0,5 chili", "Più 0,5 chili")}${stepper(repLab, `<b aria-live="polite">${s.reps ?? "–"}</b>`, "repsd", tmp ? "Meno 5 secondi" : `Meno 1 ${k ? "volta" : "ripetizione"}`, tmp ? "Più 5 secondi" : `Più 1 ${k ? "volta" : "ripetizione"}`)}</div>`;

    const label = none ? `${s.reps ?? "–"}${unitR}` : `${fmt(s.kg)} kg × ${s.reps ?? "–"}${tmp ? " secondi" : ""}`;
    const main = tmp && !s.done ? `<button class="sx-pri" data-act="sx-tgo">Avvia ${secTxt(+s.reps || 0)}</button>` : `<button class="sx-pri" data-act="done" aria-label="${s.done ? "Correggi" : k ? "Fatto" : "Serie fatta"}: ${label}">${s.done ? "Correggi" : k ? "Fatto" : "Serie fatta"}</button>`; // i numeri sono già nei selettori (scelta Giovanni 30/10)
    const CK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const chips = `<div class="sx-chips" role="group" aria-label="${k ? "Giri" : "Serie"}" style="--n:${Math.min(sets.length, 3)}">${sets.map((x, j) => `<button class="${x.done ? "d" : ""}${x.w || x.dr ? " w" : ""}" data-act="pickset" data-v="${j}" aria-current="${j === i}" aria-label="${cap(setName(sets, x, k))}: ${none ? "" : fmt(x.kg) + " kg per "}${x.reps ?? "–"}${unitR || " ripetizioni"}${x.done ? ", fatta" : ""}">${x.done ? CK : ""}${none ? "" : fmt(x.kg) + " × "}${x.reps ?? "–"}${tmp ? " s" : ""}</button>`).join("")}</div>`;

    /* Togli / Annulla a sinistra, Aggiungi a destra (tavole 85-86); bambino solo Annulla quando serve */
    const prev = i > 0 && !s.done && sets[i - 1].done ? i - 1 : -1;
    const left = s.done ? `<button data-act="sx-annulla" data-v="${i}">Annulla ${setName(sets, s, k)}</button>`
      : prev >= 0 ? `<button data-act="sx-annulla" data-v="${prev}">Annulla ${setName(sets, sets[prev], k)}</button>`
      : !k && sets.length > 1 ? `<button data-act="delset">${cap(s.w ? "togli il riscaldamento" : s.dr ? "togli il calo" : "togli " + setName(sets, s, k))}</button>` : "";
    const box = k ? (left ? `<div class="sx-box one">${left}</div>` : "") : `<div class="sx-box${left ? "" : " one"}">${left}<button data-act="addset">Aggiungi serie</button></div>`;

    const canSwap = S.sample || (window.LIB && it.lib && window.LIB[it.lib]);
    const last = idx === items.length - 1;
    /* testi lunghi (revisione copy 30/10): righe da 2, il passo avanti su tutta la larghezza */
    const btn = [`<button data-act="sheet" data-v="ex">Come si fa</button>`, canSwap ? `<button data-act="alts">${k ? "Più facile" : "Cambia esercizio"}</button>` : "", `<button data-act="exlist">Tutti gli esercizi</button>`, `<button data-act="sx-male">Mi fa male</button>`].filter(Boolean);
    const nxt = last ? `<button data-act="finish">${tv("Concludi la seduta ›", "Concludi l'allenamento ›")}</button>` : `<button data-act="ex-step" data-v="1">Prossimo esercizio ›</button>`;
    if (btn.length % 2) btn.push(nxt);
    const tools = `<div class="sx-tools" style="--n:2">${btn.join("")}</div>${btn.includes(nxt) ? "" : `<div class="sx-tools" style="--n:1">${nxt}</div>`}`;

    const T = tmp && d.tmr && d.tmr.id === it.id && d.tmr.i === i ? d.tmr : null;
    const head = `<div class="sx-top"><button class="sx-out" data-act="sx-esci">‹ Esci</button><span>Esercizio ${idx + 1} di ${items.length}</span></div>
      <div class="sx-hd"><h1>${nm}</h1><p>${setLab} · ${restLab}</p></div>`;
    if (T) { /* tavole 92-93: 3 secondi per mettersi in posizione, poi il tempo scorre */
      const st = tState(T);
      return `<div class="sx sx-run">${head}<section class="sx-sec">${ring(st.txt, st.lab, st.frac, true)}
        <p class="sx-hint">${st.prep ? "Il tempo parte da solo dopo 3 secondi." : "Respira piano, tieni la posizione."}</p>
        ${st.prep ? `<button class="sx-sec2" data-act="sx-tstop">Annulla</button>` : `<button class="sx-pri" data-act="sx-tstop">Ferma qui</button><p class="sx-hint small">Se ti fermi prima, segno i secondi fatti.</p>`}${chips}</section></div>`;
    }
    return `<div class="sx">
      <div class="sx-top"><button class="sx-out" data-act="sx-esci">‹ Esci</button><span>Esercizio ${idx + 1} di ${items.length}</span></div>
      ${allDone ? `<div class="sx-fine"><p><b>Tutte le serie fatte</b>${d.startedAt ? ` in ${Math.max(1, Math.round((Date.now() - d.startedAt) / 60000))} minuti` : ""}</p><button class="sx-pri" data-act="finish">${tv("Concludi la seduta", "Concludi l'allenamento")}</button></div>` : ""}
      <div class="sx-hd"><h1>${nm}</h1><p>${setLab} · ${restLab}</p>${up ? `<span class="sx-up">Carico in aumento: +${fmt(+(pl.kg - (b.kg || 0)).toFixed(2))} kg</span>` : ""}</div>
      ${fig}
      ${why ? `<div class="sx-why"><p>${why}</p></div>` : ""}
      <section class="sx-sec" aria-label="${k ? "Giro" : "Serie"} in corso">${tmp ? ring(mmss(+s.reps || 0), s.done ? "fatti" : "pronto", 1) : ""}${steppers}${main}${chips}${box}</section>
      <section class="sx-sec">${tools}</section>
      ${k ? `<p class="sx-note">Se qualcosa fa male, fermati e chiama l'adulto con te.</p>` : ""}
    </div>`;
  }

  /* ---------- fogli: Esci e Mi fa male (prototipo 27/10) ---------- */
  function esci() { /* tavola 97: la pausa è la scelta principale, concludere resta in fondo */
    const sh = V3.sheet(`<h2 class="v3-sh1">Vuoi fare una pausa?</h2><p class="v3-shp">Quello che hai fatto finora è già salvato sul telefono. Il recupero si ferma.</p>
      <div class="sx-shb"><button class="v3-apri wide" data-v3act="pausa">Metti in pausa</button><button class="v3-b2" data-v3act="close">${tv("Continua la seduta", "Continua l'allenamento")}</button><button class="sx-ghost" data-v3act="fine">${tv("Ho finito: concludi la seduta", "Ho finito: concludi l'allenamento")}</button></div>`, { on: {
      fine() { sh.close(); setTimeout(() => { S.fat = null; S.pain = !!draft(activeDay()).male; S.confirmDiscard = false; openSheet("finish"); }, 60); },
      pausa() { sh.close(); const d = draft(activeDay()); delete d.tmr; stopRest(d); saveDrafts(); setTimeout(() => { V3.go("oggi"); toast(tv("Seduta in pausa", "Allenamento in pausa"), { sub: "La riprendi da Palestra" }); }, 60); }
    } });
  }
  function male() {
    const a = activeDay(), d = draft(a), items = P[a].items, it = items.find(x => x.id === d.cur.id), k = kid();
    const canSwap = S.sample || (window.LIB && it.lib && window.LIB[it.lib]);
    d.male = true; saveDrafts(); // a fine seduta «dolore» è già segnato: niente proposta di aumento
    const sh = V3.sheet(`<h2 class="v3-sh1">${k ? "Fermati e chiama l'adulto che è con te." : "Se hai dolore, fermati."}</h2>
      <p class="v3-shp">Se senti dolore al petto, capogiro o fiato corto, interrompi ${tv("la seduta", "l'allenamento")} e chiama il 112.</p>
      <div class="sx-shb"><button class="v3-apri wide" data-v3act="salta">Salta questo esercizio</button>${canSwap ? `<button class="v3-b2" data-v3act="alt">${k ? "Prova quello più facile" : "Cambia con uno più leggero"}</button>` : ""}<button class="v3-b2" data-v3act="close">Torna all'esercizio</button></div>`, { label: "Mi fa male", on: {
      salta() {
        sh.close();
        const idx = items.indexOf(it), nx = items.slice(idx + 1).concat(items.slice(0, idx)).find(x => d.sets[x.id].some(y => !y.done));
        if (!nx) { toast("Non restano esercizi da fare", { sub: tv("Concludi la seduta", "Concludi l'allenamento") }); return; }
        const j = d.sets[nx.id].findIndex(y => !y.done); d.cur = { id: nx.id, i: j >= 0 ? j : 0 }; saveDrafts(); render(); window.scrollTo(0, 0);
        toast("Esercizio saltato", { sub: short(exName(it)) });
      },
      alt() { sh.close(); setTimeout(() => document.dispatchEvent(new CustomEvent("sx-alts")), 60); }
    } });
  }

  /* ---------- tavole 95-96: «Come si fa» in 3 passi semplici. Le frasi tecniche della scheda passano da un piccolo dizionario ---------- */
  const PLAIN = [
    [/negativa (lenta|controllata)/i, "Torna indietro piano, in 2-3 secondi"],
    [/spinta (decisa|esplosiva|veloce)/i, "Spingi deciso"],
    [/\bROM\b[^,.;]*/i, "Fai sempre tutto il movimento"],
    [/scapole (addotte|indietro)[^,.;]*/i, "Spalle indietro e in basso"],
    [/[^,.;]*cedimento[^,.;]*/i, "Fermati quando il movimento non è più pulito"],
    [/(core|addome) (attivo|contratto)/i, "Pancia stretta"],
    [/fase eccentrica[^,.;]*/i, "Scendi piano"],
    [/fase concentrica[^,.;]*/i, "Sali deciso"]
  ];
  const KIDS = ["Muoviti piano e guarda la foto", "Respira: fuori quando fai fatica, dentro quando torni", "Se il movimento non viene bene, fermati"];
  const GEN = ["Scendi in 2-3 secondi, risali deciso", "Espira mentre spingi o tiri, inspira nel ritorno", "Stesso movimento in ogni ripetizione"];
  function plainSteps(it) {
    const sub = curSub(it), raw = [sub && sub.cue, it.tech].filter(Boolean).join(". ");
    const out = [];
    raw.split(/[.;]\s*|,\s+/).map(x => x.trim()).filter(x => x.length > 3).forEach(x => {
      const r = PLAIN.find(([re]) => re.test(x)); const t = r ? r[1] : x; const c = t.charAt(0).toUpperCase() + t.slice(1);
      if (!out.includes(c)) out.push(c);
    });
    for (const g of kid() ? KIDS : GEN) { if (out.length >= 3) break; if (!out.includes(g)) out.push(g); }
    return (kid() ? out.filter(x => !/\d|kg|%/.test(x)).concat(KIDS) : out).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  }
  const avoid = it => { const n = String(it.note || "").trim(); return /^(evita|non )/i.test(n) ? n.replace(/\.$/, "") : ""; };
  function comeHtml() {
    const a = activeDay(), d = draft(a), it = P[a].items.find(x => x.id === d.cur.id), k = kid(), id = window.demoFor ? demoFor(it) : null;
    const canSwap = S.sample || (window.LIB && it.lib && window.LIB[it.lib]), av = avoid(it);
    return `<h2 class="sx-c-h">${esc(short(exName(it)))}</h2>
      ${id ? `<img class="sx-c-img" src="${IMG}${encodeURIComponent(id)}/0.jpg" alt="${esc(short(exName(it)))}: posizione di partenza" onerror="this.remove()">` : ""}
      ${it.nota ? `<div class="alert">${esc(it.nota)}</div>` : ""}
      <h3 class="sx-c-l">Come si fa</h3><ol class="sx-c-steps">${plainSteps(it).map((t, i) => `<li><span aria-hidden="true">${i + 1}</span><span>${esc(t)}.</span></li>`).join("")}</ol>
      ${av && !k ? `<div class="sx-why"><p><b>Da evitare:</b> ${esc(av.charAt(0).toLowerCase() + av.slice(1))}.</p></div>` : ""}
      ${k ? `<p class="sx-c-p">Se senti male, fermati e chiama l'adulto con te.</p>${canSwap ? `<button class="sx-sec2" data-act="alts">Prova quello più facile</button>` : ""}`
        : `${canSwap || window.PalSchema ? `<h3 class="sx-c-l">Altro</h3>` : ""}${canSwap ? `<button class="sx-sec2" data-act="alts">Cambia esercizio</button>` : ""}${window.PalSchema && it.unit !== "none" ? `<button class="sx-sec2" data-act="sch-oggi">Cambia lo schema solo per oggi</button>` : ""}`}
      <button class="sx-ghost" data-act="close">Chiudi</button>`;
  }
  const rs0 = window.renderSheet;
  window.renderSheet = function () {
    if (S.sheet === "saved" && S.sxNext) { const r = rs0.apply(this, arguments), sh = document.querySelector("#overlay .sheet"), b = sh && sh.querySelector('[data-act="upsave"], [data-act="close"].primary'); if (b) b.insertAdjacentHTML("beforebegin", `<div class="sx-nextw"><h3 class="sx-c-l">${S.ups ? "Gli altri esercizi" : "La prossima volta"}</h3>${S.sxNext}</div>`); return r; }
    if (S.sheet !== "saved") S.sxNext = null;
    if (S.sheet !== "ex" || !activeDay()) return rs0.apply(this, arguments);
    $("#overlay").innerHTML = `<div class="scrim" data-act="close"><div class="sheet sx-c" role="dialog" aria-modal="true" aria-label="Come si fa"><div class="grab"></div>${comeHtml()}</div></div>`;
  };

  /* ---------- tavola 98: seduta salvata = 3 numeri + «La prossima volta» esercizio per esercizio ---------- */
  const fin1 = window.finish;
  window.finish = async function (meta) {
    const day = activeDay(), items = day ? P[day].items.slice() : [], before = S.sessions.length, k = kid();
    await fin1.apply(this, arguments);
    if (S.sessions.length <= before || !S.savedHtml) return;
    const s = S.sessions[S.sessions.length - 1], old = S.savedHtml;
    const rec = (old.match(/<div class="card lime"><b>Nuovi record<\/b>[\s\S]*?<\/ul><\/div>/) || [""])[0];
    const sec = s.durata ? s.durata * 60 : s.tempi ? s.tempi.total : 0, mins = Math.max(1, Math.round(sec / 60));
    const nSets = s.items.reduce((m, e) => m + e.sets.length, 0), kg = s.items.reduce((m, e) => m + e.sets.reduce((a2, x) => a2 + (+x.kg || 0) * (+x.reps || 0), 0), 0);
    const tile = (n, u, l) => `<div class="sx-sum-t"><b>${n}${u ? `<small> ${u}</small>` : ""}</b><span>${l}</span></div>`;
    const tiles = [sec ? tile(mins, "min", "Durata") : "", tile(nSets, "", k ? "Giri" : "Serie"), k || !kg ? tile(s.items.length, "", "Esercizi") : tile(kg >= 1000 ? fmt(Math.round(kg / 100) / 10) : fmt(Math.round(kg)), kg >= 1000 ? "t" : "kg", "Sollevati")].filter(Boolean);
    const upNames = new Set(((S.ups && S.ups.list) || []).map(x => x.key));
    const next = s.items.filter(e => !e.cardio && e.sets.length).map(e => {
      const it = items.find(x => x.id === e.id); if (!it) return "";
      const key = exKey(it); if (upNames.has(key)) return ""; // la proposta di aumento ha già la sua riga sotto
      const st = S.state.ex[key] || {}, last = (st.lastSets || []).map(Number), kgN = st.kg, tmp = it.misura === "tempo";
      const tgt = last.length ? Math.min(it.max, Math.min(...last) + (tmp ? 5 : 1)) : it.min;
      const txt = k ? `Prova ${tgt} ${tmp ? "secondi" : "volte"}` : st.closedLast === localISO() && kgN != null && it.unit !== "none" ? `Tutte le serie al massimo: alla prossima seduta chiusa puoi salire` : `${kgN != null && it.unit !== "none" ? fmt(kgN) + " kg: " : ""}punta a ${tgt} ${tmp ? "secondi" : "ripetizioni"}`;
      return `<li><b>${esc(short(e.name))}</b><span>${esc(txt)}</span></li>`;
    }).filter(Boolean);
    const dd = new Date(s.date), DOWS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
    S.savedHtml = `<h2 class="sx-c-h">${allenW() ? `Allenamento ${s.day} salvato` : `Seduta ${s.day} salvata`} ✓</h2>
      <p class="sx-c-p">${DOWS[dd.getDay()].replace(/^./, c => c.toUpperCase())} ${dd.getDate()} ${dd.toLocaleDateString("it-IT", { month: "long" })} · prossima: ${allenW() ? "allenamento" : "seduta"} ${nextDay()}.</p>
      <div class="sx-sum" style="--n:${tiles.length}">${tiles.join("")}</div>${rec}`;
    S.sxNext = next.length ? `<ul class="sx-next">${next.join("")}</ul>` : ""; // va sotto la proposta di aumento
    if (S.sheet === "saved") renderSheet();
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b || !activeDay()) return;
    const act = b.dataset.act;
    if (act === "sx-esci") { e.stopPropagation(); esci(); }
    else if (act === "sx-male") { e.stopPropagation(); male(); }
    else if (act === "sx-tgo") {
      e.stopPropagation();
      const d = draft(activeDay()), s = d.sets[d.cur.id][d.cur.i]; if (!s || s.done || !(+s.reps > 0)) return;
      d.tmr = { id: d.cur.id, i: d.cur.i, ph: "prep", t0: Date.now(), dur: +s.reps }; S.timer = null; saveDrafts(); render(); window.scrollTo(0, 0);
    }
    else if (act === "sx-tstop") {
      e.stopPropagation();
      const d = draft(activeDay()), T = d.tmr; if (!T) return;
      if (T.ph === "prep") { delete d.tmr; saveDrafts(); render(); return; }
      const el = Math.round((Date.now() - T.t0) / 1000);
      if (el < 1) { delete d.tmr; saveDrafts(); render(); return; }
      tDone(Math.min(el, T.dur), el >= T.dur);
    }
    else if (act === "sx-annulla") {
      e.stopPropagation();
      const d = draft(activeDay()), sets = d.sets[d.cur.id], j = +b.dataset.v, x = sets[j]; if (!x || !x.done) return;
      const n = cap(setName(sets, x, kid()).replace(/^(la|il) /, "")); x.done = false; stopRest(d); // il recupero di una serie annullata non serve d.cur.i = j; saveDrafts(); render();
      toast(`${n} annullat${/^Serie/.test(n) ? "a" : "o"}`, { sub: "Torna da fare", undo: () => { x.done = true; saveDrafts(); render(); } });
    }
  }, true);
  /* «Prova un'alternativa» riusa il pulsante Sostituisci della vista (stessa logica di index.html) */
  document.addEventListener("sx-alts", () => { const b = document.querySelector('.sx [data-act="alts"]'); if (b) b.click(); });

  const css = document.createElement("style");
  css.textContent = `
  body:has(.sx) #top { display: none; } /* «‹ Esci» sostituisce il ritorno a Oggi */
  .sx { display: flex; flex-direction: column; gap: 28px; padding-bottom: 24px; }
  .sx-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .sx-top span { font-size: 16px; color: rgba(255,255,255,.8); font-variant-numeric: tabular-nums; }
  .sx-out { min-height: 48px; padding: 0 18px; border: 0; border-radius: 24px; background: transparent; color: var(--text); box-shadow: inset 0 0 0 2px var(--accent); font-size: 17px; font-weight: 600; }
  .sx-hd { padding-left: 16px; display: flex; flex-direction: column; align-items: flex-start; }
  .sx-hd h1 { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.15; }
  .sx-hd p { margin: 4px 0 0; font-size: 16px; color: rgba(255,255,255,.8); }
  .sx-up { margin-top: 12px; font-size: 14px; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 10px; padding: 3px 8px; }
  .sx-fig { position: relative; height: 168px; border-radius: 24px; overflow: hidden; background: #fff; flex-shrink: 0; }
  .sx-fig img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .sx-fig img.b { animation: sx-ab 2.4s steps(1) infinite; }
  @keyframes sx-ab { 0% { opacity: 0; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .sx-fig img.b { animation: none; opacity: 0; } }
  body.no-anim .sx-fig img.b { animation: none; opacity: 0; }
  .sx-why { border-radius: 18px; background: var(--surface); padding: 16px; }
  .sx-why p { margin: 0; font-size: 16px; line-height: 1.4; }
  .sx-sec { display: flex; flex-direction: column; gap: 12px; }
  .sx-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sx-two.one { grid-template-columns: 1fr; }
  .sx-f { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .sx-l { padding-left: 4px; font-size: 16px; font-weight: 600; color: rgba(255,255,255,.8); }
  .sx-st { display: grid; grid-template-columns: 52px minmax(0, 1fr) 52px; align-items: center; height: 60px; border-radius: 16px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-st button { height: 60px; border: 0; background: transparent; color: var(--accent); font-size: 24px; font-weight: 700; touch-action: manipulation; }
  .sx-st b, .sx-st input { height: 60px; box-sizing: border-box; text-align: center; font-size: 28px; font-weight: 600; line-height: 60px; border: 0; border-left: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-right: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); font-variant-numeric: tabular-nums; color: var(--text); background: transparent; width: 100%; min-width: 0; padding: 0; border-radius: 0; font-family: inherit; }
  .sx-pri { min-height: 48px; width: 100%; border: 0; border-radius: 24px; background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); font-size: 17px; font-weight: 700; }
  .sx-chips { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
  .sx-chips button { min-height: 48px; border: 0; border-radius: 999px; font-size: 16px; font-weight: 600; white-space: nowrap; background: var(--surface); color: rgba(255,255,255,.85); box-shadow: inset 0 0 0 1px var(--raised); display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-variant-numeric: tabular-nums; }
  .sx-chips button.w { box-shadow: inset 0 0 0 1px var(--raised); border: 1px dashed rgba(255,255,255,.35); }
  .sx-chips button.d { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); box-shadow: none; }
  .sx-chips button[aria-current="true"] { background: transparent; color: var(--text); box-shadow: inset 0 0 0 2px var(--text); }
  .sx-box { display: grid; grid-template-columns: 1fr 1fr; min-height: 48px; border-radius: 16px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); overflow: hidden; }
  .sx-box.one { grid-template-columns: 1fr; }
  .sx-box button { border: 0; background: transparent; color: var(--accent); font-size: 17px; font-weight: 700; min-height: 48px; padding: 0 8px; }
  .sx-box button + button { border-left: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-tools { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
  .sx-tools button { min-height: 48px; width: 100%; border: 0; border-radius: 24px; background: transparent; box-shadow: inset 0 0 0 2px var(--accent); color: var(--text); font-size: 17px; font-weight: 600; padding: 0 10px; }
  .sx-ring { position: relative; width: 232px; max-width: 62vw; aspect-ratio: 1; align-self: center; }
  .sx-ring.big { width: 280px; max-width: 74vw; }
  .sx-ring svg { width: 100%; height: 100%; display: block; transform: rotate(-90deg); }
  .sx-ring circle { fill: none; stroke: var(--raised); stroke-width: 12; }
  .sx-ring .arc { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset .25s linear; }
  .sx-ring > div { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .sx-ring b { font-size: 60px; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .sx-ring span { font-size: 15px; color: rgba(255,255,255,.8); }
  @media (prefers-reduced-motion: reduce) { .sx-ring .arc { transition: none; } }
  .sx-run .sx-sec { margin-top: 8px; }
  .sx-hint { margin: 0; text-align: center; font-size: 16px; color: rgba(255,255,255,.8); }
  .sx-hint.small { font-size: 16px; }
  .sx-sec2 { min-height: 48px; width: 100%; border: 0; border-radius: 24px; background: transparent; box-shadow: inset 0 0 0 2px var(--accent); color: var(--text); font-size: 15px; font-weight: 600; }
  .sx-ghost { min-height: 48px; width: 100%; border: 0; background: transparent; color: rgba(255,255,255,.8); font-size: 16px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
  .sx-c, .sheet:has(.sx-sum) { display: flex; flex-direction: column; gap: 16px; }
  .sx-c > *, .sheet:has(.sx-sum) > * { flex-shrink: 0; } /* il foglio scorre, i blocchi non si schiacciano */
  .sx-c-h { margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2; }
  .sx-c-img { width: 100%; height: 180px; object-fit: cover; border-radius: 20px; display: block; background: #fff; }
  .sx-c-l { margin: 4px 0 0; padding-left: 4px; font-size: 15px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .sx-c-p { margin: 0; font-size: 17px; line-height: 1.45; color: rgba(255,255,255,.85); }
  .sx-c-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .sx-c-steps li { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; font-size: 17px; line-height: 1.45; }
  .sx-c-steps li > span:first-child { width: 32px; height: 32px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent); font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .sx-sum { border-radius: 24px; padding: 14px; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-sum-t { border-radius: 16px; background: var(--surface); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sx-sum-t b { font-size: 26px; font-variant-numeric: tabular-nums; }
  .sx-sum-t small { font-size: 16px; font-weight: 600; color: rgba(255,255,255,.8); }
  .sx-sum-t span { font-size: 15px; color: rgba(255,255,255,.8); }
  .sx-next { margin: 0; padding: 0; list-style: none; }
  .sx-next li { display: flex; flex-direction: column; gap: 2px; padding: 12px 0; border-top: 1px solid var(--raised); }
  .sx-next b { font-size: 17px; } .sx-next span { font-size: 16px; color: rgba(255,255,255,.85); }
  .sx-note { margin: 0; padding-left: 16px; font-size: 16px; color: rgba(255,255,255,.8); }
  .sx-fine { border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-fine p { margin: 0; font-size: 16px; }
  .sx-shb { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .sx-shb .v3-b2 { width: 100%; }
  `;
  document.head.appendChild(css);
})();
