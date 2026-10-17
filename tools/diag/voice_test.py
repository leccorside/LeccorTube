import faulthandler
import os
import sys
import time

out_dir = sys.argv[1]
faulthandler.dump_traceback_later(60, repeat=True, file=open(os.path.join(out_dir, 'voice_test_stack.txt'), 'w'))
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
t0 = time.time()


def step(msg):
    print(f'[{time.time() - t0:6.1f}s] {msg}', flush=True)


step('importando torch')
import torch  # noqa: E402
step(f'torch {torch.__version__} de {os.path.dirname(torch.__file__)} | cuda={torch.cuda.is_available()}')
step('importando chatterbox.tts_turbo')
from chatterbox.tts_turbo import ChatterboxTurboTTS  # noqa: E402
step('carregando modelo na GPU')
model = ChatterboxTurboTTS.from_pretrained(device='cuda' if torch.cuda.is_available() else 'cpu')
step('gerando frase de teste')
wav = model.generate('This is a short test of the natural voice.')
step(f'pronto: {tuple(wav.shape)} amostras a {model.sr} Hz')
import torchaudio  # noqa: E402
torchaudio.save(os.path.join(out_dir, 'voice_test.wav'), wav.cpu(), model.sr)
step('wav salvo')
faulthandler.cancel_dump_traceback_later()
