"""Troca a marca OMNITUBE/Haris Ai pelos textos LeccorTube/Leccorside Ai no app.cp312-win_amd64.pyd.

O app.pyd é um módulo Nuitka: os textos ficam na tabela de constantes em .rdata (BLOB_OFF), uma
sequência de blocos <nome do módulo>\\0 <uint32 tamanho> <dados>. O Nuitka localiza cada bloco pelo
nome percorrendo a tabela, então os blocos podem mudar de tamanho desde que a tabela inteira mantenha
o tamanho original (o saldo negativo vira zeros no fim). Só textos exibidos ao usuário são trocados;
identificadores (strings 'a'), variáveis de ambiente, cabeçalhos HTTP, user-agents, URLs, extensões
de arquivo e a entropia DPAPI do secretstore ficam como estão.

Os offsets valem para o app.cp312-win_amd64.pyd da versão 1.4.2 original.

Uso:
    python tools/rebrand_app_pyd.py <pyd_entrada> <pyd_saida> [--dry-run]
"""
import struct
import sys

BLOB_OFF = 0xd77c50
APP, AUTHOR = 'LeccorTube', 'Leccorside Ai'


def brand(s):
    return s.replace('OMNITUBE', APP)


# módulo -> lista de (texto antigo, texto novo); cada um é uma string 'u' completa (sem o marcador)
REPL = {
    'app.capcut': [
        ' (OMNITUBE)',
        'OMNITUBE documentary - CapCut project (best effort)\n\n',
    ],
    'app.cloud': [
        ('Approximate list prices, paid directly to your own provider account (OpenRouter, ElevenLabs). '
         'OMNITUBE adds nothing.',
         f'Approximate list prices, paid directly to your own provider account (OpenRouter, ElevenLabs). '
         f'{APP} adds nothing.'),
    ],
    'app.comfy': [
        (" (ComfyUI's PyTorch does not fit this graphics card or driver. Update the NVIDIA driver in Setup "
         "Center, then Repair OMNITUBE.)",
         " (ComfyUI's PyTorch does not fit this graphics card or driver. Update the NVIDIA driver in Setup "
         "Center, then Repair.)"),
    ],
    'app.config': [
        ('Haris Ai', AUTHOR),
    ],
    'app.docu': [
        ('OMNITUBE charges nothing. Cloud costs go to your own accounts.',
         f'{APP} charges nothing. Cloud costs go to your own accounts.'),
    ],
    'app.jobs': [
        ("Cloud AI is an OMNITUBE Pro feature. Activate Pro, or set the provider back to 'On my PC' on the "
         "Pro page.",
         f"Cloud AI is a {APP} Pro feature. Activate Pro, or set the provider back to 'On my PC'."),
        ("Cloud music is an OMNITUBE Pro feature. Set the Music tab back to 'On my PC'.",
         f"Cloud music is a {APP} Pro feature. Set the Music tab back to 'On my PC'."),
    ],
    'app.llm': [
        ('Cloud check needs OMNITUBE Pro with OpenRouter or a Script AI key (Pro page).',
         f'Cloud check needs {APP} Pro with OpenRouter or a Script AI key (Pro page).'),
    ],
    'app.main': [
        ('The automation API is an OMNITUBE Pro feature.', f'The automation API is a {APP} Pro feature.'),
        ('Build in cloud is an OMNITUBE Pro feature.', f'Build in cloud is a {APP} Pro feature.'),
        ('Cloud sheets are an OMNITUBE Pro feature. Open Pro in the menu to unlock it.',
         f'Cloud sheets are a {APP} Pro feature. Open Pro in the menu to unlock it.'),
        ('Cloud pictures and clips are an OMNITUBE Pro feature. Open Pro in the menu to unlock it.',
         f'Cloud pictures and clips are a {APP} Pro feature. Open Pro in the menu to unlock it.'),
    ],
    'app.nlexport': [
        ' (OMNITUBE)</name><duration>',
        None,  # texto longo do Premiere: tratado abaixo
    ],
    'app.pro': [
        (' is an OMNITUBE Pro feature. Open Pro in the menu to unlock it.',
         f' is a {APP} Pro feature. Open Pro in the menu to unlock it.'),
    ],
    'app.routes_pro': [
        ('OpenRouter is connected. You can close this tab and go back to OMNITUBE.',
         f'OpenRouter is connected. You can close this tab and go back to {APP}.'),
        None,  # página HTML com <title>OMNITUBE</title>: tratada abaixo
    ],
    'app.setup_center': [
        (' GB is free. Free up space (or move OMNITUBE / ComfyUI to a bigger drive), then click Install.',
         ' GB is free. Free up space (or move the app / ComfyUI to a bigger drive), then click Install.'),
        ('No NVIDIA graphics card found. OMNITUBE still makes voices and videos, but images and video clips '
         'need an NVIDIA RTX card.',
         f'No NVIDIA graphics card found. {APP} still makes voices and videos, but images and video clips '
         f'need an NVIDIA RTX card.'),
        'Your PC is ready for OMNITUBE Pro',
        ('This PC has no NVIDIA RTX card, so images and video cannot be made on it. OMNITUBE Pro makes them '
         'with cloud AI, or switch the scenes to stock footage.',
         f'This PC has no NVIDIA RTX card, so images and video cannot be made on it. {APP} Pro makes them '
         f'with cloud AI, or switch the scenes to stock footage.'),
        None,  # teste do kokoro: tratado abaixo
        ('Restart ComfyUI so it sees the new models (OMNITUBE does this when it starts ComfyUI).',
         'Restart ComfyUI so it sees the new models (the app does this when it starts ComfyUI).'),
        'Draws the OMNITUBE window. Built into Windows 11, sometimes missing on Windows 10.',
    ],
    'app.system': [
        ' is too old. OMNITUBE needs Windows 10 or 11 (64-bit).',
        'OMNITUBE needs a 64-bit Windows.',
        ' GB RAM. OMNITUBE needs at least 8 GB (16 GB recommended).',
        ('Sorry, your system does not meet the requirements for OMNITUBE',
         f'Sorry, this PC does not meet the requirements for {APP}'),
        'Your PC can run OMNITUBE (low disk space)',
        'OMNITUBE runs in Limited mode on this PC',
        ('Voices, scripts, captions, music and editing work. OMNITUBE Pro can make images and video with '
         'cloud AI on this PC.',
         f'Voices, scripts, captions, music and editing work. {APP} Pro can make images and video with '
         f'cloud AI on this PC.'),
        'Your PC is ready for OMNITUBE',
        ('No NVIDIA GPU with CUDA found. OMNITUBE will run, but images and video need an NVIDIA card '
         '(RTX 20 series or newer) to be usable.',
         f'No NVIDIA GPU with CUDA found. {APP} will run, but images and video need an NVIDIA card '
         f'(RTX 20 series or newer).'),
    ],
    'app.updater': [
        ('Close OMNITUBE and start it again from OMNITUBE.exe to finish the update.',
         f'Close {APP} and start it again from LECCORTUBE.exe to finish the update.'),
    ],
}

# textos 'a' (identificadores) trocados de propósito: só o APP_NAME, exibido pelo endpoint app_info
REPL_ATTR = {
    'app.config': [(b'aOMNITUBE\x00aAPP_NAME\x00', f'a{APP}\x00aAPP_NAME\x00'.encode())],
}


def find_by_prefix(chunk, prefix):
    """Retorna o texto 'u' completo (sem marcador e sem \\0) que começa com prefix — deve ser único."""
    key = b'u' + prefix.encode()
    i = chunk.find(key)
    assert i >= 0 and chunk.count(key) == 1, f'prefixo não único: {prefix!r}'
    j = chunk.find(b'\x00', i)
    return chunk[i + 1:j].decode('utf-8')


def parse(blob_bytes):
    p, mods = 0, []
    while True:
        e = blob_bytes.find(b'\x00', p)
        name = blob_bytes[p:e]
        if len(name) > 200 or not all(32 < c < 127 for c in name):
            break
        size = struct.unpack_from('<I', blob_bytes, e + 1)[0]
        mods.append([name.decode(), blob_bytes[e + 5:e + 5 + size]])
        p = e + 5 + size
        if not name and size == 0 and len(mods) > 1 and mods[-2][0] == '':
            break
    return mods, p


def main():
    src, dst = sys.argv[1], sys.argv[2]
    dry = '--dry-run' in sys.argv
    data = bytearray(open(src, 'rb').read())
    region = bytes(data[BLOB_OFF:BLOB_OFF + 0x80000])
    mods, end = parse(region)
    assert mods[0][0] == '.bytecode' and end > 0x70000, 'tabela de constantes não encontrada'

    by_name = {m[0]: m for m in mods}
    delta_total, n = 0, 0
    for mod, items in REPL.items():
        chunk = by_name[mod][1]
        resolved = []
        for it in items:
            if it is None:
                continue
            old, new = (it, brand(it)) if isinstance(it, str) else it
            resolved.append((old, new))
        if mod == 'app.nlexport':
            old = find_by_prefix(chunk, 'OMNITUBE documentary - Premiere Pro project')
            new = brand(old).replace(' in the LeccorTube project)', ')')
            resolved.append((old, new))
        if mod == 'app.routes_pro':
            old = find_by_prefix(chunk, '<!doctype html><meta charset="utf-8"><title>OMNITUBE</title>')
            resolved.append((old, old.replace('<title>OMNITUBE</title>', f'<title>{APP}</title>')))
        if mod == 'app.setup_center':
            old = find_by_prefix(chunk, 'from kokoro import KPipeline')
            resolved.append((old, old.replace("'OMNITUBE is ready.'", f"'{APP} is ready.'")))
        for old, new in resolved:
            ob = b'u' + old.encode('utf-8') + b'\x00'
            nb = b'u' + new.encode('utf-8') + b'\x00'
            assert chunk.count(ob) >= 1, f'[{mod}] não encontrado: {old[:60]!r}'
            k = chunk.count(ob)
            chunk = chunk.replace(ob, nb)
            delta_total += (len(nb) - len(ob)) * k
            n += k
        for ob, nb in REPL_ATTR.get(mod, []):
            assert chunk.count(ob) == 1
            chunk = chunk.replace(ob, nb)
            delta_total += len(nb) - len(ob)
            n += 1
        by_name[mod][1] = chunk

    out = b''.join(name.encode() + b'\x00' + struct.pack('<I', len(c)) + c for name, c in mods)
    print(f'{n} textos trocados, saldo {delta_total:+d} bytes (tabela {end} -> {len(out)})')
    assert len(out) == end + delta_total
    if delta_total > 0:
        sys.exit(f'saldo positivo ({delta_total:+d}): encurte algum texto para caber no espaço original')
    out += b'\x00' * (end - len(out))
    assert len(out) == end
    # validação: reler a nova tabela e conferir nomes e tamanhos
    mods2, end2 = parse(out + b'\x00' * 16)
    assert [m[0] for m in mods2] == [m[0] for m in mods]
    if dry:
        return
    data[BLOB_OFF:BLOB_OFF + end] = out
    open(dst, 'wb').write(data)
    print('gravado:', dst)


if __name__ == '__main__':
    main()
