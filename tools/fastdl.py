"""Fast, resumable downloader: many parallel connections, survives power cuts / internet drops.
Usage: python fastdl.py <url> <output file> [connections]
Stdlib only, so it runs with any Python.
"""
import os
import sys
import threading
import time
import urllib.error
import urllib.request

UA = {"User-Agent": "OMNITUBE-fastdl/1.0"}


def head(url):
    for _ in range(20):
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                cr = r.headers.get("Content-Range", "")
                if "/" in cr:
                    return int(cr.split("/")[-1]), r.geturl()
                return int(r.headers.get("Content-Length", 0)), r.geturl()
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                sys.exit(f"Download link not found (HTTP {e.code}): {url}")
            print(f"  server busy (HTTP {e.code}), retrying...", flush=True)
            time.sleep(5)
        except Exception as e:
            print(f"  waiting for internet ({e.__class__.__name__}), retrying...", flush=True)
            time.sleep(5)
    sys.exit("Server not reachable.")


def worker(url, path, start, end, stats, lock):
    """Download bytes start..end into path, resuming from what is already there."""
    delay = 2
    while True:
        have = os.path.getsize(path) if os.path.exists(path) else 0
        if start + have > end:
            return
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start + have}-{end}"})
            with urllib.request.urlopen(req, timeout=60) as r, open(path, "ab") as f:
                if r.status != 206:
                    raise IOError(f"server ignored range (HTTP {r.status})")
                while True:
                    buf = r.read(256 * 1024)
                    if not buf:
                        break
                    f.write(buf)
                    with lock:
                        stats["done"] += len(buf)
            delay = 2
        except Exception:
            time.sleep(delay)
            delay = min(delay * 2, 60)


def intact(path) -> bool:
    """Wheels and zips carry a CRC for every file inside: check them, so a download damaged by a bad
    connection is caught here instead of failing later inside pip ("Error -3 while decompressing")."""
    if not path.lower().endswith((".whl", ".zip")):
        return True
    import zipfile
    print(f"  Checking {os.path.basename(path)}...", flush=True)
    try:
        with zipfile.ZipFile(path) as z:
            return z.testzip() is None
    except Exception:
        return False


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    url, out = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    if os.path.exists(out):
        if intact(out):
            print(f"Already downloaded: {out}")
            return
        print("  The earlier download was damaged. Downloading it again.", flush=True)
        os.remove(out)
    size, url = head(url)
    if not size:
        sys.exit("Server did not report a file size, cannot split the download.")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    step = size // n + 1
    parts = [(f"{out}.part{i}", i * step, min(size - 1, (i + 1) * step - 1)) for i in range(n)]
    stats, lock = {"done": sum(os.path.getsize(p) for p, _, _ in parts if os.path.exists(p))}, threading.Lock()
    print(f"Downloading {os.path.basename(out)} ({size / 1e9:.2f} GB) with {n} connections")
    if stats["done"]:
        print(f"Resuming, {stats['done'] / 1e9:.2f} GB already here")
    threads = [threading.Thread(target=worker, args=(url, p, s, e, stats, lock), daemon=True) for p, s, e in parts]
    for t in threads:
        t.start()
    last, t0 = stats["done"], time.time()
    while any(t.is_alive() for t in threads):
        time.sleep(1)
        now = stats["done"]
        speed = now - last
        last = now
        left = (size - now) / speed if speed > 0 else 0
        print(f"\r  {now / 1e9:6.2f} / {size / 1e9:.2f} GB  {speed / 1e6:6.2f} MB/s  "
              f"about {int(left // 60)}m {int(left % 60)}s left   ", end="", flush=True)
    print()
    with open(out + ".tmp", "wb") as f:
        for p, s, e in parts:
            if os.path.getsize(p) != e - s + 1:
                sys.exit(f"Part {p} has the wrong size. Run again to fix it.")
            with open(p, "rb") as src:
                while True:
                    buf = src.read(8 * 1024 * 1024)
                    if not buf:
                        break
                    f.write(buf)
    if os.path.getsize(out + ".tmp") != size:
        sys.exit("Size check failed. Run again.")
    for p, _, _ in parts:
        os.remove(p)
    if not intact(out + ".tmp"):
        os.remove(out + ".tmp")
        sys.exit("The download was damaged by the connection. Run setup again: it downloads a fresh copy.")
    os.replace(out + ".tmp", out)
    print(f"Done in {(time.time() - t0) / 60:.1f} min: {out}")


if __name__ == "__main__":
    main()
