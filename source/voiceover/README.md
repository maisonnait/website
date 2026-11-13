# The film's voice-over

The 26-second film exists in three cuts, one per voice-over: `media/film-fr.mp4`, `media/film-en.mp4`, `media/film-ar.mp4`. The page plays the cut that matches its language; Darija and Tamazight use the Arabic one. The picture is the same in all three.

The film starts silent. The sound button restarts it from the first word; with sound on it plays once and stops on the name.

## What is said

Each line starts a little after its cut (shots begin at 0, 5, 10.5, 16 and 21.5 s). The captions on the page show the same words; the last column is the spelling given to the synthetic voice where a word needed steering.

### French

| Shot | Voice from–to (s) | Caption | Spelling for the voice |
|---|---|---|---|
| 1 | 0.8–3.5 | Aït. En tamazight : ceux d’une même terre. | Aït. En tamazirte : ceux d'une même terre. |
| 2 | 5.9–8.3 | Une terre où l’on reconnaît les siens à leur parfum. | same |
| 3 | 11.4–14.0 | Rose du Dadès, fleur d’oranger, cèdre de l’Atlas. | Rose du Dadèss, fleur d'oranger, cèdre de l'Atlas. |
| 4 | 16.9–19.9 | L’ambre, le musc et l’oud : ce qui reste quand tout s’efface. | L'ambre, le musc et l'oude : ce qui reste quand tout s'efface. |
| 5 | 22.2–24.3 | Maison N’Ait. Désormais en ligne. | Maison N'Aït. Désormais en ligne. |

### English

| Shot | Voice from–to (s) | Caption | Spelling for the voice |
|---|---|---|---|
| 1 | 0.8–3.7 | Aït. In Tamazight: the people of one land. | Ite. In Tamazight: the people of one land. |
| 2 | 5.9–8.2 | A land where you know your own by their scent. | same |
| 3 | 11.4–13.9 | Dadès rose, orange blossom, Atlas cedar. | Dadess rose, orange blossom, Atlas cedar. |
| 4 | 16.9–20.2 | Amber, musk and oud: what stays when the rest has gone. | Amber, musk and ood: what stays when the rest has gone. |
| 5 | 22.2–24.0 | Maison N’Ait. Now online. | Meh-zon Night. Now online. |

### Arabic (Modern Standard) — also played for Darija and Tamazight

| Shot | Voice from–to (s) | Caption | Spelling for the voice |
|---|---|---|---|
| 1 | 0.8–4.3 | آيت. بالأمازيغية: أهلُ الأرض الواحدة. | آيْتْ. بالأمازيغية: أهلُ الأرضِ الواحدة. |
| 2 | 5.9–8.2 | أرضٌ يُعرَف فيها الأهلُ بعطرهم. | أرضٌ يُعرَفُ فيها الأهلُ بعطرهم. |
| 3 | 11.4–14.5 | ورد دادس، زهر البرتقال، أرز الأطلس. | وردُ دادس، زهرُ البرتقال، أرزُ الأطلس. |
| 4 | 16.9–20.6 | عنبرٌ ومسكٌ وعود: ما يبقى حين يزول كلّ شيء. | same |
| 5 | 22.2–25.0 | دار نايت. الآن على الإنترنت. | دار نايت. الآن على الإِنْتَرْنِتْ. |

## How it was made

- **Voice**: synthetic, generated with Supertonic 3 (Supertone Inc.) through the `sherpa-onnx` package, speaker 4, a female voice. The package numbers its ten speakers without naming them; going by their order and pitch, this should be the one Supertone lists as F5 (gentle, soft-spoken). The same speaker reads the three languages. Several takes of each line were generated; the one kept is the take an automatic transcription (Whisper) read back correctly, also once mixed under the music.
- **Music**: a slow pad and a few plucked notes, synthesised by `bed.py`. No sample or recording is used, so there is nothing to license.
- **Levels**: each track is at -16 LUFS with peaks around -2.4 dBFS; the music sits about 12 dB under the voice.
- **Nobody has listened to these tracks yet.** They were checked by transcription and measurement only. Listen to the three cuts before going live.

## Licence and disclosure

The Supertonic 3 model is published by Supertone under the BigScience Open RAIL-M licence (the sample code that comes with it is MIT). As its model pages summarise it, the licence allows commercial use on conditions, one of which is that machine-generated speech is disclosed as such. The page does this with the line under the film (“Voix off de synthèse”, key `film.voice` in `i18n.json`). Keep that line as long as these tracks are used, and read the licence text itself (file `LICENSE` of the `Supertone/supertonic-3` model) before going live.

## Replace a voice-over with a recording

Record the five lines, lay them on a 26-second track (48 kHz) following the times above, then put the track on the silent film:

    ffmpeg -i source/voiceover/film-silent.mp4 -i my-voice-fr.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -t 26 -movflags +faststart media/film-fr.mp4

Nothing else changes: the page only looks for the three file names. With a human voice the “synthetic voice” line can be removed from `page.html`.

## The scripts in this folder

They are the ones used to produce the tracks, kept for reference: `script.py` (the lines and cue times), `bed.py` (the music), `tts.py` (the voice), `lab.py` and `asr.py` (takes and their transcription), `mix.py` (placing, levelling, mixing), `mux.py` (sound onto the film, final checks). They need `sherpa-onnx`, `soundfile`, `numpy`, `scipy`, `ffmpeg`, and two models from the sherpa-onnx releases (`sherpa-onnx-supertonic-3-tts-int8-2026-05-11` and `sherpa-onnx-whisper-turbo`); the folders are set at the top of `tts.py`, `asr.py` and `mux.py`.
