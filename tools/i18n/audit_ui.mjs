// Auditoria de tradução: abre a interface num Chrome headless, navega pelas telas e lista os textos
// visíveis que continuam em inglês.
// Uso: node tools/i18n/audit_ui.mjs [lang=pt-BR] [url=http://127.0.0.1:7860/] > relatorio.json
// Requer: puppeteer-core (PUPPETEER_DIR aponta para a pasta com node_modules) e Chrome/Edge instalado.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require(path.resolve(process.env.PUPPETEER_DIR || '.', 'node_modules/puppeteer-core'));
const LANG = process.argv[2] || 'pt-BR';
const URL = process.argv[3] || 'http://127.0.0.1:7860/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLLECT = () => {
  const SKIP = 'script,style,textarea,code,pre,svg,[contenteditable=true],[data-noi18n],.noi18n,input,select option[value=""]';
  const out = new Set();
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const el = n.parentElement;
    if (!el || el.closest(SKIP) || !vis(el)) continue;
    const s = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (s && /[A-Za-z]{2}/.test(s)) out.add(s);
  }
  for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) {
    if (el.closest(SKIP.replace(',input', ''))) continue;
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = (el.getAttribute(a) || '').trim();
      if (v && /[A-Za-z]{2}/.test(v)) out.add(v);
    }
  }
  return [...out];
};

const EN = /\b(the|and|to|of|your|you|is|for|with|this|that|on|in|it|be|not|or|are|will|click|add|new|no|yes|from|first|make|makes|made|use|uses|open|close|save|pick|choose|change|show|one|all|each|every|more|only|here|when|what|how|it's|can|get|still|turn|set|keep|run|start|stop|done|ready|loading|waiting|build|render|export|voice|image|images|video|videos|scene|scenes|script|music|sound|look|cast|places|output|settings|picture|pictures|clip|clips)\b/i;
const PT_HINT = /[ãõçáéíóúâêôà]|\b(de|do|da|para|com|não|você|seu|sua|um|uma|os|as|em|no|na|ao)\b/i;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'lt-audit-')), args: ['--no-first-run', '--window-size=1500,1000'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
await page.evaluate((l) => localStorage.setItem('ot_lang', l), LANG);
await page.reload({ waitUntil: 'networkidle2', timeout: 120000 });
await sleep(3000);

const seen = new Map(); // texto -> telas
async function grab(label) {
  await sleep(1500);
  const texts = await page.evaluate(COLLECT);
  for (const t of texts) { if (!seen.has(t)) seen.set(t, new Set()); seen.get(t).add(label); }
}
const ev = async (label, js) => {
  try { await page.evaluate(js); await grab(label); } catch (e) { errors.push(`${label}: ${String(e).slice(0, 150)}`); }
};

await grab('inicio');
for (const v of ['new', 'setup', 'seasons', 'pro', 'docu']) await ev(`go:${v}`, `go(${JSON.stringify(v)})`);
await ev('settings', 'openSettings()');
await ev('fecha-settings', `document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'))`);
await ev('update', 'typeof openUpdate==="function" && openUpdate()');
await ev('fecha-update', `document.querySelectorAll('.modal.show').forEach(m=>m.classList.remove('show'))`);
// primeiro projeto e todas as abas
const pid = await page.evaluate(async () => {
  try { const r = await fetch('/api/projects'); const j = await r.json(); const a = Array.isArray(j) ? j : (j.projects || []); return a[0] && (a[0].id || a[0].name); } catch (e) { return null; }
});
if (pid) {
  await ev('projeto', `openProject(${JSON.stringify(pid)})`);
  await sleep(2000);
  const tabs = await page.evaluate(() => [...new Set([...document.querySelectorAll('[onclick*="setTab("]')]
    .map((e) => (e.getAttribute('onclick').match(/setTab\((['"])(\w+)\1/) || [])[2]).filter(Boolean))]);
  for (const tb of tabs) await ev(`aba:${tb}`, `setTab(${JSON.stringify(tb)})`);
}

const rows = [];
for (const [t, where] of seen) {
  if (PT_HINT.test(t) && !EN.test(t.replace(PT_HINT, ''))) continue;
  if (!EN.test(t)) continue;
  rows.push({ text: t, where: [...where].slice(0, 3) });
}
rows.sort((a, b) => a.text.localeCompare(b.text));
process.stdout.write(JSON.stringify({ lang: LANG, project: pid, total_textos: seen.size, ingles: rows.length, errors, rows }, null, 1));
await browser.close();
