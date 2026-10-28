"use strict";
/* Generic build: profile, targets, plan import, diet log, energy, coach. Loaded before the main script. */

const MEALS = [["col", "Colazione"], ["spu", "Spuntino"], ["pra", "Pranzo"], ["mer", "Merenda"], ["cen", "Cena"]];
const DOW = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const DOW_KEYS = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
const ACCENTS = [["lime", "#c6f24e", "Lime"], ["azzurro", "#5ac8fa", "Azzurro"], ["arancio", "#ff9f0a", "Arancio"], ["rosa", "#ff6482", "Rosa"], ["menta", "#63e6be", "Menta"]];
const GOALS = [["massa", "Aumentare la massa"], ["mantenimento", "Mantenere"], ["definizione", "Perdere grasso"]];
/* Livelli di attività fisica (PAL) dei LARN SINU (tabelle Energia: fabbisogno = metabolismo basale × PAL 1,4 · 1,6 · 1,8 · 2,0),
   http://sinu.it/wp-content/uploads/2025/07/Tabelle-riassuntive_online.pdf. Tappa C 28/10: prima erano 1,4 · 1,55 · 1,7. */
const ACTIVITY = [["bassa", "Poco: seduto quasi tutto il giorno", 1.4], ["media", "Abbastanza: cammino o sto in piedi spesso", 1.6], ["alta", "Molto: lavoro fisico o sport quasi ogni giorno", 1.8], ["moltoalta", "Moltissimo: lavoro pesante e sport intenso", 2.0]];

/* ---------- targets (Mifflin-St Jeor × PAL LARN × fattore obiettivo), allineati a LARN ed EFSA (QUESTIONARIO_PIANO_V2.md §3.3 e §5) ----------
   Proteine: PRI LARN 0,9 g/kg (18-64) e 1,1 g/kg (65+); chi si allena 1,2 (mantenimento) o 1,6 (deficit o massa);
   tetto circa 1,7 g/kg (EFSA 2012: fino a circa 2 volte la PRI è sicuro, https://doi.org/10.2903/j.efsa.2012.2557);
   carboidrati mai sotto il 45% delle calorie (LARN): se servirebbe, le proteine scendono (mai sotto la PRI).
   Over 65: almeno 30 kcal/kg (ESPEN geriatria 2022, https://doi.org/10.1016/j.clnu.2022.01.024), mai deficit automatico.
   Indice di massa corporea sotto 18,5: niente deficit, under = true (il questionario lo usa come arresto e invito al medico, CREA Dir. 1). */
function computeTargets(pr) {
  const w = +pr.peso, h = +pr.altezza, a = +pr.eta, notes = [];
  const bmr = 10 * w + 6.25 * h - 5 * a + (pr.sesso === "f" ? -161 : 5);
  const act = (ACTIVITY.find(x => x[0] === pr.attivita) || ACTIVITY[1])[2];
  let goal = pr.obiettivo, bmi = w / Math.pow(h / 100, 2);
  const o65 = a >= 65, under = bmi < 18.5;
  if (a < 18 && goal !== "mantenimento") { goal = "mantenimento"; notes.push("Sotto i 18 anni l'app non calcola surplus o deficit: per un obiettivo diverso serve un professionista."); }
  if (o65 && goal === "definizione") { goal = "mantenimento"; notes.push("Dopo i 65 anni l'app non propone deficit: per dimagrire serve il medico."); }
  if (goal !== "mantenimento" && under) { goal = "mantenimento"; notes.push("Con un indice di massa corporea sotto 18,5 l'app non propone deficit né surplus: parlane con un medico."); }
  const f = goal === "massa" ? 1.1 : goal === "definizione" ? 0.85 : 1;
  let kcal = Math.round(bmr * act * f / 10) * 10;
  if (o65) kcal = Math.max(kcal, Math.round(30 * w / 10) * 10);
  const train = pr.train != null ? !!pr.train : (typeof DAYS !== "undefined" && DAYS.length > 0);
  const pri = o65 ? 1.1 : 0.9;
  const gkg = Math.min(1.7, a < 18 ? 0.95 : !train ? pri : goal === "mantenimento" ? Math.max(pri, 1.2) : Math.max(pri, 1.6));
  let p = Math.round(w * gkg), fat = Math.round(kcal * 0.25 / 9);
  const pMax = Math.max(Math.round(w * pri), Math.floor((kcal * 0.55 - fat * 9) / 4));
  if (p > pMax) p = pMax;
  const c = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
  return { kcal, p, c, f: fat, bmr: Math.round(bmr), goalApplied: goal, notes, bmi: Math.round(bmi * 10) / 10, under };
}
/* Acqua (L al giorno) LARN per sesso ed età; over 65 ESPEN racc. 5 (bevande almeno 1,6 L donne, 2,0 L uomini). */
function waterLarn(pr) {
  const a = +(pr && pr.eta) || 30, f = pr && pr.sesso === "f";
  return a <= 3 ? 1.2 : a <= 6 ? 1.6 : a <= 10 ? 1.8 : a <= 14 ? (f ? 1.9 : 2.1) : a <= 17 ? (f ? 2.0 : 2.5) : a >= 65 ? (f ? 1.6 : 2.0) : (f ? 2.0 : 2.5);
}
/* Fibra LARN: 12,6-16,7 g ogni 1000 kcal, almeno 25 g al giorno. */
const fiberLarn = kcal => Math.max(25, Math.round((kcal || 2000) * 12.6 / 1000));

/* ---------- plan accessors (S.diet filled by import or by computeTargets). Il piano del dietista non viene mai modificato:
   kcal, proteine, carboidrati, grassi e acqua del piano restano quelli del documento caricato. ---------- */
function planTargets() { const d = S.diet || {}, kcal = d.kcal || 2000; return { kcal, pro: d.p || 100, cho: d.c || 0, fat: d.f || 0, fiber: fiberLarn(kcal), waterL: d.acqua_l || (S.profile ? waterLarn(S.profile) : 2) }; }
const hasMealPlan = () => !!(S.diet && S.diet.giorni && Object.keys(S.diet.giorni).length);
function mealOf(dow, k) { const g = S.diet && S.diet.giorni && S.diet.giorni[dow]; const m = g && g[k]; return m && m.t ? m : null; }
const ZERO = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
function nutOf(dow, k) { const m = mealOf(dow, k); return m ? { kcal: +m.kcal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0 } : ZERO(); }
function supplements() { return ((S.diet && S.diet.integratori) || []).map((x, i) => ({ id: "s" + i, name: x.nome, plan: x.dose || "" })); }

/* ---------- daily log ---------- */
const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localISO(d); };
function normDay(v) { v.meals = v.meals || {}; v.custom = v.custom || {}; v.skip = v.skip || {}; v.extra = v.extra || []; v.sup = v.sup || {}; v.water = v.water || 0;
  if (v.creatina != null) { v.sup.s0 = true; delete v.creatina; } if (v.omega) { v.sup.s1 = true; } delete v.omega; return v; }
function dayLog(iso) { return normDay(S.days[iso] || (S.days[iso] = { meals: {}, water: 0, sup: {}, peso: null, custom: {}, skip: {}, extra: [] })); }
let dayTimers = {};
function saveDay(iso) {
  lsSet("days", S.days);
  if (!S.db) return;
  clearTimeout(dayTimers[iso]);
  dayTimers[iso] = setTimeout(() => S.db.doc(S.base + "/d_" + iso).set({ kind: "day", date: iso, ...JSON.parse(JSON.stringify(S.days[iso])) }).catch(() => syncMsg("Diario salvato solo su questo dispositivo")), 600);
}
function mealState(v, k) { return v.custom[k] ? "custom" : v.skip[k] ? "skip" : v.meals[k] ? "plan" : "open"; }

/* ---------- derived signals ---------- */
function weights() { return Object.entries(S.days).filter(([, v]) => v.peso).map(([d, v]) => ({ date: d, kg: +v.peso })).sort((a, b) => a.date < b.date ? -1 : 1); }
function weightTrend() {
  const w = weights(), t = localISO();
  const win = (a, b) => w.filter(x => x.date > addDays(t, -b) && x.date <= addDays(t, -a));
  const cur = win(0, 7), prev = win(7, 14), avg = arr => arr.reduce((s, x) => s + x.kg, 0) / arr.length;
  if (cur.length < 2 || prev.length < 2) return { cur: cur.length ? avg(cur) : null, n: cur.length, rate: null };
  const a1 = avg(cur), a0 = avg(prev), rate = (a1 - a0) / a0 * 100, g = S.profile && S.profile.obiettivo;
  const [lo, hi] = g === "massa" ? [0.25, 0.5] : g === "definizione" ? [-1, -0.5] : [-0.2, 0.2];
  return { cur: a1, prev: a0, rate, n: cur.length, lo, hi, status: rate < lo ? "sotto" : rate > hi ? "sopra" : "ok" };
}
function fatigueAlert() {
  const f = S.sessions.filter(s => s.fatica != null).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 4);
  if (f.length < 4) return null;
  const span = (new Date(f[0].date) - new Date(f[3].date)) / 864e5;
  return span <= 16 && f.every(s => s.fatica >= 8) ? { avg: f.reduce((a, s) => a + s.fatica, 0) / 4 } : null;
}
function signals() {
  const out = [], wt = weightTrend();
  if (wt.rate != null && wt.status !== "ok") out.push({ k: "Peso", v: `${wt.rate >= 0 ? "+" : ""}${fmt(+wt.rate.toFixed(2))}% a settimana, fuori dal ritmo previsto (${fmt(wt.lo)}% / ${fmt(wt.hi)}%)`, s: "warn" });
  return out;
}

/* ---------- energy ---------- */
const dowOf = iso => new Date(iso + "T12:00:00").getDay();
const addN = (a, b) => ({ kcal: a.kcal + (+b.kcal || 0), p: a.p + (+b.p || 0), c: a.c + (+b.c || 0), f: a.f + (+b.f || 0) });
function intake(iso) {
  const v = dayLog(iso), dow = dowOf(iso), T = planTargets(); let eaten = ZERO(), rest = ZERO(); const restKeys = [];
  for (const [k] of MEALS) { const st = mealState(v, k);
    if (st === "plan") eaten = addN(eaten, nutOf(dow, k));
    else if (st === "custom") eaten = addN(eaten, v.custom[k]);
    else if (st === "open") { rest = addN(rest, nutOf(dow, k)); restKeys.push(k); } }
  for (const x of v.extra) eaten = addN(eaten, x);
  const projected = eaten.kcal + rest.kcal;
  return { eaten, rest, restKeys, projected, gap: T.kcal - projected, pGap: T.pro - (eaten.p + rest.p), logged: MEALS.some(([k]) => mealState(v, k) !== "open") || v.extra.length > 0 };
}
const BOOST = [
  { t: "150 g yogurt greco 0%", kcal: 85, p: 15, prot: true, where: ["spu", "mer"] },
  { t: "100 g albume", kcal: 50, p: 11, prot: true, where: ["col", "cen"] },
  { t: "60 g bresaola o tacchino", kcal: 70, p: 13, prot: true, where: ["mer", "col"] },
  { t: "50 g pasta o riso in più", kcal: 175, p: 6, where: ["pra", "cen"] },
  { t: "100 g pane con 30 g di Parmigiano", kcal: 385, p: 19, where: ["mer", "extra"] },
  { t: "50 g pane in più", kcal: 135, p: 4, where: ["mer", "col", "cen"] },
  { t: "20 g burro di frutta secca", kcal: 120, p: 4, where: ["mer", "spu"] },
  { t: "30 g frutta secca", kcal: 180, p: 6, where: ["spu", "mer"] },
  { t: "10 g olio extravergine in più", kcal: 90, p: 0, where: ["pra", "cen"] },
  { t: "1 frutto in più", kcal: 80, p: 1, where: ["spu", "mer", "col"] }
];
function recovery(kcal, prot, restKeys) {
  const out = []; let left = kcal, pLeft = prot; const used = new Set(), perMeal = {}, slots = restKeys.concat(["extra"]);
  const pick = list => { for (const b of list) { if (used.has(b.t) || left < 60) continue;
      const where = slots.find(k => (b.where.includes(k) || (k === "extra" && b.where.some(w => w === "spu" || w === "mer" || w === "extra"))) && (perMeal[k] || 0) + b.kcal <= 500);
      if (!where) continue; used.add(b.t); perMeal[where] = (perMeal[where] || 0) + b.kcal; left -= b.kcal; pLeft -= b.p; out.push({ ...b, at: where });
      if (out.length >= 5) return; } };
  if (pLeft > 10) pick(BOOST.filter(b => b.prot));
  pick(BOOST.filter(b => !b.prot && b.kcal >= 120));
  pick(BOOST.filter(b => !b.prot && b.kcal < 120));
  return { items: out, covered: kcal - left };
}
function weekBalance() {
  const mon = localISO(mondayOf(new Date())), t = localISO(), T = planTargets(); let diff = 0, days = 0;
  for (let d = mon; d < t; d = addDays(d, 1)) { if (!S.days[d]) continue; const it = intake(d); if (!it.logged) continue; diff += it.eaten.kcal - T.kcal; days++; }
  return { diff, days };
}
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const gramsOf = q => { const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(q || "")); return m ? num(m[1]) : null; };
function scaleItem(it) { if (it.per100 && it.g != null) { const k = it.g / 100; return { ...it, kcal: it.per100.kcal * k, p: it.per100.p * k, c: it.per100.c * k, f: it.per100.f * k }; } return it; }

/* ---------- prompts ---------- */
const NUT_PROMPT = `Stima calorie e macronutrienti di quanto descritto (un pasto o uno spuntino, in italiano). Usa valori medi delle tabelle CREA o USDA per alimenti comuni e per i prodotti di marca citati. Pesi a crudo se non specificato diversamente; se manca una quantità usa una porzione standard e dichiaralo nella nota. Arrotonda kcal all'unità e i grammi a 1 decimale.
Rispondi SOLO con JSON valido:
{"alimenti":[{"nome":"string","quantita":"string","kcal":0,"p":0,"c":0,"f":0}],"note":"una frase sulle assunzioni fatte"}`;
const LABEL_PROMPT = `Nella foto c'è l'etichetta nutrizionale di un prodotto oppure un alimento o un piatto.
Se è un'etichetta: leggi i valori PER 100 g (o 100 ml), il nome del prodotto se visibile e la porzione consigliata se indicata.
Se non c'è un'etichetta: riconosci l'alimento e stima i valori medi per 100 g (tabelle CREA o USDA).
Rispondi SOLO con JSON valido:
{"nome":"string","tipo":"etichetta" | "stima","per100":{"kcal":0,"p":0,"c":0,"f":0},"porzione_g":null,"note":"una frase"}`;
const TRAIN_PROMPT = `Converti la scheda di allenamento che ricevi (testo o foto) in JSON. Non inventare esercizi: riporta solo quelli presenti. Se un dato manca usa questi valori: serie 3, ripetizioni 8-12, recupero 90 secondi (150 per squat, stacchi, panche e trazioni), kg null. "giorno" è il giorno della settimana in italiano se indicato, altrimenti null. "corpo_libero" true per esercizi senza carico esterno (trazioni, addominali, piegamenti). "muscolo" è il gruppo principale in italiano (Petto, Dorso, Quadricipiti, Femorali, Glutei, Spalle, Bicipiti, Tricipiti, Polpacci, Addome).
Rispondi SOLO con JSON valido:
{"sedute":[{"nome":"string","giorno":"mercoledì" | null,"focus":"string","esercizi":[{"nome":"string","nome_inglese":"nome comune in inglese, es. Incline Dumbbell Press","serie":3,"rip_min":8,"rip_max":12,"kg":null,"recupero_s":90,"tecnica":"string","note":"string","corpo_libero":false,"muscolo":"string"}]}]}`;
const DIET_PROMPT = `Converti il piano alimentare che ricevi (testo o foto) in JSON per un'app. Metti ogni pasto in una di queste fasce: colazione, spuntino, pranzo, merenda, cena (se ci sono più spuntini uniscili nella fascia più vicina). Per ogni giorno della settimana scrivi un titolo breve del pasto, l'elenco degli alimenti con le grammature come scritte nel piano e una stima di kcal e macro (tabelle CREA o USDA, pesi a crudo salvo indicazione). Se il piano è uguale tutti i giorni ripetilo per ogni giorno; se un giorno o un pasto non è previsto usa null. Se il piano indica calorie, macro, acqua, integratori o regole, riportali così come sono scritti.
Rispondi SOLO con JSON valido:
{"kcal":null,"p":null,"c":null,"f":null,"acqua_l":null,"integratori":[{"nome":"string","dose":"string"}],"regole":["string"],"giorni":{"lunedi":{"colazione":{"titolo":"string","alimenti":["string"],"kcal":0,"p":0,"c":0,"f":0},"spuntino":null,"pranzo":null,"merenda":null,"cena":null},"martedi":{},"mercoledi":{},"giovedi":{},"venerdi":{},"sabato":{},"domenica":{}}}`;
function genTrainPrompt(pr, days) {
  return `Crea una scheda di allenamento in palestra di base, sicura e basata sull'evidenza (volume di circa 10-20 serie settimanali per muscolo, doppia progressione, RIR 1-3), per: ${pr.sesso === "f" ? "donna" : "uomo"}, ${pr.eta} anni, ${pr.peso} kg, obiettivo «${(GOALS.find(g => g[0] === pr.obiettivo) || GOALS[1])[1]}», ${days} sedute a settimana, livello ${pr.livello || "intermedio"}. Usa esercizi comuni con macchine e pesi liberi, 6-9 esercizi per seduta, nomi in italiano, con una riga di tecnica per esercizio. Distribuisci le sedute in giorni non consecutivi quando possibile.\n\n` + TRAIN_PROMPT.replace("Converti la scheda di allenamento che ricevi (testo o foto) in JSON. Non inventare esercizi: riporta solo quelli presenti. ", "");
}
const ALT_PROMPT = n => `Per l'esercizio da palestra «${n}» proponi 4 alternative che allenino lo stesso muscolo e schema motorio: 2 più facili o più stabili e 2 più difficili. Livello da 1 (molto facile) a 5 (molto tecnico); indica anche il livello dell'esercizio di partenza.
Rispondi SOLO con JSON valido:
{"livello":3,"alternative":[{"nome":"string","attrezzo":"string","livello":2,"motivo":"una riga","cue":"un consiglio tecnico breve"}]}`;

/* ---------- import mapping ---------- */
const DOW_FROM = s => { const k = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); const i = DOW_KEYS.findIndex(d => k.startsWith(d.slice(0, 3))); return i >= 0 ? i : null; };
function mapTraining(out) {
  const sed = (out && Array.isArray(out.sedute) ? out.sedute : []).filter(s => s && Array.isArray(s.esercizi) && s.esercizi.length).slice(0, 7);
  return { sedute: sed.map(s => ({ nome: String(s.nome || ""), dow: DOW_FROM(s.giorno), focus: String(s.focus || ""), esercizi: s.esercizi.slice(0, 14).map(e => { const lo = Math.max(1, Math.round(num(e.rip_min) || 8)), hi = Math.max(lo, Math.round(num(e.rip_max) || lo)); return { nome: String(e.nome || "Esercizio"), en: String(e.nome_inglese || ""), serie: Math.min(8, Math.max(1, Math.round(num(e.serie) || 3))), min: lo, max: hi, kg: e.kg == null || e.kg === "" ? null : num(e.kg), recupero: Math.round(num(e.recupero_s) || 90), tecnica: String(e.tecnica || ""), note: String(e.note || ""), corpo_libero: !!e.corpo_libero, muscolo: String(e.muscolo || "Altro") }; }) })) };
}
function mapDiet(out) {
  const keys = { colazione: "col", spuntino: "spu", pranzo: "pra", merenda: "mer", cena: "cen" }, giorni = {};
  const src = out && out.giorni || {};
  for (const [dk, meals] of Object.entries(src)) { const i = DOW_FROM(dk); if (i == null || !meals) continue; const g = {};
    for (const [mk, m] of Object.entries(meals)) { const k = keys[String(mk).toLowerCase()]; if (!k || !m || !m.titolo) continue;
      g[k] = { t: String(m.titolo), i: (Array.isArray(m.alimenti) ? m.alimenti : []).map(String).slice(0, 12), kcal: Math.round(num(m.kcal)), p: num(m.p), c: num(m.c), f: num(m.f) }; }
    if (Object.keys(g).length) giorni[i] = g; }
  const all = Object.values(giorni), mx = Math.max(0, ...all.map(g => Object.keys(g).length)), days = all.filter(g => Object.keys(g).length === mx);
  const avg = days.length ? days.reduce((a, g) => a + Object.values(g).reduce((s, m) => s + m.kcal, 0), 0) / days.length : 0;
  const avgP = days.length ? days.reduce((a, g) => a + Object.values(g).reduce((s, m) => s + m.p, 0), 0) / days.length : 0;
  return { fonte: "piano", kcal: Math.round(num(out.kcal) || avg) || null, p: Math.round(num(out.p) || avgP) || null, c: Math.round(num(out.c)) || null, f: Math.round(num(out.f)) || null, acqua_l: num(out.acqua_l) || null,
    integratori: (Array.isArray(out.integratori) ? out.integratori : []).filter(x => x && x.nome).map(x => ({ nome: String(x.nome), dose: String(x.dose || "") })).slice(0, 8),
    regole: (Array.isArray(out.regole) ? out.regole : []).map(String).slice(0, 10), giorni };
}

/* ---------- coach ---------- */
function fmtChat(t) {
  const lines = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n+/);
  let html = "", inList = false;
  for (const l of lines) { const m = /^\s*[-•]\s+(.*)/.exec(l);
    if (m) { if (!inList) { html += "<ul class=\"plain\">"; inList = true; } html += `<li>${m[1]}</li>`; }
    else { if (inList) { html += "</ul>"; inList = false; } if (l.trim()) html += `<p>${l}</p>`; } }
  return html + (inList ? "</ul>" : "");
}
const QUICK = ["Fai il punto della settimana", "Cosa mangio prima e dopo la seduta?", "Oggi sono stanco: come adatto la seduta?", "Pranzo fuori casa: come resto in linea?"];
function coachContext() {
  const t = localISO(), pr = S.profile || {}, T = planTargets(), wt = weightTrend(), it = intake(t), wb = weekBalance();
  const sess = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 6).map(s => `- ${localISO(new Date(s.date))} seduta ${s.day}${s.durata ? `, ${s.durata} min` : ""}${s.fatica != null ? `, fatica ${s.fatica}/10` : ""}${s.note ? `, note: ${s.note}` : ""}: ` + s.items.map(e => `${splitName(e.name)[0]} ${e.sets.map(x => x.kg != null ? `${x.kg}x${x.reps}` : x.reps).join("/")}`).join("; ")).join("\n");
  const prog = DAYS.map(d => `${d}${P[d].day ? " (" + P[d].day + ")" : ""}: ` + P[d].items.map(it2 => { const pl = plan(it2); return `${splitName(exName(it2))[0]} ${it2.sets}x${it2.min}-${it2.max}${pl.b.kg != null ? ` @${pl.b.kg}kg` : ""}${pl.b.lastSets ? ` ultime ${pl.b.lastSets.join("/")}` : ""}${pl.up ? " PRONTO A SALIRE" : ""}`; }).join("; ")).join("\n");
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, -i)).map(d => { const v = S.days[d]; if (!v) return `- ${d}: non registrato`; const x = intake(d); return `- ${d}: ${Math.round(x.eaten.kcal)} kcal, ${Math.round(x.eaten.p)} g proteine${v.peso ? `, peso ${v.peso} kg` : ""}`; }).join("\n");
  const goal = (GOALS.find(g => g[0] === pr.obiettivo) || GOALS[1])[1];
  return `DATI DI ${String(pr.nome || "").toUpperCase()} (oggi ${DOW[new Date().getDay()].toLowerCase()} ${t})
Profilo: ${pr.sesso === "f" ? "donna" : "uomo"}, ${pr.eta} anni, ${pr.altezza} cm, ${pr.peso} kg all'inizio, obiettivo: ${goal}, attività quotidiana ${pr.attivita}.
Scheda:
${prog || "nessuna scheda caricata"}
Ultime sedute:
${sess || "- nessuna"}
Alimentazione: ${S.diet && S.diet.creato ? "piano creato dall'app con il questionario, secondo le linee guida OMS" : S.diet && S.diet.fonte === "piano" ? "piano di un professionista caricato nell'app" : "nessun piano, obiettivo calcolato dall'app con la formula Mifflin-St Jeor (stima)"}: ${T.kcal} kcal, proteine ${T.pro} g, acqua ${T.waterL} L.${supplements().length ? " Integratori del piano: " + supplements().map(s => s.name + " " + s.plan).join(", ") + "." : ""}
Oggi: ${Math.round(it.eaten.kcal)} kcal e ${Math.round(it.eaten.p)} g proteine mangiate${hasMealPlan() ? `, pasti del piano ancora da fare ${Math.round(it.rest.kcal)} kcal` : ""}.
Ultimi 7 giorni:
${days}
Peso: ${wt.rate != null ? `media ${wt.cur.toFixed(1)} kg, ${wt.rate.toFixed(2)}% a settimana` : wt.cur ? `media ${wt.cur.toFixed(1)} kg` : "nessuna pesata"}. Bilancio della settimana fino a ieri: ${Math.round(wb.diff)} kcal su ${wb.days} giorni registrati.`;
}
const COACH_RULES = `Sei il coach personale dentro un'app di allenamento e alimentazione: segui la persona su allenamento, alimentazione e recupero usando i suoi dati.
REGOLE:
- Se il piano alimentare viene da un professionista non cambiarlo: aiuta a scegliere tra le alternative del piano, a distribuire i pasti attorno all'allenamento e a gestire i pasti fuori casa. Se l'obiettivo è calcolato dall'app, ricorda che è una stima e che un professionista può fare un piano su misura.
- Calorie: conta la media della settimana. Se mancano calorie proponi recuperi con alimenti comuni e semplici, distribuiti sui pasti che restano e sui giorni successivi, senza superare circa +500 kcal per pasto. Se ha mangiato di più, nessun compenso drastico. Mai digiuni, tagli estremi o compensazioni.
- Integratori: non prescriverli; riporta solo ciò che dice il piano o la ricerca, la decisione è di un professionista.
- Allenamento: segui la scheda e la doppia progressione; suggerisci carichi, ripetizioni, RIR, sostituzioni e scarico (fatica ≥8/10 per due settimane) con i suoi numeri.
- Salute: niente diagnosi. Dolore al petto, palpitazioni, fiato corto anomalo, febbre o dolori articolari: fermarsi e sentire il medico. Se emergono segnali di rapporto difficile con il cibo, rispondi con delicatezza e suggerisci un professionista.
- Tono diretto, concreto, mai giudicante sul corpo. Usa il nome della persona ogni tanto.
- Se un dato manca, dillo e chiedi di registrarlo nell'app invece di inventarlo.
- Rispondi in italiano, breve (massimo 150 parole; per «punto della settimana» massimo 250, in 4 blocchi: allenamento, alimentazione, peso e recupero, 3 azioni per la prossima settimana), senza trattini lunghi. Paragrafi brevi; elenchi con righe che iniziano con "- ". Puoi usare **grassetto** per i numeri chiave.`;
async function askCoach(q) {
  q = (q || "").trim(); if (!q || !S.sample || S.coachBusy) return;
  S.chat.msgs.push({ role: "user", content: q }); S.coachBusy = true; S.coachLive = ""; render();
  const hist = S.chat.msgs.slice(-12).map(m => ({ role: m.role, content: m.content }));
  while (hist.length && hist[0].role !== "user") hist.shift();
  hist[0] = { role: "user", content: COACH_RULES + "\n\n" + coachContext() + "\n\nDOMANDA:\n" + hist[0].content };
  if (hist.length > 1) hist[hist.length - 1] = { role: "user", content: "DATI AGGIORNATI:\n" + coachContext() + "\n\nDOMANDA:\n" + q };
  try {
    const r = await S.sample(hist, { modelTier: "default", cache: false, onText: u => { S.coachLive = u.text; const el = document.getElementById("live"); if (el) el.innerHTML = fmtChat(u.text); } });
    S.chat.msgs.push({ role: "assistant", content: r.text || "Nessuna risposta: riprova." });
  } catch (e) {
    S.chat.msgs.push({ role: "assistant", content: e && e.code === "not_granted" ? "Non ho il permesso di rispondere. Riapri l'app e tocca Consenti." : e && e.code === "rate_limited" ? "Troppe domande ravvicinate: riprova tra qualche minuto." : "Non sono riuscito a rispondere. Riprova tra poco." });
  }
  S.chat.msgs = S.chat.msgs.slice(-40); S.coachBusy = false; S.coachLive = "";
  lsSet("chat", S.chat); if (S.db) S.db.doc(S.base + "/chat").set({ kind: "chat", msgs: S.chat.msgs }).catch(() => {});
  render(); const th = document.getElementById("thread"); if (th && th.lastElementChild) th.lastElementChild.scrollIntoView({ block: "start" });
}

/* ---------- export ---------- */
const csvCell = v => { const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
async function exportCsv(kind) {
  if (!S.downloads) return;
  let rows;
  if (kind === "sedute") {
    rows = [["data", "seduta", "durata_min", "fatica", "esercizio", "serie", "kg", "ripetizioni", "note"]];
    for (const s of S.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1)) for (const e of s.items) e.sets.forEach((x, i) => rows.push([localISO(new Date(s.date)), s.day, s.durata ?? "", s.fatica ?? "", e.name, i + 1, x.kg, x.reps, i === 0 ? (s.note || "") : ""]));
  } else {
    rows = [["data", "peso_kg", "pasti_registrati", "kcal_stimate", "proteine_g", "acqua_l"]];
    for (const [d, v] of Object.entries(S.days).sort()) { normDay(v); const it = intake(d); rows.push([d, v.peso ? +v.peso : "", MEALS.filter(([k]) => ["plan", "custom"].includes(mealState(v, k))).length + v.extra.length, Math.round(it.eaten.kcal), Math.round(it.eaten.p), v.water * 0.25]); }
  }
  try { await S.downloads.save({ filename: `${kind === "sedute" ? "storico-allenamenti" : "diario-peso-dieta"}-${localISO()}.csv`, data: "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\n") }); }
  catch (e) { if (e && e.code !== "declined") toast("Esportazione non disponibile qui"); }
}

/* ---------- documents and offline reading ---------- */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfReady = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("script")); document.head.appendChild(s); }); }
function loadPdf() {
  // the worker script runs on the main thread ("fake worker"), so no cross-origin Worker is needed
  return pdfReady || (pdfReady = loadScript(PDFJS + "pdf.worker.min.js").then(() => loadScript(PDFJS + "pdf.min.js")).then(() => window.pdfjsLib));
}
async function readDoc(file, maxImages = 4) {
  const name = (file.name || "").toLowerCase();
  let type = file.type || "";
  // some Android pickers (Drive, file managers) give no MIME type and no extension: sniff the first bytes
  if (!type && !/\.(txt|md|csv|pdf)$/.test(name)) type = new TextDecoder().decode(await file.slice(0, 4).arrayBuffer()) === "%PDF" ? "application/pdf" : "image/jpeg";
  if (type.startsWith("text/") || /\.(txt|md|csv)$/.test(name)) return { text: (await file.text()).slice(0, 30000), images: [] };
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const lib = await loadPdf(), pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) { const pg = await pdf.getPage(i), tc = await pg.getTextContent();
      let line = "", lastY = null; for (const it of tc.items) { const y = it.transform[5]; if (lastY != null && Math.abs(y - lastY) > 3) { text += line.trim() + "\n"; line = ""; } line += it.str + " "; lastY = y; } text += line.trim() + "\n\n"; }
    if (text.replace(/\s/g, "").length > 30) return { text: text.slice(0, 30000), images: [] };
    const images = [];
    for (let i = 1; i <= Math.min(pdf.numPages, maxImages); i++) { const pg = await pdf.getPage(i), vp = pg.getViewport({ scale: 1.6 }), c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; images.push(await new Promise(r => c.toBlob(r, "image/jpeg", 0.85))); }
    return { text: "", images };
  }
  if (type.startsWith("image/")) return { text: "", images: [await shrink(file)] };
  throw new Error("formato");
}
const dowIn = s => { const k = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); const i = DOW_KEYS.findIndex(d => k.includes(d.slice(0, 5)) || new RegExp("\\b" + d.slice(0, 3) + "\\b").test(k)); return i >= 0 ? i : null; };
// Offline reader for lines like "Panca piana 3x8-10 60 kg" grouped under session titles.
function parseTrainingText(t) {
  const sedute = []; let cur = null;
  const ex = /^[-•*\d.)\s]*(.+?)[\s:,–-]+(\d{1,2})\s*(?:x|×|serie\s*(?:da|x)?)\s*(\d{1,2})(?:\s*(?:-|–|\/|a)\s*(\d{1,2}))?\s*(?:rip\w*)?(.*)$/i;
  for (const raw of String(t).split(/\n/)) { const l = raw.trim(); if (!l) continue; const m = ex.exec(l);
    if (m && /[a-zà-ú]{2}/i.test(m[1])) {
      if (!cur) { cur = { nome: "Seduta " + String.fromCharCode(65 + sedute.length), dow: null, focus: "", esercizi: [] }; sedute.push(cur); }
      const rest = m[5] || "", kg = /(\d+(?:[.,]\d+)?)\s*kg/i.exec(rest), rec = /(\d+)\s*(?:"|″|s\b|sec)/i.exec(rest), lo = +m[3], hi = Math.max(lo, +(m[4] || m[3]));
      cur.esercizi.push({ nome: m[1].trim().replace(/[\s:–-]+$/, ""), serie: Math.min(8, +m[2]), min: lo, max: hi, kg: kg ? num(kg[1]) : null, recupero: rec ? +rec[1] : 90, tecnica: "", note: "", corpo_libero: /trazion|pull.?up|addominal|crunch|plank|piegament|push.?up|dip/i.test(m[1]), muscolo: "Altro" });
    } else if (l.length <= 60 && (/\b(seduta|giorno|allenamento|workout|day|scheda|push|pull|legs|gambe|upper|lower|full\s*body)\b/i.test(l) || /^[A-F]\s*[:\-–)]?\s*$/i.test(l) || /^(seduta|giorno)?\s*[A-F1-7]\b/i.test(l) || dowIn(l) != null)) { cur = { nome: l.replace(/[:\-–]+$/, "").trim(), dow: dowIn(l), focus: "", esercizi: [] }; sedute.push(cur); }
  }
  return { sedute: sedute.filter(s => s.esercizi.length).slice(0, 7) };
}
