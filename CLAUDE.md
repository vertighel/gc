# Regola generale

No commit e No push se non scritto esplicitamente nel prompt.


# Caccia al tesoro — istruzioni per Claude Code

Leggi questo file per primo. Per i dettagli, guarda `memory.md` (decisioni prese
e perché) e la cartella `docs/` (stato attuale, roadmap, modello dati).

## Cos'è

Un gioco tipo caccia al tesoro fra amici (meno di 10 giocatori). I partecipanti
cercano oggetti reali (portoni, maniglie, orologi, cartelli...) in giro per
Genova, li inquadrano col cellulare, e un riconoscimento immagini **eseguito
interamente nel browser** conferma se è l'oggetto giusto. Le tappe possono
anche richiedere una posizione GPS vicina a quella registrata dal master.

## Stato del progetto: prototipo funzionante, in produzione limitata

Il gioco **è online e giocabile** all'indirizzo:

```
https://vertighel.github.io/gc/
```

Chi apre quell'indirizzo normale è il **giocatore**. Aggiungendo `#master` in
fondo si apre il pannello di chi crea e gestisce la caccia:

```
https://vertighel.github.io/gc/#master
```

Non è un progetto da avviare da zero: c'è già un file funzionante,
`index.html`, che va **esteso**, non riscritto. Prima di toccare qualunque
cosa, apri `docs/STATO.md` per sapere esattamente cosa c'è già.

## Architettura in una riga

**Un solo file HTML** (`index.html`), senza framework, senza build, ospitato
staticamente su **GitHub Pages**. Due file JSON pubblicati nello stesso posto
fanno da "database di sola lettura": `caccia.json` (la caccia) e
`messaggi.json` (annunci del master). Il master li aggiorna scrivendo
direttamente su GitHub tramite l'API REST, con un token salvato solo sul suo
telefono. I giocatori li scaricano con `fetch()` a ogni apertura dell'app.

Non c'è ancora nessun database vero (Supabase o simile). Tutto ciò che
richiede scritture da **più telefoni contemporaneamente** — identità dei
giocatori, scambi di ricompense, log di chi ha trovato cosa — è **rimandato**
apposta, proprio perché un hosting statico non lo può fare. Vedi
`docs/ROADMAP.md` per il perché e il come.

## Regole di lavoro per questo progetto

- **Un solo file `index.html`**, deliberatamente. Non spezzarlo in moduli o
  introdurre un bundler senza discuterne prima: la scelta di non avere build
  è ciò che permette di pubblicare con un semplice `git push`.
- **Il riconoscimento immagini resta lato client.** Non proporre di mandare
  foto a un server: è un vincolo di prodotto, non solo tecnico (vedi
  `memory.md`, sezione "Perché niente server per le immagini").
- **`caccia.json` e `messaggi.json` sono pubblici e leggibili da chiunque
  conosca l'indirizzo**, anche senza account. È un limite noto e accettato
  per ora — non è un bug da correggere di sorpresa. Vedi `docs/STATO.md`.
- **Non introdurre identità dei giocatori "di nascosto".** È una scelta
  esplicita rimandata al momento in cui arriverà un database vero. Se un
  compito sembra richiederla, fermati e chiedi conferma invece di inventare
  un sistema di account provvisorio.
- **Versione nel banner di avvio.** In cima al codice compare
  `Avvio del gioco… (versione N)`. Incrementa N a ogni modifica pubblicata:
  è il modo più veloce che abbiamo per capire, guardando il telefono, se sta
  girando l'ultima versione o una vecchia rimasta in cache.
- **Niente `git commit` né `git push` senza che sia richiesto esplicitamente
  nel prompt.** Modifica pure i file di lavoro, ma lascia le modifiche non
  committate finché non viene chiesto per iscritto in quel messaggio.

## Come testare senza un telefono vero

Fotocamera, GPS e riconoscimento immagini non si possono provare da terminale.
Il pattern che abbiamo usato finora, e che conviene continuare a usare:

1. Servi la cartella in locale: `python3 -m http.server 8765`
2. Apri con Playwright (o uno script headless equivalente) sia la pagina
   normale sia quella con `#master`.
3. Per il master, intercetta le chiamate a `https://api.github.com/**` con un
   gestore finto che simula GET (sha del file) e PUT (scrittura), invece di
   scrivere davvero sul repository durante i test.
4. Per il giocatore, scrivi a mano un `caccia.json` e un `messaggi.json` di
   prova nella cartella servita, prima di aprire la pagina.
5. Per simulare "l'oggetto riconosciuto" senza usare la fotocamera vera,
   inietta direttamente un vettore embedding finto nello stato del master
   (`M.pos`, `M.cal`) invece di passare da `getUserMedia`.

Questo pattern è già stato usato per verificare ogni funzionalità aggiunta
finora (vedi la cronologia dei commit). Non esiste ancora un file di test
automatico salvato nel repository: se ne crei uno, mettilo in `tests/` e
documentalo qui.

## Pubblicazione

- `git push` su `main` aggiorna `index.html` (e gli altri file del
  repository) su GitHub Pages entro un paio di minuti.
- `caccia.json` e `messaggi.json` normalmente **non** passano da git: il
  master li scrive direttamente dal pannello `#master` tramite l'API di
  GitHub (pulsanti "Pubblica su GitHub" e "Pubblica messaggio"). Sono
  comunque file veri nel repository: se li modifichi a mano e fai push,
  funziona lo stesso.
- Il repository **deve restare pubblico**. GitHub Pages sui repository
  privati richiede un piano a pagamento: l'abbiamo scoperto nel modo
  peggiore, vedi `memory.md`.

## Cosa manca (riassunto — dettagli in docs/ROADMAP.md)

In ordine di dipendenza, non di importanza:

1. **Identità dei giocatori** — non ancora affrontata, è il prerequisito di
   tutto il resto.
2. **Un database vero** (Supabase, quasi certamente) per possessi, scambi e
   log — necessario appena serve una scrittura da più telefoni.
3. **Scarsità (`scorta` limitata) su un regalo scambiabile/duplicabile** —
   lo scambio/la condivisione senza limiti sono già implementati senza
   database (QR fra fotocamere anteriori, vedi `docs/STATO.md`); solo un
   tetto condiviso al numero di copie richiede ancora un database vero.
4. **Log delle attività dei giocatori visibile al master** — idem.
5. **Missioni composte** — fatto, vedi `docs/ROADMAP.md` punto 5: il
   modello a nodi di `caccia-3` le gestisce già tutte (indizio unico verso
   più oggetti, più oggetti che convergono su una ricompensa, catene
   miste).
6. Narrazione, scarsità delle ricompense, coinvolgimento social — solo
   discussi, nessuna decisione tecnica presa.

## Cosa è stato provato e scartato

Non riproporre queste strade, sono già state valutate e abbandonate:

- **GitLab dell'INAF come hosting** — certificato https non valido sui siti
  Pages di quell'istanza self-hosted, oltre a un controllo di accesso che
  bloccava i giocatori. Abbandonato.
- **Netlify Drop** — funzionante ma scomodo per la pubblicazione ricorrente
  senza CLI. Il progetto è passato a GitHub Pages con push diretto.
- **Pulsante "Condividi su Instagram"** nella schermata di fine caccia —
  implementato e poi tolto su richiesta esplicita del committente ("non mi
  piace"). Non riproporlo senza che venga richiesto di nuovo.
