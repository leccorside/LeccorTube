import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'lt-sw-')) });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('http://127.0.0.1:7860/', { waitUntil: 'networkidle2', timeout: 120000 });
await page.evaluate(() => localStorage.setItem('ot_lang', 'pt-BR'));
await page.reload({ waitUntil: 'networkidle2' });
await sleep(2500);
const pid = await page.evaluate(async () => { const j = await (await fetch('/api/projects')).json(); const a = Array.isArray(j) ? j : j.projects || []; return a[0] && a[0].id; });
await page.evaluate((id) => openProject(id), pid);
await sleep(2500);
const probe = async (label) => {
  await sleep(1500);
  const r = await page.evaluate(() => {
    const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { botoes: txt('main button').slice(0, 9), abas: txt('[onclick*="setTab("]').slice(0, 9), lang: document.documentElement.lang, dom: window.I18N_DOM && window.I18N_DOM.lang };
  });
  console.log(label, JSON.stringify(r));
};
await probe('pt-BR');
await page.evaluate(() => setLanguage('en'));
await probe('en   ');
await page.evaluate(() => setLanguage('es'));
await probe('es   ');
await page.evaluate(() => setLanguage('pt-BR'));
await probe('pt-BR');
console.log('erros', errs);
await browser.close();
