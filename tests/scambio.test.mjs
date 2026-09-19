// Test del protocollo di scambio QR (cedente/ricevente) a tavolino, senza fotocamere:
// due pagine Playwright fanno da "telefoni", la lettura del QR e la generazione del QR
// sono sostituite da stub (window.__feed / window.__lastQr) e i giri del ciclo
// (scambioTickCorpo) si fanno a mano, uno alla volta. Verifica l'asimmetria del
// protocollo (il ricevente scrive per primo, il cedente solo dopo aver letto il QR
// "fatto"), la domanda manuale del cedente e i suoi tempi, "Annulla", "duplica",
// i timeout, i regali a istanze, le istanze cedute (➡️🎟️) e il baratto 🤝 (acquisizione
// simmetrica poi cessione, rifiuto "ce l'ho già", domanda manuale, a istanze).
// NON verifica la convergenza ottica reale: quella si prova solo con due telefoni veri
// (vedi CLAUDE.md).
//
// Come si lancia (serve playwright con chromium installato, es. `npm i playwright &&
// npx playwright install chromium` in una cartella qualunque, poi da lì):
//     node /percorso/gc/tests/scambio.test.mjs
// Non tocca il repository: copia index.html in una cartella temporanea, SOLO lì
// aggiunge in fondo un `window.__debug` con le funzioni interne da pilotare (mai nel
// file vero, vedi docs/DECISIONI.md), scrive un caccia.json finto e serve tutto con
// `python3 -m http.server` su una porta libera.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "gc-test-"));
let html = readFileSync(join(repo, "index.html"), "utf8");
html = html.replace("window.__avviato = true;", `
window.__debug = {
  get scambio() { return scambio; },
  apriScambio, scambioTickCorpo, barattoTickCorpo, scambioDomanda, decodificaQr, gestisciQrFoto, stato, saveState, chiudiEAggiorna, renderPlayer, mancanoIstanze,
  get game() { return game; },
  setLeggiQr(fn) { leggiQr = fn; },
  stubCamera() {
    startCamera = async () => {};
    qrEncodePromise = Promise.resolve({ toCanvas: async (c, payload) => { window.__lastQr = payload; } });
  },
  fermaTimer() { if (scambio && scambio.timer) { clearInterval(scambio.timer); scambio.timer = null; } }
};
window.__avviato = true;`);
writeFileSync(join(dir, "index.html"), html);
// Un oggetto da fotografare (obj1) e un regalo che lo richiede (gift1), scambiabile e
// duplicabile: il "telefono A" parte con obj1 trovato (quindi possiede gift1), B no.
// Più un secondo oggetto (obj2) che produce un regalo A ISTANZE (sig), e un regalo
// finale (fin) che richiede almeno 2 istanze diverse di sig.
const v = { m: 0.2, q: Buffer.from([1, 2, 3, 4]).toString("base64") };
const nodo = (extra) => ({ messaggio: "", testo: "", conThumb: false, richiedePosizione: false, pos: [v], neg: [v], soglia: 0.5, ...extra });
writeFileSync(join(dir, "caccia.json"), JSON.stringify({ formato: "caccia-3", creato: "2026-09-17T00:00:00Z", nodi: {
  obj1: nodo({ nome: "Portone", richiede: [], daValidare: true }),
  gift1: nodo({ nome: "Chiave", messaggio: "una chiave", richiede: ["obj1"], daValidare: false, scambiabile: true, duplicabile: true }),
  obj2: nodo({ nome: "Saracinesca", richiede: [], daValidare: true }),
  sig: nodo({ nome: "Sigillo", messaggio: "un sigillo", richiede: ["obj2"], daValidare: false, duplicabile: true, istanze: true }),
  fin: nodo({ nome: "Tesoro", messaggio: "fine", richiede: ["sig"], istanzeRichieste: { sig: 2 }, daValidare: false }),
  // Istanze SCAMBIABILI (➡️🎟️): ogni telefono produce la sua, cederla la consuma.
  sigS: nodo({ nome: "Gettone", richiede: ["obj2"], daValidare: false, scambiabile: true, istanze: true }),
  // Barattabili: bar1 da obj1, bar2 da obj2 (due giocatori con oggetti diversi), barI a istanze da obj2.
  bar1: nodo({ nome: "Chiave di bronzo", richiede: ["obj1"], daValidare: false, barattabile: true }),
  bar2: nodo({ nome: "Sigillo di cera", richiede: ["obj2"], daValidare: false, barattabile: true }),
  barI: nodo({ nome: "Moneta", richiede: ["obj2"], daValidare: false, barattabile: true, istanze: true }),
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

async function telefono(browser, { possiede }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await ctx.addInitScript(() => { try { localStorage.setItem("caccia-scelta", '""'); } catch {} });
  await page.goto(URL);
  await page.waitForFunction(() => window.__avviato && window.__debug && window.__debug.game);
  await page.evaluate((possiede) => {
    window.__debug.stubCamera();
    window.__lastQr = null; window.__feed = null;
    window.__debug.setLeggiQr(async () => window.__feed);
    if (possiede) { const st = window.__debug.stato(); window.__debug.chiudiEAggiorna(st, ["obj1"]); window.__debug.saveState(st); }
  }, possiede);
  return page;
}
const S = p => p.evaluate(() => { const s = window.__debug.scambio; return s && { ruolo: s.ruolo, tipo: s.tipo, mySeq: s.mySeq, myReadCount: s.myReadCount, theirAck: s.theirAck, committed: s.committed, domanda: s.domanda, theirAckKAt: s.theirAckKAt, sessionId: s.sessionId, inizio: s.inizio, istanza: s.istanza }; });
const qr = p => p.evaluate(() => window.__lastQr);
const feed = (p, t) => p.evaluate(t => { window.__feed = t; }, t);
const tick = p => p.evaluate(() => window.__debug.scambio && window.__debug.scambio.ruolo === "baratto" ? window.__debug.barattoTickCorpo() : window.__debug.scambioTickCorpo());
const stato = p => p.evaluate(() => window.__debug.stato());
const apri = (p, o) => p.evaluate(o => { window.__debug.apriScambio(o); }, o).then(() => p.waitForTimeout(50)).then(() => p.evaluate(() => window.__debug.fermaTimer()));
const vis = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; }, id);
const txt = (p, id) => p.evaluate(id => document.getElementById(id).innerText, id);
const backdate = (p, ms) => p.evaluate(ms => { window.__debug.scambio.inizio -= ms; if (window.__debug.scambio.theirAckKAt) window.__debug.scambio.theirAckKAt -= ms; }, ms);

const browser = await chromium.launch();

// ---- 0. formato
{
  const p = await telefono(browser, { possiede: false });
  const r = await p.evaluate(() => [window.__debug.decodificaQr("gc1:S:ABCDEFGH:gift1:7:3:XY12"), window.__debug.decodificaQr("gc1:d:ABCDEFGH:gift1:7:3:XY12")]);
  ok(r[0].fatto === true && r[0].tipo === "scambio" && r[1].fatto === false && r[1].tipo === "duplica", "decodificaQr: maiuscola = fatto, tipo tradotto");
  await p.context().close();
}

// ---- 1. percorso felice (scambio)
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  ok((await stato(A)).trovati.includes("gift1"), "A possiede gift1 all'inizio");
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" });
  const sid = (await S(A)).sessionId;
  await tick(A); // A disegna il primo QR
  // B lo trova in "Foto"
  await B.evaluate(t => window.__debug.gestisciQrFoto(t), await qr(A));
  await B.waitForTimeout(50); await B.evaluate(() => window.__debug.fermaTimer());
  ok((await S(B)) && (await S(B)).ruolo === "ricevente" && (await S(B)).sessionId === sid, "B apre come ricevente con lo stesso sessionId");
  ok((await txt(A, "p-scambio-codice")) === sid.slice(0, 4) && (await txt(B, "p-scambio-codice")) === sid.slice(0, 4), "codice a 4 lettere uguale sui due telefoni");
  let giri = 0, sa, sb;
  while (giri++ < 20) {
    await feed(B, await qr(A)); await tick(B);
    await feed(A, await qr(B)); await tick(A);
    sa = await S(A); sb = await S(B);
    if (sa.committed) break;
  }
  ok(sb.committed && sa.committed, `entrambi committed in ${giri} giri`);
  ok((await qr(B)).startsWith("gc1:S:"), "l'ultimo QR di B è quello 'fatto' (S)");
  ok(await B.evaluate(() => { const d = document.getElementById("p-scambio").dataset; return d.fase === "fatto" && d.ruolo === "ricevente" && getComputedStyle(document.getElementById("p-scambio")).backgroundColor === "rgb(46, 122, 76)"; }), "B è sulla schermata verde (data-fase=fatto, sfondo verde via CSS)");
  ok(await vis(B, "p-scambio-ok") && !(await vis(B, "p-scambio-chiudi")) && !(await vis(B, "p-scambio-annulla")), "B ha solo il bottone Chiudi");
  ok((await txt(B, "p-scambio-titolo")).replace(/\s+/g, " ").trim() === "Stai ricevendo: Chiave" && (await txt(A, "p-scambio-titolo")).replace(/\s+/g, " ").trim() === "Scambia: Chiave", "titoli scelti dal CSS per ruolo/tipo (testo visibile)");
  const stA = await stato(A), stB = await stato(B);
  ok(!stA.trovati.includes("gift1") && stA.ceduti.includes("gift1"), "A ha ceduto gift1");
  ok(stB.trovati.includes("gift1"), "B possiede gift1");
  ok(await vis(A, "p-scambio-chiudi") && !(await vis(A, "p-scambio-domanda")), "A: Torna a Memoria visibile, niente domanda");
  ok((await txt(A, "p-scambio-status")).startsWith("Fatto! Hai ceduto"), "A: messaggio Fatto");
  // B chiude → festa
  await B.click("#p-scambio-ok");
  ok(await vis(B, "p-reward"), "B: festa di sblocco dopo Chiudi");
  // Ordine: B ha scritto PRIMA di A? verifica che B fosse committed quando A non lo era ancora
  await A.context().close(); await B.context().close();
}

// ---- 2. B legge A ma A non legge mai B: B NON scrive; A fallisce in sicurezza senza domanda
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" });
  await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: sid });
  for (let i = 0; i < 15; i++) { await feed(B, await qr(A)); await tick(B); await feed(A, null); await tick(A); }
  const sb = await S(B);
  ok(sb.myReadCount >= 3 && !sb.committed && sb.theirAck === 0, `B a ${sb.myReadCount} letture ma non scrive (theirAck=0)`);
  ok((await stato(B)).trovati.includes("gift1") === false, "B non possiede gift1");
  await backdate(A, 61000); await tick(A);
  const sa = await S(A);
  ok(!sa.committed && !sa.domanda && await vis(A, "p-scambio-riprova"), "A: fallito in sicurezza (myReadCount=0), nessuna domanda");
  ok((await stato(A)).trovati.includes("gift1"), "A possiede ancora gift1");
  ok((await txt(A, "p-scambio-status")).includes("rimasto qui"), "A: messaggio 'rimasto qui'");
  await A.context().close(); await B.context().close();
}

// ---- 3. A legge B una volta, poi più nulla; B scrive; A non legge il fatto → domanda; Sì → cede
for (const risposta of ["si", "no"]) {
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" });
  await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: sid });
  await feed(B, await qr(A)); await tick(B);
  await feed(A, await qr(B)); await tick(A);   // A legge B una volta → ack=1
  await feed(A, null);
  for (let i = 0; i < 10; i++) { await feed(B, await qr(A)); await tick(B); await tick(A); }
  ok((await S(B)).committed && (await stato(B)).trovati.includes("gift1"), `[${risposta}] B ha scritto`);
  let sa = await S(A);
  ok(!sa.committed && !sa.domanda, `[${risposta}] A non ha ancora né scritto né chiesto`);
  // A ha visto theirAck>=K nell'ultimo QR di B prima del fatto? Solo se ha letto: qui non legge più, quindi theirAckKAt resta null → tetto 60s
  await backdate(A, 31000); await tick(A);
  sa = await S(A);
  ok(!sa.domanda, `[${risposta}] a 31s senza aver visto B a soglia: ancora nessuna domanda`);
  await backdate(A, 30000); await tick(A);
  sa = await S(A);
  ok(sa.domanda && await vis(A, "p-scambio-domanda") && !(await vis(A, "p-scambio-annulla")), `[${risposta}] a 61s: domanda visibile, Annulla nascosto`);
  ok((await A.evaluate(() => document.querySelector("#p-scambio-domanda .codice").textContent)) === sid.slice(0, 4), `[${risposta}] la domanda mostra il codice`);
  // la lettura continua sotto la domanda: se ora legge il fatto, chiude da sola
  if (risposta === "si") {
    await A.click("#p-scambio-si");
    const st = await stato(A);
    ok(!st.trovati.includes("gift1") && st.ceduti.includes("gift1") && (await S(A)).committed, "[si] A cede dopo 'Sì'");
    ok(!(await vis(A, "p-scambio-domanda")) && await vis(A, "p-scambio-chiudi"), "[si] domanda sparita, Torna a Memoria");
  } else {
    await A.click("#p-scambio-no");
    const st = await stato(A);
    ok(st.trovati.includes("gift1") && !(await S(A)), "[no] A tiene l'oggetto e chiude lo scambio");
  }
  await A.context().close(); await B.context().close();
}

// ---- 3a. domanda a schermo, "Annulla" la chiude e si continua a leggere; ricompare dopo 10 s
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" }); await tick(A);
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: (await S(A)).sessionId });
  await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); await feed(A, null);
  await backdate(A, 61000); await tick(A);
  ok((await S(A)).domanda && await vis(A, "p-scambio-domanda") && await vis(A, "p-scambio-torna"), "[3a] domanda con il bottone Annulla");
  await A.click("#p-scambio-torna");
  ok(!(await S(A)).domanda && !(await vis(A, "p-scambio-domanda")) && (await A.evaluate(() => document.getElementById("p-scambio").dataset.fase)) === "lettura" && (await stato(A)).trovati.includes("gift1"), "[3a] Annulla: domanda chiusa, si torna a leggere, l'oggetto è ancora qui");
  await tick(A);
  ok(!(await S(A)).domanda, "[3a] la domanda non ricompare subito");
  await A.evaluate(() => { window.__debug.scambio.domandaNonPrima -= 11000; }); await tick(A);
  ok((await S(A)).domanda && await vis(A, "p-scambio-domanda"), "[3a] dopo 10 s la domanda ricompare");
  // Annulla della fase di lettura (forzata) non aspetta il rinvio
  await A.click("#p-scambio-torna"); await A.click("#p-scambio-annulla");
  ok((await S(A)).domanda, "[3a] Annulla della lettura riapre la domanda senza aspettare");
  await A.context().close(); await B.context().close();
}

// ---- 3b. domanda a schermo, poi la lettura automatica riesce → risolve da sola
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" }); await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: sid });
  await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); await feed(A, null);
  for (let i = 0; i < 10; i++) { await feed(B, await qr(A)); await tick(B); await tick(A); }
  await backdate(A, 61000); await tick(A);
  ok((await S(A)).domanda, "[auto] domanda a schermo");
  await feed(A, await qr(B)); await tick(A);
  ok((await S(A)).committed && (await stato(A)).ceduti.includes("gift1") && !(await vis(A, "p-scambio-domanda")), "[auto] la lettura del 'fatto' sotto la domanda cede e toglie la domanda");
  await A.context().close(); await B.context().close();
}

// ---- 3c. tempi: domanda a 30s se B visto a soglia da ≥10s
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" }); await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: sid });
  // B legge A 3 volte senza che A legga B (theirAck 0 → B non scrive), poi A legge B: ack=3 ≥ K
  for (let i = 0; i < 3; i++) { await feed(B, await qr(A)); await tick(B); await feed(A, null); await tick(A); }
  await feed(A, await qr(B)); await tick(A);
  let sa = await S(A);
  ok(sa.theirAck >= 3 && sa.theirAckKAt, "[tempi] A ha visto B a soglia (theirAckKAt impostato)");
  await feed(A, null);
  await backdate(A, 9000); await tick(A); ok(!(await S(A)).domanda, "[tempi] 9s dopo soglia: nessuna domanda");
  await backdate(A, 2000); await tick(A); ok(!(await S(A)).domanda, "[tempi] 11s dopo soglia ma <30s dal tocco: nessuna domanda");
  await backdate(A, 20000); await tick(A); ok((await S(A)).domanda, "[tempi] 31s dal tocco e 31s dopo soglia: domanda");
  await A.context().close(); await B.context().close();
}

// ---- 4. Annulla sul cedente dopo aver letto l'amico → domanda; prima → chiude
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" }); await tick(A);
  await A.click("#p-scambio-annulla");
  ok(!(await S(A)) && await vis(A, "p-content"), "[annulla] senza letture: chiude subito");
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "gift1" }); await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: sid });
  await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A);
  await A.click("#p-scambio-annulla");
  ok((await S(A)) && (await S(A)).domanda && await vis(A, "p-scambio-domanda"), "[annulla] dopo una lettura: passa dalla domanda");
  await A.context().close(); await B.context().close();
}

// ---- 5. duplica: B scrive, A non cambia; A legge il fatto → Fatto; oppure timeout → messaggio senza domanda
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "duplica", nodo: "gift1" }); await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "duplica", nodo: "gift1", sessionId: sid });
  let giri = 0;
  while (giri++ < 20) { await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); if ((await S(A)).committed) break; }
  ok((await S(A)).committed && (await S(B)).committed, "[duplica] entrambi committed");
  ok((await qr(B)).startsWith("gc1:D:"), "[duplica] QR finale di B è 'D'");
  ok((await stato(A)).trovati.includes("gift1") && (await stato(B)).trovati.includes("gift1"), "[duplica] entrambi possiedono gift1");
  ok((await txt(A, "p-scambio-status")).startsWith("Fatto! Hai condiviso"), "[duplica] A: Fatto! Hai condiviso");
  await A.context().close(); await B.context().close();
}
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await apri(A, { ruolo: "cedente", tipo: "duplica", nodo: "gift1" }); await tick(A);
  const sid = (await S(A)).sessionId;
  await apri(B, { ruolo: "ricevente", tipo: "duplica", nodo: "gift1", sessionId: sid });
  await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); await feed(A, null);
  await backdate(A, 61000); await tick(A);
  ok(!(await S(A)).committed && !(await vis(A, "p-scambio-domanda")) && await vis(A, "p-scambio-chiudi") && (await txt(A, "p-scambio-status")).includes("copia lo stesso"), "[duplica timeout] nessuna domanda, messaggio esplicativo, Torna a Memoria");
  await A.context().close(); await B.context().close();
}

// ---- 6. ricevente: timeout prima di scrivere → fallito, nulla scritto; QR 'fatto' in Foto → già concluso
{
  const B = await telefono(browser, { possiede: false });
  await apri(B, { ruolo: "ricevente", tipo: "scambio", nodo: "gift1", sessionId: "ABCDEFGH" });
  await backdate(B, 41000); await tick(B);
  ok(!(await S(B)).committed && await vis(B, "p-scambio-riprova") && !(await stato(B)).trovati.includes("gift1"), "[B timeout] fallito, niente scritto");
  await B.evaluate(() => { window.__debug.scambio && document.getElementById("p-scambio-riprova").click(); });
  await B.evaluate(t => window.__debug.gestisciQrFoto(t), "gc1:S:ABCDEFGH:gift1:9:3:ZZ99");
  ok((await txt(B, "p-status")).includes("già concluso") && !(await S(B)), "[Foto] QR 'fatto' letto da un terzo: 'già concluso', nessuno scambio aperto");
  await B.context().close();
}

// ================= nodi a istanze =================
const ISTANZA_RE = /^[A-Z][0-9][A-Z]$/;
const bottino = (p, nodo) => p.evaluate(nodo => window.__debug.stato().bottino.filter(r => r.nodo === nodo).map(r => ({ istanza: r.istanza, prodotta: !!r.prodotta })), nodo);
const trova = (p, ids) => p.evaluate(ids => { const st = window.__debug.stato(); const n = window.__debug.chiudiEAggiorna(st, ids); window.__debug.saveState(st); return n.map(x => ({ id: x.id, istanza: x.istanza || null, prodotta: !!x.prodotta })); }, ids);

// ---- I1. produzione: una istanza L-C-L, una volta sola; "Ti manca" a fine caccia
{
  const A = await telefono(browser, { possiede: true });
  let nuovi = await trova(A, ["obj2"]);
  let b = await bottino(A, "sig");
  ok(b.length === 1 && ISTANZA_RE.test(b[0].istanza) && b[0].prodotta, `[I1] A produce una istanza (${b[0] && b[0].istanza}), prodotta: true`);
  ok(nuovi.some(n => n.id === "sig" && n.istanza === b[0].istanza && n.prodotta), "[I1] la festa porta l'istanza");
  ok(!(await stato(A)).trovati.includes("fin"), "[I1] con 1 istanza il Tesoro (×2) resta chiuso");
  nuovi = await trova(A, []);
  b = await bottino(A, "sig");
  ok(b.length === 1 && !nuovi.length && (await stato(A)).prodotti.includes("sig"), "[I1] una seconda chiusura non produce nulla (prodotti)");
  await A.evaluate(() => window.__debug.renderPlayer());
  await A.click("#p-tab-cerca"); // la fine caccia vive in "Cerca": innerText applica il CSS solo se è visibile
  const fine = await txt(A, "p-alldone"); // innerText: solo la variante mostrata dal CSS (data-fine)
  ok(fine.includes("Ti manca qualcosa") && fine.includes("Sigillo ×1") && !fine.includes("Hai trovato tutto") && await vis(A, "p-alldone"), "[I1] fine caccia: 'Ti manca qualcosa … Sigillo ×1' (variante scelta dal CSS)");
  const m = await A.evaluate(() => window.__debug.mancanoIstanze(window.__debug.stato()));
  ok(m.length === 1 && m[0].id === "sig" && m[0].quante === 1, "[I1] mancanoIstanze = sig ×1");
  await A.context().close();
}

// ---- I2/I3. due produttori; A condivide la sua a B → B ha 2 istanze diverse → Tesoro
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await trova(A, ["obj2"]); await trova(B, ["obj2"]);
  const ia = (await bottino(A, "sig"))[0].istanza, ib = (await bottino(B, "sig"))[0].istanza;
  ok(ISTANZA_RE.test(ia) && ISTANZA_RE.test(ib), `[I2] A=${ia} B=${ib}`);
  if (ia === ib) console.log("   (collisione casuale 1/6760: i controlli seguenti potrebbero fallire, rilanciare)");
  await apri(A, { ruolo: "cedente", tipo: "duplica", nodo: "sig", istanza: ia }); await tick(A);
  const qa = await qr(A);
  ok(qa.split(":").length === 8 && qa.endsWith(":" + ia), `[I3] il QR di A porta l'istanza come 7º campo (${qa.length} byte)`);
  await B.evaluate(t => window.__debug.gestisciQrFoto(t), qa);
  await B.waitForTimeout(50); await B.evaluate(() => window.__debug.fermaTimer());
  ok((await S(B)) && (await S(B)).ruolo === "ricevente", "[I3] B accetta l'istanza di A (ne ha già una diversa)");
  let giri = 0;
  while (giri++ < 20) { await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); if ((await S(A)).committed) break; }
  ok((await S(A)).committed && (await S(B)).committed, "[I3] scambio concluso");
  const bb = await bottino(B, "sig");
  ok(bb.length === 2 && bb.some(r => r.istanza === ia && !r.prodotta) && bb.some(r => r.istanza === ib && r.prodotta), "[I3] B ha la propria (★) e quella di A");
  ok((await stato(B)).trovati.includes("fin"), "[I3] Tesoro chiuso per B (2 istanze diverse)");
  const festa = await B.evaluate(() => window.__debug.scambio.esito.nuovi.map(n => ({ id: n.id, istanza: n.istanza || null })));
  ok(festa.some(n => n.id === "sig" && n.istanza === ia) && festa.some(n => n.id === "fin"), "[I3] la festa di B mostra l'istanza ricevuta e il Tesoro");
  ok((await bottino(A, "sig")).length === 1 && !(await stato(A)).trovati.includes("fin"), "[I3] A invariato (duplica)");
  // I4. stessa istanza di nuovo → rifiutata
  await B.click("#p-scambio-ok");
  await B.evaluate(t => window.__debug.gestisciQrFoto(t), qa.replace("gc1:d:", "gc1:d:"));
  ok((await txt(B, "p-status")).includes("Hai già l'istanza " + ia) && !(await S(B)), "[I4] B rifiuta una seconda copia della stessa istanza");
  // I8. Memoria: due righe Sigillo con badge, il 👥 della riga condivide QUELLA istanza
  await B.evaluate(() => window.__debug.renderPlayer());
  const righe = await B.evaluate(() => [...document.querySelectorAll("#p-inv-list li")].map(li => ({ testo: li.querySelector(".txt").textContent, badge: li.querySelector(".istanza") && li.querySelector(".istanza").textContent, tua: !!li.querySelector(".istanza-tua"), azione: li.querySelector(".todo-action") && li.querySelector(".todo-action").textContent })));
  const rs = righe.filter(r => r.badge && r.testo === "Sigillo");
  ok(rs.length === 2 && rs.some(r => r.badge === ia && !r.tua && r.azione === "👥") && rs.some(r => r.badge === ib && r.tua), "[I8] Memoria: due righe Sigillo, badge, ★ tua solo sulla propria");
  await B.evaluate(ia => { [...document.querySelectorAll("#p-inv-list li")].find(li => li.querySelector(".istanza") && li.querySelector(".istanza").textContent === ia).querySelector(".todo-action").click(); }, ia);
  ok((await S(B)) && (await S(B)).ruolo === "cedente" && (await S(B)).istanza === ia && (await S(B)).tipo === "duplica", "[I8] il 👥 della riga apre la condivisione di quella istanza (copia di copia)");
  // I5. copia di copia: B passa l'istanza di A a C; poi C trova la saracinesca → produce la sua → Tesoro
  await B.waitForTimeout(50); await B.evaluate(() => window.__debug.fermaTimer()); await tick(B);
  const C = await telefono(browser, { possiede: false });
  await C.evaluate(t => window.__debug.gestisciQrFoto(t), await qr(B));
  await C.waitForTimeout(50); await C.evaluate(() => window.__debug.fermaTimer());
  giri = 0;
  while (giri++ < 20) { await feed(C, await qr(B)); await tick(C); await feed(B, await qr(C)); await tick(B); if ((await S(B)).committed) break; }
  let bc = await bottino(C, "sig");
  ok(bc.length === 1 && bc[0].istanza === ia && !bc[0].prodotta && !(await stato(C)).prodotti.length, "[I5] C ha la copia di A ricevuta da B, non ha prodotto nulla");
  await C.click("#p-scambio-ok");
  const nuoviC = await trova(C, ["obj2"]);
  bc = await bottino(C, "sig");
  ok(bc.length === 2 && bc.some(r => r.prodotta && ISTANZA_RE.test(r.istanza) && r.istanza !== ia), "[I5] C, trovata la saracinesca DOPO aver ricevuto, produce comunque la sua");
  ok((await stato(C)).trovati.includes("fin") && nuoviC.some(n => n.id === "fin") && nuoviC.some(n => n.id === "sig" && n.prodotta), "[I5] Tesoro chiuso per C nello stesso giro, festeggiato con la produzione");
  await A.context().close(); await B.context().close(); await C.context().close();
}

// ---- I6/I7. compatibilità QR
{
  const p = await telefono(browser, { possiede: false });
  const r = await p.evaluate(() => [window.__debug.decodificaQr("gc1:d:ABCDEFGH:gift1:7:3:XY12"), window.__debug.decodificaQr("gc1:d:ABCDEFGH:sig:7:3:XY12:K7X")]);
  ok(r[0].istanza === "" && !r[0].errore && r[1].istanza === "K7X", "[I6] QR a 6 campi (versione vecchia) e a 7 campi decodificati");
  await p.evaluate(t => window.__debug.gestisciQrFoto(t), "gc1:d:ABCDEFGH:sig:7:3:XY12");
  ok((await txt(p, "p-status")).includes("Aggiorna l'app") && !(await S(p)), "[I7] nodo a istanze senza istanza nel QR → 'Aggiorna l'app'");
  await p.context().close();
}

// ================= istanze scambiabili (➡️🎟️) =================
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await trova(A, ["obj2"]);
  const ga = (await bottino(A, "sigS"))[0].istanza;
  ok(ISTANZA_RE.test(ga) && (await stato(A)).prodotti.includes("sigS"), `[S1] A produce il Gettone ${ga}`);
  await A.evaluate(() => window.__debug.renderPlayer());
  const rigaG = await A.evaluate(() => { const li = [...document.querySelectorAll("#p-inv-list li")].find(li => li.querySelector(".txt").textContent === "Gettone"); const b = li.querySelector(".todo-action"); return { icona: b.textContent, tipo: b.dataset.tipo, istanza: b.dataset.istanza }; });
  ok(rigaG.icona === "➡️" && rigaG.tipo === "scambio" && rigaG.istanza === ga, "[S1] Memoria: la riga del Gettone ha ➡️ con tipo scambio e la sua istanza");
  await apri(A, { ruolo: "cedente", tipo: "scambio", nodo: "sigS", istanza: ga }); await tick(A);
  await B.evaluate(t => window.__debug.gestisciQrFoto(t), await qr(A));
  await B.waitForTimeout(50); await B.evaluate(() => window.__debug.fermaTimer());
  let giri = 0;
  while (giri++ < 20) { await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); if ((await S(A)).committed) break; }
  ok((await S(A)).committed && (await S(B)).committed, "[S2] scambio dell'istanza concluso");
  const sA = await stato(A), sB = await stato(B);
  ok(!sA.bottino.some(r => r.nodo === "sigS") && sA.trovati.includes("sigS") && !sA.ceduti.includes("sigS") && sA.prodotti.includes("sigS"), "[S2] A: riga del Gettone via, nodo ancora in trovati, non in ceduti, prodotti intatto");
  ok(sB.bottino.some(r => r.nodo === "sigS" && r.istanza === ga && !r.prodotta) && sB.trovati.includes("sigS"), "[S2] B ha il Gettone di A (prodotta: false)");
  const dopoA = await trova(A, []);
  ok(!dopoA.length && !(await bottino(A, "sigS")).length, "[S3] una nuova chiusura su A non riconia né rifesteggia il Gettone");
  // B lo restituisce ad A: A lo riceve (festeggiato) pur avendolo già "conosciuto"
  await B.click("#p-scambio-ok");
  await apri(B, { ruolo: "cedente", tipo: "scambio", nodo: "sigS", istanza: ga }); await tick(B);
  await A.evaluate(t => window.__debug.gestisciQrFoto(t), await qr(B));
  await A.waitForTimeout(50); await A.evaluate(() => window.__debug.fermaTimer());
  ok((await S(A)) && (await S(A)).ruolo === "ricevente", "[S4] A accetta indietro la propria istanza (non la possiede più)");
  giri = 0;
  while (giri++ < 20) { await feed(A, await qr(B)); await tick(A); await feed(B, await qr(A)); await tick(B); if ((await S(B)).committed) break; }
  const festa = await A.evaluate(() => window.__debug.scambio.esito.nuovi.map(n => n.id + ":" + (n.istanza || "")));
  ok((await bottino(A, "sigS")).length === 1 && !(await bottino(B, "sigS")).length && festa.includes("sigS:" + ga), "[S4] il Gettone è tornato ad A e viene festeggiato; B non ce l'ha più");
  await A.context().close(); await B.context().close();
}

// ================= baratto (🤝) =================
const B_RE = /^gc1:([bBCx]):([A-Z2-9]{8}):([^:]+):(\d+):(\d+):([^:]*)$/;
const lettera = async p => ((await qr(p)) || "").split(":")[1];
const SB = p => p.evaluate(() => { const s = window.__debug.scambio; return s && { acquisito: s.acquisito, ceduto: s.ceduto, theirAcquisito: s.theirAcquisito, theirId: s.theirId, theirNodo: s.theirNodo, myReadCount: s.myReadCount, mySeq: s.mySeq, committed: s.committed, rifiuto: s.rifiuto, domanda: s.domanda, fase: document.getElementById("p-scambio").dataset.fase }; });
const giro = async (A, B) => { await feed(B, await qr(A)); await tick(B); await feed(A, await qr(B)); await tick(A); };

// ---- B0. formato
{
  const p = await telefono(browser, { possiede: false });
  const r = await p.evaluate(() => ["gc1:b:ABCDEFGH:bar1:7:3:", "gc1:B:ABCDEFGH:bar1:7:3:K7X", "gc1:C:ABCDEFGH:bar1:7:3:", "gc1:x:ABCDEFGH:bar1:7:3:"].map(window.__debug.decodificaQr));
  ok(r[0].tipo === "baratto" && !r[0].acquisito && r[1].acquisito && !r[1].ceduto && r[1].istanza === "K7X" && r[2].ceduto && r[3].rifiuto, "[B0] decodificaQr: b/B/C/x del baratto");
  await p.evaluate(t => window.__debug.gestisciQrFoto(t), "gc1:b:ABCDEFGH:bar1:7:3:");
  ok((await txt(p, "p-status")).includes("premi 🤝") && !(await S(p)), "[B0] un QR di baratto letto da Foto: 'apri anche tu Memoria', nessuno scambio aperto");
  await p.context().close();
}

// ---- B1. percorso felice: A offre bar1, B offre bar2; entrambi acquisiscono, poi cedono
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await trova(B, ["obj2"]);
  ok((await stato(A)).trovati.includes("bar1") && (await stato(B)).trovati.includes("bar2"), "[B1] A ha la Chiave, B il Sigillo");
  await B.evaluate(() => window.__debug.renderPlayer());
  const bt = await B.evaluate(() => { const li = [...document.querySelectorAll("#p-inv-list li")].find(li => li.querySelector(".txt").textContent === "Sigillo di cera"); return li.querySelector(".todo-action").textContent + "/" + li.querySelector(".todo-action").dataset.tipo; });
  ok(bt === "🤝/baratto", "[B1] Memoria: il Sigillo ha il bottone 🤝");
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" }); await apri(B, { ruolo: "baratto", tipo: "baratto", nodo: "bar2" });
  ok((await txt(A, "p-scambio-codice")) === "····" && (await txt(A, "p-scambio-titolo")).replace(/\s+/g, " ").trim() === "Baratta: Chiave di bronzo", "[B1] prima dell'aggancio: codice a puntini, titolo 'Baratta:'");
  await tick(A);
  ok(B_RE.test(await qr(A)) && (await lettera(A)) === "b" && (await qr(A)).length <= 42, `[B1] il QR di A è un baratto 'b' a 6 campi (${(await qr(A)).length} byte)`);
  let sa, sb, giri = 0;
  while (giri++ < 20) {
    await giro(A, B);
    sa = await SB(A); sb = await SB(B);
    if (sa.committed && sb.committed) break;
  }
  ok(sa.committed && sb.committed && sa.ceduto && sb.ceduto, `[B1] entrambi hanno ceduto in ${giri} giri`);
  ok((await txt(A, "p-scambio-codice")) === (await txt(B, "p-scambio-codice")) && /^[A-Z2-9]{4}$/.test(await txt(A, "p-scambio-codice")), "[B1] codice a 4 lettere uguale sui due telefoni, derivato dai due id");
  const stA = await stato(A), stB = await stato(B);
  ok(!stA.trovati.includes("bar1") && stA.ceduti.includes("bar1") && stA.trovati.includes("bar2"), "[B1] A ha ceduto la Chiave e ha il Sigillo");
  ok(!stB.trovati.includes("bar2") && stB.ceduti.includes("bar2") && stB.trovati.includes("bar1"), "[B1] B ha ceduto il Sigillo e ha la Chiave");
  ok((await lettera(A)) === "C" && (await lettera(B)) === "C", "[B1] gli ultimi QR di entrambi sono 'C' (acquisito e ceduto)");
  ok(await vis(A, "p-scambio-ok") && !(await vis(A, "p-scambio-chiudi")) && !(await vis(A, "p-scambio-annulla")), "[B1] A: solo il bottone Chiudi (verde)");
  ok((await txt(A, "p-scambio-status")).includes("Hai barattato Chiave di bronzo con Sigillo di cera"), "[B1] A: 'Hai barattato X con Y'");
  await A.click("#p-scambio-ok");
  ok(await vis(A, "p-reward") && (await A.evaluate(() => document.getElementById("p-reward").dataset.festa + "|" + document.querySelector("#p-reward-main .nome").textContent)) === "scambio|Sigillo di cera", "[B1] A: festa 'Ricevuto!' con il Sigillo come principale");
  await A.context().close(); await B.context().close();
}

// ---- B2. trappola 1: chi acquisisce per primo continua a far salire seq finché non cede
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await trova(B, ["obj2"]);
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" }); await apri(B, { ruolo: "baratto", tipo: "baratto", nodo: "bar2" });
  await tick(A);
  // A legge B a ogni giro, B legge A solo ogni 3 giri: A acquisisce molto prima di B.
  let g = 0, sa, sb;
  for (; g < 12; g++) { await feed(A, await qr(B)); await tick(A); await feed(B, g % 3 === 0 ? await qr(A) : null); await tick(B); sa = await SB(A); sb = await SB(B); if (sa.acquisito) break; }
  ok(sa.acquisito && !sb.acquisito && !sa.ceduto, `[B2] A ha acquisito al giro ${g + 1}, B non ancora`);
  ok((await lettera(A)) === "B" && sa.fase === "attesa" && (await txt(A, "p-scambio-status")).includes("Hai ricevuto Sigillo di cera"), "[B2] A mostra 'B' e la fase di attesa");
  ok((await stato(A)).trovati.includes("bar2") && (await stato(A)).trovati.includes("bar1"), "[B2] A ha già il Sigillo e ha ancora la Chiave (acquisizione non distruttiva)");
  const seqPrima = sa.mySeq;
  for (let i = 0; i < 3; i++) { await feed(A, null); await tick(A); }
  ok((await SB(A)).mySeq === seqPrima + 3 && (await lettera(A)) === "B", "[B2] dopo l'acquisizione seq continua a salire (QR non congelato)");
  ok(await vis(A, "p-scambio-annulla"), "[B2] in attesa 'Annulla' resta visibile");
  await A.click("#p-scambio-annulla");
  ok((await SB(A)).domanda && await vis(A, "p-scambio-domanda") && (await A.evaluate(() => document.querySelector("#p-scambio-domanda .se-baratto").innerText)).includes("Hai ricevuto Chiave di bronzo"), "[B2] Annulla dopo l'acquisizione → domanda del baratto (dice «Hai ricevuto Chiave»)");
  // nel frattempo B arriva a soglia e acquisisce: legge B di A → cede
  for (let i = 0; i < 6 && !(await SB(B)).committed; i++) { await feed(B, await qr(A)); await tick(B); }
  ok((await SB(B)).acquisito && (await SB(B)).ceduto && (await stato(B)).ceduti.includes("bar2"), "[B2] B acquisisce e, leggendo 'B' di A, cede");
  // la lettura automatica sotto la domanda: A legge il C di B → cede da sola
  await feed(A, await qr(B)); await tick(A);
  ok((await SB(A)).committed && (await stato(A)).ceduti.includes("bar1") && !(await vis(A, "p-scambio-domanda")), "[B2] A, leggendo 'C' sotto la domanda, cede e la domanda sparisce");
  await A.context().close(); await B.context().close();
}

// ---- B3. domanda manuale: Sì cede, No tiene (ma festeggia comunque ciò che ha acquisito)
for (const risposta of ["si", "no"]) {
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: false });
  await trova(B, ["obj2"]);
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" }); await apri(B, { ruolo: "baratto", tipo: "baratto", nodo: "bar2" });
  await tick(A);
  // B legge A una volta sola (ack=1, basta perché A acquisisca) e poi più nulla: non
  // arriva mai a soglia, quindi A non leggerà mai il suo "B".
  await feed(B, await qr(A)); await tick(B); await feed(B, null);
  for (let g = 0; g < 8 && !(await SB(A)).acquisito; g++) { await feed(A, await qr(B)); await tick(A); await tick(B); }
  ok((await SB(A)).acquisito && !(await SB(B)).acquisito, `[B3 ${risposta}] A ha acquisito, B no`);
  await feed(A, null);
  await backdate(A, 31000); await tick(A);
  ok(!(await SB(A)).domanda, `[B3 ${risposta}] a 31s dal tocco ma <10s dall'acquisizione: nessuna domanda`);
  await A.evaluate(() => { window.__debug.scambio.acquisitoAt -= 11000; }); await tick(A);
  ok((await SB(A)).domanda && await vis(A, "p-scambio-domanda"), `[B3 ${risposta}] a 10s dall'acquisizione: domanda`);
  await A.click("#p-scambio-torna");
  ok(!(await SB(A)).domanda && (await SB(A)).fase === "attesa", `[B3 ${risposta}] Annulla: torna in attesa`);
  await A.evaluate(() => { window.__debug.scambio.domandaNonPrima -= 11000; }); await tick(A);
  ok((await SB(A)).domanda, `[B3 ${risposta}] la domanda ricompare`);
  if (risposta === "si") {
    await A.click("#p-scambio-si");
    ok((await SB(A)).committed && (await stato(A)).ceduti.includes("bar1") && (await stato(A)).trovati.includes("bar2") && await vis(A, "p-scambio-ok"), "[B3 si] A cede e va in verde");
  } else {
    await A.click("#p-scambio-no");
    const st = await stato(A);
    ok(st.trovati.includes("bar1") && st.trovati.includes("bar2") && !(await S(A)) && await vis(A, "p-reward"), "[B3 no] A tiene la Chiave, ha comunque il Sigillo (duplicazione accettata) e lo festeggia");
  }
  await A.context().close(); await B.context().close();
}

// ---- B4. "ce l'ho già": entrambi offrono la stessa Chiave → rifiuto su entrambi, nessuno perde niente
{
  const A = await telefono(browser, { possiede: true }), B = await telefono(browser, { possiede: true });
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" }); await apri(B, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" });
  await tick(A);
  await feed(B, await qr(A)); await tick(B);
  ok((await SB(B)).rifiuto && (await SB(B)).fase === "rifiuto" && (await lettera(B)) === "x" && (await txt(B, "p-scambio-status")).includes("Hai già Chiave di bronzo"), "[B4] B: rifiuto, QR 'x', messaggio 'Hai già'");
  ok(await vis(B, "p-scambio-chiudi") && !(await vis(B, "p-scambio-annulla")), "[B4] B: Torna a Memoria");
  await feed(A, await qr(B)); await tick(A);
  ok((await SB(A)).fase === "fallito" && !(await SB(A)).acquisito && (await txt(A, "p-scambio-status")).includes("ha già Chiave di bronzo"), "[B4] A legge 'x' e fallisce: 'Il tuo amico ha già…'");
  ok((await stato(A)).trovati.includes("bar1") && (await stato(B)).trovati.includes("bar1"), "[B4] nessuno ha perso la Chiave");
  await A.context().close(); await B.context().close();
}

// ---- B5. timeout prima di acquisire → fallito, nulla scritto; Riprova riapre il baratto
{
  const A = await telefono(browser, { possiede: true });
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "bar1" });
  await backdate(A, 41000); await tick(A);
  ok((await SB(A)).fase === "fallito" && await vis(A, "p-scambio-riprova") && (await stato(A)).trovati.includes("bar1"), "[B5] timeout: fallito, Chiave ancora qui");
  await A.click("#p-scambio-riprova"); await A.waitForTimeout(50); await A.evaluate(() => window.__debug.fermaTimer());
  ok((await SB(A)) && (await SB(A)).fase === "lettura" && !(await SB(A)).theirId, "[B5] Riprova riapre il baratto da zero");
  await A.context().close();
}

// ---- B6. baratto a istanze: A e B si scambiano le proprie Monete
{
  const A = await telefono(browser, { possiede: false }), B = await telefono(browser, { possiede: false });
  await trova(A, ["obj2"]); await trova(B, ["obj2"]);
  const ma = (await bottino(A, "barI"))[0].istanza, mb = (await bottino(B, "barI"))[0].istanza;
  if (ma === mb) console.log("   (collisione casuale 1/6760: i controlli seguenti potrebbero fallire, rilanciare)");
  await apri(A, { ruolo: "baratto", tipo: "baratto", nodo: "barI", istanza: ma }); await apri(B, { ruolo: "baratto", tipo: "baratto", nodo: "barI", istanza: mb });
  await tick(A);
  ok((await qr(A)).endsWith(":" + ma), "[B6] il QR di A porta l'istanza offerta");
  let giri = 0;
  while (giri++ < 20) { await giro(A, B); if ((await SB(A)).committed && (await SB(B)).committed) break; }
  const ba = await bottino(A, "barI"), bb = await bottino(B, "barI");
  ok(ba.length === 1 && ba[0].istanza === mb && !ba[0].prodotta && bb.length === 1 && bb[0].istanza === ma && !bb[0].prodotta, "[B6] le Monete si sono scambiate: A ha quella di B e viceversa");
  ok((await stato(A)).prodotti.includes("barI") && !(await stato(A)).ceduti.includes("barI"), "[B6] A: prodotti intatto, nodo non in ceduti (è la riga ad essere ceduta)");
  await A.context().close(); await B.context().close();
}

await browser.close();
server.kill();
console.log(fails ? `\n${fails} FAIL` : "\nTUTTO OK");
process.exit(fails ? 1 : 0);
