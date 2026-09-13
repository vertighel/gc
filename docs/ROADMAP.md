# Cosa manca

In ordine di **dipendenza** (cosa deve esistere prima di cos'altro), non di
importanza percepita. Non iniziare dal punto 3 solo perché sembra più
divertente: sblocca poco senza i punti 1 e 2.

## 1. Identità dei giocatori — il prerequisito di tutto il resto

Oggi non esiste. Ogni telefono è anonimo agli occhi del master e degli altri
giocatori. Prima di costruire qualunque cosa "multi-giocatore" (scambi, log,
messaggi mirati), va decisa questa parte. È stata **volutamente rimandata**,
non dimenticata: vedi `memory.md` per il perché.

Punti da decidere insieme al committente prima di scrivere codice, non da
soli:
- Un giocatore si identifica con un nome scelto liberamente, o con un
  codice/link di invito assegnato dal master?
- L'identità serve solo a distinguere i giocatori fra loro (via database),
  o deve anche impedire che qualcuno finga di essere un altro? Con 10 amici
  fidati, probabilmente non serve un'autenticazione vera.

## 2. Un database vero (quasi certamente Supabase)

Necessario appena serve una scrittura che arriva da un telefono di un
giocatore, non solo dal master. Serve per i punti 3 e 4 di questa lista.

Passi concreti, quando si arriva a questo punto:
1. Creare un progetto Supabase (piano gratuito).
2. Aggiungere in `index.html` l'import del client Supabase e la chiave
   pubblica ("anon key") del progetto — è pensata per stare nel codice
   lato client, la sicurezza vera la fanno le regole RLS, non la
   segretezza della chiave.
3. Creare le tabelle `giocatori`, `eventi`, `istanze`, `scambi` (schema di
   partenza in `docs/MODELLO-DATI.md`, sezione finale) con le relative
   policy RLS: un giocatore può scrivere solo righe proprie, tutti possono
   leggere.

Questo **non richiede** cambiare l'hosting (resta GitHub Pages, vedi
`memory.md`): il database è un servizio a sé, raggiunto direttamente dal
browser, indipendente da dove è ospitato il sito.

## 3. Scarsità e scambio/condivisione di oggetti, indizi e ricompense

Dipende dai punti 1 e 2. Disegno concordato in conversazione (2026-09-11),
non ancora scritto in codice. Formato dati completo in
`docs/MODELLO-DATI.md`.

### Scarsità

Un nodo (di qualunque `tipo`, vedi punto 5) può avere una `scorta` limitata
invece che infinita: un contatore di quante istanze possono ancora nascere
in tutta la partita. Il contatore è condiviso fra due strade diverse che
pescano dallo stesso budget: un giocatore che soddisfa i `richiede` del
nodo per la prima volta, oppure un giocatore che ne possiede già una copia
e la **condivide** con un altro (vedi sotto) — entrambi gli eventi
consumano una unità della stessa `scorta`. Il decremento deve essere
un'unica operazione atomica sul database, altrimenti due eventi nello
stesso istante possono farla scendere sotto zero. In pratica avrà senso
quasi solo per le `ricompensa`, ma lo schema non lo vieta per gli altri
tipi.

### Condivisione e trasferimento

Due operazioni diverse, entrambe sull'istanza di un nodo (id stabile,
proprietario attuale — tabella `istanze`, vedi `docs/MODELLO-DATI.md`):

- **Condivisione**: A conserva la sua istanza, B ne riceve una copia nuova.
  **Consuma una unità di `scorta`** (fallisce se esaurita); su un nodo a
  scorta infinita non consuma nulla.
- **Trasferimento**: l'istanza passa da A a B, resta un'unica istanza; A la
  perde. **Non tocca mai la `scorta`**, perché non nasce nulla di nuovo —
  il totale in circolazione non cambia.

Prova di vicinanza fisica tramite **doppia scansione QR**, in entrambi i
casi: A mostra un QR con un codice monouso a scadenza breve (60-90 secondi)
e la propria posizione; B lo scansiona, controlla la distanza **in locale
sul proprio telefono**, poi la funzione sul database esegue l'operazione in
modo atomico (per evitare che la stessa istanza unica finisca a due
persone, o che si sfori la scorta). Il GPS non deve mai essere salvato sul
database: viaggia solo dentro il QR, da telefono a telefono. Solo un
booleano "vicinanza verificata: sì/no" arriva al database.

**Decisione esplicita del committente (2026-09-11)**: il meccanismo va
progettato per funzionare su qualunque `tipo` di nodo — oggetti e indizi
inclusi, non solo ricompense — ma **per ora si attiva solo sulle
ricompense**. Rendere scambiabili oggetti o indizi permetterebbe a un
giocatore di ottenere il progresso di qualcun altro senza cercare
fisicamente nulla, snaturando il gioco. Non attivarlo per quei due tipi
senza che sia il committente a richiederlo esplicitamente di nuovo.

## 4. Log delle attività visibile al master

Dipende dai punti 1 e 2. "Chi ha trovato cosa e quando", "chi possiede quale
ricompensa", "chi l'ha scambiata con chi": tutte informazioni che nascono
sul telefono del giocatore nel momento in cui gioca. Con il database in
piedi, diventano query semplici sulla tabella `eventi`/`istanze`/`scambi`.
Non c'è modo onesto di farlo prima, senza database (vedi `memory.md`).

## 5. Generalizzazione del modello dati: nodi e prerequisiti

Non dipende da database o identità: è un cambiamento al modello dati di
`caccia.json` e alla logica del pannello master. Si può fare **prima
ancora** del database, se si vuole: è un lavoro sul file statico e sul
pannello master, indipendente dal resto della lista. Ha senso farlo per
primo solo se il committente lo chiede esplicitamente prima di 1-2-3-4:
altrimenti, seguire l'ordine di dipendenza sopra.

Sostituisce l'idea precedente di "missioni composte" (flussi B e C del
disegno originale): non più una missione con tappe fisse che sblocca una
sola ricompensa, ma un grafo libero di **nodi tipizzati** (`indizio`,
`oggetto`, `ricompensa`) collegabili a piacimento tramite un elenco di
prerequisiti su ciascun nodo (`richiede: [id, ...]`, sempre in AND). Copre
in un colpo solo tutti gli esempi del disegno originale — un indizio unico
che porta a più oggetti, più oggetti che convergono su una ricompensa,
ricompense che ne sbloccano altre, catene miste oggetto+ricompensa →
ricompensa → indizio — senza dover inventare un "flusso" nuovo ogni volta.
Formato completo, semantica di "posseduto" per ciascun tipo, e aciclicità
garantita per costruzione (si può richiedere solo un nodo già esistente al
momento della sua creazione): vedi `docs/MODELLO-DATI.md`.

**Pannello master**: form guidato che estende quello attuale (si crea un
nodo alla volta, come oggi si registra un oggetto), con un elenco a
checkbox "richiede" per scegliere i prerequisiti fra i nodi già creati.
Scartato **di proposito** un editor grafico drag-and-drop (esistono
librerie vanilla-JS caricabili da CDN, es. Drawflow/Litegraph, quindi
sarebbero compatibili con "niente bundler") perché il master lavora dal
telefono sul campo, e trascinare nodi/collegare fili col dito su schermo
piccolo è scomodo anche nelle migliori implementazioni touch. Da valutare
in futuro, se servirà, solo un'**anteprima grafica in sola lettura** (SVG
generato automaticamente), mai un editor visuale.

Cambiare formato (es. `caccia-2`) azzera i progressi di tutti i giocatori,
come da regola già in vigore (vedi `docs/STATO.md`).

**Primo passo già fatto (2026-09-13)**: la sezione "Indizi (bozze)" del
pannello master salva un indizio (titolo + testo + foto facoltativa) su un
file a parte, `bozze.json`, senza pubblicarlo — vedi `docs/STATO.md` e
`docs/MODELLO-DATI.md`. È solo il deposito: manca ancora tutto il resto di
questo punto — assegnare un ruolo finale alla bozza, collegare i `richiede`,
e pubblicare davvero in `caccia.json` nel formato a nodi.

## 6. Narrazione, coinvolgimento social

La scarsità, discussa qui in precedenza insieme a questo punto, ha ora un
disegno tecnico concreto: vedi punto 3.

Narrazione e coinvolgimento social sono invece solo discussi a parole nelle
fasi iniziali del progetto, nessuna decisione tecnica presa. Riprendere la
conversazione con il committente prima di implementare qualunque cosa qui:
sono scelte di design del gioco, non solo tecniche, e vanno concordate come
lo sono state le altre finora.

Nota su "social": un pulsante di condivisione su Instagram è già stato
provato e **esplicitamente rifiutato** dal committente (vedi `memory.md`).
Se il tema riemerge, chiedere prima che forma preferisce, non riproporre la
stessa soluzione.
