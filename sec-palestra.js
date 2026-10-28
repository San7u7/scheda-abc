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
    #view.v3 .v3-palestra-hero { background: var(--v3-s1); border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: inset 0 0 0 2px var(--v3-lime); }
    #view.v3 .v3-palestra-ht { font-size: 22px; font-weight: 800; line-height: 1.2; }
    #view.v3 .v3-palestra-hs { font-size: 16px; color: var(--v3-t2); line-height: 1.35; margin-top: 4px; }
    #view.v3 .v3-palestra-hm { font-size: 16px; font-weight: 700; margin-top: 8px; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-palestra-note { font-size: 16px; color: var(--v3-t2); line-height: 1.35; }
    #view.v3 .v3-palestra-list { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-palestra-ex { background: var(--v3-s1); border-radius: 18px; min-height: 72px; padding: 12px 12px 12px 16px; display: flex; align-items: center; gap: 12px; box-sizing: border-box; }
    #view.v3 .v3-palestra-im { width: 56px; height: 56px; flex: none; border-radius: 12px; overflow: hidden; background: var(--v3-s2); position: relative; }
    #view.v3 .v3-palestra-im img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #view.v3 .v3-palestra-im span { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: var(--v3-t3); }
    #view.v3 .v3-palestra-im.noimg img { display: none; } #view.v3 .v3-palestra-im.noimg span { display: flex; }
    #view.v3 .v3-palestra-up { display: inline-block; margin-top: 4px; font-size: 14px; font-weight: 700; color: var(--v3-lime); background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 10px; padding: 2px 8px; }
    #view.v3 .v3-palestra-wtop { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    #view.v3 .v3-palestra-wc { font-size: 16px; color: var(--v3-t2); text-align: right; }
    #view.v3 .v3-palestra-wn { font-size: 28px; font-weight: 800; line-height: 1.15; padding-left: 16px; }
    #view.v3 .v3-palestra-wh { font-size: 18px; font-weight: 700; margin-top: 6px !important; line-height: 1.35; padding-left: 16px; }
    #view.v3 .v3-palestra-clock { text-align: center; padding: 12px 0; }
    #view.v3 .v3-palestra-clock b { display: block; font-size: 64px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.05; }
    #view.v3 .v3-palestra-clock span { display: block; font-size: 16px; color: var(--v3-t2); margin-top: 6px; }
    #view.v3 .v3-palestra-wfull { display: flex; flex-direction: column; gap: 24px; min-height: calc(100vh - var(--v3-bar) - 136px); min-height: calc(100dvh - var(--v3-bar) - 136px); }
    #view.v3 .v3-palestra-wfull .v3-palestra-acts { margin-top: auto; }
    #view.v3 .v3-palestra-acts { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-palestra-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    #view.v3 .v3-palestra-tools .v3-b2 { padding: 8px 12px; line-height: 1.2; }
    #view.v3.v3-o65 .v3-palestra-up { font-size: 16px; }
    #view.v3 .v3-palestra-fig { display: flex; justify-content: center; }
    #view.v3 .v3-palestra-fig .v3-fig { width: 160px; height: 160px; }
    `;
    document.head.appendChild(st);
  }

  /* ---------- utilità (sola lettura dei dati dell'app) ---------- */
  const has = fn => typeof window[fn] === "function";
  const group = () => data.profile().group;
  const kid = () => group() === "bambino";
  /* glossario 28/10: «Seduta» per adulto e ragazzo, «Allenamento» per bambino e over 65 */
  const alt = () => kid() || group() === "over65";
  const tv = (sed, all) => alt() ? all : sed;
  const dname = k => (P[k] && P[k].nome) || tv("Seduta ", "Allenamento ") + k;
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
  const leoQ = () => kid() ? "Perché devo fare piano i movimenti?" : "Come capisco se posso aumentare il carico?";

  function ageRow() {
    const g = group();
    if (g === "bambino") return ui.row({ title: "Sempre con un adulto vicino", sub: "I pesi li decide il tuo allenatore." });
    if (g === "ragazzo") return ui.row({ title: "Meglio con chi ti segue", sub: "Prima di aumentare il carico, chiedi all'istruttore." });
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
    if (warmOn()) out.push({ nome: "Bici o camminata veloce", how: (kid() ? "5 minuti" : g === "over65" ? "10 minuti di cyclette o tapis roulant" : "5 minuti di cyclette o tapis roulant") + ", a ritmo tranquillo", secs: g === "over65" ? 600 : 300, tips: ["Ritmo che ti permette di parlare.", "Deve scaldarti, non stancarti."] });
    if (strPre()) (W.quick ? DIN.slice(0, 3) : DIN).forEach(r => out.push({ nome: r[0], how: r[1], tips: r[2] }));
    const p = P[W.day], it = p && p.items[0];
    if (warmOn() && it && !kid() && it.unit !== "none" && !it.risc) { // con il riscaldamento automatico le serie leggere sono già in seduta
      const kg = planOf(it).kg;
      if (kg && kg >= 10) [[.4, 8], [.6, 5], [.8, 3]].forEach(([f, n]) => out.push({ nome: "Serie leggera di prova", how: nameOf(it) + ": " + kgTxt(r05(kg * f)) + " kg × " + n, it, tips: ["Movimento identico alla serie vera.", "Serve a provare il gesto, non a stancarti."] }));
    }
    return out;
  }
  const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function startTick() {
    stopTick(); W.run = true;
    const end = Date.now() + W.left * 1000; // dall'istante di fine: in background il tempo non si congela
    tick = setInterval(() => {
      if (!W || sub !== "warm") return stopTick();
      W.left = Math.max(0, Math.round((end - Date.now()) / 1000));
      const c = document.getElementById("v3-pal-clock"); if (c) c.textContent = mmss(W.left);
      if (W.left === 0) { stopTick(); W.run = false; try { navigator.vibrate && navigator.vibrate(200); } catch (_) {} V3.refresh(); }
    }, 1000);
  }
  function warmPage() {
    const L = steps(), i = Math.min(W.i, L.length - 1), st = L[i], tot = L.length, stretch = W.kind === "stretch";
    const title = stretch ? "Stretching finale" : warmOn() ? "Riscaldamento" : "Stretching", last = i === tot - 1;
    if (st.secs && W.left == null) W.left = st.secs;
    const started = st.secs && (W.run || W.left === 0);
    const clock = st.secs ? `<div class="v3-palestra-clock"><b id="v3-pal-clock" role="timer">${mmss(W.left)}</b><span>${W.left === 0 ? "Tempo finito" : W.run ? "Tempo in corso" : "Avvia quando sei pronto"}</span></div>` : "";
    const doneLabel = !last ? "Passo fatto" : stretch ? "Stretching finito" : "Inizia gli esercizi";
    const main = st.secs && !started
      ? primary("Avvia il timer", 'data-v3act="w-timer"') + ui.secondary("Salta questo esercizio", "w-next")
      : primary(doneLabel, 'data-v3act="w-next"');
    const skip = stretch || !warmOn() ? "Salta lo stretching" : kid() ? "Salta, con l'ok di un adulto" : "Salta tutto il riscaldamento";
    const fig = st.it && imgOf(st.it) ? `<div class="v3-palestra-fig">${ui.fig(imgOf(st.it), nameOf(st.it), nameOf(st.it))}</div>` : "";
    return `<div class="v3-palestra-wfull"><div class="v3-palestra-wtop">${ui.back(stretch ? "Indietro" : "Esci dal riscaldamento")}<span class="v3-palestra-wc">${e(title)} · ${i + 1} di ${tot}</span></div>
      <div class="v3-bar" role="img" aria-label="${e(title)}: passo ${i + 1} di ${tot}"><i style="width:${Math.round((i + 1) / tot * 100)}%"></i></div>
      <div><h1 class="v3-palestra-wn">${e(st.nome)}</h1><p class="v3-palestra-wh">${e(st.how)}</p></div>
      ${fig}${W.come ? ui.card(st.tips.map(t => `<p class="v3-palestra-note">${e(t)}</p>`).join("") + ui.leo("Come si fa: " + st.nome + "?")) : ""}${clock}
      <div class="v3-palestra-acts">${main}
        <div class="v3-palestra-tools"><button class="v3-b2" data-v3act="w-come" aria-expanded="${!!W.come}">${W.come ? "Nascondi" : "Come si fa"}</button><button class="v3-b2" data-v3act="w-skip">${e(skip)}</button></div>
        ${!stretch && i === 0 && !kid() && strPre() ? `<button class="v3-b2" data-v3act="w-quick">${W.quick ? "Versione completa" : "Versione rapida: 3 movimenti"}</button>` : ""}</div></div>`;
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
    return `<div class="v3-palestra-hero"><div class="v3-hf"><div><p class="v3-palestra-ht">${e(dname(k))}</p>${p.focus ? `<p class="v3-palestra-hs">${e(p.focus)}</p>` : ""}<p class="v3-palestra-hm">${e(meta)}</p>${ups && !kid() ? `<span class="v3-palestra-up">${e(ups + " con carico in aumento")}</span>` : ""}</div>${it && imgOf(it) ? ui.fig(imgOf(it), nameOf(it), nameOf(it)) : ""}</div>
      ${extra ? `<p class="v3-palestra-note">${e(extra)}</p>` : ""}${primary(label, `data-v3act="inizia" data-v3arg="${e(k)}"`)}</div>`;
  }
  function home() {
    if (!DAYS.length) {
      const kidP = data.profile().group === "bambino", teen = data.profile().group === "ragazzo"; // 28/10 tappa C: bambino solo indicazioni, ragazzo con istruttore
      return ui.header("Palestra") + ui.section("Prima cosa da fare", `<div class="v3-palestra-hero"><div><p class="v3-palestra-ht">Crea la tua scheda</p><p class="v3-palestra-hs">${kidP ? "Fino a 13 anni la scheda la fa il tuo allenatore: caricala qui." : teen ? "Con un istruttore che ti segue la preparo io, oppure carica la tua." : "Rispondi alle domande e la preparo io, oppure carica la tua."}</p></div>${kidP ? `<button class="v3-apri wide" data-act="redo" data-v="2">Carica la scheda</button><button class="v3-b2" data-v3act="q-scheda">Cosa fare alla tua età</button>` : `<button class="v3-apri wide" data-v3act="q-scheda">Rispondi alle domande</button><button class="v3-b2" data-act="redo" data-v="2">Carica la scheda che hai</button>`}</div>`) +
        ui.end(sapText(), { leoQ: "Come si costruisce una buona scheda?" });
    }
    const ts = data.todaySession(), wk = data.week(), ws = weekSessions();
    let today;
    if (ts.state === "fatta") {
      const d0 = doneToday(), nd = ts.next && P[ts.next] ? ts.next : null;
      today = ui.section("Oggi", ui.row({ title: (P[d0.day] ? dname(d0.day) : tv("Seduta", "Allenamento")) + tv(" fatta", " fatto"), sub: [d0.durata ? d0.durata + " minuti" : null, d0.fatica != null ? "fatica " + d0.fatica + " su 10" : null].filter(Boolean).join(" · ") || "Salvata nei tuoi progressi" }) +
        (strPost() ? ui.row({ title: "Stretching finale", sub: "Circa 3 minuti, se ti va", act: "stretch", apri: "Inizia" }) : "") +
        (nd ? ui.row({ title: tv("Prossima seduta: ", "Prossimo allenamento: ") + (P[nd].nome || nd), sub: "Domani, dopo il riposo", act: "apri-seduta", arg: nd }) : "") + ageRow());
    } else {
      const k = ts.day;
      today = ui.section(ts.state === "riposo" ? tv("Prossima seduta", "Prossimo allenamento") : tv("La seduta di oggi", "L'allenamento di oggi"), hero(k, activeDay() === k ? tv("Riprendi la seduta", "Riprendi l'allenamento") : tv("Inizia la seduta", "Inizia l'allenamento"), ts.state === "riposo" ? "Oggi è giorno di riposo: puoi iniziarla lo stesso." : null) + ageRow());
    }
    const nd = ts.state === "fatta" ? null : ts.day;
    const rows = DAYS.map(k => { const p = P[k], dn = doneWeek(k);
      return ui.row({ title: dname(k), sub: dn ? tv("Fatta", "Fatto") + " questa settimana ✓" : pl(p.items.length, "esercizio", "esercizi") + " · circa " + minsOf(p) + " minuti", act: "apri-seduta", arg: k, on: k === nd }); }).join("");
    const scheda = ui.section("La mia scheda", rows + ui.secondary("Apri la scheda", "modifica") +
      ui.row({ title: "Riscaldamento e stretching", sub: "La tua routine prima e dopo", act: "routine" }));
    const sets = ws.reduce((s, x) => s + (x.items || []).reduce((a, it) => a + ((it.sets || []).length), 0), 0);
    const mins = ws.filter(x => x.durata).reduce((s, x) => s + (+x.durata || 0), 0);
    const p4 = P[nd || ts.next || DAYS[0]];
    const t4 = kid() ? { label: "Esercizi della prossima", value: String(p4 ? p4.items.length : 0) } : { label: "Carico in aumento", value: String(p4 ? upsOf(p4) : 0), of: p4 ? p4.items.length : null };
    const box = ui.limeBox({ title: "La mia settimana", action: { label: "Apri", act: "settimana" }, tiles: [
      { label: tv("Sedute", "Allenamenti"), value: String(wk.sessions.done), of: wk.sessions.planned, pct: ui.pct(wk.sessions.done, wk.sessions.planned), act: "settimana" },
      { label: "Serie fatte", value: String(sets) },
      { label: "Minuti in palestra", value: mins ? ui.nf(mins, 0) : "–", unit: mins ? "min" : null },
      t4] });
    return ui.header("Palestra") + today + scheda + box + ui.end(sapText(), { leoQ: leoQ() });
  }
  function seduta() {
    const k = selDay, p = P[k]; if (!p) { sub = null; return home(); }
    const g = group(), dn = doneWeek(k);
    const list = p.items.map((it, j) => { const x = planOf(it), kg = it.unit === "none" ? null : x.kg;
      const det = tipoOf(it) !== "uguali" ? SCH[tipoOf(it)][0] + " · " + it.sets + " serie" + (kg != null ? " · da " + kgTxt(kg) + " kg" : "") : it.sets + " × " + (it.min === it.max ? it.min : it.min + "–" + it.max) + (kg != null ? " · " + kgTxt(kg) + " kg" : it.unit === "none" ? " · corpo libero" : "");
      const up = x.up && g !== "bambino" ? `<span class="v3-palestra-up">${g === "adulto" ? "+" + kgTxt(+(x.kg - (x.b.kg || 0)).toFixed(2)) + " kg oggi" : "Carico in aumento"}</span>` : "";
      return `<div class="v3-palestra-ex">${thumb(it, String(j + 1))}<span class="v3-rx"><span class="v3-rt" style="display:block">${e(nameOf(it))}</span><span class="v3-rs" style="display:block">${e(det)}</span>${up}</span></div>`; }).join("");
    const label = activeDay() === k ? tv("Riprendi la seduta", "Riprendi l'allenamento") : tv("Inizia la seduta", "Inizia l'allenamento");
    const meta = pl(p.items.length, "esercizio", "esercizi") + " · circa " + minsOf(p) + " minuti";
    return ui.back() + `<div><h1 class="v3-t1">${e(dname(k))}</h1><p class="v3-sub">${e(dn ? tv("Fatta", "Fatto") + " questa settimana ✓" : p.focus || meta)}</p></div>` +
      ui.card(ui.big(`${p.items.reduce((s, it) => s + it.sets, 0)} <span class="v3-of">serie</span>`, meta)) +
      ui.section("Esercizi", `<div class="v3-palestra-list">${list}</div>`) + primary(label, `data-v3act="inizia" data-v3arg="${e(k)}"`) +
      ui.end(sapText(), { leoQ: leoQ() });
  }
  function settimana() {
    const wk = data.week(), h = data.history("week"), map = has("weekDone") ? weekDone() : {};
    const G = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
    const rows = wk.days.map((d, i) => { const k = map[i];
      if (k) return ui.row({ title: G[i], sub: (P[k] ? dname(k) : tv("Seduta", "Allenamento")) + " ✓", on: d.today });
      if (d.today) return ui.row({ title: G[i] + " · oggi", sub: d.train ? "Giorno di palestra" : "Riposo", on: true });
      if (d.future && d.train) return ui.row({ title: G[i], sub: tv("Seduta prevista", "Allenamento previsto") });
      return ""; }).join("");
    const max = Math.max(4, ...h.map(w => w.sessions));
    return ui.back() + `<div><h1 class="v3-t1">La mia settimana</h1><p class="v3-sub">${e(wk.sessions.done + " su " + wk.sessions.planned + tv(" sedute fatte", " allenamenti fatti"))}</p></div>` +
      ui.card(ui.big(`${wk.sessions.done} <span class="v3-of">/${wk.sessions.planned}</span>`, tv("Sedute di questa settimana", "Allenamenti di questa settimana")) +
        ui.chart.bars({ vals: h.map(w => w.sessions), max, ticks: [[wk.sessions.planned, String(wk.sessions.planned), true], [0, "0"]], xl: [[0, h[0].label], [h.length - 1, "ora"]], tip: i => `${h[i].label}: ${pl(h[i].sessions, tv("seduta", "allenamento"), tv("sedute", "allenamenti"))}`, aria: tv("Sedute", "Allenamenti") + " delle ultime 13 settimane" })) +
      (rows ? ui.section("Questa settimana", rows) : "") +
      ui.end("Conta " + tv("le sedute", "gli allenamenti") + " della settimana, non i giorni di fila: anche il riposo fa parte del piano.", { leoQ: "Quanti giorni di riposo mi servono?" });
  }
  function routine() {
    const r = L => L.map(x => ui.row({ title: x[0], sub: x[1] })).join("");
    return ui.back() + `<div><h1 class="v3-t1">Riscaldamento e stretching</h1><p class="v3-sub">Prima movimenti, dopo allungamenti</p></div>` +
      ui.section("Prima: movimenti per scaldarti", r(DIN)) + ui.section("Dopo: allungamenti da fermo", r(STAT) + primary("Fai lo stretching adesso", 'data-v3act="stretch"')) +
      ui.end("Gli allungamenti tenuti fermi a lungo tolgono un po' di forza: meglio farli dopo i pesi.", { leoQ: "Che differenza c'è tra stretching dinamico e statico?" });
  }

  /* ---------- Tappa A (28/10): schemi nella scheda, «Modifica esercizio», «Altre impostazioni», schema solo per oggi ---------- */
  if (!document.getElementById("v3-pal-schemi")) {
    const st = document.createElement("style");
    st.id = "v3-pal-schemi";
    st.textContent = `
    .pal-hd { padding-left: 16px; } .pal-hd .v3-shp { color: var(--v3-t2); margin-top: 4px; }
    .pal-lab { padding-left: 16px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .pal-opts { display: flex; flex-direction: column; gap: 8px; }
    .pal-opt { background: var(--v3-s2); border: 0; border-radius: 18px; min-height: 64px; padding: 10px 12px 10px 16px; display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; color: var(--v3-t1); font-family: inherit; box-sizing: border-box; }
    .pal-opt[aria-checked="true"] { background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); }
    .pal-opt .v3-rx { flex: 1; min-width: 0; } .pal-opt .v3-rs { font-size: 15px; }
    .pal-rad { width: 52px; flex: none; display: flex; justify-content: center; }
    .pal-rad i { width: 22px; height: 22px; border-radius: 11px; box-shadow: inset 0 0 0 2px var(--v3-t3); display: block; position: relative; }
    .pal-opt[aria-checked="true"] .pal-rad i { box-shadow: inset 0 0 0 2px var(--accent); }
    .pal-opt[aria-checked="true"] .pal-rad i::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--accent); }
    .pal-tog { width: 52px; height: 48px; border: 0; background: transparent; padding: 0; flex: none; display: flex; align-items: center; justify-content: center; }
    .pal-tog i { width: 52px; height: 32px; border-radius: 16px; background: var(--v3-s3); display: block; position: relative; transition: background .18s; }
    .pal-tog i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 13px; background: var(--v3-t1); transition: left .18s; }
    .pal-tog[aria-pressed="true"] i { background: var(--v3-lime); } .pal-tog[aria-pressed="true"] i::after { left: 23px; background: var(--v3-ink); }
    body.no-anim .pal-tog i, body.no-anim .pal-tog i::after { transition: none; }
    .pal-stps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
    .pal-stp { display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; min-width: 0; }
    .pal-sl { padding-left: 16px; font-size: 16px; font-weight: 600; color: var(--v3-t2); line-height: 1.25; }
    .stepper.pal-st { grid-template-columns: 48px minmax(0, 1fr) 48px; height: auto; }
    .stepper.pal-st button { font-size: 22px; font-family: inherit; }
    .pal-v { text-align: center; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--v3-t1); }
    .pal-box { background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .pal-box-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .pal-box-h b { color: var(--v3-lime); font-size: 17px; font-weight: 700; } .pal-box-h span { font-size: 14px; color: var(--v3-t2); }
    .pal-ser { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    .pal-ser > div { background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 14px; padding: 10px 8px 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .pal-ser small { font-size: 14px; color: var(--v3-t2); } .pal-ser b { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15; white-space: nowrap; } .pal-ser span { font-size: 15px; font-variant-numeric: tabular-nums; }
    .pal-box p { margin: 0; font-size: 15px; color: var(--v3-t2); }
    #view.v3 .pal-pg .v3-row .v3-apri { width: 96px; min-width: 96px; padding: 0; justify-content: center; flex: none; }
    .pal-ta { width: 100%; box-sizing: border-box; min-height: 96px; border-radius: 18px; border: 0; background: var(--v3-s2); color: var(--v3-t1); font: 16px/1.4 var(--v3-font, Inter, system-ui, sans-serif); padding: 12px 16px; resize: vertical; }
    `;
    document.head.appendChild(st);
  }
  let ED = null; // { s, e, x (copia dell'esercizio della scheda), kg0 }
  const T = () => S.training || { sedute: [] };
  const clone = o => JSON.parse(JSON.stringify(o));
  const tipiOk = () => { const g = group(), all = Object.keys(SCH);
    if (g === "bambino") return ["uguali"];
    if (g === "ragazzo") return all.filter(t => t !== "scalare");
    if (g === "over65") return all.filter(t => t !== "scalare" && t !== "5x5");
    return all; };
  const caloOk = () => group() === "adulto";
  const misOf = x => MISURA[x.misura] ? x.misura : x.corpo_libero ? "corpo" : "pesi";
  const recTxt = s => { const m = Math.floor(s / 60), r = s % 60; return !m ? r + " secondi" : (m === 1 ? "1 minuto" : m + " minuti") + (r ? " e " + r + " secondi" : ""); };
  const ruleTxt = { uguali: "Stesso peso in ogni serie", piramide_su: "+7% di peso, −2 ripetizioni", piramide_giu: "−10% di peso, +2 ripetizioni", pesante_scarico: "Poi −12% di peso, +3 ripetizioni", scalare: "2 cali da −25% sull'ultima", "5x5": "Stesso peso, 5 ripetizioni" };
  const itemOf = (x, s, e2) => normEx(x, e2, String.fromCharCode(65 + s) + (e2 + 1));
  /* schema di lavoro dell'editor: sempre completo, anche per gli esercizi senza schema */
  function schOfX(x, kg) {
    const s = x.schema || {}, tipo = SCH[s.tipo] ? s.tipo : "uguali";
    return { tipo, serie: tipo === "uguali" ? +x.serie || 3 : +s.serie || +x.serie || 3, kg1: tipo === "uguali" ? (kg !== undefined ? kg : x.kg) : (s.kg1 != null ? +s.kg1 : kg !== undefined ? kg : x.kg), reps1: tipo === "uguali" ? +x.min || 8 : +s.reps1 || +x.min || 8, calo: !!s.calo };
  }
  /* scrive lo schema nella copia dell'esercizio (campi vecchi allineati, così coach, storico e Progressi restano coerenti) */
  function putSch(x, sc) {
    const tipo = tipiOk().includes(sc.tipo) ? sc.tipo : "uguali", calo = caloOk() && tipo !== "scalare" && !!sc.calo;
    if (tipo === "uguali") {
      const w = Math.max(0, (+x.max || +x.min || 8) - (+x.min || 8));
      x.serie = sc.serie; if (misOf(x) === "pesi" && !kid()) x.kg = sc.kg1; x.min = sc.reps1; x.max = sc.reps1 + w;
      if (calo) x.schema = { tipo, calo: true, da: new Date().toISOString() }; else delete x.schema;
    } else {
      x.serie = tipo === "5x5" ? 5 : sc.serie;
      x.schema = { tipo, serie: x.serie, kg1: misOf(x) === "pesi" ? sc.kg1 : null, reps1: tipo === "5x5" ? 5 : sc.reps1, calo, da: new Date().toISOString() };
    }
  }
  function serieBox(it, title) {
    const all = targetSets(it), wk = all.filter(s => !s.w), wu = all.filter(s => s.w), noKg = it.unit === "none";
    const lab = s => s.dr ? "Calo" : "S" + (wk.filter(z => !z.dr).indexOf(s) + 1);
    const tiles = wk.map(s => `<div><small>${lab(s)}</small>${noKg ? "" : `<b>${s.kg == null ? "–" : kgTxt(s.kg)}</b>`}<span>× ${s.reps}</span></div>`).join("");
    return `<div class="pal-box"><div class="pal-box-h"><b>${e(title || "Le tue serie")}</b><span>${e(ruleTxt[tipoOf(it)])}</span></div>
      <div class="pal-ser" style="--n:${Math.min(4, wk.length)}">${tiles}</div>${wu.length ? `<p>Prima ${wu.length} serie di riscaldamento: ${e(wu.map(s => kgTxt(s.kg) + " × " + s.reps).join(", "))}</p>` : ""}</div>`;
  }
  const opt = (title, sub, on, act, arg) => `<button class="pal-opt" role="radio" aria-checked="${!!on}" data-v3act="${act}" data-v3arg="${e(arg)}"><span class="v3-rx"><span class="v3-rt" style="display:block">${e(title)}</span>${sub ? `<span class="v3-rs" style="display:block">${e(sub)}</span>` : ""}</span><span class="pal-rad" aria-hidden="true"><i></i></span></button>`;
  const togRow = (title, sub, on, act, bg) => `<div class="v3-row"${bg ? ' style="background:var(--v3-s2)"' : ""}><span class="v3-rx"><span class="v3-rt" style="display:block">${e(title)}</span><span class="v3-rs" style="display:block">${e(sub)}</span></span><button class="pal-tog" aria-pressed="${!!on}" aria-label="${e(title)}" data-v3act="${act}"><i></i></button></div>`;
  const stp = (label, key, val, unitTxt) => `<div class="pal-stp"><span class="pal-sl">${e(label)}</span><div class="stepper pal-st"><button data-v3act="stp" data-v3arg="${key}:-1" aria-label="${e(label)}: meno">−</button><span class="pal-v" aria-live="polite">${e(val)}</span><button data-v3act="stp" data-v3arg="${key}:1" aria-label="${e(label)}: più">+</button></div></div>`;
  const STEP = { serie: [1, 1, 10], rest: [15, 15, 600], kg1: [.5, 0, 500], reps1: [1, 1, 60] };

  /* foglio «Come fai le serie?» (26) → parametri e anteprima (27). ctx: {name, sub, x, kg, today, onSave(sc, rest)} */
  function schemaSheet(ctx) {
    const x = ctx.x, sc = schOfX(x, ctx.kg), noKg = misOf(x) !== "pesi";
    let rest = +x.recupero || 90, mode = tipiOk().length > 1 ? "scelta" : "param";
    const rl = misOf(x) === "tempo" ? "Secondi" : misOf(x) === "distanza" ? "Metri" : "Ripetizioni";
    const preview = () => { const y = clone(x); putSch(y, sc); y.recupero = rest; return normEx(y, 1, "Z1"); };
    function html() {
      if (mode === "scelta") return `<div class="pal-hd"><h2 class="v3-sh1">${e(ctx.name)}</h2><p class="v3-shp">${e(ctx.sub)}</p></div><p class="pal-lab">Come fai le serie?</p>
        <div class="pal-opts" role="radiogroup" aria-label="Come fai le serie">${tipiOk().map(t => opt(SCH[t][0], SCH[t][1], sc.tipo === t, "sc-tipo", t)).join("")}</div>
        ${caloOk() && sc.tipo !== "scalare" ? togRow("Calo di peso sull'ultima serie", "Togli il 25% e continui senza pausa", sc.calo, "sc-calo", true) : ""}
        ${primary("Avanti", 'data-v3act="sc-avanti"')}`;
      const uq = sc.tipo === "uguali", f5 = sc.tipo === "5x5", it = preview();
      return `<div class="pal-hd"><h2 class="v3-sh1">${e(SCH[sc.tipo][0])}</h2><p class="v3-shp">${e(ctx.name + (uq ? " · stesso peso in ogni serie" : " · imposti solo la prima serie"))}</p></div>
        <div class="pal-stps">${f5 ? "" : stp("Serie", "serie", String(sc.serie))}${stp("Recupero", "rest", mmss(rest))}
          ${noKg || kid() ? "" : stp(uq ? "Kg" : "Kg iniziali", "kg1", kgTxt(sc.kg1 || 0))}${f5 ? "" : stp(uq ? rl : rl + " iniziali", "reps1", String(sc.reps1))}</div>
        ${serieBox(it)}${primary(ctx.today ? "Usa solo per oggi" : "Salva nella scheda", 'data-v3act="sc-save"')}${tipiOk().length > 1 ? ui.secondary("Cambia schema", "sc-cambia") : ui.secondary("Chiudi", "close")}`;
    }
    const sh = V3.sheet(html(), { label: "Come fai le serie", on: {
      "sc-tipo"(t) { sc.tipo = t; if (t === "scalare") sc.calo = false; paint(); },
      "sc-calo"() { sc.calo = !sc.calo; paint(); },
      "sc-avanti"() { mode = "param"; paint(true); },
      "sc-cambia"() { mode = "scelta"; paint(true); },
      stp(a) { const [k, d] = a.split(":"), [st, lo, hi] = STEP[k];
        if (k === "rest") rest = Math.min(hi, Math.max(lo, rest + st * d)); else sc[k] = Math.min(hi, Math.max(lo, +((+sc[k] || 0) + st * d).toFixed(2)));
        paint(); },
      "sc-save"() { ctx.onSave(sc, rest); sh.close(); }
    } });
    function paint(top) { sh.el.innerHTML = '<div class="v3-grab"></div>' + html(); if (top) sh.el.scrollTop = 0; }
    return sh;
  }
  function restSheet(x, done) {
    let r = +x.recupero || 90;
    const html = () => `<div class="pal-hd"><h2 class="v3-sh1">Recupero</h2><p class="v3-shp">${e(recTxt(r))}, parte da solo</p></div><div class="pal-stps" style="grid-template-columns:minmax(0,1fr)">${stp("Tra una serie e l'altra", "rest", mmss(r))}</div>${primary("Fatto", 'data-v3act="ok"')}`;
    const sh = V3.sheet(html(), { label: "Recupero", on: {
      stp(a) { r = Math.min(600, Math.max(15, r + 15 * +a.split(":")[1])); sh.el.innerHTML = '<div class="v3-grab"></div>' + html(); },
      ok() { done(r); sh.close(); } } });
  }
  function pickSheet(title, opts, cur, done) {
    const sh = V3.sheet(`<div class="pal-hd"><h2 class="v3-sh1">${e(title)}</h2></div><div class="pal-opts" role="radiogroup" aria-label="${e(title)}">${opts.map(([v, t, s]) => opt(t, s, String(v) === String(cur), "pk", v)).join("")}</div>${ui.secondary("Chiudi", "close")}`,
      { label: title, on: { pk(v) { done(v); sh.close(); } } });
  }
  function notaSheet(x, done) {
    const sh = V3.sheet(`<div class="pal-hd"><h2 class="v3-sh1">Nota fissa</h2><p class="v3-shp">La vedi ogni volta in seduta</p></div><textarea class="pal-ta" id="pal-nota" maxlength="140" aria-label="Nota fissa" placeholder="Esempio: panca al foro 3, presa larga">${e(x.nota || "")}</textarea>${primary("Salva la nota", 'data-v3act="ok"')}`,
      { label: "Nota fissa", on: { ok() { done((document.getElementById("pal-nota").value || "").trim()); sh.close(); } } });
  }
  function saveEd(quiet) {
    const sd = T().sedute[ED.s]; if (!sd) return;
    const x = clone(ED.x); x.corpo_libero = misOf(x) !== "pesi";
    sd.esercizi[ED.e] = x;
    const it = itemOf(x, ED.s, ED.e);
    if (tipoOf(it) === "uguali" && !x.corpo_libero && x.kg !== ED.kg0 && S.state.ex[exKey(it)]) { S.state.ex[exKey(it)].kg = x.kg; persistState(); } // serie uguali: il peso scritto vale da subito
    persistDoc("training", S.training); setTraining(S.training);
    DAYS.forEach(k => { if (S.drafts[k] && !S.drafts[k].started) delete S.drafts[k]; }); saveDrafts(); // solo le anteprime: le sedute in corso restano
    ED.x = clone(x); ED.kg0 = x.kg;
    if (!quiet) toast(short(x.nome) + " salvata nella scheda", { sub: schLabel(it) });
  }
  function openEd(s, j) {
    const x = T().sedute[s] && T().sedute[s].esercizi[j]; if (!x) return;
    const it = itemOf(x, s, j), y = clone(x);
    if (!y.schema && misOf(y) === "pesi") { const k = planOf(it).kg; if (k != null) y.kg = k; } // peso di oggi, non quello vecchio della scheda
    open("esercizio", () => { ED = { s, e: j, x: y, kg0: y.kg }; });
  }
  const edSub = () => (T().sedute[ED.s].nome || tv("Seduta ", "Allenamento ") + String.fromCharCode(65 + ED.s)) + " · esercizio " + (ED.e + 1);
  function schedaPage() {
    const k = selDay && P[selDay] ? selDay : DAYS[0], s = DAYS.indexOf(k), sd = T().sedute[s], p = P[k];
    const seg = DAYS.length > 1 ? ui.seg(DAYS.map(d => DAYS.length > 3 ? d : tv("Seduta ", "Allenamento ") + d), s, "sc-day", tv("Seduta", "Allenamento")) : "";
    const wk = T().creata ? Math.max(1, Math.round((Date.now() - Date.parse(T().creata)) / 6048e5)) : null;
    const nEx = DAYS.reduce((m, d) => m + P[d].items.length, 0);
    const rows = p.items.map((it, j) => ui.row({ title: nameOf(it), sub: it.unit === "none" && tipoOf(it) === "uguali" ? `${it.sets} × ${it.min === it.max ? it.min : it.min + "–" + it.max} · ${MISURA[it.misura].toLowerCase()}` : schLabel(it), act: "ed-open", arg: s + ":" + j, apri: "Modifica" })).join("");
    return `<div class="pal-pg">${ui.back()}</div><div><h1 class="v3-t1">La mia scheda</h1><p class="v3-sub">${e(pl(DAYS.length, tv("seduta", "allenamento"), tv("sedute", "allenamenti")) + " · " + (wk ? "da " + pl(wk, "settimana", "settimane") : pl(nEx, "esercizio", "esercizi")))}</p></div>
      <div class="pal-pg v3-sec">${ui.row({ title: "Crea una nuova scheda", sub: "Da 15 a 40 domande, scegli tu", act: "q-scheda", apri: "Inizia" })}${ui.row({ title: tv("Aggiungi una seduta", "Aggiungi un allenamento"), sub: "4 domande sulla nuova " + tv("seduta", "giornata"), act: "q-seduta", apri: "Aggiungi" })}</div>
      <section class="v3-sec">${ui.label(tv("Le tue sedute", "I tuoi allenamenti"))}${seg}</section><div><h2 class="v3-rt" style="font-size:20px;padding-left:16px">${e(dname(k))}</h2><p class="v3-sub">${e((sd.focus ? sd.focus + " · " : "") + pl(p.items.length, "esercizio", "esercizi"))}</p></div>
      <div class="pal-pg">${ui.section("", rows)}</div>${ui.secondary("Aggiungi, togli o sposta esercizi", "struttura")}`;
  }
  function edPage() {
    const x = ED.x, it = itemOf(x, ED.s, ED.e), t = tipoOf(it);
    return `${ui.back()}<div><h1 class="v3-t1">${e(short(x.nome))}</h1><p class="v3-sub">${e(edSub())}</p></div>${serieBox(it)}
      <div class="pal-pg v3-sec">${ui.row({ title: "Come fai le serie", sub: SCH[t][0] + (it.schema && it.schema.calo && t !== "scalare" ? " + calo sull'ultima" : ""), act: "ed-schema", apri: "Cambia" })}
      ${ui.row({ title: "Recupero", sub: recTxt(+x.recupero || 90) + ", parte da solo", act: "ed-rest", apri: "Cambia" })}
      ${ui.row({ title: "Altre impostazioni", sub: "Riscaldamento, salto, note", act: "ed-altre" })}</div>
      ${primary("Salva nella scheda", 'data-v3act="ed-save"')}`;
  }
  function altrePage() {
    const x = ED.x, it = itemOf(x, ED.s, ED.e), m = misOf(x);
    return `${ui.back()}<div><h1 class="v3-t1">Altre impostazioni</h1><p class="v3-sub">${e(short(x.nome))}</p></div><div class="pal-pg v3-sec">
      ${ui.row({ title: "Come si misura", sub: MISURA[m], act: "al-mis", apri: "Cambia" })}
      ${m === "pesi" && !kid() ? ui.row({ title: "Salto di peso", sub: kgTxt(it.salto) + " kg alla volta", act: "al-salto", apri: "Cambia" }) : ""}
      ${m === "pesi" ? togRow("Riscaldamento automatico", x.risc ? "2 serie leggere prima" : "Spento", x.risc, "al-risc") : ""}
      ${togRow("Un lato alla volta", x.lato ? "Prima un lato, poi l'altro" : "Spento", x.lato, "al-lato")}
      ${ui.row({ title: "Nota fissa", sub: x.nota || "Nessuna nota", act: "al-nota", apri: "Scrivi" })}</div>`;
  }
  /* seduta in corso: «Cambia lo schema solo per oggi» (31) ricalcola le serie non fatte della bozza, la scheda non cambia */
  window.PalSchema = {
    oggi() {
      const a = activeDay(); if (!a) return;
      const d = draft(a), it = P[a].items.find(x => x.id === d.cur.id); if (!it) return;
      const X = itOf(it, d), x = { nome: it.name, serie: X.sets, min: it.min, max: it.max, kg: X.kg, recupero: X.rest, misura: it.misura, schema: X.schema ? clone(X.schema) : undefined };
      const cur = d.sets[it.id].find(s => !s.done && !s.w && !s.dr);
      schemaSheet({ name: nameOf(it), sub: "Solo per oggi · la scheda resta com'è", x, kg: planOf(X).kg ?? (cur && cur.kg), today: true, onSave(sc, rest) {
        const y = clone(x); putSch(y, sc);
        d.sch = d.sch || {}; d.sch[it.id] = { schema: y.schema || { tipo: "uguali", serie: y.serie, kg1: y.kg }, rest, ...(y.schema ? {} : { min: y.min, max: y.max, kg: y.kg }) };
        if (!y.schema) d.sch[it.id].schema.serie = y.serie;
        const old = d.sets[it.id], fresh = draftSets(it, d), out = fresh.map((f, i) => old[i] && old[i].done ? old[i] : f);
        old.forEach((s, i) => { if (i >= fresh.length && s.done) out.push(s); });
        d.sets[it.id] = out; const nx = out.findIndex(s => !s.done); d.cur = { id: it.id, i: nx >= 0 ? nx : 0 };
        saveDrafts(); render(); toast("Schema cambiato solo per oggi", { sub: nameOf(it) + ": " + SCH[tipoOf(itOf(it, d))][0] });
      } });
    }
  };

  V3.register("palestra", {
    render(el) {
      if (activeDay()) { sub = null; stackSubs.length = 0; return false; } // seduta in corso: vista vecchia (serie, recupero a tutto schermo, fine)
      if (sub === "warm" && W) { el.innerHTML = warmPage(); return; }
      if (sub === "seduta") { el.innerHTML = seduta(); return; }
      if (sub === "settimana") { el.innerHTML = settimana(); return; }
      if (sub === "routine") { el.innerHTML = routine(); return; }
      if (sub === "scheda" && DAYS.length) { el.innerHTML = schedaPage(); return; }
      if (sub === "esercizio" && ED) { el.innerHTML = edPage(); return; }
      if (sub === "altre" && ED) { el.innerHTML = altrePage(); return; }
      if (sub === "quiz" && window.V3Quiz && V3Quiz.cur) { el.innerHTML = V3Quiz.html(); return; }
      el.innerHTML = home();
    },
    on: Object.assign({}, window.V3Quiz ? V3Quiz.on : {}, {
      "q-scheda"() { if (window.V3Quiz) open("quiz", () => V3Quiz.start(V3Quiz.cfg.scheda())); },
      "q-seduta"() { if (window.V3Quiz) open("quiz", () => V3Quiz.start(V3Quiz.cfg.seduta())); },
      "apri-seduta"(k) { if (P[k]) open("seduta", () => { selDay = k; }); },
      settimana() { open("settimana"); },
      routine() { open("routine"); },
      modifica() { if (!DAYS.length) return V3.legacy({ tab: "piano", hub: "train" }); const ts = data.todaySession(); open("scheda", () => { selDay = ts.day && P[ts.day] ? ts.day : DAYS[0]; }); },
      struttura() { V3.legacy({ tab: "piano", hub: "train" }); },
      "sc-day"(i) { if (DAYS[+i]) { selDay = DAYS[+i]; V3.refresh(); } },
      "ed-open"(a) { const [s2, j] = String(a).split(":").map(Number); openEd(s2, j); },
      "ed-schema"() { if (!ED) return; schemaSheet({ name: short(ED.x.nome), sub: edSub(), x: ED.x, today: false, onSave(sc, rest) { putSch(ED.x, sc); ED.x.recupero = rest; saveEd(); V3.refresh(); } }); },
      "ed-rest"() { if (ED) restSheet(ED.x, r => { ED.x.recupero = r; saveEd(true); V3.refresh(); }); },
      "ed-altre"() { if (ED) open("altre"); },
      "ed-save"() { if (!ED) return; saveEd(); V3.back(); },
      "al-mis"() { if (ED) pickSheet("Come si misura", [["pesi", "Con pesi", "Chili e ripetizioni"], ["corpo", "A corpo libero", "Solo ripetizioni"], ["tempo", "A tempo", "Secondi per serie"], ["distanza", "A distanza", "Metri per serie"]], misOf(ED.x), v => { ED.x.misura = v; saveEd(true); V3.refresh(); }); },
      "al-salto"() { if (ED) pickSheet("Salto di peso", [[0.5, "0,5 kg"], [1, "1 kg"], [2, "2 kg"], [2.5, "2,5 kg"]].map(([v, t]) => [v, t, v === 2.5 ? "Bilanciere, esercizi grandi" : v <= 1 ? "Esercizi piccoli, cavi" : "Manubri"]), itemOf(ED.x, ED.s, ED.e).salto, v => { ED.x.salto = +v; saveEd(true); V3.refresh(); }); },
      "al-risc"() { if (!ED) return; ED.x.risc = !ED.x.risc; saveEd(true); V3.refresh(); },
      "al-lato"() { if (!ED) return; ED.x.lato = !ED.x.lato; saveEd(true); V3.refresh(); },
      "al-nota"() { if (ED) notaSheet(ED.x, v => { ED.x.nota = v; saveEd(true); V3.refresh(); }); },
      stretch() { open("warm", () => { W = { kind: "stretch", day: null, i: 0, quick: false, left: null, run: false }; }); },
      inizia(k) {
        if (!P[k]) return;
        if (activeDay() || !(has("doneToday") && doneToday())) return begin(k);
        const s = V3.sheet(`<h2 class="v3-sh1">${tv("Seduta già fatta oggi", "Allenamento già fatto oggi")}</h2><p class="v3-shp">Domani rende di più: i muscoli crescono a riposo.</p>
          <button class="v3-apri wide" data-v3act="later">Rimando a domani</button><button class="v3-b2" data-v3act="anyway">Inizia lo stesso</button>`,
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
    })
  });
})();
