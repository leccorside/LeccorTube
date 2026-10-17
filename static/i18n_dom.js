/* LeccorTube — camada de tradução da interface (DOM).
 *
 * Boa parte dos textos do app está escrita direto em inglês no código (app.js, docu.js, nle.js,
 * doctl.js) ou chega pronta do servidor (mensagens de progresso e erro). Esta camada observa a página
 * e troca esses textos pela tradução do idioma escolhido, usando o dicionário de i18n_dict.js
 * (gerado por tools/i18n/build_dict.py):
 *   exact     texto inteiro de um nó ou atributo
 *   patterns  textos com partes variáveis ({0}, {1}...)
 *   fragments pedaços de mensagens do servidor, trocados dentro de textos maiores
 *
 * Não mexe em campos editáveis (textarea, input, contenteditable), em code/pre nem em elementos com
 * data-noi18n. Em inglês ("en") nada é alterado.
 */
(function () {
  "use strict";
  const DICT = window.I18N_DICT || {};
  const ATTRS = ["title", "placeholder", "aria-label", "alt", "data-tip"];
  // #metaText: título/descrição/tags gerados para o YouTube; o botão "copiar" (copyMeta) lê o texto da tela
  const SKIP_SEL = "script,style,textarea,code,pre,svg,[contenteditable=''],[contenteditable='true'],[data-noi18n],.noi18n,#metaText";
  const FRAG_MAX_LEN = 300; // textos longos (roteiros, descrições do usuário) não passam por fragmentos

  let lang = null;
  let cur = null; // dicionário preparado do idioma atual

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const norm = (s) => s.replace(/\s+/g, " ").trim();

  function prepare(code) {
    const d = DICT[code];
    if (!d) return null;
    const exact = new Map(Object.entries(d.exact || {}));
    // exato sem diferenciar maiúsculas (fallback)
    const lower = new Map();
    for (const [k, v] of exact) if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), v);
    const buckets = new Map(); // prefixo literal -> padrões
    const generic = [];
    for (const [en, tr] of d.patterns || []) {
      const order = [];
      // partes variáveis podem ser vazias ("{0} part{1}" casa "1 part")
      const rx = new RegExp("^" + esc(en).replace(/\\\{(\d+)\\\}/g, (_, i) => { order.push(+i); return "(.*?)"; }) + "$", "s");
      const p = { rx, order, tr, lit: en.replace(/\{\d+\}/g, "").length };
      const lit = en.split(/\{\d+\}/)[0].trim().slice(0, 3).toLowerCase();
      if (lit.length >= 2) {
        if (!buckets.has(lit)) buckets.set(lit, []);
        buckets.get(lit).push(p);
      } else generic.push(p);
    }
    const frags = (d.fragments || []).slice().sort((a, b) => b[0].length - a[0].length);
    return { exact, lower, buckets, generic, frags };
  }

  function lookupExact(s) {
    let v = cur.exact.get(s);
    if (v !== undefined) return v;
    // "Texto:" / "Texto…" / "Texto." / "texto," -> tenta sem a pontuação final
    const m = s.match(/^(.*?)([:…\.!?,;]+)$/);
    if (m && m[1]) {
      v = cur.exact.get(m[1]);
      if (v !== undefined) return v + m[2];
    }
    v = cur.lower.get(s.toLowerCase());
    if (v !== undefined) {
      // preserva caixa alta/inicial maiúscula do original
      if (s === s.toUpperCase() && /[A-Z]/.test(s)) return v.toUpperCase();
      if (/^[A-Z]/.test(s)) return v.charAt(0).toUpperCase() + v.slice(1);
      if (/^[a-z]/.test(s) && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(v)) return v.charAt(0).toLowerCase() + v.slice(1);
      return v;
    }
    return undefined;
  }

  // a parte variável não pode dominar o texto: evita que "{0} character{1}" case dentro de frases longas
  const VAR_MAX = 40;
  function tryPatterns(list, s) {
    for (const p of list) {
      if (s.length - p.lit > VAR_MAX && p.lit < s.length * 0.5) continue;
      const m = p.rx.exec(s);
      if (!m) continue;
      // parte variável com cara de frase ("$0.12 per minute of") não é número/nome: padrão errado
      if (m.slice(1).some((g) => (g.match(/\b[a-z]{2,}\b/g) || []).length >= 3 && lookupExact(g.trim()) === undefined)) continue;
      const vals = [];
      p.order.forEach((idx, gi) => {
        const raw = m[gi + 1];
        const t = lookupExact(raw.trim());
        vals[idx] = t !== undefined ? raw.replace(raw.trim(), t) : raw;
      });
      return p.tr.replace(/\{(\d+)\}/g, (_, i) => (vals[+i] !== undefined ? vals[+i] : ""));
    }
    return undefined;
  }

  function translateOne(s) {
    const e = lookupExact(s);
    if (e !== undefined) return e;
    const key = s.slice(0, 3).toLowerCase();
    let r = cur.buckets.has(key) ? tryPatterns(cur.buckets.get(key), s) : undefined;
    if (r === undefined) r = tryPatterns(cur.generic, s);
    return r;
  }

  // tenta o texto inteiro; depois sem símbolos nas pontas ("• ", " →"); depois por partes
  function translateCore(s, depth = 0) {
    let r = translateOne(s);
    if (r !== undefined || depth > 2) return r;
    const m = s.match(/^([^A-Za-z0-9$"'(\[{]*)([\s\S]*?)([^A-Za-z0-9)\]}"'.!?…%]*)$/);
    if (m && (m[1] || m[3]) && m[2]) {
      const core = translateCore(m[2], depth + 1);
      if (core !== undefined) return m[1] + core + m[3];
    }
    // partes separadas por " · " ou " | "
    for (const sep of [" · ", " | ", " — "]) {
      if (!s.includes(sep)) continue;
      const parts = s.split(sep);
      let hit = false;
      const outp = parts.map((p) => {
        const t = translateCore(p.trim(), depth + 1);
        if (t !== undefined) { hit = true; return p.replace(p.trim(), t); }
        return p;
      });
      if (hit) return outp.join(sep);
    }
    // várias frases
    const sents = s.split(/(?<=[.!?…])\s+(?=[A-Z"'(])/);
    if (sents.length > 1) {
      let hit = false;
      const outs = sents.map((p) => { const t = translateCore(p, depth + 1); if (t !== undefined) { hit = true; return t; } return p; });
      if (hit) return outs.join(" ");
    }
    return undefined;
  }

  function translate(text) {
    if (!cur || !text) return text;
    const s = norm(text);
    if (!s || !/[A-Za-z]{2}/.test(s)) return text;
    let r = translateCore(s);
    if (r === undefined && s.length <= FRAG_MAX_LEN && cur.frags.length) {
      let out = s, hit = false;
      for (const [en, tr] of cur.frags) {
        if (out.includes(en)) { out = out.split(en).join(tr); hit = true; }
      }
      if (hit) r = out;
    }
    if (r === undefined) return text;
    // preserva espaços nas pontas do nó original
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    return lead + r + trail;
  }

  function skipped(el) {
    return !el || (el.closest && el.closest(SKIP_SEL));
  }

  function doText(n) {
    const v = n.nodeValue;
    if (n.__i18nOut === v) return; // já é o resultado de uma tradução nossa
    n.__i18nSrc = v;
    if (skipped(n.parentElement)) { n.__i18nOut = v; return; }
    const out = lang === "en" ? v : translate(v);
    n.__i18nOut = out;
    if (out !== v) n.nodeValue = out;
  }

  function doAttrs(el) {
    if (skipped(el)) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      const store = (el.__i18nA ||= {});
      if (store[a] && store[a].out === v) continue;
      const out = lang === "en" ? v : translate(v);
      store[a] = { src: v, out };
      if (out !== v) el.setAttribute(a, out);
    }
  }

  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (skipped(root)) return;
      doAttrs(root);
    }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) return n.matches(SKIP_SEL) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else doAttrs(n);
    }
  }

  // reaplica em toda a página a partir dos originais (troca de idioma)
  function retranslateAll() {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) {
        if (n.__i18nSrc !== undefined && n.nodeValue === n.__i18nOut) {
          const src = n.__i18nSrc;
          const out = lang === "en" || skipped(n.parentElement) ? src : translate(src);
          n.__i18nOut = out;
          if (n.nodeValue !== out) n.nodeValue = out;
        } else doText(n);
      } else if (n.__i18nA) {
        for (const a of Object.keys(n.__i18nA)) {
          const st = n.__i18nA[a];
          if (n.getAttribute(a) !== st.out) continue;
          const out = lang === "en" ? st.src : translate(st.src);
          st.out = out;
          n.setAttribute(a, out);
        }
        doAttrs(n);
      } else doAttrs(n);
    }
  }

  function setActive(code) {
    lang = code || "en";
    cur = lang === "en" ? null : prepare(lang);
    if (!cur) lang = "en";
  }

  function currentLang() {
    try { return (window.I18N && window.I18N.getLang && window.I18N.getLang()) || "en"; } catch (e) { return "en"; }
  }

  // ---- inicialização
  setActive(currentLang());

  const obs = new MutationObserver((muts) => {
    if (!cur && lang === "en") return;
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => walk(n));
      } else if (m.type === "characterData") {
        doText(m.target);
      } else if (m.type === "attributes") {
        const el = m.target;
        const st = el.__i18nA && el.__i18nA[m.attributeName];
        if (!st || st.out !== el.getAttribute(m.attributeName)) doAttrs(el);
      }
    }
  });

  function start() {
    if (cur) walk(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  // troca de idioma: reaplica tudo depois que o app redesenhar as telas
  function wrapSetLang(fn) {
    return function (code, ...rest) {
      const r = fn.call(this, code, ...rest);
      setActive(currentLang());
      if (document.body) retranslateAll();
      return r;
    };
  }
  if (window.I18N && typeof window.I18N.setLang === "function") window.I18N.setLang = wrapSetLang(window.I18N.setLang);
  if (typeof window.setLanguage === "function") window.setLanguage = wrapSetLang(window.setLanguage);

  // janelas nativas
  const nativeAlert = window.alert, nativeConfirm = window.confirm, nativePrompt = window.prompt;
  window.alert = (msg) => nativeAlert.call(window, typeof msg === "string" && cur ? translate(msg) : msg);
  window.confirm = (msg) => nativeConfirm.call(window, typeof msg === "string" && cur ? translate(msg) : msg);
  window.prompt = (msg, def) => nativePrompt.call(window, typeof msg === "string" && cur ? translate(msg) : msg, def);

  window.I18N_DOM = { translate: (s) => (cur ? translate(s) : s), retranslateAll, setActive, get lang() { return lang; } };
})();
