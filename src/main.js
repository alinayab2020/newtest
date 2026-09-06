(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / Math.max(.00001, b - a));
    return t * t * (3 - 2 * t);
  };
  const invSmooth = (a, b, x) => 1 - smooth(a, b, x);

  const mobile = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  const slowNetwork = ['slow-2g', '2g'].includes(navigator.connection?.effectiveType || '');
  const FILM_FPS = 15;
  const FILM_FRAMES = 231;
  const FILM_LAST = FILM_FRAMES - 1;
  const SEGMENTS = [
    { start: 0, end: .30 },
    { start: .30, end: .44 },
    { start: .44, end: .58 },
    { start: .58, end: .72 },
    { start: .72, end: .86 },
    { start: .86, end: 1 }
  ];
  const TITLES = ['SCROLL CINEMA','THE THRESHOLD','THE YEARS OF LEARNING','THE CLINICAL MOMENT','THE OATH BEGINS','THE FUTURE CONTINUES'];

  const journey = $('#journey');
  const stage = $('#stage');
  const boot = $('#boot');
  const bootRail = $('#bootRail');
  const bootPercent = $('#bootPercent');
  const bootLabel = $('#bootLabel');
  const video = $('#heroVideo');
  const poster = $('#videoPoster');
  const portal = $('#videoPortal');
  const heroCinema = $('#heroCinema');
  const filmMeta = $('#filmMeta');
  const scrubRail = $('#scrubRail');
  const scrubFrame = $('#scrubFrame');
  const scrubTimecode = $('#scrubTimecode');
  const plates = $$('.plate');
  const panels = $$('.panel');
  const timelineItems = $$('.timeline__item');
  const timelineFill = $('#timelineFill');
  const mobileProgress = $('#mobileProgress');
  const chapterMark = $('#chapterMark');
  const hudChapter = $('#hudChapter');
  const hudTitle = $('#hudTitle');
  const transitionLens = $('#transitionLens');
  const depthCore = $('#depthCore');
  const depthGlyph = $('#depthGlyph');
  const continuityLive = $('#continuityLive');
  const confetti = $('#confetti');
  const scrollNote = $('#scrollNote');
  const soundToggle = $('#soundToggle');

  let journeyTop = 0;
  let journeyScrollable = 1;
  let pending = false;
  let progress = 0;
  let activeScene = 0;
  let videoReady = false;
  let videoBlobURL = '';
  let targetFrame = 0;
  let lastSetFrame = -1;
  let videoPrimed = false;
  let continuityLength = 0;
  let portalFinalScale = 1;
  let plateHydrated = new Set();
  let audio = null;

  function farsiNumber(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  function setBoot(p, label) {
    const v = clamp(p, 0, 100);
    bootRail.style.width = `${v}%`;
    bootPercent.textContent = `${farsiNumber(Math.round(v))}٪`;
    if (label) bootLabel.textContent = label;
  }

  function finishBoot() {
    setBoot(100, 'آماده');
    requestAnimationFrame(() => setTimeout(() => boot.classList.add('is-hidden'), 180));
  }

  async function fetchVideoToMemory() {
    const useMobileAsset = mobile || saveData || slowNetwork;
    const url = useMobileAsset ? './assets/hero-scrub-mobile.mp4' : './assets/hero-scrub.mp4';
    setBoot(5, useMobileAsset ? 'در حال آماده‌سازی نسخه سبک…' : 'در حال پیش‌بارگذاری فیلم…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { cache: 'force-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      if (!response.body || !response.body.getReader) {
        const blob = await response.blob();
        return blob;
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total) setBoot(8 + (received / total) * 78, 'در حال پیش‌بارگذاری فریم‌ها…');
      }
      clearTimeout(timeout);
      return new Blob(chunks, { type: 'video/mp4' });
    } catch (error) {
      clearTimeout(timeout);
      console.warn('Prebuffer failed; using streamed video fallback.', error);
      return null;
    }
  }

  async function prepareVideo() {
    const fallbackURL = mobile || saveData || slowNetwork ? './assets/hero-scrub-mobile.mp4' : './assets/hero-scrub.mp4';
    const blob = await fetchVideoToMemory();
    videoBlobURL = blob ? URL.createObjectURL(blob) : '';
    video.src = videoBlobURL || fallbackURL;
    video.load();
    try {
      await new Promise((resolve, reject) => {
        if (video.readyState >= 2) return resolve();
        const timer = setTimeout(() => reject(new Error('video-ready-timeout')), 12000);
        video.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timer); reject(video.error || new Error('video-error')); }, { once: true });
      });
      video.pause();
      video.currentTime = 0;
      videoReady = true;
      poster.classList.add('is-hidden');
      setBoot(94, 'Cinema ready');
      finishBoot();
      scheduleRender();
    } catch (error) {
      console.warn('Video unavailable. Poster fallback active.', error);
      videoReady = false;
      setBoot(100, 'نسخه تصویری آماده است');
      finishBoot();
    }
  }

  function primeVideo() {
    if (videoPrimed || !videoReady) return;
    videoPrimed = true;
    const target = targetFrame / FILM_FPS;
    const play = video.play();
    if (play?.then) play.then(() => { video.pause(); video.currentTime = target; }).catch(() => {});
  }

  function formatTimecode(frame) {
    const seconds = Math.floor(frame / FILM_FPS);
    const f = frame % FILM_FPS;
    return `00:${String(seconds).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
  }

  function seekVideo(frame) {
    targetFrame = clamp(Math.round(frame), 0, FILM_LAST);
    if (!videoReady || reduceMotion || targetFrame === lastSetFrame) return;
    lastSetFrame = targetFrame;
    const t = Math.min(Math.max(0, video.duration - .002), targetFrame / FILM_FPS);
    try {
      // Intentionally do not queue seeks. Each new target replaces the old target,
      // so fast scrolling never waits for stale frames to finish.
      video.currentTime = t;
    } catch (_) {}
  }

  function hydratePlate(scene) {
    if (scene < 1 || scene > 5 || plateHydrated.has(scene)) return;
    const plate = plates[scene - 1];
    const img = $('img', plate);
    const src = plate.dataset[mobile ? 'mobile' : 'desktop'];
    if (!img || !src) return;
    plateHydrated.add(scene);
    img.onload = () => plate.classList.add('is-loaded');
    img.onerror = () => plate.classList.add('is-loaded');
    img.src = src;
    if (img.complete) plate.classList.add('is-loaded');
  }

  function preloadAhead(scene, local) {
    if (scene === 0) {
      if (local > .28) hydratePlate(1);
      if (local > .72) hydratePlate(2);
      return;
    }
    hydratePlate(scene);
    if (local > .34) hydratePlate(scene + 1);
  }

  function locateSegment(p) {
    for (let i = SEGMENTS.length - 1; i >= 0; i--) {
      const s = SEGMENTS[i];
      if (p >= s.start || i === 0) return { index: i, local: clamp((p - s.start) / (s.end - s.start)) };
    }
    return { index: 0, local: 0 };
  }

  function renderHero(local) {
    const frame = Math.round(local * FILM_LAST);
    seekVideo(frame);
    scrubRail.style.width = `${local * 100}%`;
    scrubFrame.textContent = `${String(frame + 1).padStart(3,'0')} / ${FILM_FRAMES}`;
    scrubTimecode.textContent = formatTimecode(frame);

    const morph = smooth(.68, .97, local);
    const scale = lerp(1, portalFinalScale, morph);
    document.documentElement.style.setProperty('--portal-scale', scale.toFixed(4));
    document.documentElement.style.setProperty('--portal-x', `${lerp(mobile ? 0 : 18, 0, morph).toFixed(3)}vw`);
    document.documentElement.style.setProperty('--portal-radius', `${lerp(mobile ? 0 : 28, 0, morph).toFixed(2)}px`);
    heroCinema.style.opacity = `${invSmooth(.93, 1, local)}`;
    filmMeta.style.opacity = `${invSmooth(.58, .84, local)}`;
    scrollNote.style.opacity = `${invSmooth(.35, .68, local)}`;

    const campusAlpha = smooth(.74, .99, local);
    const campus = plates[0];
    campus.style.opacity = campusAlpha.toFixed(3);
    const campusImg = $('img', campus);
    if (campusImg) campusImg.style.transform = `scale(${(1.12 - campusAlpha * .045).toFixed(4)}) translate3d(${(-1.2 + campusAlpha * 1.2).toFixed(3)}%,0,0)`;
  }

  function renderPlate(scene, local) {
    plates.forEach((plate, idx) => {
      const s = idx + 1;
      let alpha = 0;
      let t = 0;
      if (s === scene) {
        alpha = scene === 5 ? 1 : invSmooth(.78,.99,local);
        t = local;
      } else if (s === scene + 1) {
        alpha = smooth(.76,.99,local);
        t = 0;
      }
      plate.style.opacity = alpha.toFixed(3);
      if (alpha > .001) {
        const img = $('img', plate);
        if (img) {
          const dir = s % 2 ? -1 : 1;
          const scale = 1.09 - t * .035;
          const x = dir * lerp(1.15, -.45, t);
          img.style.transform = `scale(${scale.toFixed(4)}) translate3d(${x.toFixed(3)}%,0,0)`;
        }
      }
    });
  }

  function panelAlpha(scene, local) {
    if (scene === 0) return invSmooth(.61,.83,local);
    if (scene === 5) return smooth(.04,.22,local);
    return smooth(.04,.2,local) * invSmooth(.76,.96,local);
  }

  function renderPanels(scene, local) {
    panels.forEach((panel, i) => {
      let a = 0;
      let y = 16;
      if (i === scene) {
        a = panelAlpha(scene, local);
        y = lerp(14, -10, local);
      } else if (scene === 0 && i === 1) {
        a = smooth(.82,1,local) * .58;
        y = lerp(28, 9, smooth(.82,1,local));
      }
      panel.style.opacity = a.toFixed(3);
      if (i === 0) panel.style.transform = `translate3d(0,calc(-50% + ${y.toFixed(2)}px),0)`;
      else if (!mobile) panel.style.transform = `translate3d(0,calc(-50% + ${y.toFixed(2)}px),0)`;
      else panel.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
      panel.classList.toggle('is-active', a > .62);
      panel.setAttribute('aria-hidden', a > .16 ? 'false' : 'true');
    });
  }

  function renderDepth(scene, local) {
    if (scene === 0 || reduceMotion) {
      depthCore.style.opacity = '0';
      return;
    }
    const pulse = smooth(.04,.22,local) * (scene === 5 ? 1 : invSmooth(.78,.98,local));
    const rotate = progress * 520 + local * 20;
    const x = (scene % 2 ? -1 : 1) * lerp(7, 2, local);
    depthCore.style.opacity = `${pulse * (mobile ? .32 : .58)}`;
    depthCore.style.transform = `translate(calc(-50% + ${x.toFixed(2)}vw),-50%) perspective(900px) rotateX(${lerp(71,62,local).toFixed(2)}deg) rotateZ(${rotate.toFixed(2)}deg) scale(${lerp(.78,1.03,pulse).toFixed(3)})`;
    depthGlyph.textContent = String(scene).padStart(2,'0');
  }

  function renderTransition(scene, local) {
    const phase = smooth(.74,.88,local) * invSmooth(.93,1,local);
    transitionLens.style.opacity = `${phase * .9}`;
    transitionLens.style.transform = `translate3d(${lerp(-28,170,smooth(.72,1,local)).toFixed(2)}vw,0,0) skewX(-8deg)`;
  }

  function renderConfetti(scene, local) {
    if (scene !== 4 || reduceMotion) {
      confetti.style.opacity = '0';
      return;
    }
    const a = smooth(.14,.38,local) * invSmooth(.78,.98,local);
    confetti.style.opacity = `${a}`;
    $$('#confetti i').forEach((el, i) => {
      const speed = 88 + (i % 7) * 8;
      const y = (local * speed * 1.7 + (i * 11) % 58) % 118;
      const dx = Math.sin(local * 7 + i) * (8 + i % 5);
      const r = local * 720 + i * 37;
      el.style.setProperty('--y', `${y}vh`);
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--r', `${r}deg`);
    });
  }

  function updateHUD(scene) {
    if (scene === activeScene) return;
    activeScene = scene;
    timelineItems.forEach((item, i) => item.classList.toggle('is-active', i === scene));
    chapterMark.textContent = String(scene).padStart(2,'0');
    hudChapter.textContent = `${String(scene).padStart(2,'0')} / 05`;
    hudTitle.textContent = TITLES[scene];
  }

  function render() {
    pending = false;
    const y = window.scrollY || window.pageYOffset || 0;
    progress = clamp((y - journeyTop) / journeyScrollable);
    const { index: scene, local } = locateSegment(progress);
    preloadAhead(scene, local);
    updateHUD(scene);

    if (scene === 0) {
      renderHero(local);
    } else {
      heroCinema.style.opacity = '0';
      scrollNote.style.opacity = '0';
      renderPlate(scene, local);
    }
    renderPanels(scene, local);
    renderDepth(scene, local);
    renderTransition(scene, local);
    renderConfetti(scene, local);

    timelineFill.style.height = `${progress * 100}%`;
    mobileProgress.style.width = `${progress * 100}%`;
    if (continuityLength) continuityLive.style.strokeDashoffset = `${continuityLength * (1 - progress)}`;
  }

  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(render);
  }

  function measure() {
    const r = journey.getBoundingClientRect();
    journeyTop = (window.scrollY || 0) + r.top;
    journeyScrollable = Math.max(1, journey.offsetHeight - window.innerHeight);
    const baseW = portal.offsetWidth || 420;
    const baseH = portal.offsetHeight || 746;
    portalFinalScale = mobile ? 1 : Math.max(window.innerWidth / baseW, window.innerHeight / baseH) * 1.04;
    scheduleRender();
  }

  function jumpTo(scene) {
    const s = SEGMENTS[clamp(scene,0,5)];
    const targetProgress = scene === 0 ? 0 : s.start + (s.end - s.start) * .18;
    const top = journeyTop + targetProgress * journeyScrollable;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function initConfetti() {
    const colors = ['#dcb66c','#8adfe5','#f4f6f5','#5d8f98'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${3 + ((i * 37) % 94)}%`);
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--y', '-15vh');
      p.style.setProperty('--dx', '0px');
      p.style.setProperty('--r', `${i * 19}deg`);
      frag.appendChild(p);
    }
    confetti.appendChild(frag);
  }

  function initContinuity() {
    if (!continuityLive || reduceMotion) return;
    continuityLength = continuityLive.getTotalLength();
    continuityLive.style.strokeDasharray = `${continuityLength}`;
    continuityLive.style.strokeDashoffset = `${continuityLength}`;
  }

  function initAudio() {
    if (audio) return audio;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    const osc = ctx.createOscillator();
    const low = ctx.createBiquadFilter();
    master.gain.value = 0;
    low.type = 'lowpass';
    low.frequency.value = 160;
    osc.type = 'sine';
    osc.frequency.value = 47;
    osc.connect(low).connect(master).connect(ctx.destination);
    osc.start();
    audio = { ctx, master, osc, state: false };
    return audio;
  }

  async function toggleAudio() {
    const a = initAudio();
    if (!a) return;
    if (a.ctx.state === 'suspended') await a.ctx.resume();
    a.state = !a.state;
    a.master.gain.setTargetAtTime(a.state ? .045 : 0, a.ctx.currentTime, .24);
    soundToggle.setAttribute('aria-pressed', String(a.state));
  }

  function bind() {
    addEventListener('scroll', scheduleRender, { passive: true });
    addEventListener('resize', measure, { passive: true });
    visualViewport?.addEventListener('resize', measure, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
      if (audio?.state) audio.master.gain.setTargetAtTime(document.hidden ? 0 : .045, audio.ctx.currentTime, .18);
    });
    for (const type of ['pointerdown','touchstart','wheel']) addEventListener(type, primeVideo, { once: true, passive: true });
    $$('[data-jump]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      jumpTo(Number(el.dataset.jump));
    }));
    soundToggle?.addEventListener('click', toggleAudio);
  }

  function init() {
    document.documentElement.classList.toggle('is-mobile', mobile);
    initConfetti();
    initContinuity();
    hydratePlate(1);
    bind();
    measure();
    setBoot(2, 'در حال آماده‌سازی فیلم…');
    prepareVideo();
  }

  addEventListener('DOMContentLoaded', init, { once: true });
  addEventListener('beforeunload', () => { if (videoBlobURL) URL.revokeObjectURL(videoBlobURL); }, { once: true });
})();
