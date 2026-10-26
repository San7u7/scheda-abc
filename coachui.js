"use strict";
/* Coach everywhere: floating button with Leo's face, full-screen chat, auto-tuned persona (editable in Piano),
   per-screen guidance, first-visit guides, streak, records and nudges. Loaded last. */
(function () {
  const AVATAR = (size = 44) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="var(--accent)"/><path d="M8 17.5c4.5-3.2 10-4.8 16-4.8s11.5 1.6 16 4.8v4.4c-4.6-3-10-4.5-16-4.5s-11.4 1.5-16 4.5z" fill="#0a0a0a"/><rect x="21" y="13.6" width="6" height="3.6" rx="1" fill="var(--accent)"/><circle cx="18" cy="27" r="2.6" fill="#0a0a0a"/><circle cx="30" cy="27" r="2.6" fill="#0a0a0a"/><path d="M17 33c2 3 4.3 4.2 7 4.2s5-1.2 7-4.2" fill="none" stroke="#0a0a0a" stroke-width="2.8" stroke-linecap="round"/></svg>`;
  window.coachAvatar = AVATAR;

  /* ---------- persona: automatic from profile and documents, editable ---------- */
  const OPTS = {
    tono: [["rassicurante", "Calmo e rassicurante"], ["motivante", "Motivante ed energico"], ["tecnico", "Diretto e tecnico"]],
    risposte: [["brevi", "Brevi"], ["dettagliate", "Dettagliate"]],
    focus: [["ipertrofia", "Massa muscolare"], ["forza", "Forza"], ["definizione", "Definizione"], ["salute", "Salute e benessere"]],
    proattivo: [["spesso", "Ogni giorno"], ["eventi", "Dopo sedute e novità"], ["mai", "Solo quando chiedo"]]
  };
  function autoPersona() {
    const pr = S.profile || {}, why = [];
    const lvl = pr.livello || "intermedio", goal = pr.obiettivo || "mantenimento";
    const tono = lvl === "principiante" ? "rassicurante" : lvl === "avanzato" ? "tecnico" : "motivante";
    why.push(`Tono «${OPTS.tono.find(x => x[0] === tono)[1].toLowerCase()}» perché il tuo livello è ${lvl}.`);
    const risposte = lvl === "principiante" ? "dettagliate" : "brevi";
    why.push(`Risposte ${risposte} per il tuo livello.`);
    const focus = goal === "massa" ? "ipertrofia" : goal === "definizione" ? "definizione" : "salute";
    why.push(`Obiettivo «${OPTS.focus.find(x => x[0] === focus)[1].toLowerCase()}» dal profilo.`);
    if (S.diet && S.diet.fonte === "piano") why.push("Rispetta il piano alimentare caricato senza cambiarlo.");
    else why.push("L'alimentazione segue l'obiettivo calcolato dall'app.");
    if (S.training && S.training.sedute && S.training.sedute.length) why.push(`Conosce la tua scheda: ${S.training.sedute.length} sedute a settimana.`);
    return { nome: "Leo", tono, risposte, focus, proattivo: "spesso", why };
  }
  function persona() { const a = autoPersona(), c = (S.profile && S.profile.coach) || {}; return { ...a, ...c, why: a.why, custom: !!(S.profile && S.profile.coach) }; }
  function savePersona(patch) { S.profile = S.profile || {}; S.profile.coach = patch ? { ...(S.profile.coach || {}), ...patch } : undefined; if (!patch) delete S.profile.coach; persistDoc("profile", S.profile); }
  const baseCtx = window.coachContext;
  window.coachContext = function () {
    const p = persona(), name = (S.profile && S.profile.nome) || "";
    const tone = { rassicurante: "calmo, caldo e rassicurante: normalizza le difficoltà e dai sicurezza", motivante: "energico e motivante: riconosci i progressi e spingi con entusiasmo misurato", tecnico: "diretto e tecnico: numeri, cause ed effetti, niente giri di parole" }[p.tono];
    return `PERSONA DEL COACH: ti chiami ${p.nome}. Dai del tu${name ? " a " + name : ""}. Tono ${tone}. Risposte ${p.risposte === "brevi" ? "brevi (massimo 100 parole)" : "dettagliate ma ordinate (massimo 220 parole)"}. Obiettivo prioritario: ${OPTS.focus.find(x => x[0] === p.focus)[1].toLowerCase()}. Non nominare mai il modello o il fornitore dell'intelligenza artificiale: sei solo ${p.nome}. Chiudi quando utile con un'azione concreta che l'app può aiutare a fare (es. «segna il pasto», «apri la seduta B»).\n\n` + baseCtx();
  };

  /* ---------- engagement: streak, records, nudges ---------- */
  const bests = () => { const m = {}; for (const s of S.sessions) for (const e of s.items) for (const x of e.sets) if (x.kg != null && +x.kg > (m[e.name] || 0)) m[e.name] = +x.kg; return m; };
  function nudge(text) { const p = persona(); if (p.proattivo === "mai") return; S.nudge = { text, at: Date.now(), seen: false }; lsSet("nudge", S.nudge); paintFab(); }
  S.nudge = lsGet("nudge", null);
  const baseFinish = window.finish;
  function suspicious() {
    const day = activeDay(); if (!day) return [];
    const b = bests(), d = draft(day), out = [];
    for (const it of P[day].items) {
      if (it.unit === "none") continue;
      const prev = Math.max(b[exName(it)] || 0, +((S.state.ex[exKey(it)] || {}).kg) || 0); if (!prev) continue;
      const kgs = (d.sets[it.id] || []).filter(x => x.done && x.kg !== "" && x.kg != null).map(x => +x.kg); if (!kgs.length) continue;
      const mx = Math.max(...kgs); if (mx > prev * 1.5) out.push({ name: exName(it), kg: mx, prev });
    }
    return out;
  }
  window.finish = async function (meta) {
    const sus = meta && meta._ok ? [] : suspicious();
    if (sus.length) { S.kgcheck = { meta, sus }; S.sheet = "kgcheck"; renderSheet(); return; }
    if (meta) delete meta._ok;
    const before = bests(); await baseFinish(meta);
    const after = bests(), recs = Object.keys(after).filter(k => before[k] != null && after[k] > before[k]).map(k => `${short(k)} ${fmt(after[k])} kg (+${fmt(after[k] - before[k])})`);
    const last = S.sessions[S.sessions.length - 1];
    if (recs.length) { const i = S.savedHtml.indexOf("</p>") + 4; S.savedHtml = S.savedHtml.slice(0, i) + `<div class="card lime"><b>Nuovi record</b><ul class="plain">${recs.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>` + S.savedHtml.slice(i); renderSheet(); }
    nudge(`Seduta ${last ? last.day : ""} salvata: bel lavoro${S.profile && S.profile.nome ? ", " + S.profile.nome : ""}. ${recs.length ? `Hai battuto ${recs.length === 1 ? "un record" : recs.length + " record"}: ${recs[0]}. ` : ""}Ricordati proteine e acqua nelle prossime ore.`);
  };
  function morning() {
    const p = persona(), key = localISO(); if (p.proattivo === "mai" || lsGet("morning", "") === key || !S.profile) return;
    lsSet("morning", key);
    const nm = S.profile.nome ? " " + S.profile.nome : "", last = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
    const gap = last ? Math.floor((Date.now() - new Date(last.date)) / 864e5) : 0, nd = nextDay(), dw = new Date().getDay();
    const plan = window.weekPlanMap ? weekPlanMap() : {};
    const done = weekDone(), today = (dw + 6) % 7, DN = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
    const missed = Object.keys(plan).map(Number).filter(d => { const i = (d + 6) % 7; return i < today && !done[i]; });
    if (gap >= 7) return nudge(`Bentornato${nm}. Ripartiamo con calma: nella prossima seduta usa circa il 90% dei carichi, poi si torna al ritmo di prima.`);
    if (dw === 0) { const n = Object.keys(done).length, tot = Object.keys(plan).length || DAYS.length; return nudge(`Settimana chiusa: ${n} ${n === 1 ? "seduta" : "sedute"} su ${tot}. Su cosa vuoi concentrarti la prossima: proteine, sonno o carichi? Scrivimelo e ti preparo un piccolo obiettivo.`); }
    if (missed.length && nd && !done[today]) return nudge(`${DN[missed[missed.length - 1]].charAt(0).toUpperCase() + DN[missed[missed.length - 1]].slice(1)} è saltato, capita. Oggi puoi fare la seduta ${nd}, oppure tocca «Sposta la settimana» in Oggi e le sistemo io.`);
    if (p.proattivo === "spesso") nudge(`Ciao${nm}! ${coachLine().replace(/<[^>]+>/g, "")}`);
  }

  /* ---------- floating coach button ---------- */
  const fab = document.createElement("button");
  fab.className = "coach-fab"; fab.setAttribute("data-act", "coach-open"); fab.setAttribute("aria-label", "Parla con il coach");
  document.body.appendChild(fab);
  function paintFab() {
    const hidden = !S.profile || !!S.ob || !!S.sheet || !!S.boardEdit;
    fab.hidden = hidden;
    fab.innerHTML = AVATAR(56) + (S.nudge && !S.nudge.seen ? '<span class="fab-dot" aria-hidden="true"></span>' : "");
    fab.classList.toggle("insession", typeof inSession === "function" && inSession());
  }

  /* ---------- chat sheet with face, context prompts and the latest nudge ---------- */
  function contextPrompts() {
    const t = S.tab, a = typeof activeDay === "function" && activeDay();
    if (a) return ["Questo esercizio mi fa male: cosa faccio?", "La macchina è occupata: con cosa lo sostituisco?", "Che carico uso oggi?", "Sono stanco: posso accorciare la seduta?"];
    if (t === "allenamento") return ["Quale seduta faccio oggi?", "Come mi scaldo prima di iniziare?", "Spiegami la doppia progressione", "Ho saltato una seduta: come recupero?"];
    if (t === "progressi") return ["Sto progredendo bene?", "Perché il peso non sale?", "Cosa miglioro questa settimana?", "Fai il punto della settimana"];
    if (t === "piano") return ["Come modifico la scheda?", "Il mio piano alimentare va bene per il mio obiettivo?", "Cosa significa RIR?", "Come carico una nuova scheda?"];
    return ["Fai il punto della settimana", "Cosa mangio prima e dopo la seduta?", "Mi mancano calorie: come le recupero?", "Pranzo fuori casa: come resto in linea?"];
  }
  const prevSheet = window.renderSheet;
  window.renderSheet = function () {
    if (S.sheet === "kgcheck") {
      const k = S.kgcheck;
      $("#overlay").innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Controlla i carichi"><div class="grab"></div>
        <h2>Controlla i carichi</h2><p class="muted">${k.sus.length === 1 ? "Questo carico è molto più alto" : "Questi carichi sono molto più alti"} dell'ultima volta. Se è giusto, è un record.</p>
        <ul class="plain">${k.sus.map(x => `<li><b>${esc(short(x.name))}: ${fmt(x.kg)} kg</b>, giusto? <span class="muted">L'ultima volta ${fmt(x.prev)} kg.</span></li>`).join("")}</ul>
        <button class="primary" data-act="kg-ok">Sì, è giusto: salva</button><button class="ghost" data-act="kg-fix">Correggi</button></div></div>`;
      paintFab(); return;
    }
    if (S.sheet !== "chat") { const r = prevSheet(); paintFab(); return r; }
    const o = $("#overlay"), p = persona(), msgs = S.chat.msgs, n = S.nudge;
    if (n) { n.seen = true; lsSet("nudge", n); }
    const bubble = n && Date.now() - n.at < 36 * 3600e3 ? `<div class="msg assistant"><p>${esc(n.text)}</p></div>` : "";
    const hello = !msgs.length && !bubble ? `<div class="msg assistant"><p>Ciao${S.profile && S.profile.nome ? " " + esc(S.profile.nome) : ""}, sono ${esc(p.nome)}. Conosco la tua scheda, il tuo piano e i tuoi dati: chiedimi qualsiasi cosa su allenamento, alimentazione o recupero.</p></div>` : "";
    o.innerHTML = `<div class="scrim" data-act="close"><div class="sheet full chat" role="dialog" aria-modal="true" aria-label="Chat con il coach"><div class="grab"></div>
      <div class="coach-head">${AVATAR(48)}<div><b>${esc(p.nome)}</b><small>Il tuo coach · ${S.sample ? "in linea" : "attiva l'AI per parlarmi"}</small></div><button class="link small" data-act="close" style="padding:0;margin-left:auto">Chiudi</button></div>
      <div class="thread" id="thread">${hello}${bubble}${msgs.map(m => `<div class="msg ${m.role}">${m.role === "user" ? esc(m.content) : fmtChat(m.content)}</div>`).join("")}${S.coachBusy ? `<div class="msg assistant" id="live">${S.coachLive ? fmtChat(S.coachLive) : '<p class="faint">Sto pensando…</p>'}</div>` : ""}</div>
      ${S.sample ? `<div class="chips cprompts">${contextPrompts().map(q => `<button class="ghost" data-act="ask" data-v="${esc(q)}" ${S.coachBusy ? "disabled" : ""}>${esc(q)}</button>`).join("")}</div>
      <form class="ask" data-act="askform"><textarea id="q" rows="1" placeholder="Scrivi a ${esc(p.nome)}…" aria-label="Domanda per il coach"></textarea><button class="primary" type="submit" ${S.coachBusy ? "disabled" : ""}>Invia</button></form>
      ${msgs.length && !S.coachBusy ? `<button class="link small" data-act="chatclear" style="align-self:center">Nuova conversazione</button>` : ""}` : (typeof aiKeyBox === "function" ? aiKeyBox() : `<div class="alert">Il coach risponde quando l'AI è attiva.</div>`)}
      <p class="small faint">Consigli generali: per dolori o dubbi di salute senti il medico; per cambiare la dieta, chi te l'ha prescritta.</p></div></div>`;
    const sh = o.querySelector(".sheet"); if (sh) sh.scrollTop = sh.scrollHeight;
    paintFab();
  };

  /* ---------- per-screen guidance and first-visit guides ---------- */
  const GUIDES = {
    oggi: ["Questa è la tua giornata", "In alto calorie, proteine, acqua e peso: toccali per i dettagli. Sotto trovi la prossima seduta e i pasti: scorri le card e spunta quelli fatti."],
    allenamento: ["Le tue sedute", "Tocca una card per vedere esercizi e carichi, poi «Inizia seduta». Durante la seduta un esercizio alla volta, con animazione, consigli e «Sostituisci» se l'attrezzo è occupato."],
    progressi: ["I tuoi progressi", "Scegli il periodo in alto. I riquadri riassumono sedute, volume, calorie e peso; tocca una seduta recente per rivederla."],
    piano: ["Il centro di controllo", "Qui cambi la scheda, il piano alimentare, i tuoi alimenti, il profilo e il modo in cui ti parlo. Ogni modifica vale subito in tutta l'app."]
  };
  function guideHtml(tab) {
    return ""; // replaced by one-line subtitles (psychologist review): guides pushed the content down
    const g = GUIDES[tab]; if (!g || lsGet("seen_" + tab, false)) return "";
    return `<div class="guide"><div class="g-h">${AVATAR(34)}<b>${g[0]}</b></div><p>${g[1]}</p><button class="ghost sm" data-act="guide-ok" data-v="${tab}">Ho capito</button></div>`;
  }
  function screenLine(tab) {
    const p = persona(); if (p.proattivo === "mai") return "";
    let t = "";
    if (tab === "progressi") { const wk = Object.keys(weekDone()).length, tot = DAYS.length || 3, ws = window.weekStreak ? weekStreak() : { n: 0 };
      t = wk >= tot ? `Settimana completa: ${wk} sedute su ${tot}.${ws.n >= 2 ? ` Sono ${ws.n} settimane complete di fila.` : ""}` : `Questa settimana ${wk} ${wk === 1 ? "seduta" : "sedute"} su ${tot}.${ws.n >= 2 ? ` Serie in corso: ${ws.n} settimane complete.` : ""}`; }
    if (tab === "piano") t = `Mi sono regolato in automatico sul tuo profilo e sui documenti caricati. Se vuoi, cambia come ti parlo nella card «Il tuo coach».`;
    return t ? `<button class="cline" data-act="coach-open">${AVATAR(30)}<span>${esc(t)}</span></button>` : "";
  }
  const inject = (html, extra) => { if (!extra) return html; const i = html.indexOf("</h1>"); if (i < 0) return extra + html; const j = html.indexOf("</p>", i); const at = j > 0 && j - i < 400 ? j + 4 : i + 5; return html.slice(0, at) + extra + html.slice(at); };

  const vO = window.viewOggi;
  window.viewOggi = function () {
    return vO();
  };
  const vA = window.viewAllenamento;
  window.viewAllenamento = function () { const html = vA(); if (typeof activeDay === "function" && activeDay()) return html; return html; };
  const vP = window.viewProgress;
  window.viewProgress = function () { return inject(vP(), screenLine("progressi") + guideHtml("progressi")); };
  const vH = window.viewPiano;
  window.viewPiano = function () { return vH(); };
  window.coachSettingsView = () => coachSettings();
  window.coachNudge = t => nudge(t);
  window.coachCard = function () {
    const p = persona();
    const card = `<div class="block"><div class="hcard coach-card"><div class="hc-h">${AVATAR(42)}<div><h2>Il tuo coach: ${esc(p.nome)}</h2><p class="small muted">${OPTS.tono.find(x => x[0] === p.tono)[1]} · risposte ${p.risposte} · ${OPTS.focus.find(x => x[0] === p.focus)[1].toLowerCase()}</p></div></div>
      <p class="small muted">${p.custom ? "Impostazioni scelte da te." : "Impostato in automatico in base al profilo e ai documenti caricati: è un consiglio, puoi cambiarlo."}</p>
      <div class="hc-acts"><button class="primary go" data-act="set-sub" data-v="coach">Regola il coach</button><button class="ghost" data-act="coach-open">Parla con ${esc(p.nome)}</button></div></div></div>`;
    return card;
  };
  function coachSettings() {
    const p = persona(), seg = (k, opts) => `<div class="seg wrap" role="group">${opts.map(([v, l]) => `<button data-act="coach-set" data-k="${k}" data-v="${v}" aria-pressed="${p[k] === v}">${l}</button>`).join("")}</div>`;
    return `<button class="back" data-act="hub" data-v=""><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>Piano</button>
      <div class="coach-hero">${AVATAR(72)}<div><h1>Regola <span class="hl">${esc(p.nome)}</span></h1><p class="muted">Come ti parla e quanto ti segue.</p></div></div>
      <div class="block"><div class="hcard"><h2>Perché è impostato così</h2><ul class="plain muted">${p.why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>${p.custom ? `<button class="ghost" data-act="coach-reset">Torna all'impostazione automatica</button>` : ""}</div></div>
      <div class="block"><div class="hcard"><div class="field"><label for="co-nome">Nome del coach</label><input type="text" id="co-nome" value="${esc(p.nome)}" autocomplete="off"></div><button class="ghost sm" data-act="coach-name">Salva il nome</button></div></div>
      <div class="block"><h2>Tono</h2>${seg("tono", OPTS.tono)}</div>
      <div class="block"><h2>Risposte</h2>${seg("risposte", OPTS.risposte)}</div>
      <div class="block"><h2>Obiettivo su cui insistere</h2>${seg("focus", OPTS.focus)}</div>
      <div class="block"><h2>Quanto spesso ti scrive</h2>${seg("proattivo", OPTS.proattivo)}<p class="small muted">Con «Ogni giorno» ti saluta al mattino con il programma; con «Dopo sedute e novità» solo quando c'è qualcosa da dirti.</p></div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "kg-ok") { const m = S.kgcheck.meta || {}; S.sheet = null; S.kgcheck = null; finish({ ...m, _ok: true }); }
    else if (act === "kg-fix") { S.sheet = null; S.kgcheck = null; renderSheet(); render(); }
    else if (act === "coach-open") { S.chatOpen = true; S.sheet = "chat"; renderSheet(); }
    else if (act === "guide-ok") { lsSet("seen_" + v, true); render(); }
    else if (act === "coach-set") { savePersona({ [b.dataset.k]: v }); render(); toast("Coach aggiornato"); }
    else if (act === "coach-reset") { savePersona(null); render(); toast("Impostazione automatica ripristinata"); }
    else if (act === "coach-name") { const n = ($("#co-nome").value || "").trim().slice(0, 20); if (n) { savePersona({ nome: n }); render(); toast(`Ora mi chiamo ${n}`); } }
  }, true);

  const baseRender = window.render;
  window.render = function () { baseRender(); paintFab(); };

  const st = document.createElement("style");
  st.textContent = `
  .coach-fab { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(76px + env(safe-area-inset-bottom, 0px)); z-index: 8; width: 60px; height: 60px; border-radius: 999px; border: 0; padding: 2px; background: #000; box-shadow: 0 8px 24px rgba(0,0,0,.55); display: grid; place-items: center; transition: transform .15s; }
  .coach-fab:active { transform: scale(.94); }
  .coach-fab.insession { right: auto; left: calc(50% - 26px); bottom: calc(8px + env(safe-area-inset-bottom, 0px)); width: 52px; height: 52px; }
  .coach-fab.insession svg { width: 48px; height: 48px; }
  .fab-dot { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 999px; background: var(--accent); border: 3px solid #000; box-shadow: 0 0 0 2px var(--accent); }
  .sync { display: none !important; }
  .wrap { padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)); }
  body.nobar .wrap { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
  .coach-head { display: flex; align-items: center; gap: 12px; }
  .coach-head small { display: block; color: var(--muted); font-size: 12px; }
  .sheet.chat .msg.assistant { background: var(--raised); }
  .cprompts .ghost { font-size: 13px; }
  .cline { width: 100%; display: flex; gap: 10px; align-items: center; text-align: left; border: 0; background: var(--surface); color: var(--text); border-radius: 18px; padding: 10px 12px; margin-top: 14px; font-size: 14px; line-height: 20px; }
  .cline svg { flex: none; }
  .guide { background: var(--raised); border-radius: 20px; padding: 14px; margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .g-h { display: flex; gap: 10px; align-items: center; }
  .guide p { margin: 0; color: var(--muted); }
  .guide .ghost { align-self: flex-start; }
  .streak-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .streak { flex: none; background: var(--accent); color: var(--lime-ink); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 700; }
  .streak b { font-weight: 800; }
  .coach-card .hc-h svg { flex: none; }
  .coach-hero { display: flex; gap: 14px; align-items: center; margin-top: 8px; }
  .coach-hero svg { flex: none; }
  .seg.wrap { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; background: none; border: 0; }
  .seg.wrap button { flex: 0 1 auto; padding: 10px 16px; min-height: 44px; height: auto; border-radius: 999px; border: 1px solid var(--control); background: none; color: var(--text); font-weight: 600; }
  .seg.wrap button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--lime-ink); }
  `;
  document.head.appendChild(st);
  setTimeout(() => { morning(); render(); }, 50);
})();
