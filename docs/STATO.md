# Stato attuale (versione 23)

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
  file la sezione sullo stile). Il testo viene dal campo `testo` **dello
  stesso nodo che si sta cercando** — mai da un prerequisito o da un
  dipendente, vedi `docs/MODELLO-DATI.md`. Se quel nodo ha `conThumb` e una
  foto, la foto compare accanto al testo.
- **Lista "Da trovare" sempre visibile**, con tutti i nodi con
  `daValidare: true` ancora mancanti *e già raggiungibili* (cioè con tutti
  i propri "richiede" già posseduti), selezionabili in qualunque ordine. I
  nodi non ancora "visti" da questo giocatore sono etichettati "Nuovo". Ogni
  riga mostra anche il proprio `testo` e la propria foto-indizio (funzione
  `immaginiIndizio()`, se `conThumb` è acceso) — utile soprattutto per
  distinguere due oggetti "fratelli" con lo stesso prerequisito: essendo
  entrambi auto-riferiti, ciascuno può avere un indizio (testo e foto)
  diverso dall'altro, anche se diventano raggiungibili nello stesso momento.
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
  (non più in coda uno alla volta), ognuno con la propria foto vera se ce
  l'ha (altrimenti un colore calcolato dal nome), nome e messaggio —
  `conThumb` qui non conta: una volta posseduto un nodo, la foto si vede
  sempre. `conThumb` decide solo se la foto fa da indizio *mentre* il
  nodo è ancora da trovare (vedi il punto sulla targa, più sopra).
- **Aggiornamenti incrementali**: se il master pubblica un `caccia.json`
  con lo stesso `formato` di quello già scaricato, i progressi e il bottino
  del giocatore restano intatti e i nuovi nodi si aggiungono alla lista.
  Solo un `formato` diverso azzera tutto (bottino, progressi, nodi visti).
- Bottino (ogni nodo diventato posseduto, non solo i vecchi "premi")
  sempre visibile in fondo alla pagina, con lo stesso criterio foto/colore
  della schermata di sblocco — ed **è cliccabile**: toccare un oggetto
  riapre il suo `messaggio` (funzione `apriRicordo()`), la stessa scheda
  vista alla schermata di sblocco — utile per rileggerlo con calma, non
  più un contenuto usa-e-getta.
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

Due concetti tenuti volutamente separati: **"pubblica su GitHub"** (la
configurazione/meccanismo di scrittura, generico) e **"pubblica la
caccia"** (l'atto di spedire il contenuto attuale come `caccia.json`, che
vive solo nella pagina "Collega gli elementi" — vedi sotto).

- All'apertura, **scarica la caccia già pubblicata**. Se non è già
  `caccia-3`, la tratta come incompatibile (non ne legge i nodi: la copia
  di lavoro riparte vuota, e pubblicare da "Collega gli elementi" sostituisce
  interamente il file).
- **"Caccia pubblicata"**: solo un elenco di sola lettura (foto + nome di
  ogni nodo della copia di lavoro condivisa, variabile `L.nodi`) — nessun
  editing qui. La foto è una miniatura cliccabile: al tocco si apre più
  grande in una lightbox, perché nel pallino piccolo spesso si vede solo
  un ritaglio, non abbastanza per distinguere un oggetto dall'altro.
- **Registrazione di un nuovo oggetto dal vivo**: pulsanti "Oggetto" e
  "Dintorni" sulla stessa riga, poi "Prova" e "Aggiungi" sulla stessa riga.
  "Oggetto" registra 20 fotogrammi (muovendosi per ~6 secondi) più uno
  scatto vero (compresso, per la miniatura); "Dintorni" registra 10
  fotogrammi come negativi; entrambi insieme alla posizione GPS del
  master in quel momento — **sempre tutti e quattro**, indipendentemente
  da come il nodo verrà poi usato: le flag si decidono dopo, in "Collega
  gli elementi", senza dover tornare sul posto. La soglia di
  riconoscimento si calcola da sola (`calibrate()`), con un messaggio che
  avvisa se l'oggetto è troppo simile all'ambiente circostante. "Prova"
  è un test immediato con la fotocamera; "Aggiungi" aggiunge il nodo
  (nome di default "Oggetto-N", flag di default: con thumb e da validare,
  non richiede posizione) alla copia di lavoro, senza pubblicare — si può
  registrarne un altro subito dopo, la fotocamera resta accesa.
- **Ogni nodo nasce così, senza eccezioni**: non esiste (più) un modo di
  creare un nodo scrivendo solo testo da un computer. Anche un premio
  "sintetico" che richiede più nodi insieme nasce dalla stessa cattura,
  marcato poi `daValidare: false` in "Collega gli elementi".
- **Pagina "Collega gli elementi"** (`#master-collega`, raggiungibile con
  un pulsante dal pannello master, con un link "← Torna al pannello
  master" per uscirne): pensata per un computer, non per il telefono — su
  schermi larghi (≥700px) la pagina si allarga di più delle altre (classe
  `wide` su `<body>`) e le schede si affiancano in una griglia; sul
  telefono restano impilate. È qui, e solo qui, che si modifica **tutto**
  di un nodo: la foto (miniatura cliccabile come sopra) e il **nome**
  (editabile), subito seguiti dalle tre flag — **Con thumb** (la foto fa
  da indizio mentre il nodo è ancora *da trovare*, per lui stesso — vedi
  `immaginiIndizio()`; non c'entra con la foto nel bottino/sblocco, che si
  vede sempre una volta posseduto), **Da validare** (richiede foto+match
  del giocatore per essere posseduto, altrimenti lo diventa da solo appena
  "richiede" è soddisfatto), **Richiede posizione** (in più al match
  fotografico, il giocatore deve essere entro 100 m dal punto registrato —
  spuntarla spunta anche "Da validare" in automatico, e non si può togliere
  l'una senza l'altra) — poi due campi separati, entrambi auto-riferiti a
  questo nodo (mai su un prerequisito né su un dipendente): l'**indizio**
  (`testo`, mostrato in "Da trovare" mentre lo si cerca) e il **messaggio**
  (si vede nella propria schermata di sblocco, poi resta rivedibile
  toccando l'oggetto nel bottino) — e un elenco di checkbox "Richiede"
  verso tutti gli altri nodi. Un
  pulsante "Rimuovi" per scheda, bloccato se un altro nodo lo richiede
  ancora. In fondo: il campo "Formato", e **da qui si pubblica la
  caccia** — pulsante "Pubblica la caccia" (verso GitHub) e "Prova su
  questo telefono" (modalità di prova locale). Prima di pubblicare
  controlla che i collegamenti non formino un ciclo (bloccando con un
  messaggio se lo trova).
- **Pagina "Grafo" (`#master-grafo`, raggiungibile da un link in "Collega gli
  elementi")**: stessi collegamenti "richiede" visti come disegno invece che
  come elenco di checkbox, per non ripetere per distrazione l'errore delle
  due flag scambiate (`daValidare` su "evidenziatore giallo" e "gomma",
  vedi `memory.md`) — con un colpo d'occhio si vede la forma del flusso, non
  solo la lista di chi richiede cosa. Anche questa pagina è pensata per un
  computer, non per il telefono. Layout automatico **verticale** per
  "livello" di dipendenza (nessuna coordinata salvata, si scorre verso il
  basso invece che verso destra — pensato per una trama lunga, che altrimenti
  crescerebbe fuori schermo in larghezza): un nodo senza "richiede" sta
  nella prima riga in alto, ogni altro nodo una riga più in basso del più
  profondo dei suoi prerequisiti; i nodi dello stesso livello si affiancano
  sulla stessa riga. Ogni scheda-nodo mostra foto, nome e un'icona per capire
  a colpo d'occhio se è "da validare" (📷, più 📍 se richiede anche la
  posizione) o un regalo automatico (🎁) — di nuovo, per rendere visibile
  subito lo squilibrio che ha causato il bug delle flag scambiate. Si
  collega cliccando il pallino di un elemento e poi quello di un altro: il
  primo è il prerequisito, il secondo è quello che lo richiede (stessa
  regola di "Richiede" in "Collega gli elementi", solo disegnata). Si
  scollega cliccando una freccia (con conferma). Cliccare il corpo di una
  scheda apre un riquadro laterale con gli stessi campi di "Collega gli
  elementi" (nome, le tre flag, indizio, messaggio, "Richiede") — stesso
  codice, non una copia: modificare da un posto si vede subito anche
  nell'altro. Se i collegamenti formano un ciclo, il grafo non si disegna:
  compare invece un messaggio che nomina i nodi coinvolti (stesso controllo
  usato prima di pubblicare), per non mostrare un disegno fuorviante. Le
  checkbox di "Collega gli elementi" restano comunque al loro posto: il
  grafo è un modo alternativo di vedere e modificare gli stessi dati, non
  la loro sostituzione.
- **Pubblicazione diretta su GitHub**: un solo pannello di configurazione
  (`<details>`, nel pannello master, sotto "Messaggi") salva su questo
  telefono soltanto proprietario, repository, ramo e un token con
  permesso di scrittura limitato al repository. Se manca e si prova a
  pubblicare da "Collega gli elementi", l'accordion si apre automaticamente
  sul pannello master con un messaggio che indica dove si trova. La
  scrittura vera e propria (`ghPutFile`, `GET` per lo sha corrente, `PUT`
  per scrivere, con un tentativo di ritentare una volta su conflitto 409)
  è condivisa fra la pubblicazione della caccia e quella dei messaggi.
- Sezione **Messaggi**, nel pannello master: composizione libera,
  pubblicazione su `messaggi.json` con lo stesso meccanismo di scrittura
  via API GitHub.
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
- L'editor dei collegamenti ("Collega gli elementi") e la pagina "Grafo" non
  sono pensati per il telefono: richiedono un computer per essere usati
  comodamente.
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
