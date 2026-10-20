/* ============================================================
   Build with YOU — checkout page
   Same background engine, same neubrutalist theme, plus the
   payment form logic and the hand-off back to the course.
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const PRO_PRICE = '4.99';

  /* ------------------------------------------------------------
     BACKGROUND (same engine as the main site)
  ------------------------------------------------------------ */
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
    for (let i = 0; i < 6; i++) {
      const p = PALETTE[i % PALETTE.length];
      blobs.push({
        color: p,
        ax: 0.12 + Math.random() * 0.76,
        ay: 0.10 + Math.random() * 0.80,
        x: 0, y: 0, tx: 0, ty: 0,
        r: 0.22 + Math.random() * 0.24,
        sx: 0.10 + Math.random() * 0.20,
        sy: 0.08 + Math.random() * 0.18,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.8,
        alpha: 0.30 + Math.random() * 0.22
      });
    }
  }

  function resizeCanvas() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawBackground(time) {
    ctx.clearRect(0, 0, W, H);
    const t = time * 0.001;
    const scroll = window.scrollY || 0;
    const progress = Math.min(1, scroll / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    const phase = scroll * 0.0016;

    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      b.tx = b.ax + Math.cos(t * b.sx + b.px + phase) * 0.20 + Math.sin(t * b.sx * 0.43 + b.px) * 0.05;
      b.ty = b.ay + Math.sin(t * b.sy + b.py + phase) * 0.18 - progress * 0.10 * b.depth;
      b.x = lerp(b.x, b.tx, 0.05);
      b.y = lerp(b.y, b.ty, 0.05);

      const radius = b.r * Math.min(W, H);
      const x = b.x * W, y = b.y * H;
      const g = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
      const h = (b.color.h + progress * 120) % 360;
      g.addColorStop(0, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,' + b.alpha + ')');
      g.addColorStop(0.45, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,' + (b.alpha * 0.45) + ')');
      g.addColorStop(1, 'hsla(' + h + ',' + b.color.s + '%,' + b.color.l + '%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let last = performance.now();
  let lastTick = performance.now();
  function tick(time) {
    last = time; lastTick = time;
    drawBackground(time);
  }
  function frame(time) { requestAnimationFrame(frame); tick(time); }
  function ensureFallback() {
    setInterval(() => {
      const now = performance.now();
      if (now - lastTick < 200) return;
      tick(now);
    }, 32);
  }

  /* ------------------------------------------------------------
     CONTEXT FROM THE COURSE MODAL
  ------------------------------------------------------------ */
  const params = new URLSearchParams(location.search);
  const courseId = params.get('course') || '';
  const phaseId = params.get('phase') || '';
  const courseName = params.get('name') || '';

  if (courseName) {
    const el = document.getElementById('summaryCourse');
    if (el) el.textContent = 'Unlocks every phase of every course — including the deep phases of “' + courseName + '”.';
  }

  const COURSE_LABELS = {
    os: 'Make your own OS', web: 'Web from Scratch', python: 'Python for Absolute Beginners',
    arch: 'Computer Architecture', neural: 'Neural Networks from Scratch',
    linux: 'Linux & the Shell', security: 'Web Security Basics'
  };
  if (courseId && COURSE_LABELS[courseId]) {
    document.title = 'Checkout — Pro membership | Build with YOU';
    const head = document.querySelector('.summary__product h2');
    if (head) head.textContent = 'Build with YOU Pro · ' + COURSE_LABELS[courseId];
  }

  /* ------------------------------------------------------------
     CARD FORMATTING
  ------------------------------------------------------------ */
  const cardInput = document.getElementById('cardnumber');
  const expiryInput = document.getElementById('expiry');
  const cvcInput = document.getElementById('cvc');
  const cardBrand = document.getElementById('cardBrand');

  if (cardInput) {
    cardInput.addEventListener('input', () => {
      const digits = cardInput.value.replace(/\D/g, '').slice(0, 16);
      cardInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
      const d = digits;
      let brand = 'CARD';
      if (/^4/.test(d)) brand = 'VISA';
      else if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) brand = 'MC';
      else if (/^3[47]/.test(d)) brand = 'AMEX';
      else if (/^6/.test(d)) brand = 'DISC';
      if (cardBrand) cardBrand.textContent = brand;
    });
  }

  if (expiryInput) {
    expiryInput.addEventListener('input', () => {
      let v = expiryInput.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      expiryInput.value = v;
    });
  }

  if (cvcInput) {
    cvcInput.addEventListener('input', () => {
      cvcInput.value = cvcInput.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  /* ------------------------------------------------------------
     VALIDATION + PAY
  ------------------------------------------------------------ */
  function setError(name, msg) {
    const box = document.querySelector('.field__error[data-for="' + name + '"]');
    const input = document.getElementById(name);
    if (box) {
      box.textContent = msg || '';
      box.classList.toggle('is-shown', !!msg);
    }
    if (input) input.classList.toggle('is-invalid', !!msg);
    return !msg;
  }

  function luhnOk(num) {
    const s = num.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(s)) return false;
    let sum = 0, alt = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let n = parseInt(s[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function validate() {
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('cardname').value.trim();
    const card = document.getElementById('cardnumber').value.trim();
    const exp = document.getElementById('expiry').value.trim();
    const cvc = document.getElementById('cvc').value.trim();

    let ok = true;
    ok = setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Enter a valid email address.') && ok;
    ok = setError('cardname', name.length >= 2 ? '' : 'Enter the name on your card.') && ok;
    ok = setError('cardnumber', luhnOk(card) ? '' : 'That card number is not valid.') && ok;

    const em = exp.match(/^(\d{2})\/(\d{2})$/);
    let expErr = 'Use MM/YY.';
    if (em) {
      const mm = parseInt(em[1], 10);
      const yy = parseInt(em[2], 10);
      const now = new Date();
      const curY = now.getFullYear() % 100, curM = now.getMonth() + 1;
      if (mm < 1 || mm > 12) expErr = 'Month must be 01–12.';
      else if (yy < curY || (yy === curY && mm < curM)) expErr = 'That card has expired.';
      else expErr = '';
    }
    ok = setError('expiry', expErr) && ok;
    ok = setError('cvc', /^\d{3,4}$/.test(cvc) ? '' : 'CVC is 3 or 4 digits.') && ok;
    return ok;
  }

  const form = document.getElementById('payForm');
  const payBtn = document.getElementById('payBtn');
  const success = document.getElementById('paySuccess');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) {
        const firstBad = form.querySelector('.is-invalid');
        if (firstBad) firstBad.focus();
        return;
      }

      payBtn.disabled = true;
      payBtn.querySelector('span').textContent = 'Processing…';

      // pretend a payment gateway round-trip
      setTimeout(() => {
        // unlock Pro for this browser (and for the signed-in account)
        try { localStorage.setItem('bwy_pro', '1'); } catch (err) {}
        if (window.Auth) {
          try { Auth.setPro(true); } catch (err) {}
        }

        const email = document.getElementById('email').value.trim();
        const next = new Date();
        next.setDate(next.getDate() + 30);
        const receipt = document.getElementById('receiptEmail');
        if (receipt) receipt.textContent = email || 'sent by email';
        const nb = document.getElementById('nextBilling');
        if (nb) nb.textContent = next.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

        const msg = document.getElementById('successMsg');
        if (msg) {
          msg.textContent = courseName
            ? '“' + courseName + '” is fully unlocked — every phase, every lab. The creator says thank you.'
            : 'Every phase of every course is unlocked. The creator says thank you.';
        }

        // hand back to the course we came from
        const cont = document.getElementById('continueBtn');
        if (cont) {
          const back = 'index.html' + (courseId ? '?course=' + encodeURIComponent(courseId) + (phaseId ? '&phase=' + encodeURIComponent(phaseId) : '') : '') + '#courses';
          cont.setAttribute('href', back);
        }

        form.hidden = true;
        success.hidden = false;
        window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      }, 1100);
    });
  }

  /* ------------------------------------------------------------
     BOOT
  ------------------------------------------------------------ */
  makeBlobs();
  resizeCanvas();
  tick(performance.now());
  requestAnimationFrame(frame);
  ensureFallback();

  window.addEventListener('resize', () => {
    clearTimeout(window.__rz);
    window.__rz = setTimeout(resizeCanvas, 120);
  });
})();
