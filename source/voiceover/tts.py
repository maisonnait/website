"""Thin wrapper around the Supertonic 3 voices (sherpa-onnx) used for the film's voice-over."""
import os
import numpy as np
import sherpa_onnx

M = "/home/claude/tts/models/supertonic3/sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
_tts = None


def engine():
    global _tts
    if _tts is None:
        cfg = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                    duration_predictor=f"{M}/duration_predictor.int8.onnx",
                    text_encoder=f"{M}/text_encoder.int8.onnx",
                    vector_estimator=f"{M}/vector_estimator.int8.onnx",
                    vocoder=f"{M}/vocoder.int8.onnx",
                    tts_json=f"{M}/tts.json",
                    unicode_indexer=f"{M}/unicode_indexer.bin",
                    voice_style=f"{M}/voice.bin",
                ),
                debug=False, num_threads=2, provider="cpu",
            )
        )
        assert cfg.validate()
        _tts = sherpa_onnx.OfflineTts(cfg)
    return _tts


def say(text, lang, sid=0, speed=1.0, steps=16):
    """Return (samples float32 mono, sample_rate)."""
    g = sherpa_onnx.GenerationConfig()
    g.sid, g.num_steps, g.speed = sid, steps, speed
    g.extra["lang"] = lang
    a = engine().generate(text, g)
    return np.asarray(a.samples, dtype=np.float32), a.sample_rate


def f0_stats(x, sr):
    """Median pitch (Hz) and its spread in semitones, by autocorrelation on voiced frames."""
    n, hop = int(sr * 0.04), int(sr * 0.01)
    lo, hi = int(sr / 400), int(sr / 60)
    f0 = []
    for i in range(0, len(x) - n, hop):
        w = x[i:i + n] * np.hanning(n)
        if np.sqrt(np.mean(w ** 2)) < 0.02:
            continue
        ac = np.correlate(w, w, "full")[n - 1:]
        if ac[0] <= 0:
            continue
        seg = ac[lo:hi]
        k = int(np.argmax(seg)) + lo
        if ac[k] / ac[0] > 0.45:
            f0.append(sr / k)
    if len(f0) < 5:
        return 0.0, 0.0
    f0 = np.array(f0)
    med = float(np.median(f0))
    return med, float(np.std(12 * np.log2(f0 / med)))


def trim(x, sr, thr=0.008, pad=0.03):
    """Cut leading and trailing silence, keeping a short pad."""
    env = np.abs(x)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]
