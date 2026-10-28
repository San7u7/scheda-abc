"use strict";
/* Askesis v3 · sezione «Cibo» (FASE 2). Regole e API: V3_CONTRATTO.md. Design: askesis-ux/prototipo_alimentazione_v5.html.
   Principio: l'educazione alimentare è lo scopo, segnare i pasti è lo strumento. Ogni spunta insegna qualcosa.
   Scritture SOLO con le strutture e le funzioni esistenti: dayLog + saveDay (stessi campi meals/custom/skip del pulsante vecchio «meal»),
   e i pulsanti vecchi data-act="mealalt" / "mealskip" / "delextra" / "redo" per il resto. Stato interno (pagina aperta, scheda, domanda) solo in memoria. */
(function () {
  if (!window.V3) return;
  const { ui, data } = V3;
  const e = ui.esc, nf = ui.nf;

  /* ---------- stato interno (mai in S) ---------- */
  const subs = [];                 // pila delle pagine interne: { p, k, … }
  let ci = null, ciDay = null;     // pasto al centro del carosello
  let pianoDow = null, numPer = 0;
  /* Pagine interne annidate: una voce di history per pagina, indietro (di sistema o «‹ Indietro») torna alla precedente.
     replace() sostituisce la pagina in cima senza nuova voce (es. «pasto» → «segnato»). */
  const top = () => subs[0] || null;
  function open(o) { subs.unshift(o); V3.page(() => { subs.shift(); }); }
  function replace(o) { if (!subs.length) return open(o); subs[0] = o; window.scrollTo(0, 0); V3.refresh(); }
  /* «Secondo te?»: risposta del giorno su chiave propria (additiva), così resta anche dopo una ricarica */
  const QK = "v3_cibo_quiz";
  const quizGet = iso => ((typeof lsGet === "function" ? lsGet(QK, {}) : {}) || {})[iso] || null;
  function quizSet(iso, a) { const all = lsGet(QK, {}) || {}; all[iso] = a; lsSet(QK, all); }

  /* ---------- utilità ---------- */
  const today = () => localISO();
  const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const HOUR = { col: 8, spu: 10.5, pra: 13, mer: 16.5, cen: 20 };
  const LAB = k => (MEALS.find(m => m[0] === k) || [k, k])[1];
  const dowOf = iso => new Date(iso + "T12:00:00").getDay();
  const prof = () => data.profile();
  const kid = () => prof().group === "bambino";
  const minor = () => prof().minor;
  /* lettura senza creare giorni: stessa logica di mealState */
  const dayV = iso => { const v = S.days[iso]; return v ? { meals: v.meals || {}, custom: v.custom || {}, skip: v.skip || {}, extra: v.extra || [] } : { meals: {}, custom: {}, skip: {}, extra: [] }; };
  const stOf = (iso, k) => mealState(dayV(iso), k);
  const planMeals = dw => MEALS.filter(([k]) => mealOf(dw, k)).map(([k]) => k);
  const segn = k => (k === "col" || k === "mer" || k === "cen") ? "segnata" : "segnato";
  const doy = iso => Math.floor((new Date(iso + "T12:00:00") - new Date(iso.slice(0, 4) + "-01-01T12:00:00")) / 864e5);

  /* ---------- scritture: stessi campi e funzioni del pulsante vecchio «meal» ---------- */
  function markEaten(k) {
    const iso = today(), first = !(S.days[iso] && intake(iso).logged);
    const d = dayLog(iso); delete d.custom[k]; delete d.skip[k]; d.meals[k] = true; saveDay(iso);
    if (first) { try { data.saveDayTarget(iso); } catch (_) {} }
  }
  function unmark(k) { const iso = today(), d = dayLog(iso); delete d.custom[k]; delete d.skip[k]; d.meals[k] = false; saveDay(iso); }
  /* «cambia le quantità» del pasto del piano: apre il foglio vecchio di registrazione, già scritto con gli alimenti del piano */
  function editQty(k) { const m = mealOf(dowOf(today()), k); S.food = { key: k, text: m ? m.i.join(", ") : "", items: [], note: "", busy: false, err: null }; openSheet("food"); }

  /* ---------- quantità in unità di casa ---------- */
  const half = (n, one, many, f) => { n = Math.max(.5, Math.round(n * 2) / 2); const i = Math.floor(n), h = n % 1 ? (f ? " e mezza" : " e mezzo") : ""; return i === 0 ? (f ? "mezza " : "mezzo ") + one : `${i} ${i === 1 ? one : many}${h}`; };
  const CASA = [
    [/^(\d+) g pane\b/i, g => `${half(g / 50, "fetta", "fette", 1)} di pane (${g} g)`],
    [/^(\d+) g patate\b/i, g => `${half(g / 150, "patata media", "patate medie", 1)} (${g} g)`],
    [/^(\d+) g olio\b/i, g => g <= 5 ? `1 cucchiaino d'olio (${g} g)` : `${half(g / 10, "cucchiaio", "cucchiai")} d'olio (${g} g)`],
    [/^(\d+) g yogurt greco\b/i, g => `${half(g / 150, "vasetto", "vasetti")} di yogurt greco (${g} g)`],
    [/(\d+) g albume\b/i, g => `albume di ${Math.max(1, Math.round(g / 33))} uova (${g} g)`]
  ];
  function casa(s) { for (const [re, f] of CASA) { const m = re.exec(s); if (m) return s.slice(0, m.index) + f(+m[1]) + s.slice(m.index + m[0].length).replace(/^ (EVO|extravergine)/i, " $1"); } return s; }

  /* ---------- il piatto spiegato: ruolo di ogni cibo ---------- */
  const KW = [
    [/\bpane\b/i, "pane", "e"], [/pasta(?! di legumi)/i, "pasta", "e"], [/\briso\b/i, "riso", "e"], [/cereal/i, "cereali", "e"], [/patate/i, "patate", "e"], [/gnocchi/i, "gnocchi", "e"], [/fette biscottate|gallette|crackers/i, "fette biscottate", "e"],
    [/uov/i, "uova", "m"], [/albume/i, "albume", "m"], [/yogurt/i, "yogurt greco", "m"], [/pollo|tacchino|carne bianca/i, "carne bianca", "m"], [/carne magra/i, "carne magra", "m"],
    [/orata|spigola|merluzzo|pesce fresco/i, "pesce", "m"], [/sgombro|tonno/i, "sgombro o tonno", "mg"], [/tofu|seitan/i, "tofu", "m"], [/mozzarella/i, "mozzarella", "m"], [/formaggio|parmigiano|grana/i, "formaggio", "m"],
    [/affettato|bresaola/i, "affettato magro", "m"], [/fagiol|ceci|lenticch|legum/i, "legumi", "m"], [/olio/i, "olio d'oliva", "g"], [/burro di frutta secca/i, "burro di frutta secca", "g"],
    [/(^|[^i] )frutta secca|mandorle|nocciole/i, "frutta secca", "g"], [/avocado/i, "avocado", "g"], [/pesto/i, "pesto", "g"], [/verdur|vegetal|insalat/i, "verdura", "f"], [/frutta fresca|porzione di frutta/i, "frutta", "f"]
  ];
  const ROLE = [["e", "Carboidrati (energia)"], ["m", "Proteine (muscoli)"], ["g", "Grassi buoni"], ["f", "Fibre e vitamine"]];
  const EMPTY = { e: "qui puoi aggiungere un po' di pane", m: "qui puoi aggiungere yogurt, uova o legumi", g: "qui basta un filo d'olio", f: "qui puoi aggiungere verdura o frutta" };
  function roles(text) { const by = { e: [], m: [], g: [], f: [] }; for (const [re, name, r] of KW) if (re.test(text)) for (const c of r) if (!by[c].includes(name)) by[c].push(name); return by; }
  const mealText = (dw, k) => { const m = mealOf(dw, k); return m ? m.t + ". " + m.i.join(". ") : ""; };

  /* ---------- curiosità (una dopo ogni spunta) ---------- */
  const CUR = [
    { id: "legumi", re: /fagiol|ceci|lenticch|legum/i, top: "I mattoni dei muscoli", ti: "Pasta e legumi", t: "Insieme valgono quanto la carne per i muscoli.", more: "Alla pasta manca un aminoacido (la lisina) che i legumi hanno; ai legumi ne manca uno (la metionina) che la pasta ha. Insieme fanno una proteina completa. Le linee guida consigliano i legumi 2–4 volte a settimana.", q: "Cosa sono gli aminoacidi?" },
    { id: "yogurt", re: /yogurt greco/i, top: "I mattoni dei muscoli", ti: "Lo yogurt greco", t: "Ha circa il triplo delle proteine di uno yogurt normale.", more: "Viene scolato, perde acqua e resta più denso: circa 10 g di proteine ogni 100 g. Porta anche calcio, che rende forti le ossa.", q: "Perché le proteine servono ai muscoli?" },
    { id: "uova", re: /uov/i, top: "Il ferro", ti: "Uova e ferro", t: "Un kiwi o un'arancia aiutano a prendere il ferro.", more: "L'uovo porta ferro, che aiuta il sangue a portare ossigeno ai muscoli. Da solo il corpo ne prende poco: la vitamina C di kiwi, arance o pomodori ne fa assorbire di più.", q: "A cosa serve il ferro?" },
    { id: "patate", re: /patate/i, top: "L'energia", ti: "Le patate", t: "Contano come pane o pasta, non come verdura.", more: "Le patate sono ricche di amido, cioè carboidrati: energia per allenarti. La verdura è un'altra cosa: fibre e vitamine con poche calorie.", q: "Cosa sono i carboidrati?" },
    { id: "azzurro", re: /sgombro|tonno|sarde|alici/i, top: "I grassi buoni", ti: "Il pesce azzurro", t: "È il pesce più ricco di omega 3.", more: "Sgombro, sarde e alici hanno più omega 3 degli altri pesci: grassi buoni che aiutano cuore e cervello. Costano poco e si trovano anche in scatola.", q: "Cosa sono gli omega 3?" },
    { id: "pesce", re: /orata|spigola|merluzzo|pesce/i, top: "I grassi buoni", ti: "Il pesce", t: "Proteine per i muscoli e grassi buoni per il cuore.", more: "Il pesce porta proteine complete e omega 3. Due o tre volte a settimana bastano per avere i suoi vantaggi.", q: "Perché il pesce fa bene al cuore?" },
    { id: "frsecca", re: /frutta secca|mandorle|nocciole/i, top: "I grassi buoni", ti: "La frutta secca", t: "Una porzione sta nel palmo di una mano.", more: "Mandorle, noci e nocciole portano grassi buoni, vitamina E e magnesio. Hanno molte calorie: 15–30 g al giorno bastano.", q: "Quali sono i grassi buoni?" },
    { id: "olio", re: /olio/i, top: "I grassi buoni", ti: "L'olio d'oliva", t: "Un cucchiaio vale circa 90 calorie.", more: "L'olio extravergine d'oliva protegge il cuore, ma è il cibo con più calorie che esista. Meglio a crudo e misurato col cucchiaio.", q: "Quanto olio posso usare al giorno?" },
    { id: "carbo", re: /pasta|riso|cereal|gnocchi/i, top: "L'energia", ti: "Pasta e riso", t: "Sono la benzina delle serie pesanti.", more: "I carboidrati si conservano nei muscoli come glicogeno: è il carburante dell'allenamento. Per questo il pasto prima della palestra ne ha di più.", q: "Cos'è il glicogeno?" },
    { id: "pane", re: /\bpane\b/i, top: "L'energia", ti: "Il pane", t: "Due fette danno l'energia di 80 g di pasta.", more: "100 g di pane (due fette) hanno circa le stesse calorie di 80 g di pasta. Il pane integrale porta più fibre e sazia di più.", q: "Pane integrale o bianco?" },
    { id: "carne", re: /pollo|tacchino|carne/i, top: "I mattoni dei muscoli", ti: "La carne", t: "100 g di pollo danno circa 23 g di proteine.", more: "La carne bianca è magra e ricca di proteine. La carne rossa porta più ferro, ma le linee guida consigliano di non superare 2–3 volte a settimana.", q: "Carne bianca o rossa?" },
    { id: "tofu", re: /tofu|seitan/i, top: "I mattoni dei muscoli", ti: "Il tofu", t: "È fatto di soia: proteine complete senza carne.", more: "La soia è uno dei pochi legumi con tutte le parti delle proteine che servono ai muscoli. Il tofu ne ha circa 13 g ogni 100 g.", q: "Si può crescere di muscoli senza carne?" },
    { id: "formaggi", re: /mozzarella|formaggio|parmigiano|grana/i, top: "Le ossa", ti: "I formaggi", t: "Portano calcio, che rende forti le ossa.", more: "Il Parmigiano è tra i cibi più ricchi di calcio: 30 g ne danno circa un terzo di quello che serve in un giorno.", q: "A cosa serve il calcio?" },
    { id: "affettato", re: /affettato|bresaola/i, top: "I mattoni dei muscoli", ti: "Gli affettati", t: "La bresaola è tra i più magri.", more: "Bresaola, fesa di tacchino e prosciutto sgrassato hanno molte proteine e pochi grassi. Contengono però parecchio sale: meglio non tutti i giorni.", q: "Perché il sale va limitato?" },
    { id: "verdura", re: /verdur|vegetal|insalat/i, top: "Fibre e vitamine", ti: "I colori della verdura", t: "Più colori nel piatto, più vitamine diverse.", more: "Ogni colore porta sostanze diverse: il rosso del pomodoro, il verde degli spinaci, l'arancio delle carote. Le fibre ti fanno sentire sazio e aiutano la pancia.", q: "Cosa sono le fibre?" },
    { id: "frutta", re: /frutta fresca|porzione di frutta/i, top: "Fibre e vitamine", ti: "La frutta intera", t: "Sazia più di un succo.", more: "La frutta intera tiene le sue fibre: lo zucchero entra piano e ti senti sazio più a lungo. Nel succo le fibre si perdono.", q: "Frutta o succo di frutta?" }
  ];
  const CUR0 = { id: "acqua", top: "Il corpo", ti: "L'acqua", t: "I muscoli sono fatti per tre quarti d'acqua.", more: "Bere poco fa sentire più stanchi anche in palestra. Un bicchiere a ogni pasto e uno durante l'allenamento sono un buon inizio.", q: "Quanta acqua devo bere?" };
  /* curiosità di un pasto in un giorno: a rotazione tra quelle che c'entrano col piatto */
  function curFor(text, iso) { const all = CUR.filter(c => c.re.test(text)); return all.length ? all[doy(iso) % all.length] : CUR0; }

  /* ---------- «Secondo te?» (una domanda al giorno) ---------- */
  const QUIZ = [
    { re: /fagiol|ceci|lenticch|legum/i, q: "Pasta e legumi insieme danno ai muscoli i mattoni giusti, anche senza carne?", o: ["Sì", "No"], a: 0, x: "Alla pasta manca un pezzo che i legumi hanno, e viceversa: insieme fanno una proteina completa." },
    { re: /patate/i, q: "Le patate contano come verdura?", o: ["Sì", "No"], a: 1, x: "Sono energia, come pane e pasta. La verdura porta fibre e vitamine." },
    { re: /yogurt greco/i, q: "Lo yogurt greco ha più proteine di uno yogurt normale?", o: ["Sì", "No"], a: 0, x: "Circa il triplo: viene scolato e resta più denso." },
    { re: /orata|spigola|merluzzo|pesce|sgombro|tonno/i, q: "Quante volte a settimana conviene mangiare pesce?", o: ["Una al mese", "Due o tre"], a: 1, x: "Due o tre volte a settimana bastano per i suoi grassi buoni." },
    { re: /uov/i, q: "Anche il tuorlo dell'uovo ha proteine?", o: ["Sì", "No, solo l'albume"], a: 0, x: "Il tuorlo ne ha quasi metà, più vitamine e grassi." },
    { re: /olio/i, q: "Un cucchiaio d'olio ha più calorie di un frutto?", o: ["Sì", "No"], a: 0, x: "Circa 90 contro 50–80: l'olio fa bene, ma ne basta poco." }
  ];
  const quizFor = (text, iso) => { const all = QUIZ.filter(z => z.re.test(text)); return all.length ? all[doy(iso) % all.length] : QUIZ[doy(iso) % QUIZ.length]; };

  /* ---------- stile della sezione (una volta) ---------- */
  if (!document.getElementById("v3-sec-cibo")) {
    const st = document.createElement("style"); st.id = "v3-sec-cibo";
    st.textContent = `
    #view.v3 .v3-cibo-caro { display: flex; gap: 12px; overflow-x: auto; contain: inline-size; width: calc(100% + 32px); min-width: 0; box-sizing: border-box; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 2px 16px; scroll-padding-inline: 16px; scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
    #view.v3 .v3-cibo-caro::-webkit-scrollbar { display: none; }
    #view.v3 .v3-cibo-mc { flex: 0 0 calc(100% - 52px); scroll-snap-align: start; background: var(--v3-s1); border-radius: 24px; padding: 16px; box-sizing: border-box; display: flex; transition: opacity .2s; }
    #view.v3 .v3-cibo-mc.cur { box-shadow: inset 0 0 0 2px var(--v3-lime); }
    #view.v3 .v3-cibo-mc:not(.cur) { opacity: .5; cursor: pointer; }
    #view.v3 .v3-cibo-in { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }
    #view.v3 .v3-cibo-k { font-size: 15px; font-weight: 700; color: var(--v3-t2); }
    #view.v3 .v3-cibo-t { font-size: 20px; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
    #view.v3 .v3-cibo-acts { margin-top: auto; padding-top: 10px; display: flex; flex-direction: column; gap: 10px; }
    #view.v3 .v3-cibo-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    #view.v3 .v3-cibo-two .v3-b2 { padding: 0 8px; }
    #view.v3 .v3-cibo-dots { display: flex; justify-content: center; margin: -8px 0 -4px; }
    #view.v3 .v3-cibo-dots button { width: 44px; height: 48px; border: 0; background: transparent; padding: 0; display: flex; align-items: center; justify-content: center; }
    #view.v3 .v3-cibo-dots i { width: 7px; height: 7px; border-radius: 4px; background: var(--v3-s3); transition: background .2s; }
    #view.v3 .v3-cibo-dots button[aria-current="true"] i { background: var(--v3-t1); }
    #view.v3 .v3-cibo-hd p.v3-sub { margin-top: 6px; }
    #view.v3 .v3-cibo-ing { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    #view.v3 .v3-cibo-ing li { font-size: 16px; line-height: 1.4; padding: 10px 0; border-top: 1px solid var(--v3-s3); }
    #view.v3 .v3-cibo-ing li:first-child { border-top: 0; padding-top: 0; }
    #view.v3 .v3-cibo-role { display: flex; flex-direction: column; gap: 2px; }
    #view.v3 .v3-cibo-role .v3-rs i { font-style: normal; color: var(--v3-t3); }
    #view.v3 .v3-cibo-q { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--v3-t2); }
    #view.v3 .v3-cibo-qq { font-size: 19px; font-weight: 700; line-height: 1.3; }
    #view.v3 .v3-cibo-acts2 { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .v3-cibo-x { display: flex; align-items: center; gap: 12px; }
    #view.v3 .v3-cibo-seg .v3-sg { min-height: 48px; }
    #view.v3 .v3-cibo-pact .v3-row .v3-apri { width: 96px; min-width: 96px; padding: 0; }
    #view.v3 .v3-cibo-tg { width: 96px; flex: none; }
    @media (prefers-reduced-motion: reduce) { #view.v3 .v3-cibo-mc, #view.v3 .v3-cibo-dots i { transition: none; } }`;
    document.head.appendChild(st);
  }

  /* ---------- pezzi comuni ---------- */
  const title = (t, verdict) => `<div class="v3-cibo-hd"><h1 class="v3-t1">${e(t)}</h1>${verdict ? `<p class="v3-sub">${e(verdict)}</p>` : ""}</div>`;
  const acts = html => `<div class="v3-cibo-acts2">${html}</div>`;
  const lime = (label, act, arg) => `<button class="v3-apri wide"${act ? ` data-v3act="${e(act)}"${arg != null ? ` data-v3arg="${e(arg)}"` : ""}` : ""}>${e(label)}</button>`;
  const leg = (label, act, v, cls = "v3-b2") => `<button class="${cls}" data-act="${e(act)}"${v != null ? ` data-v="${e(v)}"` : ""}>${e(label)}</button>`;
  const endCur = (c, act) => ui.end(c.t, { act: act || "cur", arg: c.id, leoQ: c.q });

  function stateOf(k, idx, list) {
    const st = stOf(today(), k);
    if (st === "plan" || st === "custom") return { st, lab: "Mangiato ✓" };
    if (st === "skip") return { st, lab: "Non mangiato" };
    const past = HOUR[k] + 1.5 < nowH();
    return { st, past, lab: past ? "Da segnare" : idx === nextIdx(list) ? "Adesso" : "Più tardi" };
  }
  function nextIdx(list) {
    const h = nowH(), open = list.map((k, i) => [k, i]).filter(([k]) => stOf(today(), k) === "open");
    const now = open.find(([k]) => HOUR[k] >= h - 1);
    return now ? now[1] : open.length ? open[0][1] : list.length - 1;
  }
  function mealNums(dw, k) { // calorie e macro del pasto come segnato (piano o «altra cosa»)
    const st = stOf(today(), k), v = dayV(today());
    if (st === "custom") return { kcal: Math.round(v.custom[k].kcal || 0), p: Math.round(v.custom[k].p || 0), c: Math.round(v.custom[k].c || 0), f: Math.round(v.custom[k].f || 0) };
    const n = nutOf(dw, k); return { kcal: Math.round(n.kcal), p: Math.round(n.p), c: Math.round(n.c), f: Math.round(n.f) };
  }
  const numLine = n => kid() ? `${n.p} g di proteine` : `${nf(n.kcal, 0)} calorie · ${n.p} g di proteine`;

  /* ============================== PAGINA PRINCIPALE ============================== */
  function card(k, i, list) {
    const dw = dowOf(today()), m = mealOf(dw, k), s = stateOf(k, i, list), v = dayV(today()), cur = i === ci;
    const t = s.st === "custom" ? v.custom[k].text : m ? m.t : "Non previsto";
    let body;
    if (s.st === "plan" || s.st === "custom") body = `<p class="v3-rs">${e(numLine(mealNums(dw, k)))}${s.st === "custom" ? " · al posto del piano" : ""}</p><div class="v3-cibo-acts">${ui.secondary("Vedi o cambia", "pasto", k)}</div>`;
    else if (s.st === "skip") body = `<p class="v3-rs">Segnato come non mangiato.</p><div class="v3-cibo-acts">${ui.secondary("Vedi o cambia", "pasto", k)}</div>`;
    else body = `<p class="v3-rs">${e(numLine(mealNums(dw, k)))}</p><div class="v3-cibo-acts">${lime("Ho mangiato questo", "eat", k)}${s.past
      ? `<div class="v3-cibo-two">${leg("Un'altra cosa", "mealalt", k)}${leg("Non mangiato", "mealskip", k)}</div>` : leg("Ho mangiato un'altra cosa", "mealalt", k)}</div>`;
    return `<div class="v3-cibo-mc${cur ? " cur" : ""}" data-i="${i}"${cur ? "" : ` data-v3act="dot" data-v3arg="${i}" aria-hidden="true"`}><div class="v3-cibo-in"${cur ? "" : " inert"}>
      <p class="v3-cibo-k">${e(LAB(k))} · ${e(s.lab)}</p><p class="v3-cibo-t">${e(t)}</p>${body}</div></div>`;
  }
  function numsBox(act) {
    const d = data.today();
    if (kid()) { const list = planMeals(dowOf(today())), n = list.filter(k => stOf(today(), k) !== "open").length;
      return ui.limeBox({ title: "Pasti e proteine", action: { label: "Apri", act }, tiles: [
        { label: "Pasti segnati", value: String(n), of: list.length || 5, pct: ui.pct(n, list.length || 5), act },
        { label: "Proteine", value: d.pro, of: d.proT, unit: "g", pct: ui.pct(d.pro, d.proT), act }] }); }
    return ui.limeBox({ title: "Calorie e proteine", action: { label: "Apri", act }, tiles: [
      { label: "Calorie", value: d.kcal, of: d.kcalT, pct: ui.pct(d.kcal, d.kcalT), act },
      { label: "Proteine", value: d.pro, of: d.proT, unit: "g", pct: ui.pct(d.pro, d.proT), act }] });
  }
  function mainPlan() {
    const iso = today(), list = planMeals(dowOf(iso));
    if (ciDay !== iso || ci == null || ci >= list.length) { ci = nextIdx(list); ciDay = iso; }
    const nk = list[nextIdx(list)] || list[0], c = curFor(mealText(dowOf(iso), nk), iso);
    return ui.header("Cibo") +
      `<section class="v3-sec">${ui.label("Cosa fare adesso")}
        <div class="v3-cibo-caro hscroll" role="group" aria-label="Pasti di oggi, scorri col dito">${list.map((k, i) => card(k, i, list)).join("")}</div>
        <div class="v3-cibo-dots" role="group" aria-label="Pasti di oggi">${list.map((k, i) => `<button data-v3act="dot" data-v3arg="${i}" aria-label="${e(LAB(k))}${stOf(iso, k) === "plan" || stOf(iso, k) === "custom" ? ", mangiato" : ""}" aria-current="${i === ci}"><i></i></button>`).join("")}</div>
        ${ui.secondary("Vedi tutta la giornata", "giornata")}</section>` +
      numsBox("numeri") +
      ui.row({ title: "Scopri di più", sub: "La settimana, le curiosità, il piano", act: "scopri", apri: "Apri" }) +
      endCur(c);
  }
  function mainNoPlan() {
    const iso = today(), v = dayV(iso), done = MEALS.filter(([k]) => mealState(v, k) !== "open").length;
    const rows = MEALS.map(([k, l]) => { const st = mealState(v, k);
      return ui.row({ title: l, sub: st === "custom" ? v.custom[k].text : st === "skip" ? "Non mangiato" : st === "plan" ? "Mangiato ✓" : "Non ancora segnato", act: "alt", arg: k, apri: st === "open" ? "Segna" : "Cambia" })
        .replace(/data-v3act="alt" data-v3arg="/, 'data-act="mealalt" data-v="'); }).join("");
    return ui.header("Cibo") +
      ui.section("Prima cosa da fare", ui.card(`<p class="v3-cibo-t">Crea il tuo piano alimentare</p><p class="v3-rs">Saprai cosa mettere nel piatto, e perché.</p>${lime("Crea il tuo piano", "crea")}${leg("Carica il piano che hai già", "redo", 3)}`)) +
      ui.section(`Oggi hai segnato ${done} ${done === 1 ? "pasto" : "pasti"} su 5`, rows + leg("Aggiungi cibo fuori programma", "mealalt", "extra")) +
      numsBox("numeri") +
      ui.row({ title: "Scopri di più", sub: "La settimana e le curiosità", act: "scopri", apri: "Apri" }) +
      endCur(CUR[doy(iso) % CUR.length]);
  }

  /* carosello: scorrimento col dito, pallini e schede laterali aggiornati senza ridisegnare */
  function bindCaro(el) {
    const c = el.querySelector(".v3-cibo-caro"); if (!c) return;
    const center = (i, smooth) => { const m = c.querySelector(`.v3-cibo-mc[data-i="${i}"]`); if (!m) return;
      const x = m.offsetLeft - 16; // 28/10: card del momento allineata al bordo, la successiva si vede a destra c._prog = Date.now() + (smooth ? 700 : 250);
      if (smooth && c.scrollTo && !matchMedia("(prefers-reduced-motion: reduce)").matches) c.scrollTo({ left: x, behavior: "smooth" }); else c.scrollLeft = x; };
    const mark = i => {
      c.querySelectorAll(".v3-cibo-mc").forEach(m => { const on = +m.dataset.i === i, inn = m.firstElementChild;
        m.classList.toggle("cur", on); if (on) { m.removeAttribute("data-v3act"); m.removeAttribute("data-v3arg"); m.removeAttribute("aria-hidden"); inn.removeAttribute("inert"); }
        else { m.dataset.v3act = "dot"; m.dataset.v3arg = m.dataset.i; m.setAttribute("aria-hidden", "true"); inn.setAttribute("inert", ""); } });
      el.querySelectorAll(".v3-cibo-dots button").forEach((b, j) => b.setAttribute("aria-current", String(j === i)));
    };
    center(ci, false); requestAnimationFrame(() => { if (c.isConnected) center(ci, false); });
    let tm = null;
    c.addEventListener("scroll", () => { clearTimeout(tm); tm = setTimeout(() => { if (Date.now() < (c._prog || 0)) return;
      let best = ci, bd = 1e9; const all = c.querySelectorAll(".v3-cibo-mc"); all.forEach(m => { const d = Math.abs(m.offsetLeft - 16 - c.scrollLeft); if (d < bd) { bd = d; best = +m.dataset.i; } }); if (c.scrollLeft >= c.scrollWidth - c.clientWidth - 2 && all.length) best = +all[all.length - 1].dataset.i;
      if (best !== ci) { ci = best; mark(ci); } }, 90); }, { passive: true });
    c._center = center; c._mark = mark;
  }

  /* ============================== PAGINE INTERNE ============================== */
  function pageGiornata() {
    const iso = today(), dw = dowOf(iso), v = dayV(iso), list = hasMealPlan() ? planMeals(dw) : MEALS.map(m => m[0]);
    const done = list.filter(k => stOf(iso, k) === "plan" || stOf(iso, k) === "custom").length, ni = nextIdx(list);
    const rows = list.map((k, i) => { const s = stateOf(k, i, list), m = mealOf(dw, k), t = s.st === "custom" ? v.custom[k].text : m ? m.t : "Non ancora segnato";
      return ui.row({ title: `${LAB(k)} · ${s.lab}`, sub: t, act: "pasto", arg: k, on: i === ni && s.st === "open" }); }).join("");
    const ex = v.extra.map(x => `<div class="v3-row"><span class="v3-rx"><span class="v3-rt" style="display:block">Fuori programma</span><span class="v3-rs" style="display:block">${e(x.text)} · ${kid() ? Math.round(x.p) + " g di proteine" : nf(Math.round(x.kcal), 0) + " calorie"}</span></span>${leg("Togli", "delextra", x.id, "v3-b2 v3-cibo-tg")}</div>`).join("");
    return ui.back() + title("Tutta la giornata", `Hai segnato ${done} ${done === 1 ? "pasto" : "pasti"} su ${list.length}`) +
      ui.section("Pasti di oggi", rows + ex + leg("Aggiungi cibo fuori programma", "mealalt", "extra")) +
      endCur(curFor(mealText(dw, list[ni] || "pra"), iso));
  }

  function plateBox(n, dayT) {
    const tiles = [
      kid() ? null : { label: "Calorie", value: n.kcal, pct: ui.pct(n.kcal, dayT.kcalT), miss: `${ui.pct(n.kcal, dayT.kcalT)}% della giornata` },
      { label: "Proteine", value: n.p, unit: "g", pct: ui.pct(n.p, dayT.proT), miss: `${ui.pct(n.p, dayT.proT)}% della giornata` },
      { label: "Carboidrati", value: n.c, unit: "g", pct: dayT.choT ? ui.pct(n.c, dayT.choT) : null, miss: dayT.choT ? `${ui.pct(n.c, dayT.choT)}% della giornata` : null },
      { label: "Grassi", value: n.f, unit: "g", pct: dayT.fatT ? ui.pct(n.f, dayT.fatT) : null, miss: dayT.fatT ? `${ui.pct(n.f, dayT.fatT)}% della giornata` : null }
    ].filter(Boolean);
    return ui.limeBox({ title: "Il tuo piatto, spiegato", tiles });
  }
  function rolesCard(text) {
    const by = roles(text);
    return ui.section("Cosa fa ogni cibo", ui.card(ROLE.map(([r, name]) => `<div class="v3-cibo-role"><p class="v3-rt">${e(name)}</p><p class="v3-rs">${by[r].length ? e(by[r].join(", ")) : `<i>${e(EMPTY[r])}</i>`}</p></div>`).join("") +
      ui.leo("Cosa sono proteine, carboidrati e grassi?")));
  }

  function pagePasto(k) {
    const iso = today(), dw = dowOf(iso), m = mealOf(dw, k), v = dayV(iso), st = stOf(iso, k), list = planMeals(dw), i = list.indexOf(k), s = stateOf(k, i, list);
    const c = curFor(st === "custom" ? v.custom[k].text : mealText(dw, k), iso), dayT = data.today();
    let h = ui.back() + title(LAB(k), st === "custom" ? "Mangiato un'altra cosa" : s.lab);
    if (st === "custom") {
      h += ui.card(`<p class="v3-cibo-t">${e(v.custom[k].text)}</p>${m ? `<p class="v3-rs">Il piano prevedeva: ${e(m.t.toLowerCase())}</p>` : ""}`) + plateBox(mealNums(dw, k), dayT) +
        acts(leg("Modifica cosa ho mangiato", "mealalt", k) + ui.secondary("Rimetti tra i pasti da fare", "unmark", k));
    } else if (st === "plan") {
      h += ui.section("Nel piatto", ui.card(`<ul class="v3-cibo-ing">${m.i.map(x => `<li>${e(casa(x))}</li>`).join("")}</ul>`)) + plateBox(mealNums(dw, k), dayT) + rolesCard(mealText(dw, k)) +
        acts(ui.secondary("Cambia le quantità", "qty", k) + ui.secondary("Rimetti tra i pasti da fare", "unmark", k));
    } else if (st === "skip") {
      h += (m ? ui.card(`<p class="v3-cibo-t">${e(m.t)}</p>`) : "") + acts((m ? lime("Ho mangiato questo", "eat", k) : "") + leg("Ho mangiato un'altra cosa", "mealalt", k) + ui.secondary("Rimetti tra i pasti da fare", "unmark", k));
    } else {
      h += (m ? ui.section("Nel piatto", ui.card(`<ul class="v3-cibo-ing">${m.i.map(x => `<li>${e(casa(x))}</li>`).join("")}</ul>`)) : "") +
        acts((m ? lime("Ho mangiato questo", "eat", k) + ui.secondary("Cambia le quantità", "qty", k) : "") + leg(m ? "Un'altra cosa" : "Segna cosa ho mangiato", "mealalt", k) + (s.past ? leg("Non mangiato", "mealskip", k) : ""));
    }
    return h + endCur(c);
  }

  function pageLearned(k) {
    const iso = today(), dw = dowOf(iso), text = mealText(dw, k), c = curFor(text, iso), z = quizFor(text, iso);
    let quiz = "";
    const qa = quizGet(iso);
    if (!qa) quiz = ui.card(`<p class="v3-cibo-q">Secondo te?</p><p class="v3-cibo-qq">${e(z.q)}</p><div class="v3-cibo-two">${z.o.map((o, j) => ui.secondary(o, "quiz", j)).join("")}</div>${ui.secondary("Salta la domanda", "quiz", -1)}`);
    else if (qa.k === k) quiz = ui.card(`<p class="v3-cibo-q">${qa.ok ? "Esatto!" : qa.skip ? "Domanda saltata" : "Quasi"}</p><p class="v3-rs">${e(z.x)}</p>`);
    return ui.back() + title(`${LAB(k)} ${segn(k)} ✓`, "Ecco cosa ti ha dato") + quiz + plateBox(mealNums(dw, k), data.today()) + rolesCard(text) +
      acts(ui.secondary("Torna ai pasti di oggi", "home") + ui.secondary("Rimetti tra i pasti da fare", "unmark", k)) + endCur(c);
  }

  /* calorie e proteine giorno per giorno */
  const PER = ["7 giorni", "4 settimane", "3 mesi"];
  function series(per) {
    const t = today(), out = [];
    if (per === 0) { for (let i = 6; i >= 0; i--) { const d = data.day(addDays(t, -i)); out.push({ lab: ui.dLab(d.iso), kcal: d.logged ? d.kcal : 0, pro: d.logged ? d.pro : 0, n: d.logged && d.closed ? 1 : 0, kT: d.kcalT, pT: d.proT, days: [d] }); } }
    else { const n = per === 1 ? 4 : 13, mon = localISO(mondayOf(new Date()));
      for (let w = n - 1; w >= 0; w--) { const from = addDays(mon, -7 * w), ds = []; for (let j = 0; j < 7; j++) { const iso = addDays(from, j); if (iso <= t) ds.push(data.day(iso)); }
        const ok = ds.filter(d => d.closed && d.logged), av = f => ok.length ? Math.round(ok.reduce((s, d) => s + d[f], 0) / ok.length) : 0;
        out.push({ lab: ui.dLab(from), kcal: av("kcal"), pro: av("pro"), n: ok.length, kT: av("kcalT") || (ds[0] || {}).kcalT, pT: av("proT") || (ds[0] || {}).proT, days: ds }); } }
    return out;
  }
  function pageNumeri() {
    const s = series(numPer), closed = s.flatMap(x => x.days).filter(d => d.closed && d.logged), d0 = data.today();
    const av = f => closed.length ? Math.round(closed.reduce((a, d) => a + d[f], 0) / closed.length) : null;
    const kc = av("kcal"), kT = av("kcalT"), pr = av("pro"), pT = av("proT"), last = s.length - 1;
    const xl = [[0, s[0].lab], [last, numPer === 0 ? "oggi" : "ora"]];
    const unitTip = numPer === 0 ? "" : " in media";
    const panel = (big, line, vals, max, tick, fmt, aria) => ui.big(big, line) + ui.chart.bars({ vals, max, ticks: [[tick, fmt(tick), true], [0, "0"]], xl, tip: i => `${s[i].lab}: ${s[i].days.some(d => d.logged) ? fmt(vals[i]) + unitTip : "non segnato"}`, aria });
    const empty = ui.big("–", closed.length ? "" : "Ancora pochi dati: segna i pasti");
    let chart;
    const proP = pr == null ? empty : panel(`${pr} <span class="v3-of">/${pT} g</span>`, "Proteine al giorno, in media", s.map(x => x.pro), Math.max(pT || 1, ...s.map(x => x.pro)) * 1.05, pT, v => nf(v, 0) + " g", "Proteine al giorno");
    if (kid()) chart = ui.card(proP);
    else chart = ui.card((kc == null ? empty : panel(`${nf(kc, 0)} <span class="v3-of">/${nf(kT, 0)}</span>`, "Calorie al giorno, in media", s.map(x => x.kcal), Math.max(kT || 1, ...s.map(x => x.kcal)) * 1.05, kT, v => nf(v, 0), "Calorie al giorno")) + (pr == null ? "" : proP));
    let verdict = "Ancora pochi dati";
    if (kc != null && !kid()) { const diff = kc - kT; verdict = Math.abs(diff) < 100 ? "In linea con il piano" : minor() ? (diff < 0 ? "Un po' sotto il piano" : "Un po' sopra il piano") : `${diff < 0 ? "Sotto" : "Sopra"} di circa ${nf(Math.round(Math.abs(diff) / 10) * 10, 0)} calorie`; }
    else if (pr != null) verdict = pr >= pT * .9 ? "Proteine in linea col piano" : "Proteine un po' basse";
    const rows = (kid() ? "" : ui.row({ title: "Calorie di oggi", value: `${nf(d0.kcal, 0)} <span class="v3-of">/${nf(d0.kcalT, 0)}</span>` })) + ui.row({ title: "Proteine di oggi", value: `${d0.pro} <span class="v3-of">/${d0.proT} g</span>` });
    return ui.back() + title(kid() ? "Proteine" : "Calorie e proteine", verdict) + `<div class="v3-cibo-seg">${ui.seg(PER, numPer, "per", "Periodo")}</div>` + chart + `<div class="v3-sec">${rows}</div>` +
      ui.end(kid() ? "Le proteine sono i mattoni con cui crescono i muscoli." : "Non serve essere precisi ogni giorno: conta la media.", { leoQ: kid() ? "Cosa sono le proteine?" : "Cosa sono le calorie?" });
  }

  /* settimana: cosa hai mangiato davvero (dai pasti segnati) */
  const FOOD = [
    { id: "leg", re: /fagiol|ceci|lenticch|legum|piselli/i, name: "Legumi", ok: [2, 4], hint: "Consigliati 2–4 volte a settimana", why: "Fagioli, ceci e lenticchie danno mattoni per i muscoli, energia e tanta fibra. Le linee guida li consigliano 2–4 volte a settimana." },
    { id: "pesce", re: /pesce|orata|spigola|merluzzo|sgombro|tonno|salmone|sarde|alici/i, name: "Pesce", ok: [2, 3], hint: "Consigliato 2–3 volte a settimana", why: "Proteine per i muscoli, omega 3 per il cuore. Due o tre volte a settimana bastano; prova anche sgombro o sarde, pesce azzurro con grassi buoni." },
    { id: "fv", re: /verdur|vegetal|insalat|frutta fresca|porzione di frutta|frutto|pomodor/i, name: "Frutta e verdura", ok: [14, 99], hint: "In almeno due pasti al giorno", why: "Ogni colore di frutta e verdura porta vitamine diverse. Le linee guida consigliano 5 porzioni al giorno, più colori possibile." }
  ];
  function weekFood() {
    const t = today(), cnt = { leg: 0, pesce: 0, fv: 0 }, perDay = [];
    for (let i = 6; i >= 0; i--) { const iso = addDays(t, -i), v = dayV(iso), dw = dowOf(iso); let n = 0;
      const texts = MEALS.map(([k]) => { const st = mealState(v, k); if (st !== "open" && st !== "skip") n++; return st === "plan" ? mealText(dw, k) : st === "custom" ? String(v.custom[k].text || "") : ""; }).concat(v.extra.map(x => String(x.text || "")));
      for (const f of FOOD) cnt[f.id] += texts.filter(x => x && f.re.test(x)).length;
      perDay.push({ iso, n, logged: !!S.days[iso] && intake(iso).logged }); }
    return { cnt, perDay };
  }
  function pageSettimana() {
    const w = weekFood(), logged = w.perDay.filter(d => d.logged).length, closed = w.perDay.map(d => data.day(d.iso)).filter(d => d.closed && d.logged);
    let verdict = `${logged} giorni segnati su 7`;
    if (!minor() && closed.length) { const diff = Math.round(closed.reduce((s, d) => s + d.kcal - d.kcalT, 0) / closed.length / 10) * 10;
      verdict = Math.abs(diff) < 100 ? "In linea con il piano" : `${diff < 0 ? "Sotto" : "Sopra"} di circa ${nf(Math.abs(diff), 0)} calorie al giorno`; }
    const chart = ui.card(ui.big(`${logged} <span class="v3-of">/7</span>`, "Giorni con i pasti segnati") + ui.chart.bars({ vals: w.perDay.map(d => d.n), max: 5, ticks: [[5, "5", true], [0, "0"]],
      xl: [[0, ui.dLab(w.perDay[0].iso)], [6, "oggi"]], tip: i => `${ui.dLab(w.perDay[i].iso)}: ${w.perDay[i].n} pasti segnati`, aria: "Pasti segnati negli ultimi 7 giorni" }));
    const rows = FOOD.map(f => ui.row({ title: `${f.name} · ${w.cnt[f.id]} ${w.cnt[f.id] === 1 ? "volta" : "volte"}`, sub: f.hint, act: "why", arg: f.id, apri: "Perché?" })).join("");
    return ui.back() + title("La mia settimana", verdict) + chart + ui.section("Cibi importanti", rows) +
      ui.end("Il piano conta sulla media della settimana, non sul singolo giorno.", { leoQ: "Come sto mangiando questa settimana?" });
  }

  /* curiosità scoperte: dai pasti davvero segnati negli ultimi 60 giorni */
  function discovered() {
    const t = today(), seen = new Map();
    for (let i = 0; i < 60; i++) { const iso = addDays(t, -i), v = S.days[iso]; if (!v) continue; const dv = dayV(iso), dw = dowOf(iso);
      for (const [k] of MEALS) if (mealState(dv, k) === "plan") { const c = curFor(mealText(dw, k), iso); if (!seen.has(c.id)) seen.set(c.id, c); } }
    return [...seen.values()];
  }
  function pageCuriosita() {
    const all = discovered();
    if (!all.length) return ui.back() + title("Le mie curiosità", "Ancora nessuna scoperta") + ui.card(ui.big("0", "Segna il primo pasto: qui arriva la prima")) +
      ui.secondary("Vai ai pasti di oggi", "home") + endCur(CUR0);
    const by = {}; all.forEach(c => (by[c.top] = by[c.top] || []).push(c));
    return ui.back() + title("Le mie curiosità", `${all.length} ${all.length === 1 ? "scoperta" : "scoperte"} finora`) +
      Object.keys(by).map(tp => ui.section(tp, by[tp].map(c => ui.row({ title: c.ti, sub: c.t, act: "cur", arg: c.id })).join(""))).join("") +
      ui.end("Ogni pasto che segni ti insegna qualcosa di nuovo.", { leoQ: "Cosa posso imparare sul cibo oggi?" });
  }

  function pageScopri() {
    const w = weekFood(), n = discovered().length, dw = dowOf(today()), pr = mealOf(dw, "pra");
    return ui.back() + title("Scopri di più", "Cosa mangi, cosa impari") +
      `<div class="v3-sec">${ui.row({ title: "La mia settimana", sub: `Legumi ${w.cnt.leg} ${w.cnt.leg === 1 ? "volta" : "volte"} · pesce ${w.cnt.pesce} ${w.cnt.pesce === 1 ? "volta" : "volte"}`, act: "settimana" }) +
      ui.row({ title: "Le mie curiosità", sub: `${n} ${n === 1 ? "scoperta" : "scoperte"} finora`, act: "curiosita" }) +
      (hasMealPlan() ? ui.row({ title: "Il mio piano alimentare", sub: pr ? `Oggi a pranzo: ${pr.t.toLowerCase()}` : "Pasto per pasto, giorno per giorno", act: "piano" }) : ui.row({ title: "Crea il tuo piano", sub: "Oppure carica quello del dietista", act: "crea" }))}</div>` +
      ui.end("Ogni pasto segnato è una cosa in più che sai sul cibo.", { leoQ: "Come funziona un piano alimentare?" });
  }

  /* «Lo sapevi?» e «Perché?»: pagine (non fogli) per restare su una sola voce di history */
  function pageCur(id) {
    const c = CUR.find(x => x.id === id) || CUR0;
    return ui.back() + title(c.ti, "Lo sapevi?") + ui.card(`<p class="v3-cibo-qq">${e(c.t)}</p><p class="v3-rs">${e(c.more)}</p>`) +
      acts(ui.secondary("Ho capito", "back")) + `<div class="v3-end">${ui.leo(c.q)}</div>`;
  }
  function pageWhy(id) {
    const f = FOOD.find(x => x.id === id) || FOOD[0], w = weekFood();
    return ui.back() + title(f.name, `${w.cnt[f.id]} ${w.cnt[f.id] === 1 ? "volta" : "volte"} in 7 giorni`) + ui.card(`<p class="v3-cibo-qq">${e(f.hint)}</p><p class="v3-rs">${e(f.why)}</p>`) +
      acts(ui.secondary("Ho capito", "back")) + `<div class="v3-end">${ui.leo(`Perché sono importanti: ${f.name.toLowerCase()}?`)}</div>`;
  }

  const DOWS = [1, 2, 3, 4, 5, 6, 0], DLAB = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  function pagePiano() {
    const td = dowOf(today()); if (pianoDow == null) pianoDow = td;
    const meals = MEALS.filter(([k]) => mealOf(pianoDow, k));
    const rows = meals.map(([k, l]) => { const m = mealOf(pianoDow, k); return ui.row({ title: l, sub: m.t, act: "lg", arg: "diet", apri: "Modifica" }); }).join("") || ui.card(ui.big("–", "Nessun pasto previsto in questo giorno"));
    const tot = MEALS.reduce((s, [k]) => s + nutOf(pianoDow, k).kcal, 0), d = S.diet || {};
    const src = d.creato ? "Creato con le tue risposte" : d.fonte === "piano" ? "Dal dietista" : "Il tuo piano";
    const when = d.creatoIl ? " · " + new Date(d.creatoIl).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
    return ui.back() + title("Il mio piano", src + when) +
      `<div class="v3-sec v3-cibo-pact">${ui.row({ title: "Crea un nuovo piano", sub: "Rispondi alle domande e lo preparo", act: "crea", apri: "Inizia" })}${`<button class="v3-row" data-act="redo" data-v="3" aria-label="Carica il piano del dietista"><span class="v3-rx"><span class="v3-rt" style="display:block">Carica il piano del dietista</span><span class="v3-rs" style="display:block">Da foto o file PDF</span></span><span class="v3-apri" aria-hidden="true">Carica</span></button>`}</div>` +
      `<div class="v3-cibo-seg">${ui.seg(DLAB, DOWS.indexOf(pianoDow), "dow", "Giorno della settimana")}</div>` +
      ui.section(`${pianoDow === td ? "Il piano di oggi" : "Pasti di " + DOW[pianoDow].toLowerCase()}${kid() ? "" : ` · ${nf(tot, 0)} calorie`}`, rows) +
      acts(ui.secondary("I miei alimenti", "lg", "")) +
      ui.end("Le quantità del piano sono a crudo: pesale prima di cuocere.", { leoQ: "Perché si pesa a crudo?" });
  }

  /* ============================== REGISTRAZIONE ============================== */
  V3.register("cibo", {
    /* V3.go("cibo", { meal: k }) apre direttamente il pasto k */
    enter(o) { if (o && o.meal && MEALS.some(m => m[0] === o.meal)) open({ p: "pasto", k: o.meal }); },
    render(el) {
      const p = top();
      if (p && p.p === "guida") return false; // guida flessibile della vista vecchia
      if (p && p.p === "quiz") { if (window.V3Quiz && V3Quiz.cur) { el.innerHTML = V3Quiz.html(); return; } }
      const plan = hasMealPlan();
      if (!p) { el.innerHTML = plan ? mainPlan() : mainNoPlan(); if (plan) bindCaro(el); return; }
      el.innerHTML = p.p === "giornata" ? pageGiornata() : p.p === "pasto" ? pagePasto(p.k) : p.p === "learned" ? pageLearned(p.k) : p.p === "numeri" ? pageNumeri()
        : p.p === "scopri" ? pageScopri() : p.p === "settimana" ? pageSettimana() : p.p === "curiosita" ? pageCuriosita() : p.p === "piano" ? pagePiano() : p.p === "cur" ? pageCur(p.id) : p.p === "why" ? pageWhy(p.id) : (plan ? mainPlan() : mainNoPlan());
    },
    on: Object.assign({}, window.V3Quiz ? V3Quiz.on : {}, {
      dot(i) { const c = document.querySelector("#view .v3-cibo-caro"); ci = +i; if (c && c._mark) { c._mark(ci); c._center(ci, true); } },
      eat(k) { markEaten(k); ci = null; toast(`${LAB(k)} segnato`, { sub: numLine(mealNums(dowOf(today()), k)), undo: () => { unmark(k); V3.go("cibo"); } }); const t = top(); if (t && t.p === "learned") { V3.refresh(); return; } if (t && t.p === "pasto") replace({ p: "learned", k }); else open({ p: "learned", k }); },
      unmark(k) { // 28/10: conferma prima di rimettere il pasto tra quelli da fare (tavola 24)
        let done = false; const p = top(), st = stOf(today(), k), v = dayV(today()), what = st === "custom" ? `Si cancellano «${v.custom[k].text}» e i suoi numeri di oggi.` : st === "skip" ? "Si cancella il segno «non mangiato»." : "Si cancellano il segno e i numeri di oggi.", art = { col: "la", spu: "lo", pra: "il", mer: "la", cen: "la" }[k] || "il", fem = art === "la";
        const sh = V3.sheet(`<h2 class="v3-sh1">Rimetti ${art} ${LAB(k).toLowerCase()} tra i pasti da fare?</h2><p class="v3-shp">${e(what)}</p><button class="v3-apri wide" data-v3act="ok">Sì, rimetti tra i pasti da fare</button><button class="v3-b2" data-v3act="close">No, ${fem ? "lasciala segnata" : "lascialo segnato"}</button>`,
          { label: "Rimetti tra i pasti da fare", on: { ok() { done = true; unmark(k); sh.close(); } },
            onClose: () => { if (!done) return; setTimeout(() => { if (p && p.p === "learned") V3.go("cibo"); else V3.refresh(); toast(`${LAB(k)} di nuovo da fare`, { sub: `Puoi ${fem ? "segnarla" : "segnarlo"} quando vuoi` }); }, 60); } });
      },
      qty(k) { editQty(k); },
      quiz(j) { const p = top(), iso = today(), z = quizFor(mealText(dowOf(iso), p.k), iso); quizSet(iso, { k: p.k, j: +j, ok: +j === z.a, skip: +j < 0 }); V3.refresh(); },
      home() { V3.go("cibo"); },
      giornata() { open({ p: "giornata" }); },
      pasto(k) { open({ p: "pasto", k }); },
      numeri() { open({ p: "numeri" }); },
      scopri() { open({ p: "scopri" }); },
      settimana() { open({ p: "settimana" }); },
      curiosita() { open({ p: "curiosita" }); },
      piano() { pianoDow = null; open({ p: "piano" }); },
      crea() { if (!window.V3Quiz) return open({ p: "guida" }); V3Quiz.start(V3Quiz.cfg.piano()); open({ p: "quiz" }); },
      per(i) { numPer = +i; V3.refresh(); },
      dow(i) { pianoDow = DOWS[+i]; V3.refresh(); },
      lg(hub) { V3.legacy({ tab: "piano", hub }); },
      cur(id) { open({ p: "cur", id }); },
      why(id) { open({ p: "why", id }); }
    })
  });
})();
