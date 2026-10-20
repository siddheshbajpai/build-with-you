/* ============================================================
   Build with YOU — login page logic
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- background engine (same as the site) ---------------- */
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0;
  const PALETTE = [
    { h: 44, s: 100, l: 66 }, { h: 340, s: 100, l: 68 }, { h: 188, s: 96, l: 58 },
    { h: 262, s: 100, l: 76 }, { h: 22, s: 100, l: 65 }, { h: 142, s: 85, l: 66 },
    { h: 205, s: 95, l: 72 }
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
      b.x = lerp(b.x, b.tx, 0.05);
      b.y = lerp(b.y, b.ty, 0.05);
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
    setInterval(() => {
      const now = performance.now();
      if (now - lastTick < 200) return;
      tick(now);
    }, 32);
  }
  makeBlobs(); resizeCanvas(); tick(performance.now());
  requestAnimationFrame(frame); ensureFallback();
  window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resizeCanvas, 120); });

  /* ---------------- provider buttons ---------------- */
  const providersEl = document.getElementById('providers');
  const mode = { value: 'signin' };

  function renderProviders() {
    providersEl.innerHTML = Object.keys(Auth.PROVIDERS).map(function (key) {
      const p = Auth.PROVIDERS[key];
      const live = Auth.isConfigured(key);
      return '<button class="oauthbtn oauthbtn--' + key + '" type="button" data-provider="' + key + '">' +
        '<span class="oauthbtn__icon">' + p.icon + '</span>' +
        '<span class="oauthbtn__label">Continue with ' + p.label + '</span>' +
        '<span class="oauthbtn__tag">' + (live ? 'OAuth' : 'Demo') + '</span>' +
        '</button>';
    }).join('');
  }
  renderProviders();

  providersEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-provider]');
    if (!btn) return;
    const key = btn.dataset.provider;
    msg('');
    btn.classList.add('is-busy');
    Auth.startOAuth(key).then(function (user) {
      if (user) afterSignIn(user);
    }).catch(function (err) {
      btn.classList.remove('is-busy');
      msg(err.message || 'Could not sign in.', true);
    });
  });

  /* ---------------- tabs ---------------- */
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const nameField = document.getElementById('nameField');
  const submitLabel = document.getElementById('submitLabel');
  const submitBtn = document.getElementById('submitBtn');

  function setMode(next) {
    mode.value = next;
    const isUp = next === 'signup';
    tabSignIn.classList.toggle('is-active', !isUp);
    tabSignUp.classList.toggle('is-active', isUp);
    tabSignIn.setAttribute('aria-selected', String(!isUp));
    tabSignUp.setAttribute('aria-selected', String(isUp));
    nameField.hidden = !isUp;
    submitLabel.textContent = isUp ? 'Create account' : 'Sign in';
    document.getElementById('password').setAttribute('autocomplete', isUp ? 'new-password' : 'current-password');
  }
  tabSignIn.addEventListener('click', function () { setMode('signin'); });
  tabSignUp.addEventListener('click', function () { setMode('signup'); });

  /* ---------------- show / hide password ---------------- */
  const revealBtn = document.getElementById('revealBtn');
  const passwordInput = document.getElementById('password');
  revealBtn.addEventListener('click', function () {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    revealBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    revealBtn.classList.toggle('is-on', !showing);
  });

  /* ---------------- messages ---------------- */
  function msg(text, isError) {
    const el = document.getElementById('authMsg');
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
    el.classList.toggle('is-ok', !!text && !isError);
  }
  function setError(name, text) {
    const box = document.querySelector('.field__error[data-for="' + name + '"]');
    const input = document.getElementById(name);
    if (box) { box.textContent = text || ''; box.classList.toggle('is-shown', !!text); }
    if (input) input.classList.toggle('is-invalid', !!text);
    return !text;
  }

  /* ---------------- submit ---------------- */
  const form = document.getElementById('authForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const name = document.getElementById('name').value.trim();

    let ok = true;
    ok = setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Enter a valid email address.') && ok;
    ok = setError('password', password.length >= (mode.value === 'signup' ? 8 : 6) ? '' : 'Password must be at least ' + (mode.value === 'signup' ? 8 : 6) + ' characters.') && ok;
    if (!ok) return;

    submitBtn.disabled = true;
    submitLabel.textContent = mode.value === 'signup' ? 'Creating…' : 'Signing in…';

    const action = mode.value === 'signup'
      ? Auth.signUp(name, email, password)
      : Auth.signIn(email, password);

    action.then(function (user) {
      afterSignIn(user);
    }).catch(function (err) {
      submitBtn.disabled = false;
      submitLabel.textContent = mode.value === 'signup' ? 'Create account' : 'Sign in';
      msg(err.message || 'Something went wrong.', true);
    });
  });

  function afterSignIn(user) {
    if (user.role === 'admin') {
      msg('Admin signed in — full Pro access and theme controls unlocked.');
    } else {
      msg('Welcome, ' + (user.name || user.email) + '! Redirecting…');
    }
    setTimeout(function () {
      const target = new URLSearchParams(window.location.search).get('next') || 'index.html';
      window.location.href = target;
    }, 900);
  }

  /* ---------------- forgot password ---------------- */
  document.getElementById('forgot').addEventListener('click', function (e) {
    e.preventDefault();
    msg('Reset links are sent by the server in production — for now, ask the site admin.');
  });

  /* ---------------- OAuth callback ---------------- */
  Auth.handleOAuthCallback().then(function (user) {
    if (user) afterSignIn(user);
  }).catch(function (err) {
    msg(err.message || 'Sign-in failed.', true);
  });

  /* already signed in? jump straight in */
  const existing = Auth.getUser();
  if (existing && !new URLSearchParams(window.location.search).get('force')) {
    msg('Signed in as ' + (existing.name || existing.email) + ' — taking you in…');
    setTimeout(function () {
      window.location.href = new URLSearchParams(window.location.search).get('next') || 'index.html';
    }, 700);
  }
})();
