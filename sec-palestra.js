"use strict";
/* Askesis v3 · sezione «palestra» (FASE 2). Regole e API: V3_CONTRATTO.md.
   Home Palestra (seduta di oggi, sedute della scheda, «Modifica la scheda», settimana, «Lo sapevi?» + Leo),
   anteprima della seduta, riscaldamento e stretching finale guidati passo per passo.
   La seduta vera e propria (serie, recupero a tutto schermo di timer.js, fine seduta) resta la vista vecchia:
   con una seduta in corso render() restituisce false. Avvio della seduta = stesso data-act="start" della vista vecchia.
   Nessuna scrittura su S o localStorage da questo file. */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3;
  const e = ui.esc;
  const IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

  /* ---------- stato interno (mai in S) ---------- */
  let sub = null;        // null | "seduta" | "warm" | "settimana" | "routine"
  const stackSubs = [];  // pagine interne aperte da questa sezione, per tornare indietro allo stato giusto
  let selDay = null;     // seduta mostrata nell'anteprima
  let W = null;          // passo guidato: { kind: "risc"|"stretch", day, i, quick, left, run }
  let tick = null, pendingStart = null;

  /* ---------- stile di sezione ---------- */
  if (!document.getElementById("v3-sec-palestra")) {
    const st = document.createElement("style");
    st.id = "v3-sec-palestra";
    st.textContent = `
    #view.v3 .v3-palestra-hero { background: var(--v3-s1); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: inset 0 0 0 2px var(--v3-lime); }
    #view.v3 .v3-palestra-ht { font-size: 22px; font-weight: 800; line-height: 1.2; }
    #view.v3 .v3-palestra-hs { font-size: 16px; color: var(--v3-t2); line-height: 1.35; margin-top: 4px; }
    #view.v3 .v3-palestra-hm { font-size: 16px; font-weight: 700; margin-top: 8px; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-palestra-note { font-size: 16px; color: var(--v3-t2); line-height: 1.35; }
    #view.v3 .v3-palestra-list { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-palestra-ex { background: var(--v3-s1); border-radius: 18px; min-height: 72px; padding: 10px 14px 10px 10px; display: flex; align-items: center; gap: 12px; box-sizing: border-box; }
    #view.v3 .v3-palestra-im { width: 56px; height: 56px; flex: none; border-radius: 12px; overflow: hidden; background: var(--v3-s2); position: relative; }
    #view.v3 .v3-palestra-im img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #view.v3 .v3-palestra-im span { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: var(--v3-t3); }
    #view.v3 .v3-palestra-im.noimg img { display: none; } #view.v3 .v3-palestra-im.noimg span { display: flex; }
    #view.v3 .v3-palestra-up { display: inline-block; margin-top: 4px; font-size: 14px; font-weight: 700; color: var(--v3-ink); background: var(--v3-t1); border-radius: 10px; padding: 2px 8px; }
    #view.v3 .v3-palestra-wtop { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    #view.v3 .v3-palestra-wc { font-size: 16px; color: var(--v3-t2); text-align: right; }
    #view.v3 .v3-palestra-wn { font-size: 28px; font-weight: 800; line-height: 1.15; }
    #view.v3 .v3-palestra-wh { font-size: 18px; font-weight: 700; margin-top: 6px !important; line-height: 1.35; }
    #view.v3 .v3-palestra-clock { text-align: center; padding: 12px 0; }
    #view.v3 .v3-palestra-clock b { display: block; font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.05; }
    #view.v3 .v3-palestra-clock span { display: block; font-size: 16px; color: var(--v3-t2); margin-top: 6px; }
    #view.v3 .v3-palestra-wfull { display: flex; flex-direction: column; gap: 24px; min-height: calc(100vh - var(--v3-bar) - 136px); min-height: calc(100dvh - var(--v3-bar) - 136px); }
    #view.v3 .v3-palestra-wfull .v3-palestra-acts { margin-top: auto; }
    #view.v3 .v3-palestra-acts { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-palestra-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    #view.v3 .v3-palestra-tool { min-height: 48px; border-radius: 24px; border: 0; background: var(--v3-s2); color: var(--v3-t1); font-size: 15px; font-weight: 600; padding: 8px 12px; line-height: 1.2; }
    #view.v3.v3-o65 .v3-palestra-tool, #view.v3.v3-o65 .v3-palestra-up { font-size: 16px; }
    #view.v3 .v3-palestra-fig { display: flex; justify-content: center; }
    #view.v3 .v3-palestra-fig .v3-fig { width: 160px; height: 160px; }
    `;
    document.head.appendChild(st);
  }

  /* ---------- utilità (sola lettura dei dati dell'app) ---------- */
  const has = fn => typeof window[fn] === "function";
  const group = () => data.profile().group;
  const kid = () => group() === "bambino";
  const pl = (n, one, many) => n + " " + (n === 1 ? one : many);
  const minsOf = p => Math.max(10, Math.round(p.items.reduce((m, it) => m + it.sets * (it.rest + 40), 0) / 300) * 5);
  const nameOf = it => { const n = has("exName") ? exName(it) : it.name; return typeof short === "function" ? short(n) : n; };
  const planOf = it => { try { return plan(it); } catch (_) { return { kg: it.kg, up: false, b: {} }; } };
  const upsOf = p => p.items.filter(it => planOf(it).up).length;
  const kgTxt = n => ui.nf(n, 2);
  function imgOf(it) {
    let id = null; try { id = has("demoFor") ? demoFor(it) : it.demo; } catch (_) {}
    return id ? IMG + encodeURIComponent(id) + "/0.jpg" : null;
  }
  const thumb = (it, letter) => { const src = imgOf(it); return `<div class="v3-palestra-im${src ? "" : " noimg"}">${src ? `<img src="${e(src)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg')">` : ""}<span aria-hidden="true">${e(letter || "")}</span></div>`; };
  function weekSessions() {
    const from = data.week().from, to = data.week().to, iso = d => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    return S.sessions.filter(s => { const d = iso(s.date); return d >= from && d <= to; });
  }
  const doneWeek = k => weekSessions().some(s => s.day === k);
  const primary = (label, attrs) => `<button class="v3-apri wide" ${attrs}>${e(label)}</button>`;

  const SAP = {
    adulto: ["Il riposo fa parte del piano: è lì che il muscolo si ripara e cresce.", "Più ripetizioni pulite valgono più di un chilo in più.", "Scendere lenti stimola la crescita quanto salire.", "Lavorare un lato alla volta corregge gli squilibri.", "Il riscaldamento prepara articolazioni e muscoli: rende di più la prima serie."],
    bambino: ["Prima si impara bene il movimento, poi si diventa forti.", "Quando muovi il bastone piano, i muscoli imparano il gesto giusto.", "Anche il riposo serve: i muscoli crescono mentre giochi e dormi."],
    over65: ["Respira sempre: non trattenere il fiato mentre spingi.", "Allenare la forza aiuta l'equilibrio e protegge dalle cadute.", "Un riscaldamento più lungo rende le articolazioni più morbide."]
  };
  const sapText = () => { const L = SAP[group()] || SAP.adulto, n = Math.floor(Date.now() / 864e5); return L[n % L.length]; };
  const leoQ = () => kid() ? "Perché devo fare piano i movimenti?" : "Come capisco se oggi posso salire di peso?";

  function ageRow() {
    const g = group();
    if (g === "bambino") return ui.row({ title: "Sempre con un adulto vicino", sub: "I chili li decide il tuo preparatore." });
    if (g === "ragazzo") return ui.row({ title: "Meglio con chi ti segue", sub: "Prima di salire di peso, chiedi all'istruttore." });
    if (g === "over65") return ui.row({ title: "Respiro libero, mai trattenuto", sub: "Capogiro o dolore al petto: fermati subito." });
    return "";
  }

  /* ---------- passi guidati: riscaldamento e stretching finale ---------- */
  const DIN = [["Rotazioni delle braccia", "10 avanti e 10 indietro", ["Braccia tese, cerchi ampi.", "Spalle basse."]],
    ["Cerchi con le anche", "10 per lato", ["Mani sui fianchi.", "Cerchi lenti e ampi."]],
    ["Slanci delle gambe", "10 avanti e 10 di lato, per gamba", ["Tieniti a un appoggio.", "Slancio morbido, senza strappi."]],
    ["Affondi con torsione", "5 per lato", ["Passo lungo, ginocchio sopra la caviglia.", "Ruota il busto verso la gamba davanti."]],
    ["Gatto e mucca", "8 volte, a quattro zampe", ["Inarca e arrotonda la schiena.", "Movimento lento."]],
    ["Piegamenti dell'anca a corpo libero", "10 volte, schiena dritta", ["Bacino indietro.", "Schiena dritta."]]];
  const STAT = [["Dietro le cosce", "Seduto, gamba tesa, 30 secondi per lato"], ["Quadricipiti", "In piedi, tallone al sedere, 30 secondi per lato"],
    ["Glutei", "Sdraiato, caviglia sul ginocchio, 30 secondi per lato"], ["Petto", "Avambraccio alla parete, 30 secondi per lato"],
    ["Schiena", "Seduto sui talloni, braccia avanti, 30 secondi"], ["Polpacci", "Mani al muro, gamba dietro tesa, 30 secondi per lato"]];
  const r05 = n => Math.round(n * 2) / 2;
  /* «Impostazioni allenamento» (settings.js, chiave v3_allenamento): riscaldamento prima sì/no; stretching prima, dopo, prima e dopo, mai */
  const pref = () => Object.assign({ warm: true, stretch: "both" }, (typeof lsGet === "function" && lsGet("v3_allenamento", {})) || {});
  const warmOn = () => pref().warm !== false, strPre = () => ["prima", "both"].includes(pref().stretch), strPost = () => ["dopo", "both"].includes(pref().stretch);
  function steps() {
    if (W.kind === "stretch") return STAT.map(r => ({ nome: r[0], how: r[1], secs: 30, tips: [r[1] + ".", "Allunga piano, senza dolore."] }));
    const g = group(), out = [];
    if (warmOn()) out.push({ nome: kid() ? "Bici o camminata veloce" : "Cardio leggero", how: (kid() ? "5 minuti" : g === "over65" ? "10 minuti di cyclette o tapis roulant" : "5 minuti di cyclette o tapis roulant") + ", a ritmo tranquillo", secs: g === "over65" ? 600 : 300, tips: ["Ritmo che ti permette di parlare.", "Deve scaldarti, non stancarti."] });
    if (strPre()) (W.quick ? DIN.slice(0, 3) : DIN).forEach(r => out.push({ nome: r[0], how: r[1], tips: r[2] }));
    const p = P[W.day], it = p && p.items[0];
    if (warmOn() && it && !kid() && it.unit !== "none") {
      const kg = planOf(it).kg;
      if (kg && kg >= 10) [[.4, 8], [.6, 5], [.8, 3]].forEach(([f, n]) => out.push({ nome: "Serie di avvicinamento", how: nameOf(it) + ": " + kgTxt(r05(kg * f)) + " kg × " + n, it, tips: ["Movimento identico alla serie vera.", "Serve a provare il gesto, non a stancarti."] }));
    }
    return out;
  }
  const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function startTick() {
    stopTick(); W.run = true;
    tick = setInterval(() => {
      if (!W || sub !== "warm") return stopTick();
      W.left = Math.max(0, W.left - 1);
      const c = document.getElementById("v3-pal-clock"); if (c) c.textContent = mmss(W.left);
      if (W.left === 0) { stopTick(); W.run = false; try { navigator.vibrate && navigator.vibrate(200); } catch (_) {} V3.refresh(); }
    }, 1000);
  }
  function warmPage() {
    const L = steps(), i = Math.min(W.i, L.length - 1), st = L[i], tot = L.length, stretch = W.kind === "stretch";
    const title = stretch ? "Stretching finale" : warmOn() ? "Riscaldamento" : "Stretching", last = i === tot - 1;
    if (st.secs && W.left == null) W.left = st.secs;
    const started = st.secs && (W.run || W.left === 0);
    const clock = st.secs ? `<div class="v3-palestra-clock"><b id="v3-pal-clock" role="timer">${mmss(W.left)}</b><span>${W.left === 0 ? "Tempo finito ✓" : W.run ? "Il timer sta andando" : "Quando sei pronto, avvia il timer"}</span></div>` : "";
    const doneLabel = !last ? "Fatto" : stretch ? "Fatto, ho finito" : "Fatto, inizia gli esercizi";
    const main = st.secs && !started
      ? primary("Avvia il timer", 'data-v3act="w-timer"') + ui.secondary("Salta questo passo", "w-next")
      : primary(doneLabel, 'data-v3act="w-next"');
    const skip = stretch || !warmOn() ? "Salta lo stretching" : kid() ? "Salta (chiedi all'adulto)" : "Salta il riscaldamento";
    const fig = st.it && imgOf(st.it) ? `<div class="v3-palestra-fig">${ui.fig(imgOf(st.it), nameOf(st.it), nameOf(st.it))}</div>` : "";
    return `<div class="v3-palestra-wfull"><div class="v3-palestra-wtop">${ui.back(stretch ? "Indietro" : "Esci")}<span class="v3-palestra-wc">${e(title)} · ${i + 1} di ${tot}</span></div>
      <div class="v3-bar" role="img" aria-label="${e(title)}: passo ${i + 1} di ${tot}"><i style="width:${Math.round((i + 1) / tot * 100)}%"></i></div>
      <div><h1 class="v3-palestra-wn">${e(st.nome)}</h1><p class="v3-palestra-wh">${e(st.how)}</p></div>
      ${fig}${W.come ? ui.card(st.tips.map(t => `<p class="v3-palestra-note">${e(t)}</p>`).join("") + ui.leo("Come si fa: " + st.nome + "?")) : ""}${clock}
      <div class="v3-palestra-acts">${main}
        <div class="v3-palestra-tools"><button class="v3-palestra-tool" data-v3act="w-come" aria-expanded="${!!W.come}">${W.come ? "Nascondi" : "Come si fa"}</button><button class="v3-palestra-tool" data-v3act="w-skip">${e(skip)}</button></div>
        ${!stretch && i === 0 && !kid() && strPre() ? `<button class="v3-palestra-tool" data-v3act="w-quick">${W.quick ? "Versione completa" : "Versione rapida: 3 movimenti"}</button>` : ""}</div></div>`;
  }

  /* ---------- navigazione interna ---------- */
  function open(name, prep) {
    const prev = { sub, selDay, W };
    if (prep) prep(); sub = name; stackSubs.push(prev);
    V3.page(() => {
      const p = stackSubs.pop() || { sub: null, selDay: null, W: null };
      stopTick(); sub = p.sub; selDay = p.selDay; W = p.W;
      if (!stackSubs.length && pendingStart) { const k = pendingStart; pendingStart = null; setTimeout(() => startDay(k), 0); }
    });
  }
  /* avvio con il pulsante della vista vecchia: stesso percorso di «Inizia seduta» (draft, timer.js, schermo acceso) */
  function startDay(k) {
    if (!P[k]) return;
    const b = document.createElement("button");
    b.type = "button"; b.hidden = true; b.dataset.act = has("doneToday") && doneToday() && !activeDay() ? "start-anyway" : "start"; b.dataset.v = k;
    document.body.appendChild(b); try { b.click(); } finally { b.remove(); }
  }
  function begin(k) {
    if (!P[k]) return;
    if (activeDay()) return startDay(activeDay());
    if (!warmOn() && !strPre()) return startDay(k); // tutto spento: dritto al primo esercizio
    open("warm", () => { W = { kind: "risc", day: k, i: 0, quick: false, left: null, run: false }; });
  }
  function finishWarm() {
    stopTick();
    if (W.kind === "stretch") { V3.back(); return; }
    pendingStart = W.day; history.go(-stackSubs.length);
  }

  /* ---------- pagine ---------- */
  function hero(k, label, extra) {
    const p = P[k], it = p.items[0], ups = upsOf(p);
    const meta = pl(p.items.length, "esercizio", "esercizi") + " · circa " + minsOf(p) + " minuti";
    return `<div class="v3-palestra-hero"><div class="v3-hf"><div><p class="v3-palestra-ht">${e(p.nome || "Seduta " + k)}</p>${p.focus ? `<p class="v3-palestra-hs">${e(p.focus)}</p>` : ""}<p class="v3-palestra-hm">${e(meta)}</p>${ups && !kid() ? `<span class="v3-palestra-up">${e(pl(ups, "pronto", "pronti"))} a salire</span>` : ""}</div>${it && imgOf(it) ? ui.fig(imgOf(it), nameOf(it), nameOf(it)) : ""}</div>
      ${extra ? `<p class="v3-palestra-note">${e(extra)}</p>` : ""}${primary(label, `data-v3act="inizia" data-v3arg="${e(k)}"`)}</div>`;
  }
  function home() {
    if (!DAYS.length) {
      const minor = data.profile().minor;
      return ui.header("Palestra") + ui.section("Prima cosa da fare", `<div class="v3-palestra-hero"><div><p class="v3-palestra-ht">Crea la tua scheda</p><p class="v3-palestra-hs">${minor ? "Sotto i 18 anni la scheda la prepara il tuo preparatore: caricala qui." : "Caricala come testo o foto, oppure fattene creare una di base."}</p></div><button class="v3-apri wide" data-act="redo" data-v="2">${minor ? "Carica la scheda" : "Carica o crea la scheda"}</button></div>`) +
        ui.end(sapText(), { leoQ: "Come si costruisce una buona scheda?" });
    }
    const ts = data.todaySession(), wk = data.week(), ws = weekSessions();
    let today;
    if (ts.state === "fatta") {
      const d0 = doneToday(), nd = ts.next && P[ts.next] ? ts.next : null;
      today = ui.section("Oggi", ui.row({ title: (P[d0.day] ? (P[d0.day].nome || "Seduta " + d0.day) : "Seduta") + " fatta ✓", sub: [d0.durata ? d0.durata + " minuti" : null, d0.fatica != null ? "fatica " + d0.fatica + "/10" : null].filter(Boolean).join(" · ") || "Salvata nei tuoi progressi" }) +
        (strPost() ? ui.row({ title: "Stretching finale", sub: "Circa 3 minuti, se ti va", act: "stretch", apri: "Inizia" }) : "") +
        (nd ? ui.row({ title: "Prossima: " + (P[nd].nome || "Seduta " + nd), sub: "Riposa e torna domani", act: "apri-seduta", arg: nd }) : "") + ageRow());
    } else {
      const k = ts.day;
      today = ui.section(ts.state === "riposo" ? "Prossima seduta" : "La seduta di oggi", hero(k, activeDay() === k ? "Riprendi la seduta" : "Inizia la seduta", ts.state === "riposo" ? "Oggi è giorno di riposo: puoi iniziarla lo stesso." : null) + ageRow());
    }
    const nd = ts.state === "fatta" ? null : ts.day;
    const rows = DAYS.map(k => { const p = P[k], dn = doneWeek(k);
      return ui.row({ title: p.nome || "Seduta " + k, sub: dn ? "Fatta questa settimana ✓" : pl(p.items.length, "esercizio", "esercizi") + " · circa " + minsOf(p) + " minuti", act: "apri-seduta", arg: k, on: k === nd }); }).join("");
    const scheda = ui.section("La mia scheda", rows + ui.secondary(data.profile().minor ? "Vedi o modifica la scheda" : "Modifica la scheda", "modifica") +
      ui.row({ title: "Riscaldamento e stretching", sub: "La tua routine prima e dopo", act: "routine" }));
    const sets = ws.reduce((s, x) => s + (x.items || []).reduce((a, it) => a + ((it.sets || []).length), 0), 0);
    const mins = ws.filter(x => x.durata).reduce((s, x) => s + (+x.durata || 0), 0);
    const p4 = P[nd || ts.next || DAYS[0]];
    const t4 = kid() ? { label: "Esercizi della prossima", value: String(p4 ? p4.items.length : 0) } : { label: "Pronti a salire", value: String(p4 ? upsOf(p4) : 0), of: p4 ? p4.items.length : null };
    const box = ui.limeBox({ title: "La mia settimana", action: { label: "Apri", act: "settimana" }, tiles: [
      { label: "Sedute", value: String(wk.sessions.done), of: wk.sessions.planned, pct: ui.pct(wk.sessions.done, wk.sessions.planned), act: "settimana" },
      { label: "Serie fatte", value: String(sets) },
      { label: "Minuti in palestra", value: mins ? ui.nf(mins, 0) : "–", unit: mins ? "min" : null },
      t4] });
    return ui.header("Palestra") + today + scheda + box + ui.end(sapText(), { leoQ: leoQ() });
  }
  function seduta() {
    const k = selDay, p = P[k]; if (!p) { sub = null; return home(); }
    const g = group(), dn = doneWeek(k);
    const list = p.items.map((it, j) => { const x = planOf(it), kg = it.unit === "none" ? null : x.kg;
      const det = it.sets + " × " + (it.min === it.max ? it.min : it.min + "–" + it.max) + (kg != null ? " · " + kgTxt(kg) + " kg" : it.unit === "none" ? " · corpo libero" : "");
      const up = x.up && g !== "bambino" ? `<span class="v3-palestra-up">${g === "adulto" ? "+" + kgTxt(+(x.kg - (x.b.kg || 0)).toFixed(2)) + " kg oggi" : "Pronto a salire"}</span>` : "";
      return `<div class="v3-palestra-ex">${thumb(it, String(j + 1))}<span class="v3-rx"><span class="v3-rt" style="display:block">${e(nameOf(it))}</span><span class="v3-rs" style="display:block">${e(det)}</span>${up}</span></div>`; }).join("");
    const label = activeDay() === k ? "Riprendi la seduta" : "Inizia la seduta";
    const meta = pl(p.items.length, "esercizio", "esercizi") + " · circa " + minsOf(p) + " minuti";
    return ui.back() + `<div><h1 class="v3-t1">${e(p.nome || "Seduta " + k)}</h1><p class="v3-sub">${e(dn ? "Fatta questa settimana ✓" : p.focus || meta)}</p></div>` +
      ui.card(ui.big(`${p.items.reduce((s, it) => s + it.sets, 0)} <span class="v3-of">serie</span>`, meta)) +
      ui.section("Esercizi", `<div class="v3-palestra-list">${list}</div>`) + primary(label, `data-v3act="inizia" data-v3arg="${e(k)}"`) +
      ui.end(sapText(), { leoQ: leoQ() });
  }
  function settimana() {
    const wk = data.week(), h = data.history("week"), map = has("weekDone") ? weekDone() : {};
    const G = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
    const rows = wk.days.map((d, i) => { const k = map[i];
      if (k) return ui.row({ title: G[i], sub: (P[k] ? P[k].nome || "Seduta " + k : "Seduta") + " ✓", on: d.today });
      if (d.today) return ui.row({ title: G[i] + " · oggi", sub: d.train ? "Giorno di palestra" : "Riposo", on: true });
      if (d.future && d.train) return ui.row({ title: G[i], sub: "Seduta prevista" });
      return ""; }).join("");
    const max = Math.max(4, ...h.map(w => w.sessions));
    return ui.back() + `<div><h1 class="v3-t1">La mia settimana</h1><p class="v3-sub">${e(wk.sessions.done + " su " + wk.sessions.planned + " sedute fatte")}</p></div>` +
      ui.card(ui.big(`${wk.sessions.done} <span class="v3-of">/${wk.sessions.planned}</span>`, "Sedute di questa settimana") +
        ui.chart.bars({ vals: h.map(w => w.sessions), max, ticks: [[wk.sessions.planned, String(wk.sessions.planned), true], [0, "0"]], xl: [[0, h[0].label], [h.length - 1, "ora"]], tip: i => `${h[i].label}: ${pl(h[i].sessions, "seduta", "sedute")}`, aria: "Sedute delle ultime 13 settimane" })) +
      (rows ? ui.section("Questa settimana", rows) : "") +
      ui.end("Conta le sedute della settimana, non i giorni di fila: anche il riposo fa parte del piano.", { leoQ: "Quanti giorni di riposo mi servono?" });
  }
  function routine() {
    const r = L => L.map(x => ui.row({ title: x[0], sub: x[1] })).join("");
    return ui.back() + `<div><h1 class="v3-t1">Riscaldamento e stretching</h1><p class="v3-sub">Prima movimenti, dopo allungamenti</p></div>` +
      ui.section("Prima: stretching dinamico", r(DIN)) + ui.section("Dopo: stretching statico", r(STAT) + primary("Fai lo stretching adesso", 'data-v3act="stretch"')) +
      ui.end("Gli allungamenti tenuti fermi a lungo tolgono un po' di forza: meglio farli dopo i pesi.", { leoQ: "Che differenza c'è tra stretching dinamico e statico?" });
  }

  V3.register("palestra", {
    render(el) {
      if (activeDay()) { sub = null; stackSubs.length = 0; return false; } // seduta in corso: vista vecchia (serie, recupero a tutto schermo, fine)
      if (sub === "warm" && W) { el.innerHTML = warmPage(); return; }
      if (sub === "seduta") { el.innerHTML = seduta(); return; }
      if (sub === "settimana") { el.innerHTML = settimana(); return; }
      if (sub === "routine") { el.innerHTML = routine(); return; }
      el.innerHTML = home();
    },
    on: {
      "apri-seduta"(k) { if (P[k]) open("seduta", () => { selDay = k; }); },
      settimana() { open("settimana"); },
      routine() { open("routine"); },
      modifica() { V3.legacy({ tab: "piano", hub: "train" }); },
      stretch() { open("warm", () => { W = { kind: "stretch", day: null, i: 0, quick: false, left: null, run: false }; }); },
      inizia(k) {
        if (!P[k]) return;
        if (activeDay() || !(has("doneToday") && doneToday())) return begin(k);
        const s = V3.sheet(`<h2 class="v3-sh1">Hai già fatto una seduta oggi</h2><p class="v3-shp">I muscoli crescono mentre recuperi: questa seduta rende di più domani.</p>
          <button class="v3-apri wide" data-v3act="later">Va bene, domani</button><button class="v3-b2" data-v3act="anyway">Inizio lo stesso</button>`,
          { on: { later() { s.close(); }, anyway() { s.close(); setTimeout(() => begin(k), 250); } } });
      },
      "w-timer"() { if (!W) return; startTick(); V3.refresh(); },
      "w-next"() {
        if (!W) return; stopTick();
        const L = steps();
        if (W.i >= L.length - 1) return finishWarm();
        W.i++; W.left = null; W.run = false; W.come = false; window.scrollTo(0, 0); V3.refresh();
      },
      "w-skip"() { if (W) finishWarm(); },
      "w-quick"() { if (!W) return; stopTick(); W.quick = !W.quick; W.i = 0; W.left = null; W.run = false; V3.refresh(); },
      "w-come"() { if (!W) return; W.come = !W.come; V3.refresh(); } // in linea, non in un foglio: vedi nota sul foglio nelle pagine interne
    }
  });
})();
