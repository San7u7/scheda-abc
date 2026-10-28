"use strict";
/* Askesis mini design system (visual designer review 26/10). Loaded last: one set of rules over every module.
   3 button levels · 4 text sizes · one spacing scale · one card model · one icon container · lime on one surface per view. */
(function () {
  const st = document.createElement("style");
  st.id = "askesis-ds";
  st.textContent = `
  :root { --t-1: 30px; --t-2: 20px; --t-3: 15px; --t-4: 12px; --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px; --r-card: 24px; --r-in: 12px; }

  /* type: 4 sizes */
  h1 { font-size: var(--t-1); line-height: 1.15; font-weight: 700; letter-spacing: -0.025em; }
  h2, .hcard h2, .card h2, .mb-h b, .dc-title { font-size: var(--t-2); line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; }
  body, p, li, .muted, .mb-s, .dc-sub { font-size: var(--t-3); }
  .small, small, .mb-f, .dc-meta, .stile .lab, .set-h, .now-k, .tm-k { font-size: var(--t-4) !important; }
  .faint { font-size: var(--t-4); }

  /* buttons: 3 levels */
  .primary { min-height: 52px; height: auto; border-radius: 999px; background: var(--accent); color: var(--lime-ink); font-weight: 700; font-size: 16px; }
  .ghost, .ghost.sm, .ghost.dark, .hc-acts .ghost, .row2 .ghost, label.ghost { min-height: 44px; border: 0 !important; border-radius: 999px; background: var(--raised) !important; color: var(--text); font-weight: 600; font-size: var(--t-3); }
  .ghost:active { background: var(--control) !important; }
  .link, .link.small { color: var(--accent); font-weight: 600; font-size: var(--t-3) !important; text-decoration: none; min-height: 44px; }
  .link:active { opacity: .7; }
  /* inside a lime surface the primary turns black, secondary becomes a quiet text button */
  .card.lime .primary, .now .primary, .dslide.next .dc-start { background: #0a0a0a; color: var(--accent); }
  .card.lime .ghost, .now .ghost { background: rgba(0,0,0,.1) !important; color: var(--lime-ink); }
  .card.lime .link, .now .link, .now .now-alt { color: var(--lime-ink); text-decoration: underline; text-underline-offset: 3px; }
  /* the warning action keeps its own colour */
  [data-act="wipe"] { color: var(--warn-ink, #ffb340) !important; }

  /* one card model */
  .card, .hcard, .mbox, .stile, .pcard, .dcard, .mcard { border-radius: var(--r-card); }
  .card, .hcard, .mbox { padding: var(--s-4); gap: var(--s-3); }
  .mbox { border: 0; }
  .block { margin-top: var(--s-6); }
  .block + .block { margin-top: var(--s-3); }
  .set-h + .block, h2.set-h + .block { margin-top: var(--s-3); }

  /* one icon container: soft lime square, lime glyph */
  .hc-ic, .mb-ic, .stile .ic { width: 32px; height: 32px; border-radius: var(--r-in); background: var(--accent-soft); color: var(--accent); }
  .hc-ic svg { width: 18px; height: 18px; stroke: var(--accent); }
  .mb-ic svg, .stile .ic svg { width: 18px; height: 18px; }

  /* lime on one surface per view: quick actions and accents go quiet */
  .mb-quick { background: var(--raised); color: var(--accent); }
  .mb-quick.alt { color: var(--text); }
  .mb-chev { color: var(--muted); }
  .badge-plus { background: var(--raised) !important; color: var(--accent) !important; }
  .bx-add span { color: var(--accent); }
  .now .hl-ink { text-decoration-thickness: 2px; }

  [tabindex="-1"]:focus { outline: none; }
  /* numbers line up */
  .num, .mb-m, .stile b, .tm-ph b, #sb-clock { font-variant-numeric: tabular-nums; }
  .mb-m { font-size: var(--t-1); }
  
  /* 28/10 standard «aggiungi / togli» (Giovanni): un box unico con divisore, come «−15″ | +15″» del recupero */
  .hero .pm, .setx, .v3-pm2, .stepper, .fq { background: color-mix(in srgb, var(--accent) 12%, transparent) !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent) !important; border-radius: 16px !important; overflow: hidden; gap: 0 !important; }
  .hero .pm, .setx, .v3-pm2 { display: grid !important; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); min-height: 48px; }
  .hero .pm button, .setx button, .v3-pm2 button, .stepper button, .fq button { position: relative; background: transparent !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; color: var(--accent) !important; font-weight: 700; min-height: 48px; }
  .hero .pm button + button::before, .setx button + button::before, .v3-pm2 button + button::before, .stepper button:last-child::before, .fq button:last-child::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
  .stepper button:first-child::after, .fq button:first-child::after { content: ""; position: absolute; right: 0; top: 10px; bottom: 10px; width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
  .hero .pm button:active, .setx button:active, .v3-pm2 button:active, .stepper button:active, .fq button:active { background: color-mix(in srgb, var(--accent) 14%, transparent) !important; }
  .setx button, .v3-pm2 button { font-size: 15px; padding: 0 10px; }
  .v3-pm2 { min-height: 56px; } .v3-pm2 button { min-height: 56px; font-family: inherit; }
  .stepper input, .fq .num { color: var(--text); }
  /* chip delle serie su una griglia a colonne uguali, allineati ai box sotto */
  .sets { display: grid !important; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 8px !important; }
  .sets button { justify-content: center; min-height: 44px; padding: 0 6px !important; white-space: nowrap; }

  /* 28/10 (Giovanni): i pulsanti lime pieni diventano lime trasparenti, come i box (fondo lime leggero, bordo e testo lime) */
  .primary, .v3-apri, .v3-lime .v3-in, .sbar .fine, .sbar.tm .fine, .tmm-apri, .dc-go, .bx-fine, .mb-quick {
    background: color-mix(in srgb, var(--accent) 16%, transparent) !important; box-shadow: inset 0 0 0 1.5px var(--accent) !important; color: var(--accent) !important; border: 0 !important; }
  .primary:active, .v3-apri:active, .v3-lime .v3-in:active, .sbar .fine:active, .tmm-apri:active { background: color-mix(in srgb, var(--accent) 28%, transparent) !important; }
  #tm-mini.over .tmm-apri { background: rgba(255,179,64,.16) !important; box-shadow: inset 0 0 0 1.5px #ffb340 !important; color: #ffb340 !important; }
  /* serie: − / + di chili e ripetizioni più piccoli, in proporzione ai numeri */
  .hero .pm { min-height: 40px !important; } .hero .pm button { min-height: 40px !important; height: 40px !important; font-size: 18px !important; }
`;
  document.head.appendChild(st);
  // keep this sheet last even if a module injects styles later
  new MutationObserver(() => { if (document.head.lastElementChild !== st) document.head.appendChild(st); }).observe(document.head, { childList: true });
})();
