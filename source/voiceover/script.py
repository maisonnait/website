"""Voice-over of the 26-second film: what each language says (caption form) and how it is spelt for the voice."""
# cue start (s) of the five shots; the film lasts 26 s
CUES = [0.0, 5.0, 10.5, 16.0, 21.5]
DUR = 26.0

# (text shown as caption, text given to the voice). The second differs only where a spelling steers the pronunciation.
LINES = {
    "fr": [
        ("Aït. En tamazight : ceux d’une même terre.", "Aït. En tamazirte : ceux d'une même terre."),
        ("Une terre où l’on reconnaît les siens à leur parfum.", "Une terre où l'on reconnaît les siens à leur parfum."),
        ("Rose du Dadès, fleur d’oranger, cèdre de l’Atlas.", "Rose du Dadèss, fleur d'oranger, cèdre de l'Atlas."),
        ("L’ambre, le musc et l’oud : ce qui reste quand tout s’efface.", "L'ambre, le musc et l'oude : ce qui reste quand tout s'efface."),
        ("Maison N’Ait. Désormais en ligne.", "Maison N'Aït. Désormais en ligne."),
    ],
    "en": [
        ("Aït. In Tamazight: the people of one land.", "Ite. In Tamazight: the people of one land."),
        ("A land where you know your own by their scent.", "A land where you know your own by their scent."),
        ("Dadès rose, orange blossom, Atlas cedar.", "Dadess rose, orange blossom, Atlas cedar."),
        ("Amber, musk and oud: what stays when the rest has gone.", "Amber, musk and ood: what stays when the rest has gone."),
        ("Maison N’Ait. Now online.", "Meh-zon Night. Now online."),
    ],
    "ar": [
        ("آيت. بالأمازيغية: أهلُ الأرض الواحدة.", "آيْتْ. بالأمازيغية: أهلُ الأرضِ الواحدة."),
        ("أرضٌ يُعرَف فيها الأهلُ بعطرهم.", "أرضٌ يُعرَفُ فيها الأهلُ بعطرهم."),
        ("ورد دادس، زهر البرتقال، أرز الأطلس.", "وردُ دادس، زهرُ البرتقال، أرزُ الأطلس."),
        ("عنبرٌ ومسكٌ وعود: ما يبقى حين يزول كلّ شيء.", "عنبرٌ ومسكٌ وعود: ما يبقى حين يزول كلّ شيء."),
        ("دار نايت. الآن على الإنترنت.", "دار نايت. الآن على الإِنْتَرْنِتْ."),
    ],
}
# what a transcription of the voice should read like (brand and place names as a listener would write them)
EXPECT = {
    "fr": ["Aït. En tamazirt, ceux d'une même terre.", None, None,
           "L'ambre, le musc et l'oud, ce qui reste quand tout s'efface.", "Maison Naït. Désormais en ligne."],
    "en": ["Ite. In Tamazite, the people of one land.", None, "Dades rose, orange blossom, Atlas cedar.",
           "Amber, musk and oud, what stays when the rest has gone.", "Maison Night. Now online."],
    "ar": ["آيت. بالأمازيغية أهل الأرض الواحدة", None, None, None, "دار نايت. الآن على الإنترنت"],
}
