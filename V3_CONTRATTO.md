# Askesis v3 · contratto per le sezioni

Unica guida per chi scrive `sec-oggi.js`, `sec-palestra.js`, `sec-cibo.js`, `sec-progressi.js`.
Il guscio è in `v3.js` (FASE 1). **Ognuno tocca solo il proprio `sec-*.js`.** Serve un cambio a `v3.js`, `index.html` o a un modulo vecchio? Non farlo da solo: segnalalo a chi coordina.

## 1. Come funziona

- Barra in basso fissa a 4 voci: **Oggi · Palestra · Cibo · Progressi**. Sempre visibile (anche in seduta: la barra della seduta sta subito sopra). La vecchia `.tabs` è nascosta.
- Ingranaggio = Impostazioni esistenti (profilo, dati, AI, coach). La scheda di allenamento si modifica da Palestra («Modifica la scheda»).
- Router: dopo ogni `render()` dell'app vecchia, se la sezione corrente è **registrata** e l'utente è sulla sua pagina principale, il contenuto di `#view` viene sostituito da `render(el, ctx)` della sezione.
- Se la sezione non è registrata, se `render` restituisce `false` o se lancia un errore → resta la **vista vecchia**. L'app non si rompe mai.

| Voce | Stato S impostato dalla barra | Vista vecchia di ripiego |
|---|---|---|
| `oggi` | `S.tab = "oggi"` | Oggi (board.js) |
| `palestra` | `S.tab = "allenamento"` | Allenamento (carosello sedute, seduta in corso) |
| `cibo` | `S.tab = "oggi"`, `S.macro = "food"` | «La tua alimentazione» (pasti, integratori, menù) |
| `progressi` | `S.tab = "progressi"` | Progressi (carichi, calorie, peso, foto) |

Quando la sezione è attiva: `#view` ha la classe `v3` (e `v3-o65` per gli over 65), `body` ha `v3-sec`, la barra in alto vecchia (`#top`) e il Leo flottante sono nascosti. L'intestazione la disegna la sezione con `ui.header`.

## 2. Scheletro di una sezione

```js
"use strict";
(function () {
  if (!window.V3) return;
  const { ui, data } = V3;
  let sub = null; // stato interno della sezione (pagina interna aperta, selettore…), MAI in S

  V3.register("progressi", {
    render(el, ctx) {
      // ctx = { legacy, sec, data, ui, V3 }; ctx.legacy = HTML della vista vecchia
      if (sub === "peso") { el.innerHTML = pesoPage(); return; }
      el.innerHTML = ui.header("Progressi") + mainBox() + rows() + ui.end("Le proteine aiutano il recupero.", { leoQ: "Quante proteine mi servono?" });
    },
    on: {
      // data-v3act="apri-peso" → on["apri-peso"](arg, elemento, evento)
      "apri-peso"() { sub = "peso"; V3.page(() => { sub = null; }); }
    }
  });
})();
```

- History (FASE 3): finché ci sono pagine/fogli V3 aperti la history è solo di `v3.js` (gesture.js non aggiunge voci). Le pagine interne si possono annidare: ogni indietro torna alla schermata precedente; un foglio vecchio, l'ingranaggio o un dettaglio di una vista vecchia aperti sopra una pagina si chiudono con un indietro, poi si torna alla pagina.
- `render` deve essere **sincrono** e scrivere tutto in `el.innerHTML`. Restituire `false` = usa la vista vecchia (es. Palestra durante la seduta in corso finché non c'è una versione nuova).
- Le azioni si collegano con `data-v3act="nome"` (+ `data-v3arg="valore"`): il guscio chiama `on[nome](arg, el, ev)` della sezione corrente. Niente `addEventListener` globali nelle sezioni.
- Azioni comuni già gestite se la sezione non le ridefinisce: `back` / `close` (= indietro), `go` (arg = id sezione), `sap` (apre «Lo sapevi?» in un foglio).
- I pulsanti dell'app vecchia continuano a funzionare dentro una sezione: `data-act="tab" data-v="piano"` (ingranaggio), `data-act="coach-open"` (chat Leo), `data-act="ask" data-v="domanda"` (Leo con domanda), `data-act="start" data-v="A"` (inizia seduta A).
- Per aprire una vista vecchia come pagina interna (indietro torna alla sezione): `V3.legacy({ tab: "piano", hub: "train" })` (editor della scheda, per «Modifica la scheda»), `{ tab: "piano", hub: "menu" }` (menù della settimana), `{ tab: "piano", hub: "diet" }` (modifica pasti).
- Mai `data-act="tab"` per passare da una sezione all'altra: usa `V3.go(id)` o `data-v3act="go" data-v3arg="cibo"`.

## 3. API `V3`

| Firma | Cosa fa |
|---|---|
| `V3.register(id, { render(el, ctx), on: {} })` | registra la sezione (`id` ∈ oggi, palestra, cibo, progressi) e la ridisegna se è aperta |
| `V3.go(id, opts?)` | va a una sezione (chiude prima fogli e pagine interne aperti); con `opts` chiama `enter(opts)` della sezione, se c'è (es. `V3.go("cibo", { meal: "pra" })` apre il pasto) |
| `V3.page(onBack)` | apre una pagina interna: chiamala **dopo** aver cambiato lo stato interno; aggiunge una voce di history e ridisegna. Indietro (pulsante, tasto Android, swipe iOS) chiama `onBack()` e ridisegna |
| `V3.back()` | indietro (= `history.back()`) |
| `V3.legacy({ tab, hub, macro, detail, settings })` | apre una vista vecchia come pagina interna (anche della sezione stessa, es. `{ tab: "progressi" }`), con pulsante «‹ Indietro» v3 in cima; indietro ripristina la sezione |
| `V3.sheet(html, { on, label, onClose })` | foglio dal basso; restituisce `{ el, close() }`. I `data-v3act` dentro il foglio vanno a `opts.on`, altrimenti `close` lo chiude. Si chiude anche con tocco fuori, Esc, tasto indietro |
| `V3.refresh()` | ridisegna (dopo un cambio di stato interno senza nuova pagina, es. selettore) |
| `V3.current()` | id della sezione attiva (o `null` in Impostazioni) |

Esempio foglio:
```js
const s = V3.sheet(`<h2 class="v3-sh1">Cambia periodo</h2>${ui.seg(["Settimana", "Mese"], 0, "per")}<button class="v3-b2" data-v3act="close">Chiudi</button>`,
  { on: { per(i) { periodo = +i; s.close(); V3.refresh(); } } });
```

## 4. `V3.ui`: componenti (restituiscono stringhe HTML)

Tutti i testi passati vengono già escapati, tranne `value` delle righe e `num` di `big` (accettano HTML piccolo, es. `<span class="v3-of">`). Per testo tuo usa `ui.esc()`.

| Firma | Risultato |
|---|---|
| `ui.header(titolo, sotto?)` | titolo 28/800 + data (default: «Martedì 27 ottobre») + ingranaggio 48 |
| `ui.label(testo, destra?)` | etichetta sezione 15/700 MAIUSCOLA; `destra` = HTML a destra (es. «Personalizza») |
| `ui.section(etichetta, htmlInterno)` | blocco con etichetta e gap 12 |
| `ui.row({ title, sub, when, value, act, arg, apri, on })` | riga s1 72 px; con `act` è un pulsante intero con «Apri» lime (testo con `apri`, `apri:false` senza); `value` = numero a destra; `when` = orario a sinistra; `on` = contorno lime (riga attuale) |
| `ui.apri(act, arg, etichetta="Apri")` | pill lime 48 |
| `ui.secondary(etichetta, act, arg)` | secondario: bordo 2 px lime, larghezza piena, 48 |
| `ui.back(etichetta="Indietro")` | «‹ Indietro» (azione `back`) |
| `ui.limeBox({ title, action:{label,act,arg}, tiles:[…], html })` | **l'unico** box lime della vista: titolo + pulsante nero, griglia 2×2 |
| `ui.tile({ label, value, of, unit, pct, miss, act, arg })` | riquadro «3.380 /3.400»: `value` grande, `of` piccolo, barra `pct` (0–100), `miss` riga sotto; con `act` mostra › |
| `ui.end(testoSapevi, { act, arg, leoQ })` | fondo pagina: «Lo sapevi?» (soft, titolo lime) + Leo affiancato. `leoQ` = domanda già pronta per Leo |
| `ui.leo(domanda?, etichetta="Chiedi a Leo")` | pallino L + «Chiedi a Leo» (apre la chat vecchia) |
| `ui.seg(opzioni, indiceScelto, act, ariaLabel)` | selettore a pillole; tocco → `on[act](indice)` |
| `ui.card(html)` | card scura s1 raggio 18 per numero + grafico |
| `ui.big(num, riga)` | numero grande 32/800 + una riga ≤ 8 parole |
| `ui.fig(src, alt, nome)` / `ui.hf(sinistra, fig)` | immagine reale 84×84 accanto al numero (se non carica mostra il nome) |
| `ui.legend([["k1","Adesso"],["k2","Prima"],["k3","Piano"]])` | legenda: bianco, bianco .4, tratteggio |
| `ui.nf(n, decimali=1)` | «3.380», «75,8», «−0,3» |
| `ui.pct(a, b)`, `ui.dLab(iso)` («26 ott»), `ui.dateSub()`, `ui.esc(s)` | utilità |

### Grafici `ui.chart` (dal prototipo Progressi v3.3)
Un solo asse Y; bianco pieno = adesso, bianco .4 = prima; tocco su barra/punto = pillola col valore (gestito dal guscio). Larghezza logica 326, si adattano. Testi 16 px per gli over 65 in automatico (`ui.chart.o65 = true/false` per forzare).

| Firma | Opzioni |
|---|---|
| `ui.chart.bars(o)` | `vals`, `max`, `ticks: [[valore, etichetta, tratteggiata]]`, `xl: [[indice, testo]]`, `live` (ultima = in corso, default true), `all` (numero su ogni barra), `fmt`, `tip(i)`, `aria`, `h` |
| `ui.chart.steps(o)` | carico migliore a gradini: `pts`, `flags` (1 pieno / 0 vuoto = settimana senza quell'esercizio), `min`, `max`, `xl`, `fmt`, `tip(i)`, `aria` |
| `ui.chart.line(o)` | `trend` (es. media 7 giorni), `dots` (pesate), `min`, `max`, `yl: [alto, basso]`, `plan` (riga tratteggiata «Piano»), `xl`, `fmt`, `tip(i)`, `aria`, `h` |
| `ui.chart.pairs(o)` | palestra/riposo in % del piano con riga 100%: `gym`, `rest`, `lab`, `xl`, `aria` |

```js
const h = data.history("week");
ui.card(ui.big(`${h[12].sessions}/${h[12].sessionsT}`, "Sedute questa settimana") +
  ui.chart.bars({ vals: h.map(w => w.sessions), max: Math.max(4, ...h.map(w => w.sessions)), ticks: [[h[12].sessionsT, String(h[12].sessionsT), true], [0, "0"]],
    xl: [[0, h[0].label], [12, "ora"]], tip: i => `${h[i].label}: ${h[i].sessions} sedute`, aria: "Sedute delle ultime 13 settimane" }));
```

## 5. `V3.data`: dati in sola lettura

Legge `S` senza modificarlo (non chiama `dayLog`, che crea giorni vuoti). Valori `null` = dato mancante: mostra lo stato vuoto, mai 0 inventato. Le medie usano solo **giorni chiusi** (prima di oggi) **e registrati**.

| Firma | Restituisce |
|---|---|
| `data.profile()` | `{ nome, eta, sesso, peso, altezza, obiettivo, livello, group, minor, over65, hasTraining, hasMealPlan, dietFromPlan }`; `group` ∈ `"adulto"` (anche età mancante), `"ragazzo"` (14–17), `"bambino"` (≤ 13), `"over65"` (≥ 65) |
| `data.today()` / `data.day(iso)` | `{ iso, dow, today, future, closed, train, sessions, logged, kcal, pro, cho, fat, kcalT, proT, choT, fatT }` (consumato vs obiettivo del giorno; `train` = giorno di palestra) |
| `data.week()` | `{ from, to, sessions: { done, planned }, days: [7 × day], avg: { gym, rest, all }, protein: { eaten, target } }`; `avg.*` = `{ n, kcal, kcalT, pro, proT, kcalPct, proPct }` |
| `data.history("week" \| "month", n?)` | 13 settimane (lun–dom) o 12 mesi, dal più vecchio; ogni voce `{ from, to, label, live, sessions, sessionsT, daysLogged, proPct, kcalPct, kcalGymPct, kcalRestPct }`; l'ultima ha `live: true` |
| `data.exercises(n=13)` | per esercizio: `{ name, short, unit ("kg", "none" = corpo libero, "kg/manubrio"…), muscle, demo, weeks: [n × carico migliore o null], weekFrom: [lunedì], best: {kg, reps, date}, last: {kg, reps, date}, sessions }`, il più recente prima |
| `data.weight()` | `{ entries: [{date, kg}], avg7: [{date, kg}] (media mobile 7 giorni per ogni pesata), last, trend (weightTrend: cur, rate, status…), goal }` |
| `data.photos()` | `[{ date, pose }]` (solo date e posa, mai immagini; le foto arrivano da IndexedDB qualche istante dopo l'avvio) |
| `data.nextMeal()` | `{ key, label, text, items, kcal, pro, left }` del primo pasto non segnato di oggi, oppure `null` |
| `data.todaySession()` | `{ state, day, name, focus, exercises, sets, minutes, doneSets, ups, next }`; `state` ∈ `"nessuna-scheda"`, `"in-corso"`, `"fatta"`, `"da-fare"`, `"riposo"` |
| `data.targets(train)` | obiettivo del giorno palestra/riposo (stessa formula di `nutri.js`) |
| `data.saveDayTarget(iso?)` | **unica scrittura**, additiva su chiave propria `v3_daytargets`: fotografa l'obiettivo del giorno per lo storico. Usala solo se serve (es. Cibo al primo pasto segnato) |

Esempio reale (dati di prova, 27/10): `scratchpad/v3/v3_data_esempio.json`. Estratto:
```json
"week": { "from": "2026-10-26", "sessions": { "done": 1, "planned": 3 },
  "avg": { "gym": { "n": 1, "kcal": 3445, "kcalT": 3400, "pro": 162, "proT": 165, "kcalPct": 101, "proPct": 98 } } },
"todaySession": { "state": "da-fare", "day": "B", "name": "Seduta B", "exercises": 9, "sets": 26, "minutes": 60, "ups": 1 }
```

Per scrivere dati (segnare un pasto, salvare una seduta, una pesata) usa le funzioni esistenti dell'app (`saveDay`, `persistSession`, `markDone`, …) o simula il pulsante vecchio con lo stesso `data-act`. Mai scrivere direttamente in `localStorage` o creare nuove strutture in `S`.

## 6. Regole grafiche (obbligatorie)

Fonte: `../askesis-ux/oggi/STANDARD_OGGI.md` + regole del 27/10. I componenti `ui.*` le rispettano già: usali invece di scrivere HTML a mano.
- Ordine pagina principale: intestazione → etichetta + righe azione (+ secondario «Vedi tutta…») → **un** box lime dati → «Lo sapevi?» + Leo. Gap 28.
- Pagina interna: «‹ Indietro» → titolo + verdetto (≤ 6 parole) → **un** selettore → card con numero grande + grafico → 2 righe → «Lo sapevi?» + Leo.
- Lime solo su: un box dati, pill «Apri», contorno della riga attuale, bordo dei secondari, titolo «Lo sapevi?», Leo, focus. Mai su intestazione, testi, barra.
- Niente muri di testo: numero grande + al massimo una riga breve (≤ 8 parole). Spiegazioni dietro «Apri» o «Chiedi a Leo». Termini tecnici restano, con Leo accanto.
- Affordance: ciò che si tocca ha forma di pulsante (≥ 48 px). Semiotica: il dato importante sta in un box o ha colore. Etichette esplicite, mai abbreviate.
- Grafici: un asse Y, pannelli impilati, bianco = adesso, bianco .4 = prima, fascia del piano #2a2a2a o tratteggio.
- Valori «3.380 /3.400» (obiettivo piccolo). Altezza pagina = contenuto, nessun vuoto in fondo.
- Immagini reali dove aiutano (esercizi dal Free Exercise DB come in `ux.js`, piatti, foto del percorso), mai decorative inventate.
- Età (decisione di Giovanni del 27/10): il ragazzo 14-17 vede chili e record in kg (carichi concordati con il preparatore); il bambino ≤ 13 niente chili né record in kg, solo ripetizioni. Minori: niente calorie né grassi, niente calorie da tagliare; nessun giudizio estetico sulle foto; niente rosso; niente serie di giorni consecutivi (solo settimane).
- Testi: italiano naturale, niente trattino lungo, virgolette «», tono da coach diretto (dato + spinta breve).
- Classi CSS: solo `v3-*`. Stile aggiuntivo di sezione: un `<style id="v3-sec-<id>">` iniettato una volta, con selettori prefissati `#view.v3 .v3-<id>-…`. Colori solo con i token `--v3-*` (`--v3-bg`, `--v3-s1`, `--v3-s2`, `--v3-s3`, `--v3-lime`, `--v3-soft`, `--v3-ink`, `--v3-t1`, `--v3-t2`, `--v3-t3`).

## 7. Come testare

```bash
cd scheda-abc && python3 -m http.server 8765 --bind 127.0.0.1
node /private/tmp/claude-501/-Users-giovannisantuccio/bc5d2950-9ee3-404c-96e0-82260975c465/scratchpad/v3/test_v3.mjs
```
Il test (Playwright 390×844, `createRequire('/Users/giovannisantuccio/video-ai/apple_endtoend_base/')`) prova storage vuoto e dati realistici costruiti dalla scheda `seed-abc.js` (13 settimane di sedute, 120 giorni di pasti, pesate), barra, indietro, fogli, una sezione di prova con pagina interna, seduta in corso, e stampa `V3.data`. Per la tua sezione: copia il test, togli la sezione di prova e verifica almeno
1. nessun errore JS (`pageerror` e `console.error`);
2. tocco sulla voce della barra → la tua pagina principale; ogni «Apri» → pagina interna; indietro (`page.goBack()` e pulsante «‹ Indietro») → pagina principale;
3. profili: adulto, ragazzo (eta 15), bambino (eta 10), over 65 (eta 70), e storage senza sedute/pasti (stati vuoti);
4. screenshot in `scratchpad/v3/<sezione>/`, controllati a occhio contro la tela approvata;
5. `localStorage` identico prima/dopo la sola navigazione (la sezione non scrive).

Prima del commit: `node --check sec-<id>.js`, aggiorna il `?v=` in `index.html` solo se te lo chiede chi coordina (unico punto condiviso).
