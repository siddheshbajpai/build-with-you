/* ============================================================
   Build with YOU — auth layer
   A small, dependency-free front-end auth library:
     - OAuth start + callback handling for Google / Discord / GitHub
     - local email + password accounts (salted + SHA-256 hashed)
     - a seeded ADMIN account with full Pro access
     - theme preference (light / dark / system) + admin defaults
   NOTE: this is a client-side demo auth layer. Real enforcement
   needs a server; the token exchange endpoint is pluggable.
   ============================================================ */
window.Auth = (function () {
  'use strict';

  const KEYS = {
    user: 'bwy_user',
    users: 'bwy_users',
    pro: 'bwy_pro',
    theme: 'bwy_theme',
    defaultTheme: 'bwy_default_theme'
  };

  const CONFIG = window.AUTH_CONFIG || {};

  /* ---------------- seeded admin account ---------------- */
  const ADMIN = {
    email: 'admin@buildwithyou.dev',
    password: 'Admin@2026',
    name: 'Site Admin',
    role: 'admin'
  };

  const PROVIDERS = {
    google: {
      label: 'Google',
      color: '#EA4335',
      icon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.6v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6H1.6a12 12 0 0 0 0 10.8l3.7-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.6 6.6l3.7 3.1A7.2 7.2 0 0 1 12 4.8z"/></svg>',
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'openid email profile'
    },
    discord: {
      label: 'Discord',
      color: '#5865F2',
      icon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#5865F2" d="M19.3 5.3A16.7 16.7 0 0 0 15.2 4l-.2.4a15 15 0 0 1 3.7 1.5 12.7 12.7 0 0 0-10.9 0A15 15 0 0 1 12.5 4.4L12.3 4a16.7 16.7 0 0 0-4.1 1.3C5.3 9.2 4.6 13 5 16.7a16.9 16.9 0 0 0 5.1 2.6l1-1.7a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 10.4 0l.4.3a11 11 0 0 1-1.7.8l1 1.7a16.8 16.8 0 0 0 5.1-2.6c.5-4.3-.6-8-3.7-11.4zM9.7 14.3c-1 0-1.9-.9-1.9-2.1 0-1.2.8-2.1 1.9-2.1s1.9.9 1.9 2.1c0 1.2-.8 2.1-1.9 2.1zm4.6 0c-1 0-1.9-.9-1.9-2.1 0-1.2.8-2.1 1.9-2.1s1.9.9 1.9 2.1c0 1.2-.8 2.1-1.9 2.1z"/></svg>',
      authorize: 'https://discord.com/oauth2/authorize',
      scope: 'identify email'
    },
    github: {
      label: 'GitHub',
      color: '#181717',
      icon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 1.3a10.7 10.7 0 0 0-3.4 20.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.3-.3-4.7-1.1-4.7-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.7 10.7 0 0 0 12 1.3z"/></svg>',
      authorize: 'https://github.com/login/oauth/authorize',
      scope: 'read:user user:email'
    }
  };

  /* ---------------- tiny storage helpers ---------------- */
  function read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  /* ---------------- password hashing ---------------- */
  function randomSalt() {
    const arr = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(salt + '::' + password);
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest('SHA-256', data).then(buf =>
        Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      );
    }
    // fallback (non-secure context): a simple deterministic digest
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const s = salt + '::' + password;
    for (let i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) * 0x01000193) >>> 0;
      h2 = ((h2 + s.charCodeAt(i) * (i + 7)) * 0x85ebca6b) >>> 0;
    }
    return Promise.resolve((h1.toString(16) + h2.toString(16)) + (s.length.toString(16)));
  }

  /* ---------------- users ---------------- */
  function allUsers() { return read(KEYS.users, []); }
  function saveUsers(list) { write(KEYS.users, list); }

  function findUser(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    if (e === ADMIN.email.toLowerCase()) {
      return {
        email: ADMIN.email, name: ADMIN.name, role: 'admin', provider: 'local',
        salt: 'admin-salt', hash: null, plan: 'pro'
      };
    }
    return allUsers().find(u => u.email === e) || null;
  }

  function publicUser(u) {
    if (!u) return null;
    return {
      email: u.email,
      name: u.name || u.email.split('@')[0],
      role: u.role || 'user',
      provider: u.provider || 'local',
      plan: u.plan || 'free',
      createdAt: u.createdAt || Date.now()
    };
  }

  /* ---------------- session ---------------- */
  function getUser() {
    const u = read(KEYS.user, null);
    if (!u || !u.email) return null;
    // admin always holds Pro, whatever the stored flag says
    if (u.role === 'admin' && u.plan !== 'pro') { u.plan = 'pro'; write(KEYS.user, u); }
    return u;
  }
  function setUser(u) { write(KEYS.user, u); }
  function signOut() {
    remove(KEYS.user);
    remove(KEYS.pro);
  }
  function isAdmin() { const u = getUser(); return !!u && u.role === 'admin'; }
  function isSignedIn() { return !!getUser(); }
  function hasPro() {
    const u = getUser();
    if (u && (u.role === 'admin' || u.plan === 'pro')) return true;
    return read(KEYS.pro, false) === true;
  }
  function setPro(on) {
    write(KEYS.pro, !!on);
    const u = getUser();
    if (u) { u.plan = on ? 'pro' : 'free'; setUser(u); }
    syncUserRecords();
  }

  function syncUserRecords() {
    const u = getUser();
    if (!u) return;
    const list = allUsers();
    const i = list.findIndex(x => x.email === u.email);
    if (i === -1) {
      list.push({ email: u.email, name: u.name, role: u.role, provider: u.provider, plan: u.plan, createdAt: u.createdAt });
    } else {
      list[i].plan = u.plan;
      list[i].name = u.name;
      list[i].role = u.role;
    }
    saveUsers(list);
  }

  /* ---------------- local email + password ---------------- */
  function signUp(name, email, password) {
    const e = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return Promise.reject(new Error('Enter a valid email address.'));
    if (String(password || '').length < 8) return Promise.reject(new Error('Password must be at least 8 characters.'));
    if (findUser(e)) return Promise.reject(new Error('An account with that email already exists.'));

    const salt = randomSalt();
    return hashPassword(password, salt).then(hash => {
      const rec = {
        email: e, name: String(name || '').trim() || e.split('@')[0],
        salt, hash, role: 'user', provider: 'local', plan: 'free', createdAt: Date.now()
      };
      const list = allUsers();
      list.push(rec);
      saveUsers(list);
      const session = publicUser(rec);
      setUser(session);
      syncUserRecords();
      return session;
    });
  }

  function signIn(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const rec = findUser(e);
    if (!rec) return Promise.reject(new Error('No account found for that email.'));
    if (rec.role === 'admin') {
      if (password !== ADMIN.password) return Promise.reject(new Error('Incorrect password.'));
      const session = publicUser(rec);
      session.plan = 'pro';
      setUser(session);
      write(KEYS.pro, true);
      return Promise.resolve(session);
    }
    return hashPassword(password, rec.salt).then(hash => {
      if (hash !== rec.hash) throw new Error('Incorrect password.');
      const session = publicUser(rec);
      setUser(session);
      syncUserRecords();
      return session;
    });
  }

  /* ---------------- OAuth ---------------- */
  function isConfigured(provider) {
    const c = CONFIG[provider];
    return !!(c && c.clientId && c.redirectUri && !CONFIG.forceDemo);
  }

  function randomState() {
    return randomSalt();
  }

  function redirectUri(provider) {
    const c = CONFIG[provider] || {};
    return c.redirectUri || (window.location.origin + window.location.pathname);
  }

  function startOAuth(provider) {
    const p = PROVIDERS[provider];
    if (!p) return Promise.reject(new Error('Unknown provider'));

    if (!isConfigured(provider)) {
      // demo mode: no client id yet, sign in with a local identity
      return Promise.resolve(demoSignIn(provider));
    }

    const state = randomState();
    try { sessionStorage.setItem('bwy_oauth_state', state); } catch (e) {}
    const url = p.authorize + '?client_id=' + encodeURIComponent(CONFIG[provider].clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri(provider)) +
      '&response_type=code&scope=' + encodeURIComponent(p.scope) +
      '&state=' + encodeURIComponent(state) +
      (provider === 'discord' ? '&prompt=consent' : '');
    window.location.href = url;
    return new Promise(function () {}); // navigation in progress
  }

  function demoSignIn(provider) {
    const p = PROVIDERS[provider];
    const names = { google: 'Alex Google', discord: 'Riley Discord', github: 'Sam GitHub' };
    const session = {
      email: provider + '@member.buildwithyou.dev',
      name: names[provider] || p.label + ' Member',
      role: 'user', provider: provider, plan: 'free', createdAt: Date.now()
    };
    setUser(session);
    syncUserRecords();
    return session;
  }

  /* handle ?code=...&state=... coming back from a provider */
  function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const provider = params.get('provider') || params.get('bwy_provider');
    if (!code || !provider) return Promise.resolve(null);

    let saved = null;
    try { saved = sessionStorage.getItem('bwy_oauth_state'); } catch (e) {}
    if (saved && state && saved !== state) {
      return Promise.reject(new Error('Sign-in could not be verified. Please try again.'));
    }

    // If a backend exchange endpoint is configured, use it.
    if (CONFIG.exchangeUrl) {
      return fetch(CONFIG.exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, code: code, redirect_uri: redirectUri(provider) })
      }).then(r => r.json()).then(data => {
        const session = {
          email: data.email, name: data.name || data.email.split('@')[0],
          role: data.role || 'user', provider: provider, plan: data.plan || 'free',
          createdAt: Date.now()
        };
        setUser(session);
        syncUserRecords();
        return session;
      });
    }

    // No backend: complete locally so the flow still works.
    return Promise.resolve(demoSignIn(provider));
  }

  /* ---------------- theme ---------------- */
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function effectiveTheme() {
    const pref = getTheme();
    if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return pref;
  }

  function getTheme() {
    return read(KEYS.theme, null) || read(KEYS.defaultTheme, 'light') || 'light';
  }

  function setTheme(mode) {
    const m = mode === 'dark' || mode === 'light' || mode === 'system' ? mode : 'light';
    write(KEYS.theme, m);
    applyTheme();
    return m;
  }

  function applyTheme() {
    const t = effectiveTheme();
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    return t;
  }

  function setDefaultTheme(mode) {
    const m = mode === 'dark' || mode === 'light' || mode === 'system' ? mode : 'light';
    write(KEYS.defaultTheme, m);
    applyTheme();
    return m;
  }

  function getDefaultTheme() {
    return read(KEYS.defaultTheme, 'light') || 'light';
  }

  /* ---------------- admin ---------------- */
  function adminUsers() {
    const list = allUsers().map(publicUser);
    const u = getUser();
    if (u && u.role === 'admin' && !list.some(x => x.email === u.email)) list.unshift(u);
    return list;
  }

  function adminSetPlan(email, plan) {
    const list = allUsers();
    const i = list.findIndex(x => x.email === email);
    if (i !== -1) { list[i].plan = plan; saveUsers(list); }
    const u = getUser();
    if (u && u.email === email) { u.plan = plan; setUser(u); }
    if (plan === 'pro') write(KEYS.pro, true); else remove(KEYS.pro);
  }

  function adminSetRole(email, role) {
    const list = allUsers();
    const i = list.findIndex(x => x.email === email);
    if (i !== -1) { list[i].role = role; saveUsers(list); }
    const u = getUser();
    if (u && u.email === email) { u.role = role; setUser(u); }
  }

  return {
    PROVIDERS: PROVIDERS,
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD: ADMIN.password,
    isConfigured: isConfigured,
    getUser: getUser,
    setUser: setUser,
    isSignedIn: isSignedIn,
    isAdmin: isAdmin,
    hasPro: hasPro,
    setPro: setPro,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    startOAuth: startOAuth,
    handleOAuthCallback: handleOAuthCallback,
    getTheme: getTheme,
    setTheme: setTheme,
    setDefaultTheme: setDefaultTheme,
    getDefaultTheme: getDefaultTheme,
    applyTheme: applyTheme,
    effectiveTheme: effectiveTheme,
    adminUsers: adminUsers,
    adminSetPlan: adminSetPlan,
    adminSetRole: adminSetRole,
    CONFIG: CONFIG
  };
})();
