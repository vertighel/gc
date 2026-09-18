# Memoria del progetto — vincoli e decisioni ancora attivi

Registro di *decisioni che restano valide*, non una cronologia dello
sviluppo: serve a non far riproporre strade già scartate, e a spiegare il
"perché" dietro scelte che altrimenti sembrerebbero arbitrarie leggendo
solo il codice. Per lo stato tecnico attuale vedi `docs/STATO.md`; per
cosa manca `docs/ROADMAP.md`; per la cronologia vera, `git log`.

Dopo la milestone v1, i dettagli di bug ormai corretti e le tappe
intermedie del design sono stati tolti da qui: contano solo i vincoli che
un futuro cambiamento deve ancora rispettare.

## Il contesto: chi gioca, con che rischio

Meno di 10 giocatori, tutti amici del committente. Nessun rischio serio di
imbrogli deliberati o attacchi informatici: questo giustifica scelte più
semplici di quanto servirebbe per un gioco pubblico (niente firme
crittografiche, niente prevenzione del "doppio spendere" delle
ricompense, niente anti-frode sul riconoscimento immagini). Se il gruppo
di giocatori dovesse crescere o diventare meno fidato, queste scelte
vanno riviste.

## Perché niente server per le immagini

Requisito esplicito fin dall'inizio: le foto scattate dai giocatori **non
devono mai lasciare il telefono**. Il riconoscimento confronta
**embedding calcolati nel browser** (MediaPipe, `mobilenet_v3_small` da
CDN), mai un classificatore lato server. `caccia.json` contiene solo
vettori numerici compressi, mai immagini vere — da un embedding non si
ricostruisce una foto (schema in `docs/MODELLO-DATI.md`).

## Perché nessun database, per ora

Rimandato deliberatamente per costruire prima tutto ciò che un hosting
statico può fare da solo. Regola pratica: ciò che scrive *solo* il master
resta su file JSON pubblicati su GitHub; ciò che deve scrivere *anche* un
giocatore in un registro **condiviso e letto da altri** (log attività
visibile al master, un contatore di scorta condiviso da tutti i
giocatori) richiede un database vero (quasi certamente Supabase, vedi
`docs/ROADMAP.md`), perché un hosting statico non accetta scritture
concorrenti. Non vale invece per uno scambio **diretto fra due telefoni**,
che non passa da nessun registro condiviso — vedi sotto.

## Scambio fra giocatori: niente arbitro, per scelta ragionata (2026-09-17)

Un regalo (`daValidare: false`) marcato `scambiabile`/`duplicabile` passa
da un telefono all'altro leggendosi reciprocamente un QR con le
fotocamere anteriori (`apriScambio()`, vedi `docs/STATO.md`), senza
nessun server. Non è una scorciatoia presa alla leggera: il problema di
fondo — due dispositivi che devono accordarsi su un trasferimento
passandosi solo messaggi che possono perdersi, senza un terzo che
ricordi l'esito — è il **Problema dei Due Generali**, un risultato
dimostrato dell'informatica distribuita: **non ha soluzione perfetta**
con solo due parti e nessun arbitro, qualunque sia il canale (QR,
Bluetooth, NFC — non è una limitazione del QR). Non riproporre "aggiungi
ancora una conferma" come se risolvesse il problema: non lo risolve mai
del tutto, per costruzione.

Quello che si può fare, e che questo gioco fa, è **scegliere quale dei due
esiti sbagliati resta possibile** e minimizzarlo, invece di eliminarli
entrambi:
- **Il protocollo è asimmetrico, di proposito (2026-09-17, seconda
  versione)**: il ricevente scrive per primo, appena ha letto abbastanza
  fotogrammi *crescenti* del cedente (`QR_K`, prova che dall'altra parte
  c'è un telefono acceso adesso) e sa di essere stato letto almeno una
  volta (`ack ≥ 1`); poi mostra una schermata verde **persistente** con il
  QR "fatto". Il cedente cancella **solo** dopo aver letto quel QR — o,
  se la lettura automatica non riesce, dopo che il giocatore ha guardato
  con i propri occhi lo schermo verde dell'amico e confrontato un codice
  a 4 lettere (domanda manuale). Così la **perdita** (cancellato da A, mai
  arrivato a B — l'esito peggiore, deciso dal committente) è impossibile
  per costruzione; l'unico residuo è la **duplicazione**, e solo se il
  cedente risponde "No" mentre l'amico è già verde. L'ultimo messaggio
  del protocollo passa dal canale più affidabile che c'è (gli occhi) e
  non ha scadenza.
- **La prima versione era simmetrica** (entrambi scrivevano quando
  entrambi avevano visto l'altro a soglia) e si credeva che "in caso di
  fallimento nessuno scrive". Era falso: fra il primo commit e il secondo
  c'è sempre una finestra in cui uno ha scritto e l'altro deve ancora
  leggere l'ultimo QR — e quella finestra finiva in perdita **o** in
  duplicazione a seconda di chi era più veloce, con il lato bloccato che
  per giunta vedeva "non riuscito, riprova". Il sintomo "bloccato a 4/5
  mentre l'altro dice Fatto" visto sul campo era esattamente questo. Non
  tornare al simmetrico: non è "più prudente", è solo più ambiguo.
- Il confronto fra `Date.now()` dei due telefoni non è mai usato per
  decidere nulla (l'orologio di un telefono non è comparabile con quello
  di un altro senza sincronizzarli, cosa che qui non si fa): la
  freschezza si misura solo con contatori locali crescenti (`seq`) e con
  l'orologio di ciascun telefono confrontato solo a sé stesso (timeout).
- Un QR stampato/fotografato e riusato in un secondo momento (es.
  attaccato a un muro, per duplicare all'infinito senza che nessun amico
  sia davvero lì) non supera mai la soglia: una schermata statica non può
  produrre un contatore che cresce rispondendo in tempo reale a quello che
  l'altro telefono mostra. Per questo "duplicabile" usa lo stesso
  handshake dal vivo di "scambiabile", anche se in teoria non ne
  avrebbe bisogno per evitare perdite (chi condivide non perde nulla):
  serve comunque a provare che dall'altra parte c'è un telefono acceso
  in quel momento, non un'immagine.
- Il rischio residuo di perdita, quando c'è, è accettabile per lo stesso
  motivo già scritto sopra ("Il contesto: chi gioca, con che rischio"):
  meno di 10 amici, nessun incentivo a exploitare un fallimento raro e
  autolimitante. Un vero arbitro (database) lo chiuderebbe del tutto, ma
  è un problema diverso da quello risolto qui — vedi "Perché nessun
  database, per ora".

**`scambiabile`/`duplicabile` esistono solo sui regali** (`daValidare:
false`, interfaccia lo nasconde altrimenti): su un nodo che si ottiene
rifotografando un oggetto reale, chi lo cede potrebbe semplicemente
tornare sul posto e rifotografarlo per riprenderselo — l'oggetto fisico
non sparisce dal mondo cedendone la copia digitale. Un regalo ceduto
(tipo "scambio") viene invece segnato per sempre in un nuovo elenco
`ceduti` nello stato del giocatore, escluso da lì in poi dalla chiusura
automatica dei prerequisiti (`chiudi()`): senza questo, la prima volta
che il giocatore trova qualunque altro oggetto, il regalo ceduto
ricomparirebbe da solo (i suoi prerequisiti restano soddisfatti anche
dopo averlo ceduto), duplicandolo silenziosamente.

## Regali a istanze: interazione obbligatoria senza identità (2026-09-17)

Il modello a nodi, da solo, non può **obbligare** due giocatori a
incontrarsi: ogni nodo è ottenibile da un singolo (fotografando, o
automaticamente dai prerequisiti), lo scambio è sempre una scorciatoia
alternativa. La soluzione scelta è il **regalo a istanze** (`istanze:
true`): ogni telefono che ne soddisfa i prerequisiti produce **una sola**
istanza propria, con un id casuale — e un altro nodo può richiederne
"almeno N *diverse*". Nessuno può produrne due, quindi la seconda deve
arrivare da un altro telefono: l'obbligo nasce dall'unicità della
produzione, non dal sapere chi è chi. Decisioni esplicite del committente,
da non riaprire senza motivo:
- **Istanza, non identità**: l'id distingue le *copie*, non le persone.
  Nessuno sa di chi è `K7X`; il giocatore vede "★ tua" solo sulle proprie.
  Il passo successivo — "questa copia è passata per n telefoni diversi" —
  richiederebbe un token stabile per telefono, cioè un'identità anonima: va
  deciso a parte, non introdotto di nascosto (vedi sezione sotto).
- **Solo `duplicabile`, mai scambiabile**: un'istanza che migra non aumenta
  il conteggio di nessuno, creerebbe solo confusione nel pannello.
- **Copie di copie permesse** ("chiunque"): chi ha ricevuto un'istanza può
  ricondividerla. "N istanze diverse" = "esistono N produttori", non "hai
  incontrato N persone"; per obbligare a incontrare *proprio* il produttore
  si usa la geografia o gli oggetti personali dei giocatori (v. sotto), non
  una regola nel codice.
- **Id a 3 caratteri lettera-cifra-lettera, alfabeto completo** (6760 id,
  ≈0,7 % di collisione fra 10 produttori dello stesso nodo — una collisione
  fa contare un'istanza in meno, mai di più), mostrato **sempre in
  monospaziato** per distinguere I/1 e O/0. Se un giorno servirà più
  margine: minuscole, o un quarto carattere (è l'ultimo byte disponibile
  prima che il QR salga di versione, vedi `docs/STATO.md`).
- **Reset ("Ricomincia la caccia") azzera `prodotti`** e permette di
  riprodurre: stesso buco già accettato per `ceduti`, stesso gruppo di amici.

Idee di trama emerse nella stessa discussione, non codice: la scarsità
può venire dal **mondo fisico** invece che dal database — un oggetto che
sparisce a una certa ora (saracinesca che si apre), o **oggetti personali
dei giocatori** registrati dal master al ritrovo (il portachiavi di A
produce il "sigillo di A": per averlo bisogna incontrare A). In entrambi i
casi: `conThumb` spento sull'oggetto (altrimenti la sua foto è nell'indizio
di tutti e si fotografa dallo schermo) e **mai rimuoverlo dal file** dopo
(un `richiede` verso un id inesistente vale "nessun prerequisito" e
regalerebbe il nodo a tutti).

## Convenzioni dell'interfaccia: HTML nativo e CSS prima del JS (2026-09-18)

Richiesta esplicita del committente, applicata a tutto `index.html` in un
ciclo di refactoring (versioni 55-60) e da rispettare in ogni modifica
futura — non è una preferenza estetica, è ciò che rende il file leggibile
senza seguire il JS:
- **Il markup vive nell'HTML, il JS lo riempie.** Nessun pezzo di
  interfaccia nasce da `createElement` se può stare in un `<template>`
  (righe, schede, festa, messaggi: vedi `docs/STATO.md`, "Convenzioni
  dell'interfaccia") o direttamente nella pagina. I testi con più
  varianti (titoli e messaggi di stato dello scambio, fine caccia) sono
  **tutti** scritti in HTML e il CSS ne mostra uno: il JS non deve
  contenere prosa italiana se non per messaggi con dati dentro.
- **Lo stato visibile è un attributo `data-*` sul contenitore, mai una
  lista di `hidden` accesi e spenti a mano** da più funzioni:
  `body[data-view]`, `#view-player[data-tab][data-sub][data-stato]`,
  `#p-scambio[data-ruolo][data-tipo][data-fase][data-n]`,
  `.scheda-nodo[data-validare]`. Da `data-view` il CSS deriva anche tema
  scuro, larghezza "wide" e schermo pieno: le classi `dark`/`wide`/
  `playing` sul body **non esistono più**, non reintrodurle. `hidden`
  resta legittimo solo per un singolo elemento che dipende da un dato
  (un badge, un "Riprova").
- Elementi nativi dove esistono: `<dialog>` per la lightbox, `<template>`
  per i cloni, `::before` CSS per "elenco vuoto", `:has()` per le
  dipendenze fra campi (il master usa un computer recente, `:has()` è
  accettato).
- **Nessun gancio di test nel file vero** (`window.__test` è stato tolto):
  i test copiano `index.html` e iniettano `window.__debug` solo nella
  copia — vedi `CLAUDE.md` e `tests/scambio.test.mjs`.

- **I clic sono azioni dichiarate** (`data-azione` nell'HTML, funzione con
  lo stesso nome in `AZIONI`, un solo listener delegato — vedi
  `docs/STATO.md`): fatto il 2026-09-18 su richiesta del committente, via
  tutti i 45 `onclick =`. Un bottone nuovo si aggiunge scrivendo
  `data-azione` nel markup e la funzione in `AZIONI`, mai `x.onclick = …`.

Rimaste fuori di proposito, da non "sistemare" senza motivo, e riconfermate
dal committente il 2026-09-18 ("che non si sa mai"): le sedici chiamate a
`stopCamera()`. Alcune difendono dalla "fotocamera incantata" (video
congelato o bottone disabilitato tornando su "Foto"); non si sa quali sono
essenziali e quali ridondanti, e il bug si vede solo con una fotocamera
vera. Si sfoltiscono solo con un test Playwright a fake camera
(`--use-fake-device-for-media-stream`) che ripercorra Foto → Traccia → Foto,
cambio scheda e apertura/chiusura dello scambio.

## Perché nessuna identità dei giocatori, per ora

Scelta esplicita del committente, non una dimenticanza. Stato di
progresso, bottino e messaggi letti vivono solo nel `localStorage` del
singolo telefono, senza nome né account. Introdurla di nascosto (es. per
far funzionare un log lato master) romperebbe questo accordo: quando
servirà davvero (scambio di ricompense fra giocatori, che richiede sapere
"chi è chi"), va riaperta la discussione, non decisa a sorpresa.

## Hosting: GitHub Pages, e perché il repository deve restare pubblico

Scartati prima di arrivare a GitHub Pages: **GitLab dell'INAF**
(self-hosted — il certificato https dei suoi siti Pages non è valido, e
questo impedisce alla fotocamera del browser di funzionare; non
risolvibile lato codice) e **Netlify Drop** (funzionante, ma scomodo per
pubblicazioni ricorrenti senza CLI). GitHub Pages pubblica in https
valido con un semplice `git push`, autenticato con un token di accesso
personale.

**Vincolo importante**: GitHub Pages sui repository privati richiede un
piano a pagamento. Il repository è stato reso privato una volta per
nascondere `caccia.json` e il sito è sparito con un 404. **Il repository
deve restare pubblico** finché non si sceglie un hosting alternativo per
questo scopo specifico — non riproporre "rendilo privato" senza prima
risolvere il problema dell'hosting.

## Il problema noto e accettato: `caccia.json` è uno spoiler leggibile

Chiunque conosca l'indirizzo del sito può leggere in chiaro nome
dell'oggetto, indizio ed eventuali coordinate GPS di un oggetto non
ancora trovato. **Lasciato irrisolto per scelta**: con meno di 10 amici
il rischio è stato giudicato basso rispetto al costo di risolverlo bene
(richiede un database, con indizi cifrati sbloccati al momento giusto).
Se il gruppo di giocatori cambia natura, va riconsiderato.

## Regole del modello dati `caccia-3` ancora valide

- **Ogni nodo nasce dalla cattura sul campo** (foto oggetto + foto
  dintorni come negativi + posizione GPS, sempre tutte e tre, qualunque
  sia l'uso che se ne farà poi): non esiste un modo di creare un nodo
  scrivendo solo testo da un computer, nemmeno per un premio "sintetico".
- **`formato` (versione dello schema) e slug (nome del file) sono
  concetti indipendenti**, tenuti deliberatamente separati: non farli mai
  coincidere per convenzione informale.
- **`richiede` verso un id di nodo non più esistente non blocca mai
  nulla**: trattato ovunque come "nessun prerequisito", stessa regola
  usata dal controllo anti-ciclo prima di pubblicare.
- **"caccia" è un nome riservato** per lo slug: collide con la caccia di
  sempre, rifiutato esplicitamente se scelto per una caccia con nome.
- **Un link diretto `#c-<slug>` salta sempre la schermata di scelta**,
  di proposito — pensato per condividere link diversi a gruppi diversi.

## Non riproporre senza che sia richiesto di nuovo

- **Pulsante di condivisione su Instagram** nella schermata di fine
  caccia: implementato su richiesta esplicita, poi tolto ("non mi
  piace"). Se serve di nuovo condivisione social, chiedere prima che
  forma preferisce.
