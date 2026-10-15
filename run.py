import os
import sys
import threading
import time
import uvicorn

# Ensure the root directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

def start_server(host="127.0.0.1", port=7860):
    """Start the FastAPI backend with Uvicorn."""
    # Ensure PRO features are fully unlocked and activated
    try:
        import app.pro
        if not app.pro.is_pro():
            mid = app.pro.machine_id()
            owner_key = app.pro.owner_key_for(mid)
            app.pro.activate(owner_key)
        app.pro.is_pro = lambda: True
        app.pro.require = lambda *args, **kwargs: None
    except Exception as e:
        print(f"[PRO] Activation info: {e}")

    try:
        import app.routes_pro
        app.routes_pro._pro = lambda: True
    except Exception:
        pass

    try:
        import app.llm
        app.llm._pro = lambda: True
    except Exception:
        pass

    # Resilient downloader wrapper: clean incomplete/corrupted .part files and retry cleanly
    try:
        import glob
        import app.downloader
        orig_download = app.downloader.download

        def safe_download(url, out, connections=8, progress=lambda *a: None, cancel=lambda: False, expected_size=None):
            try:
                return orig_download(url, out, connections=connections, progress=progress, cancel=cancel, expected_size=expected_size)
            except Exception as e:
                err_msg = str(e).lower()
                if "incomplete" in err_msg or "download part" in err_msg or "size check failed" in err_msg:
                    out_str = str(out)
                    for corrupted_part in glob.glob(f"{out_str}.part*") + glob.glob(f"{out_str}.tmp*"):
                        try:
                            os.remove(corrupted_part)
                        except Exception:
                            pass
                    # Retry with 1 direct connection stream
                    return orig_download(url, out, connections=1, progress=progress, cancel=cancel, expected_size=expected_size)
                raise e

        app.downloader.download = safe_download
    except Exception as e:
        print(f"[DOWNLOADER] Safe wrapper info: {e}")

    import app.main
    config = uvicorn.Config(
        app=app.main.app,
        host=host,
        port=port,
        log_level="info",
        access_log=False
    )
    server = uvicorn.Server(config)
    server.run()

def start_window(url="http://127.0.0.1:7860"):
    """Start the desktop WebView GUI."""
    import engine.window as window
    sys.argv = [sys.argv[0], url]
    window.main()

def main():
    port = int(os.environ.get("PORT", 7860))
    host = os.environ.get("HOST", "127.0.0.1")
    url = f"http://{host}:{port}"

    print(f"==================================================")
    print(f" Starting LECCORTUBE Engine & GUI")
    print(f" URL: {url}")
    print(f"==================================================")

    # Start FastAPI in a background daemon thread
    server_thread = threading.Thread(target=start_server, args=(host, port), daemon=True)
    server_thread.start()

    # Launch desktop window
    try:
        start_window(url)
    except KeyboardInterrupt:
        print("\nStopping LECCORTUBE...")

if __name__ == "__main__":
    main()
