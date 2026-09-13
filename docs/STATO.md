# Stato attuale (versione 11)

Un solo file: `index.html`, alla radice del repository. Nessuna dipendenza
installata: le uniche librerie esterne (MediaPipe) si caricano da CDN via
`import()` dinamico, solo quando serve la fotocamera, non al caricamento
della pagina.

## Modalità giocatore (indirizzo normale, senza `#`)

- **Scarica `caccia.json` da solo**, all'apertura e ogni volta che l'app
  torna in primo piano (`visibilitychange`). Nessun caricamento manuale di
  file: quello è stato tolto apposta su richiesta del committente.
- Mostra l'indizio della tappa scelta dentro una "targa" smaltata (stile
  grafico volutamente diverso dal solito chat-bot: vedi in fondo a questo
  file la sezione sullo stile).
- **Lista "Da trovare" sempre visibile**, con tutti gli oggetti ancora
  mancanti *e già raggiungibili*, selezionabili in qualunque ordine.
  Gli oggetti non ancora "visti" da questo giocatore sono etichettati
  "Nuovo". Con una caccia in formato `caccia-2` (vedi sotto), un oggetto
  compare in questa lista solo se tutti i suoi collegamenti "richiede"
  sono già soddisfatti — la targa mostra il testo (ed eventuale foto)
  dell'indizio collegato direttamente a quell'oggetto.
- Scatto e verifica: 5 fotogrammi ravvicinati, l'oggetto è considerato
  riconosciuto se almeno 3 su 5 superano la soglia calcolata dal master.
  Se la tappa ha un vincolo di posizione, il GPS viene controllato *prima*
  di accendere il confronto immagine. Un solo scatto può sbloccare più
  ricompense in un colpo solo (es. una ricompensa che ne richiede altre
  due già ottenute): si mostrano una dopo l'altra nella stessa schermata.
- **Aggiornamenti incrementali**: se il master pubblica un `caccia.json`
  con lo stesso `formato` di quello già scaricato, i progressi e il bottino
  del giocatore restano intatti e i nuovi oggetti si aggiungono alla lista.
  Solo un `formato` diverso azzera tutto (bottino, progressi, tappe viste).
- Bottino (ricompense ottenute) sempre visibile in fondo alla pagina.
- **Casella messaggi**: icona a busta in alto a destra con badge del numero
  di non letti, scarica `messaggi.json` con lo stesso meccanismo di
  `caccia.json`. Lo stato "letto" è **locale al telefono**, non tracciato
  dal master (coerente con l'assenza di identità dei giocatori).
- Funziona offline con l'ultima copia scaricata (tutto in `localStorage`).
- **Modalità di prova**: se il master preme "Prova su questo telefono" dal
  pannello master, il giocatore su quello stesso telefono entra in uno
  spazio *separato* (chiavi `localStorage` diverse, prefisso `-prova`),
  segnalato da una striscia gialla, senza toccare i dati della caccia
  realmente pubblicata.

## Modalità master (indirizzo con `#master` in fondo)

- All'apertura, **scarica la caccia già pubblicata** e la mostra in un
  elenco. In `caccia-1` ogni riga ha un pulsante "Rimuovi"; in `caccia-2`
  l'elenco è di sola lettura e rimanda alla sezione "Collega gli elementi"
  per modificare o rimuovere un nodo (lì la rimozione è bloccata se un
  altro nodo lo richiede ancora).
- **Registrazione di un nuovo oggetto dal vivo**: 20 fotogrammi
  dell'oggetto (muovendosi per ~6 secondi), poi 10 fotogrammi dei dintorni
  come negativi. La soglia di riconoscimento si calcola da soli
  (`calibrate()`), con un messaggio che avvisa se l'oggetto è troppo simile
  all'ambiente circostante e serve ripetere la cattura su un dettaglio più
  distintivo.
- Pulsante "Prova il riconoscimento" per un test immediato con la
  fotocamera, mostrando il punteggio di somiglianza numerico.
- Form per indizio, nome/simbolo/messaggio della ricompensa, e spunta per
  richiedere la posizione (raggio fisso 100 m + margine sull'accuratezza
  GPS riportata dal telefono, fino a 150 m).
- **Pubblicazione diretta su GitHub**: un pannello di configurazione
  (aperto/chiuso con `<details>`) salva su questo telefono soltanto
  proprietario, repository, ramo e un token con permesso di scrittura
  limitato al repository. Il pulsante "Pubblica su GitHub" chiama
  direttamente l'API REST di GitHub (`GET` per lo sha corrente, `PUT` per
  scrivere), gestendo anche un eventuale conflitto 409 con un tentativo di
  ritentare una volta. In alternativa resta un pulsante "Scarica
  caccia.json" per la pubblicazione manuale.
- Sezione **Messaggi**: composizione libera, pubblicazione su
  `messaggi.json` con lo stesso meccanismo di scrittura via API GitHub
  (funzione `ghPutFile`, condivisa con la pubblicazione della caccia).
- **Sezione "Indizi (bozze)"**: un form con titolo, testo dell'indizio e
  una foto facoltativa (ridimensionata e compressa nel browser prima di
  salvarla). Il pulsante "Salva bozza" **non pubblica la caccia**: scrive
  su un file a parte, `bozze.json` (stesso meccanismo `ghPutFile`), mai
  scaricato dai giocatori. Le bozze restano lì, elencate con un "Rimuovi"
  ciascuna, finché non vengono importate dalla sezione seguente.
- **Sezione "Collega gli elementi"**: pensata per un computer, non per il
  telefono. Se la caccia pubblicata è ancora nel vecchio formato
  (`caccia-1`), mostra solo un avviso e un pulsante esplicito "Passa al
  formato con collegamenti" (azzera i progressi dei giocatori alla
  prossima pubblicazione, per questo richiede una conferma a parte — non
  scatta mai dal normale "Registra un nuovo oggetto"/"Pubblica su
  GitHub", che restano utilizzabili in `caccia-1` finché questa scelta non
  viene fatta). Una volta nel nuovo formato (`caccia-2`), mostra ogni
  indizio/oggetto/ricompensa esistente con un elenco di checkbox "Richiede"
  verso gli altri elementi, permette di aggiungere una nuova ricompensa
  scollegata e di importare le bozze salvate come nuovi nodi indizio.
  Prima di pubblicare controlla che i collegamenti non formino un ciclo
  (bloccando con un messaggio se lo trova) e scrive sia `caccia.json` sia
  `bozze.json` (tolte le bozze appena incorporate).

## Cosa esplicitamente NON fa, ad oggi

- Non distingue un giocatore dall'altro (nessuna identità/login).
- Non registra da nessuna parte "chi ha trovato cosa e quando", se non nel
  `localStorage` del singolo telefono del giocatore, invisibile al master.
- Non permette scambi o condivisioni di ricompense fra giocatori (il
  formato a nodi lo prevede in futuro, vedi `docs/ROADMAP.md` punto 3, ma
  non è ancora implementato).
- Non ha ancora contenuto audio, né scarsità delle ricompense.
- Non ha nessun meccanismo di narrazione o integrazione social.
- L'editor dei collegamenti ("Collega gli elementi") non è pensato per il
  telefono: richiede un computer per essere usato comodamente.

## Formato dei file pubblicati

Vedi `docs/MODELLO-DATI.md` per lo schema completo e commentato di
`caccia.json` e `messaggi.json`.

## Note di stile grafico, per chi tocca il CSS

Palette e caratteri scelti apposta per non sembrare un'interfaccia
chat-bot generica: sfondo cemento (`--cemento`), accenti smalto blu scuro
(`--smalto`) e giallo (`--giallo`), font condensato Barlow Condensed per i
titoli. L'elemento "targa" con le viti disegnate (`.plate`, `.screw`) è
l'elemento grafico ricorrente del gioco: mantienilo se aggiungi schermate.
