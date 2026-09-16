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

## Perché `testo` è tornato, ma con significato opposto a com'era in origine

Il "limite noto" appena sopra (nessun modo di dare un indizio distinto a due
nodi fratelli) non è rimasto teorico per molto: la sera stessa, il
committente ha guardato di nuovo i suoi due evidenziatori e ha chiesto di
reintrodurre `testo`, ma **auto-riferito**, non più come indizio "per chi mi
richiede": `testo` di "evidenziatore arancione" = "sono arancione, usami",
`testo` di "evidenziatore giallo" = "sono giallo, usami" — un indizio su se
stesso, per aiutare a riconoscerlo mentre lo si cerca, non un messaggio per
il passo successivo.

Questa non è una semplice reintroduzione: è un capovolgimento del significato
originale di `testo` (che nella primissima versione di `caccia-3` era letto
dal nodo che lo richiedeva, mai dal nodo stesso — vedi la voce più sopra
"Perché `caccia-3` unifica..."). Il modello attuale, dopo due correzioni
nella stessa serata:
- **`testo`+`conThumb`/`immagine`**: indizio PRIMA del possesso, sempre e
  solo auto-riferito (mostrato mentre SI CERCA quel nodo, letto da
  `etichettaOggetto()`/`immaginiIndizio()` senza più alcun attraversamento di
  `richiede`).
- **`messaggio`**: cosa succede DOPO, sempre e solo auto-riferito (schermata
  di sblocco una volta, poi rivedibile nel bottino — invariato dalla voce
  precedente).
- **`richiede`**: decide SOLO quando un nodo compare in "Da trovare"
  (raggiungibilità). Non trasporta più alcun contenuto da un nodo all'altro
  — la funzione `indiziPer()` (il cuore del vecchio meccanismo a
  attraversamento) è stata rimossa, non solo ridefinita.

Perché ha funzionato meglio di entrambi i miei tentativi precedenti (il
campo `indizioProprio` in aggiunta, poi l'unificazione in un solo
`messaggio` cross-referenziato): rende ogni nodo un'unità autosufficiente,
prima e dopo il possesso, eliminando alla radice la distinzione fra "questo
nodo" e "chi lo richiede/chi richiede lui" che aveva causato tre bug diversi
nella stessa sessione (`testo` orfano, indizio scritto sul nodo sbagliato,
fratelli indistinguibili). Il prezzo è che ogni nodo "da trovare" ora ha
bisogno del proprio `testo` per avere un indizio: nodi come "cacciavite" o
"Scotch", che prima ricevevano il loro indizio per attraversamento da un
prerequisito (es. "Inizio" → "Svita cose" per cacciavite), oggi non hanno
più nulla scritto nel proprio `testo` e mostrano il fallback generico "Trova
questo oggetto" finché il master non gliene scrive uno — **non risolto
automaticamente**: spostare "Svita cose" da "Inizio" a `cacciavite.testo`
avrebbe richiesto una scelta editoriale (è un indizio per riconoscere il
cacciavite, o un'istruzione per il passo dopo?) che non mi competeva
prendere da solo sui dati già pubblicati del committente.

## Perché il salvataggio della copia di lavoro è diventato un problema vero

Il master registrava oggetti sul campo tenendo `L.nodi` (la copia di lavoro:
oggetti registrati, collegamenti, testi) **solo in una variabile JavaScript
in memoria** — un reload accidentale della pagina, o una schermata andata in
background troppo a lungo, cancellava tutto senza preavviso.

Soluzione a due livelli, non uno solo, perché risolvono problemi diversi:
- **Autosalvataggio locale** (`salvaLocale()`/`caricaBozzaLocale()`, chiave
  `m-lavoro` in `localStorage`): scritto a ogni modifica di `L.nodi`, letto
  all'apertura del pannello master. Protegge dal reload sullo stesso
  telefono, gratis, senza rete.
- **"Salva bozza sul server"** (bottone dedicato, scrive `lavoro.json` o
  `lavoro-<slug>.json`): protegge da un cambio di telefono, o da una pulizia
  dei dati del browser. Usa lo stesso meccanismo di scrittura
  (`ghPutFile`) già usato per `caccia.json`/`messaggi.json`.

**Decisivo**: `lavoro*.json` non è mai referenziato dal codice giocatore
(nessun `fetch` lo cerca) — è per costruzione invisibile ai giocatori, non
serve nasconderlo o proteggerlo apposta. Questo è anche ciò che tiene
disaccoppiati "salvare il lavoro" e "pubblicarlo": il primo scrive
`lavoro*.json` quante volte si vuole, il secondo (bottone "Pubblica la
caccia", invariato) resta l'unico atto che scrive `caccia*.json` e lo rende
visibile ai giocatori.

**Bug trovato e corretto durante il test**: quando il pannello master offre
un menu per passare da una caccia all'altra (vedi sezione successiva),
cambiare caccia senza aver salvato lasciava l'autosalvataggio locale della
caccia appena abbandonata intatto — tornandoci sopra, le modifiche "scartate"
al conferma ricomparivano, smentendo l'avviso mostrato. Corretto riallineando
subito l'autosalvataggio locale alla caccia appena caricata
(`caricaCopiaLavoro()` chiama `salvaLocale()` non appena determina cosa
mostrare, prima di qualunque interazione dell'utente).

## Perché più cacce sono file diversi, non righe di un database

Committente: "il master crea un nuovo gioco, o edita uno esistente [...] il
giocatore sceglie da una lista uno dei giochi". Senza un database (vedi
sopra "Perché nessun database, per ora" — vincolo ancora valido), l'unico
modo onesto di avere più cacce è **un file per caccia**: `caccia.json` per
quella di sempre (slug vuoto, retrocompatibile con i link già condivisi),
`caccia-<slug>.json` per le altre. Lo slug è derivato dal nome scelto dal
master (`slugify()`), e nella versione finale **coincide con il nome**: non
esistono più un "nome" leggibile e uno "slug" tecnico separati, per
eliminare in radice la fonte del bug sotto.

`cacce.json` è l'elenco delle cacce con nome (scritto da `registraCaccia()`
alla prima pubblicazione riuscita di ciascuna) — la caccia di sempre non ci
compare mai, è sempre la prima voce implicita ovunque questo elenco si
mostri (menu del master, schermata di scelta del giocatore).

**"caccia" è un nome riservato**, e non per caso: il committente ha aggiunto
lui stesso la stringa `"caccia"` a mano dentro `cacce.json`, "per coerenza",
pensando che la caccia di sempre dovesse comparire esplicitamente nella
lista — risultato, due voci "caccia" nella schermata di scelta (una
implicita, una dal file). Corretto in due modi, non uno solo: (a)
`leggiElencoCacce()` filtra `"caccia"` se lo trova nel file, restando
robusto anche a un'altra modifica a mano futura; (b) creare una caccia
chiamata "Caccia" viene ora rifiutato esplicitamente con un messaggio,
invece di produrre di nuovo lo stesso doppione silenzioso. La lezione più
generale: **la lettura di `cacce.json` viveva copiata in tre punti diversi**
(menu master, registrazione nuova caccia, schermata del giocatore), ciascuno
con la propria idea di "aggiungi 'caccia' in testa" — unificata in una sola
funzione (`leggiElencoCacce()`) usata da tutti e tre.

Effetto collaterale positivo: la stessa `leggiElencoCacce()` che alimenta il
menu del master è pronta per alimentare, in futuro, una schermata di scelta
più ricca — non è stato scritto apposta per quello, ma la scelta di
un'unica fonte di verità lo rende immediato.

## Perché esiste una schermata di scelta della caccia per il giocatore

Conseguenza diretta del punto sopra: se esistono più cacce, il giocatore
deve poterne scegliere una. Per ora **niente selettore in-app persistente**
per i link diretti: `#c-<slug>` continua ad aprire dritto quella caccia
(pensato per condividere link diversi a gruppi diversi). Solo il link di
sempre, **senza hash**, mostra la schermata di scelta — e solo se il
telefono non ricorda già una preferenza (chiave `caccia-scelta`).

**Continuità esplicitamente protetta**: chi aveva già una partita in corso
sulla caccia di sempre (localStorage con chiave `gioco` già popolata) non
vede la schermata la prima volta che apre questa versione — verrebbe
altrimenti sorpreso da una schermata mai vista prima, per un giocatore che
sta già giocando. La scelta si aggiorna da sola (`initPlayer()` la scrive a
ogni apertura, non solo quando la si sceglie dalla lista), così anche
arrivare da un link diretto `#c-<slug>` la aggiorna coerentemente.

**Bug trovato e corretto**: un link `#c-` senza nessuno slug dopo il
trattino (rotto, o digitato a mano incompleto) veniva trattato come link
diretto valido perché il controllo guardava solo il prefisso dell'indirizzo,
non se dopo ci fosse davvero qualcosa — risultato, caricava silenziosamente
`caccia.json` (lo slug vuoto). `route()` ora controlla anche che
`activeSlug()` non sia vuoto prima di considerare l'indirizzo un link
diretto valido; altrimenti mostra la lista.

## Perché il giocatore è diventato un'app a schermo intero

Committente, descrivendo il flusso completo (master crea/edita → registra
sul campo → collega con calma → pubblica → giocatore sceglie dalla lista →
messaggi broadcast nel mezzo): "la UI dovrebbe essere il più possibile come
se fosse schermo intero (come se fosse una app, anche se è una pagina web)
[...] il giocatore dovrebbe avere una sezione oggetti e una foto". Confermato
che il flusso già costruito (vedi sezioni sopra) corrispondeva esattamente a
questa descrizione — la parte nuova era solo il livello visivo.

Architettura scelta, dopo uno schema confermato passo per passo col
committente (non assunta a priori): **due schede fisse in basso**, "Cerca" e
"Oggetti" (mai "Caccia"/"Bottino" come proposto inizialmente — nome
scelto dal committente). Dentro "Cerca", **quattro sotto-schede sempre
mutuamente esclusive**: Indizio, Foto, poi ✉️ Messaggi e ⚙️ Impostazioni,
spostati lì dall'angolo in alto e dalla scheda Oggetti rispettivamente,
esplicitamente per essere allo stesso livello di Indizio/Foto, non pannelli
"aperti sopra" come nella prima versione (bug corretto: restavano visibili
insieme al resto finché non venivano chiusi a mano).

**Indizio, dopo due giri di correzione sullo stesso schermo**:
1. Prima versione: targa grande per l'oggetto scelto + lista delle sole
   ALTERNATIVE sotto (escludendo quello scelto). Sceglierne una saltava
   subito a "Foto".
2. Il committente ha chiesto la lista **completa** (tutti gli oggetti
   raggiungibili, non solo le alternative), con quello scelto evidenziato
   in blu invece che con un bordo — e restare su "Indizio" dopo aver
   scelto, non saltare più a "Foto" in automatico.
3. Poi, "ovviamente" (parola del committente): la targa grande doveva
   restare per l'oggetto scelto, sopra la lista completa. Risultato finale:
   **entrambe le cose insieme** — targa in alto per l'attuale, lista intera
   sotto con l'attuale evidenziato anche lì (leggera ridondanza accettata
   consapevolmente, non vista come problema). La lezione: quando il
   committente corregge una mia semplificazione con "ovviamente", di solito
   vuol dire che avevo tolto qualcosa senza che me lo avesse chiesto, non
   che il resto della richiesta precedente fosse sbagliato — vanno sommate,
   non scelte l'una o l'altra.

**Bug "fotocamera incantata" (Foto → Indizio → Foto), due cause reali,
trovate solo testando con una fotocamera finta a livello di browser
(`--use-fake-device-for-media-stream`), non solo ispezionando il codice**:
- `stopCamera()` fermava lo stream ma non scollegava `video.srcObject`:
  restava un fotogramma congelato agganciato all'elemento video.
- Il bottone "Attiva la fotocamera" veniva disabilitato all'inizio di
  `cameraButton()` e **riabilitato solo sul percorso di errore** — sul
  successo restava disabilitato per sempre, invisibile finché il bottone
  restava nascosto, ma bloccato non appena si tornava a mostrarlo. Corretto
  in `mostraSubTab()`: ogni volta che si rientra in "Foto" senza uno stream
  attivo, il bottone si riabilita esplicitamente.

**Bug "non si può ricominciare a caccia finita"**: la riga delle quattro
schede viveva dentro lo stesso contenitore che spariva quando non c'era
niente da cercare (`daTrovare()` vuoto o nessuna caccia pubblicata) — da
"Hai trovato tutto" non si arrivava più a "Impostazioni" per ricominciare.
Corretto spostando la riga delle quattro schede fuori da quel contenitore:
resta sempre raggiungibile, indipendentemente dallo stato della caccia.

**Comportamento deciso esplicitamente**: dopo aver trovato un oggetto, si
riparte sempre da "Indizio", non si resta su "Foto" (dove inevitabilmente ci
si trova subito dopo aver scattato). `showReward()` reimposta la
sotto-scheda attiva prima di mostrare la schermata di sblocco.

La targa smaltata (`.plate`/`.screw`) era rimasta temporaneamente senza
alcun uso durante il punto 2 sopra — **non cancellata dal CSS** nonostante
fosse morta in quel momento, perché `CLAUDE.md` la indica esplicitamente
come elemento da conservare per schermate future. Si è rivelata la scelta
giusta: è tornata in uso al punto 3, invariata.

## Il bug del riferimento "richiede" rotto: due funzioni che dovevano
## comportarsi allo stesso modo e non lo facevano

Trovato mentre si testava la schermata di scelta appena costruita: scegliere
la caccia di sempre mostrava "0 su 4" insieme a "Hai trovato tutto" —
contraddittorio, e riproducibile anche dopo "Ricomincia". Causa: il commit
"tolto inizio" (sera precedente) aveva rimosso un nodo modificando
`caccia.json` **a mano**, fuori dall'app — l'unico modo in cui può succedere,
perché l'editor del master impedisce di rimuovere un nodo ancora richiesto
da un altro. Il nodo rimosso era però ancora referenziato nel `richiede` di
un altro nodo, lasciando un id orfano.

`trovaCiclo()` (controllo pre-pubblicazione) ignora silenziosamente un
riferimento a un id inesistente (`if (!nodi[r]) continue`) — trattandolo
come "nessun prerequisito". Ma `chiudi()`/`daTrovare()` (cosa il giocatore
può cercare) lo trattavano come un prerequisito **mai soddisfacibile**,
bloccando per sempre tutto ciò che dipendeva da quel nodo, a cascata.
Nessuno dei due comportamenti è stato scelto a tavolino: sono cresciuti
indipendentemente, in momenti diversi, senza che nessuno notasse la
contraddizione — il controllo pre-pubblicazione dava quindi una falsa
sicurezza, perché non usava la stessa regola del gioco vero.

Corretto rendendo la tolleranza a un riferimento mancante **esplicita e
condivisa** (`richiedeSoddisfatto()`, una funzione sola usata sia da
`chiudi()`/`daTrovare()` sia concettualmente coerente con `trovaCiclo()`):
un `richiede` verso un id che non esiste più non blocca mai nulla, ovunque
nel codice. Scelta deliberata di non "ripulire" invece il dato pubblicato
(rimuovere il riferimento orfano da `caccia.json`): la correzione lato
codice basta a rendere il gioco di nuovo giocabile, senza bisogno di
ripubblicare nulla, ed è più robusta per definizione contro il prossimo
edit manuale che lascerà lo stesso tipo di orfano.

## Nota a parte: il sito è stato giù per una notte per un rename manuale

Scoperto all'inizio di questa sessione, non correlato a nessuna richiesta:
i commit "rename" della sera precedente avevano rinominato `caccia.json` in
`caccia-3.json` (probabilmente per farlo combaciare col campo `formato`),
ma il codice cerca ancora `caccia.json` — 404 per ogni giocatore, dalle
18:38 in poi. Rinominato indietro senza perdita di dati (i 5 oggetti reali
erano intatti in `caccia-3.json`). Nessuna relazione col formato/schema:
`formato` (versione della struttura dati) e il nome del file sono e restano
concetti indipendenti — la coincidenza dei nomi ("caccia-3" sia come valore
di `formato` sia come nome file scelto quella sera) è ciò che ha reso
l'incidente comprensibile, non voluto.

## Perché il pulsante Instagram è stato tolto

È stato implementato su richiesta esplicita ("aggiungi un link per pubblicare
su instagram taggando @genova_cyberpunk"), con un testo pre-compilato copiato
negli appunti più un tentativo di apertura del menu di condivisione nativo
(Instagram non offre un modo per un sito web di compilare davvero un post).
Il committente lo ha giudicato "non mi piace" e ha chiesto il ripristino
immediato, senza ulteriori dettagli sul motivo. **Non riproporlo** in una
forma simile senza che sia il committente a richiederlo di nuovo — se serve
di nuovo condivisione social, chiedere prima che forma preferisce.

## Link di prova della bozza ("#b"/"#b-<slug>"), separato da "Prova su questo telefono"

Il committente lavora così: scatta gli oggetti dal telefono, li salva come
bozza sul server, poi passa al **computer** per "Collega gli elementi"
(pensata per schermi larghi), e infine torna al telefono per provare il
risultato **in incognito** (per vedere davvero cosa scaricherebbe un
giocatore, non lo stato residuo del proprio browser).

Il pannello master, aprendo una caccia da un browser "vuoto" (il computer),
già leggeva `lavoro*.json` dal server come bozza di riserva
(`caricaCopiaLavoro()`, righe ~1043 e seguenti) — quel pezzo funzionava
prima ancora di questa sessione. Mancava solo il lato giocatore: prima
d'ora l'unico modo di vedere la caccia come un vero giocatore era
"Pubblica" (rendendola visibile a tutti) o "Prova su questo telefono"
(`localStorage`, **non funziona in incognito**: una finestra incognito ha
uno storage isolato da quella normale, quindi non trova nulla da leggere).

Aggiunto un link `#b` (caccia di sempre) / `#b-<slug>` che fa scaricare al
giocatore `draftFile(slug)` invece di `gameFile(slug)` (vedi `inBozza()` in
`index.html`): un fetch vero, funziona da qualunque browser o telefono,
incognito compreso, senza pubblicare nulla. Decisioni prese:

- **Chiavi di stato separate** (`gioco-bozza:<slug>`/`stato-bozza:<slug>`):
  se il master apre il link sullo stesso telefono invece che in incognito,
  non deve mescolare i progressi di prova con quelli veri.
- **Non sovrascrive `caccia-scelta`**: aprire un link di prova è una
  sessione temporanea, non "il giocatore ha scelto questa caccia".
- **"Prova su questo telefono" resta**, non sostituito: è istantaneo (nessun
  salvataggio richiesto, nessuna rete) per iterare in fretta sullo stesso
  telefono; il link di prova serve per il caso — diverso — di un altro
  dispositivo o di incognito.
- **Il banner giallo "stai provando..."** è condiviso fra le due modalità
  (`inProva() || inBozza()` in `renderPlayer()`): stesso avviso, stesso
  concetto ("non è la caccia pubblicata").

## Il campo "Formato" del pannello master era vestigiale, e rotto se usato

Il testo libero "Formato" in "Collega gli elementi" era un residuo di
quando `formato` era davvero migrabile a mano (`caccia-1`→`caccia-2`,
pulsante "Passa al formato con collegamenti", vedi
`docs/MODELLO-DATI.md`). Oggi il codice fissa i controlli di compatibilità
al valore letterale della costante `FORMATO` ("caccia-3"): editare quel
campo a un valore diverso rompeva silenziosamente la lettura della propria
stessa bozza/pubblicazione al giro successivo (`caricaCopiaLavoro()`
confrontava `b.formato === FORMATO`, non un valore scelto dal master).
Rimosso dall'interfaccia; il valore resta scritto internamente, sempre
uguale a `FORMATO`, mai più modificabile a mano.

## Bug: un "regalo" (nodo daValidare:false, richiede:[]) non compariva mai in Memoria

Scoperto guardando `caccia-strada.json`: il nodo "rifiuto-quantistico"
(pensato come regalo iniziale, zero prerequisiti) non risultava mai nel
bottino di nessun giocatore. Causa: `chiudi()` chiude SEMPRE, a ogni
chiamata, tutti i nodi `daValidare:false` con `richiede` già soddisfatto —
quindi un regalo a zero prerequisiti risultava "già dentro" fin dal primo
calcolo, prima ancora che il giocatore facesse qualcosa. Il confronto che
decideva cosa fosse "nuovo" (`verifica()`/`shoot()`, dentro `index.html`)
ricalcolava `chiudi()` anche per la base "prima", quindi il regalo non
risultava MAI nuovo, per tutta la partita.

Corretto centralizzando la chiusura in `chiudiEAggiorna(st, extra)`: la
base del confronto è sempre `st.trovati` grezzo (mai un `chiudi()`
ricalcolato). Chiamata sia dopo una foto vera (`verifica()`, con l'id
appena validato in `extra`) sia al caricamento/sincronizzazione della
caccia (`initPlayer()`, `syncGame()`), così un regalo compare — festeggiato
con la stessa schermata di sblocco di qualunque altro ritrovamento, per
scelta esplicita del committente — anche prima di aver mai fatto una foto,
e anche se il master lo aggiunge dopo a una caccia già in corso. Dato che
la schermata di festa vive dentro la scheda "Cerca" (`#p-reward` è
figlio di `#tab-cerca`), scoprirlo mentre si è su "Memoria" richiede di
passare a "Cerca" prima di mostrarla (`mostraTab("cerca")` prima di
`showReward()`): altrimenti la festa restava "accesa" ma invisibile,
nascosta dietro la scheda sbagliata — bug notato e corretto in questa
stessa sessione, prima di consegnare.

## L'app parte dalla scheda "Memoria", non più da "Cerca"

Richiesto esplicitamente: prima l'app apriva sempre su "Cerca", ora apre
su "Memoria" (`mostraTab("oggetti")` in `initPlayer()`). Il testo per chi
non ha ancora nulla in Memoria (`#p-mem-empty`) è lasciato al committente
da scrivere, per suggerire di passare a "Cerca".

## Bug: "Cambia caccia" serviva due tocchi, il primo rispediva alla caccia di sempre

Segnalato dal committente su una caccia con nome (es. "strada"): il primo
tocco su "⚙️ Impostazioni" → "Cambia caccia" non mostrava la schermata di
scelta ma rientrava dritto in `caccia.json` (la caccia di sempre); solo il
secondo tocco funzionava.

Causa: `avvioGiocatore()` contiene una regola di continuità pensata per un
caso preciso — chi giocava già la caccia di sempre PRIMA che esistesse la
schermata di scelta (quindi ha la chiave `gioco` ma mai una scelta salvata
in `caccia-scelta`) non deve vedersela comparire di sorpresa, ed entra
diretto. Ma la condizione era `store.get(CHOOSER_KEY) === null`, vera anche
subito dopo un "Cambia caccia" esplicito (che cancella `caccia-scelta` con
`store.del()`): chiunque avesse mai avuto una partita sulla caccia di
sempre (chiave `gioco` presente, capita spesso testando) veniva rispedito
lì invece che alla schermata di scelta. Il secondo tocco "funzionava" solo
per un dettaglio implementativo: con l'hash già vuoto dal primo tentativo,
il gestore del pulsante saltava del tutto `avvioGiocatore()` e chiamava
`mostraSceltaCaccia()` direttamente.

Corretto in due parti: (1) un marcatore separato, `CONTINUITA_KEY`
(`caccia-scelta-continuita-vista`), impostato la prima volta che
`avvioGiocatore()` gira E messo a `true` esplicitamente dentro il gestore
di "Cambia caccia" — così la regola di continuità non scatta mai più una
volta che il giocatore ha interagito almeno una volta col sistema di
scelta della caccia, comunque sia successo; (2) il gestore di "Cambia
caccia" non passa più da `location.hash = ""` (che fa scattare
`hashchange` → `route()` in modo asincrono, una finestra in cui poteva
ancora inserirsi la vecchia regola) ma usa `history.replaceState()` — che
non spara eventi — e chiama `mostraSceltaCaccia()` direttamente, subito.
