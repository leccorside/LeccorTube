"""Troca os textos do recurso de versão (Propriedades → Detalhes) de um .exe do Windows.

Lê o VS_VERSIONINFO existente, troca só os campos de texto do StringFileInfo (números de versão,
idioma e code page ficam iguais) e grava de volta com UpdateResource. Só funciona no Windows.

Uso:
    python tools/set_exe_version.py LECCORTUBE.exe
"""
import ctypes
import struct
import sys
from ctypes import wintypes

APP, AUTHOR = 'LeccorTube', 'Leccorside Ai'
NEW_STRINGS = {
    'CompanyName': AUTHOR,
    'FileDescription': f'{APP} AI video engine by {AUTHOR}',
    'ProductName': APP,
    'LegalCopyright': f'(c) {AUTHOR}',
    'InternalName': APP,
    'OriginalFilename': 'LECCORTUBE.exe',
}
RT_VERSION = 16

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.LoadLibraryExW.restype = wintypes.HMODULE
k32.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
k32.FindResourceW.restype = wintypes.HANDLE
k32.FindResourceW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p]
k32.SizeofResource.restype = wintypes.DWORD
k32.SizeofResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
k32.LoadResource.restype = wintypes.HANDLE
k32.LoadResource.argtypes = [wintypes.HMODULE, wintypes.HANDLE]
k32.LockResource.restype = ctypes.c_void_p
k32.LockResource.argtypes = [wintypes.HANDLE]
k32.FreeLibrary.argtypes = [wintypes.HMODULE]
k32.BeginUpdateResourceW.restype = wintypes.HANDLE
k32.BeginUpdateResourceW.argtypes = [wintypes.LPCWSTR, wintypes.BOOL]
k32.UpdateResourceW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, wintypes.WORD,
                                ctypes.c_void_p, wintypes.DWORD]
k32.EndUpdateResourceW.argtypes = [wintypes.HANDLE, wintypes.BOOL]
ENUMLANGPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p,
                                  wintypes.WORD, ctypes.c_void_p)
k32.EnumResourceLanguagesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p, ENUMLANGPROC,
                                       ctypes.c_void_p]


def align4(n):
    return (n + 3) & ~3


def parse_tree(buf, off=0):
    """Nó do VS_VERSIONINFO: key, type (1 = texto), value (bytes) e children."""
    length, vlen, typ = struct.unpack_from('<HHH', buf, off)
    end = off + length
    k = off + 6
    while buf[k:k + 2] != b'\x00\x00':
        k += 2
    key = buf[off + 6:k].decode('utf-16-le')
    p = align4(k + 2)
    vbytes = vlen * 2 if typ == 1 else vlen  # texto: tamanho em WCHARs (pela especificação)
    vbytes = min(vbytes, end - p)  # alguns geradores (ex.: Nuitka) gravam o tamanho em bytes
    value = bytes(buf[p:p + vbytes])
    if typ == 1 and vlen:
        text = value.decode('utf-16-le', errors='replace').split('\x00')[0]
        value = (text + '\x00').encode('utf-16-le')
        vbytes = min(vbytes, len(value))
    p = align4(p + vbytes)
    children = []
    while p < end:
        child = parse_tree(buf, p)
        children.append(child)
        p = align4(child['_end'])
    return {'key': key, 'type': typ, 'value': value, 'children': children, '_end': end}


def build(node):
    key = node['key'].encode('utf-16-le') + b'\x00\x00'
    head_len = 6 + len(key)
    out = bytearray(b'\x00' * 6) + key
    out += b'\x00' * (align4(head_len) - head_len)
    value = node['value']
    out += value
    if node['children']:
        out += b'\x00' * (align4(len(out)) - len(out))
        for i, ch in enumerate(node['children']):
            cb = build(ch)
            out += cb
            if i < len(node['children']) - 1:
                out += b'\x00' * (align4(len(out)) - len(out))
    vlen = len(value) // 2 if node['type'] == 1 else len(value)
    struct.pack_into('<HHH', out, 0, len(out), vlen, node['type'])
    return bytes(out)


def read_version(exe):
    """Bytes do recurso de versão nº 1 e o(s) idioma(s) em que ele está gravado."""
    h = k32.LoadLibraryExW(exe, None, 0x2)  # LOAD_LIBRARY_AS_DATAFILE
    if not h:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        r = k32.FindResourceW(h, 1, RT_VERSION)
        if not r:
            raise ctypes.WinError(ctypes.get_last_error())
        size = k32.SizeofResource(h, r)
        ptr = k32.LockResource(k32.LoadResource(h, r))
        langs = []

        def on_lang(_h, _t, _n, lang, _p):
            langs.append(lang)
            return True

        k32.EnumResourceLanguagesW(h, RT_VERSION, 1, ENUMLANGPROC(on_lang), None)
        return ctypes.string_at(ptr, size), langs
    finally:
        k32.FreeLibrary(h)


def main():
    exe = sys.argv[1]
    raw, res_langs = read_version(exe)
    assert len(res_langs) == 1, f'esperado 1 idioma para o recurso de versão, achei {res_langs}'
    root = parse_tree(raw)
    assert root['key'] == 'VS_VERSION_INFO'
    langs, changed = [], []
    for sfi in root['children']:
        if sfi['key'] != 'StringFileInfo':
            continue
        for table in sfi['children']:
            langs.append(table['key'])
            for s in table['children']:
                if s['key'] in NEW_STRINGS:
                    old = s['value'].decode('utf-16-le').rstrip('\x00')
                    s['value'] = (NEW_STRINGS[s['key']] + '\x00').encode('utf-16-le')
                    s['type'] = 1
                    changed.append((s['key'], old, NEW_STRINGS[s['key']]))
    assert langs, 'StringFileInfo não encontrado'
    new = build(root)
    lang = res_langs[0]  # grava no mesmo idioma para substituir (e não duplicar) o recurso
    hupd = k32.BeginUpdateResourceW(exe, False)
    if not hupd:
        raise ctypes.WinError(ctypes.get_last_error())
    buf = ctypes.create_string_buffer(new, len(new))
    ok = k32.UpdateResourceW(hupd, RT_VERSION, 1, lang, buf, len(new))
    if not ok:
        err = ctypes.get_last_error()
        k32.EndUpdateResourceW(hupd, True)
        raise ctypes.WinError(err)
    if not k32.EndUpdateResourceW(hupd, False):
        raise ctypes.WinError(ctypes.get_last_error())
    for key, old, nv in changed:
        print(f'{key}: {old!r} -> {nv!r}')


if __name__ == '__main__':
    main()
