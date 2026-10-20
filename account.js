/* ============================================================
   Build with YOU — member account page
   ============================================================ */
(function () {
  'use strict';

  /* background (same engine) */
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0;
  const PALETTE = [
    { h: 44, s: 100, l: 66 }, { h: 340, s: 100, l: 68 }, { h: 188, s: 96, l: 58 },
    { h: 262, s: 100, l: 76 }, { h: 22, s: 100, l: 65 }, { h: 142, s: 85, l: 66 }
  ];
  const blobs = [];
  function makeBlobs() {
    blobs.length = 0;
    for (let i = 0; i < 6; i++) {
      const p = PALETTE[i % PALETTE.length];
      blobs.push({
        color: p, ax: 0.12 + Math.random() * 0.76, ay: 0.10 + Math.random() * 0.80,
        x: 0, y: 0, tx: 0, ty: 0, r: 0.22 + Math.random() * 0.24,
        sx: 0.10 + Math.random() * 0.20, sy: 0.08 + Math.random() * 0.18,
        px: Math.random() * Math.PI * 2, py: Math.random() * Math.PI * 2,
        alpha: 0.30 + Math.random() * 0.22
      });
    }
  }
  function resizeCanvas() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function drawBackground(time) {
    ctx.clearRect(0, 0, W, H);
    const t = time * 0.001;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      b.tx = b.ax + Math.cos(t * b.sx + b.px) * 0.20;
      b.ty = b.ay + Math.sin(t * b.sy + b.py) * 0.18;
      b.x = lerp(b.x, b.tx, 0.05); b.y = lerp(b.y, b.ty, 0.05);
      const radius = b.r * Math.min(W, H);
      const x = b.x * W, y = b.y * H;
      const g = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
      const h = (b.color.h + t * 8) % 360;
      const a = dark ? b.alpha * 0.7 : b.alpha;
      g.addColorStop(0, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,' + a + ')');
      g.addColorStop(0.45, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,' + (a * 0.45) + ')');
      g.addColorStop(1, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  let lastTick = performance.now();
  function tick(time) { lastTick = time; drawBackground(time); }
  function frame(time) { requestAnimationFrame(frame); tick(time); }
  function ensureFallback() {
    setInterval(() => { const n = performance.now(); if (n - lastTick < 200) return; tick(n); }, 32);
  }
  makeBlobs(); resizeCanvas(); tick(performance.now());
  requestAnimationFrame(frame); ensureFallback();
  window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resizeCanvas, 120); });

  /* ---------------- page ---------------- */
  const locked = document.getElementById('locked');
  const panels = document.getElementById('panels');
  const themesEl = document.getElementById('themes');

  const COURSE_LIST = [
    { id: 'os', name: 'Make your own OS', phase: 'Phase 1 — Foundations' },
    { id: 'web', name: 'Web from Scratch', phase: 'Phase 1 — Web Fundamentals' },
    { id: 'python', name: 'Python for Absolute Beginners', phase: 'Phase 1 — First Programs' },
    { id: 'arch', name: 'Computer Architecture', phase: 'Phase 1 — How a CPU Thinks' },
    { id: 'neural', name: 'Neural Networks from Scratch', phase: 'Phase 1 — Math & Tensors' },
    { id: 'linux', name: 'Linux & the Shell', phase: 'Phase 1 — Command Line Fluency' },
    { id: 'security', name: 'Web Security Basics', phase: 'Phase 1 — How the Web Works' }
  ];

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const user = Auth.getUser();
    if (!user) {
      locked.hidden = false;
      panels.hidden = true;
      return;
    }
    locked.hidden = true;
    panels.hidden = false;

    document.getElementById('accTitle').textContent = 'Hi, ' + (user.name || user.email).split(' ')[0];
    document.getElementById('accLead').textContent =
      user.role === 'admin'
        ? 'Admin account — Pro on everything, plus the console.'
        : (Auth.hasPro() ? 'You have Pro — every phase is open.' : 'Your plan, theme and progress in one place.');

    document.getElementById('accMe').innerHTML =
      '<span class="admin__avatar">' + escapeHtml((user.name || user.email).charAt(0).toUpperCase()) + '</span>' +
      '<span class="admin__meinfo"><b>' + escapeHtml(user.name || user.email) + '</b><small>' + escapeHtml(user.email) + '</small></span>' +
      (user.role === 'admin' ? '<span class="admin__role">ADMIN</span>' :
        (Auth.hasPro() ? '<span class="member__plan is-pro">PRO</span>' : ''));

    const isPro = Auth.hasPro();
    document.getElementById('planValue').textContent = isPro ? 'Pro — every phase' : 'Free — Phase 1 only';
    document.getElementById('providerValue').textContent = user.provider || 'local';
    document.getElementById('sinceValue').textContent =
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

    const planBtn = document.getElementById('planBtn');
    if (isPro) {
      planBtn.textContent = 'Pro is active';
      planBtn.classList.add('is-on');
      planBtn.setAttribute('href', 'index.html#courses');
    } else {
      planBtn.textContent = 'Join Pro — $4.99/mo';
      planBtn.classList.remove('is-on');
      planBtn.setAttribute('href', 'checkout.html');
    }

    const adminLink = document.getElementById('adminLink');
    adminLink.hidden = user.role !== 'admin';

    const pref = Auth.getTheme();
    themesEl.querySelectorAll('.theme').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.themeMode === pref);
    });

    const list = COURSE_LIST.map(function (c) {
      return '<a class="member" href="index.html?course=' + c.id + '&phase=p1#courses">' +
        '<span class="member__avatar">' + escapeHtml(c.name.charAt(0)) + '</span>' +
        '<span class="member__info"><b>' + escapeHtml(c.name) + '</b><small>' + escapeHtml(c.phase) + '</small></span>' +
        '<span class="member__plan' + (isPro ? ' is-pro' : '') + '">' + (isPro ? 'PRO' : 'FREE') + '</span>' +
        '</a>';
    }).join('');
    document.getElementById('myCourses').innerHTML = list;
  }

  themesEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-theme-mode]');
    if (!btn) return;
    Auth.setTheme(btn.dataset.themeMode);
    render();
  });

  document.getElementById('signOutBtn').addEventListener('click', function () {
    Auth.signOut();
    window.location.href = 'index.html';
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (Auth.getTheme() === 'system') { Auth.applyTheme(); render(); }
    });
  }

  render();
})();
