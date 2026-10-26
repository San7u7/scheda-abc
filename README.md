# Scheda ABC

App personale per palestra e alimentazione (iPhone): scheda A/B/C con doppia progressione, piano del dietista con contatore di calorie, peso, foto di progresso e coach.

**Prova online:** https://san7u7.github.io/scheda-abc/ (modalità base, vedi sotto). Contiene un piano alimentare e una scheda personali.

## Come funziona
- Versione completa: artifact su claude.ai (salvataggio nell'account, coach, stime delle calorie e lettura delle foto con Claude).
- Sul sito (GitHub Pages) o aprendo `index.html` fuori da claude.ai l'app funziona in modalità base: i dati restano nel browser e le funzioni di Claude non sono disponibili.

## File
- `index.html`: interfaccia e logica di allenamento.
- `coach.js`: piano alimentare, calorie, coach, esportazione.
- `lib.js`: libreria di esercizi sostitutivi.
- `HANDOFF.md`: specifica di design.

## AI gratuita sul sito (Google Gemini)
Sul sito le funzioni intelligenti (coach, stime dei pasti, lettura di foto, etichette e documenti, valutazione del fisico) usano Google Gemini con una **chiave personale gratuita**:
1. apri https://aistudio.google.com/apikey e accedi con un account Google;
2. tocca «Create API key» e copia la chiave;
3. nell'app apri le impostazioni (o il passaggio della scheda nel percorso iniziale) e incollala in «Attiva l'AI gratis».

La chiave resta solo nel browser del telefono e non è mai nel codice. Sul piano gratuito ci sono limiti giornalieri di richieste e Google può usare le richieste per migliorare i suoi modelli. L'app sceglie da sola il modello Gemini Flash più recente disponibile.

I dati (sedute, pasti, peso, foto) restano solo sul telefono: cancellando i dati del browser si perdono.
