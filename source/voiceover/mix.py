"""Build the film's sound track for one language: voice-over lines placed on the five shots, over the music bed.

usage: mix.py <lang> <sid> [takes]      -> work/film-<lang>.wav (48 kHz stereo, exactly 26 s) + work/film-<lang>.json
The chosen takes are cached in work/takes-<lang>-sid<sid>/ so the mix can be redone without generating again."""
import os, sys, json, subprocess, re
import numpy as np, soundfile as sf
from math import gcd
from scipy.signal import resample_poly, butter, sosfilt, fftconvolve
import script, bed

SR = bed.SR
N = bed.N
LEAD = [0.70, 0.75, 0.75, 0.75, 0.60]          # silence after each cut before the voice comes in
GAP = 0.30                                     # the line ends at least this long before the next cut
TAIL = 0.6                                     # and the last one this long before the end
SPEEDS = [0.92, 1.0, 1.08, 1.16]               # tried in this order until the line fits its shot


def to48(x, sr):
    g = gcd(sr, SR)
    return resample_poly(x, SR // g, sr // g).astype(np.float64)


def window(i):
    start = script.CUES[i] + LEAD[i]
    end = (script.CUES[i + 1] - GAP) if i + 1 < len(script.CUES) else script.DUR - TAIL
    return start, end


def choose(lang, sid, n):
    """Pick one take per line: the best transcription among n, at the slowest speed that fits the shot."""
    import lab
    d = f"work/takes-{lang}-sid{sid}"
    os.makedirs(d, exist_ok=True)
    meta_p = f"{d}/meta.json"
    if os.path.exists(meta_p):
        return json.load(open(meta_p, encoding="utf-8"))
    meta = []
    for i, (cap, say) in enumerate(script.LINES[lang]):
        a, b = window(i)
        pick = None
        for sp in SPEEDS:
            ts = lab.takes(say, lang, sid, script.EXPECT[lang][i] or cap, n=n, speed=sp)
            fit = [t for t in ts if t["dur"] <= b - a]
            if fit:
                best = min(t["cer"] for t in fit)
                good = [t for t in fit if t["cer"] <= best + 1e-9]
                pick = sorted(good, key=lambda t: t["dur"])[len(good) // 2]
                pick["speed"] = sp
                break
        if pick is None:
            raise SystemExit(f"{lang} line {i + 1}: no take fits {b - a:.2f}s")
        sf.write(f"{d}/{i + 1}.wav", pick["x"], pick["sr"], subtype="PCM_16")
        meta.append({"line": i + 1, "caption": cap, "said": say, "heard": pick["hyp"], "cer": round(pick["cer"], 3),
                     "dur": round(pick["dur"], 2), "speed": pick["speed"], "window": [a, b]})
        print(f"  {lang}{i + 1} speed {pick['speed']} {pick['dur']:.2f}s/{b - a:.2f}s cer {pick['cer']:.2f}  {pick['hyp']}", flush=True)
    json.dump(meta, open(meta_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return meta


def voice_track(lang, sid, meta):
    """Mono voice on the film's timeline, lines levelled to one another, plus the envelope used to duck the bed."""
    d = f"work/takes-{lang}-sid{sid}"
    v = np.zeros(N)
    hp = butter(2, 75, "high", fs=SR, output="sos")
    placed = []
    for m in meta:
        x, sr = sf.read(f"{d}/{m['line']}.wav", dtype="float64")
        x = sosfilt(hp, to48(x, sr))
        # level on the loud part of the line (speech, not the pauses inside it)
        w = int(0.05 * SR)
        fr = np.array([np.sqrt(np.mean(x[k:k + w] ** 2)) for k in range(0, len(x) - w, w)])
        act = np.sqrt(np.mean(fr[fr > fr.max() * 0.25] ** 2))
        x *= 0.085 / act
        n = len(x)
        fade = int(0.01 * SR)
        x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
        a = int(m["window"][0] * SR)
        v[a:a + n] += x[: N - a]
        # where the voice actually starts and stops (the takes keep a little silence around them)
        idx = np.where(np.abs(x) > 0.01)[0]
        placed.append((round((a + idx[0]) / SR, 2), round((a + idx[-1]) / SR, 2)))
    env = np.abs(v)
    lp = butter(1, 3.0, "low", fs=SR, output="sos")
    env = np.clip(sosfilt(lp, sosfilt(lp, env)[::-1])[::-1] / 0.03, 0, 1)
    return v, env, placed


def loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    tail = out[out.rindex("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", tail).group(1))
    pk = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
    return i, lra, pk


def limit(x, ceiling=0.84):
    """Soft knee above 70 % of the ceiling; leaves everything below untouched."""
    k = 0.7 * ceiling
    a = np.abs(x)
    over = a > k
    y = x.copy()
    y[over] = np.sign(x[over]) * (k + (ceiling - k) * np.tanh((a[over] - k) / (ceiling - k)))
    return y


def build(lang, sid, n=4, bed_db=-12.0, duck=0.45, target=-16.0):
    meta = choose(lang, sid, n)
    v, env, placed = voice_track(lang, sid, meta)
    plate = bed.reverb_ir(0.9, 6000, 11)
    vv = np.stack([v, v], axis=1)
    wetv = np.stack([fftconvolve(v, plate[:, c])[:N] for c in (0, 1)], axis=1)
    voice = vv + wetv * 0.085                                    # a touch of room so the voice sits in the bed
    b = bed.build()
    body = b[int(4 * SR): int(22 * SR)]
    b *= (0.085 * 10 ** (bed_db / 20)) / np.sqrt(np.mean(body ** 2))
    b *= (1 - duck * env)[:, None]                               # the bed steps back while the voice speaks
    mixd = voice + b
    out = f"work/film-{lang}.wav"
    sf.write(out, limit(mixd), SR, subtype="PCM_24")
    i, lra, pk = loudness(out)
    g = 10 ** ((target - i) / 20)
    y = limit(mixd * g)
    y[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    y[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))[:, None]
    sf.write(out, y, SR, subtype="PCM_16")
    i, lra, pk = loudness(out)
    placed = [[float(a), float(b)] for a, b in placed]
    rep = {"lang": lang, "sid": sid, "lufs": i, "lra": lra, "peak_dbfs": pk, "voice_spans": placed, "lines": meta,
           "bed_db": bed_db, "duck": duck}
    json.dump(rep, open(f"work/film-{lang}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{out}: {i:.1f} LUFS, LRA {lra:.1f}, peak {pk:.1f} dBFS, voice spans {placed}")
    return rep


if __name__ == "__main__":
    build(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 4)
