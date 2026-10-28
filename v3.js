"use strict";
/* Askesis v3 · guscio comune (FASE 1).
   Barra in basso a 4 voci Oggi · Palestra · Cibo · Progressi + router + foglio dal basso + componenti condivisi + adattatore dati.
   Le sezioni nuove stanno in sec-*.js e si registrano con V3.register(id, {render}). Se una sezione non è registrata
   (o il suo render restituisce false) resta la vista vecchia corrispondente: l'app è sempre usabile.
   Caricato DOPO gesture.js e ds.js. Legge S in sola lettura: unica scrittura additiva = V3.data.saveDayTarget (chiave propria).
   Contratto per chi scrive le sezioni: V3_CONTRATTO.md. */
(function () {
  if (typeof S === "undefined" || typeof render !== "function") return;

  const SECS = [["oggi", "Oggi"], ["palestra", "Palestra"], ["cibo", "Cibo"], ["progressi", "Progressi"]];
  const ICONS = {
    oggi: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    palestra: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
    cibo: '<circle cx="12" cy="13" r="7"/><path d="M12 6c0-2 1-3 3-3"/>',
    progressi: '<path d="M4 18l6-6 4 4 6-8"/><path d="M15 8h5v5"/>'
  };
  const sections = {};

  /* ---------- token e stili (tutto prefissato v3- per non toccare le viste vecchie) ---------- */
  const font = document.createElement("link");
  font.rel = "stylesheet"; font.href = "https://fonts.googleapis.com/css2?family=Inter:wght@700;800&display=swap";
  document.head.appendChild(font);
  const st = document.createElement("style");
  st.id = "v3css";
  st.textContent = `
  :root { --v3-bg: #000; --v3-s1: #111; --v3-s2: #1a1a1a; --v3-s3: #2a2a2a; --v3-lime: var(--accent, #c6f24e); --v3-soft: var(--accent-soft, #222a10); --v3-ink: #0a0a0a;
    --v3-t1: #fff; --v3-t2: rgba(255,255,255,.8); --v3-t3: #b4b4b4; --v3-gap: 28px; --v3-tap: 48px; --v3-bar: calc(62px + max(22px, env(safe-area-inset-bottom, 0px))); --v3-font: "Inter", system-ui, -apple-system, sans-serif; }

  /* vetro (28/10, tela «Effetto vetro e profondità»): solo cornici e riquadro del recupero; fogli pieni con la schermata dietro sfocata */
  :root { --glass-bg: rgba(17,17,17,.72); --glass-blur: blur(18px) saturate(140%); --glass-line: rgba(255,255,255,.08); }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { :root { --glass-bg: rgba(17,17,17,.94); } }
  @media (prefers-reduced-transparency: reduce) { :root { --glass-bg: #111; --glass-blur: none; } }
  body.no-glass { --glass-bg: #111; --glass-blur: none; }
  #v3bar, body.v3-on .sbar { background: var(--glass-bg) !important; -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border-top: 1px solid var(--glass-line); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
  #v3-overlay .v3-scrim, .scrim { background: rgba(0,0,0,.45) !important; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
  body.no-glass #v3-overlay .v3-scrim, body.no-glass .scrim { background: rgba(0,0,0,.72) !important; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .v3-sheet, .sheet { box-shadow: 0 -12px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08); }
  body.no-anim *, body.no-anim *::before, body.no-anim *::after { animation: none !important; transition: none !important; }
  /* barra in basso */
  #v3bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 8; height: var(--v3-bar); background: var(--v3-s1); border-top: 1px solid var(--v3-s2); padding: 8px max(8px, env(safe-area-inset-right, 0px)) max(22px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)); box-sizing: border-box; font-family: var(--v3-font); }
  #v3bar[hidden] { display: none; }
  #v3bar > div { max-width: 560px; margin: 0 auto; height: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  #v3bar button { min-height: var(--v3-tap); border: 0; background: transparent; color: var(--v3-t3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font: 400 14px/1.1 var(--v3-font); padding: 0; position: relative; }
  #v3bar .v3-tip { width: 50px; height: 28px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
  #v3bar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  #v3bar button[aria-current="page"] { color: var(--v3-t1); }
  #v3bar button[aria-current="page"] .v3-tip { background: var(--v3-s3); }
  #v3bar .v3-live { position: absolute; top: 2px; left: calc(50% + 14px); width: 8px; height: 8px; border-radius: 4px; background: var(--v3-lime); }
  body.v3-on #bar .tabs { display: none !important; }
  body.v3-on .sbar { bottom: var(--v3-bar); padding-bottom: 10px; }
  body.v3-on .wrap { padding-bottom: calc(var(--fixb, var(--v3-bar)) + 24px) !important; } /* --fixb: altezza reale di barre e riquadro recupero (timer.js) */
  body.v3-on .wrap .block:has(> .ghost[data-act="finish"]), body.v3-on .wrap .block:has(> .link[data-act="finish"]) { display: none; } /* doppione di «Concludi» nella barra */
  /* body è flex con gap 12: i contenitori vuoti o con figli fissi aggiungevano ~48 px vuoti sopra la barra */
  body.v3-on > #bar, body.v3-on > #overlay:empty, body.v3-on > #hello:empty, #v3-overlay { position: absolute; }
  @media (orientation: landscape) and (max-height: 500px) { /* 28/10 rotazione: barra bassa, icona accanto al nome */
    :root { --v3-bar: calc(52px + max(8px, env(safe-area-inset-bottom, 0px))); }
    #v3bar { padding-top: 4px; padding-bottom: max(8px, env(safe-area-inset-bottom, 0px)); }
    #v3bar button { flex-direction: row; gap: 8px; }
    #v3bar .v3-tip { width: 40px; height: 32px; }
  }
  body.v3-on .coach-fab { bottom: calc(var(--v3-bar) + 14px); }
  body.v3-on .coach-fab.insession { bottom: calc(var(--v3-bar) + 90px); }
  body.v3-on .sticky-cta { bottom: calc(var(--v3-bar) + 8px); }
  body.v3-sec #top, body.v3-sec .coach-fab { display: none !important; }

  /* pagina sezione */
  #view.v3 .v3-sx { overflow-wrap: anywhere; }
  body.v3-on .wrap { min-width: 0; width: 100%; box-sizing: border-box; } #view.v3 { min-width: 0; } /* 28/10: a 320 px niente scorrimento di lato */
  #view.v3 { font-family: var(--v3-font); color: var(--v3-t1); display: flex; flex-direction: column; gap: var(--v3-gap); padding-top: max(56px, calc(env(safe-area-inset-top, 0px) + 16px)); }
  .v3 p, .v3 h1, .v3 h2, .v3 h3 { margin: 0; }
  .v3 button { font-family: var(--v3-font); }
  .v3 :focus-visible, .v3-sheet :focus-visible { outline: 2px solid var(--v3-lime); outline-offset: 2px; }
  .v3-hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .v3-t1 { font-size: 28px; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; }
  .v3-sub { font-size: 16px; color: var(--v3-t2); margin-top: 4px; }
  .v3-gear { width: 48px; height: 48px; flex: none; border-radius: 24px; background: var(--v3-s2); border: 0; color: var(--v3-t3); display: flex; align-items: center; justify-content: center; padding: 0; }
  .v3-sec { display: flex; flex-direction: column; gap: 12px; }
  .v3-lab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .v3-lab-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .v3-row { background: var(--v3-s1); border-radius: 18px; min-height: 72px; padding: 12px 12px 12px 14px; display: flex; align-items: center; gap: 12px; box-sizing: border-box; color: var(--v3-t1); border: 0; width: 100%; text-align: left; }
  .v3-row.on { box-shadow: inset 0 0 0 2px var(--v3-lime); }
  .v3-row[data-v3act] { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .v3-when { width: 40px; flex: none; font-size: 16px; font-variant-numeric: tabular-nums; }
  .v3-rx { flex: 1; min-width: 0; }
  .v3-rt { font-size: 16px; font-weight: 700; }
  .v3-rs { font-size: 16px; color: var(--v3-t2); margin-top: 2px; line-height: 1.35; }
  .v3-val { font-size: 18px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .v3-apri { background: var(--v3-lime); color: var(--v3-ink); font-size: 14px; font-weight: 700; min-height: 48px; padding: 0 18px; border-radius: 24px; display: inline-flex; align-items: center; justify-content: center; border: 0; flex: none; box-sizing: border-box; }
  .v3-apri.wide { width: 100%; font-size: 15px; }
  .v3-b2 { min-height: 48px; width: 100%; border-radius: 24px; border: 2px solid var(--v3-lime); background: transparent; color: var(--v3-t1); font-size: 15px; font-weight: 600; padding: 0 16px; box-sizing: border-box; }
  .v3-back { align-self: flex-start; min-height: 48px; padding: 0 18px; border: 2px solid var(--v3-lime); border-radius: 24px; color: var(--v3-t1); font-size: 15px; font-weight: 600; background: transparent; display: inline-flex; align-items: center; }
  .v3-lime { background: rgba(198,242,78,.12); box-shadow: inset 0 0 0 1px rgba(198,242,78,.45); color: var(--v3-t1); border-radius: 24px; /* 28/10: lime trasparente come il box Tempo totale */ padding: 18px; display: flex; flex-direction: column; gap: 16px; }
  .v3-lime-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .v3-lt { font-size: 17px; font-weight: 700; line-height: 1.3; }
  .v3-lime .v3-in { background: var(--v3-lime); color: var(--v3-ink); min-height: 48px; padding: 0 16px; border-radius: 24px; border: 0; font-size: 14px; font-weight: 600; flex: none; }
  .v3-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .v3-tile { background: rgba(10,10,10,.08); border-radius: 14px; padding: 14px; min-height: 124px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; position: relative; border: 0; color: inherit; text-align: left; }
  .v3-tile[data-v3act]::after { content: "›"; position: absolute; top: 10px; right: 12px; font-size: 22px; font-weight: 700; line-height: 1; }
  .v3-tl { font-size: 16px; font-weight: 600; padding-right: 14px; }
  .v3-num { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .v3-of { font-size: 15px; font-weight: 600; }
  .v3-miss { font-size: 15px; font-weight: 700; line-height: 1.25; }
  .v3-bar { height: 12px; border-radius: 6px; background: var(--v3-s3); overflow: hidden; }
  .v3-bar i { display: block; height: 100%; background: #fff; border-radius: 6px; }
  .v3-lime .v3-bar { background: rgba(255,255,255,.12); }
  .v3-lime .v3-bar i { background: var(--v3-lime); }
  .v3-lime .v3-tile { background: rgba(198,242,78,.08); } .v3-lime .v3-tile[data-v3act]::after { color: var(--v3-lime); } .v3-lime .v3-lt { color: var(--v3-lime); }
  .v3-end { display: flex; gap: 12px; align-items: center; }
  .v3-sap { background: var(--v3-soft); border-radius: 16px; min-height: 72px; padding: 14px 16px; flex: 1; min-width: 0; box-sizing: border-box; border: 0; color: var(--v3-t1); text-align: left; cursor: pointer; }
  .v3-st { display: block; font-size: 17px; font-weight: 700; color: var(--v3-lime); margin-bottom: 4px; }
  .v3-sx { display: block; font-size: 16px; line-height: 1.4; }
  .v3-leo { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 0; background: transparent; border: 0; color: var(--v3-t1); font-size: 15px; font-weight: 700; flex: none; line-height: 1.15; text-align: left; white-space: nowrap; }
  .v3-leo i { width: 48px; height: 48px; border-radius: 24px; background: var(--v3-s3); border: 2px solid var(--v3-lime); color: var(--v3-lime); font-style: normal; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
  .v3-seg { display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; gap: 4px; background: var(--v3-s1); border-radius: 24px; padding: 4px; }
  .v3-sg { min-height: 48px; border-radius: 24px; border: 0; background: transparent; color: var(--v3-t3); font-size: 15px; font-weight: 600; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .v3-sg[aria-pressed="true"] { background: var(--v3-s3); color: var(--v3-t1); }
  .v3-cc { background: var(--v3-s1); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .v3-cc svg { width: 100%; height: auto; display: block; }
  .v3-bn { font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1.1; }
  .v3-bd { font-size: 16px; color: var(--v3-t2); margin-top: 4px !important; }
  .v3-hf { display: flex; align-items: center; gap: 12px; } .v3-hf > div:first-child { flex: 1; min-width: 0; }
  .v3-fig { width: 84px; height: 84px; flex: none; border-radius: 14px; overflow: hidden; background: var(--v3-s2); position: relative; }
  .v3-fig img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .v3-fig span { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; text-align: center; padding: 6px; font-size: 13px; font-weight: 600; color: var(--v3-t2); line-height: 1.2; }
  .v3-fig.noimg img { display: none; } .v3-fig.noimg span { display: flex; }
  .v3-leg { display: flex; gap: 18px; font-size: 14px; color: var(--v3-t2); align-items: center; flex-wrap: wrap; }
  .v3-leg span { display: inline-flex; align-items: center; gap: 6px; }
  .v3-k1 { width: 10px; height: 10px; background: #fff; display: inline-block; } .v3-k2 { width: 10px; height: 10px; background: rgba(255,255,255,.4); display: inline-block; } .v3-k3 { width: 14px; height: 0; border-top: 2px dashed rgba(255,255,255,.6); display: inline-block; }
  .v3-chw { position: relative; }
  .v3-pill { position: absolute; transform: translate(-50%, -100%); background: #fff; color: var(--v3-ink); font-size: 14px; font-weight: 700; padding: 6px 10px; border-radius: 14px; white-space: nowrap; pointer-events: none; z-index: 2; font-variant-numeric: tabular-nums; }
  .v3-o65 .v3-lab, .v3-o65 .v3-sg, .v3-o65 .v3-back, .v3-o65 .v3-b2, .v3-o65 .v3-leg, .v3-o65 .v3-leo, .v3-o65 .v3-apri, .v3-o65 .v3-miss, .v3-o65 .v3-pill { font-size: 16px; }
  .v3-o65 .v3-rt { font-size: 17px; }

  body.v3-nobar #v3bar { display: none; }
  body.v3-on.v3-nobar .sbar { bottom: 0; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
  body.v3-on.v3-nobar .wrap { padding-bottom: calc(var(--fixb, var(--v3-bar)) + 24px) !important; }
  body.v3-on.v3-nobar .coach-fab.insession { bottom: calc(var(--v3-bar) + 6px); }
  .v3-lgb { padding: 4px 0 16px; font-family: var(--v3-font); }

  /* foglio dal basso */
  #v3-overlay .v3-scrim { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 25; display: flex; align-items: flex-end; justify-content: center; font-family: var(--v3-font); color: var(--v3-t1); }
  .v3-sheet { width: 100%; max-width: 560px; background: var(--v3-s1); border-radius: 24px 24px 0 0; padding: 10px max(16px, env(safe-area-inset-right, 0px)) max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px)) max(16px, env(safe-area-inset-left, 0px)); box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; max-height: 88vh; max-height: 88dvh; overflow-y: auto; animation: v3up .22s ease-out; }
  .v3-sheet > * { flex-shrink: 0; margin: 0; }
  .v3-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--v3-s3); align-self: center; }
  .v3-sh1 { font-size: 22px; font-weight: 800; line-height: 1.2; }
  .v3-shp { font-size: 16px; line-height: 1.45; }
  @keyframes v3up { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .v3-sheet { animation: none; } }
  `;
  // ds.js tiene il suo foglio sempre in fondo con un MutationObserver: questo resta subito prima.
  // I selettori v3- non esistono nelle viste vecchie, quindi l'ordine non crea conflitti.
  document.head.appendChild(st);

  /* ---------- utilità ---------- */
  const e = s => (typeof esc === "function" ? esc(s) : String(s ?? ""));
  const r1 = v => Math.round(v * 10) / 10;
  /* 3380 → «3.380», 75.8 → «75,8» (toLocaleString non raggruppa le 4 cifre in italiano) */
  const nf = (v, dec = 1) => { if (v == null || v === "" || isNaN(v)) return "–"; const k = Math.pow(10, dec), n = Math.round(Math.abs(+v) * k) / k, [a, b] = String(n).split(".");
    return (+v < 0 ? "−" : "") + a.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (b ? "," + b : ""); };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const today = () => localISO();
  const isoOf = d => localISO(new Date(d));
  const addD = (iso, n) => addDays(iso, n);
  const mon = d => localISO(mondayOf(d || new Date()));
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const dLab = iso => { const d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MESI[d.getMonth()]; };

  /* ============================== DATI (sola lettura) ============================== */
  const DT_KEY = "v3_daytargets";
  const saved = () => (typeof lsGet === "function" ? lsGet(DT_KEY, {}) : {}) || {};
  const sessOn = iso => S.sessions.filter(s => isoOf(s.date) === iso);
  const hasPlanDiet = () => !!(S.diet && S.diet.fonte === "piano");

  function targetsFor(train) { // stessa formula di nutri.js (dayTargets), ma per un giorno qualsiasi
    const T = planTargets();
    if (hasPlanDiet() || !T.cho) return { kcal: T.kcal, pro: T.pro, cho: T.cho, fat: T.fat };
    const n = Math.max(1, Math.min(6, DAYS.length || 3)), restF = 1 - 0.15 * n / (7 - n), c = Math.round(T.cho * (train ? 1.15 : restF));
    return { kcal: Math.round((T.kcal + (c - T.cho) * 4) / 10) * 10, pro: T.pro, cho: c, fat: T.fat };
  }
  function plannedOn(iso) { // giorno di palestra previsto (solo con «Giorni fissi»)
    if (window.trainFlex && trainFlex()) return false;
    const m = window.weekPlanMap ? weekPlanMap() : {};
    return !!m[new Date(iso + "T12:00:00").getDay()];
  }
  function isTrain(iso) {
    const t = today();
    if (sessOn(iso).length) return true;
    if (iso === t) { if (activeDay()) return true; try { return !!(window.dayTargets && dayTargets().kind.train); } catch (_) { return false; } }
    if (iso > t) return plannedOn(iso);
    return false;
  }
  function eatenOn(iso) { // intake() crea il giorno se manca: lo chiamiamo solo se il giorno esiste già
    if (!S.days[iso]) return { logged: false, kcal: 0, pro: 0, cho: 0, fat: 0 };
    const it = intake(iso);
    return { logged: !!it.logged, kcal: Math.round(it.eaten.kcal), pro: Math.round(it.eaten.p), cho: Math.round(it.eaten.c), fat: Math.round(it.eaten.f) };
  }
  function dayInfo(iso) {
    const t = today(), train = isTrain(iso), sv = saved()[iso], T = sv || (iso === t && window.dayTargets ? (() => { const x = dayTargets(); return { kcal: x.kcal, pro: x.pro, cho: x.cho, fat: x.fat }; })() : targetsFor(train));
    const ea = iso > t ? { logged: false, kcal: 0, pro: 0, cho: 0, fat: 0 } : eatenOn(iso);
    return { iso, dow: new Date(iso + "T12:00:00").getDay(), today: iso === t, future: iso > t, closed: iso < t, train, sessions: sessOn(iso).length,
      logged: ea.logged, kcal: ea.kcal, pro: ea.pro, cho: ea.cho, fat: ea.fat, kcalT: T.kcal, proT: T.pro, choT: T.cho, fatT: T.fat };
  }
  function summarize(days) { // medie solo sui giorni chiusi e registrati
    const pick = f => days.filter(d => d.closed && d.logged && f(d));
    const avg = arr => arr.length ? { n: arr.length, kcal: Math.round(arr.reduce((s, d) => s + d.kcal, 0) / arr.length), kcalT: Math.round(arr.reduce((s, d) => s + d.kcalT, 0) / arr.length),
      pro: Math.round(arr.reduce((s, d) => s + d.pro, 0) / arr.length), proT: Math.round(arr.reduce((s, d) => s + d.proT, 0) / arr.length),
      kcalPct: Math.round(arr.reduce((s, d) => s + d.kcal / d.kcalT, 0) / arr.length * 100), proPct: Math.round(arr.reduce((s, d) => s + d.pro / d.proT, 0) / arr.length * 100) } : { n: 0, kcal: null, kcalT: null, pro: null, proT: null, kcalPct: null, proPct: null };
    return { gym: avg(pick(d => d.train)), rest: avg(pick(d => !d.train)), all: avg(pick(() => true)) };
  }
  function range(from, to) { const out = []; for (let d = from; d <= to; d = addD(d, 1)) out.push(d); return out; }

  const data = {
    profile() {
      const p = S.profile || {}, eta = +p.eta || null;
      const group = eta == null ? "adulto" : eta <= 13 ? "bambino" : eta <= 17 ? "ragazzo" : eta >= 65 ? "over65" : "adulto";
      return { nome: p.nome || "", eta, sesso: p.sesso || null, peso: +p.peso || null, altezza: +p.altezza || null, obiettivo: p.obiettivo || null, livello: p.livello || null,
        group, minor: group === "bambino" || group === "ragazzo", over65: group === "over65", hasTraining: DAYS.length > 0, hasMealPlan: hasMealPlan(), dietFromPlan: hasPlanDiet() };
    },
    targets(train) { return targetsFor(!!train); },
    day: dayInfo,
    week() {
      const from = mon(), to = addD(from, 6), days = range(from, to).map(dayInfo);
      const done = S.sessions.filter(s => { const d = isoOf(s.date); return d >= from && d <= to; }).length;
      return { from, to, sessions: { done, planned: DAYS.length }, days, avg: summarize(days),
        protein: { eaten: days.filter(d => !d.future).reduce((s, d) => s + d.pro, 0), target: days.reduce((s, d) => s + d.proT, 0) } };
    },
    history(kind = "week", n) {
      const t = today(), out = [];
      n = n || (kind === "month" ? 12 : 13);
      for (let i = n - 1; i >= 0; i--) {
        let from, to, label;
        if (kind === "month") { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); from = localISO(d); const e2 = new Date(d); e2.setMonth(e2.getMonth() + 1); e2.setDate(0); to = localISO(e2); label = MESI[d.getMonth()]; }
        else { from = addD(mon(), -7 * i); to = addD(from, 6); label = dLab(from); }
        const days = range(from, to).map(dayInfo), sum = summarize(days), all = days.filter(d => d.closed && d.logged);
        const sessions = S.sessions.filter(s => { const d = isoOf(s.date); return d >= from && d <= to; }).length;
        out.push({ from, to, label, live: from <= t && t <= to, sessions, sessionsT: kind === "month" ? Math.round(DAYS.length * days.length / 7) : DAYS.length, daysLogged: all.length,
          proPct: all.length ? pct(all.reduce((s, d) => s + d.pro, 0), all.reduce((s, d) => s + d.proT, 0)) : null,
          kcalPct: sum.all.kcalPct, kcalGymPct: sum.gym.kcalPct, kcalRestPct: sum.rest.kcalPct });
      }
      return out;
    },
    exercises(n = 13) {
      const weeks = Array.from({ length: n }, (_, i) => addD(mon(), -7 * (n - 1 - i))), h = exHistory(), out = [];
      for (const [name, list] of Object.entries(h)) {
        const per = weeks.map((w, i) => { const end = i < n - 1 ? weeks[i + 1] : addD(w, 7); const xs = list.filter(x => { const d = isoOf(x.date); return d >= w && d < end && x.kg != null; }); return xs.length ? Math.max(...xs.map(x => +x.kg)) : null; });
        const withKg = list.filter(x => x.kg != null), best = withKg.length ? withKg.reduce((a, b) => +b.kg > +a.kg ? b : a) : null, last = list[list.length - 1];
        const it = (typeof ALL !== "undefined" ? ALL : []).find(x => x.name === name);
        out.push({ name, short: typeof short === "function" ? short(name) : name, unit: it ? (it.unit || "kg") : "kg", muscle: it ? it.mus : null, demo: it ? it.demo : null, weeks: per, weekFrom: weeks,
          best: best ? { kg: +best.kg, reps: best.reps, date: isoOf(best.date) } : null, last: last ? { kg: last.kg, reps: last.reps, date: isoOf(last.date) } : null, sessions: list.length });
      }
      return out.sort((a, b) => (b.last ? b.last.date : "").localeCompare(a.last ? a.last.date : ""));
    },
    weight() {
      const w = weights(), avg7 = w.map(x => { const win = w.filter(y => y.date > addD(x.date, -7) && y.date <= x.date); return { date: x.date, kg: r1(win.reduce((s, y) => s + y.kg, 0) / win.length) }; });
      return { entries: w, avg7, last: w[w.length - 1] || null, trend: weightTrend(), goal: (S.profile || {}).obiettivo || null };
    },
    photos() { return (S.photos || []).map(p => ({ date: String(p.date).slice(0, 10), pose: p.pose || null })).sort((a, b) => a.date < b.date ? -1 : 1); },
    nextMeal() {
      const t = today(), dw = new Date().getDay(), v = S.days[t], st = k => v ? mealState({ meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {} }, k) : "open";
      const open = MEALS.filter(([k]) => st(k) === "open" && (!hasMealPlan() || mealOf(dw, k)));
      if (!open.length) return null;
      const [k, label] = open[0], m = mealOf(dw, k), n = nutOf(dw, k);
      return { key: k, label, text: m ? m.t : null, items: m ? m.i || [] : [], kcal: m ? n.kcal : null, pro: m ? n.p : null, left: open.length };
    },
    todaySession() {
      if (!DAYS.length) return { state: "nessuna-scheda" };
      const a = activeDay(), d0 = doneToday();
      let state, day;
      if (a) { state = "in-corso"; day = a; }
      else if (d0) { state = "fatta"; day = d0.day; }
      else { day = nextDay(); state = isTrain(today()) ? "da-fare" : "riposo"; }
      const p = P[day]; if (!p) return { state, day };
      const sets = p.items.reduce((s, it) => s + it.sets, 0), minutes = Math.max(10, Math.round(p.items.reduce((m, it) => m + it.sets * (it.rest + 40), 0) / 300) * 5);
      const dr = S.drafts[day], doneSets = a && dr ? Object.values(dr.sets || {}).flat().filter(x => x.done).length : 0;
      return { state, day, name: p.nome || "Seduta " + day, focus: p.focus || "", exercises: p.items.length, sets, minutes, doneSets, ups: p.items.filter(it => plan(it).up).length, next: d0 ? nextDay() : null };
    },
    today() { return dayInfo(today()); },
    /* unica scrittura, additiva e su chiave propria: fotografa il target del giorno per lo storico */
    saveDayTarget(iso) {
      iso = iso || today(); const x = iso === today() && window.dayTargets ? dayTargets() : targetsFor(isTrain(iso));
      const all = saved(); all[iso] = { kcal: x.kcal, pro: x.pro, cho: x.cho, fat: x.fat, train: isTrain(iso) };
      lsSet(DT_KEY, all); return all[iso];
    }
  };

  /* ============================== COMPONENTI (stringhe HTML) ============================== */
  const A = (act, arg) => act ? ` data-v3act="${e(act)}"${arg != null ? ` data-v3arg="${e(arg)}"` : ""}` : "";
  const GEAR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const dateSub = () => { const d = new Date(), s = GIORNI[d.getDay()] + " " + d.getDate() + " " + d.toLocaleDateString("it-IT", { month: "long" }); return s.charAt(0).toUpperCase() + s.slice(1); };

  const ui = {
    esc: e, nf, pct, dLab, dateSub,
    header: (title, sub) => `<div class="v3-hd"><div><h1 class="v3-t1">${e(title)}</h1><p class="v3-sub">${e(sub == null ? dateSub() : sub)}</p></div><button class="v3-gear" data-act="tab" data-v="piano" aria-label="Impostazioni">${GEAR}</button></div>`,
    label: (text, right) => right ? `<div class="v3-lab-row"><h2 class="v3-lab">${e(text)}</h2>${right}</div>` : `<h2 class="v3-lab">${e(text)}</h2>`,
    section: (label, inner) => `<section class="v3-sec">${label ? ui.label(label) : ""}${inner}</section>`,
    apri: (act, arg, label = "Apri") => `<button class="v3-apri"${A(act, arg)}>${e(label)}</button>`,
    secondary: (label, act, arg) => `<button class="v3-b2"${A(act, arg)}>${e(label)}</button>`,
    back: (label = "Indietro") => `<button class="v3-back" data-v3act="back">‹ ${e(label)}</button>`,
    /* o: {title, sub, when, value, act, arg, apri (etichetta, default «Apri»; false = senza pulsante), on (riga attuale)} */
    row(o) {
      const right = o.value != null ? `<span class="v3-val">${o.value}</span>` : o.act && o.apri !== false ? `<span class="v3-apri" aria-hidden="true">${e(o.apri || "Apri")}</span>` : "";
      const tag = o.act ? "button" : "div";
      return `<${tag} class="v3-row${o.on ? " on" : ""}"${A(o.act, o.arg)}${o.act ? ` aria-label="${e(o.title)}${o.sub ? ": " + e(o.sub) : ""}"` : ""}>${o.when ? `<span class="v3-when">${e(o.when)}</span>` : ""}<span class="v3-rx"><span class="v3-rt" style="display:block">${e(o.title)}</span>${o.sub ? `<span class="v3-rs" style="display:block">${e(o.sub)}</span>` : ""}</span>${right}</${tag}>`;
    },
    /* tile: {label, value, of, unit, pct, miss, act, arg}  →  «3.380 /3.400» */
    tile(t) {
      const tag = t.act ? "button" : "div", w = t.pct != null ? Math.max(0, Math.min(100, t.pct)) : null;
      return `<${tag} class="v3-tile"${A(t.act, t.arg)}><span class="v3-tl">${e(t.label)}</span><span class="v3-num">${typeof t.value === "number" ? nf(t.value) : e(t.value)}${t.of != null ? ` <span class="v3-of">/${typeof t.of === "number" ? nf(t.of) : e(t.of)}${t.unit ? " " + e(t.unit) : ""}</span>` : t.unit ? ` <span class="v3-of">${e(t.unit)}</span>` : ""}</span>${w != null ? `<span class="v3-bar" role="img" aria-label="${w}%"><i style="width:${w}%"></i></span>` : ""}${t.miss ? `<span class="v3-miss">${e(t.miss)}</span>` : ""}</${tag}>`;
    },
    /* o: {title, action: {label, act, arg}, tiles: [tile…] (2×2), html (contenuto extra)} — un solo box lime per vista */
    limeBox: o => `<div class="v3-lime"><div class="v3-lime-h"><p class="v3-lt">${e(o.title)}</p>${o.action ? `<button class="v3-in"${A(o.action.act, o.action.arg)}>${e(o.action.label)}</button>` : ""}</div>${o.tiles ? `<div class="v3-grid">${o.tiles.map(ui.tile).join("")}</div>` : ""}${o.html || ""}</div>`,
    leo: (q, label = "Chiedi a Leo") => q ? `<button class="v3-leo" data-act="ask" data-v="${e(q)}"><i aria-hidden="true">L</i>${e(label)}</button>` : `<button class="v3-leo" data-act="coach-open"><i aria-hidden="true">L</i>${e(label)}</button>`,
    /* «Lo sapevi?» + Leo affiancati, sempre in fondo alla pagina */
    end: (text, o = {}) => `<div class="v3-end"><button class="v3-sap"${A(o.act || "sap", o.arg)}><span class="v3-st">Lo sapevi?</span><span class="v3-sx">${e(text)}&nbsp;›</span></button>${ui.leo(o.leoQ)}</div>`,
    seg: (opts, sel, act, label = "Scegli") => `<div class="v3-seg" role="group" aria-label="${e(label)}">${opts.map((t, i) => `<button class="v3-sg" aria-pressed="${i === sel}"${A(act, i)}>${e(t)}</button>`).join("")}</div>`,
    card: inner => `<div class="v3-cc">${inner}</div>`,
    big: (num, line) => `<div><p class="v3-bn">${num}</p>${line ? `<p class="v3-bd">${e(line)}</p>` : ""}</div>`,
    fig: (src, alt, name) => `<div class="v3-fig"><img src="${e(src)}" alt="${e(alt)}" loading="lazy" onerror="this.parentNode.classList.add('noimg')"><span aria-hidden="true">${e(name || alt)}</span></div>`,
    hf: (left, fig) => `<div class="v3-hf">${left}${fig}</div>`,
    legend: items => `<p class="v3-leg">${items.map(([k, t]) => `<span><i class="v3-${k}"></i>${e(t)}</span>`).join("")}</p>`,
    chart: {}
  };

  /* ---------- grafici (dal prototipo Progressi v3.3: un solo asse Y, bianco = adesso, bianco .4 = prima) ---------- */
  const big = () => !!(ui.chart.o65 != null ? ui.chart.o65 : data.profile().over65);
  const F = 'font-family="Inter,sans-serif"', FS = () => big() ? 16 : 13, CT = () => big() ? "#fff" : "rgba(255,255,255,.7)", r = r1;
  const txt = (fs, items, fill, w) => `<g ${F} font-size="${fs}" fill="${fill || CT()}"${w ? ` font-weight="${w}"` : ""}>${items.map(([x, y, t, a]) => `<text x="${r(x)}" y="${r(y)}"${a ? ` text-anchor="${a}"` : ""}>${e(t)}</text>`).join("")}</g>`;
  const tw = (t, fs) => String(t).length * fs * .78;
  const vlab = (x, y, t, fs, xmin, xmax) => { const h = tw(t, fs) / 2; return [Math.max(xmin + h, Math.min(xmax - h, x)), y, t, "middle"]; };
  const grid = (x0, lines) => lines.map(([y, d, b]) => `<line x1="${x0}" y1="${r(y)}" x2="326" y2="${r(y)}" stroke="${d ? "rgba(255,255,255,.55)" : "#2b2b2b"}"${d ? ' stroke-dasharray="4 4"' : ""}${b ? ' stroke-width="2"' : ""}></line>`).join("");
  const hit = (x, y, w, h, tip, ty, tx) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="transparent" data-tip="${e(tip)}" data-ty="${r(ty)}" data-tx="${r(tx)}"></rect>`;
  const nfx = v => nf(v);
  const DEF = { fmt: nfx, tip: i => String(i), aria: "Grafico" };

  /* barre: vals, max, ticks [[v, etichetta, tratteggio]], xl [[i, testo]], live (ultima = in corso, default true), all (numero su ogni barra), fmt, tip(i), aria, h */
  ui.chart.bars = function (o) {
    o = { ...DEF, ...o };
    const fs = FS(), bg = fs > 13, n = o.vals.length, x0 = bg ? 28 : 36, step = (326 - x0) / n, bw = Math.min(22, step * .62), T = fs + 12, H = o.h || (bg ? 80 : 60), base = T + H;
    const vals = o.vals.map(v => v || 0), yv = v => base - v / o.max * H, top = v => base - Math.max(2, v / o.max * H);
    const xs = vals.map((_, i) => x0 + i * step + (step - bw) / 2), last = n - 1, live = o.live !== false;
    const two = bg && live && o.xl, h = base + (o.xl ? fs + 10 : 12) + (two ? fs + 4 : 0);
    let s = `<svg width="326" height="${h}" viewBox="0 0 326 ${h}" role="img" aria-label="${e(o.aria)}">`;
    s += grid(x0, o.ticks.map(([v, , d]) => [yv(v), d, v === 0]));
    s += txt(fs, o.ticks.filter(t => t[1]).map(([v, l]) => [0, yv(v) + fs * .35, l]));
    s += `<g fill="rgba(255,255,255,.4)">` + vals.map((v, i) => i === last ? "" : `<rect x="${r(xs[i])}" y="${r(top(v))}" width="${r(bw)}" height="${r(base - top(v))}"></rect>`).join("") + `</g>`;
    s += `<rect x="${r(xs[last])}" y="${r(top(vals[last]))}" width="${r(bw)}" height="${r(base - top(vals[last]))}" fill="#fff"></rect>`;
    const closed = live ? vals.slice(0, -1) : vals, rec = closed.length ? closed.lastIndexOf(Math.max(...closed)) : last;
    const idx = o.all ? vals.map((_, i) => i) : [...new Set([rec, last])];
    const L = idx.map(i => vlab(xs[i] + bw / 2, top(vals[i]) - 6, o.fmt(vals[i]), fs, x0, 326));
    if (!o.all && L.length === 2 && Math.abs(L[0][0] - L[1][0]) < (tw(L[0][2], fs) + tw(L[1][2], fs)) / 2 && Math.abs(L[0][1] - L[1][1]) < fs + 2) L.shift();
    s += txt(fs, L, "#fff", 700);
    if (o.xl) s += txt(fs, o.xl.map(([i, t]) => bg ? [xs[i] + bw / 2, base + fs + 6, t, "middle"] : i === last ? [xs[i] + bw, base + fs + 6, t, "end"] : [xs[i], base + fs + 6, t]).concat(two ? [[326, base + 2 * fs + 10, "in corso", "end"]] : []));
    s += vals.map((v, i) => hit(x0 + i * step, 0, step, base, o.tip(i) + (live && i === last ? " (in corso)" : ""), top(v), xs[i] + bw / 2)).join("");
    return `<div class="v3-chw">${s}</svg></div>`;
  };
  /* gradini del carico migliore: pts, flags (pieno/vuoto), min, max, xl, fmt, tip, aria */
  ui.chart.steps = function (o) {
    o = { ...DEF, ...o };
    const fs = FS(), n = o.pts.length, gap = 275 / Math.max(1, n - 1), X = i => 44 + i * gap, T = 2 * fs + 18, H = 132, base = T + H;
    const lo = o.min ?? Math.min(...o.pts), hi = o.max ?? Math.max(...o.pts), Y = v => T + (hi - v) / ((hi - lo) || 1) * H;
    let d = `M44 ${r(Y(o.pts[0]))}`, prev = o.pts[0], lastCh = 0;
    for (let i = 1; i < n; i++) if (o.pts[i] !== prev) { d += ` H${r(X(i))} V${r(Y(o.pts[i]))}`; prev = o.pts[i]; lastCh = i; }
    if (lastCh !== n - 1) d += ` H319`;
    const h = base + fs + 12;
    let s = `<svg width="326" height="${h}" viewBox="0 0 326 ${h}" role="img" aria-label="${e(o.aria)}">`;
    s += grid(36, [[T], [T + H / 2], [base, false, true]]);
    s += txt(fs, [[0, T + fs * .35, nf(hi)], [0, base + fs * .35, nf(lo)]]);
    s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="2"></path>`;
    const f = o.flags || o.pts.map(() => 1);
    s += `<g fill="#fff">` + o.pts.map((v, i) => f[i] ? `<circle cx="${r(X(i))}" cy="${r(Y(v))}" r="7"></circle>` : "").join("") + `</g>`;
    s += `<g fill="#111" stroke="#fff" stroke-width="2.5">` + o.pts.map((v, i) => f[i] ? "" : `<circle cx="${r(X(i))}" cy="${r(Y(v))}" r="6"></circle>`).join("") + `</g>`;
    const mx = Math.max(...o.pts), rec = o.pts.indexOf(mx), idx = [rec];
    if (o.pts[n - 1] !== mx) idx.push(n - 1);
    s += txt(fs, idx.map(i => vlab(X(i), Y(o.pts[i]) - 12, o.fmt(o.pts[i]), fs, 36, 326)), "#fff", 700);
    s += txt(fs, [vlab(X(rec), Y(mx) - 14 - fs, "Record", fs, 36, 326)], "#fff", 700);
    if (o.xl) s += txt(fs, o.xl.map(([i, t]) => i === n - 1 ? [X(i), base + fs + 6, t, "end"] : [X(i), base + fs + 6, t]));
    s += o.pts.map((v, i) => hit(X(i) - gap / 2, 0, gap, base, o.tip(i), Y(v) - 4, X(i))).join("");
    return `<div class="v3-chw">${s}</svg></div>`;
  };
  /* linea di tendenza: trend, dots (pesate), min, max, yl [alto, basso], plan (riga tratteggiata), xl, fmt, tip, aria, h */
  ui.chart.line = function (o) {
    o = { ...DEF, ...o };
    const fs = FS(), n = o.trend.length, x0 = o.x0 || 36, X = i => 44 + i * 275 / Math.max(1, n - 1), T = fs + 14, H = o.h || 72, base = T + H;
    const mn = o.min ?? Math.min(...o.trend, ...(o.dots || [])), mx = o.max ?? Math.max(...o.trend, ...(o.dots || [])), Y = v => T + (mx - v) / ((mx - mn) || 1) * H, h = base + (o.xl ? fs + 10 : 6);
    const yl = o.yl || [nf(mx), nf(mn)];
    let s = `<svg width="326" height="${h}" viewBox="0 0 326 ${h}" role="img" aria-label="${e(o.aria)}">`;
    s += grid(x0, [[T], [base]]);
    s += txt(fs, [[0, T + fs * .35, yl[0]], [0, base + fs * .35, yl[1]]]);
    if (o.plan != null) s += grid(x0, [[Y(o.plan), true]]) + txt(fs, [[x0 + 4, Y(o.plan) - 6, "Piano"]]);
    if (o.dots) s += `<g fill="rgba(255,255,255,.4)">` + o.dots.map((v, i) => `<circle cx="${r(44 + i * 275 / Math.max(1, o.dots.length - 1))}" cy="${r(Y(v))}" r="3.5"></circle>`).join("") + `</g>`;
    s += `<path d="${o.trend.map((v, i) => (i ? "L" : "M") + r(X(i)) + " " + r(Y(v))).join(" ")}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"></path>`;
    s += `<circle cx="${r(X(n - 1))}" cy="${r(Y(o.trend[n - 1]))}" r="5" fill="#fff"></circle>`;
    s += txt(fs, [n > 1 && o.trend[n - 2] > o.trend[n - 1] ? [X(n - 1) - 10, Y(o.trend[n - 1]) + fs + 4, o.fmt(o.trend[n - 1]), "end"] : vlab(X(n - 1), Y(o.trend[n - 1]) - 10, o.fmt(o.trend[n - 1]), fs, x0, 326)], "#fff", 700);
    if (o.xl) s += txt(fs, o.xl.map(([i, t]) => i === n - 1 ? [X(i), base + fs + 6, t, "end"] : [X(i), base + fs + 6, t, i ? "middle" : "start"]));
    s += o.trend.map((v, i) => hit(X(i) - 275 / Math.max(1, n - 1) / 2, 0, 275 / Math.max(1, n - 1), base, o.tip(i), Y(v) - 4, X(i))).join("");
    return `<div class="v3-chw">${s}</svg></div>`;
  };
  /* coppie palestra/riposo in % del piano (riga 100%): gym, rest, lab, xl, aria */
  ui.chart.pairs = function (o) {
    o = { ...DEF, ...o };
    const fs = FS(), n = o.gym.length, x0 = 40, xr = 296, step = (xr - x0) / n, bw = Math.min(14, step * .34), T = fs + 12, H = 104, base = T + H, mx = 115;
    const gym = o.gym.map(v => v || 0), rest = o.rest.map(v => v || 0);
    const yv = v => base - Math.min(v, mx) / mx * H, cx = i => x0 + i * step + step / 2, last = n - 1, h = base + fs + 10;
    let s = `<svg width="326" height="${h}" viewBox="0 0 326 ${h}" role="img" aria-label="${e(o.aria)}">`;
    s += grid(x0, [[yv(100), true], [base, false, true]]) + txt(fs, [[0, yv(100) + fs * .35, "100%"], [0, base + fs * .35, "0"]]);
    s += `<g fill="rgba(255,255,255,.4)">` + rest.map((v, i) => `<rect x="${r(cx(i) + 1)}" y="${r(yv(v))}" width="${r(bw)}" height="${r(base - yv(v))}"></rect>`).join("") + `</g>`;
    s += `<g fill="#fff">` + gym.map((v, i) => `<rect x="${r(cx(i) - bw - 1)}" y="${r(yv(v))}" width="${r(bw)}" height="${r(base - yv(v))}"></rect>`).join("") + `</g>`;
    s += txt(fs, [[cx(last) - 1, yv(gym[last]) - 6, gym[last] + "%", "end"], [cx(last) + 1, yv(rest[last]) - 6, rest[last] + "%", "start"]], "#fff", 700);
    if (o.xl) s += txt(fs, o.xl.map(([i, t]) => i === last ? [cx(i) + bw + 1, base + fs + 6, t, "end"] : [cx(i) - bw - 1, base + fs + 6, t]));
    s += gym.map((v, i) => hit(x0 + i * step, 0, step, base, `${(o.lab || [])[i] || ""}: palestra ${o.gym[i] ?? "–"}%, riposo ${o.rest[i] ?? "–"}%${i === last ? " (in corso)" : ""}`, yv(Math.max(v, rest[i])) - 4, cx(i))).join("");
    return `<div class="v3-chw">${s}</svg></div>`;
  };
  function showTip(t) {
    const w = t.closest(".v3-chw"), svg = w.querySelector("svg"), k = svg.getBoundingClientRect().width / 326, box = w.parentElement;
    box.querySelectorAll(".v3-pill").forEach(p => p.remove());
    const p = document.createElement("span"); p.className = "v3-pill"; p.setAttribute("role", "status"); p.textContent = t.dataset.tip; w.appendChild(p);
    const half = p.offsetWidth / 2, x = Math.max(half, Math.min(w.clientWidth - half, +t.dataset.tx * k));
    p.style.left = x + "px"; p.style.top = Math.max(p.offsetHeight, +t.dataset.ty * k - 4) + "px";
  }

  /* ============================== NAVIGAZIONE ============================== */
  /* stack delle pagine interne e dei fogli V3: ogni voce = una voce di history, così il tasto indietro (Android, swipe iOS) la chiude */
  const stack = [];
  let pending = null;
  /* Un solo padrone della history: finché lo stack V3 non è vuoto, gesture.js non aggiunge voci-guardia e non gestisce
     popstate (chiede a V3._owns / V3._busy). Ogni voce ricorda la navigazione prima del push (nav) e quella attesa
     sopra di lei (exp): se nel frattempo l'app vecchia ha aperto qualcosa (foglio vecchio, ingranaggio, dettaglio di una
     vista vecchia), indietro chiude solo quello e rimette la voce. Così ogni indietro torna alla schermata precedente. */
  const NAV = ["tab", "hub", "macro", "detail", "settings", "boardEdit"];
  const navSnap = () => NAV.reduce((o, k) => (o[k] = S[k], o), {});
  const sameNav = o => NAV.every(k => (S[k] || null) === (o[k] || null));
  function navRestore(o) { let ch = false; for (const k of NAV) if ((S[k] || null) !== (o[k] || null)) { S[k] = o[k]; ch = true; } if (ch) lsSet("tab2", S.tab); return ch; }
  function push(close, sec, page, legacy) { const nav = navSnap(); stack.push({ close, sec, page: !!page, legacy: !!legacy, nav, exp: nav }); try { history.pushState({ v3d: stack.length }, ""); } catch (_) {} }
  const owns = ev => !!pending || stack.length > ((ev && ev.state && ev.state.v3d) || 0);
  window.addEventListener("popstate", ev => {
    if (pending) { const fn = pending; pending = null; ev.stopImmediatePropagation(); while (stack.length) { try { stack.pop().close(true); } catch (_) {} } fn(); return; }
    const depth = (ev.state && ev.state.v3d) || 0;
    if (stack.length > depth) {
      ev.stopImmediatePropagation();
      const top = stack[stack.length - 1];
      if (depth === stack.length - 1 && (S.sheet || !sameNav(top.exp))) { // qualcosa dell'app vecchia sopra la voce: chiudi solo quello
        if (S.sheet) { if (S.sheet === "chat") S.chatOpen = false; closeSheet(); }
        else { navRestore(top.exp); window.scrollTo(0, 0); render(); }
        try { history.pushState({ v3d: stack.length }, ""); } catch (_) {}
        return;
      }
      let re = navRestore(stack[depth].nav);
      while (stack.length > depth) { const it = stack.pop(); if (it.page) re = true; try { it.close(true); } catch (err) { console.error(err); } }
      if (re) { if (stack.length === 0 || !stack[stack.length - 1].page) window.scrollTo(0, 0); render(); }
    }
  }, true);
  function unwind(then) { if (!stack.length) return then(); pending = then; history.go(-stack.length); }

  const derive = () => {
    if (S.ob || !S.profile || S.settings) return null;
    if (S.tab === "allenamento") return "palestra";
    if (S.tab === "progressi") return "progressi";
    if (S.tab === "oggi") return S.macro === "food" ? "cibo" : S.macro === "train" ? "palestra" : S.macro === "body" ? "progressi" : "oggi";
    if (S.tab === "piano") return S.hub === "train" ? "palestra" : S.hub === "menu" || S.hub === "diet" ? "cibo" : null;
    return null;
  };
  const atRoot = id => !S.settings && !S.ob && (id === "oggi" ? S.tab === "oggi" && !S.macro : id === "palestra" ? S.tab === "allenamento" && !S.detail : id === "cibo" ? S.tab === "oggi" && S.macro === "food" : id === "progressi" ? S.tab === "progressi" : false);

  function navTo(id, opts) {
    S.settings = null; S.hub = ""; S.macro = null; S.boardEdit = false; S.detail = null;
    S.tab = id === "palestra" ? "allenamento" : id === "progressi" ? "progressi" : "oggi";
    if (id === "cibo") S.macro = "food";
    lsSet("tab2", S.tab); lsSet("v3tab", id);
    window.scrollTo(0, 0); render();
    const def = sections[id];
    if (opts && def && typeof def.enter === "function" && current === id) { try { def.enter(opts); } catch (err) { console.error("[V3] enter " + id, err); } }
  }
  function go(id, opts) { if (!SECS.some(s => s[0] === id)) return; unwind(() => navTo(id, opts)); }

  /* ---------- barra in basso ---------- */
  const bar = document.createElement("nav");
  bar.id = "v3bar"; bar.setAttribute("aria-label", "Sezioni");
  document.body.appendChild(bar);
  bar.addEventListener("click", ev => { const b = ev.target.closest("[data-v3go]"); if (b) go(b.dataset.v3go); });
  function renderV3Bar(cur) {
    const show = !!S.profile && !S.ob;
    bar.hidden = !show; document.body.classList.toggle("v3-on", show);
    const live = !!activeDay(); document.body.classList.toggle("v3-live", live && S.tab === "allenamento");
    document.body.classList.toggle("v3-nobar", show && live && S.tab === "allenamento" && !S.settings && !!document.querySelector("#bar .sbar"));
    if (!show) return;
    bar.innerHTML = `<div>${SECS.map(([k, l]) => `<button type="button" data-v3go="${k}"${cur === k ? ' aria-current="page"' : ""}><span class="v3-tip"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg></span>${l}${k === "palestra" && live ? '<span class="v3-live" aria-label="seduta in corso"></span>' : ""}</button>`).join("")}</div>`;
  }

  /* ---------- router: dopo la vista vecchia, se la sezione è registrata la sostituisce ---------- */
  let current = null;
  const r0 = window.render;
  window.render = function () {
    r0();
    current = derive();
    const v = document.getElementById("view"), def = current && sections[current];
    let used = false;
    const lg = stack.length && stack[stack.length - 1].legacy;
    if (lg && v) { v.classList.remove("v3", "v3-o65"); v.insertAdjacentHTML("afterbegin", `<div class="v3-lgb"><button class="v3-back" data-v3act="v3lb">‹ Indietro</button></div>`); }
    else if (def && v && atRoot(current)) {
      const legacy = v.innerHTML;
      v.classList.add("v3"); v.classList.toggle("v3-o65", data.profile().over65);
      v.innerHTML = "";
      try { used = def.render(v, { legacy, sec: current, data, ui, V3 }) !== false; }
      catch (err) { console.error("[V3] sezione " + current, err); used = false; }
      if (!used) { v.innerHTML = legacy; v.classList.remove("v3", "v3-o65"); }
    } else if (v) v.classList.remove("v3", "v3-o65");
    document.body.classList.toggle("v3-sec", used);
    renderV3Bar(current);
  };
  if (S.tab === "oggi" && !S.macro && lsGet("v3tab", "") === "cibo") S.macro = "food";

  /* ---------- foglio dal basso ---------- */
  const ov = document.createElement("div"); ov.id = "v3-overlay"; document.body.appendChild(ov);
  function sheet(html, opts = {}) {
    const scrim = document.createElement("div"); scrim.className = "v3-scrim";
    scrim.innerHTML = `<div class="v3-sheet" role="dialog" aria-modal="true"${opts.label ? ` aria-label="${e(opts.label)}"` : ""}><div class="v3-grab"></div>${html}</div>`;
    ov.appendChild(scrim);
    const sh = scrim.firstElementChild, h = sh.querySelector("h2, h3, .v3-sh1"), prevFocus = document.activeElement;
    if (h && !opts.label) { h.id = h.id || "v3sh" + Date.now(); h.tabIndex = -1; sh.setAttribute("aria-labelledby", h.id); try { h.focus({ preventScroll: true }); } catch (_) {} }
    document.body.style.overflow = "hidden";
    let open = true;
    const api = { el: sh, on: opts.on || {}, close() { if (open) history.back(); } };
    scrim._v3 = api;
    push(() => { open = false; scrim.remove(); if (!ov.children.length) document.body.style.overflow = ""; if (opts.onClose) opts.onClose(); try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (_) {} }, current);
    return api;
  }

  /* ---------- clic: data-v3act → handler della sezione (o del foglio), più le azioni comuni ---------- */
  document.addEventListener("click", ev => {
    const tip = ev.target.closest(".v3-chw [data-tip]"); if (tip) { showTip(tip); return; }
    const scrim = ev.target.classList && ev.target.classList.contains("v3-scrim") ? ev.target : null;
    if (scrim) { scrim._v3.close(); return; }
    const b = ev.target.closest("[data-v3act]"); if (!b) return;
    const act = b.dataset.v3act, arg = b.dataset.v3arg, inSheet = b.closest(".v3-scrim");
    if (act === "v3lb") { history.back(); return; }
    const handlers = inSheet ? inSheet._v3.on : (current && sections[current] && sections[current].on) || {};
    if (typeof handlers[act] === "function") { handlers[act](arg, b, ev); return; }
    if (act === "back" || act === "close") { history.back(); return; }
    if (act === "go") { go(arg); return; }
    if (act === "sap" && !inSheet) { sheet(`<h2 class="v3-sh1">Lo sapevi?</h2><p class="v3-shp">${e(b.querySelector(".v3-sx") ? b.querySelector(".v3-sx").textContent.replace(/\s*›\s*$/, "") : "")}</p>${ui.leo()}<button class="v3-b2" data-v3act="close">Chiudi</button>`); }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && ov.lastElementChild) { ev.stopPropagation(); ov.lastElementChild._v3.close(); } }, true);

  /* ============================== API ============================== */
  const V3 = window.V3 = {
    sections, ui, data,
    register(id, def) {
      if (!SECS.some(s => s[0] === id) || !def || typeof def.render !== "function") { console.error("[V3] register: id o render non validi", id); return; }
      sections[id] = def; if (current === id) render();
    },
    go, sheet, refresh: () => render(),
    current: () => current,
    /* pagina interna di una sezione: la sezione cambia il suo stato e chiama V3.page(onBack); indietro (pulsante, Android, swipe) chiama onBack */
    page(onBack) { push(() => onBack(), current, true); window.scrollTo(0, 0); render(); },
    back: () => history.back(),
    /* apre una vista vecchia come pagina interna (es. editor scheda: {tab:"piano", hub:"train"}; menù: {tab:"piano", hub:"menu"}); indietro torna qui */
    legacy(nav) { push(() => {}, current, true, true); for (const k of NAV) if (k in nav) S[k] = nav[k]; stack[stack.length - 1].exp = navSnap(); window.scrollTo(0, 0); render(); },
    /* per gesture.js: V3 gestisce questo popstate / la history è di V3 (niente voci-guardia) */
    _owns: owns,
    _busy: () => !!pending || stack.length > 0
  };
  render();
})();
