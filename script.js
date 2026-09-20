// --- отложенная загрузка картинок (data-src) ---
function revealImgs(root) {
  if (!root) return;
  root.querySelectorAll('img[data-src]').forEach(img => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  });
}

// после загрузки hero — тихо подгружаем только след. секцию (для плавного первого перехода)
window.addEventListener('load', () => {
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 800));
  idle(() => revealImgs(document.getElementById('birthday')));
});

// --- мини-роутер экранов ---
let current = document.getElementById('hero');
let busy = false;

function go(id) {
  const next = document.getElementById(id);
  if (busy || !next || next === current) return;
  busy = true;

  revealImgs(next); // гарантированно грузим картинки секции при переходе

  const prev = current;
  current = next;

  if (prev.id === 'birthday') bdPortrait.stop();

  prev.classList.remove('active');
  prev.classList.add('leaving');

  next.classList.add('active', 'entering');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.classList.add('go');
  }));

  if (id === 'birthday') playBirthday();
  if (id === 'result') setTimeout(resetWishVideo, 200);
  if (id === 'final') startFinalCinema();
  if (/^quiz[2-5]?$/.test(id)) initQuizSection(id);

  setTimeout(() => {
    prev.classList.remove('leaving');
    next.classList.remove('entering', 'go');
    next.scrollTop = 0;
    busy = false;
  }, 1200);
}

// --- фон секции «С днём рождения»: летающая звезда закрашивает Ч/Б в цвет ---
const _imgCache = {};
function loadImageOnce(src) {
  if (_imgCache[src]) return _imgCache[src];
  _imgCache[src] = new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
  return _imgCache[src];
}

let bdPaint = null;
function drawBirthdayBg() {
  const box = document.querySelector('.birthday__bg');
  if (!box) return;
  const canvas = box.querySelector('.birthday__bg-canvas');
  if (!canvas) return;
  if (bdPaint) bdPaint.stop();
  bdPaint = createBirthdayPaint(canvas);
  bdPaint.run();
}

// зацикленный «разрез»: Ч/Б фон, по нему непрерывно вспыхивают и гаснут цветные пятна
function createBirthdayPaint(canvas) {
  const box = canvas.parentElement;
  const rect = box.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width || box.offsetWidth || window.innerWidth));
  const H = Math.max(1, Math.round(rect.height || box.offsetHeight || window.innerHeight));
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bw = document.createElement('canvas'); bw.width = W; bw.height = H;
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const trail = document.createElement('canvas'); trail.width = W; trail.height = H;   // маска цвета (альфа)
  const tctx = trail.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  const xctx = tmp.getContext('2d');

  const MAX = 9;            // одновременно активных пятен
  const SPAWN_MS = 340;     // интервал появления новых
  let raf = 0, stopped = false, cells = [], lastSpawn = 0;

  const easeOut = g => 1 - (1 - g) * (1 - g);

  function cover(iw, ih) {
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    return [(W - dw) / 2, (H - dh) / 2, dw, dh];
  }

  // новое пятно в свободном месте
  function spawnCell(now) {
    const m = 0.05;
    let cx = 0, cy = 0, ok = false, tries = 0;
    do {
      cx = W * (m + Math.random() * (1 - 2 * m));
      cy = H * (m + Math.random() * (1 - 2 * m));
      ok = cells.every(c => Math.hypot(c.cx - cx, c.cy - cy) > c.rMax * 0.7);
      tries++;
    } while (!ok && tries < 8);
    const blobs = [];
    const nb = 3 + (Math.random() * 3 | 0);
    for (let k = 0; k < nb; k++) blobs.push({ ang: Math.random() * Math.PI * 2, dist: 0.35 + Math.random() * 0.6, rr: 0.32 + Math.random() * 0.3 });
    cells.push({
      cx, cy, blobs,
      rMax: H * (0.12 + Math.random() * 0.11),
      born: now,
      life: 2600 + Math.random() * 1500,
    });
  }

  // фаза жизни пятна → альфа (появление/удержание/угасание) и радиус
  function cellState(c, now) {
    const t = (now - c.born) / c.life;
    if (t >= 1) return null;
    let a;
    if (t < 0.30) a = t / 0.30;           // проявление
    else if (t < 0.58) a = 1;             // держится цвет
    else a = 1 - (t - 0.58) / 0.42;       // гаснет обратно в Ч/Б
    const rg = easeOut(Math.min(1, t / 0.42));
    return { a: a * a, r: rg * c.rMax };
  }

  function blot(x, y, r, a) {
    const g = tctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + (a * 0.7).toFixed(3) + ')');
    g.addColorStop(0.82, 'rgba(0,0,0,' + (a * 0.22).toFixed(3) + ')');   // покрепче кромка → «разрез»
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.beginPath(); tctx.arc(x, y, r, 0, Math.PI * 2); tctx.fill();
  }

  function stampCell(c, st) {
    blot(c.cx, c.cy, st.r, st.a);
    for (const b of c.blobs) blot(c.cx + Math.cos(b.ang) * b.dist * st.r, c.cy + Math.sin(b.ang) * b.dist * st.r, b.rr * st.r, st.a * 0.85);
  }

  function compose() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bw, 0, 0);                         // Ч/Б основа
    xctx.globalCompositeOperation = 'source-over';
    xctx.clearRect(0, 0, W, H);
    xctx.drawImage(col, 0, 0);
    xctx.globalCompositeOperation = 'destination-in';
    xctx.drawImage(trail, 0, 0);                     // цвет только внутри пятен
    xctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  }

  function frame(now) {
    if (stopped) return;
    if (!lastSpawn) lastSpawn = now;
    if (now - lastSpawn >= SPAWN_MS && cells.length < MAX) { spawnCell(now); lastSpawn = now; }

    tctx.clearRect(0, 0, W, H);
    cells = cells.filter(c => {
      const st = cellState(c, now);
      if (!st) return false;
      stampCell(c, st);
      return true;
    });
    compose();
    raf = requestAnimationFrame(frame);
  }

  return {
    async run() {
      let img;
      try { img = await loadImageOnce('img/photo-anime/birhday-bd.jpg'); }
      catch (e) { return; }
      if (stopped) return;
      const [dx, dy, dw, dh] = cover(img.naturalWidth, img.naturalHeight);
      col.getContext('2d').drawImage(img, dx, dy, dw, dh);
      const bx = bw.getContext('2d');
      bx.filter = 'grayscale(1) contrast(1.03)';      // полностью Ч/Б фон
      bx.drawImage(img, dx, dy, dw, dh);
      bx.filter = 'none';
      // стартуем уже населённым: несколько пятен на разных фазах
      const t0 = performance.now();
      for (let i = 0; i < MAX; i++) spawnCell(t0 - Math.random() * 2200);
      raf = requestAnimationFrame(frame);
    },
    stop() { stopped = true; if (raf) cancelAnimationFrame(raf); },
  };
}

// разбить текст на буквы (для побуквенной прорисовки); возвращает следующий индекс
function splitLetters(el, start = 0) {
  if (!el || el.dataset.split) return start;
  let i = start, html = '';
  el.textContent.split(/(\s+)/).forEach(token => {
    if (token === '') return;
    if (/^\s+$/.test(token)) { html += ' '; return; }
    html += '<span class="w">' +
      [...token].map(ch => `<span class="ch" style="--i:${i++}">${ch}</span>`).join('') +
      '</span>';
  });
  el.innerHTML = html;
  el.dataset.split = '1';
  return i;
}

function splitSubtitle() {
  splitLetters(document.querySelector('.birthday__subtitle'));
}

// оркестратор секции birthday: подзаголовок → контуры портрета → акварель → кнопка (CSS-задержка)
function playBirthday() {
  const sec = document.getElementById('birthday');
  splitSubtitle();
  sec.classList.remove('play', 'ready');
  void sec.offsetWidth;
  sec.classList.add('play');
  bdPortrait.play().then(ok => { if (ok) sec.classList.add('ready'); });
}

// портрет: линии вычерчиваются сверху вниз, затем акварельное пятно проявляет цветной рисунок
const bdPortrait = (() => {
  const box = document.querySelector('.bd-portrait');
  const lines = box && box.querySelector('.bd-portrait__lines');
  const aFace = document.getElementById('a-face');
  const signLetters = splitLetters(box && box.querySelector('.bd-portrait__sign'));
  const LINES_DELAY = 0.6, DRAW_DUR = 2.0, DRAW_STAGGER = 1.4;
  const PAUSE_MS = 1000;      // пауза между прорисовкой лица и началом покраски
  const BTN_AFTER_MS = 550;   // кнопка появляется вскоре после старта покраски
  let run = 0;

  function reset() {
    box.classList.remove('color', 'signed');
    lines.classList.remove('draw', 'fade');
    lines.innerHTML = '';
  }

  // возвращает true, если дошли до конца (не было stop / повторного play)
  async function play() {
    if (!box || !lines) return false;
    const id = ++run;
    reset();
    buildPortraitFX();
    await sleep(LINES_DELAY * 1000);
    if (id !== run) return false;
    await drawLinesInto(lines, DRAW_DUR, DRAW_STAGGER, { fit: 'xMidYMid meet', byY: true });
    if (id !== run) return false;

    await sleep(PAUSE_MS);                 // 1.5с пауза перед покраской
    if (id !== run) return false;

    lines.classList.add('fade');
    try { aFace.beginElement(); } catch (e) {}
    requestAnimationFrame(() => { if (id === run) box.classList.add('color'); });

    // подпись — параллельно, чтобы не задерживать появление кнопки
    setTimeout(() => { if (id === run) box.classList.add('signed'); }, 1600);

    await sleep(BTN_AFTER_MS);             // кнопка «Начать квест» появляется быстрее
    return id === run;
  }

  return { play, stop() { run++; } };
})();

// золотые искры разлетаются от лица вместе с фронтом акварели (SMIL, привязаны к a-face)
function buildPortraitFX() {
  const fx = document.getElementById('bd-fx');
  if (!fx) return;
  fx.textContent = '';
  const CX = 470, CY = 340, N = 70;
  for (let i = 0; i < N; i++) {
    const big = i % 5 === 0;
    const ang = Math.random() * Math.PI * 2;
    const delay = Math.random() * 1.7;
    const r0 = 60 + delay / 1.7 * 420;                  // старт на фронте пятна
    const fly = 120 + Math.random() * 220;
    const sx = CX + Math.cos(ang) * r0, sy = CY + Math.sin(ang) * r0;
    const ex = Math.cos(ang) * fly, ey = Math.sin(ang) * fly - 60 - Math.random() * 80;
    const dur = (1.0 + Math.random() * 1.1).toFixed(2);
    const rad = (big ? 9 + Math.random() * 6 : 4 + Math.random() * 4).toFixed(1);
    const begin = 'a-face.begin+' + delay.toFixed(2) + 's';

    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', rad);
    c.setAttribute('cx', '0'); c.setAttribute('cy', '0');
    c.setAttribute('fill', 'url(#wc-spark)');
    c.setAttribute('opacity', '0');

    const m = document.createElementNS(SVGNS, 'animateMotion');
    m.setAttribute('dur', dur + 's');
    m.setAttribute('begin', begin);
    m.setAttribute('fill', 'remove');
    m.setAttribute('calcMode', 'spline');
    m.setAttribute('keyPoints', '0;1');
    m.setAttribute('keyTimes', '0;1');
    m.setAttribute('keySplines', '0.2 0.6 0.3 1');
    m.setAttribute('path', `M ${sx.toFixed(0)} ${sy.toFixed(0)} q ${(ex * 0.5).toFixed(0)} ${(ey * 0.3).toFixed(0)} ${ex.toFixed(0)} ${ey.toFixed(0)}`);

    const o = document.createElementNS(SVGNS, 'animate');
    o.setAttribute('attributeName', 'opacity');
    o.setAttribute('begin', begin);
    o.setAttribute('dur', dur + 's');
    o.setAttribute('fill', 'remove');
    o.setAttribute('values', '0;1;1;0');
    o.setAttribute('keyTimes', '0;0.15;0.5;1');

    c.appendChild(m); c.appendChild(o);
    fx.appendChild(c);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- выбор vibe-карточки ---
function pickVibe(card) {
  document.querySelectorAll('.vibe__card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  document.body.dataset.vibe = card.dataset.vibe || 'sea';
  setTimeout(() => go('quiz'), 900);
}

// --- выбор quiz-варианта (в рамках своей секции) ---
function pickQuiz(btn) {
  const section = btn.closest('.screen');
  section.querySelectorAll('.quiz__option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  section.querySelector('.quiz__next').disabled = false;
  drawOptCircle(section, btn);
}

// рисованный кружок вокруг выбранного варианта (SVG stroke-draw)
function makeOptCircle() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'opt-circle');
  svg.setAttribute('viewBox', '0 0 300 70');
  svg.setAttribute('preserveAspectRatio', 'none');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M14,37 C9,15 92,7 150,7 C214,6 295,12 289,33 C294,58 206,66 150,63 C76,67 17,61 14,37');
  p.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(p);
  return svg;
}
function drawOptCircle(section, btn) {
  const opts = section.querySelector('.quiz__options');
  if (!opts) return;
  let svg = opts.querySelector('.opt-circle');
  if (!svg) { svg = makeOptCircle(); opts.appendChild(svg); }
  const oR = opts.getBoundingClientRect(), bR = btn.getBoundingClientRect();
  const pad = 9;
  svg.style.left = (bR.left - oR.left - pad) + 'px';
  svg.style.top = (bR.top - oR.top - pad) + 'px';
  svg.style.width = (bR.width + pad * 2) + 'px';
  svg.style.height = (bR.height + pad * 2) + 'px';
  const path = svg.querySelector('path');
  const L = path.getTotalLength();
  path.style.strokeDasharray = L;
  svg.classList.add('draw');                       // видимость
  path.getAnimations().forEach(a => a.cancel());   // сбросить прошлую обводку
  path.animate(                                     // и обмотать заново
    [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
    { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
  );
}

// индикатор прогресса (5 точек)
function buildProgress(id) {
  const sec = document.getElementById(id);
  if (!sec) return;
  const step = id === 'quiz' ? 1 : parseInt(id.replace('quiz', ''), 10);
  let bar = sec.querySelector('.quiz__progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'quiz__progress';
    for (let i = 0; i < 5; i++) { const d = document.createElement('span'); d.className = 'pd'; bar.appendChild(d); }
    sec.insertBefore(bar, sec.firstChild);
  }
  [...bar.children].forEach((d, i) => {
    d.classList.toggle('done', i < step - 1);
    d.classList.toggle('current', i === step - 1);
  });
}

// --- оживление блока вопроса: вырезанные персонажи в углах + проявление по словам ---
const QUIZ_DECOR = {
  quiz: [
    ['kiki', 'left:6px;top:6px;width:clamp(48px,13vw,66px);--rot:-6deg;--d:5.6s'],
    ['book-card', 'right:6px;bottom:4px;width:clamp(54px,15vw,74px);--rot:3deg;--d:6.2s;--delay:.6s;opacity:.42'],
    ['card-form-drams', 'right:14px;top:8px;width:clamp(38px,10vw,52px);--rot:4deg;--d:4.6s;--delay:.3s'],
  ],
  quiz2: [
    ['kiki', 'right:6px;top:6px;width:clamp(48px,13vw,66px);--rot:6deg;--d:5.9s'],
    ['card-form-drams', 'left:10px;bottom:6px;width:clamp(38px,10vw,52px);--rot:-4deg;--d:4.4s;--delay:.5s'],
    ['lighthub', 'left:14px;top:12px;width:clamp(14px,4vw,22px);--rot:0deg;--d:3.6s;--delay:.2s;opacity:.7'],
  ],
  quiz3: [
    ['kiki', 'left:6px;bottom:6px;width:clamp(48px,13vw,66px);--rot:4deg;--d:5.4s'],
    ['card-form-drams', 'right:10px;top:8px;width:clamp(40px,11vw,54px);--rot:5deg;--d:4.8s;--delay:.4s'],
  ],
  quiz4: [
    ['book-card', 'left:6px;top:6px;width:clamp(54px,15vw,74px);--rot:-3deg;--d:6.1s;opacity:.42'],
    ['kiki', 'right:6px;bottom:6px;width:clamp(48px,13vw,66px);--rot:-5deg;--d:5.7s;--delay:.5s'],
    ['lighthub', 'right:16px;top:12px;width:clamp(14px,4vw,22px);--d:3.4s;--delay:.2s;opacity:.7'],
  ],
  quiz5: [
    ['doror', 'left:6px;bottom:5px;width:clamp(58px,16vw,80px);--rot:2deg;--d:6.4s;opacity:.4'],
    ['card-form-drams', 'right:10px;top:8px;width:clamp(38px,10vw,52px);--rot:-4deg;--d:4.5s;--delay:.4s'],
  ],
};

function buildQuizDecor(id) {
  const card = document.querySelector('#' + id + ' .quiz__card');
  if (!card || card.querySelector('.card-decor')) return;
  const wrap = document.createElement('div');
  wrap.className = 'card-decor';
  (QUIZ_DECOR[id] || []).forEach(([name, style]) => {
    const img = document.createElement('img');
    img.src = 'img/photo-anime/card-decor/' + name + '.webp';
    img.alt = ''; img.setAttribute('aria-hidden', 'true');
    img.style.cssText = style;
    wrap.appendChild(img);
  });
  card.insertBefore(wrap, card.firstChild);   // за текстом (z-index держит вопрос сверху)
}

function revealQuestion(id) {
  const q = document.querySelector('#' + id + ' .quiz__question');
  if (!q) return;
  if (!q.dataset.raw) q.dataset.raw = q.textContent;
  let i = 0;
  q.innerHTML = q.dataset.raw.split(/(\s+)/).map(t =>
    /^\s+$/.test(t) ? ' ' : '<span class="qw" style="--i:' + (i++) + '">' + t + '</span>'
  ).join('');
  q.classList.remove('reveal');
  void q.offsetWidth;
  q.classList.add('reveal');
}

function initQuizSection(id) {
  buildQuizDecor(id);
  buildProgress(id);
  revealQuestion(id);
}

// параллакс от наклона телефона (мобила, где живут фоны-картинки)
window.addEventListener('deviceorientation', e => {
  const sec = document.querySelector('.screen.active');
  if (!sec || !/^quiz[2-5]?$/.test(sec.id)) return;
  if (e.gamma == null || e.beta == null) return;
  const nx = Math.max(-1, Math.min(1, e.gamma / 22));        // лево-право
  const ny = Math.max(-1, Math.min(1, (e.beta - 45) / 22));  // наклон вперёд/назад
  sec.style.setProperty('--px', nx.toFixed(3));
  sec.style.setProperty('--py', ny.toFixed(3));
}, { passive: true });

// параллакс блока от курсора (десктоп) — сдвигает декор и вопрос «в глубину»
document.addEventListener('pointermove', e => {
  const sec = document.querySelector('.screen.active');
  if (!sec || !/^quiz[2-5]?$/.test(sec.id)) return;
  const nx = (e.clientX / window.innerWidth - 0.5) * 2;
  const ny = (e.clientY / window.innerHeight - 0.5) * 2;
  sec.style.setProperty('--px', nx.toFixed(3));
  sec.style.setProperty('--py', ny.toFixed(3));
}, { passive: true });

// --- конфигурация шагов квеста ---
const QUIZ = {
  1: { section: 'quiz',  hint: 'hintOverlay',  polaroid: 'polaroidOverlay',  next: 'quiz2' },
  2: { section: 'quiz2', hint: 'hintOverlay2', polaroid: 'polaroidOverlay2', next: 'quiz3' },
  3: { section: 'quiz3', hint: 'hintOverlay3', polaroid: 'polaroidOverlay3', next: 'shelf' },
  4: { section: 'quiz4', hint: 'hintOverlay4', polaroid: 'polaroidOverlay4', next: 'quiz5' },
  5: { section: 'quiz5', hint: 'hintOverlay5', polaroid: 'polaroidOverlay5', next: 'result' },
};

// --- проверка ответа (с откликом) ---
function checkQuiz(step) {
  const secId = QUIZ[step].section;
  const selected = document.querySelector('#' + secId + ' .quiz__option.selected');
  if (!selected) return;
  const section = document.getElementById(secId);
  const card = section.querySelector('.quiz__card');
  if (selected.hasAttribute('data-correct')) {
    quizFeedbackCorrect(section, card);
    setTimeout(() => showPolaroid(step), 900);
  } else {
    quizFeedbackWrong(section, card);
    setTimeout(() => showHint(step), 650);
  }
}

// правильно → искры + «охает» карточка + Кики подпрыгивает
function quizFeedbackCorrect(section, card) {
  sparkleBurst(section, card);
  restartClass(card, 'correct', 700);
  const kiki = section.querySelector('.card-decor img[src*="kiki"]');
  if (kiki) restartClass(kiki, 'hop', 650);
}
// неверно → «дрожание» + сажевый дух мотает головой
function quizFeedbackWrong(section, card) {
  restartClass(card, 'wrong', 550);
  const soot = section.querySelector('.card-decor img[src*="card-form-drams"]');
  if (soot) restartClass(soot, 'wobble', 550);
}
function restartClass(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function sparkleBurst(section, card) {
  const sr = section.getBoundingClientRect(), cr = card.getBoundingClientRect();
  const cx = cr.left - sr.left + cr.width / 2, cy = cr.top - sr.top + cr.height / 2;
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('div'); s.className = 'spark';
    const sz = 6 + Math.random() * 11; s.style.width = s.style.height = sz + 'px';
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    section.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 95;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 1, offset: .3 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.4}px), calc(-50% + ${Math.sin(a) * d * 1.4}px)) scale(.3)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 450, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => s.remove();
  }
}
function checkQuiz1() { checkQuiz(1); }
function checkQuiz2() { checkQuiz(2); }
function checkQuiz3() { checkQuiz(3); }
function checkQuiz4() { checkQuiz(4); }
function checkQuiz5() { checkQuiz(5); }

// --- карточка-подсказка ---
function showHint(step) {
  const el = document.getElementById(QUIZ[step].hint);
  revealImgs(el);
  el.classList.add('visible');
}

function closeHint(step) {
  document.getElementById(QUIZ[step].hint).classList.remove('visible');
}

function giveUp(step) {
  document.getElementById(QUIZ[step].hint).classList.remove('visible');
  setTimeout(() => showPolaroid(step), 300);
}

// --- polaroid modal (комплименты) ---
function showPolaroid(step) {
  const el = document.getElementById(QUIZ[step].polaroid);
  revealImgs(el);
  el.classList.add('visible');
}

function closePolaroid(step, e) {
  const overlay = document.getElementById(QUIZ[step].polaroid);
  if (e.target === overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => go(QUIZ[step].next), 400);
  }
}
function closePolaroid1(e) { closePolaroid(1, e); }
function closePolaroid2(e) { closePolaroid(2, e); }
function closePolaroid3(e) { closePolaroid(3, e); }
function closePolaroid4(e) { closePolaroid(4, e); }
function closePolaroid5(e) { closePolaroid(5, e); }

// явное «далее →» (кнопка + Escape), без тапа по фону
function advancePolaroid(step) {
  const overlay = document.getElementById(QUIZ[step].polaroid);
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => go(QUIZ[step].next), 400);
}

// --- фон-видео финала: статичный кадр (как фото), по нажатию играет ветер → разлёт ---
let wishVideo = null;
function initWishVideo() { wishVideo = document.querySelector('.wish__video'); }
function resetWishVideo() {            // статичный кадр до нажатия
  if (!wishVideo) return;
  try { wishVideo.pause(); wishVideo.currentTime = 0; } catch (e) {}
}
function releaseWish() {               // по нажатию — с начала: 2с ветра, затем разлёт
  if (!wishVideo) return;
  try { wishVideo.currentTime = 0; wishVideo.play(); } catch (e) {}
}

// --- финал: загадай желание (текст остаётся только на устройстве) ---
function sendWish() {
  const input = document.querySelector('#result .wish__input');
  const text = input ? input.value.trim() : '';
  try { if (text) localStorage.setItem('nozanin_wish', text); } catch (e) {}
  releaseWish();                  // одуванчики разлетаются — желание улетает
  if (wishVideo) {                // «Загадано» — когда разлёт отыграл (+ страховка)
    let shown = false;
    const done = () => { if (shown) return; shown = true; finishWish(); };
    wishVideo.addEventListener('ended', done, { once: true });
    setTimeout(done, 6000);
  } else finishWish();
}

function skipWish() { go('final'); }   // пропуск — сразу к финалу, без карточки «Загадано»

function finishWish() {
  const el = document.getElementById('wishDoneOverlay');
  revealImgs(el);
  el.classList.add('visible');
}

function goFinal() {
  document.getElementById('wishDoneOverlay').classList.remove('visible');
  setTimeout(() => go('final'), 300);
}

// полный сброс состояния квеста (выборы, обводки, полочки, желание)
function resetQuest() {
  // vibe
  document.querySelectorAll('.vibe__card.selected').forEach(el => el.classList.remove('selected'));
  delete document.body.dataset.vibe;

  // quiz: снять выборы, убрать обводки, «далее» — неактивна, сбросить фидбек карточки
  document.querySelectorAll('.quiz__option.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.opt-circle').forEach(el => el.remove());
  document.querySelectorAll('.quiz__next').forEach(b => b.disabled = true);
  document.querySelectorAll('.quiz__card').forEach(c => c.classList.remove('correct', 'wrong'));

  // отвлекалочка: вернуть все фото в трей, очистить полочки
  const tray = document.querySelector('.shelf__tray');
  if (tray) {
    document.querySelectorAll('#shelf .shelf__slot .shelf__photo').forEach(p => {
      p.classList.remove('placed', 'picked', 'dropping', 'dragging');
      p.style.cssText = p.style.cssText
        .replace(/(position|left|top|width|height|z-index|pointer-events|margin)\s*:[^;]*;?/g, '');
      tray.appendChild(p);
    });
    tray.querySelectorAll('.shelf__photo.picked').forEach(p => p.classList.remove('picked'));
  }
  pickedPhoto = null;
  const sNext = document.querySelector('.shelf__next'); if (sNext) sNext.classList.remove('ready');
  document.querySelectorAll('#shelf .shelf__slot').forEach(s => s.classList.remove('pulse', 'over'));
  const cnt = document.getElementById('shelfCount'); if (cnt) cnt.textContent = '0 из 3';

  // желание
  const wish = document.querySelector('#result .wish__input'); if (wish) wish.value = '';
}

function finishQuest() {
  resetQuest();
  go('hero');
}

function restartQuest() {
  resetQuest();
  go('vibe');
}

// --- рукописная прорисовка текста поздравления (по букве) ---
function animateFinalHandwriting() {
  const els = document.querySelectorAll('#final .final__hbd, #final .final__sign, #final .final__text p');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const PER = 25; // мс на букву (общий сквозной счётчик)
  let gi = 0;

  els.forEach(el => {
    if (!el.dataset.raw) el.dataset.raw = el.innerHTML;      // сохраняем исходник (в заголовке есть <br>)
    let html = '';
    el.dataset.raw.split(/(<br\s*\/?>)/i).forEach(chunk => {
      if (/<br/i.test(chunk)) { html += '<br>'; return; }
      chunk.split(/(\s+)/).forEach(token => {
        if (token === '') return;
        if (/^\s+$/.test(token)) { html += ' '; return; } // обычный пробел — точка переноса
        html += '<span class="w">' + [...token]
          .map(ch => `<span class="ch" style="--i:${gi++}">${esc(ch)}</span>`)
          .join('') + '</span>';
      });
    });
    el.innerHTML = html;
  });

  // общая длительность как CSS-переменную (не обязательно, но пригодится)
  const total = gi * PER;
  document.getElementById('final').style.setProperty('--hw-total', total + 'ms');
  return gi;                       // число букв → длительность прописывания
}

// ── финал-кино: торт рисуется крупно → акварель → садится в шапку → текст → конфетти ──
let finalRun = 0;
const ENTER_MS = 1250;               // ждём завершения анимации входа секции перед замером

function startFinalCinema() {
  const sec = document.getElementById('final');
  const cake = sec.querySelector('.final__cake');
  const slot = sec.querySelector('.final__cake-slot');
  const lines = cake && cake.querySelector('.final__cake-lines');
  if (!cake || !slot || !lines) return;
  const rid = ++finalRun;

  // сброс состояния (важно для «Пройти снова»)
  sec.classList.remove('final--intro', 'final--paint', 'final--assembled', 'final--writing');
  cake.classList.remove('is-live', 'final__cake--lift', 'instant', 'is-docked');
  cake.style.transition = 'none';
  cake.style.transform = '';
  cake.style.opacity = '';
  lines.classList.remove('draw', 'fade');
  lines.innerHTML = '';

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  try { new Image().src = 'img/photo-anime/cake-img.jpg'; } catch (e) {}   // прогрев
  bindFinalResize();                           // держим торт на слоте при ресайзе/повороте

  // прячем карточку на время входа секции; замер слота — ТОЛЬКО после входа (иначе торт съедет)
  sec.classList.add('final--intro');
  setTimeout(() => {
    if (rid !== finalRun) return;
    if (reduce) assembleFinalInstant();        // без движения — сразу собранная карточка
    else playFinal(rid);                       // полное кино
  }, ENTER_MS);
}

async function playFinal(rid) {
  const sec = document.getElementById('final');
  const cake = sec.querySelector('.final__cake');
  const slot = sec.querySelector('.final__cake-slot');
  const lines = cake.querySelector('.final__cake-lines');
  const aCake = document.getElementById('a-cake');

  // 0) геометрия слота + «большой кадр» по центру экрана
  positionCakeToSlot(sec, cake, slot);
  const big = cakeBigTransform(sec, cake);
  cake.style.transition = 'none';
  cake.classList.add('is-live', 'final__cake--lift');
  cake.style.transform = big;
  void cake.offsetWidth;
  cake.style.transition = '';
  sec.classList.add('final--paint');
  bindFinalSkip(rid);

  // 1) вычерчивание контуров торта
  try { await drawLinesInto(lines, 1.4, 0.9, { fit: 'xMidYMid slice' }); }
  catch (e) {}                                  // svg не загрузился — просто покажем акварель
  if (rid !== finalRun) return;

  // 2) линии гаснут + проступает акварель
  lines.classList.add('fade');
  try { aCake.beginElement(); } catch (e) {}
  await sleep(1300);
  if (rid !== finalRun) return;

  // 3) торт уезжает в шапку карточки, карточка проявляется вокруг
  cake.classList.remove('final__cake--lift');
  cake.classList.add('is-docked');
  cake.style.transform = '';                    // → назад в слот (CSS transition)
  const letters = animateFinalHandwriting() || 0;   // заранее разбиваем текст на скрытые буквы
  sec.classList.remove('final--intro', 'final--paint');   // карточка проявляется (буквы ещё скрыты)
  await sleep(700);
  if (rid !== finalRun) return;

  // 4) текст начинает прописываться пером
  sec.classList.add('final--writing');
  const textMs = letters * 25 + 600;

  // 5) финальный «хлопок» конфетти (в середине прописывания)
  setTimeout(() => { if (rid === finalRun) fireFinalConfetti(); }, Math.min(textMs - 200, 3800));

  await sleep(textMs);
  if (rid === finalRun) unbindFinalSkip();
}

// торт мгновенно в шапке (повтор / reduced-motion / тап-скип)
function assembleFinalInstant() {
  const sec = document.getElementById('final');
  const cake = sec.querySelector('.final__cake');
  const slot = sec.querySelector('.final__cake-slot');
  const lines = cake.querySelector('.final__cake-lines');
  positionCakeToSlot(sec, cake, slot);
  cake.style.transition = 'none';
  cake.style.transform = '';
  cake.classList.remove('final__cake--lift');
  cake.classList.add('is-live', 'instant', 'is-docked');
  lines.classList.add('fade');
  sec.classList.remove('final--intro', 'final--paint', 'final--writing');
  sec.classList.add('final--assembled');
  animateFinalHandwriting();
}

// торт садится ровно на слот в шапке (docked-геометрия)
function positionCakeToSlot(sec, cake, slot) {
  const secR = sec.getBoundingClientRect();
  const sR = slot.getBoundingClientRect();
  cake.style.left = (sR.left - secR.left) + 'px';
  cake.style.top = (sR.top - secR.top) + 'px';
  cake.style.width = sR.width + 'px';
  cake.style.height = sR.height + 'px';
}

// transform из docked-состояния в «большой кадр» по центру секции
function cakeBigTransform(sec, cake) {
  const secR = sec.getBoundingClientRect();
  const cR = cake.getBoundingClientRect();
  const bigW = Math.min(secR.width * 0.9, 460);
  const scale = Math.max(1.15, bigW / (cR.width || 1));
  const cx0 = cR.left + cR.width / 2, cy0 = cR.top + cR.height / 2;
  const tx = (secR.left + secR.width / 2) - cx0;
  const ty = (secR.top + secR.height * 0.42) - cy0;
  // наклон полароида сохраняем и в «большом кадре» — чтобы посадка была плавной
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(-2deg)`;
}

// тап по секции = промотать кино к собранной карточке
function bindFinalSkip(rid) {
  const sec = document.getElementById('final');
  unbindFinalSkip();
  const h = (e) => {
    if (e.target.closest && e.target.closest('.final__finish, .final__restart, button, a')) return;
    finalRun++;                                 // отменяем текущую цепочку await'ов
    unbindFinalSkip();
    assembleFinalInstant();
    setTimeout(fireFinalConfetti, 200);
  };
  sec._finalSkip = h;
  sec.addEventListener('click', h);
}
function unbindFinalSkip() {
  const sec = document.getElementById('final');
  if (sec && sec._finalSkip) { sec.removeEventListener('click', sec._finalSkip); sec._finalSkip = null; }
}

// торт остаётся на слоте при ресайзе/повороте экрана (когда уже сел в шапку)
function bindFinalResize() {
  unbindFinalResize();
  const sec = document.getElementById('final');
  const h = () => {
    const cake = sec.querySelector('.final__cake');
    const slot = sec.querySelector('.final__cake-slot');
    if (cake && slot && cake.classList.contains('is-docked')) {
      const t = cake.style.transition;
      cake.style.transition = 'none';
      positionCakeToSlot(sec, cake, slot);
      void cake.offsetWidth;
      cake.style.transition = t;
    }
  };
  sec._finalResize = h;
  window.addEventListener('resize', h);
}
function unbindFinalResize() {
  const sec = document.getElementById('final');
  if (sec && sec._finalResize) { window.removeEventListener('resize', sec._finalResize); sec._finalResize = null; }
}

// --- финальный «хлопок»: конфетти вокруг открытки (canvas-confetti) ---
let _confetti = null;
function getConfetti() {
  if (_confetti) return _confetti;
  if (typeof confetti === 'undefined') return null;
  const canvas = document.getElementById('confetti-canvas');
  _confetti = canvas
    ? confetti.create(canvas, { resize: true, useWorker: true })
    : confetti;                                    // запасной вариант — на весь экран
  return _confetti;
}

function fireFinalConfetti() {
  const section = document.getElementById('final');
  if (!section || !section.classList.contains('active')) return;   // секция должна быть на экране
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fire = getConfetti();
  if (!fire) return;

  const card = section.querySelector('.final__card');
  const r = (card || section).getBoundingClientRect();
  // центр открытки в долях окна — точка, откуда расходится залп
  const ox = (r.left + r.width / 2) / window.innerWidth;
  const oy = (r.top + r.height / 2) / window.innerHeight;
  const COLORS = ['#FFD166', '#EF6F6C', '#06D6A0', '#118AB2', '#F78DA7', '#FF9F52', '#8367C7', '#FCE9C8'];

  const base = { origin: { x: ox, y: oy }, colors: COLORS, disableForReducedMotion: true };

  // 1) плотный круговой «бабах» вокруг открытки
  fire({ ...base, particleCount: 130, spread: 360, startVelocity: 42, scalar: 1.05, ticks: 220 });
  // 2) две встречные струи-хлопушки из нижних углов открытки
  const lx = r.left / window.innerWidth, rx = r.right / window.innerWidth, by = r.bottom / window.innerHeight;
  setTimeout(() => {
    if (!section.classList.contains('active')) return;
    fire({ ...base, particleCount: 70, angle: 60,  spread: 55, startVelocity: 55, origin: { x: lx, y: by } });
    fire({ ...base, particleCount: 70, angle: 120, spread: 55, startVelocity: 55, origin: { x: rx, y: by } });
  }, 160);
  // 3) лёгкий «дождик» сверху для послевкусия
  setTimeout(() => {
    if (!section.classList.contains('active')) return;
    fire({ ...base, particleCount: 60, spread: 120, startVelocity: 30, gravity: 0.9, scalar: 0.9, origin: { x: ox, y: Math.max(0, oy - 0.25) } });
  }, 420);
}

// --- отвлекалочка: разложи фото по полочкам ---
let pickedPhoto = null;

function updateShelf() {
  const filled = document.querySelectorAll('#shelf .shelf__slot .shelf__photo').length;
  const c = document.getElementById('shelfCount');
  if (c) c.textContent = filled + ' из 3';
  const awaiting = !!pickedPhoto;   // фото выбрано → подсветить пустые ячейки
  document.querySelectorAll('#shelf .shelf__slot').forEach(s => {
    s.classList.toggle('pulse', awaiting && !s.querySelector('.shelf__photo'));
  });
}

function pickPhoto(img) {
  if (img.classList.contains('placed')) return;
  if (pickedPhoto === img) {
    img.classList.remove('picked');
    pickedPhoto = null;
    updateShelf();
    return;
  }
  document.querySelectorAll('.shelf__photo').forEach(p => p.classList.remove('picked'));
  img.classList.add('picked');
  pickedPhoto = img;
  updateShelf();
}

// поместить конкретное фото в полочку (общая логика для клика и drag'а)
function placeInSlot(photo, slot) {
  if (!photo || !slot || slot.querySelector('.shelf__photo')) return false;
  photo.classList.remove('picked');
  photo.classList.add('placed', 'dropping');
  slot.appendChild(photo);
  photo.addEventListener('animationend', () => photo.classList.remove('dropping'), { once: true });
  const filled = document.querySelectorAll('#shelf .shelf__slot .shelf__photo').length;
  if (filled === 3) document.querySelector('.shelf__next').classList.add('ready');
  return true;
}

// клик-фолбэк (тап по фото → тап по полочке)
function placePhoto(slot) {
  if (placeInSlot(pickedPhoto, slot)) { pickedPhoto = null; updateShelf(); }
}

// --- перетаскивание фото на полочку (drag-and-drop) ---
function initShelfDrag() {
  const shelf = document.getElementById('shelf');
  if (!shelf) return;
  let drag = null;

  const slots = () => [...shelf.querySelectorAll('.shelf__slot')];
  const slotUnder = (x, y) => slots().find(s => {
    const r = s.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
  const highlight = (x, y) => {
    const over = drag && drag.moved ? slotUnder(x, y) : null;
    slots().forEach(s => s.classList.toggle('over', s === over && !s.querySelector('.shelf__photo')));
  };
  const clearHi = () => slots().forEach(s => s.classList.remove('over'));
  const resetStyle = (p) => {
    p.classList.remove('dragging');
    p.style.cssText = p.style.cssText
      .replace(/(position|left|top|width|height|z-index|pointer-events|margin)\s*:[^;]*;?/g, '');
  };

  shelf.addEventListener('pointerdown', (e) => {
    const photo = e.target.closest('.shelf__photo');
    if (!photo || photo.classList.contains('placed') || photo.closest('.shelf__slot')) return;
    const r = photo.getBoundingClientRect();
    drag = {
      photo, moved: false,
      startX: e.clientX, startY: e.clientY,
      offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height,
      pid: e.pointerId,
    };
    try { photo.setPointerCapture(e.pointerId); } catch (_) {}
  });

  shelf.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = drag.photo;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;  // порог
      drag.moved = true;
      pickedPhoto = null;
      shelf.querySelectorAll('.shelf__photo.picked').forEach(x => x.classList.remove('picked'));
      p.classList.add('dragging');
      p.style.position = 'fixed';
      p.style.width = drag.w + 'px';
      p.style.height = drag.h + 'px';
      p.style.margin = '0';
      p.style.zIndex = '1000';
      updateShelf();                                   // подсветить пустые полочки
    }
    p.style.left = (e.clientX - drag.offX) + 'px';
    p.style.top = (e.clientY - drag.offY) + 'px';
    highlight(e.clientX, e.clientY);
  });

  const finish = (e) => {
    if (!drag) return;
    const p = drag.photo;
    try { p.releasePointerCapture(drag.pid); } catch (_) {}
    if (drag.moved) {
      const slot = slotUnder(e.clientX, e.clientY);
      clearHi();
      resetStyle(p);
      if (!placeInSlot(p, slot)) shelf.querySelector('.shelf__tray').appendChild(p);  // мимо → назад в трей
      updateShelf();
    }
    drag = null;
  };
  shelf.addEventListener('pointerup', finish);
  shelf.addEventListener('pointercancel', finish);
}
window.addEventListener('load', initShelfDrag);

// --- HERO: линии → тап → цветная акварель снизу вверх (линии тают во время покраски) ---

// вычерчивание SVG-линий (этап 1)
// opts.fit — preserveAspectRatio (по умолчанию cover); opts.byY — порядок штрихов по вертикали, а не по DOM
async function drawLinesInto(box, dur, stagger, opts = {}) {
  const txt = await fetch(box.dataset.svg).then(r => r.text());
  box.innerHTML = txt;
  const svg = box.querySelector('svg');
  if (svg) svg.setAttribute('preserveAspectRatio', opts.fit || 'xMidYMid slice');
  const paths = box.querySelectorAll('path');
  const n = paths.length;
  let order = (i) => i / n;
  if (opts.byY && svg) {
    const vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
    const y0 = vb[1], h = vb[3] || 1;
    order = (i, p) => {
      const m = /M\s*[-\d.]+[\s,]+([-\d.]+)/.exec(p.getAttribute('d') || '');
      return m ? Math.min(1, Math.max(0, (parseFloat(m[1]) - y0) / h)) : i / n;
    };
  }
  paths.forEach((p, i) => {
    const L = p.getTotalLength() || 1;
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = (order(i, p) * stagger).toFixed(3) + 's';
  });
  void box.offsetWidth;
  box.classList.add('draw');
  await new Promise(r => setTimeout(r, (dur + stagger) * 1000));
}

const SVGNS = 'http://www.w3.org/2000/svg';

// золотые блёстки-частицы + финальная вспышка (SVG SMIL), синхр. с фронтом краски
function buildHeroFX() {
  const fx = document.getElementById('hb-fx');
  if (!fx) return;
  fx.textContent = '';
  const N = 74;
  for (let i = 0; i < N; i++) {
    const big = i % 6 === 0;                             // каждая 6-я — крупная искра
    const sx = 30 + Math.random() * 1350;
    const sy = 752 - Math.random() * 90;                // старт у нижней кромки
    const rise = 190 + Math.random() * 460;
    const sway = (Math.random() * 2 - 1) * 90;
    const dur = (1.1 + Math.random() * 1.3).toFixed(2);
    const delay = (Math.random() * 2.0).toFixed(2);     // позже начатые — «едут» на фронте выше
    const rad = (big ? 5 + Math.random() * 4 : 2 + Math.random() * 3.4).toFixed(1);
    const begin = 'a-color.begin+' + delay + 's';

    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', rad);
    c.setAttribute('cx', '0'); c.setAttribute('cy', '0');
    c.setAttribute('fill', 'url(#wc-spark)');
    c.setAttribute('opacity', '0');

    const m = document.createElementNS(SVGNS, 'animateMotion');
    m.setAttribute('dur', dur + 's');
    m.setAttribute('begin', begin);
    m.setAttribute('fill', 'remove');
    m.setAttribute('calcMode', 'spline');
    m.setAttribute('keyPoints', '0;1');
    m.setAttribute('keyTimes', '0;1');
    m.setAttribute('keySplines', '0.2 0.6 0.3 1');
    m.setAttribute('path', `M ${sx.toFixed(0)} ${sy.toFixed(0)} q ${sway.toFixed(0)} ${(-rise * 0.5).toFixed(0)} ${(sway * 0.4).toFixed(0)} ${(-rise).toFixed(0)}`);

    const o = document.createElementNS(SVGNS, 'animate');
    o.setAttribute('attributeName', 'opacity');
    o.setAttribute('begin', begin);
    o.setAttribute('dur', dur + 's');
    o.setAttribute('fill', 'remove');
    o.setAttribute('values', '0;1;1;0');
    o.setAttribute('keyTimes', '0;0.18;0.5;1');

    c.appendChild(m); c.appendChild(o);
    fx.appendChild(c);
  }

  // тёплая вспышка-bloom у восхода (верх-право)
  const bloom = document.createElementNS(SVGNS, 'circle');
  bloom.setAttribute('cx', '1235'); bloom.setAttribute('cy', '250');
  bloom.setAttribute('r', '60'); bloom.setAttribute('fill', 'url(#wc-bloom)');
  bloom.setAttribute('opacity', '0');
  const br = document.createElementNS(SVGNS, 'animate');
  br.setAttribute('attributeName', 'r'); br.setAttribute('begin', 'a-color.begin+1.35s');
  br.setAttribute('dur', '1.8s'); br.setAttribute('values', '50;300;440');
  br.setAttribute('keyTimes', '0;0.55;1'); br.setAttribute('fill', 'remove');
  br.setAttribute('calcMode', 'spline'); br.setAttribute('keySplines', '0.2 0.7 0.3 1;0.4 0 0.6 1');
  const bo = document.createElementNS(SVGNS, 'animate');
  bo.setAttribute('attributeName', 'opacity'); bo.setAttribute('begin', 'a-color.begin+1.35s');
  bo.setAttribute('dur', '1.8s'); bo.setAttribute('values', '0;0.95;0'); bo.setAttribute('keyTimes', '0;0.3;1');
  bo.setAttribute('fill', 'remove');
  bloom.appendChild(br); bloom.appendChild(bo);
  fx.appendChild(bloom);
}

function initHeroLive() {
  const box = document.querySelector('.hero-live');
  if (!box) return;
  const lines = box.querySelector('.hero-live__lines');
  const hint = box.querySelector('.hero-live__hint');
  const openBtn = box.querySelector('.hero-live__open');
  const title = box.querySelector('.hero-title');
  let titleLetters = 0;
  if (title) {
    titleLetters = splitLetters(title.querySelector('.hero-title__hb'));
    titleLetters = splitLetters(title.querySelector('.hero-title__name'), titleLetters + 3); // пауза между строками
  }
  const aColor = document.getElementById('a-color');
  if (!aColor) return;

  let ready = false, busy = false, done = false, pendingTap = false;

  buildHeroFX(); // частицы должны существовать до старта, чтобы begin="a-color.begin" связался

  function finishColor() {
    if (done) return;
    done = true;
    lines.style.display = 'none';
    if (title) title.classList.add('show');                    // перо прописывает Happy Birthday → Nozanin
    const writeMs = titleLetters * 75 + 300;
    if (openBtn) setTimeout(() => openBtn.classList.add('show'), writeMs + 200);
  }

  // этап 2: цвет снизу вверх + блёстки + вспышка, линии растворяются вместе с покраской
  function startColor() {
    if (!ready || busy || done) return;
    busy = true;
    hint.classList.remove('show');
    lines.classList.add('fade');
    try { aColor.beginElement(); } catch (e) {}
    aColor.addEventListener('endEvent', finishColor, { once: true });
    setTimeout(finishColor, 4200); // страховка, если endEvent не придёт
  }

  function trigger() {
    if (done || busy) return;
    if (ready) startColor();
    else { pendingTap = true; hint.classList.remove('show'); } // тапнул раньше — запустим после ч/б
  }
  box.addEventListener('pointerdown', trigger);
  box._trigger = trigger;   // клавиатурный вызов (Enter/Space) из initA11y

  // подсказка появляется через ~1с после загрузки — не дожидаясь конца прорисовки
  setTimeout(() => { if (!done && !busy && !pendingTap) hint.classList.add('show'); }, 1000);

  // этап 1 (линии) → надпись → готово к тапу
  (async () => {
    await drawLinesInto(lines, 2.0, 1.0);
    ready = true;
    if (pendingTap) { startColor(); return; }
    if (!done && !busy) hint.classList.add('show');
  })();
}

window.addEventListener('load', () => initHeroLive());

// ---- доступность и управление (harden) ----
function polaroidStepById(id) { for (const k in QUIZ) if (QUIZ[k].polaroid === id) return +k; return 0; }
function hintStepById(id) { for (const k in QUIZ) if (QUIZ[k].hint === id) return +k; return 0; }

function initA11y() {
  // «кнопки-не-кнопки» — фокусируемы и озвучиваются
  document.querySelectorAll('.vibe__card, .shelf__slot, .shelf__photo, .hero-live').forEach(el => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });
  document.querySelectorAll('.vibe__card').forEach(c => {
    const t = c.querySelector('.vibe__card-label span');
    if (t) c.setAttribute('aria-label', 'Выбрать: ' + t.textContent.trim());
  });
  const hero = document.querySelector('.hero-live');
  if (hero) hero.setAttribute('aria-label', 'Нажми, чтобы оживить картинку');
  document.querySelectorAll('#shelf .shelf__slot').forEach((s, i) => s.setAttribute('aria-label', 'Полочка ' + (i + 1)));
  document.querySelectorAll('#shelf .shelf__photo').forEach((p, i) => p.setAttribute('aria-label', 'Фото ' + (i + 1)));

  // модалки → диалоги + кнопка «далее» в полароиды + автофокус + Escape-фокус
  document.querySelectorAll('.polaroid-overlay, .hint-overlay').forEach(o => {
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    new MutationObserver(() => {
      if (o.classList.contains('visible')) {
        const b = o.querySelector('button');
        if (b) setTimeout(() => { try { b.focus(); } catch (e) {} }, 80);
      }
    }).observe(o, { attributes: true, attributeFilter: ['class'] });
  });
  [1, 2, 3, 4, 5].forEach(step => {
    const o = document.getElementById(QUIZ[step].polaroid);
    if (!o) return;
    const card = o.querySelector('.polaroid');
    if (!card || card.querySelector('.polaroid__next')) return;
    const b = document.createElement('button');
    b.className = 'polaroid__next'; b.type = 'button'; b.textContent = 'далее →';
    b.addEventListener('click', e => { e.stopPropagation(); advancePolaroid(step); });
    card.appendChild(b);
  });

  // клавиатура: Enter/Space активируют role=button, Escape закрывает открытую модалку
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const pol = document.querySelector('.polaroid-overlay.visible');
      if (pol) { const s = polaroidStepById(pol.id); if (s) advancePolaroid(s); return; }
      const hn = document.querySelector('.hint-overlay.visible');
      if (hn) {
        if (hn.id === 'wishDoneOverlay') goFinal();
        else { const s = hintStepById(hn.id); if (s) closeHint(s); }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      const el = document.activeElement;
      if (el && el.tagName !== 'BUTTON' && el.tagName !== 'TEXTAREA' && el.getAttribute && el.getAttribute('role') === 'button') {
        e.preventDefault();
        if (el.classList.contains('hero-live') && el._trigger) el._trigger();
        else el.click();
      }
    }
  });
}

// --- живой огонёк в карточках-подсказках: оживляем ту же картинку (мерцание + искры) ---
function buildHintFlames() {
  document.querySelectorAll('.hint-frame > img.hint-flame').forEach(img => {
    if (img.closest('.fireimg')) return;
    const wrap = document.createElement('div');
    wrap.className = 'fireimg';
    img.classList.add('flame-img');
    img.replaceWith(wrap);          // ставим обёртку на место картинки
    wrap.appendChild(img);          // и возвращаем саму картинку внутрь
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('i');
      s.className = 'spark'; s.setAttribute('aria-hidden', 'true');
      wrap.appendChild(s);
    }
  });
}

window.addEventListener('load', initA11y);
window.addEventListener('load', initWishVideo);
window.addEventListener('load', buildHintFlames);

// --- звёздочки-искры, плавно отлетающие от кнопки при нажатии ---
const clickFx = (() => {
  let canvas, ctx, dpr = 1, W = 0, H = 0, particles = [], raf = 0;
  // золотые оттенки (без разноцветья)
  const STAR = ['#FFC61A', '#FFD84D', '#F5A623', '#FFCE3A', '#F7B733'];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = Math.floor(innerWidth * dpr);
    H = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  function init() {
    canvas = document.getElementById('fx-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }
  // точка на периметре кнопки (0..1 по обходу)
  function edgePoint(r, t) {
    const per = 2 * (r.width + r.height);
    let d = t * per;
    if (d < r.width) return { x: r.left + d, y: r.top };                       d -= r.width;
    if (d < r.height) return { x: r.left + r.width, y: r.top + d };            d -= r.height;
    if (d < r.width) return { x: r.left + r.width - d, y: r.top + r.height };  d -= r.width;
    return { x: r.left, y: r.top + r.height - d };
  }
  // 4-лучевая звезда-искра
  function star(x, y, rad, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * dpr;
    const inner = rad * 0.36;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? rad : inner;
      const a = (Math.PI / 4) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function burst(rect) {
    if (!ctx) return;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const N = 40;                                           // больше звёзд
    for (let i = 0; i < N; i++) {
      const p = edgePoint(rect, Math.random());
      let dx = p.x - cx, dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const sp = (0.25 + Math.random() * 0.85) * dpr;       // мягче — «плавно отлетают»
      particles.push({
        x: p.x * dpr, y: p.y * dpr,
        vx: dx * sp + (Math.random() - 0.5) * 0.3 * dpr,
        vy: dy * sp - (0.2 + Math.random() * 0.4) * dpr,    // лёгкий подъём
        r: (4.5 + Math.random() * 5) * dpr,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.1,
        life: 0, ttl: 95 + Math.random() * 60,              // дольше живут
        color: STAR[(Math.random() * STAR.length) | 0],
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    const g = 0.022 * dpr;                                  // почти невесомо
    particles = particles.filter(p => {
      p.life++;
      p.vx *= 0.968; p.vy = p.vy * 0.968 + g;               // мягкое торможение
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const t = p.life / p.ttl;                             // 0 → 1
      if (t >= 1) return false;
      const alpha = t < 0.2 ? t / 0.2 : (1 - (t - 0.2) / 0.8);  // мягче появление+затухание
      star(p.x, p.y, p.r * (0.7 + 0.3 * (1 - t)), p.rot, p.color, alpha);
      return true;
    });
    if (particles.length) raf = requestAnimationFrame(frame);
    else { raf = 0; ctx.clearRect(0, 0, W, H); }
  }
  return { init, burst };
})();

function initClickFx() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!clickFx.init()) return;
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('button');
    // основные кнопки; кроме hero-секции и вариантов ответа квиза
    if (!btn || btn.closest('#hero') || btn.classList.contains('quiz__option')) return;
    clickFx.burst(btn.getBoundingClientRect());
  }, { passive: true });
}
window.addEventListener('load', initClickFx);
