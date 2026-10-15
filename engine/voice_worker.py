import json
import os
import sys
import traceback

os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')

_models = {}
_conds = {}
_builtin = {}
_OUT = sys.stdout
sys.stdout = sys.stderr

def _log(msg):
    print(msg, file=sys.stderr, flush=True)

def _device():
    import torch
    return 'cuda' if torch.cuda.is_available() else 'cpu'

_patched = False

def _patch_float32():
    global _patched
    if _patched:
        return
    _patched = True
    import numpy as np
    import torch

    def f32(x):
        if isinstance(x, np.ndarray):
            return x.astype(np.float32, copy=False)
        if torch.is_tensor(x) and x.is_floating_point() and x.dtype != torch.float32:
            return x.float()
        if isinstance(x, (list, tuple)):
            return type(x)(f32(i) for i in x)
        return x

    try:
        from chatterbox.models.s3tokenizer import s3tokenizer as _s3
        cls = _s3.S3Tokenizer
        orig_mel = cls.log_mel_spectrogram

        def log_mel_spectrogram(self, audio, *a, **k):
            return orig_mel(self, f32(audio), *a, **k)

        cls.log_mel_spectrogram = log_mel_spectrogram
    except Exception as e:
        _log(f'float32 patch (tokenizer) skipped: {e}')

    try:
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        if hasattr(ChatterboxTurboTTS, 'norm_loudness'):
            orig_norm = ChatterboxTurboTTS.norm_loudness

            def norm_loudness(self, wav, sr, *a, **k):
                return f32(orig_norm(self, f32(wav), sr, *a, **k))

            ChatterboxTurboTTS.norm_loudness = norm_loudness
    except Exception as e:
        _log(f'float32 patch (turbo) skipped: {e}')

def _model(engine):
    _patch_float32()
    if engine not in _models:
        for other in list(_models):
            del _models[other]
            _conds.clear()
        dev = _device()
        _log(f'Loading Chatterbox {engine} on {dev} (first time downloads about 2 to 4 GB)...')
        if engine == 'turbo':
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            _models[engine] = ChatterboxTurboTTS.from_pretrained(device=dev)
        elif engine == 'mtl':
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            _models[engine] = ChatterboxMultilingualTTS.from_pretrained(device=dev)
        else:
            from chatterbox.tts import ChatterboxTTS
            _models[engine] = ChatterboxTTS.from_pretrained(device=dev)

        _builtin[engine] = _models[engine].conds
        _log('Voice model ready')

    return _models[engine]

def _prepare(engine, model, voice, exaggeration):
    if not voice:
        model.conds = _builtin.get(engine)
        return

    key = (engine, voice, os.path.getmtime(voice), round(float(exaggeration), 3))
    if key in _conds:
        model.conds = _conds[key]
        return

    if engine == 'turbo':
        model.prepare_conditionals(voice, exaggeration=0.0)
    else:
        model.prepare_conditionals(voice, exaggeration=exaggeration)

    _conds[key] = model.conds

def synth(req):
    import numpy as np
    import soundfile as sf
    import torch

    engine = req.get('engine', 'turbo')
    model = _model(engine)
    p = req.get('params', {})
    exaggeration = float(p.get('exaggeration', 0.5))
    _prepare(engine, model, req.get('voice'), exaggeration)

    if model.conds is None:
        raise RuntimeError('No voice loaded. Pick a voice sample.')

    sr = model.sr
    pause = np.zeros(int(float(req.get('pause', 0.3)) * sr), dtype=np.float32)
    expect = req.get('expect') or []
    seed = int(req.get('seed', 0))
    parts = []

    for i, text in enumerate(req['chunks']):
        best = None
        for attempt in range(3):
            torch.manual_seed(seed + i * 101 + attempt * 7919)
            if engine == 'mtl':
                wav = model.generate(
                    text,
                    language_id=req.get('lang', 'en'),
                    exaggeration=exaggeration,
                    cfg_weight=float(p.get('cfg_weight', 0.5)),
                    temperature=float(p.get('temperature', 0.8))
                )
            elif engine == 'turbo':
                wav = model.generate(
                    text,
                    temperature=float(p.get('temperature', 0.8)),
                    top_p=float(p.get('top_p', 0.95)),
                    repetition_penalty=float(p.get('repetition_penalty', 1.2))
                )
            else:
                wav = model.generate(
                    text,
                    exaggeration=exaggeration,
                    cfg_weight=float(p.get('cfg_weight', 0.5)),
                    temperature=float(p.get('temperature', 0.8))
                )

            a = wav.squeeze().detach().cpu().numpy().astype(np.float32).reshape(-1)
            dur = len(a) / sr
            want = float(expect[i]) if (i < len(expect) and expect[i]) else 0.0

            ok = (not want) or (0.45 * want <= dur <= 2.4 * want + 1.5)

            if best is None or (want and abs(dur - want) < abs(len(best) / sr - want)):
                best = a

            if ok:
                break

            _log(f"chunk {i + 1}: length {dur:.1f}s looks wrong (expected about {want:.1f}s), retrying")

        parts.append(best)
        if i < len(req['chunks']) - 1:
            parts.append(pause)

    audio = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 0.99:
        audio = (audio / peak) * 0.95

    sf.write(req['out'], audio, sr)
    return {'ok': True, 'seconds': len(audio) / sr, 'sr': sr}

def main():
    _log('voice worker started')
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        cmd = req.get('cmd')
        if cmd == 'quit':
            _OUT.write(json.dumps({'ok': True}) + '\n')
            _OUT.flush()
            return
        elif cmd == 'ping':
            import torch
            res = {
                'ok': True,
                'cuda': torch.cuda.is_available(),
                'gpu': torch.cuda.get_device_name(0) if torch.cuda.is_available() else ''
            }
            try:
                import chatterbox
                res['chatterbox'] = True
            except Exception as e:
                res.update({'ok': False, 'error': f'chatterbox not installed: {e}'})
        elif cmd == 'synth':
            try:
                res = synth(req)
            except Exception as e:
                _log(traceback.format_exc())
                res = {'ok': False, 'error': f'{e.__class__.__name__}: {e}'}
        else:
            res = {'ok': False, 'error': f'unknown command {cmd}'}

        _OUT.write(json.dumps(res) + '\n')
        _OUT.flush()

if __name__ == '__main__':
    main()
