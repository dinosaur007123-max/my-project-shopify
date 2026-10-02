/* ==========================================================================
   MIRA Maison — interactions & scroll choreography
   Depends on gsap, ScrollTrigger and Lenis (loaded before this file).
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isMobile = () => window.innerWidth < 861;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  const config = window.MIRA || {};
  let lenis = null;

  /* ------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (!hasGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      closeMenu();
      lenis.scrollTo(target, { offset: -20, duration: 1.6 });
    });
  }

  const lockScroll = (on) => {
    document.body.classList.toggle('is-locked', on);
    if (lenis) on ? lenis.stop() : lenis.start();
  };

  /* ------------------------------------------------------------------
     Text splitting helpers
     ------------------------------------------------------------------ */
  function splitWords(el, wrapperClass = 'split-line') {
    if (el.dataset.splitDone) return $$('.' + wrapperClass + ' > span', el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = wrapperClass;
            outer.style.display = 'inline-block';
            const inner = document.createElement('span');
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.matches('svg, img, br')) {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = '1';
    return $$('.' + wrapperClass + ' > span', el);
  }

  function initSplitReveals() {
    $$('[data-split]').forEach((el) => {
      const words = splitWords(el);
      if (!hasGsap || reduceMotion) return;
      gsap.set(words, { yPercent: 110 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.045 })
      });
    });
  }

  function initReveals() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     Preloader + hero
     ------------------------------------------------------------------ */
  function runPreloader() {
    const pre = $('[data-preloader]');
    if (!pre || !hasGsap || reduceMotion) { if (pre) pre.remove(); return Promise.resolve(); }
    lockScroll(true);
    const count = $('[data-preloader-count]', pre);
    const bar = $('[data-preloader-bar]', pre);
    const letters = $$('.preloader__mark span', pre);
    const critical = $$('.hero img');
    let loaded = 0;
    const total = Math.max(critical.length, 1);
    const state = { p: 0 };
    const target = { p: 0 };

    critical.forEach((img) => {
      const done = () => { loaded++; target.p = loaded / total; };
      if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
    if (!critical.length) target.p = 1;

    gsap.to(letters, { yPercent: -105, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.1 });

    return new Promise((resolve) => {
      const minTime = performance.now() + 1500;
      const tick = () => {
        state.p = lerp(state.p, performance.now() > minTime ? target.p : Math.min(target.p, 0.9), 0.08);
        const pct = Math.round(state.p * 100);
        count.textContent = String(pct).padStart(3, '0');
        bar.style.transform = `scaleX(${state.p})`;
        if (state.p > 0.995 && performance.now() > minTime) {
          gsap.ticker.remove(tick);
          const tl = gsap.timeline({ onComplete: () => { pre.remove(); lockScroll(false); } });
          tl.to(letters, { yPercent: -210, duration: 0.8, ease: 'expo.in', stagger: 0.04 })
            .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.3')
            .add(resolve, '-=0.7');
        }
      };
      gsap.ticker.add(tick);
      setTimeout(() => { target.p = 1; }, 6000);
    });
  }

  function initHero() {
    const hero = $('[data-hero]');
    if (!hero || !hasGsap) return { intro: () => {} };
    const stage = $('[data-hero-stage]', hero);
    const letters = $$('.hero__letter > span', hero);
    const left = $$('.hero__letter.is-left', hero);
    const right = $$('.hero__letter.is-right', hero);
    const bottle = $('[data-hero-bottle]', hero);
    const inner = $('.hero__bottle-inner', hero);
    const fades = $$('[data-hero-fade]', hero);
    const lotus = $('[data-hero-lotus] img', hero);
    const glow = $('[data-hero-glow]', hero);
    const tiltEl = $('[data-hero-tilt]', hero);

    if (reduceMotion) return { intro: () => {} };

    gsap.set(letters, { yPercent: 105 });
    gsap.set(inner, { y: 160, rotate: -32, opacity: 0, scale: 0.9 });
    gsap.set(fades, { opacity: 0, y: 24 });

    const intro = () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to(letters, { yPercent: 0, duration: 1.6, stagger: 0.08 })
        .to(inner, { y: 0, rotate: -14, opacity: 1, scale: 1, duration: 2, ease: 'expo.out' }, 0.25)
        .to(fades, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.7);
    };

    // Scroll: letters part, bottle stands up and sinks into the film below.
    const mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: hero, start: 'top top', end: '+=110%', scrub: 1, pin: stage, pinSpacing: true }
      });
      tl.to(left, { xPercent: -60, opacity: 0.15, ease: 'none', stagger: { each: 0.02, from: 'end' } }, 0)
        .to(right, { xPercent: 60, opacity: 0.15, ease: 'none', stagger: 0.02 }, 0)
        .to(bottle, { yPercent: -30, scale: 1.35, ease: 'none' }, 0)
        .to(inner, { rotate: 0, ease: 'none' }, 0)
        .to(fades, { opacity: 0, y: -40, ease: 'none' }, 0)
        .to(lotus, { rotate: 45, scale: 1.2, ease: 'none' }, 0)
        .to(glow, { scale: 1.8, opacity: 0.4, ease: 'none' }, 0);
    });
    mm.add('(max-width: 860px)', () => {
      gsap.to(bottle, { yPercent: -20, rotate: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to(letters, { yPercent: -30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    });

    // Mouse parallax on desktop.
    if (finePointer) {
      const pos = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        pos.x = (e.clientX - r.left) / r.width - 0.5;
        pos.y = (e.clientY - r.top) / r.height - 0.5;
      });
      stage.addEventListener('pointerleave', () => { pos.x = 0; pos.y = 0; });
      gsap.ticker.add(() => {
        cur.x = lerp(cur.x, pos.x, 0.06); cur.y = lerp(cur.y, pos.y, 0.06);
        if (tiltEl) tiltEl.style.transform = `perspective(1000px) translate3d(${cur.x * 30}px, ${cur.y * 22}px, 0) rotateY(${cur.x * 18}deg) rotateX(${-cur.y * 10}deg)`;
        glow.style.transform = `translate(calc(-50% + ${cur.x * 120}px), calc(-50% + ${cur.y * 90}px))`;
        $('[data-hero-word]', hero).style.transform = `translate3d(${cur.x * -24}px, calc(-50% + ${cur.y * -12}px), 0)`;
      });
    }

    return { intro };
  }

  /* ------------------------------------------------------------------
     Marquee — velocity reactive
     ------------------------------------------------------------------ */
  function initMarquees() {
    $$('[data-marquee]').forEach((el) => {
      const track = $('[data-marquee-track]', el);
      const group = track.firstElementChild;
      const base = parseFloat(el.dataset.speed || 60);
      let x = 0, dir = -1, boost = 0;
      if (reduceMotion || !hasGsap) return;
      ScrollTrigger.create({
        trigger: el, start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => { dir = self.direction === 1 ? -1 : 1; boost = clamp(Math.abs(self.getVelocity()) / 40, 0, 18); }
      });
      gsap.ticker.add((t, dt) => {
        const w = group.offsetWidth;
        if (!w) return;
        boost = lerp(boost, 0, 0.05);
        x += dir * (base + boost * base * 0.25) * (dt / 1000);
        if (x <= -w) x += w;
        if (x > 0) x -= w;
        track.style.transform = `translate3d(${x}px,0,0) skewX(${dir * boost * -0.4}deg)`;
      });
    });
  }

  /* ------------------------------------------------------------------
     Scroll film — image-sequence scrubbing on canvas
     ------------------------------------------------------------------ */
  function initFilm() {
    $$('[data-film]').forEach((section) => {
      const canvas = $('[data-film-canvas]', section);
      const ctx = canvas.getContext('2d');
      const total = parseInt(section.dataset.frames, 10) || 1;
      const first = section.dataset.first;
      const pad = (n) => String(n).padStart(3, '0');
      const urlFor = (i) => first.replace('film-001', 'film-' + pad(i));
      const frames = new Array(total);
      const captions = $$('[data-film-caption]', section);
      const bar = $('[data-film-bar]', section);
      const counter = $('[data-film-count]', section);
      let current = -1, loading = false;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        draw(current < 0 ? 0 : current, true);
      };

      const nearestLoaded = (i) => {
        for (let d = 0; d < total; d++) {
          if (frames[i - d] && frames[i - d].complete && frames[i - d].naturalWidth) return frames[i - d];
          if (frames[i + d] && frames[i + d].complete && frames[i + d].naturalWidth) return frames[i + d];
        }
        return null;
      };

      function draw(i, force) {
        if (i === current && !force) return;
        const img = nearestLoaded(i);
        if (!img) return;
        current = i;
        const cw = canvas.width, ch = canvas.height;
        const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
        section.classList.add('is-ready');
      }

      const load = () => {
        if (loading) return;
        loading = true;
        // Load every 4th frame first so scrubbing works immediately, then fill in.
        const order = [];
        for (let i = 0; i < total; i += 4) order.push(i);
        for (let i = 0; i < total; i++) if (i % 4) order.push(i);
        let idx = 0;
        const next = () => {
          const batch = order.slice(idx, idx + 6);
          idx += 6;
          if (!batch.length) return;
          let pending = batch.length;
          batch.forEach((i) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = img.onerror = () => { if (i === 0) resize(); if (--pending === 0) next(); };
            img.src = urlFor(i + 1);
            frames[i] = img;
          });
        };
        next();
      };

      if (!hasGsap) { load(); return; }
      ScrollTrigger.create({ trigger: section, start: 'top 250%', once: true, onEnter: load });
      window.addEventListener('resize', resize);

      ScrollTrigger.create({
        trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          draw(Math.min(total - 1, Math.floor(p * total)));
          bar.style.transform = `scaleX(${p})`;
          let active = 0;
          captions.forEach((cap, ci) => {
            const s = parseFloat(cap.dataset.start) / 100, e = parseFloat(cap.dataset.end) / 100;
            const fadeIn = clamp((p - s) / 0.06, 0, 1);
            const fadeOut = clamp((e - p) / 0.06, 0, 1);
            const o = Math.min(fadeIn, fadeOut);
            cap.style.opacity = o;
            cap.style.setProperty('--y', `${(1 - o) * 30}px`);
            cap.style.translate = `0 ${(1 - o) * 30}px`;
            if (p >= s) active = ci;
          });
          if (counter) counter.textContent = String(active + 1).padStart(2, '0');
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Parallax, arc story, counters, rotating badges
     ------------------------------------------------------------------ */
  function initParallax() {
    if (!hasGsap || reduceMotion) return;
    $$('[data-parallax]').forEach((el) => {
      const amt = parseFloat(el.dataset.parallax) || 10;
      gsap.fromTo(el, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('[data-rotate-on-scroll]').forEach((el) => {
      gsap.to(el.querySelector('svg'), { rotate: 360, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  function initArc() {
    $$('[data-arc]').forEach((section) => {
      const lines = $$('[data-arc-line]', section);
      const frame = $('[data-arc-frame]', section);
      if (hasGsap && !reduceMotion) {
        lines.forEach((path) => {
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top 75%', end: 'center 40%', scrub: 1 } });
        });
        gsap.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: frame, start: 'top 80%', once: true } });
      }
      $$('[data-count-to]', section).forEach((el) => {
        const to = parseFloat(el.dataset.countTo) || 0;
        if (!hasGsap || reduceMotion) { el.textContent = to; return; }
        const o = { v: 0 };
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }) });
      });
    });
  }

  /* ------------------------------------------------------------------
     Tabs (spotlight + product page)
     ------------------------------------------------------------------ */
  function initTabs(root = document) {
    $$('[data-tabs]', root).forEach((tabs) => {
      if (tabs.dataset.tabsInit) return;
      tabs.dataset.tabsInit = '1';
      const buttons = $$('[data-tab]', tabs);
      const panels = $$('[data-panel]', tabs);
      buttons.forEach((btn) => btn.addEventListener('click', () => {
        const i = btn.dataset.tab;
        buttons.forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
        panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === i));
      }));
    });
  }

  /* ------------------------------------------------------------------
     Product spotlight carousel
     ------------------------------------------------------------------ */
  function initSpotlight() {
    $$('[data-spotlight]').forEach((section) => {
      const slides = $$('[data-spot]', section);
      const bg = $('[data-spotlight-bg]', section);
      const add = $('[data-spot-add]', section);
      const link = $('[data-spot-link]', section);
      const idx = $('[data-spot-current]', section);
      let current = 0, busy = false;

      const apply = (slide) => {
        section.style.setProperty('--accent', slide.dataset.accent);
        section.style.setProperty('--accent-2', slide.dataset.accent2 || slide.dataset['accent-2'] || '#140c08');
        bg.style.setProperty('--accent', slide.dataset.accent);
        link.href = slide.dataset.url;
        add.dataset.variant = slide.dataset.variantId || '';
        add.disabled = false;
      };
      slides.forEach((s) => { s.dataset.accent2 = s.getAttribute('data-accent-2'); });
      apply(slides[0]);

      const go = (to, dirSign) => {
        if (busy || to === current) return;
        busy = true;
        const from = slides[current], next = slides[to];
        const dir = dirSign || (to > current ? 1 : -1);
        current = to;
        idx.textContent = String(to + 1).padStart(2, '0');
        apply(next);
        if (!hasGsap || reduceMotion) {
          from.classList.remove('is-active'); from.setAttribute('aria-hidden', 'true');
          next.classList.add('is-active'); next.setAttribute('aria-hidden', 'false');
          busy = false; return;
        }
        const tl = gsap.timeline({ onComplete: () => { busy = false; } });
        tl.to($$('.spot__title .line > span', from), { yPercent: -110, duration: 0.6, ease: 'expo.in', stagger: 0.04 }, 0)
          .to($('.spot__bottle', from), { xPercent: -40 * dir, rotate: -18 * dir, opacity: 0, duration: 0.7, ease: 'expo.in' }, 0)
          .to($$('.spot__details, .spot__ghost, .spot__lede', from), { opacity: 0, duration: 0.4 }, 0)
          .add(() => {
            from.classList.remove('is-active'); from.setAttribute('aria-hidden', 'true');
            next.classList.add('is-active'); next.setAttribute('aria-hidden', 'false');
            gsap.set(from.querySelectorAll('*'), { clearProps: 'all' });
          })
          .fromTo($$('.spot__title .line > span', next), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.06 })
          .fromTo($('.spot__bottle', next), { xPercent: 50 * dir, rotate: 20 * dir, opacity: 0, scale: 0.9 }, { xPercent: 0, rotate: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'expo.out' }, '<')
          .fromTo($('.spot__ghost', next), { opacity: 0, xPercent: -50 + 10 * dir }, { opacity: 1, xPercent: -50, duration: 1.4, ease: 'expo.out' }, '<')
          .fromTo($$('.spot__details > *, .spot__lede', next), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, '<0.15');
      };

      $('[data-spot-next]', section).addEventListener('click', () => go((current + 1) % slides.length, 1));
      $('[data-spot-prev]', section).addEventListener('click', () => go((current - 1 + slides.length) % slides.length, -1));
      section.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') go((current + 1) % slides.length, 1);
        if (e.key === 'ArrowLeft') go((current - 1 + slides.length) % slides.length, -1);
      });

      // Swipe
      let sx = null;
      section.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
      section.addEventListener('pointerup', (e) => {
        if (sx === null) return;
        const dx = e.clientX - sx; sx = null;
        if (Math.abs(dx) > 50) dx < 0 ? go((current + 1) % slides.length, 1) : go((current - 1 + slides.length) % slides.length, -1);
      });

      add.addEventListener('click', () => {
        if (add.dataset.variant) Cart.add(add.dataset.variant, 1, add);
        else window.location.href = link.href;
      });

      // Entrance on scroll.
      if (hasGsap && !reduceMotion) {
        const first = slides[0];
        gsap.from($$('.spot__title .line > span', first), { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: section, start: 'top 65%', once: true } });
        gsap.from($('.spot__bottle', first), { y: 120, rotate: 14, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: section, start: 'top 65%', once: true } });
        gsap.to(bg, { backgroundPosition: '50% 30%', ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    });
  }

  /* ------------------------------------------------------------------
     Horizontal pinned gallery
     ------------------------------------------------------------------ */
  function initHScroll() {
    if (!hasGsap) return;
    $$('[data-hscroll]').forEach((section) => {
      const track = $('[data-hscroll-track]', section);
      const pin = $('[data-hscroll-pin]', section);
      const mm = gsap.matchMedia();
      mm.add('(min-width: 861px)', () => {
        const dist = () => track.scrollWidth - window.innerWidth;
        const tween = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + dist(), scrub: 1, pin, invalidateOnRefresh: true, anticipatePin: 1 }
        });
        $$('[data-note-img]', section).forEach((img) => {
          gsap.fromTo(img, { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: img.closest('[data-note]'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        });
      });
      mm.add('(max-width: 860px)', () => {
        pin.style.height = 'auto';
        pin.style.padding = '100px 0';
        track.style.width = '100%';
        track.style.overflowX = 'auto';
        track.style.scrollSnapType = 'x mandatory';
        track.style.paddingBottom = '20px';
      });
    });
  }

  /* ------------------------------------------------------------------
     Video reveal
     ------------------------------------------------------------------ */
  function initVideoReveal() {
    $$('[data-vreveal]').forEach((section) => {
      const frame = $('[data-vreveal-frame]', section);
      const video = $('video', section);
      const title = $$('[data-vreveal-title] .line > span', section);
      const fades = $$('[data-vreveal-fade]', section);
      const toggle = $('[data-video-toggle]', section);

      const start = () => {
        if (!video.src && video.dataset.src) { video.src = video.dataset.src; video.load(); }
        const p = video.play(); if (p && p.catch) p.catch(() => {});
      };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => entries.forEach((en) => {
          if (en.isIntersecting) { if (!toggle.classList.contains('is-paused')) start(); } else video.pause();
        }), { rootMargin: '200px 0px' }).observe(section);
      } else start();

      toggle.addEventListener('click', () => {
        const paused = toggle.classList.toggle('is-paused');
        paused ? video.pause() : start();
      });

      if (!hasGsap || reduceMotion) return;
      gsap.set(title, { yPercent: 110 });
      gsap.set(fades, { opacity: 0, y: 20 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: '+=120%', scrub: 1, pin: $('.vreveal__pin', section) } });
      tl.to(frame, { clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0px 0px)', ease: 'none' }, 0)
        .to(video, { scale: 1, ease: 'none' }, 0)
        .to(title, { yPercent: 0, stagger: 0.08, ease: 'power3.out', duration: 0.5 }, 0.25)
        .to(fades, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.3 }, 0.55);
    });
  }

  /* ------------------------------------------------------------------
     Scent finder
     ------------------------------------------------------------------ */
  function initFinder() {
    $$('[data-finder]').forEach((section) => {
      const matches = $$('[data-finder-match]', section);
      const placeholder = $('[data-finder-placeholder]', section);
      const answers = {};
      $$('[data-finder-input]', section).forEach((input) => input.addEventListener('change', () => {
        answers[input.dataset.finderInput] = input.value;
        if (!answers.moment && !answers.mood) return;
        let best = null, bestScore = -1;
        matches.forEach((m, i) => {
          const score = (m.dataset.moment === answers.moment ? 2 : 0) + (m.dataset.mood === answers.mood ? 1.5 : 0) - i * 0.01;
          if (score > bestScore) { bestScore = score; best = m; }
        });
        if (!best) return;
        placeholder.hidden = true;
        matches.forEach((m) => { m.hidden = m !== best; });
        if (hasGsap && !reduceMotion) {
          gsap.fromTo($('.finder__bottle', best), { y: 60, rotate: -12, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1.2, ease: 'expo.out' });
          gsap.fromTo($$('.finder__info > *', best), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: 'expo.out' });
        }
      }));
    });
  }

  /* ------------------------------------------------------------------
     Quote — words brighten as you scroll
     ------------------------------------------------------------------ */
  function initQuote() {
    $$('[data-words]').forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map((w) => `<span class="word">${w.replace(/</g, '&lt;')}</span>`).join(' ');
      const spans = $$('.word', el);
      if (!hasGsap || reduceMotion) { spans.forEach((s) => (s.style.opacity = 1)); return; }
      gsap.to(spans, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } });
    });
  }

  function initFooter() {
    const mark = $('[data-footer-mark]');
    if (mark && hasGsap && !reduceMotion) {
      gsap.from($$('span', mark), { yPercent: 100, duration: 1.6, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: mark, start: 'top 95%', once: true } });
    }
    const top = $('[data-scroll-top]');
    if (top) top.addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 2 }) : window.scrollTo({ top: 0, behavior: 'smooth' })));
  }

  /* ------------------------------------------------------------------
     Cursor, magnetic buttons, 3D tilt
     ------------------------------------------------------------------ */
  function initCursor() {
    const ring = $('[data-cursor]'), dot = $('[data-cursor-dot]');
    if (!ring || !finePointer || reduceMotion) { if (ring) ring.remove(); if (dot) dot.remove(); return; }
    const label = $('[data-cursor-label]', ring);
    const m = { x: innerWidth / 2, y: innerHeight / 2 }, r = { ...m };
    window.addEventListener('pointermove', (e) => { m.x = e.clientX; m.y = e.clientY; dot.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`; });
    document.addEventListener('pointerleave', () => { ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); });
    document.addEventListener('pointerenter', () => { ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); });
    const loop = () => { r.x = lerp(r.x, m.x, 0.18); r.y = lerp(r.y, m.y, 0.18); ring.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener('pointerover', (e) => {
      const withText = e.target.closest('[data-cursor-text]');
      const interactive = e.target.closest('a, button, label, input, select, textarea');
      if (withText && withText.dataset.cursorText) { ring.classList.add('has-label'); label.textContent = withText.dataset.cursorText; }
      else ring.classList.remove('has-label');
      ring.classList.toggle('is-hover', !!interactive && !withText);
    });
  }

  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.3;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(() => (el.style.transition = ''), 700);
      });
    });
  }

  function initTilt(root = document) {
    if (!finePointer || reduceMotion) return;
    $$('[data-tilt]', root).forEach((el) => {
      if (el.dataset.tiltInit) return;
      el.dataset.tiltInit = '1';
      const target = $('[data-tilt-target]', el) || el;
      target.style.transformStyle = 'preserve-3d';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        target.style.transform = `perspective(900px) rotateY(${px * 14}deg) rotateX(${-py * 12}deg) translateZ(0)`;
      });
      el.addEventListener('pointerleave', () => {
        target.style.transition = 'transform .9s cubic-bezier(.22,1,.36,1)';
        target.style.transform = '';
        setTimeout(() => (target.style.transition = ''), 900);
      });
    });
  }

  /* ------------------------------------------------------------------
     Header + menu
     ------------------------------------------------------------------ */
  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      header.classList.toggle('is-hidden', y > last && y > 400 && !document.documentElement.classList.contains('menu-open'));
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (toggle && menu) {
      toggle.addEventListener('click', () => (document.documentElement.classList.contains('menu-open') ? closeMenu() : openMenu()));
      const imgs = $$('[data-menu-img]', menu);
      if (imgs[0]) imgs[0].classList.add('is-active');
      $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('pointerenter', () => {
        imgs.forEach((img) => img.classList.toggle('is-active', img.dataset.menuImg === a.dataset.menuLink));
      }));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); Cart.close(); } });
    }
  }
  function openMenu() {
    document.documentElement.classList.add('menu-open');
    const t = $('[data-menu-toggle]'); if (t) t.setAttribute('aria-expanded', 'true');
    const m = $('[data-menu]'); if (m) m.setAttribute('aria-hidden', 'false');
    lockScroll(true);
  }
  function closeMenu() {
    if (!document.documentElement.classList.contains('menu-open')) return;
    document.documentElement.classList.remove('menu-open');
    const t = $('[data-menu-toggle]'); if (t) t.setAttribute('aria-expanded', 'false');
    const m = $('[data-menu]'); if (m) m.setAttribute('aria-hidden', 'true');
    lockScroll(false);
  }

  /* ------------------------------------------------------------------
     Drag-to-scroll (testimonials)
     ------------------------------------------------------------------ */
  function initDragScroll() {
    $$('[data-drag-scroll]').forEach((vp) => {
      let down = false, sx = 0, sl = 0;
      vp.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = vp.scrollLeft; vp.classList.add('is-dragging'); });
      window.addEventListener('pointerup', () => { down = false; vp.classList.remove('is-dragging'); });
      vp.addEventListener('pointermove', (e) => { if (!down) return; vp.scrollLeft = sl - (e.clientX - sx) * 1.4; });
      const section = vp.closest('[data-voices]');
      if (!section) return;
      const step = () => { const card = vp.querySelector('.voice'); return card ? card.offsetWidth + 24 : 400; };
      const prev = $('[data-voices-prev]', section), next = $('[data-voices-next]', section);
      if (prev) prev.addEventListener('click', () => vp.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => vp.scrollBy({ left: step(), behavior: 'smooth' }));
    });
  }

  /* ------------------------------------------------------------------
     Cart (AJAX + Section Rendering API)
     ------------------------------------------------------------------ */
  const Cart = {
    drawer: null,
    init() {
      this.drawer = $('[data-cart-drawer]');
      document.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-cart-toggle]');
        if (toggle && this.drawer) { e.preventDefault(); this.open(); return; }
        if (e.target.closest('[data-cart-close]')) { this.close(); return; }
        const quick = e.target.closest('[data-quick-add]');
        if (quick) { e.preventDefault(); this.add(quick.dataset.quickAdd, 1, quick); return; }
        const qty = e.target.closest('[data-qty-change]');
        if (qty) {
          const line = qty.closest('[data-line]');
          if (line) this.change(parseInt(line.dataset.line, 10), parseInt(qty.dataset.qtyChange, 10), line);
        }
      });
    },
    open() { if (!this.drawer) return; this.drawer.classList.add('is-open'); this.drawer.setAttribute('aria-hidden', 'false'); lockScroll(true); },
    close() { if (!this.drawer || !this.drawer.classList.contains('is-open')) return; this.drawer.classList.remove('is-open'); this.drawer.setAttribute('aria-hidden', 'true'); lockScroll(false); },
    async request(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, sections: 'cart-drawer-items', sections_url: window.location.pathname })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || 'Cart error');
      return data;
    },
    render(sections) {
      const html = sections && sections['cart-drawer-items'];
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const meta = doc.querySelector('[data-cart-meta]');
      const items = doc.querySelector('.shopify-section') || doc.body;
      if (meta) meta.remove();
      $$('[data-cart-items]').forEach((el) => { el.innerHTML = items.innerHTML; });
      if (meta) {
        $$('[data-cart-count]').forEach((el) => {
          el.textContent = meta.dataset.count;
          el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
        });
        $$('[data-cart-total]').forEach((el) => { el.textContent = meta.dataset.total; });
      }
    },
    async add(id, quantity = 1, btn) {
      if (btn) btn.classList.add('is-loading');
      try {
        const data = await this.request(config.routes.cartAdd + '.js', { items: [{ id: parseInt(id, 10), quantity }] });
        this.render(data.sections);
        const item = data.items && data.items[0];
        toast(item ? `${item.product_title} — added to your bag` : 'Added to your bag', item && item.image);
        this.open();
      } catch (err) {
        toast(err.message);
      } finally {
        if (btn) btn.classList.remove('is-loading');
      }
    },
    async change(line, quantity, el) {
      if (el) el.classList.add('is-updating');
      try {
        const data = await this.request(config.routes.cartChange + '.js', { line, quantity: Math.max(0, quantity) });
        this.render(data.sections);
      } catch (err) { toast(err.message); }
      finally { if (el) el.classList.remove('is-updating'); }
    }
  };

  let toastEl = null, toastTimer = null;
  function toast(msg, img) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = (img ? `<img src="${img}" alt="">` : '') + `<span></span>`;
    toastEl.querySelector('span').textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
  }

  /* ------------------------------------------------------------------
     Product page: variants, quantity, add to cart
     ------------------------------------------------------------------ */
  function initProductForm() {
    const form = $('[data-product-form]');
    if (!form) return;
    const pdp = form.closest('[data-pdp]');
    const variants = JSON.parse(($('[data-product-json]', pdp) || {}).textContent || '[]');
    const idInput = $('[data-variant-input]', form);
    const price = $('[data-pdp-price]', pdp);
    const addBtn = $('[data-add-button]', form);
    const addLabel = $('[data-add-label]', form);
    const qtyInput = $('[data-qty-input] input', form);
    const formatMoney = (cents) => {
      const fmt = config.moneyFormat || '{{amount}}';
      const amount = (cents / 100).toFixed(2);
      const withCommas = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, k) => (k === 'amount_no_decimals' ? withCommas.split('.')[0] : k === 'amount_with_comma_separator' ? withCommas.replace('.', ',') : withCommas));
    };

    $$('[data-option-index]', form).forEach((input) => input.addEventListener('change', () => {
      const selected = $$('fieldset.pdp__option', form).map((fs) => { const c = $('input:checked', fs); return c ? c.value : null; });
      const v = variants.find((variant) => variant.options.every((o, i) => o === selected[i]));
      if (!v) return;
      idInput.value = v.id;
      price.textContent = formatMoney(v.price);
      addBtn.disabled = !v.available;
      addLabel.textContent = v.available ? addLabel.dataset.add || 'Add to bag' : 'Sold out';
      const url = new URL(window.location.href); url.searchParams.set('variant', v.id); history.replaceState({}, '', url);
    }));
    addLabel.dataset.add = addLabel.textContent.trim();

    $$('[data-step]', form).forEach((b) => b.addEventListener('click', () => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) + parseInt(b.dataset.step, 10));
    }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      Cart.add(idInput.value, parseInt(qtyInput.value, 10) || 1, addBtn);
    });
  }

  /* ------------------------------------------------------------------
     Misc
     ------------------------------------------------------------------ */
  function initSort() {
    const sel = $('[data-sort]');
    if (!sel) return;
    sel.addEventListener('change', () => { const u = new URL(window.location.href); u.searchParams.set('sort_by', sel.value); window.location.href = u; });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  async function boot() {
    initSmoothScroll();
    Cart.init();
    initHeader();
    initCursor();
    initMagnetic();
    initTilt();
    initTabs();
    initProductForm();
    initSort();
    initDragScroll();

    const hero = initHero();
    await (config.preloader ? runPreloader() : Promise.resolve());
    hero.intro();

    initSplitReveals();
    initReveals();
    initMarquees();
    initFilm();
    initParallax();
    initArc();
    initSpotlight();
    initHScroll();
    initVideoReveal();
    initFinder();
    initQuote();
    initFooter();

    if (hasGsap) {
      window.addEventListener('load', () => ScrollTrigger.refresh());
      setTimeout(() => ScrollTrigger.refresh(), 1200);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Theme editor support: re-run reveal-dependent pieces when sections reload.
  document.addEventListener('shopify:section:load', () => {
    initTabs(); initTilt(); initReveals(); initSplitReveals();
    if (hasGsap) ScrollTrigger.refresh();
  });
})();
