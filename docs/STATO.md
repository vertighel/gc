# Stato attuale (versione 32)

Un solo file: `index.html`, alla radice del repository. Nessuna dipendenza
installata: le uniche librerie esterne (MediaPipe) si caricano da CDN via
`import()` dinamico, solo quando serve la fotocamera, non al caricamento
della pagina.

La caccia pubblicata è nel formato `caccia-3` (nodi **unificati**: niente
più `tipo` indizio/oggetto/ricompensa, un solo tipo di nodo con tre flag
booleani — vedi `docs/MODELLO-DATI.md` per lo schema completo). **Non c'è
migrazione automatica** dai formati
precedenti: se il sito ha ancora pubblicato un `caccia-1`/`caccia-2`, il
master lo vede segnalato come incompatibile e riparte da zero. Questo
`formato` non ha nulla a che fare col nome di una caccia (vedi sotto): sono
due concetti indipendenti, tenuti deliberatamente separati dopo un
incidente in cui coincidevano per caso (vedi `memory.md`).

## Più cacce, un file ciascuna

Il gioco non pubblica più una sola caccia: il master può crearne diverse in
parallelo, ciascuna un file a sé, con lo stesso meccanismo statico di
sempre (nessun database, vedi `memory.md`).

- **Slug = nome**: il nome che il master sceglie per una caccia (uno
  slugify di un testo libero: minuscole, spazi e simboli diventati `-`) è
  anche il suo identificativo tecnico. Non esistono più un "nome" e uno
  "slug" separati.
- **La caccia di sempre ha slug vuoto**: file `caccia.json`, link senza `#`
  in fondo — esattamente quello già condiviso prima che esistesse questa
  funzionalità, retrocompatibile per costruzione. Le altre cacce sono
  `caccia-<slug>.json`, raggiunte dal giocatore con `#c-<slug>` in fondo
  all'indirizzo.
- **`cacce.json`**: l'elenco delle cacce con nome (la caccia di sempre non
  ci compare mai, è sempre la prima voce implicita). Scritto da
  `registraCaccia()` alla prima pubblicazione riuscita di ciascuna caccia
  con nome. Letto da un'unica funzione condivisa, `leggiElencoCacce()`, sia
  dal menu del pannello master sia dalla schermata di scelta del giocatore
  (vedi sotto) — **"caccia" è un nome riservato**, filtrato se ricompare
  per errore dentro `cacce.json`, e rifiutato esplicitamente se si prova a
  creare una nuova caccia con quel nome.
- **Copia di lavoro del master salvata in due modi**, che risolvono
  problemi diversi:
  - in `localStorage` del telefono (`m-lavoro`), scritta a ogni modifica —
    protegge da un reload accidentale, gratis, senza rete;
  - `lavoro.json`/`lavoro-<slug>.json` sul server, scritto solo premendo
    "Salva bozza sul server" — protegge da un cambio di telefono, e
    permette di provarla come un vero giocatore col link `#b`/`#b-<slug>`
    (vedi sotto "Link di prova della bozza"). Il giocatore **normale** (link
    `#c-<slug>` o senza `#`) non lo legge mai: resta invisibile a chi gioca
    davvero finché non si preme "Pubblica" (che resta l'unico atto che
    scrive `caccia*.json`, invariato).

## Modalità giocatore (indirizzo normale, senza `#`)

- **Schermo pieno, come un'app**: barra in alto fissa, contenuto che scorre
  solo al proprio interno, barra di due schede fissa in basso — "🔍 Cerca"
  e "💽 Memoria". Attivo solo mentre si gioca (classe `playing` sul
  `<body>`): il pannello master e la schermata di scelta restano pagine
  normali che scorrono. **Si apre sempre su "Memoria"**, non su "Cerca"
  (`mostraTab("oggetti")` in `initPlayer()`): chi non ha ancora nulla lo
  capisce dal testo lì (`#p-mem-empty`), che suggerisce di passare a
  "Cerca" — eccetto quando c'è una festa/sblocco da mostrare (vedi sotto
  "Il possesso si festeggia sempre"), che vive dentro "Cerca" e quindi ci
  passa automaticamente.
- **Schermata di scelta della caccia**: aprendo il link senza `#`, se il
  telefono non ricorda ancora una preferenza (chiave `caccia-scelta`),
  vede l'elenco delle cacce disponibili (`leggiElencoCacce()`) e ne
  sceglie una. La scelta si ricorda per le aperture successive: si cambia
  da "⚙️ Impostazioni" → "Cambia caccia" (vedi sotto). Chi ha già una
  partita in corso sulla caccia di sempre non vede questa schermata la
  prima volta che apre questa versione (continuità). Un
  link diretto `#c-<slug>` la salta sempre, va dritto al giocatore — a
  meno che lo slug dopo il trattino sia vuoto (link rotto), nel qual caso
  mostra comunque la lista invece di caricare la caccia di sempre per
  sbaglio.
- **Dentro "Cerca", quattro sotto-schede sempre mutuamente esclusive**
  (una sola visibile alla volta, `mostraSubTab()`):
  - **Indizio**: una targa smaltata (stile grafico volutamente diverso dal
    solito chat-bot, vedi in fondo la sezione sullo stile) per l'oggetto
    scelto adesso, col testo dal campo `testo` **dello stesso nodo che si
    sta cercando** (mai da un prerequisito o un dipendente, vedi
    `docs/MODELLO-DATI.md`) e la sua foto se `conThumb` è acceso. Sotto, la
    lista **completa** di tutti i nodi raggiungibili non ancora trovati
    (non solo le alternative), ciascuno col proprio indizio e foto per
    intero — i non ancora "visti" sono etichettati "Nuovo". Toccarne uno
    lo evidenzia (sfondo blu) e lo rende quello attuale, aggiornando la
    targa sopra, ma **resta su questa scheda**: passare a "Foto" è una
    scelta separata del giocatore, non più automatica.
  - **Foto**: fotocamera e "Scatta e verifica" per l'oggetto attuale. 5
    fotogrammi ravvicinati, vince il migliore. Il nodo è validato se quel
    fotogramma supera la soglia calcolata dal master ed è più simile
    all'oggetto che ai suoi dintorni. Se il nodo ha `richiedePosizione`, il
    GPS viene controllato *prima* di accendere il confronto immagine
    (vincolo implicito: non esiste senza `daValidare`). La fotocamera si
    ferma sempre lasciando questa scheda.
  - **✉️ Messaggi**: badge col numero di non letti sull'icona. Scarica
    `messaggi.json` con lo stesso meccanismo di `caccia.json`. Lo stato
    "letto" è locale al telefono, non tracciato dal master.
  - **⚙️ Impostazioni**: "Cambia caccia" (dimentica la scelta, torna alla
    schermata di scelta) e "Ricomincia la caccia" (azzera bottino e
    progressi di questa caccia).
  - Questa riga di quattro schede **resta sempre raggiungibile**, anche
    senza una caccia pubblicata o a caccia interamente trovata: altrimenti
    da "Hai trovato tutto" non si potrebbe più arrivare a "Impostazioni"
    per ricominciare.
- **Il possesso si festeggia sempre**, per ogni nodo, validato con lo
  scatto o diventato posseduto da solo (`daValidare: false`) perché tutto
  ciò che richiedeva era già posseduto. Un solo scatto può sbloccarne più
  di uno in cascata: si mostrano **tutti insieme nella stessa schermata**
  (non in coda uno alla volta), ognuno con la propria foto vera se ce l'ha
  (altrimenti un colore calcolato dal nome), nome e messaggio — `conThumb`
  qui non conta: una volta posseduto un nodo, la foto si vede sempre.
  **Dopo la festa si riparte sempre dalla scheda "Indizio"**, mai restando
  su "Foto" (dove inevitabilmente ci si trova appena dopo aver scattato).
  Un nodo "regalo" a **zero prerequisiti** (`daValidare: false`,
  `richiede: []`, es. un dono iniziale) si festeggia già al primo avvio o
  alla prima sincronizzazione, non solo dopo un'altra foto.
- **Un `richiede` verso un id di nodo non più esistente non blocca mai
  nulla** (può succedere solo modificando `caccia.json` a mano fuori
  dall'app, bypassando il controllo di "Rimuovi"): trattato ovunque come
  "nessun prerequisito", coerente col comportamento già usato dal
  controllo anti-ciclo prima di pubblicare.
- **Aggiornamenti incrementali**: se il master pubblica una caccia con lo
  stesso `formato` di quella già scaricata, i progressi e il bottino del
  giocatore restano intatti e i nuovi nodi si aggiungono alla lista. Solo
  un `formato` diverso azzera tutto (bottino, progressi, nodi visti).
- **Bottino** (ogni nodo diventato posseduto, non solo i vecchi "premi")
  nella scheda "Memoria", con lo stesso criterio foto/colore della
  schermata di sblocco — ed **è cliccabile**: toccare un oggetto riapre il
  suo `messaggio` (funzione `apriRicordo()`), la stessa scheda vista alla
  schermata di sblocco — utile per rileggerlo con calma, non più un
  contenuto usa-e-getta.
- **Progressi separati per caccia**: bottino, stato e messaggi-visti sono
  namespaced per slug (`gioco:<slug>`, `stato:<slug>`) — la caccia di
  sempre resta sulle chiavi `gioco`/`stato` già in uso, nessuna migrazione
  per chi gioca già. I messaggi (`messaggi.json`) restano invece globali,
  condivisi da tutte le cacce: non c'è ancora un canale di annunci per
  singola caccia.
- Funziona offline con l'ultima copia scaricata (tutto in `localStorage`).
- **Modalità di prova**: se il master preme "Prova su questo telefono" dal
  pannello master, il giocatore su quello stesso telefono entra in uno
  spazio *separato* (chiavi `localStorage` diverse, prefisso `-prova`),
  segnalato da una striscia gialla, senza toccare i dati della caccia
  realmente pubblicata. Istantaneo (nessun salvataggio né rete), ma
  **funziona solo su questo stesso telefono**: una finestra in incognito
  ha uno storage isolato, quindi lì non troverebbe nulla.
- **Link di prova della bozza**: `#b` (caccia di sempre) o `#b-<slug>`
  fanno scaricare al giocatore `lavoro*.json` (la bozza salvata sul server
  con "Salva bozza sul server", vedi sotto) invece di `caccia*.json` —
  stessa striscia gialla di "Modalità di prova". A differenza di "Prova su
  questo telefono" è un vero `fetch()`, quindi funziona da qualunque
  browser, telefono o finestra incognito, senza bisogno di pubblicare
  davvero. Stato e bottino di questa modalità hanno chiavi proprie
  (`gioco-bozza:<slug>`/`stato-bozza:<slug>`) e non contano come "la
  caccia scelta" su questo telefono (`caccia-scelta` resta invariato).

## Modalità master (indirizzo con `#master` in fondo)

Due concetti tenuti volutamente separati: **"pubblica su GitHub"** (la
configurazione/meccanismo di scrittura, generico) e **"pubblica la
caccia"** (l'atto di spedire il contenuto attuale come `caccia.json`, che
vive solo nella pagina "Collega gli elementi" — vedi sotto).

- **Menu delle cacce in cima al pannello master**: prima voce "+ Nuova
  caccia" (chiede un nome, che diventa slug e file — vedi sopra "Più
  cacce, un file ciascuna" — e apre una copia di lavoro vuota, avvisando
  se si abbandonano modifiche non salvate), poi la caccia di sempre
  ("caccia"), poi ogni caccia con nome nota (`cacce.json`). Sotto il menu,
  il link da mandare ai giocatori di quella caccia (`#c-<slug>`, o quello
  di sempre senza `#`). Sceglierne una dal menu carica la sua copia di
  lavoro con la stessa precedenza usata all'apertura (bozza locale di
  QUELLA caccia → bozza sul server → pubblicata → vuota).
- All'apertura (o scegliendo una caccia dal menu), **carica la sua copia
  di lavoro** con questa precedenza: bozza salvata in locale su questo
  telefono (se è di quella caccia) → bozza salvata sul server
  (`lavoro*.json`) → caccia già pubblicata (`caccia*.json`) → vuota se
  nessuna delle tre esiste. Se la caccia pubblicata non è già `caccia-3`,
  viene trattata come incompatibile (non se ne leggono i nodi: pubblicare
  da "Collega gli elementi" sostituisce interamente il file). Un bottone
  **"Salva bozza sul server"**, sotto ai controlli di registrazione,
  scrive la copia di lavoro attuale su `lavoro*.json` senza pubblicarla:
  resta invisibile ai giocatori normali finché non si preme "Pubblica" —
  ma da qui in poi provabile da subito col link "#b"/"#b-<slug>" mostrato
  sotto lo stesso bottone.
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
  (`testo`, mostrato al giocatore nella scheda "Indizio" mentre lo si
  cerca) e il **messaggio**
  (si vede nella propria schermata di sblocco, poi resta rivedibile
  toccando l'oggetto nel bottino) — e un elenco di checkbox "Richiede"
  verso tutti gli altri nodi. Un
  pulsante "Rimuovi" per scheda, bloccato se un altro nodo lo richiede
  ancora. In fondo, **da qui si pubblica la caccia** — pulsante
  "Pubblica" (verso GitHub, rende la caccia visibile a tutti) e "Prova su
  questo telefono" (modalità di prova locale, vedi sopra "Modalità
  giocatore"). Non c'è più un campo "Formato" modificabile a mano: era un
  residuo della migrazione manuale `caccia-1`→`caccia-2` (vedi
  `docs/MODELLO-DATI.md`), oggi il valore resta fissato internamente alla
  costante `FORMATO`. Prima di pubblicare
  controlla che i collegamenti non formino un ciclo (bloccando con un
  messaggio se lo trova).
- **Pagina "Grafo" (`#master-grafo`, raggiungibile da un link in "Collega gli
  elementi")**: stessi collegamenti "richiede" visti come disegno invece che
  come elenco di checkbox — con un colpo d'occhio si vede la forma del
  flusso, non solo la lista di chi richiede cosa. Anche questa pagina è
  pensata per un computer, non per il telefono. Layout automatico
  **verticale** per
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
- Non c'è modo dal pannello master di rinominare o eliminare una caccia già
  pubblicata (si può solo crearne di nuove dal menu).
- I messaggi broadcast (`messaggi.json`) sono globali: non esiste un canale
  di annunci per singola caccia.
- Nessuna schermata di scelta per chi arriva da un link diretto
  `#c-<slug>`: la salta sempre, di proposito (vedi `memory.md`).

## Formato dei file pubblicati

Vedi `docs/MODELLO-DATI.md` per lo schema completo e commentato di
`caccia.json` e `messaggi.json`.

## Note di stile grafico, per chi tocca il CSS

Palette e caratteri scelti apposta per non sembrare un'interfaccia
chat-bot generica: sfondo cemento (`--cemento`), accenti smalto blu scuro
(`--smalto`) e giallo (`--giallo`), font condensato Barlow Condensed per i
titoli. L'elemento "targa" con le viti disegnate (`.plate`, `.screw`) è
l'elemento grafico ricorrente del gioco: mantienilo se aggiungi schermate.
