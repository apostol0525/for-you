// --- мини-роутер экранов ---
let current = document.getElementById('hero');
let busy = false;

function go(id) {
  const next = document.getElementById(id);
  if (busy || !next || next === current) return;
  busy = true;

  const prev = current;
  current = next;

  prev.classList.remove('active');
  prev.classList.add('leaving');

  next.classList.add('active', 'entering');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.classList.add('go');
  }));

  if (id === 'birthday') animateCards();
  if (id === 'final') setTimeout(animateFinalHandwriting, 700);

  setTimeout(() => {
    prev.classList.remove('leaving');
    next.classList.remove('entering', 'go');
    next.scrollTop = 0;
    busy = false;
  }, 1200);
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
  document.getElementById(QUIZ[step].hint).classList.add('visible');
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
  document.getElementById(QUIZ[step].polaroid).classList.add('visible');
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
  document.getElementById('wishDoneOverlay').classList.add('visible');
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

// --- 3D-параллакс hero ---
const heroEl = document.getElementById('hero');
const scene = document.querySelector('.scene');

const PERSPECTIVE = 1400;
const MAX_TILT = 11;

const LAYERS = [
  { el: document.querySelector('.far'), z: 0, shift: 0.007 },
  { el: document.querySelector('.clouds'), z: 140, shift: 0.022 },
  { el: document.querySelector('.near'), z: 250, shift: 0.04 },
];

let tiltX = 0, tiltY = 0;
let curX = 0, curY = 0;
let running = false;

function render() {
  curX += (tiltX - curX) * 0.09;
  curY += (tiltY - curY) * 0.09;

  scene.style.transform =
    `rotateX(${(-curY * MAX_TILT).toFixed(3)}deg) rotateY(${(curX * MAX_TILT).toFixed(3)}deg)`;

  const w = heroEl.clientWidth, h = heroEl.clientHeight;

  for (const l of LAYERS) {
    const k = (PERSPECTIVE - l.z) / PERSPECTIVE;
    const dx = -curX * w * l.shift;
    const dy = -curY * h * l.shift;
    l.el.style.transform =
      `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, ${l.z}px) scale(${k})`;
  }

  if (Math.abs(tiltX - curX) > 0.0005 || Math.abs(tiltY - curY) > 0.0005) {
    requestAnimationFrame(render);
  } else {
    running = false;
  }
}

function kick() {
  if (!running) { running = true; requestAnimationFrame(render); }
}

window.addEventListener('mousemove', (e) => {
  tiltX = (e.clientX / window.innerWidth) * 2 - 1;
  tiltY = (e.clientY / window.innerHeight) * 2 - 1;
  kick();
});

document.addEventListener('mouseleave', () => { tiltX = 0; tiltY = 0; kick(); });

function onOrient(e) {
  if (e.gamma == null || e.beta == null) return;
  // выше чувствительность: полный наклон уже при ~16° поворота телефона
  tiltX = Math.max(-1, Math.min(1, e.gamma / 16));
  tiltY = Math.max(-1, Math.min(1, (e.beta - 45) / 16));
  kick();
}

if (typeof DeviceOrientationEvent !== 'undefined' &&
  typeof DeviceOrientationEvent.requestPermission === 'function') {
  const ask = () => {
    DeviceOrientationEvent.requestPermission()
      .then(state => { if (state === 'granted') window.addEventListener('deviceorientation', onOrient); })
      .catch(() => { });
    window.removeEventListener('touchend', ask);
    window.removeEventListener('click', ask);
  };
  window.addEventListener('touchend', ask);
  window.addEventListener('click', ask);
} else {
  window.addEventListener('deviceorientation', onOrient);
}

window.addEventListener('resize', kick);

render();
