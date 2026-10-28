"use strict";
/* Askesis v3 · Tappa C (28/10): motore unico dei questionari + domande condivise (profilo e PAR-Q+) + tre questionari:
   «Crea una nuova scheda» (Essenziale 15 / Intermedio 25 / Completo 40, askesis-ux/QUESTIONARIO_SCHEDA_V2.md),
   «Aggiungi una seduta» (4 domande), «Crea un nuovo piano» (15 / 25 / 40, askesis-ux/QUESTIONARIO_PIANO_V2.md).
   Ogni domanda porta il suo numero nel documento (n), i profili (p: b bambino ≤13, r ragazzo 14-17, a adulto 18-64, o over 65)
   e la fonte (src, sigle nella tabella FONTI). «Domanda n di N» conta SOLO le domande che si vedono davvero (condizioni comprese).
   Dati del profilo (età, sesso, altezza, peso) chiesti una volta e salvati nel profilo; PAR-Q+ condiviso, valido 12 mesi, poi solo
   «È cambiato qualcosa?». Bambino: niente scheda né piano automatici, solo indicazioni educative. Ragazzo: scheda solo con istruttore,
   piano senza obiettivi di peso. Bandiere rosse → niente generazione. Generazione con Gemini (S.sample.json), anteprima e conferma.
   Scritture solo con le funzioni dell'app: persistDoc, setTraining/applyAll, saveDrafts, persistState, lsSet su chiavi proprie
   (v3_quiz_<id> = risposte in corso, v3_parq = ultime risposte sulla salute). */
(function () {
  if (!window.V3) return;
  const { ui } = V3;
  const e = ui.esc, nf = ui.nf;
  const PQ = "v3_parq";

  /* ---------- fonti (sigle usate nel campo src di ogni domanda) ---------- */
  const FONTI = {
    who: "OMS, Guidelines on physical activity and sedentary behaviour 2020 · https://www.who.int/publications/i/item/9789240015128",
    min: "Ministero della Salute, Linee di indirizzo sull'attività fisica 2021 · https://www.salute.gov.it/imgs/C_17_notizie_5693_1_file.pdf",
    isscad: "ISS EpiCentro, PASSI d'Argento, cadute negli over 64 · https://www.epicentro.iss.it/passi-argento/dati/cadute",
    parq: "PAR-Q+ Collaboration, PAR-Q+ rev. 01-11-2024 (© 2025) · https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf",
    acsm09: "ACSM Position Stand 2009, Progression models in resistance training · https://pubmed.ncbi.nlm.nih.gov/19204579/",
    acsm26: "ACSM Position Stand 2026, Resistance training prescription in healthy adults · https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/",
    acsmscr: "Riebe et al., ACSM preparticipation screening 2015 · https://doi.org/10.1249/MSS.0000000000000664",
    garber: "Garber et al., ACSM Position Stand 2011 · https://pubmed.ncbi.nlm.nih.gov/21694556/",
    nscay: "NSCA, Youth resistance training 2009 · https://pubmed.ncbi.nlm.nih.gov/19620931/",
    ltad: "NSCA, Long-term athletic development 2016 · https://pubmed.ncbi.nlm.nih.gov/26933920/",
    frag: "Fragala et al., NSCA, Resistance training for older adults 2019 · https://pubmed.ncbi.nlm.nih.gov/31343601/",
    dm14: "DM 8/8/2014, certificati per attività sportiva non agonistica · https://basilicata.coni.it/images/basilicata/DM_08Ago2014_certificazione.pdf",
    crea: "CREA, Linee guida per una sana alimentazione 2018 · https://www.crea.gov.it/documents/59764/0/LINEE-GUIDA+DEFINITIVO.pdf",
    dossier11: "CREA, Dossier scientifico cap. 11 · https://www.crea.gov.it/documents/59764/0/Dossier+LG+2017_CAP11.pdf",
    larn: "SINU, LARN tabelle riassuntive 2025 · http://sinu.it/wp-content/uploads/2025/07/Tabelle-riassuntive_online.pdf",
    whogrowth: "OMS, Growth reference 5-19 anni · https://www.who.int/tools/growth-reference-data-for-5to19-years",
    ue1169: "Reg. UE 1169/2011, Allegato II · https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32011R1169",
    celiachia: "Ministero della Salute, celiachia · https://www.salute.gov.it/new/it/faq/faq-la-celiachia-impariamo-conviverci/",
    gravidanza: "ISSalute, gravidanza · https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/g/gravidanza",
    diabete: "ISS, linea guida SID-AMD terapia diabete tipo 2 · https://www.iss.it/-/snlg-terapia-diabete-tipo2",
    reni: "ISSalute, insufficienza renale · https://www.issalute.it/index.php/la-salute-dalla-a-alla-z-menu/i/insufficienza-renale",
    scoff: "Morgan e coll., SCOFF, BMJ 1999 · https://doi.org/10.1136/bmj.319.7223.1467",
    scoffit: "Pannocchia e coll., SCOFF italiano 2011 · https://doi.org/10.1002/erv.1105",
    passi: "ISS, Report PASSI 2023-2024 · https://www.epicentro.iss.it/passi/pdf2026/Report%20PASSI%202023-2024.pdf",
    pda: "ISS EpiCentro, PASSI d'Argento · https://www.epicentro.iss.it/passi-argento/",
    whodiet: "OMS, Healthy diet 2026 · https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
    whosugars: "OMS, Sugars intake 2015 · https://www.who.int/publications/i/item/9789241549028",
    whosodium: "OMS, Sodium intake 2012 · https://www.who.int/publications/i/item/9789241504836",
    okkio: "ISS, OKkio alla SALUTE, questionario genitori · https://www.epicentro.iss.it/okkioallasalute/pdf2016/12_D8%20Questionario%20genitori.pdf",
    efsacaff: "EFSA, caffeina 2015 · https://doi.org/10.2903/j.efsa.2015.4102",
    efsaprot: "EFSA, proteine 2012 · https://doi.org/10.2903/j.efsa.2012.2557",
    espen: "ESPEN, practical guideline geriatria 2022 · https://doi.org/10.1016/j.clnu.2022.01.024",
    glim: "GLIM, criteri di malnutrizione 2019 · https://doi.org/10.1016/j.clnu.2018.08.002",
    iodio: "ISS EpiCentro, iodoprofilassi · https://www.epicentro.iss.it/iodio/",
    mindna: "Ministero della Salute, disturbi della nutrizione e dell'alimentazione · https://www.salute.gov.it/new/it/tema/salute-mentale/classificazione-dei-disturbi-della-nutrizione-e-dellalimentazione-dna/",
    issdca: "ISS, piattaforma disturbi alimentari · https://piattaformadisturbialimentari.iss.it/"
  };

  /* ---------- stile ---------- */
  if (!document.getElementById("v3-quiz")) {
    const st = document.createElement("style"); st.id = "v3-quiz";
    st.textContent = `
    #view.v3 .qz-pg { display: flex; flex-direction: column; gap: 28px; min-height: calc(100vh - 136px); min-height: calc(100dvh - 136px); }
    body:has(#view.v3 .qz-pg) #v3bar { display: none; } /* 28/10: questionario = percorso a tutto schermo, si esce con «Esci» */
    #view.v3 .qz-pg > .qz-go { margin-top: auto; }
    #view.v3 .qz-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    #view.v3 .qz-prog { padding-left: 16px; display: flex; flex-direction: column; gap: 8px; }
    #view.v3 .qz-prog span { font-size: 15px; color: var(--v3-t2); font-variant-numeric: tabular-nums; }
    #view.v3 .qz-bar i { background: var(--accent); }
    #view.v3 .qz-h { padding-left: 16px; display: flex; flex-direction: column; gap: 6px; }
    #view.v3 .qz-q { font-size: 24px; font-weight: 800; line-height: 1.2; }
    #view.v3.v3-o65 .qz-q { font-size: 26px; }
    #view.v3 .qz-h .v3-sub { padding-left: 0; margin-top: 0; }
    #view.v3 .qz-opts { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-opt { background: var(--v3-s1); border: 0; border-radius: 18px; min-height: 72px; padding: 12px 12px 12px 16px; display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; color: var(--v3-t1); box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    #view.v3 .qz-opt[aria-checked="true"] { background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); }
    #view.v3 .qz-opt .v3-rt { font-size: 17px; } #view.v3 .qz-opt .v3-rs { font-size: 15px; }
    #view.v3 .qz-rad { width: 52px; flex: none; display: flex; justify-content: center; }
    #view.v3 .qz-rad i { width: 22px; height: 22px; border-radius: 11px; box-shadow: inset 0 0 0 2px var(--v3-t3); display: block; position: relative; box-sizing: border-box; }
    #view.v3 .qz-opt[aria-checked="true"] .qz-rad i { box-shadow: inset 0 0 0 2px var(--accent); }
    #view.v3 .qz-opt[aria-checked="true"] .qz-rad i::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--accent); }
    #view.v3 .qz-opt[role="checkbox"] .qz-rad i { border-radius: 6px; }
    #view.v3 .qz-opt[role="checkbox"][aria-checked="true"] .qz-rad i { background: var(--accent); }
    #view.v3 .qz-opt[role="checkbox"][aria-checked="true"] .qz-rad i::after { inset: 0; background: none; content: "✓"; color: var(--v3-ink); font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
    #view.v3 .qz-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    #view.v3 .qz-chip { min-height: 52px; border-radius: 16px; border: 0; background: var(--v3-s1); color: var(--v3-t1); font-size: 16px; font-weight: 600; padding: 8px 14px 8px 16px; text-align: left; display: flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; line-height: 1.2; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    #view.v3 .qz-chip[aria-pressed="true"], #view.v3 .qz-chip[aria-checked="true"] { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); }
    #view.v3 .qz-note { padding-left: 16px; font-size: 15px; color: var(--v3-t2); line-height: 1.35; }
    #view.v3 .qz-go[aria-disabled="true"] { opacity: .45; }
    #view.v3 .qz-acts { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-pg .v3-row .v3-apri { width: 96px; min-width: 96px; padding: 0; }
    #view.v3 .qz-numw { display: flex; align-items: center; gap: 12px; background: var(--v3-s1); border-radius: 18px; min-height: 72px; padding: 0 16px; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, transparent); }
    #view.v3 .qz-numw input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--v3-t1); font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; height: 60px; outline: none; }
    #view.v3 .qz-numw label { font-size: 17px; color: var(--v3-t2); white-space: nowrap; }
    #view.v3 .qz-nums { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-yns { display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-ynr { background: var(--v3-s1); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-ynr .v3-rt { font-size: 16px; font-weight: 600; line-height: 1.35; } #view.v3 .qz-ynr .v3-rs { font-size: 15px; }
    #view.v3 .qz-yn { display: grid; grid-template-columns: 1fr 1fr; border-radius: 16px; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); overflow: hidden; }
    #view.v3 .qz-yn button { min-height: 40px; border: 0; background: transparent; color: var(--accent); font-size: 15px; font-weight: 700; }
    #view.v3 .qz-yn button + button { box-shadow: inset 1px 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
    #view.v3 .qz-yn button[aria-checked="true"] { background: color-mix(in srgb, var(--accent) 28%, transparent); color: var(--v3-t1); }
    #view.v3 .qz-key .card { background: var(--v3-s1); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    #view.v3 .qz-key .card h2 { font-size: 17px; margin: 0; }
    #view.v3 .qz-key .ghost { min-height: 48px; border-radius: 24px; font-size: 15px; font-weight: 700; border: 0; width: 100%; background: transparent; box-shadow: inset 0 0 0 2px var(--accent); color: var(--v3-t1); }
    #view.v3 .qz-src { padding-left: 16px; font-size: 13px; color: var(--v3-t3); line-height: 1.35; }
    `;
    document.head.appendChild(st);
  }

  /* ---------- utilità ---------- */
  const prof = () => S.profile || {};
  const age = () => +prof().eta || null;
  /* profilo: b bambino ≤13, r ragazzo 14-17, a adulto 18-64, o over 65 (età sconosciuta = adulto finché non risponde) */
  const grp = () => { const a = age(); return a == null ? "a" : a <= 13 ? "b" : a <= 17 ? "r" : a >= 65 ? "o" : "a"; };
  const minorP = () => { const a = age(); return !!(a && a < 18); };
  const over65 = () => (age() || 0) >= 65;
  const female = () => prof().sesso === "f";
  const bmiOf = () => { const p = prof(); return p.peso && p.altezza ? +p.peso / Math.pow(+p.altezza / 100, 2) : null; };
  const pl = (n, one, many) => n + " " + (n === 1 ? one : many);
  const opt = (v, t, s, x) => [v, t, s || null, !!x];
  const slug = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const L = (...xs) => xs.map(x => Array.isArray(x) ? opt(x[0], x[1], x[2]) : opt(slug(x), x));
  const NONE = (t = "Nessuna", v = "no") => opt(v, t, null, true);
  const optsOf = (q, a) => (typeof q.opts === "function" ? q.opts(a) : q.opts) || [];
  const txt = (v, a) => (typeof v === "function" ? v(a) : v);
  const none = v => v === "no" || v === "nessuno";
  const yes = (a, id) => Array.isArray(a[id]) && a[id].some(x => !none(x));
  const labOf = (q, a) => { const v = a[q.id];
    if (q.type === "num") return v === "nonso" ? "non lo so" : v + (q.unit ? " " + q.unit : "");
    if (q.type === "nums") return v && v.nonso ? "non lo so" : Object.entries(v || {}).filter(([k, x]) => k !== "nonso" && x).map(([k, x]) => k + " " + x + " kg").join(", ");
    if (q.type === "yn") return Object.entries(v || {}).map(([k, x]) => (+k + 1) + " " + x).join(", ");
    const O = optsOf(q, a), f = x => { const o = O.find(o => String(o[0]) === String(x)); return o ? o[1] : String(x); };
    return Array.isArray(v) ? v.map(f).join(", ") : f(v); };
  const minsOf = sd => Math.max(20, Math.round((sd.esercizi.reduce((m, x) => m + x.serie * ((+x.recupero || 90) + 40), 0) / 60 + 10) / 5) * 5);
  const restTxt = s => { const m = Math.floor(s / 60), r = s % 60; return m ? m + (r ? ":" + String(r).padStart(2, "0") : "") + " min" : r + " s"; };
  const LETTER = i => String.fromCharCode(65 + i);
  const GG = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const dLong = iso => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const setProf = patch => { S.profile = { ...(S.profile || {}), ...patch }; persistDoc("profile", S.profile); };
  const LEVELS = { essenziale: 15, intermedio: 25, completo: 40 };
  const levelPick = what => ({ id: "livello", label: "Quante domande", def: "essenziale",
    opts: [["essenziale", "Essenziale", "Fino a 15 domande, circa 4 minuti"], ["intermedio", "Intermedio", "Fino a 25 domande, " + what + (/^la /.test(what) ? " più precisa" : " più preciso")], ["completo", "Completo", "Fino a 40 domande, il più su misura"]] });

  /* ---------- dati del profilo condivisi: chiesti solo se mancano, salvati nel profilo, valgono per scheda e piano ---------- */
  const PROF_QS = (n0, stale) => [
    { n: n0, id: "eta", type: "num", min: 1, max: 110, unit: "anni", q: "Quanti anni hai?", sub: "Lo chiedo una volta sola", need: () => !age(),
      after(a) { setProf({ eta: Math.round(a.eta) }); }, src: "larn who" },
    { n: n0 + 1, id: "sesso", q: "Per il calcolo serve il sesso: sei donna o uomo?", sub: "La formula del metabolismo e i valori LARN lo richiedono",
      opts: L(["f", "Donna"], ["m", "Uomo"]), need: () => !["f", "m"].includes(prof().sesso), after(a) { setProf({ sesso: a.sesso }); }, src: "larn" },
    { n: n0 + 2, id: "altezza", type: "num", min: 80, max: 230, unit: "cm", q: "Quanto sei alto, in centimetri?", need: () => !prof().altezza,
      after(a) { setProf({ altezza: Math.round(a.altezza) }); }, src: "crea whogrowth" },
    { n: n0 + 3, id: "peso", type: "num", min: 20, max: 300, unit: "kg", dec: true, q: "Quanto pesi oggi, in chili?", def: () => prof().peso || null,
      need: () => !prof().peso || (stale && weightStale()), after(a) { setProf({ peso: Math.round(a.peso * 10) / 10 }); }, src: "crea larn" }
  ];
  function weightStale() { // peso «vecchio» per il piano: nessuna pesata negli ultimi 30 giorni
    try { const w = weights(); return !w.length || Date.now() - Date.parse(w[w.length - 1].date) > 30 * 864e5; } catch (_) { return false; }
  }

  /* ---------- PAR-Q+, domande generali (pagina 1). Testo FEDELE alla versione ufficiale in vigore
     (PAR-Q+ Collaboration, revisione 01-11-2024, © 2025, https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf).
     Una traduzione italiana ufficiale NON esiste (verificato su https://eparmedx.com/print-versions-of-par-q/languages/ il 28/10/2026:
     ci sono portoghese, cinese, tedesco, gujarati, malese, spagnolo, turco, vietnamita): qui c'è la traduzione letterale, frase per frase,
     senza parafrasi, con le due avvertenze ufficiali delle domande 3 e 6. Le righe «PLEASE LIST CONDITION(S) HERE» non servono:
     un sì ferma comunque la generazione (l'app non fa le pagine 2 e 3). Validità 12 mesi (dichiarazione del partecipante). ---------- */
  const PARQ = [
    ["Il tuo medico ti ha mai detto che hai una malattia del cuore OPPURE la pressione alta?", null, "Has your doctor ever said that you have a heart condition OR high blood pressure?"],
    ["Senti dolore al petto a riposo, durante le attività della vita quotidiana OPPURE quando fai attività fisica?", null, "Do you feel pain in your chest at rest, during your daily activities of living, OR when you do physical activity?"],
    ["Perdi l'equilibrio a causa di capogiri OPPURE hai perso conoscenza negli ultimi 12 mesi?", "Rispondi NO se il capogiro era legato a una respirazione eccessiva (anche durante un esercizio intenso).", "Do you lose balance because of dizziness OR have you lost consciousness in the last 12 months? Please answer NO if your dizziness was associated with over-breathing (including during vigorous exercise)."],
    ["Ti è mai stata diagnosticata un'altra malattia cronica (diversa da una malattia del cuore o dalla pressione alta)?", null, "Have you ever been diagnosed with another chronic medical condition (other than heart disease or high blood pressure)?"],
    ["Attualmente prendi farmaci prescritti per una malattia cronica?", null, "Are you currently taking prescribed medications for a chronic medical condition?"],
    ["Hai attualmente (o hai avuto negli ultimi 12 mesi) un problema a ossa, articolazioni o tessuti molli (muscoli, legamenti o tendini) che potrebbe peggiorare se diventi più attivo fisicamente?", "Rispondi NO se hai avuto un problema in passato, ma oggi non limita la tua capacità di essere fisicamente attivo.", "Do you currently have (or have had within the past 12 months) a bone, joint, or soft tissue (muscle, ligament, or tendon) problem that could be made worse by becoming more physically active? Please answer NO if you had a problem in the past, but it does not limit your current ability to be physically active."],
    ["Il tuo medico ti ha mai detto che dovresti fare solo attività fisica sotto controllo medico?", null, "Has your doctor ever said that you should only do medically supervised physical activity?"]
  ];
  const parqFresh = () => { const p = lsGet(PQ, null); return p && p.at && Date.now() - Date.parse(p.at) < 365 * 864e5 ? p : null; };
  const PARQ_QS = n => [
    { n, id: "parq_chg", show: a => !!a._pq, q: "Sulla salute è cambiato qualcosa dall'ultima volta?", sub: a => "Hai risposto alle 7 domande del PAR-Q+ il " + dLong(a._pq),
      opts: [opt("no", "No, è tutto uguale"), opt("si", "Sì, qualcosa è cambiato", "Rispondi di nuovo alle 7 domande")], src: "parq" },
    { n, id: "parq", type: "yn", noAi: true, show: a => !a._pq || a.parq_chg === "si", q: "Sette domande sulla salute",
      sub: () => grp() === "b" ? "Le risposte le dà un genitore" : "Rispondi sì o no a ogni domanda", items: PARQ,
      note: "Domande del PAR-Q+ (PAR-Q+ Collaboration, revisione 01-11-2024), tradotte alla lettera: una versione italiana ufficiale non esiste.",
      after(a) { lsSet(PQ, { at: new Date().toISOString(), v: 2, yes: Object.entries(a.parq || {}).filter(([, x]) => x === "si").map(([k]) => "p" + k) }); }, src: "parq" }
  ];
  /* sì alla salute: risposta nuova, oppure «non è cambiato niente» su un sì salvato */
  function parqYes(a) {
    if (a.parq && typeof a.parq === "object" && (!a._pq || a.parq_chg === "si")) return Object.values(a.parq).includes("si");
    if (a.parq_chg === "no") { const p = parqFresh(); return !!(p && p.yes && p.yes.length); }
    return false;
  }

  /* ---------- pagine di arresto (testo breve, non spaventa, dice cosa fare dopo) ---------- */
  const loadTrain = '<button class="v3-apri wide" data-act="redo" data-v="2">Carica la scheda</button>';
  const loadDiet = '<button class="v3-apri wide" data-act="redo" data-v="3">Carica il piano del dietista</button>';
  const noT = "Non preparo la scheda in automatico", noD = "Non preparo il piano in automatico";
  const T_ = (title, line, o = {}) => ({ title, sub: noT, line, acts: loadTrain, fix: true, ...o });
  const D_ = (title, line, o = {}) => ({ title, sub: noD, line, acts: loadDiet, fix: true, leoQ: "Perché serve un professionista per il piano?", ...o });
  const STOP = {
    medicoT: T_("Prima parlane con il medico", "Ti dirà cosa puoi fare, poi carica qui la scheda."),                                   // R1
    sintomiT: T_("Prima fai un controllo", "Questi segnali vanno fatti vedere al medico prima di allenarti."),                       // R2
    gravT: T_("Il piano lo decide chi ti segue", "In gravidanza muoversi fa bene, ma il piano lo decide chi ti segue."),             // R3
    intervT: T_("Prima senti il medico", "Dopo un intervento chiedi al medico quando e come ripartire."),                              // R4
    malannoT: T_("Aspetta di stare meglio", "Poi rifai la scheda: le risposte restano salvate.", { sub: "Rimandiamo di qualche giorno", acts: "" }), // R5
    doloreT: T_("Prima fai vedere il dolore", "Con un dolore che ti limita serve prima un medico o un fisioterapista.", { leoQ: "Cosa faccio se sento dolore in palestra?" }), // R6
    caduteT: T_("Prima un controllo", "Dopo una caduta serve un controllo prima degli esercizi di forza."),                           // R7
    istruttoreT: T_("Serve un istruttore", "Sotto i 18 anni i pesi si fanno con un istruttore. Chiedi in palestra.", { sub: "Sotto i 18 anni" }), // R8
    minorT: { title: "La seduta la prepara il tuo allenatore", sub: "Sotto i 18 anni", line: "Serve chi ti segue di persona. Poi caricala qui.", acts: loadTrain },
    tantiT: { title: "La scheda ha già 7 sedute", sub: "È il massimo per una settimana", line: "Togli una seduta prima di aggiungerne un'altra.", acts: "" },
    medicoD: D_("Prima parlane con il medico", "Hai risposto sì sulla salute: prima serve l'ok del medico."),                         // bandiera 9
    dcaD: D_("Parliamone con il medico", "Alcune risposte meritano attenzione: parlane con il tuo medico.", { dca: true, leoQ: null }), // 2, 3
    sottoD: D_("Prima senti il medico", "L'indice di massa corporea è sotto 18,5: il piano lo decide il medico."),                    // 4
    gravD: D_("Il piano lo fa chi ti segue", "In gravidanza o allattamento serve ginecologo, ostetrica o dietista. Non serve mangiare per due."), // 5
    diabD: D_("Il piano lo fa il diabetologo", "Con farmaci o insulina carboidrati e orari dipendono dalla terapia."),                // 6
    reniD: D_("Il piano lo fa il medico", "Con reni o fegato da curare proteine e sale li decide il medico."),                        // 7
    prescrD: D_("Vale la dieta del medico", "Con questa condizione vale la prescrizione del medico: caricala qui."),                  // 8
    nutrD: D_("Parlane con il medico di famiglia", "Alcune risposte dicono che mangi meno del necessario: serve un controllo."),      // 10
    o65D: D_("Per dimagrire serve il medico", "Dopo i 65 anni si perde peso solo con il medico: protegge muscoli e ossa."),          // 11
    caloD: D_("Prima un controllo", "Un calo di peso senza volerlo va fatto vedere al medico.")                                       // 12
  };

  /* ============================== MOTORE ============================== */
  const Q = window.V3Quiz = { cur: null, cfg: {}, PARQ, parqFresh, FONTI };
  /* visibili = livello scelto (n ≤ 15/25/40) + profilo + dati mancanti + condizione. Il contatore conta SOLO queste. */
  const vis = r => r.cfg.qs.filter(q => (!q.n || !r.a.livello || q.n <= LEVELS[r.a.livello]) && (!q.p || q.p.includes(grp())) && (!q.need || (r.a._need || []).includes(q.id)) && (!q.show || q.show(r.a)));
  const save = r => lsSet(r.key, { a: r.a, i: r.i, at: new Date().toISOString() });
  const paint = (r, top = true) => { if (Q.cur !== r) return; if (top) window.scrollTo(0, 0); V3.refresh(); };
  function ensure(r, q) { if (r.a[q.id] === undefined && q.def) { const d = q.def(r.a); if (d != null) r.a[q.id] = d; } }
  function answered(r, q) {
    const v = r.a[q.id];
    if (q.type === "num") return v === "nonso" || (typeof v === "number" && v >= q.min && v <= q.max);
    if (q.type === "nums") return !!v && (v.nonso || Object.entries(v).some(([k, x]) => k !== "nonso" && x > 0));
    if (q.type === "yn") return !!v && q.items.every((_, i) => v[i]);
    return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
  }
  /* snapshot all'avvio: quali dati del profilo mancano e se il PAR-Q+ è ancora valido (così la lista non cambia mentre rispondi) */
  const initA = (r, a) => { if (a._pq === undefined) { const p = parqFresh(); a._pq = p ? p.at : null; }
    if (!a._need) a._need = r.cfg.qs.filter(q => q.need && q.need()).map(q => q.id); return a; };

  Q.start = function (cfg) {
    const key = "v3_quiz_" + cfg.id, sv = lsGet(key, null);
    const r = { cfg, key, a: {}, i: 0, phase: cfg.intro ? "intro" : "q", saved: sv && sv.a && Object.keys(sv.a).some(k => k[0] !== "_" && k !== "livello") ? sv : null, res: null, err: null, stop: null, ac: null };
    const pk = cfg.intro && cfg.intro.pick;
    if (pk) r.a[pk.id] = (sv && sv.a && sv.a[pk.id]) || pk.def;
    if (!cfg.intro && r.saved) { r.a = r.saved.a; r.i = Math.max(0, Math.min(r.saved.i || 0, vis(r).length - 1)); }
    initA(r, r.a);
    const st0 = cfg.flag && cfg.flag(r.a, true);
    if (st0) { r.phase = "stop"; r.stop = st0; r.stopFrom = "start"; }
    else if (cfg.edu && grp() === "b") r.phase = "edu";
    Q.cur = r; return r;
  };

  /* ---------- pagine ---------- */
  function body(r, q) {
    const v = r.a[q.id], many = q.type === "many", O = optsOf(q, r.a), qt = e(txt(q.q, r.a));
    if (q.type === "num") return `<div class="qz-numw"><input class="qz-num" id="qz-num" data-k="" inputmode="${q.dec ? "decimal" : "numeric"}" autocomplete="off" aria-label="${qt}" value="${typeof v === "number" ? e(String(v).replace(".", ",")) : ""}"><label for="qz-num">${e(q.unit || "")}</label></div>${q.skip ? `<div class="qz-grid"><button class="qz-chip" aria-pressed="${v === "nonso"}" data-v3act="qz-nonso">${v === "nonso" ? "✓ " : ""}${e(q.skip)}</button></div>` : ""}`;
    if (q.type === "nums") return `<div class="qz-nums">${q.fields.map(([k, l]) => `<div class="qz-numw"><input class="qz-num" id="qz-n-${k}" data-k="${k}" inputmode="numeric" autocomplete="off" aria-label="${e(l)} in chili" value="${v && v[k] ? v[k] : ""}"><label for="qz-n-${k}">${e(l)} · kg</label></div>`).join("")}</div><div class="qz-grid"><button class="qz-chip" aria-pressed="${!!(v && v.nonso)}" data-v3act="qz-nonso">${v && v.nonso ? "✓ " : ""}Non lo so</button></div>`;
    if (q.type === "yn") return `<div class="qz-yns">${q.items.map((it, i) => { const x = v && v[i]; return `<div class="qz-ynr"><p class="v3-rt">${i + 1}. ${e(it[0])}</p>${it[1] ? `<p class="v3-rs">${e(it[1])}</p>` : ""}<div class="qz-yn" role="radiogroup" aria-label="Domanda ${i + 1}"><button role="radio" aria-checked="${x === "si"}" data-v3act="qz-yn" data-v3arg="${i}:si">Sì</button><button role="radio" aria-checked="${x === "no"}" data-v3act="qz-yn" data-v3arg="${i}:no">No</button></div></div>`; }).join("")}</div>`;
    const on = x => many ? (v || []).map(String).includes(String(x)) : String(v) === String(x);
    if (q.grid) return `<div class="qz-grid" role="${many ? "group" : "radiogroup"}" aria-label="${qt}">${O.map((o, j) => `<button class="qz-chip" ${many ? `aria-pressed="${on(o[0])}"` : `role="radio" aria-checked="${on(o[0])}"`} data-v3act="qz-pick" data-v3arg="${j}">${on(o[0]) ? "✓ " : ""}${e(o[1])}</button>`).join("")}</div>`;
    return `<div class="qz-opts" role="${many ? "group" : "radiogroup"}" aria-label="${qt}">${O.map((o, j) => `<button class="qz-opt" role="${many ? "checkbox" : "radio"}" aria-checked="${on(o[0])}" data-v3act="qz-pick" data-v3arg="${j}"><span class="v3-rx"><span class="v3-rt" style="display:block">${e(o[1])}</span>${o[2] ? `<span class="v3-rs" style="display:block">${e(o[2])}</span>` : ""}</span><span class="qz-rad" aria-hidden="true"><i></i></span></button>`).join("")}</div>`;
  }
  function qPage(r) {
    const Lq = vis(r); r.i = Math.max(0, Math.min(r.i, Lq.length - 1));
    const q = Lq[r.i], n = Lq.length, num = r.i + 1; ensure(r, q);
    const last = r.i === Lq.length - 1, ok = answered(r, q), many = q.type === "many";
    const sub = txt(q.sub, r.a) || (many ? (q.max ? "Al massimo " + q.max : "Puoi sceglierne più di una") : "");
    return `<div class="qz-pg"><div class="qz-top"><button class="v3-back" data-v3act="qz-prev">‹ Indietro</button><button class="v3-back" data-v3act="qz-exit">Esci</button></div>
      <div class="qz-prog"><span>Domanda ${num} di ${n}</span><div class="v3-bar qz-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${num}" aria-label="Domanda ${num} di ${n}"><i style="width:${Math.round(num / n * 100)}%"></i></div></div>
      <div class="qz-h"><h1 class="qz-q">${e(txt(q.q, r.a))}</h1>${sub ? `<p class="v3-sub">${e(sub)}</p>` : ""}</div>
      ${body(r, q)}${q.note ? `<p class="qz-note">${e(txt(q.note, r.a))}</p>` : ""}
      <button class="v3-apri wide qz-go" data-v3act="qz-next"${ok ? "" : ' aria-disabled="true"'}>${e(last ? (grp() === "b" && r.cfg.edu ? "Fatto" : r.cfg.lastLabel || "Fatto") : "Avanti")}</button></div>`;
  }
  function introPage(r) {
    const it = r.cfg.intro, pk = it.pick, Lq = vis(r);
    const pick = pk ? `<div class="qz-opts" role="radiogroup" aria-label="${e(pk.label)}">${pk.opts.map((o, j) => `<button class="qz-opt" role="radio" aria-checked="${r.a[pk.id] === o[0]}" data-v3act="qz-ipick" data-v3arg="${j}"><span class="v3-rx"><span class="v3-rt" style="display:block">${e(o[1])}</span><span class="v3-rs" style="display:block">${e(txt(o[2], r.a))}</span></span><span class="qz-rad" aria-hidden="true"><i></i></span></button>`).join("")}</div>` : "";
    const rows = (txt(it.rows, r.a) || []).concat(S.sample || grp() === "b" ? [] : [["Ti servirà la chiave di Google", "Gratuita: la inserisci alla fine"]]);
    const resume = r.started || (r.saved && r.saved.i > 0 && (!pk || r.saved.a[pk.id] === r.a[pk.id]));
    const note = grp() === "b" ? "Rispondi insieme a un genitore." : it.note;
    const resN = () => { const t = { cfg: r.cfg, a: r.saved.a }; return Math.min(r.saved.i, vis(t).length - 1) + 1; };
    return `<div class="qz-pg">${ui.back()}<div class="qz-h"><h1 class="qz-q" style="font-size:28px">${e(it.title)}</h1><p class="v3-sub">${e(txt(it.sub, r.a))}</p></div>
      ${pick}${rows.length ? `<div class="v3-sec">${rows.map(x => ui.row({ title: x[0], sub: x[1] })).join("")}</div>` : ""}${note ? `<p class="qz-note">${e(note)}</p>` : ""}
      <div class="qz-acts qz-go">${resume ? `<button class="v3-apri wide" data-v3act="qz-start" data-v3arg="resume">${r.started ? "Continua le domande" : "Riprendi dalla domanda " + resN()}</button>${ui.secondary("Ricomincia da capo", "qz-start", "new")}` : `<button class="v3-apri wide" data-v3act="qz-start" data-v3arg="new">Inizia le domande</button>`}</div></div>`;
  }
  function stopPage(r) {
    const s = r.stop;
    const dca = s.dca ? `<div class="v3-sec"><div class="v3-row"><span class="v3-rx"><span class="v3-rt" style="display:block">SOS Disturbi Alimentari</span><span class="v3-rs" style="display:block">Numero verde 800 180 969, gratuito</span></span><a class="v3-apri" href="tel:800180969" style="width:96px;min-width:96px;padding:0;display:flex;align-items:center;justify-content:center;text-decoration:none">Chiama</a></div><div class="v3-row"><span class="v3-rx"><span class="v3-rt" style="display:block">Servizi vicino a te</span><span class="v3-rs" style="display:block">Mappa dell'Istituto Superiore di Sanità</span></span><a class="v3-apri" href="https://piattaformadisturbialimentari.iss.it/" target="_blank" rel="noopener" style="width:96px;min-width:96px;padding:0;display:flex;align-items:center;justify-content:center;text-decoration:none">Apri</a></div></div>` : "";
    return `<div class="qz-pg"><button class="v3-back" data-v3act="qz-prev">‹ Indietro</button><div class="qz-h"><h1 class="qz-q" style="font-size:28px">${e(s.title)}</h1><p class="v3-sub">${e(s.sub)}</p></div>
      ${ui.card(`<p class="v3-rt">${e(s.line)}</p>`)}${dca}${s.leoQ === null ? "" : ui.leo(s.leoQ || "Cosa posso fare in palestra con un problema di salute?")}
      <div class="qz-acts qz-go">${s.acts}${s.fix && r.stopFrom !== "start" ? ui.secondary("Cambia la risposta", "qz-prev") : ""}${ui.secondary("Esci", "back")}</div></div>`;
  }
  /* bambino ≤13: niente scheda né piano automatici, solo indicazioni educative (+ riepilogo per il pediatra se ha risposto) */
  function eduPage(r) {
    const E = r.cfg.edu(r), done = r.eduDone;
    const recap = done ? ui.section("Da mostrare al pediatra", vis(r).filter(q => !q.noAi && r.a[q.id] != null).slice(0, 40).map(q => ui.row({ title: txt(q.q, r.a), sub: labOf(q, r.a) })).join("")) : "";
    return `<div class="qz-pg"><button class="v3-back" data-v3act="${done ? "qz-prev" : "back"}">‹ Indietro</button><div class="qz-h"><h1 class="qz-q" style="font-size:28px">${e(E.title)}</h1><p class="v3-sub">${e(E.sub)}</p></div>
      ${ui.section(E.label, E.rows.map(x => ui.row({ title: x[0], sub: x[1] })).join(""))}<p class="qz-src">${e(E.src)}</p>${recap}
      <div class="qz-acts qz-go">${E.acts}${done ? "" : ui.secondary("Rispondi alle domande con un genitore", "qz-kidq")}${ui.secondary("Esci", "back")}</div></div>`;
  }
  function keyPage(r) {
    const has = !!S.sample;
    return `<div class="qz-pg"><button class="v3-back" data-v3act="qz-prev">‹ Indietro</button><div class="qz-h"><h1 class="qz-q" style="font-size:30px">${has ? "Leo è attivo" : "Attiva Leo"}</h1><p class="v3-sub">${has ? "Ora posso prepararla" : "Gratis, in 2 minuti · risposte salvate"}</p></div>
      ${has ? ui.row({ title: "Leo usa Google Gemini", sub: "Chiave salvata solo su questo telefono" }) : `<div class="qz-key">${typeof aiKeyBox === "function" ? aiKeyBox({ bare: true }) : ""}</div>`}
      ${has ? `<div class="qz-acts qz-go"><button class="v3-apri wide" data-v3act="qz-gen">${e(r.cfg.lastLabel || "Continua")}</button></div>` : ""}</div>`;
  }
  function genPage(r) {
    return `<div class="qz-pg" style="padding-top:72px"><div class="qz-h"><h1 class="qz-q" style="font-size:28px">${e(r.cfg.genTitle)}</h1><p class="v3-sub">Circa un minuto, resta pure qui</p></div>
      ${ui.card(ui.big(`${vis(r).length} <span class="v3-of">risposte</span>`, "Le uso tutte, una per una"))}
      <div class="qz-acts qz-go">${ui.secondary("Annulla", "qz-cancel")}</div></div>`;
  }
  function errText(err) {
    const c = err && err.code;
    if (c === "network") return ["Non ho raggiunto Google", "Il telefono sembra senza connessione", "Controlla internet e tocca «Riprova»"];
    if (c === "timeout") return ["Google non ha risposto in tempo", "Il servizio è lento o molto carico", "Aspetta un minuto e tocca «Riprova»"];
    if (c === "rate_limited") return ["Richieste gratuite finite per ora", "La chiave gratuita ha un limite di richieste", "Riprova tra qualche minuto o domani"];
    if (c === "upstream_error") return ["Google non ha risposto bene", "Il servizio è sovraccarico o in manutenzione", "Aspetta qualche minuto e tocca «Riprova»"];
    if (c === "bad_key") return ["La chiave di Google non funziona", "Forse è stata copiata male o è scaduta", "Inseriscila di nuovo: le risposte restano"];
    return ["La risposta dell'IA era incompleta", "Capita quando la risposta è lunga", "Tocca «Riprova»: di solito va al secondo tentativo"];
  }
  function errPage(r) {
    const [w, y, d] = errText(r.err), bad = r.err && r.err.code === "bad_key";
    return `<div class="qz-pg"><button class="v3-back" data-v3act="qz-prev">‹ Indietro</button><div class="qz-h"><h1 class="qz-q" style="font-size:28px">Non ci sono riuscito</h1><p class="v3-sub">Le tue risposte sono salvate</p></div>
      <div class="v3-sec">${ui.row({ title: "Cosa è successo", sub: w })}${ui.row({ title: "Perché", sub: y })}${ui.row({ title: "Cosa fare", sub: d })}</div>
      <div class="qz-acts qz-go">${bad ? `<button class="v3-apri wide" data-v3act="qz-rekey">Inserisci di nuovo la chiave</button>` : `<button class="v3-apri wide" data-v3act="qz-gen">Riprova</button>`}${ui.secondary("Rivedi le risposte", "qz-prev")}</div></div>`;
  }
  function prevPage(r) {
    const c = r.cfg, has = c.hasCurrent && c.hasCurrent();
    return `<div class="qz-pg"><button class="v3-back" data-v3act="qz-prev">‹ Indietro</button><div class="qz-h"><h1 class="qz-q" style="font-size:28px">${e(c.prevTitle)}</h1><p class="v3-sub">${e(txt(c.prevSub, r.res) || "")}</p></div>
      ${c.preview(r.res, r)}
      <div class="qz-acts"><button class="v3-apri wide" data-v3act="qz-ok">${e(c.okLabel)}</button>${ui.secondary(has ? c.keepLabel : c.noLabel, "qz-no")}</div></div>`;
  }
  const PAGES = { intro: introPage, q: qPage, stop: stopPage, edu: eduPage, key: keyPage, gen: genPage, err: errPage, prev: prevPage };
  Q.html = () => (Q.cur ? PAGES[Q.cur.phase](Q.cur) : "");

  /* ---------- campi numerici: il valore si legge mentre scrivi, il pulsante si accende quando è valido ---------- */
  document.addEventListener("input", ev => {
    const inp = ev.target; if (!inp.classList || !inp.classList.contains("qz-num")) return;
    const r = Q.cur; if (!r || r.phase !== "q") return;
    const q = vis(r)[r.i]; if (!q || !/^nums?$/.test(q.type)) return;
    const raw = inp.value.replace(",", ".").replace(/[^\d.]/g, ""), x = raw === "" ? null : +raw;
    if (q.type === "num") r.a[q.id] = x;
    else if (q.type === "nums") { const v = Object.assign({}, r.a[q.id] || {}); delete v.nonso; v[inp.dataset.k] = x; r.a[q.id] = v; }
    save(r);
    const go = document.querySelector("#view .qz-go"); if (go) answered(r, q) ? go.removeAttribute("aria-disabled") : go.setAttribute("aria-disabled", "true");
    const ns = document.querySelector('#view [data-v3act="qz-nonso"]'); if (ns && x != null) { ns.setAttribute("aria-pressed", "false"); ns.textContent = q.skip || "Non lo so"; }
  });

  /* ---------- generazione ---------- */
  async function run(r) {
    if (r.cfg.edu && grp() === "b") { r.phase = "edu"; r.eduDone = true; paint(r); return; } // bambino: niente IA
    if (!S.sample) { r.phase = "key"; paint(r); return; }
    r.phase = "gen"; r.err = null; r.ac = new AbortController(); paint(r);
    try { r.res = await r.cfg.generate(r.a, r.ac.signal); r.phase = "prev"; }
    catch (err) {
      if (err && err.code === "cancelled") { r.phase = "q"; r.i = vis(r).length - 1; }
      else { r.err = err && err.code ? err : { code: "invalid" }; r.phase = "err"; }
    }
    r.ac = null; paint(r);
  }
  function next(r) {
    const Lq = vis(r), q = Lq[r.i]; ensure(r, q);
    if (!answered(r, q)) {
      toast(q.type === "num" ? `Scrivi un numero da ${q.min} a ${q.max}` : q.type === "yn" ? "Rispondi sì o no a tutte le domande" : q.type === "many" ? "Scegli almeno una risposta" : q.type === "nums" ? "Scrivi almeno un massimale o tocca «Non lo so»" : "Scegli una risposta per andare avanti"); return; }
    if (q.after) q.after(r.a);
    save(r);
    const st = r.cfg.flag && r.cfg.flag(r.a, false);
    if (st) { r.stop = st; r.stopFrom = "q"; r.phase = "stop"; paint(r); return; }
    const L2 = vis(r), j = L2.indexOf(q);
    if (j >= L2.length - 1) { run(r); return; }
    r.i = j + 1; save(r); paint(r);
  }

  /* ---------- azioni (le sezioni le uniscono ai loro handler) ---------- */
  const R = () => Q.cur;
  Q.on = {
    "qz-start"(mode) { const r = R(); if (!r) return; const pk = r.cfg.intro && r.cfg.intro.pick;
      if (mode === "resume" && r.started) { r.i = 0; }
      else if (mode === "resume" && r.saved) { const lv = pk ? r.a[pk.id] : null; r.a = Object.assign({}, r.saved.a); if (pk) r.a[pk.id] = lv; r.i = r.saved.i || 0; }
      else { const lv = pk ? r.a[pk.id] : null; r.a = {}; if (pk) r.a[pk.id] = lv; r.i = 0; }
      initA(r, r.a); r.started = true; r.phase = "q"; save(r); paint(r); },
    "qz-ipick"(j) { const r = R(); if (!r) return; const pk = r.cfg.intro.pick; r.a[pk.id] = pk.opts[+j][0]; paint(r, false); },
    "qz-kidq"() { const r = R(); if (!r) return; r.phase = r.cfg.intro ? "intro" : "q"; paint(r); },
    "qz-pick"(j) { const r = R(); if (!r) return; const q = vis(r)[r.i], O = optsOf(q, r.a), o = O[+j]; if (!o) return;
      if (q.type === "many") { let v = (r.a[q.id] || []).slice(); const has = v.includes(o[0]);
        if (has) v = v.filter(x => x !== o[0]); else if (o[3]) v = [o[0]];
        else { v = v.filter(x => !(O.find(z => z[0] === x) || [])[3]); if (q.max && v.length >= q.max) { toast("Al massimo " + q.max + ": togline una prima"); return; } v.push(o[0]); }
        r.a[q.id] = v; } else r.a[q.id] = o[0];
      save(r); paint(r, false); },
    "qz-yn"(arg) { const r = R(); if (!r) return; const q = vis(r)[r.i], [i, x] = String(arg).split(":"); r.a[q.id] = Object.assign({}, r.a[q.id] || {}, { [i]: x }); save(r); paint(r, false); },
    "qz-nonso"() { const r = R(); if (!r) return; const q = vis(r)[r.i];
      if (q.type === "nums") r.a[q.id] = r.a[q.id] && r.a[q.id].nonso ? {} : { nonso: true }; else r.a[q.id] = r.a[q.id] === "nonso" ? null : "nonso";
      save(r); paint(r, false); },
    "qz-next"() { const r = R(); if (r) next(r); },
    "qz-prev"() { const r = R(); if (!r) return;
      if (r.phase === "q") { if (r.i > 0) { r.i--; save(r); paint(r); } else if (r.cfg.intro) { r.phase = "intro"; paint(r); } else V3.back(); return; }
      if (r.phase === "stop" && r.stopFrom === "start") { V3.back(); return; }
      if (r.phase === "gen") return;
      if (r.phase !== "stop") r.i = vis(r).length - 1;
      r.phase = "q"; paint(r); },
    "qz-exit"() { const r = R(); if (!r) return; let go = false;
      const sh = V3.sheet(`<h2 class="v3-sh1">Uscire dalle domande?</h2><p class="v3-shp">Le risposte restano salvate: riprendi da qui quando vuoi.</p><button class="v3-apri wide" data-v3act="ok">Sì, esci</button><button class="v3-b2" data-v3act="close">No, continuo</button>`,
        { label: "Uscire dalle domande", on: { ok() { go = true; sh.close(); } }, onClose: () => { if (go) setTimeout(() => V3.back(), 60); } }); },
    "qz-gen"() { const r = R(); if (r) run(r); },
    "qz-cancel"() { const r = R(); if (r && r.ac) r.ac.abort(); },
    async "qz-rekey"() { const r = R(); if (!r) return; setAIKey(""); await setupSite(); r.phase = "key"; paint(r); },
    "qz-ok"() { const r = R(); if (!r || !r.res) return; const t = r.cfg.confirm(r.res, r.a); if (!t) return; lsSet(r.key, null); Q.cur = null; V3.back(); setTimeout(() => toast(t.msg, { sub: t.sub }), 80); },
    "qz-no"() { const r = R(); if (!r) return; lsSet(r.key, null); const t = r.cfg.keepToast; Q.cur = null; V3.back(); if (t) setTimeout(() => toast(t), 80); }
  };

  /* ============================== CONFIGURAZIONI ============================== */
  const TRAIN_JSON = typeof TRAIN_PROMPT === "string" ? TRAIN_PROMPT.slice(TRAIN_PROMPT.indexOf('"muscolo" è')) : "";
  const DIET_JSON = typeof DIET_PROMPT === "string" ? DIET_PROMPT.slice(DIET_PROMPT.indexOf("Rispondi SOLO")) : "";
  const answersTxt = (r, a) => vis({ cfg: r, a }).filter(q => a[q.id] != null && !q.noAi).map(q => `- ${txt(q.q, a)} ${labOf(q, a)}`).join("\n");
  const prLine = () => { const p = prof(); return [p.sesso === "f" ? "donna" : p.sesso === "m" ? "uomo" : null, p.eta ? p.eta + " anni" : null, p.peso ? p.peso + " kg" : null, p.altezza ? p.altezza + " cm" : null].filter(Boolean).join(", "); };
  function trainOut(out) {
    const t = mapTraining(out);
    t.sedute.forEach(sd => sd.esercizi.forEach(x => { x.kg = null; x.tecnica = String(x.tecnica || "").slice(0, 140); delete x.schema; })); // serie uguali di default, chili da scegliere alla prima seduta
    if (!t.sedute.length) throw { code: "invalid" };
    return t;
  }
  const exRows = sd => sd.esercizi.map(x => ui.row({ title: x.nome, sub: x.cardio || x.misura === "cardio" ? `Cardio · ${x.minuti || 20} minuti, ritmo ${x.intensita || "medio"}` : `${x.serie} × ${x.min === x.max ? x.min : x.min + "–" + x.max}${x.corpo_libero ? " · corpo libero" : ""} · recupero ${restTxt(+x.recupero || 90)}` })).join("");
  const KIDQ = (adult, kid) => () => grp() === "b" ? kid : adult;

  /* ---------- «Crea una nuova scheda»: QUESTIONARIO_SCHEDA_V2.md, sezione 1 (n = numero nel documento) ---------- */
  const ZONE = ["Collo", "Spalla", "Gomito", "Polso e mano", "Schiena", "Anca", "Ginocchio", "Caviglia e piede"];
  const LONG = (a) => ["6-24", "oltre2"].includes(a.rt_experience);
  const SCHEDA_QS = [
    ...PROF_QS(0, false),                                                                   // dati di profilo condivisi (non contano nelle 40)
    ...PARQ_QS(1).map((q, i) => ({ ...q, n: i + 1 })),                                      // 1 parq_check, 2 parq
    { n: 3, id: "symptoms", type: "many", q: "Ti capita una di queste cose?", src: "acsmscr",
      opts: L(["fiato", "Fiato corto con sforzi leggeri"], ["cuore", "Cuore che batte forte o irregolare a riposo"], ["caviglie", "Caviglie gonfie"], ["polpacci", "Dolore ai polpacci camminando, passa da fermo"], ["stanchezza", "Stanchezza insolita con poco sforzo"]).concat([NONE()]) },
    { n: 4, id: "now_status", type: "many", q: "In questo periodo ti riguarda una di queste?", src: "parq who",
      opts: () => (female() && (age() || 30) >= 14 ? L(["gravidanza", "Sono in gravidanza"], ["parto", "Ho partorito nell'ultimo anno"]) : []).concat(L(["intervento", "Intervento chirurgico negli ultimi 6 mesi"], ["malanno", "Febbre o un malanno in questi giorni"]), [NONE()]) },
    { n: 5, id: "body_area", type: "many", grid: true, q: KIDQ("Hai una zona del corpo con dolore o infortunio?", "Ti fa male qualche parte del corpo?"), src: "parq", opts: L(...ZONE).concat([NONE()]) },
    { n: 6, id: "pain_limit", show: a => yes(a, "body_area"), q: "Quel dolore ti limita nei movimenti di ogni giorno?", src: "parq", opts: [opt("no", "No, è solo un fastidio"), opt("si", "Sì, mi limita")] },
    { n: 7, id: "falls", p: "o", q: "Nell'ultimo anno sei caduto o ti senti meno stabile?", sub: "Anche se non ti sei fatto male", src: "who isscad", opts: [opt("no", "No"), opt("si", "Sì")] },
    { n: 8, id: "supervision", p: "rb", q: KIDQ("Un istruttore qualificato ti seguirà in palestra?", "Un allenatore o un adulto ti segue quando ti alleni?"), src: "nscay",
      opts: [opt("sempre", "Sì, sempre"), opt("avolte", "Solo a volte"), opt("no", "No")] },
    { n: 9, id: "goal", q: KIDQ("Cosa vuoi ottenere?", "Cosa ti piacerebbe fare meglio?"), src: "acsm09 acsm26", def: () => grp() === "a" ? ({ massa: "ipertrofia", definizione: "salute" })[prof().obiettivo] || null : null,
      opts: () => ({ b: L(["correre", "Correre più veloce"], ["saltare", "Saltare più in alto"], ["forte", "Essere più forte"], ["giocare", "Giocare senza stancarmi"]),
        o: L(["autonomia", "Restare autonomo"], ["gambe", "Più forza nelle gambe"], ["equilibrio", "Più equilibrio"], ["salute", "Stare bene in generale"]) })[grp()] ||
        L(["forza", "Più forza", "Sollevare carichi più pesanti"], ["ipertrofia", "Muscoli più grandi", "Aumentare la massa muscolare"], ["resistenza", "Più resistenza", "Durare di più senza stancarti"], ["salute", "Stare bene e in salute", "Salute e movimento"]) },
    { n: 10, id: "rt_experience", p: "rao", q: () => over65() ? "Hai mai fatto esercizi di forza, anche con macchine o elastici?" : "Da quanto ti alleni con i pesi?", src: "acsm09",
      opts: L(["mai", "Mai o quasi mai"], ["meno6", "Meno di 6 mesi"], ["6-24", "Da 6 mesi a 2 anni"], ["oltre2", "Più di 2 anni"]) },
    { n: 11, id: "regular_activity", q: "Negli ultimi 3 mesi ti sei allenato almeno 3 volte a settimana?", sub: "Almeno 30 minuti ogni volta", src: "acsmscr",
      opts: L(["si", "Sì, quasi sempre"], ["avolte", "A volte"], ["no", "No"]) },
    { n: 12, id: "days", q: "Quanti giorni a settimana puoi allenarti?", src: "who acsm09", note: () => over65() ? "L'equilibrio puoi allenarlo anche nei giorni liberi." : null,
      opts: a => over65() ? [opt(2, "2 giorni", "Consigliato per iniziare"), opt(3, "3 giorni", "Il massimo per la forza alla tua età")]
        : grp() !== "a" ? [opt(2, "2 giorni"), opt(3, "3 giorni")]
        : [opt(2, "2 giorni", "Tutto il corpo"), opt(3, "3 giorni", "Il più scelto da chi inizia"), opt(4, "4 giorni", "Alto e basso alternati"), opt(5, "5 giorni", "Per chi ha esperienza")].concat(a.rt_experience === "oltre2" ? [opt(6, "6 giorni", "Solo per chi ha molta esperienza")] : []) },
    { n: 13, id: "minutes", q: "Quanto tempo hai per ogni allenamento?", src: "garber",
      opts: () => [opt(30, "30 minuti"), opt(45, "45 minuti"), opt(60, "1 ora")].concat(grp() === "a" ? [opt(90, "1 ora e mezza")] : []) },
    { n: 14, id: "equipment", q: "Dove ti alleni?", src: "acsm09 acsm26",
      opts: L(["completa", "Palestra completa", "Macchine, cavi, bilancieri e manubri"], ["base", "Palestra di base", "Manubri, panca e poche macchine"], ["casa", "A casa con piccoli attrezzi", "Manubri, elastici, kettlebell"], ["corpo", "A corpo libero", "Nessun attrezzo"]) },
    { n: 15, id: "avoid_ex", p: "rao", type: "many", grid: true, q: "Ci sono esercizi che non vuoi o non puoi fare?", src: "acsm09 min",
      opts: L("Stacco da terra", "Squat con bilanciere", "Panca piana", "Trazioni", "Lento avanti", "Affondi", "Corsa e salti").concat([NONE("Nessuno", "nessuno")]) },
    // Intermedio (16-25)
    { n: 16, id: "split", p: "a", show: a => +a.days >= 3 && LONG(a), q: "Come vuoi dividere gli allenamenti?", src: "acsm09",
      opts: L(["total", "Tutto il corpo ogni volta"], ["altobasso", "Alto e basso", "Un giorno busto, un giorno gambe"], ["ppl", "Spinta, tirata, gambe", "Tre allenamenti che si alternano"], ["auto", "Decidi tu", "Scelgo io in base alle risposte"]) },
    { n: 17, id: "weekdays", type: "many", grid: true, q: "In quali giorni puoi allenarti?", src: "acsm09 nscay",
      opts: [1, 2, 3, 4, 5, 6, 0].map(d => opt(d, GG[d])).concat([NONE("Quando capita", "nessuno")]) },
    { n: 18, id: "aerobic_min", p: "ao", q: "Quanti minuti a settimana fai attività che ti fa sudare?", src: "who min",
      opts: L(["lt60", "Meno di 60"], ["60-149", "Da 60 a 149"], ["150-300", "Da 150 a 300"], ["gt300", "Più di 300"]) },
    { n: 19, id: "sitting", q: "Quante ore al giorno passi seduto?", src: "who", opts: L(["lt4", "Meno di 4"], ["4-8", "Da 4 a 8"], ["gt8", "Più di 8"]) },
    { n: 20, id: "rir", p: "ar", show: a => a.rt_experience && a.rt_experience !== "mai", q: "A fine serie, quante ripetizioni ti restano di solito?", src: "acsm26",
      opts: L(["0", "Nessuna, arrivo al limite"], ["1-3", "Da 1 a 3"], ["gt3", "Più di 3"], ["nonso", "Non lo so"]) },
    { n: 21, id: "known_lifts", p: "ar", type: "many", grid: true, show: a => a.rt_experience && a.rt_experience !== "mai", q: "Quali di questi esercizi sai già fare bene?", src: "acsm09 nscay",
      opts: L("Squat", "Stacco", "Panca", "Rematore", "Lento avanti", "Trazioni").concat([NONE("Nessuno", "nessuno")]) },
    { n: 22, id: "work", p: "ao", q: "Il tuo lavoro è fisicamente pesante?", src: "who", opts: L(["seduto", "No, sto seduto"], ["piedi", "Sto in piedi e cammino"], ["pesi", "Sì, sollevo pesi"], ["nonlavoro", "Non lavoro"]) },
    { n: 23, id: "cardio_pref", type: "many", grid: true, show: a => ["lt60", "60-149"].includes(a.aerobic_min) || "br".includes(grp()), q: "Che attività aerobica ti piace di più?", src: "who min",
      opts: L("Camminata veloce", "Corsa", "Bici o cyclette", "Nuoto", "Ballo", "Ellittica o vogatore").concat([NONE()]) },
    { n: 24, id: "vigorous_used", p: "ao", show: () => (age() || 0) >= 45, q: "Sei abituato a sforzi molto intensi, al limite?", src: "parq", opts: L(["si", "Sì, li faccio spesso"], ["no", "No"]) },
    { n: 25, id: "chair_stand", p: "o", q: "Riesci ad alzarti da una sedia senza usare le mani?", sub: "Provalo solo vicino a un appoggio sicuro", src: "frag",
      opts: L(["facile", "Sì, facilmente"], ["fatica", "Sì, con fatica"], ["no", "No"]) },
    // Completo (26-40)
    { n: 26, id: "priority", p: "ar", type: "many", grid: true, max: 2, q: "Quali parti del corpo vuoi migliorare di più?", src: "acsm26",
      opts: L("Petto", "Schiena", "Spalle", "Braccia", "Gambe", "Glutei", "Addome").concat([NONE("Nessuna in particolare")]) },
    { n: 27, id: "mobility", q: "Fai esercizi di allungamento o mobilità?", src: "garber", opts: L(["mai", "Mai"], ["1", "1 volta a settimana"], ["2+", "2 o più volte a settimana"]) },
    { n: 28, id: "home_kit", type: "many", grid: true, show: a => a.equipment === "casa", q: "Quali attrezzi hai a casa?", src: "acsm26",
      opts: L("Manubri", "Elastici", "Kettlebell", "Sbarra per trazioni", "Panca", "Step").concat([NONE("Niente", "nessuno")]) },
    { n: 29, id: "other_sport", q: "Pratichi un altro sport?", src: "ltad", opts: L(["no", "No"], ["squadra", "Sì, di squadra"], ["resistenza", "Sì, di resistenza"], ["combattimento", "Sì, di combattimento"], ["altro", "Sì, altro"]) },
    { n: 30, id: "sport_freq", type: "num", min: 1, max: 7, unit: "volte a settimana", show: a => a.other_sport && a.other_sport !== "no", q: "Quante volte a settimana fai quello sport?", src: "ltad acsm09" },
    { n: 31, id: "max_known", p: "a", type: "nums", fields: [["squat", "Squat"], ["panca", "Panca"], ["stacco", "Stacco"]], show: a => LONG(a) && (age() || 30) < 65,
      q: "Conosci il tuo massimale in squat, panca o stacco?", sub: "Scrivi solo quelli che conosci", src: "acsm09" },
    { n: 32, id: "injury_history", type: "many", grid: true, q: "Hai avuto infortuni in passato allenandoti?", src: "parq", opts: L(...ZONE).concat([NONE("Nessuno", "nessuno")]) },
    { n: 33, id: "training_break", p: "rao", show: a => a.regular_activity === "no" && a.rt_experience && a.rt_experience !== "mai", q: "Per quanto tempo ti eri fermato?", src: "acsm09 acsmscr",
      opts: L(["lt1", "Meno di 1 mese"], ["1-3", "Da 1 a 3 mesi"], ["gt3", "Più di 3 mesi"]) },
    { n: 34, id: "fear_falling", p: "o", q: "Hai paura di cadere quando cammini?", src: "isscad", opts: L(["no", "No"], ["unpo", "Un po'"], ["molto", "Sì, molto"]) },
    { n: 35, id: "walking_aid", p: "o", q: "Usi un bastone o un altro aiuto per camminare?", src: "frag", opts: L(["no", "No"], ["si", "Sì"]) },
    { n: 36, id: "one_leg", p: "o", q: "Riesci a stare su un piede per 10 secondi?", sub: "Provalo solo vicino a un appoggio sicuro", src: "who frag",
      opts: L(["si", "Sì"], ["appoggio", "Solo appoggiandomi"], ["no", "No"]) },
    { n: 37, id: "screen_time", p: "br", q: KIDQ("Quante ore al giorno usi schermi per svago?", "Quante ore al giorno giochi con telefono, tablet o tv?"), src: "who",
      opts: L(["lt1", "Meno di 1"], ["1-2", "Da 1 a 2"], ["gt2", "Più di 2"]) },
    { n: 38, id: "growth", p: "rb", show: () => (age() || 0) >= 10, q: KIDQ("Sei cresciuto molto in altezza nell'ultimo anno?", "Quest'anno sei diventato molto più alto?"), src: "ltad",
      opts: L(["no", "No"], ["si", "Sì"], ["nonso", "Non lo so"]) },
    { n: 39, id: "event_date", p: "ar", q: "Ti stai preparando per una data precisa?", src: "acsm09", opts: L(["no", "No"], ["gara", "Sì, una gara"], ["prova", "Sì, una prova fisica o un concorso"]) },
    { n: 40, id: "med_cert", q: "Hai un certificato medico sportivo valido?", src: "dm14",
      note: () => minorP() ? "Per lo sport organizzato sotto i 18 anni il certificato serve." : null,
      opts: L(["agonistico", "Sì, agonistico"], ["nonagonistico", "Sì, non agonistico"], ["no", "No"], ["nonso", "Non lo so"]) }
  ];

  /* vincoli per l'IA: QUESTIONARIO_SCHEDA_V2.md, sezione 3 (fonte tra parentesi quadre) */
  function schedaPrompt(a) {
    const g = grp(), nov = !a.rt_experience || ["mai", "meno6"].includes(a.rt_experience) || a.regular_activity === "no";
    const lvl = nov ? "principiante" : a.rt_experience === "oltre2" ? "avanzato" : "intermedio";
    const qs = { qs: SCHEDA_QS }, has = (id, x) => Array.isArray(a[id]) && a[id].includes(x);
    const zones = (a.body_area || []).filter(x => !none(x)), past = (a.injury_history || []).filter(x => !none(x)), avoid = (a.avoid_ex || []).filter(x => !none(x));
    const lab = id => { const q = SCHEDA_QS.find(q => q.id === id); return a[id] != null ? labOf(q, a) : "non indicato"; };
    const lines = [
      `Esattamente ${a.days} sedute, ognuna dentro ${a.minutes} minuti: 5-10 minuti di riscaldamento, parte centrale, 5-10 minuti di defaticamento; allungamenti almeno 2-3 volte a settimana [ACSM 2011]. Conta circa 2 minuti e mezzo per serie, recupero compreso.`,
      "Almeno 2 sedute di forza a settimana con tutti i grandi gruppi muscolari [OMS 2020; ACSM 2026].",
      "Frequenza per livello: principiante 2-3 sedute a corpo intero, intermedio 3-4, avanzato 4-5 (fino a 6 solo con divisione per gruppi e obiettivo muscoli) [ACSM 2009]." + (a.split ? " Divisione richiesta: " + lab("split") + "." : " Divisione: tutto il corpo."),
      "Volume: per i muscoli più grandi almeno 10 serie a settimana per gruppo; oltre 18-20 il guadagno cala. Forza 2-3 serie per esercizio. Principianti da 1-3 serie per esercizio [ACSM 2026; ACSM 2009].",
      "Ripetizioni e carichi: principiante 8-12 ripetizioni al 60-70% del massimale; forza (esperti) ≥80% del massimale, 1-6 ripetizioni; muscoli 6-15 ripetizioni con sforzo alto; resistenza 10-25 ripetizioni con carichi leggeri [ACSM 2009; ACSM 2026].",
      `Mai serie a cedimento: 2-3 ripetizioni di margine (RIR 2-3)${nov || g === "o" ? "; per questa persona almeno 3" : ""} [ACSM 2026].`,
      "Recuperi: 2-3 minuti sui multiarticolari pesanti, 1-2 minuti sugli altri [ACSM 2009].",
      "Progressione: quando fa 1-2 ripetizioni oltre l'obiettivo per 2 sedute di fila, carico +2-10%" + (a.goal === "salute" ? " (con obiettivo salute non è obbligatoria)" : "") + " [ACSM 2009; ACSM 2026].",
      "Gli stessi muscoli allenati pesante non in giorni consecutivi [ACSM 2009]." + (Array.isArray(a.weekdays) && !a.weekdays.includes("nessuno") ? " Giorni disponibili: " + a.weekdays.map(d => GG[d]).join(", ") + "." : ""),
      `Attrezzatura: ${lab("equipment")}${a.home_kit ? " (" + lab("home_kit") + ")" : ""}. Solo esercizi fattibili con questa attrezzatura.`
    ];
    if (["lt60", "60-149"].includes(a.aerobic_min)) lines.push(`Aggiungi attività aerobica fino a 150-300 minuti moderati a settimana (o 75-150 intensi)${a.cardio_pref ? ", scegliendo tra: " + lab("cardio_pref") : ""} [OMS 2020; Min. Salute 2021].`);
    if (a.sitting === "gt8") lines.push("Più di 8 ore seduto: consiglia pause attive e mobilità di anche e schiena [OMS 2020].");
    if ((age() || 0) >= 45 && a.vigorous_used === "no") lines.push("Sopra i 45 anni e non abituato: niente massimali né serie sotto le 6 ripetizioni [PAR-Q+].");
    if (nov || a.training_break === "gt3") lines.push("Riparte o è inattivo: intensità leggera o moderata nelle prime settimane, poi aumento graduale [ACSM screening; PAR-Q+].");
    if (zones.length) lines.push("Zone con fastidio che non limita: " + zones.join(", ") + ". Evita esercizi che le caricano direttamente, preferisci varianti guidate [PAR-Q+].");
    if (past.length) lines.push("Infortuni passati: " + past.join(", ") + ". Riscaldamento specifico e prudenza [PAR-Q+].");
    if (avoid.length) lines.push("Non usare mai questi esercizi: " + avoid.join(", ") + ".");
    if (a.known_lifts && a.known_lifts.includes("nessuno")) lines.push("Non conosce i multiarticolari: versione guidata o più semplice, tecnica prima del carico [ACSM 2009].");
    if (a.priority && !a.priority.includes("no")) lines.push("Più serie settimanali su: " + lab("priority") + ", dentro i limiti di volume [ACSM 2026].");
    if (a.mobility && a.mobility !== "2+") lines.push("Aggiungi allungamenti a fine seduta [ACSM 2011].");
    if (a.other_sport && a.other_sport !== "no") lines.push(`Pratica già uno sport (${lab("other_sport")}${a.sport_freq ? ", " + a.sport_freq + " volte a settimana" : ""}): la scheda lo completa, non lo duplica [NSCA LTAD].`);
    if (a.work === "pesi") lines.push("Lavoro pesante: meno volume su schiena e gambe, più recupero [OMS 2020].");
    if (a.event_date && a.event_date !== "no") lines.push("Si prepara per una data precisa: organizza le settimane per arrivarci pronto [ACSM 2009].");
    if (has("now_status", "parto")) lines.push("Ha partorito nell'ultimo anno: ripresa graduale, obiettivo 150 minuti a settimana di attività moderata e rinforzo muscolare [OMS 2020].");
    if (g === "o") lines.push("Over 65: almeno 3 giorni a settimana di attività multicomponente (equilibrio + forza) [OMS 2020]; forza 2-3 sedute, 1-3 serie da 8-12, si parte leggeri fino al 70-85% del massimale; in ogni seduta un esercizio di potenza (salita veloce, discesa controllata) e uno di equilibrio [NSCA 2019]; mai a cedimento [ACSM 2026].");
    if (g === "o" && (["unpo", "molto"].includes(a.fear_falling) || a.walking_aid === "si" || a.chair_stand === "no" || a.one_leg === "no")) lines.push("Esercizi seduti o con appoggio, progressione lenta, supervisione consigliata [NSCA 2019; ISS cadute].");
    if (g === "r") lines.push("Ragazzo 14-17 seguito da un istruttore: 60 minuti al giorno di attività in media, 3 giorni di rinforzo muscoli e ossa [OMS 2020]; forza 2-3 sedute in giorni non consecutivi, si inizia con 1-2 serie da 10-15 ripetizioni con carichi leggeri, poi 1-3 serie da 6-15; tecnica prima del carico; riscaldamento dinamico 5-10 minuti [NSCA 2009]; niente massimali" + (a.growth === "si" ? "; picco di crescita: carichi più leggeri, più coordinazione" : "") + " [NSCA LTAD].");
    if (a.max_known && !a.max_known.nonso) lines.push("Massimali dichiarati: " + labOf(SCHEDA_QS.find(q => q.id === "max_known"), a) + ". Usali solo per indicare le percentuali.");
    return `Sei un preparatore atletico. Crea una scheda di allenamento sicura e basata sulle fonti indicate.
Persona: ${prLine() || "dati non indicati"}. Livello: ${lvl}.
Risposte al questionario:
${answersTxt(qs, a)}

Vincoli obbligatori:
${lines.map(x => "- " + x).join("\n")}
- kg sempre null (i carichi si scelgono alla prima seduta). Nomi degli esercizi in italiano. "tecnica" = una frase breve (massimo 12 parole).

Rispondi in JSON. "giorno" è il giorno della settimana in italiano, "corpo_libero" true per esercizi senza carico esterno, ${TRAIN_JSON}`;
  }
  const SCHEDA_EDU = r => ({ title: "Muoversi giocando", sub: "Fino a 13 anni niente scheda automatica", label: "Cosa fare alla tua età",
    rows: [["Un'ora al giorno", "Di movimento, giocando"], ["3 volte a settimana", "Giochi per muscoli e ossa: salti, corse"], ["Meno schermi", "Più tempo fuori a giocare"], ["La scheda con i pesi", "Te la prepara il tuo allenatore"]],
    src: "Fonti: OMS, linee guida attività fisica 2020 (5-17 anni); NSCA 2009.", acts: loadTrain });
  Q.cfg.scheda = () => ({
    id: "scheda_v2", qs: SCHEDA_QS, lastLabel: "Prepara la scheda", genTitle: "Preparo la tua scheda", edu: SCHEDA_EDU,
    intro: { title: "Nuova scheda", sub: "Scegli quante domande fare", note: "Le domande sulla salute le fai una volta sola.", pick: levelPick("la scheda"),
      rows: () => [["Puoi fermarti e riprendere", "Le risposte restano salvate"], ["La scheda attuale resta", "Scegli tu quando cambiarla"]] },
    flag(a, start) {
      if (start) return null;
      if (parqYes(a)) return STOP.medicoT;                                              // R1
      if (yes(a, "symptoms")) return STOP.sintomiT;                                     // R2
      const ns = a.now_status || [];
      if (ns.includes("gravidanza")) return STOP.gravT;                                 // R3
      if (ns.includes("intervento")) return STOP.intervT;                               // R4
      if (ns.includes("malanno")) return STOP.malannoT;                                 // R5
      if (a.pain_limit === "si") return STOP.doloreT;                                   // R6
      if (a.falls === "si") return STOP.caduteT;                                        // R7
      if (grp() === "r" && a.supervision && a.supervision !== "sempre") return STOP.istruttoreT; // R8 (decisione Giovanni: solo «Sì, sempre»)
      return null;
    },
    async generate(a, signal) { return trainOut(await S.sample.json(schedaPrompt(a), { modelTier: "complex", task: "Creo la tua scheda", signal })); },
    prevTitle: "La tua nuova scheda",
    prevSub: t => pl(t.sedute.length, "seduta", "sedute") + " · " + pl(t.sedute.reduce((m, s) => m + s.esercizi.length, 0), "esercizio", "esercizi"),
    preview: (t, r) => ui.card(ui.big(`${t.sedute.length} <span class="v3-of">${t.sedute.length === 1 ? "seduta" : "sedute"} a settimana</span>`, "Circa " + Math.round(t.sedute.reduce((m, s) => m + minsOf(s), 0) / t.sedute.length) + " minuti l'una")) +
      ((r.a.walking_aid === "si" || r.a.chair_stand === "no") ? ui.row({ title: "Fai i primi allenamenti con un istruttore", sub: "Esercizi con appoggio" }) : "") +   // R12
      ((age() || 0) >= 45 && r.a.vigorous_used === "no" && r.a.goal === "forza" ? ui.row({ title: "Partiamo con carichi medi", sub: "Per i massimali serve un professionista" }) : "") + // R11
      t.sedute.map((sd, i) => ui.section("Seduta " + LETTER(i) + (sd.dow != null ? " · " + GG[sd.dow] : "") + (sd.nome && !/^seduta/i.test(sd.nome) ? " · " + sd.nome : ""), exRows(sd))).join("") +
      ui.row({ title: "Se un esercizio fa male", sub: "Saltalo e segnalalo" }),                                                                                                   // R10
    hasCurrent: () => !!(S.training && S.training.sedute && S.training.sedute.length),
    okLabel: "Usa questa scheda", keepLabel: "Tieni quella attuale", noLabel: "Non usarla", keepToast: "Hai tenuto la scheda attuale",
    confirm(t) {
      if (activeDay()) { toast("Prima concludi la seduta in corso"); return null; }
      S.training = { sedute: t.sedute, origine: "questionario", creata: new Date().toISOString() }; persistDoc("training", S.training);
      S.drafts = {}; saveDrafts(); S.state.subs = {}; persistState(); S.timer = null; applyAll();
      return { msg: "Nuova scheda salvata", sub: pl(t.sedute.length, "seduta", "sedute") + ": i chili li scegli alla prima seduta" };
    }
  });

  /* ---------- «Aggiungi una seduta»: 4 domande (tavola 36) ---------- */
  const SEDUTA_QS = [
    { id: "muscoli", q: "Cosa vuoi allenare nella nuova seduta?", sub: "Puoi sceglierne più di uno", type: "many", grid: true, note: "Dopo: durata, dove ti alleni, giorno.",
      opts: ["Petto", "Schiena", "Spalle", "Braccia", "Gambe", "Glutei", "Addome"].map(x => opt(x.toLowerCase(), x)).concat([opt("tutto", "Tutto il corpo", null, true)]) },
    { id: "durata", q: "Quanto deve durare?", opts: [opt(30, "30 minuti"), opt(45, "45 minuti"), opt(60, "1 ora"), opt(90, "1 ora e mezza")] },
    { id: "dove", q: "Dove ti alleni?", opts: [opt("palestra", "In palestra", "Macchine, cavi e pesi"), opt("casa", "A casa con i pesi", "Manubri, panca o elastici"), opt("corpo", "A corpo libero", "Nessun attrezzo")] },
    { id: "giorno", q: "In che giorno la fai?", grid: true, opts: [1, 2, 3, 4, 5, 6, 0].map(d => opt(d, GG[d])).concat([opt("flex", "Quando vuoi")]) }
  ];
  function sedutaPrompt(a) {
    const T = (S.training && S.training.sedute) || [];
    const now = T.map((sd, i) => `Seduta ${LETTER(i)}${sd.dow != null ? " (" + GG[sd.dow] + ")" : ""}: ${sd.esercizi.map(x => x.nome + " " + x.serie + "x" + x.min + "-" + x.max).join("; ")}`).join("\n");
    return `Sei un preparatore atletico. Crea UNA nuova seduta da aggiungere alla scheda di questa persona (${prLine() || "dati non indicati"}, livello ${prof().livello || "intermedio"}).
Scheda attuale:
${now || "nessuna seduta"}
Richiesta:
${answersTxt({ qs: SEDUTA_QS }, a)}

Vincoli: dentro ${a.durata} minuti compreso un riscaldamento di 5-10 minuti (circa 2 minuti e mezzo per serie, recupero compreso); non ripetere la stessa seduta già presente; tieni conto del volume settimanale (almeno 10 serie a settimana per muscolo, senza superare 20) [ACSM 2026]; ripetizioni 6-12 sui multiarticolari, 10-15 sui complementari; recuperi 2-3 minuti sui multiarticolari pesanti, 1-2 sugli altri [ACSM 2009]; 2-3 ripetizioni di margine, niente cedimento [ACSM 2026].${over65() ? " Persona over 65: serie da 8-12, carichi moderati, un esercizio di equilibrio [NSCA 2019]." : ""} Solo esercizi fattibili con: ${labOf(SEDUTA_QS[2], a)}. kg sempre null. Nomi in italiano, "tecnica" = una frase breve (massimo 12 parole).

Rispondi in JSON con una sola seduta nell'elenco "sedute". "giorno" è il giorno della settimana in italiano o null, "corpo_libero" true per esercizi senza carico esterno, ${TRAIN_JSON}`;
  }
  Q.cfg.seduta = () => ({
    id: "seduta", qs: SEDUTA_QS, lastLabel: "Prepara la seduta", genTitle: "Preparo la nuova seduta",
    flag() {
      if (minorP()) return STOP.minorT;
      if (((S.training && S.training.sedute) || []).length >= 7) return STOP.tantiT;
      return null;
    },
    async generate(a, signal) {
      const t = trainOut(await S.sample.json(sedutaPrompt(a), { modelTier: "complex", task: "Creo la nuova seduta", signal }));
      const sd = t.sedute[0]; sd.dow = a.giorno === "flex" ? null : +a.giorno;
      if (!sd.nome) sd.nome = "Seduta " + LETTER(((S.training && S.training.sedute) || []).length);
      return sd;
    },
    prevTitle: "La nuova seduta",
    prevSub: sd => "Seduta " + LETTER(((S.training && S.training.sedute) || []).length) + (sd.dow != null ? " · " + GG[sd.dow] : " · quando vuoi"),
    preview: sd => ui.card(ui.big(`${sd.esercizi.length} <span class="v3-of">esercizi</span>`, "Circa " + minsOf(sd) + " minuti" + (sd.focus ? " · " + sd.focus : ""))) + ui.section("Esercizi", exRows(sd)),
    hasCurrent: () => false, okLabel: "Aggiungi alla scheda", noLabel: "Non aggiungerla",
    confirm(sd) {
      S.training = S.training || { sedute: [] }; S.training.sedute = S.training.sedute || [];
      S.training.sedute.push(sd); persistDoc("training", S.training); setTraining(S.training);
      const Lt = LETTER(S.training.sedute.length - 1);
      return { msg: "Seduta " + Lt + " aggiunta alla scheda", sub: pl(sd.esercizi.length, "esercizio", "esercizi") + " · circa " + minsOf(sd) + " minuti" };
    }
  });

  /* ---------- «Crea un nuovo piano»: QUESTIONARIO_PIANO_V2.md. Percorso adulto + varianti a pari numero per over 65 (o), ragazzo (r), bambino (b).
     Over 65: il MNA-SF è un marchio Nestlé e NON si usa; al suo posto domande equivalenti da fonti pubbliche: criteri GLIM (ESPEN:
     apporto ridotto, calo di peso involontario, malattia acuta), linea guida ESPEN geriatria 2022 (demenza, depressione, mobilità)
     e PASSI d'Argento dell'ISS (autonomia nell'uscire di casa). ---------- */
  const KQ = t => () => grp() === "b" ? t[1] : t[0];
  const PIANO_QS = [
    ...PROF_QS(1, true),                                                                                                  // 1-4
    { n: 5, id: "activity", p: "rao", q: "Contando lavoro e sport, quanto ti muovi di solito?", src: "larn who", def: () => prof().attivita || null,
      opts: ACTIVITY.map(x => { const [t, s] = x[1].split(": "); return opt(x[0], t, s); }) },
    { n: 5, id: "kid_active", p: "b", q: "Quanti giorni a settimana gioca o fa sport per un'ora?", src: "okkio who", grid: true, opts: [0, 1, 2, 3, 4, 5, 6, 7].map(x => opt(x, String(x))) },
    { n: 6, id: "training", p: "ra", q: "Quanti giorni a settimana ti alleni?", src: "who larn",
      def: () => (DAYS.length ? (DAYS.length <= 2 ? "12" : DAYS.length <= 4 ? "34" : "5+") : null), opts: L(["0", "Nessuno"], ["12", "1-2"], ["34", "3-4"], ["5+", "5 o più"]) },
    { n: 6, id: "ill3m", p: "o", q: "Negli ultimi tre mesi hai avuto una malattia o un periodo di forte stress?", src: "glim espen", opts: L(["si", "Sì"], ["no", "No"]) },
    { n: 6, id: "kid_night", p: "b", q: "Dopo cena mangia o beve qualcosa, a parte l'acqua?", src: "okkio", opts: L(["si", "Sì"], ["no", "No"]) },
    { n: 7, id: "goal", p: "a", q: "Cosa vuoi ottenere con il piano?", src: "crea", def: () => ({ definizione: "definizione", mantenimento: "mantenimento", massa: "massa" })[prof().obiettivo] || null,
      opts: () => ((bmiOf() || 22) < 18.5 ? [] : [opt("definizione", "Perdere grasso")]).concat([opt("mantenimento", "Mantenere il peso"), opt("massa", "Aumentare la massa muscolare"), opt("meglio", "Mangiare meglio", "Senza cambiare peso")]) },
    { n: 7, id: "goal65", p: "o", q: "Cosa vuoi ottenere con il piano?", src: "espen", opts: L(["mantenere", "Mantenere peso e forza"], ["recuperare", "Recuperare peso o forza"], ["meglio", "Mangiare meglio"], ["perdere", "Perdere peso"]) },
    { n: 7, id: "breakfast_yn", p: "r", q: "Fai colazione prima di andare a scuola?", src: "crea okkio", opts: L(["sempre", "Sempre"], ["avolte", "A volte"], ["mai", "Mai"]) },
    { n: 7, id: "kid_breakfast", p: "b", q: "Fa colazione ogni mattina?", src: "crea", opts: L(["sempre", "Sempre"], ["avolte", "A volte"], ["mai", "Mai"]) },
    { n: 8, id: "pattern", q: KQ(["Quali cibi di origine animale mangi?", "Quali cibi di origine animale mangia?"]), src: "dossier11 larn",
      opts: L(["tutti", "Tutti"], ["pesce", "Niente carne, sì pesce"], ["uova_latte", "Niente carne né pesce, sì uova e latticini"], ["nessuno", "Nessuno"]) },
    { n: 9, id: "allergy", type: "many", grid: true, q: KQ(["Un medico ti ha diagnosticato allergie, intolleranze o celiachia?", "Un medico gli ha diagnosticato allergie, intolleranze o celiachia?"]), sub: "Solo diagnosi del medico", src: "ue1169 celiachia dossier11",
      opts: L("Celiachia", "Lattosio", "Latte", "Uova", "Pesce", "Crostacei e molluschi", "Frutta a guscio", "Arachidi", "Soia", "Sedano, senape o sesamo", "Lupini", "Solfiti").concat([NONE()]) },
    { n: 10, id: "meals", p: "rab", q: KQ(["Quanti pasti fai in una giornata?", "Quanti pasti fa in una giornata?"]), src: "crea",
      opts: [opt(3, "3: colazione, pranzo, cena"), opt(4, "4: più uno spuntino"), opt(5, "5: più due spuntini")] },
    { n: 10, id: "mood", p: "o", q: "Hai problemi di memoria o ti senti spesso molto giù?", sub: "Può rispondere un familiare", src: "espen",
      opts: L(["no", "Nessuno"], ["lieve", "Memoria un po' debole o umore giù"], ["grave", "Demenza o depressione diagnosticate"]) },
    ...PARQ_QS(11),                                                                                                      // 11
    { n: 12, id: "conditions", type: "many", q: "Hai una di queste condizioni di salute?", src: "gravidanza diabete reni crea",
      opts: () => (female() && (age() || 30) >= 14 && (age() || 30) <= 55 ? [opt("gravidanza", "Gravidanza o allattamento")] : []).concat(L(["diabete", "Diabete curato con farmaci o insulina"], ["reni", "Malattia dei reni"], ["fegato", "Malattia del fegato"], ["intestino", "Malattia intestinale cronica"], ["bariatrica", "Intervento per l'obesità"], ["prescritta", "Dieta già prescritta dal medico"]), [NONE()]) },
    { n: 13, id: "scoff", p: "ra", type: "many", q: "Quali di queste frasi sono vere per te?", sub: "Domande SCOFF, usate dai medici", src: "scoff scoffit",
      opts: L(["vomito", "Ti fai vomitare quando ti senti troppo pieno"], ["controllo", "Temi di aver perso il controllo su quanto mangi"], ["persi6", "Hai perso più di 6 chili in tre mesi"], ["grasso", "Ti senti grasso anche se gli altri ti trovano magro"], ["domina", "Il cibo domina la tua vita"]).concat([NONE()]) },
    { n: 13, id: "intake3m", p: "o", q: "Negli ultimi tre mesi hai mangiato meno del solito?", src: "glim espen", opts: L(["molto", "Molto meno"], ["unpo", "Un po' meno"], ["uguale", "Come prima"]) },
    { n: 13, id: "kid_amount", p: "b", q: "Secondo te, tuo figlio mangia poco, giusto o troppo?", src: "okkio", opts: L(["poco", "Poco"], ["giusto", "Il giusto"], ["troppo", "Troppo"]) },
    { n: 14, id: "water", p: "ra", q: "Quanti bicchieri d'acqua bevi in una giornata?", src: "crea larn", opts: L(["lt4", "Meno di 4"], ["4-5", "4-5"], ["6-8", "6-8"], ["gt8", "Più di 8"]) },
    { n: 14, id: "wloss3m", p: "o", q: "Negli ultimi tre mesi hai perso peso senza volerlo?", src: "glim pda", opts: L(["gt3", "Più di 3 chili"], ["1-3", "Da 1 a 3 chili"], ["no", "No"], ["nonso", "Non lo so"]) },
    { n: 14, id: "kid_fruit", p: "b", q: "Quante volte mangia frutta?", src: "okkio", opts: L("4 o più al giorno", "2-3 al giorno", "1 al giorno", "Qualche volta a settimana", "Meno di una volta a settimana", "Mai") },
    { n: 15, id: "fruitveg", p: "ra", q: "Quante porzioni di frutta e verdura mangi al giorno?", sub: "Una porzione sta in una mano, o mezzo piatto di verdura cotta", src: "passi crea whodiet",
      opts: L(["0", "Nessuna"], ["1-2", "1-2"], ["3-4", "3-4"], ["5+", "5 o più"]) },
    { n: 15, id: "goout", p: "o", q: "Riesci a uscire di casa da solo?", src: "pda espen", opts: L(["letto", "Sto tra letto e poltrona"], ["casa", "Mi muovo solo in casa"], ["esco", "Esco di casa"]) },
    { n: 15, id: "kid_drinks", p: "b", q: "Quante volte beve bibite zuccherate o gassate?", src: "okkio whosugars", opts: L("Più volte al giorno", "1 al giorno", "Qualche volta a settimana", "Meno di una volta a settimana", "Mai") },
    // Intermedio (16-25)
    { n: 16, id: "breakfast", q: KQ(["Cosa mangi di solito a colazione?", "Cosa mangia di solito a colazione?"]), src: "crea", opts: L("Niente", "Solo un caffè", "Latte o yogurt con pane o cereali", "Dolci da bar o merendine", "Salato") },
    { n: 17, id: "wholegrain", p: "rab", q: "Quanto spesso scegli pane, pasta o riso integrali?", src: "larn crea", opts: L("Mai", "A volte", "Almeno metà delle volte") },
    { n: 17, id: "water", p: "o", q: "Quanti bicchieri d'acqua bevi in una giornata?", src: "crea espen", opts: L(["lt4", "Meno di 4"], ["4-5", "4-5"], ["6-8", "6-8"], ["gt8", "Più di 8"]) },
    { n: 18, id: "legumes", q: "Quante volte a settimana mangi legumi?", src: "crea", opts: L(["0", "Mai"], ["1-2", "1-2"], ["3-4", "3-4"], ["5+", "5 o più"]) },
    { n: 19, id: "fish", q: "Quante volte a settimana mangi pesce?", src: "crea", opts: L(["0", "Mai"], ["1", "1"], ["2-3", "2-3"], ["4+", "4 o più"]) },
    { n: 20, id: "redmeat", q: "Quante volte a settimana mangi carne rossa o salumi?", src: "crea", opts: L(["0", "Mai"], ["1", "1"], ["2-3", "2-3"], ["4+", "4 o più"]) },
    { n: 21, id: "dairy", q: "Quante porzioni di latte o yogurt prendi al giorno?", src: "crea larn", opts: L(["0", "Nessuna"], ["1", "1"], ["2", "2"], ["3+", "3 o più"]) },
    { n: 22, id: "sugarydrinks", p: "rao", q: "Quante bibite zuccherate o succhi bevi a settimana?", src: "whosugars crea", opts: L(["0", "Mai"], ["1-2", "1-2"], ["3-6", "3-6"], ["ogni", "Ogni giorno"]) },
    { n: 22, id: "kid_snack", p: "b", q: "Cosa mangia di solito a metà mattina?", src: "okkio crea", opts: L("Frutta o yogurt", "Panino", "Merendina o snack", "Niente") },
    { n: 23, id: "sweets", p: "rab", q: "Quante volte mangi dolci, biscotti o merendine?", src: "larn crea", opts: L("Raramente", "Qualche volta a settimana", "Ogni giorno", "Più volte al giorno") },
    { n: 23, id: "fruitveg", p: "o", q: "Quante porzioni di frutta e verdura mangi al giorno?", sub: "Una porzione sta in una mano, o mezzo piatto di verdura cotta", src: "crea pda",
      opts: L(["0", "Nessuna"], ["1-2", "1-2"], ["3-4", "3-4"], ["5+", "5 o più"]) },
    { n: 24, id: "alcohol", p: "ao", q: "Quanti bicchieri di alcolici bevi in una settimana?", src: "crea passi", opts: L(["0", "Nessuno"], ["1-3", "1-3"], ["4-7", "4-7"], ["gt7", "Più di 7"]) },
    { n: 24, id: "energy", p: "r", q: "Bevi bevande energetiche?", src: "efsacaff", opts: L("Mai", "Qualche volta", "Ogni settimana", "Ogni giorno") },
    { n: 24, id: "kid_veg", p: "b", q: "Quante volte mangia verdura, patate escluse?", src: "okkio", opts: L("4 o più al giorno", "2-3 al giorno", "1 al giorno", "Qualche volta a settimana", "Meno di una volta a settimana", "Mai") },
    { n: 25, id: "salt", q: "Quanto sale aggiungi quando cucini o a tavola?", src: "crea whosodium", opts: L("Quasi niente", "Poco", "Il normale", "Molto") },
    // Completo (26-40)
    { n: 26, id: "nuts", q: "Quante volte a settimana mangi frutta secca a guscio?", src: "crea", opts: L("Mai", "1-2", "3-5", "Ogni giorno") },
    { n: 27, id: "eggs", q: "Quante uova mangi in una settimana?", src: "crea", opts: L("Nessuno", "1-2", "3-4", "Più di 4") },
    { n: 28, id: "fat", q: "Quale grasso usi di più per cucinare e condire?", src: "crea whodiet", opts: L("Olio extravergine d'oliva", "Altri oli vegetali", "Burro, panna o strutto", "Margarina") },
    { n: 29, id: "cheese", q: "Quante volte a settimana mangi formaggi?", src: "crea", opts: L("Mai", "1-2", "3-4", "Ogni giorno") },
    { n: 30, id: "readyfood", q: "Quante volte a settimana mangi cibi pronti o fast food?", src: "crea whodiet", opts: L("Mai", "1", "2-3", "4 o più") },
    { n: 31, id: "eatout", q: "Quanti pasti a settimana consumi fuori casa?", src: "crea", opts: L("Nessuno", "1-2", "3-5", "Più di 5") },
    { n: 32, id: "iodine", q: "In cucina usi sale iodato?", src: "crea iodio", opts: L("Sì", "No", "Non lo so") },
    { n: 33, id: "waist", p: "a", type: "num", min: 50, max: 200, unit: "cm", skip: "Non lo so", q: "Quanto misuri di giro vita, in centimetri?", sub: "In piedi, all'altezza dell'ombelico, senza trattenere il respiro", src: "crea" },
    { n: 33, id: "chew", p: "o", q: "Hai difficoltà a masticare o a deglutire?", src: "crea espen", opts: L("No", "A volte", "Spesso") },
    { n: 33, id: "screens", p: "r", q: "Quante ore al giorno passi davanti a schermi?", src: "who", opts: L("Meno di 2", "2-3", "4 o più") },
    { n: 33, id: "kid_screens", p: "b", q: "Quante ore al giorno passa davanti a schermi?", src: "okkio", opts: L("Meno di 1", "1-2", "3 o più") },
    { n: 34, id: "weighttrend", p: "ra", q: "Il tuo peso è cambiato negli ultimi sei mesi?", src: "glim crea", opts: L(["stabile", "È stabile"], ["salito", "È salito"], ["dieta", "È sceso con una dieta"], ["involontario", "È sceso senza volerlo"]) },
    { n: 34, id: "thirst", p: "o", q: "Bevi anche quando non hai sete?", src: "crea espen", opts: L("Sì", "A volte", "No") },
    { n: 34, id: "kid_weightview", p: "b", q: "Secondo te, tuo figlio è sottopeso, normopeso o sovrappeso?", src: "okkio", opts: L("Sottopeso", "Normopeso", "Un po' sovrappeso", "Molto sovrappeso") },
    { n: 35, id: "emotional", p: "rao", q: "Ti capita di mangiare per noia, ansia o tristezza?", src: "crea", opts: L("Mai", "A volte", "Spesso") },
    { n: 35, id: "kid_sleep", p: "b", q: "Quante ore dorme nelle notti di scuola?", src: "okkio", opts: L("Meno di 9", "9-11", "Più di 11") },
    { n: 36, id: "binge", p: "rao", q: "Ti capita di mangiare tantissimo senza riuscire a fermarti?", src: "crea mindna", opts: L(["mai", "Mai"], ["raro", "Meno di una volta a settimana"], ["settimana", "Una volta a settimana o più"]) },
    { n: 36, id: "kid_moveview", p: "b", q: "Secondo te, si muove poco, abbastanza o tanto?", src: "okkio", opts: L("Poco", "Abbastanza", "Tanto") },
    { n: 37, id: "caffeine", p: "rao", q: "Quanti caffè o bevande energetiche prendi al giorno?", src: "efsacaff", opts: L("Nessuno", "1-2", "3-4", "5 o più") },
    { n: 37, id: "kid_caffeine", p: "b", q: "Beve tè freddo, cola o bevande con caffeina?", src: "efsacaff", opts: L("Mai", "Qualche volta", "Ogni giorno") },
    { n: 38, id: "supplements", type: "many", grid: true, q: KQ(["Prendi integratori o prodotti per lo sport?", "Prende integratori o prodotti per lo sport?"]), src: "crea dossier11",
      opts: L("Proteine in polvere", "Creatina", "Vitamine o minerali", "Omega 3", "Prodotti dimagranti", "Altro").concat([NONE("Nessuno", "nessuno")]) },
    { n: 39, id: "whocooks", q: KQ(["Chi prepara di solito i tuoi pasti?", "Chi prepara di solito i suoi pasti?"]), src: "crea", opts: L("Io", "Un familiare", "Mensa", "Compro piatti pronti") },
    { n: 40, id: "budget", q: "Quanto conta il prezzo quando fai la spesa?", src: "crea", opts: L("Molto", "Abbastanza", "Poco") }
  ];
  /* over 65, rischio di malnutrizione (al posto del punteggio MNA-SF): segni GLIM/ESPEN. Uno grave o due lievi = arresto e invito al medico. */
  function nutRisk(a) {
    const bmi = bmiOf();
    const severe = a.intake3m === "molto" || a.wloss3m === "gt3" || a.goout === "letto" || a.mood === "grave";
    const mild = [a.intake3m === "unpo", ["1-3", "nonso"].includes(a.wloss3m), a.goout === "casa", a.ill3m === "si", a.mood === "lieve", bmi != null && bmi < 22].filter(Boolean).length;
    return severe || mild >= 2;
  }
  function dietTargets(a) {
    const p = prof(), g = grp();
    if (!p.peso || !p.altezza || !p.eta) return null;
    const goal = g === "a" ? (a.goal === "meglio" ? "mantenimento" : a.goal || "mantenimento") : "mantenimento"; // ragazzo e over 65: niente deficit né surplus
    const train = a.training != null ? a.training !== "0" : undefined;
    return computeTargets({ ...p, obiettivo: goal, attivita: a.activity || p.attivita || "media", train });
  }
  /* porzioni e frequenze CREA (Tab. 9.1): colonna più vicina al fabbisogno */
  const FREQ = { 1500: "pane 2½ al giorno, pasta o riso 1, frutta 2, verdura 2½, latte e yogurt 3, olio 2; a settimana legumi 3, pesce 2, carne bianca 1, carne rossa 1, uova 2, formaggi 3, patate 1, frutta secca 1; acqua almeno 6 bicchieri",
    2000: "pane 3½ al giorno, pasta o riso 1½, frutta 3, verdura 2½, latte e yogurt 3, olio 3; a settimana legumi 3, pesce 2, carne bianca 2, carne rossa 1, uova 3, formaggi 3, patate 2, frutta secca 2; acqua almeno 8 bicchieri",
    2500: "pane 4½ al giorno, pasta o riso 1½, frutta 3, verdura 3, latte e yogurt 3, olio 4; a settimana legumi 3, pesce 3, carne bianca 3, carne rossa 1, uova 4, formaggi 3, patate 2, frutta secca 2½; acqua almeno 10 bicchieri" };
  function pianoPrompt(a, T) {
    const g = grp(), n = +a.meals || 5, keep = n === 3 ? "colazione, pranzo, cena (spuntino e merenda null)" : n === 4 ? "colazione, spuntino, pranzo, cena (merenda null)" : "colazione, spuntino, pranzo, merenda, cena";
    const col = T.kcal < 1750 ? 1500 : T.kcal < 2250 ? 2000 : 2500, fib = fiberLarn(T.kcal), wat = waterLarn(prof());
    const allergies = (a.allergy || []).filter(x => !none(x)), pat = a.pattern ? labOf(PIANO_QS.find(q => q.id === "pattern"), a) : "tutti";
    const extra = [];
    if (g === "r") extra.push("Ragazzo 14-17: obiettivo «crescere in salute», niente deficit né surplus, nessun obiettivo di peso. Porzioni e frequenze CREA per l'età (Tab. 9.2). Niente bevande energetiche [EFSA caffeina: 3 mg per chilo].");
    if (g === "o") extra.push("Over 65: proteine almeno 1-1,1 g per chilo distribuite nei pasti, niente diete restrittive [ESPEN 2022; LARN]; sale sotto 4 g; bere anche senza sete; alcol mai nel piano [CREA Dir. 4, 7, 8]" + (a.chew && a.chew !== "no" ? "; cibi morbidi, facili da masticare e deglutire [CREA Dir. 10]" : "") + ".");
    if (a.pattern === "nessuno") extra.push("Alimentazione senza cibi animali: legumi, soia, frutta secca a ogni pasto; ricorda di far valutare la vitamina B12 al medico [CREA Dossier cap. 11].");
    if (a.pattern === "nessuno" && g !== "a") extra.push("In ragazzi e over 65 consiglia di sentire il dietista per vitamina B12, ferro e calcio [CREA].");
    if (a.alcohol && ["4-7", "gt7"].includes(a.alcohol)) extra.push("Avviso: alcol oltre i limiti CREA (2 bicchieri al giorno uomo, 1 donna e over 65): una regola lo ricorda [CREA Dir. 8].");
    if (typeof a.waist === "number" && a.waist > (female() ? 88 : 102)) extra.push(`Avviso: giro vita ${a.waist} cm, oltre ${female() ? 88 : 102}: una regola invita a un controllo medico [CREA Dir. 1].`);
    if (a.emotional === "spesso") extra.push("Mangia spesso per noia o ansia: una regola educativa su fame e sazietà e l'invito a parlarne col medico [CREA Dir. 1].");
    if ((a.supplements || []).includes("prodotti_dimagranti")) extra.push("Usa prodotti dimagranti: una regola dice di parlarne col medico [CREA Dir. 11].");
    if (a.whocooks && g === "o") extra.push("Piatti facili e nutrienti da preparare [CREA Dir. 10].");
    if (a.budget === "molto") extra.push("Spesa attenta: alimenti di stagione e legumi [CREA Dir. 13].");
    return `Sei un dietista. Crea un piano alimentare settimanale (7 giorni) per questa persona: ${prLine() || "dati non indicati"}.
Fabbisogno calcolato (Mifflin-St Jeor × livello di attività LARN): circa ${T.kcal} kcal al giorno (tolleranza 5%), proteine ${T.p} g, carboidrati ${T.c} g, grassi ${T.f} g.
Risposte al questionario:
${answersTxt({ qs: PIANO_QS }, a)}

Vincoli (CREA, Linee guida per una sana alimentazione 2018; LARN SINU; OMS):
- Porzioni standard CREA (crudo, parte edibile): pane 50 g; pasta, riso, farro, orzo 80 g; fette biscottate o cracker 30 g; patate 200 g; frutta 150 g; verdura 200 g (insalata 80 g); carne 100 g; pesce 150 g; 1 uovo 50 g; legumi freschi o in scatola 150 g, secchi 50 g, tofu 100 g; latte 125 ml, yogurt 125 g; formaggi freschi 100 g, stagionati 50 g; olio 10 ml; frutta secca 30 g [CREA Tab. 9.1].
- Frequenze per circa ${col} kcal: ${FREQ[col]} [CREA Tab. 9.1]. Porzioni frazionabili.
- Carboidrati 45-60% delle calorie (fino al 65% con attività intensa), minimo 2 g per chilo; zuccheri totali sotto il 15%, liberi sotto il 10% (frutta intera e latte non contano) [LARN; OMS zuccheri 2015].
- Grassi 20-35% (consigliato fino al 30%), saturi sotto il 10%, trans sotto l'1%; olio extravergine come condimento principale [LARN; OMS; CREA Dir. 5].
- Proteine ${T.p} g, mai oltre circa 1,7 g per chilo [LARN; EFSA proteine 2012].
- Fibra almeno ${fib} g al giorno (12,6-16,7 g ogni 1000 kcal, minimo 25 g), almeno metà dei cereali integrali [LARN; CREA Dir. 3].
- Sale sotto ${g === "o" ? "4" : "5"} g al giorno, iodato [CREA Dir. 7; OMS sodio].
- Almeno 400 g di frutta e verdura al giorno (5 porzioni), verdura a pranzo e a cena [OMS; CREA Dir. 2].
- Acqua: circa ${nf(wat, 1)} L al giorno, come bevanda [LARN acqua; EFSA 2010]. Alcol mai nel piano [CREA Dir. 8]. Integratori mai aggiunti [CREA Dir. 11].
- Carne rossa 1 porzione a settimana, carni lavorate il meno possibile; legumi 3 a settimana; pesce 2-3 [CREA Tab. 9.1].
${extra.map(x => "- " + x).join("\n")}
Regole di scrittura: pasti = ${keep}; colazione sempre presente [CREA Dir. 9]. Quantità in porzioni CREA e misure di casa (fette, cucchiai, vasetti), mai solo in grammi. Rispetta SEMPRE il tipo di alimentazione (${pat}) e le diagnosi${allergies.length ? " (escludi: " + allergies.join(", ") + ")" : ""}; nessun alimento escluso senza diagnosi. Piatti semplici e italiani. Varia i pasti nella settimana. "kcal", "p", "c", "f" di ogni pasto = stima (tabelle CREA). In "regole" 3-5 consigli «perché» brevi e concreti, ognuno collegato a una risposta (es. «1-2 porzioni di frutta e verdura» → «aggiungi una frutta a merenda: l'obiettivo è 5 porzioni al giorno»). "integratori" vuoto. "kcal","p","c","f" in cima = i valori del fabbisogno indicati sopra. "acqua_l" = ${nf(wat, 1)}.

${DIET_JSON}`;
  }
  const DOWS = [1, 2, 3, 4, 5, 6, 0];
  const PIANO_EDU = r => ({ title: "Mangiare bene per crescere", sub: "Fino a 13 anni niente piano automatico", label: "I gruppi di cibo",
    rows: [["Frutta e verdura", "5 porzioni al giorno, di colori diversi"], ["Pane, pasta, riso", "Ogni giorno, meglio integrali"], ["Legumi, pesce, uova", "Più spesso della carne"], ["Latte e yogurt", "Ogni giorno"],
      ["Acqua", "Circa " + nf(waterLarn(prof()), 1) + " litri al giorno"], ["Bibite e dolci", "Solo ogni tanto"], ["Movimento", "Un'ora al giorno, giocando"]],
    src: "Fonti: CREA, Linee guida per una sana alimentazione 2018 (Tab. 9.2 e Dir. 10); LARN SINU (acqua); OMS 2020. Il piano su misura lo fa il pediatra o il dietista.", acts: loadDiet });
  Q.cfg.piano = () => ({
    id: "piano_v2", qs: PIANO_QS, lastLabel: "Prepara il piano", genTitle: "Preparo il tuo piano", edu: PIANO_EDU,
    intro: { title: "Nuovo piano", sub: "Scegli quante domande fare", note: "Le domande sulla salute le fai una volta sola.", pick: levelPick("il piano"), rows: [] },
    flag(a, start) {
      const g = grp(), bmi = bmiOf();
      if (g !== "b" && g !== "r" && bmi != null && bmi < 18.5) return STOP.sottoD;                       // 4 (vale anche all'avvio)
      if (start) return null;
      if (parqYes(a)) return STOP.medicoD;                                                              // 9
      const c = a.conditions || [];
      if (c.includes("gravidanza")) return STOP.gravD;                                                  // 5
      if (c.includes("diabete")) return STOP.diabD;                                                     // 6
      if (c.includes("reni") || c.includes("fegato")) return STOP.reniD;                                // 7
      if (c.some(x => ["intestino", "bariatrica", "prescritta"].includes(x))) return STOP.prescrD;     // 8
      if ((a.scoff || []).filter(x => !none(x)).length >= 2 || a.binge === "settimana") return STOP.dcaD; // 2, 3
      if (g === "o" && nutRisk(a)) return STOP.nutrD;                                                    // 10
      if (g === "o" && a.goal65 === "perdere") return STOP.o65D;                                          // 11
      if (a.weighttrend === "involontario") return STOP.caloD;                                           // 12
      return null;
    },
    async generate(a, signal) {
      const T = dietTargets(a); if (!T) throw { code: "invalid" };
      const out = await S.sample.json(pianoPrompt(a, T), { modelTier: "complex", task: "Creo il tuo piano", signal });
      const d = mapDiet(out); if (!Object.keys(d.giorni).length) throw { code: "invalid" };
      return { ...d, fonte: "piano", creato: true, origine: "Creato con le tue risposte", kcal: T.kcal, p: T.p, c: T.c, f: T.f, integratori: [], notes: T.notes, acqua_l: waterLarn(prof()), livello: a.livello, minore: grp() === "r", creatoIl: new Date().toISOString() };
    },
    prevTitle: "Il tuo nuovo piano", prevSub: () => grp() === "r" ? "Per crescere in salute, senza obiettivi di peso" : "Linee guida CREA e LARN, sul tuo fabbisogno",
    preview(d) {
      const td = new Date().getDay(), dw = d.giorni[td] ? td : DOWS.find(x => d.giorni[x]), g = d.giorni[dw] || {}, kid = d.minore;
      const rows = MEALS.filter(([k]) => g[k]).map(([k, l]) => ui.row({ title: l, sub: g[k].t, value: kid ? null : nf(g[k].kcal, 0) })).join("");
      return ui.card(kid ? ui.big(`${Object.keys(g).length} <span class="v3-of">pasti al giorno</span>`, `Proteine ${nf(d.p, 0)} g · acqua ${nf(d.acqua_l, 1)} L`) : ui.big(`${nf(d.kcal, 0)} <span class="v3-of">calorie al giorno</span>`, `Proteine ${nf(d.p, 0)} g · ${Object.keys(g).length} pasti`)) +
        ui.section(`Pasti di ${GG[dw].toLowerCase()}${dw === td ? " (oggi)" : ""}`, rows) +
        (d.regole && d.regole.length ? ui.section("I consigli del piano", d.regole.slice(0, 3).map(t => ui.row({ title: t })).join("")) : "");
    },
    hasCurrent: () => hasMealPlan(), okLabel: "Usa questo piano", keepLabel: "Tieni quello attuale", noLabel: "Non usarlo", keepToast: "Hai tenuto il piano attuale",
    confirm(d) { S.diet = d; persistDoc("diet", S.diet); applyAll(); return { msg: "Nuovo piano salvato", sub: d.minore ? "Per crescere in salute" : "Circa " + nf(d.kcal, 0) + " calorie al giorno" }; }
  });
})();
