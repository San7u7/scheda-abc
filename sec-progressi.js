"use strict";
/* Askesis v3 · sezione «progressi» (FASE 2). Regole e API: V3_CONTRATTO.md. Tela: askesis-ux/progressi/prototipo_progressi_v3_3.html.
   Pagina principale: box lime «Per chiudere la settimana» + 5 sezioni (La mia settimana, Forza e carichi, Cibo e allenamento, Peso, Foto del corpo).
   Minori: solo settimana + Forza (ragazzo, kg e record) o «Prossima volta» (bambino, solo ripetizioni); niente peso, foto, calorie.
   Dati solo da V3.data e dalle funzioni esistenti (exHistory, weights, mealState). Unica scrittura: «Nascondi il peso» su chiave propria v3_peso_nascosto.
   Correlazione mai causa: le frasi dicono «insieme», mai «grazie a». Sotto soglia: «Servono più dati: ancora N». */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3;
  const esc = ui.esc, nf = ui.nf, dLab = ui.dLab;

  /* ---------- stato interno (mai in S) ---------- */
  let sub = null;                 // pagina interna aperta: settimana, forza, cibo, peso, foto, fare, legacy
  const sel = {};                 // scelta del selettore per pagina
  let shown = new Set();          // foto mostrate (sfocate fino a «Mostra»)
  const pick = {};                // foto scelte per il confronto, per posa: { a: id, b: id }
  let memo = {};
  const HIDE_KEY = "v3_peso_nascosto";
  const hidden = () => !!lsGet(HIDE_KEY, false);

  /* ---------- utilità ---------- */
  const today = () => localISO();
  const mon0 = () => localISO(mondayOf(new Date()));
  const isoOf = d => localISO(new Date(d));
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const MESIL = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const longDate = iso => { const d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MESIL[d.getMonth()]; };
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const nn = a => a.filter(v => v != null);
  const sgn = (v, dec = 1) => (v > 0 ? "+" : "") + nf(v, dec);
  const days = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
  const prof = () => data.profile();
  const grp = () => prof().group;
  const kid = () => grp() === "bambino", minor = () => prof().minor, o65 = () => prof().over65;
  const planned = () => (typeof DAYS !== "undefined" ? DAYS.length : 0);
  const of = (t, u) => ` <span class="v3-of">/${esc(t)}${u ? " " + esc(u) : ""}</span>`;
  const pl = t => `<p class="v3-progressi-pl">${esc(t)}</p>`;
  const bigS = (num, line) => `<div><p class="v3-bn${String(num).replace(/<[^>]+>/g, "").length > 10 ? " v3-progressi-bs" : ""}">${num}</p>${line ? `<p class="v3-bd">${esc(line)}</p>` : ""}</div>`;
  const plural = (n, a, b) => n === 1 ? a : b;

  /* stato dei pasti senza creare giorni (mealState dell'app, sola lettura) */
  const mstate = (iso, k) => { const v = S.days[iso]; if (!v) return "open"; return mealState({ meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {} }, k); };
  const eaten = (iso, k) => { const s = mstate(iso, k); return s === "plan" || s === "custom"; };
  const colDone = iso => eaten(iso, "col");
  const mealsDone = iso => MEALS.filter(([k]) => eaten(iso, k)).length;

  /* ---------- aggregati per settimana o mese (dai giorni di V3.data) ---------- */
  function buckets(kind, n) {
    const out = [], t = today();
    for (let i = n - 1; i >= 0; i--) {
      let from, to, label, tl;
      if (kind === "month") { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); from = localISO(d); const e = new Date(d); e.setMonth(e.getMonth() + 1); e.setDate(0); to = localISO(e); label = MESI[d.getMonth()]; tl = MESIL[d.getMonth()]; }
      else { from = addDays(mon0(), -7 * i); to = addDays(from, 6); label = dLab(from); tl = "settimana del " + dLab(from); }
      out.push({ from, to, label, tl, live: from <= t && t <= to });
    }
    return out;
  }
  function agg(kind, n) {
    const key = kind + n; if (memo[key]) return memo[key];
    const t = today(), ses = S.sessions.map(s => isoOf(s.date));
    const res = buckets(kind, n).map(b => {
      const ds = []; for (let d = b.from; d <= b.to && d <= t; d = addDays(d, 1)) ds.push(data.day(d));
      const cl = ds.filter(d => d.closed && d.logged), gym = cl.filter(d => d.train), rest = cl.filter(d => !d.train);
      const pctOf = (arr, k) => arr.length ? Math.round(avg(arr.map(d => d[k] / d[k + "T"])) * 100) : null;
      const sumP = cl.reduce((s, d) => s + d.pro, 0), sumT = cl.reduce((s, d) => s + d.proT, 0);
      const nd = days(b.from, b.to) + 1;
      return Object.assign(b, {
        sessions: ses.filter(d => d >= b.from && d <= b.to).length,
        sessionsT: kind === "month" ? Math.round(planned() * nd / 7) : planned(),
        logged: cl.length, kcal: cl.length ? Math.round(avg(cl.map(d => d.kcal))) : null, kcalT: cl.length ? Math.round(avg(cl.map(d => d.kcalT))) : null,
        proPct: sumT ? Math.round(sumP / sumT * 100) : null,
        kcalGym: pctOf(gym, "kcal"), kcalRest: pctOf(rest, "kcal"), proGym: pctOf(gym, "pro"), proRest: pctOf(rest, "pro"),
        col: ds.filter(d => colDone(d.iso)).length, elapsed: ds.length
      });
    });
    return (memo[key] = res);
  }
  /* over 65, «1 anno»: 12 mesi a coppie = 6 colonne */
  function pairsOf(bs) {
    const out = [];
    for (let i = 0; i < bs.length; i += 2) { const a = bs[i], b = bs[i + 1] || a, av = k => { const v = nn([a[k], b[k]]); return v.length ? Math.round(avg(v)) : null; };
      out.push({ label: b.label, tl: a.tl + " e " + b.tl, live: a.live || b.live, sessions: a.sessions + (b === a ? 0 : b.sessions), sessionsT: a.sessionsT + (b === a ? 0 : b.sessionsT),
        proPct: av("proPct"), kcalGym: av("kcalGym"), kcalRest: av("kcalRest"), proGym: av("proGym"), proRest: av("proRest"), col: a.col + (b === a ? 0 : b.col), logged: a.logged + (b === a ? 0 : b.logged) }); }
    return out;
  }
  const big = () => o65();
  /* etichette asse X: per gli over 65 la scritta «in corso» la aggiunge il grafico */
  const xl = (bs, idx) => idx.map(i => [i, i === bs.length - 1 && bs[i].live && !big() ? "in corso" : bs[i].label]);

  /* ---------- quanti dati ci sono ---------- */
  function dataDays() {
    if (memo.dd != null) return memo.dd;
    const t = today(), set = new Set(S.sessions.map(s => isoOf(s.date)).filter(d => d < t));
    for (const iso of Object.keys(S.days)) if (iso < t && !set.has(iso) && data.day(iso).logged) set.add(iso);
    return (memo.dd = set.size);
  }
  function loggedDays(n) { // giorni chiusi con i pasti segnati negli ultimi n giorni
    const t = today(); let c = 0;
    for (let i = 1; i <= n; i++) { const d = addDays(t, -i); if (S.days[d] && data.day(d).logged) c++; }
    return c;
  }
  const W = () => memo.w || (memo.w = data.weight());

  /* ---------- forza: carico migliore per settimana, dalle sedute vere ---------- */
  function exSeries() {
    if (memo.ex) return memo.ex;
    const h = exHistory(), w0 = addDays(mon0(), -7 * 12), K = kid(), out = [];
    for (const ex of data.exercises(13)) {
      const list = (h[ex.name] || []).filter(x => isoOf(x.date) >= w0);
      if (!list.length) continue;
      const useKg = !K && ex.unit !== "none" && list.some(x => +x.kg > 0);
      const byW = {};
      for (const x of list) {
        const wi = Math.floor(days(w0, isoOf(x.date)) / 7), reps = Math.max(...x.sets.map(s => +s.reps || 0));
        const v = useKg ? { kg: +x.kg || 0, reps: +x.reps || 0 } : { kg: null, reps };
        const cur = byW[wi];
        if (!cur || (useKg ? v.kg > cur.kg || (v.kg === cur.kg && v.reps > cur.reps) : v.reps > cur.reps)) byW[wi] = Object.assign(v, { wi, date: isoOf(x.date) });
      }
      const pts = Object.values(byW).sort((a, b) => a.wi - b.wi);
      out.push({ name: ex.name, short: String(ex.short || ex.name).split("/")[0].trim(), demo: ex.demo, useKg, pts, n: list.length });
    }
    out.sort((a, b) => (b.useKg - a.useKg) || (b.n - a.n)); // prima gli esercizi con i carichi, i più frequenti
    return (memo.ex = out);
  }
  const val = (e, p) => e.useKg ? p.kg : p.reps;
  const fmtV = (e, v) => e.useKg ? nf(v) + " kg" : String(v);
  function stall(e) { const p = e.pts, L = val(e, p[p.length - 1]); let n = 1; while (n < p.length && val(e, p[p.length - 1 - n]) === L) n++; return n; }
  const step = kg => kg >= 20 ? 2.5 : 1;
  function toBeat(e) {
    const l = e.pts[e.pts.length - 1];
    if (!e.useKg) return { v: `${l.reps + 1}`, alt: "Una ripetizione in più", txt: `${l.reps + 1} ripetizioni` };
    return { v: `${nf(l.kg)} kg × ${l.reps + 1}`, alt: `Oppure ${nf(Math.max(0, l.kg - step(l.kg)))} kg × ${l.reps + 2}`, txt: `${nf(l.kg)} × ${l.reps + 1}` };
  }
  /* punto pieno: adulti e over 65 = proteine della settimana almeno al 95% del piano; ragazzo = colazione tutti i giorni */
  function flags(e) {
    const wk = agg("week", 13);
    return e.pts.map(p => { const b = wk[p.wi]; if (!b) return 0; return minor() ? (b.col >= (b.live ? b.elapsed : 7) ? 1 : 0) : (b.proPct != null && b.proPct >= 95 ? 1 : 0); });
  }
  const exImg = e => e.demo ? ui.fig(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${encodeURIComponent(e.demo)}/0.jpg`, `Esercizio: ${e.name}, posizione di partenza`, e.short) : "";

  /* ---------- peso ---------- */
  function rateOf(from) { // kg a settimana tra la media 7 giorni più vecchia e l'ultima del periodo
    const a = W().avg7.filter(x => x.date >= from); if (a.length < 2) return null;
    const d = days(a[0].date, a[a.length - 1].date); return d >= 7 ? (a[a.length - 1].kg - a[0].kg) / d * 7 : null;
  }
  /* over 65: calo non voluto oltre il 5% in 3 mesi (decisione 3) */
  function calo() {
    if (!o65() || prof().obiettivo === "definizione") return null;
    const a = W().avg7; if (a.length < 4) return null;
    const cur = a[a.length - 1], win = a.filter(x => x.date >= addDays(today(), -92) && days(x.date, cur.date) >= 56);
    if (!win.length) return null;
    const ref = win.reduce((m, x) => x.kg > m.kg ? x : m);
    const drop = (ref.kg - cur.kg) / ref.kg;
    return drop > 0.05 ? { from: ref.kg, to: cur.kg, kg: ref.kg - cur.kg, fromDate: ref.date } : null;
  }
  const fase = () => ({ massa: "fase di massa", definizione: "fase di definizione", mantenimento: "mantenimento" })[prof().obiettivo] || "";

  /* ---------- foto ---------- */
  const POSES = [["frontale", "Fronte"], ["laterale", "Lato"], ["posteriore", "Schiena"]];
  const photosOf = pose => (S.photos || []).filter(p => (p.pose || "frontale") === pose).slice().sort((a, b) => a.date < b.date ? -1 : 1);

  /* ---------- pagina «Servono più dati» ---------- */
  function needCard(n, done, tot, unit, btn) {
    return `<div><p class="v3-progressi-nd">Servono più dati</p><p class="v3-bd">ancora ${esc(n)} ${esc(unit)}</p></div>
      <div class="v3-bar" role="img" aria-label="${done} ${esc(unit)} su ${tot}"><i style="width:${Math.min(100, Math.round(done / tot * 100))}%"></i></div>${pl(`${done} ${unit} su ${tot} per il grafico`)}${btn || ""}`;
  }
  const btnGo = (label, id) => `<button class="v3-b2" data-v3act="go" data-v3arg="${id}">${esc(label)}</button>`;
  const btnPeso = `<button class="v3-b2" data-act="sheet" data-v="peso">Registra il peso</button>`;
  const dotLeg = (a, b) => `<p class="v3-leg"><span><i class="v3-progressi-d1"></i>${esc(a)}</span><span><i class="v3-progressi-d2"></i>${esc(b)}</span></p>`;
  const tog = (t, s, on, act) => `<div class="v3-row"><span class="v3-rx"><span class="v3-rt" style="display:block">${esc(t)}</span><span class="v3-rs" style="display:block">${esc(s)}</span></span><button class="v3-progressi-tog" aria-label="${esc(t)}" aria-pressed="${on}" data-v3act="${act}"><i></i></button></div>`;

  /* ============================== SEZIONI ============================== */
  const SEC = {};

  /* --- La mia settimana --- */
  SEC.settimana = {
    title: "La mia settimana", legacy: null,
    opts: () => o65() ? ["6 settimane", "6 mesi", "1 anno"] : ["8 settimane", "3 mesi", "1 anno"], def: () => 0,
    need() { const n = dataDays(); return n < 14 ? [14 - n, n, 14, "giorni", btnGo(S.sessions.length ? "Segna i pasti" : "Inizia la prima seduta", S.sessions.length ? "cibo" : "palestra")] : null; },
    series(i) {
      if (o65()) return i === 0 ? agg("week", 6) : i === 1 ? agg("month", 6) : pairsOf(agg("month", 12));
      return i === 0 ? agg("week", 13).slice(-9) : i === 1 ? agg("week", 13) : agg("month", 12);
    },
    verdict() {
      if (this.need()) return "Ancora pochi dati";
      const bs = agg("week", 13).filter(b => !b.live);
      if (minor()) { const full = bs.filter(b => b.col === 7), part = bs.filter(b => b.col < 7);
        if (full.length >= 2 && part.length >= 2 && avg(full.map(b => b.sessions)) - avg(part.map(b => b.sessions)) >= 0.3) return "Colazione e allenamenti vanno insieme";
        return avg(bs.map(b => b.sessions)) >= planned() * 0.8 ? "Allenamenti regolari" : "Ogni allenamento conta"; }
      const ok = bs.filter(b => b.proPct != null && b.logged >= 3), full = ok.filter(b => b.sessions >= b.sessionsT && b.sessionsT), part = ok.filter(b => b.sessions < b.sessionsT);
      if (full.length >= 2 && part.length >= 2) { const d = avg(full.map(b => b.proPct)) - avg(part.map(b => b.proPct)); if (d >= 3) return "Più sedute, più proteine"; if (d <= -3) return "Più sedute, meno proteine"; }
      return avg(bs.map(b => b.sessions)) >= planned() * 0.8 ? "Sedute regolari" : "Meno sedute del piano";
    },
    card(i) {
      const bs = this.series(i), n = bs.length, last = n - 1, cl = bs.filter(b => !b.live), K = kid(), M = minor();
      const word = M ? "allenamenti" : "sedute", T = Math.max(1, ...bs.map(b => b.sessionsT || 0));
      let head;
      if (o65()) {
        if (i === 0) { const c5 = cl.slice(-5); head = bigS(`${c5.reduce((s, b) => s + b.sessions, 0)} sedute su ${c5.reduce((s, b) => s + b.sessionsT, 0)}`, `nelle ultime ${c5.length} settimane`); }
        else head = bigS(`${Math.round(avg(cl.map(b => b.sessions)) / (i === 2 ? 2 : 1))} sedute al mese`, i === 1 ? "in media negli ultimi mesi" : "in media nell'ultimo anno");
      } else if (i === 2) head = bigS(`${Math.round(avg(cl.map(b => b.sessions)))} ${word} al mese`, `in media · erano ${bs[0].sessions} a ${bs[0].tl}`);
      else { const a = avg(cl.map(b => b.sessions)), a1 = avg(cl.slice(-4).map(b => b.sessions)), a0 = avg(cl.slice(-8, -4).map(b => b.sessions));
        head = K ? bigS(`Circa ${Math.round(a)}`, `${word} a settimana`) : bigS(`${nf(i === 0 ? a1 : a)} ${word}`, i === 0 && a0 != null ? `a settimana · ${sgn(Math.round((a1 - a0) * 10) / 10)} sul mese prima` : `a settimana negli ultimi 3 mesi`); }
      const xi = o65() ? (n === 6 && i === 0 ? [0, 2, 5] : bs.map((_, k) => k)) : n === 9 ? [0, 4, 8] : n === 13 ? [0, 4, 8, 12] : [0, 4, 8, 11];
      const sMax = Math.max(T, ...bs.map(b => b.sessions)), all = o65();
      let h = head + pl(i === 0 || (i === 1 && !o65()) ? `${M ? "Allenamenti" : "Sedute"} fatte su ${T}` : `${M ? "Allenamenti" : "Sedute"} nel periodo`)
        + ui.chart.bars({ vals: bs.map(b => b.sessions), max: sMax, ticks: [[T, String(T)], [0, "0"]], all, fmt: String, tip: k => `${bs[k].tl}: ${bs[k].sessions} ${word}`, aria: `${M ? "Allenamenti" : "Sedute"} per periodo` });
      if (M) { const cMax = i === 2 ? 31 : 7;
        h += pl(i === 2 ? "Giorni con colazione nel mese" : "Giorni con colazione, su 7") + ui.chart.bars({ vals: bs.map(b => b.col), max: cMax, ticks: [[cMax, String(cMax)], [0, "0"]], xl: xl(bs, xi), all, fmt: String, tip: k => `${bs[k].tl}: colazione ${bs[k].col} giorni`, aria: "Giorni con colazione" }); }
      else { const p = bs.map(b => b.proPct || 0);
        h += pl("Proteine, % del piano") + ui.chart.bars({ vals: p, max: Math.max(120, ...p), ticks: [[100, "100", true], [0, "0"]], xl: xl(bs, xi), all, fmt: v => v + "%", tip: k => `${bs[k].tl}: ${bs[k].proPct == null ? "pasti non segnati" : bs[k].proPct + "% del piano"}`, aria: "Proteine per periodo, % del piano" }); }
      return h;
    },
    rows() {
      const w = data.week(), M = minor();
      const r1 = ui.row({ title: M ? "Allenamenti" : "Sedute", sub: "Questa settimana", value: planned() ? `${w.sessions.done}${of(w.sessions.planned)}` : "–" });
      if (M) { const col = w.days.filter(d => !d.future && colDone(d.iso)).length; return r1 + ui.row({ title: "Colazione", sub: "Giorni di questa settimana", value: `${col}${of(7)}` }); }
      const a = w.avg.all;
      return r1 + ui.row({ title: "Proteine al giorno", sub: a.n ? "Media dei giorni chiusi" : "Nessun giorno chiuso", value: a.n ? `${a.pro}${of(a.proT, "g")}` : "–" });
    },
    lab: "Questa settimana",
    sap: () => minor() ? ["Perché conta la colazione?", ["Dopo la notte il corpo ha bisogno di energia.", "Qui vedi se le settimane con la colazione hanno anche più allenamenti: vanno insieme, ma conta anche altro."]]
      : ["Perché contano le proteine?", ["Dopo la seduta i muscoli si riparano con le proteine dei pasti.", "Qui vedi se le settimane con più sedute hanno anche più proteine."]],
    graf: () => `Ogni barra è un periodo: sopra ${minor() ? "gli allenamenti, sotto i giorni con colazione" : "le sedute, sotto le proteine"}. La barra bianca è adesso, ancora in corso: per questo è più bassa.`,
    leoQ: () => minor() ? "Cosa mi manca questa settimana?" : "Come vanno sedute e proteine nelle ultime settimane?"
  };

  /* --- Forza e carichi (adulto, ragazzo, over 65) e Prossima volta (bambino) --- */
  function forzaDef(isKid) {
    return {
      title: isKid ? "Prossima volta" : "Forza e carichi", legacy: "carichi", lab: isKid ? "Prossimo allenamento" : "Prossima seduta",
      list: () => exSeries().filter(e => e.pts.length >= 2 || exSeries().length < 3),
      opts() { return this.list().slice(0, 3).map(e => e.short); }, def: () => 0, isEx: true,
      need() { const n = S.sessions.length, u = isKid ? "allenamenti" : "sedute"; if (n < 8) return [8 - n, n, 8, u, btnGo(n ? "Vai in palestra" : "Inizia la prima seduta", "palestra")];
        return this.list().length ? null : [1, 0, 1, isKid ? "allenamento con esercizi" : "seduta con carichi", btnGo("Vai in palestra", "palestra")]; },
      cur(i) { const l = this.list(); return l[Math.min(i, l.length - 1)]; },
      verdict(i) {
        if (this.need()) return "Ancora pochi dati";
        const e = this.cur(i), n = stall(e);
        if (isKid) return val(e, e.pts[e.pts.length - 1]) > val(e, e.pts[0]) ? "Fai più ripetizioni di prima" : "Prova una ripetizione in più";
        if (n >= 3) return `Stesso carico da ${n} settimane`;
        const f = flags(e), rec = []; let mx = val(e, e.pts[0]);
        e.pts.forEach((p, k) => { if (k && val(e, p) > mx) { rec.push(k); mx = val(e, p); } });
        if (!rec.length) return "Carico stabile da 3 mesi";
        const inF = rec.filter(k => f[k]).length;
        if (minor()) return inF * 2 >= rec.length ? "Record e colazioni vanno insieme" : `${rec.length} ${plural(rec.length, "record", "record")} in 3 mesi`;
        return `${inF} record su ${rec.length} con le proteine del piano`;
      },
      card(i) {
        const e = this.cur(i), p = e.pts, L = p.map(x => val(e, x)), l = p[p.length - 1], f = isKid ? null : flags(e);
        const rng = Math.max(...L) - Math.min(...L), u = e.useKg ? (rng > 8 ? 5 : 2.5) : 1;
        const lo = Math.max(0, Math.floor((Math.min(...L) - Math.max(rng, u) * .25) / u) * u), hi = Math.ceil((Math.max(...L) + Math.max(rng, u) * .3) / u) * u;
        const diff = L[L.length - 1] - L[0];
        const head = e.useKg ? bigS(`${nf(l.kg)} kg × ${l.reps}`, diff ? `${sgn(diff)} kg dal ${dLab(p[0].date)}` : `stesso carico dal ${dLab(p[0].date)}`)
          : bigS(`${l.reps} ${isKid ? "ripetizioni" : "rip."}`, `erano ${p[0].reps} il ${dLab(p[0].date)}`);
        const xi = [[0, dLab(p[0].date)], [p.length - 1, "ultima"]];
        if (p.length > 4) xi.splice(1, 0, [Math.floor((p.length - 1) / 2), dLab(p[Math.floor((p.length - 1) / 2)].date)]);
        return ui.hf(head, exImg(e)) + pl(e.useKg ? "Carico migliore, ogni settimana" : "Ripetizioni migliori, ogni settimana")
          + ui.chart.steps({ pts: L, flags: f, min: lo, max: hi, xl: xi, fmt: v => fmtV(e, v), tip: k => `${dLab(p[k].date)}: ${e.useKg ? `${nf(p[k].kg)} kg × ${p[k].reps}` : p[k].reps + " ripetizioni"}${f && f[k] ? (minor() ? " · colazione ogni giorno" : " · proteine del piano") : ""}`, aria: `${e.useKg ? "Carico migliore" : "Ripetizioni migliori"} a ${e.name} in 3 mesi` })
          + (f ? (minor() ? dotLeg("Colazione tutti i giorni", "Non tutti") : dotLeg("Proteine del piano", "Meno del piano")) : "");
      },
      rows(i) {
        const e = this.cur(i), b = toBeat(e), n = stall(e), w = data.week();
        const r1 = ui.row({ title: isKid ? "Da battere la prossima volta" : "Da battere", sub: b.alt, value: esc(b.v) });
        if (isKid || minor()) return r1 + ui.row({ title: "Allenamenti", sub: "Questa settimana", value: planned() ? `${w.sessions.done}${of(w.sessions.planned)}` : "–" });
        if (n >= 3) { const wk = agg("week", 13), ws = nn(e.pts.slice(-n).map(p => wk[p.wi] && wk[p.wi].kcalRest)), v = ws.length ? Math.round(avg(ws)) : null;
          return r1 + ui.row({ title: "Calorie a riposo", sub: `Nelle ${n} settimane ferme`, value: v == null ? "–" : `${v}%${of("100%")}` }); }
        const a = w.avg.all, kg = prof().peso || (W().last && W().last.kg);
        return r1 + ui.row({ title: "Proteine al giorno", sub: a.n && kg ? "Media dei giorni chiusi" : "Nessun giorno chiuso", value: a.n && kg ? `${nf(a.pro / kg)}${of(nf(a.proT / kg), "g/kg")}` : "–" });
      },
      sap: () => isKid ? ["Chi decide gli esercizi?", ["L'adulto che ti allena, con la scheda.", "Qui vedi quante ripetizioni hai fatto: prova a farne una in più."]]
        : minor() ? ["Chi decide i carichi?", ["Il tuo preparatore, con la scheda.", "Qui vedi i record e cosa battere: i carichi nuovi li concordi con lui."]]
        : ["Cos'è il carico migliore?", ["È il peso più alto sollevato in una seduta, con le sue ripetizioni.", "Punto pieno: settimana con almeno il 95% delle proteine del piano. Vanno insieme, ma contano anche sonno e riposo."]],
      graf: () => isKid ? "La linea mostra quante ripetizioni hai fatto ogni settimana. Quando sale, hai battuto il tuo record." : "La linea è il carico migliore di ogni settimana: sale quando batti un record.",
      leoQ: () => isKid ? "Quante ripetizioni provo la prossima volta?" : "Cosa provo alla prossima seduta?"
    };
  }
  SEC.forza = forzaDef(false);
  SEC.fare = forzaDef(true);

  /* --- Cibo e allenamento (adulto: calorie; over 65: proteine) --- */
  const FOOD = {
    yogurt: ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Lancaster%2C_United_States_%28Unsplash%29.jpg/960px-Lancaster%2C_United_States_%28Unsplash%29.jpg", "Ciotola di yogurt con frutti rossi e mandorle", "Yogurt e frutta secca", "Foto: Peter Hershey, CC0, Wikimedia Commons"],
    legumi: ["https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Healthy_Lentil_Salad_%28Unsplash%29.jpg/960px-Healthy_Lentil_Salad_%28Unsplash%29.jpg", "Insalata di lenticchie con verdure", "Lenticchie", "Foto: James Sutton, CC0, Wikimedia Commons"]
  };
  function fabbisogno() {
    const n = loggedDays(28); if (n < 21) return { need: 21 - n };
    const t = today(), ds = []; for (let i = 1; i <= 28; i++) { const d = data.day(addDays(t, -i)); if (d.logged) ds.push(d); }
    const r = rateOf(addDays(t, -28)); if (r == null) return { noWeight: true };
    const k = avg(ds.map(d => d.kcal)), est = k - r * 7700 / 7, kT = avg(ds.map(d => d.kcalT));
    return { lo: Math.round((est - 100) / 50) * 50, hi: Math.round((est + 100) / 50) * 50, kcal: Math.round(k), rate: r, kT: Math.round(kT) };
  }
  SEC.cibo = {
    title: "Cibo e allenamento", legacy: "calorie", lab: "Cosa cambia",
    opts: () => o65() ? ["6 settimane", "6 mesi", "1 anno"] : ["4 settimane", "3 mesi", "1 anno"], def: () => 0,
    need() { const n = loggedDays(56); return n < 14 ? [14 - n, n, 14, "giorni con i pasti segnati", btnGo("Segna i pasti", "cibo")] : null; },
    k: () => o65() ? ["proGym", "proRest"] : ["kcalGym", "kcalRest"],
    series(i) { if (o65()) return i === 0 ? agg("week", 6) : i === 1 ? agg("month", 6) : pairsOf(agg("month", 12)); return i === 0 ? agg("week", 13).slice(-5) : i === 1 ? agg("week", 13) : agg("month", 12); },
    verdict(i) {
      if (this.need()) return "Ancora pochi dati";
      const [g, r] = this.k(), bs = this.series(i).filter(b => !b.live), G = avg(nn(bs.map(b => b[g]))), R = avg(nn(bs.map(b => b[r])));
      const what = o65() ? "proteine" : "calorie", rest = o65() ? "Senza ginnastica" : "A riposo";
      if (R != null && R < 92 && (G == null || R < G - 3)) return `${rest}, meno ${what} del piano`;
      if (G != null && G < 92) return o65() ? "Con ginnastica, meno proteine" : "In palestra mangi meno del piano";
      if ((R != null && R > 110) || (G != null && G > 110)) return `Sopra il piano, ${what}`;
      return "Vicino al piano, sempre";
    },
    card(i) {
      const [g, r] = this.k(), bs = this.series(i), cl = bs.filter(b => !b.live), G = avg(nn(cl.map(b => b[g]))), R = avg(nn(cl.map(b => b[r])));
      const n = bs.length, xi = o65() ? (n === 6 && i === 0 ? [0, 2, 5] : bs.map((_, k) => k)) : n === 5 ? [0, 2, 4] : n === 13 ? [0, 4, 8, 12] : [0, 4, 8, 11];
      const food = o65() ? FOOD.legumi : FOOD.yogurt;
      const head = bigS(R == null ? "Riposo –" : `Riposo ${Math.round(R)}%`, `${o65() ? "proteine del piano" : "del piano"} · ${o65() ? "ginnastica" : "palestra"} ${G == null ? "–" : Math.round(G) + "%"}`);
      return ui.hf(head, ui.fig(food[0], food[1], food[2])) + pl(o65() ? "Proteine, % del piano" : "Calorie, % del piano")
        + ui.chart.pairs({ gym: bs.map(b => b[g]), rest: bs.map(b => b[r]), lab: bs.map(b => b.tl), xl: xl(bs, xi), aria: o65() ? "Proteine nei giorni con e senza ginnastica" : "Calorie nei giorni di palestra e di riposo" })
        + `<p class="v3-leg"><span><i class="v3-k1"></i>${o65() ? "Con ginnastica" : "Palestra"}</span><span><i class="v3-k2"></i>${o65() ? "Senza" : "Riposo"}</span><span><i class="v3-k3"></i>Piano</span></p>`
        + `<p class="v3-progressi-cred">${esc(food[3])}</p>`;
    },
    rows() {
      const w = data.week();
      if (o65()) { const a = w.avg.all, kg = prof().peso || (W().last && W().last.kg);
        return ui.row({ title: "Proteine al giorno", sub: a.n ? "Media dei giorni chiusi" : "Nessun giorno chiuso", value: a.n ? `${a.pro}${of(a.proT, "g")}` : "–" })
          + ui.row({ title: "Per ogni kg di peso", sub: "Dopo i 65 anni: 1,0-1,5 g", value: a.n && kg ? `${nf(a.pro / kg)} g` : "–" }); }
      const a = w.avg.rest, miss = a.n ? a.kcalT - a.kcal : null;
      const r1 = ui.row({ title: "A riposo, questa settimana", sub: !a.n ? "Nessun giorno di riposo chiuso" : miss > 0 ? `Mancano ${nf(miss)} kcal al giorno` : "In linea con il piano", value: a.n ? `${nf(a.kcal)}${of(nf(a.kcalT))}` : "–" });
      const f = fabbisogno();
      const r2 = f.need ? ui.row({ title: "Il tuo fabbisogno reale", sub: `Servono più dati: ancora ${f.need} giorni`, value: "–" })
        : f.noWeight ? ui.row({ title: "Il tuo fabbisogno reale", sub: "Servono più pesate nelle ultime 4 settimane", value: "–" })
        : ui.row({ title: "Il tuo fabbisogno reale", sub: "Come si calcola", act: "fab", apri: false }).replace("</button>", `<span class="v3-val">${nf(f.lo)}-${nf(f.hi)}</span></button>`);
      return r1 + r2;
    },
    sap: () => o65() ? ["Proteine anche a riposo", ["I muscoli si rinforzano anche nei giorni senza ginnastica.", "Un pranzo con legumi, pesce o uova arriva a circa 25 g di proteine."]]
      : ["Cosa mangiare a riposo?", ["Nei giorni senza palestra i muscoli recuperano e usano energia.", "Se a riposo resti sotto il piano, segui le porzioni del piano anche lì."]],
    graf: () => `Ogni coppia è un periodo: bianco i giorni ${o65() ? "con ginnastica" : "di palestra"}, grigio quelli ${o65() ? "senza" : "di riposo"}. La riga tratteggiata è il piano (100%).`,
    leoQ: () => o65() ? "Quante proteine mi servono al giorno?" : "Quanto devo mangiare nei giorni di riposo?"
  };

  /* --- Peso (adulto, over 65) --- */
  SEC.peso = {
    title: "Peso", legacy: "peso", lab: "",
    opts: () => ["4 settimane", "3 mesi", "1 anno"], def: () => 1,
    need() { const e = W().entries, span = e.length ? days(e[0].date, e[e.length - 1].date) : 0;
      if (e.length < 8) return [8 - e.length, e.length, 8, "pesate", btnPeso];
      if (span < 21) return [21 - span, span, 21, "giorni di pesate", btnPeso]; return null; },
    verdict() {
      if (calo()) return "Peso in calo: parliamone";
      if (this.need()) return "Ancora pochi dati";
      const r = rateOf(addDays(today(), -28)), g = prof().obiettivo;
      if (r == null || Math.abs(r) < 0.1) return o65() ? "Stabile, come deve essere" : "Stabile nelle ultime 4 settimane";
      if (r > 0) return g === "massa" ? "Sale, in linea con la massa" : "Sale nelle ultime 4 settimane";
      return g === "definizione" ? "Scende, in linea con la definizione" : "Scende nelle ultime 4 settimane";
    },
    card(i) {
      const from = addDays(today(), -[28, 91, 365][i] + 1), wt = W(), ent = wt.entries.filter(x => x.date >= from), a7 = wt.avg7.filter(x => x.date >= from), c = calo();
      let kc = "";
      if (!o65()) {
        const bs = i === 0 ? agg("week", 13).slice(-5) : i === 1 ? agg("week", 13) : agg("month", 12), ok = bs.filter(b => b.kcal != null && !b.live);
        if (ok.length >= 2) { const v = ok.map(b => b.kcal), plan = Math.round(avg(nn(ok.map(b => b.kcalT)))), lo = Math.floor(Math.min(...v, plan) / 100) * 100 - 100, hi = Math.ceil(Math.max(...v, plan) / 100) * 100 + 100;
          kc = pl(i === 2 ? "Calorie medie al giorno, per mese" : "Calorie medie al giorno, per settimana") + ui.chart.line({ trend: v, plan, min: lo, max: hi, yl: [nf(hi), nf(lo)], xl: [[0, ok[0].label], [ok.length - 1, ok[ok.length - 1].label]], fmt: nf, tip: k => `${ok[k].tl}: ${nf(v[k])} kcal`, aria: "Calorie medie e piano" }); }
      }
      const med = `<p class="v3-progressi-note">Parlane con il medico o con il dietista</p><button class="v3-b2" data-v3act="medico">Prepara il riepilogo per il medico</button>`;
      if (hidden()) return (c ? bigS("Peso in calo", "da 3 mesi") + med : bigS("Peso nascosto", "Continui a registrarlo")) + kc;
      if (ent.length < 2) return bigS(`${nf(wt.last.kg)} kg`, "Poche pesate in questo periodo") + pl("Scegli un periodo più lungo") + kc;
      const all = ent.map(x => x.kg).concat(a7.map(x => x.kg)), lo = Math.floor(Math.min(...all) - 0.8), hi = Math.max(lo + 1, Math.ceil(Math.max(...all) + 0.2));
      const n = a7.length, mid = Math.floor((n - 1) / 2);
      const ch = ui.chart.line({ trend: a7.map(x => x.kg), dots: o65() ? null : ent.map(x => x.kg), min: lo, max: hi, yl: [String(hi), String(lo)], xl: [[0, dLab(a7[0].date)], [mid, dLab(a7[mid].date)], [n - 1, "ora"]].filter((x, k, A) => k === 0 || x[0] !== A[k - 1][0]), fmt: v => nf(v) + " kg", tip: k => `${dLab(a7[k].date)}: media ${nf(a7[k].kg)} kg · pesata ${nf(ent[k].kg)}`, aria: "Peso: media di 7 giorni e pesate" });
      const cur = a7[n - 1].kg;
      if (c) return bigS(`${nf(c.kg)} kg in meno`, `da ${nf(c.from)} a ${nf(c.to)} kg`) + pl("Peso, la media di 7 giorni") + ch + med;
      const r = rateOf(from);
      const line = o65() ? (r == null || Math.abs(r) < 0.1 ? "stabile · nessun obiettivo di calo" : `${sgn(r)} kg a settimana`) : r == null ? "media degli ultimi 7 giorni" : `${sgn(r)} kg a settimana${fase() ? " · " + fase() : ""}`;
      return bigS(`${nf(cur)} kg`, line) + pl(o65() ? "Peso, la media di 7 giorni" : "Peso: linea = media, puntini = pesate") + ch + kc;
    },
    rows() {
      const l = W().last, h = hidden();
      return ui.row({ title: "Ultima pesata", sub: l ? longDate(l.date) : "Nessuna pesata", value: !l ? "–" : h ? "Nascosto" : `${nf(l.kg)} kg` })
        + tog("Nascondi il peso", "Continui a registrarlo", h, "hidew") + `<button class="v3-b2" data-act="sheet" data-v="peso">Registra il peso</button>`;
    },
    sap: () => calo() ? ["Perché un calo va controllato?", ["Un calo di peso in pochi mesi va sempre sentito dal medico.", "Non è un giudizio: è una precauzione."]]
      : o65() ? ["Perché tenere il peso stabile?", ["Dopo i 65 anni perdere peso senza volerlo può voler dire perdere muscolo.", "Per questo Askesis non fissa obiettivi di calo."]]
      : ["Perché la linea e i puntini?", ["Le pesate cambiano ogni giorno con acqua e cibo.", "La linea è la media di 7 giorni: mostra dove stai andando."]],
    graf: () => o65() ? "La linea è la media del peso di 7 giorni: piatta vuol dire stabile." : "I puntini sono le pesate, la linea è la media di 7 giorni. Sotto, le calorie medie al giorno: la riga tratteggiata è il piano.",
    leoQ: () => calo() ? "Cosa dico al medico del mio peso?" : "Il mio peso va bene per il mio obiettivo?"
  };

  /* --- Foto del corpo (adulto, over 65): foto vere da photos.js / IndexedDB, sfocate fino a «Mostra» --- */
  SEC.foto = {
    title: "Foto del corpo", legacy: "foto", lab: "", noLeg: false,
    opts: () => POSES.map(p => p[1]), def: () => Math.max(0, POSES.findIndex(([p]) => photosOf(p).length)),
    need: () => null,
    verdict: () => (S.photos || []).length ? "Solo sul tuo telefono" : "Spente, le attivi tu",
    pair(pose) {
      const l = photosOf(pose); if (!l.length) return null;
      const pk = pick[pose] || {}, a = l.find(p => p.id === pk.a) || l[0], b = l.find(p => p.id === pk.b) || l[l.length - 1];
      return a.date <= b.date ? [a, b] : [b, a];
    },
    card(i) {
      const [pose, lab] = POSES[i];
      if (!S.assets) return bigS("Non disponibili", "Questo browser non salva le foto") + `<div class="v3-progressi-frame">${sagoma(i)}</div>`;
      const pr = this.pair(pose);
      if (!pr) return bigS("Nessuna foto", `${lab}: scatta la prima quando vuoi`) + `<div class="v3-progressi-frame">${sagoma(i)}</div>` + pl("Così ti metterai nella foto");
      const [a, b] = pr, one = a.id === b.id;
      const pic = (p, side) => `<div class="v3-progressi-pic">${shown.has(p.id)
        ? `<div class="v3-progressi-blur on"><img src="${esc(p.url)}" alt="Foto ${esc(pose)} del ${esc(longDate(isoOf(p.date)))}"><button class="v3-progressi-show" data-v3act="hidep" data-v3arg="${esc(p.id)}">Nascondi</button></div>`
        : `<div class="v3-progressi-blur"><button class="v3-progressi-show" data-v3act="showp" data-v3arg="${esc(p.id)}">Mostra</button></div>`}${one ? "" : `<button class="v3-progressi-pdb" data-v3act="pickp" data-v3arg="${side}" aria-label="Cambia foto: ${esc(longDate(isoOf(p.date)))}">${esc(dLab(isoOf(p.date)))}&nbsp;›</button>`}</div>`;
      if (one) return bigS("1 foto", `del ${longDate(isoOf(a.date))}`) + `<div class="v3-progressi-pair one">${pic(a, "a")}</div>` + pl("Con la prossima potrai confrontarle");
      const da = isoOf(a.date), db = isoOf(b.date), wk = Math.max(1, Math.round(days(da, db) / 7));
      const ses = S.sessions.filter(s => { const d = isoOf(s.date); return d >= da && d <= db; }).length;
      const pd = []; for (let d = da; d <= db && d < today(); d = addDays(d, 1)) { if (S.days[d]) { const x = data.day(d); if (x.logged) pd.push(x.pro); } }
      const kg = prof().peso || (W().last && W().last.kg), pro = pd.length && kg ? nf(avg(pd) / kg) + " g/kg" : "–";
      const near = iso => { const a7 = W().avg7; let best = null; for (const x of a7) if (Math.abs(days(x.date, iso)) <= 7 && (!best || Math.abs(days(x.date, iso)) < Math.abs(days(best.date, iso)))) best = x; return best; };
      const wa = near(da), wb = near(db), dw = wa && wb ? sgn(Math.round((wb.kg - wa.kg) * 10) / 10) + " kg" : "–";
      return bigS(`${wk} ${plural(wk, "settimana", "settimane")}`, "tra le due foto") + `<div class="v3-progressi-pair">${pic(a, "a")}${pic(b, "b")}</div>`
        + `<div class="v3-progressi-nums"><div><p class="v3-progressi-nl">Sedute</p><p class="v3-progressi-nv">${ses}</p></div><div><p class="v3-progressi-nl">Proteine</p><p class="v3-progressi-nv">${pro}</p></div><div><p class="v3-progressi-nl">Peso</p><p class="v3-progressi-nv">${hidden() ? "Nascosto" : dw}</p></div></div>`;
    },
    rows(i) {
      const [pose, lab] = POSES[i], l = photosOf(pose), last = l[l.length - 1];
      let next = "Quando vuoi";
      if (last) { const n = addDays(isoOf(last.date), 28); next = n <= today() ? "Oggi" : dLab(n); }
      const up = S.assets ? `<label class="v3-b2 v3-progressi-up" data-v3act="pose" data-v3arg="${pose}">Aggiungi foto: ${esc(lab.toLowerCase())}<input type="file" accept="image/*" data-act="upload" aria-label="Scegli una foto ${esc(pose)}"></label>` : "";
      return ui.row({ title: "Prossima foto", sub: "Al massimo una ogni 4 settimane", value: esc(next) }) + up;
    },
    sap: () => ["Come scattare bene", ["Stessa luce, stessa ora, stessa posa.", "Meglio al mattino, prima di colazione. Le foto restano sul telefono."]],
    graf: () => "Qui il grafico sono le due foto: tocca una data per scegliere quali confrontare. Sotto vedi sedute, proteine e peso tra le due.",
    leoQ: () => "Ogni quanto conviene fare le foto del corpo?",
    moreLabel: "Confronto con l'AI e tutte le foto"
  };
  function sagoma(pose) {
    const f = 'fill="rgba(255,255,255,.22)"';
    if (pose === 1) return `<svg viewBox="0 0 100 160" aria-hidden="true"><circle cx="52" cy="24" r="13" ${f}></circle><path d="M42 42 Q54 38 60 46 L63 96 L58 154 L46 154 L44 100 L40 70 Z" ${f}></path></svg>`;
    return `<svg viewBox="0 0 100 160" aria-hidden="true"><circle cx="50" cy="24" r="14" ${f}></circle><path d="M30 46 Q50 40 70 46 L80 98 L72 100 L66 66 L64 154 L54 154 L50 104 L46 154 L36 154 L34 66 L28 100 L20 98 Z" ${f}></path>${pose === 2 ? '<line x1="50" y1="50" x2="50" y2="100" stroke="rgba(0,0,0,.35)" stroke-width="2"></line>' : ""}</svg>`;
  }

  /* ---------- chi vede cosa ---------- */
  const allowed = () => kid() ? ["settimana", "fare"] : minor() ? ["settimana", "forza"] : ["settimana", "forza", "cibo", "peso", "foto"];

  /* ============================== PAGINA PRINCIPALE ============================== */
  function lime() {
    const w = data.week(), pd = w.sessions.planned, dn = w.sessions.done, M = minor();
    const sed = pd ? { label: M ? "Allenamenti" : "Sedute", value: String(dn), of: pd, pct: ui.pct(dn, pd), miss: dn >= pd ? "Settimana chiusa" : `${dn >= pd - 1 ? "Manca" : "Mancano"} ${pd - dn} ${M ? plural(pd - dn, "allenamento", "allenamenti") : plural(pd - dn, "seduta", "sedute")}` }
      : { label: M ? "Allenamenti" : "Sedute", value: "–", miss: "Crea la scheda in Palestra" };
    const t = today(), v = S.days[t], water = v ? (v.water || 0) * 0.25 : 0, wT = planTargets().waterL;
    const acqua = { label: "Acqua oggi", value: nf(water), of: nf(wT), unit: "L", pct: wT ? Math.round(water / wT * 100) : 0, miss: water >= wT ? "Fatto" : `Mancano ${nf(wT - water)} L` };
    let tiles;
    if (M) {
      const past = w.days.filter(d => !d.future), col = past.filter(d => colDone(d.iso)).length, p3 = past.filter(d => mealsDone(d.iso) >= 3).length;
      tiles = [sed, { label: "Colazione", value: String(col), of: 7, pct: ui.pct(col, 7), miss: col >= 7 ? "Tutti i giorni" : `Mancano ${7 - col} ${plural(7 - col, "giorno", "giorni")}` },
        { label: "Giorni con 3 pasti", value: String(p3), of: 7, pct: ui.pct(p3, 7), miss: p3 >= 7 ? "Tutti i giorni" : `Mancano ${7 - p3} ${plural(7 - p3, "giorno", "giorni")}` }, acqua];
    } else {
      const pe = w.protein.eaten, pt = w.protein.target;
      const pro = { label: "Proteine", value: nf(pe), of: nf(pt), unit: "g", pct: ui.pct(pe, pt), miss: pe >= pt ? "Fatto" : `Mancano ${nf(pt - pe)} g` };
      const kc = (lab, a) => a.n ? { label: lab, value: nf(a.kcal), of: nf(a.kcalT), pct: ui.pct(a.kcal, a.kcalT), miss: a.kcal >= a.kcalT ? "Media: in linea" : `Media: mancano ${nf(a.kcalT - a.kcal)} kcal` } : { label: lab, value: "–", miss: "Nessun giorno chiuso" };
      if (o65()) { const past = w.days.filter(d => d.closed), lg = past.filter(d => d.logged).length;
        tiles = [sed, pro, { label: "Giorni con i pasti segnati", value: String(lg), of: past.length || 0, pct: ui.pct(lg, past.length || 1), miss: past.length ? (lg >= past.length ? "Tutti" : `Mancano ${past.length - lg} ${plural(past.length - lg, "giorno", "giorni")}`) : "La settimana è appena iniziata" }, acqua]; }
      else tiles = [sed, pro, kc("Calorie palestra", w.avg.gym), kc("Calorie riposo", w.avg.rest)];
    }
    return ui.limeBox({ title: kid() ? "Cosa ti manca questa settimana" : "Per chiudere la settimana", tiles });
  }
  function rowSub(id) {
    const w = data.week();
    if (id === "settimana") { if (SEC.settimana.need()) return S.sessions.length ? "Servono più dati" : "Inizia la prima seduta";
      const a = avg(agg("week", 13).filter(b => !b.live).slice(-4).map(b => b.sessions)); return kid() ? `Circa ${Math.round(a)} allenamenti a settimana` : `${nf(a)} ${minor() ? "allenamenti" : "sedute"} a settimana`; }
    if (id === "forza" || id === "fare") { const d = SEC[id], n = d.need(); if (n) return `Servono più dati: ancora ${n[0]} ${n[3]}`; const e = d.cur(0);
      return id === "fare" ? `Prova ${toBeat(e).txt}: ${e.short.toLowerCase()}` : `Da battere: ${e.short.toLowerCase()} ${toBeat(e).txt}`; }
    if (id === "cibo") { if (SEC.cibo.need()) return "Servono più dati"; const [, r] = SEC.cibo.k(), R = avg(nn(SEC.cibo.series(0).filter(b => !b.live).map(b => b[r])));
      return R == null ? "Nessun giorno di riposo segnato" : `${o65() ? "Senza ginnastica" : "A riposo"}: ${Math.round(R)}% del piano`; }
    if (id === "peso") { const l = W().last, c = calo(); if (hidden()) return c ? "Peso in calo: parlane col medico" : "Nascosto · lo registri sempre"; if (!l) return "Registra la prima pesata";
      if (c) return `${nf(c.kg)} kg in meno: parlane col medico`; const r = rateOf(addDays(today(), -28)); return `${nf(W().avg7[W().avg7.length - 1].kg)} kg${r != null ? ` · ${sgn(r)} a settimana` : ""}`; }
    if (id === "foto") { const n = (S.photos || []).length; return n ? `${n} ${plural(n, "foto", "foto")} · solo sul telefono` : "Nessuna foto · le aggiungi tu"; }
    return "";
  }
  function mainPage() {
    const c = calo();
    const rows = allowed().map(id => ui.row({ title: SEC[id].title, sub: rowSub(id), act: "open", arg: id })).join("")
      + (minor() ? "" : ui.row({ title: "Tutti i dati", sub: S.downloads ? "Grafici di prima ed esportazione CSV" : "I grafici di prima", act: "legacy", arg: "carichi" }));
    const sap = kid() ? "La colazione dà energia per allenarsi." : minor() ? "La colazione aiuta ad allenarsi." : o65() ? "Dopo i 65 anni servono proteine a ogni pasto." : "Le proteine aiutano i muscoli a recuperare.";
    return ui.header("Progressi") + lime()
      + (c ? ui.card((hidden() ? bigS("Peso in calo", "da 3 mesi") : bigS(`${nf(c.kg)} kg in meno`, "in 3 mesi")) + `<p class="v3-progressi-note">Parlane con il medico o con il dietista</p><button class="v3-b2" data-v3act="medico">Prepara il riepilogo per il medico</button>`) : "")
      + ui.section("I tuoi progressi", rows)
      + ui.end(sap, { act: "psap", arg: "main", leoQ: kid() ? "Cosa mi manca questa settimana?" : "Cosa mi manca per chiudere la settimana?" });
  }

  /* ============================== PAGINA INTERNA ============================== */
  function segHTML(id, d, i) {
    if (!d.isEx) return ui.seg(d.opts(), i, "sel", "Periodo");
    const l = d.list(), o = l.slice(0, 3), other = i >= 3;
    return `<div class="v3-seg" role="group" aria-label="Esercizio">${o.map((e, k) => `<button class="v3-sg" aria-pressed="${k === i}" data-v3act="sel" data-v3arg="${k}">${esc(e.short)}</button>`).join("")}${l.length > 3 ? `<button class="v3-sg" aria-pressed="${other}" data-v3act="exlist">${other ? esc(l[i].short) : "Altri"}&nbsp;›</button>` : ""}</div>`;
  }
  function innerPage(id) {
    const d = SEC[id], need = d.need();
    let i = sel[id] != null ? sel[id] : d.def();
    if (d.isEx && !need) i = Math.min(i, d.list().length - 1);
    const sap = d.sap();
    return ui.back() + `<div><h1 class="v3-t1">${esc(d.title)}</h1><p class="v3-sub">${esc(d.verdict(i))}</p></div>`
      + (need ? "" : segHTML(id, d, i))
      + ui.card(need ? needCard(...need) : d.card(i))
      + (need ? "" : `<section class="v3-sec">${d.lab ? ui.label(d.lab) : ""}${d.rows(i)}${d.legacy && !minor() ? ui.secondary(d.moreLabel || "Tutti i dati di prima", "legacy", d.legacy) : ""}</section>`)
      + ui.end(sap[0], { act: "psap", arg: id, leoQ: d.leoQ() });
  }

  /* ---------- fogli ---------- */
  const close = `<button class="v3-b2" data-v3act="close">Chiudi</button>`;
  function sapSheet(id) {
    const d = id === "main" ? null : SEC[id];
    const s = d ? d.sap() : kid() ? ["La colazione dà energia", ["Dopo la notte il corpo ha bisogno di energia.", "Nel riquadro verde vedi cosa ti manca questa settimana."]]
      : minor() ? ["La colazione aiuta ad allenarsi", ["Dopo la notte il corpo ha bisogno di energia per allenarsi.", "Nel riquadro verde vedi cosa manca per chiudere la settimana."]]
      : o65() ? ["Proteine a ogni pasto", ["Dopo i 65 anni conviene avere proteine a ogni pasto: legumi, pesce, uova o latticini.", "Nel riquadro verde vedi cosa manca per chiudere la settimana."]]
      : ["Proteine e recupero", ["Dopo la seduta i muscoli si riparano con le proteine dei pasti.", "Nel riquadro verde vedi cosa manca per chiudere la settimana."]];
    const how = d ? `<p class="v3-progressi-shl">Come si legge</p><p class="v3-shp">${esc(d.graf())}</p>` : "";
    V3.sheet(`<h2 class="v3-sh1">${esc(s[0])}</h2>${s[1].map(l => `<p class="v3-shp">${esc(l)}</p>`).join("")}${how}${ui.leo(d ? d.leoQ() : null)}${close}`);
  }
  function fabSheet() {
    const f = fabbisogno(); if (f.need || f.noWeight) return;
    V3.sheet(`<h2 class="v3-sh1">Il tuo fabbisogno reale</h2><p class="v3-shp">Si calcola dalle calorie medie delle ultime 4 settimane (${nf(f.kcal)} kcal al giorno) e da come cambia il peso (${sgn(f.rate)} kg a settimana).</p><p class="v3-shp">Risultato: ${nf(f.lo)}-${nf(f.hi)} kcal al giorno. Il piano ne prevede in media ${nf(f.kT)}.</p><p class="v3-progressi-note">Portalo al dietista: decide lui.</p>${close}`);
  }
  function medicoSheet() {
    const c = calo(); if (!c) return;
    const wk = agg("week", 6).filter(b => !b.live), s = wk.reduce((x, b) => x + b.sessions, 0), t = wk.reduce((x, b) => x + b.sessionsT, 0), pp = nn(wk.map(b => b.proPct));
    V3.sheet(`<h2 class="v3-sh1">Riepilogo per il medico</h2><p class="v3-shp">Peso medio da ${nf(c.from)} kg (${esc(longDate(c.fromDate))}) a ${nf(c.to)} kg oggi: ${nf(c.kg)} kg in meno.</p><p class="v3-shp">Sedute: ${s} su ${t} nelle ultime ${wk.length} settimane.${pp.length ? ` Proteine: in media il ${Math.round(avg(pp))}% del piano.` : ""}</p><p class="v3-shp">Mostralo al medico o al dietista alla prossima visita.</p>${close}`);
  }
  function exSheet() {
    const d = SEC[sub], l = d.list(), i = sel[sub] || 0;
    const s = V3.sheet(`<h2 class="v3-sh1">Tutti gli esercizi</h2><p class="v3-progressi-shl">${minor() && !kid() ? "Dalla scheda del preparatore" : "Dalla tua scheda"}</p>${l.map((e, k) => ui.row({ title: e.name, sub: "Da battere: " + toBeat(e).txt, act: "pick", arg: k, on: k === i, apri: k === i ? "Scelto" : "Scegli" })).join("")}${close}`,
      { on: { pick(k) { sel[sub] = +k; s.close(); V3.refresh(); } } });
  }
  function photoSheet(side) {
    const pose = POSES[sel.foto != null ? sel.foto : SEC.foto.def()][0], l = photosOf(pose), pr = SEC.foto.pair(pose); if (!pr) return;
    const cur = side === "a" ? pr[0] : pr[1], other = side === "a" ? pr[1] : pr[0];
    const s = V3.sheet(`<h2 class="v3-sh1">${side === "a" ? "Foto di partenza" : "Foto da confrontare"}</h2>${l.map((p, k) => p.id === other.id ? "" : ui.row({ title: longDate(isoOf(p.date)), sub: k === 0 ? "La prima" : k === l.length - 1 ? "L'ultima" : "Foto " + (k + 1), act: "pick", arg: p.id, on: p.id === cur.id, apri: p.id === cur.id ? "Scelta" : "Scegli" })).join("")}${close}`,
      { on: { pick(id) { const pk = pick[pose] = { a: pr[0].id, b: pr[1].id }; pk[side] = id; shown.delete(cur.id); s.close(); V3.refresh(); } } });
  }

  /* ---------- stile della sezione (una volta) ---------- */
  if (!document.getElementById("v3-sec-progressi")) {
    const st = document.createElement("style"); st.id = "v3-sec-progressi";
    st.textContent = `
    #view.v3 .v3-progressi-pl { font-size: 14px; font-weight: 600; color: var(--v3-t2); }
    #view.v3 .v3-progressi-bs { font-size: 26px; }
    #view.v3 .v3-progressi-nd { font-size: 24px; font-weight: 800; line-height: 1.15; }
    #view.v3 .v3-progressi-note { font-size: 16px; font-weight: 700; }
    #view.v3 .v3-progressi-cred { font-size: 12px; color: var(--v3-t3); line-height: 1.4; }
    #view.v3 .v3-progressi-d1, #view.v3 .v3-progressi-d2 { width: 12px; height: 12px; border-radius: 6px; display: inline-block; box-sizing: border-box; }
    #view.v3 .v3-progressi-d1 { background: var(--v3-t1); } #view.v3 .v3-progressi-d2 { border: 2px solid var(--v3-t1); }
    #view.v3 .v3-progressi-tog { width: 56px; height: 48px; border: 0; background: transparent; padding: 0; flex: none; display: flex; align-items: center; justify-content: center; }
    #view.v3 .v3-progressi-tog i { width: 56px; height: 32px; border-radius: 16px; background: var(--v3-s3); display: block; position: relative; }
    #view.v3 .v3-progressi-tog i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 13px; background: var(--v3-t1); }
    #view.v3 .v3-progressi-tog[aria-pressed="true"] i { background: var(--v3-lime); }
    #view.v3 .v3-progressi-tog[aria-pressed="true"] i::after { left: 27px; background: var(--v3-ink); }
    #view.v3 .v3-progressi-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    #view.v3 .v3-progressi-pair.one { grid-template-columns: minmax(0, 1fr); }
    #view.v3 .v3-progressi-pic { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    #view.v3 .v3-progressi-blur { height: 200px; border-radius: 12px; background: var(--v3-s2); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
    #view.v3 .v3-progressi-blur.on { align-items: flex-end; padding-bottom: 10px; box-sizing: border-box; }
    #view.v3 .v3-progressi-blur img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    #view.v3 .v3-progressi-show { position: relative; min-height: 48px; padding: 0 18px; border-radius: 24px; border: 2px solid var(--v3-lime); background: rgba(0,0,0,.6); color: var(--v3-t1); font-size: 15px; font-weight: 600; }
    #view.v3 .v3-progressi-pdb { min-height: 48px; width: 100%; border-radius: 24px; border: 2px solid var(--v3-lime); background: transparent; color: var(--v3-t1); font-size: 15px; font-weight: 700; padding: 0 8px; white-space: nowrap; }
    #view.v3 .v3-progressi-nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    #view.v3 .v3-progressi-nums > div { background: var(--v3-s2); border-radius: 14px; padding: 12px; min-width: 0; }
    #view.v3 .v3-progressi-nl { font-size: 14px; color: var(--v3-t2); }
    #view.v3 .v3-progressi-nv { font-size: 17px; font-weight: 700; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    #view.v3 .v3-progressi-frame { height: 200px; border-radius: 12px; background: var(--v3-s2); display: flex; align-items: center; justify-content: center; }
    #view.v3 .v3-progressi-frame svg { height: 160px; width: auto; }
    #view.v3 .v3-progressi-up { position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
    #view.v3 .v3-progressi-up input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    #view.v3-o65 .v3-progressi-pl, #view.v3-o65 .v3-progressi-nl, #view.v3-o65 .v3-progressi-show, #view.v3-o65 .v3-progressi-pdb, #view.v3-o65 .v3-progressi-cred { font-size: 16px; }
    .v3-sheet .v3-progressi-shl { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--v3-t2); }
    .v3-sheet .v3-progressi-note { font-size: 16px; font-weight: 700; }`;
    document.head.appendChild(st);
  }

  /* ============================== REGISTRAZIONE ============================== */
  V3.register("progressi", {
    render(el) {
      memo = {};
      if (sub && !allowed().includes(sub)) sub = null;
      el.innerHTML = sub ? innerPage(sub) : mainPage();
    },
    on: {
      open(id) { if (!allowed().includes(id)) return; sub = id; V3.page(() => { sub = null; shown = new Set(); }); },
      sel(i) { sel[sub] = +i; shown = new Set(); V3.refresh(); },
      exlist() { exSheet(); },
      legacy(psub) { S.psub = psub || "carichi"; V3.legacy({ tab: "progressi" }); }, // vista vecchia (grafici di prima, CSV) come pagina interna
      psap(id) { sapSheet(id || "main"); },
      fab() { fabSheet(); },
      medico() { medicoSheet(); },
      hidew() { lsSet(HIDE_KEY, !hidden()); V3.refresh(); },
      showp(id) { shown.add(id); V3.refresh(); },
      hidep(id) { shown.delete(id); V3.refresh(); },
      pickp(side) { photoSheet(side); },
      pose(p) { S.pose = p; } // come photos.js: la posa della prossima foto caricata dal selettore file
    }
  });
})();
