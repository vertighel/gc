// Test a tavolino dei BIVI (`bivio`) e della CONVERGENZA (`richiedeUno`), senza
// fotocamera: una sola pagina Playwright fa da telefono e i ritrovamenti si simulano
// chiamando chiudiEAggiorna(st, [id]) come farebbe una foto riuscita (o, per un regalo,
// una ricezione da un altro telefono: è la stessa chiamata di scambioRiuscito). Verifica:
// il primo validato di un bivio blocca gli altri (spariscono da Traccia, il ramo a valle
// muore da sé), un nodo già posseduto non si perde, il contatore "Trovati N di M" conta
// solo ciò che è ancora raggiungibile, la fine caccia arriva quando il ramo scelto è
// completo, l'epilogo in OR (richiedeUno) si sblocca da un ramo qualunque, il
// "contrabbando" (un regalo ricevuto dall'altro ramo lo apre da lì in poi, la foto
// esclusa resta esclusa), alternative a profondità diverse, il numero del bivio nel
// markup di Traccia (data-bivio + badge) ma nascosto dal CSS, e i controlli di
// pubblicazione (biviImpossibili, trovaCiclo attraverso richiedeUno).
// NON verifica il pannello del master (tendina "Bivio", elenco "Richiede almeno uno di",
// Grafo): quello si guarda a mano.
//
// Come si lancia (serve playwright con chromium installato, es. `npm i playwright &&
// npx playwright install chromium` in una cartella qualunque, poi da lì):
//     node /percorso/gc/tests/bivio.test.mjs
// Non tocca il repository: copia index.html in una cartella temporanea, SOLO lì
// aggiunge in fondo un `window.__debug` con le funzioni interne da pilotare (mai nel
// file vero, vedi docs/DECISIONI.md), scrive un caccia.json finto e serve tutto con
// `python3 -m http.server` su una porta libera. Ogni scenario apre un browser context
// nuovo: localStorage pulito, nessuno stato da azzerare a mano.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "gc-test-"));
let html = readFileSync(join(repo, "index.html"), "utf8");
html = html.replace("window.__avviato = true;", `
window.__debug = {
  stato, saveState, chiudiEAggiorna, renderPlayer, daTrovare, mancanoIstanze, chiudi,
  bloccato, unoSoddisfatto, raggiungibili, biviImpossibili, trovaCiclo, aggiornaProgresso,
  get game() { return game; },
};
window.__avviato = true;`);
writeFileSync(join(dir, "index.html"), html);

// Grafo di prova. Bivio 1: due porte alla radice, ciascuna apre un ramo (chiave 🎁
// duplicabile → stanza 📷 → fine 🎁) e l'epilogo si sblocca con UNA delle due fini
// (richiedeUno). Bivio 2 a profondità diverse: confessionale alla radice, cassaforte
// dietro il tronco. Il tronco non appartiene a nessun bivio.
const v = { m: 0.2, q: Buffer.from([1, 2, 3, 4]).toString("base64") };
const nodo = (extra) => ({ messaggio: "", testo: "", conThumb: false, richiedePosizione: false, pos: [v], neg: [v], soglia: 0.5, ...extra });
writeFileSync(join(dir, "caccia.json"), JSON.stringify({ formato: "caccia-3", creato: "2026-09-20T00:00:00Z", nodi: {
  portaA: nodo({ nome: "Porta A", richiede: [], daValidare: true, bivio: 1 }),
  portaB: nodo({ nome: "Porta B", richiede: [], daValidare: true, bivio: 1 }),
  chiaveA: nodo({ nome: "Chiave A", messaggio: "chiave A", richiede: ["portaA"], daValidare: false, duplicabile: true }),
  chiaveB: nodo({ nome: "Chiave B", messaggio: "chiave B", richiede: ["portaB"], daValidare: false, duplicabile: true }),
  stanzaA: nodo({ nome: "Stanza A", richiede: ["chiaveA"], daValidare: true }),
  stanzaB: nodo({ nome: "Stanza B", richiede: ["chiaveB"], daValidare: true }),
  fineA: nodo({ nome: "Fine A", messaggio: "finale A", richiede: ["stanzaA"], daValidare: false }),
  fineB: nodo({ nome: "Fine B", messaggio: "finale B", richiede: ["stanzaB"], daValidare: false }),
  epilogo: nodo({ nome: "Epilogo", messaggio: "epilogo", richiede: [], richiedeUno: ["fineA", "fineB"], daValidare: false }),
  tronco: nodo({ nome: "Tronco", richiede: [], daValidare: true }),
  cassaforte: nodo({ nome: "Cassaforte", richiede: ["tronco"], daValidare: true, bivio: 2 }),
  confessionale: nodo({ nome: "Confessionale", richiede: [], daValidare: true, bivio: 2 }),
} }));
writeFileSync(join(dir, "messaggi.json"), "[]");
writeFileSync(join(dir, "cacce.json"), "[]");

const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn("python3", ["-m", "http.server", String(port)], { cwd: dir, stdio: "ignore" });
const URL = `http://localhost:${port}/index.html`;
// Aspetta che il server risponda davvero (un'attesa fissa a volte non bastava).
for (let i = 0; ; i++) {
  try { if ((await fetch(URL)).ok) break; } catch {}
  if (i > 50) throw new Error("il server di prova non risponde");
  await new Promise(r => setTimeout(r, 100));
}

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

async function telefono(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await ctx.addInitScript(() => { try { localStorage.setItem("caccia-scelta", '""'); } catch {} });
  await page.goto(URL);
  await page.waitForFunction(() => window.__avviato && window.__debug && window.__debug.game);
  return page;
}
// Simula un ritrovamento (o, per un regalo, una ricezione): chiude, salva, ridisegna.
// Ritorna gli id festeggiati, nell'ordine in cui chiudiEAggiorna li dà.
const trova = (p, ids) => p.evaluate(ids => { const d = window.__debug; const st = d.stato(); const n = d.chiudiEAggiorna(st, ids); d.saveState(st); d.renderPlayer(); return n.map(x => x.id); }, ids);
const stato = p => p.evaluate(() => window.__debug.stato());
const todo = p => p.evaluate(() => window.__debug.daTrovare(window.__debug.stato()).map(m => m.id).sort());
const progresso = p => p.evaluate(() => { window.__debug.renderPlayer(); return document.getElementById("p-progress").textContent.trim(); });
const bloccato = (p, id) => p.evaluate(id => { const d = window.__debug; return d.bloccato(d.game.nodi, id, new Set(d.stato().trovati)); }, id);
const manca = p => p.evaluate(() => window.__debug.mancanoIstanze(window.__debug.stato()));
const vista = p => p.evaluate(() => { const v = document.getElementById("view-player"); return { stato: v.dataset.stato, fine: v.dataset.fine }; });
// Le righe di Traccia: per ogni <li> di #p-todo-list, l'id (data-id del bottone), il
// data-bivio del <li>, il testo del badge e se il badge si vede davvero.
const righe = p => p.evaluate(() => { window.__debug.renderPlayer(); return [...document.querySelectorAll("#p-todo-list li")].map(li => { const b = li.querySelector("button"), badge = li.querySelector(".badge"); return { id: b.dataset.id, bivio: li.dataset.bivio || null, badge: badge ? badge.textContent : null, visibile: !!badge && getComputedStyle(badge).display !== "none" && badge.offsetParent !== null }; }); });
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const browser = await chromium.launch();

// ---- 1. avvio: le due porte, il tronco e il confessionale; le porte segnate bivio 1, il confessionale no
{
  const p = await telefono(browser);
  ok(uguali(await todo(p), ["confessionale", "portaA", "portaB", "tronco"]), "[1] Traccia all'avvio: portaA, portaB, tronco, confessionale");
  ok((await progresso(p)) === "Trovati 0 di 7", "[1] progresso 'Trovati 0 di 7' (tutti i 7 nodi da fotografare raggiungibili)");
  const r = await righe(p);
  const per = Object.fromEntries(r.map(x => [x.id, x]));
  ok(per.portaA && per.portaA.bivio === "1" && per.portaB && per.portaB.bivio === "1", "[1] le righe delle porte portano data-bivio=\"1\"");
  ok(per.confessionale && per.confessionale.bivio === null && per.tronco && per.tronco.bivio === null, "[1] confessionale (alternativa sola in Traccia) e tronco senza data-bivio");
  ok(per.portaA.badge === "1️⃣" && per.portaA.visibile === false, "[1] il badge 1️⃣ c'è nel markup ma il CSS lo nasconde");
  ok(!(await bloccato(p, "portaA")) && !(await bloccato(p, "portaB")), "[1] nessuna porta bloccata prima della scelta");
  await p.context().close();
}

// ---- 2. A poi B: la porta B sparisce, il ramo B muore, l'epilogo arriva via fineA, fine caccia
{
  const p = await telefono(browser);
  const n1 = await trova(p, ["portaA"]);
  ok(uguali([...n1].sort(), ["chiaveA", "portaA"]), "[2] portaA → festeggia portaA e chiaveA");
  ok(uguali(await todo(p), ["confessionale", "stanzaA", "tronco"]), "[2] Traccia: portaB sparita, stanzaA entrata");
  ok(await bloccato(p, "portaB"), "[2] portaB bloccata");
  ok((await progresso(p)) === "Trovati 1 di 5", "[2] progresso 'Trovati 1 di 5' (portaB e stanzaB fuori dal conto)");
  ok((await manca(p)).length === 0, "[2] mancanoIstanze vuoto: il ramo morto non chiede nulla");
  const n2 = await trova(p, ["stanzaA"]);
  ok(uguali([...n2].sort(), ["epilogo", "fineA", "stanzaA"]), "[2] stanzaA → fineA ed epilogo insieme (richiedeUno soddisfatto da fineA)");
  const st = await stato(p);
  ok(st.bottino.some(r => r.nodo === "epilogo") && st.bottino.some(r => r.nodo === "fineA") && !st.bottino.some(r => r.nodo === "fineB"), "[2] bottino: fineA ed epilogo, non fineB");
  await trova(p, ["tronco"]);
  ok(uguali(await todo(p), ["cassaforte", "confessionale"]), "[2] dopo il tronco: cassaforte e confessionale insieme in Traccia");
  const r = await righe(p); const per = Object.fromEntries(r.map(x => [x.id, x]));
  ok(per.cassaforte.bivio === "2" && per.confessionale.bivio === "2" && per.cassaforte.badge === "2️⃣", "[2] ora entrambe le alternative del bivio 2 portano data-bivio=\"2\" e badge 2️⃣");
  await trova(p, ["cassaforte"]);
  ok(uguali(await todo(p), []), "[2] cassaforte → confessionale sparisce, niente più da fotografare");
  ok((await progresso(p)) === "Trovati 4 di 4", "[2] progresso 'Trovati 4 di 4'");
  const v = await vista(p);
  ok(v.stato === "fine" && v.fine === "tutto", "[2] schermata di fine: 'Hai trovato tutto'");
  // ---- 7. un nodo posseduto non si perde
  const c = await p.evaluate(() => { const d = window.__debug; const st = d.stato(); return [...d.chiudi(d.game.nodi, st.trovati, st.ceduti)]; });
  ok(c.includes("chiaveA") && c.includes("portaA") && c.includes("epilogo"), "[7] chiudi() ricalcolato conserva chiaveA, portaA, epilogo");
  const forzato = await p.evaluate(() => { const d = window.__debug; const st = d.stato(); st.trovati.push("portaB"); d.saveState(st); d.renderPlayer(); const dopo = d.stato(); return { trovati: dopo.trovati, todo: d.daTrovare(dopo).map(m => m.id), bloccatoA: d.bloccato(d.game.nodi, "portaA", new Set(dopo.trovati)) }; });
  // Con portaB posseduta si deriva chiaveB e stanzaB entra in Traccia: possedere apre, mai chiude.
  ok(forzato.trovati.includes("portaA") && forzato.trovati.includes("portaB") && uguali(forzato.todo, ["stanzaB"]), "[7] portaB forzata in trovati (file vecchio): portaA resta, il ramo B si apre");
  ok(forzato.bloccatoA === false, "[7] un nodo già posseduto non risulta bloccato");
  await p.context().close();
}

// ---- 3. B poi A: simmetrico, epilogo via fineB
{
  const p = await telefono(browser);
  const n1 = await trova(p, ["portaB"]);
  ok(uguali([...n1].sort(), ["chiaveB", "portaB"]), "[3] portaB → festeggia portaB e chiaveB");
  ok(uguali(await todo(p), ["confessionale", "stanzaB", "tronco"]), "[3] Traccia: portaA sparita, stanzaB entrata");
  ok(await bloccato(p, "portaA") && !(await bloccato(p, "portaB")), "[3] portaA bloccata, portaB no");
  ok((await progresso(p)) === "Trovati 1 di 5", "[3] progresso 'Trovati 1 di 5'");
  const n2 = await trova(p, ["stanzaB"]);
  ok(uguali([...n2].sort(), ["epilogo", "fineB", "stanzaB"]), "[3] stanzaB → fineB ed epilogo insieme");
  await p.context().close();
}

// ---- 4. contrabbando: chiaveB ricevuta da un amico dopo aver scelto A apre stanzaB, non portaB
{
  const p = await telefono(browser);
  await trova(p, ["portaA"]);
  const n = await trova(p, ["chiaveB"]); // ricezione simulata: stessa chiamata di scambioRiuscito
  ok(n.includes("chiaveB"), "[4] chiaveB ricevuta viene festeggiata");
  ok(uguali(await todo(p), ["confessionale", "stanzaA", "stanzaB", "tronco"]), "[4] stanzaB entra in Traccia, portaB resta fuori");
  ok(await bloccato(p, "portaB"), "[4] portaB ancora bloccata");
  ok((await progresso(p)) === "Trovati 1 di 6", "[4] progresso 'Trovati 1 di 6' (stanzaB torna nel conto, portaB no)");
  await trova(p, ["stanzaB"]);
  const st = await stato(p);
  ok(st.bottino.some(r => r.nodo === "fineB") && st.bottino.some(r => r.nodo === "epilogo"), "[4] via il ramo contrabbandato si arriva a fineB e all'epilogo");
  await p.context().close();
}

// ---- 5. bivio a profondità diverse: il primo validato vince, ovunque stia
{
  const p = await telefono(browser);
  await trova(p, ["confessionale"]);
  ok(!(await todo(p)).includes("cassaforte"), "[5a] confessionale → cassaforte non c'è (tronco non ancora trovato)");
  await trova(p, ["tronco"]);
  ok(!(await todo(p)).includes("cassaforte") && await bloccato(p, "cassaforte"), "[5a] anche dopo il tronco la cassaforte non compare: bloccata");
  ok((await progresso(p)) === "Trovati 2 di 6", "[5a] progresso 'Trovati 2 di 6' (solo la cassaforte fuori)");
  await p.context().close();

  const q = await telefono(browser);
  await trova(q, ["tronco"]);
  ok(uguali(await todo(q), ["cassaforte", "confessionale", "portaA", "portaB"]), "[5b] tronco → cassaforte e confessionale entrambi in Traccia");
  await trova(q, ["cassaforte"]);
  ok(!(await todo(q)).includes("confessionale") && await bloccato(q, "confessionale"), "[5b] cassaforte → confessionale sparisce");
  ok((await progresso(q)) === "Trovati 2 di 6", "[5b] progresso 'Trovati 2 di 6'");
  await q.context().close();
}

// ---- 6. controlli di pubblicazione e predicati sui casi limite
{
  const p = await telefono(browser);
  ok((await p.evaluate(() => window.__debug.biviImpossibili(window.__debug.game.nodi))) === null, "[6] biviImpossibili: null sul grafo di prova");
  const msg = await p.evaluate(() => window.__debug.biviImpossibili({ a: { nome: "Alfa", bivio: 3, richiede: [] }, b: { nome: "Beta", bivio: 3, richiede: ["a"] } }));
  ok(typeof msg === "string" && msg.includes("Alfa") && msg.includes("Beta"), "[6] biviImpossibili: stesso bivio di un antenato → messaggio con entrambi i nomi");
  const msg2 = await p.evaluate(() => window.__debug.biviImpossibili({ a: { nome: "Alfa", bivio: 3, richiede: [] }, m: { nome: "Mezzo", richiede: ["a"] }, b: { nome: "Beta", bivio: 3, richiede: [], richiedeUno: ["m"] } }));
  ok(typeof msg2 === "string" && msg2.includes("Alfa") && msg2.includes("Beta"), "[6] biviImpossibili: antenato a catena attraverso richiedeUno");
  const ciclo = await p.evaluate(() => window.__debug.trovaCiclo({ a: { nome: "A", richiede: [], richiedeUno: ["b"] }, b: { nome: "B", richiede: ["a"] } }));
  ok(Array.isArray(ciclo) && ciclo.length === 2, "[6] trovaCiclo vede il ciclo che passa da richiedeUno");
  const uno = await p.evaluate(() => { const d = window.__debug; const nodi = { a: { richiede: [] }, x: { richiede: [], richiedeUno: ["fantasma"] }, y: { richiede: [], richiedeUno: ["a", "fantasma"] } }; return [d.unoSoddisfatto(nodi, nodi.x, new Set()), d.unoSoddisfatto(nodi, nodi.y, new Set()), d.unoSoddisfatto(nodi, nodi.y, new Set(["a"])), d.unoSoddisfatto(nodi, nodi.a, new Set())]; });
  ok(uno[0] === true && uno[1] === false && uno[2] === true && uno[3] === true, "[6] unoSoddisfatto: solo id inesistenti → true; misto → serve uno esistente; assente → true");
  const rag = await p.evaluate(() => { const d = window.__debug; return [...d.raggiungibili(d.game.nodi, new Set(["portaA"]))].sort(); });
  ok(!rag.includes("portaB") && !rag.includes("chiaveB") && !rag.includes("stanzaB") && !rag.includes("fineB") && rag.includes("epilogo") && rag.includes("cassaforte") && rag.includes("confessionale"), "[6] raggiungibili da {portaA}: ramo B fuori, epilogo dentro (via fineA), bivio 2 ancora aperto");
  await p.context().close();
}

await browser.close();
server.kill();
console.log(fails ? `\n${fails} FAIL` : "\nTUTTO OK");
process.exit(fails ? 1 : 0);
