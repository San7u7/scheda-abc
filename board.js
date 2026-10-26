"use strict";
/* Customizable Oggi board: choose, hide and reorder blocks, plus new blocks (week, weight trend, records, photos, tip).
   Loaded after hub.js and before coachui.js, so the coach wraps the finished board. */
(function () {
  const W = [
    ["stats", "Calorie, proteine, acqua e peso", "I numeri del giorno"],
    ["coach", "Messaggio del coach", "Cosa fare adesso, in una riga"],
    ["session", "Prossima seduta", "Inizia o riprendi l'allenamento"],
    ["week", "La tua settimana", "Sedute fatte e in programma"],
    ["meals", "Pasti di oggi", "Spunta o registra i pasti"],
    ["weight", "Andamento del peso", "Ultimi 30 giorni"],
    ["records", "Ultimi record", "I carichi migliori del mese"],
    ["sup", "Integratori", "Spunta quelli presi"],
    ["photo", "Foto progressi", "Promemoria per la foto"],
    ["tip", "Consiglio del giorno", "Un consiglio diverso ogni giorno"]
  ];
  const DEF = { order: W.map(w => w[0]), off: ["records", "photo", "tip"] };
  const cfg = () => { const c = lsGet("board", null) || DEF, order = c.order.filter(k => W.some(w => w[0] === k)); W.forEach(w => { if (!order.includes(w[0])) order.push(w[0]); }); return { order, off: c.off || [] }; };
  const save = c => lsSet("board", c);

  const TIPS = ["Dormi 7–9 ore: il muscolo cresce mentre recuperi, non mentre ti alleni.", "Distribuisci le proteine in 4 pasti da circa 30–40 g: rende di più di due pasti enormi.", "Le ultime 2 ripetizioni devono essere dure ma pulite: lì c'è lo stimolo.", "Bevi un bicchiere d'acqua appena sveglio: parti già avanti.", "Pesati sempre nelle stesse condizioni: al mattino, dopo il bagno, prima di mangiare.", "Se un giorno salti, non recuperare doppio: riprendi dalla seduta successiva.", "Riscaldamento breve ma specifico: 2 serie leggere del primo esercizio valgono più di 10 minuti di tapis roulant.", "Scrivi i carichi: quello che misuri migliora.", "Una foto ogni 2–4 settimane, stessa luce e stessa posa: la bilancia non vede i muscoli.", "Creatina tutti i giorni, anche quelli di riposo: conta la costanza, non l'orario."];

  function week() {
    const done = weekDone(), mon = mondayOf(new Date()), today = (new Date().getDay() + 6) % 7, plan = {};
    ((S.training && S.training.sedute) || []).forEach((s, i) => { if (s.dow != null) plan[(s.dow + 6) % 7] = DAYS[i] || s.nome; });
    const L = ["L", "M", "M", "G", "V", "S", "D"];
    const cells = L.map((l, i) => { const d = done[i], p = plan[i], cls = d ? "on" : p ? (i < today ? "miss" : "plan") : "rest";
      return `<div class="wk ${cls} ${i === today ? "today" : ""}"><span class="wk-l">${l}</span><span class="wk-d">${d || p || "·"}</span></div>`; }).join("");
    const n = Object.keys(done).length, tot = Object.keys(plan).length || DAYS.length;
    return `<div class="card"><div class="block-h"><h2>La tua <span class="hl">settimana</span></h2><span class="small muted num">${n} di ${tot}</span></div><div class="wkrow">${cells}</div></div>`;
  }
  function weight() {
    const from = addDays(localISO(), -30), w = weights().filter(x => x.date >= from);
    if (w.length < 2) return `<div class="card"><h2>Andamento del <span class="hl">peso</span></h2><p class="muted">${w.length ? "Ancora una pesata e vedi la curva." : "Pesati qualche mattina a settimana e qui vedi la curva."}</p><button class="ghost" data-act="sheet" data-v="peso">Registra il peso</button></div>`;
    const ks = w.map(x => Math.round(x.kg * 10) / 10), lo = Math.min(...ks), hi = Math.max(...ks), span = hi - lo || 1, W2 = 300, H = 70;
    const pts = w.map((x, i) => `${(i / (w.length - 1) * W2).toFixed(1)},${(H - 6 - (x.kg - lo) / span * (H - 12)).toFixed(1)}`).join(" ");
    const ch = ks[ks.length - 1] - ks[0];
    return `<div class="card"><div class="block-h"><h2>Andamento del <span class="hl">peso</span></h2><span class="small muted num">${ch >= 0 ? "+" : ""}${fmt(+ch.toFixed(1))} kg in 30 giorni</span></div>
      <svg class="spark" viewBox="0 0 ${W2} ${H}" preserveAspectRatio="none" role="img" aria-label="Peso da ${fmt(ks[0])} a ${fmt(ks[ks.length - 1])} kg"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
      <div class="block-h"><span class="small muted num">${fmt(ks[0])} kg</span><button class="link small" data-act="sheet" data-v="peso">Registra oggi</button><span class="small num"><b>${fmt(ks[ks.length - 1])} kg</b></span></div></div>`;
  }
  function records() {
    const from = addDays(localISO(), -30), best = {}, recent = {};
    for (const s of S.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1)) {
      const d = localISO(new Date(s.date));
      for (const e of s.items) { const m = Math.max(0, ...e.sets.map(x => +x.kg || 0)); if (!m) continue; if (best[e.name] != null && m > best[e.name] && d >= from) recent[e.name] = { kg: m, gain: m - best[e.name], d }; best[e.name] = Math.max(best[e.name] || 0, m); }
    }
    const list = Object.entries(recent).sort((a, b) => a[1].d < b[1].d ? 1 : -1).slice(0, 3);
    return `<div class="card"><h2>Ultimi <span class="hl">record</span></h2>${list.length ? `<ul class="plain">${list.map(([n, r]) => `<li><b>${esc(short(n))}</b> ${fmt(r.kg)} kg <span class="hl">+${fmt(r.gain)}</span></li>`).join("")}</ul>` : `<p class="muted">Nessun record nell'ultimo mese. Quando chiudi un range, il carico sale e qui compare il record.</p>`}</div>`;
  }
  function photo() {
    const last = S.photos.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0], days = last ? Math.floor((Date.now() - new Date(last.date)) / 864e5) : null;
    const msg = days == null ? "Non hai ancora foto: scattane una oggi come punto di partenza." : days >= 14 ? `L'ultima foto è di ${days} giorni fa: è il momento di farne un'altra.` : `Ultima foto ${days ? days + " giorni fa" : "oggi"}. La prossima tra ${14 - days} giorni.`;
    return `<div class="card"><h2>Foto <span class="hl">progressi</span></h2><p class="muted">${msg}</p><button class="ghost" data-act="board-photo">Vai alle foto</button></div>`;
  }
  const tip = () => { const n = Math.floor(Date.now() / 864e5) % TIPS.length; return `<div class="card"><h2>Consiglio del <span class="hl">giorno</span></h2><p>${TIPS[n]}</p></div>`; };

  const base = window.viewOggi;
  window.viewOggi = function () {
    const tpl = document.createElement("template"); tpl.innerHTML = base();
    const parts = {}, head = [];
    for (const el of [...tpl.content.children]) {
      const h = el.outerHTML;
      if (!el.classList.contains("block")) head.push(h);
      else if (h.includes("coach-line")) parts.coach = h;
      else if (h.includes("pcard") || h.includes("Nessuna scheda")) parts.session = h;
      else if (h.includes('data-act="meal')) parts.meals = h;
      else if (h.includes("<h2>Integratori")) parts.sup = h;
      else if (!parts.stats) parts.stats = h;
      else head.push(h);
    }
    const gen = { week, weight, records, photo, tip }, c = cfg();
    const body = c.order.filter(k => !c.off.includes(k)).map(k => parts[k] || (gen[k] ? `<div class="block">${gen[k]()}</div>` : "")).join("");
    return head.join("") + body + `<div class="block" style="display:flex;justify-content:center"><button class="ghost sm" data-act="board-edit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>Personalizza questa schermata</button></div>`;
  };

  const prevSheet = window.renderSheet;
  window.renderSheet = function () {
    if (S.sheet !== "board") return prevSheet();
    const c = cfg(), o = $("#overlay");
    const rows = c.order.map((k, i) => { const w = W.find(x => x[0] === k), on = !c.off.includes(k);
      return `<div class="brow ${on ? "" : "off"}"><button class="bsw" data-act="board-tog" data-v="${k}" role="switch" aria-checked="${on}" aria-label="Mostra ${w[1]}"><span></span></button><span class="b-t"><b>${w[1]}</b><small>${w[2]}</small></span>
        <button class="icon-btn sm" data-act="board-mv" data-v="${k}" data-d="-1" aria-label="Sposta su" ${i ? "" : "disabled"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg></button>
        <button class="icon-btn sm" data-act="board-mv" data-v="${k}" data-d="1" aria-label="Sposta giù" ${i < c.order.length - 1 ? "" : "disabled"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div>`; }).join("");
    o.innerHTML = `<div class="scrim" data-act="close"><div class="sheet full" role="dialog" aria-modal="true" aria-label="Personalizza Oggi"><div class="grab"></div>
      <h2>Personalizza <span class="hl">Oggi</span></h2><p class="muted">Accendi i blocchi che ti servono e mettili nell'ordine che preferisci. Il resto dell'app non cambia.</p>
      <div class="blist">${rows}</div>
      <button class="primary" data-act="close">Fatto</button><button class="link small" data-act="board-reset" style="align-self:center">Ripristina come all'inizio</button></div></div>`;
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === "board-edit") { S.sheet = "board"; renderSheet(); }
    else if (act === "board-tog") { const c = cfg(); c.off = c.off.includes(v) ? c.off.filter(x => x !== v) : [...c.off, v]; save(c); renderSheet(); render(); }
    else if (act === "board-mv") { const c = cfg(), i = c.order.indexOf(v), j = i + +b.dataset.d; if (j < 0 || j >= c.order.length) return; [c.order[i], c.order[j]] = [c.order[j], c.order[i]]; save(c); renderSheet(); render(); }
    else if (act === "board-reset") { save(DEF); renderSheet(); render(); }
    else if (act === "board-photo") { S.tab = "progressi"; S.psub = "foto"; lsSet("tab2", S.tab); render(); setTimeout(() => { const h = [...document.querySelectorAll("h2")].find(x => x.textContent === "Dettagli"); if (h) h.scrollIntoView({ behavior: "smooth" }); }, 50); }
  }, true);

  const st = document.createElement("style");
  st.textContent = `
  .wkrow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .wk { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wk-l { font-size: 12px; color: var(--muted); }
  .wk-d { width: 100%; aspect-ratio: 1; max-width: 42px; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: 15px; background: var(--surface-2); color: var(--faint); }
  .wk.on .wk-d { background: var(--accent); color: var(--lime-ink); }
  .wk.plan .wk-d { border: 2px solid var(--accent); background: none; color: var(--accent); }
  .wk.miss .wk-d { border: 2px dashed var(--control); background: none; color: var(--muted); }
  .wk.today .wk-l { color: var(--text); font-weight: 700; }
  .spark { width: 100%; height: 70px; display: block; }
  .blist { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 4px; }
  .brow { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border-radius: 16px; padding: 8px 8px 8px 12px; }
  .brow.off .b-t { opacity: .5; }
  .b-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .b-t small { color: var(--muted); font-size: 12px; }
  .icon-btn.sm { width: 40px; height: 40px; } .icon-btn[disabled] { opacity: .3; }
  .bsw { flex: none; width: 50px; height: 30px; border-radius: 999px; border: 0; background: var(--control); position: relative; padding: 0; }
  .bsw span { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 999px; background: #fff; transition: transform .18s; }
  .bsw[aria-checked="true"] { background: var(--accent); }
  .bsw[aria-checked="true"] span { transform: translateX(20px); background: var(--lime-ink); }
  [data-act="board-edit"] { display: inline-flex; align-items: center; gap: 8px; }`;
  document.head.appendChild(st);
})();
