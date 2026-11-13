"""Put each language's sound track on the (silent) film and check the result.

usage: mux.py            -> site/media/film-{fr,en,ar}.mp4 ; prints loudness, timing and a transcription of each line"""
import json, subprocess, sys, os, re
import numpy as np, soundfile as sf
sys.path.insert(0, "/home/claude/tts")
import script, lab, asr, mix

MASTER = "/home/claude/film_master/film.mp4"
OUT = "/home/claude/site/media"

def run(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-800:])
    return r

def probe(p):
    j = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,duration,sample_rate,channels,bit_rate", "-of", "json", p).stdout)
    return j

def faststart(p):
    b = open(p, "rb").read(4096)
    return b.find(b"moov") != -1 and (b.find(b"mdat") == -1 or b.find(b"moov") < b.find(b"mdat"))

for lang in ("fr", "en", "ar"):
    wav = f"/home/claude/tts/work/film-{lang}.wav"
    out = f"{OUT}/film-{lang}.mp4"
    tmp = f"{OUT}/film-{lang}.part.mp4"
    run("ffmpeg", "-v", "error", "-y", "-i", MASTER, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-t", "26", "-movflags", "+faststart", tmp)
    os.replace(tmp, out)
    j = probe(out)
    st = {s["codec_type"]: s for s in j["streams"]}
    print(f"== {out}: {int(j['format']['size']) / 1e6:.2f} MB, video {st['video']['codec_name']} {float(st['video']['duration']):.3f}s, "
          f"audio {st['audio']['codec_name']} {st['audio']['sample_rate']}Hz {st['audio']['channels']}ch {float(st['audio']['duration']):.3f}s, faststart {faststart(out)}")
    # decode what a browser will play and check it
    dec = f"/home/claude/tts/work/check-{lang}.wav"
    run("ffmpeg", "-v", "error", "-y", "-i", out, "-vn", "-ac", "2", "-ar", "48000", dec)
    i, lra, pk = mix.loudness(dec)
    x, sr = sf.read(dec, dtype="float32")
    mono = x.mean(axis=1)
    rep = json.load(open(f"/home/claude/tts/work/film-{lang}.json", encoding="utf-8"))
    print(f"   loudness {i:.1f} LUFS, range {lra:.1f} LU, peak {pk:.1f} dBFS, length {len(x) / sr:.3f}s")
    worst = 0
    for k, (cap, _) in enumerate(script.LINES[lang]):
        a = script.CUES[k]
        b = script.CUES[k + 1] if k + 1 < len(script.CUES) else script.DUR
        seg = mono[int(a * sr): int(b * sr)]
        hyp = asr.transcribe(seg, sr, lang)
        e = lab.cer(lab.norm(script.EXPECT[lang][k] or cap, lang), lab.norm(hyp, lang))
        worst = max(worst, e)
        s0, s1 = rep["voice_spans"][k]
        print(f"   shot {k + 1} [{a:4.1f}-{b:4.1f}s] voice {s0:5.2f}-{s1:5.2f}s (in {s0 - a:.2f}s after the cut, out {b - s1:.2f}s before the next)  cer {e:.2f}  {hyp}")
    print(f"   worst line cer {worst:.2f}")
