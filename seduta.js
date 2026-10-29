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
    if (it.warm && !X.risc && i === 0 && !s.done && !k) why += `${why ? " " : ""}Prima fai 1 serie leggera: metà del carico, 6–8 ripetizioni.`;
    if (sub) why += `${why ? " " : ""}Al posto di ${esc(short(it.name))}.`;

    const id = window.demoFor ? demoFor(it) : null, nm = esc(short(exName(it)));
    const fig = id ? `<div class="sx-fig" role="img" aria-label="${nm}: come si fa"><img src="${IMG}${encodeURIComponent(id)}/0.jpg" alt="" onerror="this.parentNode.remove()"><img class="b" src="${IMG}${encodeURIComponent(id)}/1.jpg" alt="" onerror="this.remove()"></div>` : "";

    const repLab = k ? "Quante volte" : tmp ? "Secondi" : "Ripetizioni", unitR = k ? " volte" : tmp ? " secondi" : "";
    const stepper = (lab, mid, act, mn, pl2) => `<div class="sx-f"><span class="sx-l">${lab}</span><div class="sx-st"><button data-act="${act}" data-v="-1" aria-label="${mn}">−</button>${mid}<button data-act="${act}" data-v="1" aria-label="${pl2}">+</button></div></div>`;
    const kgIn = `<input id="kg" inputmode="decimal" type="text" autocomplete="off" value="${s.kg == null ? "" : String(s.kg).replace(".", ",")}" placeholder="0" data-act="kgin" aria-label="${unitLab(it)}">`;
    const steppers = `<div class="sx-two${none ? " one" : ""}">${none ? "" : stepper(unitLab(it), kgIn, "kg", "Meno 0,5 chili", "Più 0,5 chili")}${stepper(repLab, `<b aria-live="polite">${s.reps ?? "–"}</b>`, "repsd", tmp ? "Meno 5 secondi" : `Meno 1 ${k ? "volta" : "ripetizione"}`, tmp ? "Più 5 secondi" : `Più 1 ${k ? "volta" : "ripetizione"}`)}</div>`;

    const label = none ? `${s.reps ?? "–"}${unitR}` : `${fmt(s.kg)} kg × ${s.reps ?? "–"}${tmp ? " secondi" : ""}`;
    const main = `<button class="sx-pri" data-act="done" aria-label="${s.done ? "Correggi" : k ? "Fatto" : "Serie fatta"}: ${label}">${s.done ? "Correggi" : k ? "Fatto" : "Serie fatta"}</button>`; // i numeri sono già nei selettori (scelta Giovanni 30/10)
    const CK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const chips = `<div class="sx-chips" role="group" aria-label="${k ? "Giri" : "Serie"}" style="--n:${Math.min(sets.length, 3)}">${sets.map((x, j) => `<button class="${x.done ? "d" : ""}${x.w || x.dr ? " w" : ""}" data-act="pickset" data-v="${j}" aria-current="${j === i}" aria-label="${cap(setName(sets, x, k))}: ${none ? "" : fmt(x.kg) + " kg per "}${x.reps ?? "–"}${unitR || " ripetizioni"}${x.done ? ", fatta" : ""}">${x.done ? CK : ""}${none ? "" : fmt(x.kg) + " × "}${x.reps ?? "–"}</button>`).join("")}</div>`;

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

    return `<div class="sx">
      <div class="sx-top"><button class="sx-out" data-act="sx-esci">‹ Esci</button><span>Esercizio ${idx + 1} di ${items.length}</span></div>
      ${allDone ? `<div class="sx-fine"><p><b>Tutte le serie fatte</b>${d.startedAt ? ` in ${Math.max(1, Math.round((Date.now() - d.startedAt) / 60000))} minuti` : ""}</p><button class="sx-pri" data-act="finish">${tv("Concludi la seduta", "Concludi l'allenamento")}</button></div>` : ""}
      <div class="sx-hd"><h1>${nm}</h1><p>${setLab} · ${restLab}</p>${up ? `<span class="sx-up">Carico in aumento: +${fmt(+(pl.kg - (b.kg || 0)).toFixed(2))} kg</span>` : ""}</div>
      ${fig}
      ${why ? `<div class="sx-why"><p>${why}</p></div>` : ""}
      <section class="sx-sec" aria-label="${k ? "Giro" : "Serie"} in corso">${steppers}${main}${chips}${box}</section>
      <section class="sx-sec">${tools}</section>
      ${k ? `<p class="sx-note">Se qualcosa fa male, fermati e chiama l'adulto con te.</p>` : ""}
    </div>`;
  }

  /* ---------- fogli: Esci e Mi fa male (prototipo 27/10) ---------- */
  function esci() {
    const sh = V3.sheet(`<h2 class="v3-sh1">Vuoi uscire ${tv("dalla seduta", "dall'allenamento")}?</h2><p class="v3-shp">Quello che hai fatto finora è già salvato sul telefono.</p>
      <div class="sx-shb"><button class="v3-apri wide" data-v3act="fine">${tv("Concludi la seduta", "Concludi l'allenamento")}</button><button class="v3-b2" data-v3act="pausa">Metti in pausa</button><button class="v3-b2" data-v3act="close">${tv("Continua la seduta", "Continua l'allenamento")}</button></div>`, { on: {
      fine() { sh.close(); setTimeout(() => { S.fat = null; S.pain = !!draft(activeDay()).male; S.confirmDiscard = false; openSheet("finish"); }, 60); },
      pausa() { sh.close(); setTimeout(() => { V3.go("oggi"); toast(tv("Seduta in pausa", "Allenamento in pausa"), { sub: "La riprendi da Palestra" }); }, 60); }
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

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b || !activeDay()) return;
    const act = b.dataset.act;
    if (act === "sx-esci") { e.stopPropagation(); esci(); }
    else if (act === "sx-male") { e.stopPropagation(); male(); }
    else if (act === "sx-annulla") {
      e.stopPropagation();
      const d = draft(activeDay()), sets = d.sets[d.cur.id], j = +b.dataset.v, x = sets[j]; if (!x || !x.done) return;
      const n = cap(setName(sets, x, kid()).replace(/^(la|il) /, "")); x.done = false; d.cur.i = j; saveDrafts(); render();
      toast(`${n} annullat${/^Serie/.test(n) ? "a" : "o"}`, { sub: "Puoi rifarla", undo: () => { x.done = true; saveDrafts(); render(); } });
    }
  }, true);
  /* «Prova un'alternativa» riusa il pulsante Sostituisci della vista (stessa logica di index.html) */
  document.addEventListener("sx-alts", () => { const b = document.querySelector('.sx [data-act="alts"]'); if (b) b.click(); });

  const css = document.createElement("style");
  css.textContent = `
  body:has(.sx) #top { display: none; } /* «‹ Esci» sostituisce il ritorno a Oggi */
  .sx { display: flex; flex-direction: column; gap: 28px; padding-bottom: 24px; }
  .sx-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .sx-top span { font-size: 15px; color: rgba(255,255,255,.8); font-variant-numeric: tabular-nums; }
  .sx-out { min-height: 48px; padding: 0 18px; border: 0; border-radius: 24px; background: transparent; color: var(--text); box-shadow: inset 0 0 0 2px var(--accent); font-size: 15px; font-weight: 600; }
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
  .sx-l { padding-left: 4px; font-size: 15px; font-weight: 600; color: rgba(255,255,255,.8); }
  .sx-st { display: grid; grid-template-columns: 52px minmax(0, 1fr) 52px; align-items: center; height: 60px; border-radius: 16px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-st button { height: 60px; border: 0; background: transparent; color: var(--accent); font-size: 24px; font-weight: 700; touch-action: manipulation; }
  .sx-st b, .sx-st input { height: 60px; box-sizing: border-box; text-align: center; font-size: 28px; font-weight: 600; line-height: 60px; border: 0; border-left: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-right: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); font-variant-numeric: tabular-nums; color: var(--text); background: transparent; width: 100%; min-width: 0; padding: 0; border-radius: 0; font-family: inherit; }
  .sx-pri { min-height: 48px; width: 100%; border: 0; border-radius: 24px; background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); font-size: 15px; font-weight: 700; }
  .sx-chips { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
  .sx-chips button { min-height: 44px; border: 0; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap; background: var(--surface); color: rgba(255,255,255,.8); box-shadow: inset 0 0 0 1px var(--raised); display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-variant-numeric: tabular-nums; }
  .sx-chips button.w { box-shadow: inset 0 0 0 1px var(--raised); border: 1px dashed rgba(255,255,255,.35); }
  .sx-chips button.d { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); box-shadow: none; }
  .sx-chips button[aria-current="true"] { background: transparent; color: var(--text); box-shadow: inset 0 0 0 2px var(--text); }
  .sx-box { display: grid; grid-template-columns: 1fr 1fr; min-height: 48px; border-radius: 16px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); overflow: hidden; }
  .sx-box.one { grid-template-columns: 1fr; }
  .sx-box button { border: 0; background: transparent; color: var(--accent); font-size: 15px; font-weight: 700; min-height: 48px; padding: 0 8px; }
  .sx-box button + button { border-left: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-tools { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
  .sx-tools button { min-height: 48px; width: 100%; border: 0; border-radius: 24px; background: transparent; box-shadow: inset 0 0 0 2px var(--accent); color: var(--text); font-size: 15px; font-weight: 600; padding: 0 10px; }
  .sx-note { margin: 0; padding-left: 16px; font-size: 16px; color: rgba(255,255,255,.8); }
  .sx-fine { border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .sx-fine p { margin: 0; font-size: 16px; }
  .sx-shb { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .sx-shb .v3-b2 { width: 100%; }
  `;
  document.head.appendChild(css);
})();
