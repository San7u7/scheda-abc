# Scheda ABC

App personale per palestra e alimentazione (iPhone): scheda A/B/C con doppia progressione, piano del dietista con contatore di calorie, peso, foto di progresso e coach.

**Repository privato**: contiene il piano alimentare e i dati di allenamento personali.

## Come funziona
- Versione completa: artifact su claude.ai (salvataggio nell'account, coach, stime delle calorie e lettura delle foto con Claude).
- Aprendo `index.html` fuori da claude.ai l'app funziona in modalità base: i dati restano nel browser e le funzioni di Claude non sono disponibili.

## File
- `index.html`: interfaccia e logica di allenamento.
- `coach.js`: piano alimentare, calorie, coach, esportazione.
- `lib.js`: libreria di esercizi sostitutivi.
- `HANDOFF.md`: specifica di design.
