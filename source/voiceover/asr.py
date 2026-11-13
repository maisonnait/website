"""Speech-to-text check of generated audio (Whisper turbo through sherpa-onnx)."""
import numpy as np, sherpa_onnx
W = "/home/claude/tts/models/whisper/sherpa-onnx-whisper-turbo"
_rec = {}

def recognizer(lang):
    if lang not in _rec:
        _rec[lang] = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=f"{W}/turbo-encoder.int8.onnx", decoder=f"{W}/turbo-decoder.int8.onnx",
            tokens=f"{W}/turbo-tokens.txt", language=lang, task="transcribe", num_threads=2)
    return _rec[lang]

def resample(x, sr, to=16000):
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(sr, to)
    return resample_poly(x, to // g, sr // g).astype(np.float32)

def transcribe(x, sr, lang):
    r = recognizer(lang)
    s = r.create_stream()
    s.accept_waveform(16000, resample(x, sr))
    r.decode_stream(s)
    return s.result.text.strip()
