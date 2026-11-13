"""Music bed of the film: a slow pad in D that follows the five shots, with a short harp-like figure at each cut.
Everything is synthesised here (sines with slow envelopes, an artificial reverb); no sample or recording is used."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
DUR = 26.0
CUES = [0.0, 5.0, 10.5, 16.0, 21.5]
rng = np.random.default_rng(7)

N = int(SR * DUR)
T = np.arange(N) / SR

def hz(name):
    """Note name such as 'F#4' -> frequency (A4 = 440)."""
    semis = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n, octv = name[:-1], int(name[-1])
    s = semis[n[0]] + (1 if "#" in n else 0) - (1 if "b" in n else 0)
    return 440.0 * 2 ** (s / 12 + (octv - 4))

# one chord per shot: I, I with its third and ninth, IV, V sus4, I
CHORDS = [
    ["D2", "A2", "D3", "A3"],
    ["D2", "A2", "F#3", "A3", "E4"],
    ["G2", "D3", "G3", "B3", "D4"],
    ["A2", "E3", "A3", "D4", "E4"],
    ["D2", "A2", "D3", "F#3", "A3", "D4"],
]
# the figure played just after each cut (note, delay in s)
FIGURES = [
    [("D4", 0.55), ("A4", 0.85), ("D5", 1.15)],
    [("F#4", 0.15), ("A4", 0.43), ("E5", 0.71)],
    [("G4", 0.15), ("B4", 0.43), ("D5", 0.71)],
    [("A4", 0.15), ("D5", 0.43), ("E5", 0.71)],
    [("D4", 0.15), ("A4", 0.43), ("F#5", 0.71), ("D5", 2.9)],
]

def smooth(x):
    """0..1 -> 0..1 with zero slope at both ends."""
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

def pad_note(f, weight):
    """Five slightly detuned voices of one note, each drifting slowly in level and spread across the stereo field."""
    out = np.zeros((N, 2))
    dets = (-0.0023, -0.0011, 0.0, 0.0013, 0.0021)
    for k, det in enumerate(dets):
        ph = rng.uniform(0, 2 * np.pi)
        lfo = 1 + 0.14 * np.sin(2 * np.pi * rng.uniform(0.04, 0.11) * T + rng.uniform(0, 2 * np.pi))
        v = np.sin(2 * np.pi * f * (1 + det) * T + ph)
        v += 0.12 * np.sin(2 * np.pi * 2 * f * (1 + det) * T + ph * 1.7)      # a little second harmonic for warmth
        pan = 0.5 + (k - 2) * 0.17 + rng.uniform(-0.04, 0.04)
        out[:, 0] += v * lfo * np.cos(pan * np.pi / 2)
        out[:, 1] += v * lfo * np.sin(pan * np.pi / 2)
    return out * weight / len(dets)

def pad():
    out = np.zeros((N, 2))
    xf = 1.5                                            # crossfade between chords, centred on the cut
    for i, chord in enumerate(CHORDS):
        a = CUES[i]
        b = CUES[i + 1] if i + 1 < len(CUES) else DUR + xf
        env = smooth((T - (a - xf / 2)) / xf) * (1 - smooth((T - (b - xf / 2)) / xf))
        if i == 0:
            env = 1 - smooth((T - (b - xf / 2)) / xf)
        seg = np.zeros((N, 2))
        for name in chord:
            f = hz(name)
            # the lowest notes stay discreet; the middle of the chord carries the bed, also on small speakers
            w = 0.35 if f < 100 else 0.6 if f < 140 else 0.9 if f < 200 else 1.0 if f < 340 else 0.7
            seg += pad_note(f, w)
            if 140 <= f < 260:
                seg += pad_note(2 * f, 0.34)                                    # soft octave on top
        out += seg * env[:, None]
    return out

def pluck(f, t0, amp, pan):
    """A soft harp-like note: a few harmonics, the higher ones dying faster."""
    n0 = int(t0 * SR)
    t = T[: N - n0]
    att = smooth(t / 0.012)
    v = np.zeros_like(t)
    for h, a, tau in ((1, 1.0, 1.25), (2, 0.30, 0.7), (3, 0.10, 0.4), (4, 0.04, 0.22)):
        v += a * np.sin(2 * np.pi * f * h * t) * np.exp(-t / tau)
    v *= att * amp
    out = np.zeros((N, 2))
    out[n0:, 0] = v * np.cos(pan * np.pi / 2)
    out[n0:, 1] = v * np.sin(pan * np.pi / 2)
    return out

def figures():
    out = np.zeros((N, 2))
    for i, fig in enumerate(FIGURES):
        for k, (name, dt) in enumerate(fig):
            out += pluck(hz(name), CUES[i] + dt, 0.5 if k < 3 else 0.38, 0.35 + 0.15 * (k % 3))
    return out

def reverb_ir(rt60, lowpass, seed):
    """Stereo impulse response: decaying noise, darker as it fades."""
    r = np.random.default_rng(seed)
    n = int(SR * rt60 * 1.2)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-6.91 * t / rt60)[:, None]
    sos = butter(2, lowpass, "low", fs=SR, output="sos")
    ir = sosfilt(sos, ir, axis=0)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]     # short pre-delay ramp
    return ir / np.sqrt((ir ** 2).sum(axis=0)).max()

def wet(x, ir, amount):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in (0, 1)], axis=1)
    return x * (1 - amount) + y * amount * 0.9

def level(x, cutoff=0.9):
    """Ride the gain so the pad keeps an even level: detuned voices drift in and out of phase over seconds."""
    power = np.mean(x ** 2, axis=1)
    sos = butter(2, cutoff, "low", fs=SR, output="sos")
    env = np.sqrt(np.maximum(sosfilt(sos, sosfilt(sos, power)[::-1])[::-1], 1e-12))   # zero-phase smoothing
    floor = np.median(env) * 0.25
    return x / np.maximum(env, floor)[:, None]

def build():
    hall = reverb_ir(2.6, 4200, 3)
    p = level(wet(pad(), hall, 0.38))                                           # unit RMS throughout
    f = wet(figures(), hall, 0.5)
    f /= np.abs(f).max()
    bed = p * 1.0 + f * 2.0
    # the film opens from silence and closes on the name
    bed *= (smooth(T / 2.4) * (1 - smooth((T - 23.2) / 2.7)))[:, None]
    sos = butter(2, 55, "high", fs=SR, output="sos")
    return sosfilt(sos, bed, axis=0)

if __name__ == "__main__":
    import soundfile as sf
    b = build()
    b = b / np.abs(b).max() * 0.5
    sf.write("/home/claude/tts/work/bed.wav", b, SR, subtype="PCM_16")
    print("bed", b.shape, "peak", np.abs(b).max().round(3), "rms", np.sqrt(np.mean(b ** 2)).round(4))
