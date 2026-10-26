# Handoff: Scheda ABC v2 (Oggi · Allenamento · Progressi · Piano)

## Panoramica
App personale per iPhone, usata in palestra con una mano e di mattina/sera per la dieta.
Una domanda per schermata: Oggi = «cosa devo fare adesso?»; Allenamento = «quale serie faccio e con quanto?».

## Layout
- Colonna unica, max 560px, gutter `max(16px, safe-area)`. Nessun layout desktop dedicato.
- Tab bar 4 voci, 64px + safe-area. In seduta attiva sulla tab Allenamento la tab bar è sostituita dalla barra seduta (72px).

## Token (invariati, stile True-black flat)
| Token | Valore | Uso |
|---|---|---|
| `--ground` | #000 | sfondo |
| `--surface` | #111 | card, righe |
| `--raised` | #2a2a2a | controlli, chip |
| `--text` / `--muted` / `--faint` | #fff / #b4b4b4 / #949494 | tre livelli di testo |
| `--accent` | #c6f24e | SOLO stato «fatto», progresso, «pronto a salire» |
| primario | bianco pieno, testo nero | una azione per schermata |
| `--fs-hero` | 44px/600 tabulare | kg e ripetizioni della serie attiva |
| radius | 20 card · 12 controlli · 999 chip/pill | |

## Componenti
| Componente | Varianti | Note |
|---|---|---|
| Card Coach | normale / avviso | 1–2 frasi calcolate dai dati + «Chiedi al coach» + 2 chip domanda |
| Card Seduta | da fare / in corso / fatta | CTA: Inizia seduta / Riprendi seduta / nessuna |
| Riga pasto | da fare / fatto, chiusa / aperta | spunta 44px a sinistra, chevron apre le grammature |
| Abitudini | acqua (− / +), chip integratori, peso | peso apre un foglio con stepper |
| Riga esercizio | fatto / in corso parziale / da fare | tocco = diventa attivo |
| Esercizio attivo | — | nome + ⋯; riga grigia «target · ultima»; numeri hero; chip ripetizioni; pulsante Fatta; mini-riga serie |
| Chip ripetizioni | fuori range / nel range / selezionato | scroll orizzontale nel proprio contenitore; selezionato = bianco pieno |
| Barra seduta | timer spento / acceso / finito | tempo seduta, recupero con +15″ e Salta, Fine |
| Foglio (sheet) | ⋯ esercizio, sostituisci, peso, note fine seduta, chat coach | chiusura: tocco fuori, Esc, pulsante |

## Stati e interazioni
| Elemento | Evento | Comportamento |
|---|---|---|
| Fatta | tap | serie fatta, timer parte (recupero dell'esercizio), serie successiva selezionata con gli stessi valori; ultima serie → esercizio compresso, si apre il successivo |
| Mini-riga serie | tap | seleziona quella serie per modificarla; se fatta il pulsante diventa «Aggiorna serie» + «Annulla serie» |
| Chip ripetizioni | tap | imposta le ripetizioni della serie selezionata |
| Kg | − / + | passo 2,5 (2 per manubrio); tap sul numero = tastiera decimale |
| Timer | 0 | «Recupero finito», nessun avanzamento automatico; sparisce dopo 8 s |
| Fine | tap | foglio note: durata, fatica 1–10, note → Salva seduta |

## Casi limite
- Nessuna seduta registrata: Progressi mostra stato vuoto con «Inizia la prima seduta».
- Esercizio a corpo libero: al posto dei kg «Corpo libero»; trazioni: «Zavorra».
- Range lungo (12–20): chip scorrevoli, il selezionato viene portato in vista.
- Senza claude.ai (niente db, sample, assets): dati sul dispositivo, coach e foto mostrano come attivarli.

## Accessibilità
- Tocchi ≥ 44px; focus visibile; `aria-pressed` su chip e spunte; `aria-label` sui pulsanti icona; `prefers-reduced-motion` senza transizioni.

## Testi (UX copy)
- Termini fissi: seduta, serie, ripetizioni, carico, pasto, recupero.
- CTA: «Inizia seduta», «Riprendi seduta», «Fatta», «Aggiorna serie», «Annulla serie», «Concludi seduta», «Salva seduta», «Chiedi al coach», «Registra peso».
- Stati vuoti: cosa è + perché è vuoto + come iniziare.
- Errori: cosa è successo + cosa fare, senza scuse.
