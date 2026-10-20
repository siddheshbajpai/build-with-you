/* ============================================================
   Build with YOU — background engine + scroll orchestration
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ------------------------------------------------------------
     1. SCROLL STATE
     One rAF loop drives everything so the background, the
     parallax and the progress bar are always in sync with the
     scroll position -> no lag, no tearing, no glitch.
  ------------------------------------------------------------ */
  const state = {
    raw: window.scrollY || 0,       // actual scroll position (px)
    smooth: window.scrollY || 0,    // lerped scroll position (px)
    velocity: 0,                    // smoothed scroll velocity
    progress: 0,                    // 0..1 through the document
    max: 1
  };

  function measure() {
    state.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* ------------------------------------------------------------
     2. ANIMATED BACKGROUND CANVAS
     A field of soft colour blobs that:
       - drifts on its own (continuous animation)
       - advances its phase with scroll, so scrolling further
         changes what you see (scroll drives the animation)
       - reacts to scroll velocity with a short "pulse"

     Performance notes: the canvas backing store is smaller than the
     display size on phones (soft blobs hide the upscale), blobs are
     drawn in one pass and every per-frame value is written only when
     it actually changed, so the compositor is never woken up for a
     no-op.
  ------------------------------------------------------------ */
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0, DPR = 1;

  const isSmall = () => window.innerWidth <= 640;
  const isMobile = () => window.innerWidth <= 860;

  const PALETTE = [
    { h: 44,  s: 100, l: 66 },  // yellow
    { h: 340, s: 100, l: 68 },  // pink
    { h: 188, s: 96,  l: 58 },  // cyan
    { h: 262, s: 100, l: 76 },  // purple
    { h: 22,  s: 100, l: 65 },  // orange
    { h: 142, s: 85,  l: 66 },  // green
    { h: 205, s: 95,  l: 72 }   // blue
  ];

  let blobs = [];

  function makeBlobs() {
    const count = isMobile() ? 5 : 7;
    blobs.length = 0;
    for (let i = 0; i < count; i++) {
      const p = PALETTE[i % PALETTE.length];
      const ax = 0.12 + Math.random() * 0.76;
      const ay = 0.10 + Math.random() * 0.80;
      blobs.push({
        color: p,
        // normalised anchor position
        ax: ax,
        ay: ay,
        // current (smoothed) position — starts at the anchor so the
        // background never "grows" out of the corner on first paint
        x: ax, y: ay,
        tx: ax, ty: ay,
        r: 0.20 + Math.random() * 0.26,
        // motion params
        sx: 0.10 + Math.random() * 0.22,
        sy: 0.08 + Math.random() * 0.20,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        // depth: how much it reacts to scroll
        depth: 0.25 + Math.random() * 0.85,
        alpha: 0.34 + Math.random() * 0.26
      });
    }
  }

  function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    // phones get a smaller backing store + a lower DPR: the blobs are
    // soft gradients, so the upscale is invisible but the fill rate
    // (and therefore the battery bill) drops sharply.
    const scale = isSmall() ? 0.62 : (isMobile() ? 0.8 : 1);
    DPR = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 2) * scale;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    // the element itself is sized by CSS, so a late resize never
    // leaves a stretched (blurry) or clipped canvas behind
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawBlob(b, time) {
    const min = Math.min(W, H);
    const radius = b.r * min * (1 + state.velocity * 0.0016);
    const hueShift = state.progress * 120 + state.smooth * 0.012;

    const x = b.x * W;
    const y = b.y * H;

    const g = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
    const h = (b.color.h + hueShift) % 360;
    const s = b.color.s;
    const l = b.color.l;
    g.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${b.alpha})`);
    g.addColorStop(0.45, `hsla(${h}, ${s}%, ${l}%, ${b.alpha * 0.45})`);
    g.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground(time) {
    ctx.clearRect(0, 0, W, H);

    const t = time * 0.001;
    // scroll adds to the animation phase: scrolling down advances
    // the whole field, so the background "follows" the journey.
    const phase = state.smooth * 0.0016;
    const pulse = Math.min(Math.abs(state.velocity) * 0.0012, 0.5);

    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];

      // target position: autonomous drift + scroll-driven parallax
      b.tx = b.ax + Math.cos(t * b.sx + b.px + phase) * 0.20 + Math.sin(t * b.sx * 0.43 + b.px) * 0.05;
      b.ty = b.ay + Math.sin(t * b.sy + b.py + phase) * 0.18 - state.progress * 0.12 * b.depth;

      // smooth follow -> buttery, no jitter
      b.x = lerp(b.x, b.tx, 0.045);
      b.y = lerp(b.y, b.ty, 0.045);

      drawBlob(b, time + pulse * 400);
    }
  }

  /* ------------------------------------------------------------
     3. MASTER LOOP
     One tick drives the background, the parallax, the progress bar
     and the nav state, so everything stays perfectly in sync with
     the scroll position -> no lag, no tearing, no glitch.

     rAF is the primary driver. Some environments (background tabs,
     hidden frames, throttled windows) stop firing rAF, so a timer
     fallback keeps the background alive everywhere.
  ------------------------------------------------------------ */
  let last = performance.now();
  let lastTick = performance.now();
  let fallbackId = null;

  // cached values so the hot path never writes the same thing twice
  let lastScrollY = -1;
  let lastProgressPx = -1;
  let lastStuck = null;
  let lastSectionMeasure = 0;
  let lastVisibilityCheck = 0;
  let lastActiveCheck = 0;
  let viewportH = window.innerHeight;

  function tick(time) {
    const dt = Math.min(time - last, 50) || 16;
    last = time;
    lastTick = time;

    // --- scroll smoothing -----------------------------------
    const target = window.scrollY || window.pageYOffset || 0;
    state.raw = target;

    const prevSmooth = state.smooth;
    state.smooth = lerp(state.smooth, target, REDUCED ? 1 : 0.12);
    if (Math.abs(state.smooth - target) < 0.4) state.smooth = target;

    // instantaneous velocity, smoothed
    const v = (state.smooth - prevSmooth) / (dt / 16.67);
    state.velocity = lerp(state.velocity, v, 0.12);
    if (Math.abs(state.velocity) < 0.02) state.velocity = 0;

    state.progress = Math.min(1, Math.max(0, state.smooth / state.max));

    const moved = Math.abs(state.smooth - lastScrollY) > 0.4;

    // --- publish to CSS (only when the value actually moved) ---
    if (moved) {
      root.style.setProperty('--scrollY', state.smooth.toFixed(1));
      root.style.setProperty('--scrollP', state.progress.toFixed(3));
      lastScrollY = state.smooth;
    }

    // --- progress bar (throttled: it repaints a full-width layer)
    const progressPx = Math.round(state.progress * 1000) / 10;
    if (progressPx !== lastProgressPx) {
      const bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progressPx + '%';
      lastProgressPx = progressPx;
    }

    // --- nav state ------------------------------------------
    const stuck = state.raw > 40;
    if (stuck !== lastStuck) {
      nav.classList.toggle('is-stuck', stuck);
      lastStuck = stuck;
    }

    // --- active section + reveals (throttled, layout reads) ---
    if (time - lastActiveCheck > 120) {
      lastActiveCheck = time;
      updateActiveLink();
    }
    if (time - lastSectionMeasure > 800) {
      // the page height changes when an accordion opens, so refresh
      // the cached offsets now and then (5 cheap reads)
      lastSectionMeasure = time;
      measureSections();
    }
    if (moved && time - lastVisibilityCheck > 140) {
      lastVisibilityCheck = time;
      checkVisibility();
    }

    // --- background -----------------------------------------
    drawBackground(time);
  }

  function frame(time) {
    requestAnimationFrame(frame);
    tick(time);
  }

  // fallback for environments where rAF is paused
  function ensureFallback() {
    if (fallbackId) return;
    fallbackId = setInterval(() => {
      const now = performance.now();
      if (now - lastTick < 200) return;   // rAF is alive — let it drive
      tick(now);
    }, 32);
  }

  /* ------------------------------------------------------------
     4. REVEAL ON SCROLL + COUNTERS
     IntersectionObserver does the work when the browser is painting.
     Some environments (background tabs, throttled frames) never
     deliver observer callbacks, which would leave the page blank —
     so the master tick double-checks visibility and reveals
     anything that is in view. Nothing can get stuck invisible.
  ------------------------------------------------------------ */
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  const countEls = Array.from(document.querySelectorAll('[data-count]'));

  function checkVisibility() {
    const vh = window.innerHeight;

    for (let i = revealEls.length - 1; i >= 0; i--) {
      const el = revealEls[i];
      if (el.classList.contains('is-visible')) { revealEls.splice(i, 1); continue; }
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > -60) {
        el.classList.add('is-visible');
        revealEls.splice(i, 1);
      }
    }

    for (let i = countEls.length - 1; i >= 0; i--) {
      const el = countEls[i];
      if (el.dataset.done) { countEls.splice(i, 1); continue; }
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) {
        el.dataset.done = '1';
        animateCount(el);
        countEls.splice(i, 1);
      }
    }
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------
     5. ACTIVE NAV LINK  (position based — always accurate)
  ------------------------------------------------------------ */
  const nav = document.getElementById('nav');
  const navLinks = Array.from(document.querySelectorAll('.nav__links a'));
  const sections = navLinks
    .map((a) => ({ link: a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((s) => s.el);

  let activeLink = null;
  let sectionOffsets = [];

  // Section offsets are cached and refreshed on a slow timer, so the
  // scroll handler never forces a layout just to find the active link.
  function measureSections() {
    sectionOffsets = sections.map(function (s) {
      return { link: s.link, el: s.el, top: s.el.offsetTop };
    });
  }

  function updateActiveLink() {
    if (!sectionOffsets.length) {
      measureSections();
      if (!sectionOffsets.length) return;
    }
    // the "current" section is the last one whose top has passed
    // the reading line (a third down the viewport)
    const line = state.smooth + viewportH * 0.34;
    let current = null;
    for (const s of sectionOffsets) {
      if (s.top <= line) current = s;
    }
    // near the very bottom, always highlight the last section
    if (state.progress > 0.985 && sectionOffsets.length) current = sectionOffsets[sectionOffsets.length - 1];

    if (current && current.link !== activeLink) {
      navLinks.forEach((a) => {
        a.style.background = '';
        a.style.borderColor = '';
        a.style.transform = '';
      });
      current.link.style.background = 'var(--yellow)';
      current.link.style.borderColor = 'var(--edge)';
      current.link.style.transform = 'translateY(-2px)';
      activeLink = current.link;
    }
  }

  /* ------------------------------------------------------------
     6. MOBILE MENU
  ------------------------------------------------------------ */
  const navToggle = document.getElementById('navToggle');
  const navLinksWrap = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    const open = navLinksWrap.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  navLinksWrap.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      navLinksWrap.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && navLinksWrap.classList.contains('is-open')) {
      navLinksWrap.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ------------------------------------------------------------
     7. ANIMATED COUNTERS
  ------------------------------------------------------------ */
  const raf = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (fn) { return setTimeout(fn, 16); };

  function animateCount(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const start = performance.now();
    function step() {
      const now = performance.now();
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = prefix + val + suffix;
      if (p < 1) raf(step);
    }
    raf(step);
  }

  /* ------------------------------------------------------------
     8. TERMINAL TYPING (the "Make your own OS" hero)
  ------------------------------------------------------------ */
  const termBody = document.getElementById('termBody');
  if (termBody) {
    const LINES = [
      [{ t: '$ ', c: 't-dim' }, { t: 'make kernel', c: 't-cmd' }],
      [{ t: '[build] ', c: 't-dim' }, { t: 'linking bootloader ...', c: '' }],
      [{ t: '[build] ', c: 't-dim' }, { t: 'linking kernel.bin  ', c: '' }, { t: 'OK', c: 't-ok' }],
      [{ t: '[run  ] ', c: 't-dim' }, { t: 'qemu -drive format=raw,file=os.bin', c: '' }],
      [{ t: '[ok  ] ', c: 't-dim' }, { t: 'GRUB loaded. 1280x800. Entering protected mode.', c: '' }],
      [{ t: 'Build with YOU — you are now an OS developer.', c: 't-hi' }]
    ];

    if (REDUCED) {
      termBody.innerHTML = LINES.map((line) =>
        line.map((p) => `<span class="${p.c}">${escapeHtml(p.t)}</span>`).join('')
      ).join('\n');
    } else {
      // flatten the script into a stream of (char, class) pairs
      const stream = [];
      LINES.forEach((line, idx) => {
        line.forEach((p) => {
          for (const ch of p.t) stream.push({ ch: ch, c: p.c });
        });
        if (idx < LINES.length - 1) stream.push({ ch: '\n', c: '' });
      });

      // Build the DOM incrementally — re-parsing innerHTML for every
      // character is what makes a typing effect stutter on slow phones.
      const cursorEl = document.createElement('span');
      cursorEl.className = 't-cursor';
      cursorEl.textContent = '▊';

      let openSpan = null;
      let i = 0;

      function typeNext() {
        if (i >= stream.length) {
          if (openSpan) { termBody.appendChild(openSpan); openSpan = null; }
          return;
        }
        const item = stream[i++];

        if (item.c !== (openSpan ? openSpan.className : null)) {
          if (openSpan) { termBody.appendChild(openSpan); openSpan = null; }
          if (item.c) {
            openSpan = document.createElement('span');
            openSpan.className = item.c;
          }
        }
        const text = document.createTextNode(item.ch);
        if (openSpan) openSpan.appendChild(text);
        else termBody.appendChild(text);

        termBody.appendChild(cursorEl);   // keep the caret at the end
        setTimeout(typeNext, item.ch === '\n' ? 120 : 18);
      }

      termBody.textContent = '';
      termBody.appendChild(cursorEl);
      setTimeout(typeNext, 350);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------
     9. FEATURED COURSE CARD TILT
  ------------------------------------------------------------ */
  const courseHero = document.querySelector('.course-hero');
  if (courseHero && !REDUCED && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    courseHero.addEventListener('pointermove', (e) => {
      const r = courseHero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      courseHero.style.transform =
        `perspective(1400px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translate3d(0,0,0)`;
    });
    courseHero.addEventListener('pointerleave', () => {
      courseHero.style.transform = '';
    });
  }

  /* ------------------------------------------------------------
     10. MODULE / FAQ ACCORDIONS — one open at a time
  ------------------------------------------------------------ */
  const modGroups = [
    { container: document.getElementById('modules'), tag: 'module' },
    { container: document.querySelector('.faq'), tag: 'faq__item' }
  ];
  modGroups.forEach((grp) => {
    if (!grp.container) return;
    grp.container.addEventListener('click', (e) => {
      const summary = e.target.closest('summary');
      if (!summary) return;
      // we drive the open state ourselves, so cancel the native toggle
      e.preventDefault();
      const parent = summary.parentElement;
      const willOpen = !parent.open;
      grp.container.querySelectorAll('details').forEach((d) => { d.open = false; });
      parent.open = willOpen;
    });
  });

  /* ------------------------------------------------------------
     11. COURSE MODAL
     Enroll Free -> phase by phase breakdown.
     Phase 1 (Beginner) is free and open.
     Phase 2/3 are locked + blurred: complete the previous phase
     or unlock everything with the $4.99 / month membership.
  ------------------------------------------------------------ */
  const COURSES = {
    os: {
      badge: 'Course 01',
      tag: 'Flagship',
      title: 'Make your own OS',
      lead: 'Write a real, bootable operating system from an empty folder — bootloader, kernel, interrupts, paging, processes, filesystem and a shell. Your code boots the machine.',
      meta: [['Level', 'Beginner → Advanced'], ['Lessons', '48 video · 26 labs'], ['Language', 'C, x86-64 ASM'], ['Length', '12 weeks'], ['Cost', 'Phase 1 free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'Foundations', weeks: 'Weeks 1–4', state: 'open',
          summary: 'Meet the bare machine. You start with nothing but a CPU and a board, and finish with a kernel that boots, prints and reads your keyboard.',
          items: [
            { t: 'The Bare Metal World', d: 'Registers, the stack, memory-mapped IO and exactly what happens between power-on and your first instruction.', len: '22 min' },
            { t: 'Writing the Bootloader', d: '16-bit assembly, BIOS interrupts, loading a kernel off disk and switching the CPU into protected mode.', len: '31 min' },
            { t: 'Your First Kernel', d: 'Kernel entry point, jumping to 64-bit long mode, and printing to the screen with a linker script you wrote.', len: '28 min' },
            { t: 'Debugging Like a Kernel Dev', d: 'QEMU, GDB, breakpoints, memory dumps — the habits that make the rest of the course painless.', len: '19 min' }
          ],
          lab: { t: 'Lab 1–3: flash a bootloader, boot a kernel, print to screen', d: 'A bootable os.bin that says "Build with YOU". Free tools only: QEMU, GCC, NASM, make.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Kernel Engineering', weeks: 'Weeks 5–8', state: 'locked',
          summary: 'The kernel stops being a demo and starts being a real system: the CPU talks back to you, and memory becomes something you manage.',
          items: [
            { t: 'Interrupts & the IDT', d: 'The CPU calling back into your code, and an interrupt descriptor table that makes it all make sense.', len: '34 min' },
            { t: 'Timers & Preemption', d: 'The programmable interval timer, tick handling and giving each program a fair slice of the CPU.', len: '27 min' },
            { t: 'Paging & Virtual Memory', d: 'CR3, page tables, the TLB, page faults — and the first heap you wrote yourself.', len: '41 min' },
            { t: 'Processes & System Calls', d: 'Task control blocks, context switching, and the boundary between user code and your kernel.', len: '36 min' }
          ],
          lab: { t: 'Lab 4–6: a keyboard driver, a heap allocator, three processes at once', d: 'Type on the host keyboard and watch it appear in your own OS.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Full Systems', weeks: 'Weeks 9–12', state: 'locked',
          summary: 'Storage, users, and the finish line: an operating system you can plug into a USB stick and boot on real hardware.',
          items: [
            { t: 'Filesystem & Drivers', d: 'Inodes, directories, a RAM disk image and a driver model that lets you add hardware.', len: '38 min' },
            { t: 'A Shell of Your Own', d: 'Command parsing, pipes, redirection and a prompt that feels like home.', len: '29 min' },
            { t: 'Booting Real Hardware', d: 'From QEMU to a USB stick: GRUB, boot order, and the moment your OS takes over a real laptop.', len: '24 min' }
          ],
          lab: { t: 'Final project: ship your OS as a bootable USB image', d: 'A portfolio project nobody can buy.' }
        }
      ]
    },

    web: {
      badge: 'Course 02', tag: 'Web', title: 'Web from Scratch',
      lead: 'HTML, CSS and JavaScript explained the way a browser actually works — then a full-stack app you deploy and people can use.',
      meta: [['Level', 'Beginner → Intermediate'], ['Lessons', '28 lessons'], ['Stack', 'HTML, CSS, JS'], ['Length', '6 weeks'], ['Cost', 'Phase 1 free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'Web Fundamentals', weeks: 'Weeks 1–2', state: 'open',
          summary: 'How the browser turns text into pixels, and how to write pages that behave the way you expect.',
          items: [
            { t: 'HTML: structure that lasts', d: 'Semantic markup, forms, and why accessibility comes free with it.', len: '26 min' },
            { t: 'CSS: layout without guessing', d: 'The box model, flexbox and grid — and how to debug a layout that refuses to cooperate.', len: '38 min' },
            { t: 'JavaScript for the DOM', d: 'Events, state and the browser event loop, explained with diagrams.', len: '34 min' },
            { t: 'Responsive from scratch', d: 'One layout that works on a phone, a laptop and a 4K monitor.', len: '22 min' }
          ],
          lab: { t: 'Lab: build a responsive landing page from a blank file', d: 'No framework, no starter template.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Real Applications', weeks: 'Weeks 3–4', state: 'locked',
          summary: 'Stop making pages. Start making applications that talk to a server and keep their own state.',
          items: [
            { t: 'Async JavaScript', d: 'Promises, async/await, and what actually happens while you await.', len: '31 min' },
            { t: 'APIs & the Fetch API', d: 'Talk to a real API, handle errors, and render the result.', len: '27 min' },
            { t: 'A Backend in One File', d: 'Build a small server with a database and a real REST endpoint.', len: '44 min' },
            { t: 'State & Forms', d: 'Validation, optimistic updates and forms that survive a refresh.', len: '25 min' }
          ],
          lab: { t: 'Lab: a weather app with live data and error states', d: 'Deployed and shareable.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Production', weeks: 'Weeks 5–6', state: 'locked',
          summary: 'Ship it: build systems, testing, CI/CD and the deployment pipeline that makes updates painless.',
          items: [
            { t: 'Tooling & Bundlers', d: 'Modules, npm, and a build step you actually understand.', len: '36 min' },
            { t: 'Testing that pays off', d: 'Unit, integration and end-to-end — and when each one is worth it.', len: '33 min' },
            { t: 'CI/CD & Deployment', d: 'Push to main, get a live URL. Then fix it when it breaks.', len: '30 min' }
          ],
          lab: { t: 'Final project: ship a full-stack app', d: 'Your own domain and analytics.' }
        }
      ]
    },

    python: {
      badge: 'Course 03', tag: 'Beginner friendly', title: 'Python for Absolute Beginners',
      lead: 'Your first program in twenty minutes, then scripts, files, APIs and a bot that runs while you sleep.',
      meta: [['Level', 'Beginner'], ['Lessons', '24 lessons'], ['Stack', 'Python 3'], ['Length', '4 weeks'], ['Cost', 'Free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'First Programs', weeks: 'Weeks 1–2', state: 'open',
          summary: 'Zero experience needed. You write real code in the first lesson and keep going from there.',
          items: [
            { t: 'Your First Program', d: 'Variables, printing and the difference between text and numbers.', len: '18 min' },
            { t: 'Making Decisions', d: 'if/else, comparisons and the art of readable conditions.', len: '21 min' },
            { t: 'Loops & Lists', d: 'Repeating work without repeating yourself.', len: '24 min' },
            { t: 'Functions & Files', d: 'Package logic into functions, then save and read real files.', len: '29 min' }
          ],
          lab: { t: 'Lab: a script that renames 200 files for you', d: 'Run it on your own folder.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Automation & Data', weeks: 'Weeks 3', state: 'locked',
          summary: 'Turn your scripts into tools that work on their own: scheduling, APIs and cleaning messy data.',
          items: [
            { t: 'Modules & Virtual Environments', d: 'Organise code so tomorrow-you can find it.', len: '26 min' },
            { t: 'APIs with Python', d: 'Fetch, parse and post real data.', len: '28 min' },
            { t: 'Working With Data', d: 'Dictionaries, CSVs, JSON and the one-liners that replace a whole spreadsheet.', len: '32 min' },
            { t: 'Scheduling & Automation', d: 'cron, tasks and a bot that works while you sleep.', len: '23 min' }
          ],
          lab: { t: 'Lab: a daily bot that posts a summary to chat', d: 'Runs on your machine, every morning.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Engineering in Python', weeks: 'Weeks 4', state: 'locked',
          summary: 'Write Python other people can maintain: types, structure, tests and packaging.',
          items: [
            { t: 'OOP & Dataclasses', d: 'Model your data so the code explains itself.', len: '34 min' },
            { t: 'Type Hints', d: 'Catch bugs before you run the code.', len: '22 min' },
            { t: 'Testing & Packaging', d: 'pytest, and shipping a package other people can pip install.', len: '36 min' }
          ],
          lab: { t: 'Final project: publish a Python package', d: 'On PyPI, with docs.' }
        }
      ]
    },

    arch: {
      badge: 'Course 04', tag: 'Systems', title: 'Computer Architecture',
      lead: 'Caches, pipelines and branch prediction, visualised. The theory that makes your OS course finally click.',
      meta: [['Level', 'Beginner → Advanced'], ['Lessons', '22 lessons'], ['Stack', 'C, simulators'], ['Length', '5 weeks'], ['Cost', 'Phase 1 free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'How a CPU Thinks', weeks: 'Weeks 1–2', state: 'open',
          summary: 'Start from ones and zeros and end up holding a complete mental model of a processor.',
          items: [
            { t: 'Numbers & Logic', d: 'Binary, hex, two\'s complement and gates that turn them into decisions.', len: '25 min' },
            { t: 'The CPU Anatomy', d: 'Registers, the fetch-decode-execute cycle and what an instruction really is.', len: '31 min' },
            { t: 'Memory & the Hierarchy', d: 'RAM, cache and disk, and why access time is not free.', len: '27 min' },
            { t: 'Assembly Basics', d: 'Reading and writing x86-64 assembly without panicking.', len: '33 min' }
          ],
          lab: { t: 'Lab: trace a program instruction by instruction', d: 'A hand-written simulator shows every step.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Performance', weeks: 'Weeks 3–4', state: 'locked',
          summary: 'Why one line of code is 50x faster than another — and how to measure it instead of guessing.',
          items: [
            { t: 'Pipelining & Hazards', d: 'Overlapping instructions, and the stalls that sneak in.', len: '29 min' },
            { t: 'Caches in Detail', d: 'Direct-mapped, set-associative and the LRU myth.', len: '34 min' },
            { t: 'Branch Prediction', d: 'How the CPU guesses, and what happens when it guesses wrong.', len: '26 min' },
            { t: 'Measuring Things', d: 'Benchmarking honestly: warm-up, noise and honest numbers.', len: '30 min' }
          ],
          lab: { t: 'Lab: build a cache simulator and beat the naive version', d: 'Measured, not guessed.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Modern Execution', weeks: 'Week 5', state: 'locked',
          summary: 'Superscalar cores, SIMD and the tricks compilers use so you do not have to.',
          items: [
            { t: 'Superscalar & ILP', d: 'More instructions per cycle, and why they cannot all run at once.', len: '35 min' },
            { t: 'Vectorisation', d: 'AVX, data layout and writing loops the CPU loves.', len: '32 min' },
            { t: 'Profilers & Counters', d: 'Hardware counters that tell you exactly where the cycles went.', len: '28 min' }
          ],
          lab: { t: 'Final project: make a hot loop 10x faster', d: 'With a before/after profile to prove it.' }
        }
      ]
    },

    neural: {
      badge: 'Course 05', tag: 'AI', title: 'Neural Networks from Scratch',
      lead: 'No frameworks. Just tensors, gradients and a network you write with your own hands in NumPy.',
      meta: [['Level', 'Beginner → Advanced'], ['Lessons', '26 lessons'], ['Stack', 'NumPy, PyTorch'], ['Length', '6 weeks'], ['Cost', 'Phase 1 free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'Math & Tensors', weeks: 'Weeks 1–2', state: 'open',
          summary: 'The maths you actually need — explained with pictures, not notation dumps.',
          items: [
            { t: 'Vectors & Matrices', d: 'The only linear algebra you need to start.', len: '26 min' },
            { t: 'Tensors in NumPy', d: 'Broadcasting, shapes and the mistakes everybody makes once.', len: '30 min' },
            { t: 'Functions & Derivatives', d: 'What a gradient is, and why it points downhill.', len: '33 min' },
            { t: 'The Chain Rule', d: 'Backpropagation without hand-waving.', len: '28 min' }
          ],
          lab: { t: 'Lab: implement gradient descent by hand', d: 'Watch a loss curve fall.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Building Networks', weeks: 'Weeks 3–4', state: 'locked',
          summary: 'Layers, activations and training loops — the full recipe, written out line by line.',
          items: [
            { t: 'The Perceptron', d: 'Your first neuron, and how it learns.', len: '25 min' },
            { t: 'Layers & Activation', d: 'Building depth, and why activations matter.', len: '31 min' },
            { t: 'Training Loops', d: 'Batches, epochs, learning rates and loss curves.', len: '34 min' },
            { t: 'From NumPy to PyTorch', d: 'Same network, two implementations, one insight.', len: '29 min' }
          ],
          lab: { t: 'Lab: train a classifier on your own handwriting', d: 'A neural network you wrote yourself.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Real Models', weeks: 'Weeks 5–6', state: 'locked',
          summary: 'Overfitting, regularisation and shipping a model that behaves in the wild.',
          items: [
            { t: 'Overfitting & Regularisation', d: 'Dropout, weight decay and data augmentation.', len: '32 min' },
            { t: 'Evaluation & Metrics', d: 'Accuracy can lie. Learn what it hides.', len: '27 min' },
            { t: 'Serving a Model', d: 'An API around your network, with real inference.', len: '30 min' }
          ],
          lab: { t: 'Final project: deploy your own model', d: 'Live endpoint, documented.' }
        }
      ]
    },

    linux: {
      badge: 'Course 06', tag: 'Systems', title: 'Linux & the Shell',
      lead: 'Processes, pipes, permissions and a shell you stop googling and start writing.',
      meta: [['Level', 'Beginner → Intermediate'], ['Lessons', '19 lessons'], ['Stack', 'Bash, systemd'], ['Length', '4 weeks'], ['Cost', 'Free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'Command Line Fluency', weeks: 'Weeks 1–2', state: 'open',
          summary: 'The shell is a language. Learn the grammar and the terminal stops being scary.',
          items: [
            { t: 'Files & Navigation', d: 'Paths, permissions and moving around without a mouse.', len: '22 min' },
            { t: 'Pipes & Redirection', d: 'Chaining commands into real tools.', len: '26 min' },
            { t: 'Text Tools', d: 'grep, sed, awk and friends — with realistic examples.', len: '31 min' },
            { t: 'Processes & Signals', d: 'What is running, and how to stop it.', len: '24 min' }
          ],
          lab: { t: 'Lab: build a log analyser with grep + awk', d: 'Ten lines, genuinely useful.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Running Systems', weeks: 'Weeks 3', state: 'locked',
          summary: 'Services, networking and the machine you are responsible for at 2am.',
          items: [
            { t: 'systemd & Services', d: 'Units, restarts, logs and why "it worked after reboot" is a bug report.', len: '30 min' },
            { t: 'Networking Basics', d: 'Ports, DNS, curl and reading a packet capture.', len: '28 min' },
            { t: 'Users & Security', d: 'SSH keys, sudo hygiene and a locked-down server.', len: '26 min' }
          ],
          lab: { t: 'Lab: deploy and monitor a tiny service', d: 'With a real restart policy.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Containers & Ops', weeks: 'Week 4', state: 'locked',
          summary: 'Ship the same way the big teams do: containers, pipelines and repeatable environments.',
          items: [
            { t: 'Containers', d: 'Images, layers and why "works on my machine" happens.', len: '29 min' },
            { t: 'CI on a Server', d: 'Push to test, deploy on green.', len: '27 min' },
            { t: 'Hardening Basics', d: 'Firewalls, updates and a checklist that fits on one page.', len: '25 min' }
          ],
          lab: { t: 'Final project: a self-hosted, auto-deployed service', d: 'With HTTPS and backups.' }
        }
      ]
    },

    security: {
      badge: 'Course 07', tag: 'Security', title: 'Web Security Basics',
      lead: 'OWASP top 10 with live labs: XSS, SQLi, CSRF — break them on purpose, then fix them for good.',
      meta: [['Level', 'Beginner → Intermediate'], ['Lessons', '21 lessons'], ['Stack', 'Web + Linux'], ['Length', '4 weeks'], ['Cost', 'Free']],
      phases: [
        {
          id: 'p1', tier: 'Beginner', name: 'How the Web Works', weeks: 'Weeks 1–2', state: 'open',
          summary: 'Understand the machine before you try to break it — requests, responses, cookies and sessions.',
          items: [
            { t: 'HTTP & the Browser Model', d: 'Requests, responses, headers and what your browser trusts.', len: '24 min' },
            { t: 'Cookies & Sessions', d: 'Where identity lives, and why it is a target.', len: '22 min' },
            { t: 'Authentication Patterns', d: 'Passwords, tokens, OAuth and what each one actually protects.', len: '29 min' }
          ],
          lab: { t: 'Lab: read a session cookie and predict the attack', d: 'On a deliberately vulnerable app.' }
        },
        {
          id: 'p2', tier: 'Intermediate', name: 'Attacks & Defence', weeks: 'Weeks 3', state: 'locked',
          summary: 'Break the OWASP top 10 in a safe lab, then defend against every one of them.',
          items: [
            { t: 'Injection & XSS', d: 'SQLi and cross-site scripting, exploited on purpose.', len: '33 min' },
            { t: 'CSRF & SSRF', d: 'Forcing the browser to do what the attacker wants.', len: '27 min' },
            { t: 'Broken Access Control', d: 'The quiet, devastating one. And its fixes.', len: '30 min' }
          ],
          lab: { t: 'Lab: exploit, then patch, a vulnerable web app', d: 'Attack on the left, fix on the right.' }
        },
        {
          id: 'p3', tier: 'Advanced', name: 'Hardening & Shipping', weeks: 'Week 4', state: 'locked',
          summary: 'Turn a working app into one you would be comfortable putting in front of real users.',
          items: [
            { t: 'Headers & CSP', d: 'Defence in depth, one response header at a time.', len: '26 min' },
            { t: 'Secrets & Storage', d: 'Never commit a key again.', len: '22 min' },
            { t: 'Logging & Response', d: 'Knowing what happened, and what to do about it.', len: '25 min' }
          ],
          lab: { t: 'Final project: harden a full app to a checklist', d: 'Prove it with a scanner.' }
        }
      ]
    }
  };

  const PRO_PRICE = '4.99';

  // Pro status is remembered in the browser, so joining once unlocks
  // every course — on this device, forever.
  function readPro() {
    try { return localStorage.getItem('bwy_pro') === '1'; } catch (e) { return false; }
  }
  function writePro() {
    try { localStorage.setItem('bwy_pro', '1'); } catch (e) {}
  }

  const modal = document.getElementById('courseModal');
  const elBadge = document.getElementById('modalBadge');
  const elTag = document.getElementById('modalTag');
  const elTitle = document.getElementById('modalTitle');
  const elLead = document.getElementById('modalLead');
  const elMeta = document.getElementById('modalMeta');
  const elPhases = document.getElementById('phaseList');
  const elDetail = document.getElementById('phaseDetail');
  const elFootnote = document.getElementById('modalFootnote');
  const toast = document.getElementById('toast');

  let activeCourse = null;
  let activeCourseId = null;
  let activePhase = null;
  let proActive = Auth.hasPro();
  let lastFocused = null;

  function phaseNumber(p) {
    return activeCourse.phases.indexOf(p) + 1;
  }

  function isLocked(p) {
    return p.state === 'locked' && !proActive;
  }

  function phaseMeta(p) {
    const n = phaseNumber(p);
    return {
      tierClass: n === 1 ? '' : (n === 2 ? ' pd__tier--mid' : ' pd__tier--adv')
    };
  }

  function renderPhaseRail() {
    elPhases.innerHTML = activeCourse.phases.map((p, i) => {
      const locked = isLocked(p);
      return '<button class="phase' + (p.id === activePhase ? ' is-active' : '') + '" type="button" data-phase="' + p.id + '">' +
        '<span class="phase__num' + (locked ? ' phase__num--locked' : '') + '">' + (locked ? '&#128274;' : String(i + 1).padStart(2, '0')) + '</span>' +
        '<span class="phase__info">' +
          '<span class="phase__name">' + escapeHtml(p.name) + '</span>' +
          '<span class="phase__sub">' + escapeHtml(p.tier) + ' &middot; ' + escapeHtml(p.weeks) + '</span>' +
        '</span>' +
        '<span class="phase__state' + (locked ? ' phase__state--locked' : '') + '">' + (locked ? 'Locked' : 'Free') + '</span>' +
      '</button>';
    }).join('');
  }

  function lessonList(p) {
    return '<ol class="pd__list">' + p.items.map((it, i) =>
      '<li>' +
        '<span class="pd__num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span><span class="pd__t">' + escapeHtml(it.t) + '</span><span class="pd__d">' + escapeHtml(it.d) + '</span></span>' +
        '<span class="pd__len">' + escapeHtml(it.len) + '</span>' +
      '</li>'
    ).join('') + '</ol>';
  }

  function renderOpenPhase(p) {
    const n = phaseNumber(p);
    const m = phaseMeta(p);
    const isFirst = n === 1;
    elDetail.innerHTML =
      '<span class="pd__freebadge">&#10003; Free &middot; included forever</span>' +
      '<span class="pd__tier' + m.tierClass + '">' + escapeHtml(p.tier) + '</span>' +
      '<h3 class="pd__title">Phase ' + n + ' &mdash; ' + escapeHtml(p.name) + '</h3>' +
      '<p class="pd__summary">' + escapeHtml(p.summary) + '</p>' +
      lessonList(p) +
      (p.lab ? '<div class="pd__lab">&#128187; ' + escapeHtml(p.lab.t) + '<small>' + escapeHtml(p.lab.d) + '</small></div>' : '') +
      '<div class="pd__cta">' +
        '<button class="btn btn--dark" type="button" data-start="' + p.id + '">Start Phase ' + n + '</button>' +
        (isFirst
          ? '<button class="btn btn--ghost" type="button" data-locked-preview="' + (activeCourse.phases[1] ? activeCourse.phases[1].id : '') + '">See what comes next &rarr;</button>'
          : '') +
      '</div>';
  }

  function renderLockedPhase(p) {
    const n = phaseNumber(p);
    const prev = activeCourse.phases[n - 2];
    const m = phaseMeta(p);
    elDetail.innerHTML =
      '<span class="pd__tier' + m.tierClass + '">' + escapeHtml(p.tier) + ' &middot; LOCKED</span>' +
      '<h3 class="pd__title">Phase ' + n + ' &mdash; ' + escapeHtml(p.name) + '</h3>' +
      '<p class="pd__summary">' + escapeHtml(p.summary) + '</p>' +
      '<div class="pd__blur" aria-hidden="true">' + lessonList(p) + '</div>' +
      '<div class="pd__lock">' +
        '<span class="pd__lockicon">&#128274;</span>' +
        '<h4>Locked &mdash; complete Phase ' + (n - 1) + ' to unlock</h4>' +
        '<p>Phase ' + (n - 1) + ' &mdash; <b>' + escapeHtml(prev ? prev.name : '') + '</b> &mdash; is free and waiting for you. ' +
        'Or unlock every phase of every course right now with Pro: a nominal <b>$' + PRO_PRICE + ' per month</b>, and every dollar of it funds the next course.</p>' +
        '<div class="pd__cta" style="justify-content:center">' +
          '<button class="btn btn--big btn--ghost" type="button" data-goto="' + (prev ? prev.id : '') + '">Back to Phase ' + (n - 1) + ' (free)</button>' +
        '</div>' +
      '</div>' +
      '<div class="pd__pay pd__pay--compact">' +
        '<span class="pd__tier pd__tier--pro">Pro membership</span>' +
        '<h3>$' + PRO_PRICE + ' <small>/ month</small></h3>' +
        '<span class="pd__price-note">nominal &middot; cancel anytime</span>' +
        '<p class="pd__paylead">Unlock Phase ' + n + ' and every other phase of every course the moment you join.</p>' +
        '<ul class="pd__perks">' +
          '<li>Phase 2 &amp; Phase 3 of this course, unlocked</li>' +
          '<li>All 42 courses, every phase, no limits</li>' +
          '<li>Downloadable labs, source code and datasets</li>' +
          '<li>Certificates for completed phases</li>' +
          '<li>100% of Pro directly funds the creator</li>' +
        '</ul>' +
        '<div class="pd__payactions">' +
          '<button class="btn btn--big btn--yellow" type="button" data-join>Join Pro &mdash; $' + PRO_PRICE + ' / month</button>' +
          '<button class="btn btn--big btn--ghost" type="button" data-goto="' + (activeCourse.phases[0].id) + '">Stay on the free phase</button>' +
        '</div>' +
        '<p class="pd__fine">Phase 1 stays free forever &middot; cancel any time</p>' +
      '</div>';
  }

  function renderDetail() {
    const p = activeCourse.phases.find((x) => x.id === activePhase) || activeCourse.phases[0];
    activePhase = p.id;
    if (isLocked(p)) {
      renderLockedPhase(p);
      elFootnote.textContent = 'Phase 1 is free forever. Phases 2–3 need Pro ($' + PRO_PRICE + '/month) — which supports the creator.';
    } else {
      renderOpenPhase(p);
      elFootnote.textContent = 'Phase 1 is free, forever. No card, no sign-up.';
    }
    renderPhaseRail();
  }

  function openCourse(id, phaseId) {
    const course = COURSES[id];
    if (!course) return;
    activeCourse = course;
    activeCourseId = id;
    activePhase = (phaseId && course.phases.some((p) => p.id === phaseId)) ? phaseId : course.phases[0].id;

    elBadge.textContent = course.badge;
    elTag.textContent = course.tag;
    elTitle.textContent = course.title;
    elLead.textContent = course.lead;
    elMeta.innerHTML = course.meta.map((m) =>
      '<span class="mchip' + (/^Free|Phase 1/.test(m[1]) ? ' mchip--free' : '') + '"><b>' + escapeHtml(m[0]) + '</b>' + escapeHtml(m[1]) + '</span>'
    ).join('');

    renderDetail();

    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const close = modal.querySelector('.modal__close');
      if (close) close.focus();
    }, 60);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  // open from any "Enroll Free" button
  document.addEventListener('click', (e) => {
    const enroll = e.target.closest('[data-enroll]');
    if (enroll) {
      e.preventDefault();
      openCourse(enroll.dataset.enroll);
      return;
    }

    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      e.preventDefault();
      closeModal();
      return;
    }
    const phaseBtn = e.target.closest('[data-phase]');
    if (phaseBtn && modal.classList.contains('is-open')) {
      activePhase = phaseBtn.dataset.phase;
      renderDetail();
      return;
    }

    const goto = e.target.closest('[data-goto]');
    if (goto && goto.dataset.goto) {
      activePhase = goto.dataset.goto;
      renderDetail();
      return;
    }

    const paywall = e.target.closest('[data-paywall]');
    if (paywall) {
      const panel = elDetail.querySelector('.pd__pay');
      if (panel) panel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      return;
    }

    const preview = e.target.closest('[data-locked-preview]');
    if (preview && preview.dataset.lockedPreview) {
      activePhase = preview.dataset.lockedPreview;
      renderDetail();
      return;
    }

    const join = e.target.closest('[data-join]');
    if (join) {
      // hand over to the checkout page, keeping the course context
      const q = 'checkout.html?course=' + encodeURIComponent(activeCourseId || 'os') +
                '&phase=' + encodeURIComponent(activePhase) +
                '&name=' + encodeURIComponent(activeCourse ? activeCourse.title : '');
      window.location.href = q;
      return;
    }

    const start = e.target.closest('[data-start]');
    if (start) {
      const p = activeCourse.phases.find((x) => x.id === start.dataset.start);
      showToast('Enrolled in Phase ' + phaseNumber(p) + ' — ' + p.name + '. Let\'s go!');
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // Returning from checkout: ?course=os&phase=p2 -> reopen that course
  (function openFromCheckout() {
    const qp = new URLSearchParams(window.location.search);
    const cid = qp.get('course');
    if (!cid || !COURSES[cid]) return;
    // jump to the courses section first (the modal locks body scroll)
    const target = document.getElementById('courses');
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    }
    openCourse(cid, qp.get('phase'));
  })();

  /* ------------------------------------------------------------
     11.5 ACCOUNT + THEME
     The nav reflects the signed-in member, and the theme toggle
     switches the whole site between light and dark.
  ------------------------------------------------------------ */
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const accountLink = document.getElementById('accountLink');
  const accountIcon = document.getElementById('accountIcon');
  const accountLabel = document.getElementById('accountLabel');

  function paintThemeIcon() {
    if (!themeIcon) return;
    const pref = Auth.getTheme();
    const eff = Auth.effectiveTheme();
    themeIcon.textContent = pref === 'system' ? '◐' : (eff === 'dark' ? '☾' : '☀');
    themeToggle.setAttribute('title',
      pref === 'system' ? 'Theme: system (' + eff + ')' : 'Theme: ' + eff + ' — click to switch');
  }

  function paintAccount() {
    if (!accountLink) return;
    const user = Auth.getUser();
    accountLink.classList.remove('is-pro', 'is-admin');
    if (!user) {
      accountIcon.textContent = '👤';
      accountLabel.textContent = 'Sign in';
      accountLink.setAttribute('href', 'login.html');
      accountLink.setAttribute('aria-label', 'Sign in');
      return;
    }
    accountIcon.textContent = user.role === 'admin' ? '★' : (Auth.hasPro() ? '⚡' : '👤');
    accountLabel.textContent = user.role === 'admin' ? 'Admin' : (user.name || user.email).split(' ')[0];
    accountLink.setAttribute('href', user.role === 'admin' ? 'admin.html' : 'account.html');
    accountLink.setAttribute('aria-label', 'Signed in as ' + (user.name || user.email));
    if (user.role === 'admin') accountLink.classList.add('is-admin');
    else if (Auth.hasPro()) accountLink.classList.add('is-pro');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const eff = Auth.effectiveTheme();
      Auth.setTheme(eff === 'dark' ? 'light' : 'dark');
      paintThemeIcon();
      paintAccount();
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (Auth.getTheme() === 'system') { Auth.applyTheme(); paintThemeIcon(); }
    });
  }

  // keep the nav in sync no matter who changed the theme
  if (window.MutationObserver && root.getAttribute('data-theme')) {
    new MutationObserver(function () {
      paintThemeIcon();
      paintAccount();
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  paintThemeIcon();
  paintAccount();

  /* ------------------------------------------------------------
     12. LIFECYCLE
  ------------------------------------------------------------ */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      viewportH = window.innerHeight;
      resizeCanvas();
      makeBlobs();
      measureSections();
      measure();
    }, 120);
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => { resizeCanvas(); measure(); }, 250);
  });

  document.addEventListener('visibilitychange', () => {
    // rAF is paused by the browser while hidden; reset the clock so the
    // scroll velocity doesn't spike when we come back.
    last = performance.now();
    if (!document.hidden) ensureFallback();
  });

  // re-measure when layout settles (fonts, images)
  window.addEventListener('load', () => {
    measure();
    measureSections();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { measure(); measureSections(); }).catch(() => {});
  }

  // year stamp
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // boot
  makeBlobs();
  resizeCanvas();
  measure();
  measureSections();
  viewportH = window.innerHeight;
  state.smooth = window.scrollY || 0;
  state.raw = state.smooth;
  last = performance.now();
  lastTick = last;
  tick(last);          // paint one frame right away (no waiting on rAF)
  checkVisibility();   // reveal whatever is already on screen
  requestAnimationFrame(frame);
  ensureFallback();
})();
