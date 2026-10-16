// Extrai os textos de interface (em inglês) dos arquivos JS/HTML do frontend.
// Saída: JSON { exact: {texto: [arquivos]}, patterns: {padrão com {0}: [arquivos]} }
// Uso: node tools/i18n/extract_js.mjs static/app.js static/docu.js ... > tools/i18n/strings_js.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const NODE_PATH = process.env.ACORN_DIR || '.';
const acorn = require(path.resolve(NODE_PATH, 'node_modules/acorn'));
const walk = require(path.resolve(NODE_PATH, 'node_modules/acorn-walk'));

const exact = new Map();
const patterns = new Map();
const add = (map, s, file) => {
  if (!map.has(s)) map.set(s, new Set());
  map.get(s).add(file);
};

const ENT = { '&middot;': '·', '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&rarr;': '→', '&larr;': '←', '&times;': '×', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&bull;': '•',
  '&apos;': "'", '&copy;': '©', '&deg;': '°' };
const decode = (s) => s.replace(/&[a-z]+;|&#\d+;/g, (m) => ENT[m] ?? (m.startsWith('&#') ? String.fromCharCode(+m.slice(2, -1)) : m));
const PH = (i) => `\u0001${i}\u0001`;
const ATTRS = /\b(title|placeholder|aria-label|alt|data-tip|data-title|label)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const hasWords = (s) => /[A-Za-z]{2,}/.test(s.replace(/\u0001\d+\u0001/g, ''));
const SKIP_CALLEES = new Set(['t', '$', '$$', 'querySelector', 'querySelectorAll', 'getElementById', 'addEventListener',
  'removeEventListener', 'api', 'fetch', 'getItem', 'setItem', 'removeItem', 'add', 'remove', 'toggle', 'contains',
  'closest', 'matches', 'getAttribute', 'setAttribute', 'removeAttribute', 'hasAttribute', 'createElement', 'ic',
  'icon', 'startsWith', 'endsWith', 'includes', 'indexOf', 'split', 'replace', 'replaceAll', 'match', 'test',
  'RegExp', 'postMessage', 'dispatchEvent', 'Event', 'CustomEvent', 'require', 'open', 'go', 'dataset', 'log',
  'warn', 'error', 'debug', 'toLocaleString', 'toFixed', 'padStart', 'join', 'getPropertyValue', 'setProperty',
  'scrollIntoView', 'animate', 'insertAdjacentHTML']);

// Normaliza um pedaço de texto; devolve [texto, ehPadrão] ou null
function normSeg(seg) {
  let s = decode(seg).replace(/\s+/g, ' ').trim();
  if (!s || !hasWords(s)) return null;
  // renumera marcadores na ordem
  let k = 0;
  const map = {};
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => `{${(map[i] ??= k++)}}`);
  return [s, k > 0];
}

function addSeg(seg, file) {
  const r = normSeg(seg);
  if (!r) return;
  const [s, isPat] = r;
  if (isPat) {
    add(patterns, s, file);
    // versão sem marcadores nas pontas (ícones viram elementos separados no DOM)
    const core = s.replace(/^(\{\d+\}\s*)+/, '').replace(/(\s*\{\d+\})+$/, '').trim();
    if (core && core !== s && hasWords(core)) {
      if (/\{\d+\}/.test(core)) {
        let k = 0; const m = {};
        add(patterns, core.replace(/\{(\d+)\}/g, (_, i) => `{${(m[i] ??= k++)}}`), file);
      } else add(exact, core, file);
    }
  } else add(exact, s, file);
}

// Processa uma string com possível HTML (marcadores já substituídos)
function processHtmlish(s, file) {
  if (!/[<>]/.test(s)) { addSeg(s, file); return; }
  // atributos de texto
  for (const m of s.matchAll(ATTRS)) addSeg(m[3] ?? m[4] ?? '', file);
  // texto entre tags
  const parts = s.split(/<\/?[a-zA-Z][^<>]*>|<!--[\s\S]*?-->/g);
  for (const p of parts) if (!/[<>]/.test(p)) addSeg(p, file);
}

function isUiLiteral(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 2 || !/[A-Za-z]{2,}/.test(s)) return false;
  if (/^[\w\-./:#@?=&%[\]]+$/.test(s) && !/^[A-Z][a-z]+(?:[ -][A-Za-z]+)*[.!?…:]?$/.test(s)) return false;
  if (/^(https?:|\/api\/|\/static\/|data:|#|\.|\[)/.test(s)) return false;
  if (/[{};]\s*$/.test(s) && /[:;]/.test(s) && !/ /.test(s.replace(/[^ ]/g, '').slice(3))) return false;
  if (/^(var|let|const|function|return|if|for)\b/.test(s)) return false;
  if (/^[a-z-]+:\s*[^ ]+;?$/.test(s)) return false; // css
  return true;
}

function calleeName(c) {
  if (!c) return '';
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression') return c.property.name || c.property.value || '';
  return '';
}

for (const file of process.argv.slice(2)) {
  const code = fs.readFileSync(file, 'utf8');
  const rel = path.basename(file);
  if (file.endsWith('.html')) {
    const html = code.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
    processHtmlish(html, rel);
    continue;
  }
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  walk.fullAncestor(ast, (node, _st, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (node.type === 'TemplateLiteral') {
      if (parent && parent.type === 'TaggedTemplateExpression') return;
      let s = '';
      node.quasis.forEach((q, i) => {
        s += q.value.cooked ?? q.value.raw;
        if (i < node.expressions.length) {
          const ex = node.expressions[i];
          const src = code.slice(ex.start, ex.end);
          // ícones e trechos que geram HTML viram fronteira de tag
          s += /^\s*(ic|icon|chip|svg|btnIc|pill)\s*\(/.test(src) ? '<i>' : PH(i);
        }
      });
      processHtmlish(s, rel);
      return;
    }
    // "texto " + valor + " mais texto": monta um padrão com {n} (só na raiz da cadeia de +)
    if (node.type === 'BinaryExpression' && node.operator === '+' &&
        !(parent && parent.type === 'BinaryExpression' && parent.operator === '+')) {
      const parts = [];
      const flat = (n) => { if (n.type === 'BinaryExpression' && n.operator === '+') { flat(n.left); flat(n.right); } else parts.push(n); };
      flat(node);
      if (parts.some((p) => p.type === 'Literal' && typeof p.value === 'string' && /[A-Za-z]{2}/.test(p.value))) {
        let s = '', k = 0;
        for (const p of parts) {
          if (p.type === 'Literal' && typeof p.value === 'string') s += p.value;
          else if (p.type === 'TemplateLiteral') s += p.quasis.map((q, i) => (q.value.cooked ?? '') + (i < p.expressions.length ? PH(k++) : '')).join('');
          else {
            const src = code.slice(p.start, p.end);
            s += /^\s*(ic|icon|chip|svg)\s*\(/.test(src) ? '<i>' : PH(k++);
          }
        }
        if (k > 0) processHtmlish(s, rel);
      }
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (!parent) return;
      if (parent.type === 'Property' && parent.key === node) return;
      if (parent.type === 'MemberExpression' && parent.property === node) return;
      if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in'].includes(parent.operator)) return;
      if (parent.type === 'SwitchCase') return;
      if (parent.type === 'ImportDeclaration') return;
      if ((parent.type === 'CallExpression' || parent.type === 'NewExpression')) {
        const name = calleeName(parent.callee);
        if (SKIP_CALLEES.has(name)) {
          // t("chave", "fallback"): o fallback não precisa (já é traduzível pela chave)
          return;
        }
      }
      const v = node.value;
      if (/[<>]/.test(v) && /<\/?[a-z]/i.test(v)) processHtmlish(v, rel);
      else if (isUiLiteral(v)) addSeg(v, rel);
    }
  });
}

const out = (m) => Object.fromEntries([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, [...v]]));
process.stdout.write(JSON.stringify({ exact: out(exact), patterns: out(patterns) }, null, 1));
