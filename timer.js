"use strict";
/* Session stopwatch (team review 26/10): «In serie» / «Recupero» / «Oltre» phases from saved instants (survives a reload),
   one tap on the time block = «Inizio la serie», end-of-session summary for the coach. Loaded after board.js. */
(function () {
  if (typeof S === "undefined") return;
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const min = s => { s = Math.round(s); return s >= 60 ? `${Math.floor(s / 60)}′${s % 60 >= 30 && s < 600 ? "30″" : ""}` : `${s}″`; };
  const evOf = d => d.ev || (d.ev = []);
  /* glossario 28/10: «Seduta» per adulto e ragazzo, «Allenamento» per bambino e over 65 */
  const alt = () => { try { const g = window.V3 && V3.data.profile().group; return g === "bambino" || g === "over65"; } catch (_) { return false; } };
  const tv = (sed, all) => alt() ? all : sed;
  const minTxt = s => { s = Math.max(0, Math.round(s)); const m = Math.round(s / 60); return s < 60 ? s + " secondi" : m === 1 ? "1 minuto" : m + " minuti"; };
  function phase(d) {
    const ev = evOf(d), last = ev[ev.length - 1], now = Date.now();
    if (!last || last.type === "go") return { k: "work", since: last ? last.t : (d.startedAt || now) };
    const e = (now - last.t) / 1000, planned = last.rest || 90;
    return e <= planned ? { k: "rest", since: last.t, left: planned - e, planned } : { k: "over", since: last.t, over: e - planned, planned };
  }

  /* ---------- events ---------- */
  const md0 = window.markDone;
  window.markDone = function () {
    const a = activeDay(), d = a && draft(a), it = d && P[a].items.find(x => x.id === d.cur.id), s = it && d.sets[it.id][d.cur.i], was = s && s.done;
    md0();
    if (it && !was) { evOf(S.drafts[a]).push({ type: "done", t: Date.now(), ex: it.id, name: exName(it), reps: +s.reps || 0, rest: (typeof itOf === "function" ? itOf(it, S.drafts[a]) : it).rest || 90 }); saveDrafts(); renderBar(); }
  };
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-act="tm-go"], [data-act="t15"], [data-act="tm-m15"]'); if (!b) return; const a = activeDay(); if (!a) return; const d = S.drafts[a], ev = evOf(d), last = ev[ev.length - 1];
    if (b.dataset.act === "tm-m15") { e.stopPropagation(); if (last && last.type === "done") { const el = (Date.now() - last.t) / 1000; last.rest = Math.max(Math.ceil(el), (last.rest || 90) - 15); saveDrafts(); syncTimer(); full(); mini(); } return; } // mai sotto lo zero: con meno di 15″ il recupero finisce
    if (b.dataset.act === "t15") { if (last && last.type === "done") { const e = (Date.now() - last.t) / 1000; last.rest = Math.max(last.rest, Math.ceil(e)) + 15; saveDrafts(); syncTimer(); renderBar(); } return; }
    e.stopPropagation(); if (last && last.type === "done") { ev.push({ type: "go", t: Date.now() }); S.timer = null; saveDrafts(); if (!inSession() && window.V3) V3.go("palestra"); renderBar(); }
  }, true);

  /* ---------- bar (28/10): in seduta la barra mostra solo tempo totale + Concludi; il recupero vive nel riquadro #tm-mini ---------- */
  const rb0 = window.renderBar;
  window.renderBar = function () {
    if (!inSession()) { const r = rb0(); full(); mini(); return r; }
    const a = activeDay(), d = S.drafts[a];
    S.barSig = "x";
    const dur = tv("Durata della seduta", "Durata dell'allenamento");
    $("#bar").innerHTML = `<div class="sbar tm" role="region" aria-label="${tv("Seduta in corso", "Allenamento in corso")}"><div>
      <div class="tm-ph work" role="timer" aria-label="${dur}"><span class="tm-k">${dur}</span><b id="sb-ph">${mmss((Date.now() - (d.startedAt || Date.now())) / 1000)}</b></div>
      <button class="fine" data-act="finish">${tv("Concludi la seduta", "Concludi l'allenamento")}</button></div></div>`;
    full(); mini();
  };
  window.tickBar = function () {
    if (!inSession()) return; const d = S.drafts[activeDay()];
    const p = $("#sb-ph"); if (!p) return renderBar();
    p.textContent = mmss((Date.now() - (d.startedAt || Date.now())) / 1000);
  };

  /* ---------- riquadro del recupero (28/10, Giovanni): sempre visibile in ogni sezione durante la pausa, tocco = tutto schermo ---------- */
  function mini() {
    let el = document.getElementById("tm-mini");
    const a = activeDay(), d = a && S.drafts[a], ph = d && phase(d), it = d && d.cur && P[a].items.find(x => x.id === d.cur.id);
    const show = !!ph && ph.k !== "work" && !document.getElementById("tm-full") && !S.sheet && !S.ob;
    document.body.classList.toggle("tm-mini-on", show);
    if (!show) { if (el) el.remove(); fixb(); return; }
    if (!el) {
      el = document.createElement("button"); el.type = "button"; el.id = "tm-mini"; el.dataset.act = "tm-open"; el.setAttribute("aria-label", "Apri il recupero a tutto schermo");
      el.innerHTML = `<span class="tmm-l"><span class="tmm-k" id="tmm-k"></span><b id="tmm-t" role="timer"></b></span><span class="tmm-n" id="tmm-n"></span><span class="tmm-apri" aria-hidden="true">Apri</span><span class="tmm-track"><i id="tmm-bar"></i></span>`;
      document.body.appendChild(el);
    }
    el.className = ph.k;
    $("#tmm-k").textContent = ph.k === "rest" ? "Recupero" : "Recupero oltre il previsto";
    const s = it && d.sets[it.id] && d.sets[it.id][d.cur.i];
    $("#tmm-n").innerHTML = s && !s.done ? "Poi:<br><span>" + esc(short(exName(it))) + "</span>" : "<span>Esercizio finito</span>";
    $("#tmm-t").textContent = ph.k === "rest" ? mmss(ph.left) : "+" + mmss(ph.over);
    $("#tmm-bar").style.width = (ph.k === "rest" ? (1 - ph.left / ph.planned) * 100 : 100) + "%";
    // sopra la barra più alta tra quella della seduta e quella delle sezioni
    const tops = ["#bar .sbar", "#v3bar"].map(q => document.querySelector(q)).filter(x => x && !x.hidden && getComputedStyle(x).display !== "none").map(x => x.getBoundingClientRect()).filter(r => r.height > 0 && r.top < innerHeight).map(r => r.top);
    el.style.bottom = (innerHeight - (tops.length ? Math.min(...tops) : innerHeight) + 12) + "px";
    fixb();
  }
  // 28/10: aria in fondo sempre uguale = altezza reale di quanto sta fisso in basso (barra sezioni, barra seduta, riquadro recupero)
  function fixb() {
    const tops = ["#v3bar", "#bar .sbar", "#tm-mini"].map(q => document.querySelector(q)).filter(x => x && !x.hidden && getComputedStyle(x).display !== "none").map(x => x.getBoundingClientRect()).filter(r => r.height > 0 && r.top < innerHeight).map(r => r.top);
    const h = tops.length ? Math.round(innerHeight - Math.min(...tops)) : 0;
    if (fixb.h !== h) { fixb.h = h; document.documentElement.style.setProperty("--fixb", h + "px"); }
  }
  const rn0 = window.render; if (rn0) window.render = function () { const r = rn0.apply(this, arguments); setTimeout(fixb, 0); return r; };
  // il cronometro del bip (S.timer, in memoria) si ricava dagli istanti salvati: sopravvive a ricariche e uscite dall'app
  function syncTimer() {
    const a = activeDay(), d = a && S.drafts[a], ev = d && evOf(d), last = ev && ev[ev.length - 1];
    if (last && last.type === "done") S.timer = { end: last.t + (last.rest || 90) * 1000, total: last.rest || 90 };
  }
  /* cardio (modifica 5): tempo dagli istanti salvati in d.cardio {id, t, pz, pause}; annuncio solo a metà, alla fine e nei cambi */
  function cardioTick() {
    const a = activeDay(), d = a && S.drafts[a], c = d && d.cardio; if (!c || c.pause || typeof cardioLeft !== "function") return;
    const it = P[a].items.find(x => x.id === c.id); if (!it || !d.sets[it.id]) return;
    const k = cardioLeft(d, it), t = document.getElementById("cdo-t"), arc = document.getElementById("cdo-arc"), live = document.getElementById("cdo-live");
    if (t) t.textContent = mmss(k.left);
    if (arc) arc.style.strokeDashoffset = (+arc.getAttribute("stroke-dasharray") * k.left / k.dur).toFixed(1);
    const say = m => { if (live) live.textContent = m; };
    if (!c.half && k.el >= k.dur / 2) { c.half = true; saveDrafts(); say("Metà del cardio: mancano " + minTxt(k.left)); }
    if (k.left <= 0 && !c.end) { c.end = true; c.pause = Date.now(); saveDrafts(); say("Cardio finito");
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (_) {}
      if (inSession() && d.cur && d.cur.id === it.id && typeof cardioFine === "function") cardioFine(); }
  }
  setInterval(() => { syncTimer(); full(); mini(); fixb(); cardioTick(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { syncTimer(); full(); mini(); } });
  window.addEventListener("resize", () => mini());

  /* ---------- full-screen rest (27/10): tap anywhere = «go», swipe down = back to the bar without ending the rest ---------- */
  const R = 130, C = 2 * Math.PI * R;
  function nextLine(a, d) {
    const it = d.cur && P[a].items.find(x => x.id === d.cur.id), sets = it && d.sets[it.id], s = sets && sets[d.cur.i];
    if (!s || s.done) return "Esercizio finito";
    return `<span class="tmf-ex">Poi: ${esc(short(exName(it)))}</span><br>serie ${d.cur.i + 1} di ${sets.length}, ${s.kg != null && it.unit !== "none" ? fmt(s.kg) + " kg × " : ""}${s.reps}`;
  }
  function full() {
    let el = document.getElementById("tm-full");
    const a = activeDay(), d = a && S.drafts[a], last = d && evOf(d)[evOf(d).length - 1], ph = d && phase(d);
    const v3o = document.getElementById("v3-overlay"); // un foglio v3 aperto (es. «Tieni le serie») passa davanti al recupero
    if (!ph || ph.k === "work" || S.sheet || S.ob || (v3o && v3o.children.length) || S.tmHide === last.t) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.id = "tm-full"; el.dataset.act = "tm-go"; el.dataset.t = Date.now();
      el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Recupero");
      el.innerHTML = `<div class="tmf-tot"><span>${tv("Durata della seduta", "Durata dell'allenamento")}</span><b id="tmf-tot"></b></div>
        <div class="tmf-main"><span class="tmf-k" id="tmf-k"></span>
        <div class="tmf-ring"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="${R}"/><circle id="tmf-arc" cx="150" cy="150" r="${R}" stroke-dasharray="${C}"/></svg><b id="tmf-t" role="timer"></b></div>
        <p class="tmf-next" id="tmf-next"></p></div><div class="tmf-ctl">
        <div class="tmf-adj"><button class="tmf-15" data-act="tm-m15" id="tmf-m15" aria-label="Meno 15 secondi di recupero">−15 s</button><button class="tmf-15" data-act="t15" id="tmf-15" aria-label="Più 15 secondi di recupero">+15 s</button></div>
        <div class="tmf-foot"><button class="tmf-go" data-act="tm-go">Tocca per terminare la pausa</button><button class="tmf-min" data-act="tm-min">Riduci il cronometro</button></div></div>`;
      let y0 = null;
      el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; }, { passive: true });
      el.addEventListener("touchend", e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) { e.preventDefault(); S.tmHide = last.t; el.remove(); mini(); } y0 = null; });
      document.body.appendChild(el);
    }
    el.className = ph.k;
    $("#tmf-k").textContent = ph.k === "rest" ? "Recupero" : "Recupero oltre il previsto";
    $("#tmf-t").textContent = ph.k === "rest" ? mmss(ph.left) : "+" + mmss(ph.over);
    $("#tmf-arc").style.strokeDashoffset = ph.k === "rest" ? C * (ph.left / ph.planned) : 0;
    $("#tmf-next").innerHTML = nextLine(a, d);
    $("#tmf-15").textContent = ph.k === "rest" ? "+15 s" : "Altri 15 secondi"; $("#tmf-m15").hidden = ph.k !== "rest";
    $("#tmf-tot").textContent = mmss((Date.now() - (d.startedAt || Date.now())) / 1000);
  }
  window.addEventListener("click", e => { // window capture runs before the «tm-go» handler on document
    const m = e.target.closest('[data-act="tm-min"], [data-act="tm-open"]');
    if (m) { e.stopImmediatePropagation(); const a = activeDay(), d = a && S.drafts[a], ev = d && evOf(d), last = ev && ev[ev.length - 1];
      if (m.dataset.act === "tm-min") { if (last) S.tmHide = last.t; const el = document.getElementById("tm-full"); if (el) el.remove(); } else S.tmHide = null;
      full(); mini(); return; }
    const f = e.target.closest("#tm-full"); // ignore the tap that lands right after «Fatta»
    if (f && !e.target.closest('[data-act="t15"], [data-act="tm-m15"]') && Date.now() - f.dataset.t < 600) e.stopImmediatePropagation();
  }, true);
  const rs0 = window.renderSheet;
  if (rs0) window.renderSheet = function () { const r = rs0.apply(this, arguments); full(); return r; };

  /* ---------- summary ---------- */
  function summary(d, end) {
    const ev = evOf(d), sets = [], t0 = d.startedAt || (ev[0] && ev[0].t) || end;
    let start = t0, est = false;
    for (let k = 0; k < ev.length; k++) {
      const e = ev[k]; if (e.type === "go") { start = e.t; est = false; continue; }
      const work = (e.t - start) / 1000;
      sets.push({ name: e.name, ex: e.ex, work: Math.max(0, work), est, done: e.t, planned: e.rest, bad: work < 20 && k > 0 && ev[k - 1].type === "done" });
      const nx = ev[k + 1];
      if (nx && nx.type === "done") { const guess = Math.max(20, (nx.reps || 8) * 4); start = nx.t - guess * 1000; est = true; } // forgot «Inizio la serie»: estimate
      else { start = nx ? nx.t : e.t; est = false; }
    }
    const rests = [];
    for (let k = 0; k < sets.length - 1; k++) { const s = sets[k], nextStart = sets[k + 1].done - sets[k + 1].work * 1000, r = (nextStart - s.done) / 1000;
      const pause = r > 2 * s.planned + 180; rests.push({ name: s.name, ex: s.ex, r: Math.max(0, r), planned: s.planned, pause, bad: s.bad || sets[k + 1].bad }); }
    const total = (end - t0) / 1000, work = sets.reduce((n, s) => n + s.work, 0), restT = rests.filter(r => !r.pause).reduce((n, r) => n + r.r, 0), pauses = rests.filter(r => r.pause).reduce((n, r) => n + r.r, 0);
    const meas = rests.filter(r => !r.pause && !r.bad), over = meas.filter(r => r.r > r.planned + 15), avgOver = meas.length ? meas.reduce((n, r) => n + (r.r - r.planned), 0) / meas.length : 0;
    const byEx = {}; sets.forEach(s => { byEx[s.name] = (byEx[s.name] || 0) + s.work; }); rests.forEach(r => { byEx[r.name] = (byEx[r.name] || 0) + r.r; });
    const longest = Object.entries(byEx).sort((x, y) => y[1] - x[1])[0];
    const overBy = {}; over.forEach(r => { overBy[r.name] = (overBy[r.name] || 0) + 1; }); const worst = Object.entries(overBy).sort((x, y) => y[1] - x[1])[0];
    return { total, work, rest: restT, pauses, avgOver, overN: over.length, restN: meas.length, maxOver: over.length ? Math.max(...over.map(r => r.r - r.planned)) : 0, worst: worst && worst[0], longest, estN: sets.filter(s => s.est).length, sets: sets.length };
  }
  window.sessionSummary = summary;
  const fin0 = window.finish;
  window.finish = async function (meta) {
    const a = activeDay(), d = a && S.drafts[a], end = Date.now(), sm = d && evOf(d).length ? summary(d, end) : null, before = S.sessions.length;
    await fin0(meta);
    if (!sm || S.sessions.length <= before) return;
    const s = S.sessions[S.sessions.length - 1]; s.tempi = { total: Math.round(sm.total), lavoro: Math.round(sm.work), recupero: Math.round(sm.rest), pause: Math.round(sm.pauses) }; lsSet("sessions", S.sessions);
    const prev = S.sessions.slice(0, -1).filter(x => x.day === s.day && x.tempi).pop();
    const lines = [
      `Durata ${minTxt(sm.total)}`,
      `Recupero ${minTxt(sm.rest)}, serie ${minTxt(sm.work)}${sm.pauses ? `, pause ${minTxt(sm.pauses)}` : ""}`
    ];
    const more = [
      sm.restN ? (sm.avgOver > 10 ? `Recupero medio: ${minTxt(sm.avgOver)} oltre il previsto` : sm.avgOver < -10 ? `Recupero medio: ${minTxt(-sm.avgOver)} sotto il previsto` : "Recuperi nei tempi previsti") : "",
      sm.overN ? `${sm.overN} recuperi su ${sm.restN} più lunghi${sm.worst ? `, soprattutto a ${esc(short(sm.worst))}` : ""}` : "",
      sm.longest ? `Esercizio più lungo: ${esc(short(sm.longest[0]))}, ${minTxt(sm.longest[1])}` : "",
      prev ? (() => { const dd = Math.round((sm.total - prev.tempi.total) / 60); return dd === 0 ? "Stessa durata della volta scorsa" : `${Math.abs(dd) === 1 ? "1 minuto" : Math.abs(dd) + " minuti"} ${dd < 0 ? "in meno" : "in più"} della volta scorsa`; })() : "",
      sm.estN ? `${sm.estN} serie con tempo stimato` : ""
    ].filter(Boolean);
    const li = L => `<ul class="plain">${L.map(l => `<li>${l}</li>`).join("")}</ul>`;
    const i = S.savedHtml.indexOf("</p>") + 4;
    S.savedHtml = S.savedHtml.slice(0, i) + `<div class="card tm-sum"><b>I tuoi tempi</b>${li(lines)}${more.length ? `<details class="tm-more"><summary>Apri</summary>${li(more)}</details>` : ""}</div>` + S.savedHtml.slice(i);
    if (S.sheet === "saved") renderSheet();
  };
  // the duration field starts from the real stopwatch
  const st = document.createElement("style");
  st.textContent = `
  .sbar.tm > div { display: flex; align-items: center; gap: 8px; }
  .tm-ph { flex: 1; min-width: 0; display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 8px; border: 0; border-radius: 16px; padding: 8px 12px 10px; background: var(--raised); color: var(--text); text-align: left; position: relative; overflow: hidden; }
  .tm-ph b { font-size: 22px; font-variant-numeric: tabular-nums; justify-self: end; }
  .tm-k { font-size: 13px; font-weight: 700; color: var(--muted); }
  .tm-go { grid-column: 1 / -1; font-size: 11px; color: var(--muted); }
  .tm-track { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: transparent; } .tm-track i { display: block; height: 100%; background: var(--accent); }
  .tm-ph.rest { background: var(--surface-2); } .tm-ph.rest .tm-k { color: var(--accent); }
  .tm-ph.over { background: color-mix(in srgb, var(--warn, #ffb340) 18%, var(--v3-bg, #000)); } .tm-ph.over .tm-k, .tm-ph.over b { color: var(--warn, #ffb340); } .tm-ph.over .tm-track i { background: var(--warn, #ffb340); }
  .tm-ph.work .tm-track { display: none; }
  .tm-ph.work { grid-template-columns: 1fr; justify-items: center; text-align: center; row-gap: 2px; padding: 8px 12px; } .tm-ph.work b { justify-self: center; }
  .tm-ph.work { background: color-mix(in srgb, var(--accent) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); } .tm-ph.work .tm-k, .tm-ph.work b { color: var(--accent); }
  .sbar.tm .tm-ph.work b { font-size: 22px; }
  #tm-mini { position: fixed; left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); z-index: 9; max-width: 528px; margin: 0 auto; min-height: 76px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 16px; padding: 10px 12px 12px 16px; border: 2px solid var(--accent); border-radius: 18px; background: var(--glass-fume, rgba(22,22,22,.88)); -webkit-backdrop-filter: var(--glass-fume-blur, blur(16px) saturate(120%)); backdrop-filter: var(--glass-fume-blur, blur(16px) saturate(120%)); color: var(--text); text-align: left; font: inherit; overflow: hidden; box-shadow: 0 0 0 1px #000, 0 12px 32px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.10); cursor: pointer; animation: tmm-in .45s cubic-bezier(.2,1,.3,1) both; }
  @keyframes tmm-in { 0% { opacity: 0; transform: translateY(14px) scale(.94); } 60% { opacity: 1; transform: translateY(-2px) scale(1.015); } 100% { opacity: 1; transform: none; } }
  body.no-glass #tm-mini { background: #161616; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .tmm-l { display: flex; flex-direction: column; gap: 4px; }
  .tmm-k { font-size: 14px; font-weight: 700; color: var(--accent); line-height: 1.15; max-width: 8.5em; }
  .tmm-n { font-size: 13px; line-height: 18px; color: var(--muted); padding-left: 16px; border-left: 1px solid rgba(255,255,255,.12); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tmm-n span { color: var(--text); font-weight: 600; font-size: 14px; }
  #tm-mini b { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; line-height: 1; min-width: 3.3ch; }
  .tmm-apri { min-height: 44px; display: flex; align-items: center; padding: 0 16px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); font-weight: 700; font-size: 15px; }
  .tmm-track { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,.08); } .tmm-track i { display: block; height: 100%; background: var(--accent); transition: width 1s linear; }
  #tm-mini.over { border-color: var(--warn, #ffb340); } #tm-mini.over .tmm-k, #tm-mini.over b { color: var(--warn, #ffb340); } #tm-mini.over .tmm-track i { background: var(--warn, #ffb340); } #tm-mini.over .tmm-apri { background: color-mix(in srgb, var(--warn, #ffb340) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--warn, #ffb340); color: var(--warn, #ffb340); }
  body.tm-mini-on .coach-fab { bottom: calc(var(--v3-bar, 0px) + 100px) !important; }
  .tmf-min { width: 100%; max-width: 360px; min-height: 52px; border: 0; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); color: var(--text); font-size: 16px; font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { #tm-mini { animation: none; } .tmm-track i { transition: none; } }
  .sbar.tm .fine { flex: none; }
  .sbar.tm .clock { flex: none; min-width: 0; }
  @media (max-width: 400px) {
    .sbar.tm > div { gap: 6px; } .sbar.tm .clock .small { display: none; } .sbar.tm .clock b { font-size: 16px; }
    .tm-ph { padding: 6px 10px 8px; } .tm-ph b { font-size: 18px; } .tm-k { font-size: 12px; } .tm-go { display: none; }
    .sbar.tm .fine { padding: 0 14px; font-size: 15px; }
  }
  @media (max-width: 340px) { .sbar.tm .clock { display: none; } }
  #tm-full { position: fixed; inset: 0; z-index: 40; background: var(--v3-bg, #000); color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: calc(84px + env(safe-area-inset-top, 0px)) 24px calc(156px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; touch-action: manipulation; cursor: pointer; animation: tmf-in .25s ease-out; }
  @keyframes tmf-in { from { opacity: 0; transform: scale(.96); } }
  .tmf-k { font-size: 18px; font-weight: 700; color: var(--accent); letter-spacing: .01em; margin-bottom: 24px; }
  .tmf-ring { position: relative; width: min(272px, 70vw); aspect-ratio: 1; }
  .tmf-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
  .tmf-ring circle { fill: none; stroke-width: 10; stroke: var(--raised); }
  .tmf-ring #tmf-arc { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  .tmf-ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: min(84px, 21vw); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .tmf-next { margin: 32px 0 0; font-size: 17px; line-height: 24px; color: var(--muted); max-width: 320px; text-wrap: balance; }
  .tmf-ex { color: var(--text); font-weight: 600; }
  .tmf-adj { display: flex; gap: 20px; justify-content: center; margin-top: 28px; } .tmf-adj .tmf-15 { min-width: 112px; min-height: 56px; font-size: 20px; } .tmf-adj .tmf-15 { margin-top: 0; } .tmf-15[hidden] { display: none; }
  .tmf-15 { margin-top: 20px; min-width: 96px; min-height: 48px; border: 0; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1px var(--raised); color: var(--text); font-size: 17px; font-weight: 700; }
  .tmf-foot { position: absolute; left: 24px; right: 24px; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .tmf-tot { position: absolute; top: calc(20px + env(safe-area-inset-top, 0px)); left: 24px; right: 24px; display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--accent); }
  .tmf-tot span { font-size: 14px; font-weight: 600; opacity: .85; } .tmf-tot b { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tmf-go { width: 100%; max-width: 360px; min-height: 56px; border: 0; border-radius: 999px; background: var(--text); color: var(--v3-ink, #0a0a0a); font-size: 17px; font-weight: 700; }
  #tm-full.over .tmf-k, #tm-full.over .tmf-ring b { color: var(--warn, #ffb340); } #tm-full.over #tmf-arc { stroke: var(--warn, #ffb340); } #tm-full.over .tmf-15 { padding: 0 22px; } #tm-full.over .tmf-ring b { font-size: min(68px, 17vw); }
  @media (orientation: portrait) and (max-height: 700px) { /* telefoni piccoli */
    #tm-full { gap: 12px; padding-top: calc(16px + env(safe-area-inset-top, 0px)); padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
    .tmf-tot { min-height: 48px; } .tmf-tot span { font-size: 14px; } .tmf-tot b { font-size: 22px; }
    .tmf-main { gap: 10px; padding: 14px 12px; } .tmf-k { font-size: 16px; } .tmf-ring { width: min(160px, 50vw); } .tmf-ring b { font-size: min(52px, 15vw); }
    .tmf-next { font-size: 15px; line-height: 20px; } .tmf-ctl { gap: 10px; } .tmf-adj, .tmf-adj .tmf-15 { min-height: 48px; } .tmf-foot { margin-top: 0; gap: 8px; } .tmf-go { min-height: 52px; } .tmf-min { min-height: 48px; }
  }
  /* 28/10 tavola 22b: telefono in verticale a box impilati (Tempo totale in alto, Recupero grande, ±15 come box con divisore) */
  #tm-full { justify-content: center; gap: 16px; padding: calc(32px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
  .tmf-tot { position: static; flex-direction: row; justify-content: space-between; align-items: center; width: 100%; max-width: 480px; min-height: 60px; box-sizing: border-box; padding: 0 16px; border-radius: 20px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
  .tmf-tot span { font-size: 15px; opacity: 1; } .tmf-tot b { font-size: 26px; }
  .tmf-main { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 480px; box-sizing: border-box; padding: 24px 16px; border: 2px solid var(--accent); border-radius: 24px; background: var(--v3-s1, #111); }
  #tm-full.over .tmf-main { border-color: var(--warn, #ffb340); }
  .tmf-k { margin: 0; font-size: 18px; } .tmf-ring { width: min(240px, 62vw); } .tmf-ring b { font-size: min(72px, 18vw); } #tm-full.over .tmf-ring b { font-size: min(58px, 15vw); }
  .tmf-next { margin: 0; font-size: 16px; line-height: 22px; }
  .tmf-ctl { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 480px; }
  .tmf-adj { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin: 0; gap: 0; min-height: 60px; border-radius: 20px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); overflow: hidden; }
  .tmf-adj .tmf-15 { position: relative; margin: 0; min-width: 0; min-height: 60px; width: 100%; border-radius: 0; background: transparent; box-shadow: none; color: var(--accent); font-size: 22px; padding: 0 12px; }
  .tmf-adj .tmf-15 + .tmf-15::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
  .tmf-adj .tmf-15:active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  #tm-full.over .tmf-adj { grid-template-columns: 1fr; } #tm-full.over .tmf-adj .tmf-15 { font-size: 18px; } #tm-full.over .tmf-adj .tmf-15::before { display: none; }
  .tmf-foot { position: static; left: auto; right: auto; bottom: auto; width: 100%; gap: 12px; margin-top: 8px; } .tmf-go, .tmf-min { max-width: none; }
  /* 28/10 tavole 17 e 20: in orizzontale e su tablet due box affiancati, Recupero grande + Tempo totale, comandi sotto */
  @media (orientation: landscape) and (max-height: 500px), (min-width: 600px) and (min-height: 800px) {
    #tm-full { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 16px; align-content: stretch; align-items: stretch; justify-items: stretch; text-align: center; }
    .tmf-main { display: flex; grid-column: 1; grid-row: 1; max-width: none; border: 2px solid var(--accent); border-radius: 24px; background: var(--v3-s1, #111); align-items: center; justify-content: center; min-height: 0; }
    .tmf-tot { position: static; flex-direction: column; max-width: none; min-height: 0; grid-column: 2; grid-row: 1; border-radius: 24px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); justify-content: center; gap: 6px; padding: 16px; }
    #tm-full.over .tmf-main { border-color: var(--warn, #ffb340); }
    .tmf-ctl { display: flex; grid-column: 1 / -1; grid-row: 2; align-items: center; max-width: none; }
    .tmf-adj { margin: 0; } .tmf-foot { position: static; margin: 0; left: auto; right: auto; bottom: auto; }
    .tmf-15 { margin-top: 0; }
  }
  @media (orientation: landscape) and (max-height: 500px) {
    .sbar.tm { padding-top: 6px !important; padding-bottom: max(6px, env(safe-area-inset-bottom, 0px)) !important; }
    .sbar.tm .tm-ph.work { grid-template-columns: auto auto; justify-content: center; align-items: baseline; column-gap: 10px; min-height: 48px; padding: 6px 12px; } .sbar.tm .tm-ph.work b { font-size: 20px; }
    .sbar.tm .fine { height: 48px; }
    #tm-mini { min-height: 60px; padding: 6px 10px 8px 14px; } #tm-mini b { font-size: 28px; }
    #tm-full { padding: max(20px, env(safe-area-inset-top, 0px)) max(44px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-bottom, 0px)) max(44px, env(safe-area-inset-left, 0px)); }
    .tmf-main { flex-direction: row; gap: 28px; padding: 12px 24px; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 28px; row-gap: 10px; text-align: left; }
    .tmf-ring { grid-column: 1; grid-row: 1 / span 2; width: min(200px, calc(100vh - 160px)); } .tmf-ring b { font-size: min(60px, 15vh); } #tm-full.over .tmf-ring b { font-size: min(48px, 12vh); }
    .tmf-k { grid-column: 2; grid-row: 1; align-self: end; margin: 0; font-size: 20px; } .tmf-next { grid-column: 2; grid-row: 2; align-self: start; margin: 0; max-width: none; }
    .tmf-tot span { font-size: 15px; } .tmf-tot b { font-size: 40px; }
    .tmf-ctl { flex-direction: row; align-items: center; gap: 12px; }
    .tmf-adj { width: 220px; flex: none; min-height: 52px; } .tmf-adj .tmf-15 { min-height: 52px; font-size: 18px; }
    .tmf-foot { flex-direction: row; flex: 1; gap: 12px; width: auto; } .tmf-go { flex: 1; min-height: 52px; max-width: none; } .tmf-min { width: auto; min-height: 52px; padding: 0 20px; }
  }
  @media (min-width: 600px) and (min-height: 800px) {
    #tm-full { padding: 48px; grid-template-rows: min(560px, 60vh) auto; gap: 24px 16px; }
    .tmf-main { flex-direction: column; gap: 20px; padding: 24px; border-radius: 28px; } .tmf-tot { border-radius: 28px; } .tmf-tot span { font-size: 16px; } .tmf-tot b { font-size: 44px; }
    .tmf-k { margin: 0; font-size: 20px; } .tmf-ring { width: min(320px, 34vh); } .tmf-ring b { font-size: 100px; } #tm-full.over .tmf-ring b { font-size: 80px; }
    .tmf-next { margin: 0; font-size: 18px; line-height: 26px; }
    .tmf-ctl { flex-direction: column; gap: 24px; align-items: stretch; } #tm-full { align-content: center; } .tmf-adj, .tmf-adj .tmf-15 { min-height: 60px; } .tmf-adj .tmf-15 { font-size: 22px; }
    .tmf-foot { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; width: 100%; } .tmf-go, .tmf-min { max-width: none; min-height: 56px; }
  }
  @media (prefers-reduced-motion: reduce) { #tm-full { animation: none; } .tmf-ring #tmf-arc { transition: none; } }
  .tm-sum ul { margin: 6px 0 0; } .tm-sum li { margin-bottom: 6px; }
  .tm-more summary { min-height: 48px; display: flex; align-items: center; color: var(--accent); font-weight: 700; cursor: pointer; }`;
  document.head.appendChild(st);
})();
