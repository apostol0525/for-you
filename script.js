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

  prev.classList.remove('active');
  prev.classList.add('leaving');

  next.classList.add('active', 'entering');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.classList.add('go');
  }));

  if (id === 'birthday') playBirthday();
  if (id === 'final') setTimeout(animateFinalHandwriting, 700);

  setTimeout(() => {
    prev.classList.remove('leaving');
    next.classList.remove('entering', 'go');
    next.scrollTop = 0;
    busy = false;
  }, 1200);
}

// --- фон-прорисовка секции «С днём рождения» (инлайн SVG + вычерчивание) ---
let birthdayBgLoaded = false;
async function drawBirthdayBg() {
  const box = document.querySelector('.birthday__bg');
  if (!box) return;
  if (!birthdayBgLoaded) {
    try {
      const txt = await fetch(box.dataset.svg).then(r => r.text());
      box.innerHTML = txt;
      // каждому пути — пунктир длиной в сам путь + лёгкий сдвиг старта (эффект руки)
      const paths = box.querySelectorAll('path');
      const n = paths.length;
      paths.forEach((p, i) => {
        const L = p.getTotalLength() || 1;
        p.style.strokeDasharray = L;
        p.style.strokeDashoffset = L;
        p.style.animationDelay = (i / n * 2.4).toFixed(3) + 's';
      });
      birthdayBgLoaded = true;
    } catch (e) { return; }
  }
  // перезапуск: вернуть штрихи в скрытое состояние
  box.classList.remove('draw');
  box.querySelectorAll('path').forEach(p => {
    p.style.strokeDashoffset = p.style.strokeDasharray;
  });
  void box.offsetWidth; // рефлоу
  box.classList.add('draw');
}

// разбить подзаголовок на буквы (для побуквенной прорисовки)
let subtitleSplit = false;
function splitSubtitle() {
  const el = document.querySelector('.birthday__subtitle');
  if (!el || subtitleSplit) return;
  let i = 0, html = '';
  el.textContent.split(/(\s+)/).forEach(token => {
    if (token === '') return;
    if (/^\s+$/.test(token)) { html += ' '; return; }
    html += '<span class="w">' +
      [...token].map(ch => `<span class="ch" style="--i:${i++}">${ch}</span>`).join('') +
      '</span>';
  });
  el.innerHTML = html;
  subtitleSplit = true;
}

// оркестратор появления секции «С днём рождения»
function playBirthday() {
  const sec = document.getElementById('birthday');
  splitSubtitle();
  drawBirthdayBg();                 // фон рисуется
  gsap.set([cardLeft, cardRight], { yPercent: 60, opacity: 0, scale: 0.85 }); // фото скрыты
  sec.classList.remove('play');
  void sec.offsetWidth;
  sec.classList.add('play');        // заголовок → подзаголовок(буквы) → кнопка (через CSS-задержки)
  clearTimeout(playBirthday._t);
  playBirthday._t = setTimeout(animateCards, 4300); // фото всплывают после текста
}

// --- GSAP: анимация карточек ---
const cardLeft = document.querySelector('.birthday__photo--left');
const cardRight = document.querySelector('.birthday__photo--right');

gsap.set(cardLeft, { yPercent: 60, rotate: -20, opacity: 0, scale: 0.85 });
gsap.set(cardRight, { yPercent: 60, rotate: 20, opacity: 0, scale: 0.85 });

function animateCards() {
  gsap.to(cardLeft, {
    yPercent: 0, rotate: -6, opacity: 1, scale: 1,
    duration: 0.9, ease: 'back.out(1.4)', delay: 0.3,
  });
  gsap.to(cardRight, {
    yPercent: 0, rotate: 5, opacity: 1, scale: 1,
    duration: 0.9, ease: 'back.out(1.4)', delay: 0.45,
  });
}

// --- выбор vibe-карточки ---
function pickVibe(card) {
  document.querySelectorAll('.vibe__card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  setTimeout(() => go('quiz'), 600);
}

// --- выбор quiz-варианта (в рамках своей секции) ---
function pickQuiz(btn) {
  const section = btn.closest('.screen');
  section.querySelectorAll('.quiz__option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  section.querySelector('.quiz__next').disabled = false;
}

// --- конфигурация шагов квеста ---
const QUIZ = {
  1: { section: 'quiz',  hint: 'hintOverlay',  polaroid: 'polaroidOverlay',  next: 'quiz2' },
  2: { section: 'quiz2', hint: 'hintOverlay2', polaroid: 'polaroidOverlay2', next: 'quiz3' },
  3: { section: 'quiz3', hint: 'hintOverlay3', polaroid: 'polaroidOverlay3', next: 'shelf' },
  4: { section: 'quiz4', hint: 'hintOverlay4', polaroid: 'polaroidOverlay4', next: 'quiz5' },
  5: { section: 'quiz5', hint: 'hintOverlay5', polaroid: 'polaroidOverlay5', next: 'result' },
};

// --- проверка ответа ---
function checkQuiz(step) {
  const selected = document.querySelector('#' + QUIZ[step].section + ' .quiz__option.selected');
  if (!selected) return;
  if (selected.hasAttribute('data-correct')) showPolaroid(step);
  else showHint(step);
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

// --- финал: загадай желание (текст остаётся только на устройстве) ---
function sendWish() {
  const input = document.querySelector('#result .wish__input');
  const text = input ? input.value.trim() : '';
  try { if (text) localStorage.setItem('nozanin_wish', text); } catch (e) {}
  finishWish();
}

function skipWish() { finishWish(); }

function finishWish() {
  const el = document.getElementById('wishDoneOverlay');
  revealImgs(el);
  el.classList.add('visible');
}

function goFinal() {
  document.getElementById('wishDoneOverlay').classList.remove('visible');
  setTimeout(() => go('final'), 300);
}

function finishQuest() {
  go('hero');
}

function restartQuest() {
  document.querySelectorAll('.quiz__option.selected, .vibe__card.selected')
    .forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.quiz__next').forEach(b => b.disabled = true);
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
}

// --- отвлекалочка: разложи фото по полочкам ---
let pickedPhoto = null;

function pickPhoto(img) {
  if (img.classList.contains('placed')) return;
  if (pickedPhoto === img) {
    img.classList.remove('picked');
    pickedPhoto = null;
    return;
  }
  document.querySelectorAll('.shelf__photo').forEach(p => p.classList.remove('picked'));
  img.classList.add('picked');
  pickedPhoto = img;
}

function placePhoto(slot) {
  if (!pickedPhoto || slot.querySelector('.shelf__photo')) return;
  const photo = pickedPhoto;
  photo.classList.remove('picked');
  photo.classList.add('placed', 'dropping');
  slot.appendChild(photo);
  photo.addEventListener('animationend', () => photo.classList.remove('dropping'), { once: true });
  pickedPhoto = null;

  const filled = document.querySelectorAll('#shelf .shelf__slot .shelf__photo').length;
  if (filled === 3) {
    document.querySelector('.shelf__next').classList.add('ready');
  }
}

// --- HERO прототип: прорисовка линий → раскраска пальцем (scratch) ---
async function drawLinesInto(box, dur, stagger) {
  const txt = await fetch(box.dataset.svg).then(r => r.text());
  box.innerHTML = txt;
  const paths = box.querySelectorAll('path');
  const n = paths.length;
  paths.forEach((p, i) => {
    const L = p.getTotalLength() || 1;
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    p.style.animationDelay = (i / n * stagger).toFixed(3) + 's';
  });
  void box.offsetWidth;
  box.classList.add('draw');
  await new Promise(r => setTimeout(r, (dur + stagger) * 1000));
}

function initHeroLive() {
  const box = document.querySelector('.hero-live');
  if (!box) return;
  const lines = box.querySelector('.hero-live__lines');
  const canvas = box.querySelector('.hero-live__cover');
  const hint = box.querySelector('.hero-live__hint');
  const ctx = canvas.getContext('2d');
  const PAPER = '#DDCEC7';
  let cssW = 0, cssH = 0;
  let sketch = null;                 // офскрин: бумага + впитанные линии
  let ready = false, busy = false, done = false;

  const r = box.getBoundingClientRect();
  cssW = r.width; cssH = r.height;
  canvas.width = cssW; canvas.height = cssH;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, cssW, cssH);    // бумага поверх цвета

  // фаза 1: линии рисуются (SVG) → фаза 2: «впитываем» их в скетч-канвас
  drawLinesInto(lines, 4, 2).then(() => rasterizeSketch()).then(() => {
    ready = true;
    hint.classList.add('show');
  });

  function rasterizeSketch() {
    return new Promise(res => {
      const svg = lines.querySelector('svg');
      if (!svg) { res(); return; }
      // гарантируем финальное состояние линий (для корректного снимка)
      svg.querySelectorAll('path').forEach(p => { p.style.animation = 'none'; p.style.strokeDashoffset = '0'; });
      const vb = (svg.getAttribute('viewBox') || '0 0 1920 1079').split(/\s+/).map(Number);
      const vbW = vb[2], vbH = vb[3];
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => {
        sketch = document.createElement('canvas');
        sketch.width = cssW; sketch.height = cssH;
        const sx = sketch.getContext('2d');
        sx.fillStyle = PAPER; sx.fillRect(0, 0, cssW, cssH);
        const scale = Math.max(cssW / vbW, cssH / vbH);   // cover
        const dw = vbW * scale, dh = vbH * scale;
        sx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
        lines.style.display = 'none';
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(sketch, 0, 0);
        res();
      };
      img.onerror = () => res();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  // одно касание → мягкая волна закрашивания от точки, линии впитываются
  function bloom(x, y) {
    if (!ready || busy || done) return;
    busy = true;
    hint.classList.remove('show');
    const maxR = Math.hypot(Math.max(x, cssW - x), Math.max(y, cssH - y)) + 40;
    const soft = Math.min(cssW, cssH) * 0.42;   // мягкая растекающаяся кромка
    const dur = 2400, t0 = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOut
      const R = e * maxR;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(sketch, 0, 0);              // заново скетч
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, Math.max(0, R - soft), x, y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      if (p < 1) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, cssW, cssH); done = true; busy = false; } // полный цвет
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', e => {
    const b = canvas.getBoundingClientRect();
    bloom(e.clientX - b.left, e.clientY - b.top);
  });
}

window.addEventListener('load', () => initHeroLive());
