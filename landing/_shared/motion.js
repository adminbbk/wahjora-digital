/* Wahjora motion engine — shared by the 3D landing pages.
   Depth-map 2.5D heroes (WebGL), scroll-scrubbed film frames, floating flip cards,
   parallax layers, pinned horizontal galleries, split-text reveals.
   Needs GSAP + ScrollTrigger (+ optional Lenis) loaded first. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const W = {};
  window.WJ = W;

  /* ---------- smooth scroll ---------- */
  W.smooth = function () {
    if (reduce || !window.Lenis) return null;
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -10 }); }
    }));
    return lenis;
  };

  /* ---------- pointer (normalised -1..1, eased) ---------- */
  const P = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { P.tx = e.clientX / innerWidth * 2 - 1; P.ty = e.clientY / innerHeight * 2 - 1; });
  if (window.DeviceOrientationEvent && touch) addEventListener('deviceorientation', e => {
    if (e.gamma == null) return; P.tx = Math.max(-1, Math.min(1, e.gamma / 25)); P.ty = Math.max(-1, Math.min(1, (e.beta - 40) / 25));
  });
  W.pointer = P;

  /* ---------- hero photo parallax: the whole photo moves as one rigid layer, so the product never warps ---------- */
  W.depthHero = function (canvas, { img, cx = 0.5 } = {}) {
    const wrap = document.createElement('div'); wrap.className = 'hero-ph';
    const im = new Image(); im.src = img; im.alt = canvas.getAttribute('aria-label') || ''; im.decoding = 'async';
    im.style.objectPosition = (cx * 100) + '% 50%';
    wrap.appendChild(im); canvas.replaceWith(wrap);
    const on = () => wrap.classList.add('on'); im.complete ? on() : im.addEventListener('load', on);
    if (reduce) return;
    let sp = 0, vis = true, last = '';
    ScrollTrigger.create({ trigger: wrap.closest('section') || wrap, start: 'top top', end: 'bottom top', onUpdate: s => sp = s.progress });
    new IntersectionObserver(e => vis = e[0].isIntersecting).observe(wrap);
    (function loop() {
      requestAnimationFrame(loop);
      if (!vis) return;
      P.x += (P.tx - P.x) * 0.06; P.y += (P.ty - P.y) * 0.06;
      const x = (-P.x * 14).toFixed(1), y = (-P.y * 10 + sp * 90).toFixed(1), sc = (1.06 + sp * 0.06).toFixed(4);
      const k = x + y + sc; if (k === last) return; last = k;
      im.style.transform = `translate3d(${x}px,${y}px,0) scale(${sc})`;
    })();
  };

  /* ---------- scroll-scrubbed film frames on canvas ---------- */
  W.frameScrub = function (section, { dir, count, ext = 'webp', pad = 3, fit = 'cover', onProgress } = {}) {
    const canvas = section.querySelector('canvas.scrub');
    const ctx = canvas.getContext('2d');
    const frames = new Array(count); let cur = -1, want = 0;
    const src = i => `${dir}f${String(i + 1).padStart(pad, '0')}.${ext}`;
    const draw = i => {
      let k = i; while (k >= 0 && !(frames[k] && frames[k].complete && frames[k].naturalWidth)) k--;
      if (k < 0) return; const im = frames[k];
      const cw = canvas.width, ch = canvas.height, ir = im.naturalWidth / im.naturalHeight, cr = cw / ch;
      let w, h; if ((fit === 'cover') === (cr > ir)) { w = cw; h = cw / ir; } else { h = ch; w = ch * ir; }
      ctx.clearRect(0, 0, cw, ch); ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h); cur = i;
    };
    const resize = () => { const r = Math.min(devicePixelRatio, 2); canvas.width = canvas.clientWidth * r; canvas.height = canvas.clientHeight * r; draw(Math.max(want, 0)); };
    // load key frames first so scrubbing is usable immediately, then fill gaps
    const order = []; for (let step = 16; step >= 1; step = step >> 1) for (let i = 0; i < count; i += step) if (!order.includes(i)) order.push(i);
    let loaded = 0;
    const get = (i, n) => setTimeout(() => { if (frames[i]) return; const im = new Image(); im.decoding = 'async'; im.onload = () => { loaded++; if (i === 0 || i === want) draw(want); }; im.src = src(i); frames[i] = im; }, n < 12 ? 0 : 20 + n * 8);
    // first frame decides: if the film exists, fetch the rest once it is within a screen; if not, show the poster and stop
    const f0 = new Image(); frames[0] = f0;
    f0.onload = () => { loaded++; draw(want);
      const near = new IntersectionObserver(es => { if (es[0].isIntersecting) { near.disconnect(); order.forEach(get); } }, { rootMargin: '100% 0px' });
      near.observe(section); };
    f0.onerror = () => section.classList.add('noframes');
    f0.src = src(0);
    resize(); addEventListener('resize', resize);
    const chapters = [...section.querySelectorAll('[data-at]')].map(el => { const [a, b] = el.dataset.at.split('-').map(Number); return { el, a, b }; });
    ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: s => {
        want = Math.min(count - 1, Math.round(s.progress * (count - 1)));
        if (want !== cur) requestAnimationFrame(() => draw(want));
        chapters.forEach(c => c.el.classList.toggle('in', s.progress >= c.a && s.progress < c.b));
        section.style.setProperty('--p', s.progress.toFixed(4));
        onProgress && onProgress(s.progress);
      }
    });
    chapters.forEach(c => c.el.classList.toggle('in', c.a === 0));
  };

  /* ---------- parallax layers: data-speed (-1..1), data-rot ---------- */
  W.parallax = function (root = document) {
    if (reduce) return;
    root.querySelectorAll('[data-speed]').forEach(el => {
      const sp = parseFloat(el.dataset.speed), rot = parseFloat(el.dataset.rot || 0);
      gsap.fromTo(el, { yPercent: -sp * 50, rotate: -rot }, { yPercent: sp * 50, rotate: rot, ease: 'none',
        scrollTrigger: { trigger: el.closest('[data-pscope]') || el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  };

  /* ---------- floating flip cards ---------- */
  W.flipCards = function (root = document) {
    root.querySelectorAll('.flip').forEach((card, i) => {
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.setAttribute('aria-pressed', 'false');
      const toggle = () => { const on = card.classList.toggle('flipped'); card.setAttribute('aria-pressed', on); };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      if (!reduce) {
        card.style.setProperty('--d', (i * -1.3) + 's');
        if (!touch) {
          card.addEventListener('pointermove', e => { const r = card.getBoundingClientRect();
            card.style.setProperty('--rx', ((e.clientY - r.top) / r.height - .5) * -14 + 'deg');
            card.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 14 + 'deg');
            card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%'); card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%'); });
          card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
        }
      }
    });
    if (!reduce) gsap.utils.toArray(root.querySelectorAll('.flip-deck')).forEach(deck => {
      gsap.from(deck.querySelectorAll('.flip'), { y: 120, rotateZ: i => (i % 2 ? 8 : -8), opacity: 0, stagger: .12, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: deck, start: 'top 80%' } });
    });
  };

  /* ---------- pinned horizontal gallery ---------- */
  W.hGallery = function (section) {
    const track = section.querySelector('.h-track');
    if (reduce || innerWidth < 760) { section.classList.add('h-static'); return; }
    const dist = () => track.scrollWidth - innerWidth;
    gsap.to(track, { x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true } });
    track.querySelectorAll('.h-img img').forEach(img => gsap.fromTo(img, { xPercent: -12 }, { xPercent: 12, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), scrub: true } }));
  };

  /* ---------- split-text reveal ---------- */
  W.splitReveal = function (root = document) {
    root.querySelectorAll('[data-split]').forEach(el => {
      const words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent.trim());
      el.innerHTML = words.map(w => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(' ');
      if (reduce) return;
      gsap.from(el.querySelectorAll('.w>span'), { yPercent: 110, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: .06,
        scrollTrigger: { trigger: el, start: 'top 85%' } });
    });
  };

  /* ---------- clip-path image reveal + zoom-through ---------- */
  W.reveals = function (root = document) {
    if (reduce) return;
    root.querySelectorAll('[data-reveal]').forEach(el => gsap.fromTo(el, { clipPath: 'inset(18% 12% 18% 12% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 25%', scrub: true } }));
    root.querySelectorAll('[data-zoom]').forEach(sec => {
      const img = sec.querySelector('img');
      gsap.fromTo(img, { scale: 1 }, { scale: parseFloat(sec.dataset.zoom) || 1.8, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true } });
    });
  };

  /* ---------- floating particles canvas (motes, bubbles, sand) ---------- */
  W.particles = function (canvas, { n = 70, color = '255,200,120', rise = -0.25, size = [0.6, 2.4], drift = 0.3, shape = 'dot' } = {}) {
    if (reduce) return;
    const c = canvas.getContext('2d'); let w, h; const ps = [];
    const rs = () => { w = canvas.width = canvas.clientWidth; h = canvas.height = canvas.clientHeight; };
    rs(); addEventListener('resize', rs);
    for (let i = 0; i < n; i++) ps.push({ x: Math.random(), y: Math.random(), r: size[0] + Math.random() * (size[1] - size[0]), s: .3 + Math.random(), o: Math.random() * 6.28 });
    let vis = true; new IntersectionObserver(e => vis = e[0].isIntersecting).observe(canvas);
    (function f(t) { requestAnimationFrame(f); if (!vis) return; c.clearRect(0, 0, w, h);
      ps.forEach(p => { p.y += rise * p.s / h * 2; p.x += Math.sin(t / 1400 + p.o) * drift / w + P.x * .0004 * p.s;
        if (p.y < -.02) p.y = 1.02; if (p.y > 1.02) p.y = -.02; if (p.x < -.02) p.x = 1.02; if (p.x > 1.02) p.x = -.02;
        const a = .25 + .55 * Math.abs(Math.sin(t / 900 + p.o));
        c.beginPath(); c.arc(p.x * w, p.y * h, p.r, 0, 6.283);
        if (shape === 'ring') { c.strokeStyle = `rgba(${color},${a})`; c.lineWidth = .8; c.stroke(); }
        else { c.fillStyle = `rgba(${color},${a})`; c.fill(); } });
    })(0);
  };

  /* ---------- magnetic buttons ---------- */
  W.magnetic = function () {
    if (touch || reduce) return;
    document.querySelectorAll('[data-magnetic]').forEach(b => {
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .25, y: (e.clientY - r.top - r.height / 2) * .35, duration: .4 }); });
      b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.4)' }));
    });
  };

  W.boot = function (fn) {
    gsap.registerPlugin(ScrollTrigger);
    const go = () => { W.smooth(); fn && fn(W); W.splitReveal(); W.parallax(); W.reveals(); W.flipCards(); W.magnetic();
      document.documentElement.classList.add('ready'); ScrollTrigger.refresh(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  };
})();
