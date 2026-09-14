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

## Perché il pulsante Instagram è stato tolto

È stato implementato su richiesta esplicita ("aggiungi un link per pubblicare
su instagram taggando @genova_cyberpunk"), con un testo pre-compilato copiato
negli appunti più un tentativo di apertura del menu di condivisione nativo
(Instagram non offre un modo per un sito web di compilare davvero un post).
Il committente lo ha giudicato "non mi piace" e ha chiesto il ripristino
immediato, senza ulteriori dettagli sul motivo. **Non riproporlo** in una
forma simile senza che sia il committente a richiederlo di nuovo — se serve
di nuovo condivisione social, chiedere prima che forma preferisce.
