"use strict";
/* Impostazioni (gear): profile, coach, AI, data, info. Piano keeps only training, diet and foods (IA review).
   Rules move to Allenamento, CSV export only here, backup reminder from Leo. Loaded after coachui.js, before gesture.js. */
(function () {
  const BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>';
  function view() {
    if (S.settings === "coach") return coachSettingsView().replace(/<button class="back" data-act="hub" data-v="">[\s\S]*?<\/button>/, `<button class="back" data-act="set-sub" data-v="main">${BACK}Impostazioni</button>`);
    return `<button class="back" data-act="set-close">${BACK}Chiudi</button><h1><span class="hl">Impostazioni</span></h1>
      <p class="muted" style="margin-top:4px">Profilo, coach, intelligenza artificiale e dati. Si regolano una volta, poi pensano a tutto da sole.</p>
      <h2 class="set-h">Tu e il coach</h2>${window.coachCard ? coachCard() : ""}${settingsBlocks()}`;
  }
  const r0 = window.render;
  window.render = function () { r0(); if (S.settings && S.profile && !S.ob) { const v = $("#view"); if (v) v.innerHTML = view(); } };

  // rules belong to training; CSV export lives only in Impostazioni
  const vA = window.viewAllenamento;
  window.viewAllenamento = function () { const h = vA(); return activeDay() || S.detail ? h : h + (window.rulesBlock ? rulesBlock() : ""); };
  const vP = window.viewProgress;
  window.viewProgress = function () { return vP().replace(/<button[^>]*data-act="export"[^>]*>[\s\S]*?<\/button>/g, ""); };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act], .gear"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (b.classList.contains("gear")) { e.preventDefault(); e.stopPropagation(); S.settings = S.settings ? null : "main"; S.macro = null; S.boardEdit = false; window.scrollTo(0, 0); render(); return; }
    if (act === "tab" || act === "redo") S.settings = null;
    if (act === "set-close") { e.stopPropagation(); S.settings = null; window.scrollTo(0, 0); render(); }
    else if (act === "set-sub") { e.stopPropagation(); S.settings = v === "coach" ? "coach" : "main"; window.scrollTo(0, 0); render(); }
    else if (act === "backup") lsSet("backup_at", Date.now());
  }, true);

  // Leo reminds the backup after 7 days of use, then monthly (data live only on this phone)
  setTimeout(() => {
    if (!S.site || !S.profile || !window.coachNudge) return;
    const first = lsGet("first_use", 0) || (lsSet("first_use", Date.now()), Date.now()), last = lsGet("backup_at", 0), asked = lsGet("backup_nudge", 0), DAY = 864e5;
    if (Date.now() - first < 7 * DAY || Date.now() - last < 30 * DAY || Date.now() - asked < 30 * DAY) return;
    lsSet("backup_nudge", Date.now());
    coachNudge("I tuoi dati sono solo su questo telefono. Ogni tanto salvane una copia: Impostazioni › I tuoi dati › Salva una copia dei dati. Ci vogliono 10 secondi.");
  }, 1500);

  const st = document.createElement("style");
  st.textContent = `.set-h { margin: 22px 0 0; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }`;
  document.head.appendChild(st);
})();
