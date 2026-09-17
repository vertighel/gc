# Modello dati attuale

Oggi tutto vive in file JSON pubblici, scritti solo dal master, e nel
`localStorage` di ogni telefono (mai condiviso). Questo documento descrive
tutti i file, e a fondo pagina indica come si tradurrebbero in tabelle quando
arriverà un database vero — non per farlo subito, ma perché conviene tenere
la forma dei dati già compatibile con quella futura.

`caccia.json` è oggi nel formato `caccia-3` (nodi **unificati**: non esiste
più una distinzione di `tipo` fra indizio/oggetto/ricompensa, vedi sotto).
I formati precedenti (`caccia-1`, missioni a tappa singola; `caccia-2`,
nodi ancora divisi per tipo) restano descritti più sotto solo come
**archivio storico**, per chi legge vecchi commit o vecchie copie di
`caccia.json`: il codice attuale non li legge più, e **non esiste
migrazione automatica** fra un formato e l'altro (decisione esplicita).
Ogni cambio di `formato` — incluso passare a `caccia-3` — azzera i
progressi di tutti i giocatori, come sempre.

**`caccia.json` non è più l'unico file di questo tipo**: da quando il
master può pubblicare più cacce (vedi `docs/STATO.md`), `caccia.json` è
solo quella con "slug" vuoto (la caccia di sempre); le altre sono
`caccia-<slug>.json`, stesso schema `caccia-3` descritto qui, un file per
caccia. `formato` (dentro il file) e lo slug (nel nome del file) sono
indipendenti: il primo è la versione dello schema, il secondo l'identità
della caccia — vedi `memory.md` (i due non vanno mai fatti coincidere per
convenzione informale). Vedi più sotto anche `cacce.json`
e `lavoro*.json`, i due file nuovi legati a questa funzionalità.

## `caccia.json`, formato `caccia-3` (attuale)

Un solo tipo di nodo, non più tre. Indizio, oggetto e ricompensa sono la
**stessa cosa**: ogni nodo nasce dallo stesso rito di cattura sul campo
(fotocamera + posizione GPS, sempre entrambi, mai in modo condizionale) e
si comporta in un modo o nell'altro solo in base a tre flag booleani
espliciti, non più in base a un `tipo` fisso.

```jsonc
{
  "formato": "caccia-3",
  "creato": "2026-09-14T…",
  "nodi": {
    "n1": {
      "nome": "Oggetto-1",              // editabile dal master, default "Oggetto-N" alla cattura
      "testo": "Cerca qualcosa che segna il tempo",  // indizio mostrato mentre QUESTO
                                         // nodo è ancora da trovare — sempre auto-riferito,
                                         // mai su un prerequisito o un dipendente — facoltativo
      "messaggio": "Hai fermato le lancette. Ora cerca qualcosa che chiuda un cerchio.",
                                         // testo mostrato alla PROPRIA schermata di sblocco
                                         // (una volta) e poi sempre rivedibile toccando
                                         // l'oggetto nel bottino — facoltativo
      "immagine": "data:image/jpeg;base64,…",  // sempre presente: scattata in automatico
                                         // durante la registrazione, non è un embedding
      "pos": [ /* ~20 embedding, formato invariato dalle versioni precedenti */ ],
      "neg": [ /* ~10 embedding, formato invariato */ ],
      "soglia": 0.8123,
      "luogo": { "lat": 44.4056, "lon": 8.9463, "raggio": 100 },  // sempre presente
                                         // (posizione del master al momento dello scatto)
      "daValidare": true,   // true = serve foto+match per essere posseduto;
                             // false = posseduto in automatico appena "richiede" è soddisfatto
      "conThumb": true,     // true = la foto fa da indizio *mentre* questo nodo è
                             // ancora da trovare — auto-riferita come "testo"; non
                             // c'entra col possesso — vedi sotto
      "richiedePosizione": false,  // true = in aggiunta al match fotografico, il giocatore deve
                                    // essere entro `luogo.raggio` — IMPLICA daValidare: true
      "richiede": [],       // AND verso altri id di nodi, come nei formati precedenti
      "scambiabile": false, // facoltativi, solo se daValidare è false (regali): 🔄 il
      "duplicabile": false, // cedente lo perde / 👥 il cedente lo tiene — vedi docs/STATO.md
      "istanze": false,     // facoltativo, solo su un regalo: "a istanze" — ogni telefono che
                             // ne soddisfa i richiede ne PRODUCE una istanza propria (id casuale
                             // lettera-cifra-lettera), una sola volta; le istanze si condividono.
                             // Implica duplicabile: true e scambiabile: false. Vedi sotto.
      "istanzeRichieste": { "<idNodo>": 2 }  // facoltativo, sul nodo che richiede: "almeno N
                             // istanze DIVERSE" di quel prerequisito (assente = 1); ignorato se
                             // il prerequisito non è a istanze. `richiede` resta la lista di id.
    }
  }
}
```

### Nodi a istanze (`istanze: true`)

Un regalo normale è **uno**: o lo possiedi o no. Un regalo a istanze è un
"sigillo" di cui ogni giocatore produce la **propria** copia, distinta da
quelle degli altri per un id casuale a tre caratteri (`"K7X"`: lettera,
cifra, lettera — 6760 combinazioni, mostrato sempre in monospaziato). Le
regole, tutte in `chiudiEAggiorna()`/`prerequisitiSoddisfatti()`:

- **Produzione**: quando i `richiede` del nodo sono soddisfatti, il
  telefono genera la sua istanza e la segna in `stato.prodotti` — **una
  sola volta per nodo**, anche se nel frattempo ha ricevuto istanze di
  altri (chi prima riceve una copia e poi trova l'oggetto produce comunque
  la sua).
- **Condivisione**: l'istanza viaggia nel QR dello scambio (settimo
  campo) e chi la riceve la tiene accanto alle proprie; rifiuta solo la
  *stessa* istanza. **Chiunque** la abbia può ricondividerla (copie di
  copie): "3 istanze diverse" significa "esistono 3 produttori", non "hai
  incontrato 3 persone".
- **Requisito**: un nodo con `istanzeRichieste: { G: 2 }` si chiude solo
  con ≥ 2 istanze **distinte** di G in mano. Se non c'è più nulla da
  fotografare ma manca questo, la fine caccia dice "Ti manca: G ×1" invece
  di "Hai trovato tutto".
- **Niente identità**: nessuno sa *di chi* è `K7X`; il giocatore vede
  "★ tua" solo sulle proprie. Collisioni casuali fra due produttori (~0,7 %
  con 10 produttori) fanno contare una istanza in meno, nulla di peggio.
  Il reset ("Ricomincia la caccia") azzera `prodotti`: limite accettato.

È il modo di rendere **obbligatorio l'incontro** fra giocatori senza
database né identità: nessuno può produrre due istanze, quindi la seconda
deve arrivare da un altro telefono. Vedi `memory.md`.

Regole:

- **Ogni nodo nasce dalla cattura sul campo** (fotocamera + GPS): non
  esiste più un modo di creare un nodo scrivendo solo testo da un
  computer (la vecchia sezione "Indizi (bozze)"/`bozze.json` è stata
  eliminata insieme a `caccia-2`, vedi `memory.md`). Anche un premio
  "sintetico" che richiede più altri nodi insieme (l'equivalente di una
  vecchia `ricompensa` composita) nasce così: il master fotografa
  *qualcosa* — l'oggetto fisico del premio, un simbolo, qualunque cosa —
  e poi imposta `daValidare: false` così diventa posseduto in automatico
  quando i suoi `richiede` sono soddisfatti, invece che dopo uno scatto
  del giocatore.
- **`richiedePosizione: true` implica sempre `daValidare: true`**: non ha
  senso richiedere una posizione senza passare comunque dalla verifica
  fotografica, perché oggi il controllo GPS avviene solo *dentro* il
  flusso "Scatta e verifica" — non esiste (e non è stato costruito) un
  flusso separato "controlla solo la posizione, senza fotocamera". Il
  pannello del master impedisce di spuntare l'una senza l'altra.
- **"Posseduto" non dipende più dal tipo, ma da `daValidare`**: con
  `daValidare: true` serve la validazione reale del giocatore (foto, più
  GPS se `richiedePosizione`); con `daValidare: false` il nodo diventa
  posseduto da solo, appena tutti i suoi `richiede` lo sono.
- **Il possesso si festeggia sempre**, per ogni nodo, validato o
  automatico: appena un nodo passa da non-posseduto a posseduto (anche a
  cascata, per effetto di un solo scatto), il giocatore vede una
  schermata di sblocco cumulativa con **tutti** i nodi appena ottenuti
  insieme in quel momento (non più uno alla volta in coda) e ognuno entra
  nel bottino. **Una volta posseduto, un nodo mostra sempre la sua foto
  vera** se ce l'ha (altrimenti un colore calcolato in automatico dal
  `nome`, funzione `coloreNodo()`, hash del nome → tinta HSL → RGB —
  nessun campo "Simbolo" da scegliere a mano, eliminato con `caccia-2`):
  `conThumb` qui non conta, vedi il punto seguente.
- **`testo`/`conThumb`+`immagine` e `messaggio` sono due campi separati,
  entrambi sempre auto-riferiti — mai su un prerequisito, mai su un
  dipendente.** `testo` (e la foto, se `conThumb`) è l'indizio di **prima**:
  si vede in "Da trovare" e nella targa in alto mentre questo nodo, e solo
  questo nodo, è ancora da cercare (`etichettaOggetto()`/`immaginiIndizio()`
  leggono il nodo stesso, non chi richiede o chi è richiesto). `messaggio` è
  cosa succede **dopo**: una volta nella schermata di sblocco cumulativa
  appena il nodo diventa posseduto, e da lì in poi sempre rivedibile
  toccando l'oggetto nel bottino (`apriRicordo()`) — il bottino funziona
  quindi anche da promemoria di cosa si stava cercando. `richiede` decide
  **solo quando** un nodo compare in "Da trovare" (raggiungibilità): non
  trasporta più alcun contenuto da un nodo all'altro. Conseguenza pratica:
  per dare un indizio distinto a due nodi "fratelli" con lo stesso
  prerequisito (stesso `richiede`, quindi raggiungibili nello stesso
  momento) basta scrivere un `testo`/foto diverso su ciascuno — non serve
  più un nodo-indizio a monte dedicato. Una volta posseduto, la foto torna
  comunque sempre visibile indipendentemente da `conThumb` (vedi punto
  precedente) — quello non è cambiato.
- **Aciclicità non garantita per costruzione**, stessa cosa delle versioni
  precedenti: `trovaCiclo()` controlla prima di ogni pubblicazione.
- **Nessuna migrazione da `caccia-1`/`caccia-2`**: se la caccia pubblicata
  non è già `caccia-3`, il pannello del master la tratta come
  incompatibile (non prova a leggerne i nodi) e riparte da un elenco
  vuoto — pubblicare da lì sostituisce interamente il file esistente.

## Formati precedenti (solo archivio storico, il codice attuale non li legge più)

### `caccia.json`, formato `caccia-1`

```jsonc
{
  "formato": "caccia-1",          // stringa qualsiasi. Cambiarla = azzera
                                   // i progressi di TUTTI i giocatori.
                                   // A parità di "formato", il gioco cresce
                                   // per aggiunta: vedi docs/STATO.md.
  "creato": "2026-09-10T21:04:56.845Z",  // timestamp dell'ultima pubblicazione

  "oggetti": {
    "o1abc23": {                  // id stabile, generato una volta alla
                                   // registrazione, MAI riusato
      "nome": "Orologio da muro",
      "soglia": 0.8123,           // soglia di similarità, calcolata da
                                   // calibrate() nel pannello master
      "pos": [ { "m": 0.0421, "q": "base64…" }, /* ~20 elementi */ ],
      "neg": [ { "m": 0.0398, "q": "base64…" }, /* ~10 elementi */ ],
      "luogo": {                  // null se la tappa non richiede posizione
        "lat": 44.4056,
        "lon": 8.9463,
        "raggio": 100             // metri
      }
    }
  },

  "missioni": [
    {
      "id": "m1def45",            // id stabile, generato alla registrazione
      "titolo": "Orologio da muro",
      "tappe": [                  // SEMPRE un solo elemento in questo formato
        { "indizio": "Trova l'orologio", "oggetto": "o1abc23" }
      ],
      "ricompensa": {
        "nome": "Chiave del tempo",
        "simbolo": "🗝️",
        "messaggio": "Hai fermato le lancette. Tieni questa chiave: servirà."
      }
    }
  ]
}
```

**`pos` / `neg`**: ogni elemento è un embedding a 1024 dimensioni,
compresso a interi a 8 bit (`q`, base64) più un fattore di scala (`m`).
Funzioni `pack()`/`unpack()` nel codice. Non contengono mai pixel di
immagini: da un embedding non si ricostruisce una foto. Vedi
`memory.md`, sezione "Perché niente server per le immagini", per il perché
di questa scelta. Lo stesso formato di `pos`/`neg` vale identico nel nodo
`oggetto` del formato `caccia-2` qui sotto: non è cambiato.

### `caccia.json`, formato `caccia-2`

```jsonc
{
  "formato": "caccia-2",
  "creato": "2026-09-13T…",
  "nodi": {
    "n1": {
      "tipo": "indizio",
      "titolo": "Indizio per l'orologio",   // uso interno (liste del master), mai mostrato al giocatore
      "testo": "Cerca qualcosa che segna il tempo",
      "immagine": "data:image/jpeg;base64,…",   // null se non allegata
      "richiede": []                             // [] = raggiungibile da subito
    },
    "o1abc23": {
      "tipo": "oggetto",
      "nome": "Orologio da muro",
      "soglia": 0.8123,
      "pos": [ /* ~20 embedding, formato invariato */ ],
      "neg": [ /* ~10 embedding, formato invariato */ ],
      "luogo": null,                 // o { lat, lon, raggio } come in caccia-1
      "richiede": ["n1"]
    },
    "n3": {
      "tipo": "ricompensa",
      "nome": "Chiave del tempo",
      "simbolo": "🗝️",
      "messaggio": "Hai fermato le lancette.",
      "richiede": ["o1abc23"]
    }
  }
}
```

Nota sulla forma di `indizio`: è piatta (`titolo`/`testo`/`immagine`
direttamente sul nodo), non l'incapsulamento `contenuto: {tipo, ...}`
immaginato in una versione precedente di questo documento — è la forma già
in uso in `bozze.json`, e si è scelto di non introdurne una diversa solo
per i nodi pubblicati. Non esiste ancora un tipo `audio` (fuori dall'ambito
di questo lavoro, vedi `docs/ROADMAP.md`).

Regole del formato:

- `richiede` è sempre in **AND**: un nodo diventa raggiungibile solo
  quando *tutti* i nodi elencati sono "posseduti" da quel giocatore. Niente
  OR.
- **Aciclicità non garantita per costruzione**: il pannello master permette
  di ricollegare fra loro anche nodi già esistenti (checkbox "richiede" per
  ognuno), quindi un ciclo è tecnicamente possibile da creare per errore.
  Prima di ogni pubblicazione dalla sezione "Collega gli elementi" viene
  eseguito un controllo esplicito (`trovaCiclo()`, una DFS sul grafo
  `richiede`): se trova un ciclo, blocca la pubblicazione ed elenca i nodi
  coinvolti.
- Cosa vuol dire "posseduto", per tipo:
  - `oggetto`: solo dopo la validazione reale (foto + eventuale GPS).
  - `indizio`: appena diventa raggiungibile — è testo/immagine, non c'è
    nulla da convalidare.
  - `ricompensa`: appena tutti i `richiede` sono posseduti.
- **Non ancora implementati** (progettati, vedi `docs/ROADMAP.md` punto 3):
  `scorta` (limite di istanze), `trasferibile`/`condivisibile` (scambio fra
  giocatori), contenuto `audio`. Aggiungerli non richiede di cambiare
  ulteriormente `formato`: sono campi opzionali in più sullo stesso
  `caccia-2`.

#### Come si passa da `caccia-1` a `caccia-2`

Solo su azione esplicita del master (bottone "Passa al formato con
collegamenti" nella sezione "Collega gli elementi"), mai automaticamente:
la funzione `migraANodi()` traduce ogni missione esistente in una catena
`indizio → oggetto → ricompensa`, riusando l'id già esistente dell'oggetto
(così l'oggetto "resta lo stesso" anche nel nuovo formato: stessi embedding,
stessa soglia). Come sempre, cambiare `formato` azzera i progressi di tutti
i giocatori — per questo l'azione è protetta da una conferma esplicita e
non scatta mai dal normale pulsante "Pubblica su GitHub" del modulo rapido
"Registra un nuovo oggetto", che resta utilizzabile in `caccia-1` finché
il master non fa quella scelta.

Una volta in `caccia-2`, lo stesso modulo rapido continua a funzionare
identico nell'interfaccia, ma produce la sua catena di tre nodi dentro
`nodi` invece che una voce in `oggetti`/`missioni`.

## `bozze.json`: eliminato con `caccia-3`

Esisteva nelle versioni precedenti come modo per salvare un indizio
scritto a mano (titolo, testo, foto opzionale) senza pubblicarlo subito.
Con `caccia-3` ogni nodo nasce dalla cattura sul campo (vedi sopra):
questa doppia via per crearne uno — a mano da computer, oppure sul posto
con la fotocamera — è stata eliminata a favore della sola seconda,
unificando il flusso. Il file e la sezione "Indizi (bozze)" del pannello
master non esistono più.

## Contenuto multimediale: solo testo e immagine per ora

Ogni nodo porta testo (`testo`/`messaggio`) e un'immagine inline in
base64 (`immagine`). Non c'è ancora l'audio, né la distinzione fra
"immagine inline piccola" e "file media separato" discussa in una fase di
progettazione precedente: con testo e immagini di piccole dimensioni,
tenerle inline in `caccia.json` si è rivelato semplice a sufficienza per
ora. Se in futuro le immagini o l'audio dovessero appesantire troppo il
file, riprendere l'idea di file media separati pubblicati a parte (vedi
la cronologia di questo documento nei commit precedenti), con due vincoli
reali da tenere in conto quando ci si arriva: l'**autoplay audio non
funziona sui telefoni** (serve sempre un tocco esplicito), e per restare
**offline** un file caricato con `src` esterno avrebbe bisogno di un
prefetch esplicito (`Cache Storage`/IndexedDB), a differenza del testo che
sta già tutto in `localStorage`.

## `messaggi.json` (pubblicato dal master, letto da tutti)

```jsonc
[
  {
    "id": "msgmtw0n6dp7mr",        // generato con newId("msg")
    "quando": "2026-09-10T21:04:56.845Z",
    "testo": "Si comincia sabato alle 15!"
  }
]
```

Array semplice, sempre in ordine di pubblicazione (append-only: il master
non modifica né cancella messaggi già pubblicati, solo ne aggiunge). Non
esiste un campo "destinatario": sono **tutti broadcast**, per scelta (vedi
`memory.md`).

## `cacce.json` (pubblicato dal master, letto da tutti)

```jsonc
["centro-storico", "boccadasse"]
```

Array di stringhe, ogni stringa uno slug di una caccia con nome (vedi
`docs/STATO.md`). **La caccia di sempre (slug vuoto) non ci compare mai**,
è sempre la prima voce implicita ovunque questo elenco si mostri.
**`"caccia"` è un nome riservato**: se ricompare qui (per esempio scritto a
mano per errore), il codice lo filtra (vedi `memory.md`). Scritto da `registraCaccia()` alla
prima pubblicazione riuscita di ciascuna caccia con nome; letto da
`leggiElencoCacce()`, unica funzione condivisa fra il menu del pannello
master e la schermata di scelta del giocatore.

## `lavoro.json` / `lavoro-<slug>.json` (pubblicato dal master, MAI letto dal giocatore)

Stesso schema di `caccia.json` per `nodi`, ma `{ formato, salvato, nodi }`
(`salvato`, non `creato`: la data dell'ultimo salvataggio della bozza, non
di una pubblicazione) — su un nome di file diverso apposta: nessun `fetch`
nel codice giocatore
lo cerca mai, quindi resta invisibile ai giocatori per costruzione, non per
un controllo di accesso. È la bozza della copia di lavoro del master,
scritta premendo "Salva bozza sul server" — protegge da un cambio di
telefono o dalla pulizia dei dati del browser, senza rendere pubblico
nulla prima che il master prema "Pubblica" (che scrive invece
`caccia*.json`).

## `localStorage` del giocatore (mai condiviso, chiavi principali)

| Chiave | Contenuto |
|---|---|
| `caccia-scelta` | slug dell'ultima caccia scelta/vista (`""` = quella di sempre) — assente = non ha ancora scelto, vedi `docs/STATO.md` |
| `gioco` / `gioco:<slug>` | l'ultimo `caccia*.json` scaricato per quella caccia (`caccia-3`) — la caccia di sempre resta su `gioco` senza suffisso, per compatibilità con chi giocava già |
| `stato` / `stato:<slug>` | `{ trovati, bottino, visti, scelta, ceduti, prodotti }` — vedi sotto, namespaced come sopra |
| `msg-letti` | array di `id` di messaggi già letti — **non** namespaced per caccia: i messaggi sono globali |
| `gioco-prova` / `stato-prova` / `prova` | copie separate usate dalla modalità di prova del master, mai namespaced per caccia |

`stato.trovati` è un array di id di nodi **posseduti**: sia quelli
validati fisicamente dal giocatore (`daValidare: true`, foto + eventuale
GPS), sia quelli diventati posseduti da soli a cascata (`daValidare:
false`, appena i loro `richiede` erano soddisfatti) — a ogni scatto
riuscito, `trovati` viene ricalcolato per intero con una chiusura a punto
fisso sul grafo `richiede` (`chiudi()`) e salvato così com'è, invece di
ricalcolarlo ogni volta da un insieme più piccolo di soli oggetti
validati. Il conteggio "Trovati X di Y" mostrato al giocatore filtra
comunque solo i nodi con `daValidare: true` fra quelli in `trovati`,
altrimenti conterebbe anche gli sblocchi automatici.
`stato.bottino` è un array con **ogni** nodo diventato posseduto, non solo
quelli validati (copie dei campi `nome`/`messaggio`/`conThumb`/`immagine`
del nodo, con l'id del nodo e `quando` aggiunti) — un solo scatto può
aggiungerne più di uno in un colpo solo, se sblocca più nodi a cascata.
Per un nodo a istanze ci sono **più voci per lo stesso nodo**, ciascuna con
`istanza` (l'id a tre caratteri) e `prodotta` (`true` se generata da questo
telefono, `false` se ricevuta); `trovati` contiene comunque l'id del nodo
una volta sola (= "ne ho almeno una").
`stato.ceduti` sono i nodi ceduti con uno scambio 🔄, esclusi per sempre
dalla chiusura automatica (vedi `memory.md`); `stato.prodotti` i nodi a
istanze di cui questo telefono ha già generato la propria istanza.

## `localStorage` del master (mai condiviso, chiavi principali)

| Chiave | Contenuto |
|---|---|
| `gh-config` | `{ owner, repo, branch, path, token }` — il token di scrittura GitHub |
| `m-lavoro` | `{ formato, slug, nodi }` — autosalvataggio della copia di lavoro corrente, scritto a ogni modifica; `slug` dice a quale caccia appartiene, così cambiando caccia dal menu non si vede riapparire la bozza di quella lasciata |

## Come si tradurrebbe in tabelle, quando arriverà il database

Non farlo finché non serve davvero (vedi `docs/ROADMAP.md`), ma per
orientarsi. Il modello a `nodi` si presta bene alla traduzione, meglio di
quello a `missioni`: è già un grafo, non serve normalizzare oggetti
annidati dentro missioni dentro ricompense.

- `nodi` → probabilmente resta pubblicato come file statico anche col
  database: **non serve un database solo per far leggere i nodi ai
  giocatori**, il database serve per ciò che segue. L'unica eccezione è se
  si deciderà di nascondere lo spoiler (vedi ultimo punto).
- `stato.trovati` + `stato.bottino`, oggi solo locali → tabella `eventi`
  (chi, quale nodo, quando) scritta dal giocatore via Supabase, con RLS
  che permette a ognuno di scrivere solo le proprie righe.
- Le istanze scambiabili/scarse (`scorta`/`trasferibile`/`condivisibile`,
  non ancora implementate — vedi `docs/ROADMAP.md`, punto 3) → tabella
  `istanze` (nodo di origine, proprietario attuale) + tabella `scambi`
  (storico condivisioni/trasferimenti). La `scorta` di un nodo diventerebbe
  un contatore decrementato in un'unica transazione, sia quando nasce da un
  evento di gioco sia quando nasce da una condivisione.
- L'identità del giocatore, oggi assente → tabella `giocatori`, con un id
  stabile assegnato all'iscrizione. È il prerequisito di tutto il punto
  precedente: senza un id di chi scrive, non si può dire "questa istanza
  appartiene a Luca".
- **Se un giorno si vorrà smettere di pubblicare tutto il grafo in
  chiaro** (oggi `caccia.json` è uno spoiler leggibile, vedi `memory.md`):
  la visibilità di un nodo si esprime come una condizione RLS
  dichiarativa, senza bisogno di funzioni ricorsive — "`richiede` è
  interamente contenuto nell'insieme dei nodi già in `eventi` per questo
  giocatore" è un confronto di containment fra array, esprimibile in una
  singola policy. Serve però un piccolo trigger che, per i nodi con
  `daValidare: false`, scriva da solo il loro evento "posseduto" appena
  diventano raggiungibili — a differenza di un nodo con `daValidare:
  true`, il cui evento lo scrive il giocatore solo dopo la validazione
  reale.
- `messaggi.json` → se un giorno servirà la conferma di lettura visibile al
  master, diventa una tabella `messaggi` (scritta dal master) più una
  tabella `letture` (scritta dai giocatori). Finché resta solo broadcast
  senza conferma, il file statico attuale basta e non c'è motivo di
  migrarlo per primo.
