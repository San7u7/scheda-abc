"use strict";
/* Askesis · «Il mio storico» (tavole 75-80, 29/10) e modulo di calcolo unico V3Stats (usato da storico, report e Progressi).
   Storico: Giorno / Settimana / Mese + ‹ periodo ›, nessun limite di date indietro, mai il futuro. Settimana sempre lunedì-domenica.
   Fonti in sola lettura: V3.data.day(iso) (consumato e obiettivo del giorno, con i target salvati da saveDayTarget), S.days, S.sessions,
   cardio fuori palestra (cardio_fuori) come cardioWeek. Nessuna scrittura.
   Regola A3 (audit 29/10): un giorno è «segnato» solo con almeno un pasto mangiato (come da piano o altro) o un fuori programma:
   un pasto «non mangiato» da solo NON conta, così le medie non scendono con giorni a 0.
   Il giorno mostra le stesse parole del diario (giorni.js): «Come da piano», «Altro: …», «Non mangiato», «Non segnato».
   I fuori programma non hanno righe (il diario non li mostra), ma restano nel totale del giorno, con una nota. */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3, e = ui.esc, nf = ui.nf;

  /* ============================== SOGLIE (uniche per storico, report e Progressi) ============================== */
  const SOGLIE = {
    CALORIE_IN_LINEA: 100,     // calorie in linea = entro 100 dall'obiettivo del giorno
    PROTEINE_MIN: 1,           // proteine raggiunte = almeno l'obiettivo (100%)
    PUNTO_PIENO: 0.95,         // settimana «punto pieno» (Progressi › Forza): proteine della settimana almeno al 95% del piano
    MOVIMENTO_GIORNO: 60,      // minori: minuti di movimento al giorno (OMS, = CARDIO.obiettivo 420 / 7)
    MACRO_BANDA: 0.10,         // carboidrati e grassi in linea = entro il 10% dall'obiettivo
    FV_PORZIONI: 5,            // frutta e verdura: 5 porzioni al giorno
    FV_MAX_PASTO: 3,           // porzioni contate al massimo per un pasto
    ACQUA_MIN: 1,              // acqua raggiunta = almeno l'obiettivo del piano (litri)
    PESO_STABILE: 0.2,         // kg: differenza di media sotto la quale il peso è «stabile»
    FATICA_DURA: 8,            // fatica «Dura» o più (scala 1-10 di sempre)
    REPORT_GIORNI: 3,          // giorni segnati minimi per parlare di cibo nel report
    CORREGGI_GIORNI: 13,       // il diario corregge fino a 13 giorni fa
    LEGUMI: [2, 4], PESCE: [2, 3] // volte a settimana (come Cibo › I cibi della settimana)
  };
  const RE_FV = /insalat|verdur|vegetal|lattuga|rucola|pomodor|zucchin|spinac|carot|broccol|finocch|peperon|melanzan|frutta(?! secca)|frutto|frutti rossi|\bmela\b|\bmele\b|\bpera\b|banana|arancia|spremuta|kiwi|fragol|mirtill/gi;
  const RE_LEG = /fagiol|ceci|lenticch|legum|piselli/i;
  const RE_PESCE = /pesce|orata|spigola|merluzzo|sgombro|tonno|salmone|sarde|alici/i;

  /* ============================== utilità date ============================== */
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const MES3 = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const GG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const today = () => localISO();
  const dt = iso => new Date(iso + "T12:00:00");
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1); // «Seduta A» → «seduta A»
  const isoOf = d => localISO(new Date(d));
  const monOf = iso => localISO(mondayOf(dt(iso)));
  const monthOf = iso => iso.slice(0, 8) + "01";
  const monthEnd = iso => { const d = dt(monthOf(iso)); d.setMonth(d.getMonth() + 1); d.setDate(0); return localISO(d); };
  const addMonth = (iso, n) => { const d = dt(monthOf(iso)); d.setMonth(d.getMonth() + n); return localISO(d); };
  const range = (a, b) => { const o = []; for (let d = a; d <= b; d = addDays(d, 1)) o.push(d); return o; };
  const dLong = iso => cap(`${GG[dt(iso).getDay()]} ${dt(iso).getDate()} ${MESI[dt(iso).getMonth()]}`);
  const dTab = iso => cap(GG[dt(iso).getDay()].slice(0, 3)) + " " + dt(iso).getDate();
  const gName = iso => GG[dt(iso).getDay()];
  const wLab = (a, b) => { const x = dt(a), y = dt(b); return x.getMonth() === y.getMonth() ? `${x.getDate()} – ${y.getDate()} ${MES3[y.getMonth()]}` : `${x.getDate()} ${MES3[x.getMonth()]} – ${y.getDate()} ${MES3[y.getMonth()]}`; };
  const mLab = iso => cap(MESI[dt(iso).getMonth()]) + " " + dt(iso).getFullYear();
  const hm = d => { const x = new Date(d); return x.getHours() + ":" + String(x.getMinutes()).padStart(2, "0"); };
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const sgn = (v, dec = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), dec);
  const pl = (n, a, b) => n === 1 ? a : b;

  /* ============================== chi è ============================== */
  const prof = () => data.profile();
  const grp = () => prof().group;
  const kid = () => grp() === "bambino", minor = () => prof().minor, o65 = () => prof().over65;
  const kw = () => kid() || o65(); // glossario: bambino e over 65 dicono «allenamento»
  const W1 = () => kw() ? "allenamento" : "seduta", WN = () => kw() ? "allenamenti" : "sedute";
  const sName = k => { const n = typeof P !== "undefined" && P[k] ? (P[k].nome || "Seduta " + k) : "Seduta " + k; return kw() ? n.replace(/^Seduta\b/, "Allenamento") : n; };
  const planned = () => typeof DAYS !== "undefined" ? DAYS.length : 0;
  const cardioT = () => typeof CARDIO !== "undefined" ? CARDIO.obiettivo(grp()) : (minor() ? 420 : 150);
  const waterT = () => { try { return planTargets().waterL; } catch (_) { return 2; } };

  /* ============================== V3Stats: un solo calcolo ============================== */
  let memo = {};
  const LAB = k => (MEALS.find(m => m[0] === k) || [k, k])[1];
  const dayV = iso => { const v = S.days[iso]; return v ? { meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {}, extra: v.extra || [], snap: v.snap || {}, water: +v.water || 0, peso: v.peso } : null; };
  /* pasti del giorno con le parole del diario (giorni.js mealRow) */
  function meals(iso) {
    const dw = dt(iso).getDay(), plan = hasPlanNow(), v = dayV(iso) || { meals: {}, custom: {}, skip: {}, extra: [], snap: {} };
    return MEALS.filter(([k]) => !plan || mealOf(dw, k) || mealState(v, k) !== "open").map(([k]) => { // M13: come il diario (V3.data.dayMeals), i pasti segnati restano anche se il piano è cambiato
      const st = mealState(v, k), m = plan ? mealOf(dw, k) : null; let n = null, text = "";
      if (st === "plan") { n = v.snap[k] || (window.planNutOf ? planNutOf(dw, k) : nutOf(dw, k)); text = m ? m.t + ". " + (m.i || []).join(". ") : ""; }
      else if (st === "custom") { const c = v.custom[k]; n = c; text = String(c.text || ""); }
      return { k, label: LAB(k), st, eaten: st === "plan" || st === "custom",
        what: st === "plan" ? "Come da piano" : st === "custom" ? "Altro: " + (v.custom[k].text || "") : st === "skip" ? "Non mangiato" : "Non segnato",
        kcal: n ? Math.round(+n.kcal || 0) : null, pro: n ? Math.round(+n.p || 0) : null, text };
    });
  }
  const fvOf = text => Math.min(SOGLIE.FV_MAX_PASTO, new Set((String(text).match(RE_FV) || []).map(x => x.toLowerCase())).size);
  const bestSet = sets => sets.filter(z => !z.dr).reduce((a, z) => !a || (+z.kg || 0) > (+a.kg || 0) || ((+z.kg || 0) === (+a.kg || 0) && (+z.reps || 0) > (+a.reps || 0)) ? z : a, null);
  /* M3 (audit 29/10): minuti di una seduta, un solo calcolo per Palestra «Tempo», storico e report.
     1) durata scritta a fine seduta, 2) tempi del cronometro, 3) stima dalla scheda per le sedute segnate dopo (late). Altrimenti null. */
  function estMin(k) { // stessa stima della scheda in Palestra (pesi: serie × (recupero + 40 s), a scatti di 5, minimo 10; cardio: i suoi minuti)
    const p = typeof P !== "undefined" && P[k]; if (!p || !p.items || !p.items.length) return null;
    const isC = it => it.misura === "cardio", L = p.items.filter(it => !isC(it));
    const pm = L.length ? Math.max(10, Math.round(L.reduce((m, it) => m + (+it.sets || 0) * ((+it.rest || 90) + 40), 0) / 300) * 5) : 0;
    return pm + p.items.filter(isC).reduce((m, it) => m + (+it.dur || 0), 0) || null;
  }
  const sessMin = s => !s ? null : +s.durata > 0 ? Math.round(+s.durata) : s.tempi && +s.tempi.total > 0 ? Math.max(1, Math.round(s.tempi.total / 60)) : s.late ? estMin(s.day) : null;
  const sessOf = (from, to) => S.sessions.filter(s => { const d = isoOf(s.date); return d >= from && d <= to; });
  const minRange = (from, to) => sessOf(from, to).reduce((m, s) => m + (sessMin(s) || 0), 0); // minuti di allenamento nel periodo
  /* movimento/cardio: stessa regola di cardioWeek (intenso doppio, leggero 0), sedute + cardio fuori palestra; obiettivo minori 60 al giorno */
  function move(from, to) {
    const n = range(from, to).length, min = typeof cardioWeek === "function" ? cardioWeek(from, to) : 0;
    return { min, T: Math.round(cardioT() * n / 7), perDay: minor() ? SOGLIE.MOVIMENTO_GIORNO : null };
  }
  /* M6: peso di riferimento per i g/kg = media 7 giorni dell'ultima pesata; il peso del profilo solo se non ci sono pesate */
  const pesoRif = () => { try { const w = data.weight(), a = w.avg7; if (a && a.length) return a[a.length - 1].kg; } catch (_) {} return prof().peso || null; };
  function sessInfo(s) {
    const items = (s.items || []).filter(x => !x.cardio && (x.sets || []).length).map(x => {
      const b = bestSet(x.sets), vol = x.sets.reduce((m, z) => m + (z.kg != null ? +z.kg * (+z.reps || 0) : 0), 0);
      return { name: x.name, sets: x.sets.length, best: b ? { kg: b.kg != null && b.kg !== "" ? +b.kg : null, reps: +b.reps || 0 } : null, vol };
    });
    const cardio = (s.items || []).filter(x => x.cardio).map(x => ({ name: x.name, min: +x.cardio.min || 0, int: x.cardio.int || null }));
    return { id: s.id, date: s.date, day: s.day, name: sName(s.day), time: s.late ? null : hm(s.date), late: !!s.late, min: sessMin(s), fatica: s.fatica != null ? +s.fatica : null, dolore: !!s.dolore,
      items, cardio, sets: items.reduce((m, x) => m + x.sets, 0), vol: Math.round(items.reduce((m, x) => m + x.vol, 0)) };
  }
  const cw = it => typeof CARDIO !== "undefined" ? (CARDIO.peso[it] ?? 1) : 1; // come cardioWeek: leggero 0, medio 1, forte 2
  function day(iso) {
    if (memo[iso]) return memo[iso];
    const t = today(), d = data.day(iso), v = dayV(iso), ms = meals(iso);
    const reg = !!v && (ms.some(m => m.eaten) || v.extra.length > 0); // A3: lo «non mangiato» da solo non segna il giorno
    const ses = S.sessions.filter(s => isoOf(s.date) === iso).sort((a, b) => a.date < b.date ? -1 : 1).map(sessInfo);
    const fuori = typeof CARDIO !== "undefined" && CARDIO.fuori ? (lsGet("cardio_fuori", []) || []).filter(c => c.date === iso) : [];
    const cardioMin = Math.round(ses.reduce((m, s) => m + s.cardio.reduce((a, c) => a + c.min * cw(c.int), 0), 0) + fuori.reduce((m, c) => m + (+c.min || 0) * cw(c.int), 0));
    const o = { iso, today: iso === t, closed: iso < t, future: iso > t, reg, meals: ms, extra: v ? v.extra.length : 0,
      kcal: reg ? d.kcal : null, pro: reg ? d.pro : null, cho: reg ? d.cho : null, fat: reg ? d.fat : null,
      kcalT: d.kcalT, proT: d.proT, choT: d.choT, fatT: d.fatT, train: d.train,
      water: v && v.water > 0 ? v.water * 0.25 : null, waterT: waterT(),
      fv: reg ? ms.filter(m => m.eaten).reduce((s, m) => s + fvOf(m.text), 0) : null, fvT: SOGLIE.FV_PORZIONI,
      leg: ms.filter(m => m.eaten && RE_LEG.test(m.text)).length, pesce: ms.filter(m => m.eaten && RE_PESCE.test(m.text)).length,
      sessions: ses, fuori, cardio: cardioMin, min: ses.reduce((m, s) => m + (s.min || 0), 0), vol: ses.reduce((m, s) => m + s.vol, 0), sets: ses.reduce((m, s) => m + s.sets, 0),
      peso: v && v.peso ? +v.peso : null };
    return (memo[iso] = o);
  }

  /* parametri: ordine fisso (COERENZA 29/10, punto 5) */
  const PAR = {
    kcal: { sec: "Cibo", t: () => "Calorie", u: "", dec: 0, get: d => d.kcal, tgt: d => d.kcalT, ok: (v, t) => Math.abs(v - t) <= SOGLIE.CALORIE_IN_LINEA, okw: "in linea", no: "Fuori dall'obiettivo" },
    pro: { sec: "Cibo", t: () => "Proteine", u: "g", dec: 0, get: d => d.pro, tgt: d => d.proT, ok: (v, t) => v >= t * SOGLIE.PROTEINE_MIN, okw: "raggiunte", no: "Sotto l'obiettivo" },
    cho: { sec: "Cibo", t: () => "Carboidrati", u: "g", dec: 0, get: d => d.cho, tgt: d => d.choT, ok: (v, t) => Math.abs(v - t) <= t * SOGLIE.MACRO_BANDA, okw: "in linea", no: "Fuori dall'obiettivo" },
    fat: { sec: "Cibo", t: () => "Grassi", u: "g", dec: 0, get: d => d.fat, tgt: d => d.fatT, ok: (v, t) => Math.abs(v - t) <= t * SOGLIE.MACRO_BANDA, okw: "in linea", no: "Fuori dall'obiettivo" },
    acqua: { sec: "Cibo", t: () => "Acqua", u: "L", dec: 2, get: d => d.water, tgt: d => d.waterT, ok: (v, t) => v >= t * SOGLIE.ACQUA_MIN, okw: "raggiunta", no: "Sotto l'obiettivo" },
    fv: { sec: "Cibo", t: () => "Frutta e verdura", u: "porzioni", dec: 0, get: d => d.fv, tgt: d => d.fvT, ok: (v, t) => v >= t, okw: "raggiunte", no: "Sotto l'obiettivo" },
    sedute: { sec: "Allenamento", tr: 1, t: () => kw() ? "Allenamenti" : "Sedute", u: "", dec: 0, get: d => d.sessions.length },
    kg: { sec: "Allenamento", tr: 1, t: () => "Peso sollevato", u: "kg", dec: 0, get: d => d.vol },
    tempo: { sec: "Allenamento", tr: 1, t: () => "Tempo", u: "minuti", dec: 0, get: d => d.min },
    cardio: { sec: "Allenamento", tr: 1, t: () => kid() ? "Movimento" : "Cardio", u: "minuti", dec: 0, get: d => d.cardio, dayT: () => minor() ? SOGLIE.MOVIMENTO_GIORNO : null },
    peso: { sec: "Corpo", body: 1, t: () => "Peso", u: "kg", dec: 1, get: d => d.peso }
  };
  const ORDER = ["kcal", "pro", "cho", "fat", "acqua", "fv", "sedute", "tempo", "kg", "cardio", "peso"];
  /* minori: niente calorie, grassi né peso del corpo; bambino niente chili; over 65 niente peso sollevato */
  function params() {
    const no = new Set(minor() ? ["kcal", "cho", "fat", "peso"] : []); // minori: come «I numeri di oggi» (tavola 74)
    if (kid() || o65()) no.add("kg");
    return ORDER.filter(k => !no.has(k));
  }
  /* aggregato di un periodo [from, to] per un parametro: medie e conteggi SOLO su giorni chiusi e con il dato */
  function agg(k, from, to) {
    const p = PAR[k], ds = range(from, to).map(day), past = ds.filter(d => !d.future);
    if (p.tr) {
      const tot = past.reduce((m, d) => m + p.get(d), 0);
      const T = k === "sedute" ? (to === addDays(from, 6) ? planned() : Math.round(planned() * ds.length / 7)) : k === "cardio" ? Math.round(cardioT() * ds.length / 7) : null;
      const cm = k === "cardio" ? move(from, to).min : k === "tempo" ? minRange(from, to) : null; // stessi totali di Palestra e Progressi
      return { k, days: ds, total: cm != null ? cm : tot, T, n: past.length, has: past.some(d => p.get(d) > 0) };
    }
    const cl = ds.filter(d => (k === "peso" ? !d.future : d.closed) && p.get(d) != null), vals = cl.map(p.get);
    const tg = p.tgt ? cl.map(p.tgt) : [];
    return { k, days: ds, n: cl.length, avg: vals.length ? avg(vals) : null, tAvg: tg.length ? avg(tg) : (p.tgt && ds.length ? avg(ds.map(p.tgt)) : null),
      okN: p.ok ? cl.filter(d => p.ok(p.get(d), p.tgt(d))).length : null, has: cl.length > 0 || ds.some(d => d.today && p.get(d) != null) };
  }
  function week(from) { from = monOf(from); const to = addDays(from, 6), ds = range(from, to).map(day);
    return { from, to, days: ds, reg: ds.filter(d => d.closed && d.reg).length, elapsed: ds.filter(d => !d.future).length,
      sessions: ds.flatMap(d => d.sessions.map(s => Object.assign({ iso: d.iso }, s))), T: planned(), agg: k => agg(k, from, to) }; }

  window.V3Stats = { SOGLIE, PAR, ORDER, params, day, meals, agg, week, clear() { memo = {}; }, estMin, sessMin, minRange, move, pesoRif, monOf, wLab, mLab, dLong, dTab, gName, range, sName, kw, cardioT, waterT, RE_LEG, RE_PESCE, bestSet };

  /* ============================== STORICO (pagine) ============================== */
  const VIEWS = ["giorno", "settimana", "mese"];
  const st = { view: "settimana", iso: null, param: null };
  const anchor = () => { const t = today(); if (!st.iso || st.iso > t) st.iso = t; return st.iso; };
  function per() { // periodo della vista corrente
    const a = anchor();
    if (st.view === "giorno") return { from: a, to: a, lab: dLong(a), nextOk: a < today(), prevL: "Giorno prima", nextL: "Giorno dopo" };
    if (st.view === "mese") { const f = monthOf(a), t2 = monthEnd(a); return { from: f, to: t2, lab: mLab(f), nextOk: addMonth(f, 1) <= today(), prevL: "Mese prima", nextL: "Mese dopo" }; }
    const f = monOf(a); return { from: f, to: addDays(f, 6), lab: wLab(f, addDays(f, 6)), nextOk: addDays(f, 7) <= today(), prevL: "Settimana prima", nextL: "Settimana dopo" };
  }
  function shift(n) {
    const a = anchor(), t = today();
    let x = st.view === "giorno" ? addDays(a, n) : st.view === "mese" ? addMonth(a, n) : addDays(monOf(a), 7 * n);
    if (n > 0 && st.view === "settimana" && x > t) x = t;
    if (n > 0 && st.view === "mese" && x > t) return;
    if (x > t) x = t;
    st.iso = x;
  }

  /* ---------- pezzi ---------- */
  const fmtV = (k, v, unit = true) => { const p = PAR[k]; if (v == null) return "–"; const s = k === "acqua" ? nf(v, v >= 10 ? 1 : 2) : nf(v, p.dec); return s + (unit && p.u ? " " + p.u : ""); };
  const fmtA = (k, v) => v == null ? "–" : k === "acqua" ? nf(v, 1) + " L" : fmtV(k, k === "peso" ? v : Math.round(v)); // media
  const nav = p => `<div class="v3-st-nav"><button class="v3-st-ar" data-v3act="st-prev" aria-label="${e(p.prevL)}">‹</button><b>${e(p.lab)}</b><button class="v3-st-ar" data-v3act="st-next" aria-label="${e(p.nextL)}"${p.nextOk ? "" : " disabled"}>›</button></div>`;
  const seg = () => ui.seg(["Giorno", "Settimana", "Mese"], VIEWS.indexOf(st.view), "st-view", "Periodo");
  const title = (t, v) => `<div><h1 class="v3-t1">${e(t)}</h1><p class="v3-sub">${e(v)}</p></div>`;
  /* tabella: head [testi], rows [[celle html]], foot [celle] ; la prima colonna a sinistra, le altre a destra */
  function table(head, rows, foot, cls = "") {
    const th = head.map(h => `<th scope="col">${e(h)}</th>`).join("");
    const tr = r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join("")}</tr>`;
    return `<div class="v3-st-tw"><table class="v3-st-tb ${cls}"><thead><tr>${th}</tr></thead><tbody>${rows.map(tr).join("")}${foot ? `<tr class="v3-st-ft">${foot.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join("")}</tr>` : ""}</tbody></table></div>`;
  }
  /* barre: colonna piena = obiettivo raggiunto, tenue = sotto, trattino scuro = nessun dato. Usa ui.chart.bars e ricolora le colonne */
  function bars(vals, fills, o) {
    const mx = Math.max(1, o.target || 0, ...vals.map(v => v || 0)) * 1.08;
    const ticks = o.target ? [[o.target, o.tl || "", true], [0, ""]] : [[0, ""]];
    let svg = ui.chart.bars({ vals: vals.map(v => v || 0), max: mx, ticks, xl: o.xl, live: false, fmt: () => "", tip: o.tip, aria: o.aria, h: 96 });
    let i = 0;
    svg = svg.replace(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"(?: fill="#fff")?><\/rect>/g, (m, x, y, w, h) => {
      const f = fills[i++];
      if (f === "none") { const b = +y + +h; return `<rect x="${x}" y="${(b - 3).toFixed(1)}" width="${w}" height="3" rx="1.5" fill="#2b2b2b"></rect>`; }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(4, +w / 2).toFixed(1)}" fill="${f === "ok" ? "#fff" : "rgba(255,255,255,.4)"}"></rect>`;
    });
    return svg;
  }
  const legend = (k, tgt) => tgt ? `<p class="v3-leg"><span><i class="v3-st-k1"></i>Obiettivo raggiunto</span><span><i class="v3-st-k2"></i>${e(PAR[k].no || "Sotto l'obiettivo")}</span><span><i class="v3-k3"></i>Obiettivo</span></p>` : "";
  const cardHead = (l, v) => `<div class="v3-st-ch"><b>${e(l)}</b><b class="v3-st-cv">${v}</b></div>`;
  const of = (t, u) => ` <span class="v3-of">/${e(t)}${u ? " " + e(u) : ""}</span>`;

  /* ---------- verdetti e righe ---------- */
  function rowSub(k, a, wk) {
    const p = PAR[k];
    if (p.tr) {
      if (k === "sedute") { const ss = wk.days.flatMap(d => d.sessions.map(s => ({ s, iso: d.iso })));
        const lst = ss.length && ss.length <= 2 ? " · " + ss.map(x => `${lc1(x.s.name)} ${gName(x.iso)}`).join(", ") : "";
        return (a.T ? `${a.total} su ${a.T}` : `${a.total}`) + lst; }
      if (k === "kg") return a.total ? fmtV("kg", a.total) : `Nessuna ${W1()} con i pesi`;
      if (k === "tempo") return a.total ? `${nf(a.total, 0)} minuti` : `Nessun${kw() ? " allenamento" : "a seduta"} con il tempo`;
      return `${nf(a.total, 0)}${a.T ? " su " + nf(a.T, 0) : ""} minuti`;
    }
    if (!a.has) return k === "peso" ? "Nessuna pesata" : k === "acqua" ? "Acqua non segnata" : "Nessun giorno segnato";
    if (a.avg == null) return "Solo oggi, ancora in corso";
    const base = `Media ${fmtA(k, a.avg)}`;
    return (k === "kcal" || k === "pro") && a.n ? `${base} · ${p.okw} ${a.okN} ${pl(a.okN, "giorno", "giorni")} su ${a.n}` : base;
  }
  function periodVerdict(from, to, isWeek) {
    const ds = range(from, to).map(day), reg = ds.filter(d => !d.future && d.reg).length, el = ds.filter(d => !d.future).length, ses = ds.reduce((m, d) => m + d.sessions.length, 0);
    const w = isWeek ? "settimana" : "mese";
    if (!reg && !ses && !ds.some(d => d.peso || d.water)) return `Nessun dato in questo ${isWeek ? "periodo" : "mese"}`;
    if (minor() || !reg) return `${reg} ${pl(reg, "giorno segnato", "giorni segnati")} su ${el}`;
    const a = agg("kcal", from, to);
    if (!a.n) return `${reg} ${pl(reg, "giorno segnato", "giorni segnati")} su ${el}`;
    if (a.okN * 2 >= a.n) return `${cap(w)} in linea con il piano`;
    return a.avg < a.tAvg ? "Calorie sotto il piano, in media" : "Calorie sopra il piano, in media";
  }
  const SAP = {
    main: "Conta la media della settimana, non il singolo giorno", kcal: "In linea vuol dire entro 100 calorie dall'obiettivo", pro: "Il corpo usa meglio le proteine divise in 4 o 5 pasti",
    cho: "I carboidrati sono l'energia per allenarti", fat: "I grassi buoni vengono da olio, pesce e frutta secca", acqua: "Bere spesso conta più che bere tanto in una volta",
    fv: "Cinque porzioni al giorno, più colori possibile", sedute: "Conta la regolarità delle settimane, non il singolo giorno", kg: "Il muscolo cresce se il lavoro aumenta piano",
    cardio: "Il cardio leggero si segna ma non conta: quello forte vale doppio", peso: "Il peso cambia ogni giorno: conta la media", giorno: "Rivedere i giorni passati aiuta a capire cosa funziona"
  };
  const sapOf = k => kid() ? ({ main: "Ogni giorno segnato ti aiuta a capire come stai andando", pro: "Le proteine sono i mattoni dei muscoli", cardio: "Giocare, correre e andare in bici: conta tutto il movimento", acqua: "Bere spesso aiuta a stare attento a scuola", sedute: "Allenarsi un po' ogni settimana conta più di tanto una volta sola", giorno: "Rivedere i giorni passati aiuta a capire cosa funziona" })[k] || SAP[k] : SAP[k];
  const LEO = { main: "Come sono andate le ultime settimane?", giorno: "Cosa posso migliorare di questo giorno?" };

  /* ---------- pagina Settimana / Mese (elenco di tutti i numeri) ---------- */
  function listPage() {
    const p = per(), wk = { days: range(p.from, p.to).map(day) };
    const groups = {};
    for (const k of params()) { const a = agg(k, p.from, p.to); (groups[PAR[k].sec] = groups[PAR[k].sec] || []).push(ui.row({ title: PAR[k].t(), sub: rowSub(k, a, wk), act: "st-par", arg: k })); }
    return ui.back() + title("Il mio storico", periodVerdict(p.from, p.to, st.view === "settimana")) + seg() + nav(p)
      + Object.entries(groups).map(([s, r]) => ui.section(s, r.join(""))).join("")
      + ui.end(sapOf("main"), { leoQ: LEO.main });
  }

  /* ---------- pagina di un numero ---------- */
  function paramPage(k) {
    const p = per(), P0 = PAR[k], a = agg(k, p.from, p.to), isW = st.view === "settimana", ds = a.days;
    const xl = isW ? ds.map((d, i) => [i, "LMMGVSD"[i]]) : [0, 7, 14, 21, 28].filter(i => i < ds.length).map(i => [i, String(i + 1)]);
    let verdict, head, chart = "", tab = "", tlab = isW ? "Giorno per giorno" : "Settimana per settimana", extra = "";
    if (k === "peso") {
      const pts = ds.filter(d => d.peso != null);
      const prevA = agg("peso", isW ? addDays(p.from, -7) : addMonth(p.from, -1), addDays(p.from, -1));
      verdict = !pts.length ? "Nessuna pesata in questo periodo" : prevA.avg != null && a.avg != null ? (Math.abs(a.avg - prevA.avg) < SOGLIE.PESO_STABILE ? `Stabile rispetto ${isW ? "alla settimana" : "al mese"} prima` : `${sgn(a.avg - prevA.avg, 1)} kg rispetto ${isW ? "alla settimana" : "al mese"} prima`) : `${pts.length} ${pl(pts.length, "pesata", "pesate")}`;
      head = cardHead("Media", pts.length ? `${nf(avg(pts.map(d => d.peso)), 1)} <span class="v3-of">kg</span>` : "–");
      if (pts.length >= 2) { const v = pts.map(d => d.peso), lo = Math.floor(Math.min(...v) - 0.5), hi = Math.ceil(Math.max(...v) + 0.5);
        chart = ui.chart.line({ trend: v, min: lo, max: hi, yl: [String(hi), String(lo)], xl: [[0, ui.dLab(pts[0].iso)], [v.length - 1, ui.dLab(pts[v.length - 1].iso)]], fmt: x => nf(x) + " kg", tip: i => `${dTab(pts[i].iso)}: ${nf(v[i])} kg`, aria: "Pesate del periodo" }); }
      else if (pts.length === 1) chart = `<p class="v3-st-pl">Una sola pesata: ${e(dTab(pts[0].iso))}</p>`;
      tab = pts.length ? (isW ? table(["Giorno", "Peso"], pts.map(d => [e(dTab(d.iso)), fmtV("peso", d.peso)]))
        : table(["Settimana", "Media"], weeksOf(p).map(w => { const x = agg("peso", w.from, w.to); return [e(wLab(w.from, w.to)), x.avg == null ? "–" : fmtA("peso", x.avg)]; }))) : "";
      extra = ui.row({ title: "Peso e tendenza", sub: "Media di 7 giorni e grafico", act: "open", arg: "peso" });
    } else if (P0.tr) {
      const prevA = agg(k, isW ? addDays(p.from, -7) : addMonth(p.from, -1), isW ? addDays(p.from, -1) : addDays(p.from, -1));
      const vals = ds.map(d => d.future ? null : P0.get(d)), dT = P0.dayT ? P0.dayT() : null;
      const fills = ds.map((d, i) => d.future || !vals[i] ? "none" : dT ? (vals[i] >= dT ? "ok" : "low") : "ok");
      const tot = a.total;
      if (k === "sedute") { verdict = a.T ? `${tot} su ${a.T}` : `${tot} ${pl(tot, W1(), WN())}`; head = cardHead("Totale", `${tot}${a.T ? of(a.T) : ""}`); }
      else if (k === "kg") { verdict = !tot ? `Nessuna ${W1()} con i pesi` : prevA.total ? `${sgn(Math.round((tot - prevA.total) / prevA.total * 100))}% rispetto ${isW ? "alla settimana" : "al mese"} prima` : `${fmtV("kg", tot)} in tutto`; head = cardHead("Totale", `${nf(tot, 0)} <span class="v3-of">kg</span>`); }
      else if (k === "tempo") { verdict = tot ? `${nf(tot, 0)} minuti in tutto` : `Nessun${kw() ? " allenamento" : "a seduta"} con il tempo`; head = cardHead("Totale", `${nf(tot, 0)} <span class="v3-of">minuti</span>`); }
      else { verdict = `${nf(tot, 0)} su ${nf(a.T, 0)} minuti`; head = cardHead("Totale", `${nf(tot, 0)}${of(nf(a.T, 0), "minuti")}`); }
      chart = bars(vals, fills, { target: dT, tl: dT ? String(dT) : "", xl, tip: i => `${dTab(ds[i].iso)}: ${vals[i] == null ? "–" : fmtV(k, vals[i])}`, aria: `${P0.t()} per giorno` });
      if (k === "cardio") {
        tab = isW ? table(["Giorno", "Minuti"], ds.filter(d => !d.future && (d.cardio || d.sessions.some(s => s.cardio.length) || d.fuori.length)).map(d => [e(dTab(d.iso)), nf(d.cardio, 0)]))
          : table(["Settimana", "Minuti", "Obiettivo"], weeksOf(p).map(w => { const x = agg("cardio", w.from, w.to); return [e(wLab(w.from, w.to)), nf(x.total, 0), nf(cardioT(), 0)]; }));
        if (!ds.some(d => d.cardio)) tab = "";
        tlab = isW ? "Giorno per giorno" : tlab;
      } else if (k === "tempo") {
        const ss = ds.flatMap(d => d.sessions.map(s => [d.iso, s]));
        tlab = isW ? (kw() ? "Allenamenti della settimana" : "Sedute della settimana") : tlab;
        tab = isW ? (ss.length ? table([cap(W1()), "Minuti"], ss.map(([iso, s]) => [e(`${cap(GG[dt(iso).getDay()].slice(0, 3))} · ${lc1(s.name)}`), s.min == null ? "–" : nf(s.min, 0)])) : "")
          : table(["Settimana", "Minuti"], weeksOf(p).map(w => [e(wLab(w.from, w.to)), nf(minRange(w.from, w.to), 0)]));
        extra = ss.some(([, s]) => s.late) ? `<p class="v3-st-pl">Per ${kw() ? "gli allenamenti segnati" : "le sedute segnate"} dopo il tempo è stimato dalla scheda.</p>` : "";
      } else {
        const showKg = !kid() && !o65();
        if (isW) { tlab = kw() ? "Allenamenti della settimana" : "Sedute della settimana";
          const ss = ds.flatMap(d => d.sessions.map(s => [d.iso, s]));
          tab = ss.length ? table([cap(W1()), "Serie"].concat(showKg ? ["Peso totale"] : []).concat(["Fatica"]),
            ss.map(([iso, s]) => [e(`${cap(GG[dt(iso).getDay()].slice(0, 3))} · ${lc1(s.name)}`), String(s.sets)].concat(showKg ? [s.vol ? fmtV("kg", s.vol) : "–"] : []).concat([s.fatica != null && typeof fatWord === "function" ? e(fatWord(s.fatica)) : "–"]))) : "";
        } else tab = table(["Settimana", cap(WN())].concat(showKg ? ["Peso totale"] : []), weeksOf(p).map(w => { const s = agg("sedute", w.from, w.to), v = agg("kg", w.from, w.to); return [e(wLab(w.from, w.to)), String(s.total)].concat(showKg ? [v.total ? fmtV("kg", v.total) : "–"] : []); }));
      }
    } else {
      const vals = ds.map(d => d.future ? null : P0.get(d)), tgts = ds.map(P0.tgt), tAvg = a.tAvg;
      const fills = ds.map((d, i) => vals[i] == null ? "none" : P0.ok(vals[i], tgts[i]) && !d.today ? "ok" : d.today ? (P0.ok(vals[i], tgts[i]) ? "ok" : "low") : "low");
      verdict = !a.has ? (k === "acqua" ? "Acqua non segnata in questo periodo" : "Nessun giorno segnato") : a.n ? `${cap(P0.okw)} ${a.okN} ${pl(a.okN, "giorno", "giorni")} su ${a.n}` : "Solo oggi, ancora in corso";
      head = cardHead("Media", a.avg == null ? "–" : `${fmtA(k, a.avg).replace(/ (g|L|porzioni)$/, "")}${tAvg != null ? of(k === "acqua" ? nf(tAvg, 1) : nf(Math.round(tAvg), 0), P0.u) : ""}`);
      chart = bars(vals, fills, { target: tAvg, xl, tip: i => `${dTab(ds[i].iso)}: ${vals[i] == null ? "nessun dato" : fmtV(k, vals[i])}${ds[i].today ? " (in corso)" : ""}`, aria: `${P0.t()} per giorno e obiettivo` }) + legend(k, tAvg != null);
      if (isW) {
        const rows = ds.filter(d => !d.future).map(d => { const v = P0.get(d), t = P0.tgt(d);
          return [e(dTab(d.iso)), fmtV(k, v, false), fmtV(k, t, false), v == null ? "–" : d.today ? "in corso" : (k === "acqua" ? (v - t >= 0 ? "+" : "−") + nf(Math.abs(v - t), 2) : sgn(Math.round(v - t)))]; });
        tab = table(["Giorno", P0.t() === "Frutta e verdura" ? "Porzioni" : k === "acqua" ? "Litri" : P0.t(), "Obiettivo", "Differenza"], rows);
      } else {
        tab = table(["Settimana", "Media", "Obiettivo raggiunto"], weeksOf(p).map(w => { const x = agg(k, w.from, w.to); return [e(wLab(w.from, w.to)), x.avg == null ? "–" : fmtA(k, x.avg), x.n ? `${x.okN} ${pl(x.okN, "giorno", "giorni")} su ${x.n}` : "–"]; }));
      }
    }
    return ui.back() + title(P0.t(), verdict) + seg() + nav(p) + ui.card(head + chart) + (tab ? ui.section(tlab, tab) : "") + extra
      + ui.end(sapOf(k), { leoQ: `Come vanno ${P0.t().toLowerCase()} nelle ultime settimane?` });
  }
  /* settimane lunedì-domenica che toccano il mese (intere, anche se escono dal mese) */
  function weeksOf(p) { const out = []; for (let m = monOf(p.from); m <= p.to; m = addDays(m, 7)) if (m <= today()) out.push({ from: m, to: addDays(m, 6) }); return out; }

  /* ---------- pagina Giorno ---------- */
  function dayPage() {
    const p = per(), d = day(p.from), M = minor();
    const eaten = d.meals.filter(m => m.eaten).length;
    const sw = d.sessions.length === 1 ? ` e ${kw() ? "l'" : "la "}${lc1(d.sessions[0].name)}` : d.sessions.length > 1 ? ` e ${d.sessions.length} ${WN()}` : "";
    const verdict = !eaten && !d.sessions.length && !d.cardio ? "Nessun dato in questo giorno" : `${eaten} ${pl(eaten, "pasto", "pasti")}${sw}`;
    let h = "";
    if (d.meals.length) {
      const head = ["Pasto", "Cosa"].concat(M ? [] : ["Calorie"]).concat(["Proteine"]);
      const rows = d.meals.map(m => [e(m.label), e(m.what)].concat(M ? [] : [m.kcal == null ? "–" : nf(m.kcal, 0)]).concat([m.pro == null ? "–" : m.pro + " g"]));
      const foot = d.reg ? ["Totale", ""].concat(M ? [] : [nf(d.kcal, 0)]).concat([d.pro + " g"]) : null;
      h += ui.section("Pasti", table(head, rows, foot, "v3-st-meals") + (d.extra ? `<p class="v3-st-pl">Il totale conta anche ${d.extra === 1 ? "un fuori programma segnato" : d.extra + " fuori programma segnati"} in Cibo.</p>` : ""));
    }
    for (const s of d.sessions) {
      const rows = s.items.map(x => [e(x.name), String(x.sets), !x.best ? "–" : x.best.kg != null && !kid() ? `${nf(x.best.kg)} kg × ${x.best.reps}` : `${x.best.reps} ripetizioni`]);
      const sh = `${s.name} · ${s.late ? (kw() ? "segnato dopo" : "segnata dopo") : s.time}${s.min ? ` · ${s.min} minuti` : ""}`;
      if (rows.length) h += ui.section(sh, table(["Esercizio", "Serie", "Serie migliore"], rows));
      else h += ui.section(sh, "");
    }
    const INT = { leggero: "leggero", medio: "medio", forte: "forte" };
    const cr = d.sessions.flatMap(s => s.cardio).map(c => ui.row({ title: c.name, sub: `${c.min} minuti${c.int && INT[c.int] ? " · " + INT[c.int] : ""}` }))
      .concat(d.fuori.map(c => ui.row({ title: kid() ? "Movimento fuori palestra" : "Cardio fuori palestra", sub: `${+c.min || 0} minuti${c.int && INT[c.int] ? " · " + INT[c.int] : ""}` })));
    if (cr.length) h += `<div class="v3-sec">${cr.join("")}</div>`;
    if (!h) h = ui.card(`<p class="v3-st-pl">Nessun pasto${d.sessions.length ? "" : " né " + W1()} segnato in questo giorno.</p>`);
    const fix = d.iso >= addDays(today(), -SOGLIE.CORREGGI_GIORNI) ? ui.secondary("Correggi questo giorno", "st-fix") : "";
    return ui.back() + title("Il mio storico", verdict) + seg() + nav(p) + h + fix + ui.end(sapOf("giorno"), { leoQ: LEO.giorno });
  }

  /* ---------- stile (una volta) ---------- */
  if (!document.getElementById("v3-sec-storico")) {
    const s = document.createElement("style"); s.id = "v3-sec-storico";
    s.textContent = `
    #view.v3 .v3-st-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #view.v3 .v3-st-nav b { font-size: 16px; font-variant-numeric: tabular-nums; text-align: center; }
    #view.v3 .v3-st-ar { width: 52px; height: 48px; flex: none; border: 0; border-radius: 24px; background: var(--v3-s1); color: var(--v3-t1); font: 700 20px var(--v3-font); padding: 0; }
    #view.v3 .v3-st-ar:disabled { opacity: .3; }
    #view.v3 .v3-st-ch { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    #view.v3 .v3-st-ch b { font-size: 16px; } #view.v3 .v3-st-ch .v3-st-cv { font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #view.v3 .v3-st-k1, #view.v3 .v3-st-k2 { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    #view.v3 .v3-st-k1 { background: #fff; } #view.v3 .v3-st-k2 { background: rgba(255,255,255,.4); }
    #view.v3 .v3-st-pl { font-size: 15px; color: var(--v3-t2); padding: 0 16px; }
    #view.v3 .v3-cc .v3-st-pl { padding: 0; }
    #view.v3 .v3-st-tw { border-radius: 18px; background: var(--v3-s1); padding: 6px 16px; overflow-x: auto; }
    #view.v3 .v3-st-tb { width: 100%; border-collapse: collapse; font-size: 15px; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-st-tb th, #view.v3 .v3-st-tb td { padding: 12px 0 12px 8px; text-align: right; border-top: 1px solid var(--v3-s3); vertical-align: top; font-weight: 400; }
    #view.v3 .v3-st-tb th:first-child { text-align: left; padding-left: 0; }
    #view.v3 .v3-st-tb thead th { border-top: 0; color: var(--v3-t2); font-weight: 600; font-size: 14px; padding-top: 10px; padding-bottom: 10px; }
    #view.v3 .v3-st-tb tbody th { color: var(--v3-t1); }
    #view.v3 .v3-st-tb .v3-st-ft th, #view.v3 .v3-st-tb .v3-st-ft td { font-weight: 700; }
    #view.v3 .v3-st-tb td:last-child { white-space: nowrap; }
    #view.v3 .v3-st-meals td:nth-child(2) { text-align: left; overflow-wrap: anywhere; }
    #view.v3 .v3-st-meals thead th:nth-child(2) { text-align: left; }
    #view.v3-o65 .v3-st-tb, #view.v3-o65 .v3-st-pl { font-size: 16px; } #view.v3-o65 .v3-st-tb thead th { font-size: 15px; }`;
    document.head.appendChild(s);
  }

  /* ============================== API per sec-progressi ============================== */
  window.V3Storico = {
    /* o = { view, iso, param } */
    reset(o) { o = o || {}; st.view = VIEWS.includes(o.view) ? o.view : "settimana"; st.iso = o.iso && /^\d{4}-\d{2}-\d{2}$/.test(o.iso) ? o.iso : today(); st.param = o.param && PAR[o.param] && params().includes(o.param) ? o.param : null; },
    render() {
      memo = {};
      if (st.param && !params().includes(st.param)) st.param = null;
      if (st.view === "giorno") return dayPage();
      return st.param ? paramPage(st.param) : listPage();
    },
    on: {
      "st-view"(i) { const v = VIEWS[+i]; if (!v || v === st.view) return; if (v === "giorno" && st.view !== "giorno") { const p = per(); st.iso = p.from <= today() && today() <= p.to ? today() : p.to < today() ? p.to : today(); } st.view = v; V3.refresh(); },
      "st-prev"() { shift(-1); V3.refresh(); },
      "st-next"() { shift(1); V3.refresh(); },
      "st-par"(k) { if (!PAR[k]) return; st.param = k; V3.page(() => { st.param = null; }); },
      "st-fix"() { const iso = per().from; if (iso >= addDays(today(), -SOGLIE.CORREGGI_GIORNI)) V3.open("oggi", { day: iso }); }
    }
  };
})();
