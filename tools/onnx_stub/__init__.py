# Stub installed by setup_voice.bat when the real onnx package has no build for this Python.
# Chatterbox never uses onnx (its weights are safetensors), but s3tokenizer imports it.
from types import SimpleNamespace as _NS


def load(*args, **kwargs):
    raise RuntimeError("onnx is not installed (stub)")


numpy_helper = _NS(to_array=load)
__version__ = "0.0-stub"
