"""Gera static/i18n_dict.js (dicionário da camada de tradução i18n_dom.js) a partir das traduções.

Entrada: tools/i18n/source_en.json  (exact / patterns / fragments, gerado por build_sources.py)
         tools/i18n/translations.json  ({texto_en: {"pt": ..., "es": ...}})
Saída:   static/i18n_dict.js  ->  window.I18N_DICT = {"pt-BR": {...}, "es": {...}}

Traduções que perdem marcadores {n} ou tags HTML do original são descartadas (e listadas).

Uso:
    python tools/i18n/build_dict.py [pastas/arquivos out_*.json para mesclar em translations.json]
"""
import glob
import json
import os
import re
import sys

LANGS = {'pt': 'pt-BR', 'es': 'es'}
TR_FILE = 'tools/i18n/translations.json'


def placeholders(s):
    return sorted(re.findall(r'\{\d+\}', s))


def tags(s):
    return sorted(re.findall(r'</?[a-zA-Z][a-zA-Z0-9]*', s))


def merge_inputs(paths):
    tr = json.load(open(TR_FILE, encoding='utf-8')) if os.path.exists(TR_FILE) else {}
    files = []
    for p in paths:
        files += sorted(glob.glob(os.path.join(p, 'out_*.json'))) if os.path.isdir(p) else [p]
    for f in files:
        if '.part' in os.path.basename(f):
            continue
        data = json.load(open(f, encoding='utf-8-sig'))
        for k, v in data.items():
            if isinstance(v, dict):
                tr[k] = {**tr.get(k, {}), **{lk: v[lk] for lk in LANGS if isinstance(v.get(lk), str)}}
        print(f'mesclado: {os.path.basename(f)} ({len(data)})')
    json.dump(dict(sorted(tr.items())), open(TR_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return tr


def main():
    tr = merge_inputs(sys.argv[1:]) if len(sys.argv) > 1 else json.load(open(TR_FILE, encoding='utf-8'))
    src = json.load(open('tools/i18n/source_en.json', encoding='utf-8'))
    # traduções manuais (palavras soltas que o extrator não acha) entram como 'exact'
    manual = {k: v for k, v in json.load(open('tools/i18n/manual.json', encoding='utf-8')).items() if not k.startswith('_')}
    tr = {**tr, **manual}
    src['exact'] = sorted(set(src['exact']) | set(manual))
    out ={code: {'exact': {}, 'patterns': [], 'fragments': []} for code in LANGS.values()}
    missing, bad = {c: 0 for c in LANGS}, []
    for kind in ('exact', 'patterns', 'fragments'):
        for en in src[kind]:
            entry = tr.get(en)
            for lk, code in LANGS.items():
                t = entry.get(lk) if entry else None
                if not isinstance(t, str) or not t.strip():
                    missing[lk] += 1
                    continue
                if placeholders(t) != placeholders(en) or tags(t) != tags(en):
                    bad.append((lk, en, t))
                    continue
                if t == en:
                    continue
                if kind == 'exact':
                    out[code]['exact'][en] = t
                elif kind == 'patterns':
                    out[code]['patterns'].append([en, t])
                else:
                    out[code]['fragments'].append([en, t])
    # padrões mais específicos (mais texto literal) primeiro
    for code in out:
        out[code]['patterns'].sort(key=lambda p: -len(re.sub(r'\{\d+\}', '', p[0])))
    js = ('/* Gerado por tools/i18n/build_dict.py — não editar à mão. */\n'
          'window.I18N_DICT = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open('static/i18n_dict.js', 'w', encoding='utf-8').write(js)
    for code in out:
        print(code, {k: len(v) for k, v in out[code].items()})
    print('sem tradução:', missing, '| descartadas por marcador/tag:', len(bad))
    for lk, en, t in bad[:20]:
        print(f'  [{lk}] {en[:70]!r} -> {t[:70]!r}')
    print(f'static/i18n_dict.js: {len(js.encode()) // 1024} KB')


if __name__ == '__main__':
    main()
