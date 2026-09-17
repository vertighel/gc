// Test del protocollo di scambio QR (cedente/ricevente) a tavolino, senza fotocamere:
// due pagine Playwright fanno da "telefoni", la lettura del QR e la generazione del QR
// sono sostituite da stub (window.__feed / window.__lastQr) e i giri del ciclo
// (scambioTickCorpo) si fanno a mano, uno alla volta. Verifica l'asimmetria del
// protocollo (il ricevente scrive per primo, il cedente solo dopo aver letto il QR
// "fatto"), la domanda manuale del cedente e i suoi tempi, "Annulla", "duplica",
// i timeout. NON verifica la convergenza ottica reale: quella si prova solo con due
// telefoni veri (vedi CLAUDE.md).
//
// Come si lancia (serve playwright con chromium installato, es. `npm i playwright &&
// npx playwright install chromium` in una cartella qualunque, poi da lì):
//     node /percorso/gc/tests/scambio.test.mjs
// Non tocca il repository: copia index.html in una cartella temporanea, SOLO lì
// aggiunge in fondo un `window.__debug` con le funzioni interne da pilotare (mai nel
// file vero, vedi memory.md), scrive un caccia.json finto e serve tutto con
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
  apriScambio, scambioTickCorpo, scambioDomanda, decodificaQr, gestisciQrFoto, stato, saveState, chiudiEAggiorna,
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
const v = { m: 0.2, q: Buffer.from([1, 2, 3, 4]).toString("base64") };
const nodo = (extra) => ({ messaggio: "", testo: "", conThumb: false, richiedePosizione: false, pos: [v], neg: [v], soglia: 0.5, ...extra });
writeFileSync(join(dir, "caccia.json"), JSON.stringify({ formato: "caccia-3", creato: "2026-09-17T00:00:00Z", nodi: {
  obj1: nodo({ nome: "Portone", richiede: [], daValidare: true }),
  gift1: nodo({ nome: "Chiave", messaggio: "una chiave", richiede: ["obj1"], daValidare: false, scambiabile: true, duplicabile: true }),
} }));
writeFileSync(join(dir, "messaggi.json"), '{"messaggi":[]}');
writeFileSync(join(dir, "cacce.json"), "[]");

const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn("python3", ["-m", "http.server", String(port)], { cwd: dir, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
const URL = `http://localhost:${port}/index.html`;

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
const S = p => p.evaluate(() => { const s = window.__debug.scambio; return s && { ruolo: s.ruolo, tipo: s.tipo, mySeq: s.mySeq, myReadCount: s.myReadCount, theirAck: s.theirAck, committed: s.committed, domanda: s.domanda, theirAckKAt: s.theirAckKAt, sessionId: s.sessionId, inizio: s.inizio }; });
const qr = p => p.evaluate(() => window.__lastQr);
const feed = (p, t) => p.evaluate(t => { window.__feed = t; }, t);
const tick = p => p.evaluate(() => window.__debug.scambioTickCorpo());
const stato = p => p.evaluate(() => window.__debug.stato());
const apri = (p, o) => p.evaluate(o => { window.__debug.apriScambio(o); }, o).then(() => p.waitForTimeout(50)).then(() => p.evaluate(() => window.__debug.fermaTimer()));
const vis = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; }, id);
const txt = (p, id) => p.evaluate(id => document.getElementById(id).textContent, id);
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
  ok(await B.evaluate(() => document.getElementById("p-scambio").classList.contains("fatto")), "B è sulla schermata verde");
  ok(await vis(B, "p-scambio-chiudi") && (await txt(B, "p-scambio-chiudi")) === "Chiudi", "B ha il bottone Chiudi");
  const stA = await stato(A), stB = await stato(B);
  ok(!stA.trovati.includes("gift1") && stA.ceduti.includes("gift1"), "A ha ceduto gift1");
  ok(stB.trovati.includes("gift1"), "B possiede gift1");
  ok(await vis(A, "p-scambio-chiudi") && !(await vis(A, "p-scambio-domanda")), "A: Torna a Memoria visibile, niente domanda");
  ok((await txt(A, "p-scambio-status")).startsWith("Fatto! Hai ceduto"), "A: messaggio Fatto");
  // B chiude → festa
  await B.click("#p-scambio-chiudi");
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

await browser.close();
server.kill();
console.log(fails ? `\n${fails} FAIL` : "\nTUTTO OK");
process.exit(fails ? 1 : 0);
