"use strict";
/* Session stopwatch (team review 26/10): «In serie» / «Recupero» / «Oltre» phases from saved instants (survives a reload),
   one tap on the time block = «Inizio la serie», end-of-session summary for the coach. Loaded after board.js. */
(function () {
  if (typeof S === "undefined") return;
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const min = s => { s = Math.round(s); return s >= 60 ? `${Math.floor(s / 60)}′${s % 60 >= 30 && s < 600 ? "30″" : ""}` : `${s}″`; };
  const evOf = d => d.ev || (d.ev = []);
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
    if (it && !was) { evOf(S.drafts[a]).push({ type: "done", t: Date.now(), ex: it.id, name: exName(it), reps: +s.reps || 0, rest: it.rest || 90 }); saveDrafts(); renderBar(); }
  };
  document.addEventListener("click", e => {
    const b = e.target.closest('[data-act="tm-go"], [data-act="t15"]'); if (!b) return; const a = activeDay(); if (!a) return; const d = S.drafts[a], ev = evOf(d), last = ev[ev.length - 1];
    if (b.dataset.act === "t15") { if (last && last.type === "done") { const e = (Date.now() - last.t) / 1000; last.rest = Math.max(last.rest, Math.ceil(e)) + 15; saveDrafts(); renderBar(); } return; }
    e.stopPropagation(); if (last && last.type === "done") { ev.push({ type: "go", t: Date.now() }); S.timer = null; saveDrafts(); renderBar(); }
  }, true);

  /* ---------- bar ---------- */
  const rb0 = window.renderBar;
  window.renderBar = function () {
    if (!inSession()) { const r = rb0(); full(); return r; }
    const a = activeDay(), d = S.drafts[a], ph = phase(d);
    S.barSig = "x" + ph.k;
    $("#bar").innerHTML = `<div class="sbar tm" role="region" aria-label="Seduta in corso"><div>
      ${ph.k === "work" ? "" : `<span class="clock"><span class="small faint">Seduta ${a}</span><b id="sb-clock" role="timer">${mmss((Date.now() - (d.startedAt || Date.now())) / 1000)}</b></span>`}
      <button class="tm-ph ${ph.k}" data-act="tm-go" ${ph.k === "work" ? 'aria-disabled="true"' : ""} aria-label="${ph.k === "work" ? "Tempo totale della seduta" : "Inizio la serie"}">
        <span class="tm-k" id="sb-k">${ph.k === "work" ? "Tempo totale allenamento" : ph.k === "rest" ? "Recupero" : "Recupero aggiuntivo"}</span><b id="sb-ph">${ph.k === "rest" ? mmss(ph.left) : ph.k === "over" ? "+" + mmss(ph.over) : mmss((Date.now() - (d.startedAt || Date.now())) / 1000)}</b>
        ${ph.k !== "work" ? `<span class="tm-go">Tocca quando inizi la serie</span>` : ""}<span class="tm-track"><i id="sb-bar" style="width:${ph.k === "rest" ? (1 - ph.left / ph.planned) * 100 : 100}%"></i></span></button>
      ${ph.k === "rest" ? `<button class="tm-15" data-act="t15" aria-label="Più 15 secondi di recupero">+15″</button>` : ""}
      <button class="fine" data-act="finish">Concludi</button></div></div>`;
    full();
  };
  window.tickBar = function () {
    if (!inSession()) return; const d = S.drafts[activeDay()], ph = phase(d);
    if (S.barSig !== "x" + ph.k) return renderBar();
    const c = $("#sb-clock"), p = $("#sb-ph"), bar = $("#sb-bar");
    if (c) c.textContent = mmss((Date.now() - (d.startedAt || Date.now())) / 1000);
    if (p) p.textContent = ph.k === "rest" ? mmss(ph.left) : ph.k === "over" ? "+" + mmss(ph.over) : mmss((Date.now() - (d.startedAt || Date.now())) / 1000);
    if (bar && ph.k === "rest") bar.style.width = (1 - ph.left / ph.planned) * 100 + "%";
    full();
  };

  /* ---------- full-screen rest (27/10): tap anywhere = «go», swipe down = back to the bar without ending the rest ---------- */
  const R = 130, C = 2 * Math.PI * R;
  function nextLine(a, d) {
    const it = d.cur && P[a].items.find(x => x.id === d.cur.id), sets = it && d.sets[it.id], s = sets && sets[d.cur.i];
    if (!s || s.done) return "Ultima serie fatta";
    return `<span class="tmf-ex">Prossima: ${esc(short(exName(it)))}</span><br>serie ${d.cur.i + 1}/${sets.length} · ${s.kg != null && it.unit !== "none" ? fmt(s.kg) + " kg × " : ""}${s.reps}`;
  }
  function full() {
    let el = document.getElementById("tm-full");
    const a = inSession() && activeDay(), d = a && S.drafts[a], last = d && evOf(d)[evOf(d).length - 1], ph = d && phase(d);
    if (!ph || ph.k === "work" || S.sheet || S.tmHide === last.t) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.id = "tm-full"; el.dataset.act = "tm-go"; el.dataset.t = Date.now();
      el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Recupero");
      el.innerHTML = `<div class="tmf-tot"><span>Tempo totale allenamento</span><b id="tmf-tot"></b></div>
        <span class="tmf-k" id="tmf-k"></span>
        <div class="tmf-ring"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="${R}"/><circle id="tmf-arc" cx="150" cy="150" r="${R}" stroke-dasharray="${C}"/></svg><b id="tmf-t" role="timer"></b></div>
        <p class="tmf-next" id="tmf-next"></p>
        <button class="tmf-15" data-act="t15" id="tmf-15" aria-label="Più 15 secondi di recupero">+15″</button>
        <div class="tmf-foot"><button class="tmf-go" data-act="tm-go">Tocca per terminare la pausa</button></div>`;
      let y0 = null;
      el.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; }, { passive: true });
      el.addEventListener("touchend", e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 80) { e.preventDefault(); S.tmHide = last.t; el.remove(); } y0 = null; });
      document.body.appendChild(el);
    }
    el.className = ph.k;
    $("#tmf-k").textContent = ph.k === "rest" ? "Recupero" : "Tempo di recupero aggiuntivo";
    $("#tmf-t").textContent = ph.k === "rest" ? mmss(ph.left) : "+" + mmss(ph.over);
    $("#tmf-arc").style.strokeDashoffset = ph.k === "rest" ? C * (ph.left / ph.planned) : 0;
    $("#tmf-next").innerHTML = nextLine(a, d);
    $("#tmf-15").textContent = ph.k === "rest" ? "+15″" : "Aggiungi tempo di recupero";
    $("#tmf-tot").textContent = mmss((Date.now() - (d.startedAt || Date.now())) / 1000);
  }
  window.addEventListener("click", e => { // window capture runs before the «tm-go» handler on document
    const f = e.target.closest("#tm-full"); // ignore the tap that lands right after «Fatta»
    if (f && !e.target.closest('[data-act="t15"]') && Date.now() - f.dataset.t < 600) e.stopImmediatePropagation();
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
    const ratio = sm.work > 0 ? Math.round(sm.rest / sm.work) : null;
    const lines = [
      `Durata ${min(sm.total)}: in serie ${min(sm.work)}, recupero ${min(sm.rest)}${sm.pauses ? `, pause ${min(sm.pauses)}` : ""}${ratio ? ` <span class="faint">(1:${ratio})</span>` : ""}`,
      sm.restN ? (sm.avgOver > 10 ? `Recuperi più lunghi del previsto di ${min(sm.avgOver)} in media` : sm.avgOver < -10 ? `Recuperi più corti del previsto di ${min(-sm.avgOver)} in media` : "Recuperi nei tempi previsti") : "",
      sm.overN ? `Sforati ${sm.overN} recuperi su ${sm.restN}${sm.worst ? `, soprattutto a ${esc(short(sm.worst))}` : ""} (fino a +${min(sm.maxOver)})` : "",
      sm.longest ? `Esercizio più lungo: ${esc(short(sm.longest[0]))}, ${min(sm.longest[1])}` : "",
      prev ? (() => { const dd = Math.round((sm.total - prev.tempi.total) / 60); return `Rispetto alla seduta ${s.day} del ${new Date(prev.date).toLocaleDateString("it-IT", { day: "numeric", month: "numeric" })}: ${dd === 0 ? "stessa durata" : Math.abs(dd) + "′ " + (dd < 0 ? "in meno" : "in più")}`; })() : "",
      sm.estN ? `${sm.estN} ${sm.estN === 1 ? "serie stimata" : "serie stimate"}: non hai toccato «Inizio la serie»` : ""
    ].filter(Boolean);
    const i = S.savedHtml.indexOf("</p>") + 4;
    S.savedHtml = S.savedHtml.slice(0, i) + `<div class="card tm-sum"><b>I tuoi tempi</b><ul class="plain">${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>` + S.savedHtml.slice(i);
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
  .tm-ph.over { background: #3a2a0a; } .tm-ph.over .tm-k, .tm-ph.over b { color: #ffb340; } .tm-ph.over .tm-track i { background: #ffb340; }
  .tm-ph.work .tm-track { display: none; }
  .tm-ph.work { grid-template-columns: 1fr; justify-items: center; text-align: center; row-gap: 2px; padding: 8px 12px; } .tm-ph.work b { justify-self: center; }
  .tm-ph.work { background: rgba(198,242,78,.14); box-shadow: inset 0 0 0 1px rgba(198,242,78,.45); } .tm-ph.work .tm-k, .tm-ph.work b { color: var(--accent); }
  .tm-15 { flex: none; min-width: 52px; min-height: 48px; border: 0; border-radius: 14px; background: var(--raised); color: var(--text); font-weight: 700; }
  .sbar.tm .fine { flex: none; }
  .sbar.tm .clock { flex: none; min-width: 0; }
  @media (max-width: 400px) {
    .sbar.tm > div { gap: 6px; } .sbar.tm .clock .small { display: none; } .sbar.tm .clock b { font-size: 16px; }
    .tm-ph { padding: 6px 10px 8px; } .tm-ph b { font-size: 18px; } .tm-k { font-size: 12px; } .tm-go { display: none; }
    .tm-15 { min-width: 44px; font-size: 13px; } .sbar.tm .fine { padding: 0 14px; font-size: 15px; }
  }
  @media (max-width: 340px) { .sbar.tm .clock { display: none; } }
  #tm-full { position: fixed; inset: 0; z-index: 40; background: #000; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: calc(64px + env(safe-area-inset-top, 0px)) 24px calc(112px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; touch-action: manipulation; cursor: pointer; animation: tmf-in .25s ease-out; }
  @keyframes tmf-in { from { opacity: 0; transform: scale(.96); } }
  .tmf-k { font-size: 15px; font-weight: 700; color: var(--accent); letter-spacing: .02em; margin-bottom: 20px; }
  .tmf-ring { position: relative; width: min(272px, 70vw); aspect-ratio: 1; }
  .tmf-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
  .tmf-ring circle { fill: none; stroke-width: 10; stroke: var(--raised); }
  .tmf-ring #tmf-arc { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  .tmf-ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: min(84px, 21vw); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
  .tmf-next { margin: 28px 0 0; font-size: 17px; line-height: 24px; color: var(--muted); max-width: 320px; text-wrap: balance; }
  .tmf-ex { color: var(--text); font-weight: 600; }
  .tmf-15 { margin-top: 20px; min-width: 88px; min-height: 44px; border: 0; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1px var(--raised); color: var(--text); font-size: 17px; font-weight: 700; }
  .tmf-foot { position: absolute; left: 24px; right: 24px; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .tmf-tot { position: absolute; top: calc(20px + env(safe-area-inset-top, 0px)); left: 24px; right: 24px; display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--accent); }
  .tmf-tot span { font-size: 13px; font-weight: 600; opacity: .8; } .tmf-tot b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tmf-go { width: 100%; max-width: 360px; min-height: 56px; border: 0; border-radius: 999px; background: var(--text); color: #000; font-size: 17px; font-weight: 700; }
  #tm-full.over .tmf-k, #tm-full.over .tmf-ring b { color: #ffb340; } #tm-full.over #tmf-arc { stroke: #ffb340; } #tm-full.over .tmf-15 { padding: 0 22px; } #tm-full.over .tmf-ring b { font-size: min(68px, 17vw); }
  @media (prefers-reduced-motion: reduce) { #tm-full { animation: none; } .tmf-ring #tmf-arc { transition: none; } }
  .tm-sum ul { margin: 6px 0 0; } .tm-sum li { margin-bottom: 6px; }`;
  document.head.appendChild(st);
})();
