# Memoria del progetto — decisioni prese e perché

Questo file è un registro di *decisioni*, non di funzionalità. Serve a non
far riproporre strade già valutate e scartate, e a spiegare il "perché"
dietro scelte che altrimenti sembrerebbero arbitrarie leggendo solo il
codice. Per lo stato tecnico attuale vedi `docs/STATO.md`; per cosa manca
vedi `docs/ROADMAP.md`.

## Il contesto: chi gioca, con che rischio

Meno di 10 giocatori, tutti amici del committente. Non è previsto un rischio
serio di imbrogli deliberati o di attacchi informatici. Questo ha
giustificato scelte più semplici di quanto servirebbe per un gioco pubblico:
niente firme crittografiche, niente prevenzione del "doppio spendere" delle
ricompense, niente sistema anti-frode sul riconoscimento immagini. Se il
progetto dovesse crescere a un pubblico più ampio o meno fidato, queste
scelte vanno riviste, non date per scontate.

## Perché niente server per le immagini

Requisito esplicito fin dall'inizio: "il gioco deve avvenire il più possibile
localmente sui cellulari dei partecipanti, soprattutto per quanto riguarda la
gestione delle immagini". Le foto scattate dai giocatori **non devono mai
lasciare il telefono**. Per questo il riconoscimento non usa un classificatore
allenato lato server, ma un confronto di **embedding calcolati nel browser**
con MediaPipe (modello `mobilenet_v3_small`, caricato da CDN al momento
dell'uso). Il master, quando registra un oggetto, cattura sia foto
dell'oggetto sia foto dei dintorni come negativi: la soglia di riconoscimento
si calibra automaticamente confrontando i due gruppi, invece di essere un
numero fisso indovinato a occhio.

Conseguenza pratica: il file `caccia.json` non contiene mai immagini, solo
vettori numerici compressi (embedding a 8 bit). Da un embedding non si
ricostruisce una foto. Vedi `docs/MODELLO-DATI.md` per il formato esatto.

## Perché nessun database, per ora

Il disegno originale prevedeva Supabase per tracciamento del master, scambi
di ricompense e messaggi. Si è deciso di **rimandarlo** e costruire prima
tutto ciò che un hosting statico può fare da solo, per due motivi: il
committente voleva vedere qualcosa di giocabile subito, e buona parte del
tempo speso finora è già andata via in problemi di infrastruttura (vedi
sotto) più che di funzionalità. La regola pratica concordata: tutto ciò che
scrive *solo* il master può restare su file statici pubblicati su GitHub;
tutto ciò che deve scrivere *anche* un giocatore richiede per forza un
database, perché un hosting statico non accetta scritture concorrenti.

Su questa base sono stati implementati **i messaggi broadcast** (scrive solo
il master, letto tracciato solo in locale sul telefono di ognuno, il master
non sa chi ha letto cosa) mentre sono stati esplicitamente rimandati **log
delle attività dei giocatori** e **scambio di ricompense** (richiedono
entrambi una scrittura dal telefono del giocatore).

## Perché nessuna identità dei giocatori, per ora

Decisione esplicita del committente: "niente identità dei giocatori" nella
fase attuale. Il gioco attualmente non distingue un giocatore dall'altro: lo
stato di progresso, il bottino, e i messaggi letti vivono nel `localStorage`
del singolo telefono, senza nome né account. È una scelta consapevole, non
una dimenticanza: introdurla in modo strisciante (per esempio per far
funzionare un log lato master) romperebbe questo accordo. Quando servirà
davvero — cioè quando si costruirà lo scambio di ricompense fra giocatori,
che richiede sapere "chi è chi" — andrà riaperta la discussione, non decisa
a sorpresa in una sessione di sviluppo.

## Perché GitHub Pages, dopo un percorso lungo

L'hosting è passato da tre soluzioni diverse prima di stabilizzarsi:

1. **GitLab dell'INAF (self-hosted)**, la prima scelta, per comodità: il
   committente aveva già un account lì. Prima ha bloccato l'accesso perché
   il sito Pages richiedeva login; risolto rendendo Pages pubblico nelle
   impostazioni del progetto. Poi si è scoperto che il certificato https di
   quell'istanza per i siti Pages **non è valido**, e questo impedisce alla
   fotocamera del browser di funzionare (richiede https valido). Non è un
   problema risolvibile lato codice: dipende da come gli amministratori
   dell'ente hanno configurato il loro server. Abbandonato per questo
   progetto.
2. **Netlify**, con Netlify Drop, ha funzionato subito e in https valido.
   Il limite: pubblicare richiede o la CLI (`netlify deploy --prod`) o
   collegare un repository esterno che Netlify osserva per il deploy
   automatico. Con GitLab dell'INAF come sorgente, Netlify doveva
   raggiungerlo da internet — un potenziale problema in più con
   un'istanza self-hosted dietro eventuali restrizioni di rete.
3. **GitHub Pages**, la soluzione attuale. Il codice è stato spostato su un
   repository GitHub (`vertighel/gc`), autenticato con un **token di
   accesso personale** (la password normale non è più accettata da GitHub
   per le operazioni git). Pubblica in https valido di default, senza
   configurazione, con un semplice `git push`.

**Attenzione, vincolo importante emerso durante lo sviluppo**: GitHub Pages
sui repository privati richiede un piano a pagamento (GitHub Pro o
superiore). Il committente ha reso il repository privato per nascondere il
contenuto di `caccia.json` (spoiler di indizi e coordinate) e il sito è
sparito con un errore 404. **Il repository deve restare pubblico** finché non
si sceglie un hosting alternativo per questo scopo specifico (per esempio
tornare a Netlify, che pubblica gratuitamente anche da repository privati).
Non riproporre "rendi privato il repository" come soluzione, senza prima
aver risolto il problema dell'hosting.

## Il problema noto e accettato: `caccia.json` è uno spoiler leggibile

Con il repository pubblico, chiunque conosca l'indirizzo del sito può aprire
`https://vertighel.github.io/gc/caccia.json` e leggere in chiaro nome
dell'oggetto, indizio, e — se il master non ha tolto la spunta sulla
posizione — le **coordinate GPS esatte** dell'oggetto non ancora trovato.
È un problema reale, discusso esplicitamente, e **lasciato irrisolto per
scelta**: con meno di 10 amici il rischio che qualcuno vada a spoilerarsi da
solo il gioco leggendo il codice sorgente è stato giudicato basso rispetto al
costo di risolverlo bene (che richiede il database: indizi cifrati, sbloccati
solo al momento giusto). Se il gruppo di giocatori cambia natura, questo va
riconsiderato.

## Perché `caccia-3` unifica indizio/oggetto/ricompensa in un solo tipo di nodo

Discusso a fondo con il committente prima di scriverlo (non una scelta
tecnica unilaterale): indizio, oggetto e ricompensa avevano già oggi la
stessa regola di possesso di base ("appena `richiede` è soddisfatto"),
tranne che per l'oggetto, che in più richiede una validazione reale
(foto/GPS). Da lì l'idea del committente: e se **l'oggetto trovato fosse
esso stesso la ricompensa** (mostrato come thumb nel bottino), e indizio e
ricompensa fossero la stessa cosa? Il modello risultante, `caccia-3`: un
solo tipo di nodo, con tre flag booleani (`daValidare`, `conThumb`,
`richiedePosizione`) al posto del `tipo` fisso. Vedi
`docs/MODELLO-DATI.md` per lo schema.

Decisioni collegate, prese esplicitamente durante la discussione (non
dedotte da sole):

- **`richiedePosizione` implica sempre `daValidare`**: non esiste (e non è
  stato costruito) un flusso "controlla solo la posizione, senza
  fotocamera" — il controllo GPS oggi vive solo dentro lo scatto-e-verifica.
- **Il possesso si festeggia sempre, per tutti**, non solo per le vecchie
  "ricompense": ogni nodo appena posseduto (anche a cascata da un solo
  scatto) genera una schermata di sblocco, con **tutti** i nodi ottenuti
  insieme mostrati nella stessa schermata invece che in coda uno alla
  volta com'era prima.
- **Ogni nodo, senza eccezioni, nasce dalla cattura sul campo** (foto +
  posizione GPS, sempre entrambe, indipendentemente da come verrà poi
  usato): niente più un modo di creare un nodo scrivendo solo testo da un
  computer. Per questo la sezione "Indizi (bozze)" e `bozze.json` sono
  stati eliminati, non solo lasciati com'erano.
- **Nessuna migrazione automatica da `caccia-2`**, per scelta esplicita
  del committente ("non migrare"): pubblicare in `caccia-3` azzera la
  caccia esistente, il master la ricostruisce da zero con il nuovo
  flusso. Coerente con lo status di "prototipo, produzione limitata" (vedi
  `CLAUDE.md`) — non è stato giudicato un costo che valesse la pena di
  scrivere codice di conversione per attraversarlo una volta sola.
- **Un premio "sintetico"** (che prima sarebbe stata una `ricompensa`
  composita, richiesta da più oggetti insieme) nasce comunque dalla stessa
  cattura fotocamera+GPS: il master fotografa qualcosa — l'oggetto fisico
  del premio, un simbolo, non importa cosa — e lo marca `daValidare:
  false`. Non esiste (e non è stato aggiunto) un modo di creare un nodo
  senza passare dalla fotocamera, nemmeno per questo caso.

## Perché "Collega gli elementi" ha anche una vista a grafo

Dopo aver corretto due bug reali nella caccia pubblicata dal committente
(un `testo` orfano perché nessun nodo lo richiedeva, e due flag
`daValidare` scambiate fra "evidenziatore giallo" e "gomma" — vedi le
sessioni precedenti), il committente ha chiesto un modo di vedere i
collegamenti "richiede" come disegno oltre che come checkbox ("che ne dici
di pensare ad un editor svg per collegare questi oggetti? pensalo per la
versione pc"), esplicitamente **in aggiunta** alle checkbox esistenti, non
al loro posto ("lascia anche le checkbox").

Due decisioni di interazione, chieste con `AskUserQuestion` e scelte
entrambe nell'opzione raccomandata:
- **Direzione**: cliccare il pallino del nodo A e poi quello del nodo B
  crea "B richiede A" — il primo clic è il prerequisito, il secondo è chi
  lo richiede. Stessa regola concettuale delle checkbox "Richiede" in
  "Collega gli elementi", solo disegnata.
- **Clic sul corpo di un nodo**: apre un riquadro laterale con i dettagli
  editabili, invece di portare via dalla pagina verso "Collega gli
  elementi".

Il primo disegno era orizzontale (livelli in colonne, da sinistra a destra);
il committente lo ha corretto subito dopo averlo visto: **verticale**, perché
lo sviluppo della "trama" della caccia sarà lungo, e una lista lunga che
cresce verso il basso si scorre normalmente, mentre una che cresce verso
destra finirebbe fuori schermo. Layout attuale: livello di dipendenza = riga
(asse Y, dall'alto in basso), nodi dello stesso livello affiancati sulla
stessa riga (asse X).

Due vincoli tecnici aggiunti in fase di implementazione (non richiesti
esplicitamente, ma coerenti con lo scopo dichiarato della pagina — vedere a
colpo d'occhio errori di collegamento, non nasconderli):
- **Un ciclo blocca il disegno**, non lo disegna storto: prima di calcolare
  i livelli (`livelliNodi()`) si richiama lo stesso `trovaCiclo()` già
  usato prima di pubblicare, e se trova un ciclo mostra un messaggio con i
  nomi coinvolti invece del grafo. Un grafo che "prova comunque a
  disegnarsi" in presenza di un ciclo avrebbe vanificato lo scopo stesso
  della pagina (proprio le checkbox avevano già lasciato passare inosservato
  l'errore delle due flag scambiate).
- **Il riquadro laterale riusa lo stesso codice di `schedaNodo()`**
  (fattorizzato in `costruisciTestata()` e `corpoNodoCampi()`), non una
  copia parallela: stessa lezione del bug `m-cfg2` di una sessione
  precedente, dove due copie della stessa configurazione si erano
  disallineate. Nome, le tre flag (con la stessa implicazione "richiede
  posizione" ⇒ "da validare"), testo, messaggio e "Richiede" sono un solo
  posto di codice, condiviso fra "Collega gli elementi" e il grafo.

## Perché "Con thumb" mostra anche la foto propria, non solo quella del prerequisito

Il modello originale di `caccia-3` (vedi sopra) faceva di `testo`/`conThumb` di
un nodo l'indizio per chi cerca **ciò che lo richiede**, mai per se stesso —
scelta deliberata, coerente con "trovi il cacciavite, il suo testo ti dice
come procedere". Con dati reali, questo ha causato tre incidenti simili in
sessione, sempre sullo stesso fraintendimento (il committente si aspettava
che accendere "Con thumb" su un nodo mostrasse la sua foto a chi lo sta
cercando): un `testo` orfano su un nodo senza prerequisiti, due indizi "evi1"/
"evi2" scritti sul nodo sbagliato, e infine due nodi **fratelli** (stesso
prerequisito, "evidenziatore arancione" ed "evidenziatore giallo") con "Con
thumb" acceso su ciascuno ma senza alcun effetto visibile, perché nessun
terzo nodo li richiedeva singolarmente.

Il terzo caso ha reso evidente un limite strutturale, non solo un errore di
etichette: per due nodi fratelli non esiste **nessun** prerequisito capace di
distinguerli, dato che condividono lo stesso indizio testuale. Serviva un modo
di mostrare la foto di un nodo per aiutare a riconoscere **lui stesso**, non
solo il suo prerequisito.

Soluzione adottata: `immaginiIndizio(nodo)` ora restituisce **sia** la foto
propria del nodo (se il suo `conThumb` e la sua `immagine` ci sono) **sia**
quella di ogni prerequisito con `conThumb` acceso — le due liste si
sommano, non si sostituiscono. La targa in alto (ex `#p-clue-img`, ora
`#p-clue-imgs`, un contenitore invece di un singolo `<img>`) e ogni riga di
"Da trovare" mostrano tutte le foto che si applicano. Compromesso accettato
consapevolmente: mostrare la foto vera dell'oggetto da trovare lo rende più
facile da riconoscere (meno "indovinello", più "eccolo") — ma è il master a
scegliere di accenderlo per un nodo specifico, non un comportamento imposto
di default.

## Perché `testo` è sparito: un solo campo `messaggio`, rivedibile dal bottino

Terzo giro sullo stesso nodo del problema (vedi sopra "Con thumb"): il
committente ha notato che `messaggio` si vedeva una volta sola, alla
schermata di sblocco, e mai più — e che nei suoi dati reali stava già
scrivendo quasi la stessa cosa sia in `testo` sia in `messaggio` (cacciavite:
`messaggio` "hai svitato. ora evidenzialo con due colori diversi", `testo`
"evidenziami con due evidenziatori diversi" — due modi di dire la stessa
cosa, nello stesso momento: "l'hai appena preso, ecco cosa fare ora"). Sua
proposta, adottata: eliminare `testo`, rendere `messaggio` rivedibile in
qualunque momento toccando l'oggetto nel bottino (`apriRicordo()`), e
lasciare che sia lui stesso — non un campo separato — a fare da indizio per
chi richiede quel nodo (`indiziPer()`/`etichettaOggetto()` ora leggono
`messaggio` invece di `testo`).

Perché non ho proposto io questa soluzione prima (avevo suggerito un nuovo
campo `indizioProprio`): il committente ha notato una ridondanza che io non
avevo visto, osservando i propri dati reali — la mia proposta avrebbe
aggiunto un terzo campo, la sua ne toglie uno. Non è la prima volta in questa
sessione che l'uso reale del pannello master smaschera un difetto del
modello dati più in fretta di quanto l'avessi progettato a tavolino: vedi
anche il flag `daValidare` scambiato e il `testo` orfano, sempre più sopra.

**Limite noto, esplicitamente accettato**: due nodi "fratelli" con lo stesso
prerequisito (stesso `richiede`) mostrano comunque lo stesso `messaggio` come
indizio testuale, perché quell'indizio arriva dal prerequisito condiviso, non
da loro stessi — non risolto da questo cambiamento. A distinguerli oggi è
solo la foto propria (vedi sopra), che già si somma correttamente. Se in
futuro servirà un indizio testuale diverso per ciascuno, sarà un'aggiunta a
parte, non ancora richiesta.

**Dati esistenti**: i 6 nodi già pubblicati avevano sia `testo` sia
`messaggio` scritti. Il campo `testo` è stato assorbito in `messaggio` con
una regola meccanica (se `messaggio` era vuoto, diventa `testo`; se
`testo` era pieno e diverso da `messaggio`, viene accodato su un paragrafo
nuovo; altrimenti `messaggio` resta invariato) e il file `caccia.json` è
stato aggiornato e pubblicato direttamente via commit, non dal pannello
master — coerente con quanto già previsto in `CLAUDE.md` ("sono comunque
file veri nel repository: se li modifichi a mano e fai push, funziona lo
stesso").

## Perché il pulsante Instagram è stato tolto

È stato implementato su richiesta esplicita ("aggiungi un link per pubblicare
su instagram taggando @genova_cyberpunk"), con un testo pre-compilato copiato
negli appunti più un tentativo di apertura del menu di condivisione nativo
(Instagram non offre un modo per un sito web di compilare davvero un post).
Il committente lo ha giudicato "non mi piace" e ha chiesto il ripristino
immediato, senza ulteriori dettagli sul motivo. **Non riproporlo** in una
forma simile senza che sia il committente a richiederlo di nuovo — se serve
di nuovo condivisione social, chiedere prima che forma preferisce.
