"use strict";
/* Tutorial (team design): a 5-step tour on the real elements offered once by Leo, first-use hints for hidden gestures,
   and a «Come funziona» page in Impostazioni. No forced modal: «Salta» always visible. Loaded after settings.js. */
(function () {
  const STEPS = [
    [".now", "Adesso", "Qui trovi sempre la prossima cosa da fare. Tocca «L'ho mangiato» o «Inizia» e il resto si aggiorna da solo."],
    [".mgrid .bx", "Oggi è tuo", "Tieni premuto un box per spostarlo o nasconderlo. Con il «+» in fondo aggiungi sezioni."],
    ['.tabs [data-v="allenamento"]', "Allenamento", "Scegli la seduta e ti guido un esercizio alla volta. Attrezzo occupato? Tocca «Sostituisci»."],
    ['.tabs [data-v="progressi"], .tabs [data-v="piano"]', "Progressi e Piano", "In Progressi vedi carichi, peso e foto nel tempo. In Piano trovi scheda, dieta e i tuoi alimenti."],
    [".coach-fab", "Leo", "Io sono sempre qui in basso. Chiedimi qualsiasi cosa, anche a metà allenamento. Le impostazioni sono nell'ingranaggio in alto."]
  ];
  const layer = document.createElement("div"); layer.className = "tour"; layer.hidden = true; document.body.appendChild(layer);
  let step = -1;
  const rectOf = sel => { const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null || e.classList.contains("coach-fab")); if (!els.length) return null;
    const rs = els.map(e => e.getBoundingClientRect()); return { x: Math.min(...rs.map(r => r.left)), y: Math.min(...rs.map(r => r.top)), r: Math.max(...rs.map(r => r.right)), b: Math.max(...rs.map(r => r.bottom)), el: els[0] }; };
  function show() {
    if (step < 0 || step >= STEPS.length) return end();
    const [sel, title, text] = STEPS[step], first = document.querySelector(sel.split(",")[0]);
    if (first && !first.closest(".tabs") && !first.classList.contains("coach-fab")) first.scrollIntoView({ block: "center" });
    setTimeout(() => {
      const r = rectOf(sel); const pad = 8;
      const hole = r ? `<div class="t-hole" style="left:${r.x - pad}px;top:${r.y - pad}px;width:${r.r - r.x + 2 * pad}px;height:${r.b - r.y + 2 * pad}px"></div>` : `<div class="t-dim"></div>`;
      const below = r && r.b + 200 < innerHeight;
      const pos = !r ? "top:30%" : below ? `top:${r.b + 16}px` : `bottom:${innerHeight - r.y + 16}px`;
      layer.innerHTML = hole + `<div class="t-bub" role="dialog" aria-modal="false" aria-label="${title}" style="${pos}"><div class="t-h">${window.coachAvatar ? coachAvatar(30) : ""}<b>${title}</b><span class="small muted">${step + 1} di ${STEPS.length}</span></div><p>${text}</p>
        <div class="t-acts"><button class="link small" data-tour="skip">Salta</button><button class="primary sm" data-tour="next">${step === STEPS.length - 1 ? "Fatto" : "Avanti"}</button></div></div>`;
      layer.hidden = false; layer.querySelector('[data-tour="next"]').focus();
    }, 260);
  }
  function start() { lsSet("tour_seen", true); S.tab = "oggi"; S.macro = null; S.settings = null; S.sheet = null; render(); step = 0; show(); }
  function end() { step = -1; layer.hidden = true; layer.innerHTML = ""; lsSet("tour_seen", true); }
  window.startTour = start;
  layer.addEventListener("click", e => { const b = e.target.closest("[data-tour]"); if (!b) { if (e.target === layer || e.target.classList.contains("t-hole") || e.target.classList.contains("t-dim")) end(); return; }
    const a = b.dataset.tour; if (a === "skip") end(); else if (a === "next") { step++; show(); } else if (a === "go") { offerOff(); start(); } else if (a === "later") { offerOff(); lsSet("tour_seen", true); } });
  document.addEventListener("keydown", e => { if (step >= 0 && e.key === "Escape") end(); });

  // the offer: once, on Oggi, after the greeting
  const offerOff = () => { layer.hidden = true; layer.innerHTML = ""; };
  function offer() {
    if (lsGet("tour_seen", false) || !S.profile || S.ob || S.tab !== "oggi" || S.sheet || document.querySelector(".hello")) return;
    layer.innerHTML = `<div class="t-dim"></div><div class="t-bub" role="dialog" aria-label="Tutorial" style="top:30%"><div class="t-h">${window.coachAvatar ? coachAvatar(36) : ""}<b>Ti faccio vedere come funziona?</b></div><p>Ci vogliono 30 secondi. Puoi rivederlo quando vuoi da Impostazioni › Come funziona.</p>
      <div class="t-acts"><button class="link small" data-tour="later">Dopo</button><button class="primary sm" data-tour="go">Sì, mostrami</button></div></div>`;
    layer.hidden = false;
  }
  setTimeout(function wait() { if (document.querySelector(".hello")) return setTimeout(wait, 500); offer(); }, 1200);

  // first-use hints for hidden gestures (one per screen, never during a set: only shown when the screen appears)
  const HINTS = {
    swipe: () => !!document.querySelector(".fnav") && "Scorri di lato per cambiare esercizio.",
    label: () => S.sheet === "food" && "Inquadra la tabella nutrizionale dell'etichetta: i valori li leggo io e li salvo nei tuoi alimenti.",
    drag: () => !!S.sheet && S.sheet !== "food" && document.querySelector(".sheet .grab") && "Trascina in basso per chiudere questa finestra."
  };
  let shown = false;
  function hint() {
    if (shown || step >= 0 || !layer.hidden || !lsGet("tour_seen", false)) return;
    for (const k in HINTS) { if (lsGet("hint_" + k, false)) continue; const t = HINTS[k](); if (!t) continue;
      lsSet("hint_" + k, true); shown = true;
      const h = document.createElement("div"); h.className = "t-tip"; h.setAttribute("role", "status"); h.innerHTML = `${window.coachAvatar ? coachAvatar(24) : ""}<span>${t}</span>`;
      document.body.appendChild(h); const off = () => { h.remove(); shown = false; }; setTimeout(off, 5500); h.addEventListener("click", off); return; }
  }
  const r0 = window.render, s0 = window.renderSheet;
  window.render = function () { r0(); if (S.settings === "main") { const v = $("#view"); if (v && !v.querySelector(".how")) v.insertAdjacentHTML("beforeend", how()); } setTimeout(hint, 400); };
  window.renderSheet = function () { s0(); setTimeout(hint, 400); };

  function how() {
    const item = (t, d) => `<li><b>${t}</b><br><span class="muted">${d}</span></li>`;
    return `<div class="block how"><div class="hcard"><h2>Come funziona</h2>
      <ul class="plain how-list">
        ${item("Oggi", "In cima «Adesso» ti dice la prossima cosa da fare. Sotto i tuoi numeri e le sezioni: tieni premuto per spostarle o nasconderle, «+» per aggiungerle.")}
        ${item("Allenamento", "Scegli la seduta e segui un esercizio alla volta. Scorri di lato per cambiare esercizio, «Sostituisci» se l'attrezzo è occupato. Se salti un giorno, sposti le sedute della settimana.")}
        ${item("Alimentazione", "Spunta i pasti del piano o scrivi cosa hai mangiato. Fotografa le etichette dei cibi che mangi spesso: poi li riconosco quando li scrivi.")}
        ${item("Progressi", "Carichi, calorie, peso e foto nel tempo. In Foto trovi «Il tuo percorso»: ogni 4 settimane confronto le tue foto.")}
        ${item("Piano", "La scheda e il piano alimentare che segui: li guardi, li modifichi o ne carichi di nuovi.")}
        ${item("Leo", "Il pulsante in basso a destra: chiedimi qualsiasi cosa. Come ti parlo lo scegli qui sopra, in «Il tuo coach».")}
        ${item("Gesti", "Scorri dal bordo sinistro per tornare indietro. Trascina in basso una finestra per chiuderla.")}
        ${item("I tuoi dati", "Restano solo su questo telefono. Salva ogni tanto una copia: è qui sopra, in «I tuoi dati».")}
      </ul><button class="primary go" data-act="tour-again">Rivedi il tour</button></div></div>`;
  }
  document.addEventListener("click", e => { if (e.target.closest('[data-act="tour-again"]')) { e.stopPropagation(); start(); } }, true);

  const st = document.createElement("style");
  st.textContent = `
  .tour { position: fixed; inset: 0; z-index: 60; }
  .t-dim { position: absolute; inset: 0; background: rgba(0,0,0,.72); }
  .t-hole { position: absolute; border-radius: 22px; box-shadow: 0 0 0 9999px rgba(0,0,0,.72), 0 0 0 3px var(--accent); transition: all .25s; pointer-events: none; }
  .t-bub { position: absolute; left: 16px; right: 16px; max-width: 420px; margin: 0 auto; background: var(--surface-2, #1a1a1a); border: 1px solid var(--raised); border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.6); }
  .t-h { display: flex; align-items: center; gap: 10px; } .t-h b { flex: 1; font-size: 17px; }
  .t-bub p { margin: 0; }
  .t-acts { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
  .t-acts .primary { min-height: 44px; padding: 0 22px; width: auto; flex: 0 0 auto; }
  .t-acts .link { min-height: 44px; }
  .t-tip { position: fixed; left: 16px; right: 16px; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); z-index: 40; display: flex; gap: 10px; align-items: center; background: var(--text); color: #000; border-radius: 18px; padding: 10px 14px; font-weight: 500; box-shadow: 0 8px 24px rgba(0,0,0,.5); animation: tipin .25s ease-out; }
  .t-tip svg { flex: none; }
  @keyframes tipin { from { transform: translateY(12px); opacity: 0; } }
  .how-list li { margin-bottom: 12px; }
  @media (prefers-reduced-motion: reduce) { .t-hole { transition: none; } .t-tip { animation: none; } }`;
  document.head.appendChild(st);
})();
