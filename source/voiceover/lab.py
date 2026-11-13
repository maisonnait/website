"""Try wordings and voices: several takes per line, each transcribed back and scored against what it should say."""
import re, sys, json, unicodedata, numpy as np, soundfile as sf
import tts, asr

def norm(s, lang):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    if lang == "ar":
        s = re.sub("[ً-ْٰـ]", "", s)
        s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\w\s]", " ", s, flags=re.U)
    return re.sub(r"\s+", " ", s).strip()

def cer(a, b):
    """Character error rate of hypothesis b against reference a (Levenshtein / len(a))."""
    a, b = a.replace(" ", ""), b.replace(" ", "")
    if not a: return 1.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] / len(a)

def clean(x, sr):
    """Trim silence on a smoothed envelope, keep 120 ms on each side."""
    w = int(sr * 0.02)
    env = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, "same"))
    idx = np.where(env > max(0.002, env.max() * 0.008))[0]
    if len(idx) == 0: return x
    a, b = max(0, idx[0] - int(.12 * sr)), min(len(x), idx[-1] + int(.30 * sr))
    return x[a:b]

def takes(text, lang, sid, expect=None, n=3, speed=1.0, steps=16):
    out = []
    for k in range(n):
        x, sr = tts.say(text, lang, sid=sid, speed=speed, steps=steps)
        x = clean(x, sr)
        hyp = asr.transcribe(np.concatenate([np.zeros(sr // 3, np.float32), x, np.zeros(sr // 2, np.float32)]), sr, lang)
        e = cer(norm(expect or text, lang), norm(hyp, lang))
        out.append({"x": x, "sr": sr, "hyp": hyp, "cer": e, "dur": len(x) / sr})
    return sorted(out, key=lambda t: t["cer"])

if __name__ == "__main__":
    lang, sid = sys.argv[1], int(sys.argv[2])
    for text in sys.argv[3:]:
        exp = None
        if "=>" in text: text, exp = [p.strip() for p in text.split("=>")]
        ts = takes(text, lang, sid, exp)
        print(f"[{lang} sid{sid}] {text}")
        for t in ts:
            print(f"    cer {t['cer']:.2f}  {t['dur']:.2f}s  {t['hyp']}")
