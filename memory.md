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
