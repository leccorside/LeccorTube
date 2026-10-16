"""Junta os textos extraídos (JS + app.pyd) numa lista única de origem para tradução.

Entrada: tools/i18n/strings_js.json e tools/i18n/strings_pyd.json
Saída:   tools/i18n/source_en.json  ->  {"exact": [...], "patterns": [...], "fragments": [...]}

- exact:     texto inteiro de um nó/atributo (comparação exata)
- patterns:  texto com partes variáveis {0}, {1}... (vira expressão regular)
- fragments: pedaços de mensagens do servidor montadas em tempo de execução; trocados dentro de
             textos maiores quando não há correspondência exata nem padrão
"""
import json
import re

PROMPT_MODULES = {'app.cinema', 'app.catalog', 'app.docu_samples', 'app.docu_presets', 'app.castkit',
                  'app.exporter', 'app.project'}


def js_noise(s):
    if re.match(r'^(/|\.|#|\[|data:|https?:|\{\d+\}[|:/]|[a-z]+:\{)', s):
        return True
    # "${" só é código quando não é preço + marcador ("~${0}")
    if re.search(r'onclick=|onchange=|oninput=|="|\$\{(?!\d+\})|\|\{|=>|\bfunction\b|;\s*$|^\w+\(|audio/\*|image/\*|video/\*', s):
        return True
    if re.fullmatch(r'[\w\-./:{}|*,]+', s) and not re.match(r'^[A-Z][a-z]', s):
        return True
    if re.fullmatch(r'[\s,.:;!?()\[\]{}0-9|+\-–—·/%×→←…"\'*]+(true|false|null)?[\s,.:;!?()\[\]{}0-9|+\-–—·/%×→←…"\'*a-z]*', s) \
            and not re.search(r'[A-Za-z]{3,}', s):
        return True
    if s in {', false, true'}:
        return True
    return False


def pyd_keep(s, mods):
    if all(m in PROMPT_MODULES for m in mods) and not re.match(r'^[A-Z0-9]', s):
        return False
    if re.search(r'\b(None|float|int|str|dict|list|bool)\s*\|', s) or re.fullmatch(r'[\w\s|]+\|\s*None', s):
        return False
    return True


def main():
    js = json.load(open('tools/i18n/strings_js.json', encoding='utf-8'))
    pyd = json.load(open('tools/i18n/strings_pyd.json', encoding='utf-8'))
    exact = {s for s in js['exact'] if not js_noise(s)}
    patterns = {s for s in js['patterns'] if not js_noise(s)}
    fragments = set()
    for s, mods in pyd.items():
        if not pyd_keep(s, mods):
            continue
        s = s.strip()
        # mensagens completas começam com maiúscula e não terminam em conectivo; o resto é fragmento
        if re.match(r'^[A-Z0-9"\'(]', s) and not re.search(r'[(:,]$|\b(of|to|the|a|an|in|for|with|and|or)$', s):
            exact.add(s)
        elif len(s) >= 12 and ' ' in s.strip() and '|' not in s:
            fragments.add(s)
    out = {'exact': sorted(exact), 'patterns': sorted(patterns), 'fragments': sorted(fragments - exact)}
    json.dump(out, open('tools/i18n/source_en.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in out.items()}, 'chars', sum(len(s) for v in out.values() for s in v))


if __name__ == '__main__':
    main()
