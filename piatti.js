"use strict";
/* 30/10 tavole 88-90: foto dei piatti in Cibo. 20 foto CC0 di Wikimedia Commons (elenco e autori in askesis-ux/cibo/FOTO_PIATTI.md).
   Piatti.of(testo del pasto) → { src, alt, cred } per la prima regola che corrisponde, null se nessuna (niente foto decorative).
   Caricato prima di sec-cibo.js. */
(function () {
  const U = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
  const F = {
    uova: [U + "6/61/Eggs_Spinach_and_Fried_Bread_DSCN3826.TIF/lossy-page1-960px-Eggs_Spinach_and_Fried_Bread_DSCN3826.TIF.jpg", "Uova all'occhio di bue su pane con spinaci", "Jamesjhawkins"],
    yogurt: [U + "a/a1/Lancaster%2C_United_States_%28Unsplash%29.jpg/960px-Lancaster%2C_United_States_%28Unsplash%29.jpg", "Yogurt con fragole, mirtilli e granola", "Peter Hershey"],
    frutta_pane: [U + "6/64/Peanut_butter_and_banana_on_toasted_homemade_bread_-_Massachusetts.jpg/960px-Peanut_butter_and_banana_on_toasted_homemade_bread_-_Massachusetts.jpg", "Pane tostato con crema di frutta secca e banana", "Daderot"],
    panino: [U + "1/1d/Breakfast_%28Unsplash%29.jpg/960px-Breakfast_%28Unsplash%29.jpg", "Pane con prosciutto, formaggio e pomodoro", "Sofiya Levchenko"],
    legumi: [U + "3/30/Bean_salad.jpg/960px-Bean_salad.jpg", "Insalata di fagioli, ceci e fagiolini", "PPD"],
    pasta_pesto: [U + "6/61/Pesto_Pasta_%28Unsplash%29.jpg/960px-Pesto_Pasta_%28Unsplash%29.jpg", "Pasta al pesto con pomodorini e rucola", "Eaters Collective"],
    pasta_legumi: [U + "c/c3/Pasta_e_fagioli_-_minestra.jpg/960px-Pasta_e_fagioli_-_minestra.jpg", "Piatto di pasta e fagioli", "valtercirillo"],
    pasta_pesce: [U + "6/60/Pasta_alle_Vongole_-_Wiki_Loves_Sicilia.jpg/960px-Pasta_alle_Vongole_-_Wiki_Loves_Sicilia.jpg", "Pasta alle vongole", "8w9d"],
    pollo: [U + "8/83/Fried_chicken_with_vegetables_and_rice.jpg/960px-Fried_chicken_with_vegetables_and_rice.jpg", "Pollo con riso e fagiolini", "Wilfredor"],
    pasta_pomodoro: [U + "e/e4/Pasta_alla_Norma_-_Wiki_Loves_Sicilia.jpg/960px-Pasta_alla_Norma_-_Wiki_Loves_Sicilia.jpg", "Pasta al pomodoro con melanzane e ricotta", "8w9d"],
    carne: [U + "f/fa/Steak_Dinner_for_Two_%28Unsplash%29.jpg/960px-Steak_Dinner_for_Two_%28Unsplash%29.jpg", "Carne con verdure al forno", "Mantra Media"],
    pesce: [U + "e/e3/Fish_for_Lunch_%28Unsplash%29.jpg/960px-Fish_for_Lunch_%28Unsplash%29.jpg", "Pesce alla griglia con insalata", "Davide Cantelli"],
    tofu: [U + "7/73/Brighton_Bibimbap_%28tofu%29_-_Time_For_Kimchi.jpg/960px-Brighton_Bibimbap_%28tofu%29_-_Time_For_Kimchi.jpg", "Riso con tofu e verdure", "Andy Li"],
    misto: [U + "9/9c/Quiche_and_Salad_%28Unsplash%29.jpg/960px-Quiche_and_Salad_%28Unsplash%29.jpg", "Torta salata con insalata mista", "James Harris"],
    insalata: [U + "8/8f/Isidor_Emanuel_2016_%28Unsplash%29.jpg/960px-Isidor_Emanuel_2016_%28Unsplash%29.jpg", "Insalata di lattuga, pomodori e carote", "Isidor Emanuel"],
    frutta: [U + "9/99/Bowl_of_Fresh_Fruit_%28Unsplash%29.jpg/960px-Bowl_of_Fresh_Fruit_%28Unsplash%29.jpg", "Ciotola di frutta fresca", "Iwona Łach"],
    porridge: [U + "c/c6/Porridge-muesli-fruits.jpg/960px-Porridge-muesli-fruits.jpg", "Porridge d'avena con frutta", "braetschit"],
    riso: [U + "3/3b/Clermont-Ferrand%2C_France_%28Unsplash%29.jpg/960px-Clermont-Ferrand%2C_France_%28Unsplash%29.jpg", "Risotto alle erbe", "Julien Pianetti"],
    zuppa: [U + "e/e6/Amy%27s_lentil_vegetable_soup.jpg/960px-Amy%27s_lentil_vegetable_soup.jpg", "Zuppa di lenticchie e verdure", "Mx. Granger"],
    pizza: [U + "1/1b/A_well_garnished_pizza_%28Unsplash%29.jpg/960px-A_well_garnished_pizza_%28Unsplash%29.jpg", "Pizza con rucola", "David Nuescheler"]
  };
  /* dal più specifico al più generico: il primo che corrisponde vince */
  const RULES = [
    [/pesto/, "pasta_pesto"],
    [/(pasta|riso|cereali|gnocchi)[^.]*(legum|fagiol|ceci|lenticch)|pasta e (fagioli|ceci|lenticchie)/, "pasta_legumi"],
    [/(pasta|spaghett|linguin)[^.]*(pesce|tonno|vongol|gamber|salmone)/, "pasta_pesce"],
    [/tofu|tempeh/, "tofu"],
    [/pollo|tacchino/, "pollo"],
    [/(pasta|gnocchi)[^.]*(mozzarell|pomodor)|mozzarell/, "pasta_pomodoro"],
    [/sgombr|fagioli[^.]*tonno|tonno[^.]*fagioli/, "legumi"],
    [/pesce|salmone|merluzz|orata|branzin|tonno/, "pesce"],
    [/carne|bistecc|manzo|vitello|maiale|hamburger/, "carne"],
    [/uov|frittat|omelette/, "uova"],
    [/yogurt|skyr/, "yogurt"],
    [/burro di (frutta secca|arachidi)|crema di (frutta secca|arachidi|mandorle)|marmellat/, "frutta_pane"],
    [/affettat|prosciutt|bresaol|panino|tramezzin|toast/, "panino"],
    [/avena|porridge|muesli|fiocchi/, "porridge"],
    [/zupp|minestr|vellutat|brodo/, "zuppa"],
    [/pizz/, "pizza"],
    [/legum|fagiol|ceci|lenticch/, "legumi"],
    [/insalat/, "insalata"],
    [/risott|\briso\b/, "riso"],
    [/frutta|mela|banana|arancia|frutti di bosco/, "frutta"],
    [/a piacere|a scelta|primo piatto|secondo piatto/, "misto"]
  ];
  function of(text) {
    const t = String(text || "").toLowerCase();
    for (const [re, k] of RULES) if (re.test(t)) { const f = F[k]; return { k, src: f[0], alt: f[1], cred: `Foto d'esempio · ${f[2]}, CC0, Wikimedia Commons` }; }
    return null;
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* tre misure delle tavole: card (88), miniatura (89), grande con credito (90); se l'immagine non carica sparisce */
  const img = (p, cls) => `<img class="${cls}" src="${p.src}" alt="${esc(p.alt)}" loading="lazy" decoding="async" onerror="this.remove()">`;
  window.Piatti = {
    of,
    card: t => { const p = of(t); return p ? img(p, "pf-card") : ""; },
    thumb: t => { const p = of(t); return p ? img(p, "pf-thumb") : ""; },
    big: t => { const p = of(t); return p ? `<figure class="pf-big">${img(p, "pf-bimg")}<figcaption>${esc(p.cred)}</figcaption></figure>` : ""; }
  };

  const css = document.createElement("style");
  css.textContent = `
  #view.v3 .pf-card { width: 100%; height: 150px; object-fit: cover; display: block; border-radius: 16px; margin-bottom: 8px; background: var(--v3-s2, #1a1a1a); }
  #view.v3 .v3-row.pf-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; column-gap: 14px; align-items: center; }
  #view.v3 .pf-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 12px; display: block; background: var(--v3-s2, #1a1a1a); }
  #view.v3 .pf-big { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  #view.v3 .pf-bimg { width: 100%; height: 190px; object-fit: cover; display: block; border-radius: 24px; background: var(--v3-s2, #1a1a1a); }
  #view.v3 .pf-big figcaption { padding-left: 16px; font-size: 12px; color: var(--v3-t3); line-height: 1.4; }
  `;
  document.head.appendChild(css);
})();
