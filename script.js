(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- настройки ---------- */
  const AUTOPLAY_MS = 6000;   // автопрокрутка слайдов, 0 — выключить
  const ANIM_MS = 1000;       // длительность смены слайда (как в CSS)

  $('#year').textContent = new Date().getFullYear();
  document.body.classList.add('is-loading');

  /* ---------- разбивка имени на буквы ---------- */
  function splitText(el, text) {
    el.setAttribute('aria-label', text);
    el.textContent = '';
    let i = 0;
    text.split(' ').forEach((word, wi, arr) => {
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      [...word].forEach(c => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i++);
        s.textContent = c;
        w.appendChild(s);
      });
      el.appendChild(w);
      if (wi < arr.length - 1) { el.appendChild(document.createTextNode(' ')); i++; }
    });
  }
  $$('[data-split]').forEach(el => splitText(el, el.textContent.trim()));
  $$('.chips li').forEach((li, i) => li.style.setProperty('--n', i));

  /* ---------- прелоадер ---------- */
  // прелоадер ждёт только то, что видно сразу; остальные слайды догружаются фоном
  const imgs = $$('img').filter(i => !i.matches('.slide:not(.is-active)'));
  let loaded = 0;
  const pctEl = $('#loaderPct'), bar = $('.loader__bar span');
  const tick = () => {
    loaded++;
    const p = Math.round((loaded / imgs.length) * 100);
    pctEl.textContent = p;
    bar.style.width = p + '%';
    if (loaded >= imgs.length) done();
  };
  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    pctEl.textContent = 100; bar.style.width = '100%';
    setTimeout(() => {
      $('#loader').classList.add('is-done');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      startAutoplay();
    }, 350);
  }
  imgs.forEach(img => (img.complete ? tick() : (img.addEventListener('load', tick, { once: true }), img.addEventListener('error', tick, { once: true }))));
  setTimeout(done, 6000); // страховка

  /* ---------- слайдер в ноутбуке ---------- */
  const showcase = $('.showcase');
  const slides = $$('.slide');
  const dotsWrap = $('#dots');
  const glare = $('.screen__glare'), scan = $('.screen__scan');
  let current = 0, timer = null;
  const screenEl = $('#screen');
  const screenHit = $('#screenHit');

  /* плашка с названием и описанием экрана */
  const caption = $('#caption'), capTitle = $('#capTitle'), capDesc = $('#capDesc');
  let capSwapT = 0;
  function updateCaption(animated) {
    const s = slides[current];
    const en = document.documentElement.lang === 'en';
    const apply = () => {
      capTitle.textContent = (en && s.dataset.titleEn) || s.dataset.title || '';
      capDesc.textContent = (en && s.dataset.descEn) || s.dataset.desc || '';
    };
    if (!animated || !caption.classList.contains('is-open')) return apply();
    caption.classList.add('is-swap');
    clearTimeout(capSwapT);
    capSwapT = setTimeout(() => { apply(); caption.classList.remove('is-swap'); }, 220);
  }
  let capHideT = 0;
  function showCaption(autoHideMs) {
    caption.classList.add('is-open');
    showcase.classList.add('is-paused');
    clearTimeout(capHideT);
    if (autoHideMs) capHideT = setTimeout(hideCaption, autoHideMs);
  }
  function hideCaption() {
    clearTimeout(capHideT);
    caption.classList.remove('is-open');
  }
  document.documentElement.style.setProperty('--autoplay', AUTOPLAY_MS + 'ms');

  updateCaption(false);

  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'dot' + (i === 0 ? ' is-active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Слайд ${i + 1}`);
    b.innerHTML = '<span></span>';
    b.addEventListener('click', () => go(i, i > current ? 1 : -1));
    dotsWrap.appendChild(b);
    return b;
  });

  const restart = el => { el.classList.remove('run'); void el.offsetWidth; el.classList.add('run'); };

  let finishT = 0;
  function go(index, dir) {
    index = (index + slides.length) % slides.length;
    if (index === current) return;
    // можно листать, не дожидаясь конца прошлой анимации: сбрасываем её и начинаем новую
    clearTimeout(finishT);
    const prev = slides[current], next = slides[index];
    const d = dir > 0 ? 'next' : 'prev';

    slides.forEach(s => s.className = 'slide');
    void screenEl.offsetWidth; // перезапуск CSS-анимаций
    prev.classList.add('is-leaving', 'leave-' + d);
    next.classList.add('is-active', 'enter-' + d);
    restart(glare); restart(scan);

    dots[current].classList.remove('is-active');
    dots[index].classList.add('is-active');
    current = index;
    updateCaption(true);

    finishT = setTimeout(() => {
      prev.className = 'slide';
      next.className = 'slide is-active';
    }, reduced ? 0 : ANIM_MS);
    startAutoplay();
  }

  function startAutoplay() {
    clearTimeout(timer);
    if (!AUTOPLAY_MS || reduced) return;
    // перезапуск анимации заполнения точки
    const s = dots[current].querySelector('span');
    s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    timer = setTimeout(() => { if (!showcase.classList.contains('is-paused')) go(current + 1, 1); else startAutoplay(); }, AUTOPLAY_MS);
  }

  const pulse = btn => { btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse'); };
  $('#prevBtn').addEventListener('click', e => { pulse(e.currentTarget); go(current - 1, -1); });
  $('#nextBtn').addEventListener('click', e => { pulse(e.currentTarget); go(current + 1, 1); });

  // пауза при наведении на ноутбук
  const laptopWrap = $('#laptopWrap');
  laptopWrap.addEventListener('mouseenter', () => showcase.classList.add('is-paused'));
  laptopWrap.addEventListener('mouseleave', () => { showcase.classList.remove('is-paused'); startAutoplay(); });
  // плашка: на компьютере — при наведении на экран ноутбука
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // зона наведения — неподвижный слой поверх экрана (не зависит от наклона ноутбука)
    screenHit.addEventListener('mouseenter', () => showCaption());
    screenHit.addEventListener('mouseleave', hideCaption);
  }

  // клавиатура
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return;
    const r = showcase.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (e.key === 'ArrowRight') go(current + 1, 1);
    if (e.key === 'ArrowLeft') go(current - 1, -1);
  });

  // мобильные: свайп влево/вправо и тап для плашки
  // Свайп срабатывает сразу по ходу движения пальца (не дожидаясь отпускания),
  // а короткий резкий «флик» засчитывается даже на небольшом расстоянии. Картинка за пальцем не тянется.
  let sx = null, sy = null, st = 0, axis = null, swiped = false;
  laptopWrap.addEventListener('touchstart', e => {
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = performance.now(); axis = null; swiped = false;
  }, { passive: true });
  laptopWrap.addEventListener('touchmove', e => {
    if (sx === null || swiped) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (axis !== 'x') return;
    if (Math.abs(dx) > Math.min(70, laptopWrap.offsetWidth * .18)) {
      swiped = true;
      go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  laptopWrap.addEventListener('touchend', e => {
    if (sx === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = performance.now() - st;
    sx = null;
    if (swiped) return;
    // быстрый флик
    if (axis === 'x' && Math.abs(dx) > 24 && Math.abs(dx) / dt > .35) {
      go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); return;
    }
    // тап по экрану: показать плашку (сама спрячется через 10 с) / спрятать
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || dt > 500 || !(screenHit.contains(e.target) || screenEl.contains(e.target))) return;
    if (caption.classList.contains('is-open')) { hideCaption(); showcase.classList.remove('is-paused'); startAutoplay(); }
    else {
      showCaption(10000);
      setTimeout(() => { if (!caption.classList.contains('is-open')) { showcase.classList.remove('is-paused'); startAutoplay(); } }, 10050);
    }
  });
  laptopWrap.addEventListener('touchcancel', () => { sx = null; });


  /* ---------- языки: RU / EN ----------
     Русский текст живёт в разметке. Английский — в словаре EN ниже:
     элементы помечены data-i18n="ключ" (текст) и data-i18n-attr="атрибут:ключ" (alt, aria-label, title).
     Тексты слайдов на английском — в атрибутах data-title-en / data-desc-en у картинок.
     Язык выбирается так: ?lang=en / ?lang=ru в адресе → сохранённый выбор → язык браузера
     (русский для ru/uk/be/kk, для остальных — английский). */
  const EN = {
    'meta.title': 'Alexey Krivoschekov — GameDev UI Designer',
    'meta.desc': 'Portfolio of Alexey Krivoschekov, a game UI/UX designer.',
    'name': 'Alexey Krivoschekov',
    'up': 'Back to top',
    'contacts': 'Contacts',
    'cases': 'Case studies',
    'prev': 'Previous slide',
    'next': 'Next slide',
    'skills.h': 'Skills',
    'skills.p': 'Expert command of Adobe Photoshop (vector and raster tools), proficiency in Figma, asset slicing and graphics preparation. Experienced in team development with Git, task tracking and project documentation.',
    'chip.uiart': 'UI art',
    'chip.icons': 'Icons',
    'chip.slicing': 'Asset slicing',
    'chip.docs': 'Documentation',
    'projects.h': 'Projects',
    'projects.p1': 'Visual style and UI concept art development, UI art, game icons and HUD elements.',
    'projects.h2': 'Sunshine Bay, Airport City, Mystery Manor and more',
    'projects.p2': 'Contributed to development: UI elements, windows and icons.',
    'tank': 'Click me!',
    'tankAlt': 'Game art — tank',
    'exp.h': 'Experience',
    'exp.p1': 'UI/UX design, vector and raster assets, icons, final rendering of game screens, windows and menus, UI layout.',
    'exp.h2': 'Private game project — Lead UI/UX Game Designer / UI Artist',
    'exp.p2': 'Full ownership of the visual side: game assets, icons and items.',
    'exp.p3': 'Visual style, design concepts and final UI art for the company’s key titles.',
    'art': 'Art',
    'logo1': 'Art department logo, version 1',
    'logo2': 'Art department logo, version 2',
    'logo3': 'Art department logo, version 3',
    'portfolio.h': 'Portfolio',
    'portfolio.p': 'Here you’ll find the latest design projects I’ve been working on. To see the real quality of the interfaces, their pixel precision and how they adapt to mobile devices, view the original mockups directly in Figma.',
    'up.link': 'Back to top ↑'
  };
  const RU = {
    'meta.title': document.title,
    'meta.desc': ($('meta[name="description"]') || {}).content || ''
  };
  // запоминаем русские оригиналы из разметки
  $$('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (!(k in RU)) RU[k] = el.hasAttribute('data-split') ? el.getAttribute('aria-label') : el.textContent;
  });
  $$('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
    const [attr, k] = pair.split(':');
    if (!(k in RU)) RU[k] = el.getAttribute(attr) || '';
  }));

  const langToggle = $('#langToggle'), langLabel = $('#langLabel'), langBox = $('#lang');
  const langOpts = $$('.lang__opt');

  function setLang(lang, animate) {
    const dict = lang === 'en' ? EN : RU;
    const t = k => (k in dict ? dict[k] : RU[k]);
    const swap = () => {
      document.documentElement.lang = lang;
      document.title = t('meta.title');
      const md = $('meta[name="description"]'); if (md) md.content = t('meta.desc');
      $$('[data-i18n]').forEach(el => {
        const v = t(el.dataset.i18n);
        if (el.hasAttribute('data-split')) { if (el.getAttribute('aria-label') !== v) splitText(el, v); }
        else if (el.textContent !== v) el.textContent = v;
      });
      $$('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, k] = pair.split(':'); el.setAttribute(attr, t(k));
      }));
      slides.forEach((s, i) => s.alt = (lang === 'en' ? 'Case ' : 'Кейс ') + (i + 1));
      dots.forEach((d, i) => d.setAttribute('aria-label', (lang === 'en' ? 'Slide ' : 'Слайд ') + (i + 1)));
      updateCaption(false);
      langLabel.textContent = lang.toUpperCase();
      langOpts.forEach(o => o.setAttribute('aria-checked', String(o.dataset.lang === lang)));
      langOpts.forEach(o => o.classList.toggle('is-current', o.dataset.lang === lang));
    };
    if (animate && !reduced) {
      document.body.classList.add('lang-fade');
      setTimeout(() => { swap(); requestAnimationFrame(() => document.body.classList.remove('lang-fade')); }, 180);
    } else swap();
    try { localStorage.setItem('lang', lang); } catch (e) {}
  }

  function openLang(open) {
    langBox.classList.toggle('is-open', open);
    langToggle.setAttribute('aria-expanded', String(open));
  }
  langToggle.addEventListener('click', e => { e.stopPropagation(); openLang(!langBox.classList.contains('is-open')); });
  langOpts.forEach(o => o.addEventListener('click', e => {
    e.stopPropagation();
    const lang = o.dataset.lang;
    openLang(false);
    if (lang !== document.documentElement.lang) setLang(lang, true);
  }));
  document.addEventListener('click', e => { if (!langBox.contains(e.target)) openLang(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openLang(false); });

  // стартовый язык
  (function initLang() {
    let saved = null;
    try { saved = localStorage.getItem('lang'); } catch (e) {}
    const param = new URLSearchParams(location.search).get('lang');
    const nav = (navigator.language || 'ru').toLowerCase();
    const browser = /^(ru|uk|be|kk)/.test(nav) ? 'ru' : 'en';
    const lang = (param === 'en' || param === 'ru') ? param : (saved === 'en' || saved === 'ru') ? saved : browser;
    if (lang === 'en') setLang('en', false);
    else { langOpts.forEach(o => o.classList.toggle('is-current', o.dataset.lang === 'ru')); langOpts.forEach(o => o.setAttribute('aria-checked', String(o.dataset.lang === 'ru'))); }
  })();

  /* ---------- наклон ноутбука за курсором ---------- */
  const laptop = $('#laptop');
  if (finePointer && !reduced) {
    laptopWrap.addEventListener('mousemove', e => {
      const r = laptopWrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      laptop.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
      laptop.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
    });
    laptopWrap.addEventListener('mouseleave', () => { laptop.style.setProperty('--ry', '0deg'); laptop.style.setProperty('--rx', '0deg'); });
  }

  /* ---------- параллакс фона, прогресс скролла, таймлайн ----------
     Никаких замеров вёрстки на каждом кадре: размеры кэшируются при ресайзе,
     обновление идёт только когда реально двигается мышь или страница. */
  const blobs = $('#blobs');
  const progress = $('#scrollProgress');
  const tlFill = $('#timelineFill');
  const timeline = $('#timeline');
  const tlItems = $$('.tl');
  const tankEl = $('#tank');

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let docMax = 1, tlTop = 0, tlH = 1, tlMarks = [];
  let raf = 0;

  function measure() {
    docMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const tr = timeline.getBoundingClientRect();
    tlTop = tr.top + scrollY; tlH = Math.max(1, tr.height);
    tlMarks = tlItems.map(li => (li.getBoundingClientRect().top + scrollY + 8 - tlTop) / tlH);
  }

  function update() {
    raf = 0;
    const sc = scrollY;
    mx += (tmx - mx) * .08; my += (tmy - my) * .08;
    if (!reduced) blobs.style.transform = `translate3d(${(-mx * 50).toFixed(1)}px, ${(-my * 40).toFixed(1)}px, 0)`;
    progress.style.transform = `scaleX(${(sc / docMax).toFixed(4)})`;

    const p = clamp((sc + innerHeight * .7 - tlTop) / tlH, 0, 1);
    tlFill.style.transform = `scaleY(${p.toFixed(4)})`;
    tlItems.forEach((li, i) => li.classList.toggle('lit', p >= tlMarks[i]));

    // продолжаем только пока параллакс «доезжает» за мышью
    if (Math.abs(tmx - mx) > .001 || Math.abs(tmy - my) > .001) schedule();
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

  if (finePointer && !reduced) addEventListener('mousemove', e => {
    tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; schedule();
  }, { passive: true });
  addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(() => { measure(); schedule(); }).observe(document.body);
  measure(); schedule();

  /* ---------- появление при скролле ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      io.unobserve(el);
      // убираем задержку, чтобы ховеры реагировали мгновенно
      setTimeout(() => el.style.setProperty('--d', '0s'), 1600);
    });
  }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .reveal-logo, .reveal-tank').forEach(el => io.observe(el));

  /* ---------- пауза бесконечных анимаций вне экрана ---------- */
  const offIO = new IntersectionObserver(entries => {
    entries.forEach(en => en.target.classList.toggle('is-offscreen', !en.isIntersecting));
  }, { rootMargin: '100px 0px' });
  $$('.hero, main > section').forEach(el => offIO.observe(el));

  /* ---------- частицы на всю страницу ----------
     Один фиксированный холст на весь экран. Три вида: искры, «пиксели» и мягкие
     плавающие пятна (боке). В шапке искр больше, ниже — спокойнее.
     У каждой частицы своя глубина: при скролле ближние смещаются сильнее.
     Всё рисуется заранее подготовленными спрайтами — без shadowBlur. */
  const cv = $('#fx');
  const ctx = cv.getContext('2d');
  let W, H, parts = [];

  function makeSprite(hue, sat, light, core) {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.min(95, light + 25)}%, 1)`);
    grd.addColorStop(core, `hsla(${hue}, ${sat}%, ${light}%, .85)`);
    grd.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return s;
  }
  const PIXEL = ['hsl(205, 80%, 62%)', 'hsl(25, 85%, 60%)', 'hsl(255, 70%, 70%)'];
  const heroEl = $('.hero');
  let heroH = innerHeight;

  function resize() {
    W = innerWidth; H = innerHeight;
    cv.width = W; cv.height = H;
    heroH = heroEl.offsetHeight;
  }
  function spawn(init, kind) {
    const r = Math.random();
    kind = kind || (r < .72 ? 'pixel' : 'block');
    const z = .25 + Math.random() * .75; // глубина
    const base = {
      kind, z,
      x: Math.random() * W,
      y: init ? Math.random() * H : H + 40,
      w: Math.random() * Math.PI * 2,
      life: init ? Math.random() * 400 : 0,
      type: kind
    };
    if (kind === 'giant') return Object.assign(base, { // огромные, еле заметные, медленные
      kind: 'pixel', z: .12 + Math.random() * .2,
      y: init ? Math.random() * H : H + 260,
      vx: (Math.random() - .5) * .12, vy: -(.03 + Math.random() * .07),
      s: 90 + Math.random() * 170, max: 2200 + Math.random() * 2000,
      life: init ? Math.random() * 1500 : 0,
      col: PIXEL[(Math.random() * PIXEL.length) | 0], a: .03 + Math.random() * .03
    });
    if (kind === 'pixel') return Object.assign(base, {
      vx: (Math.random() - .5) * .2, vy: -(.12 + Math.random() * .35) * z,
      s: (4 + Math.random() * 10) * z + 2, max: 400 + Math.random() * 600,
      col: PIXEL[(Math.random() * PIXEL.length) | 0], a: .22
    });
    return Object.assign(base, { // block — крупные чёткие квадраты
      kind: 'pixel', block: true,
      vx: (Math.random() - .5) * .2, vy: -(.06 + Math.random() * .2),
      s: 16 + Math.random() * 22, max: 900 + Math.random() * 900,
      col: PIXEL[(Math.random() * PIXEL.length) | 0], a: .08 + Math.random() * .1
    });
  }
  function initParts() {
    const n = Math.round(clamp(W * H / 16000, 50, 170));
    const giants = Math.round(clamp(W * H / 300000, 6, 14));
    parts = Array.from({ length: n }, () => spawn(true))
      .concat(Array.from({ length: giants }, () => spawn(true, 'giant')));
  }

  let last = 0, lastScroll = scrollY;
  function draw(now) {
    const dt = Math.min(3, last ? (now - last) / 16.67 : 1);
    last = now;
    const sc = scrollY, dScroll = sc - lastScroll; lastScroll = sc;
    // 1 — в шапке, ~0.35 — ниже по странице
    const heroK = clamp(1 - sc / Math.max(1, heroH), 0, 1);
    const sparkK = .35 + .65 * heroK;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life += dt; p.w += .02 * dt;
      p.x += (p.vx + Math.sin(p.w) * .3 * p.z) * dt;
      p.y += p.vy * dt - dScroll * p.z * .35;
      // заворачиваем по вертикали, чтобы при скролле частицы не кончались
      if (p.y < -300) p.y += H + 560;
      else if (p.y > H + 260) p.y -= H + 560;
      if (p.x < -280) p.x += W + 560; else if (p.x > W + 280) p.x -= W + 560;

      const t = p.life / p.max;
      if (t >= 1) { parts[i] = spawn(false, p.type); parts[i].y = Math.random() * H; continue; }
      let a = Math.sin(t * Math.PI) * p.a;
      const ox = -mx * 40 * p.z, oy = -my * 30 * p.z; // параллакс за мышью

      if (p.kind === 'pixel') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), Math.round(p.s), Math.round(p.s));
      } else {
        if (p.kind === 'spark') a *= sparkK * (.75 + .25 * Math.sin(p.w * 7)); // мерцание
        if (a < .01) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(p.img, p.x + ox - p.s, p.y + oy - p.s, p.s * 2, p.s * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (!document.hidden && !reduced) requestAnimationFrame(draw); else { drawing = false; last = 0; }
  }
  let drawing = false;
  const startDraw = () => { if (!drawing) { drawing = true; requestAnimationFrame(draw); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startDraw(); });
  resize(); initParts();
  if (reduced) { requestAnimationFrame(t => { draw(t); drawing = false; }); } else startDraw();
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { resize(); initParts(); }, 150); });

  /* ---------- танк: выстрел по клику ----------
     Пиксельный выстрел из обоих стволов: вспышка из квадратов у дула,
     снаряд с пиксельным шлейфом летит строго по оси ствола, следом — дымок. */
  const tankImg = $('.tank__body img');
  // координаты дул в долях картинки art_tank.png (666×498) и направление ствола
  const MUZZLES = [[.237, .293], [.291, .378]];
  const DIR = (() => { const x = -120, y = -20, l = Math.hypot(x, y); return [x / l, y / l]; })();
  const FIRE = ['#ffffff', '#fff3b0', '#ffd23f', '#ffa22b', '#ff6a1a'];
  const SMOKE = ['#8fa3c7', '#6f84ad', '#b8c6e0'];
  const pick = a => a[(Math.random() * a.length) | 0];

  function pixel(x, y, size, color, frames, opts) {
    const el = document.createElement('span');
    el.className = 'px';
    el.style.cssText = `width:${size}px;height:${size}px;background:${color};margin:${-size / 2}px 0 0 ${-size / 2}px`;
    document.body.appendChild(el);
    el.animate(frames.map(f => ({
      transform: `translate(${Math.round(x + f[0])}px, ${Math.round(y + f[1])}px) scale(${f[2] ?? 1})`,
      opacity: f[3] ?? 1
    })), opts).onfinish = () => el.remove();
  }

  function shot(mx0, my0, scale) {
    const [dx, dy] = DIR, nx = -dy, ny = dx; // ось ствола и перпендикуляр
    const u = Math.max(.6, scale);
    // 1) вспышка: квадраты конусом вдоль ствола
    for (let i = 0; i < 16; i++) {
      const along = (10 + Math.random() * 60) * u;
      const side = (Math.random() - .5) * along * .7;
      const sz = Math.round((4 + Math.random() * 9) * u);
      pixel(mx0, my0, sz, pick(FIRE), [
        [0, 0, 1, 1],
        [dx * along * .7 + nx * side * .7, dy * along * .7 + ny * side * .7, .8, 1],
        [dx * along + nx * side, dy * along + ny * side, .3, 0]
      ], { duration: 220 + Math.random() * 200, easing: 'cubic-bezier(.1,.8,.3,1)' });
    }
    // ядро вспышки: крупные яркие квадраты прямо у дула
    for (let i = 0; i < 6; i++) {
      const along = (4 + Math.random() * 22) * u;
      const side = (Math.random() - .5) * 16 * u;
      const sz = Math.round((10 + Math.random() * 8) * u);
      pixel(mx0 + dx * along + nx * side, my0 + dy * along + ny * side, sz, i < 3 ? '#ffffff' : '#ffe27a',
        [[0, 0, .6, 1], [dx * 6, dy * 6, 1.1, 1], [dx * 10, dy * 10, .4, 0]],
        { duration: 140 + Math.random() * 80, easing: 'ease-out' });
    }
    // 2) снаряд + пиксельный шлейф — строго по линии дула
    const dist = Math.max(mx0 + 80, 400);
    const tx = dx * dist, ty = dy * dist;
    const head = Math.round(14 * u);
    pixel(mx0, my0, head, '#fff7d6', [[0, 0], [tx, ty]], { duration: 520, easing: 'linear' });
    for (let k = 1; k <= 9; k++) {
      pixel(mx0, my0, Math.max(3, Math.round(head * (1 - k * .09))), FIRE[Math.min(k >> 1, FIRE.length - 1)],
        [[0, 0, 1, 1], [tx, ty, 1, .2]],
        { duration: 520, delay: k * 9, easing: 'linear', fill: 'backwards' });
    }
    // 3) дымок: серо-голубые квадраты, медленно расплываются
    for (let i = 0; i < 7; i++) {
      const along = (6 + Math.random() * 30) * u;
      const sz = Math.round((6 + Math.random() * 8) * u);
      pixel(mx0, my0, sz, pick(SMOKE), [
        [dx * along * .3, dy * along * .3, .6, .55],
        [dx * along + (Math.random() - .5) * 20, dy * along - 18 - Math.random() * 20, 1.1, 0]
      ], { duration: 600 + Math.random() * 400, delay: 60, easing: 'ease-out', fill: 'backwards' });
    }
  }

  let cooldown = false;
  tankEl.addEventListener('click', () => {
    if (cooldown) return;
    cooldown = true; setTimeout(() => cooldown = false, 550);
    const r = tankImg.getBoundingClientRect(); // до отдачи
    tankEl.classList.remove('fire'); void tankEl.offsetWidth; tankEl.classList.add('fire');
    if (reduced) return;
    const scale = r.width / 666;
    MUZZLES.forEach(([fx, fy], i) =>
      setTimeout(() => shot(r.left + r.width * fx, r.top + r.height * fy, scale), i * 90));
  });


  /* ---------- выхлоп за танком ----------
     Полупрозрачные бело-серые квадраты поднимаются из-за кормы и тают,
     не долетая до верха танка. Работает, только пока танк на экране. */
  (function tankExhaust() {
    if (reduced) return;
    const tank = $('#tank');
    const SRC = [[.80, .44], [.84, .45], [.88, .47]];              // точки выхлопа в долях картинки
    const COLS = ['#e8edf5', '#c9d2e0', '#aab6c9'];
    let visible = false, t = 0;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !t) loop();
    }).observe(tank);
    function puff() {
      const w = tankImg.offsetWidth, h = tankImg.offsetHeight;
      if (!w) return;
      const [fx, fy] = SRC[(Math.random() * SRC.length) | 0];
      const u = w / 666;
      const sz = Math.round((8 + Math.random() * 12) * u);
      const el = document.createElement('span');
      el.className = 'exhaust';
      el.style.cssText = `width:${sz}px;height:${sz}px;left:${fx * w - sz / 2}px;top:${fy * h - sz / 2}px;background:${COLS[(Math.random() * COLS.length) | 0]}`;
      tank.insertBefore(el, tank.firstChild);            // позади корпуса
      const rise = h * (.22 + Math.random() * .14);      // тает ниже верха танка
      const drift = (10 + Math.random() * 30) * u;       // чуть сносит назад
      el.animate([
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${drift * .25}px, ${-rise * .2}px) scale(1)`, opacity: .45 + Math.random() * .15, offset: .18 },
        { transform: `translate(${drift}px, ${-rise}px) scale(1.5)`, opacity: 0 }
      ], { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = () => el.remove();
    }
    function loop() {
      if (!visible || document.hidden) { t = 0; return; }
      puff();
      t = setTimeout(loop, 110 + Math.random() * 130);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !t) loop(); });
  })();

  /* ---------- логотипы: 3D-наклон и блик ---------- */
  if (finePointer && !reduced) {
    $$('.logo').forEach(logo => {
      const card = $('.logo__card', logo);
      logo.addEventListener('mousemove', e => {
        const r = logo.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((x - .5) * 24).toFixed(1) + 'deg');
        card.style.setProperty('--rx', (-(y - .5) * 24).toFixed(1) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      logo.addEventListener('mouseleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); });
    });
  }

  /* ---------- кнопка Figma: магнит + волна ---------- */
  const btn = $('#figmaBtn');
  if (finePointer && !reduced) {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * .15}px, ${y * .3}px)`;
    });
    btn.addEventListener('mouseleave', () => btn.style.transform = '');
  }
  btn.addEventListener('pointerdown', e => {
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const rp = document.createElement('span');
    rp.className = 'ripple';
    rp.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(rp);
    setTimeout(() => rp.remove(), 700);
  });

  /* ---------- «палец по ЖК-экрану» ----------
     Лёгкий WebGL-эффект на фоне: курсор оставляет короткий след — затемнение
     с радужными разводами по краям, как при нажатии на матрицу.
     Поле следа считается в 1/4 разрешения, картинка — в 1/2.
     Когда мышь стоит, отрисовка полностью останавливается. */
  (function lcdTouch() {
    if (reduced || !finePointer) return;
    const canvas = $('#lcd');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return;

    const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    // шаг симуляции: затухание + лёгкая диффузия + мазок вдоль пути курсора
    const FS_STEP = `precision mediump float;varying vec2 uv;
      uniform sampler2D t;uniform vec2 res,a,b;uniform float r,str,decay;
      void main(){
        vec2 px=1./res;
        float v=texture2D(t,uv).r;
        float n=(texture2D(t,uv+vec2(px.x,0.)).r+texture2D(t,uv-vec2(px.x,0.)).r+texture2D(t,uv+vec2(0.,px.y)).r+texture2D(t,uv-vec2(0.,px.y)).r)*.25;
        v=mix(v,n,.45);
        v=max(v*decay-.008,0.);
        vec2 p=uv*res,pa=p-a,ba=b-a;
        float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-4),0.,1.);
        float s=smoothstep(r,0.,length(pa-ba*h))*str;
        v=v+s*(1.-v);
        gl_FragColor=vec4(v,0.,0.,1.);
      }`;
    // вывод: тёмное «продавленное» пятно + интерференционная радуга по краям
    const FS_DRAW = `precision mediump float;varying vec2 uv;
      uniform sampler2D t;uniform vec2 res,head;uniform float hr,hi,asp;
      void main(){
        vec2 px=1./res;
        float f=texture2D(t,uv).r;
        if(f<.003){gl_FragColor=vec4(0.);return;}
        float gx=texture2D(t,uv+vec2(px.x,0.)).r-texture2D(t,uv-vec2(px.x,0.)).r;
        float gy=texture2D(t,uv+vec2(0.,px.y)).r-texture2D(t,uv-vec2(0.,px.y)).r;
        float edge=clamp(length(vec2(gx,gy))*6.,0.,1.);
        float band=f*(1.-f)*4.;
        float phase=f*2.4+(gx-gy)*3.;
        vec3 col=.5+.5*cos(6.2831*(phase+vec3(0.,.33,.67)));
        col=mix(col,vec3(.85,.9,1.),.35);
        // у «пальца» ярче, к хвосту — как было
        float hk=smoothstep(hr*1.8,0.,length((uv-head)*vec2(asp,1.)))*hi;
        float ringA=clamp((band*.15+edge*.08)*(1.+2.6*hk),0.,.28+.37*hk);
        float darkA=smoothstep(.15,1.,f)*.22*(1.+1.2*hk);
        float a=ringA+darkA*(1.-ringA);
        gl_FragColor=vec4(col*ringA,a);
      }`;

    function prog(fs) {
      const p = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s);
      });
      gl.bindAttribLocation(p, 0, 'p');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; ['t', 'res', 'a', 'b', 'r', 'str', 'decay', 'head', 'hr', 'hi', 'asp'].forEach(n => u[n] = gl.getUniformLocation(p, n));
      return { p, u };
    }
    let step, drawP;
    try { step = prog(FS_STEP); drawP = prog(FS_DRAW); } catch (e) { return; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    let fw, fh, targets = [], cur = 0;
    function makeTarget() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb };
    }
    function setup() {
      targets.forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
      const k = Math.min(.25, 480 / innerWidth);        // поле ≤ 480px по ширине
      fw = Math.max(64, Math.round(innerWidth * k));
      fh = Math.max(64, Math.round(innerHeight * k));
      const o = Math.min(.5, 1280 / innerWidth);        // вывод ≤ 1280px
      canvas.width = Math.round(innerWidth * o);
      canvas.height = Math.round(innerHeight * o);
      targets = [makeTarget(), makeTarget()];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    setup();
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(setup, 200); });

    // ввод
    let px = null, py = null, nx = 0, ny = 0, moved = false, lastMove = 0, running = false, lastT = 0, headI = 0, headR = 40;
    addEventListener('pointermove', e => {
      nx = e.clientX; ny = e.clientY;
      if (px === null) { px = nx; py = ny; }
      moved = true; lastMove = performance.now();
      if (!running) { running = true; lastT = 0; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { px = null; });

    function loop(now) {
      const dt = Math.min(3, lastT ? (now - lastT) / 16.67 : 1); lastT = now;
      const sx = fw / innerWidth, sy = fh / innerHeight;
      let ax = 0, ay = 0, bx = 0, by = 0, r = 1, str = 0;
      if (moved && px !== null) {
        const speed = Math.hypot(nx - px, ny - py);
        ax = px * sx; ay = (innerHeight - py) * sy;
        bx = nx * sx; by = (innerHeight - ny) * sy;
        r = (38 + Math.min(speed, 80) * .35) * sx;       // радиус «пальца»
        str = clamp(speed / 30, .2, .9);
        headR = 38 + Math.min(speed, 80) * .35;
        headI = Math.min(1, headI + .5);
        px = nx; py = ny; moved = false;
      }
      const src = targets[cur], dst = targets[cur ^ 1];
      // шаг поля
      gl.useProgram(step.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, fw, fh);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(step.u.t, 0);
      gl.uniform2f(step.u.res, fw, fh);
      gl.uniform2f(step.u.a, ax, ay); gl.uniform2f(step.u.b, bx, by);
      gl.uniform1f(step.u.r, r); gl.uniform1f(step.u.str, str);
      gl.uniform1f(step.u.decay, Math.pow(.82, dt));    // короткое затухание ≈ 0.3 c
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      cur ^= 1;
      // вывод
      gl.useProgram(drawP.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      gl.uniform1i(drawP.u.t, 0);
      gl.uniform2f(drawP.u.res, fw, fh);
      gl.uniform2f(drawP.u.head, nx / innerWidth, 1 - ny / innerHeight);
      gl.uniform1f(drawP.u.hr, headR / innerHeight);
      gl.uniform1f(drawP.u.asp, innerWidth / innerHeight);
      gl.uniform1f(drawP.u.hi, headI);
      headI *= Math.pow(.8, dt);                           // «палец» остановился — яркость уходит
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (now - lastMove < 1000 && !document.hidden) requestAnimationFrame(loop);
      else { running = false; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
  })();

  /* ---------- LCD-глитч на фоне ----------
     Раз в 6–14 секунд на долю секунды проскакивают горизонтальные полосы
     «битых» пикселей: радужные, белые, синие — как сбой матрицы.
     Маленький холст (1/3 разрешения) растягивается с пикселизацией,
     рисуется только во время вспышки, в остальное время простаивает. */
  (function lcdGlitch() {
    if (reduced) return;
    const c = $('#glitch');
    const g = c.getContext('2d');
    const PX = 3; // размер «пикселя» матрицы в CSS-пикселях
    let gw, gh;
    const size = () => { gw = Math.ceil(innerWidth / PX); gh = Math.ceil(innerHeight / PX); c.width = gw; c.height = gh; };
    size(); addEventListener('resize', size);

    const RAINBOW = ['#ff2a4a', '#ff7a1a', '#ffd21a', '#5cff4a', '#1ae8ff', '#2a6bff', '#b43cff', '#ff3cd2'];
    const COOL = ['#ffffff', '#cfe6ff', '#6fb4ff', '#2a6bff', '#8a7dff'];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

    let streaks = [];
    function build() {
      // облако полос вокруг случайного центра, вытянутое по горизонтали
      const cx = rnd(.15, .85) * gw, cy = rnd(.15, .85) * gh;
      const spreadX = rnd(.25, .45) * gw, spreadY = rnd(.12, .3) * gh;
      const n = Math.round(rnd(35, 75));
      streaks = [];
      for (let i = 0; i < n; i++) {
        const len = Math.round(rnd(6, 70) * (Math.random() < .15 ? 2 : 1));
        const x = Math.round(cx + gauss() * spreadX - len / 2);
        const y = Math.round(cy + gauss() * spreadY);
        const rows = Math.random() < .7 ? 1 : 2;
        const pal = Math.random() < .5 ? RAINBOW : COOL;
        const start = (Math.random() * pal.length) | 0;
        // полоса = последовательность цветных отрезков с редкими дырами
        const runs = [];
        let px = 0, k = start;
        while (px < len) {
          const w = Math.round(rnd(2, 9));
          if (Math.random() > .12) runs.push([px, Math.min(w, len - px), pal[k % pal.length]]);
          px += w; if (Math.random() < .7) k++;
        }
        streaks.push({ x, y, rows, runs, a: rnd(.35, .9) });
      }
      // широкие толстые полосы ближе к краям экрана
      const wide = Math.round(rnd(3, 8));
      for (let i = 0; i < wide; i++) {
        const left = Math.random() < .5;
        const len = Math.round(rnd(.12, .32) * gw);
        const x = left ? Math.round(rnd(-.08, .1) * gw) : Math.round(gw - len - rnd(-.08, .1) * gw);
        const y = Math.round(rnd(.05, .95) * gh);
        const pal = Math.random() < .55 ? RAINBOW : COOL;
        const runs = [];
        let px = 0, k = (Math.random() * pal.length) | 0;
        while (px < len) {
          const w = Math.round(rnd(6, 26));
          if (Math.random() > .1) runs.push([px, Math.min(w, len - px), pal[k % pal.length]]);
          px += w; if (Math.random() < .6) k++;
        }
        streaks.push({ x, y, rows: Math.round(rnd(3, 7)), runs, a: rnd(.3, .65) });
      }
    }

    function render(shift) {
      g.clearRect(0, 0, gw, gh);
      g.globalCompositeOperation = 'lighter';
      for (const s of streaks) {
        // случайный горизонтальный сдвиг отдельных полос — «рваная» картинка
        const dx = Math.random() < .3 ? Math.round(rnd(-12, 12)) : 0;
        g.globalAlpha = s.a * (Math.random() < .15 ? .3 : 1);
        for (const [ox, w, col] of s.runs) {
          g.fillStyle = col;
          for (let r = 0; r < s.rows; r++) g.fillRect(s.x + ox + dx + shift, s.y + r * 2, w, 1); // через строку — как строки LCD
        }
      }
      g.globalAlpha = 1;
    }

    function burst() {
      if (document.hidden) return schedule();
      build();
      const frames = Math.round(rnd(3, 7));
      let f = 0;
      c.style.opacity = rnd(.35, .6).toFixed(2);
      (function tick() {
        if (f++ < frames) {
          if (Math.random() < .35) build();
          render(Math.round(rnd(-4, 4)));
          setTimeout(tick, rnd(30, 80));
        } else {
          g.clearRect(0, 0, gw, gh);
          // иногда — короткий повтор, как у настоящего сбоя
          if (Math.random() < .3) setTimeout(burst, rnd(120, 300)); else schedule();
        }
      })();
    }
    function schedule() { setTimeout(burst, rnd(6000, 14000)); }
    setTimeout(burst, rnd(3000, 5000));
  })();
})();
