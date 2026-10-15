"""Troca o ícone embutido de um .exe do Windows pelo de um arquivo .ico (API UpdateResource).

Substitui o primeiro grupo de ícones (RT_GROUP_ICON) mantendo o nome dele, para o Explorer e a
barra de tarefas mostrarem o ícone novo. Só funciona no Windows.

Uso:
    python tools/set_exe_icon.py LECCORTUBE.exe assets/omnitube.ico
"""
import ctypes
import struct
import sys
from ctypes import wintypes

RT_ICON, RT_GROUP_ICON = 3, 14
LANG_NEUTRAL_DEFAULT = 0x0409

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.BeginUpdateResourceW.restype = wintypes.HANDLE
k32.BeginUpdateResourceW.argtypes = [wintypes.LPCWSTR, wintypes.BOOL]
k32.UpdateResourceW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, wintypes.WORD,
                                ctypes.c_void_p, wintypes.DWORD]
k32.EndUpdateResourceW.argtypes = [wintypes.HANDLE, wintypes.BOOL]
k32.LoadLibraryExW.restype = wintypes.HMODULE
k32.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
k32.FreeLibrary.argtypes = [wintypes.HMODULE]
ENUMNAMEPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p,
                                  ctypes.c_void_p)
k32.EnumResourceNamesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ENUMNAMEPROC, ctypes.c_void_p]
ENUMLANGPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p,
                                  wintypes.WORD, ctypes.c_void_p)
k32.EnumResourceLanguagesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p, ENUMLANGPROC,
                                       ctypes.c_void_p]


def first_group(exe):
    """Nome (int ou str) e idioma do primeiro RT_GROUP_ICON do exe."""
    h = k32.LoadLibraryExW(exe, None, 0x2)  # LOAD_LIBRARY_AS_DATAFILE
    if not h:
        raise ctypes.WinError(ctypes.get_last_error())
    found = []

    def on_name(_h, _t, name, _p):
        found.append(name if name < 0x10000 else ctypes.wstring_at(name))
        return False

    k32.EnumResourceNamesW(h, RT_GROUP_ICON, ENUMNAMEPROC(on_name), None)
    if not found:
        k32.FreeLibrary(h)
        return 1, LANG_NEUTRAL_DEFAULT
    langs = []
    name = found[0]
    name_arg = name if isinstance(name, int) else ctypes.c_wchar_p(name)

    def on_lang(_h, _t, _n, lang, _p):
        langs.append(lang)
        return True

    k32.EnumResourceLanguagesW(h, RT_GROUP_ICON, name_arg, ENUMLANGPROC(on_lang), None)
    k32.FreeLibrary(h)
    return name, (langs[0] if langs else LANG_NEUTRAL_DEFAULT)


def main():
    exe, ico = sys.argv[1], sys.argv[2]
    data = open(ico, 'rb').read()
    _, typ, count = struct.unpack_from('<HHH', data, 0)
    assert typ == 1 and count > 0, 'arquivo .ico inválido'
    entries = []
    for i in range(count):
        w, h, colors, _, planes, bpp, size, off = struct.unpack_from('<BBBBHHII', data, 6 + 16 * i)
        entries.append((w, h, colors, planes, bpp, size, data[off:off + size]))

    name, lang = first_group(exe)
    hupd = k32.BeginUpdateResourceW(exe, False)
    if not hupd:
        raise ctypes.WinError(ctypes.get_last_error())
    base_id = 100  # IDs novos para não colidir com os ícones antigos
    grp = struct.pack('<HHH', 0, 1, count)
    for i, (w, h, colors, planes, bpp, size, img) in enumerate(entries):
        buf = ctypes.create_string_buffer(img, len(img))
        if not k32.UpdateResourceW(hupd, RT_ICON, base_id + i, lang, buf, len(img)):
            raise ctypes.WinError(ctypes.get_last_error())
        grp += struct.pack('<BBBBHHIH', w, h, colors, 0, planes, bpp, size, base_id + i)
    gbuf = ctypes.create_string_buffer(grp, len(grp))
    name_arg = name if isinstance(name, int) else ctypes.c_wchar_p(name)
    if not k32.UpdateResourceW(hupd, RT_GROUP_ICON, name_arg, lang, gbuf, len(grp)):
        raise ctypes.WinError(ctypes.get_last_error())
    if not k32.EndUpdateResourceW(hupd, False):
        raise ctypes.WinError(ctypes.get_last_error())
    print(f'ícone trocado: grupo {name!r}, idioma {lang:#06x}, {count} tamanhos')


if __name__ == '__main__':
    main()
