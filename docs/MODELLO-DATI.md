# Modello dati attuale

Oggi tutto vive in due file JSON pubblici, scritti solo dal master, e nel
`localStorage` di ogni telefono (mai condiviso). Questo documento descrive
entrambi, e a fondo pagina indica come si tradurrebbero in tabelle quando
arriverà un database vero — non per farlo subito, ma perché conviene tenere
la forma dei dati già compatibile con quella futura.

## `caccia.json` (pubblicato dal master, letto da tutti)

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
      "tappe": [                  // oggi SEMPRE un solo elemento: sarà
                                   // sostituito dal formato "nodi" più
                                   // sotto, vedi ROADMAP.md punto 5
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
di questa scelta.

## `bozze.json` (pubblicato dal master, mai letto dai giocatori)

Implementato (sezione "Indizi (bozze)" del pannello master). Non è il
formato a nodi finale descritto più sotto — è deliberatamente più semplice,
un primo passo scollegato dal resto: salva un indizio con titolo, testo e
un'eventuale foto, senza ancora collegarlo a nessun oggetto/ricompensa né
pubblicarlo nella caccia vera.

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
appesantire il file. A differenza di `pos`/`neg` degli oggetti, qui *è* una
vera immagine visibile (non un embedding): è pensata per essere mostrata al
giocatore, non per il riconoscimento — vedi la sezione "Formato futuro" più
sotto per come si inserirà nel campo `contenuto` una volta assemblata.

Nessuna interfaccia oggi legge questo file per costruire `caccia.json`: è
un deposito, non ancora un editor. Vedi `docs/ROADMAP.md`, punto 5, per il
seguito previsto (assemblaggio, `richiede`, pubblicazione).

## Formato futuro: nodi e prerequisiti (`caccia-2`, progettato, non ancora implementato)

Non ancora in `index.html`: è il disegno concordato in conversazione
(2026-09-11) per generalizzare il formato sopra (`oggetti` + `missioni` a
tappa singola). Sostituirà quella sezione quando si deciderà di
implementarlo (vedi `docs/ROADMAP.md`, punto 5) — cambiare `formato` azzera
i progressi di tutti, come sempre.

```jsonc
{
  "formato": "caccia-2",
  "nodi": {
    "n1": {
      "tipo": "indizio",
      "contenuto": { "tipo": "testo", "testo": "Cerca qualcosa che segna il tempo" },
      "richiede": []                 // [] = visibile/raggiungibile da subito
    },
    "n2": {
      "tipo": "oggetto",
      "nome": "Orologio da muro",
      "soglia": 0.8123,
      "pos": [ /* ~20 embedding, formato invariato rispetto a oggi */ ],
      "neg": [ /* ~10 embedding, formato invariato rispetto a oggi */ ],
      "luogo": null,                 // o { lat, lon, raggio } come oggi
      "contenuto": { "tipo": "immagine", "file": "media/n2.jpg" }, // opzionale,
                                      // solo un aiuto visivo: non sostituisce
                                      // pos/neg/soglia, che restano il
                                      // meccanismo di riconoscimento
      "richiede": ["n1"]
    },
    "n3": {
      "tipo": "ricompensa",
      "nome": "Chiave del tempo",
      "simbolo": "🗝️",
      "contenuto": { "tipo": "audio", "file": "media/n3.mp3" },
      "richiede": ["n2"],
      "scorta": 3,                   // null = infinita (default)
      "trasferibile": true,          // default false
      "condivisibile": true          // default false
    }
  }
}
```

Regole del formato:

- `richiede` è sempre in **AND**: un nodo diventa raggiungibile solo
  quando *tutti* i nodi elencati sono "posseduti" da quel giocatore. Niente
  OR, per tenere gestibili sia l'editor sia la logica di sblocco.
- **Aciclicità garantita per costruzione**: un nodo può comparire nel
  `richiede` di un altro solo se esiste già al momento in cui quest'ultimo
  viene creato. Non serve un algoritmo di validazione a parte.
- Cosa vuol dire "posseduto", per tipo:
  - `oggetto`: solo dopo la validazione reale (foto + eventuale GPS),
    esattamente come oggi.
  - `indizio`: appena diventa raggiungibile — è testo, non c'è nulla da
    convalidare.
  - `ricompensa`: appena tutti i `richiede` sono posseduti — genera
    un'istanza, a meno che la `scorta` sia esaurita.
- `scorta` / `trasferibile` / `condivisibile`: semantica completa in
  `docs/ROADMAP.md`, punto 3. In sintesi: `scorta` è un budget di
  creazione condiviso fra "ottenuto direttamente" e "ricevuto in
  condivisione" — **condividere consuma una unità di scorta** (crea una
  nuova istanza), **trasferire no** (sposta un'istanza esistente, il
  totale in circolazione non cambia). Oggi il gioco intende attivare
  condivisione/trasferimento solo per `tipo: "ricompensa"`: lo schema li
  permette anche su `oggetto`/`indizio`, ma restano disattivati per scelta
  del committente (snaturerebbero la ricerca fisica).

### `contenuto`: testo, immagine o audio, con lo stesso involucro

Per `indizio` e `ricompensa`, `contenuto` sostituisce il campo testo
attuale (`testo` / `messaggio`):

```jsonc
{ "tipo": "testo",     "testo": "…" }
{ "tipo": "immagine",  "file": "media/n2.jpg" }
{ "tipo": "audio",     "file": "media/n3.mp3" }
```

Per `oggetto`, `contenuto` è **sempre facoltativo e puramente illustrativo**
(es. una foto di riferimento, un indizio sonoro alla scoperta): non
sostituisce mai `pos`/`neg`/`soglia`/`luogo`, che restano l'unico
meccanismo di riconoscimento. Un modo economico di popolarlo: riusare uno
dei fotogrammi già catturati in `pos` durante la calibrazione come
miniatura, senza una cattura dedicata.

**I file (`immagine`/`audio`) non stanno dentro `caccia.json`**, a
differenza degli embedding: verrebbero scaricati per intero da ogni
giocatore ad ogni controllo, un peso inutile su dati mobili. Vivono come
file separati nel repository (es. `media/n2.jpg`), pubblicati con lo stesso
meccanismo già usato per `caccia.json`/`messaggi.json` — `ghPutFile`
generalizzato ad accettare anche contenuto binario, non solo testo/JSON,
dato che l'API di GitHub tratta entrambi allo stesso modo (base64 nel
corpo della `PUT`). `caccia.json` contiene solo il percorso.

Due vincoli reali da tenere in conto quando si implementa, non solo
dettagli:

- **Autoplay audio sui telefoni**: i browser mobili non fanno mai partire
  un audio da soli quando un nodo si sblocca — serve sempre un tocco
  esplicito ("▶ Ascolta"). Non è aggirabile, va progettato così da subito.
- **Offline**: oggi "funziona offline con l'ultima copia scaricata" (vedi
  `docs/STATO.md`) perché tutto lo stato di gioco sta nel `localStorage`.
  Un file media caricato con `src` esterno dipende invece dalla cache HTTP
  del browser, che può svuotarsi in qualsiasi momento — per mantenere la
  stessa garanzia di offline anche sui media serve un prefetch esplicito
  (es. `Cache Storage`/IndexedDB) dei file dei nodi già raggiungibili, non
  basta il comportamento di default del browser.

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
| `gioco` | l'ultimo `caccia.json` scaricato |
| `stato` | `{ progresso, bottino, visti, scelta }` — vedi sotto |
| `msg-letti` | array di `id` di messaggi già letti |
| `gioco-prova` / `stato-prova` / `prova` | copie separate usate dalla modalità di prova del master |

`stato.progresso` è una mappa `{ id_missione: numero_di_tappe_completate }`.
`stato.bottino` è un array di ricompense ottenute (copie del campo
`ricompensa` della missione, con `missione` e `quando` aggiunti).

## `localStorage` del master (mai condiviso, chiavi principali)

| Chiave | Contenuto |
|---|---|
| `gh-config` | `{ owner, repo, branch, path, token }` — il token di scrittura GitHub |

## Come si tradurrebbe in tabelle, quando arriverà il database

Non farlo finché non serve davvero (vedi `docs/ROADMAP.md`), ma per
orientarsi. Il modello a `nodi` (sopra) si presta bene alla traduzione,
meglio di quello a `missioni`: è già un grafo, non serve normalizzare
oggetti annidati dentro missioni dentro ricompense.

- `nodi` → probabilmente resta pubblicato come file statico anche col
  database: **non serve un database solo per far leggere i nodi ai
  giocatori**, il database serve per ciò che segue. L'unica eccezione è se
  si deciderà di nascondere lo spoiler (vedi ultimo punto).
- `stato.progresso` + `stato.bottino`, oggi solo locali → tabella `eventi`
  (chi, quale nodo, quando) scritta dal giocatore via Supabase, con RLS
  che permette a ognuno di scrivere solo le proprie righe.
- Le istanze scambiabili/scarse (vedi `docs/ROADMAP.md`, punto 3) →
  tabella `istanze` (nodo di origine, proprietario attuale) + tabella
  `scambi` (storico condivisioni/trasferimenti). La `scorta` di un nodo
  diventa un contatore decrementato in un'unica transazione, sia quando
  nasce da un evento di gioco sia quando nasce da una condivisione.
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
