// Sincronizzazione della copia di lavoro del master fra due dispositivi (telefono e
// computer) attraverso "Salva bozza sul server" e "Pubblica": fra bozza locale, bozza sul
// server e caccia pubblicata deve vincere la più recente, e le modifiche locali non
// salvate non vanno mai scartate senza chiedere (vedi caricaCopiaLavoro() in index.html).
//
// A tavolino: due contesti Playwright fanno da telefono e da computer; l'API di GitHub è
// finta (il PUT scrive davvero il file nella cartella servita, così l'altro dispositivo lo
// legge con un fetch normale); i nodi sono finti (niente fotocamera: si scrive la bozza
// locale in localStorage come la lascerebbe l'autosalvataggio). Non tocca il repository:
// copia index.html in una cartella temporanea. Si lancia con
//   node tests/sincronizzazione.test.mjs
// da una cartella dove "playwright" (con Chromium) è installato.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const WWW = mkdtempSync(join(tmpdir(), "gc-sync-")) + "/";
copyFileSync(join(repo, "index.html"), WWW + "index.html");
writeFileSync(WWW + "messaggi.json", "[]"); writeFileSync(WWW + "cacce.json", '["t"]');
const PORT = 8000 + Math.floor(Math.random() * 1000);
const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: WWW, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const nodo = (nome) => ({ nome, testo: "", messaggio: "", immagine: null, pos: [], neg: [], soglia: 0.5, luogo: null, daValidare: true, conThumb: true, richiedePosizione: false, scambiabile: false, duplicabile: false, richiede: [] });
const b = await chromium.launch();
async function dispositivo(nome) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.route("https://api.github.com/**", async route => {
    const req = route.request(); const path = new URL(req.url()).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, "");
    if (req.method() === "PUT") { const body = req.postDataJSON(); writeFileSync(WWW + path, Buffer.from(body.content, "base64").toString("utf8")); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { sha: "n" } }) }); }
    return route.fulfill({ status: existsSync(WWW + path) ? 200 : 404, contentType: "application/json", body: JSON.stringify({ sha: "s" }) });
  });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("gh-config")) localStorage.setItem("gh-config", JSON.stringify({ owner: "o", repo: "r", branch: "main", path: "caccia.json", token: "t" })); } catch {} });
  const pg = await ctx.newPage(); pg.nome = nome;
  pg.on("pageerror", e => console.log(nome, "PAGEERROR", e.message));
  pg.dialogs = []; pg.rispostaDialog = true;
  pg.on("dialog", d => { pg.dialogs.push(d.message()); pg.rispostaDialog ? d.accept() : d.dismiss(); });
  return pg;
}
const apri = async (pg) => { await pg.goto("about:blank"); await pg.goto(`http://localhost:${PORT}/index.html#master-collega`); await pg.waitForFunction(() => document.getElementById("m-base-status").textContent && !/Leggo/.test(document.getElementById("m-base-status").textContent)); await pg.waitForTimeout(400); };
const salvaBozza = async pg => { await pg.evaluate(() => { location.hash = "#master"; }); await pg.waitForTimeout(300); await pg.click("#m-save-draft"); await pg.waitForTimeout(500); await pg.evaluate(() => { location.hash = "#master-collega"; }); await pg.waitForTimeout(300); };
const nomi = pg => pg.evaluate(() => [...document.querySelectorAll('.scheda-nodo [name="nome"]')].map(i => i.value));
const stato = pg => pg.evaluate(() => document.getElementById("m-draft-status").textContent);
const setLocale = (pg, v) => pg.evaluate(v => localStorage.setItem("m-lavoro", JSON.stringify(v)), v);

const tel = await dispositivo("telefono"), pc = await dispositivo("pc");
// --- Problema 1: il PC ha creato la caccia (bozza locale vuota, formato vecchio senza date);
// il telefono ha fotografato due oggetti e salva la bozza sul server.
await pc.goto(`http://localhost:${PORT}/index.html`); await setLocale(pc, { formato: "caccia-3", slug: "t", nodi: {} });
await tel.goto(`http://localhost:${PORT}/index.html`); await setLocale(tel, { formato: "caccia-3", slug: "t", nodi: { a: nodo("Oggetto-1"), b: nodo("Oggetto-2") } });
await apri(tel); ok((await nomi(tel)).join() === "Oggetto-1,Oggetto-2", "telefono: bozza locale con 2 oggetti");
await salvaBozza(tel);
ok(existsSync(WWW + "lavoro-t.json"), "telefono: Salva bozza scrive lavoro-t.json");
await apri(pc); ok((await nomi(pc)).join() === "Oggetto-1,Oggetto-2", "1) PC apre e trova i 2 oggetti della bozza del telefono (prima: bozza locale vuota vinceva)");
console.log("   stato PC:", await stato(pc));
// --- Problema 2: il PC rinomina e pubblica; il telefono riapre e deve vedere i nomi nuovi.
await pc.locator('.scheda-nodo [name="nome"]').first().fill("Il gusto"); await pc.locator('.scheda-nodo [name="nome"]').first().dispatchEvent("change");
await pc.locator('.scheda-nodo [name="nome"]').nth(1).fill("L'olfatto"); await pc.locator('.scheda-nodo [name="nome"]').nth(1).dispatchEvent("change");
await pc.waitForTimeout(200);
await pc.click("#m-link-publish"); await pc.waitForTimeout(500);
ok(existsSync(WWW + "caccia-t.json") && JSON.parse(readFileSync(WWW + "caccia-t.json")).nodi.a.nome === "Il gusto", "PC: Pubblica scrive caccia-t.json coi nomi nuovi");
await apri(tel); ok((await nomi(tel)).join() === "Il gusto,L'olfatto", "2) telefono riapre e vede i nomi pubblicati dal PC (prima: restava Oggetto-1/2)");
console.log("   stato telefono:", await stato(tel));
// --- Problema 3: il telefono aggiunge un terzo oggetto (simulato: modifica locale datata
// dopo la pubblicazione) e salva la bozza; il PC riapre e lo trova.
const loc = await tel.evaluate(() => JSON.parse(localStorage.getItem("m-lavoro")));
ok(loc.base && loc.salvato === loc.base, "telefono: bozza locale allineata alla versione pubblicata (salvato == base)");
loc.nodi.c = nodo("Oggetto-3"); loc.salvato = new Date().toISOString(); await setLocale(tel, loc);
await apri(tel); ok((await nomi(tel)).length === 3, "telefono: riapre con la propria modifica locale (più recente della pubblicata)");
console.log("   stato telefono:", await stato(tel));
await salvaBozza(tel);
await apri(pc); ok((await nomi(pc)).join() === "Il gusto,L'olfatto,Oggetto-3", "3) PC riapre e trova il terzo oggetto aggiunto dal telefono");
// --- Conflitto: PC ha modifiche non salvate, il telefono nel frattempo salva una bozza più recente.
const locPc = await pc.evaluate(() => JSON.parse(localStorage.getItem("m-lavoro")));
locPc.nodi.a.nome = "GUSTO (modifica PC non salvata)"; locPc.salvato = new Date().toISOString(); await setLocale(pc, locPc);
await new Promise(r => setTimeout(r, 1100));
await salvaBozza(tel); // bozza server più recente della modifica PC
pc.rispostaDialog = false; pc.dialogs = []; await apri(pc);
ok(pc.dialogs.length === 1 && /mai salvate/.test(pc.dialogs[0]), "conflitto: il PC chiede prima di scartare le modifiche locali");
ok((await nomi(pc))[0] === "GUSTO (modifica PC non salvata)", "conflitto, Annulla: tiene le modifiche locali");
console.log("   stato PC:", await stato(pc));
pc.rispostaDialog = true; pc.dialogs = []; await apri(pc);
ok(pc.dialogs.length === 1 && (await nomi(pc))[0] === "Il gusto", "conflitto, OK: carica la bozza del server");
console.log(fail ? `${fail} FAIL` : "TUTTO OK");
await b.close(); srv.kill();
process.exit(fail ? 1 : 0);
