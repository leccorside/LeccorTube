import ctypes
import os
import sys
import threading
import time
import urllib.request

import webview

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:7860'
ICON = sys.argv[2] if len(sys.argv) > 2 else ''
TITLE = 'LECCORTUBE'
IS_WIN = os.name == 'nt'

if IS_WIN:
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    user32.GetWindowLongPtrW.restype = ctypes.c_ssize_t
    user32.SetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]
    user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]

    class RECT(ctypes.Structure):
        _fields_ = [('left', ctypes.c_long), ('top', ctypes.c_long), ('right', ctypes.c_long), ('bottom', ctypes.c_long)]

    class MONITORINFO(ctypes.Structure):
        _fields_ = [('cbSize', ctypes.c_ulong), ('rcMonitor', RECT), ('rcWork', RECT), ('dwFlags', ctypes.c_ulong)]

WM_SYSCOMMAND, SC_SIZE, SC_MOVE_DRAG = 274, 61440, 61458
EDGES = {
    'l': 1,
    'r': 2,
    't': 3,
    'tl': 4,
    'tr': 5,
    'b': 6,
    'bl': 7,
    'br': 8,
}

def _hwnd():
    if not IS_WIN:
        return None
    pid = os.getpid()
    found = []

    def cb(h, _):
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(h, ctypes.byref(p))
        if p.value == pid and user32.IsWindowVisible(h) and not user32.GetParent(h):
            n = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(h, n, 256)
            if n.value == TITLE:
                found.append(h)
        return True

    cb_func = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)(cb)
    user32.EnumWindows(cb_func, 0)
    return found[0] if found else None

LOG = os.environ.get('LECCORTUBE_WINLOG') or os.environ.get('OMNITUBE_WINLOG') or os.path.join(os.environ.get('LECCORTUBE_HOME') or os.environ.get('OMNITUBE_HOME', os.getcwd()), 'logs', 'window.log')

def _log(*a):
    try:
        with open(LOG, 'a', encoding='utf-8') as fh:
            fh.write(time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a) + '\n')
    except OSError:
        pass

def _monitor(h):
    mon = user32.MonitorFromWindow(h, 2)
    mi = MONITORINFO()
    mi.cbSize = ctypes.sizeof(MONITORINFO)
    if user32.GetMonitorInfoW(mon, ctypes.byref(mi)):
        return mi
    return None

def _evaljs(api, code):
    try:
        api._win.evaluate_js(code)
    except Exception:
        pass

class Api:
    def __init__(self):
        self._win = None
        self._saved = None
        self._maxed = False

    def minimize(self):
        h = _hwnd()
        if h:
            user32.ShowWindow(h, 6)
            return
        self._win.minimize()

    def toggle_maximize(self):
        h = _hwnd()
        _log('max', h)
        if not h:
            return False
        if self._maxed and self._saved:
            l, t, r, b = self._saved
            user32.SetWindowPos(h, 0, l, t, r - l, b - t, 36)
            self._maxed = False
            return self._maxed

        rc = RECT()
        user32.GetWindowRect(h, ctypes.byref(rc))
        self._saved = (rc.left, rc.top, rc.right, rc.bottom)
        mon = user32.MonitorFromWindow(h, 2)
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        user32.GetMonitorInfoW(mon, ctypes.byref(mi))
        w = mi.rcWork
        user32.SetWindowPos(h, 0, w.left, w.top, w.right - w.left, w.bottom - w.top, 36)
        self._maxed = True
        return self._maxed

    def is_maximized(self):
        return self._maxed

    def close(self):
        self._win.destroy()

    def log(self, *a):
        _log('js:', *a)

    def _busy(self):
        try:
            return bool(self._win.evaluate_js('window.__omni_busy === true'))
        except Exception:
            return False

    def drag(self):
        if not IS_WIN:
            return
        h = _hwnd()
        if not h:
            return
        user32.ReleaseCapture()
        user32.SendMessageW(h, WM_SYSCOMMAND, SC_MOVE_DRAG, 0)

    def resize(self, edge):
        if not IS_WIN:
            return
        code = EDGES.get(edge)
        if not code:
            return
        h = _hwnd()
        if not h:
            return
        user32.ReleaseCapture()
        user32.SendMessageW(h, WM_SYSCOMMAND, SC_SIZE + code, 0)

    def platform(self):
        return sys.platform

def _polish(api: Api):
    if not IS_WIN:
        return
    for _ in range(60):
        h = _hwnd()
        if h:
            GWL_STYLE = -16
            WS_THICKFRAME = 0x00040000
            WS_MINIMIZEBOX = 0x00020000
            WS_MAXIMIZEBOX = 0x00010000
            style = user32.GetWindowLongPtrW(h, GWL_STYLE)
            style |= (WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX)
            user32.SetWindowLongPtrW(h, GWL_STYLE, ctypes.c_ssize_t(style))
            user32.SetWindowPos(h, 0, 0, 0, 0, 0, 0x0027)
            break
        time.sleep(0.05)

SPLASH = '<!doctype html><html><head><meta charset="utf-8"><style>\nhtml,body{margin:0;height:100%;background:#0b0b10;color:#f6f3f3;font:600 15px \'Segoe UI\',system-ui,sans-serif;overflow:hidden}\nbody{display:grid;place-items:center;-webkit-user-select:none;user-select:none}\n.g{position:fixed;width:900px;height:620px;border-radius:50%;filter:blur(110px);background:radial-gradient(closest-side,#d3101f,transparent);opacity:.25;top:-260px;right:-160px}\n.c{text-align:center;position:relative}\n.w{font:800 34px/1 \'Segoe UI\',sans-serif;letter-spacing:5px}.w b{color:#ff2d40}\n.s{margin-top:10px;color:rgba(246,243,243,.55);font-size:13px;letter-spacing:.4px}\n.bar{width:220px;height:4px;border-radius:9px;background:rgba(255,255,255,.08);margin:26px auto 0;overflow:hidden}\n.bar i{display:block;width:40%;height:100%;border-radius:9px;background:linear-gradient(90deg,#ff2d40,#ff6a3d);animation:m 1.1s ease-in-out infinite}\n@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}\n.x{position:fixed;top:0;right:0;width:48px;height:40px;border:0;background:transparent;color:#aaa;font-size:18px;cursor:pointer}\n.x:hover{background:#e81123;color:#fff}\n</style></head><body><div class="g"></div><button class="x" onclick="window.pywebview&&pywebview.api.close()">&#x2715;</button>\n<div class="c"><div class="w">LECCOR<b>TUBE</b></div><div class="s">by Leccorside Ai &middot; starting the engine</div><div class="bar"><i></i></div></div></body></html>'

def _open_when_ready(win):
    for _ in range(300):
        try:
            req = urllib.request.urlopen(URL, timeout=1)
            if req.status == 200:
                win.load_url(URL)
                return
        except Exception:
            pass
        time.sleep(0.2)

def main():
    _log('start', URL, os.getpid())
    if IS_WIN:
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('LECCORTUBE.LeccorsideAi.App')
        except Exception:
            pass

    api = Api()
    win = webview.create_window(
        TITLE,
        html=SPLASH,
        js_api=api,
        width=1380,
        height=880,
        min_size=(1020, 640),
        frameless=True,
        easy_drag=False,
        background_color='#0b0b10'
    )
    api._win = win

    threading.Thread(target=_polish, args=(api,), daemon=True).start()
    threading.Thread(target=_open_when_ready, args=(win,), daemon=True).start()

    webview.start(debug=False)

if __name__ == '__main__':
    main()
