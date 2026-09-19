# gc — Percorsi di riconoscimento visivo sul campo / Field visual-recognition paths

🇮🇹 [Italiano](#italiano) · 🇬🇧 [English](#english)

# Italiano

**Sistema per percorsi di riconoscimento visivo sul campo, eseguito interamente nel browser.** 

## Sommario

Un curatore registra elementi fisici di un territorio; i partecipanti li individuano e li verificano con la fotocamera del proprio dispositivo. Gli elementi sono organizzati in un grafo diretto aciclico di prerequisiti, e fra dispositivi sono possibili operazioni di trasferimento e replica realizzate con un protocollo ottico fra pari, senza server. 
Non esistono identità, database né trasmissione di immagini: l'intero stato risiede sul dispositivo.

Istanza pubblica: <https://vertighel.github.io/gc/> 

Il sistema è composto da quattro strati.

1. **Verifica.** Ogni elemento è descritto da un insieme di riferimenti acquisiti sul posto dal curatore:
 - rappresentazioni vettoriali dell'elemento (positivi),
 - dell'ambiente circostante (negativi),
 - della posizione geografica.
2. La verifica del partecipante è un confronto di similarità fra la cattura dell'inquadratura e quei riferimenti, con una soglia calibrata automaticamente all'acquisizione:
 - riconoscimento di *istanze* visive, a una classe per volta, senza addestramento e senza dataset;
 - un secondo fattore opzionale è la prossimità geografica (entro un raggio dal punto registrato), controllata dopo la verifica visiva.
3. **Progressione** Gli elementi formano un *grafo diretto aciclico*:
 - gli archi sono prerequisiti in `AND`;
 - un elemento si acquisisce per *verifica* (fotocamera, più eventualmente posizione); o per *derivazione*, automaticamente, quando tutti i suoi prerequisiti sono soddisfatti.
 - A ogni elemento sono associati un testo visibile prima dell'acquisizione (traccia) e uno dopo (contenuto di sblocco);
 - il curatore dispone inoltre di un canale di annunci e può pubblicare più percorsi indipendenti dallo stesso sito.
4. **Operazioni sugli elementi derivati** Sugli elementi derivati sono definite tre operazioni:
 - *trasferimento* esclusivo (l'elemento si sposta da un dispositivo all'altro),
 - *replica* (copia identica, non esclusiva);
 - *replica a istanze* (ogni dispositivo può produrre un solo token univoco dell'elemento, e può replicare quelli ricevuti). Un arco può richiedere "almeno N istanze distinte": poiché nessun dispositivo ne produce due, il vincolo è soddisfacibile solo cooperando.
4.1. **Interazione** Le operazioni avvengono su un canale ottico bidirezionale:
 - i due dispositivi si leggono a vicenda un codice QR con le fotocamere anteriori;
 - usano un protocollo di consegna asimmetrico e senza terze parti.
5. **Compilazione del grafo e distribuzione.** Il curatore acquisisce i riferimenti sul campo, modifica il grafo (con controllo di aciclicità) e pubblica; il tutto da un pannello nello stesso file. L'applicazione è un unico file HTML su hosting statico; i dati pubblicati sono file JSON in sola lettura, scritti dal curatore tramite l'API di GitHub e scaricati dai partecipanti a ogni avvio. Lo stato di ciascun partecipante risiede esclusivamente nel suo dispositivo.

**Cosa distingue questo progetto**

- **Riconoscimento senza infrastruttura né addestramento.** Il modello (MobileNet v3 via MediaPipe) gira nel browser; ogni elemento nasce da una cattura di pochi secondi sul posto, con soglia calibrata automaticamente contro l'ambiente circostante.
- Nessuna immagine dei partecipanti lascia mai il dispositivo: la verifica avviene in locale e in rete circolano solo vettori quantizzati del curatore.
- Nessuna informazione sulla posizione lascia mai il dispositivo.
- Nessuna informazione sull'identità dell'utente è condivisa con un server.
- **Cooperazione obbligata senza identità.** L'unicità della produzione delle istanze (una stringa per dispositivo) rende alcuni elementi ottenibili solo incontrando altri utilizzatori, senza che il sistema sappia chi è chi.
- **Commit fra pari su canale ottico.** Il trasferimento fra due dispositivi è un'istanza del ["Problema dei Due Generali"](https://en.wikipedia.org/wiki/Two_Generals%27_Problem), che non ha soluzione perfetta senza arbitro. Il protocollo non finge di risolverlo: è asimmetrico (il ricevente scrive per primo, il cedente cancella solo dopo aver letto la prova) e sceglie l'errore residuo. Tecnicamente, la duplicazione resta possibile in un caso preciso, mentre la perdita è impossibile per costruzione. La prova di presenza dal vivo (*"Freshness"*) si misura con contatori locali crescenti.
- **Zero infrastruttura.** Un solo file, nessun build, nessun server applicativo: la pubblicazione è un `git push`, il "database" sono due file JSON, e il sistema funziona offline con l'ultima copia scaricata.
- **Dichiarativo fino all'interfaccia.** Il markup è HTML nativo (`<template>`, `<dialog>`, `<details>`), lo stato visibile è un attributo `data-*` letto dal CSS, i clic sono azioni dichiarate nell'HTML e risolte da un unico listener: il file si legge senza seguire il JavaScript.

## Indice

- [Caso d'uso: la caccia al tesoro](#caso-duso-la-caccia-al-tesoro)
- [Come si gioca](#come-si-gioca)
- [Il master: creare una caccia](#il-master-creare-una-caccia)
- [Struttura del progetto](#struttura-del-progetto)
  - [Architettura](#architettura)
  - [Modello dati](#modello-dati)
  - [Scambio senza server](#scambio-senza-server)
  - [Convenzioni dell'interfaccia](#convenzioni-dellinterfaccia)
- [Sviluppo e test](#sviluppo-e-test)
- [Limiti noti e roadmap](#limiti-noti-e-roadmap)
- [Screenshot](#screenshot)

## Caso d'uso: la caccia al tesoro

L'istanza pubblica del sistema è una caccia al tesoro per le vie di Genova: un gioco per meno di dieci persone, tutte amiche di chi lo organizza (il *master*, cioè il curatore). Nel resto di questo documento si usa il lessico del gioco — caccia, giocatore, master, oggetto, regalo, bottino — perché è quello dell'interfaccia.

Il master gira per la città, fotografa oggetti reali (portoni, maniglie, orologi, cartelli…) e li collega fra loro in una trama. I giocatori aprono un indirizzo web sul telefono, leggono l'indizio, cercano l'oggetto e lo inquadrano: il riconoscimento avviene sul telefono stesso, confrontando *embedding* calcolati nel browser — nessuna foto lascia mai il dispositivo. Una tappa può anche richiedere di trovarsi entro 100 m dal punto in cui il master ha registrato l'oggetto (GPS, controllato solo dopo che la foto è valida).

Trovare un oggetto può sbloccare dei *regali*: elementi che si ottengono da soli quando i loro prerequisiti sono soddisfatti. Un regalo può essere **scambiabile** (passa a un amico, chi lo cede lo perde), **duplicabile** (l'amico riceve una copia) o **a istanze** (ogni telefono ne produce una copia diversa, e un altro elemento può richiederne "almeno N diverse": l'unico modo per averle è incontrare altri giocatori). Il passaggio avviene telefono-a-telefono, leggendosi a vicenda un QR con le fotocamere anteriori, senza server. Il master può inoltre inviare messaggi a tutti i giocatori.

## Come si gioca

Le stesse istruzioni si leggono nel gioco toccando ❓.

Questa pagina necessita dei permessi per usare fotocamere e GPS, ma **non** trasmette a terzi né immagini né posizione: tutto resta nel tuo telefono. Le interazioni fra utilizzatori **non** sono mediate da un server e **non** scambiano alcuna informazione personale.

In basso hai due schede: **🔍 Cerca** per trovare gli oggetti, **💽 Memoria** per rivedere quelli trovati.

1. **👾 Traccia** mostra l'indizio dell'oggetto da cercare (testo e, a volte, una foto). Sotto c'è l'elenco di tutto ciò che puoi cercare adesso: toccane uno per sceglierlo.
2. Trovato l'oggetto, vai in **📷 Foto**, tocca **Attiva la fotocamera**, inquadralo per intero e premi **Scatta e verifica**. Se la tappa chiede anche la posizione, il GPS viene controllato solo dopo che la foto è valida: accendilo e resta vicino all'oggetto.
3. In **💽 Memoria** tocca una riga per rivedere foto e messaggio. Alcuni oggetti si possono condividere con altri utilizzatori: con **🔄** (scambia) lo trasferisci, e scomparirà dalla tua Memoria, con **👥** duplichi una copia identica. Un oggetto con 🎟️ è diverso per ogni giocatore: puoi duplicare una copia diversa.
4. Per passarlo: tu premi 🔄 o 👥 in Memoria; chi riceve apre **📷 Foto**, attiva la fotocamera e inquadra il tuo schermo. Poi mettete i telefoni schermo contro schermo: le fotocamere anteriori si leggono a vicenda. Aspettate **Fatto!**: chi riceve vede una schermata verde con un codice e la tiene in vista finché l'altro telefono non ha finito. Se il tuo telefono dice «Non ho letto la conferma», guarda l'altro schermo: rispondi **Sì** solo se è verde e mostra lo stesso codice.
5. Per riceverlo: apri **📷 Foto**, attiva la fotocamera e inquadra il QR nell'altro schermo. Dopo pochi istanti si aprirà la camera anteriore. Metti i telefoni schermo contro schermo: le fotocamere anteriori si leggono a vicenda. Aspettate **Fatto!**: chi riceve vede una schermata verde con un codice e la tiene in vista finché l'altro telefono non ha finito. Se il tuo telefono dice «Non ho letto la conferma», guarda l'altro schermo: rispondi **Sì** solo se è verde e mostra lo stesso codice.
6. **✉️** sono i messaggi del master: si scaricano a ogni apertura dell'app.
7. **⚙️** sono le impostazioni: **Cambia caccia** torna alla scelta della caccia; **Ricomincia la caccia** cancella la Memoria e i progressi di questa caccia su questo telefono.

Consigli: usa Chrome o Safari e tieni la pagina aperta; se qualcosa sembra bloccato, ricarica la pagina. Il numero di versione nel banner di avvio ti dice se hai l'ultima versione.

## Il master: creare una caccia

Il pannello del master è lo stesso `index.html` aperto con `#master` in fondo all'indirizzo. È diviso in tre pagine.

**Pannello master (`#master`).** In cima, il menu delle cacce: la prima voce "+ Nuova caccia" chiede un nome, che diventa lo *slug* (minuscole, spazi e simboli trasformati in `-`) e quindi il nome del file e il link da mandare ai giocatori; poi "caccia" (quella di sempre, senza `#` nel link) e ogni caccia con nome elencata in `cacce.json`. Sotto, "Registra un nuovo elemento": si attiva la fotocamera e si registra un oggetto sul posto, sempre con la stessa sequenza — **Oggetto** (20 fotogrammi mentre ci si muove per circa 6 secondi, più uno scatto compresso per la miniatura), **Dintorni** (10 fotogrammi dell'ambiente intorno, usati come negativi), la posizione GPS del master in quel momento. La soglia di riconoscimento si calcola da sola (`calibrate()`) e un messaggio avvisa se l'oggetto è troppo simile ai dintorni. **Prova** verifica subito il riconoscimento con la fotocamera; **Aggiungi** mette il nodo nella copia di lavoro (nome di default "Oggetto-N"), senza pubblicare. Ogni nodo nasce solo così: non esiste un modo di crearne uno scrivendo del testo da un computer. Più in basso l'elenco di sola lettura degli elementi (miniatura cliccabile, si ingrandisce in una lightbox), la sezione **Messaggi** (un annuncio per tutti, scritto in `messaggi.json`) e il pannello di configurazione di GitHub.

**Collega gli elementi (`#master-collega`).** Pensata per un computer. Una scheda per nodo con: foto, nome modificabile, le tre spunte **Thumb** (la foto fa da indizio mentre l'elemento è ancora da trovare), **Validare** (serve la foto del giocatore per possederlo; spenta, l'elemento diventa un regalo che si ottiene da solo quando i prerequisiti sono soddisfatti) e **Posizione** (in più alla foto, il giocatore deve essere entro 100 m; spuntarla accende anche Validare). Solo sui regali compare il **modo**: 🎁 Libero, 🔄 Scambiabile, 👥 Duplicabile, 🎟️ Duplicabile a istanze. Poi i due testi, **Indizio** (visibile prima, mentre lo si cerca) e **Messaggio** (visibile alla schermata di sblocco e poi in Memoria), e l'elenco **Richiede**: una spunta per ogni altro nodo, sempre in AND; se il prerequisito è a istanze compare il campo "almeno N". "Rimuovi" è bloccato se un altro nodo lo richiede ancora. In fondo, **Pubblica** (dopo un controllo che i collegamenti non formino un ciclo) e **Prova su questo telefono**, che apre il giocatore su questo stesso telefono in uno spazio separato, segnalato da una striscia gialla, senza toccare la caccia pubblicata.

**Grafo (`#master-grafo`).** Gli stessi collegamenti disegnati: layout automatico verticale per livello di dipendenza, un'icona per nodo (📷 da validare, 📍 con posizione, 🎁 regalo più l'icona del modo, `×N` sulle frecce a istanze). Si collega cliccando il pallino di un nodo e poi quello di un altro (il primo è il prerequisito), si scollega cliccando una freccia, si apre la stessa scheda di "Collega gli elementi" cliccando il corpo di un nodo. Se c'è un ciclo il grafo non si disegna e un messaggio elenca i nodi coinvolti.

**Bozza e pubblicazione.** La copia di lavoro si salva in due modi: in automatico nel `localStorage` del telefono del master a ogni modifica (chiave `m-lavoro`), e sul server premendo "Salva bozza sul server", che scrive `lavoro.json` (o `lavoro-<slug>.json`). Quest'ultimo file non è mai letto dal giocatore normale, ma si può provare da qualunque browser col link `#b` (o `#b-<slug>`). All'apertura il pannello ricarica la copia di lavoro con questa precedenza: bozza locale → bozza sul server → caccia pubblicata → vuota. Solo **Pubblica** scrive `caccia.json` (o `caccia-<slug>.json`), e alla prima pubblicazione di una caccia con nome la aggiunge a `cacce.json`.

Tutte le scritture passano dall'**API REST di GitHub** (`ghPutFile()`: `GET` per lo sha corrente, `PUT` per scrivere, un tentativo in più su conflitto 409). Il pannello "Configura la pubblicazione su GitHub" salva utente, repository, ramo e un token *fine-grained* con permesso "Contents: Read and write" limitato a questo repository. Il token resta solo nel `localStorage` di quel telefono. I giocatori vedono il file aggiornato entro circa un minuto.

**Più cacce.** Ogni caccia è un file a sé: `caccia.json` per quella di sempre, `caccia-<slug>.json` per le altre, elencate in `cacce.json`. Il giocatore che apre il link senza `#` sceglie da una lista e la scelta viene ricordata; un link diretto `#c-<slug>` salta la scelta e va dritto a quella caccia. I messaggi (`messaggi.json`) sono invece globali, condivisi da tutte le cacce.

## Struttura del progetto

| File | Cosa contiene |
|---|---|
| [`index.html`](index.html) | Tutto il gioco: CSS, HTML (giocatore, scelta della caccia, master, Collega, Grafo, `<template>`) e il modulo JS. |
| `caccia.json`, `caccia-<slug>.json` | Le cacce pubblicate, formato `caccia-3`. Scritte dal master via API GitHub, lette dai giocatori con `fetch()`. |
| `lavoro.json`, `lavoro-<slug>.json` | Bozze di lavoro del master salvate sul server. Mai lette dal giocatore normale; provabili col link `#b`/`#b-<slug>`. |
| `cacce.json` | Elenco degli slug delle cacce con nome (quella di sempre non ci compare mai). |
| `messaggi.json` | Annunci del master, in ordine di pubblicazione, uguali per tutte le cacce. |
| `img/` | Gli screenshot di questo README. |
| [`tests/`](tests/) | Test Playwright: `scambio.test.mjs` (protocollo di scambio) e `sincronizzazione.test.mjs` (telefono e computer del master che si passano la copia di lavoro). |

### Architettura

- **Un solo file HTML**, senza framework e senza build: si pubblica con un `git push` su GitHub Pages. Le uniche librerie esterne si caricano da CDN con `import()` dinamico, solo quando servono.
- **I JSON sono il database, in sola lettura.** I giocatori li scaricano con `fetch()` (senza cache) a ogni apertura; solo il master li scrive, tramite l'API di GitHub. Non c'è nessun database vero.
- **Lo stato del giocatore vive nel `localStorage`** del suo telefono: la caccia scaricata, gli elementi posseduti, il bottino, i messaggi letti, gli elementi ceduti e le istanze prodotte, con chiavi separate per caccia (`gioco`/`stato`, `gioco:<slug>`/`stato:<slug>`). Funziona offline con l'ultima copia scaricata.
- **Il riconoscimento immagini è interamente nel browser.** `index.html` usa [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (`@mediapipe/tasks-vision@1.0.1`, classe `ImageEmbedder`) con il modello `mobilenet_v3_small` (float32) scaricato dal repository dei modelli MediaPipe; prova prima il delegato GPU e ripiega su CPU. Ogni fotogramma diventa un vettore normalizzato (1024 dimensioni) e si confronta per prodotto scalare con i vettori dell'oggetto (`pos`) e dei dintorni (`neg`) registrati dal master; vince il migliore di 5 fotogrammi ravvicinati, valido se supera la soglia calcolata alla registrazione ed è più simile all'oggetto che ai dintorni. In `caccia.json` i vettori sono compressi a 8 bit (`pack()`/`unpack()`): nessuna foto dei giocatori lascia mai il telefono, e da un embedding non si ricostruisce un'immagine.
- **QR per lo scambio**: lettura con [`jsqr`](https://www.npmjs.com/package/jsqr) 1.4.0, generazione con [`qrcode`](https://www.npmjs.com/package/qrcode) 1.5.4, entrambi caricati da CDN solo quando si apre l'interfaccia di scambio.

### Modello dati

Formato `caccia-3`: un solo tipo di nodo. Ogni nodo nasce dalla cattura sul campo (foto dell'oggetto, foto dei dintorni, posizione GPS: sempre tutte e tre) e si comporta in un modo o nell'altro solo in base a tre flag booleani:

- `daValidare` — `true`: serve foto e riconoscimento per possederlo; `false`: è un regalo, posseduto da solo appena i suoi `richiede` sono soddisfatti.
- `richiedePosizione` — in più alla foto, il giocatore deve essere entro `luogo.raggio` (100 m). Implica `daValidare: true`.
- `conThumb` — la foto fa da indizio mentre il nodo è ancora da trovare. Una volta posseduto, la foto si vede sempre.

`richiede` è la lista dei prerequisiti (sempre in AND). Sui regali, i modi `scambiabile` / `duplicabile` / `istanze`; su chi richiede un nodo a istanze, `istanzeRichieste: { "<id>": N }` per chiedere "almeno N istanze diverse". Un'istanza è un id casuale a tre caratteri lettera-cifra-lettera (es. `K7X`), prodotto una sola volta per telefono. `testo` (l'indizio, prima) e `messaggio` (dopo lo sblocco) sono sempre riferiti al nodo stesso. Prima di pubblicare, `trovaCiclo()` controlla che i collegamenti non formino un ciclo. Se il master ripubblica con lo stesso `formato`, i progressi dei giocatori restano e i nuovi nodi si aggiungono; un `formato` diverso azzera tutto.

### Scambio senza server

Un regalo `scambiabile` o `duplicabile` passa da un telefono all'altro con un handshake dal vivo: i due telefoni si mettono schermo contro schermo e ognuno legge, con la fotocamera anteriore, il QR che l'altro mostra e ridisegna alcune volte al secondo. Il QR contiene solo `gc1:tipo:sessionId:nodo:seq:ack:mioId:istanza` (44 byte al massimo, versione QR 3, così i moduli restano grandi e leggibili). Le prime quattro lettere del `sessionId` sono il codice mostrato grande su entrambi gli schermi.

Il problema di fondo — due dispositivi che devono accordarsi su un trasferimento scambiandosi messaggi che possono perdersi, senza un terzo che ricordi l'esito — è il **Problema dei Due Generali**, che non ha soluzione perfetta. Il gioco non lo risolve: sceglie quale dei due errori possibili resta ammesso. Il **protocollo è asimmetrico**: il ricevente scrive per primo, appena ha letto `QR_K` (3) fotogrammi crescenti del cedente e sa di essere stato letto almeno una volta, e mostra una schermata verde persistente col codice; il cedente cancella l'oggetto **solo** dopo aver letto quel QR "fatto" (e a quel punto diventa verde anche lui: è l'unico dei due ad avere la certezza), oppure dopo che il giocatore ha guardato con i propri occhi lo schermo verde dell'amico e confrontato il codice (domanda manuale, che compare dopo 30 s dal tocco e 10 s da quando l'amico può aver scritto, comunque entro 60 s). Così la **perdita** (cancellato da chi cede, mai arrivato a chi riceve) è impossibile per costruzione; l'unico errore residuo, accettato, è la **duplicazione**, e solo se il cedente risponde "No" mentre l'amico è già verde. La freschezza si misura con contatori locali crescenti, mai confrontando gli orologi dei due telefoni; un QR stampato non supera mai la soglia, perché non può rispondere in tempo reale. Chi cede un nodo lo vede segnato per sempre in `ceduti`, così la chiusura automatica dei regali non glielo restituisce alla foto successiva.

### Convenzioni dell'interfaccia

- **HTML nativo, il JS lo riempie.** Righe, schede, festa di sblocco, messaggi sono `<template>` in fondo alla pagina, clonati con `clona(id)`. I testi con più varianti (titoli dello scambio, fine caccia) sono tutti scritti in HTML e il CSS ne mostra uno. `<dialog>` per la lightbox, `::before` per gli elenchi vuoti, `:has()` per le dipendenze fra campi.
- **Lo stato visibile è un attributo `data-*`**, mai una lista di `hidden` accesi e spenti a mano: `body[data-view]` (`player`, `chooser`, `master`, `master-collega`, `master-grafo`), `#view-player[data-tab][data-sub][data-stato]`, `#p-scambio[data-ruolo][data-tipo][data-fase][data-n]`, `.scheda-nodo[data-validare]`. Da `data-view` il CSS deriva anche tema scuro, larghezza e schermo pieno.
- **I clic sono azioni dichiarate.** Ogni elemento cliccabile porta `data-azione="nome"` (più i dati che servono in altri `data-*`), la funzione con lo stesso nome sta in `AZIONI`, e un unico listener delegato la chiama. Nessun `onclick =` nel file.
- **Nessun gancio di test nel file vero**: i test copiano `index.html` e iniettano `window.__debug` solo nella copia.

## Sviluppo e test

Non c'è nulla da installare per il gioco in sé. Per provarlo in locale:

```sh
python3 -m http.server 8765
```

e si apre `http://localhost:8765/` (giocatore) e `http://localhost:8765/#master` (master). Fotocamera, GPS e riconoscimento non si provano da terminale; il pattern usato finora è Playwright con Chromium:

- per il master, intercettare `https://api.github.com/**` con un gestore finto che simula `GET` (sha) e `PUT` (scrittura), invece di scrivere davvero sul repository;
- per il giocatore, scrivere a mano un `caccia.json` e un `messaggi.json` di prova nella cartella servita;
- per simulare la fotocamera, `--use-fake-device-for-media-stream`; per simulare un oggetto riconosciuto, iniettare un embedding finto nello stato del master;
- lo stato del modulo JS non è raggiungibile da `page.evaluate`: si copia `index.html` in una cartella di prova e solo lì si aggiunge un `window.__debug`.

[`tests/scambio.test.mjs`](tests/scambio.test.mjs) fa esattamente questo per il protocollo di scambio: due pagine Playwright fanno da telefoni, lettura e generazione del QR sono sostituite da stub, i giri del ciclo si eseguono uno alla volta. Verifica l'asimmetria (il ricevente scrive per primo), la domanda manuale del cedente e i suoi tempi, "Annulla", "duplica", i timeout, e i regali a istanze (produzione unica, produzione dopo ricezione, rifiuto della stessa istanza, copie di copie, chiusura "almeno ×2", messaggio "Ti manca"). **Non** prova la convergenza ottica reale: quella si vede solo con due telefoni veri. [`tests/sincronizzazione.test.mjs`](tests/sincronizzazione.test.mjs) fa lo stesso per il lato master: due dispositivi (telefono e computer) che si passano la copia di lavoro con "Salva bozza sul server" e "Pubblica", con un'API di GitHub finta che scrive davvero i file nella cartella servita. Si lanciano con `node tests/<nome>.test.mjs` da una cartella dove `playwright` (con Chromium) è installato.

Il banner di avvio mostra `Avvio del gioco… (versione N)`: `N` si incrementa a ogni modifica pubblicata ed è il modo più rapido per capire, guardando il telefono, se gira l'ultima versione o una vecchia rimasta in cache.

## Limiti noti e roadmap

- **I JSON sono pubblici.** Chiunque conosca l'indirizzo può leggere `caccia.json`: nomi, indizi, coordinate. Accettato per scelta, con meno di dieci amici; per nasconderli servirebbe un database con indizi cifrati.
- **Nessuna identità dei giocatori.** Ogni telefono è anonimo; progressi e bottino vivono solo nel suo `localStorage`. Rimandata di proposito, è il prerequisito di tutto il resto.
- **Nessun database.** Tutto ciò che richiede scritture da più telefoni — log di chi ha trovato cosa visibile al master, un contatore condiviso — è rimandato a un database vero (quasi certamente Supabase), senza cambiare hosting.
- **Scarsità rimandata.** Un regalo duplicabile si condivide un numero illimitato di volte: un tetto condiviso (`scorta`) richiede un'operazione atomica su un database.
- Il repository **deve restare pubblico**: GitHub Pages sui repository privati richiede un piano a pagamento.

Strade già provate e scartate, da non riproporre: **GitLab dell'INAF** come hosting (certificato https non valido sui siti Pages, che impedisce alla fotocamera di funzionare, oltre a un controllo di accesso che bloccava i giocatori) e **Netlify Drop** (funzionante, ma scomodo per pubblicazioni ricorrenti senza CLI).

## Screenshot

![Scelta della caccia](img/giocatore-scelta.png)

Schermata di scelta: si apre la prima volta senza `#` nell'indirizzo; la caccia di sempre più quelle elencate in `cacce.json`.

![Cerca › Traccia](img/giocatore-traccia.png)

Cerca › Traccia: la targa con l'indizio dell'elemento scelto e, sotto, l'elenco di tutto ciò che si può cercare adesso.

![Cerca › Foto](img/giocatore-foto.png)

Cerca › Foto con la fotocamera attiva (qui quella finta di Chromium) e "Scatta e verifica" pronto.

![Memoria](img/giocatore-memoria.png)

Memoria: l'elemento toccato in cima con foto e messaggio, sotto il bottino con i bottoni 🔄/👥 e un'istanza `K7X` marcata "★ tua".

![Istruzioni](img/giocatore-istruzioni.png)

Il pannello ❓ con le istruzioni riportate sopra.

![Scambio, lato cedente](img/giocatore-scambio.png)

Scambio, lato cedente in fase di lettura: anteprima specchiata della fotocamera anteriore, il proprio QR, il codice e il contatore delle letture.

![Scambio, lato ricevente](img/giocatore-scambio-verde.png)

Lato ricevente a scambio concluso: la schermata verde persistente con codice e QR "fatto", da tenere in vista finché il cedente non ha letto (anche il cedente diventa verde quando l'ha letta).

![Pannello master](img/master-pannello.png)

Pannello `#master`: menu delle cacce, registrazione di un nuovo elemento (Oggetto/Dintorni, Prova/Aggiungi), elenco degli elementi, messaggi e configurazione di GitHub.

![Collega gli elementi](img/master-collega.png)

`#master-collega`: una scheda per nodo con nome, flag, modo del regalo, indizio, messaggio e "Richiede" (con "almeno N" per un prerequisito a istanze).

![Grafo dei collegamenti](img/master-grafo.png)

`#master-grafo` sulla caccia "strada": layout per livello di dipendenza, icone per tipo di nodo, frecce cliccabili.

---

# English

**A system for field visual-recognition paths, running entirely in the browser.** A curator records physical elements of a territory; participants locate them and verify them with the camera of their own device. Elements are organised in a directed acyclic graph of prerequisites, and transfer and replication operations between devices are carried out by a peer-to-peer optical protocol, with no server. There are no identities, no database and no image transmission: the whole state lives on the device.

Public instance: <https://vertighel.github.io/gc/> 

## Abstract

The system has four layers.

1. **Verification.** Each element is described by a set of references acquired on site by the curator: visual embeddings of the element (positives), embeddings of its surroundings (negatives) and a geographic position. A participant's verification is a similarity comparison between the embedding of the current frame and those references, with a threshold calibrated automatically at acquisition time: visual *instance* recognition, one class at a time, with no training and no dataset. An optional second factor is geographic proximity (within a radius of the recorded point), checked after the visual verification.
2. **Progression.** Elements form a directed acyclic graph; edges are AND prerequisites. An element is acquired by *verification* (camera, plus optionally position) or by *derivation*, automatically, once all its prerequisites are satisfied. Each element carries a text shown before acquisition (trail) and one shown after (unlock content); the curator also has a broadcast channel and can publish several independent paths from the same site.
3. **Interaction between devices.** Three operations are defined on derived elements: exclusive *transfer* (the element moves from one device to another), *replication* (an identical, non-exclusive copy) and *instanced replication* (each device can produce a single unique token of the element, and can replicate the ones it has received). An edge can require "at least N distinct instances": since no device produces two, the constraint can only be met by cooperating. The operations run over a bidirectional optical channel — the two devices read each other's QR code with their front cameras — with an asymmetric commit protocol and no third party.
4. **Authoring and distribution.** The curator acquires references in the field, edits the graph (with an acyclicity check) and publishes, all from a panel in the same file. The application is a single HTML file on static hosting; published data are read-only JSON files, written by the curator through the GitHub API and downloaded by participants at every start. Each participant's state lives only on their device.

**What sets this project apart**

- **Recognition with no infrastructure and no training.** The model (MobileNet v3 via MediaPipe) runs in the browser; every element is born from a few seconds of capture on site, with a threshold calibrated automatically against the surroundings. No participant image ever leaves the device: verification is local, and only the curator's quantised vectors travel over the network.
- **Forced cooperation without identity.** The uniqueness of instance production — one token per device — makes some elements obtainable only by meeting other participants, without the system knowing who is who: no accounts, no database, no tracking.
- **Peer-to-peer commit over an optical channel.** A transfer between two devices is an instance of the Two Generals Problem, which has no perfect solution without an arbiter. The protocol does not pretend to solve it: it is asymmetric (the receiver writes first, the giver deletes only after reading the proof) and chooses the residual error — duplication remains possible in one precise case, loss is impossible by construction. Freshness comes from local increasing counters, never from comparing clocks.
- **Zero infrastructure.** One file, no build, no application server: deployment is a `git push`, the "database" is two JSON files, and the system works offline with the last downloaded copy.
- **Declarative down to the UI.** The markup is native HTML (`<template>`, `<dialog>`, `<details>`), visible state is a `data-*` attribute read by CSS, clicks are actions declared in the HTML and dispatched by a single listener: the file can be read without following the JavaScript.

## Contents

- [Use case: a treasure hunt](#use-case-a-treasure-hunt)
- [How to play](#how-to-play)
- [The master: creating a hunt](#the-master-creating-a-hunt)
- [Project structure](#project-structure)
  - [Architecture](#architecture)
  - [Data model](#data-model)
  - [Serverless exchange](#serverless-exchange)
  - [UI conventions](#ui-conventions)
- [Development and testing](#development-and-testing)
- [Known limits and roadmap](#known-limits-and-roadmap)
- [Screenshots](#screenshots)

## Use case: a treasure hunt

The public instance of the system is a treasure hunt through the streets of Genoa: a game for fewer than 10 players, all friends of the organiser (the *master*, i.e. the curator). The rest of this document uses the game's vocabulary — hunt, player, master, object, gift, loot — because it is the vocabulary of the interface.

The master walks around Genoa and records real objects (doors, handles, clocks, signs...) with the phone camera. Players then go looking for them: when they think they have found one, they frame it with their phone and an image-recognition model running **entirely in the browser** confirms whether it is the right object. A step can also require the player to be within 100 m of the GPS position the master recorded. Some nodes are "gifts" that unlock automatically once their prerequisites are met; a gift can be marked as swappable (it moves from one phone to another), duplicable (a copy is shared, the giver keeps it) or "instanced" (each phone produces its own unique copy, and another node can require several different ones, which forces players to meet). The master can also broadcast messages that every player downloads when opening the app. Photos never leave the phone; nothing is sent to any server other than the static files on GitHub Pages.

## How to play

The same instructions are shown in the game by tapping ❓.

This page needs permission to use the cameras and GPS, but it does **not** send images or your position to anyone: everything stays on your phone. Interactions between users are **not** mediated by a server and do **not** exchange any personal information.

At the bottom you have two tabs: **🔍 Cerca** (Search) to find the objects, **💽 Memoria** (Memory) to review the ones you have found.

1. **👾 Traccia** (Trail) shows the clue for the object to look for (text and, sometimes, a photo). Below it is the list of everything you can look for right now: tap one to choose it.

2. Once you have found the object, go to **📷 Foto** (Photo), tap **Attiva la fotocamera** (Turn on the camera), frame it whole and press **Scatta e verifica** (Shoot and check). If the step also requires the position, the GPS is checked only after the photo is valid: turn it on and stay close to the object.

3. In **💽 Memoria** tap a row to see the photo and message again. Some objects can be shared with other users: with **🔄** (swap) you transfer it, and it disappears from your Memoria; with **👥** you duplicate an identical copy. An object with 🎟️ is different for every player: you can duplicate a different copy.

4. To pass it on: you press 🔄 or 👥 in Memoria; the receiver opens **📷 Foto**, turns on the camera and frames your screen. Then put the phones screen to screen: the front cameras read each other. Wait for **Fatto!** (Done!): the receiver sees a green screen with a code and keeps it in view until the other phone has finished. If your phone says «Non ho letto la conferma» (I did not read the confirmation), look at the other screen: answer **Sì** (Yes) only if it is green and shows the same code.

5. To receive it: open **📷 Foto**, turn on the camera and frame the QR on the other screen. After a few moments the front camera will open. Put the phones screen to screen: the front cameras read each other. Wait for **Fatto!**: the receiver sees a green screen with a code and keeps it in view until the other phone has finished. If your phone says «Non ho letto la conferma», look at the other screen: answer **Sì** only if it is green and shows the same code.

6. **✉️** are the master's messages: they are downloaded every time the app is opened.

7. **⚙️** are the settings: **Cambia caccia** (Change hunt) goes back to the hunt chooser; **Ricomincia la caccia** (Restart the hunt) clears the Memoria and the progress of this hunt on this phone.

Tips: use Chrome or Safari and keep the page open; if something seems stuck, reload the page. The version number in the boot banner tells you whether you have the latest version.

## The master: creating a hunt

Open the game with `#master` at the end of the address. The panel is a normal, scrolling page (no dark theme, no full-screen mode: those are for players only).

**Hunt menu.** At the top, a `<select>` lists "+ Nuova caccia" (new hunt), the default hunt ("caccia") and every named hunt known from `cacce.json`. A new hunt asks for a name, which is slugified (lower case, anything that is not a letter or digit becomes `-`) and becomes both the file name (`caccia-<slug>.json`) and the player link (`#c-<slug>`); the link is shown under the menu. "caccia" is a reserved name and is refused. The default hunt has an empty slug: `caccia.json`, link with no `#`. Choosing a hunt loads its working copy with this precedence: local draft on this phone (`m-lavoro` in `localStorage`, if it belongs to that hunt) → draft on the server (`lavoro*.json`) → published hunt (`caccia*.json`) → empty. A published file that is not in the `caccia-3` format is reported as incompatible and not read.

**Registra un nuovo elemento (record a new element).** Turn on the camera (rear), then:

- **Oggetto** (Object) records 20 embeddings while you move around the object for about 6 seconds (one every 300 ms), plus one real JPEG snapshot for the thumbnail.
- **Dintorni** (Surroundings) records 10 embeddings of the environment, used as negatives.
- Both are stored together with the master's GPS position at that moment (radius 100 m). All four (positives, negatives, snapshot, position) are always captured, whatever the node will be used for later.
- The recognition **threshold** is computed automatically by `calibrate()`: halfway between the 20th percentile of leave-one-out similarity among the positives and the highest similarity of any negative to the positives. A status line warns when the object looks too much like its surroundings.
- **Prova** (Try) runs the same 5-frame check a player would run, right there.
- **Aggiungi** (Add) appends the node to the working copy with default name "Oggetto-N" and default flags (Thumb on, Validare on, Posizione off), without publishing. The camera stays on so you can record the next one.

Every node is born this way, without exception: there is no way to create a node by typing text on a computer, not even a "synthetic" prize.

**Draft: local and on the server.** Every change is autosaved to `localStorage` (`m-lavoro`), which protects against an accidental reload. "Salva bozza sul server" writes the working copy to `lavoro.json` / `lavoro-<slug>.json` on GitHub: this protects against changing phone and lets anyone test the draft as a real player through the link `#b` / `#b-<slug>` (a real `fetch`, works from any browser). Normal players never read `lavoro*.json`.

**Elementi.** A read-only list of the nodes in the working copy (thumbnail + name). Tapping a thumbnail opens it larger in a lightbox.

**Collega gli elementi (`#master-collega`).** Designed for a computer, not a phone. Each node is a card (`<template id="tpl-nodo">`) with:

- the photo and an editable **name**;
- three flags: **Thumb** (the photo is shown as a clue while the node is still to be found), **Validare** (the player must photograph it and pass the match; if off, the node is owned automatically as soon as its prerequisites are owned), **Posizione** (in addition to the photo match, the player must be within 100 m of the recorded point; checking it also checks Validare, and they cannot be separated);
- the **gift mode**, a radio group visible only when Validare is off: 🎁 Libero (stays with whoever gets it), 🔄 Scambiabile (swappable: passes to a friend, you lose it), 👥 Duplicabile (a copy to a friend, you keep it), 🎟️ Duplicabile a istanze (instanced: a different seal for every player). In the file these are the three booleans `scambiabile` / `duplicabile` / `istanze`;
- **Indizio** (`testo`, the clue shown while looking for this node) and **Messaggio** (shown at unlock and afterwards in Memoria), both about this node itself;
- **Richiede** (Requires): a checkbox for every other node; when the prerequisite is instanced, an "almeno N" (at least N) numeric field asks for N *different* instances (`istanzeRichieste`);
- **Rimuovi** (Remove), blocked while another node still requires this one.

At the bottom: **Pubblica** writes `caccia*.json` to GitHub (after `trovaCiclo()` has checked that the `richiede` links contain no cycle; a cycle blocks publishing and names the nodes involved), and **Prova su questo telefono** (Try on this phone) switches the player view on this same phone to a separate, yellow-striped test space (`localStorage` keys with the `-prova` suffix) without touching the published hunt or the network.

**Grafo (`#master-grafo`).** The same `richiede` links drawn as a graph, laid out vertically by dependency level (no coordinates are saved). Click the dot of one node and then the dot of another to link them (first = prerequisite, second = the node that requires it); click an arrow to remove it (with confirmation); click a card body to open the same node card in a side panel (same code as "Collega gli elementi", not a copy). If the links form a cycle the graph is not drawn and a message lists the nodes involved. Each card shows 📷 (to validate), 📍 (position required) or 🎁 (gift), plus the gift-mode icon.

**Publishing through the GitHub API.** A `<details>` panel in the master page stores owner, repository, branch and a fine-grained personal access token (Contents: read and write, limited to this repository) in `localStorage` on the master's phone only. `ghPutFile()` does a `GET` on the Contents API to fetch the current `sha`, then a `PUT` with the new content; on a `409` conflict it re-reads the `sha` and retries once. The same function publishes the hunt, the server draft, `cacce.json` (updated by `registraCaccia()` on the first successful publish of a named hunt) and the messages. GitHub Pages serves the new file within about a minute.

**Messages.** A textarea in the master page and "Pubblica messaggio": the message is appended to `messaggi.json` (`{ id, quando, testo }`), which is global to all hunts. Players see them in ✉️ with an unread badge; the read state is local to each phone.

## Project structure

| File | Role |
|---|---|
| `index.html` | The whole application: player, hunt chooser, master panel, "Collega gli elementi", graph. CSS, HTML and a single `<script type="module">`. |
| `caccia.json` | The default hunt (empty slug), format `caccia-3`. Written by the master from the panel. |
| `caccia-<slug>.json` | One file per named hunt, same format. |
| `lavoro.json`, `lavoro-<slug>.json` | The master's server draft, never read by normal players; reachable with `#b` / `#b-<slug>`. |
| `cacce.json` | Array of slugs of the named hunts (the default hunt is never listed). |
| `messaggi.json` | Array of broadcast messages `{ id, quando, testo }`, shared by all hunts. |
| `img/` | Screenshots used in this README. |
| `tests/scambio.test.mjs` | Playwright test of the QR exchange protocol. |
| `tests/sincronizzazione.test.mjs` | Playwright test of the master's draft synchronisation between phone and computer. |

### Architecture

One HTML file, no framework, no build step, no dependencies to install. `git push` on `main` is the deployment: GitHub Pages serves the repository as is (the repository must stay public; Pages on private repositories is a paid feature).

The JSON files next to `index.html` are a read-only database. Players download them with `fetch(..., { cache: "no-store" })` at every start; the master writes them through the GitHub REST API (Contents endpoint) with a token that lives only in the master phone's `localStorage`. Nothing else writes anywhere: all player state (downloaded hunt, found nodes, loot, read messages, hunt choice) is in the player's `localStorage`, namespaced by hunt slug (`gioco:<slug>`, `stato:<slug>`; the default hunt keeps the bare `gioco` / `stato` keys). The game works offline with the last copy downloaded.

Image recognition is entirely client-side. `index.html` loads **MediaPipe Tasks Vision 1.0.1** (`@mediapipe/tasks-vision` from jsDelivr, `ImageEmbedder`) with the **`mobilenet_v3_small` float32 image-embedder model** from Google's MediaPipe model storage, via a dynamic `import()` only when a camera is first needed (GPU delegate, falling back to CPU). Each frame is cropped to the central square, resized to 256×256 and turned into an L2-normalised embedding; embeddings are stored quantised to 8-bit integers with a scale factor (`pack()` / `unpack()`). A player's shot takes 5 frames in about one second and keeps the best one: the node is valid if that frame's cosine similarity to the object's positives is at least the threshold and higher than its similarity to the negatives. `caccia.json` therefore contains only numeric vectors and one small JPEG thumbnail per node, never the recorded frames. QR reading and generation use `jsqr` 1.4.0 and `qrcode` 1.5.4, also from jsDelivr, loaded lazily when the exchange screen opens.

Routing is by URL hash (`route()`): `#master`, `#master-collega`, `#master-grafo` open the master pages; `#c-<slug>` opens a named hunt directly; `#b` / `#b-<slug>` opens a server draft; no hash opens the chooser (or the remembered hunt).

### Data model

Format `caccia-3`. A hunt is `{ formato, creato, nodi }`; `nodi` is a map from id to node, and every node has the same shape, whatever its role:

- `nome`, `testo` (clue), `messaggio` (unlock message), `immagine` (JPEG data URL), `pos` / `neg` (embeddings), `soglia` (threshold), `luogo` (`{ lat, lon, raggio }`);
- `daValidare`: `true` = the player must photograph it; `false` = a gift, owned automatically as soon as `richiede` is satisfied;
- `conThumb`: the photo is part of the clue while the node is still to be found;
- `richiedePosizione`: GPS within `luogo.raggio` is also required (implies `daValidare`);
- `richiede`: array of node ids, always in AND. A reference to a node that no longer exists counts as "no prerequisite";
- gift modes, only meaningful when `daValidare` is `false`: `scambiabile` (🔄), `duplicabile` (👥), `istanze` (🎟️, implies `duplicabile`);
- `istanzeRichieste`: `{ "<id>": N }` on the requiring node, "at least N different instances" of that prerequisite.

An instanced gift is produced once per phone (`stato.prodotti`) with a random 3-character id (letter-digit-letter, shown in monospace); instances travel in the exchange QR and can be re-shared by anyone who holds one. Since no phone can produce two, a node that requires two different instances can only be completed by meeting another player: this is how the game forces encounters without identities or a database.

The `richiede` graph must be acyclic; this is not guaranteed by construction, so `trovaCiclo()` runs before every publish. Changing `formato` resets every player's progress; publishing a hunt with the same `formato` keeps progress and adds the new nodes.

### Serverless exchange

A gift with 🔄 or 👥 passes between two phones by mutual QR reading with the **front cameras**, with no server. The giver presses the button in Memoria and gets a full-screen exchange view (front camera on top, own QR below, refreshed every 300 ms). The receiver has no dedicated button: in **📷 Foto** the rear camera is already scanning every frame for a QR with the `gc1:` prefix, and when it sees the giver's screen it switches to the exchange view by itself, front camera on. The QR payload is a short colon-separated string (`gc1:` + type, session id, node id, `seq`, `ack`, private id, instance), 44 bytes at most, so the modules stay large and easy to focus.

Two phones agreeing on a transfer over a channel where messages can be lost, with no third party to remember the outcome, is the **Two Generals Problem**: it has no perfect solution, whatever the channel. The protocol therefore chooses which wrong outcome remains possible instead of pretending to remove both. It is deliberately **asymmetric**:

- the **receiver** writes first, as soon as it has read `QR_K` = 3 *increasing* frames from the giver (proof of a live phone, not a printed QR) and has seen `ack ≥ 1` from the giver (optics work both ways). It then shows a persistent green screen with a large 4-letter code and the "done" QR, with no expiry. If it times out (40 s) before writing, nothing was written and it simply fails;
- the **giver** never fails on time. It deletes (`cedi()`, swap only) **only** after reading the "done" QR, or after the player, asked by a yellow prompt ("does your friend's phone show the green screen with code ABCD?"), answers "Sì" having looked at the other screen. When it does delete, the giver's screen turns green too: it is the only one of the two that knows for sure. The prompt appears after 30 s from the tap and 10 s after the receiver reached the threshold, at most after 60 s; automatic reading continues underneath and closes the prompt on success. If the giver never read the friend at all, the friend cannot have written, and the giver fails safely without any prompt.

Outcome: **loss** (deleted on A, never arrived on B) is impossible by construction. The only residual error is **duplication**, and only if the giver answers "No" while the friend is already green. Clocks of the two phones are never compared; freshness comes from local increasing counters. A swapped-away node is added forever to `stato.ceduti`, so the automatic closure of prerequisites cannot silently give it back.

### UI conventions

- Native HTML: `<dialog>` for the lightbox, `<details>` for the GitHub configuration, `<select>` for the hunt menu, `<template>` elements at the end of the page for every data-driven row or card (`tpl-riga`, `tpl-festa`, `tpl-inbox`, `tpl-pubblicato`, `tpl-grafonode`, `tpl-nodo`, `tpl-richiede`), cloned with `clona(id)`. Texts with several variants (exchange titles and status lines, end-of-hunt messages) are all written in the HTML and CSS shows one.
- Visible state is a `data-*` attribute on a container, never a set of `hidden` flags toggled by hand: `body[data-view]` (`player`, `chooser`, `master`, `master-collega`, `master-grafo`), `#view-player[data-tab][data-sub][data-stato]`, `#p-scambio[data-ruolo][data-tipo][data-fase][data-n]`, `.scheda-nodo[data-validare]`. Dark theme, wide layout and full-screen mode are derived by CSS from `data-view`.
- Clicks are declared actions: every clickable element carries `data-azione="name"` (plus `data-tab`, `data-id`, `data-slug`... as needed), the function with that name is registered in the `AZIONI` object next to the code it belongs to, and a single delegated `document.addEventListener("click")` dispatches it. There is no `onclick =` in the file. Text fields and checkboxes keep their own `oninput` / `onchange`.
- No test hooks in the real file: tests copy `index.html` and inject `window.__debug` only in the copy.

## Development and testing

Serve the folder locally and open it in a browser:

```
python3 -m http.server 8765
```

Camera, GPS and recognition cannot be exercised from a terminal. The pattern used so far is Playwright (or an equivalent headless browser): open both the plain page and the `#master` page; for the master, intercept `https://api.github.com/**` with a fake handler that simulates `GET` (current sha) and `PUT`; for the player, write a `caccia.json` and a `messaggi.json` by hand in the served folder; to simulate a recognised object, inject fake embeddings into the master state (`M.pos`, `M.cal`) through a `window.__debug` hook added to a **copy** of `index.html` in a temporary folder, never to the real file.

`tests/scambio.test.mjs` does exactly this for the exchange protocol. It copies `index.html` to a temporary directory, replaces `window.__avviato = true;` with a `window.__debug` block exposing the internal functions, writes a fake hunt (an object to photograph, a swappable/duplicable gift that requires it, a second object producing an instanced seal, and a final gift requiring two different seals), serves everything with `python3 -m http.server` on a free port and drives two Chromium pages as the two phones. QR reading and generation are replaced by stubs and the protocol loop (`scambioTickCorpo`) is stepped by hand. It covers: the happy path; the receiver not writing when the giver never reads it; the manual prompt, its timing and its "Sì" / "No" answers; the prompt closing by itself when automatic reading succeeds; "Annulla"; "duplica"; receiver timeout; a third phone seeing a "done" QR; instance production, sharing, "Ti manca" at end of hunt and QR compatibility with the older 6-field payload. It does **not** test real optical convergence between two cameras: that is only seen with two real phones. `tests/sincronizzazione.test.mjs` does the same for the master side: two devices (phone and computer) passing the working copy to each other through "Salva bozza sul server" and "Pubblica", with a fake GitHub API that really writes the files into the served folder; among local draft, server draft and published hunt the most recent wins, and unsaved local edits are never discarded without a confirmation. Run them with `node tests/<name>.test.mjs` from a directory where `playwright` with Chromium is installed.

The boot banner at the top of the page reads `Avvio del gioco… (versione N)`; `N` is incremented at every published change, and is the quickest way to tell, looking at a phone, whether it is running the latest version or a cached one.

## Known limits and roadmap

- `caccia*.json`, `messaggi.json` and `cacce.json` are public: anyone with the address can read names, clues and GPS coordinates of objects not yet found. Accepted for a group of fewer than 10 friends.
- No player identity: every phone is anonymous to the master and to the other players. Deliberately postponed, not forgotten.
- No database: anything that needs writes from several phones (activity log visible to the master, a shared stock counter) cannot exist on static hosting. Supabase is the likely choice when it comes.
- Scarcity (a limited `scorta` on a shareable gift) is postponed for the same reason: a duplicable gift can be shared an unlimited number of times.
- Messages are global, not per hunt; a published hunt cannot be renamed or deleted from the panel.
- The real optical convergence of the asymmetric exchange protocol still has to be re-tested with two phones after the version 52 rewrite.

Tried and dropped: hosting on the INAF GitLab Pages (invalid https certificate, which also blocks the browser camera, plus access control that locked players out) and Netlify Drop (worked, but inconvenient for repeated publishing without a CLI). Also removed on request: an Instagram share button on the end-of-hunt screen.

## Screenshots

![Hunt chooser](img/giocatore-scelta.png)

The hunt chooser, shown at the first opening without a `#c-<slug>` link.

![Cerca › Traccia](img/giocatore-traccia.png)

🔍 Cerca › 👾 Traccia: the clue plate and the list of everything that can be looked for right now.

![Foto tab](img/giocatore-foto.png)

📷 Foto: the viewfinder and "Scatta e verifica".

![Memoria](img/giocatore-memoria.png)

💽 Memoria: found objects, with 🔄 / 👥 on the gifts that can be passed on.

![Instructions](img/giocatore-istruzioni.png)

The ❓ panel with the in-game instructions.

![Exchange, giver](img/giocatore-scambio.png)

The exchange screen on the giver's phone during the reading phase.

![Exchange, receiver done](img/giocatore-scambio-verde.png)

The receiver's green "done" screen with the code to compare (the giver turns green as well once it has read it).

![Master panel](img/master-pannello.png)

The `#master` panel: hunt menu, recording, elements, messages, GitHub configuration.

![Collega gli elementi](img/master-collega.png)

"Collega gli elementi": node cards with flags, gift mode and "Richiede".

![Graph](img/master-grafo.png)

The graph of `richiede` links, laid out by dependency level.
