// Segnaposto: il master costruisce il grafo PRIMA (elementi senza foto) e va sul campo
// DOPO a riempirlo. Un segnaposto è un nodo con `pos` vuoto; nel pannello master si tocca
// un elemento della lista (diventa il "bersaglio") e la cattura Oggetto/Dintorni/Aggiungi
// scrive la foto dentro quel nodo invece di crearne uno nuovo — lo stesso gesto rifà la
// foto a un elemento che ce l'ha già (con conferma). Pubblicare e "Prova su questo
// telefono" restano bloccati finché un elemento da validare è senza foto; un regalo
// (daValidare:false) senza foto va bene. Il giocatore, su una bozza con un segnaposto,
// riceve un messaggio chiaro invece di un confronto col vuoto.
//
// A tavolino: niente fotocamera — la cattura è simulata scrivendo M.pos/M.neg/M.cal
// come li lascerebbe record(); l'API di GitHub è finta (il PUT scrive davvero nella
// cartella servita). NON prova il riconoscimento né la cattura reale. Non tocca il
// repository: copia index.html in una cartella temporanea e SOLO lì aggiunge un
// `window.__debug` (mai nel file vero, vedi docs/DECISIONI.md). Si lancia con
//   node tests/segnaposto.test.mjs
// da una cartella dove "playwright" (con Chromium) è installato.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const WWW = mkdtempSync(join(tmpdir(), "gc-segnaposto-")) + "/";
let html = readFileSync(join(repo, "index.html"), "utf8");
html = html.replace("window.__avviato = true;", `
window.__debug = {
  get L() { return L; }, get M() { return M; },
  senzaFoto, elementiSenzaFoto, publishGame, currentGame, renderPanelList, iconaNodo, shoot, stato, saveState, store, newId, masterRefresh,
  get game() { return game; },
};
window.__avviato = true;`);
writeFileSync(WWW + "index.html", html);
writeFileSync(WWW + "messaggi.json", "[]");
writeFileSync(WWW + "cacce.json", "[]");
// Un nodo CON foto (obj1), nella caccia pubblicata di default (slug "").
const v = { m: 0.2, q: Buffer.from([1, 2, 3, 4]).toString("base64") };
const nodo = (extra) => ({ nome: "x", testo: "", messaggio: "", conThumb: true, richiedePosizione: false, immagine: "data:image/png;base64,iVBORw0KGgo=", pos: [v], neg: [v], soglia: 0.5, luogo: null, daValidare: true, scambiabile: false, duplicabile: false, richiede: [], ...extra });
const scriviCaccia = nodi => writeFileSync(WWW + "caccia.json", JSON.stringify({ formato: "caccia-3", creato: "2026-09-20T00:00:00Z", nodi }));
scriviCaccia({ obj1: nodo({ nome: "Portone" }) });

const PORT = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: WWW, stdio: "ignore" });
const PAGINA = `http://localhost:${PORT}/index.html`;
for (let i = 0; ; i++) {
  try { if ((await fetch(PAGINA)).ok) break; } catch {}
  if (i > 50) throw new Error("il server di prova non risponde");
  await new Promise(r => setTimeout(r, 100));
}

let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
let puts = 0; // PUT ricevute dall'API finta, per verificare che un controllo fallito non pubblichi
const b = await chromium.launch();

// Un pannello master in un contesto nuovo (localStorage pulito: nessuna bozza locale,
// quindi carica caccia.json). Le finestre di dialogo si rispondono con pg.rispostaDialog.
async function master() {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.route("https://api.github.com/**", async route => {
    const req = route.request(); const path = new URL(req.url()).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, "");
    if (req.method() === "PUT") { puts++; const body = req.postDataJSON(); writeFileSync(WWW + path, Buffer.from(body.content, "base64").toString("utf8")); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { sha: "n" } }) }); }
    return route.fulfill({ status: existsSync(WWW + path) ? 200 : 404, contentType: "application/json", body: JSON.stringify({ sha: "s" }) });
  });
  await ctx.addInitScript(() => { try { localStorage.setItem("gh-config", JSON.stringify({ owner: "o", repo: "r", branch: "main", path: "caccia.json", token: "t" })); } catch {} });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => console.log("PAGEERROR", e.message));
  pg.dialogs = []; pg.rispostaDialog = true;
  pg.on("dialog", d => { pg.dialogs.push(d.message()); pg.rispostaDialog ? d.accept() : d.dismiss(); });
  await pg.goto(PAGINA + "#master");
  await pg.waitForFunction(() => window.__avviato && window.__debug && window.__debug.M.baseLoaded && window.__debug.L.nodi);
  await pg.waitForTimeout(300);
  return pg;
}
const clic = (pg, sel) => pg.evaluate(sel => { const el = document.querySelector(sel); if (!el) throw new Error("manca " + sel); el.click(); }, sel).then(() => pg.waitForTimeout(150));
const nodi = pg => pg.evaluate(() => JSON.parse(JSON.stringify(window.__debug.L.nodi)));
const ids = pg => pg.evaluate(() => Object.keys(window.__debug.L.nodi));
const bersaglio = pg => pg.evaluate(() => window.__debug.M.bersaglio);
const testo = (pg, sel) => pg.evaluate(sel => (document.querySelector(sel) || {}).textContent, sel).then(t => (t || "").replace(/\s+/g, " ").trim());
const nascosto = (pg, sel) => pg.evaluate(sel => { const el = document.querySelector(sel); return !el || el.hidden || getComputedStyle(el).display === "none"; }, sel);
// Le righe della lista del pannello: id (data-id del bottone), data-foto del <li>, aria-current.
const righe = pg => pg.evaluate(() => [...document.querySelectorAll("#m-panel-list li")].map(li => { const bt = li.querySelector('button[data-azione="bersaglio-foto"]'); return { id: bt ? bt.dataset.id : null, foto: li.dataset.foto || null, corrente: !!bt && bt.getAttribute("aria-current") === "true" }; }));
// Cattura simulata: M come lo lascia record() + recalibrate() (pos/neg già nel formato del file).
const cattura = pg => pg.evaluate(() => { const M = window.__debug.M; M.pos = [{ m: 0.2, q: "AQIDBA==" }]; M.neg = [{ m: 0.2, q: "AQIDBA==" }]; M.cal = { soglia: 0.5 }; M.immagine = "data:image/png;base64,iVBORw0KGgo="; M.luogo = null; window.__debug.masterRefresh(); });
const segnaposti = pg => pg.evaluate(() => Object.entries(window.__debug.L.nodi).filter(([, n]) => window.__debug.senzaFoto(n)).map(([id]) => id));

// ---- 1. due segnaposti dal pannello, senza fotocamera
{
  const pg = await master();
  ok((await ids(pg)).length === 1, "[1] il pannello parte con il solo obj1 della caccia pubblicata");
  ok(!(await pg.evaluate(() => document.getElementById("m-add-placeholder").disabled)), "[1] 'Aggiungi un segnaposto' è attivo anche senza fotocamera");
  await clic(pg, "#m-add-placeholder"); await clic(pg, "#m-add-placeholder");
  const n = await nodi(pg); const seg = await segnaposti(pg);
  ok(Object.keys(n).length === 3 && seg.length === 2, "[1] due nodi in più, entrambi senza foto");
  ok(seg.every(id => Array.isArray(n[id].pos) && n[id].pos.length === 0 && n[id].immagine === null && n[id].soglia === null && n[id].daValidare === true && Array.isArray(n[id].richiede)), "[1] segnaposto: pos vuoto, immagine e soglia null, da validare, richiede []");
  ok(seg.map(id => n[id].nome).sort().join() === "Elemento-2,Elemento-3", "[1] nomi Elemento-2 ed Elemento-3 — " + seg.map(id => n[id].nome).join());
  const r = await righe(pg);
  ok(r.length === 3 && r[0].foto === "no" && r[1].foto === "no" && r[2].id === "obj1" && r[2].foto === null, "[1] lista: i segnaposti in testa con data-foto=\"no\", obj1 senza — " + JSON.stringify(r));
  ok(await pg.evaluate(id => window.__debug.iconaNodo(window.__debug.L.nodi[id]).icona.includes("❓"), seg[0]), "[1] iconaNodo del segnaposto contiene ❓");
  ok(!(await pg.evaluate(() => window.__debug.iconaNodo(window.__debug.L.nodi.obj1).icona.includes("❓"))), "[1] iconaNodo di obj1 (con foto) senza ❓");
  ok((await testo(pg, "#m-cap-registra")) === "Registra un nuovo elemento", "[1] titolo 'Registra un nuovo elemento' senza bersaglio");
  ok(await nascosto(pg, "#m-bersaglio-x"), "[1] la × del bersaglio è nascosta senza bersaglio");
  ok(!(await ids(pg)).some(id => !/^n/.test(id) && id !== "obj1"), "[1] gli id nuovi vengono da newId('n')");
  await pg.context().close();
}

// ---- 2. scegliere e annullare il bersaglio
{
  const pg = await master();
  await clic(pg, "#m-add-placeholder"); await clic(pg, "#m-add-placeholder");
  const [primo] = (await righe(pg)).map(r => r.id);
  const nome = await pg.evaluate(id => window.__debug.L.nodi[id].nome, primo);
  await clic(pg, `#m-panel-list button[data-id="${primo}"]`);
  ok((await bersaglio(pg)) === primo, "[2] toccare la riga imposta M.bersaglio");
  const r = await righe(pg);
  ok(r.filter(x => x.corrente).length === 1 && r.find(x => x.id === primo).corrente, "[2] aria-current sulla sola riga del bersaglio");
  ok((await testo(pg, "#m-cap-registra")) === `Foto per: ${nome}`, "[2] titolo 'Foto per: " + nome + "'");
  ok((await testo(pg, "#m-add")) === `Salva la foto su ${nome}`, "[2] bottone 'Salva la foto su " + nome + "'");
  ok(!(await nascosto(pg, "#m-bersaglio-x")), "[2] la × del bersaglio si vede");
  await clic(pg, `#m-panel-list button[data-id="${primo}"]`);
  ok((await bersaglio(pg)) === null && (await testo(pg, "#m-cap-registra")) === "Registra un nuovo elemento" && (await testo(pg, "#m-add")) === "Aggiungi", "[2] secondo tocco sulla stessa riga: bersaglio tolto, titolo e bottone tornano");
  ok(!(await righe(pg)).some(x => x.corrente), "[2] nessuna riga corrente dopo l'annullamento");
  await clic(pg, `#m-panel-list button[data-id="${primo}"]`); await clic(pg, "#m-bersaglio-x");
  ok((await bersaglio(pg)) === null && (await nascosto(pg, "#m-bersaglio-x")), "[2] la × toglie il bersaglio e si nasconde");
  await pg.context().close();
}

// ---- 3. la cattura atterra sul segnaposto scelto, che tiene nome e collegamenti
{
  const pg = await master();
  await clic(pg, "#m-add-placeholder");
  const [seg] = await segnaposti(pg);
  await pg.evaluate(id => { window.__debug.L.nodi[id].nome = "Porta A"; window.__debug.L.nodi[id].richiede = ["obj1"]; window.__debug.renderPanelList(); }, seg);
  const quanti = (await ids(pg)).length;
  await clic(pg, `#m-panel-list button[data-id="${seg}"]`);
  await cattura(pg);
  ok(!(await pg.evaluate(() => document.getElementById("m-add").disabled)), "[3] dopo la cattura il bottone è attivo");
  await clic(pg, "#m-add");
  const n = (await nodi(pg))[seg];
  ok(n.pos.length === 1 && n.neg.length === 1 && n.soglia === 0.5 && typeof n.immagine === "string" && n.immagine.startsWith("data:"), "[3] la foto è finita nel segnaposto: pos, neg, soglia, immagine");
  ok((await ids(pg)).length === quanti, "[3] nessun nodo nuovo creato");
  ok(n.nome === "Porta A" && n.richiede.join() === "obj1" && n.daValidare === true, "[3] nome e collegamenti conservati");
  ok((await bersaglio(pg)) === null, "[3] il bersaglio si azzera dopo il salvataggio");
  ok((await righe(pg)).find(x => x.id === seg).foto === null, "[3] la riga non è più segnata senza foto");
  ok((await pg.evaluate(() => window.__debug.M.pos.length === 0 && window.__debug.M.cal === null)), "[3] M ripulito come dopo un 'Aggiungi' normale");
  ok((await pg.evaluate(() => JSON.parse(localStorage.getItem("m-lavoro")).nodi))[seg].pos.length === 1, "[3] autosalvataggio locale aggiornato (interoperabilità con Salva bozza)");
  await pg.context().close();
}

// ---- 4. rifare la foto a un elemento che ce l'ha già: conferma
{
  const pg = await master();
  const prima = (await nodi(pg)).obj1.pos;
  await clic(pg, '#m-panel-list button[data-id="obj1"]');
  await cattura(pg);
  pg.rispostaDialog = false; pg.dialogs = [];
  await clic(pg, "#m-add");
  ok(pg.dialogs.length === 1 && /Sostituire la foto di/.test(pg.dialogs[0]) && /Portone/.test(pg.dialogs[0]), "[4] chiede 'Sostituire la foto di Portone?' — " + JSON.stringify(pg.dialogs));
  ok(JSON.stringify((await nodi(pg)).obj1.pos) === JSON.stringify(prima), "[4] Annulla: obj1 invariato");
  ok((await bersaglio(pg)) === "obj1", "[4] Annulla: il bersaglio resta");
  ok((await ids(pg)).length === 1, "[4] Annulla: nessun nodo nuovo");
  pg.rispostaDialog = true; pg.dialogs = [];
  await cattura(pg);
  await clic(pg, "#m-add");
  const dopo = (await nodi(pg)).obj1;
  ok(pg.dialogs.length === 1 && dopo.pos.length === 1 && dopo.pos[0].q === "AQIDBA==" && dopo.soglia === 0.5, "[4] OK: foto sostituita");
  ok((await bersaglio(pg)) === null && (await ids(pg)).length === 1, "[4] OK: bersaglio azzerato, sempre un solo nodo");
  await pg.context().close();
}

// ---- 5. senza bersaglio, 'Aggiungi' crea un nodo nuovo come oggi
{
  const pg = await master();
  const quanti = (await ids(pg)).length;
  await cattura(pg);
  ok((await testo(pg, "#m-add")) === "Aggiungi", "[5] senza bersaglio il bottone dice 'Aggiungi'");
  await clic(pg, "#m-add");
  const n = await nodi(pg);
  ok(Object.keys(n).length === quanti + 1, "[5] un nodo in più");
  const nuovo = Object.entries(n).find(([id]) => id !== "obj1")[1];
  ok(nuovo && nuovo.pos.length === 1 && nuovo.soglia === 0.5 && /^Oggetto-/.test(nuovo.nome), "[5] il nuovo nodo ha la foto e il nome 'Oggetto-N'");
  await pg.context().close();
}

// ---- 6. controlli: un segnaposto da validare blocca Pubblica e Prova; un regalo senza foto no
{
  const pg = await master();
  await clic(pg, "#m-add-placeholder"); await clic(pg, "#m-add-placeholder");
  const seg = await segnaposti(pg);
  const nomiSeg = await pg.evaluate(ids => ids.map(id => window.__debug.L.nodi[id].nome), seg);
  const mancanti = await pg.evaluate(() => window.__debug.elementiSenzaFoto(window.__debug.L.nodi));
  ok(mancanti.length === 2 && nomiSeg.every(x => mancanti.includes(x)), "[6] elementiSenzaFoto elenca i due segnaposti — " + JSON.stringify(mancanti));
  puts = 0;
  const esito = await pg.evaluate(() => window.__debug.publishGame(document.getElementById("m-link-status")));
  const msg = await testo(pg, "#m-link-status");
  ok(esito === false && /Elemento-3/.test(msg) && /Elemento-2/.test(msg), "[6] publishGame rifiuta e nomina i segnaposti — " + msg);
  ok(puts === 0, "[6] nessuna PUT sull'API");
  await clic(pg, "#m-local");
  ok((await pg.evaluate(() => localStorage.getItem("prova"))) === null, "[6] Prova su questo telefono non parte");
  ok(/Elemento-3/.test(await testo(pg, "#m-link-status")), "[6] ...e spiega perché nel m-link-status");
  ok((await pg.evaluate(() => location.hash)) === "#master", "[6] si resta nel pannello");
  await pg.evaluate(ids => { for (const id of ids) window.__debug.L.nodi[id].daValidare = false; }, seg);
  ok((await pg.evaluate(() => window.__debug.elementiSenzaFoto(window.__debug.L.nodi))).length === 0, "[6] come regali, i segnaposti non contano");
  const esito2 = await pg.evaluate(() => window.__debug.publishGame(document.getElementById("m-link-status")));
  ok(esito2 === true && puts >= 1, "[6] con i regali senza foto si pubblica (PUT ricevuta)");
  const pubblicata = JSON.parse(readFileSync(WWW + "caccia.json", "utf8"));
  ok(seg.every(id => pubblicata.nodi[id] && pubblicata.nodi[id].pos.length === 0 && pubblicata.nodi[id].daValidare === false), "[6] il file pubblicato contiene i regali senza foto");
  await pg.context().close();
}

// ---- 7. giocatore su una caccia con un segnaposto da validare (es. bozza): messaggio chiaro
{
  scriviCaccia({ seg: nodo({ nome: "Porta A", immagine: null, pos: [], neg: [], soglia: null }) });
  const ctx = await b.newContext();
  const pg = await ctx.newPage();
  pg.on("pageerror", e => console.log("PAGEERROR", e.message));
  await ctx.addInitScript(() => { try { localStorage.setItem("caccia-scelta", '""'); } catch {} });
  await pg.goto(PAGINA);
  await pg.waitForFunction(() => window.__avviato && window.__debug && window.__debug.game);
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.__debug.senzaFoto(window.__debug.game.nodi.seg)), "[7] il giocatore riconosce il segnaposto");
  ok((await pg.evaluate(() => [...document.querySelectorAll("#p-todo-list li button")].map(x => x.dataset.id))).includes("seg"), "[7] la Traccia lo mostra (è raggiungibile)");
  await pg.evaluate(() => window.__debug.shoot());
  await pg.waitForTimeout(200);
  ok(/non ha ancora una foto/.test(await testo(pg, "#p-status")), "[7] Scatta: 'non ha ancora una foto' — " + (await testo(pg, "#p-status")));
  ok((await pg.evaluate(() => window.__debug.stato().trovati)).length === 0, "[7] nulla trovato");
  await ctx.close();
}

console.log(fail ? `${fail} FAIL` : "TUTTO OK");
await b.close(); srv.kill();
process.exit(fail ? 1 : 0);
