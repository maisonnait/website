(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let id; return () => { clearTimeout(id); id = setTimeout(fn, ms); }; };
const root = document.documentElement;
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasIO = 'IntersectionObserver' in window;

/* ============ language ============ */
const LANGS = {
  fr: { dir: 'ltr', hash: 'fr', name: 'Français' },
  en: { dir: 'ltr', hash: 'en', name: 'English' },
  ar: { dir: 'rtl', hash: 'ar', name: 'العربية' },
  ary: { dir: 'rtl', hash: 'darija', name: 'الدارجة' },
  zgh: { dir: 'ltr', hash: 'tamazight', name: 'ⵜⴰⵎⴰⵣⵉⵖⵜ' }
};
const byHash = h => Object.keys(LANGS).find(k => LANGS[k].hash === h);
let lang = 'fr';
/* the light theme is the default; the dark one is a choice the visitor makes */
let mode = root.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';

function t(key, n) {
  const d = I18N[lang] || I18N.fr;
  let s = d[key];
  if (s === undefined) s = I18N.fr[key] !== undefined ? I18N.fr[key] : key;
  return n === undefined ? s : s.replace('{n}', n);
}

function initialLang() {
  const h = byHash(location.hash.replace('#', ''));
  if (h) return h;
  try { const s = localStorage.getItem('nait-lang'); if (LANGS[s]) return s; } catch (e) { /* storage may be unavailable */ }
  const n = (navigator.language || 'fr').toLowerCase();
  if (n.indexOf('ar') === 0) return 'ar';
  if (n.indexOf('zgh') === 0 || n.indexOf('tzm') === 0 || n.indexOf('ber') === 0) return 'zgh';
  if (n.indexOf('en') === 0) return 'en';
  return 'fr';
}

const langbox = $('#langbox'), langBtn = $('#langBtn'), langCur = $('#langCur');

function paintLang() {
  root.lang = lang;
  root.dir = LANGS[lang].dir;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  langCur.textContent = LANGS[lang].name;
  langCur.lang = lang;
  catalog.render();
  sheet.refresh();
  film.setVoice();
  layout();
}

/* the page dips out behind a veil while words or colours are swapped */
function swap(apply) {
  if (RM) { apply(); return; }
  root.classList.add('is-swapping');
  setTimeout(() => { apply(); setTimeout(() => root.classList.remove('is-swapping'), 140); }, 260);
}

function setLang(next) {
  if (!LANGS[next] || next === lang) return;
  lang = next;
  try { localStorage.setItem('nait-lang', lang); } catch (e) { /* ignore */ }
  try { location.hash = LANGS[lang].hash; } catch (e) { /* the address may be read-only */ }
  swap(paintLang);
}

function openLang(open) {
  langbox.classList.toggle('is-open', open);
  langBtn.setAttribute('aria-expanded', String(open));
}
langBtn.addEventListener('click', () => openLang(!langbox.classList.contains('is-open')));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (b) { openLang(false); setLang(b.dataset.lang); return; }
  if (!e.target.closest('#langbox')) openLang(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && langbox.classList.contains('is-open')) { openLang(false); langBtn.focus(); }
});
window.addEventListener('hashchange', () => {
  const h = byHash(location.hash.replace('#', ''));
  if (h) setLang(h);
});

/* in-page links scroll without touching the address, which carries the language */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.getElementById(a.getAttribute('href').slice(1));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
});

/* ============ mist: the spray particles ============ */
function Mist(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, raf = 0, light = true;
  const parts = [];
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sg = sprite.getContext('2d');

  /* gold dust on white paper, warm light on the night */
  function paintSprite() {
    sg.clearRect(0, 0, 64, 64);
    const g = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (light) {
      g.addColorStop(0, 'rgba(168,128,24,.95)');
      g.addColorStop(0.35, 'rgba(201,162,39,.42)');
      g.addColorStop(1, 'rgba(201,162,39,0)');
    } else {
      g.addColorStop(0, 'rgba(255,244,214,.95)');
      g.addColorStop(0.3, 'rgba(241,220,155,.45)');
      g.addColorStop(1, 'rgba(212,175,55,0)');
    }
    sg.fillStyle = g;
    sg.fillRect(0, 0, 64, 64);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  function tick() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.wait > 0) { p.wait--; continue; }
      p.life++;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      p.vx *= 0.955; p.vy = p.vy * 0.955 - 0.014;
      p.x += p.vx; p.y += p.vy; p.s *= p.g;
      const k = p.life / p.max;
      ctx.globalAlpha = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * p.a;
      ctx.drawImage(sprite, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (parts.length) raf = requestAnimationFrame(tick);
  }
  function burst(x, y, o) {
    o = o || {};
    if (!w) resize();
    const n = o.n || 110, ang = o.angle === undefined ? -Math.PI / 2 : o.angle, spread = o.spread || 0.95, pw = o.power || 1;
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 2 * spread * (0.25 + Math.random() * 0.75);
      const v = (1.2 + Math.random() * 9) * pw;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 4 + Math.random() * 11, g: 1.012 + Math.random() * 0.02,
        a: 0.1 + Math.random() * 0.16, life: 0, max: 60 + Math.random() * 100, wait: Math.floor(Math.random() * 8) });
    }
    if (parts.length > 720) parts.splice(0, parts.length - 720);
    if (!raf) raf = requestAnimationFrame(tick);
  }
  paintSprite();
  return { resize, burst, setLight(v) { light = !!v; paintSprite(); } };
}

const hero = $('#top');
const heroVideo = $('#heroVideo');
const mistHero = Mist($('#heroMist'));
const mistAtom = Mist($('#atomMist'));
const hint = $('#heroHint');

hero.addEventListener('click', e => {
  if (RM || e.target.closest('a,button')) return;
  const r = hero.getBoundingClientRect();
  mistHero.burst(e.clientX - r.left, e.clientY - r.top, { n: 130 });
  hint.classList.add('is-gone');
});
/* one spray as the wordmark finishes drawing */
if (!RM) {
  setTimeout(() => {
    const m = $('.wm__nait'), r = hero.getBoundingClientRect(), b = m.getBoundingClientRect();
    if (r.bottom < 80 || document.hidden) return;
    const rtl = root.dir === 'rtl';
    mistHero.burst((rtl ? b.left + b.width * 0.12 : b.right - b.width * 0.12) - r.left, b.top + b.height * 0.25 - r.top,
      { n: 150, angle: rtl ? -2.1 : -1.05, spread: 0.8, power: 1.15 });
  }, 2100);
}

/* ============ the five note sketches ============ */
const sketches = (() => {
  const S = window.NAIT_SKETCHES || {};
  const items = $$('canvas[data-sketch]').map(c => ({ c, ctx: c.getContext('2d'), name: c.dataset.sketch, w: 0, h: 0, on: false }));
  const t0 = performance.now();
  let raf = 0, odd = false;
  function size(it) {
    const r = it.c.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    it.w = Math.round(r.width); it.h = Math.round(r.height);
    it.c.width = Math.round(it.w * dpr); it.c.height = Math.round(it.h * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw(it, tt) {
    const f = S[it.name];
    if (!f || !it.w) return;
    try { f(it.ctx, it.w, it.h, tt); } catch (e) { /* a sketch must never break the page */ }
  }
  function loop(now) {
    raf = 0; odd = !odd;
    const tt = (now - t0) / 1000;
    let live = false;
    for (const it of items) {
      if (!it.on) continue;
      live = true;
      if (odd && it.c.dataset.off !== '1') draw(it, tt);
    }
    if (live) raf = requestAnimationFrame(loop);
  }
  function resize() {
    const tt = RM ? 4 : (performance.now() - t0) / 1000;
    items.forEach(it => { size(it); draw(it, tt); });
  }
  if (hasIO && !RM) {
    const io = new IntersectionObserver(es => {
      for (const e of es) { const it = items.find(i => i.c === e.target); if (it) it.on = e.isIntersecting; }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { rootMargin: '60px' });
    items.forEach(it => io.observe(it.c));
  }
  return { resize, light(v) { if (S.light) S.light(v); } };
})();

/* ============ theme ============ */
const modeBtn = $('#modeBtn'), themeColor = $('#themeColor');

function paintMode() {
  const dark = mode === 'dark';
  root.setAttribute('data-mode', mode);
  modeBtn.dataset.i18nAria = dark ? 'theme.toLight' : 'theme.toDark';
  modeBtn.setAttribute('aria-label', t(modeBtn.dataset.i18nAria));
  modeBtn.setAttribute('aria-pressed', String(dark));
  if (themeColor) themeColor.setAttribute('content', dark ? '#080B1F' : '#FFFFFF');
  /* each theme has its own hero film: gold smoke on white, or on the night */
  if (!RM) {
    const src = dark ? 'media/hero-dark.mp4' : 'media/hero.mp4';
    if (heroVideo.getAttribute('src') !== src) {
      heroVideo.setAttribute('src', src);
      heroVideo.load();
      if (hero.getBoundingClientRect().bottom > 0) { const p = heroVideo.play(); if (p && p.catch) p.catch(() => {}); }
    }
  }
  sketches.light(!dark);
  mistHero.setLight(!dark);
  mistAtom.setLight(!dark);
  sketches.resize();
}
modeBtn.addEventListener('click', () => {
  mode = mode === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('nait-mode', mode); } catch (e) { /* ignore */ }
  swap(paintMode);
});

/* ============ film ============ */
const film = (() => {
  const sec = $('#film'), v = $('#filmVideo'), cap = $('#filmCap'), btn = $('#filmBtn'), snd = $('#filmSound');
  const track = $('#filmTrack'), fill = $('i', track), ticks = $$('.film__tick', track);
  const CUES = [[0, 'film.c1'], [5, 'film.c2'], [10.5, 'film.c3'], [16, 'film.c4'], [21.5, 'film.c5']];
  const DUR = 26;
  /* one cut of the film per voice-over; Darija and Tamazight are read in Arabic */
  const VOICE = { fr: 'fr', en: 'en', ar: 'ar', ary: 'ar', zgh: 'ar' };
  let cue = 3, raf = 0, userPaused = false, swapId = 0, sound = false;

  function setCue(i) {
    if (i === cue) return;
    cue = i;
    ticks.forEach((tk, k) => tk.classList.toggle('is-on', k === i));
    clearTimeout(swapId);
    if (RM) { cap.dataset.i18n = CUES[i][1]; cap.textContent = t(CUES[i][1]); return; }
    cap.classList.add('is-out');
    swapId = setTimeout(() => {
      cap.dataset.i18n = CUES[cue][1];
      cap.textContent = t(CUES[cue][1]);
      cap.classList.remove('is-out');
    }, 300);
  }
  function loop() {
    raf = 0;
    const tt = v.currentTime || 0;
    fill.style.setProperty('--v', clamp(tt / DUR).toFixed(4));
    let i = 0;
    for (let k = 0; k < CUES.length; k++) if (tt >= CUES[k][0] - 0.08) i = k;
    setCue(i);
    if (!v.paused) raf = requestAnimationFrame(loop);
  }
  function paintSound() {
    v.muted = !sound;
    v.loop = !sound;                       /* with the voice on, the film plays once and rests on the name */
    snd.setAttribute('aria-pressed', String(sound));
    snd.dataset.i18nAria = sound ? 'film.soundOff' : 'film.soundOn';
    snd.setAttribute('aria-label', t(snd.dataset.i18nAria));
  }
  function play() {
    if (v.preload === 'none') v.preload = 'auto';
    const p = v.play();
    if (p && p.catch) p.catch(err => {
      /* a browser that refuses sound still gets the silent film */
      if (!sound || !err || err.name !== 'NotAllowedError') return;
      sound = false;
      paintSound();
      const q = v.play();
      if (q && q.catch) q.catch(() => {});
    });
  }
  function seek(s) {
    const go = () => { try { v.currentTime = s + 0.03; } catch (e) { /* not seekable yet */ } loop(); };
    if (v.readyState >= 1) go(); else { v.addEventListener('loadedmetadata', go, { once: true }); }
  }
  /* the cut that matches the page's language; a change of voice restarts the current shot */
  function setVoice() {
    const src = 'media/film-' + (VOICE[lang] || 'fr') + '.mp4';
    if (v.getAttribute('src') === src) return;
    const was = !v.paused, at = CUES[cue][0], started = v.currentTime > 0.1 || was;
    v.setAttribute('src', src);
    if (!started && v.preload === 'none') return;      /* nothing loaded yet: the new address is enough */
    v.load();
    if (at > 0) seek(at);
    if (was) play();
  }
  v.addEventListener('play', () => {
    sec.classList.add('is-playing');
    btn.dataset.i18nAria = 'film.pause';
    btn.setAttribute('aria-label', t('film.pause'));
    if (!raf) raf = requestAnimationFrame(loop);
  });
  v.addEventListener('pause', () => {
    sec.classList.remove('is-playing');
    btn.dataset.i18nAria = 'film.play';
    btn.setAttribute('aria-label', t('film.play'));
  });
  v.addEventListener('ended', () => { userPaused = true; });
  /* a film that cannot load takes its section with it */
  v.addEventListener('error', () => {
    sec.hidden = true;
    $$('a[href="#film"]').forEach(a => { a.hidden = true; });
  });
  btn.addEventListener('click', () => {
    if (v.paused) { userPaused = false; play(); } else { userPaused = true; v.pause(); }
  });
  snd.addEventListener('click', () => {
    sound = !sound;
    sec.classList.add('has-heard');
    paintSound();
    if (sound) { userPaused = false; seek(0); play(); }   /* the voice-over is heard from its first word */
  });
  ticks.forEach(tk => tk.addEventListener('click', () => { userPaused = false; play(); seek(parseFloat(tk.dataset.t)); }));
  ticks[cue].classList.add('is-on');
  if (hasIO) {
    new IntersectionObserver(es => {
      for (const e of es) {
        /* the silent film starts by itself; with sound on, it waits for the visitor. Off screen it always stops. */
        if (e.isIntersecting && e.intersectionRatio >= 0.55) { if (!RM && !userPaused && !sound) play(); }
        else if (!e.isIntersecting && !v.paused) { v.pause(); if (sound) userPaused = true; }
      }
    }, { threshold: [0, 0.55] }).observe($('.film__clip', sec));
  }
  return { setVoice };
})();

/* background videos only run while they are on screen */
(() => {
  const cta = $('#ctaVideo');
  if (RM) { cta.pause(); return; }
  if (!hasIO) return;
  const io = new IntersectionObserver(es => {
    for (const e of es) {
      const v = e.target.tagName === 'VIDEO' ? e.target : $('video', e.target);
      if (e.isIntersecting) {
        if (v.preload === 'none') v.preload = 'auto';
        if (v.getAttribute('src')) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      } else v.pause();
    }
  }, { rootMargin: '120px' });
  io.observe(heroVideo);
  io.observe($('#cta'));
})();

/* ============ reading a perfume: the spray timeline ============ */
(() => {
  const sec = $('#lire'), stages = $$('.stage', sec), liq = $('#atomLiq'), flac = $('.atom__flacon'), cv = $('#atomMist');
  let level = 122, timers = [];
  liq.style.transform = 'translate(0px,' + level + 'px)';
  $('#sprayBtn').addEventListener('click', () => {
    level = level > 236 ? 122 : level + 9;                 /* the flacon empties a little, then refills */
    liq.style.transform = 'translate(0px,' + level + 'px)';
    if (RM) return;
    const a = flac.getBoundingClientRect(), c = cv.getBoundingClientRect();
    const x = a.left + a.width / 2 - c.left, y = a.top + a.height * (2 / 320) - c.top;
    mistAtom.burst(x, y, { n: 150, spread: 0.75, power: 1.05 });
    setTimeout(() => mistAtom.burst(x, y, { n: 70, spread: 0.5, power: 0.8 }), 140);
    timers.forEach(clearTimeout); timers = [];
    sec.classList.add('is-playing');
    stages.forEach(s => s.classList.remove('is-on'));
    void sec.offsetWidth;
    const on = (i, dur) => { stages[i].style.setProperty('--dur', dur + 'ms'); stages[i].classList.add('is-on'); };
    const off = i => stages[i].classList.remove('is-on');
    on(0, 1500);
    timers.push(setTimeout(() => on(1, 2900), 1200));
    timers.push(setTimeout(() => off(0), 1900));
    timers.push(setTimeout(() => on(2, 3600), 3700));
    timers.push(setTimeout(() => off(1), 4600));
    timers.push(setTimeout(() => { sec.classList.remove('is-playing'); stages.forEach(s => s.classList.remove('is-on')); }, 8200));
  });
})();

/* ============ catalogue ============ */
const LIQUID = { arabisant: 'liq-amber', femmes: 'liq-rose', hommes: 'liq-indigo', unisexe: 'liq-silver' };
const WAVE = 'M-160 0q20-6 40 0' + 't40 0'.repeat(14) + 'V240H-160Z';
const MOTIFS = [
  () => '<path d="M100 140 134 190 100 240 66 190Z"/><circle cx="100" cy="190" r="8"/>',
  () => '<path d="M100 132 140 190 100 248 60 190Z"/><path d="M100 152 126 190 100 228 74 190Z"/><path d="M100 172 112 190 100 208 88 190Z"/>',
  () => [0, 1, 2, 3, 4].map(i => '<path d="M62 ' + (150 + i * 22) + ' 100 ' + (128 + i * 22) + ' 138 ' + (150 + i * 22) + '"/>').join(''),
  () => '<path d="M72 162h56v56H72z"/><path d="M100 150.4 139.6 190 100 229.6 60.4 190Z"/><circle cx="100" cy="190" r="12"/>',
  () => [-60, -40, -20, 0, 20, 40, 60].map(a => { const r = a * Math.PI / 180; return '<path d="M100 266 ' + (100 + Math.sin(r) * 150).toFixed(1) + ' ' + (266 - Math.cos(r) * 150).toFixed(1) + '"/>'; }).join('') + '<path d="M60 266h80"/>',
  () => [24, 44, 64, 84].map(r => '<path d="M' + (100 - r) + ' 258a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0"/>').join('') + '<path d="M50 258h100"/>',
  () => [150, 190, 230].map(y => '<path d="M52 ' + (y + 10) + ' 68 ' + (y - 10) + ' 84 ' + (y + 10) + ' 100 ' + (y - 10) + ' 116 ' + (y + 10) + ' 132 ' + (y - 10) + ' 148 ' + (y + 10) + '"/>').join(''),
  () => [58, 72, 86, 100, 114, 128, 142].map(x => '<path d="M' + x + ' 118V262"/>').join('') + '<path d="M100 170 114 190 100 210 86 190Z" fill="currentColor" stroke="none"/>'
];
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }

/* every scent family wears the same house flacon; the engraving and the fill level are drawn from its name.
   Lines use currentColor, so the drawing follows the theme. */
function flacon(p) {
  const r = rng(hash(p.slug));
  const motif = MOTIFS[Math.floor(r() * MOTIFS.length)]();
  const lvl = Math.round(112 + r() * 66), phase = Math.round(r() * 80);
  return '<svg viewBox="0 0 200 320" aria-hidden="true"><ellipse cx="100" cy="313" rx="72" ry="5" fill="#000" opacity=".16"/>' +
    '<g clip-path="url(#clip-body)"><g transform="translate(' + phase + ' ' + lvl + ')"><path class="flacon__wave" d="' + WAVE + '" fill="url(#' + LIQUID[p.c] + ')"/></g></g>' +
    '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="56,70 144,70 170,96 170,284 144,310 56,310 30,284 30,96" fill="currentColor" fill-opacity=".03"/>' +
    '<rect x="88" y="52" width="24" height="18"/><rect x="70" y="14" width="60" height="38" fill="currentColor" fill-opacity=".07"/><rect x="82" y="2" width="36" height="12" fill="currentColor" fill-opacity=".07"/>' +
    '<g clip-path="url(#clip-body)" stroke-opacity=".72" stroke-width="1.5">' + motif + '</g></g></svg>';
}

const catalog = (() => {
  const tabsEl = $('#tabs'), grid = $('#grid'), desc = $('#colDesc'), all = $('#colAll');
  let current = 'arabisant', io = null;
  const scentLabel = p => { const n = p.scents.length; return n === 0 ? t('card.single') : n === 1 ? t('fmt.scents1') : t('fmt.scents', n); };
  const price = () => t('fmt.price', CATALOG.price);

  function renderTabs() {
    tabsEl.innerHTML = CATALOG.collections.map(c => {
      const on = c.id === current;
      return '<button class="tab" role="tab" type="button" id="tab-' + c.id + '" data-c="' + c.id + '" aria-controls="grid" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">' +
        '<span class="tab__name">' + esc(t('tab.' + c.id)) + '</span><span class="tab__n">' + esc(c.count ? t('fmt.families', c.count) : t('card.soon')) + '</span></button>';
    }).join('');
  }
  function renderGrid(fresh) {
    const col = CATALOG.collections.find(c => c.id === current);
    const items = CATALOG.products.filter(p => p.c === current);
    desc.textContent = t('desc.' + current);
    all.href = col.url;
    grid.setAttribute('aria-labelledby', 'tab-' + current);
    if (!items.length) {
      grid.innerHTML = '<div class="soon cham ring"><svg viewBox="0 0 200 320" stroke-width="2.4" aria-hidden="true"><use href="#flacon"/></svg><p>' + esc(t('desc.unisexe')) + '</p></div>';
    } else {
      grid.innerHTML = items.map((p, i) => {
        const n = p.scents.length;
        return '<article class="card card--' + p.c + ' cham ring" style="--i:' + i + '">' +
          '<div class="card__art">' + flacon(p) +
          (p.img ? '<img class="card__photo" src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div>' +
          '<div class="card__body">' + (n ? '<p class="card__tag">Style</p>' : '') +
          '<h3 class="card__name" dir="ltr">' + esc(p.name) + '</h3>' +
          '<p class="card__meta"><span>' + esc(scentLabel(p)) + '</span>' + (p.sizes ? '<span>' + esc(t('fmt.sizes')) + '</span>' : '') + '</p>' +
          '<div class="card__row"><span class="card__price">' + esc(price()) + '</span>' +
          (n ? '<button class="tlink card__see" type="button" data-open="' + esc(p.slug) + '">' + esc(t('card.see')) + '</button>' : '') + '</div>' +
          '<a class="btn btn--sm card__order" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(t('card.order')) + '<span class="vh"> ' + esc(p.name) + '</span></a>' +
          '</div></article>';
      }).join('');
    }
    /* the shop's photo replaces the drawn flacon only once it has really loaded */
    $$('.card__photo', grid).forEach(img => {
      const done = () => {
        if (img.naturalWidth < 2) { img.remove(); return; }
        const r = img.naturalWidth / img.naturalHeight;
        if (r < .8 || r > 1.25) img.classList.add('is-fit');   /* tall or wide pictures are shown whole */
        img.parentNode.classList.add('has-photo');
      };
      if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', () => img.remove(), { once: true }); }
    });
    grid.classList.remove('is-fresh');
    if (fresh) { void grid.offsetWidth; grid.classList.add('is-fresh'); }
    if (io) io.disconnect();
    if (hasIO && !RM) {
      io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-live', e.isIntersecting)), { rootMargin: '40px' });
      $$('.card', grid).forEach(c => io.observe(c));
    }
  }
  function select(id, focus) {
    if (id === current) return;
    current = id;
    renderTabs();
    renderGrid(true);
    if (focus) { const b = $('#tab-' + id); if (b) b.focus(); }
  }
  tabsEl.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) select(b.dataset.c); });
  tabsEl.addEventListener('keydown', e => {
    const ids = CATALOG.collections.map(c => c.id), i = ids.indexOf(current);
    const fwd = root.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight', back = root.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let j = -1;
    if (e.key === fwd) j = (i + 1) % ids.length;
    else if (e.key === back) j = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = ids.length - 1;
    if (j < 0) return;
    e.preventDefault();
    select(ids[j], true);
  });
  grid.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) sheet.open(b.dataset.open, b); });
  return { render() { renderTabs(); renderGrid(false); }, scentLabel, price };
})();

/* ============ the scent sheet ============ */
const sheet = (() => {
  const el = $('#sheet'), panel = $('.sheet__panel', el), title = $('#sheetTitle'), meta = $('#sheetMeta'), list = $('#sheetList'), cta = $('#sheetCta'), closeBtn = $('#sheetClose');
  let slug = null, opener = null;
  function fill() {
    const p = CATALOG.products.find(x => x.slug === slug);
    if (!p) return;
    const rtl = root.dir === 'rtl';
    title.textContent = p.name;
    meta.textContent = catalog.scentLabel(p) + (p.sizes ? ' — ' + t('fmt.sizes') : '');
    cta.href = p.url;
    list.innerHTML = p.scents.map((s, i) =>
      '<li class="scent" style="--i:' + i + '"><span dir="ltr">' + esc(s[0]) + '</span>' +
      (s[2] ? '<span class="scent__tag">' + esc(t('tag.' + s[2])) + '</span>' : '') +
      (rtl && s[1] ? '<span class="scent__ar">' + esc(s[1]) + '</span>' : '') + '</li>').join('');
    $('.sheet__body', el).scrollTop = 0;
  }
  function open(s, from) {
    slug = s; opener = from || null;
    fill();
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeBtn.focus(), 80);
  }
  function close() {
    if (!slug) return;
    slug = null;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (opener && document.contains(opener)) opener.focus();
  }
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => {
    if (!slug) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([tabindex="-1"])', panel);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  return { open, close, refresh() { if (slug) fill(); } };
})();

/* ============ scroll: progress, chapters, stacked notes ============ */
const bar = $('#bar'), rail = $('#rail');
const scenes = $$('[data-scene]');
const notes = $$('.note');
const noteArt = notes.map(n => $('canvas', n));
const navLinks = $$('.bar__nav a'), railLinks = $$('[data-rail]');
const chapters = ['nom', 'notes', 'film', 'lire', 'collections', 'en-ligne'].map(id => document.getElementById(id));
let vh = window.innerHeight, ticking = false;

function frame() {
  ticking = false;
  const y = window.scrollY || root.scrollTop || 0;
  const max = Math.max(1, root.scrollHeight - vh);
  bar.classList.toggle('is-solid', y > 24);
  bar.style.setProperty('--sp', clamp(y / max).toFixed(4));
  for (const s of scenes) {
    if (!s._live) continue;
    const r = s.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) continue;
    s.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
    s.style.setProperty('--e', clamp((vh - r.top) / (vh * 0.75)).toFixed(4));
  }
  for (let i = 0; i < notes.length; i++) {
    const next = notes[i + 1];
    if (!next) { noteArt[i].dataset.off = ''; break; }
    const a = notes[i].getBoundingClientRect(), b = next.getBoundingClientRect();
    notes[i].style.setProperty('--cover', clamp((vh - b.top) / (vh * 0.85)).toFixed(3));
    noteArt[i].dataset.off = b.top <= a.top + 16 ? '1' : '';
  }
  let cur = '';
  for (const c of chapters) if (!c.hidden && c.getBoundingClientRect().top < vh * 0.45) cur = c.id;
  navLinks.forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + cur));
  const key = cur === 'film' ? 'notes' : cur === 'en-ligne' ? 'collections' : cur;
  railLinks.forEach(a => a.classList.toggle('is-on', a.dataset.rail === key));
  rail.classList.toggle('is-on', y > vh * 0.7);
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
window.addEventListener('scroll', onScroll, { passive: true });
/* scroll-driven scenes switch on at the first scroll, and only for scenes still below the fold: nothing jumps, and the page is complete at rest */
window.addEventListener('scroll', () => { if (!RM) scenes.forEach(s => { s._live = s.getBoundingClientRect().top > vh * 0.9; }); }, { passive: true, once: true });

function layout() {
  vh = window.innerHeight;
  const bh = bar.offsetHeight;
  /* a note taller than the screen sticks by its bottom edge, so all of it can be read */
  notes.forEach((n, i) => { n.style.top = Math.min(bh + i * 12, vh - n.offsetHeight) + 'px'; });
  sketches.resize();
  mistHero.resize();
  mistAtom.resize();
  frame();
}
window.addEventListener('resize', debounce(layout, 160));
window.addEventListener('load', layout);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

/* ============ reveals: armed by the first scroll, so the page is complete at rest ============ */
(() => {
  if (!hasIO || RM) return;
  const els = $$('.rv');
  let armed = false;
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.remove('is-pending'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  function arm() {
    if (armed) return;
    armed = true;
    const lim = window.innerHeight * 1.05;
    for (const el of els) if (el.getBoundingClientRect().top > lim) { el.classList.add('is-pending'); io.observe(el); }
  }
  ['scroll', 'wheel', 'touchmove', 'keydown'].forEach(ev => window.addEventListener(ev, arm, { passive: true, once: true }));
})();

/* ============ start ============ */
lang = initialLang();
paintMode();
paintLang();
})();
