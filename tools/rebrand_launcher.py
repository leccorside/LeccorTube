"""Troca a marca OMNITUBE/Haris Ai pelos textos LeccorTube/Leccorside Ai no launcher Nuitka onefile.

O launcher é um Nuitka onefile: o payload (zstd) fica em .rdata a partir de PAYLOAD_OFF e contém o
launcher.dll, cuja tabela de constantes guarda os textos. O bloco __main__ precisa manter o mesmo
tamanho (a docstring do módulo é usada para compensar) e o frame zstd novo é completado com um
skippable frame até o tamanho original. Os offsets valem para o OMNITUBE.exe 1.4.2.0 original.

Uso (requer o pacote zstandard):
    python tools/rebrand_launcher.py OMNITUBE.exe LECCORTUBE.exe
"""
import struct
import sys

import zstandard

SRC, DST = sys.argv[1], sys.argv[2]
PAYLOAD_OFF = 0x20850          # 'KAY' + frame zstd
MAIN_CHUNK = (0x69db35, 0x6a0ae2)  # bloco __main__ da tabela de constantes (offsets no launcher.dll)

APP, AUTHOR = 'LeccorTube', 'Leccorside Ai'

# (antigo, novo) — conteúdo exato incluindo o marcador de tipo e o \0 final
REPL = [
    (b'aOMNITUBE\x00', f'a{APP}\x00'),
    (b'uHaris Ai\x00', f'u{AUTHOR}\x00'),
    (b'uBring the running OMNITUBE (app window or its setup console) to the front.\x00',
     f'uBring the running {APP} to the front.\x00'),
    (b"uThe OMNITUBE desktop window (frameless WebView2 with OMNITUBE's own title bar).\x00",
     f'uThe {APP} desktop window.\x00'),
    (b"u  (OMNITUBE does not use that 'minor version link', so the message above is harmless. Continuing.)\x00",
     f"u  ({APP} does not use that 'minor version link', so the message above is harmless. Continuing.)\x00"),
    (b'u  First start: preparing the OMNITUBE engine (one time, about 150 MB).\x00',
     f'u  First start: preparing the {APP} engine (one time, about 150 MB).\x00'),
    (b'u  Could not create the engine. Check the internet connection and start OMNITUBE again.\x00',
     f'u  Could not create the engine. Check the internet connection and start {APP} again.\x00'),
    (b'u  Package install failed. Start OMNITUBE again (it continues where it stopped).\x00',
     f'u  Package install failed. Start {APP} again (it continues where it stopped).\x00'),
    (b'uPreparing OMNITUBE (one time)\x00', f'uPreparing {APP} (one time)\x00'),
    (b'uUpdating the OMNITUBE engine\x00', f'uUpdating the {APP} engine\x00'),
    (b'uOMNITUBE could not download its engine. Check your internet connection, then click Try again. '
     b'It continues where it stopped.\n\nStill not working? Send logs\\setup.log to the OMNITUBE Discord.\x00',
     f'u{APP} could not download its engine. Check your internet connection, then click Try again. '
     f'It continues where it stopped.\n\nStill not working? Check logs\\setup.log.\x00'),
    (b"uAnother program is using OMNITUBE's port\x00", f"uAnother program is using {APP}'s port\x00"),
    (b'u is used by another program. Close that program (or restart the PC) and start OMNITUBE again.\x00',
     f'u is used by another program. Close that program (or restart the PC) and start {APP} again.\x00'),
    (b'uOMNITUBE could not start\x00', f'u{APP} could not start\x00'),
    (b'uThe OMNITUBE engine stopped while starting (code \x00', f'uThe {APP} engine stopped while starting (code \x00'),
    (b'u). Click Try again. If it keeps happening, open Setup Center > Repair, or send logs\\server.log '
     b'to the OMNITUBE Discord.\x00',
     'u). Click Try again. If it keeps happening, open Setup Center > Repair, or check logs\\server.log.\x00'),
    (b'uOMNITUBE stopped\x00', f'u{APP} stopped\x00'),
    (b'uOMNITUBE stopped with an error (code \x00', f'u{APP} stopped with an error (code \x00'),
    (b'u). Start it again. If it keeps happening, send logs\\server.log to the OMNITUBE Discord.\x00',
     'u). Start it again. If it keeps happening, check logs\\server.log.\x00'),
    (b'uOnly one OMNITUBE.exe at a time. A second double-click (common while the first start is still '
     b'setting up)\n    used to start a second engine install into the same folder, and both stalled.\x00',
     f'uOnly one {APP} launcher at a time.\x00'),
]
DOC_PREFIX = b'uOMNITUBE launcher (becomes OMNITUBE.exe).'  # docstring do módulo: usado para equilibrar o tamanho

exe = bytearray(open(SRC, 'rb').read())
assert exe[PAYLOAD_OFF:PAYLOAD_OFF + 3] == b'KAY', 'payload não encontrado'
frame_off = PAYLOAD_OFF + 3
dobj = zstandard.ZstdDecompressor().decompressobj()
raw = bytearray(dobj.decompress(bytes(exe[frame_off:])))
clen = len(exe) - frame_off - len(dobj.unused_data)
size_field = frame_off + clen
assert struct.unpack_from('<Q', exe, size_field)[0] == clen + 3, 'campo de tamanho inesperado'

# localizar launcher.dll dentro do payload (nome UTF-16 + \0\0 + uint64 tamanho + dados)
name = 'launcher.dll'.encode('utf-16-le') + b'\x00\x00'
assert raw.startswith(name)
dll_size = struct.unpack_from('<Q', raw, len(name))[0]
dll_off = len(name) + 8
dll = raw[dll_off:dll_off + dll_size]

s, e = MAIN_CHUNK
chunk = bytes(dll[s:e])
assert chunk.startswith(b'__main__\x00')
new = chunk
for old, rep in REPL:
    rep = rep.encode('utf-8')
    assert new.count(old) == 1, f'não único/ausente: {old[:50]!r} ({new.count(old)})'
    new = new.replace(old, rep)

# equilibrar com a docstring do módulo
i = new.find(DOC_PREFIX)
j = new.find(b'\x00', i)
assert i > 0 and new.count(DOC_PREFIX) == 1
delta = len(new) - len(chunk)
doc_len = j - i  # inclui o 'u'
target = doc_len - delta
base = f'u{APP} launcher. Standard library only.'.encode('utf-8')
assert target >= len(base), f'sem folga: precisa {target}, base {len(base)}'
doc = base + b' ' * (target - len(base))
new = new[:i] + doc + new[j:]
assert len(new) == len(chunk), (len(new), len(chunk))
assert b'Haris' not in new and b'Discord' not in new
dll[s:e] = new
raw[dll_off:dll_off + dll_size] = dll

# recomprimir e caber exatamente no espaço original (preenchendo com skippable frame)
# mesmas opções do frame original (janela 128 MB, sem content size, sem checksum) + long distance matching
level = 22
params = zstandard.ZstdCompressionParameters.from_level(
    level, window_log=27, enable_ldm=True, write_content_size=False, write_checksum=False)
comp = zstandard.ZstdCompressor(compression_params=params).compress(bytes(raw))
pad = clen - len(comp)
assert pad >= 8, f'compressão maior que o original: {len(comp)} > {clen}'
skippable = struct.pack('<II', 0x184D2A50, pad - 8) + b'\x00' * (pad - 8)
blob = comp + skippable
assert len(blob) == clen
exe[frame_off:frame_off + clen] = blob

# validação: descompactar de novo e comparar
chk = zstandard.ZstdDecompressor().decompressobj()
out = chk.decompress(bytes(exe[frame_off:frame_off + clen]))
assert out == bytes(raw), 'validação falhou'
open(DST, 'wb').write(exe)
print(f'ok: {len(REPL)} textos trocados, docstring ajustada ({doc_len} -> {target} bytes), '
      f'zstd nível {level}, folga {pad} bytes')
