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

// --- HERO: 3 этапа — линии → ч/б проявление → цвет (акварельное растекание) ---

// вычерчивание SVG-линий (этап 1)
async function drawLinesInto(box, dur, stagger) {
  const txt = await fetch(box.dataset.svg).then(r => r.text());
  box.innerHTML = txt;
  const svg = box.querySelector('svg');
  if (svg) svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); // как object-fit: cover
  const paths = box.querySelectorAll('path');
  const n = paths.length;
  paths.forEach((p, i) => {
    const L = p.getTotalLength() || 1;
    p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = (i / n * stagger).toFixed(3) + 's';
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
  const aBW = document.getElementById('a-bw');
  const aColor = document.getElementById('a-color');
  if (!aBW || !aColor) return;

  let ready = false, busy = false, done = false, pendingTap = false;

  buildHeroFX(); // частицы должны существовать до старта, чтобы begin="a-color.begin" связался

  function finishColor() {
    if (done) return;
    done = true;
    lines.style.transition = 'opacity .8s ease';
    lines.style.opacity = '0';
    setTimeout(() => { lines.style.display = 'none'; }, 820);
    if (openBtn) setTimeout(() => openBtn.classList.add('show'), 300);
  }

  // этап 3: цвет снизу вверх + блёстки + вспышка
  function startColor() {
    if (!ready || busy || done) return;
    busy = true;
    hint.classList.remove('show');
    try { aColor.beginElement(); } catch (e) {}
    aColor.addEventListener('endEvent', finishColor, { once: true });
    setTimeout(finishColor, 4200); // страховка, если endEvent не придёт
  }

  box.addEventListener('pointerdown', () => {
    if (done || busy) return;
    if (ready) startColor();
    else { pendingTap = true; hint.classList.remove('show'); } // тапнул раньше — запустим после ч/б
  });

  // надпись — почти сразу
  setTimeout(() => { if (!busy && !done) hint.classList.add('show'); }, 500);

  // этап 1 (линии) → этап 2 (ч/б проявляется пятнами) → готово к тапу
  (async () => {
    await drawLinesInto(lines, 2.0, 1.0);
    try { aBW.beginElement(); } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
    ready = true;
    if (pendingTap) startColor();
  })();
}

window.addEventListener('load', () => initHeroLive());
