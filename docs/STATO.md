# Stato attuale (versione 15)

Un solo file: `index.html`, alla radice del repository. Nessuna dipendenza
installata: le uniche librerie esterne (MediaPipe) si caricano da CDN via
`import()` dinamico, solo quando serve la fotocamera, non al caricamento
della pagina.

La caccia pubblicata è nel formato `caccia-3` (nodi **unificati**: niente
più `tipo` indizio/oggetto/ricompensa, un solo tipo di nodo con tre flag
booleani — vedi `docs/MODELLO-DATI.md` per lo schema completo e
`memory.md` per il perché). **Non c'è migrazione automatica** dai formati
precedenti: se il sito ha ancora pubblicato un `caccia-1`/`caccia-2`, il
master lo vede segnalato come incompatibile e riparte da zero.

## Modalità giocatore (indirizzo normale, senza `#`)

- **Scarica `caccia.json` da solo**, all'apertura e ogni volta che l'app
  torna in primo piano (`visibilitychange`). Nessun caricamento manuale di
  file: quello è stato tolto apposta su richiesta del committente.
- Mostra l'indizio del nodo scelto dentro una "targa" smaltata (stile
  grafico volutamente diverso dal solito chat-bot: vedi in fondo a questo
  file la sezione sullo stile). Il testo viene dal campo `testo` di
  qualunque nodo il nodo corrente richieda tramite "richiede"; se quel
  nodo ha `conThumb` e una foto, la foto compare accanto al testo.
- **Lista "Da trovare" sempre visibile**, con tutti i nodi con
  `daValidare: true` ancora mancanti *e già raggiungibili* (cioè con tutti
  i propri "richiede" già posseduti), selezionabili in qualunque ordine. I
  nodi non ancora "visti" da questo giocatore sono etichettati "Nuovo".
- Scatto e verifica: 5 fotogrammi ravvicinati, vince il migliore dei 5.
  Il nodo è considerato validato se quel fotogramma supera la soglia
  calcolata dal master ed è più simile all'oggetto che ai suoi dintorni.
  Se il nodo ha `richiedePosizione`, il GPS viene controllato *prima* di
  accendere il confronto immagine (vincolo implicito: `richiedePosizione`
  non esiste senza `daValidare`, vedi `docs/MODELLO-DATI.md`).
- **Il possesso si festeggia sempre**, per ogni nodo, validato con lo
  scatto o diventato posseduto da solo (`daValidare: false`) perché tutto
  ciò che richiedeva era già posseduto. Un solo scatto può sbloccarne più
  di uno in cascata: si mostrano **tutti insieme nella stessa schermata**
  (non più in coda uno alla volta), ognuno con la propria foto (se
  `conThumb`) o un colore calcolato dal nome, nome e messaggio.
- **Aggiornamenti incrementali**: se il master pubblica un `caccia.json`
  con lo stesso `formato` di quello già scaricato, i progressi e il bottino
  del giocatore restano intatti e i nuovi nodi si aggiungono alla lista.
  Solo un `formato` diverso azzera tutto (bottino, progressi, nodi visti).
- Bottino (ogni nodo diventato posseduto, non solo i vecchi "premi")
  sempre visibile in fondo alla pagina, con lo stesso criterio foto/colore
  della schermata di sblocco.
- **Casella messaggi**: icona a busta in alto a destra con badge del numero
  di non letti, scarica `messaggi.json` con lo stesso meccanismo di
  `caccia.json`. Lo stato "letto" è **locale al telefono**, non tracciato
  dal master (coerente con l'assenza di identità dei giocatori).
- Funziona offline con l'ultima copia scaricata (tutto in `localStorage`).
- **Modalità di prova**: se il master preme "Prova su questo telefono" dal
  pannello master, il giocatore su quello stesso telefono entra in uno
  spazio *separato* (chiavi `localStorage` diverse, prefisso `-prova`),
  segnalato da una striscia gialla, senza toccare i dati della caccia
  realmente pubblicata.

## Modalità master (indirizzo con `#master` in fondo)

- All'apertura, **scarica la caccia già pubblicata**. Se non è già
  `caccia-3`, la tratta come incompatibile (non ne legge i nodi: il
  pannello "Caccia pubblicata" riparte vuoto, e pubblicare da lì sostituisce
  interamente il file).
- **Pannello "Caccia pubblicata"**: la copia di lavoro condivisa (variabile
  `L.nodi`) fra questo pannello e la pagina "Collega gli elementi" — le
  modifiche fatte in uno si vedono subito nell'altro, e nessuna delle due
  scrive davvero finché non si preme un pulsante "Pubblica". Ogni nodo è
  una scheda con: la sua foto (sempre presente, catturata alla
  registrazione), il nome (editabile), e tre checkbox — **Con thumb**
  (mostra la foto al giocatore, altrimenti solo testo/colore), **Da
  validare** (richiede foto+match del giocatore per essere posseduto,
  altrimenti lo diventa da solo appena "richiede" è soddisfatto),
  **Richiede posizione** (in più al match fotografico, il giocatore deve
  essere entro 100 m dal punto registrato — spuntarla spunta anche "Da
  validare" in automatico, e non si può togliere l'una senza l'altra). Un
  pulsante "Rimuovi" per scheda, bloccato se un altro nodo lo richiede
  ancora.
- **Registrazione di un nuovo oggetto dal vivo**: 20 fotogrammi
  dell'oggetto (muovendosi per ~6 secondi) più uno scatto vero (compresso,
  per la thumb), poi 10 fotogrammi dei dintorni come negativi, più la
  posizione GPS del master in quel momento — **sempre tutti e quattro**,
  indipendentemente da come il nodo verrà poi usato: le flag si decidono
  dopo, nel pannello qui sopra, senza dover tornare sul posto. La soglia
  di riconoscimento si calcola da sola (`calibrate()`), con un messaggio
  che avvisa se l'oggetto è troppo simile all'ambiente circostante e serve
  ripetere la cattura su un dettaglio più distintivo. Pulsante "Prova il
  riconoscimento" per un test immediato con la fotocamera. Il pulsante
  "Aggiungi alla caccia" aggiunge il nodo (nome di default "Oggetto-N",
  flag di default: con thumb e da validare, non richiede posizione) alla
  copia di lavoro, senza pubblicare: si può registrarne un altro subito
  dopo, la fotocamera resta accesa.
- **Ogni nodo nasce così, senza eccezioni**: non esiste (più) un modo di
  creare un nodo scrivendo solo testo da un computer. Anche un premio
  "sintetico" che richiede più nodi insieme nasce dalla stessa cattura,
  marcato poi `daValidare: false` nel pannello.
- **Pagina "Collega gli elementi"** (`#master-collega`, raggiungibile con
  un pulsante dal pannello master, con un link "← Torna al pannello
  master" per uscirne): pensata per un computer, non per il telefono — su
  schermi larghi (≥700px) la pagina si allarga di più delle altre (classe
  `wide` su `<body>`) e le schede si affiancano in una griglia; sul
  telefono restano impilate. Ogni scheda mostra la foto e il nome (di sola
  lettura: si modificano nel pannello "Caccia pubblicata"), un campo per
  il **testo dell'indizio** (mostrato a chi deve ancora raggiungere questo
  nodo) e uno per il **messaggio della propria schermata di sblocco** —
  campi indipendenti, un nodo può avere entrambi — più un elenco di
  checkbox "Richiede" verso tutti gli altri nodi. Prima di pubblicare
  controlla che i collegamenti non formino un ciclo (bloccando con un
  messaggio se lo trova).
- **Pubblicazione diretta su GitHub**: un pannello di configurazione
  (aperto/chiuso con `<details>`) salva su questo telefono soltanto
  proprietario, repository, ramo e un token con permesso di scrittura
  limitato al repository. Il pulsante "Pubblica su GitHub" (presente sia
  nel pannello master sia in "Collega gli elementi": scrivono entrambi la
  stessa copia di lavoro) chiama direttamente l'API REST di GitHub (`GET`
  per lo sha corrente, `PUT` per scrivere), gestendo anche un eventuale
  conflitto 409 con un tentativo di ritentare una volta. In alternativa
  restano "Scarica caccia.json" (pubblicazione manuale) e "Prova su questo
  telefono" (modalità di prova locale, vedi sopra).
- Sezione **Messaggi**: composizione libera, pubblicazione su
  `messaggi.json` con lo stesso meccanismo di scrittura via API GitHub
  (funzione `ghPutFile`, condivisa con la pubblicazione della caccia).
- **Colore di un nodo**: non c'è un campo "Simbolo" da scegliere a mano.
  Il colore mostrato quando manca la foto (o `conThumb` è spento) si
  calcola da solo con un piccolo hash del nome (funzione `coloreNodo()`,
  con conversione HSL → RGB per restare sempre leggibile): stesso nome,
  sempre lo stesso colore, senza salvare nulla in più in `caccia.json`.

## Cosa esplicitamente NON fa, ad oggi

- Non distingue un giocatore dall'altro (nessuna identità/login).
- Non registra da nessuna parte "chi ha trovato cosa e quando", se non nel
  `localStorage` del singolo telefono del giocatore, invisibile al master.
- Non permette scambi o condivisioni fra giocatori (il formato a nodi lo
  prevede in futuro, vedi `docs/ROADMAP.md` punto 3, ma non è ancora
  implementato).
- Non ha ancora contenuto audio, né scarsità delle istanze.
- Non ha nessun meccanismo di narrazione o integrazione social.
- L'editor dei collegamenti ("Collega gli elementi") non è pensato per il
  telefono: richiede un computer per essere usato comodamente.
- Non c'è modo di creare un nodo senza passare dalla fotocamera (per
  scelta, vedi `memory.md`) né di sostituire in un secondo momento solo la
  foto o solo pos/neg/soglia di un nodo già esistente: per quello serve
  registrarne uno nuovo dal modulo "Registra un nuovo oggetto".
- Non legge né migra i vecchi `caccia.json` in formato `caccia-1`/`caccia-2`.

## Formato dei file pubblicati

Vedi `docs/MODELLO-DATI.md` per lo schema completo e commentato di
`caccia.json` e `messaggi.json`.

## Note di stile grafico, per chi tocca il CSS

Palette e caratteri scelti apposta per non sembrare un'interfaccia
chat-bot generica: sfondo cemento (`--cemento`), accenti smalto blu scuro
(`--smalto`) e giallo (`--giallo`), font condensato Barlow Condensed per i
titoli. L'elemento "targa" con le viti disegnate (`.plate`, `.screw`) è
l'elemento grafico ricorrente del gioco: mantienilo se aggiungi schermate.
