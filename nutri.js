"use strict";
/* «Consigli di oggi» + flexible guide for people without a dietitian plan (team: sports nutritionist + psychologist).
   All numbers are computed here, never by the AI. With a dietitian plan: only tips around the plan, macros untouched.
   Lives in Oggi › Alimentazione. Loaded after board.js. */
(function () {
  if (typeof S === "undefined") return;
  const hasPlan = () => !!(S.diet && S.diet.fonte === "piano");
  const LEGS = /quadricip|femoral|glute|gamb|polpacc/i;
  function safetyLimited() { const pr = S.profile || {}, bmi = pr.peso && pr.altezza ? pr.peso / Math.pow(pr.altezza / 100, 2) : 22;
    const w = weights(), recent = w.filter(x => x.date >= addDays(localISO(), -21)), drop = recent.length > 2 ? (recent[0].kg - recent[recent.length - 1].kg) / recent[0].kg : 0;
    return (pr.eta && pr.eta < 18) || bmi < 18.5 || drop > 0.03; }
  function dayKind() {
    const dt0 = doneToday(), a = activeDay(), nd = nextDay();
    if (dt0 || a) return { train: true, done: !!dt0, day: (dt0 && dt0.day) || a };
    const flex = window.trainFlex && trainFlex(), m = window.weekPlanMap ? weekPlanMap() : {};
    const planned = flex ? !(window.restAdvice && restAdvice()) : !!m[new Date().getDay()];
    return { train: planned, done: false, day: flex ? nd : m[new Date().getDay()] };
  }
  const isLegs = d => d && P[d] && P[d].items.some(it => LEGS.test(it.mus || "") || LEGS.test(it.name || ""));
  function targets() { // carbs +15% on training days, the same total removed on rest days: the weekly average stays the computed one
    const T = planTargets(), n = Math.max(1, Math.min(6, DAYS.length || 3)), k = dayKind();
    if (hasPlan() || !T.cho) return { ...T, kind: k, adj: 0 };
    const restF = 1 - 0.15 * n / (7 - n), c = Math.round(T.cho * (k.train ? 1.15 : restF)), adj = c - T.cho;
    return { ...T, cho: c, kcal: Math.round((T.kcal + adj * 4) / 10) * 10, kind: k, adj };
  }
  window.dayTargets = targets;

  function tips() {
    const T = targets(), k = T.kind, it = intake(localISO()), v = dayLog(localISO()), out = [], lim = safetyLimited();
    const water = (T.waterL || 2.5) + (k.done || k.train ? 0.5 : 0), drunk = v.water * 0.25;
    if (!lim) {
      const pLeft = Math.round(T.pro - it.eaten.p), open = MEALS.filter(([mk]) => mealState(v, mk) === "open").length;
      if (pLeft > 15) out.push(`Ancora ${pLeft} g di proteine per l'obiettivo${open ? `: circa ${Math.round(pLeft / open)} g in ognuno dei ${open} pasti che restano` : ""}.`);
      else if (it.logged) out.push("Proteine di oggi quasi a posto: bene così.");
    }
    if (k.done) out.push(`Seduta ${k.day || ""} fatta: nel pasto dopo metti 30–40 g di proteine e una porzione di carboidrati, servono a recuperare.`);
    else if (k.train && !lim) out.push(isLegs(k.day) ? `Oggi tocca alle gambe: carboidrati nel pasto 2–3 ore prima della seduta, ti danno energia per le serie pesanti.` : `Giorno di allenamento: un pasto con carboidrati e proteine 2–3 ore prima, oppure uno spuntino leggero un'ora prima.`);
    else out.push(hasPlan() ? "Oggi riposo: stessi pasti del piano, servono a recuperare." : "Oggi riposo: stesse proteine, un po' meno carboidrati. Il recupero è parte dell'allenamento.");
    if (drunk < water - 0.2) out.push(`Acqua: ${fmt(drunk)} L su ${fmt(Math.round(water * 10) / 10)} L${k.done || k.train ? " (mezzo litro in più perché ti alleni)" : ""}.`);
    return out.slice(0, 3);
  }

  /* ---------- flexible guide (no dietitian plan) ---------- */
  const SLOTS = [
    ["col", "Colazione", .22, ["Yogurt greco 200 g, fiocchi d'avena 50 g, frutta", "Pane integrale 80 g, 2 uova, una spremuta", "Latte 250 ml, cereali 60 g, frutta secca 20 g"]],
    ["pra", "Pranzo", .30, ["Pasta 90 g al pomodoro, petto di pollo 150 g, verdure", "Riso 90 g, tonno o salmone 150 g, verdure e olio", "Legumi 200 g cotti, pane 60 g, insalata e olio"]],
    ["mer", "Spuntino o pre seduta", .15, ["Fette biscottate 4 con marmellata, yogurt", "Banana e 30 g di frutta secca", "Pane 60 g con bresaola 50 g"]],
    ["cen", "Cena", .28, ["Pesce 200 g, patate 250 g, verdure", "Carne magra 180 g, pane 60 g, verdure", "Frittata di 3 uova, pane 60 g, verdure"]],
    ["spu", "Extra facoltativo", .05, ["Un frutto", "Yogurt bianco", "Un quadratino di cioccolato fondente"]]
  ];
  function guide() {
    const T = targets(), k = T.kind, base = planTargets(), lim = safetyLimited(), foods = (S.foods || []).filter(f => f.per100 && f.per100.p >= 8).slice(0, 3);
    const day = k.train ? `Oggi è un giorno di allenamento: ${fmt(T.kcal)} calorie, con ${T.cho} g di carboidrati (${T.adj > 0 ? "+" : ""}${T.adj} g rispetto alla media).` : `Oggi è un giorno di riposo: ${fmt(T.kcal)} calorie, con ${T.cho} g di carboidrati (${T.adj} g rispetto alla media).`;
    return `<div class="block"><div class="card ng"><h2>La tua guida</h2><p class="small muted" style="margin:0">Una guida, non una dieta: scegli tu cosa mangiare dentro queste quote.</p>
      ${lim ? `<p>Per il tuo profilo l'app non propone quantità: per un piano su misura rivolgiti a un medico o a un dietista.</p>` : `<p style="margin:0">${day}</p>
      <div class="ng-kv"><span><b>${fmt(T.kcal)}</b>kcal</span><span><b>${T.pro} g</b>proteine</span><span><b>${T.cho} g</b>carboidrati</span><span><b>${T.fat} g</b>grassi</span></div>
      <div class="ng-slots">${SLOTS.map(([id, l, sh, ex]) => `<details class="ng-slot"><summary><b>${l}</b><span class="small muted">circa ${fmt(Math.round(T.kcal * sh / 10) * 10)} kcal · ${Math.round(T.pro * (sh >= .2 ? .27 : .1))} g proteine</span></summary><ul class="plain small">${ex.map(x => `<li>${x}</li>`).join("")}${foods.length && sh >= .2 ? `<li class="muted">Dai tuoi alimenti: ${foods.map(f => esc(f.nome)).join(", ")}</li>` : ""}</ul></details>`).join("")}</div>
      <p class="small muted" style="margin:0">Le porzioni sono indicative per circa ${fmt(base.kcal)} kcal di media: se ti alleni mangi un po' di più, a riposo un po' meno.</p>
      <ul class="plain small ng-rules"><li>Una fonte di proteine a ogni pasto.</li><li>Verdura a pranzo e a cena.</li><li>I carboidrati più vicini alla seduta.</li><li>Pesati 2 volte a settimana: se in 3 settimane il peso non va dove vuoi, Leo ti propone come correggere.</li></ul>`}</div></div>`;
  }

  function card() {
    const t = tips(); if (!t.length) return "";
    return `<div class="block"><div class="card ng"><h2>Consigli di oggi</h2><p class="small muted" style="margin:0">${hasPlan() ? "Dentro il tuo piano, senza cambiarlo." : "Una guida, non una dieta."}</p>
      <ul class="plain ng-tips">${t.map(x => `<li>${x}</li>`).join("")}</ul>
      <p class="small faint" style="margin:0">Consigli generali, non una prescrizione. Se hai un piano del dietista vale quello; per dubbi su salute o peso parla con un professionista.</p></div></div>`;
  }

  const vO = window.viewOggi;
  window.viewOggi = function () {
    const h = vO(); if (S.macro !== "food") return h;
    const add = card() + (hasPlan() ? "" : guide());
    const i = h.indexOf('<div class="block"><h2>Integratori'), j = h.lastIndexOf('<div class="block"><div class="stack"');
    const at = i >= 0 ? i : j >= 0 ? j : h.length;
    return h.slice(0, at) + add + h.slice(at);
  };
  // Profilo › Piano alimentare: point people without a plan to their guide
  const vH = window.viewPiano;
  window.viewPiano = function () { const h = vH(); if (S.hub || hasPlan()) return h;
    return h.replace(/(<h2>Piano alimentare<\/h2>[\s\S]*?<\/p>)/, `$1<p class="small muted" style="margin:6px 0 0">Non hai un piano del dietista: ti seguo con una guida flessibile. <button class="link small" data-act="guide-open">Apri la guida di oggi ›</button></p>`); };
  document.addEventListener("click", e => { if (e.target.closest('[data-act="guide-open"]')) { e.stopPropagation(); S.settings = null; S.tab = "oggi"; S.macro = "food"; lsSet("tab2", "oggi"); window.scrollTo(0, 0); render(); } }, true);

  const st = document.createElement("style");
  st.textContent = `
  .ng { gap: 10px; } .ng h2 { margin: 0; }
  .ng-tips { margin: 0; } .ng-tips li { padding: 8px 0; border-bottom: 1px solid var(--raised); } .ng-tips li:last-child { border-bottom: 0; }
  .ng-kv { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } .ng-kv span { background: var(--raised); border-radius: 12px; padding: 8px; font-size: 12px; color: var(--muted); display: flex; flex-direction: column; } .ng-kv b { font-size: 16px; color: var(--text); }
  .ng-slots { display: flex; flex-direction: column; gap: 6px; }
  .ng-slot { background: var(--surface-2); border-radius: 14px; padding: 0 12px; }
  .ng-slot summary { min-height: 52px; display: flex; flex-direction: column; justify-content: center; cursor: pointer; list-style: none; } .ng-slot summary::-webkit-details-marker { display: none; }
  .ng-slot ul { margin: 0 0 10px; } .ng-slot li { padding: 4px 0; }
  .ng-rules { margin: 0; color: var(--muted); } .ng-rules li { padding: 3px 0; }`;
  document.head.appendChild(st);
})();
