import importlib.metadata as md
import os
import sys
import time

log = open(sys.argv[1], 'w', encoding='utf-8', buffering=1)
t0 = time.time()
n = 0
slow = []
for dist in md.distributions():
    name = dist.metadata['Name']
    for f in dist.files or []:
        p = f.locate()
        log.write(f'{time.time() - t0:8.1f} {name} :: {p}\n')
        t = time.time()
        try:
            os.stat(p)
        except OSError:
            pass
        dt = time.time() - t
        n += 1
        if dt > 0.5:
            slow.append((dt, str(p)))
            log.write(f'   LENTO {dt:.1f}s\n')
log.write(f'FIM: {n} arquivos em {time.time() - t0:.1f}s; lentos={len(slow)}\n')
for dt, p in sorted(slow, reverse=True)[:20]:
    log.write(f'   {dt:.1f}s {p}\n')
