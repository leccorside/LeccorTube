"""Extrai do app.cp312-win_amd64.pyd (tabela de constantes Nuitka) as mensagens que o servidor manda
para a interface (progresso, erros, descrições do Setup Center, catálogo...).

Uso: python tools/i18n/extract_pyd.py app.cp312-win_amd64.pyd > tools/i18n/strings_pyd.json
"""
import json
import re
import sys

sys.path.insert(0, 'tools')
from rebrand_app_pyd import BLOB_OFF, parse  # noqa: E402

PROMPT_HINTS = re.compile(
    r'\b(You are|you are a|Return ONLY|Return only|Reply with|Respond with|JSON|Rules:|RULES|Output:|'
    r'Write the|Do not|DO NOT|Example:|Format:|STORY:|ENVIRONMENT:|negative prompt|masterpiece|'
    r'best quality|8k|cinematic lighting)\b')


def ui_like(s):
    t = s.strip()
    if len(t) < 3 or len(t) > 400 or not re.search(r'[A-Za-z]{2,}', t):
        return False
    if ' ' not in t and not re.fullmatch(r'[A-Z][a-z]+[.!…]?', t):
        return False
    if re.match(r'^(https?:|/|\\|[A-Z]:\\|-|\.|\$|<|\{|\[|%|#|@|=)', t):
        return False
    if PROMPT_HINTS.search(t):
        return False
    if t.count('\n') > 3:
        return False
    if re.search(r'[{}]{2}|\\[nrt]|\b(def|import|lambda|select|ffmpeg|torch|cuda:|pip install)\b', t):
        return False
    if re.search(r'[=;]\s*\S+\s*[=;]', t):  # código/args
        return False
    if sum(c.isalpha() or c == ' ' for c in t) / len(t) < 0.75:
        return False
    return True


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    data = open(sys.argv[1], 'rb').read()
    mods, _ = parse(data[BLOB_OFF:BLOB_OFF + 0x80000])
    out = {}
    for name, chunk in mods:
        if not name.startswith('app'):
            continue
        # cada constante termina em \0; antes do marcador 'u' pode haver códigos de tipo (ex.: b'T\x02t')
        for seg in chunk.split(b'\x00'):
            s = None
            for pos in [i for i in range(min(len(seg), 7)) if seg[i:i + 1] == b'u']:
                try:
                    cand = seg[pos + 1:].decode('utf-8')
                except UnicodeDecodeError:
                    continue
                if ui_like(cand):
                    s = cand
                    break
            if s:
                key = re.sub(r'\s+', ' ', s).strip()
                out.setdefault(key, set()).add(name)
    json.dump({k: sorted(v) for k, v in sorted(out.items())}, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
