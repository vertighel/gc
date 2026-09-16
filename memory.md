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
giocatore (log attività, scambio ricompense) richiede un database vero
(quasi certamente Supabase, vedi `docs/ROADMAP.md`), perché un hosting
statico non accetta scritture concorrenti.

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
