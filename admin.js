/* ============================================================
   Build with YOU — admin console
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- background (same engine) ---------------- */
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
    const count = window.innerWidth <= 860 ? 4 : 6;
    for (let i = 0; i < count; i++) {
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
    W = window.innerWidth; H = window.innerHeight;
    const small = W <= 640, mobile = W <= 860;
    const scale = small ? 0.62 : (mobile ? 0.8 : 1);
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2) * scale;
    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    canvas.style.width = '100%'; canvas.style.height = '100%';
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
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

  /* ---------------- admin console ---------------- */
  const locked = document.getElementById('locked');
  const panels = document.getElementById('panels');
  const membersEl = document.getElementById('members');
  const themesEl = document.getElementById('themes');
  const defaultThemeEl = document.getElementById('defaultTheme');

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const user = Auth.getUser();

    if (!user || user.role !== 'admin') {
      locked.hidden = false;
      panels.hidden = true;
      document.getElementById('adminMe').innerHTML = '';
      return;
    }

    locked.hidden = true;
    panels.hidden = false;

    document.getElementById('adminMe').innerHTML =
      '<span class="admin__avatar">' + escapeHtml((user.name || user.email).charAt(0).toUpperCase()) + '</span>' +
      '<span class="admin__meinfo"><b>' + escapeHtml(user.name || user.email) + '</b><small>' + escapeHtml(user.email) + '</small></span>' +
      '<span class="admin__role">ADMIN</span>';

    document.getElementById('myPlan').textContent = user.plan === 'pro' ? 'Pro — every phase' : 'Free';
    document.getElementById('myRole').textContent = user.role;
    document.getElementById('mySince').textContent =
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

    const proBtn = document.getElementById('proToggle');
    proBtn.textContent = Auth.hasPro() ? 'Pro active on this account' : 'Grant Pro to my account';
    proBtn.classList.toggle('is-on', Auth.hasPro());

    // theme states
    const pref = Auth.getTheme();
    const def = Auth.getDefaultTheme();
    themesEl.querySelectorAll('.theme').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.themeMode === pref);
    });
    defaultThemeEl.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.themeMode === def);
    });

    // members
    const list = Auth.adminUsers();
    if (!list.length) {
      membersEl.innerHTML = '<p class="admin__empty">No local accounts yet. Members created on this device appear here.</p>';
    } else {
      membersEl.innerHTML = list.map(function (u) {
        const isPro = u.plan === 'pro' || u.role === 'admin';
        return '<div class="member">' +
          '<span class="member__avatar">' + escapeHtml((u.name || u.email).charAt(0).toUpperCase()) + '</span>' +
          '<span class="member__info"><b>' + escapeHtml(u.name || u.email) + '</b><small>' + escapeHtml(u.email) + ' · via ' + escapeHtml(u.provider || 'local') + '</small></span>' +
          '<span class="member__plan ' + (isPro ? 'is-pro' : '') + '">' + (isPro ? 'PRO' : 'FREE') + '</span>' +
          '<button class="btn btn--sm ' + (isPro ? 'btn--ghost' : 'btn--dark') + '" type="button" data-toggle-plan="' + escapeHtml(u.email) + '">' +
            (isPro ? 'Revoke Pro' : 'Grant Pro') +
          '</button>' +
          '<button class="btn btn--sm ' + (u.role === 'admin' ? 'btn--ghost' : 'btn--dark') + '" type="button" data-toggle-role="' + escapeHtml(u.email) + '">' +
            (u.role === 'admin' ? 'Demote' : 'Make admin') +
          '</button>' +
          '</div>';
      }).join('');
    }
  }

  /* theme switching */
  themesEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-theme-mode]');
    if (!btn) return;
    Auth.setTheme(btn.dataset.themeMode);
    render();
  });

  defaultThemeEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-theme-mode]');
    if (!btn) return;
    Auth.setDefaultTheme(btn.dataset.themeMode);
    render();
  });

  /* pro toggle */
  document.getElementById('proToggle').addEventListener('click', function () {
    Auth.setPro(!Auth.hasPro());
    render();
  });

  /* member actions */
  membersEl.addEventListener('click', function (e) {
    const planBtn = e.target.closest('[data-toggle-plan]');
    if (planBtn) {
      const email = planBtn.dataset.togglePlan;
      const u = Auth.adminUsers().find(function (x) { return x.email === email; });
      const isPro = u && (u.plan === 'pro' || u.role === 'admin');
      Auth.adminSetPlan(email, isPro ? 'free' : 'pro');
      render();
      return;
    }
    const roleBtn = e.target.closest('[data-toggle-role]');
    if (roleBtn) {
      const email = roleBtn.dataset.toggleRole;
      const u = Auth.adminUsers().find(function (x) { return x.email === email; });
      Auth.adminSetRole(email, u && u.role === 'admin' ? 'user' : 'admin');
      render();
    }
  });

  /* sign out */
  document.getElementById('signOutBtn').addEventListener('click', function () {
    Auth.signOut();
    window.location.href = 'index.html';
  });

  /* follow the OS theme when set to "system" */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (Auth.getTheme() === 'system') { Auth.applyTheme(); render(); }
    });
  }

  render();
})();
