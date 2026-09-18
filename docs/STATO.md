# Stato attuale (versione 60)

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

## Convenzioni dell'interfaccia (valgono ovunque)

- **Il markup vive nell'HTML, il JS lo riempie.** Ogni riga o scheda generata
  dai dati (righe di Memoria e "Da trovare" `tpl-riga`, festa di sblocco
  `tpl-festa`, messaggi `tpl-inbox`, elenco pubblicato `tpl-pubblicato`,
  scheda del Grafo `tpl-grafonode`, scheda del nodo `tpl-nodo`/`tpl-richiede`)
  è un `<template>` in fondo alla pagina, clonato con `clona(id)`. I testi
  fissi con più varianti (titoli dello scambio, fine caccia) sono tutti
  scritti in HTML e il CSS ne mostra una.
- **Lo stato visibile è un attributo, non una lista di `hidden`.**
  `body[data-view]`, `#view-player[data-tab][data-sub][data-stato]`,
  `#p-scambio[data-ruolo][data-tipo][data-fase]`, `.scheda-nodo[data-validare]`:
  il JS cambia l'attributo, il CSS decide cosa si vede. `hidden` resta solo per
  singoli elementi dipendenti da un dato (es. la barra "nuovi oggetti").
- La lightbox è un `<dialog id="lightbox">` nativo (`apriAnteprima()`), che si
  chiude al tocco o con Esc. "Nessun messaggio ancora." è un `::before` CSS
  sull'elenco vuoto.
- **I clic sono azioni dichiarate nell'HTML, un solo listener le esegue.**
  Ogni elemento cliccabile porta `data-azione="nome"` (più i dati che servono:
  `data-tab`, `data-sub`, `data-id`, `data-slug`, `data-chiave`, `data-nodo`…)
  e la funzione con quel nome sta in `AZIONI`, registrata con
  `Object.assign(AZIONI, {...})` vicino al codice che riguarda (bottoni fissi
  in `initMaster()`/`initPlayer()`, righe di lista accanto a `renderTodo()`/
  `renderMemoria()`, grafo accanto a `disegnaGrafo()`). Un unico
  `document.addEventListener("click")` trova l'elemento con `closest` e
  chiama la funzione: nessun `onclick =` nel file. Un clic esegue una sola
  azione, la più interna — per questo la miniatura dentro una scheda apre
  l'anteprima senza aprire la scheda, senza `stopPropagation`. Un'azione
  dichiarata ma non registrata finisce in `console.error`. Valgono anche per
  gli elementi SVG del grafo (`dataset` funziona anche lì). I campi di testo
  e le spunte restano con `oninput`/`onchange` propri: hanno bisogno del nodo
  che stanno modificando, non di un nome.
- Le Impostazioni del giocatore contengono le **Istruzioni** in un
  `<details>` nativo chiuso di default (testo statico, il JS non lo tocca).

## Modalità giocatore (indirizzo normale, senza `#`)

- **Schermo pieno, come un'app**: barra in alto fissa, contenuto che scorre
  solo al proprio interno, barra di due schede fissa in basso — "🔍 Cerca"
  e "💽 Memoria". Attivo solo mentre si gioca: il pannello master e la
  schermata di scelta restano pagine normali che scorrono. **Quale vista è
  aperta lo dice un solo attributo, `body[data-view]`** (`player`,
  `chooser`, `master`, `master-collega`, `master-grafo`, impostato da
  `route()`/`mostraGiocatore()`/`mostraSceltaCaccia()`): il CSS ne deriva
  la sezione visibile, il tema scuro (tutto ciò che vede il giocatore, mai
  il master), la larghezza "wide" delle pagine Collega/Grafo e la modalità
  a schermo pieno — non esistono più classi `dark`/`wide`/`playing` da
  tenere allineate a mano. Dentro il giocatore, allo stesso modo,
  `#view-player[data-tab][data-sub][data-stato]` (+ `data-prova`,
  `data-fine`) decide quale scheda, sotto-scheda (compresa la festa di
  sblocco, `data-sub="festa"`) e stato (`vuoto`/`fine`/`gioco`) si vede:
  `mostraTab()`/`mostraSubTab()`/`renderPlayer()` cambiano solo gli
  attributi, mai `hidden` sui singoli pannelli. I due testi di fine caccia
  ("Hai trovato tutto" / "Ti manca qualcosa") sono entrambi in HTML,
  scelti da `data-fine`. **Si apre sempre su "Memoria"**, non su "Cerca"
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
    GPS viene controllato *dopo* il confronto immagine, solo se la foto è
    già valida (vincolo implicito: non esiste senza `daValidare`): così chi
    inquadra l'oggetto giusto nel posto sbagliato vede "Oggetto valido, ma
    sei a circa X dal punto giusto" invece di un generico rifiuto che non
    distingue le due cause. La fotocamera si ferma sempre lasciando questa
    scheda.
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
  schermata di sblocco — ed **è cliccabile**: toccare un oggetto lo rende
  "attuale" (`memoriaScelta`, `renderMemoria()`) e mostra nello schermo in
  cima nome e `messaggio`, gli stessi visti alla schermata di sblocco —
  utile per rileggerlo con calma, non più un contenuto usa-e-getta.
- **Scambio/condivisione fra giocatori, telefono-a-telefono, senza server** — ⚠️
  **protocollo corretto e testato a tavolino (`tests/scambio.test.mjs`), ma la
  convergenza ottica reale va ancora riprovata con due telefoni** dopo la riscrittura
  asimmetrica della versione 52 (vedi `docs/ROADMAP.md` punto 3). Un nodo "regalo"
  (`daValidare: false`) può avere le flag `scambiabile` e/o `duplicabile`
  (impostabili solo su un regalo, vedi sotto "Collega gli elementi" — non hanno senso
  su un nodo che si trova rifotografando un oggetto reale). In "Memoria", un regalo
  posseduto con una di queste flag mostra un bottone accanto — 🔄 (scambia, il cedente
  lo perde) o 👥 (condividi, il cedente lo mantiene) — che apre un'interfaccia di
  scambio a schermo intero (`apriScambio()`): fotocamera **anteriore** in alto, il
  proprio QR generato in basso, che si aggiorna alcune volte al secondo. Chi riceve
  non ha un bottone dedicato: usa "Foto" come sempre (fotocamera **posteriore**), e se
  invece di un oggetto reale inquadra il QR di un amico, l'app riconosce il prefisso
  `gc1:` e passa da sola all'interfaccia di scambio, spegnendo la posteriore e
  accendendo l'anteriore (`gestisciQrFoto()`). Il controllo QR gira in sottofondo su
  ogni fotogramma di "Foto" senza mai interferire col riconoscimento a embedding
  normale: un QR estraneo (nessun prefisso `gc1:`) mostra "QR sconosciuto" ma lascia
  "Scatta e verifica" perfettamente funzionante, utile se l'oggetto reale da
  riconoscere porta anche un QR stampato sopra per coincidenza. Il richiedente vede
  il proprio QR sopra e l'anteprima sotto (ricalca il gesto appena fatto con la
  posteriore); il cedente il contrario, perché parte da fermo dalla scheda Memoria.
  I due telefoni si scambiano un `sessionId` casuale (condiviso, isola sessioni
  vicine distinte; le sue prime 4 lettere sono mostrate grandi su entrambi gli
  schermi come **codice** da confrontare a occhio), un `mioId` privato (**non**
  condiviso — serve solo a scartare un fotogramma che risultasse il proprio invece
  che quello dell'altro, es. un riflesso sul vetro dell'altro schermo) e due
  contatori (`seq` crescente, `ack` = quante letture valide ciascuno ha fatto
  dell'altro). **Dentro un giro si legge sempre prima l'altro e si aggiorna il
  proprio conteggio, solo dopo si disegna il proprio QR** — mai il contrario
  (`scambioTickCorpo()`): il QR disegnato nel giro in cui si scrive deve già essere
  quello finale.

  **Il protocollo è asimmetrico** (Problema dei Due Generali, vedi `memory.md`):
  - il **ricevente** scrive il proprio stato (`chiudiEAggiorna()`) appena ha letto
    `QR_K` (3) fotogrammi *crescenti* del cedente **e** ha visto `ack ≥ 1` dal
    cedente (l'ottica funziona in entrambi i versi). Nello stesso giro disegna il QR
    "fatto" (codice tipo **maiuscolo**, `S`/`D`, zero byte in più) e passa a una
    **schermata verde persistente** con codice grande, fotocamera spenta, QR fermo e
    un solo bottone "Chiudi" (che porta alla festa di sblocco). Non ha scadenza: è la
    prova che il cedente deve leggere, col telefono o con gli occhi. Se va in timeout
    (`QR_TIMEOUT_MS`, 40 s dall'apertura) *prima* di scrivere, "Scambio non riuscito"
    + "Riprova" — sicuro, non ha scritto nulla.
  - il **cedente** non scrive mai per tempo: cancella (`cedi()`, solo tipo "scambio")
    **solo** quando legge il QR "fatto" — oppure quando il giocatore, nella **domanda
    manuale** (`scambioDomanda()`, riquadro giallo "il telefono del tuo amico mostra
    la schermata verde con il codice ABCD?" con "No, tengo l'oggetto" / "Sì, l'ho
    controllato"), risponde Sì. La domanda compare dopo `QR_DOMANDA_MIN_MS` (30 s)
    dal tocco **e** `QR_DOMANDA_DOPO_K_MS` (10 s) da quando ha visto l'amico a soglia
    (cioè da quando può aver scritto), comunque entro `QR_DOMANDA_MAX_MS` (60 s); la
    lettura automatica **continua** sotto la domanda e, se riesce, la chiude da sola.
    Se il cedente non ha **mai** letto l'amico (`myReadCount == 0`) l'amico non può
    aver scritto (richiede `ack ≥ 1`): fallisce in sicurezza senza domanda ("l'oggetto
    è rimasto qui"). "Annulla" dopo almeno una lettura passa dalla stessa domanda.
    Per un "duplica" non c'è nulla da cancellare: al posto della domanda un messaggio
    spiega che, se l'amico è verde, ha ricevuto la copia lo stesso.
  - Esiti: la **perdita** (cancellato da A, mai arrivato a B) è impossibile per
    costruzione; la **duplicazione** solo se il cedente risponde "No" (o chiude)
    mentre l'amico è già verde. Un terzo telefono che in "Foto" inquadra la schermata
    verde di un ricevente vede "Questo scambio è già concluso."

  La schermata `#p-scambio` è guidata da tre attributi — `data-ruolo`
  (cedente/ricevente: anche l'ordine QR/anteprima, via `order`), `data-tipo`
  (scambio/duplica: titolo e sottotitolo scritti in HTML, il CSS mostra la variante),
  `data-fase` (lettura/domanda/incerto/fatto/fallito: bottoni, riquadro della domanda,
  schermata verde) più `data-n` (letture finora) — e il JS cambia solo questi e i
  testi variabili (nome, codice, contatore): **tutti i messaggi di stato** ("Avvicina
  gli schermi", "Verifica in corso (n/K)", "Fatto! Hai ceduto…", "Ricevuto!…", "Scambio
  non riuscito…", "Non ho letto la conferma…") sono varianti scritte in HTML dentro
  `#p-scambio-status`, scelte dal CSS; solo gli errori della fotocamera passano da
  `setStatus()` su `#p-scambio-errore`. Il contenuto del QR (`"gc1:" + tipo-in-un-carattere:sessionId:nodo:seq:ack:mioId:istanza`,
  non JSON; l'ultimo campo è vuoto per i nodi normali, un QR a 6 campi di una versione
  precedente si legge ancora) è pensato apposta per restare piccolo (44 byte nel caso
  peggiore, versione QR 3): meno byte da codificare vuol dire
  moduli più grandi a parità di dimensione a schermo, più facili da mettere a fuoco e
  leggere al volo. L'anteprima della fotocamera anteriore (non il fotogramma vero letto
  da jsQR, solo quello che il giocatore vede) è specchiata via CSS, altrimenti allineare
  a mano due telefoni è disorientante (muoversi verso destra sposterebbe l'immagine
  verso sinistra). Chi cede un nodo
  tipo "scambio" viene tolto da `trovati`/bottino e aggiunto per sempre a un nuovo
  elenco `ceduti` nello stato del giocatore: `chiudi()` lo esclude per sempre dalla
  chiusura automatica dei "regali", altrimenti alla prima sincronizzazione successiva
  (bastano i suoi prerequisiti ancora soddisfatti) la logica reattiva lo riassegnerebbe
  da sola, duplicandolo — vedi `memory.md`, sezione sullo scambio. Chi condivide un
  nodo tipo "duplica" non tocca il proprio stato: il ricevente lo aggiunge con lo
  stesso meccanismo di un ritrovamento normale (`chiudiEAggiorna()`). Le due librerie
  di lettura/generazione QR (`jsqr`, `qrcode`) si caricano da CDN via `import()`
  dinamico solo aprendo questa interfaccia, stesso pattern lazy di MediaPipe.
- **Regali "a istanze"** (`istanze: true`, solo su un regalo, implica `duplicabile`): ogni
  telefono che ne soddisfa i prerequisiti **produce** la propria istanza — un id casuale
  lettera-cifra-lettera (`K7X`), monospaziato e colorato dall'hash — una sola volta
  (`stato.prodotti`, anche se aveva già ricevuto istanze di altri). Le istanze si
  condividono con lo stesso scambio 👥 (settimo campo del QR); chi riceve rifiuta solo la
  *stessa* istanza e può ricondividere quelle ricevute (copie di copie). In Memoria ogni
  istanza è una riga (nome sopra, badge sotto, "★ tua" sulle proprie) col proprio 👥. Un
  nodo può richiedere "almeno N istanze diverse" di un altro (`istanzeRichieste`, campo
  numerico accanto alla spunta "Richiede" nel pannello master, etichetta `×N` sulla
  freccia del Grafo, icona 🎟️ sulla scheda): è così che si rende **obbligatorio
  l'incontro fra giocatori** senza database né identità — nessuno può produrre due
  istanze, la seconda deve arrivare da un altro telefono. Se non c'è più nulla da
  fotografare ma manca un'istanza, la fine caccia dice "Ti manca qualcosa … Sigillo ×1"
  (`mancanoIstanze()`) invece di "Hai trovato tutto". Schema e regole in
  `docs/MODELLO-DATI.md`, ragionamento in `memory.md`.
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
  (editabile), subito seguiti dalle flag — **Thumb** (la foto fa
  da indizio mentre il nodo è ancora *da trovare*, per lui stesso — vedi
  `immaginiIndizio()`; non c'entra con la foto nel bottino/sblocco, che si
  vede sempre una volta posseduto), **Validare** (richiede foto+match
  del giocatore per essere posseduto, altrimenti lo diventa da solo appena
  "richiede" è soddisfatto), **Posizione** (in più al match
  fotografico, il giocatore deve essere entro 100 m dal punto registrato —
  spuntarla spunta anche "Validare" in automatico, e non si può togliere
  l'una senza l'altra), e, sotto, il **modo del regalo** come scelta unica (radio, visibile solo
  quando "Validare" è spenta — ha senso solo su un regalo, mai su un nodo
  che si ottiene rifotografando un oggetto reale, altrimenti chi lo cede
  potrebbe rifotografarlo per riprenderselo): 🎁 **Libero**, 🔄
  **Scambiabile**, 👥 **Duplicabile**, 🎟️ **Duplicabile a istanze** (vedi
  sopra). Nel file restano le tre flag booleane `scambiabile`/`duplicabile`/
  `istanze` (`MODI_REGALO`, `modoRegalo()`, `impostaModoRegalo()`): la radio
  le scrive in modo esclusivo, e un file modificato a mano con più flag
  accese si legge con la precedenza istanze > scambiabile > duplicabile,
  la stessa usata dal bottone in Memoria. L'icona del modo compare accanto
  a 🎁 sulla scheda del Grafo (`iconaNodo()`). **Il markup della scheda vive in
  HTML** (`<template id="tpl-nodo">`, una riga "Richiede" per nodo da
  `tpl-richiede`): `creaSchedaNodo()` lo clona, riempie i valori e collega gli
  eventi, ed è la stessa funzione usata dal riquadro laterale del Grafo. Le
  regole di visibilità sono CSS: `data-validare` sulla radice nasconde la radio,
  `:has()` mostra "almeno N" solo a spunta accesa su un prerequisito a istanze —
  poi due
  campi separati, entrambi auto-riferiti a
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
- Permette scambio/condivisione di un regalo fra due telefoni vicini (vedi sopra),
  ma **non** la "condivisione a scorta limitata" progettata in `docs/ROADMAP.md`
  punto 3 (un contatore condiviso fra tutti i giocatori richiede un'operazione
  atomica su un database, che non esiste ancora — vedi `memory.md`): oggi un nodo
  "duplicabile" si può condividere un numero illimitato di volte.
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
