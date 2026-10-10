/* ==========================================================================
   Portfolio motion + interaction.
   Engine: GSAP 3.15 (ScrollTrigger, SplitText) + Lenis 1.3 smooth scrolling,
   loaded from jsDelivr in index.html. Every effect degrades gracefully:
   - prefers-reduced-motion → no intro, no Lenis, no tweens; content shown as-is.
   - CDN unavailable        → plain-JS fallback; nothing is hidden.
   ========================================================================== */

// Form delivery: Web3Forms (https://web3forms.com). It emails each submission to the inbox the
// access key was created for and answers with JSON, so the page only says "sent" when delivery is confirmed.
// The access key is public by design (it can only send to that inbox).
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
const FORM_ACCESS_KEY = '074b9548-23c2-43d9-ab7a-a7d9ce9338db';
const CONTACT_EMAIL = 'dkiplikurniawan@gmail.com';
const SUBMIT_TIMEOUT_MS = 15000;

const Motion = {
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  fine: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  get gsap() { return !!(window.gsap && window.ScrollTrigger); },
  get full() { return this.gsap && !this.reduced; },
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const headerOffset = () => ($('#navbar')?.offsetHeight || 80) + 12;
let lenis = null;
const onScroll = (fn) => { if (lenis) lenis.on('scroll', fn); else window.addEventListener('scroll', () => requestAnimationFrame(fn), { passive: true }); };

/* ======================================================================== scroll engine */
function initSmoothScroll() {
  if (!Motion.full || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!target) return;
    e.preventDefault();
    const focusTarget = () => { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); };
    revealWithin(target);
    // Lenis already applies the CSS scroll-padding-top (header height).
    if (lenis) lenis.scrollTo(target, { duration: 1.2, onComplete: focusTarget });
    else { window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerOffset(), behavior: Motion.reduced ? 'auto' : 'smooth' }); focusTarget(); }
    history.pushState(null, '', id);
  });
}

function revealWithin(root) {
  if (!Motion.gsap) return;
  $$('[data-fade], [data-split-lines] .split-line', root).forEach((el) => gsap.set(el, { clearProps: 'opacity,visibility,transform' }));
}

/* ======================================================================== header */
function initHeader() {
  const header = $('#navbar');
  const bar = $('.scroll-progress');
  let lastY = window.scrollY;
  const update = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
    header.classList.toggle('is-scrolled', y > 24);
    const menuOpen = $('#menu-toggle')?.getAttribute('aria-expanded') === 'true';
    const hide = Motion.full && y > 400 && y > lastY + 4 && !header.contains(document.activeElement) && !menuOpen;
    if (hide) header.classList.add('is-hidden'); else if (y < lastY - 4 || y < 400) header.classList.remove('is-hidden');
    lastY = y;
  };
  onScroll(update);
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();

  const links = $$('.nav-list a[href^="#"]');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const setActive = () => {
    const line = window.innerHeight * 0.35;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    links.forEach((a) => (current && a.getAttribute('href') === `#${current.id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  };
  onScroll(setActive);
  setActive();
}

function initMobileMenu() {
  const toggle = $('#menu-toggle');
  const menu = $('#mobile-menu');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (open && Motion.full) gsap.from($$('li', menu), { y: 14, opacity: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' });
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); } });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ======================================================================== intro (name drawn in outline) + hero */
function initIntro() {
  const curtain = $('.curtain');
  const showCurtain = Motion.full && curtain && getComputedStyle(curtain).display !== 'none';
  const hero = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });

  // Hero entrance
  const hello = $('[data-hero="hello"]');
  const split = window.SplitText ? SplitText.create(hello, { type: 'chars', aria: 'none' }) : null;
  gsap.set('[data-hero]', { opacity: 1 });
  hero.from(split ? split.chars : hello, { yPercent: 105, opacity: 0, rotate: 4, duration: 1.1, stagger: 0.05 }, 0)
    .fromTo('[data-hero="portrait"]', { clipPath: 'inset(100% 0% 0% 0% round 36px)' }, { clipPath: 'inset(0% 0% 0% 0% round 36px)', duration: 1.3, ease: 'expo.inOut' }, 0)
    .from('.portrait-media img', { scale: 1.3, duration: 1.6 }, 0.1)
    .from('[data-hero="badges"] li', { y: 14, opacity: 0, duration: 0.7, stagger: 0.06 }, 0.15)
    .from('[data-hero="eyebrow"], [data-hero="intro"], [data-hero="desc"]', { y: 24, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.25)
    .from('[data-hero="ctas"] > *', { y: 18, opacity: 0, duration: 0.7, stagger: 0.06 }, 0.45)
    .from('.portrait-tag', { y: 20, opacity: 0, duration: 0.7 }, 0.8)
    .from('[data-hero="cue"]', { opacity: 0, duration: 0.6 }, 0.8);

  gsap.to('.hero-copy-col', { yPercent: -18, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.portrait-media', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  if (!showCurtain) { curtain?.remove(); hero.play(); return; }

  // Intro: lens draws, name is traced in outline, fills grey then white, tagline underlines, curtain lifts.
  lenis?.stop();
  const words = $$('.intro-word', curtain);
  const done = () => {
    curtain.remove(); lenis?.start();
    try { sessionStorage.setItem('dk-intro-seen', '1'); } catch (e) {}
  };
  const intro = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: done });
  intro.to('.lens-ring', { strokeDashoffset: 0, duration: 0.8 })
    .to('.lens-dot', { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, '-=0.2')
    .to('.lens-dot', { x: -14, y: 6, duration: 0.5, ease: 'power3.inOut' })
    .to('.lens-dot', { x: 0, y: 0, duration: 0.45, ease: 'power3.inOut' })
    .to(words, { strokeDashoffset: 0, duration: 1.25, stagger: 0.15, ease: 'power1.inOut' }, 0.45)
    .to(words, { fill: '#3f3f46', duration: 0.35, stagger: 0.08 }, '-=0.15')
    .to(words, { fill: '#ffffff', strokeWidth: 0, duration: 0.45, stagger: 0.08 })
    .fromTo('.intro-tag span', { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' }, '-=0.5')
    .to('.intro-tag span', { '--uline': '100%', duration: 0.6 }, '-=0.3')
    .to('.intro-stage', { y: -40, opacity: 0, duration: 0.55, ease: 'power3.in' }, '+=0.25')
    .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=0.25')
    .add(() => hero.play(), '-=0.55');
  gsap.set(curtain, { clipPath: 'inset(0% 0% 0% 0%)' });
  gsap.set('.lens-dot', { scale: 0.2 });

  const skip = $('.intro-skip', curtain);
  skip.addEventListener('click', () => { intro.progress(1); hero.progress(0).play(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.body.contains(curtain)) { skip.click(); document.removeEventListener('keydown', esc); } });
}

/* ======================================================================== text + section reveals */
function initTextReveals() {
  $$('[data-split-lines]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 85%', once: true } }),
    });
  });

  // Statements: words brighten as you scroll. Start at 0.48 so unlit words still meet 3:1 (large text). Once lit, they stay lit.
  $$('[data-scrub-words]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', wordsClass: 'scrub-word', aria: 'none' });
    const tween = gsap.fromTo(split.words, { opacity: 0.48 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: true,
      onLeave: (self) => { self.kill(); tween.progress(1); } } });
  });

  gsap.set('[data-fade]', { opacity: 0, y: 40 });
  ScrollTrigger.batch('[data-fade]', {
    start: 'top 88%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
  ScrollTrigger.addEventListener('refresh', () => $$('[data-fade]').forEach((el) => { if (el.getBoundingClientRect().bottom < 0) gsap.set(el, { opacity: 1, y: 0 }); }));
}

/* ======================================================================== about photo (NY Phil-style editorial split) */
function initAboutPhoto() {
  const fig = $('[data-about-photo]');
  if (!fig) return;
  gsap.fromTo(fig, { clipPath: 'inset(18% 12% 18% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: fig, start: 'top 95%', end: 'top 20%', scrub: true } });
  gsap.fromTo('.about-photo-inner', { yPercent: -6, scale: 1.15 }, { yPercent: 6, scale: 1, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.about-overlay span', { yPercent: 100, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 55%', once: true } });
}

/* ======================================================================== DEAFSAPP pipeline (works without GSAP) */
function initPipeline() {
  const root = $('#pipeline');
  if (!root) return;
  const stages = $$('.stage', root);
  const list = $('.ds-steps', root);
  const slides = $$('.g-slide', root);
  const cur = $('.g-cur', root);
  const bar = $('.g-bar', root);
  root.setAttribute('data-ready', '');
  let shown = -1;
  const setSlide = (n) => {
    if (n === shown || !slides.length) return;
    shown = n;
    slides.forEach((s, i) => { s.classList.toggle('is-active', i === n); s.classList.toggle('is-past', i < n); });
    if (cur) cur.textContent = String(n + 1).padStart(2, '0');
    bar?.style.setProperty('--g', ((n + 1) / slides.length).toFixed(3));
  };
  const setStage = (k) => {
    if (String(k) === root.dataset.activeStage) return;
    root.dataset.activeStage = String(k);
    stages.forEach((s, i) => { s.classList.toggle('is-active', i + 1 === k); s.classList.toggle('is-done', i + 1 < k); });
  };
  const compute = () => {
    const mid = window.innerHeight * 0.55;
    let k = 1;
    stages.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) k = i + 1; });
    setStage(k);
    // Photos advance with reading progress through the steps (5 photos over 4 steps).
    if (list && slides.length) {
      const r = list.getBoundingClientRect();
      const p = clamp((mid - r.top) / r.height, 0, 0.999);
      setSlide(Math.floor(p * slides.length));
    }
  };
  onScroll(compute);
  stages.forEach((s, i) => s.addEventListener('focusin', () => setStage(i + 1)));
  compute();
}

/* ======================================================================== rolling number reels */
function initOdometers() {
  $$('.odo[data-count]').forEach((el, idx) => {
    const target = el.dataset.count;
    el.textContent = '';
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = target; el.appendChild(sr);
    const strips = [];
    [...target].forEach((ch) => {
      if (/\d/.test(ch)) {
        const reel = document.createElement('span');
        reel.className = 'odo-reel'; reel.setAttribute('aria-hidden', 'true');
        const strip = document.createElement('span');
        strip.className = 'odo-strip';
        for (let r = 0; r < 2; r++) for (let n = 0; n < 10; n++) { const d = document.createElement('span'); d.textContent = n; strip.appendChild(d); }
        reel.appendChild(strip); el.appendChild(reel);
        strips.push({ strip, digit: +ch });
      } else {
        const s = document.createElement('span'); s.className = 'odo-static'; s.textContent = ch; s.setAttribute('aria-hidden', 'true'); el.appendChild(s);
      }
    });
    // Each reel spins one full turn and lands on its digit (index 10 + digit of a 20-item strip).
    gsap.set(strips.map((s) => s.strip), { yPercent: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => strips.forEach((s, i) => gsap.to(s.strip, { yPercent: -((10 + s.digit) / 20) * 100, duration: 1.8 + i * 0.25, ease: 'power4.out', delay: idx * 0.08 })),
    });
  });
}

/* ======================================================================== VOLDO 3D phones */
function initPhones() {
  const stage = $('[data-phones]');
  if (!stage) return;
  const rig = $('.phone-rig', stage);
  const [left, center, right] = ['.phone-left', '.phone-center', '.phone-right'].map((s) => $(s, stage));
  const tl = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 90%', end: 'center 55%', scrub: 1 } });
  tl.fromTo(left, { xPercent: 70, y: 140, rotateY: 0, rotateZ: 0, scale: 0.86, opacity: 0 }, { xPercent: 0, y: 30, rotateY: 16, rotateZ: -2, scale: 1, opacity: 1, ease: 'power2.out' }, 0)
    .fromTo(right, { xPercent: -70, y: 140, rotateY: 0, rotateZ: 0, scale: 0.86, opacity: 0 }, { xPercent: 0, y: 30, rotateY: -16, rotateZ: 2, scale: 1, opacity: 1, ease: 'power2.out' }, 0)
    .fromTo(center, { y: 160, scale: 0.88, rotateX: 18 }, { y: -14, scale: 1.04, rotateX: 0, ease: 'power2.out' }, 0);
  gsap.fromTo(rig, { rotateX: 0 }, { rotateX: -6, ease: 'none', scrollTrigger: { trigger: stage, start: 'center 55%', end: 'bottom top', scrub: true } });
  $$('.phone-screen', stage).forEach((el, i) => gsap.to(el, { y: -8, duration: 3 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.6 }));
  if (Motion.fine) {
    const rx = gsap.quickTo(rig, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(rig, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 10);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
    });
    stage.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

/* ======================================================================== work list hover preview */
function initWorkPreview() {
  if (!Motion.fine) return;
  const box = $('.work-preview');
  const img = $('img', box);
  const xTo = gsap.quickTo(box, 'x', { duration: 0.5, ease: 'power3.out' });
  const yTo = gsap.quickTo(box, 'y', { duration: 0.5, ease: 'power3.out' });
  let current = null, px = -1, py = -1;
  const show = (row) => {
    if (current === row) return;
    current = row;
    img.src = row.dataset.preview;
    box.classList.toggle('is-chart', /\.svg$/.test(row.dataset.preview));
    gsap.to(box, { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out', overwrite: true });
  };
  const hide = () => { if (!current) return; current = null; gsap.to(box, { opacity: 0, scale: 0.85, duration: 0.25, overwrite: true }); };
  $$('.work-row[data-preview]').forEach((row) => {
    row.addEventListener('pointerenter', () => show(row));
    row.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; xTo(px + 24); yTo(py - 110); });
    row.addEventListener('pointerleave', hide);
  });
  // Scrolling moves rows under a still pointer without pointer events: re-check what is under it.
  onScroll(() => {
    if (!current) return;
    const under = px >= 0 ? document.elementFromPoint(px, py)?.closest('.work-row[data-preview]') : null;
    if (under) show(under); else hide();
  });
  window.addEventListener('blur', hide);
}

/* ======================================================================== timeline + footer */
function initTimeline() {
  const tl = $('.timeline');
  if (tl) ScrollTrigger.create({ trigger: tl, start: 'top 70%', end: 'bottom 60%', scrub: true, onUpdate: (self) => tl.style.setProperty('--tl', self.progress.toFixed(3)) });
  gsap.fromTo('.footer-wordmark', { xPercent: -6 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
}

function initMagnetic() {
  if (!Motion.fine) return;
  $$('[data-magnetic]').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo(clamp((e.clientX - (r.left + r.width / 2)) * 0.2, -6, 6));
      yTo(clamp((e.clientY - (r.top + r.height / 2)) * 0.2, -6, 6));
    });
    btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ======================================================================== skills tabs (ARIA) */
function initTabs() {
  $$('[data-tabs]').forEach((root) => {
    const list = $('[role="tablist"]', root);
    const tabs = $$('[role="tab"]', root);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    const indicator = $('.tab-indicator', root);
    list.hidden = false;
    root.classList.add('is-ready');
    const move = (tab) => { indicator.style.setProperty('--tw', `${tab.offsetWidth}px`); indicator.style.setProperty('--tx', `${tab.offsetLeft}px`); };
    const select = (i, focus) => {
      tabs.forEach((t, j) => { const on = i === j; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[j].hidden = !on; });
      move(tabs[i]);
      if (focus) tabs[i].focus();
      if (Motion.full) gsap.from($$('.skill-rows li', panels[i]), { y: 14, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'all' });
      if (Motion.gsap) ScrollTrigger.refresh();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, false));
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (k) { e.preventDefault(); select((i + k + tabs.length) % tabs.length, true); }
        if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    const initial = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    tabs.forEach((t, j) => { panels[j].hidden = j !== initial; });
    requestAnimationFrame(() => move(tabs[initial]));
    window.addEventListener('resize', () => move(tabs.find((t) => t.getAttribute('aria-selected') === 'true')), { passive: true });
    document.fonts?.ready.then(() => move(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));
  });
}

/* ======================================================================== contact form */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function setFieldError(input, message) {
  const err = document.getElementById(`${input.id}-error`);
  if (message) { input.setAttribute('aria-invalid', 'true'); if (err) { err.textContent = message; err.hidden = false; } }
  else { input.removeAttribute('aria-invalid'); if (err) { err.textContent = ''; err.hidden = true; } }
}
function validateForm(f) {
  const errors = [];
  const check = (input, ok, msg) => { setFieldError(input, ok ? '' : msg); if (!ok) errors.push(input); };
  check(f.name, f.name.value.trim().length >= 2, 'Enter your name.');
  check(f.email, EMAIL_RE.test(f.email.value.trim()), 'Enter a valid email address, for example name@example.com.');
  check(f.message, f.message.value.trim().length >= 10, 'Write a message of at least 10 characters.');
  return errors;
}
function composeLinks({ name, email, classification, message }) {
  const subject = `[${classification}] Message from ${name}`;
  const body = `Name: ${name}\nEmail: ${email}\nTopic: ${classification}\n\n${message}`;
  return {
    mailto: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text) node.textContent = text; // user input is never parsed as HTML
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}
function showStatus(state, nodes) { const box = $('#form-status'); box.dataset.state = state; box.replaceChildren(...nodes); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Returns { ok, info }. ok is true only when Web3Forms confirms the email was accepted. */
async function sendMessage(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: FORM_ACCESS_KEY,
        subject: `[Portfolio] ${payload.classification} — ${payload.name}`,
        from_name: 'Portfolio contact form',
        replyto: payload.email,
        name: payload.name,
        email: payload.email,
        topic: payload.classification,
        message: payload.message,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && (data.success === true || String(data.success) === 'true');
    if (!ok) console.info('[portfolio] form service replied:', data.message || res.status);
    return { ok, info: data.message || '' };
  } catch (err) {
    console.info('[portfolio] form service unreachable:', String(err));
    return { ok: false, info: String(err) };
  } finally { clearTimeout(timer); }
}

function initContactForm() {
  const form = $('#inquiry-form');
  if (!form) return;
  const f = { name: $('#inquiry-name'), email: $('#inquiry-email'), classification: $('#inquiry-classification'), message: $('#inquiry-message'), honeypot: $('#inquiry-website') };
  const button = $('#inquiry-submit-btn');
  const label = $('.send-label', button);
  const panel = $('#sent-panel');
  [f.name, f.email, f.message].forEach((input) => input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) validateForm(f); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.dataset.state === 'sending') return;
    const errors = validateForm(f);
    if (errors.length) { errors[0].focus(); button.dataset.state = 'error'; setTimeout(() => (button.dataset.state = 'idle'), 450); return; }
    if (f.honeypot.value) return;
    const payload = { name: f.name.value.trim(), email: f.email.value.trim(), classification: f.classification.value, message: f.message.value.trim() };

    button.dataset.state = 'sending';
    button.setAttribute('aria-busy', 'true');
    label.textContent = 'Sending';
    showStatus('pending', [el('span', 'Sending your message…')]);
    const [{ ok }] = await Promise.all([sendMessage(payload), wait(Motion.reduced ? 0 : 1100)]); // let the flight animation play

    button.removeAttribute('aria-busy');
    if (ok) {
      button.dataset.state = 'sent';
      label.textContent = 'Sent';
      showStatus('success', [el('strong', 'Message sent.')]);
      await wait(Motion.reduced ? 0 : 900);
      $('#sent-text').textContent = `Thank you, ${payload.name}. I'll reply to ${payload.email} within a few days.`;
      form.hidden = true;
      panel.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-in')));
      panel.focus({ preventScroll: true });
      form.reset();
      $('#form-status').replaceChildren();
    } else {
      button.dataset.state = 'error';
      label.textContent = 'Send message';
      setTimeout(() => (button.dataset.state = 'idle'), 450);
      const links = composeLinks(payload);
      showStatus('error', [
        el('strong', "The message couldn't be delivered."),
        document.createTextNode(' Check your connection and try again, or send it by email: '),
        el('a', 'open in your email app', { href: links.mailto }),
        document.createTextNode(' or '),
        el('a', 'open in Gmail', { href: links.gmail, target: '_blank', rel: 'noopener' }),
        document.createTextNode(`, or write to ${CONTACT_EMAIL}.`),
      ]);
    }
  });

  $('#send-another')?.addEventListener('click', () => {
    panel.classList.remove('is-in');
    panel.hidden = true;
    form.hidden = false;
    button.dataset.state = 'idle';
    label.textContent = 'Send message';
    f.name.focus();
  });
}

/* ======================================================================== boot */
function run(fns) {
  for (const fn of fns) {
    try { fn(); } catch (err) {
      console.warn(`[portfolio] ${fn.name} failed:`, err);
      document.documentElement.classList.add('no-motion');
      if (Motion.gsap) gsap.set('[data-hero], [data-fade], .scrub-word, .split-line, .phone', { clearProps: 'all' });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.__motionReady = true;
  run([initMobileMenu, initTabs, initContactForm]);

  if (!Motion.full) {
    document.documentElement.classList.add('no-motion');
    $('.curtain')?.remove();
    run([initAnchors, initHeader, initPipeline]);
    return;
  }

  gsap.registerPlugin(ScrollTrigger, ...(window.SplitText ? [SplitText] : []));
  run([initSmoothScroll, initAnchors, initHeader, initPipeline]);
  const animate = () => {
    run([initIntro, initTextReveals, initAboutPhoto, initOdometers, initPhones, initWorkPreview, initTimeline, initMagnetic]);
    if (location.hash) { const t = $(location.hash); if (t) { revealWithin(t); requestAnimationFrame(() => (lenis ? lenis.scrollTo(t, { immediate: true }) : t.scrollIntoView())); } }
    window.addEventListener('load', () => ScrollTrigger.refresh());
  };
  // Fonts first: line breaks and the outlined name depend on them. Never wait more than 1.5 s.
  let started = false;
  const start = () => { if (!started) { started = true; animate(); } };
  Promise.all([document.fonts?.ready, document.fonts?.load?.('400 100px Anton')].filter(Boolean)).then(start, start);
  setTimeout(start, 1500);
});
