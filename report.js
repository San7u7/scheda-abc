"use strict";
/* Askesis · «Il mio report» (tavole 81-84, 29/10): Generale (cibo e allenamento incrociati), Palestra, Cibo; ‹ settimana ›.
   Di default l'ultima settimana chiusa (lunedì-domenica). Tutti i numeri da V3Stats (storico.js), stesse soglie.
   «Com'è andata» = 2-3 frasi scritte da REGOLE sui dati (niente IA). 3 consigli scelti da regole con priorità:
   sicurezza, piano (del dietista o della scheda), abitudini. I consigli sul cibo restano sempre «dentro il tuo piano».
   Minori: niente calorie, grassi, peso del corpo; fino a 13 anni niente chili e frasi semplici rivolte al bambino, movimento 60 minuti al giorno.
   Over 65: «allenamento», niente peso sollevato, avviso «Peso in calo: parlane col medico» (calo() di sec-progressi.js).
   Con pochi dati: messaggio onesto, nessun numero inventato. Condividi = navigator.share (testo) o copia; PDF = stampa con foglio pulito. */
(function () {
  if (!window.V3 || !window.V3Stats) return;
  const { ui, data } = V3, e = ui.esc, nf = ui.nf, X = window.V3Stats, SO = X.SOGLIE;
  const TIPI = ["generale", "palestra", "cibo"];
  const rp = { tipo: 0, from: null };
  const today = () => localISO();
  const lastClosed = () => addDays(X.monOf(today()), -7);
  const prof = () => data.profile();
  const kid = () => prof().group === "bambino", minor = () => prof().minor, o65 = () => prof().over65;
  const kw = () => X.kw(), W1 = () => kw() ? "allenamento" : "seduta", WN = () => kw() ? "allenamenti" : "sedute";
  const pl = (n, a, b) => n === 1 ? a : b;
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const B = s => `<b>${e(s)}</b>`;
  const calo = () => { try { return window.V3Calo ? window.V3Calo() : null; } catch (_) { return null; } };
  const art = l => { const x = l.toLowerCase(); return ({ pranzo: "il ", spuntino: "lo " })[x] || "la "; }; // «la colazione», «lo spuntino», «il pranzo»
  const fatW = v => v == null || typeof fatWord !== "function" ? null : fatWord(v);

  /* ============================== numeri della settimana ============================== */
  function facts(from) {
    const wk = X.week(from), ds = wk.days, closed = ds.filter(d => d.closed), reg = closed.filter(d => d.reg);
    const a = k => wk.agg(k);
    const ses = wk.sessions, T = wk.T;
    const gym = reg.filter(d => d.train), rest = reg.filter(d => !d.train);
    const mAvg = (arr, k) => arr.length ? Math.round(avg(arr.map(d => d[k]))) : null;
    const mealsAll = closed.flatMap(d => d.meals), eaten = mealsAll.filter(m => m.eaten).length;
    const miss = {}; closed.filter(d => d.reg).forEach(d => d.meals.forEach(m => { if (!m.eaten) miss[m.k] = (miss[m.k] || 0) + 1; }));
    const topMiss = Object.entries(miss).sort((x, y) => y[1] - x[1])[0];
    const prev = X.week(addDays(from, -7));
    const fat = ses.filter(s => s.fatica != null).map(s => s.fatica), fatP = prev.sessions.filter(s => s.fatica != null).map(s => s.fatica);
    const vol = ses.reduce((m, s) => m + s.vol, 0), volP = prev.sessions.reduce((m, s) => m + s.vol, 0);
    const pesoA = a("peso").avg, pesoP = prev.agg("peso").avg;
    /* esercizi: carico migliore della settimana contro la settimana di 4 settimane fa */
    const ex = {}; ses.forEach(s => s.items.forEach(x => { const o = ex[x.name] = ex[x.name] || { name: x.name, n: 0, best: null }; o.n++; if (x.best && (!o.best || (x.best.kg || 0) > (o.best.kg || 0) || ((x.best.kg || 0) === (o.best.kg || 0) && x.best.reps > o.best.reps))) o.best = x.best; }));
    const old = X.week(addDays(from, -28)).sessions, oldBest = name => { let b = null; old.forEach(s => s.items.filter(x => x.name === name).forEach(x => { if (x.best && (!b || (x.best.kg || 0) > (b.kg || 0) || ((x.best.kg || 0) === (b.kg || 0) && x.best.reps > b.reps))) b = x.best; })); return b; };
    const exs = Object.values(ex).sort((x, y) => y.n - x.n || ((y.best && y.best.kg) || 0) - ((x.best && x.best.kg) || 0)).slice(0, 4).map(o => Object.assign(o, { old: oldBest(o.name) }));
    const useKg = o => !kid() && o.best && o.best.kg != null && o.best.kg > 0;
    const diffOf = o => !o.old ? null : useKg(o) && o.old.kg != null ? o.best.kg - o.old.kg : o.best.reps - o.old.reps;
    const both = exs.filter(o => o.old), up = both.filter(o => diffOf(o) > 0);
    return { wk, ds, reg: reg.length, closedN: closed.length, ses, T, a, gym, rest, mAvg, eaten, planned: mealsAll.length, topMiss: topMiss && topMiss[1] >= 2 ? { k: topMiss[0], n: topMiss[1], label: (MEALS.find(m => m[0] === topMiss[0]) || [0, topMiss[0]])[1] } : null,
      leg: closed.reduce((m, d) => m + d.leg, 0), pesce: closed.reduce((m, d) => m + d.pesce, 0), fat, fatP, vol, volP, sets: ses.reduce((m, s) => m + s.sets, 0), pesoA, pesoP, exs, useKg, diffOf, both, up,
      cardio: a("cardio").total, cardioT: X.cardioT(), dolore: ses.some(s => s.dolore), colMiss: miss.col || 0 };
  }

  /* ============================== frasi a regole ============================== */
  function fraseSedute(f) {
    if (kid()) return f.T ? `Questa settimana hai fatto ${B(f.ses.length + " " + pl(f.ses.length, "allenamento", "allenamenti") + " su " + f.T)}.` : `Questa settimana hai fatto ${B(f.ses.length + " " + pl(f.ses.length, "allenamento", "allenamenti"))}.`;
    const s = f.T ? `${f.ses.length} ${pl(f.ses.length, W1(), WN())} su ${f.T}` : `${f.ses.length} ${pl(f.ses.length, W1(), WN())}`;
    return (f.T && f.ses.length >= f.T ? "Settimana completa: hai fatto " : "Hai fatto ") + B(s);
  }
  function generale(f) {
    const pro = f.a("pro"), kc = f.a("kcal"), out = [];
    if (kid()) {
      out.push(fraseSedute(f));
      if (pro.n) out.push(`Hai mangiato abbastanza proteine ${B(pro.okN + " " + pl(pro.okN, "giorno", "giorni") + " su " + pro.n)}.`);
      const aq = f.a("acqua"); if (aq.n) out.push(`Hai bevuto in media ${B(nf(aq.avg, 1) + " litri")} al giorno.`);
      return out;
    }
    out.push(fraseSedute(f) + (pro.n ? ` e raggiunto l'obiettivo di proteine ${B(pro.okN + " " + pl(pro.okN, "giorno", "giorni") + " su " + pro.n)}.` : "."));
    let s2 = "";
    if (!minor()) { const g = f.mAvg(f.gym, "kcal"), gT = f.mAvg(f.gym, "kcalT");
      if (g != null) s2 += Math.abs(g - gT) <= SO.CALORIE_IN_LINEA ? `Nei giorni di ${o65() ? "allenamento" : "palestra"} hai mangiato quanto previsto. ` : `Nei giorni di ${o65() ? "allenamento" : "palestra"} hai mangiato ${B(nf(Math.abs(g - gT), 0) + " calorie")} ${g < gT ? "in meno" : "in più"} del previsto. `; }
    const rp0 = f.mAvg(f.rest, "pro"), rT = f.mAvg(f.rest, "proT");
    if (rp0 != null) s2 += rp0 < rT ? `Nei giorni di riposo ti mancano ancora ${B(nf(rT - rp0, 0) + " g")} di proteine.` : "Nei giorni di riposo le proteine sono in linea.";
    else if (minor()) { const fv = f.a("fv"); if (fv.n) s2 += `Frutta e verdura: in media ${B(nf(fv.avg, 0) + " porzioni")} al giorno su ${SO.FV_PORZIONI}.`; }
    if (s2) out.push(s2.trim());
    if (!minor()) { const c = o65() && calo();
      if (c) out.push(`Il peso è sceso di ${B(nf(c.kg) + " kg")} in 3 mesi: parlane col medico.`);
      else if (f.pesoA != null) out.push(f.pesoP == null ? `Peso medio della settimana: ${B(nf(f.pesoA) + " kg")}.` : Math.abs(f.pesoA - f.pesoP) < SO.PESO_STABILE ? `Il peso è stabile: media ${B(nf(f.pesoA) + " kg")}, come la settimana prima.` : `Il peso ${f.pesoA > f.pesoP ? "sale" : "scende"}: media ${B(nf(f.pesoA) + " kg")}, ${(f.pesoA > f.pesoP ? "+" : "−") + nf(Math.abs(f.pesoA - f.pesoP))} kg sulla settimana prima.`); }
    return out.slice(0, 3);
  }
  function palestra(f) {
    const out = [], fa = avg(f.fat), w = fatW(fa);
    if (kid()) { out.push(fraseSedute(f)); if (f.sets) out.push(`In tutto hai fatto ${B(f.sets + " serie")}.`); if (f.cardio || f.cardioT) out.push(`Ti sei mosso ${B(nf(f.cardio, 0) + " minuti")}: l'obiettivo è 60 minuti al giorno.`); return out; }
    out.push(fraseSedute(f) + (w ? `, con fatica in media ${e(w.toLowerCase())}.` : "."));
    if (!o65() && f.vol) out.push(`Hai sollevato ${B(nf(f.vol, 0) + " kg")} in tutto` + (f.volP ? `, il ${Math.abs(Math.round((f.vol - f.volP) / f.volP * 100))}% in ${f.vol >= f.volP ? "più" : "meno"} della settimana prima.` : "."));
    else if (f.sets) out.push(`Hai fatto ${B(f.sets + " serie")} in tutto.`);
    if (f.both.length) out.push(`Nel mese il carico è salito su ${B(f.up.length + " " + pl(f.both.length, "esercizio", "esercizi") + " su " + f.both.length)}.`);
    else if (f.cardioT) out.push(`Cardio: ${B(nf(f.cardio, 0) + " minuti su " + f.cardioT)}.`);
    return out.slice(0, 3);
  }
  function cibo(f) {
    const out = [], pro = f.a("pro"), kc = f.a("kcal"), fv = f.a("fv");
    if (kid()) {
      out.push(`Hai segnato ${B(f.eaten + " pasti su " + f.planned)}.` + (f.topMiss ? ` Il pasto che salti più spesso è ${e(art(f.topMiss.label) + f.topMiss.label.toLowerCase())}.` : ""));
      if (pro.n) out.push(`Hai mangiato abbastanza proteine ${B(pro.okN + " " + pl(pro.okN, "giorno", "giorni") + " su " + pro.n)}.`);
      if (fv.n) out.push(fv.avg >= SO.FV_PORZIONI ? "Frutta e verdura: ne mangi abbastanza." : `Frutta e verdura: in media ${B(nf(fv.avg, 0))} porzioni al giorno, ne servono ${SO.FV_PORZIONI}.`);
      return out;
    }
    out.push(`Hai segnato ${B(f.eaten + " pasti su " + f.planned)}` + (f.topMiss ? `: ${e(art(f.topMiss.label) + f.topMiss.label.toLowerCase())} è il pasto che resta più spesso non mangiato.` : "."));
    let s2 = "";
    if (!minor() && kc.n) { const d = kc.avg - kc.tAvg; s2 += `Le calorie sono ${Math.abs(d) <= SO.CALORIE_IN_LINEA ? "vicine al" : d < 0 ? "sotto il" : "sopra il"} piano, in media ${B(nf(Math.round(kc.avg), 0) + " su " + nf(Math.round(kc.tAvg), 0))}. `; }
    if (pro.n) s2 += `Le proteine arrivano all'obiettivo ${pro.okN} ${pl(pro.okN, "giorno", "giorni")} su ${pro.n}.`;
    if (s2) out.push(s2.trim());
    const fvOk = fv.n && fv.avg >= SO.FV_PORZIONI, legOk = f.leg >= SO.LEGUMI[0], peOk = f.pesce >= SO.PESCE[0];
    const low = [!legOk ? "legumi" : null, !peOk ? "pesce" : null].filter(Boolean);
    if (fv.n) out.push(`Frutta e verdura ${fvOk ? "vanno bene" : "sono poche"}` + (low.length ? `; ${low.join(" e ")} ${low.length > 1 ? "sono pochi" : low[0] === "pesce" ? "è poco" : "sono pochi"}.` : "."));
    return out.slice(0, 3);
  }

  /* ============================== consigli a regole (priorità: sicurezza, piano, abitudini) ============================== */
  function consigliPal(f) {
    const s = [], p = [], h = [], fa = avg(f.fat), faP = avg(f.fatP), hard = o65() ? "«Pesante» o «Troppo»" : "«Dura» o «Al limite»";
    if (f.dolore) s.push({ t: "Hai segnalato dolore", s: `Parlane con il medico prima ${kw() ? "del prossimo allenamento" : "della prossima seduta"}.` });
    if (fa != null && faP != null && fa >= SO.FATICA_DURA && faP >= SO.FATICA_DURA && !kid()) s.push({ t: "Una settimana più leggera", s: `Due settimane di fila ${hard}: fai metà delle serie.` });
    if (o65() && calo()) s.push({ t: "Peso in calo: parlane col medico", s: "Un calo di peso in pochi mesi va sempre sentito dal medico." });
    if (kid()) {
      if (f.T && f.ses.length < f.T) p.push({ t: "Un allenamento alla volta", s: "Chiedi all'adulto che ti allena quando fare il prossimo." });
      p.push({ t: "Una ripetizione in più", s: "Prova a farne una in più all'esercizio che ti piace." });
      if (f.cardio < f.cardioT) h.push({ t: "60 minuti di movimento al giorno", s: "Gioco, bici, corsa: conta tutto." });
      else h.push({ t: "Continua a muoverti così", s: "Hai fatto il movimento della settimana." });
      return { s, p, h };
    }
    if (f.T && f.ses.length < f.T) p.push({ t: `Fissa i giorni ${kw() ? "degli" : "delle"} ${f.T} ${WN()}`, s: "Mettili in agenda come un appuntamento." });
    const ferma = f.exs.find(o => o.old && f.diffOf(o) === 0);
    if (ferma) p.push({ t: `${ferma.name}: tutte le ripetizioni`, s: minor() ? "Quando chiudi tutte le serie, chiedi al preparatore se salire." : "Quando chiudi tutte le serie, l'app ti propone di salire." });
    if (f.cardio < f.cardioT) { const n = Math.max(1, Math.ceil((f.cardioT - f.cardio) / 30)); h.push({ t: `${n} ${pl(n, "camminata veloce", "camminate veloci")} da 30 minuti`, s: `Anche nei giorni di riposo: arrivi a ${f.cardioT} minuti.` }); }
    if (f.T && f.ses.length >= f.T) h.push({ t: `Tieni il ritmo ${kw() ? "degli" : "delle"} ${f.T} ${WN()}`, s: "È la cosa che sta funzionando meglio." });
    h.push({ t: o65() ? "Fatica «Giusto» va bene" : "Fatica «Giusta» o «Dura» va bene", s: `Due settimane di fila ${hard}? Una settimana con metà serie.` });
    return { s, p, h };
  }
  function consigliCibo(f) {
    const s = [], p = [], h = [], kc = f.a("kcal"), pro = f.a("pro"), aq = f.a("acqua"), fv = f.a("fv"), wT = X.waterT();
    if (kid()) {
      if (f.colMiss >= 2) s.push({ t: "Non saltare la colazione", s: "Ti dà energia per la scuola e per giocare." });
      if (f.topMiss && f.topMiss.k !== "col") p.push({ t: `Non saltare ${art(f.topMiss.label) + f.topMiss.label.toLowerCase()}`, s: "Chiedi a mamma o papà di prepararlo insieme." });
      if (aq.n && aq.avg < wT) h.push({ t: "Un bicchiere d'acqua a ogni pasto", s: "Bere spesso ti aiuta a stare attento." });
      if (fv.n && fv.avg < SO.FV_PORZIONI) h.push({ t: "Un frutto o la verdura a ogni pasto", s: "Più colori nel piatto, più vitamine." });
      if (f.eaten < f.planned) h.push({ t: "Segna tutti i pasti", s: "Così vedi meglio come stai andando." });
      return { s, p, h };
    }
    if (!minor() && kc.n && kc.avg < kc.tAvg - 300) s.push({ t: "Mangia tutti i pasti del piano", s: `Sei sotto di circa ${nf(Math.round((kc.tAvg - kc.avg) / 50) * 50, 0)} calorie al giorno: segui le porzioni del tuo piano.` });
    if (minor() && f.colMiss >= 2) s.push({ t: "Non saltare la colazione", s: "Dà energia per la scuola e l'allenamento, come nel tuo piano." });
    if (o65() && pro.n && pro.avg < pro.tAvg * 0.9) s.push({ t: "Proteine a ogni pasto, dentro il tuo piano", s: "Legumi, pesce, uova o latticini, come previsto dal piano." });
    if (f.topMiss) p.push({ t: `Prepara ${art(f.topMiss.label) + f.topMiss.label.toLowerCase()} la sera prima`, s: "Così non lo salti: è già nel tuo piano." });
    const rp0 = f.mAvg(f.rest, "pro"), rT = f.mAvg(f.rest, "proT");
    if (rp0 != null && rp0 < rT - 5) p.push({ t: "Le proteine del piano anche a riposo", s: "Segui le porzioni del tuo piano anche nei giorni senza palestra." });
    if (f.closedN >= 5 && f.leg < SO.LEGUMI[0]) p.push({ t: "Legumi 2 volte, se il tuo piano lo prevede", s: "Altrimenti chiedi al tuo dietista dove inserirli." });
    if (f.closedN >= 5 && f.pesce < SO.PESCE[0]) p.push({ t: "Pesce 2 volte, dentro il tuo piano", s: "Salmone o sgombro danno anche i grassi buoni." });
    if (aq.n && aq.avg < wT) h.push({ t: "Un bicchiere d'acqua in più a ogni pasto", s: `Così arrivi a circa ${nf(wT, 1)} L al giorno.` });
    if (fv.n && fv.avg < SO.FV_PORZIONI) h.push({ t: "Frutta o verdura a ogni pasto, dentro il tuo piano", s: "Cinque porzioni al giorno, più colori possibile." });
    if (f.eaten < f.planned) h.push({ t: "Segna tutti i pasti", s: "Più pasti segnati, numeri più precisi." });
    h.push({ t: "Conta la media della settimana", s: "Un giorno fuori dal piano non cambia il risultato." });
    return { s, p, h };
  }
  function pick3(...groups) { // gruppi già in ordine di priorità
    const out = [], seen = new Set();
    for (const g of groups) for (const c of g) { if (out.length >= 3) return out; if (!seen.has(c.t)) { seen.add(c.t); out.push(c); } }
    return out;
  }

  /* ============================== pagine ============================== */
  const of = (t, u) => ({ of: t, unit: u });
  function tiles(tipo, f) {
    const pro = f.a("pro"), kc = f.a("kcal"), aq = f.a("acqua"), fv = f.a("fv"), wT = X.waterT();
    const sed = { label: cap(WN()), value: String(f.ses.length), ...(f.T ? of(f.T) : {}), pct: f.T ? ui.pct(f.ses.length, f.T) : null };
    const proG = { label: "Proteine", value: pro.n ? String(pro.okN) : "–", ...(pro.n ? of(pro.n, "giorni") : {}), pct: pro.n ? ui.pct(pro.okN, pro.n) : null, miss: pro.n ? null : "Nessun giorno segnato" };
    const acqua = { label: "Acqua", value: aq.n ? nf(aq.avg, 1) : "–", ...of(nf(wT, 1), "L"), pct: aq.n ? ui.pct(aq.avg, wT) : null, miss: aq.n ? "media al giorno" : "Non segnata" };
    const fvT = { label: "Frutta e verdura", value: fv.n ? nf(fv.avg, 0) : "–", ...of(SO.FV_PORZIONI, "porzioni"), pct: fv.n ? ui.pct(fv.avg, SO.FV_PORZIONI) : null, miss: fv.n ? "media al giorno" : "Nessun giorno segnato" };
    if (tipo === "palestra") {
      const fa = avg(f.fat), w = fatW(fa);
      const t2 = { label: "Fatica", value: w || "–", miss: f.fat.length ? `media ${pl(f.fat.length, kw() ? "dell'allenamento" : "della seduta", (kw() ? "dei " : "delle ") + f.fat.length + " " + WN())}` : "Non segnata" };
      const t3 = !kid() && !o65() ? { label: "Peso sollevato", value: f.vol ? nf(f.vol, 0) : "–", unit: f.vol ? "kg" : null, miss: f.vol && f.volP ? `${f.vol >= f.volP ? "+" : "−"}${Math.abs(Math.round((f.vol - f.volP) / f.volP * 100))}% sulla settimana prima` : f.vol ? "" : `Nessuna ${W1()} con i pesi` }
        : { label: "Serie fatte", value: String(f.sets) };
      const t4 = { label: kid() ? "Movimento" : "Cardio", value: nf(f.cardio, 0), ...of(f.cardioT, "minuti"), pct: ui.pct(f.cardio, f.cardioT) };
      return [sed, t2, t3, t4];
    }
    if (tipo === "cibo") {
      const pasti = { label: "Pasti segnati", value: String(f.eaten), ...of(f.planned), pct: ui.pct(f.eaten, f.planned || 1) };
      const proM = minor() || !pro.n ? proG : { label: "Proteine", value: nf(Math.round(pro.avg), 0), ...of(nf(Math.round(pro.tAvg), 0), "g"), pct: ui.pct(pro.avg, pro.tAvg), miss: "media al giorno" };
      return [pasti, proM, acqua, fvT];
    }
    if (minor()) return [sed, proG, acqua, fvT];
    const cal = kc.n ? { label: "Calorie", value: nf(Math.round(kc.avg), 0), ...of(nf(Math.round(kc.tAvg), 0)), pct: ui.pct(kc.avg, kc.tAvg), miss: "media al giorno" } : { label: "Calorie", value: "–", miss: "Nessun giorno segnato" };
    const c = o65() && calo();
    const peso = c ? { label: "Peso", value: nf(f.pesoA != null ? f.pesoA : c.to), unit: "kg", miss: "In calo: parlane col medico" }
      : f.pesoA == null ? { label: "Peso", value: "–", miss: "Nessuna pesata" }
      : { label: "Peso", value: nf(f.pesoA), unit: "kg", miss: f.pesoP == null ? "media della settimana" : Math.abs(f.pesoA - f.pesoP) < SO.PESO_STABILE ? "uguale alla settimana prima" : `${f.pesoA > f.pesoP ? "+" : "−"}${nf(Math.abs(f.pesoA - f.pesoP))} kg sulla settimana prima` };
    return [sed, proG, cal, peso];
  }
  function table(tipo, f) {
    const T = (h, rows) => `<div class="v3-st-tw"><table class="v3-st-tb"><thead><tr>${h.map(x => `<th scope="col">${e(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if (tipo === "palestra") {
      if (!f.exs.length) return "";
      const kgOn = o => f.useKg(o);
      const rows = f.exs.map(o => { const d = f.diffOf(o), k = kgOn(o);
        return [e(o.name), !o.best ? "–" : k ? nf(o.best.kg) + " kg" : o.best.reps + " ripetizioni", d == null ? "–" : d === 0 ? "uguale" : (d > 0 ? "+" : "−") + nf(Math.abs(d)) + (k ? " kg" : "")]; });
      return ui.section(kid() ? "I tuoi esercizi" : "Esercizi principali", T(["Esercizio", kid() ? "Ripetizioni" : "Carico", "Da 4 settimane fa"], rows));
    }
    if (tipo === "cibo") {
      const rows = [[e("Legumi"), String(f.leg), `da ${SO.LEGUMI[0]} a ${SO.LEGUMI[1]}`], [e("Pesce"), String(f.pesce), `da ${SO.PESCE[0]} a ${SO.PESCE[1]}`]];
      if (f.topMiss) rows.push([e(f.topMiss.label + " non mangiato"), String(f.topMiss.n), ""]);
      return ui.section("Cosa hai mangiato", T(["", "Volte", "Consigliato"], rows));
    }
    const g = f.gym, r = f.rest, m = (arr, k, u) => { const v = f.mAvg(arr, k); return v == null ? "–" : nf(v, 0) + (u ? " " + u : ""); };
    const rows = (minor() ? [] : [[e("Calorie"), m(g, "kcal"), m(r, "kcal")]]).concat([[e("Proteine"), m(g, "pro", "g"), m(r, "pro", "g")]]);
    if (minor()) rows.push([e("Frutta e verdura"), m(g, "fv"), m(r, "fv")]);
    if (!g.length && !r.length) return "";
    return ui.section(o65() || kid() ? "Allenamento e riposo a confronto" : "Palestra e riposo a confronto", T(["", o65() || kid() ? "Allenamento" : "Palestra", "Riposo"], rows));
  }
  const consigliHtml = list => list.length ? ui.section(kid() ? "Per la prossima settimana" : "Consigli per la settimana", `<ol class="v3-rp-cs">${list.map((c, i) => `<li><span class="v3-rp-n" aria-hidden="true">${i + 1}</span><div><p class="v3-rp-ct">${e(c.t)}</p><p class="v3-rp-cx">${e(c.s)}</p></div></li>`).join("")}</ol>`) : "";
  function build() {
    const tipo = TIPI[rp.tipo], from = rp.from, f = facts(from);
    const fewCibo = f.reg < SO.REPORT_GIORNI, noSes = !f.ses.length;
    let verdict, frasi = [], few = false, cons = [];
    const cp = consigliPal(f), cc = consigliCibo(f);
    if (tipo === "palestra") {
      few = noSes && !f.cardio;
      verdict = few ? `Nessun${kw() ? " allenamento" : "a seduta"} in questa settimana` : f.T ? `${f.ses.length} ${pl(f.ses.length, W1(), WN())} su ${f.T}` : `${f.ses.length} ${pl(f.ses.length, W1(), WN())}`;
      if (!few) { frasi = palestra(f); cons = pick3(cp.s, cp.p, cp.h); }
    } else if (tipo === "cibo") {
      few = fewCibo;
      const kc = f.a("kcal");
      verdict = few ? "Ancora pochi giorni segnati" : minor() || !kc.n ? `${f.eaten} pasti segnati su ${f.planned}` : Math.abs(kc.avg - kc.tAvg) <= SO.CALORIE_IN_LINEA ? "Calorie vicine al piano" : kc.avg < kc.tAvg ? "Calorie sotto il piano" : "Calorie sopra il piano";
      if (!few) { frasi = cibo(f); cons = pick3(cc.s, cc.p, cc.h); }
    } else {
      few = fewCibo && noSes;
      const pro = f.a("pro");
      verdict = few ? "Ancora pochi dati" : f.T && f.ses.length >= f.T && pro.n && pro.okN * 2 >= pro.n ? "Settimana completa" : f.T && f.ses.length >= f.T ? (kw() ? "Tutti gli allenamenti fatti" : "Tutte le sedute fatte") : "Settimana a metà";
      if (!few) { frasi = fewCibo ? palestra(f) : generale(f); cons = pick3(cc.s, cp.s, cc.p.slice(0, 1), cp.p.slice(0, 1), cc.h.slice(0, 1), cp.h.slice(0, 1), cc.p, cp.p, cc.h, cp.h); }
    }
    return { tipo, f, verdict, frasi, few, cons, fewCibo, noSes };
  }
  const nav = () => { const to = addDays(rp.from, 6), nx = addDays(rp.from, 7) <= lastClosed();
    return `<div class="v3-st-nav"><button class="v3-st-ar" data-v3act="rp-prev" aria-label="Settimana prima">‹</button><b>${e(X.wLab(rp.from, to))}</b><button class="v3-st-ar" data-v3act="rp-next" aria-label="Settimana dopo"${nx ? "" : " disabled"}>›</button></div>`; };
  const SAPR = { generale: "Il report si aggiorna ogni lunedì con la settimana appena finita", palestra: "Il muscolo cresce se il lavoro aumenta piano", cibo: "I legumi danno proteine e fibre insieme" };
  function page() {
    const r = build(), f = r.f;
    let body;
    if (r.few) {
      const what = r.tipo === "palestra" ? `Nessun${kw() ? " allenamento" : "a seduta"} e nessun cardio segnati in questa settimana.` : `Giorni con i pasti segnati: ${f.reg}. ${r.tipo === "cibo" ? "Ne servono almeno " + SO.REPORT_GIORNI + " per parlare del cibo." : `${cap(WN())}: ${f.ses.length}.`}`;
      body = ui.card(`<p class="v3-progressi-nd" style="font-size:24px;font-weight:800">Ancora pochi dati</p><p class="v3-bd">${e(what)}</p><p class="v3-bd">Il report usa solo quello che segni: niente numeri inventati.</p>`)
        + ui.secondary(r.tipo === "palestra" ? "Vai in palestra" : "Segna i pasti", "go", r.tipo === "palestra" ? "palestra" : "cibo");
    } else {
      body = ui.section("Com'è andata", `<div class="v3-cc v3-rp-txt">${r.frasi.map(s => `<p>${s}</p>`).join("")}</div>`)
        + ui.limeBox({ title: kid() ? "La tua settimana in numeri" : "I numeri della settimana", tiles: tiles(r.tipo, f) })
        + (r.tipo === "generale" && r.fewCibo ? "" : table(r.tipo, f))
        + consigliHtml(r.cons)
        + `<div class="v3-rp-acts"><button class="v3-apri wide" data-v3act="rp-share">Condividi il report</button>${ui.secondary("Salva in PDF", "rp-pdf")}</div>`;
    }
    return `<div class="v3-rp">` + ui.back() + `<div><h1 class="v3-t1">Il mio report</h1><p class="v3-sub">${e(r.verdict)}</p></div>` + `<div class="v3-rp-ctl">${ui.seg(["Generale", "Palestra", "Cibo"], rp.tipo, "rp-tipo", "Tipo di report")}${nav()}</div>` + body
      + ui.end(SAPR[r.tipo], { leoQ: r.tipo === "palestra" ? "Come sono andati gli allenamenti questa settimana?" : r.tipo === "cibo" ? "Come ho mangiato questa settimana?" : "Cosa posso migliorare la prossima settimana?" }) + `</div>`;
  }
  function plain() {
    const r = build(), strip = s => s.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
    const head = `Il mio report ${["generale", "palestra", "cibo"][rp.tipo]}, ${X.wLab(rp.from, addDays(rp.from, 6))}`;
    if (r.few) return `${head}\nAncora pochi dati in questa settimana.`;
    return [head, r.verdict, "", ...r.frasi.map(strip), "", ...tiles(r.tipo, r.f).map(t => `${t.label}: ${t.value}${t.of != null ? " / " + t.of : ""}${t.unit ? " " + t.unit : ""}`), "",
      r.cons.length ? "Consigli:" : "", ...r.cons.map((c, i) => `${i + 1}. ${c.t}. ${c.s}`)].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n").trim();
  }
  async function share() {
    const text = plain();
    try { if (navigator.share) { await navigator.share({ title: "Il mio report", text }); return; } } catch (err) { if (err && err.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); if (typeof toast === "function") toast("Report copiato", { sub: "Incollalo dove vuoi" }); }
    catch (_) { V3.sheet(`<h2 class="v3-sh1">Il mio report</h2><p class="v3-shp" style="white-space:pre-wrap">${e(text)}</p><button class="v3-b2" data-v3act="close">Chiudi</button>`); }
  }
  function pdf() {
    document.body.classList.add("v3-print");
    const off = () => { document.body.classList.remove("v3-print"); window.removeEventListener("afterprint", off); };
    window.addEventListener("afterprint", off);
    setTimeout(() => { try { window.print(); } catch (_) {} setTimeout(off, 1000); }, 50);
  }

  if (!document.getElementById("v3-sec-report")) {
    const s = document.createElement("style"); s.id = "v3-sec-report";
    s.textContent = `
    #view.v3 .v3-rp { display: flex; flex-direction: column; gap: var(--v3-gap); }
    #view.v3 .v3-rp-ctl { display: flex; flex-direction: column; gap: 16px; }
    #view.v3 .v3-rp-txt p { font-size: 16px; line-height: 1.45; }
    #view.v3 .v3-rp-txt b { font-weight: 700; }
    #view.v3 .v3-rp-cs { list-style: none; margin: 0; padding: 16px; border-radius: 24px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 6%, transparent); display: flex; flex-direction: column; gap: 18px; }
    #view.v3 .v3-rp-cs li { display: flex; gap: 12px; align-items: flex-start; }
    #view.v3 .v3-rp-n { width: 28px; height: 28px; flex: none; border-radius: 14px; background: var(--v3-lime); color: var(--v3-ink); font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; }
    #view.v3 .v3-rp-ct { font-size: 16px; font-weight: 700; line-height: 1.3; }
    #view.v3 .v3-rp-cx { font-size: 16px; color: var(--v3-t2); line-height: 1.4; margin-top: 2px !important; }
    #view.v3 .v3-rp td { white-space: nowrap; }
    #view.v3 .v3-rp-acts { display: flex; flex-direction: column; gap: 12px; }
    @media print {
      body.v3-print { background: #fff !important; }
      body.v3-print #v3bar, body.v3-print #top, body.v3-print .coach-fab, body.v3-print #v3-overlay, body.v3-print .v3-back, body.v3-print .v3-rp-ctl .v3-seg, body.v3-print .v3-st-ar, body.v3-print .v3-rp-acts, body.v3-print .v3-end, body.v3-print .v3-gear, body.v3-print #hello, body.v3-print #bar { display: none !important; }
      body.v3-print .wrap { padding: 0 !important; }
      body.v3-print #view.v3 { padding-top: 0; color: #000; background: #fff; gap: 16px; }
      body.v3-print #view.v3 * { color: #000 !important; box-shadow: none !important; }
      body.v3-print #view.v3 .v3-cc, body.v3-print #view.v3 .v3-st-tw, body.v3-print #view.v3 .v3-lime, body.v3-print #view.v3 .v3-tile, body.v3-print #view.v3 .v3-rp-cs { background: #fff !important; border: 1px solid #bbb; }
      body.v3-print #view.v3 .v3-bar { background: #ddd !important; } body.v3-print #view.v3 .v3-bar i { background: #000 !important; }
      body.v3-print #view.v3 .v3-rp-n { background: #000 !important; color: #fff !important; }
      body.v3-print #view.v3 .v3-st-tb th, body.v3-print #view.v3 .v3-st-tb td { border-top-color: #ccc; }
      body.v3-print #view.v3 section, body.v3-print #view.v3 .v3-lime { break-inside: avoid; }
    }`;
    document.head.appendChild(s);
  }

  window.V3Report = {
    reset(tipo) { const i = TIPI.indexOf(tipo); rp.tipo = i >= 0 ? i : 0; rp.from = lastClosed(); },
    render() { X.clear(); if (!rp.from) rp.from = lastClosed(); return page(); },
    on: {
      "rp-tipo"(i) { rp.tipo = Math.max(0, Math.min(2, +i)); V3.refresh(); },
      "rp-prev"() { rp.from = addDays(rp.from, -7); V3.refresh(); },
      "rp-next"() { const n = addDays(rp.from, 7); if (n <= lastClosed()) { rp.from = n; V3.refresh(); } },
      "rp-share"() { share(); },
      "rp-pdf"() { pdf(); }
    }
  };
})();
