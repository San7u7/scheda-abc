"use strict";
/* Diet plan, daily log, weight, coach. Loaded before the main script; everything here runs only when called. */

const ACCENTS = [["lime", "#c6f24e", "Lime"], ["azzurro", "#5ac8fa", "Azzurro"], ["arancio", "#ff9f0a", "Arancio"], ["rosa", "#ff6482", "Rosa"], ["menta", "#63e6be", "Menta"]];
const ACTIVITY = [["bassa", "Lavoro seduto, poco movimento", 1.4], ["media", "Un po' di movimento ogni giorno", 1.55], ["alta", "Lavoro attivo o molto sport", 1.7]];

/* ---------- the diet plan (dietista, REV5 del 05/02/2026) ---------- */
const PLAN = {
  rev: "REV5 del 05/02/2026", kcal: 3400, cho: 480, pro: 165, fat: 85, fiber: 35, oil: 40, waterL: 2.5,
  lastCheck: { date: "2026-01-30", kg: 78.9, bf: 12.0 }, nextCheck: "2026-04-30",
  supplements: [
    { id: "creatina", name: "Creatina monoidrato", plan: "5 g dopo colazione (Creapure)", unit: "g", dflt: 3 },
    { id: "omega", name: "Omega 3", plan: "3 perle dopo colazione (o dopo cena nei giorni senza pesce)" }
  ],
  rules: ["Pesi degli alimenti sempre a crudo.", "Olio EVO 40 g al giorno, quasi tutto a crudo: meno olio se la proteina è grassa (uova, formaggi, pesce grasso).", "Alcol da evitare, bevande zuccherate da limitare.", "Cena libera il sabato, spostabile in un altro giorno, gestita senza eccessi."]
};
const SPUNTINO = { t: "Frutta, yogurt e frutta secca", i: ["1 porzione di frutta fresca di stagione", "150 g yogurt greco 0% bianco", "15 g frutta secca (circa 10 mandorle, 15 nocciole o 3 noci)"] };
const MERENDA = { t: "Frutta, pane e burro di frutta secca", i: ["1 porzione di frutta fresca", "100 g pane (o 70 g fette biscottate, gallette o crackers di riso)", "20 g burro di frutta secca al naturale, oppure 30 g Parmigiano o Grana"] };
const COL = {
  fagioli: { t: "Pane con fagioli, sgombro e vegetali", i: ["100 g pane", "200 g fagioli o ceci in vetro, sciacquati (70 g se secchi)", "50 g filetti di sgombro o tonno sott'olio, sgocciolati", "10 g olio EVO (o 40 g avocado)", "Vegetali cotti o crudi, erbe aromatiche"] },
  uova: { t: "Pane e uova", i: ["150 g pane", "2 uova intere + 100 g albume", "Vegetali cotti o crudi, erbe aromatiche"] },
  affettato: { t: "Pane con affettato e formaggio magro", i: ["150 g pane", "50 g affettato magro (cotto, crudo sgrassato, bresaola)", "50 g formaggio spalmabile proteico", "5 g olio EVO (o 20 g avocado)", "Vegetali cotti o crudi"] },
  scelta: { t: "Una colazione a scelta tra le altre", i: ["Pane con fagioli e sgombro, pane e uova, oppure pane con affettato e formaggio magro"] }
};
const CENA_BASE = ["100 g riso o cereali", "450 g patate (o 150 g pane)", "Verdura e/o insalata"];
// index = Date.getDay(): 0 domenica … 6 sabato
const MENU = [
  { col: COL.scelta, pra: { t: "Primo piatto a piacere", i: ["Completo, in linea con gli altri pranzi per alimenti e quantità"] }, cen: { t: "Secondo piatto a piacere", i: ["Completo, in linea con le altre cene per alimenti e quantità"] } },
  { col: COL.fagioli, pra: { t: "Pasta, riso o cereali con pollo e vegetali", i: ["200 g pasta, riso o cereali in chicco", "120 g carne bianca magra (pollo o tacchino)", "Vegetali cotti o crudi", "15 g olio EVO + 10 g Parmigiano (piatto unico: 20 g olio)"] }, cen: { t: "Uova con riso, patate e vegetali", i: ["2 uova intere + 100 g albume"].concat(CENA_BASE, ["10 g olio EVO"]) } },
  { col: COL.uova, pra: { t: "Pasta, riso o cereali con legumi e vegetali", i: ["150 g pasta, riso o cereali", "80 g legumi secchi (240 g se pesati cotti)", "Vegetali cotti o crudi", "20 g olio EVO"] }, cen: { t: "Pesce con riso, patate e vegetali", i: ["200 g orata o spigola"].concat(CENA_BASE, ["15–20 g olio EVO"]) } },
  { col: COL.affettato, pra: { t: "Pasta, riso o cereali con pesce e vegetali", i: ["200 g pasta, riso o cereali", "150 g pesce fresco o surgelato (o 100 g sgombro o tonno sott'olio)", "Vegetali cotti o crudi", "Olio EVO: 5–20 g secondo il pesce"] }, cen: { t: "Tofu con riso, patate e vegetali", i: ["180 g tofu (o 120 g seitan)"].concat(CENA_BASE, ["5–15 g olio EVO"]) } },
  { col: COL.uova, pra: { t: "Pasta mista con pesto e vegetali", i: ["120 g pasta di legumi + 120 g pasta di semola", "Vegetali cotti o crudi", "Olio EVO e/o Parmigiano, oppure 35 g pesto all'olio EVO"] }, cen: { t: "Carne con riso, patate e vegetali", i: ["150 g carne magra, bianca o rossa"].concat(CENA_BASE, ["10–15 g olio EVO"]) } },
  { col: COL.fagioli, pra: { t: "Pasta, riso o gnocchi con mozzarella e vegetali", i: ["200 g pasta, riso o cereali (oppure 420 g gnocchi)", "100 g mozzarella proteica", "Vegetali cotti o crudi", "10 g olio EVO"] }, cen: { t: "Pesce con riso, patate e vegetali", i: ["200 g merluzzo"].concat(CENA_BASE, ["20 g olio EVO"]) } },
  { col: COL.scelta, pra: { t: "Primo piatto a piacere", i: ["Completo, in linea con gli altri pranzi per alimenti e quantità"] }, cen: { t: "Cena a piacere", i: ["Pasto libero gestito con equilibrio e senza eccessi", "Si può spostare in un altro giorno della settimana"] } }
];
const MEALS = [["col", "Colazione"], ["spu", "Spuntino"], ["pra", "Pranzo"], ["mer", "Merenda"], ["cen", "Cena"]];
const DOW = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const mealOf = (dow, k) => k === "spu" ? SPUNTINO : k === "mer" ? MERENDA : MENU[dow][k];

/* ---------- daily log ---------- */
const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localISO(d); };
function dayLog(iso) { return normDay(S.days[iso] || (S.days[iso] = { meals: {}, water: 0, creatina: null, omega: false, peso: null, custom: {}, skip: {}, extra: [] })); }
let dayTimers = {};
function saveDay(iso) {
  lsSet("days", S.days);
  if (!S.db) return;
  clearTimeout(dayTimers[iso]);
  dayTimers[iso] = setTimeout(() => S.db.doc(S.base + "/d_" + iso).set({ kind: "day", date: iso, ...JSON.parse(JSON.stringify(S.days[iso])) }).catch(() => syncMsg("Diario salvato solo su questo dispositivo")), 600);
}

/* ---------- derived signals ---------- */
function weights() { return Object.entries(S.days).filter(([, v]) => v.peso).map(([d, v]) => ({ date: d, kg: +v.peso })).sort((a, b) => a.date < b.date ? -1 : 1); }
function weightTrend() {
  const w = weights(), t = localISO();
  const win = (a, b) => w.filter(x => x.date > addDays(t, -b) && x.date <= addDays(t, -a));
  const cur = win(0, 7), prev = win(7, 14), avg = arr => arr.reduce((s, x) => s + x.kg, 0) / arr.length;
  if (cur.length < 2 || prev.length < 2) return { cur: cur.length ? avg(cur) : null, n: cur.length, rate: null };
  const a1 = avg(cur), a0 = avg(prev), rate = (a1 - a0) / a0 * 100;
  return { cur: a1, prev: a0, rate, n: cur.length, status: rate < 0.25 ? "sotto" : rate > 0.5 ? "sopra" : "ok" };
}
function adherence(days = 7) {
  const t = localISO(); let meals = 0, water = 0, cre = 0, logged = 0;
  for (let i = 0; i < days; i++) { const v = S.days[addDays(t, -i)]; if (!v) continue; logged++;
    meals += MEALS.filter(([k]) => v.meals[k] || (v.custom && v.custom[k])).length; water += v.water; if (v.creatina) cre++; }
  return { meals, of: days * 5, water: water * 0.25 / days, cre, days, logged };
}
function fatigueAlert() {
  const f = S.sessions.filter(s => s.fatica != null).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 4);
  if (f.length < 4) return null;
  const span = (new Date(f[0].date) - new Date(f[3].date)) / 864e5;
  return span <= 16 && f.every(s => s.fatica >= 8) ? { avg: f.reduce((a, s) => a + s.fatica, 0) / 4 } : null;
}
function signals() {
  const out = [], wk = Object.keys(weekDone()).length, ups = ALL.filter(it => plan(it).up).length;
  out.push({ k: "Allenamento", v: `${wk} di 3 sedute questa settimana`, s: wk >= 3 ? "ok" : "neutral" });
  out.push({ k: "Progressione", v: ups ? `${ups} esercizi pronti a salire di carico` : "Nessun range chiuso: punta a +1 ripetizione", s: ups ? "ok" : "neutral" });
  const fa = fatigueAlert(), lastF = S.sessions.filter(s => s.fatica != null).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  out.push(fa ? { k: "Fatica", v: `Media ${fmt(fa.avg)}/10 nelle ultime 4 sedute: fai una settimana di scarico`, s: "warn" } : { k: "Fatica", v: lastF ? `Ultima seduta ${lastF.fatica}/10` : "Segnala la fatica a fine seduta", s: "neutral" });
  const wt = weightTrend();
  out.push(wt.rate == null ? { k: "Peso", v: wt.cur ? `Media ${fmt(+wt.cur.toFixed(1))} kg: servono 2 pesate per settimana per il ritmo` : "Pesati 2–3 volte a settimana al mattino", s: "neutral" }
    : { k: "Peso", v: `${wt.rate >= 0 ? "+" : ""}${fmt(+wt.rate.toFixed(2))}% a settimana (obiettivo 0,25–0,5%)`, s: wt.status === "ok" ? "ok" : "warn" });
  const ad = adherence();
  out.push({ k: "Dieta", v: ad.logged ? `${ad.meals} pasti segnati su ${ad.of} negli ultimi 7 giorni` : "Segna i pasti nella scheda Dieta", s: ad.logged && ad.meals / ad.of >= 0.8 ? "ok" : "neutral" });
  out.push({ k: "Integratori", v: `Creatina segnata ${ad.cre} giorni su 7 (piano: 5 g, tu: ${S.state.creatinaG || 3} g)`, s: ad.cre >= 6 ? "ok" : "neutral" });
  return out;
}

function fmtChat(t) {
  const lines = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n+/);
  let html = "", inList = false;
  for (const l of lines) { const m = /^\s*[-•]\s+(.*)/.exec(l);
    if (m) { if (!inList) { html += "<ul class=\"plain\">"; inList = true; } html += `<li>${m[1]}</li>`; }
    else { if (inList) { html += "</ul>"; inList = false; } if (l.trim()) html += `<p>${l}</p>`; } }
  return html + (inList ? "</ul>" : "");
}
const QUICK = ["Fai il punto della settimana", "Cosa mangio prima e dopo la seduta?", "Oggi sono stanco: come adatto la seduta?", "Pranzo fuori casa: come resto in linea col piano?"];

/* ---------- coach brain ---------- */
function coachContext() {
  const t = localISO(), wt = weightTrend(), ad = adherence();
  const sess = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 6).map(s => `- ${s.date.slice(0, 10)} seduta ${s.day}${s.durata ? `, ${s.durata} min` : ""}${s.fatica != null ? `, fatica ${s.fatica}/10` : ""}${s.note ? `, note: ${s.note}` : ""}: ` + s.items.map(e => `${splitName(e.name)[0]} ${e.sets.map(x => x.kg != null ? `${x.kg}x${x.reps}` : x.reps).join("/")}`).join("; ")).join("\n");
  const prog = DAYS.map(d => `${d} (${P[d].day}): ` + P[d].items.map(it => { const pl = plan(it); return `${splitName(exName(it))[0]} ${it.sets}x${it.min}-${it.max}${pl.b.kg != null ? ` @${pl.b.kg}${it.unit && it.unit !== "none" ? it.unit : "kg"}` : ""}${pl.b.lastSets ? ` ultime ${pl.b.lastSets.join("/")}` : ""}${pl.up ? " PRONTO A SALIRE" : ""}`; }).join("; ")).join("\n");
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, -i)).map(d => { const v = S.days[d]; return v ? `- ${d}: pasti ${MEALS.filter(([k]) => v.meals[k] || (v.custom && v.custom[k])).map(([, l]) => l).join(", ") || "nessuno segnato"}; kcal stimate ${Math.round(intake(d).eaten.kcal)}; acqua ${fmt(v.water * 0.25)} L; creatina ${v.creatina ? v.creatina + " g" : "no"}; omega3 ${v.omega ? "sì" : "no"}${v.peso ? `; peso ${v.peso} kg` : ""}` : `- ${d}: non registrato`; }).join("\n");
  return `DATI DI GIOVANNI (oggi ${DOW[new Date().getDay()].toLowerCase()} ${t})
Profilo: ${S.profile ? `${S.profile.sesso === "f" ? "donna" : "uomo"}, ${S.profile.eta} anni, ${S.profile.altezza} cm, ${S.profile.peso} kg al primo accesso, attività quotidiana ${S.profile.attivita}, fase ${S.profile.obiettivo}` : "uomo, circa 33 anni, fase di massa"}, livello intermedio. Ultimo controllo dal dietista ${PLAN.lastCheck.date}: ${PLAN.lastCheck.kg} kg, massa grassa ${PLAN.lastCheck.bf}% (bioimpedenza). Dopo quel controllo ha fatto una fase di definizione; ora è tornato in massa con questo stesso piano, in accordo con il dietista: il piano è valido e confermato.
Allenamento: 3 sedute a settimana in palestra, niente calcetto (A mercoledì, B venerdì, C domenica, ordine A→B→C se cambia i giorni). RIR 1-2 sui multiarticolari, doppia progressione. Con 3 sedute settimanali queste calorie hanno già funzionato in passato.
Scheda attuale:
${prog}
Ultime sedute:
${sess || "- nessuna seduta registrata nell'app"}
Piano alimentare ${PLAN.rev}: ${PLAN.kcal} kcal medie, CHO ${PLAN.cho} g, proteine ${PLAN.pro} g (2 g/kg), grassi ${PLAN.fat} g, fibra ${PLAN.fiber} g, olio EVO ${PLAN.oil} g, acqua ${PLAN.waterL} L. Cinque pasti: colazione, spuntino (frutta, yogurt greco, frutta secca), pranzo, merenda (frutta, pane, burro di frutta secca o grana), cena (proteina + 100 g riso + 450 g patate + verdura). Cena libera il sabato. Alcol da evitare.
Menù di oggi: colazione ${MENU[new Date().getDay()].col.t}; pranzo ${MENU[new Date().getDay()].pra.t}; cena ${MENU[new Date().getDay()].cen.t}.
Integratori: piano = creatina 5 g/die dopo colazione + omega 3 (3 perle). Lui prende ${S.state.creatinaG || 3} g di creatina.
Diario ultimi 7 giorni:
${days}
Peso: ${wt.rate != null ? `media settimana ${wt.cur.toFixed(1)} kg, ${wt.rate.toFixed(2)}% sulla settimana prima (obiettivo +0,25-0,5%/settimana)` : wt.cur ? `media ${wt.cur.toFixed(1)} kg, dati insufficienti per il ritmo` : "nessuna pesata registrata"}.
Aderenza: ${ad.meals}/${ad.of} pasti segnati in 7 giorni.
Calorie oggi (stime): mangiate ${Math.round(intake(t).eaten.kcal)} kcal e ${Math.round(intake(t).eaten.p)} g proteine; pasti del piano ancora da fare: ${intake(t).restKeys.map(k => MEALS.find(m => m[0] === k)[1]).join(', ') || 'nessuno'} (${Math.round(intake(t).rest.kcal)} kcal); a fine giornata seguendo il piano: ${Math.round(intake(t).projected)} kcal su ${PLAN.kcal}. Pasti variati oggi: ${Object.entries(dayLog(t).custom).map(([k, x]) => `${k}: ${x.text} (${Math.round(x.kcal)} kcal)`).join('; ') || 'nessuno'}. Bilancio settimana fino a ieri: ${Math.round(weekBalance().diff)} kcal su ${weekBalance().days} giorni registrati.`;
}
const COACH_RULES = `Sei il coach personale di Giovanni dentro la sua app di allenamento: lo segui su allenamento, alimentazione e recupero usando i suoi dati.
REGOLE:
- La dieta è del suo dietista: non cambiare calorie, grammature, macro o integratori e non proporre tagli o digiuni. Puoi aiutarlo a scegliere tra le alternative del piano, distribuire i pasti attorno all'allenamento, gestire pasti fuori casa restando in linea col piano, leggere l'aderenza. Per cambiare il piano rimanda al dietista.
- Calorie: conta la media della settimana. Se mancano calorie, proponi recuperi con alimenti già presenti nel piano (porzioni un po' più grandi di pasta, riso, pane, olio, frutta secca, yogurt greco, albume), distribuiti sui pasti che restano e sui giorni successivi, senza superare circa +500 kcal per pasto. Se ha mangiato di più, nessun compenso drastico: si torna al piano dal pasto successivo. Le calorie sono stime.
- Integratori: puoi far notare differenze tra il piano e quello che prende (es. creatina 3 g contro 5 g) e dire cosa dice la ricerca, ma la decisione è del dietista.
- Allenamento: segui la scheda e la doppia progressione; suggerisci carichi, ripetizioni, RIR, sostituzioni dalla scheda e scarico (fatica ≥8/10 per due settimane) con i suoi numeri.
- Salute: niente diagnosi. Dolore al petto, palpitazioni, fiato corto anomalo, febbre o dolori articolari: fermarsi e sentire il medico.
- Tono diretto, concreto, mai giudicante sul corpo. Niente consigli restrittivi.
- Se un dato manca, dillo e chiedi di registrarlo nell'app invece di inventarlo.
- Rispondi in italiano, breve (massimo 150 parole salvo «punto della settimana», massimo 250), senza trattini lunghi. Paragrafi brevi; per gli elenchi righe che iniziano con "- ". Puoi usare **grassetto** per i numeri chiave.
- «Fai il punto della settimana» = sintesi in 4 blocchi: allenamento, alimentazione, peso e recupero, 3 azioni per la prossima settimana.`;

async function askCoach(q) {
  q = (q || "").trim(); if (!q || !S.sample || S.coachBusy) return;
  S.chat.msgs.push({ role: "user", content: q }); S.coachBusy = true; S.coachLive = ""; render();
  const hist = S.chat.msgs.slice(-12).map(m => ({ role: m.role, content: m.content }));
  hist[0] = { role: "user", content: COACH_RULES + "\n\n" + coachContext() + "\n\nDOMANDA:\n" + hist[0].content };
  if (hist.length > 1) hist[hist.length - 1] = { role: "user", content: "DATI AGGIORNATI:\n" + coachContext() + "\n\nDOMANDA:\n" + q };
  try {
    const r = await S.sample(hist, { modelTier: "default", cache: false, onText: u => { S.coachLive = u.text; const el = document.getElementById("live"); if (el) el.innerHTML = fmtChat(u.text); } });
    S.chat.msgs.push({ role: "assistant", content: r.text || "Nessuna risposta: riprova." });
  } catch (e) {
    S.chat.msgs.push({ role: "assistant", content: e && e.code === "not_granted" ? "Serve il permesso per far rispondere Claude: riapri la scheda e consenti l'accesso." : e && e.code === "rate_limited" ? "Troppe domande ravvicinate: riprova tra qualche minuto." : "Non sono riuscito a rispondere. Riprova tra poco." });
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
    for (const s of S.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1)) for (const e of s.items) e.sets.forEach((x, i) => rows.push([s.date.slice(0, 10), s.day, s.durata ?? "", s.fatica ?? "", e.name, i + 1, x.kg, x.reps, i === 0 ? (s.note || "") : ""]));
  } else {
    rows = [["data", "peso_kg", "pasti_su_5", "kcal_stimate", "proteine_g", "acqua_l", "creatina_g", "omega3"]];
    for (const [d, v] of Object.entries(S.days).sort()) { normDay(v); const it = intake(d); rows.push([d, v.peso ? +v.peso : "", MEALS.filter(([k]) => mealState(v, k) === "plan" || mealState(v, k) === "custom").length, Math.round(it.eaten.kcal), Math.round(it.eaten.p), v.water * 0.25, v.creatina ?? "", v.omega ? "sì" : "no"]); }
  }
  try { await S.downloads.save({ filename: `${kind === "sedute" ? "storico-allenamenti" : "diario-peso-dieta"}-${localISO()}.csv`, data: "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\n") }); }
  catch (e) { if (e && e.code !== "declined") toast("Esportazione non disponibile qui"); }
}


/* ---------- energy: plan estimates, intake, recovery ---------- */
// Estimated [kcal, protein, carbs, fat] per plan meal (raw weights from REV5, CREA/USDA averages). Weekdays sum to ~3400.
const N_SPU = [255, 19, 27, 8], N_MER = [465, 14, 72, 11];
const N_COL = { fagioli: [655, 31, 78, 19], uova: [610, 36, 78, 12], affettato: [595, 32, 78, 11], scelta: [625, 33, 78, 14] };
const NUT = [ // index = getDay()
  { col: N_COL.scelta, pra: [1015, 49, 151, 21], cen: [1065, 48, 161, 24] },
  { col: N_COL.fagioli, pra: [1055, 58, 150, 24], cen: [1015, 40, 161, 22] },
  { col: N_COL.uova, pra: [1020, 39, 155, 24], cen: [1125, 57, 160, 29] },
  { col: N_COL.affettato, pra: [990, 54, 150, 17], cen: [1085, 42, 164, 27] },
  { col: N_COL.uova, pra: [1065, 47, 152, 25], cen: [1015, 50, 160, 18] },
  { col: N_COL.fagioli, pra: [950, 47, 150, 15], cen: [1080, 53, 160, 23] },
  { col: N_COL.scelta, pra: [1015, 49, 151, 21], cen: [1100, 45, 150, 30] }
];
const nutOf = (dow, k) => { const a = k === "spu" ? N_SPU : k === "mer" ? N_MER : NUT[dow][k]; return { kcal: a[0], p: a[1], c: a[2], f: a[3] }; };
const dowOf = iso => new Date(iso + "T12:00:00").getDay();
const ZERO = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
const addN = (a, b) => ({ kcal: a.kcal + (+b.kcal || 0), p: a.p + (+b.p || 0), c: a.c + (+b.c || 0), f: a.f + (+b.f || 0) });
function normDay(v) { v.meals = v.meals || {}; v.custom = v.custom || {}; v.skip = v.skip || {}; v.extra = v.extra || []; return v; }
function mealState(v, k) { return v.custom[k] ? "custom" : v.skip[k] ? "skip" : v.meals[k] ? "plan" : "open"; }
function intake(iso) {
  const v = normDay(dayLog(iso)), dow = dowOf(iso); let eaten = ZERO(), rest = ZERO(); const restKeys = [];
  for (const [k] of MEALS) { const st = mealState(v, k);
    if (st === "plan") eaten = addN(eaten, nutOf(dow, k));
    else if (st === "custom") eaten = addN(eaten, v.custom[k]);
    else if (st === "open") { rest = addN(rest, nutOf(dow, k)); restKeys.push(k); } }
  for (const x of v.extra) eaten = addN(eaten, x);
  const target = { kcal: PLAN.kcal, p: PLAN.pro };
  return { eaten, rest, restKeys, target, projected: eaten.kcal + rest.kcal, gap: PLAN.kcal - (eaten.kcal + rest.kcal), pGap: PLAN.pro - (eaten.p + rest.p), logged: MEALS.some(([k]) => mealState(v, k) !== "open") || v.extra.length > 0 };
}
// Additions drawn only from foods already in the dietitian's plan.
const BOOST = [
  { t: "150 g yogurt greco 0%", kcal: 85, p: 15, prot: true, where: ["spu", "mer"] },
  { t: "100 g albume", kcal: 50, p: 11, prot: true, where: ["col", "cen"] },
  { t: "60 g bresaola o tacchino", kcal: 70, p: 13, prot: true, where: ["mer", "col"] },
  { t: "50 g pasta o riso in più", kcal: 175, p: 6, where: ["pra", "cen"] },
  { t: "100 g pane con 30 g di Parmigiano", kcal: 385, p: 19, where: ["mer", "extra"] },
  { t: "50 g pane in più", kcal: 135, p: 4, where: ["mer", "col", "cen"] },
  { t: "20 g burro di frutta secca", kcal: 120, p: 4, where: ["mer", "spu"] },
  { t: "30 g frutta secca", kcal: 180, p: 6, where: ["spu", "mer"] },
  { t: "10 g olio EVO in più", kcal: 90, p: 0, where: ["pra", "cen"] },
  { t: "1 frutto in più", kcal: 80, p: 1, where: ["spu", "mer", "col"] }
];
function recovery(kcal, prot, restKeys) {
  const out = []; let left = kcal, pLeft = prot; const used = new Set(), perMeal = {};
  const slots = restKeys.concat(["extra"]);
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
  const mon = localISO(mondayOf(new Date())), t = localISO(); let diff = 0, days = 0;
  for (let d = mon; d < t; d = addDays(d, 1)) { const x = S.days[d]; if (!x) continue; const it = intake(d); if (!it.logged) continue; diff += it.eaten.kcal - PLAN.kcal; days++; }
  return { diff, days };
}
const NUT_PROMPT = `Stima calorie e macronutrienti di quanto descritto (un pasto o uno spuntino, in italiano). Usa valori medi delle tabelle CREA o USDA per alimenti italiani comuni e per i prodotti di marca citati. Pesi a crudo se non specificato diversamente; se manca una quantità usa una porzione standard italiana e dichiaralo nella nota. Arrotonda kcal all'unità e i grammi a 1 decimale.
Rispondi SOLO con JSON valido:
{"alimenti":[{"nome":"string","quantita":"string","kcal":0,"p":0,"c":0,"f":0}],"note":"una frase sulle assunzioni fatte"}`;

const LABEL_PROMPT = `Nella foto c'è l'etichetta nutrizionale di un prodotto oppure un alimento o un piatto.
Se è un'etichetta: leggi i valori PER 100 g (o 100 ml), il nome del prodotto se visibile e la porzione consigliata se indicata.
Se non c'è un'etichetta: riconosci l'alimento e stima i valori medi per 100 g (tabelle CREA o USDA).
Rispondi SOLO con JSON valido:
{"nome":"string","tipo":"etichetta" | "stima","per100":{"kcal":0,"p":0,"c":0,"f":0},"porzione_g":null,"note":"una frase"}`;
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const gramsOf = q => { const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(q || "")); return m ? num(m[1]) : null; };
function scaleItem(it) { if (it.per100 && it.g != null) { const k = it.g / 100; return { ...it, kcal: it.per100.kcal * k, p: it.per100.p * k, c: it.per100.c * k, f: it.per100.f * k }; } return it; }
