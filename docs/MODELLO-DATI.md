# Modello dati attuale

Oggi tutto vive in file JSON pubblici, scritti solo dal master, e nel
`localStorage` di ogni telefono (mai condiviso). Questo documento descrive
tutti i file, e a fondo pagina indica come si tradurrebbero in tabelle quando
arriverà un database vero — non per farlo subito, ma perché conviene tenere
la forma dei dati già compatibile con quella futura.

`caccia.json` può trovarsi in due formati diversi, entrambi letti sia dal
giocatore sia dal master: il vecchio `caccia-1` (missioni a tappa singola,
tuttora quello pubblicato finché il master non sceglie di cambiare) e il
nuovo `caccia-2` (nodi collegabili liberamente, implementato ma **attivato
solo su scelta esplicita del master**, dalla sezione "Collega gli elementi"
del pannello — vedi `docs/STATO.md` e `docs/ROADMAP.md` punto 5). Il
giocatore legge entrambi senza differenze visibili: `loadGame()` traduce al
volo un `caccia-1` nella stessa forma a nodi usata internamente.

## `caccia.json`, formato `caccia-1` (il più vecchio, ancora quello pubblicato oggi)

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

## `caccia.json`, formato `caccia-2` (nodi collegabili, implementato)

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

### Come si passa da `caccia-1` a `caccia-2`

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

## `bozze.json` (pubblicato dal master, mai letto dai giocatori)

Salva un indizio con titolo, testo e un'eventuale foto, **senza pubblicarlo
nella caccia**: resta a parte finché il master non lo importa dalla sezione
"Collega gli elementi" (diventa lì un nodo `indizio`, con un nuovo id) e
pubblica. L'importazione toglie la bozza da questo file solo al momento
della pubblicazione riuscita, non prima, per non perdere lavoro se la
pagina si ricarica senza pubblicare.

```jsonc
[
  {
    "id": "bmtw1a2b3c",           // generato con newId("b")
    "creato": "2026-09-13T…",
    "tipo": "indizio",            // oggi sempre "indizio": è l'unico tipo di bozza che esiste
    "titolo": "Indizio per l'orologio",
    "testo": "Cerca qualcosa che segna il tempo",
    "immagine": "data:image/jpeg;base64,…"   // null se non allegata
  }
]
```

`immagine`, se presente, è già ridimensionata (lato massimo 800px) e
compressa in JPEG **nel browser prima del salvataggio**, per non
appesantire il file.

## Contenuto multimediale: solo testo e immagine per ora

Un `indizio` (in bozza o già nodo) porta testo e/o un'immagine inline in
base64. Non c'è ancora l'audio, né la distinzione fra "immagine inline
piccola" e "file media separato" discussa in una fase di progettazione
precedente: con testo e immagini di piccole dimensioni, tenerle inline in
`caccia.json`/`bozze.json` si è rivelato semplice a sufficienza per ora.
Se in futuro le immagini o l'audio dovessero appesantire troppo i file,
riprendere l'idea di file media separati pubblicati a parte (vedi la
cronologia di questo documento nei commit precedenti), con due vincoli
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

## `localStorage` del giocatore (mai condiviso, chiavi principali)

| Chiave | Contenuto |
|---|---|
| `gioco` | l'ultimo `caccia.json` scaricato (formato originale, `caccia-1` o `caccia-2`) |
| `stato` | `{ trovati, bottino, visti, scelta }` — vedi sotto |
| `msg-letti` | array di `id` di messaggi già letti |
| `gioco-prova` / `stato-prova` / `prova` | copie separate usate dalla modalità di prova del master |

`stato.trovati` è un array di id di nodi **`oggetto`** validati fisicamente
dal giocatore (foto + eventuale GPS) — è l'unico stato che serve salvare:
tutto il resto (quali indizio sono visibili, quali ricompense sono state
sbloccate) si ricalcola ad ogni apertura con una chiusura a punto fisso sul
grafo `richiede` (`calcolaRaggiungibili()`), a partire da `trovati`.
`stato.bottino` resta un array di ricompense ottenute (copie dei campi
`nome`/`simbolo`/`messaggio` del nodo, con l'id del nodo e `quando`
aggiunti) — un solo scatto può aggiungerne più di una in un colpo solo, se
sblocca più ricompense contemporaneamente.

## `localStorage` del master (mai condiviso, chiavi principali)

| Chiave | Contenuto |
|---|---|
| `gh-config` | `{ owner, repo, branch, path, token }` — il token di scrittura GitHub |

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
  singola policy. Serve però un piccolo trigger che, per i nodi di tipo
  `indizio`/`ricompensa`, scriva da solo il loro evento "posseduto" appena
  diventano raggiungibili — a differenza di `oggetto`, il cui evento lo
  scrive il giocatore solo dopo la validazione reale.
- `messaggi.json` → se un giorno servirà la conferma di lettura visibile al
  master, diventa una tabella `messaggi` (scritta dal master) più una
  tabella `letture` (scritta dai giocatori). Finché resta solo broadcast
  senza conferma, il file statico attuale basta e non c'è motivo di
  migrarlo per primo.
