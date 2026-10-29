"use strict";
/* Askesis v3 · «I miei alimenti» dentro Cibo (28/10, tavole 39-49).
   Pagine interne di Cibo (prefisso al-): lista (40), foglio Aggiungi (41), scheda alimento (42), scansione (43, 48, 49),
   scrivi a mano (44), nuovo alimento, componi il pasto (45), la mia dieta (46), domanda «settimana prossima» (47).
   Dati: S.foods (stessa struttura di sempre + campi facoltativi: marca, ean, fonte, foto, h, cond, gr, ug), foto in IndexedDB
   (chiave fo_<id>, 256 px), libreria offline window.CIBO_BASE (cibo-base.js, USDA), prodotti da Open Food Facts via codice a barre.
   Chiavi proprie: v3_dieta (la mia dieta, mai dentro S.diet), v3_ripeti (pasti da riproporre), v3_off_cache, v3_foods_v.
   Il piano del dietista non si tocca mai: la mia dieta è un'alternativa e si segue solo se l'utente lo sceglie. */
(function () {
  if (!window.V3 || typeof S === "undefined") return;
  const { ui, data } = V3;
  const e = ui.esc, nf = ui.nf;
  let nav = null; // { open, replace, top } da sec-cibo.js

  /* ---------- utilità ---------- */
  const r1 = v => Math.round((+v || 0) * 10) / 10;
  const n0 = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : null; };
  const kid = () => data.profile().group === "bambino";
  const today = () => localISO();
  const dowT = () => new Date().getDay();
  const LAB = k => k === "extra" ? "Fuori programma" : (MEALS.find(m => m[0] === k) || [k, k])[1];
  const ART = { col: "la", spu: "lo", pra: "il", mer: "la", cen: "la" };
  const DL = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"], DOWS = [1, 2, 3, 4, 5, 6, 0];
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9% ]/g, " ").replace(/\s+/g, " ").trim();
  const foods = () => S.foods || (S.foods = []);
  const byId = id => foods().find(f => f.id === id) || null;
  const gfmt = g => nf(g, g < 10 && g % 1 ? 1 : 0) + " g";
  const monOf = iso => localISO(mondayOf(new Date(iso + "T12:00:00")));
  const sunOf = iso => addDays(monOf(iso), 6);
  const dLong = iso => { const d = new Date(iso + "T12:00:00"); return DOW[d.getDay()].toLowerCase() + " " + d.getDate() + " " + d.toLocaleDateString("it-IT", { month: "long" }); };
  const save = () => { try { persistFoods(); } catch (err) { console.error(err); } };

  /* ---------- migrazione (additiva): valori numerici e campi di base, nessun dato tolto ---------- */
  const FV = "v3_foods_v";
  function normFood(f) {
    const p = f.per100 || (f.per100 = {});
    for (const k of ["kcal", "p", "c", "f"]) p[k] = +p[k] || 0;
    for (const k of ["fib", "sale"]) if (p[k] != null) p[k] = +p[k] || 0;
    f.porzione = +f.porzione || 100; f.used = +f.used || 0; f.tipo = f.tipo || "manuale"; f.nome = String(f.nome || "Alimento");
    return f;
  }
  if ((lsGet(FV, 0) || 0) < 2) { try { foods().forEach(normFood); lsSet("foods", S.foods); lsSet(FV, 2); } catch (err) { console.error(err); } }

  /* ---------- libreria offline (USDA) ---------- */
  const BASE = (window.CIBO_BASE || []).map(a => ({ nome: a[0], gr: a[1], per100: { kcal: a[2], p: a[3], c: a[4], f: a[5], fib: a[6], sale: a[7] }, porzione: a[8], h: a[9] || [], fdc: a[10], cond: !!a[11], key: norm(a[0]) }));
  /* ruolo del cibo: per il bambino e per le frasi che insegnano */
  const GR = { cer: "e", leg: "m", car: "m", pes: "m", lat: "m", uov: "m", ver: "v", fru: "v", sec: "g", con: "g", dol: "d", bev: "b" };
  function roleOf(f) {
    if (f.gr && GR[f.gr]) return GR[f.gr];
    const p = f.per100, k = p.kcal || 1;
    if (/olio|burro|strutto|margarina/i.test(f.nome) || p.f * 9 / k > .6) return "g";
    if (/insalat|verdur|lattuga|rucola|pomodor|zucchin|spinac|carot|broccol|finocch|peperon|melanzan|frutta|mela|pera|banana|arancia|kiwi|fragol/i.test(f.nome) || (k < 50 && p.p < 3)) return "v";
    if (p.p * 4 / k >= .3) return "m";
    if (k < 70 && p.c < 15) return "v";
    if (/biscott|cioccol|merendin|caramell|torta|gelato|zucchero|marmellata|crema/i.test(f.nome)) return "d";
    return "e";
  }
  const ROLE_KID = { m: "Proteine: aiutano i muscoli a crescere", e: "Energia per giocare e allenarti", g: "Grassi buoni: ne basta poco", v: "Fibre e vitamine: più colori, meglio è", d: "Un dolce: ogni tanto, non tutti i giorni", b: "Da bere" };
  const isCond = f => !!f.cond || /\bolio|burro|strutto|margarina|maionese|zucchero|miele|aceto|pesto|ketchup|senape|salsa di soia/i.test(f.nome);
  const stepOf = f => isCond(f) ? 5 : 10;

  /* ---------- foto (IndexedDB, 256 px) ---------- */
  const PURL = {};
  async function idbDel(id) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  async function small(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(r, "image/jpeg", .85));
    } finally { URL.revokeObjectURL(url); }
  }
  async function setPhoto(f, blob) {
    const b = await small(blob), key = "fo_" + f.id;
    await idbPut(key, b);
    if (PURL[f.id]) URL.revokeObjectURL(PURL[f.id]);
    PURL[f.id] = URL.createObjectURL(b); f.foto = key; save();
  }
  async function dropPhoto(f) { const key = f.foto; delete f.foto; save(); if (PURL[f.id]) { URL.revokeObjectURL(PURL[f.id]); delete PURL[f.id]; } if (key) { try { await idbDel(key); } catch (_) {} } }
  const ini = f => e((f.nome || "?").trim().charAt(0).toUpperCase());
  const ph = (f, cls = "") => `<span class="v3-al-ph ${cls}" data-fph="${e(f.id || "")}" aria-hidden="true"><b>${ini(f)}</b></span>`;
  function fillPhotos(root) {
    (root || document).querySelectorAll("[data-fph]").forEach(async el => {
      const f = byId(el.dataset.fph); if (!f || !f.foto) return;
      try { if (!PURL[f.id]) { const b = await idbGet(f.foto); if (!b) return; PURL[f.id] = URL.createObjectURL(b); }
        if (!el.isConnected || el.querySelector("img")) return;
        const im = document.createElement("img"); im.alt = ""; im.src = PURL[f.id]; el.appendChild(im); el.classList.add("on"); } catch (_) {}
    });
  }

  /* icona per categoria (tavole 68-71): foto del prodotto se c'è, altrimenti il disegno del suo gruppo; segno «codice a barre» se arriva da scansione */
  const ICO = {
    cer: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 8c1-2 3-2 4 0M12 7c1-2 3-2 4 0"/>',
    lat: '<path d="M7 8h10l-1 12H8z"/><path d="M6 5h12v3H6z"/>',
    fru: '<circle cx="9" cy="14" r="3"/><circle cx="15" cy="14" r="3"/><circle cx="12" cy="9" r="3"/><path d="M12 6V4"/>',
    ver: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
    leg: '<path d="M5 15c0-5 4-9 9-9h2a3 3 0 0 1 0 6h-2c-2 0-3 1-3 3a4 4 0 0 1-6 0z"/>',
    car: '<path d="M14 4a6 6 0 0 1 3 11l-4 1-2 3a2 2 0 1 1-3-2l1-2 1-4a6 6 0 0 1 4-7z"/>',
    pes: '<path d="M3 12c3-4 7-5 11-5 3 0 5 2 6 5-1 3-3 5-6 5-4 0-8-1-11-5z"/><path d="M3 12l-1-3M3 12l-1 3"/><circle cx="16" cy="11" r=".6"/>',
    uov: '<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>',
    sec: '<path d="M12 4c4 2 6 6 4 11-1 3-3 5-4 5s-3-2-4-5C6 10 8 6 12 4z"/><path d="M12 7v10"/>',
    con: '<path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/>',
    dol: '<circle cx="12" cy="12" r="8"/><path d="M9 9h.01M14 10h.01M10 14h.01M15 15h.01"/>',
    bev: '<path d="M7 4h10l-1.5 16h-7z"/><path d="M7.5 9h9"/>'
  };
  const RG = { m: "car", e: "cer", v: "ver", g: "con", d: "dol", b: "bev" };
  function grOf(f) {
    if (f.gr && ICO[f.gr]) return f.gr;
    const n = f.nome + " " + (f.marca || "");
    for (const [g, re] of [["lat", /yogurt|yoghurt|latte|kefir|skyr|formagg|mozzarell|ricotta|parmigian|grana/i], ["cer", /avena|fiocchi|muesli|granola|cereal|pasta|riso|pane|fette|cracker|grissin|farro|orzo|gallett/i],
      ["fru", /mirtill|frutt|mela|pera|banana|arancia|kiwi|fragol|uva|pesca|lampon/i], ["ver", /insalat|verdur|lattuga|rucola|pomodor|zucchin|spinac|carot|broccol|minestr/i], ["leg", /legum|ceci|fagiol|lentic|piselli|soia|hummus/i],
      ["pes", /tonno|salmone|pesce|merluzz|sgombr|gamber|alici|sardin/i], ["car", /pollo|tacchino|manzo|vitello|maiale|carne|prosciutt|bresaola|salam|wurstel/i], ["uov", /\buov/i], ["sec", /mandorl|noci|nocciol|arachid|pistacch|semi/i],
      ["con", /\bolio|burro|maionese|pesto|salsa/i], ["dol", /biscott|cioccol|merendin|caramell|torta|gelato|marmellata|crema|wafer|barretta/i], ["bev", /acqua|succo|bevanda|tè|caffè|bibita|aranciata/i]]) if (re.test(n)) return g;
    return RG[roleOf(f)] || "cer";
  }
  const svgI = (f, px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[grOf(f)]}</svg>`;
  const BAR = '<span class="v3-al-bc" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14"/></svg></span>';
  const ico = (f, scan) => `<span class="v3-al-io"><span class="v3-al-ic" data-fph="${e(f.id || "")}" aria-hidden="true">${svgI(f, 26)}</span>${scan ? BAR : ""}</span>`;

  /* ---------- numeri e frasi ---------- */
  const kc = (f, g) => f.per100.kcal * g / 100, pr = (f, g) => f.per100.p * g / 100;
  function tot(items) { const t = { kcal: 0, p: 0, c: 0, f: 0 }; for (const x of items) { const f = byId(x.id); if (!f) continue; const k = x.g / 100; t.kcal += f.per100.kcal * k; t.p += f.per100.p * k; t.c += f.per100.c * k; t.f += f.per100.f * k; } return t; }
  const half = n => { n = Math.max(.5, Math.round(n * 2) / 2); const i = Math.floor(n), h = n % 1; return i === 0 ? "mezza porzione" : `${i} ${i === 1 ? "porzione" : "porzioni"}${h ? " e mezza" : ""}`; };
  const porLab = (f, g) => half(g / (f.porzione || 100));
  /* una frase che insegna: il nutriente che pesa di più, nella porzione abituale, confrontato con un cibo di casa */
  function teach(f) {
    const p = f.per100, g = f.porzione || 100;
    if (kid()) return ROLE_KID[roleOf(f)] || ROLE_KID.e;
    const kcal = p.kcal || 1, sp = p.p * 4 / kcal, sc = p.c * 4 / kcal, sf = p.f * 9 / kcal;
    /* «una fetta e mezza di pane», «2 uova e mezzo» */
    const amt = (v, unit, one, many, fem, tail = "") => { const n = Math.max(.5, Math.round(v / unit * 2) / 2), i = Math.floor(n), h = n % 1 ? (fem ? " e mezza" : " e mezzo") : "";
      return (i === 0 ? (fem ? "mezza " : "mezzo ") + one : i === 1 ? (fem ? "una " : "un ") + one + h : `${i} ${many}${h}`) + tail; };
    if (sp >= .25 && p.p * g / 100 >= 3) return `${nf(p.p * g / 100, 0)} g di proteine in ${gfmt(g)}: come ${amt(p.p * g / 100, 6, "uovo", "uova", false)}`;
    if (sf >= .5 && p.f * g / 100 >= 3) return `${nf(p.f * g / 100, 0)} g di grassi in ${gfmt(g)}: come ${amt(p.f * g / 100, 10, "cucchiaio", "cucchiai", false, " d'olio")}`;
    if (sc >= .4 && p.c * g / 100 >= 5) return `${nf(p.c * g / 100, 0)} g di carboidrati in ${gfmt(g)}: come ${amt(p.c * g / 100, 15, "fetta", "fette", true, " di pane")}`;
    return `${nf(p.kcal * g / 100, 0)} calorie in ${gfmt(g)}`;
  }
  /* controllo di Atwater: calorie ≈ 4 × proteine + 4 × carboidrati + 9 × grassi (+2 × fibre), tolleranza 15% */
  function atwater(p) {
    if (!p || !p.kcal) return null;
    const exp = 4 * (+p.p || 0) + 4 * (+p.c || 0) + 9 * (+p.f || 0) + 2 * (+p.fib || 0), d = p.kcal - exp;
    return Math.abs(d) > Math.max(10, .15 * Math.max(exp, p.kcal)) ? Math.round(exp) : null;
  }
  const subOf = f => kid() ? (ROLE_KID[roleOf(f)] || "").split(":")[0] : `${nf(f.per100.kcal, 0)} calorie · ${nf(f.per100.p, f.per100.p < 10 && f.per100.p % 1 ? 1 : 0)} g proteine`;

  /* ---------- aggiungi un alimento (da libreria, da Open Food Facts, da Leo, a mano) ---------- */
  function addFood(o) {
    const f = normFood({ id: "f" + Date.now() + Math.floor(Math.random() * 1000), used: 0, ...o });
    foods().push(f); save(); return f;
  }
  function fromBase(b) {
    const ex = foods().find(f => f.fdc === b.fdc || norm(f.nome) === b.key); if (ex) return ex;
    return addFood({ nome: b.nome, per100: { ...b.per100 }, porzione: b.porzione, tipo: "base", fonte: "USDA", fdc: b.fdc, gr: b.gr, h: b.h.map(x => x.slice()), ...(b.cond ? { cond: 1 } : {}) });
  }

  /* ---------- Open Food Facts: codice a barre (CORS), 15 letture al minuto, cache locale ---------- */
  const OFF = "https://world.openfoodfacts.org/api/v2/product/", OFC = "v3_off_cache", reads = [];
  function eanOk(c) {
    c = String(c || ""); if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
    const d = c.split("").map(Number), chk = d.pop(); let s = 0;
    d.reverse().forEach((x, i) => { s += x * (i % 2 ? 1 : 3); });
    return (10 - s % 10) % 10 === chk;
  }
  async function offGet(ean) {
    const cache = lsGet(OFC, {}) || {};
    if (cache[ean]) return cache[ean].d;
    if (navigator.onLine === false) throw { code: "offline" };
    const now = Date.now(); while (reads.length && now - reads[0] > 60000) reads.shift();
    if (reads.length >= 15) throw { code: "rate" };
    reads.push(now);
    let r;
    try { r = await fetch(`${OFF}${ean}.json?fields=product_name,product_name_it,brands,quantity,nutriments,image_front_small_url,serving_quantity`, { headers: { Accept: "application/json" } }); }
    catch (_) { throw { code: "offline" }; }
    if (!r.ok && r.status !== 404) throw { code: "net" };
    const j = await r.json().catch(() => ({})), p = j && j.status === 1 && j.product;
    let d = null;
    if (p) {
      const n = p.nutriments || {}; let kcal = n0(n["energy-kcal_100g"]); if (kcal == null && n0(n.energy_100g) != null) kcal = n0(n.energy_100g) / 4.184;
      const nome = String(p.product_name_it || p.product_name || "").trim();
      d = { ean, nome: nome || "Prodotto senza nome", marca: String(p.brands || "").split(",")[0].trim(), qty: String(p.quantity || "").trim(), img: p.image_front_small_url || null,
        por: n0(p.serving_quantity), ok: kcal != null && kcal > 0,
        per100: { kcal: Math.round(kcal || 0), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g), fib: n0(n.fiber_100g) != null ? r1(n.fiber_100g) : null, sale: n0(n.salt_100g) != null ? Math.round(n0(n.salt_100g) * 100) / 100 : null } };
    }
    const keys = Object.keys(cache); if (keys.length > 40) delete cache[keys[0]];
    cache[ean] = { t: now, d }; lsSet(OFC, cache);
    return d;
  }
  async function addFromOff(d) {
    const ex = foods().find(f => f.ean === d.ean); if (ex) return ex;
    const p = { ...d.per100 }; if (p.fib == null) delete p.fib; if (p.sale == null) delete p.sale;
    const f = addFood({ nome: d.nome, marca: d.marca || "", ean: d.ean, per100: p, porzione: d.por && d.por > 0 && d.por < 1000 ? Math.round(d.por) : 100, tipo: "off", fonte: "Open Food Facts" });
    if (d.img) { try { const r = await fetch(d.img); if (r.ok) await setPhoto(f, await r.blob()); } catch (_) {} }
    return f;
  }

  /* ---------- Leo legge l'etichetta (funzione già esistente: LABEL_PROMPT + S.sample) ---------- */
  async function leoLabel(file, extra = {}) {
    if (!S.sample) { toast("Per leggere l'etichetta serve Leo", { sub: "Attivalo in Impostazioni, poi riprova" }); return null; }
    toast("Leo sta leggendo l'etichetta", { sub: "Ci vuole qualche secondo" });
    try {
      const blob = await shrink(file), out = await S.sample.json(LABEL_PROMPT, { images: [blob], modelTier: "quick", fast: true });
      const p = out && out.per100 || {}, per100 = { kcal: Math.round(num(p.kcal)), p: r1(num(p.p)), c: r1(num(p.c)), f: r1(num(p.f)) };
      if (!per100.kcal) throw new Error("vuoto");
      const f = addFood({ nome: String(out.nome || "Alimento"), per100, porzione: num(out.porzione_g) || 100, tipo: out.tipo === "etichetta" ? "etichetta" : "stima", fonte: "Leo", ...extra });
      toast(`Aggiunto: ${f.nome}`, { sub: kid() ? "Ora è tra i tuoi alimenti" : `${nf(per100.kcal, 0)} calorie per 100 g` });
      return f;
    } catch (_) { toast("Non riesco a leggere i valori", { sub: "Riprova con l'etichetta dritta e ben illuminata" }); return null; }
  }

  /* ---------- la mia dieta e i pasti da riproporre (chiavi proprie, mai S.diet) ---------- */
  const DK = "v3_dieta", RK = "v3_ripeti";
  let dC; // la dieta letta una volta: mealOf la chiede molte volte per ogni disegno
  const dieta = () => dC !== undefined ? dC : (dC = lsGet(DK, null));
  const setD = d => { dC = d ? JSON.parse(JSON.stringify(d)) : null; lsSet(DK, d); };
  function following() {
    const d = dieta(); if (!d || !d.segui) return false;
    const t = today(); if ((d.dal && t < d.dal) || (d.al && t > d.al)) return false;
    return Object.values(d.giorni || {}).some(g => Object.values(g || {}).some(a => a && a.length));
  }
  function dietMeal(d, dow, k) {
    const its = ((d.giorni || {})[dow] || {})[k] || [], ok = its.filter(x => byId(x.id) && x.g > 0);
    if (!ok.length) return null;
    const t = tot(ok), names = ok.map(x => byId(x.id).nome);
    return { t: names.join(", "), i: ok.map(x => `${byId(x.id).nome} ${nf(x.g, 0)} g`), kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), mia: true };
  }
  /* seguire la mia dieta: i pasti di Cibo e i conti del giorno la usano; il piano del dietista resta intatto in S.diet
     (e le viste che lo modificano, menù e «Modifica i pasti», vedono sempre l'originale) */
  const planMealOf = window.mealOf;
  /* I giorni passati non cambiano MAI: quando un pasto è segnato «come da piano», il giorno tiene i valori del piano in vigore
     in quel momento (v.snap[k] = {kcal, p, c, f, src}); intake() in coach.js legge quelli. Migrazione: i record vecchi senza snap
     ricevono i valori del piano del dietista (l'unico che esisteva), una volta sola e prima che la mia dieta possa entrare in gioco. */
  const nums = m => ({ kcal: +(m && m.kcal) || 0, p: +(m && m.p) || 0, c: +(m && m.c) || 0, f: +(m && m.f) || 0 });
  window.planNutOf = (dow, k) => nums(planMealOf(dow, k));
  const SV = "v3_snap_v";
  if (typeof planMealOf === "function" && (lsGet(SV, 0) || 0) < 1) {
    try { let ch = false;
      for (const [iso, v] of Object.entries(S.days || {})) { if (!v || !v.meals) continue; const dow = new Date(iso + "T12:00:00").getDay();
        for (const [k] of MEALS) if (v.meals[k] && !(v.custom && v.custom[k]) && !(v.snap && v.snap[k])) { (v.snap = v.snap || {})[k] = { ...nums(planMealOf(dow, k)), src: "piano" }; ch = true; } }
      if (ch) lsSet("days", S.days); lsSet(SV, 1);
    } catch (err) { console.error(err); }
  }
  const saveDay0 = window.saveDay;
  if (typeof saveDay0 === "function") window.saveDay = function (iso) {
    try { const v = S.days[iso]; if (v && v.meals) { const dow = new Date(iso + "T12:00:00").getDay(), sn = v.snap || {};
      for (const [k] of MEALS) { if (v.meals[k] && !(v.custom && v.custom[k])) { if (!sn[k]) { const m = window.mealOf(dow, k); sn[k] = { ...nums(m), src: m && m.mia ? "dieta" : "piano" }; } } else delete sn[k]; }
      if (Object.keys(sn).length) v.snap = sn; else delete v.snap; } } catch (err) { console.error(err); }
    return saveDay0.apply(this, arguments);
  };
  if (typeof planMealOf === "function") window.mealOf = function (dow, k) {
    if (!following() || S.hub === "menu" || S.hub === "diet" || S.sheet === "meal-edit") return planMealOf(dow, k);
    const d = dieta(), g = (d.giorni || {})[dow] || {};
    if (!Object.values(g).some(a => a && a.length)) return planMealOf(dow, k); // giorno vuoto: vale il piano di prima
    return dietMeal(d, dow, k);
  };
  const ripeti = () => lsGet(RK, {}) || {};
  function proposta(k) { const r = ripeti()[dowT() + ":" + k], t = today(); return r && t > r.dal && t <= r.al ? r : null; }

  /* «Lo tengo anche la settimana prossima?» (tavola 47): due scelte, cambiabile dopo */
  function ask47(kind, then) {
    let pick = null;
    const what = kind === "dieta" ? "La dieta di questa settimana si ripete uguale. Puoi cambiarla quando vuoi." : `Lo stesso pasto te lo ripropongo ${DOW[dowT()].toLowerCase()} prossimo. Puoi cambiarlo quando vuoi.`;
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Lo tengo anche la settimana prossima?</h2><p class="v3-shp v3-al-t">${e(what)}</p>
      <button class="v3-apri wide" data-v3act="si">Sì, anche la prossima</button><button class="v3-b2" data-v3act="no">No, solo questa settimana</button>`,
      { label: "Lo tengo anche la settimana prossima?", on: { si() { pick = true; sh.close(); }, no() { pick = false; sh.close(); } }, onClose: () => setTimeout(() => then(pick), 60) });
  }

  /* ============================== STILE ============================== */
  if (!document.getElementById("v3-alimenti")) {
    const st = document.createElement("style"); st.id = "v3-alimenti";
    st.textContent = `
    #view.v3 .v3-al-grid, .v3-al-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .v3-al-fig { display: flex; flex-direction: column; gap: 6px; min-width: 0; border: 0; background: transparent; padding: 0; color: var(--v3-t2); text-align: left; font: inherit; }
    .v3-al-fig > span:last-child { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .v3-al-ph { position: relative; display: flex; align-items: center; justify-content: center; flex: none; width: 56px; height: 56px; border-radius: 14px; background: var(--v3-s2); overflow: hidden; color: var(--v3-t2); font-size: 20px; }
    .v3-al-ph b { font-weight: 800; } .v3-al-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .v3-al-ph.on b { visibility: hidden; }
    .v3-al-fig .v3-al-ph { width: 100%; height: auto; aspect-ratio: 1; font-size: 24px; }
    .v3-al-ph.sm { width: 48px; height: 48px; border-radius: 12px; font-size: 18px; }
    .v3-al-ph.big { width: 100%; height: 180px; border-radius: 24px; font-size: 44px; }
    .v3-al-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .v3-al-two > * { min-width: 0; }
    .v3-al-in { width: 100%; box-sizing: border-box; min-height: 48px; border: 0; border-radius: 18px; background: var(--v3-s1); color: var(--v3-t1); font: 400 16px var(--v3-font); padding: 0 16px; outline: none; }
    .v3-al-in::placeholder { color: var(--v3-t3); }
    .v3-al-in:focus { box-shadow: inset 0 0 0 2px var(--accent); }
    .v3-sheet .v3-al-in { background: var(--v3-s2); }
    .v3-al-row { background: var(--v3-s1); border-radius: 18px; min-height: 72px; padding: 12px 12px 12px 16px; display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; border: 0; color: var(--v3-t1); text-align: left; font: inherit; }
    .v3-sheet .v3-al-row { background: var(--v3-s2); }
    .v3-al-row.hl { background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
    .v3-al-row.hl .v3-rt { color: var(--accent); }
    .v3-al-row .v3-apri { width: 96px; min-width: 96px; padding: 0 8px; }
    label.v3-apri { cursor: pointer; }
    .v3-al-st { display: grid; grid-template-columns: 40px minmax(64px, auto) 40px; height: 40px; flex: none; border-radius: 16px; overflow: hidden; background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
    .v3-al-st button { position: relative; border: 0; background: transparent; color: var(--accent); font: 700 20px var(--v3-font); padding: 0; height: 40px; touch-action: manipulation; -webkit-user-select: none; user-select: none; }
    .v3-al-st button:active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
    .v3-al-st button:first-child::after, .v3-al-st button:last-child::before { content: ""; position: absolute; top: 10px; bottom: 10px; width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
    .v3-al-st button:first-child::after { right: 0; } .v3-al-st button:last-child::before { left: 0; }
    .v3-al-sv { display: flex; align-items: center; justify-content: center; padding: 0 8px; font-size: 16px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .v3-al-pr .v3-rt { display: block; overflow-wrap: anywhere; }
    .v3-al-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .v3-al-chip { min-height: 44px; border-radius: 22px; padding: 0 16px; border: 0; background: var(--v3-s2); color: var(--v3-t1); font: 600 15px var(--v3-font); box-shadow: inset 0 0 0 1.5px var(--v3-s3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .v3-al-chip.add { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); font-weight: 700; }
    .v3-al-chip.pl { background: transparent; }
    .v3-al-mc { background: var(--v3-s1); border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .v3-al-mh { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .v3-al-mh span { color: var(--v3-t2); font-size: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .v3-al-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .v3-al-days button { min-height: 48px; border-radius: 16px; border: 0; background: var(--v3-s1); color: var(--v3-t2); font: 600 15px var(--v3-font); padding: 0; }
    .v3-al-days button[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); }
    .v3-al-sum { font-size: 22px; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .v3-al-cam { position: relative; width: 100%; aspect-ratio: 3 / 4; max-height: 56vh; border-radius: 24px; overflow: hidden; background: var(--v3-s2); }
    .v3-al-cam video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .v3-al-cam .v3-al-fr { position: absolute; left: 50%; top: 50%; width: 64%; aspect-ratio: 1.7; transform: translate(-50%, -50%); border-radius: 18px; box-shadow: inset 0 0 0 3px var(--accent), 0 0 0 999px rgba(0,0,0,.25); }
    .v3-al-cam .v3-al-msg { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; background: var(--v3-s2); }
    .v3-al-cam[data-st="denied"] .v3-al-msg, .v3-al-cam[data-st="nocam"] .v3-al-msg, .v3-al-cam[data-st="busy"] .v3-al-msg, .v3-al-cam[data-st="nolib"] .v3-al-msg { display: flex; }
    .v3-al-cam[data-st="busy"] .v3-al-msg { background: rgba(0,0,0,.6); }
    .v3-al-msg b { font-size: 18px; } .v3-al-msg span { font-size: 16px; color: var(--v3-t2); line-height: 1.4; }
    .v3-al-cam .v3-al-hint { position: absolute; left: 0; right: 0; bottom: 16px; text-align: center; font-size: 15px; color: var(--v3-t1); text-shadow: 0 1px 4px rgba(0,0,0,.8); }
    .v3-al-cred { font-size: 14px; color: var(--v3-t2); line-height: 1.4; padding-left: 16px; }
    .v3-al-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
    .v3-al-fields label { display: flex; flex-direction: column; gap: 6px; font-size: 15px; font-weight: 600; color: var(--v3-t2); min-width: 0; }
    .v3-al-fields label.w { grid-column: 1 / -1; }
    .v3-al-cc .v3-al-in { background: var(--v3-s2); }
    .v3-al-x { display: flex; align-items: center; gap: 12px; }
    .v3-al-x > div { flex: 1; min-width: 0; }
    .v3-al-x .v3-rt { display: block; } .v3-al-x .v3-rs { display: block; }
    #view.v3 .v3-al-lime .v3-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    #view.v3 .v3-al-lime .v3-tile { min-height: 76px; padding: 12px; }
    .v3-al-note { font-size: 16px; color: var(--v3-t2); line-height: 1.4; }
    .v3-al-warn { font-size: 16px; font-weight: 700; color: var(--accent); line-height: 1.35; }
    .v3-al-apri { width: 96px; min-width: 96px; padding: 0 8px !important; }
    .v3-al-pg { display: contents; }
    #view.v3 .v3-al-pg .v3-row .v3-apri { width: 96px; min-width: 96px; padding: 0 8px; }
    .v3-sheet .v3-al-t { padding-left: 16px; } .v3-sheet .v3-shp.v3-al-t { color: var(--v3-t2); margin-top: -8px; }
    label.v3-al-lb { display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .v3-al-pm2 { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
    .v3-al-io { position: relative; flex: none; width: 44px; height: 44px; }
    .v3-al-ic { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; overflow: hidden; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent); }
    .v3-al-ic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; } .v3-al-ic.on svg { visibility: hidden; }
    .v3-al-bc { position: absolute; right: -4px; bottom: -4px; z-index: 1; width: 20px; height: 20px; border-radius: 6px; background: var(--v3-bg); color: var(--accent); box-shadow: inset 0 0 0 1.5px var(--accent); display: flex; align-items: center; justify-content: center; }
    .v3-al-prow .v3-rt { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: break-word; line-height: 1.25; }
    .v3-al-st.big { grid-template-columns: 44px minmax(60px, auto) 44px; height: 48px; }
    .v3-al-st.big button { height: 48px; }
    #al-sacts .v3-al-two > * { padding: 0 8px; white-space: nowrap; }
    .v3-al-tots { display: block; margin-top: 4px; font-size: 16px; font-weight: 400; color: var(--v3-t2); font-variant-numeric: tabular-nums; }
    .v3-al-cam.pk { aspect-ratio: auto; height: 300px; max-height: none; }
    .v3-al-cam.pk .v3-al-hint { top: 14px; bottom: auto; }
    .v3-al-cam.pk .v3-al-fr { top: 42%; }
    .v3-al-cam.pk.miss .v3-al-fr { box-shadow: inset 0 0 0 3px var(--warn), 0 0 0 999px rgba(0,0,0,.25); }
    .v3-al-say { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 2; border-radius: 16px; background: rgba(0,0,0,.72); padding: 10px 10px 10px 14px; display: flex; align-items: center; gap: 12px; min-height: 64px; box-sizing: border-box; }
    .v3-al-say:empty { display: none; }
    .v3-al-say > span { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .v3-al-say b { font-size: 16px; line-height: 1.25; } .v3-al-say span span { font-size: 15px; color: var(--v3-t2); }
    .v3-al-say.miss b { color: var(--warn); }
    .v3-al-say button { flex: none; min-height: 44px; padding: 0 14px; border: 0; border-radius: 22px; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: var(--v3-t1); font: 600 14px var(--v3-font); }
    #al-tray:empty { display: none; }
    .v3-al-tray { display: flex; flex-wrap: wrap; gap: 8px; }
    .v3-al-tc { min-height: 44px; max-width: 100%; padding: 0 0 0 12px; border-radius: 999px; background: var(--v3-s1); box-shadow: inset 0 0 0 1px var(--v3-s3); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; box-sizing: border-box; }
    .v3-al-tc svg { flex: none; color: var(--accent); } .v3-al-tc > span { min-width: 0; overflow-wrap: break-word; padding: 6px 0; line-height: 1.3; }
    .v3-al-tc button { flex: none; width: 44px; height: 44px; border: 0; background: transparent; color: var(--v3-t1); font: 700 18px var(--v3-font); padding: 0; }
    .v3-al-trs { margin: -4px 0 0; padding-left: 16px; font-size: 15px; color: var(--v3-t2); }
    @media (max-width: 360px) { .v3-al-st { grid-template-columns: 36px minmax(56px, auto) 36px; } .v3-al-ph { width: 48px; height: 48px; } #view.v3 .v3-al-lime .v3-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.appendChild(st);
  }

  /* ============================== PEZZI ============================== */
  const sorted = () => foods().slice().sort((a, b) => (b.used || 0) - (a.used || 0) || a.nome.localeCompare(b.nome));
  const row = (f, right, cls = "") => `<div class="v3-al-row ${cls}">${ph(f)}<span class="v3-rx v3-al-pr"><span class="v3-rt">${e(f.nome)}</span><span class="v3-rs" style="display:block">${e(subOf(f))}</span></span>${right}</div>`;
  const btn = (label, act, arg, cls = "v3-apri") => `<button class="${cls}" data-v3act="${e(act)}"${arg != null ? ` data-v3arg="${e(arg)}"` : ""}>${e(label)}</button>`;
  const end = (adult, child, q) => ui.end(kid() ? child : adult, { leoQ: q });

  /* Cibo, pagina principale (tavola 39): «I miei alimenti» in evidenza */
  function block() {
    const list = sorted().slice(0, 4);
    const grid = list.length ? `<div class="v3-al-grid">${list.map(f => `<button class="v3-al-fig" data-v3act="al-scheda" data-v3arg="${e(f.id)}" aria-label="${e(f.nome)}">${ph(f)}<span>${e(f.nome)}</span></button>`).join("")}</div>`
      : ui.card(`<p class="v3-rt">Ancora nessun alimento</p><p class="v3-rs">Scansiona il codice a barre di ciò che mangi spesso.</p>`);
    return `<section class="v3-sec">${ui.label("I miei alimenti", `<button class="v3-apri v3-al-apri" data-v3act="al-lista">Apri</button>`)}${grid}
      <div class="v3-al-two">${btn("Scansiona", "al-scan")}${btn("Aggiungi", "al-add", null, "v3-b2")}</div></section>`;
  }

  /* 40 · la lista */
  function listRows(q) {
    const w = norm(q).split(" ").filter(Boolean), all = sorted().filter(f => !w.length || w.every(t => norm(f.nome + " " + (f.marca || "")).split(" ").some(x => x.startsWith(t))));
    if (!all.length) return ui.card(`<p class="v3-rs">${q ? `Nessun alimento con «${e(q)}».` : "Ancora nessun alimento: scansiona il primo."}</p>`);
    return all.map(f => row(f, btn("Apri", "al-scheda", f.id))).join("");
  }
  function pageLista(p) {
    const n = foods().length;
    return ui.back() + `<div><h1 class="v3-t1">I miei alimenti</h1><p class="v3-sub">${n} ${n === 1 ? "alimento" : "alimenti"} · con foto e valori</p></div>` +
      `<section class="v3-sec"><input class="v3-al-in" id="al-find" type="search" inputmode="search" autocomplete="off" placeholder="Cerca nei tuoi alimenti" aria-label="Cerca nei tuoi alimenti" value="${e(p.q || "")}">
        <div class="v3-al-two">${btn("Scansiona", "al-scan")}${btn("Aggiungi", "al-add", null, "v3-b2")}</div></section>
      <section class="v3-sec" id="al-list">${listRows(p.q || "")}</section>` +
      ui.row({ title: "Costruisci la dieta", sub: "Con i tuoi alimenti, pasto per pasto", act: "al-dieta" }) +
      end("I valori per 100 g servono a confrontare prodotti diversi.", "Ogni cibo ha un compito: guardalo nella sua scheda.", "Come si legge un'etichetta?");
  }

  /* 41 · foglio Aggiungi */
  function sheetAdd(ctx = {}) {
    let go = null;
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Aggiungi un alimento</h2><p class="v3-shp v3-al-t">Scegli come</p>
      <div class="v3-al-row hl"><span class="v3-rx"><span class="v3-rt" style="display:block">Scansiona il codice a barre</span><span class="v3-rs" style="display:block">Il più veloce: punti e fatto</span></span>${btn("Scansiona", "scan")}</div>
      <div class="v3-al-row"><span class="v3-rx"><span class="v3-rt" style="display:block">Scrivi a mano</span><span class="v3-rs" style="display:block">Ti propongo i prodotti simili</span></span>${btn("Scrivi", "mano")}</div>
      <div class="v3-al-row"><span class="v3-rx"><span class="v3-rt" style="display:block">Fotografa l'etichetta</span><span class="v3-rs" style="display:block">Se il codice non c'è: Leo legge i valori</span></span><label class="v3-apri">Foto<input type="file" accept="image/*" capture="environment" hidden data-alfile="label"${ctx.pick ? ` data-pick="${e(JSON.stringify(ctx.pick))}"` : ""}></label></div>
      ${ui.secondary("Chiudi", "close")}`, { label: "Aggiungi un alimento", on: {
        scan() { go = { p: "al-scan", pick: ctx.pick || null, host: ctx.host || null }; sh.close(); }, mano() { go = { p: "al-mano", pick: ctx.pick || null }; sh.close(); } },
      onClose: () => { const g = go; go = null; if (g) setTimeout(() => nav.open(g), 60); } });
    return sh;
  }

  /* 42 · la scheda dell'alimento */
  function pageScheda(p) {
    const f = byId(p.id); if (!f) return ui.back() + ui.card(`<p class="v3-rs">Questo alimento non c'è più.</p>`);
    const v = f.per100, at = f.tipo === "base" ? null : atwater(v), k = kid();
    const src = f.fonte === "Open Food Facts" ? "Da Open Food Facts" : f.fonte === "USDA" ? "Dal set base" : f.tipo === "etichetta" || f.fonte === "Leo" ? "Letti da Leo" : "Scritti da te";
    const g = (x, u = " g") => x == null ? "–" : nf(x, x > 0 && x < 1 ? 2 : x < 10 && x % 1 ? 1 : 0) + u;
    const lvl = (x, hi, lo) => x >= hi ? "Tante" : x >= lo ? "Un po'" : "Poche";
    const tiles = k ? [{ label: "Proteine", value: lvl(v.p, 10, 4) }, { label: "Energia", value: lvl(v.c, 40, 12) }, { label: "Grassi", value: lvl(v.f, 15, 4) }, { label: "Fibre", value: lvl(v.fib || 0, 6, 2) }, { label: "Sale", value: v.sale == null ? "–" : v.sale >= 1.25 ? "Tanto" : v.sale >= .3 ? "Un po'" : "Poco" }, { label: "Porzione", value: f.h && f.h[0] ? f.h[0][0] : "1" }]
      : [{ label: "Calorie", value: nf(v.kcal, 0) }, { label: "Proteine", value: g(v.p) }, { label: "Carboidrati", value: g(v.c) }, { label: "Grassi", value: g(v.f) }, { label: "Fibre", value: g(v.fib) }, { label: "Sale", value: g(v.sale) }];
    const hh = (f.h || []).filter(x => x[0] !== "vasetto" || true).slice(0, 2).map(x => `${x[0]} ${nf(x[1], 0)} g`);
    const porz = k ? `Abituale: ${f.h && f.h[0] ? "1 " + f.h[0][0] : "1 porzione"}` : [`Abituale ${nf(f.porzione, 0)} g`].concat(hh).join(" · ");
    const cred = f.fonte === "Open Food Facts" ? `<p class="v3-al-cred">Dati e foto da Open Food Facts (licenza ODbL, foto CC BY-SA). Controlla sempre con l'etichetta.</p>`
      : f.fonte === "USDA" ? `<p class="v3-al-cred">Valori medi da USDA FoodData Central (pubblico dominio).</p>` : "";
    return ui.back() +
      `<section class="v3-sec">${ph(f, "big")}<input type="file" accept="image/*" hidden id="al-fin" data-alfile="foto" data-fid="${e(f.id)}">
        ${f.foto ? `<div class="v3-pm2 v3-al-pm2"><button data-v3act="al-fdel" data-v3arg="${e(f.id)}">Togli la foto</button><button data-v3act="al-fpick">Cambia la foto</button></div>`
          : `<div class="v3-pm2 v3-al-pm2"><button data-v3act="al-fpick">Aggiungi la foto</button></div>`}</section>` +
      `<div><h1 class="v3-t1">${e(f.nome)}</h1><p class="v3-sub">${e([f.marca, k ? "" : `porzione abituale ${nf(f.porzione, 0)} g`].filter(Boolean).join(" · ") || "Il tuo alimento")}</p></div>` +
      `<div class="v3-al-lime">${ui.limeBox({ title: k ? "Cosa porta" : "Per 100 g", tiles, html: `${at != null && !k ? `<p class="v3-al-warn">Le calorie non tornano: con questi valori sarebbero circa ${nf(at, 0)}. Controlla l'etichetta.</p>` : ""}<p class="v3-al-note">${e(teach(f))}</p>` })
        .replace('<p class="v3-lt">', `<p class="v3-lt">`).replace(/(<p class="v3-lt">[^<]*<\/p>)/, `$1<span class="v3-al-note">${e(k ? "" : src)}</span>`)}</div>` +
      `<section class="v3-sec">${ui.row({ title: "Porzioni", sub: porz, act: "al-por", arg: f.id, apri: "Cambia" })}${k ? "" : ui.row({ title: "Valori per 100 g", sub: at != null ? "Da controllare" : src, act: "al-edit", arg: f.id, apri: "Correggi" })}</section>` +
      cred + ui.secondary("Togli dai miei alimenti", "al-del", f.id) +
      end("Per 100 g serve a confrontare, la porzione serve a contare.", "Ogni cibo ha un compito: proteine, energia o vitamine.", "Cosa guardo per primo sull'etichetta?");
  }

  /* 43 · scansione «tipo Yuka»: fotocamera continua, riconoscimento automatico.
     Dal pasto composto (pick.k, tavole 68-71) la fotocamera resta accesa: ogni codice entra subito nel pasto (p.host = la pagina del pasto) */
  const hostOf = p => p && p.p === "al-scan" && p.pick && p.pick.k && p.host && p.host.p === "al-pasto" ? p.host : null;
  const ALLA = { la: "alla", lo: "allo", il: "al" };
  function pageScan(p) {
    const h = hostOf(p);
    if (!h) return ui.back() + `<div><h1 class="v3-t1">Scansiona</h1><p class="v3-sub">Inquadra il codice a barre</p></div>` +
      `<div class="v3-al-cam" id="al-cam" data-st="${e(p.st || "on")}"><video playsinline muted autoplay aria-label="Fotocamera"></video><span class="v3-al-fr" aria-hidden="true"></span>
        <span class="v3-al-hint" aria-live="polite">Lo riconosco da solo, tienilo fermo</span>
        <div class="v3-al-msg" role="status"><b id="al-cam-t">${e(p.mt || "")}</b><span id="al-cam-s">${e(p.ms || "")}</span></div></div>` +
      ui.secondary("Scrivi il codice a mano", "al-ean");
    const k = h.k, back = k === "extra" ? "Torna al fuori programma" : `Torna ${ALLA[ART[k]] || "al"} ${LAB(k).toLowerCase()}`;
    return ui.back() + `<div><h1 class="v3-t1">Scansiona</h1><p class="v3-sub">${e(LAB(k))} · inquadra il codice a barre</p></div>` +
      `<div class="v3-al-cam pk${p.say && p.say.k === "miss" ? " miss" : ""}" id="al-cam" data-st="${e(p.st || "on")}"><video playsinline muted autoplay aria-label="Fotocamera"></video><span class="v3-al-fr" aria-hidden="true"></span>
        <span class="v3-al-hint">Lo riconosco da solo, tienilo fermo</span>
        <div class="v3-al-msg" role="status"><b id="al-cam-t">${e(p.mt || "")}</b><span id="al-cam-s">${e(p.ms || "")}</span></div>
        <div class="v3-al-say${p.say && p.say.k === "miss" ? " miss" : ""}" id="al-say" role="status" aria-live="polite">${sayHtml(p.say)}</div></div>` +
      `<div class="v3-sec" id="al-sacts">${sacts(p)}</div>` +
      `<section class="v3-sec" id="al-tray">${trayHtml(h)}</section>` +
      btn(back, "back", null, "v3-apri wide");
  }
  const sayHtml = s => !s ? "" : `<span><b>${e(s.t)}</b>${s.s ? `<span>${e(s.s)}</span>` : ""}</span>${s.undo ? `<button data-v3act="al-sundo" data-v3arg="${e(s.undo)}">Annulla</button>` : ""}`;
  /* sotto la fotocamera: se il codice non c'è, le tre strade (tavola 70); sempre «Scrivi il codice a mano» */
  const sacts = p => (p.say && p.say.k === "miss" ? `<div class="v3-al-two"><label class="v3-b2 v3-al-lb">Fotografa l'etichetta<input type="file" accept="image/*" capture="environment" hidden data-alfile="label" data-ean="${e(p.say.ean || "")}"></label>${btn("Scansiona un altro", "al-sagain", null, "v3-b2")}</div>` : "") +
    ui.secondary("Scrivi il codice a mano", "al-ean");
  function trayHtml(h) {
    const its = h.items.filter(x => byId(x.id)); if (!its.length) return "";
    return ui.label(`${{ la: "Nella", lo: "Nello" }[ART[h.k]] || "Nel"} ${LAB(h.k).toLowerCase()} · ${its.length}`) +
      `<p class="v3-al-trs">I grammi li sistemi dopo</p><div class="v3-al-tray">${its.map(x => { const f = byId(x.id);
        return `<span class="v3-al-tc">${svgI(f, 18)}<span>${e(f.nome)}</span><button data-v3act="al-sx" data-v3arg="${e(f.id)}" aria-label="Togli ${e(f.nome.toLowerCase())}">×</button></span>`; }).join("")}</div>`;
  }
  /* aggiorna solo i pezzi della scansione, senza ridisegnare: il video resta acceso */
  function scanUpd(p) {
    const h = hostOf(p); if (!h || top() !== p) return;
    const box = document.getElementById("al-cam"), say = document.getElementById("al-say"), acts = document.getElementById("al-sacts"), tray = document.getElementById("al-tray"), miss = !!(p.say && p.say.k === "miss");
    if (box) box.classList.toggle("miss", miss);
    if (say) { say.classList.toggle("miss", miss); say.innerHTML = sayHtml(p.say); }
    if (acts) acts.innerHTML = sacts(p);
    if (tray) tray.innerHTML = trayHtml(h);
  }
  const sayAdded = (f, g) => kid() ? porLab(f, g) : `${gfmt(g)} · ${itemSub(f, g)}`;
  function scanAdd(p, f) {
    const h = hostOf(p); if (!h) return;
    const ex = h.items.find(x => x.id === f.id);
    if (ex) p.say = { k: "ok", t: `${f.nome} c'è già`, s: kid() ? "È già nel piatto" : "I grammi li sistemi dopo" };
    else { const g = gStart(f); h.items.push({ id: f.id, g, sc: 1 }); p.say = { k: "ok", t: `${f.nome} aggiunto`, s: sayAdded(f, g), undo: f.id }; }
    scanUpd(p);
  }
  /* il prodotto lo cerco tra i miei alimenti, poi su Open Food Facts; uno mai visto si salva anche nei miei alimenti */
  async function scanFound(p, code) {
    lastCode = code; lastAt = Date.now(); try { navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive) && navigator.vibrate(40); } catch (_) {}
    const mine = foods().find(f => f.ean === code);
    if (mine) return scanAdd(p, mine);
    p.say = { k: "busy", t: "Cerco il prodotto", s: `Codice ${code}` }; scanUpd(p);
    let d = null, err = null;
    try { d = await offGet(code); } catch (x) { err = x; }
    if (d && d.ok) { const f = await addFromOff(d); return scanAdd(p, f); }
    const why = err ? err.code : d ? "novalori" : "nonc";
    p.say = { k: "miss", ean: code, t: { offline: "Sei senza rete", rate: "Troppe ricerche in un minuto", net: "La libreria non risponde", novalori: "Lo conosco, ma senza valori" }[why] || "Non lo conosco", s: `Codice ${code}` };
    scanUpd(p);
  }
  const POLY = "https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/es/ponyfill.js/+esm"; // ZXing-WASM, versione fissata, solo alla prima scansione
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
  let cam = null, polyMod = null, lastCode = null, lastAt = 0; // lo stesso codice ancora inquadrato si ignora finché resta nel riquadro (4 secondi dall'ultima volta che l'ho visto)
  async function detector() {
    if (window.BarcodeDetector) { try { const f = await BarcodeDetector.getSupportedFormats(); const ok = FORMATS.filter(x => f.includes(x)); if (ok.length) return new BarcodeDetector({ formats: ok }); } catch (_) {} }
    try { polyMod = polyMod || await import(POLY); return new polyMod.BarcodeDetector({ formats: FORMATS }); } catch (_) { return null; }
  }
  function camMsg(st, t, s) {
    const box = document.getElementById("al-cam"), p = nav && nav.top(); if (p && p.p === "al-scan") Object.assign(p, { st, mt: t, ms: s });
    if (!box) return; box.dataset.st = st; const a = document.getElementById("al-cam-t"), b = document.getElementById("al-cam-s"); if (a) a.textContent = t || ""; if (b) b.textContent = s || "";
  }
  function camStop() { if (!cam) return; clearTimeout(cam.t); try { cam.stream && cam.stream.getTracks().forEach(t => t.stop()); } catch (_) {} cam = null; }
  async function camStart() {
    camStop(); const box = document.getElementById("al-cam"); if (!box) return;
    const me = cam = { t: null, stream: null, at: Date.now() };
    camMsg("on");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camMsg("nocam", "Non vedo la fotocamera", "Scrivi il codice a mano qui sotto.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
    catch (err) { if (cam === me) cam = null; return err && (err.name === "NotAllowedError" || err.name === "SecurityError") ? camMsg("denied", "Serve il permesso per la fotocamera", "Consentilo nelle impostazioni del telefono, oppure scrivi il codice a mano.") : camMsg("nocam", "Non vedo la fotocamera", "Scrivi il codice a mano qui sotto."); }
    if (cam !== me || !document.getElementById("al-cam")) { stream.getTracks().forEach(t => t.stop()); return; }
    me.stream = stream;
    const video = () => document.querySelector("#al-cam video");
    const v = video(); v.srcObject = stream; try { await v.play(); } catch (_) {}
    const det = await detector();
    if (cam !== me) return;
    if (!det) { camStop(); return camMsg("nolib", "Non riesco a leggere i codici", "Controlla la rete, oppure scrivi il codice a mano."); }
    const tick = async () => {
      if (cam !== me) return;
      const vv = video(); if (!vv) return camStop(); // pagina chiusa: si spegne da sola
      if (vv.srcObject !== stream) { vv.srcObject = stream; try { await vv.play(); } catch (_) {} }
      try { const codes = await det.detect(vv), now = Date.now(); let c = null;
        for (const x of codes || []) { if (!eanOk(x.rawValue)) continue; if (x.rawValue === lastCode && now - Math.max(lastAt, me.at) < 4000) { lastAt = now; continue; } c = x; break; }
        if (c && cam === me) { const p = top(); if (hostOf(p)) { await scanFound(p, c.rawValue); if (cam === me) me.t = setTimeout(tick, 400); return; } return found(c.rawValue); } } catch (_) {}
      me.t = setTimeout(tick, 160);
    };
    tick();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) camStop(); else if (document.getElementById("al-cam") && !cam) { const p = nav && nav.top(); if (p && p.p === "al-scan" && (p.st || "on") === "on") camStart(); } });

  async function found(code) {
    if (hostOf(top())) return scanFound(top(), code); // dal pasto: la fotocamera resta accesa
    camStop(); lastCode = code; lastAt = Date.now(); try { navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive) && navigator.vibrate(40); } catch (_) {}
    camMsg("busy", "Cerco il prodotto", `Codice ${code}`);
    const mine = foods().find(f => f.ean === code);
    const pk = (top() || {}).pick;
    if (mine) { camMsg("on"); if (pk) return addToPick(pk, mine); toast("Ce l'hai già", { sub: mine.nome }); nav.replace({ p: "al-scheda", id: mine.id }); return; }
    let d = null, err = null;
    try { d = await offGet(code); } catch (x) { err = x; }
    if (d && d.ok) sheetFound(d); else sheetNot(code, err ? err.code : d ? "novalori" : "nonc");
  }

  /* 48 · prodotto trovato */
  function sheetFound(d) {
    let go = null;
    const p = d.per100, prot = p.p * (d.por || 100) / 100, k = kid();
    const line = k ? (ROLE_KID[roleOf({ nome: d.nome, per100: p })] || "") : `${nf(prot, 0)} g di proteine in ${nf(d.por || 100, 0)} g${prot >= 3 ? `: come ${prot < 9 ? "un uovo" : nf(Math.round(prot / 6), 0) + " uova"}` : ""}`;
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">${e(d.nome)}</h2><p class="v3-shp v3-al-t">${e([d.marca, d.qty].filter(Boolean).join(" · ") || "Prodotto trovato")}</p>
      <div class="v3-al-x"><span class="v3-al-ph big" style="width:72px;height:72px;border-radius:14px" aria-hidden="true">${d.img ? `<img src="${e(d.img)}" alt="" onerror="this.remove()">` : ""}<b>${e(d.nome.charAt(0).toUpperCase())}</b></span>
        <div><p class="v3-rt">${k ? e(d.nome) : `${nf(p.kcal, 0)} calorie per 100 g`}</p><p class="v3-rs">${e(line)}</p></div></div>
      <p class="v3-al-cred" style="padding-left:16px">Da Open Food Facts · controlla con l'etichetta</p>
      ${btn("Aggiungi ai miei alimenti", "add", null, "v3-apri wide")}${ui.secondary("Scansiona un altro", "again")}`,
      { label: d.nome, on: { async add(_, b) { b.disabled = true; const f = await addFromOff(d); go = f; sh.close(); }, again() { go = "again"; sh.close(); } },
        onClose: () => setTimeout(() => {
          const pk = (top() || {}).pick;
          if (go && go.id && pk) addToPick(pk, go);
          else if (go && go.id) { toast("Aggiunto ai tuoi alimenti", { sub: kid() ? go.nome : `${go.nome} · ${nf(go.per100.kcal, 0)} calorie per 100 g` }); nav.replace({ p: "al-scheda", id: go.id }); }
          else if (document.getElementById("al-cam")) camStart();
        }, 60) });
  }
  /* 49 · non trovato (anche senza rete o senza valori) */
  function sheetNot(code, why) {
    let go = null;
    const T = { offline: ["Sei senza rete", `Il codice ${code} lo cerco quando torna la rete. Intanto puoi aggiungerlo così.`], rate: ["Troppe ricerche in un minuto", "Aspetta qualche secondo, oppure aggiungilo così."], net: ["La libreria non risponde", `Codice ${code}. Intanto puoi aggiungerlo così.`],
      novalori: ["Lo conosco, ma senza valori", `Codice ${code}: puoi scriverlo a mano o fotografare l'etichetta.`], nonc: ["Non lo conosco", `Codice ${code}: non è in libreria. Puoi scriverlo a mano o fotografare l'etichetta.`] }[why] || ["Non lo conosco", `Codice ${code}.`];
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">${e(T[0])}</h2><p class="v3-shp v3-al-t">${e(T[1])}</p>
      ${btn("Scansiona un altro", "again", null, "v3-apri wide")}${ui.secondary("Scrivi a mano", "mano")}
      <label class="v3-b2 v3-al-lb">Fotografa l'etichetta<input type="file" accept="image/*" capture="environment" hidden data-alfile="label" data-ean="${e(code)}"></label>`,
      { label: T[0], on: { mano() { go = "mano"; sh.close(); }, again() { go = "again"; sh.close(); } },
        onClose: () => setTimeout(() => { if (go === "mano") nav.replace({ p: "al-mano", ean: code, pick: (top() || {}).pick || null }); else if (document.getElementById("al-cam")) camStart(); }, 60) });
    sheetNot.cur = sh;
  }
  function sheetEan() {
    let code = null;
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Scrivi il codice</h2><p class="v3-shp v3-al-t">Le cifre sotto le barre, di solito 13.</p>
      <input class="v3-al-in" id="al-ean" inputmode="numeric" autocomplete="off" maxlength="14" aria-label="Codice a barre"><p class="v3-al-warn" id="al-ean-e" hidden>Il codice non torna: controlla le cifre.</p>
      ${btn("Cerca il prodotto", "ok", null, "v3-apri wide")}${ui.secondary("Chiudi", "close")}`,
      { label: "Scrivi il codice", on: { ok() { const v = (document.getElementById("al-ean").value || "").replace(/\D/g, ""); if (!eanOk(v)) { document.getElementById("al-ean-e").hidden = false; return; } code = v; sh.close(); } },
        onClose: () => { if (code) setTimeout(() => found(code), 60); } });
    setTimeout(() => { const i = document.getElementById("al-ean"); if (i) try { i.focus(); } catch (_) {} }, 80);
  }

  /* 44 · scrivi a mano: prima i miei alimenti, poi la libreria, dopo 3 lettere e 600 ms */
  function matches(q) {
    const w = norm(q).split(" ").filter(Boolean); if (!w.length) return { mine: [], lib: [] };
    const hit = s => { const t = norm(s).split(" "); return w.every(x => t.some(y => y.startsWith(x))); };
    const score = s => (norm(s).startsWith(w[0]) ? 0 : 1) * 100 + s.length;
    const mine = foods().filter(f => hit(f.nome + " " + (f.marca || ""))).sort((a, b) => score(a.nome) - score(b.nome)).slice(0, 5);
    const have = new Set(mine.map(f => norm(f.nome)));
    const lib = BASE.filter(b => !have.has(b.key) && hit(b.nome)).sort((a, b) => score(a.nome) - score(b.nome)).slice(0, 8);
    return { mine, lib };
  }
  function manoRes(q) {
    if (norm(q).length < 3) return `<p class="v3-al-note" style="padding-left:16px">Scrivi almeno 3 lettere.</p>`;
    const m = matches(q);
    const libRow = (b, i) => `<div class="v3-al-row"><span class="v3-al-ph" aria-hidden="true"><b>${e(b.nome.charAt(0))}</b></span><span class="v3-rx v3-al-pr"><span class="v3-rt">${e(b.nome)}</span><span class="v3-rs" style="display:block">${e(kid() ? (ROLE_KID[GR[b.gr]] || "").split(":")[0] : `${nf(b.per100.kcal, 0)} calorie`)}</span></span>${btn("Scegli", "al-pickb", BASE.indexOf(b))}</div>`;
    return (m.mine.length ? ui.section(kid() ? "Dai tuoi alimenti" : "Dai tuoi alimenti · per 100 g", m.mine.map(f => row(f, btn("Scegli", "al-pickf", f.id))).join("")) : "") +
      (m.lib.length ? ui.section(kid() ? "Dalla libreria" : "Dalla libreria · per 100 g", m.lib.map(libRow).join("")) : "") +
      (!m.mine.length && !m.lib.length ? ui.card(`<p class="v3-rs">Nessun alimento con «${e(q)}».</p>`) : "");
  }
  function pageMano(p) {
    return ui.back() + `<div><h1 class="v3-t1">Scrivi a mano</h1><p class="v3-sub">${p.pick ? "Scegli cosa aggiungere" : "Scrivi il nome, ti suggerisco io"}</p></div>` +
      `<input class="v3-al-in" id="al-q" type="search" autocomplete="off" placeholder="Per esempio: yogurt greco" aria-label="Nome dell'alimento" value="${e(p.q || "")}">` +
      `<div class="v3-sec" id="al-res" aria-live="polite">${p.q && norm(p.q).length >= 3 ? manoRes(p.q) : ""}</div>` +
      `<div class="v3-al-two">${btn("Scansiona", "al-mscan")}${btn("Scrivi i valori", "al-nuovo", null, "v3-b2")}</div>` +
      end("Il set base usa valori medi pubblici, non di una marca.", "Scrivi il nome: ti mostro i cibi che conosco.", "Perché i valori cambiano tra le marche?");
  }

  /* nuovo alimento o correzione dei valori (controllo di Atwater) */
  function pageNuovo(p) {
    const f = p.id ? byId(p.id) : null, v = f ? f.per100 : {}, val = x => x == null ? "" : String(x).replace(".", ",");
    const fld = (id, lab, x, mode = "decimal", w = "") => `<label class="${w}">${e(lab)}<input class="v3-al-in" id="${id}" inputmode="${mode}" autocomplete="off" value="${e(val(x))}"></label>`;
    return ui.back() + `<div><h1 class="v3-t1">${f ? "Correggi i valori" : "Nuovo alimento"}</h1><p class="v3-sub">Valori per 100 g, come sull'etichetta</p></div>` +
      `<div class="v3-cc v3-al-cc"><div class="v3-al-fields">${fld("al-n", "Nome", f ? f.nome : p.nome || "", "text", "w")}${fld("al-k", "Calorie", v.kcal, "numeric")}${fld("al-p", "Proteine (g)", v.p)}${fld("al-c", "Carboidrati (g)", v.c)}${fld("al-f", "Grassi (g)", v.f)}${fld("al-fib", "Fibre (g)", v.fib)}${fld("al-s", "Sale (g)", v.sale)}${fld("al-por", "Porzione abituale (g)", f ? f.porzione : 100, "numeric", "w")}</div>
        <p class="v3-al-warn" id="al-err" hidden></p></div>` +
      btn(f ? "Salva i valori" : "Salva l'alimento", "al-nsave", null, "v3-apri wide") +
      end("Calorie: circa proteine per 4, carboidrati per 4, grassi per 9.", "Scrivi i numeri come sull'etichetta.", "Perché le calorie si calcolano così?");
  }
  function readNuovo() {
    const g = id => n0((document.getElementById(id) || {}).value);
    return { nome: ((document.getElementById("al-n") || {}).value || "").trim(), per100: { kcal: g("al-k"), p: g("al-p") || 0, c: g("al-c") || 0, f: g("al-f") || 0, fib: g("al-fib"), sale: g("al-s") }, porzione: g("al-por") || 100 };
  }

  /* 45 · componi il pasto («Ho mangiato un'altra cosa») */
  /* audit M10: iso = giorno passato del diario (fino a 13 giorni fa); senza iso è oggi */
  const pIso = iso => iso && iso < today() && iso >= addDays(today(), -13) ? iso : null;
  const GG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  function pastoInit(k, iso) {
    iso = pIso(iso); const v = S.days[iso || today()], c = v && v.custom && k !== "extra" ? v.custom[k] : null;
    if (c && Array.isArray(c.items)) return { items: c.items.filter(x => byId(x.id)).map(x => ({ ...x })), from: "edit", iso };
    if (iso) return { items: [], from: c ? "testo" : "", iso };
    const pz = k !== "extra" && proposta(k); if (pz) return { items: pz.items.filter(x => byId(x.id)).map(x => ({ ...x })), from: "ripeti" };
    return { items: [], from: c ? "testo" : "" };
  }
  const gLab = (f, g) => kid() ? porLab(f, g) : gfmt(g);
  const teen = () => data.profile().group === "ragazzo";
  /* sotto il nome: calorie per l'adulto, proteine per il ragazzo (niente calorie ai minori), il compito del cibo per il bambino */
  const itemSub = (f, g) => kid() ? (ROLE_KID[roleOf(f)] || "").split(":")[0] : teen() ? `${nf(pr(f, g), 0)} g di proteine` : `${nf(kc(f, g), 0)} calorie`;
  const gStart = f => Math.max(stepOf(f), Math.round((f.porzione || 100) / stepOf(f)) * stepOf(f));
  function totLine(items) {
    const t = tot(items);
    if (kid()) { const r = new Set(items.filter(x => x.g > 0 && byId(x.id)).map(x => roleOf(byId(x.id)))), miss = [["m", "le proteine"], ["v", "la verdura"], ["e", "l'energia"]].filter(([q]) => !r.has(q)).map(x => x[1]);
      return { big: items.length ? (miss.length ? "Nel piatto manca " + miss.join(" e ") : "Piatto completo") : "Piatto vuoto", t }; }
    if (teen()) return { big: `${nf(t.p, 0)} g di proteine`, sub: `Carboidrati ${nf(t.c, 0)} g`, t };
    return { big: `${nf(t.kcal, 0)} calorie · ${nf(t.p, 0)} g di proteine`, sub: `Carboidrati ${nf(t.c, 0)} g · Grassi ${nf(t.f, 0)} g`, t };
  }
  function oilLine(p) {
    const its = p.items.filter(x => x.g > 0 && byId(x.id)); if (!its.length) return "";
    if (its.some(x => isCond(byId(x.id)))) return "";
    const veg = its.find(x => roleOf(byId(x.id)) === "v");
    if (!veg && !["pra", "cen"].includes(p.k)) return "";
    return `<div class="v3-al-x"><p class="v3-al-note" style="flex:1">${veg ? `Hai messo l'olio ${/insalat|lattuga|rucola/i.test(byId(veg.id).nome) ? "sull'insalata" : "sulle verdure"}?` : "Hai messo l'olio?"}</p><button class="v3-in" data-v3act="al-oil">Aggiungi l'olio</button></div>`;
  }
  function pastoBox(p) { const l = totLine(p.items); return `<div class="v3-lime" id="al-tot"><p class="v3-al-sum" id="al-tot-n">${e(l.big)}${l.sub && p.items.length ? `<span class="v3-al-tots" id="al-tot-s">${e(l.sub)}</span>` : ""}</p>${oilLine(p)}</div>`; }
  function pageRows(p) {
    return p.items.map((x, i) => { const f = byId(x.id); if (!f) return ""; const st = stepOf(f), lo = f.nome.toLowerCase();
      const less = kid() ? `Meno mezza porzione di ${lo}` : `Meno ${st} g di ${lo}`, more = kid() ? `Più mezza porzione di ${lo}` : `Più ${st} g di ${lo}`;
      return `<div class="v3-al-row v3-al-prow">${ico(f, x.sc || !!f.ean)}<span class="v3-rx v3-al-pr"><span class="v3-rt">${e(f.nome)}</span><span class="v3-rs" style="display:block" id="al-sk${i}">${e(itemSub(f, x.g))}</span></span>
        <div class="v3-al-st big" role="group" aria-label="Quantità di ${e(lo)}"><button data-v3act="al-g" data-v3arg="${i}:-1" data-hold="alg${i}m" aria-label="${e(less)}">−</button><span class="v3-al-sv" id="al-sv${i}" aria-live="polite">${e(gLab(f, x.g))}</span><button data-v3act="al-g" data-v3arg="${i}:1" data-hold="alg${i}p" aria-label="${e(more)}">+</button></div></div>`; }).join("");
  }
  function pagePasto(p) {
    const used = sorted().filter(f => !p.items.some(x => x.id === f.id)).slice(0, 4), k = p.k, rp = !p.iso && k !== "extra" && ripeti()[dowT() + ":" + k], n = p.items.length;
    const sub = p.from === "ripeti" ? `Come ${DOW[dowT()].toLowerCase()} scorso, cambia pure` : n ? `${n} ${n === 1 ? "alimento" : "alimenti"} · sistema i grammi` : p.from === "testo" ? "Rifallo con i tuoi alimenti" : "Componi con i tuoi alimenti";
    const two = n ? `<div class="v3-al-two">${btn("Scansiona un altro", "al-pscan", null, "v3-b2")}${btn("Aggiungi", "al-pfind", null, "v3-b2")}</div>`
      : `<div class="v3-al-two">${btn("Scansiona", "al-pscan")}${btn("Aggiungi", "al-pfind", null, "v3-b2")}</div>${p.iso ? btn("Scrivilo a parole", "al-parole", k, "v3-b2") : `<button class="v3-b2" data-act="mealalt" data-v="${e(k)}">Scrivilo a parole</button>`}`;
    return ui.back() + `<div><h1 class="v3-t1">${e(LAB(k))}${p.iso ? " di " + GG[new Date(p.iso + "T12:00:00").getDay()] : ""}</h1><p class="v3-sub">${e(sub)}</p></div>` +
      (n ? `<section class="v3-sec" id="al-rows">${pageRows(p)}${two}</section>` : `<section class="v3-sec">${ui.card(`<p class="v3-rt">Cosa hai mangiato?</p><p class="v3-rs">Scansiona il codice o aggiungi un alimento. Puoi scansionarne più di uno di fila.</p>`)}${two}</section>`) +
      (used.length ? ui.section("I più usati", `<div class="v3-al-chips">${used.map(f => `<button class="v3-al-chip pl" data-v3act="al-padd" data-v3arg="${e(f.id)}">+ ${e(f.nome)}</button>`).join("")}</div>`) : "") +
      (n ? pastoBox(p) + (rp ? ui.row({ title: "Lo riproponi la prossima settimana", sub: `Fino a ${dLong(rp.al)}`, act: "al-rp", apri: "Cambia" }) : "") +
        btn(k === "extra" ? "Segna il fuori programma" : `Segna ${ART[k] || "il"} ${LAB(k).toLowerCase()}`, "al-psave", null, "v3-apri wide") : "") +
      end("Un cucchiaio d'olio vale circa 90 calorie: si conta anche lui.", "Nel piatto: proteine, verdura e una fonte di energia.", "Quanto olio posso usare al giorno?");
  }
  function pastoUpd(p, i) {
    const x = p.items[i], f = x && byId(x.id); if (!f) return;
    const sv = document.getElementById("al-sv" + i), sk = document.getElementById("al-sk" + i), n = document.getElementById("al-tot-n"), l = totLine(p.items);
    if (sv) sv.textContent = gLab(f, x.g);
    if (sk) sk.textContent = itemSub(f, x.g);
    if (n) { n.firstChild.textContent = l.big; const s2 = document.getElementById("al-tot-s"); if (s2 && l.sub) s2.textContent = l.sub; }
  }
  function savePasto(p) {
    const its = p.items.filter(x => x.g > 0 && byId(x.id));
    if (!its.length) { toast("Aggiungi almeno un alimento", { sub: "Tocca un alimento, poi le quantità" }); return; }
    const t = tot(its), iso = pIso(p.iso) || today(), past = iso !== today(), first = !(S.days[iso] && intake(iso).logged), d = dayLog(iso), k = p.k;
    const prev = k === "extra" ? null : { c: d.custom[k] ? JSON.parse(JSON.stringify(d.custom[k])) : null, m: d.meals[k], s: d.skip[k] };
    const en = { text: its.map(x => kid() ? byId(x.id).nome : `${byId(x.id).nome} ${nf(x.g, 0)} g`).join(", "), kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), items: its.map(x => ({ id: x.id, g: x.g })) };
    let xid = null;
    if (k === "extra") { xid = Date.now(); d.extra.push({ id: xid, ...en }); } else { d.custom[k] = en; d.meals[k] = false; delete d.skip[k]; }
    saveDay(iso); if (first) { try { data.saveDayTarget(iso); } catch (_) {} }
    for (const x of its) { const f = byId(x.id); f.used = (f.used || 0) + 1; f.ug = x.g; } save();
    const undo = () => { const dd = dayLog(iso); if (k === "extra") dd.extra = dd.extra.filter(z => z.id !== xid); else { if (prev.c) dd.custom[k] = prev.c; else delete dd.custom[k]; dd.meals[k] = prev.m || false; if (prev.s) dd.skip[k] = prev.s; } saveDay(iso); V3.refresh(); };
    const sub = kid() ? `${its.length} ${its.length === 1 ? "alimento" : "alimenti"} nel piatto` : `${nf(en.kcal, 0)} calorie · ${nf(en.p, 0)} g di proteine`;
    const msg = k === "extra" ? "Fuori programma segnato" : `${LAB(k)} ${k === "col" || k === "mer" || k === "cen" ? "segnata" : "segnato"}`;
    if (k === "extra") { toast(msg, { sub, undo }); V3.go("cibo"); return; }
    if (past) { toast(msg, { sub: `${sub} · ${dLong(iso)}`, undo }); V3.back(); return; } // giorno del diario: si torna al diario, niente «riproponi»
    ask47("pasto", yes => {
      const all = ripeti(), key = dowT() + ":" + k;
      if (yes) { all[key] = { items: en.items, dal: iso, al: addDays(sunOf(iso), 7) }; lsSet(RK, all); } else if (yes === false && all[key]) { delete all[key]; lsSet(RK, all); }
      toast(msg, { sub: yes ? `${sub} · te lo ripropongo` : sub, undo });
      V3.go("cibo");
    });
  }

  /* 46 · la mia dieta: giorno per giorno, pasto per pasto. Alternativa al piano del dietista, mai sopra di lui */
  function dietDraft() { const d = dieta(); return d ? JSON.parse(JSON.stringify(d)) : { giorni: {}, segui: !hasMealPlan(), dal: null, al: null }; }
  function dayTot(dd, dow) { const g = (dd.giorni || {})[dow] || {}; return tot(Object.values(g).flat()); }
  function fv(dd, dow) { const g = (dd.giorni || {})[dow] || {}; let n = 0; for (const x of Object.values(g).flat()) { const f = byId(x.id); if (f && roleOf(f) === "v") n += x.g / (f.gr === "fru" || /frutt|mela|pera|banana|arancia/i.test(f.nome) ? 150 : f.porzione >= 150 ? 200 : 80); } return Math.round(n); }
  function pageDieta(p) {
    const dd = p.d, dow = p.dow, g = (dd.giorni || {})[dow] || {}, k = kid(), saved = dieta();
    const card = ([mk, l]) => { const its = (g[mk] || []).filter(x => byId(x.id)), t = tot(its);
      return `<div class="v3-al-mc"><div class="v3-al-mh"><p class="v3-rt">${e(l)}</p><span>${its.length ? (k ? `${its.length} ${its.length === 1 ? "alimento" : "alimenti"}` : `${nf(t.kcal, 0)} calorie`) : "da comporre"}</span></div>
        <div class="v3-al-chips">${its.map((x, i) => `<button class="v3-al-chip" data-v3act="al-dit" data-v3arg="${mk}:${i}">${e(byId(x.id).nome)} ${e(k ? "" : nf(x.g, 0) + " g")}</button>`).join("")}<button class="v3-al-chip add" data-v3act="al-dadd" data-v3arg="${mk}" aria-label="Aggiungi a ${e(l.toLowerCase())}">Aggiungi</button></div></div>`; };
    const T = planTargets().kcal, t = dayTot(dd, dow), miss = [["col", "la colazione"], ["pra", "il pranzo"], ["cen", "la cena"]].filter(([mk]) => !(g[mk] || []).length).map(x => x[1]);
    const left = Math.round((T - t.kcal) / 50) * 50;
    const big = k ? (miss.length ? "Ancora " + miss.join(" e ") : "Giornata completa") : miss.length ? `Ancora ${miss.join(" e ")}${left > 100 ? ` e circa ${nf(left, 0)} calorie` : ""}` : Math.abs(left) <= 150 ? "Giornata completa" : left > 0 ? `Mancano circa ${nf(left, 0)} calorie` : `Circa ${nf(-left, 0)} calorie oltre il piano`;
    const segRow = saved ? `<div class="v3-row"><span class="v3-rx"><span class="v3-rt" style="display:block">Segui la mia dieta</span><span class="v3-rs" style="display:block">${hasMealPlan() ? "Il piano del dietista resta com'è" : "Cibo ti propone questi pasti"}</span></span><button class="v3-progressi-tog" role="switch" aria-checked="${!!saved.segui}" aria-pressed="${!!saved.segui}" aria-label="Segui la mia dieta" data-v3act="al-segui"><i></i></button></div>` +
      ui.row({ title: "Vale fino a " + dLong(saved.al || sunOf(today())), sub: saved.ripeti ? "Si ripete anche la prossima settimana" : "Solo questa settimana", act: "al-dval", apri: "Cambia" }) : "";
    return ui.back() + `<div><h1 class="v3-t1">La mia dieta</h1><p class="v3-sub">${hasMealPlan() ? "Alternativa al piano del dietista" : "Con i tuoi alimenti, pasto per pasto"}</p></div>` +
      `<div class="v3-al-days" role="group" aria-label="Giorno della settimana">${DOWS.map(d => `<button data-v3act="al-dow" data-v3arg="${d}" aria-pressed="${d === dow}">${DL[d]}</button>`).join("")}</div>` +
      `<section class="v3-sec">${MEALS.map(card).join("")}</section>` +
      `<div class="v3-lime"><p class="v3-al-sum v3-lt">${e(big)}</p><p class="v3-al-note">Frutta e verdura: ${fv(dd, dow)} ${fv(dd, dow) === 1 ? "porzione" : "porzioni"} su 5</p></div>` +
      (segRow ? `<section class="v3-sec">${segRow}</section>` : "") +
      `<div class="v3-al-two">${btn("Copia il giorno", "al-dcopy", null, "v3-b2")}${btn("Salva la dieta", "al-dsave")}</div>` +
      end("Ogni pasto con proteine, verdura e una fonte di energia.", "Ogni pasto con proteine, verdura e una fonte di energia.", "Come compongo un pasto equilibrato?");
  }
  function sheetDit(p, mk, i) {
    const its = p.d.giorni[p.dow][mk], x = its[i], f = byId(x.id), st = stepOf(f);
    let del = false;
    const lab = () => gLab(f, x.g);
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">${e(f.nome)}</h2><p class="v3-shp v3-al-t">${e(LAB(mk))}, ${e(DOW[p.dow].toLowerCase())}</p>
      <div class="v3-al-x"><div><p class="v3-rt" id="al-dkc">${kid() ? "" : nf(kc(f, x.g), 0) + " calorie"}</p></div><div class="v3-al-st" role="group" aria-label="Quantità"><button data-v3act="g" data-v3arg="-1" data-hold="aldm" aria-label="Meno ${st} g">−</button><span class="v3-al-sv" id="al-dsv">${e(lab())}</span><button data-v3act="g" data-v3arg="1" data-hold="aldp" aria-label="Più ${st} g">+</button></div></div>
      ${btn("Fatto", "close", null, "v3-apri wide")}${ui.secondary("Togli dal pasto", "del")}`,
      { label: f.nome, on: { g(a) { const sv = kid() ? (f.porzione || 100) / 2 : st; x.g = Math.max(sv, x.g + sv * (+a)); document.getElementById("al-dsv").textContent = lab(); const kk = document.getElementById("al-dkc"); if (kk && !kid()) kk.textContent = nf(kc(f, x.g), 0) + " calorie"; },
        del() { del = true; sh.close(); } },
        onClose: () => setTimeout(() => { if (del) { its.splice(i, 1); toast("Tolto dal pasto", { sub: f.nome }); } V3.refresh(); }, 60) });
  }
  function sheetCopy(p) {
    const sel = new Set(); let ok = false;
    const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Copia ${e(DOW[p.dow].toLowerCase())}</h2><p class="v3-shp v3-al-t">Scegli i giorni: i loro pasti diventano uguali.</p>
      <div class="v3-al-days" role="group" aria-label="Giorni">${DOWS.filter(d => d !== p.dow).map(d => `<button data-v3act="t" data-v3arg="${d}" aria-pressed="false">${DL[d]}</button>`).join("")}</div>
      ${btn(`Copia ${DOW[p.dow].toLowerCase()}`, "ok", null, "v3-apri wide")}${ui.secondary("Chiudi", "close")}`,
      { label: "Copia su altri giorni", on: { t(a, b) { const d = +a; if (sel.has(d)) sel.delete(d); else sel.add(d); b.setAttribute("aria-pressed", String(sel.has(d))); }, ok() { if (!sel.size) return; ok = true; sh.close(); } },
        onClose: () => setTimeout(() => { if (!ok) return; const src = JSON.stringify(p.d.giorni[p.dow] || {}); for (const d of sel) p.d.giorni[d] = JSON.parse(src);
          toast(`${DOW[p.dow]} copiato`, { sub: "Su " + [...sel].sort((a, b) => DOWS.indexOf(a) - DOWS.indexOf(b)).map(d => DOW[d].toLowerCase()).join(", ") }); V3.refresh(); }, 60) });
  }

  /* ============================== AZIONI ============================== */
  const top = () => nav && nav.top();
  function addToPick(pick, f, pop = true) {
    // pick: { k } pasto composto, { dk, dow } dieta. Torna alla pagina di prima (pop) con l'alimento aggiunto
    if (pop) history.back();
    setTimeout(() => {
      const p = top(); if (!p) return;
      if (pick.k && p.p === "al-pasto") { const ex = p.items.find(x => x.id === f.id); if (!ex) p.items.push({ id: f.id, g: Math.max(stepOf(f), Math.round((f.porzione || 100) / stepOf(f)) * stepOf(f)) }); }
      if (pick.dk && p.p === "al-dieta") { const g = p.d.giorni[pick.dow] = p.d.giorni[pick.dow] || {}; (g[pick.dk] = g[pick.dk] || []).push({ id: f.id, g: f.porzione || 100 }); }
      toast("Aggiunto", { sub: f.nome }); V3.refresh();
    }, pop ? 120 : 0);
  }
  const on = {
    "al-lista"() { nav.open({ p: "al-lista", q: "" }); },
    "al-add"() { sheetAdd(); },
    "al-scan"() { nav.open({ p: "al-scan" }); },
    "al-scheda"(id) { nav.open({ p: "al-scheda", id }); },
    "al-dieta"() { nav.open({ p: "al-dieta", d: dietDraft(), dow: dowT() }); },
    "al-altra"(k) { nav.open({ p: "al-pasto", k, ...pastoInit(k) }); },
    "al-parole"(k) { const p = nav.top(), iso = p && p.iso, d = iso && S.days[iso], c = d && d.custom && d.custom[k]; S.food = { key: k, text: c ? c.text : "", items: [], note: "", busy: false, err: null, iso }; openSheet("food"); },
    "al-ean"() { sheetEan(); },
    "al-fpick"() { const i = document.getElementById("al-fin"); if (i) i.click(); },
    "al-fdel"(id) { const f = byId(id); if (!f) return; let ok = false;
      const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Togliere la foto?</h2><p class="v3-shp v3-al-t">Resta l'alimento con i suoi valori.</p>${btn("Sì, togli la foto", "ok", null, "v3-apri wide")}${ui.secondary("No, la tengo", "close")}`,
        { label: "Togliere la foto?", on: { ok() { ok = true; sh.close(); } }, onClose: () => { if (!ok) return; dropPhoto(f).then(() => { V3.refresh(); toast("Foto tolta", { sub: f.nome }); }); } }); },
    "al-del"(id) { const f = byId(id); if (!f) return; let ok = false;
      const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Togliere «${e(f.nome)}»?</h2><p class="v3-shp v3-al-t">Lo tolgo dai tuoi alimenti, con la foto. I pasti già segnati restano.</p>${btn("Sì, togli l'alimento", "ok", null, "v3-apri wide")}${ui.secondary("No, lo tengo", "close")}`,
        { label: "Togliere l'alimento?", on: { ok() { ok = true; sh.close(); } },
          onClose: () => { if (!ok) return; setTimeout(async () => {
            const i = foods().indexOf(f), blob = f.foto ? await idbGet(f.foto).catch(() => null) : null;
            S.foods = foods().filter(x => x !== f); save(); if (f.foto) { try { await idbDel(f.foto); } catch (_) {} }
            history.back();
            toast("Alimento tolto", { sub: f.nome, undo: async () => { S.foods.splice(Math.max(0, i), 0, f); if (blob) { try { await idbPut(f.foto, blob); } catch (_) {} } save(); V3.refresh(); } });
          }, 60); } }); },
    "al-por"(id) { const f = byId(id); if (!f) return; let v = f.porzione || 100, ok = false; const st = stepOf(f);
      const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Porzione abituale</h2><p class="v3-shp v3-al-t">${e(f.nome)}: quanto ne mangi di solito.</p>
        <div class="v3-al-x"><div><p class="v3-rs">${e((f.h || []).slice(0, 2).map(x => `${x[0]} ${nf(x[1], 0)} g`).join(" · ") || "In grammi")}</p></div><div class="v3-al-st" role="group" aria-label="Porzione"><button data-v3act="g" data-v3arg="-1" data-hold="alpm" aria-label="Meno ${st} g">−</button><span class="v3-al-sv" id="al-psv">${nf(v, 0)} g</span><button data-v3act="g" data-v3arg="1" data-hold="alpp" aria-label="Più ${st} g">+</button></div></div>
        ${btn("Salva la porzione", "ok", null, "v3-apri wide")}${ui.secondary("Chiudi", "close")}`,
        { label: "Porzione abituale", on: { g(a) { v = Math.max(st, v + st * (+a)); document.getElementById("al-psv").textContent = nf(v, 0) + " g"; }, ok() { ok = true; sh.close(); } },
          onClose: () => { if (!ok) return; f.porzione = v; save(); setTimeout(() => { V3.refresh(); toast("Porzione salvata", { sub: `${f.nome} · ${nf(v, 0)} g` }); }, 60); } }); },
    "al-edit"(id) { nav.open({ p: "al-nuovo", id }); },
    "al-nuovo"() { const p = top() || {}; nav.open({ p: "al-nuovo", nome: (document.getElementById("al-q") || {}).value || p.q || "", ean: p.ean || null, pick: p.pick || null }); },
    "al-nsave"() {
      const p = top(), v = readNuovo(), errEl = document.getElementById("al-err"), err = t => { errEl.textContent = t; errEl.hidden = false; };
      if (!v.nome) return err("Scrivi il nome dell'alimento.");
      if (!v.per100.kcal || v.per100.kcal > 950) return err("Scrivi le calorie per 100 g (tra 1 e 900).");
      if (v.per100.p + v.per100.c + v.per100.f > 100.5) return err("Proteine, carboidrati e grassi insieme non superano 100 g.");
      if (v.per100.fib == null) delete v.per100.fib; if (v.per100.sale == null) delete v.per100.sale;
      const doSave = () => {
        if (p.id) { const f = byId(p.id); Object.assign(f, { nome: v.nome, porzione: v.porzione }); f.per100 = v.per100; if (f.tipo === "base") f.tipo = "manuale"; save(); history.back(); setTimeout(() => toast("Valori corretti", { sub: f.nome }), 80); return; }
        const f = addFood({ nome: v.nome, per100: v.per100, porzione: v.porzione, tipo: "manuale", ...(p.ean ? { ean: p.ean } : {}) });
        if (p.pick) { history.back(); setTimeout(() => addToPick(p.pick, f), 140); return; }
        toast("Alimento salvato", { sub: kid() ? f.nome : `${f.nome} · ${nf(f.per100.kcal, 0)} calorie per 100 g` }); nav.replace({ p: "al-scheda", id: f.id });
      };
      const at = atwater(v.per100);
      if (at == null) return doSave();
      let ok = null;
      const sh = V3.sheet(`<h2 class="v3-sh1 v3-al-t">Le calorie non tornano</h2><p class="v3-shp v3-al-t">Con questi valori mi aspetto circa ${nf(at, 0)} calorie, tu ne hai scritte ${nf(v.per100.kcal, 0)}. Controlla di aver letto i valori per 100 g.</p>
        ${btn("Correggo i valori", "close", null, "v3-apri wide")}${ui.secondary("Salva così", "ok")}`, { label: "Le calorie non tornano", on: { ok() { ok = true; sh.close(); } }, onClose: () => { if (ok) setTimeout(doSave, 60); } });
    },
    "al-pickf"(id) { const p = top(), f = byId(id); if (!f) return; if (p.pick) return addToPick(p.pick, f); nav.open({ p: "al-scheda", id }); },
    "al-pickb"(i) { const b = BASE[+i]; if (!b) return; const p = top(), f = fromBase(b); if (p.ean && !f.ean) { f.ean = p.ean; save(); }
      if (p.pick) return addToPick(p.pick, f);
      toast("Aggiunto ai tuoi alimenti", { sub: kid() ? f.nome : `${f.nome} · ${nf(f.per100.kcal, 0)} calorie per 100 g` }); nav.replace({ p: "al-scheda", id: f.id }); },
    "al-g"(a) { const p = top(); if (!p || p.p !== "al-pasto") return; const [i, s] = a.split(":").map(Number), x = p.items[i], f = x && byId(x.id); if (!f) return;
      const st = kid() ? (f.porzione || 100) / 2 : stepOf(f); x.g = Math.max(0, Math.round((x.g + st * s) * 10) / 10); pastoUpd(p, i); },
    "al-padd"(id) { const p = top(), f = byId(id); if (!f || p.items.some(x => x.id === id)) return; p.items.push({ id, g: Math.max(stepOf(f), Math.round((f.ug || f.porzione || 100) / stepOf(f)) * stepOf(f)) }); V3.refresh(); },
    "al-pfind"() { const p = top(); sheetAdd({ pick: { k: p.k }, host: p }); },
    "al-mscan"() { const p = top(); nav.replace({ p: "al-scan", pick: p.pick || null, host: p.host || null }); },
    "al-pscan"() { const p = top(); nav.open({ p: "al-scan", pick: { k: p.k }, host: p }); },
    /* scansione dal pasto: Annulla, togli dal vassoio, scansiona un altro */
    "al-sundo"(id) { const p = top(), h = hostOf(p), f = byId(id); if (!h) return; h.items = h.items.filter(x => x.id !== id);
      p.say = { k: "ok", t: f ? `${f.nome} tolto` : "Tolto", s: "Inquadra il prossimo codice" }; scanUpd(p); },
    "al-sx"(id) { const p = top(), h = hostOf(p); if (!h) return; h.items = h.items.filter(x => x.id !== id); if (p.say && p.say.undo === id) p.say = null; scanUpd(p); },
    "al-sagain"() { const p = top(); if (!hostOf(p)) return; p.say = null; scanUpd(p); if (!cam && (p.st || "on") === "on") camStart(); },
    "al-oil"() { const p = top(); let f = foods().find(x => /olio.*oliva|olio extravergine/i.test(x.nome)) || foods().find(x => /^olio/i.test(x.nome));
      if (!f) { const b = BASE.find(x => /^Olio extravergine/.test(x.nome)); if (b) f = fromBase(b); }
      if (!f) return; if (!p.items.some(x => x.id === f.id)) p.items.push({ id: f.id, g: 10 }); V3.refresh(); toast("Olio aggiunto", { sub: kid() ? "Un cucchiaio" : "Un cucchiaio, 10 g · circa 90 calorie" }); },
    "al-psave"() { savePasto(top()); },
    "al-rp"() { const p = top(); ask47("pasto", yes => { const all = ripeti(), key = dowT() + ":" + p.k; if (yes === null) return;
      if (yes) all[key] = { ...(all[key] || { items: p.items.filter(x => x.g > 0) }), dal: today(), al: addDays(sunOf(today()), 7) }; else delete all[key]; lsSet(RK, all);
      V3.refresh(); toast(yes ? "Lo riproponi la prossima settimana" : "Solo questa settimana", { sub: `${LAB(p.k)} di ${DOW[dowT()].toLowerCase()}` }); }); },
    "al-dow"(d) { const p = top(); p.dow = +d; V3.refresh(); },
    "al-dadd"(mk) { const p = top(); sheetAdd({ pick: { dk: mk, dow: p.dow } }); },
    "al-dit"(a) { const p = top(), [mk, i] = a.split(":"); sheetDit(p, mk, +i); },
    "al-dcopy"() { sheetCopy(top()); },
    "al-dsave"() { const p = top(), had = !!dieta();
      if (!Object.values(p.d.giorni || {}).some(g => Object.values(g || {}).some(a => a && a.length))) { toast("La dieta è vuota", { sub: "Aggiungi almeno un pasto" }); return; }
      ask47("dieta", yes => { const d = p.d, t = today(); d.dal = d.dal && d.dal <= t ? d.dal : monOf(t); if (yes !== null || !had) { d.ripeti = !!yes; d.al = yes ? addDays(sunOf(t), 7) : sunOf(t); }
        if (!had) d.segui = !hasMealPlan(); setD(d); p.d = JSON.parse(JSON.stringify(d)); V3.refresh();
        toast("Dieta salvata", { sub: hasMealPlan() ? "Il piano del dietista resta com'è" : d.ripeti ? "Si ripete anche la prossima settimana" : "Vale fino a domenica" }); }); },
    "al-dval"() { const p = top(), d = dieta(); if (!d) return; ask47("dieta", yes => { if (yes === null) return; const t = today(); d.ripeti = !!yes; d.al = yes ? addDays(sunOf(t), 7) : sunOf(t); setD(d); p.d.al = d.al; p.d.ripeti = d.ripeti; V3.refresh(); toast(yes ? "Si ripete anche la prossima settimana" : "Vale solo questa settimana", { sub: "La mia dieta" }); }); },
    "al-segui"() { const d = dieta(); if (!d) return; d.segui = !d.segui; setD(d); const p = top(); if (p && p.d) p.d.segui = d.segui; V3.refresh();
      toast(d.segui ? "Segui la tua dieta" : "Segui il piano del dietista", { sub: d.segui ? "Cibo ti propone i tuoi pasti" : hasMealPlan() ? "La tua dieta resta salvata" : "La tua dieta resta salvata" }); }
  };

  /* file: foto dell'alimento (42) e foto dell'etichetta per Leo (41, 49) */
  document.addEventListener("change", async ev => {
    const t = ev.target; if (!t || !t.dataset || !t.dataset.alfile || !t.files || !t.files[0]) return;
    const file = t.files[0], kind = t.dataset.alfile; t.value = "";
    if (kind === "foto") { const f = byId(t.dataset.fid); if (!f) return; const had = !!f.foto;
      try { await setPhoto(f, file); V3.refresh(); toast(had ? "Foto cambiata" : "Foto aggiunta", { sub: f.nome }); } catch (_) { toast("Foto non salvata", { sub: "Riprova con un'altra foto" }); } return; }
    if (kind === "label") {
      const ean = t.dataset.ean || null, sc = t.closest(".v3-scrim"); if (sc && sc._v3) sc._v3.close();
      const sp = t.dataset.pick ? JSON.parse(t.dataset.pick) : null, p = top();
      const f = await leoLabel(file, ean ? { ean } : {});
      if (f) setTimeout(() => { if (hostOf(p) && top() === p) scanAdd(p, f); else if (sp) addToPick(sp, f, false); else if (p && p.pick && p.p === "al-scan") addToPick(p.pick, f); else nav.replace({ p: "al-scheda", id: f.id }); }, 120);
    }
  });
  /* ricerca: lista (in diretta) e scrivi a mano (3 lettere, 600 ms) senza ridisegnare la pagina, così la tastiera resta aperta */
  let deb = null;
  document.addEventListener("input", ev => {
    const t = ev.target; if (!t) return;
    if (t.id === "al-find") { const p = top(); if (p) p.q = t.value; const el = document.getElementById("al-list"); if (el) { el.innerHTML = listRows(t.value); fillPhotos(el); } }
    if (t.id === "al-q") { const p = top(); if (p) p.q = t.value; clearTimeout(deb); const q = t.value;
      if (norm(q).length < 3) { const el = document.getElementById("al-res"); if (el) el.innerHTML = ""; return; }
      deb = setTimeout(() => { const el = document.getElementById("al-res"); if (el && (document.getElementById("al-q") || {}).value === q) { el.innerHTML = manoRes(q); fillPhotos(el); } }, 600); }
  });

  /* ============================== API per sec-cibo.js ============================== */
  window.V3Alim = {
    bind(n) { nav = n; },
    altra(k, iso) { nav.open({ p: "al-pasto", k, ...pastoInit(k, iso) }); }, // audit M10: dal diario, su quel giorno
    block,
    page(p) {
      if (!p || !String(p.p).startsWith("al-")) return null;
      if (p.p !== "al-scan") camStop();
      const h = p.p === "al-lista" ? pageLista(p) : p.p === "al-scheda" ? pageScheda(p) : p.p === "al-scan" ? pageScan(p) : p.p === "al-mano" ? pageMano(p)
        : p.p === "al-nuovo" ? pageNuovo(p) : p.p === "al-pasto" ? pagePasto(p) : p.p === "al-dieta" ? pageDieta(p) : null;
      return h == null ? null : `<div class="v3-al-pg">${h}</div>`;
    },
    after(el) {
      fillPhotos(el);
      const p = top();
      if (p && p.p === "al-scan") { if ((p.st || "on") === "on" && !cam) camStart(); else if (cam && cam.stream) { const v = el.querySelector("#al-cam video"); if (v && v.srcObject !== cam.stream) { v.srcObject = cam.stream; v.play().catch(() => {}); } } }
      else camStop();
    },
    on, following, planMealOf: planMealOf || window.mealOf,
    found, eanOk, base: BASE // found(codice) = come se la fotocamera l'avesse letto (anche per le prove)
  };
})();
